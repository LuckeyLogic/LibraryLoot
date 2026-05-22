// src/utils/bookLookup.js
//
// Looks up book metadata by ISBN against two public APIs:
//   1. Open Library  — primary, generous CORS, no auth, no rate-limit
//      worth worrying about at our scale.
//   2. Google Books  — fallback when Open Library has nothing.
//
// Both APIs are callable directly from the browser; no Cloud Function
// proxy needed. Returns a normalized shape so the admin form doesn't
// have to know which source it came from.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { normalizeIsbn } from './isbn.js'

/**
 * @typedef {Object} BookLookupResult
 * @property {string}        isbn13         - Canonical 13-digit ISBN.
 * @property {string}        title
 * @property {string[]}      authors
 * @property {number|null}   publishedYear
 * @property {string|null}   coverUrl       - Direct URL to cover image.
 * @property {string}        summary
 * @property {string|null}   series         - Series name (e.g. "Harry Potter"), or null for standalone titles.
 * @property {number|null}   seriesNumber   - Position within the series (1, 2, 3…), or null when the source doesn't specify.
 * @property {string[]}      subjects       - Subject / genre / category tags (e.g. ["Friendship", "Middle school"]).
 * @property {'open-library'|'google-books'} source
 */

const OPEN_LIBRARY_HOST  = 'https://openlibrary.org'
const OPEN_LIBRARY_DATA  = 'https://openlibrary.org/api/books'
const OPEN_LIBRARY_ISBN  = 'https://openlibrary.org/isbn'
const OPEN_LIBRARY_COVER = 'https://covers.openlibrary.org/b/isbn'
const GOOGLE_BOOKS       = 'https://www.googleapis.com/books/v1/volumes'

/**
 * Hard cap on subjects[] length per book. Open Library especially
 * returns long subject lists; keeping ~6 is plenty for catalog search
 * + display and avoids bloating doc size.
 */
const MAX_SUBJECTS = 6

/**
 * Library-of-Congress controlled-vocabulary entries that ARE accurate
 * but read as catalog jargon when surfaced as a reader-facing tag.
 * Catalogers use these to roll up the whole kids' shelf; they don't
 * tell a reader anything that the rest of the catalog UI doesn't
 * already say. Filtered out of subjects[] before display.
 *
 * Comparison is case-insensitive against the trimmed string. Add to
 * this list — don't try to make it cleverer with regex — when more
 * jargon-shaped entries show up in real catalog adds.
 */
const LOC_VOCAB_BLOCKLIST = new Set([
  'juvenile literature',
  'juvenile fiction',
  'juvenile works',
  'juvenile nonfiction',
  'juvenile non-fiction',
  'children\'s literature',
  'children\'s fiction',
  'children\'s nonfiction',
  'children\'s non-fiction'
])

/**
 * Returns true when a candidate subject string looks like catalog-
 * system metadata rather than a real reader-facing tag. Examples it
 * catches:
 *   - "nyt:graphic-books-and-manga=2021-10-10"  (NYT-bestseller-list ID)
 *   - "bisac:JUV019000"                          (BISAC code)
 *   - "lcsh:fre--"                               (LCSH shorthand)
 *   - "Juvenile literature"                      (LoC vocab, see set above)
 *   - any string under 3 chars
 *   - pure-numeric strings (Dewey Decimal codes, year-range markers)
 *
 * Strings like "New York Times bestseller" or "Friendship" or
 * "Middle school" pass through — they're real human-readable tags.
 *
 * @param   {string} s  Already trimmed.
 * @returns {boolean}
 */
function looksLikeGarbageSubject(s) {
  if (typeof s !== 'string') return true
  const t = s.trim()
  if (!t) return true
  if (t.length < 3) return true
  // Catalog-system separators. Any `:` or `=` in a subject means it's
  // almost certainly an internal identifier, not a reader-facing tag.
  if (/[:=]/.test(t)) return true
  // Pure numeric: Dewey-decimal codes, year markers, etc.
  if (/^[\d.\s-]+$/.test(t)) return true
  // LoC controlled vocabulary — accurate but cataloger-flavored.
  if (LOC_VOCAB_BLOCKLIST.has(t.toLowerCase())) return true
  return false
}

/**
 * De-dupe a subject list case-insensitively while preserving the first
 * occurrence's original casing. Filters catalog-system garbage (see
 * looksLikeGarbageSubject) before dedup so the cap doesn't get burned
 * on tags we'd just drop anyway.
 */
function dedupeSubjects(list) {
  const seen = new Set()
  const out  = []
  for (const raw of list) {
    if (typeof raw !== 'string') continue
    const s = raw.trim()
    if (!s) continue
    if (looksLikeGarbageSubject(s)) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= MAX_SUBJECTS) break
  }
  return out
}

/**
 * Combine a title and subtitle into the form catalogers and humans
 * actually use: "Title: Subtitle". Capitalizes the subtitle's first
 * letter (Open Library frequently returns "a Graphic Novel" — that's
 * cataloger style, not how a reader writes it) so the result matches
 * the convention admins use in AdminBooks.
 *
 * Returns `title` alone when there's no subtitle. Returns `''` when
 * `title` is missing.
 *
 * Example:
 *   combineTitle('Kristy and the Snobs', 'a Graphic Novel')
 *     → 'Kristy and the Snobs: A Graphic Novel'
 *
 * @param   {string|null|undefined} title
 * @param   {string|null|undefined} subtitle
 * @returns {string}
 */
function combineTitle(title, subtitle) {
  const t = (title || '').toString().trim()
  if (!t) return ''
  const s = (subtitle || '').toString().trim()
  if (!s) return t
  const capped = s.charAt(0).toUpperCase() + s.slice(1)
  return `${t}: ${capped}`
}

/**
 * Parse Open Library's `series` field, which is sometimes a string like
 * "The Baby-Sitters Club Graphix #2" — splits the trailing #N into a
 * separate seriesNumber so admin queries can filter by series alone.
 *
 * @param   {Array<string>|string|null|undefined} raw
 * @returns {{name: string|null, number: number|null}}
 */
function parseSeries(raw) {
  if (!raw) return { name: null, number: null }
  const first = Array.isArray(raw) ? raw[0] : raw
  if (typeof first !== 'string' || !first.trim()) return { name: null, number: null }
  const m = first.match(/^(.*?)(?:\s*[#]\s*(\d+))\s*$/)
  if (m) {
    return { name: m[1].trim() || null, number: Number(m[2]) }
  }
  return { name: first.trim(), number: null }
}

/**
 * HEAD-fetch a candidate cover URL and decide whether to keep it.
 *
 * Why this exists: Open Library has a long-standing habit of serving a
 * 1×1 placeholder pixel (~100 bytes) when they don't actually have a
 * cover for a given ISBN — the URL 200-OKs, no error, but the rendered
 * image is meaningless. We never noticed for "Steam Train, Dream Train"
 * (issue surfaced 2026-05-15 by the operator). Adding `?default=false`
 * makes OL 404 on real absence; pairing that with a small-body check
 * also catches non-OL hosts that ship their own placeholders.
 *
 * Behavior:
 *   - For Open Library covers (covers.openlibrary.org), append
 *     `?default=false` so the URL 404s on real absence. The returned
 *     URL keeps the flag, so the front-end <img> shows a broken-image
 *     icon on later disappearance instead of a silent fake.
 *   - HEAD with a 5s timeout. On 404 → drop (return null). On a body
 *     suspiciously small (<1000 bytes) → drop.
 *   - On network error / HEAD blocked → KEEP the URL. Some CDNs serve
 *     405 on HEAD even when GET works; better false-positive than
 *     dropping a legit cover.
 *
 * @param   {string|null} url
 * @returns {Promise<string|null>}
 */
async function verifyCoverUrl(url) {
  if (!url || typeof url !== 'string') return null

  let probeUrl = url
  if (/covers\.openlibrary\.org/.test(url) && !/\?/.test(url)) {
    probeUrl = url + '?default=false'
  }

  try {
    const ac    = new AbortController()
    const timer = setTimeout(() => ac.abort(), 5000)
    const res   = await fetch(probeUrl, { method: 'HEAD', signal: ac.signal })
    clearTimeout(timer)

    if (!res.ok) return null
    const lenHeader = res.headers.get('content-length')
    if (lenHeader) {
      const len = parseInt(lenHeader, 10)
      if (Number.isFinite(len) && len > 0 && len < 1000) return null
    }
    return probeUrl
  } catch (_e) {
    // Network error / CORS / HEAD-blocked CDN. Better to keep the URL
    // and let the <img> tag sort it out than drop a probably-good
    // cover. The status-quo behavior before this commit.
    return url
  }
}

/**
 * Extracts the year from a date string like "2020", "2020-01-15",
 * "March 1, 2020", etc. Returns null if no plausible year is present.
 *
 * @param   {string|number|null|undefined} value
 * @returns {number|null}
 */
function pickYear(value) {
  if (value == null) return null
  if (typeof value === 'number' && value > 1000) return value
  const str   = String(value)
  const match = str.match(/(1[5-9]\d{2}|20\d{2}|21\d{2})/)
  return match ? Number(match[1]) : null
}

/**
 * Returns true when a candidate "summary" string is almost certainly
 * NOT a real book description — typically a leak from the source API's
 * catalog-system data rather than reader-facing prose.
 *
 * The motivating example (surfaced 2026-05-15):
 *   "PK Childrens Plus, Inc. Accelerated Reader LG 2.8 0.5 158536."
 * That's a distributor blurb with an embedded Accelerated Reader code
 * (LG = lower-grades, 2.8 reading level, 0.5 AR points, 158536 quiz ID).
 * It looks like prose at a glance but conveys nothing about the book.
 *
 * When the heuristic fires, callers replace the summary with the empty
 * string so the admin form shows a blank field — clear signal to type
 * one in or use the upcoming AI fallback (3f Tier 3).
 *
 * @param   {string} text
 * @returns {boolean}
 */
function looksLikePlaceholderSummary(text) {
  if (typeof text !== 'string') return true
  const t = text.trim()
  if (!t) return true
  // Too short to be a real description (a haiku is ~50 chars).
  if (t.length < 60) return true
  // Accelerated Reader sigils.
  if (/Accelerated Reader/i.test(t)) return true
  if (/\bAR\s*Quiz\b/i.test(t)) return true
  // AR-code shape: "LG 2.8 0.5 158536" — two letters, decimal, decimal, int.
  if (/[A-Z]{2}\s+\d+\.\d+\s+\d+\.\d+\s+\d{4,}/.test(t)) return true
  // Other catalog systems' embedded codes.
  if (/\bBL\s*:/i.test(t)) return true
  if (/\bLexile\s*:/i.test(t)) return true
  // Distributor-blurb shape: short string ending in ", Inc." — common
  // for entries where the "summary" is actually the publisher's
  // catalog row.
  if (t.length < 100 && /,\s*Inc\.?\s*$/.test(t)) return true
  return false
}

/**
 * Asks Open Library for a single ISBN. Returns a normalized result or
 * null. Swallows network errors so the caller can fall back.
 *
 * @param   {string} isbn13
 * @returns {Promise<BookLookupResult|null>}
 */
async function fromOpenLibrary(isbn13) {
  try {
    const url      = `${OPEN_LIBRARY_DATA}?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return null

    const body = await response.json()
    const data = body[`ISBN:${isbn13}`]
    if (!data) return null

    const authors = Array.isArray(data.authors)
      ? data.authors.map((a) => a && a.name).filter(Boolean)
      : []

    const cover =
      (data.cover && (data.cover.large || data.cover.medium || data.cover.small)) ||
      `${OPEN_LIBRARY_COVER}/${isbn13}-L.jpg`

    // bibkeys subjects: array of {name, url} objects.
    const bibkeysSubjects = Array.isArray(data.subjects)
      ? data.subjects.map((s) => (s && s.name) || (typeof s === 'string' ? s : null)).filter(Boolean)
      : []
    // Parse series from bibkeys (rarely present, but a free win when it is).
    const bibkeysSeries = parseSeries(data.series)

    // Deeper chain: isbn → works → series. The bibkeys endpoint is
    // shallow — series, subjects, and the work-level description barely
    // populate from it. The works record for a given edition has much
    // richer data. We follow the chain with independent try-blocks per
    // leg so any failure leaves us with whatever bibkeys data we
    // already collected.
    let workSubjects    = []
    let chainSeriesName = null
    let chainSeriesPos  = null
    let workDescription = ''
    try {
      const edition = await fetch(`${OPEN_LIBRARY_ISBN}/${isbn13}.json`,
        { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
      const workKey = edition && Array.isArray(edition.works) && edition.works[0] && edition.works[0].key
      if (workKey) {
        const work = await fetch(`${OPEN_LIBRARY_HOST}${workKey}.json`,
          { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : null))
        if (Array.isArray(work && work.subjects)) workSubjects = work.subjects

        // OL stores work descriptions as either a plain string OR a
        // typed object { type: '/type/text', value: '...' }. Handle
        // both shapes. This is the most reliable way to get real
        // prose for books whose bibkeys.notes is empty — many works
        // have rich descriptions here even when the edition does not.
        if (work && work.description) {
          if (typeof work.description === 'string') {
            workDescription = work.description
          } else if (typeof work.description.value === 'string') {
            workDescription = work.description.value
          }
        }

        // work.series: [{ series: { key: '/series/...' }, position: '7' }]
        const seriesRef = work && Array.isArray(work.series) && work.series[0]
        const seriesKey = seriesRef && seriesRef.series && seriesRef.series.key
        if (seriesKey) {
          const seriesDoc = await fetch(`${OPEN_LIBRARY_HOST}${seriesKey}.json`,
            { headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : null))
          if (seriesDoc && typeof seriesDoc.name === 'string' && seriesDoc.name.trim()) {
            chainSeriesName = seriesDoc.name.trim()
            const pos = parseInt(seriesRef.position, 10)
            if (Number.isFinite(pos)) chainSeriesPos = pos
          }
        }
      }
    } catch (_) {
      // Enrichment failed — proceed with bibkeys-only data.
    }

    // Prefer work-level subjects (richer) over bibkeys-level when both
    // exist; same for series (chain > bibkeys).
    const subjects = dedupeSubjects(
      workSubjects.length > 0 ? workSubjects : bibkeysSubjects
    )
    const series       = chainSeriesName || bibkeysSeries.name   || null
    const seriesNumber = chainSeriesPos  || bibkeysSeries.number || null

    // Cover URL validity check (3e Tier 1) — drop OL's 1×1 placeholder.
    const verifiedCover = await verifyCoverUrl(cover)

    // Summary: try bibkeys.notes / bibkeys.excerpts first (per-edition);
    // fall back to the works-record description for books that only
    // have prose there. Each candidate gets the placeholder heuristic
    // (3f Tier 1) so AR-code blurbs / distributor rows never survive.
    const bibkeysSummary = (data.notes && (data.notes.value || data.notes)) ||
                           (data.excerpts && data.excerpts[0] && data.excerpts[0].text) ||
                           ''
    let summary = ''
    if (bibkeysSummary && !looksLikePlaceholderSummary(bibkeysSummary)) {
      summary = bibkeysSummary
    } else if (workDescription && !looksLikePlaceholderSummary(workDescription)) {
      summary = workDescription
    }

    // Title: bibkeys returns `title` and `subtitle` as separate fields.
    // Catalogers' convention (and how AdminBooks stores it) is to
    // combine them as "Title: Subtitle" — see combineTitle() for the
    // capitalization rule.
    const title = combineTitle(data.title, data.subtitle)

    return {
      isbn13,
      title,
      authors,
      publishedYear : pickYear(data.publish_date),
      coverUrl      : verifiedCover,
      summary,
      series,
      seriesNumber,
      subjects,
      source        : 'open-library'
    }
  } catch (_err) {
    return null
  }
}

/**
 * Asks Google Books for the ISBN as a fallback when Open Library
 * returns nothing usable.
 *
 * @param   {string} isbn13
 * @returns {Promise<BookLookupResult|null>}
 */
async function fromGoogleBooks(isbn13) {
  try {
    const url      = `${GOOGLE_BOOKS}?q=isbn:${isbn13}`
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return null

    const body = await response.json()
    const item = Array.isArray(body.items) && body.items[0]
    if (!item || !item.volumeInfo) return null

    const v       = item.volumeInfo
    const authors = Array.isArray(v.authors) ? v.authors : []

    // Google Books cover URLs sometimes start with http://; upgrade to https
    // so the page doesn't trip mixed-content warnings.
    let coverUrl = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || null
    if (coverUrl && coverUrl.startsWith('http://')) {
      coverUrl = 'https://' + coverUrl.slice(7)
    }

    // Google Books returns `categories` instead of `subjects` (same
    // idea: subject/genre tags). Some volumes include them, some don't.
    const subjects = dedupeSubjects(Array.isArray(v.categories) ? v.categories : [])

    // Google Books surfaces series via `seriesInfo.shortSeriesBookTitle`
    // (e.g. "Book 3") and `seriesInfo.volumeSeries[0].seriesId`, but no
    // direct name. Fall back to parsing "Series Name #N" out of the
    // title or subtitle when present.
    let series = { name: null, number: null }
    if (v.seriesInfo && Array.isArray(v.seriesInfo.volumeSeries) && v.seriesInfo.volumeSeries[0]) {
      // We can't fetch the series name reliably from Google Books'
      // basic volume response — it requires a separate API. Skip
      // setting `series.name` here; admin can fill it in manually if
      // they care.
      const num = parseInt(v.seriesInfo.bookDisplayNumber, 10)
      if (Number.isFinite(num)) series.number = num
    }

    // Cover URL validity check (3e Tier 1). Google's thumbnails are
    // usually solid, but the HEAD check catches the edge cases where
    // a volume's image link points at a dead asset.
    const verifiedCover = await verifyCoverUrl(coverUrl)

    // Summary placeholder filter (3f Tier 1). Google's `description`
    // is almost always real prose, but the heuristic is cheap and
    // catches the rare distributor-blurb edition entries.
    const rawSummary = v.description || ''
    const summary    = looksLikePlaceholderSummary(rawSummary) ? '' : rawSummary

    // Google Books exposes both v.title and v.subtitle (same shape as
    // OL bibkeys). Combine for consistency with fromOpenLibrary so
    // admin-curated "Title: Subtitle" forms don't show up as a
    // spurious diff just because Google split them.
    const title = combineTitle(v.title, v.subtitle)

    return {
      isbn13,
      title,
      authors,
      publishedYear : pickYear(v.publishedDate),
      coverUrl      : verifiedCover,
      summary,
      series        : series.name,
      seriesNumber  : series.number,
      subjects,
      source        : 'google-books'
    }
  } catch (_err) {
    return null
  }
}

/**
 * Looks up a book by ISBN, trying Open Library first, then Google
 * Books. Returns null if neither has a record.
 *
 * @param   {string} rawIsbn  - Any reasonable ISBN-10 or ISBN-13 input.
 * @returns {Promise<BookLookupResult|null>}
 */
export async function lookupBookByIsbn(rawIsbn) {
  const isbn13 = normalizeIsbn(rawIsbn)
  if (!isbn13) return null

  const fromOl = await fromOpenLibrary(isbn13)
  if (fromOl && fromOl.title) return fromOl

  const fromGb = await fromGoogleBooks(isbn13)
  if (fromGb && fromGb.title) return fromGb

  return null
}

/**
 * Builds the canonical Open Library cover URL for a given ISBN. Useful
 * as a deterministic fallback when an API record has no cover field.
 *
 * @param   {string}  isbn13
 * @param   {'S'|'M'|'L'} [size='L']
 * @returns {string}
 */
export function openLibraryCoverUrl(isbn13, size = 'L') {
  return `${OPEN_LIBRARY_COVER}/${isbn13}-${size}.jpg`
}

// ── TITLE SEARCH ─────────────────────────────────────────────────────
//
// LOOT's tool layer (ITEM 9c) needs to answer "find me a book named X"
// even when the user only has a title, not an ISBN. Both APIs offer
// title-search endpoints with no auth:
//   - Open Library: /search.json?title=...&limit=N
//   - Google Books: /volumes?q=intitle:...&maxResults=N
// Open Library first because its data is cleaner for kid/picture books;
// Google Books for fallback when OL has nothing.

const OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json'
const OPEN_LIBRARY_COVERS = 'https://covers.openlibrary.org/b'

/**
 * @typedef {Object} BookSearchMatch
 * @property {string|null} isbn13         - Best ISBN-13 we could pick from the result. May be null if the source had no ISBN-13.
 * @property {string}      title
 * @property {string[]}    authors
 * @property {number|null} publishedYear
 * @property {string|null} coverUrl
 * @property {'open-library'|'google-books'} source
 */

/** Pick the best ISBN-13 from an Open Library search-result `isbn` array. */
function pickIsbn13(isbnList) {
  if (!Array.isArray(isbnList)) return null
  const thirteen = isbnList.find((i) => typeof i === 'string' && /^\d{13}$/.test(i))
  return thirteen || null
}

/**
 * @param   {string} title
 * @param   {number} limit
 * @returns {Promise<BookSearchMatch[]>}
 */
async function searchOpenLibrary(title, limit) {
  try {
    const url      = `${OPEN_LIBRARY_SEARCH}?title=${encodeURIComponent(title)}&limit=${limit}`
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return []

    const body = await response.json()
    const docs = Array.isArray(body.docs) ? body.docs : []

    const mapped = docs.map((d) => ({
      isbn13       : pickIsbn13(d.isbn),
      title        : combineTitle(d.title, d.subtitle),
      authors      : Array.isArray(d.author_name) ? d.author_name : [],
      publishedYear: typeof d.first_publish_year === 'number' ? d.first_publish_year : null,
      coverUrl     : d.cover_i ? `${OPEN_LIBRARY_COVERS}/id/${d.cover_i}-L.jpg` : null,
      source       : 'open-library'
    }))

    // Sort ISBN-13-bearing matches first — they're actionable for
    // downstream catalog checks. Edition entries without an ISBN
    // still come back so the caller can show "this title exists
    // but no ISBN found" when nothing better turns up.
    mapped.sort((a, b) => {
      if (a.isbn13 && !b.isbn13) return -1
      if (!a.isbn13 && b.isbn13) return  1
      return 0
    })
    return mapped
  } catch (_err) {
    return []
  }
}

/**
 * @param   {string} title
 * @param   {number} limit
 * @returns {Promise<BookSearchMatch[]>}
 */
async function searchGoogleBooks(title, limit) {
  try {
    const url      = `${GOOGLE_BOOKS}?q=intitle:${encodeURIComponent(title)}&maxResults=${limit}`
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return []

    const body  = await response.json()
    const items = Array.isArray(body.items) ? body.items : []

    return items.map((item) => {
      const v       = item.volumeInfo || {}
      const authors = Array.isArray(v.authors) ? v.authors : []

      // Pick the ISBN-13 from industryIdentifiers if available.
      const ids = Array.isArray(v.industryIdentifiers) ? v.industryIdentifiers : []
      const isbn13Entry = ids.find((id) => id.type === 'ISBN_13' && id.identifier)
      const isbn13 = isbn13Entry ? isbn13Entry.identifier : null

      let coverUrl = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || null
      if (coverUrl && coverUrl.startsWith('http://')) {
        coverUrl = 'https://' + coverUrl.slice(7)
      }

      return {
        isbn13,
        title        : combineTitle(v.title, v.subtitle),
        authors,
        publishedYear: pickYear(v.publishedDate),
        coverUrl,
        source       : 'google-books'
      }
    })
  } catch (_err) {
    return []
  }
}

/**
 * Searches for books matching a title query. Tries Open Library first,
 * falls back to Google Books when OL returns nothing. Returns up to
 * `limit` candidates. Empty array if neither source has matches —
 * callers should treat that as "no results" not an error.
 *
 * @param   {string} title    Title query (partial OK).
 * @param   {number} [limit]  Max results to return. Default 5.
 * @returns {Promise<BookSearchMatch[]>}
 */
export async function searchBooksByTitle(title, limit = 5) {
  if (!title || typeof title !== 'string' || !title.trim()) return []
  const trimmed = title.trim()
  const cap     = Math.max(1, Math.min(10, limit))

  const fromOl = await searchOpenLibrary(trimmed, cap)
  if (fromOl.length > 0) return fromOl.slice(0, cap)

  const fromGb = await searchGoogleBooks(trimmed, cap)
  return fromGb.slice(0, cap)
}
