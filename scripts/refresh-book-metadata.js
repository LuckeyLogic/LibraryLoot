// scripts/refresh-book-metadata.js
//
// Created by Miguel Brown on 2026-05-15.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// One-off backfill that re-fetches book metadata from Open Library /
// Google Books for every book in the catalog and populates the
// post-ITEM-3d fields (`series`, `seriesNumber`, `subjects`).
//
// Existing fields (title, authors, publishedYear, coverUrl, summary,
// readingLevel) are NOT overwritten — the admin has already curated
// those. We ONLY fill in the new metadata fields, leaving everything
// else as-is.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
//     node refresh-book-metadata.js [tenantId]
//
//   [tenantId]  Optional. Defaults to `luckey-logic`.
//
// SAFE TO RE-RUN — only updates docs whose new fields are missing,
// stale, or differ from what the APIs now return.

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

function dedupe(list) {
  const seen = new Set();
  const out  = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
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

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const docSnap of snap.docs) {
    scanned++;
    const data = docSnap.data() || {};
    const isbn = data.isbn13 || docSnap.id;
    const label = `${isbn} "${data.title || "(no title)"}"`;

    // Skip only when this doc has a non-empty series (the most valuable
    // field for series-search). Subjects alone aren't enough to skip
    // because the first version of this script populated subjects with
    // weak bibkeys data — re-running with the deeper isbn→works chain
    // produces richer values. Admin-curated values (where series is
    // already filled in) stay untouched.
    if (data.series && typeof data.series === "string" && data.series.trim()) {
      skipped++;
      console.log(`  · already has series "${data.series}": ${label}`);
      continue;
    }

    const meta = (await fromOpenLibrary(isbn)) || (await fromGoogleBooks(isbn));
    if (!meta) {
      missing++;
      console.log(`  ? no API result for ${label}`);
      continue;
    }

    // Prefer fresh API data for subjects (the deeper chain produces
    // genuinely richer results than the bibkeys-only first cut), but
    // preserve any series the admin already curated in AdminBooks.
    // The skip-if-series-set guard above already exits when admin
    // touched the series field, so reaching here means series is
    // safe to (re)populate from the API.
    const patch = {
      series      : meta.series       || data.series       || null,
      seriesNumber: meta.seriesNumber || data.seriesNumber || null,
      subjects    : Array.isArray(meta.subjects) && meta.subjects.length > 0
        ? meta.subjects
        : (data.subjects || []),
      updatedAt   : admin.firestore.FieldValue.serverTimestamp()
    };

    await docSnap.ref.set(patch, { merge: true });
    updated++;
    const tagBits = [];
    if (patch.series)             tagBits.push(`series="${patch.series}"`);
    if (patch.seriesNumber != null) tagBits.push(`#${patch.seriesNumber}`);
    if (patch.subjects.length)    tagBits.push(`subjects=[${patch.subjects.join(", ")}]`);
    console.log(`  + updated: ${label}  ${tagBits.join("  ") || "(no new metadata available)"}`);
  }

  console.log("");
  console.log("═".repeat(72));
  console.log("  SUMMARY");
  console.log("═".repeat(72));
  console.log(`  Books scanned:        ${scanned}`);
  console.log(`  Updated:              ${updated}`);
  console.log(`  Already populated:    ${skipped}`);
  console.log(`  No API match:         ${missing}`);
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
