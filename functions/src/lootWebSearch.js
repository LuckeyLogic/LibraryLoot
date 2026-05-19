// functions/src/lootWebSearch.js
//
// Created by Miguel Brown on 2026-05-19.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// HTTPS-callable that runs a web search through the Brave Search API on
// behalf of the LOOT admin assistant. See CLAUDE.md ITEM 9c.3 for the
// design rationale — short version: Gemini's tool-calling is fully
// featured, but Vertex AI doesn't ship a built-in web_search tool the way
// Anthropic does, so we wire it ourselves. This closes the GUNNY-vs-LOOT
// capability gap.
//
// Security model:
//   - Caller must be authenticated AND carry both the `admin: true` and
//     `tenant: <tenantId>` custom claims. Parents and anon visitors can't
//     reach this tool; that's by design — LOOT for non-admin audiences
//     (ITEMs 9f / 9g) will get a separately-scoped web tool with stricter
//     rate limits and a token-gate pattern.
//   - Per-UID, per-day quota gates the call. Hit the cap → friendly error.
//     Defaults: 50 searches per UID per day. Adjust in QUOTA_PER_DAY.
//   - Brave's API key is held server-side via Secret Manager (the
//     BRAVE_SEARCH_API_KEY secret). Never returned to the client.
//
// App Check:
//   - NOT enforced on this callable for now. The project-wide App Check
//     setup needs cleanup before launch (per CLAUDE.md); enforcing here
//     in isolation would block dev. Once App Check is healthy, add
//     `enforceAppCheck: true` to the onCall config below.
//
// Brave Search API:
//   - https://api.search.brave.com/res/v1/web/search
//   - Free tier: 2000 queries/month, no card required. Library-Loot-scale
//     usage won't approach that.

"use strict";

const {defineSecret} = require("firebase-functions/params");
const {HttpsError, onCall} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const REGION = "us-central1";

/**
 * Brave Search API subscription token. Set with:
 *   firebase functions:secrets:set BRAVE_SEARCH_API_KEY
 *
 * Until this secret is set in the deployed project, calls to this
 * function will fail with a clear "not configured" error rather than
 * pretending to search.
 */
const braveKey = defineSecret("BRAVE_SEARCH_API_KEY");

// ── CONFIG ────────────────────────────────────────────────────────────

/** Hard daily cap on web searches per UID. */
const QUOTA_PER_DAY = 50;

/** Hard cap on how many results we ask Brave for in a single call. */
const MAX_COUNT = 10;

/** Default result count when caller doesn't specify. */
const DEFAULT_COUNT = 5;

/** Hard cap on the user-supplied query length (chars). Brave itself
 * accepts up to ~400; we cap a touch lower to leave room for sanitization. */
const MAX_QUERY_LENGTH = 380;

// ── HELPERS ───────────────────────────────────────────────────────────

/**
 * UTC date key for the quota doc. Resets at midnight UTC, not the
 * caller's local midnight — predictable across timezones.
 *
 * @return {string} `YYYY-MM-DD`.
 */
function todayUtcKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomic read-check-increment of the per-UID daily quota counter. Doc
 * lives in a server-only collection (`_loot_meta`); Firestore rules
 * deny all client access so clients can't tamper with it.
 *
 * @param {object} db        Admin SDK Firestore instance.
 * @param {string} tenant    Caller's tenant claim.
 * @param {string} uid       Caller's Firebase Auth UID.
 * @return {Promise<number>} The new searchCount AFTER incrementing.
 *                           Throws HttpsError if the cap was already hit.
 */
async function enforceQuota(db, tenant, uid) {
  const date = todayUtcKey();
  const docId = `${tenant}_${uid}_${date}`;
  const ref = db.collection("_loot_meta").doc(docId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data().searchCount || 0) : 0;

    if (cur >= QUOTA_PER_DAY) {
      throw new HttpsError(
          "resource-exhausted",
          `Daily web-search cap hit (${QUOTA_PER_DAY}/day). ` +
          `Resets at midnight UTC.`,
      );
    }

    const next = cur + 1;
    if (snap.exists) {
      tx.update(ref, {
        searchCount: next,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(ref, {
        tenantId: tenant,
        uid: uid,
        date: date,
        searchCount: next,
        fetchCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return next;
  });
}

/**
 * Hit Brave Search API and normalize the response into a flat array of
 * `{title, url, snippet, source: 'brave'}` objects. Caps at MAX_COUNT.
 *
 * @param {string} apiKey  Brave subscription token.
 * @param {string} query   User's search query (already validated).
 * @param {number} count   Number of results to request (1..MAX_COUNT).
 * @return {Promise<Array<object>>}
 *           Each result: {title, url, snippet, source: "brave"}.
 */
async function callBraveSearch(apiKey, query, count) {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  // `safesearch: strict` — Library Loot is a kids' reading program;
  // we never want LOOT to surface adult content even when an admin's
  // query is borderline.
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
        `Couldn't reach Brave Search: ${err.message || "network error"}.`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new HttpsError(
        "internal",
        "Brave Search rejected our API key. The operator needs to " +
        "re-set BRAVE_SEARCH_API_KEY (see CLAUDE.md ITEM 9c.3).",
    );
  }
  if (res.status === 429) {
    throw new HttpsError(
        "resource-exhausted",
        "Brave Search is rate-limiting us right now. Try again in a minute.",
    );
  }
  if (!res.ok) {
    throw new HttpsError(
        "unavailable",
        `Brave Search returned HTTP ${res.status}. Try again shortly.`,
    );
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new HttpsError(
        "internal",
        `Brave Search returned non-JSON: ${err.message || "parse error"}.`,
    );
  }

  const rawResults = (body && body.web && Array.isArray(body.web.results)) ?
      body.web.results :
      [];

  return rawResults.slice(0, MAX_COUNT).map((r) => ({
    title: typeof r.title === "string" ? r.title : "",
    url: typeof r.url === "string" ? r.url : "",
    snippet: typeof r.description === "string" ? r.description : "",
    source: "brave",
  }));
}

// ── CALLABLE ──────────────────────────────────────────────────────────

exports.lootWebSearch = onCall(
    {
      region: REGION,
      secrets: [braveKey],
      // TODO: enable App Check enforcement once the project-wide App Check
      // provider config is cleaned up (CLAUDE.md flagged this).
    },
    async (request) => {
      // ── AUTH ──
      const auth = request.auth;
      if (!auth || !auth.uid) {
        throw new HttpsError(
            "unauthenticated",
            "You must be signed in to search the web through LOOT.",
        );
      }
      const token = auth.token || {};
      if (token.admin !== true) {
        throw new HttpsError(
            "permission-denied",
            "LOOT web search is admin-only for now.",
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
            "LOOT web search isn't configured yet — operator hasn't set " +
            "the Brave Search API key. (CLAUDE.md ITEM 9c.3 has the steps.)",
        );
      }

      // ── QUOTA ──
      const db = getFirestore();
      const newCount = await enforceQuota(db, tenant, auth.uid);

      // ── SEARCH ──
      const results = await callBraveSearch(apiKey, query, count);

      logger.info("LOOT web search", {
        uid: auth.uid,
        tenant: tenant,
        queryLen: query.length,
        count: count,
        results: results.length,
        usedToday: newCount,
      });

      return {
        results: results,
        query: query,
        usedToday: newCount,
        dailyCap: QUOTA_PER_DAY,
      };
    },
);
