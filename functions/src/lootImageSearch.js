// functions/src/lootImageSearch.js
//
// Created by Miguel Brown on 2026-05-20.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// HTTPS-callable that runs an IMAGE search through the Brave Search
// API on behalf of the LOOT admin assistant. Sister function to
// lootWebSearch (ITEM 9c.3) — same auth model, same secret, same
// quota collection, just a different Brave endpoint and an extra
// per-result HEAD-check to confirm each candidate URL actually
// serves a real image.
//
// Round 2.5 — powers the "🤖 Find via AI" button on the coverUrl
// row of the Refresh-diff modal. fetchPage's cheerio extraction
// strips <img> tags during text extraction, so getting image URLs
// out of regular web search is awkward. This dedicated endpoint
// returns clean image candidates with direct URLs.
//
// Security model
// ──────────────────────────────────────────────────────────────────
//   - Caller must be authenticated AND carry `admin: true` and
//     `tenant: <tenantId>` custom claims (matches lootWebSearch).
//   - Per-UID daily quota counter `imageSearchCount` — separate
//     from `searchCount`/`fetchCount` so image searches don't
//     compete for the same budget. Default 50/day per UID.
//   - Brave API key from Secret Manager (BRAVE_SEARCH_API_KEY).
//   - safesearch=strict — kids' reading program.
//
// App Check: deferred (matches the rest of functions/).

"use strict";

const {defineSecret} = require("firebase-functions/params");
const {HttpsError, onCall} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const REGION = "us-central1";
const braveKey = defineSecret("BRAVE_SEARCH_API_KEY");

// ── CONFIG ────────────────────────────────────────────────────────

/** Hard daily cap on image searches per UID. Independent of the
 * web-search and fetch caps so book-cover hunting doesn't eat into
 * the quota reserved for sponsor verification + summary fetches. */
const QUOTA_PER_DAY = 50;

/** Hard cap on how many image candidates we request from Brave per
 * call. Brave's image endpoint maxes out around 100; we ask for far
 * less and then validate them server-side. */
const MAX_COUNT = 8;
const DEFAULT_COUNT = 5;

/** Hard cap on user-supplied query length. */
const MAX_QUERY_LENGTH = 380;

/** HEAD-probe timeout per candidate URL during validation. */
const VALIDATE_TIMEOUT_MS = 4000;

/** Reject images smaller than this byte size — rules out tracking
 * pixels, broken icons, and the OL placeholder-style 1×1 png. Real
 * book covers from Goodreads/publisher CDNs are typically 20-200KB. */
const MIN_IMAGE_BYTES = 5000;

// ── HELPERS ───────────────────────────────────────────────────────

/**
 * UTC date key for the quota doc. Matches lootWebSearch.js +
 * lootFetchPage.js.
 *
 * @return {string} `YYYY-MM-DD`.
 */
function todayUtcKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomic read-check-increment of the per-UID daily imageSearchCount.
 * Doc shape shared with lootWebSearch.js / lootFetchPage.js —
 * different field, same /_loot_meta/{tenant_uid_date} container.
 *
 * @param {object} db
 * @param {string} tenant
 * @param {string} uid
 * @return {Promise<number>} The post-increment count.
 */
async function enforceQuota(db, tenant, uid) {
  const date = todayUtcKey();
  const docId = `${tenant}_${uid}_${date}`;
  const ref = db.collection("_loot_meta").doc(docId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data().imageSearchCount || 0) : 0;

    if (cur >= QUOTA_PER_DAY) {
      throw new HttpsError(
          "resource-exhausted",
          `Daily image-search cap hit (${QUOTA_PER_DAY}/day). ` +
          `Resets at midnight UTC.`,
      );
    }

    const next = cur + 1;
    if (snap.exists) {
      tx.update(ref, {
        imageSearchCount: next,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(ref, {
        tenantId: tenant,
        uid: uid,
        date: date,
        searchCount: 0,
        fetchCount: 0,
        imageSearchCount: next,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return next;
  });
}

/**
 * Hit Brave's `/v1/images/search` endpoint and normalize the
 * response into a flat array of candidate image objects.
 *
 * Brave's response shape:
 *   { results: [ { title, url (page url),
 *                  properties: { url (direct image), placeholder },
 *                  thumbnail: { src, original }, source, ... } ] }
 *
 * @param {string} apiKey
 * @param {string} query
 * @param {number} count
 * @return {Promise<Array<object>>}
 *     Each result: {title, url (direct image), thumbnailUrl, source, host}.
 */
async function callBraveImages(apiKey, query, count) {
  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("safesearch", "strict");

  let res;
  try {
    res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });
  } catch (err) {
    throw new HttpsError(
        "unavailable",
        `Couldn't reach Brave image search: ${err.message || "network error"}.`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new HttpsError(
        "internal",
        "Brave Search rejected our API key. The operator needs to " +
        "re-set BRAVE_SEARCH_API_KEY.",
    );
  }
  if (res.status === 429) {
    throw new HttpsError(
        "resource-exhausted",
        "Brave Search is rate-limiting us. Try again in a minute.",
    );
  }
  if (!res.ok) {
    throw new HttpsError(
        "unavailable",
        `Brave image search returned HTTP ${res.status}.`,
    );
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new HttpsError(
        "internal",
        `Brave image search returned non-JSON: ` +
        `${err.message || "parse error"}.`,
    );
  }

  const raw = Array.isArray(body && body.results) ? body.results : [];
  return raw.slice(0, MAX_COUNT).map((r) => {
    const directUrl = (r.properties && r.properties.url) || null;
    const thumbUrl = (r.thumbnail &&
        (r.thumbnail.src || r.thumbnail.original)) || null;
    let host = "";
    try {
      host = directUrl ? new URL(directUrl).hostname : "";
    } catch (_e) {/* ignore */}
    return {
      title: typeof r.title === "string" ? r.title : "",
      url: directUrl,
      thumbnailUrl: thumbUrl,
      source: (r.source) || (r.url) || null,
      host,
    };
  }).filter((c) => c.url);
}

/**
 * HEAD-check a candidate URL: must return 200, content-type must
 * start with `image/`, content-length must be >= MIN_IMAGE_BYTES (or
 * missing — some CDNs don't report it on HEAD; let those through).
 * Returns true when the URL is a real image, false otherwise.
 *
 * @param {string} url
 * @return {Promise<boolean>}
 */
async function validateImageUrl(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), VALIDATE_TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      method: "HEAD",
      signal: ac.signal,
      headers: {
        "User-Agent": "LibraryLootLOOT/1.0 (+https://library-loot.web.app)",
        "Accept": "image/*",
      },
    });
    clearTimeout(timer);

    if (!r.ok) return false;
    const ctype = (r.headers.get("content-type") || "").toLowerCase();
    if (!/^image\//.test(ctype)) return false;
    const lenHeader = r.headers.get("content-length");
    if (lenHeader) {
      const n = parseInt(lenHeader, 10);
      if (Number.isFinite(n) && n > 0 && n < MIN_IMAGE_BYTES) return false;
    }
    return true;
  } catch (_e) {
    clearTimeout(timer);
    return false;
  }
}

// ── CALLABLE ──────────────────────────────────────────────────────

exports.lootImageSearch = onCall(
    {
      region: REGION,
      secrets: [braveKey],
      // TODO: enable App Check enforcement once the project-wide
      // App Check provider config is healthy.
    },
    async (request) => {
      // ── AUTH ──
      const auth = request.auth;
      if (!auth || !auth.uid) {
        throw new HttpsError(
            "unauthenticated",
            "You must be signed in to search images through LOOT.",
        );
      }
      const token = auth.token || {};
      if (token.admin !== true) {
        throw new HttpsError(
            "permission-denied",
            "LOOT image search is admin-only for now.",
        );
      }
      const tenant = typeof token.tenant === "string" ? token.tenant : null;
      if (!tenant) {
        throw new HttpsError(
            "failed-precondition",
            "Your account isn't bound to a tenant. Contact the operator.",
        );
      }

      // ── ARG VALIDATION ──
      const data = request.data || {};
      const rawQuery = typeof data.query === "string" ? data.query : "";
      const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
      if (!query) {
        throw new HttpsError(
            "invalid-argument",
            "A non-empty `query` string is required.",
        );
      }
      let count = Number.isInteger(data.count) ? data.count : DEFAULT_COUNT;
      if (count < 1) count = 1;
      if (count > MAX_COUNT) count = MAX_COUNT;

      // ── SECRET ──
      const apiKey = braveKey.value();
      if (!apiKey) {
        throw new HttpsError(
            "failed-precondition",
            "LOOT image search isn't configured — operator hasn't set " +
            "the Brave Search API key.",
        );
      }

      // ── QUOTA ──
      const db = getFirestore();
      const newCount = await enforceQuota(db, tenant, auth.uid);

      // ── SEARCH ──
      const candidates = await callBraveImages(apiKey, query, count);

      // ── VALIDATE ──
      // HEAD-check each candidate in parallel. Filter to ones that
      // pass — the caller never sees broken/tracking-pixel URLs.
      const validatedFlags = await Promise.all(
          candidates.map((c) => validateImageUrl(c.url)),
      );
      const validated = candidates.filter((_c, i) => validatedFlags[i]);

      logger.info("LOOT image search", {
        uid: auth.uid,
        tenant: tenant,
        queryLen: query.length,
        asked: count,
        gotRaw: candidates.length,
        validated: validated.length,
        usedToday: newCount,
      });

      return {
        results: validated,
        query: query,
        usedToday: newCount,
        dailyCap: QUOTA_PER_DAY,
      };
    },
);
