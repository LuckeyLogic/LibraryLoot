// src/lib/loot/lootTools.js
//
// LOOT's tools — what the assistant can DO when chatting. Each tool has
// two halves that live side-by-side in this file so they can't drift:
//
//   1. A FunctionDeclaration (the schema that Gemini sees in the model
//      config). This is what tells Gemini which tools exist, what
//      arguments they take, and when to use them.
//   2. An implementation (the actual JS that runs when Gemini decides
//      to call the tool). Implementations are async, accept the
//      arguments object the model produced, and return either a data
//      object the model can read back OR `{ error: '<friendly text>' }`.
//
// Error handling policy: implementations NEVER throw. They catch every
// exception, console.error it (TODO ITEM 9c.1: wire to admin-visible
// error log once LOOT conversation logging lands), and return an error
// object the model can read and explain to the user. Throwing would
// break the chat loop in lootClient.js.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { getDoc, getDocs }              from 'firebase/firestore'
import { httpsCallable }                 from 'firebase/functions'

import { lookupBookByIsbn,
         searchBooksByTitle }            from '../../utils/bookLookup.js'
import { normalizeIsbn }                 from '../../utils/isbn.js'

import { functions }                     from '../../firebase.js'
import { tenantCollection,
         tenantDoc }                     from '../../firebase/tenant.js'

// ── DECLARATIONS ─────────────────────────────────────────────────────
//
// Schema follows Gemini's FunctionDeclaration shape. Keep descriptions
// punchy + decision-oriented — the model reads these to decide WHICH
// tool to call, not WHAT each does mechanically.

const declarations = [
  {
    name       : 'lookupBookByIsbn',
    description:
      'Look up book metadata (title, authors, year, cover, summary) ' +
      'by ISBN against Open Library + Google Books. Use when the user ' +
      'has an ISBN. Returns canonical ISBN-13 even if input was ISBN-10. ' +
      'This searches the WIDER WEB, not the tenant catalog — use ' +
      'isBookInCatalog to check whether a book is actually in this library.',
    parameters: {
      type      : 'object',
      properties: {
        isbn: {
          type       : 'string',
          description: 'An ISBN-10 or ISBN-13. Hyphens / spaces tolerated.'
        }
      },
      required: ['isbn']
    }
  },
  {
    name       : 'searchBooksByTitle',
    description:
      'Search the web for books by title. Returns up to 5 candidates ' +
      'with ISBN-13 (when available), title, authors, year, cover URL. ' +
      'Use when the user names a book without giving an ISBN. Read the ' +
      'matches back to the user and ask them to confirm WHICH one if ' +
      'there\'s ambiguity — there often is for common titles.',
    parameters: {
      type      : 'object',
      properties: {
        title: {
          type       : 'string',
          description: 'Book title or partial title to search.'
        }
      },
      required: ['title']
    }
  },
  {
    name       : 'isBookInCatalog',
    description:
      'Check whether a specific ISBN is currently in THIS tenant\'s book ' +
      'catalog (Firestore). Returns { inCatalog, active, title, addedAt }. ' +
      'Distinct from lookupBookByIsbn — that searches the wider web; this ' +
      'reports what\'s actually been added to this library\'s shelf. Use ' +
      'when you already know the ISBN; otherwise prefer searchCatalogByTitle.',
    parameters: {
      type      : 'object',
      properties: {
        isbn: {
          type       : 'string',
          description: 'An ISBN-10 or ISBN-13. Normalized to ISBN-13 before lookup.'
        }
      },
      required: ['isbn']
    }
  },
  {
    name       : 'searchCatalog',
    description:
      'Flexible search of THIS tenant\'s book catalog. Pass any combination ' +
      'of the criteria below; books must match ALL provided criteria (AND ' +
      'semantics). Returns up to 20 matches with { isbn13, title, authors, ' +
      'publishedYear, readingLevel, minAge, maxAge, active, quizApproved }. ' +
      'Use this FIRST for any "what do we have…" / "is X in our catalog?" / ' +
      '"anything by Y?" / "books for a 7-year-old" / "what middle-grade ' +
      'books need quiz approval?" question — it\'s one Firestore read, no ' +
      'web round-trip. Fall back to searchBooksByTitle (web) only when ' +
      'this returns no matches.',
    parameters: {
      type      : 'object',
      properties: {
        title       : { type: 'string',  description: 'Title substring (case-insensitive, punctuation-normalized — commas/colons/etc. don\'t need to match).' },
        author      : { type: 'string',  description: 'Author name substring; matches if ANY author in the book\'s authors[] array contains this.' },
        series      : { type: 'string',  description: 'Series-name substring; matches book.series. Use for questions like "do we have any Harry Potter books?" or "any Baby-Sitters Club?"' },
        subject     : { type: 'string',  description: 'Subject / genre / category substring; matches if ANY tag in book.subjects[] contains this. Use for "books about friendship", "fantasy books", etc.' },
        yearMin     : { type: 'integer', description: 'Minimum publishedYear (inclusive).' },
        yearMax     : { type: 'integer', description: 'Maximum publishedYear (inclusive).' },
        readingLevel: { type: 'string',  description: 'Exact match. Valid values: "Early reader", "Grade 3-5", "Middle grade", "YA", "Not specified".' },
        forAge      : { type: 'integer', description: 'Books appropriate for a kid of this age. Matches if book.minAge <= N AND (book.maxAge is null OR book.maxAge >= N).' },
        activeOnly  : { type: 'boolean', description: 'When true, only return books with active: true.' },
        quizApproved: { type: 'boolean', description: 'Exact match on quizApproved (true/false).' }
      }
      // No required fields — empty {} lists the whole catalog (capped).
    }
  },
  {
    name       : 'searchWeb',
    description:
      'Search the broader web (via Brave Search) for general info — book ' +
      'summaries, cover candidates, sponsor brand verification, etc. ' +
      'Returns up to 10 results, each with { title, url, snippet, source }. ' +
      'Use ONLY for questions the other tools can\'t answer: searchCatalog ' +
      'handles "what\'s in our catalog?", lookupBookByIsbn / ' +
      'searchBooksByTitle handle book metadata. searchWeb is for the open ' +
      'web. When you use this tool, you MUST cite the URL of the source ' +
      'you rely on in your reply. If no result actually answers the user\'s ' +
      'question, say so plainly — DO NOT make up details that aren\'t in ' +
      'a real result.',
    parameters: {
      type      : 'object',
      properties: {
        query: {
          type       : 'string',
          description: 'Search query. Keep it focused — 1-2 lines max.'
        },
        count: {
          type       : 'integer',
          description: 'How many results to fetch (1-10). Default 5.'
        }
      },
      required: ['query']
    }
  },
  {
    name       : 'fetchPage',
    description:
      'Read the main text content of a specific web page. Use AFTER ' +
      'searchWeb when the snippet isn\'t enough — pick a result URL and ' +
      'fetch the full page to read it. Returns { text, title, url } where ' +
      'text is the page\'s main readable content (up to ~10K chars, with ' +
      'a "(truncated)" marker if longer). Pages are cached server-side for ' +
      '24h, so repeated reads of the same URL are free. When you cite ' +
      'something from a fetched page, cite the page\'s URL — not the ' +
      'search result\'s URL (they\'re usually the same, but after ' +
      'redirects they can differ).',
    parameters: {
      type      : 'object',
      properties: {
        url: {
          type       : 'string',
          description: 'Full http(s) URL of the page to read. Must come ' +
            'from a previous searchWeb result or from a URL the user ' +
            'explicitly pasted — DO NOT make up URLs.'
        }
      },
      required: ['url']
    }
  }
]

// ── IMPLEMENTATIONS ──────────────────────────────────────────────────

/**
 * @param {{isbn: string}} args
 * @returns {Promise<Object>}
 */
async function impl_lookupBookByIsbn(args) {
  try {
    const isbn = String(args && args.isbn || '').trim()
    if (!isbn) {
      return { error: 'No ISBN provided.' }
    }
    const result = await lookupBookByIsbn(isbn)
    if (!result) {
      return {
        error: `Neither Open Library nor Google Books had a record for "${isbn}". Double-check the ISBN, or ask the user to search by title instead.`
      }
    }
    return result
  } catch (err) {
    // TODO(ITEM 9c.1): write to LOOT error log once conversation
    // logging ships, so admin can see tool-failure patterns.
    console.error('[lootTools] lookupBookByIsbn error', err)
    return {
      error: `Book lookup failed: ${err && err.message ? err.message : 'unknown error'}.`
    }
  }
}

/**
 * @param {{title: string}} args
 * @returns {Promise<Object>}
 */
async function impl_searchBooksByTitle(args) {
  try {
    const title = String(args && args.title || '').trim()
    if (!title) {
      return { error: 'No title provided.' }
    }
    const matches = await searchBooksByTitle(title, 5)
    if (matches.length === 0) {
      return {
        error: `No matches found for "${title}". Ask the user to try a different title or to provide an ISBN.`
      }
    }
    return { matches }
  } catch (err) {
    // TODO(ITEM 9c.1): write to LOOT error log.
    console.error('[lootTools] searchBooksByTitle error', err)
    return {
      error: `Title search failed: ${err && err.message ? err.message : 'unknown error'}.`
    }
  }
}

/**
 * @param {{isbn: string}} args
 * @returns {Promise<Object>}
 */
async function impl_isBookInCatalog(args) {
  try {
    const raw    = String(args && args.isbn || '').trim()
    const isbn13 = normalizeIsbn(raw)
    if (!isbn13) {
      return { error: `"${raw}" doesn't look like a valid ISBN.` }
    }
    const snap = await getDoc(tenantDoc('books', isbn13))
    if (!snap.exists()) {
      return { inCatalog: false, isbn13 }
    }
    const data = snap.data() || {}
    return {
      inCatalog : true,
      isbn13,
      active    : data.active === true,
      title     : data.title || null,
      addedAtMs : data.addedAt && data.addedAt.toMillis ? data.addedAt.toMillis() : null
    }
  } catch (err) {
    // TODO(ITEM 9c.1): write to LOOT error log.
    console.error('[lootTools] isBookInCatalog error', err)
    return {
      error: `Catalog check failed: ${err && err.message ? err.message : 'unknown error'}.`
    }
  }
}

/**
 * Normalize a string for fuzzy substring comparison: lowercase, strip
 * non-alphanumerics (commas / periods / colons / hyphens / apostrophes /
 * parens / em-dashes / ampersands all collapse to whitespace), then
 * collapse runs of whitespace to a single space.
 *
 * Catalog: "Steam Train, Dream Train" → "steam train dream train"
 * User:    "Steam Train Dream Train"  → "steam train dream train"
 * → match.
 *
 * Same normalizer is used for both title and author searches so
 * "J. K. Rowling" matches "JK Rowling" matches "jk rowling".
 */
function normalizeForSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build a single human-readable summary of which catalog criteria are
 * active. Drives the chip label in LootMessage so the admin can see
 * exactly what LOOT is searching for ("📚 Searching catalog: author
 * 'Ann M Martin', year ≥ 2020"). Returns "all books" when no
 * criteria were passed.
 */
function describeCatalogCriteria(args = {}) {
  const parts = []
  if (args.title)        parts.push(`title "${args.title}"`)
  if (args.author)       parts.push(`author "${args.author}"`)
  if (args.series)       parts.push(`series "${args.series}"`)
  if (args.subject)      parts.push(`subject "${args.subject}"`)
  if (args.yearMin != null && args.yearMax != null) parts.push(`year ${args.yearMin}-${args.yearMax}`)
  else if (args.yearMin != null) parts.push(`year ≥ ${args.yearMin}`)
  else if (args.yearMax != null) parts.push(`year ≤ ${args.yearMax}`)
  if (args.readingLevel) parts.push(`level "${args.readingLevel}"`)
  if (args.forAge != null) parts.push(`age ${args.forAge}`)
  if (args.activeOnly)   parts.push('active only')
  if (args.quizApproved !== undefined && args.quizApproved !== null) {
    parts.push(args.quizApproved ? 'quiz approved' : 'quiz unapproved')
  }
  return parts.length === 0 ? 'all books' : parts.join(', ')
}

/**
 * @param {Object} args  Any combination of {title, author, yearMin,
 *                       yearMax, readingLevel, forAge, activeOnly,
 *                       quizApproved}.
 * @returns {Promise<Object>}
 */
async function impl_searchCatalog(args = {}) {
  try {
    // Pre-compute normalized needles so we don't do it per book.
    const titleNeedle   = args.title   ? normalizeForSearch(args.title)   : null
    const authorNeedle  = args.author  ? normalizeForSearch(args.author)  : null
    const seriesNeedle  = args.series  ? normalizeForSearch(args.series)  : null
    const subjectNeedle = args.subject ? normalizeForSearch(args.subject) : null

    const snap = await getDocs(tenantCollection('books'))
    const matches = []

    snap.forEach((d) => {
      const data = d.data() || {}

      // Title substring (punctuation-normalized).
      if (titleNeedle) {
        const t = normalizeForSearch(data.title)
        if (!t || !t.includes(titleNeedle)) return
      }

      // Author substring against ANY author in the array.
      if (authorNeedle) {
        const authors = Array.isArray(data.authors) ? data.authors : []
        const anyAuthorMatch = authors.some(
          (a) => normalizeForSearch(a).includes(authorNeedle)
        )
        if (!anyAuthorMatch) return
      }

      // Series substring (single string field on each book, or null).
      if (seriesNeedle) {
        const s = normalizeForSearch(data.series)
        if (!s || !s.includes(seriesNeedle)) return
      }

      // Subject substring against ANY tag in book.subjects[].
      if (subjectNeedle) {
        const subjects = Array.isArray(data.subjects) ? data.subjects : []
        const anySubjectMatch = subjects.some(
          (t) => normalizeForSearch(t).includes(subjectNeedle)
        )
        if (!anySubjectMatch) return
      }

      // Year range (inclusive). null publishedYear excludes the book
      // from any year-bounded query — we have no idea where it falls.
      if (args.yearMin != null) {
        if (typeof data.publishedYear !== 'number' || data.publishedYear < args.yearMin) return
      }
      if (args.yearMax != null) {
        if (typeof data.publishedYear !== 'number' || data.publishedYear > args.yearMax) return
      }

      // Reading level — exact match (case-sensitive on canonical
      // enum value).
      if (args.readingLevel) {
        if (data.readingLevel !== args.readingLevel) return
      }

      // "Appropriate for age N": book.minAge <= N AND
      // (book.maxAge is null OR book.maxAge >= N).
      if (args.forAge != null) {
        const minA = typeof data.minAge === 'number' ? data.minAge : null
        const maxA = typeof data.maxAge === 'number' ? data.maxAge : null
        if (minA == null) return   // no minAge → can't confirm appropriateness
        if (minA > args.forAge) return
        if (maxA != null && maxA < args.forAge) return
      }

      // active filter.
      if (args.activeOnly === true) {
        if (data.active !== true) return
      }

      // quizApproved filter (explicit true/false).
      if (args.quizApproved !== undefined && args.quizApproved !== null) {
        if (data.quizApproved !== args.quizApproved) return
      }

      matches.push({
        isbn13       : data.isbn13 || d.id,
        title        : data.title || '',
        authors      : Array.isArray(data.authors) ? data.authors : [],
        publishedYear: typeof data.publishedYear === 'number' ? data.publishedYear : null,
        readingLevel : data.readingLevel || null,
        minAge       : typeof data.minAge === 'number' ? data.minAge : null,
        maxAge       : typeof data.maxAge === 'number' ? data.maxAge : null,
        series       : data.series || null,
        seriesNumber : typeof data.seriesNumber === 'number' ? data.seriesNumber : null,
        subjects     : Array.isArray(data.subjects) ? data.subjects : [],
        active       : data.active === true,
        quizApproved : data.quizApproved === true
      })
    })

    if (matches.length === 0) {
      return {
        error  : `No catalog match for { ${describeCatalogCriteria(args)} }. Try widening the criteria — or use searchBooksByTitle (web) to confirm a specific book exists.`,
        matches: []
      }
    }

    return { matches: matches.slice(0, 20), totalMatched: matches.length }
  } catch (err) {
    // TODO(ITEM 9c.1): write to LOOT error log.
    console.error('[lootTools] searchCatalog error', err)
    return {
      error: `Catalog search failed: ${err && err.message ? err.message : 'unknown error'}.`
    }
  }
}

// ── WEB SEARCH + PAGE FETCH (Cloud-Function-backed) ─────────────────
//
// These tools route through HTTPS-callables (ITEM 9c.3) so the Brave
// Search API key stays server-side, quotas are enforced in Firestore,
// and SSRF / hostile-host protection lives in one place. The model
// sees the same shape as for any other tool: pass args, get a data
// object or { error }.

/**
 * Pull a hostname out of a URL for the chip label. Best-effort —
 * falls back to the raw URL truncated to 40 chars if URL parsing
 * fails. Never throws; UI rendering depends on this.
 */
function hostnameForChip(rawUrl) {
  try {
    return new URL(rawUrl).hostname
  } catch (_e) {
    return String(rawUrl || '').slice(0, 40)
  }
}

/**
 * @param {{query: string, count?: number}} args
 * @returns {Promise<Object>}
 */
async function impl_searchWeb(args) {
  try {
    const query = String(args && args.query || '').trim()
    if (!query) {
      return { error: 'No search query provided.' }
    }
    const callable = httpsCallable(functions, 'lootWebSearch')
    const res      = await callable({
      query,
      count: Number.isInteger(args && args.count) ? args.count : 5
    })
    const data     = (res && res.data) || {}
    if (!Array.isArray(data.results) || data.results.length === 0) {
      return {
        error  : `No web results for "${query}". Try a different phrasing or be more specific.`,
        results: []
      }
    }
    return data
  } catch (err) {
    console.error('[lootTools] searchWeb error', err)
    // Cloud-Function HttpsError comes back with a .message we can show.
    const msg = err && err.message ? err.message : 'unknown error'
    return { error: `Web search failed: ${msg}.` }
  }
}

/**
 * @param {{url: string}} args
 * @returns {Promise<Object>}
 */
async function impl_fetchPage(args) {
  try {
    const url = String(args && args.url || '').trim()
    if (!url) {
      return { error: 'No URL provided.' }
    }
    const callable = httpsCallable(functions, 'lootFetchPage')
    const res      = await callable({ url })
    const data     = (res && res.data) || {}
    if (!data.text) {
      return {
        error: `Couldn't extract any readable text from ${url}. The page may be JS-heavy or behind a login wall.`
      }
    }
    return data
  } catch (err) {
    console.error('[lootTools] fetchPage error', err)
    const msg = err && err.message ? err.message : 'unknown error'
    return { error: `Page fetch failed: ${msg}.` }
  }
}

// ── EXPORTS ──────────────────────────────────────────────────────────

/** FunctionDeclaration[] — passed into getGenerativeModel({ tools }). */
export const lootToolDeclarations = declarations

/**
 * Map from tool name → implementation. lootClient.js looks up the
 * impl here when the model emits a function call.
 */
export const lootToolImplementations = {
  lookupBookByIsbn  : impl_lookupBookByIsbn,
  searchBooksByTitle: impl_searchBooksByTitle,
  isBookInCatalog   : impl_isBookInCatalog,
  searchCatalog     : impl_searchCatalog,
  searchWeb         : impl_searchWeb,
  fetchPage         : impl_fetchPage
}

/**
 * Pretty labels for the UI chip layer. Keep these in lockstep with the
 * declaration names so the chip rendering doesn't fall behind when we
 * add tools. The chip-renderer in LootMessage.jsx reads from this.
 *
 * Each entry:
 *   - emoji: a glyph rendered in the chip.
 *   - label: function (args) => string  — visible chip text.
 */
export const LOOT_TOOL_DISPLAY = {
  lookupBookByIsbn  : {
    emoji: '📖',
    label: (a) => `Looking up ISBN ${a && a.isbn ? a.isbn : '…'}`
  },
  searchBooksByTitle: {
    emoji: '🔍',
    label: (a) => `Searching for "${a && a.title ? a.title : '…'}"`
  },
  isBookInCatalog   : {
    emoji: '📚',
    label: (a) => `Checking catalog for ${a && a.isbn ? a.isbn : '…'}`
  },
  searchCatalog     : {
    emoji: '📚',
    label: (a) => `Searching catalog: ${describeCatalogCriteria(a || {})}`
  },
  searchWeb         : {
    emoji: '🌐',
    label: (a) => `Searching the web for "${a && a.query ? a.query : '…'}"`
  },
  fetchPage         : {
    emoji: '📄',
    label: (a) => `Reading ${a && a.url ? hostnameForChip(a.url) : '…'}`
  }
}
