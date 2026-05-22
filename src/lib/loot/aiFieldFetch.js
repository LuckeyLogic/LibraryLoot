/**
 * Per-field "🤖 Find via AI" fetcher for the Refresh-diff modal. Wraps a focused
 * call into LOOT (Gemini 2.5 Flash via Vertex AI) + the existing 9c.3 searchWeb
 * / fetchPage Cloud Functions. The operator hits a button on a diff row whose
 * new value came back empty from Open Library / Google Books, and the AI goes
 * hunting for a real value on the open web — with the same CITATION & HONESTY
 * guardrails the LOOT chat already enforces. Tier 3 of ITEMs 3e and 3f — pays
 * off the capability we built in 9c.3.…
 * @module lib/loot/aiFieldFetch
 */
// src/lib/loot/aiFieldFetch.js
//
// Per-field "🤖 Find via AI" fetcher for the Refresh-diff modal.
// Wraps a focused call into LOOT (Gemini 2.5 Flash via Vertex AI)
// + the existing 9c.3 searchWeb / fetchPage Cloud Functions. The
// operator hits a button on a diff row whose new value came back
// empty from Open Library / Google Books, and the AI goes hunting
// for a real value on the open web — with the same CITATION &
// HONESTY guardrails the LOOT chat already enforces.
//
// Tier 3 of ITEMs 3e and 3f — pays off the capability we built in
// 9c.3.
//
// SCOPE for v1:
//   - 'summary'  : structured AI extraction of a kid-appropriate
//                  plot summary from web search + page fetch
//   - 'coverUrl' : NOT YET. Requires reaching image URLs through
//                  fetchPage's text-only extraction, OR a new
//                  imageSearch Cloud Function. Tracked as Round 2.5.
//
// Created by Miguel Brown on 5/20/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { chatWithLoot }      from './lootClient.js'

/**
 * Field-specific prompt templates. Each takes a book object and
 * returns the user message we send to LOOT. The templates lock
 * down the output shape so we can parse it deterministically — no
 * "Sure, I'd be happy to..." preamble, no extra commentary, just
 * the two labelled lines.
 *
 * The CITATION & HONESTY block in LOOT's system prompt enforces the
 * "never invent" rule. These prompts just steer toward the field-
 * specific need.
 */
const FIELD_PROMPTS = {

  summary: (book) => `
You are filling the SUMMARY field for this book in our library catalog:

  Title    : "${book.title}"
  Author(s): ${(book.authors || []).join(', ') || '(unknown)'}
  ISBN-13  : ${book.isbn13 || '(unknown)'}
  Year     : ${book.publishedYear || '(unknown)'}

Use your searchWeb tool (and fetchPage if the snippet isn't enough) to find a real, kid-appropriate plot summary for this book.

REQUIREMENTS:
- 2-4 sentences of plain prose describing the plot or premise.
- Suitable for a kids' library catalog — no spoilers for the ending, age-appropriate tone.
- MUST be grounded in a real source you actually fetched. Do NOT invent details.
- If you can't find a real source, say so plainly — do NOT make something up.

OUTPUT FORMAT — return EXACTLY one of these two shapes, nothing else:

A. Found a real source:

SUMMARY: <your 2-4 sentence summary>
SOURCE: <the URL where you got it>

B. No useful source found:

SUMMARY: (none)
SOURCE: (none)

No preamble. No "Here is a summary..." text. No markdown formatting. Just the two labelled lines.
`.trim()

}

/**
 * Parse LOOT's structured response into either { value, source } or
 * { error }. Tolerant of small formatting drift (extra whitespace,
 * different newline conventions) but bails on anything that doesn't
 * roughly match the contract.
 *
 * @param {string} text  Raw text reply from chatWithLoot.
 * @returns {{value: string, source: string|null} | {error: string}}
 */
function parseStructuredResponse(text) {
  if (!text || typeof text !== 'string') {
    return { error: 'AI returned an empty response.' }
  }

  const summaryMatch = text.match(/SUMMARY\s*:\s*([\s\S]*?)\n\s*SOURCE\s*:/i)
  const sourceMatch  = text.match(/SOURCE\s*:\s*(.+?)\s*$/im)
  if (!summaryMatch) {
    return {
      error: 'AI response didn\'t match the expected format. Try again.'
    }
  }

  const value  = summaryMatch[1].trim()
  const source = sourceMatch ? sourceMatch[1].trim() : null

  // Sentinel for the "no real source" branch — keep this in sync
  // with the prompt template's B-shape.
  if (!value || /^\(none\)$/i.test(value)) {
    return {
      error: 'No real source found for this book. Try again or fill it in manually.'
    }
  }
  if (source && /^\(none\)$/i.test(source)) {
    // Has prose but admits no source — refuse it. The whole point of
    // the AI button is to surface a CITED value, not a hallucination.
    return {
      error: 'AI returned a value but couldn\'t cite a source. Refusing to surface unverified content.'
    }
  }

  return { value, source: source || null }
}

/**
 * Ask LOOT to find a real value for one field of a book, by searching
 * the open web through the existing searchWeb + fetchPage tools.
 *
 * Returns either { value, source } where `value` is the field text
 * the modal should drop into the editable input AND `source` is the
 * URL we got it from (for the operator's reference), or { error }
 * with a one-sentence message safe to show in the UI.
 *
 * Never throws — every error path returns the { error } shape.
 *
 * @param {Object} params
 * @param {Object} params.book   The book doc currently in Firestore (or
 *                               the lookup result). Used for title,
 *                               authors, isbn13, publishedYear.
 * @param {string} params.field  Field key — one of: 'summary'.
 * @returns {Promise<{value: string, source: string|null} | {error: string}>}
 */
export async function findFieldViaAI({ book, field }) {

  const promptFn = FIELD_PROMPTS[field]
  if (!promptFn) {
    return { error: `AI search for "${field}" isn't supported yet.` }
  }
  if (!book) {
    return { error: 'No book context provided.' }
  }

  try {
    const prompt  = promptFn(book)
    const history = [{ role: 'user', text: prompt }]
    const reply   = await chatWithLoot(history)
    return parseStructuredResponse(reply)
  } catch (err) {
    // chatWithLoot throws for bad history shape; the underlying
    // tools (searchWeb / fetchPage) return error objects rather than
    // throwing, so the model's reply already incorporates any tool
    // failures. Anything reaching here is a transport-level problem.
    // eslint-disable-next-line no-console
    console.error('[aiFieldFetch] AI call failed', err)
    return {
      error: err && err.message
        ? `AI request failed: ${err.message}`
        : 'AI request failed.'
    }
  }
}
