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
 * Build the list of diff rows for the Refresh modal.
 *
 * Skips fields where the existing and fresh values are identical after
 * normalization — only changed fields appear. Also skips fields that
 * are never API-sourced (readingLevel, coverStoragePath) or that the
 * admin can't safely change here (isbn13, source).
 *
 * @param   {Object} existing  The book doc currently in Firestore.
 * @param   {Object} fresh     The lookup result from utils/bookLookup.lookupBookByIsbn.
 * @returns {Array<Object>}
 *     Each entry: { field, label, inputType, hint, oldValue, newValue, kind, defaultChecked }.
 *     - oldValue/newValue are the string forms (for display + as the initial editable input value).
 *     - kind drives the row's color/label.
 *     - defaultChecked is the smart-default state for the checkbox.
 */
export function computeBookDiff(existing, fresh) {
  if (!existing || !fresh) return []

  const rows = []
  for (const f of FIELDS) {
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
