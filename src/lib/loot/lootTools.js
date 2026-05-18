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

import { getDoc }                       from 'firebase/firestore'

import { lookupBookByIsbn,
         searchBooksByTitle }            from '../../utils/bookLookup.js'
import { normalizeIsbn }                 from '../../utils/isbn.js'

import { tenantDoc }                     from '../../firebase/tenant.js'

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
      'to answer "is X in our catalog?" questions.',
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
  isBookInCatalog   : impl_isBookInCatalog
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
  }
}
