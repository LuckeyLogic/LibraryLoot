// functions/src/lootFetchPage.js
//
// Created by Miguel Brown on 2026-05-19.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// HTTPS-callable that fetches a URL server-side, extracts the main
// readable text, and returns it to the LOOT admin assistant. Pairs with
// lootWebSearch (ITEM 9c.3) — the model picks a result from the search,
// then calls this tool to read the page in full when the snippet isn't
// enough.
//
// Why server-side, not in the browser?
//   - CORS would block most pages from being fetched by the client.
//   - We can sanitize / size-cap the response before it goes to the model.
//   - 24h Firestore cache means repeat fetches don't burn bandwidth.
//   - Future rate-limiting / abuse detection lives in one place.
//
// Extraction approach (v1, cheerio):
//   - Strip script / style / nav / header / footer / aside / noscript /
//     iframe / svg / form / button.
//   - Pick the densest text container among: <article>, <main>,
//     [role=main], <body>. Densest = most text length after stripping.
//   - Normalize whitespace and cap output at MAX_OUTPUT_CHARS.
//
// Security model:
//   - Caller must be authenticated AND carry the `admin: true` claim.
//   - Per-UID daily quota on fetch count (shared doc shape with
//     lootWebSearch).
//   - URL must be http(s); private network ranges + localhost are
//     blocked at hostname resolution stage to avoid SSRF.
//
// App Check: deferred — see lootWebSearch.js for the same TODO.

"use strict";

const crypto = require("crypto");

const cheerio = require("cheerio");

const {HttpsError, onCall} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {getFirestore, FieldValue, Timestamp} =
    require("firebase-admin/firestore");

const REGION = "us-central1";

// ── CONFIG ────────────────────────────────────────────────────────────

/** Hard daily cap on page fetches per UID. Higher than search since most
 * fetches hit the cache. */
const QUOTA_PER_DAY = 100;

/** Cache TTL — pages refresh after this. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Hard cap on extracted text returned to the model. ~10K chars is
 * generous for the LLM context budget without crowding out the rest of
 * the conversation. */
const MAX_OUTPUT_CHARS = 10000;

/** Hard cap on the raw HTML we'll download. Most pages are well under
 * 1MB; anything bigger is almost certainly an attack vector or a
 * useless mega-doc. 5MB ceiling protects function memory. */
const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** Outbound fetch timeout. */
const FETCH_TIMEOUT_MS = 10000;

/** Tags to strip wholesale before extracting text. */
const STRIP_TAGS = [
  "script", "style", "noscript", "iframe", "svg",
  "nav", "header", "footer", "aside",
  "form", "button", "input", "select", "textarea",
];

// ── HELPERS ───────────────────────────────────────────────────────────

/**
 * UTC date key for the quota doc. Matches lootWebSearch.js.
 *
 * @return {string} `YYYY-MM-DD`.
 */
function todayUtcKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * SHA-256 hex of a URL — used as the cache doc ID. Stable across
 * invocations so cache hits actually hit.
 *
 * @param {string} url
 * @return {string} 64-char hex digest.
 */
function hashUrl(url) {
  return crypto.createHash("sha256").update(url, "utf8").digest("hex");
}

/**
 * Validate a URL string and return a normalized URL object. Rejects
 * anything that isn't http(s), or that targets a host that could
 * confuse the fetch into hitting our own infrastructure (localhost,
 * private network ranges, link-local).
 *
 * @param {string} raw
 * @return {URL}
 */
function validateUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_e) {
    throw new HttpsError(
        "invalid-argument",
        `"${String(raw).slice(0, 80)}" isn't a valid URL.`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpsError(
        "invalid-argument",
        "Only http(s) URLs are supported.",
    );
  }
  const host = parsed.hostname.toLowerCase();
  // Block obviously dangerous hostnames. This isn't a complete SSRF
  // defense — a malicious operator could DNS-rebind — but it stops the
  // accidental and trivially-malicious cases.
  const blocked = (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
  if (blocked) {
    throw new HttpsError(
        "invalid-argument",
        `Refusing to fetch from "${host}" — ` +
        `private/local addresses are blocked.`,
    );
  }
  return parsed;
}

/**
 * Atomic read-check-increment of the per-UID daily fetchCount counter.
 * Doc shape is shared with lootWebSearch.js — same `_loot_meta` doc,
 * different field.
 *
 * @param {object} db
 * @param {string} tenant
 * @param {string} uid
 * @return {Promise<number>} The new fetchCount AFTER incrementing.
 */
async function enforceQuota(db, tenant, uid) {
  const date = todayUtcKey();
  const docId = `${tenant}_${uid}_${date}`;
  const ref = db.collection("_loot_meta").doc(docId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data().fetchCount || 0) : 0;

    if (cur >= QUOTA_PER_DAY) {
      throw new HttpsError(
          "resource-exhausted",
          `Daily page-fetch cap hit (${QUOTA_PER_DAY}/day). ` +
          `Resets at midnight UTC.`,
      );
    }

    const next = cur + 1;
    if (snap.exists) {
      tx.update(ref, {
        fetchCount: next,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(ref, {
        tenantId: tenant,
        uid: uid,
        date: date,
        searchCount: 0,
        fetchCount: next,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return next;
  });
}

/**
 * Download the URL with size + time guards. Returns the HTML string,
 * the final URL after redirects, and the resolved status.
 *
 * @param {string} urlStr
 * @return {Promise<{html:string, finalUrl:string, status:number}>}
 */
async function downloadHtml(urlStr) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(urlStr, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        // Honest UA so cooperative sites can identify and contact us.
        "User-Agent": "LibraryLootLOOT/1.0 (+https://library-loot.web.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new HttpsError(
          "deadline-exceeded",
          `Page fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s.`,
      );
    }
    throw new HttpsError(
        "unavailable",
        `Couldn't reach "${urlStr}": ${err.message || "network error"}.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new HttpsError(
        "unavailable",
        `Page returned HTTP ${res.status}.`,
    );
  }
  const ctype = res.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml/i.test(ctype)) {
    throw new HttpsError(
        "invalid-argument",
        `Page is not HTML (content-type: "${ctype || "unknown"}"). ` +
        `LOOT can only read text/html pages.`,
    );
  }

  // Read with a size cap. We rely on the response's stream rather than
  // res.text() so we can abort early on absurdly-large bodies.
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) {
    // Node's undici always exposes a reader, but be defensive.
    const text = await res.text();
    if (text.length > MAX_HTML_BYTES) {
      throw new HttpsError(
          "out-of-range",
          `Page is too large (>${MAX_HTML_BYTES} bytes).`,
      );
    }
    return {html: text, finalUrl: res.url, status: res.status};
  }

  const chunks = [];
  let total = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      try {
        await reader.cancel();
      } catch (_e) {
        // ignore
      }
      throw new HttpsError(
          "out-of-range",
          `Page is too large (>${MAX_HTML_BYTES} bytes).`,
      );
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return {html: buf.toString("utf8"), finalUrl: res.url, status: res.status};
}

/**
 * Extract main readable text from an HTML string. Returns the cleaned
 * text capped at MAX_OUTPUT_CHARS, plus the page title.
 *
 * @param {string} html
 * @return {{text:string, title:string}}
 */
function extractText(html) {
  const $ = cheerio.load(html);

  // Page title — from <title>, falling back to first <h1>.
  let title = ($("title").first().text() || "").trim();
  if (!title) {
    title = ($("h1").first().text() || "").trim();
  }
  if (title.length > 240) title = title.slice(0, 240);

  // Strip junk before scoring candidates.
  STRIP_TAGS.forEach((tag) => $(tag).remove());

  // Candidate containers, in priority order. We pick whichever has the
  // most text content — empty <main> tags are common on JS-heavy sites,
  // so falling back to <body> when the others come up empty is the
  // robust move.
  const candidates = [
    $("article").first(),
    $("main").first(),
    $("[role=main]").first(),
    $("body").first(),
  ];

  let bestText = "";
  for (const c of candidates) {
    if (!c || c.length === 0) continue;
    const t = (c.text() || "").trim();
    if (t.length > bestText.length) bestText = t;
  }

  // Normalize whitespace: collapse runs of \s into single spaces, then
  // collapse runs of newlines created by block-level tags into single
  // newlines. Two-pass is simpler than one regex.
  const collapsed = bestText
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const capped = collapsed.length > MAX_OUTPUT_CHARS ?
      collapsed.slice(0, MAX_OUTPUT_CHARS) + "\n\n…(truncated)" :
      collapsed;

  return {text: capped, title: title};
}

// ── CALLABLE ──────────────────────────────────────────────────────────

exports.lootFetchPage = onCall(
    {
      region: REGION,
      // TODO: enable App Check enforcement when the project-wide setup
      // is cleaned up (see CLAUDE.md).
    },
    async (request) => {
      // ── AUTH ──
      const auth = request.auth;
      if (!auth || !auth.uid) {
        throw new HttpsError(
            "unauthenticated",
            "You must be signed in to fetch pages through LOOT.",
        );
      }
      const token = auth.token || {};
      if (token.admin !== true) {
        throw new HttpsError(
            "permission-denied",
            "LOOT page fetching is admin-only for now.",
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
      const rawUrl = typeof data.url === "string" ? data.url.trim() : "";
      if (!rawUrl) {
        throw new HttpsError(
            "invalid-argument",
            "A `url` string is required.",
        );
      }
      const parsed = validateUrl(rawUrl);
      const canonicalUrl = parsed.toString();

      // ── CACHE CHECK ──
      // Cache uses the original requested URL (post-validation,
      // pre-fetch). After a fetch we also store the final URL post-
      // redirect so we know where the content actually came from.
      const db = getFirestore();
      const cacheRef = db.collection("_loot_url_cache")
          .doc(hashUrl(canonicalUrl));
      const cacheSnap = await cacheRef.get();
      if (cacheSnap.exists) {
        const c = cacheSnap.data();
        const fetchedAtMs = c.fetchedAt && c.fetchedAt.toMillis ?
            c.fetchedAt.toMillis() :
            0;
        if (fetchedAtMs && (Date.now() - fetchedAtMs) < CACHE_TTL_MS) {
          logger.info("LOOT fetch cache hit", {
            uid: auth.uid,
            tenant: tenant,
            hostname: parsed.hostname,
            ageMs: Date.now() - fetchedAtMs,
          });
          return {
            text: c.text || "",
            title: c.title || "",
            url: c.finalUrl || canonicalUrl,
            cached: true,
            fetchedAtMs: fetchedAtMs,
          };
        }
      }

      // ── QUOTA ──
      const newCount = await enforceQuota(db, tenant, auth.uid);

      // ── DOWNLOAD + EXTRACT ──
      const {html, finalUrl} = await downloadHtml(canonicalUrl);
      const {text, title} = extractText(html);

      // ── CACHE WRITE ──
      const fetchedAt = Timestamp.now();
      try {
        await cacheRef.set({
          url: canonicalUrl,
          finalUrl: finalUrl,
          hostname: parsed.hostname,
          title: title,
          text: text,
          fetchedAt: fetchedAt,
          byteLength: text.length,
        });
      } catch (err) {
        // Non-fatal — the user gets their content even if we couldn't
        // cache it. Common cause: doc would exceed the 1MB Firestore
        // limit (shouldn't happen given MAX_OUTPUT_CHARS, but defensive).
        logger.warn("LOOT cache write failed (non-fatal)", {
          uid: auth.uid,
          hostname: parsed.hostname,
          err: err.message || String(err),
        });
      }

      logger.info("LOOT page fetch", {
        uid: auth.uid,
        tenant: tenant,
        hostname: parsed.hostname,
        bytes: text.length,
        usedToday: newCount,
      });

      return {
        text: text,
        title: title,
        url: finalUrl,
        cached: false,
        fetchedAtMs: fetchedAt.toMillis(),
      };
    },
);
