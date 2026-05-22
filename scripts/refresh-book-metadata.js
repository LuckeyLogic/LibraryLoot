// scripts/refresh-book-metadata.js
//
// Created by Miguel Brown on 2026-05-15.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// One-off backfill that:
//   1. (ITEM 3d) Re-fetches book metadata from Open Library / Google
//      Books and populates `series`, `seriesNumber`, `subjects` when
//      not already admin-curated.
//   2. (ITEMs 3e + 3f + 3g, Tier 1 rinse — added 2026-05-20) Inspects
//      EXISTING book data and clears values that the new Tier 1
//      heuristics identify as catalog-system garbage:
//        - Cover URLs that HEAD-check as Open Library's 1x1 placeholder
//          pixel (or any URL returning <1000 bytes / 404).
//        - Summaries that look like AR codes, Lexile blurbs, or
//          distributor catalog rows.
//        - Subject tags that match catalog-jargon shapes (`:` or `=`
//          separators, LoC controlled vocabulary, pure-numeric codes).
//
// Existing GOOD data (title, authors, publishedYear, admin-written
// summaries, valid covers, real subject tags) is never overwritten —
// the script only RINSES known-bad data. Per-field comparison-and-
// merge logic lives in the AdminBooks Refresh button's diff UI, not
// here; the script is a non-interactive batch tool.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
//     node refresh-book-metadata.js [tenantId]
//
//   [tenantId]  Optional. Defaults to `luckey-logic`.
//
// SAFE TO RE-RUN — every operation is idempotent. Re-running on a
// catalog that's already clean is a no-op.

"use strict";

const admin = require("firebase-admin");

const [, , tenantArg] = process.argv;
const DEFAULT_TENANT  = tenantArg || "luckey-logic";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS must be set.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

// ── Helpers — mirror utils/bookLookup.js logic but in Node ─────────────

const OPEN_LIBRARY_HOST = "https://openlibrary.org";
const OPEN_LIBRARY      = "https://openlibrary.org/api/books";
const OPEN_LIBRARY_ISBN = "https://openlibrary.org/isbn";
const GOOGLE_BOOKS      = "https://www.googleapis.com/books/v1/volumes";
const MAX_SUBJECTS      = 6;

// ── Tier 1 heuristics (mirrored from src/utils/bookLookup.js) ─────────
// Kept in sync by hand. If the front-end heuristics change, port the
// edits here too so the script's "rinse" decisions match what the UI
// would do at lookup time.

const LOC_VOCAB_BLOCKLIST = new Set([
  "juvenile literature",
  "juvenile fiction",
  "juvenile works",
  "juvenile nonfiction",
  "juvenile non-fiction",
  "children's literature",
  "children's fiction",
  "children's nonfiction",
  "children's non-fiction"
]);

function looksLikeGarbageSubject(s) {
  if (typeof s !== "string") return true;
  const t = s.trim();
  if (!t) return true;
  if (t.length < 3) return true;
  if (/[:=]/.test(t)) return true;
  if (/^[\d.\s-]+$/.test(t)) return true;
  if (LOC_VOCAB_BLOCKLIST.has(t.toLowerCase())) return true;
  return false;
}

function looksLikePlaceholderSummary(text) {
  if (typeof text !== "string") return true;
  const t = text.trim();
  if (!t) return true;
  if (t.length < 60) return true;
  if (/Accelerated Reader/i.test(t)) return true;
  if (/\bAR\s*Quiz\b/i.test(t)) return true;
  if (/[A-Z]{2}\s+\d+\.\d+\s+\d+\.\d+\s+\d{4,}/.test(t)) return true;
  if (/\bBL\s*:/i.test(t)) return true;
  if (/\bLexile\s*:/i.test(t)) return true;
  if (t.length < 100 && /,\s*Inc\.?\s*$/.test(t)) return true;
  return false;
}

/**
 * HEAD-fetch a candidate cover URL and decide whether to keep it.
 * Mirrors src/utils/bookLookup.js. Returns the (possibly normalized
 * with ?default=false) URL when the cover passes, or null when it
 * fails. On network error: returns the original URL (better false-
 * positive than dropping a legit cover).
 */
async function verifyCoverUrl(url) {
  if (!url || typeof url !== "string") return null;

  let probeUrl = url;
  if (/covers\.openlibrary\.org/.test(url) && !/\?/.test(url)) {
    probeUrl = url + "?default=false";
  }

  try {
    const ac    = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    const res   = await fetch(probeUrl, { method: "HEAD", signal: ac.signal });
    clearTimeout(timer);

    if (!res.ok) return null;
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const len = parseInt(lenHeader, 10);
      if (Number.isFinite(len) && len > 0 && len < 1000) return null;
    }
    return probeUrl;
  } catch (_e) {
    return url;
  }
}

function dedupe(list) {
  const seen = new Set();
  const out  = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
    if (looksLikeGarbageSubject(s)) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= MAX_SUBJECTS) break;
  }
  return out;
}

function parseSeries(raw) {
  if (!raw) return { name: null, number: null };
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string" || !first.trim()) return { name: null, number: null };
  const m = first.match(/^(.*?)(?:\s*[#]\s*(\d+))\s*$/);
  if (m) return { name: m[1].trim() || null, number: Number(m[2]) };
  return { name: first.trim(), number: null };
}

async function fromOpenLibrary(isbn13) {
  try {
    // Step 1: bibkeys (shallow but cheap — author/cover/summary live here)
    const url = `${OPEN_LIBRARY}?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = await res.json();
    const data = body[`ISBN:${isbn13}`];
    if (!data) return null;

    const bibkeysSubjects = dedupe((Array.isArray(data.subjects) ? data.subjects : [])
      .map((s) => (s && s.name) || (typeof s === "string" ? s : null))
      .filter(Boolean));
    const bibkeysSeries = parseSeries(data.series);

    // Steps 2–3: edition → work → series chain (richer). Each leg
    // independent — failures leave us with the bibkeys data.
    let workSubjects = [];
    let chainSeriesName = null;
    let chainSeriesPos  = null;
    try {
      const ed = await fetch(`${OPEN_LIBRARY_ISBN}/${isbn13}.json`,
        { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null));
      const workKey = ed && Array.isArray(ed.works) && ed.works[0] && ed.works[0].key;
      if (workKey) {
        const work = await fetch(`${OPEN_LIBRARY_HOST}${workKey}.json`,
          { headers: { Accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null));
        if (Array.isArray(work && work.subjects)) workSubjects = work.subjects;

        const seriesRef = work && Array.isArray(work.series) && work.series[0];
        const seriesKey = seriesRef && seriesRef.series && seriesRef.series.key;
        if (seriesKey) {
          const seriesDoc = await fetch(`${OPEN_LIBRARY_HOST}${seriesKey}.json`,
            { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null));
          if (seriesDoc && typeof seriesDoc.name === "string" && seriesDoc.name.trim()) {
            chainSeriesName = seriesDoc.name.trim();
            const pos = parseInt(seriesRef.position, 10);
            if (Number.isFinite(pos)) chainSeriesPos = pos;
          }
        }
      }
    } catch (_) {
      // Enrichment failed — fall through with whatever bibkeys gave us.
    }

    const subjects = dedupe(workSubjects.length > 0 ? workSubjects : bibkeysSubjects);
    const series       = chainSeriesName || bibkeysSeries.name   || null;
    const seriesNumber = chainSeriesPos  || bibkeysSeries.number || null;

    return { series, seriesNumber, subjects };
  } catch (_) { return null; }
}

async function fromGoogleBooks(isbn13) {
  try {
    const url = `${GOOGLE_BOOKS}?q=isbn:${isbn13}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = await res.json();
    const item = Array.isArray(body.items) && body.items[0];
    if (!item || !item.volumeInfo) return null;
    const v = item.volumeInfo;
    const subjects = dedupe(Array.isArray(v.categories) ? v.categories : []);
    let seriesNumber = null;
    if (v.seriesInfo && v.seriesInfo.bookDisplayNumber) {
      const n = parseInt(v.seriesInfo.bookDisplayNumber, 10);
      if (Number.isFinite(n)) seriesNumber = n;
    }
    return { series: null, seriesNumber, subjects };
  } catch (_) { return null; }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("═".repeat(72));
  console.log(`  REFRESHING book metadata for tenant: ${DEFAULT_TENANT}`);
  console.log("═".repeat(72));
  console.log("");

  const colRef = db.collection(DEFAULT_TENANT).doc("_main").collection("books");
  const snap = await colRef.get();

  if (snap.empty) {
    console.log("  No books in catalog. Nothing to do.");
    process.exit(0);
  }

  let scanned        = 0;
  let updated        = 0;
  let rinsedFields   = 0;   // count of individual fields cleaned across all books
  let backfilledOnly = 0;   // books where only the 3d backfill applied (no rinse)
  let cleanAlready   = 0;   // books that needed nothing
  let missing        = 0;   // books where the API came back empty

  for (const docSnap of snap.docs) {
    scanned++;
    const data  = docSnap.data() || {};
    const isbn  = data.isbn13 || docSnap.id;
    const label = `${isbn} "${data.title || "(no title)"}"`;

    // ── Pass 1: Tier 1 rinse on EXISTING data ─────────────────────
    // Every book gets this, regardless of whether series is set.
    // Only clears fields that the heuristic identifies as garbage;
    // never overwrites good prose or valid covers.
    const patch    = {};
    const rinsedOn = [];

    // Cover URL: HEAD-check. If invalid, clear the field. If valid,
    // optionally normalize to the ?default=false form so future re-
    // checks (and the front-end <img>) honestly fail rather than
    // serve a placeholder pixel.
    if (data.coverUrl && typeof data.coverUrl === "string") {
      const verified = await verifyCoverUrl(data.coverUrl);
      if (!verified) {
        patch.coverUrl = null;
        rinsedOn.push("coverUrl (invalid/placeholder)");
      } else if (verified !== data.coverUrl) {
        patch.coverUrl = verified;
        rinsedOn.push("coverUrl (normalized to ?default=false)");
      }
    }

    // Summary: heuristic check. If placeholder garbage, clear.
    if (data.summary && looksLikePlaceholderSummary(data.summary)) {
      patch.summary = "";
      rinsedOn.push("summary (catalog placeholder)");
    }

    // Subjects: re-run the (now-stricter) garbage filter over existing.
    // The first version of dedupe() didn't filter LoC vocab + catalog-
    // separator tags; books added before 2026-05-20 may have them.
    if (Array.isArray(data.subjects) && data.subjects.length > 0) {
      const cleaned = dedupe(data.subjects);
      if (cleaned.length !== data.subjects.length ||
          cleaned.some((s, i) => s !== data.subjects[i])) {
        patch.subjects = cleaned;
        rinsedOn.push(`subjects (${data.subjects.length} → ${cleaned.length})`);
      }
    }

    // ── Pass 2: 3d backfill from API ──────────────────────────────
    // Only runs when the doc has no admin-curated series. (The skip
    // guard moved here from the top of the loop so Pass 1 still runs
    // on admin-curated docs to rinse any old garbage.)
    let backfilled = false;
    if (!data.series || (typeof data.series === "string" && !data.series.trim())) {
      const meta = (await fromOpenLibrary(isbn)) || (await fromGoogleBooks(isbn));
      if (!meta) {
        // No API result — that's OK, we may still have applied a Pass 1
        // rinse above. Track the miss separately so the summary is honest.
        if (rinsedOn.length === 0) {
          missing++;
          console.log(`  ? no API result for ${label}`);
          continue;
        }
      } else {
        // The script's series-backfill: only set when API has it. We
        // already know the admin hasn't curated series (guard above).
        if (meta.series && !patch.series) {
          patch.series = meta.series;
          backfilled = true;
        }
        if (meta.seriesNumber != null) {
          patch.seriesNumber = meta.seriesNumber;
          backfilled = true;
        }
        // Prefer fresh API subjects when they're richer than what
        // we kept from Pass 1. The dedupe() in fromOpenLibrary
        // already applies the garbage filter.
        if (Array.isArray(meta.subjects) && meta.subjects.length > 0) {
          const existingSubjects = patch.subjects || data.subjects || [];
          if (meta.subjects.length > existingSubjects.length) {
            patch.subjects = meta.subjects;
            backfilled = true;
          }
        }
      }
    }

    // ── Write patch if anything changed ───────────────────────────
    if (Object.keys(patch).length === 0) {
      cleanAlready++;
      const why = data.series && data.series.trim() ?
          `series already set ("${data.series}"); nothing to rinse` :
          "nothing to clean or backfill";
      console.log(`  · ${label}  (${why})`);
      continue;
    }

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await docSnap.ref.set(patch, { merge: true });
    updated++;
    rinsedFields += rinsedOn.length;
    if (rinsedOn.length === 0 && backfilled) backfilledOnly++;

    const tagBits = [];
    if (rinsedOn.length)             tagBits.push(`rinsed: ${rinsedOn.join(", ")}`);
    if (backfilled && patch.series)  tagBits.push(`series="${patch.series}"`);
    if (backfilled && patch.seriesNumber != null) tagBits.push(`#${patch.seriesNumber}`);
    if (backfilled && Array.isArray(patch.subjects)) {
      tagBits.push(`subjects=[${patch.subjects.join(", ")}]`);
    }
    console.log(`  + updated: ${label}  ${tagBits.join("  ")}`);
  }

  console.log("");
  console.log("═".repeat(72));
  console.log("  SUMMARY");
  console.log("═".repeat(72));
  console.log(`  Books scanned:               ${scanned}`);
  console.log(`  Updated:                     ${updated}`);
  console.log(`    Tier 1 fields rinsed:      ${rinsedFields}`);
  console.log(`    3d backfill only:          ${backfilledOnly}`);
  console.log(`  Clean already (no changes):  ${cleanAlready}`);
  console.log(`  No API match:                ${missing}`);
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
