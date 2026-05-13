// src/utils/isbn.js
//
// ISBN normalization + validation. Books in Firestore are keyed by the
// canonical ISBN-13 (digits only) so an ISBN-10 input still resolves to
// the same book document.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

/**
 * Strips all non-digit characters EXCEPT a trailing 'X' (ISBN-10 check
 * digit). Returns a normalized digit string ready for length checks.
 *
 * @param   {string} raw
 * @returns {string}
 */
export function stripIsbn(raw) {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

/**
 * Validates an ISBN-10 using its checksum.
 *
 * @param   {string} isbn10  - 10-char digit string (may end in 'X').
 * @returns {boolean}
 */
function isValidIsbn10(isbn10) {
  if (isbn10.length !== 10) return false
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const d = Number(isbn10[i])
    if (Number.isNaN(d)) return false
    sum += d * (10 - i)
  }
  const last  = isbn10[9]
  const check = last === 'X' ? 10 : Number(last)
  if (Number.isNaN(check)) return false
  sum += check
  return sum % 11 === 0
}

/**
 * Validates an ISBN-13 using its checksum.
 *
 * @param   {string} isbn13  - 13-digit string.
 * @returns {boolean}
 */
function isValidIsbn13(isbn13) {
  if (isbn13.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 13; i++) {
    const d = Number(isbn13[i])
    if (Number.isNaN(d)) return false
    sum += d * (i % 2 === 0 ? 1 : 3)
  }
  return sum % 10 === 0
}

/**
 * Converts a valid ISBN-10 to its ISBN-13 form (with the 978 prefix).
 *
 * @param   {string} isbn10
 * @returns {string}  13-digit ISBN-13
 */
function toIsbn13(isbn10) {
  const core = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return core + check
}

/**
 * Normalizes any reasonable ISBN input to a canonical ISBN-13 digit
 * string, or returns null if the input doesn't parse to a valid ISBN.
 *
 * @param   {string}  raw
 * @returns {string|null}
 */
export function normalizeIsbn(raw) {
  const stripped = stripIsbn(raw)
  if (stripped.length === 13 && isValidIsbn13(stripped)) {
    return stripped
  }
  if (stripped.length === 10 && isValidIsbn10(stripped)) {
    return toIsbn13(stripped)
  }
  return null
}

/**
 * True if the input parses to a valid ISBN-10 or ISBN-13.
 *
 * @param   {string} raw
 * @returns {boolean}
 */
export function isValidIsbn(raw) {
  return normalizeIsbn(raw) !== null
}
