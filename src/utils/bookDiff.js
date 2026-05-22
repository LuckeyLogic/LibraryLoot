// src/utils/bookDiff.js
//
// Computes a field-by-field diff between an existing book document and
// a fresh metadata lookup result. Drives the Refresh-button review
// modal in AdminBooks (RefreshDiffModal): the admin sees what the API
// would change, picks which changes to accept, and optionally edits
// the suggested value inline before applying.
//
// Smart defaults protect against the "I manually wrote a good summary,
// the API still returns garbage, refresh blew it away" scenario that
// surfaced in 2026-05-20 testing:
//   - populate-empty       → checked   (additive, no risk)
//   - clear-existing       → unchecked (the heuristic fired but you
//                                       may want to keep what you have)
//   - replace-existing     → unchecked (both have values; only you
//                                       know which is better)
//
// Created by Miguel Brown on 5/20/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

/**
 * Field metadata — drives both the diff comparison and the modal's
 * input rendering. Order matters: rows appear in this order in the
 * modal.
 */
const FIELDS = [
  { key: 'title',         label: 'Title',          inputType: 'text'                                                                    },
  { key: 'authors',       label: 'Authors',        inputType: 'csv',      hint: 'Comma-separated list'                                  },
  { key: 'publishedYear', label: 'Published year', inputType: 'number'                                                                  },
  { key: 'coverUrl',      label: 'Cover URL',      inputType: 'text',     hint: 'Direct image URL — empty if no usable cover was found' },
  { key: 'summary',       label: 'Summary',        inputType: 'textarea'                                                                },
  { key: 'series',        label: 'Series',         inputType: 'text'                                                                    },
  { key: 'seriesNumber',  label: 'Series #',       inputType: 'number'                                                                  },
  { key: 'subjects',      label: 'Subjects',       inputType: 'csv',      hint: 'Comma-separated list, max 6 tags'                      }
]

/**
 * Hard cap on subjects[] length. Mirrors `MAX_SUBJECTS` in
 * src/utils/bookLookup.js — kept in sync by hand. Drives the
 * additive-merge math for the subjects diff row.
 */
const SUBJECTS_CAP = 6

/**
 * Convert a field value (from either an existing book doc or a fresh
 * lookup result) into the string shape the form uses. The form layer
 * is all-strings — arrays render as comma-joined, numbers as their
 * string form, null/undefined as ''.
 *
 * @param {Object} book   Either a book doc OR a BookLookupResult.
 * @param {string} key
 * @returns {string}
 */
function stringify(book, key) {
  const v = book ? book[key] : null
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/**
 * Classify the kind of change a diff row represents. Drives the
 * smart-default checkbox state + the row's visual treatment in the
 * modal.
 *
 * @param   {string} oldS  Trimmed string form of the existing value.
 * @param   {string} newS  Trimmed string form of the new API value.
 * @returns {'additive'|'destructive'|'replace'}
 */
function classifyKind(oldS, newS) {
  const oldEmpty = !oldS
  const newEmpty = !newS
  if (oldEmpty && !newEmpty)  return 'additive'
  if (!oldEmpty && newEmpty)  return 'destructive'
  return 'replace'
}

/**
 * Special-case row builder for `subjects`. Subjects are tags (set-like),
 * not a single value, so a whole-array replace is the wrong semantic —
 * API returning a SHORTER list than what the admin curated shouldn't
 * propose deleting the admin's work.
 *
 * Rules:
 *   1. Compute the case-insensitive set difference (tags the API has
 *      that the existing book doesn't).
 *   2. If `existing` is already at SUBJECTS_CAP, there's no room to
 *      add anything — return null (no row).
 *   3. If no genuinely-new tags survive the diff — return null.
 *   4. Otherwise, the proposed value is `existing` + the new tags,
 *      capped at SUBJECTS_CAP (existing-first, additions overflow gets
 *      dropped).
 *
 * The diff is *additive only* — existing tags are never removed by
 * default. If the admin wants to remove tags, they can edit the input
 * field inline before applying.
 *
 * @param   {Object} existing
 * @param   {Object} fresh
 * @returns {Object|null}  Row object, or null when there's nothing to
 *                         add.
 */
function diffSubjectsRow(existing, fresh) {
  const oldArr = Array.isArray(existing.subjects) ? existing.subjects : []
  const newArr = Array.isArray(fresh.subjects)    ? fresh.subjects    : []

  if (oldArr.length >= SUBJECTS_CAP) return null

  const existingSet = new Set(oldArr.map((s) => String(s).toLowerCase().trim()))
  const additions   = []
  const roomLeft    = SUBJECTS_CAP - oldArr.length
  for (const t of newArr) {
    const trimmed = String(t).trim()
    const key     = trimmed.toLowerCase()
    if (!trimmed || existingSet.has(key)) continue
    additions.push(trimmed)
    existingSet.add(key)
    if (additions.length >= roomLeft) break
  }
  if (additions.length === 0) return null

  const proposed = [...oldArr, ...additions]
  const oldS     = oldArr.join(', ')
  const newS     = proposed.join(', ')

  const kindLabel = additions.length === 1
    ? `Will add new tag: "${additions[0]}"`
    : `Will add ${additions.length} new tags`

  return {
    field         : 'subjects',
    label         : 'Subjects',
    inputType     : 'csv',
    hint          : `Comma-separated list, max ${SUBJECTS_CAP} tags`,
    oldValue      : oldS,
    newValue      : newS,
    kind          : 'additive',
    kindLabel,                       // overrides the default diffKindLabel
    defaultChecked: true
  }
}

/**
 * Build the list of diff rows for the Refresh modal.
 *
 * Skips fields where the existing and fresh values are identical after
 * normalization — only changed fields appear. Also skips fields that
 * are never API-sourced (readingLevel, coverStoragePath) or that the
 * admin can't safely change here (isbn13, source).
 *
 * `subjects` gets special-case additive-merge semantics (see
 * `diffSubjectsRow`) — the API can suggest ADDING tags but never
 * REMOVING admin-curated ones.
 *
 * @param   {Object} existing  The book doc currently in Firestore.
 * @param   {Object} fresh     The lookup result from utils/bookLookup.lookupBookByIsbn.
 * @returns {Array<Object>}
 *     Each entry: { field, label, inputType, hint, oldValue, newValue, kind,
 *                   kindLabel?, defaultChecked }.
 *     - oldValue/newValue are the string forms (for display + as the initial editable input value).
 *     - kind drives the row's color/visual treatment.
 *     - kindLabel (optional) overrides the default text from diffKindLabel().
 *     - defaultChecked is the smart-default state for the checkbox.
 */
export function computeBookDiff(existing, fresh) {
  if (!existing || !fresh) return []

  const rows = []
  for (const f of FIELDS) {

    // Subjects: additive set-merge instead of whole-array replace.
    if (f.key === 'subjects') {
      const row = diffSubjectsRow(existing, fresh)
      if (row) rows.push(row)
      continue
    }

    const oldS = stringify(existing, f.key).trim()
    const newS = stringify(fresh, f.key).trim()
    if (oldS === newS) continue

    const kind = classifyKind(oldS, newS)
    rows.push({
      field         : f.key,
      label         : f.label,
      inputType     : f.inputType,
      hint          : f.hint || null,
      oldValue      : oldS,
      newValue      : newS,
      kind,
      defaultChecked: kind === 'additive'
    })
  }
  return rows
}

/**
 * Human-readable label for a diff-row kind. Used by the modal to
 * caption each row with WHY a checkbox defaults to checked or
 * unchecked.
 *
 * @param   {'additive'|'destructive'|'replace'} kind
 * @returns {string}
 */
export function diffKindLabel(kind) {
  if (kind === 'additive')    return 'Will populate empty field'
  if (kind === 'destructive') return 'Will clear your existing value'
  if (kind === 'replace')     return 'Will replace your existing value'
  return ''
}
