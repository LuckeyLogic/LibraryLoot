// src/components/RefreshDiffModal.jsx
//
// Per-field "review changes" modal for AdminBooks's Refresh button.
// Opens after a fresh metadata lookup of an existing book. Shows
// every field that differs as its own row with:
//   - a smart-default checkbox (additive = checked, destructive /
//     replace = unchecked) so the user never accidentally blows away
//     manually-curated good prose by hitting "Apply"
//   - the existing value (read-only display)
//   - the new value as an EDITABLE input/textarea — the user can tweak
//     the API's suggestion before applying it
//   - a rationale chip ("Will clear your existing value", etc.)
//
// Footer offers "Select all" / "Deselect all" bulk toggle, Cancel,
// and Apply Selected. Apply emits an `{ field: editedValue }` map of
// only the checked rows; the caller merges those into the form state
// and opens the standard edit form for any further fine-tuning before
// the final Save.
//
// Created by Miguel Brown on 5/20/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useMemo, useState } from 'react'

import { diffKindLabel }                       from '../utils/bookDiff.js'

import styles                                  from './RefreshDiffModal.module.css'

/**
 * RefreshDiffModal — review and selectively apply API-suggested
 * metadata changes to an existing book.
 *
 * @param {Object}   props
 * @param {string}   props.bookTitle    Used in the modal header.
 * @param {Array}    props.initialRows  Rows from computeBookDiff().
 *                                      Each row: { field, label, inputType, hint,
 *                                      oldValue, newValue, kind, defaultChecked }.
 * @param {Function} props.onApply      Called with an object map { field: string }
 *                                      containing ONLY the checked rows' current
 *                                      edited values. Caller writes these into
 *                                      form state.
 * @param {Function} props.onCancel     Called with no args when the user dismisses
 *                                      the modal without applying.
 * @returns {JSX.Element}
 */
export default function RefreshDiffModal({ bookTitle, initialRows, onApply, onCancel }) {

  // Local row state: each row carries `checked` + `editedValue` on top
  // of the immutable diff metadata. Initialized from props.
  const [rows, setRows] = useState(() => initialRows.map((r) => ({
    ...r,
    checked    : r.defaultChecked,
    editedValue: r.newValue
  })))

  // Esc key dismisses the modal — matches the LOOT panel pattern.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // ── Selection state ────────────────────────────────────────────
  const checkedCount = useMemo(
    () => rows.reduce((acc, r) => acc + (r.checked ? 1 : 0), 0),
    [rows]
  )
  const allChecked = rows.length > 0 && checkedCount === rows.length
  const noneChecked = checkedCount === 0

  // ── Handlers ───────────────────────────────────────────────────
  const toggleRow = (i) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, checked: !r.checked } : r))
  }

  const editRow = (i, value) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, editedValue: value } : r))
  }

  const toggleAll = () => {
    // Flip-flop semantics. If all are checked, deselect everything.
    // Otherwise check everything (covers the "some selected" and "none
    // selected" states with a single intuition: clicking moves toward
    // "all checked").
    const next = !allChecked
    setRows((prev) => prev.map((r) => ({ ...r, checked: next })))
  }

  const handleApply = () => {
    // Build the merged-changes object using the current (possibly
    // edited) value for each checked row. Skip unchecked rows entirely
    // — the form state for those fields stays as-is.
    const acceptedChanges = {}
    for (const r of rows) {
      if (r.checked) acceptedChanges[r.field] = r.editedValue
    }
    onApply(acceptedChanges)
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className={styles.backdrop} onClick={onCancel} role="dialog" aria-modal="true">
      {/* Stop click-through so clicking inside the modal doesn't close it. */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        <header className={styles.header}>
          <div>
            <h2 className={styles.headerTitle}>Review changes</h2>
            <p className={styles.headerSubtitle}>
              {bookTitle ? <>For <strong>{bookTitle}</strong></> : null}
              {bookTitle && rows.length > 0 ? ' · ' : null}
              {rows.length > 0
                ? `${rows.length} field${rows.length === 1 ? '' : 's'} differ from the API`
                : null}
            </p>
          </div>
          <button
            type      ="button"
            className ={styles.closeBtn}
            onClick   ={onCancel}
            aria-label="Close"
            title     ="Close (Esc)"
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {rows.length === 0 ? (
            <div className={styles.empty}>
              <strong>Already up to date</strong>
              <span>The API didn't return anything that differs from this book's current data.</span>
            </div>
          ) : (
            rows.map((r, i) => (
              <DiffRow
                key       ={r.field}
                row       ={r}
                onToggle  ={() => toggleRow(i)}
                onEdit    ={(v) => editRow(i, v)}
              />
            ))
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerCount}>
            <strong>{checkedCount}</strong> of <strong>{rows.length}</strong> selected
          </div>
          <div className={styles.footerActions}>
            {rows.length > 0 ? (
              <button
                type      ="button"
                className ={`${styles.btn} ${styles.btnGhost}`}
                onClick   ={toggleAll}
              >
                {allChecked ? 'Deselect all' : 'Select all'}
              </button>
            ) : null}
            <button
              type      ="button"
              className ={`${styles.btn} ${styles.btnSecondary}`}
              onClick   ={onCancel}
            >
              Cancel
            </button>
            <button
              type      ="button"
              className ={`${styles.btn} ${styles.btnPrimary}`}
              onClick   ={handleApply}
              disabled  ={noneChecked || rows.length === 0}
            >
              Apply selected
            </button>
          </div>
        </footer>

      </div>
    </div>
  )
}

/**
 * DiffRow — one suggested change. Shows the current value, the
 * editable new value, the change-kind chip, and the checkbox.
 *
 * @param {Object}   props
 * @param {Object}   props.row       The row state.
 * @param {Function} props.onToggle  Toggle the row's checkbox.
 * @param {Function} props.onEdit    Edit the row's new value.
 * @returns {JSX.Element}
 */
function DiffRow({ row, onToggle, onEdit }) {
  const kindClass  = styles[row.kind] || ''
  const inputId    = `diff-row-${row.field}`
  const isTextarea = row.inputType === 'textarea'

  return (
    <div className={`${styles.row} ${kindClass}`}>
      <div className={styles.checkboxWrap}>
        <input
          id        ={`${inputId}-check`}
          type      ="checkbox"
          className ={styles.checkbox}
          checked   ={row.checked}
          onChange  ={onToggle}
          aria-label={`Apply change to ${row.label}`}
        />
      </div>

      <div className={styles.rowMain}>

        <div className={styles.rowHeader}>
          <label htmlFor={`${inputId}-check`} className={styles.fieldLabel}>
            {row.label}
          </label>
          <span className={`${styles.kindChip} ${kindClass}`}>
            {row.kindLabel || diffKindLabel(row.kind)}
          </span>
          {row.hint ? <span className={styles.hint}>{row.hint}</span> : null}
        </div>

        <div className={styles.valueBlock}>
          <span className={styles.valueLabel}>Current</span>
          <div className={`${styles.oldValue} ${row.oldValue ? '' : styles.empty}`}>
            {row.oldValue || '(empty)'}
          </div>
        </div>

        <div className={styles.valueBlock}>
          <span className={styles.valueLabel}>New (edit if you want)</span>
          {isTextarea ? (
            <textarea
              id        ={inputId}
              className ={styles.newTextarea}
              value     ={row.editedValue}
              onChange  ={(e) => onEdit(e.target.value)}
              rows      ={4}
            />
          ) : (
            <input
              id        ={inputId}
              type      ="text"
              className ={styles.newInput}
              value     ={row.editedValue}
              onChange  ={(e) => onEdit(e.target.value)}
            />
          )}
        </div>

      </div>
    </div>
  )
}
