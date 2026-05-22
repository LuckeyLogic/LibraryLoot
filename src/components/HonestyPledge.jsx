/**
 * Reader's-promise card shown at challenge acceptance. Kid-readable first-person
 * pledge statements + a single consent checkbox + an accept button that fires
 * `onAccept` with a small payload the challenge document can record: {
 * acceptedAt: Date, statements: string[], version: 'v1' } Storing the snapshot
 * of pledge text + version means a challenge approved months later still shows
 * the EXACT promise the kid took at the time, even after we edit the pledge
 * copy. (Important for trust when a librarian is…
 * @module components/HonestyPledge
 */
// src/components/HonestyPledge.jsx
//
// Reader's-promise card shown at challenge acceptance. Kid-readable
// first-person pledge statements + a single consent checkbox + an
// accept button that fires `onAccept` with a small payload the
// challenge document can record:
//
//   { acceptedAt: Date, statements: string[], version: 'v1' }
//
// Storing the snapshot of pledge text + version means a challenge
// approved months later still shows the EXACT promise the kid took at
// the time, even after we edit the pledge copy. (Important for trust
// when a librarian is reviewing an old completion.)
//
// Content lives in siteContent.honestyPledge — kept there so future
// surfaces (the librarian-approval view, the parent dashboard's
// "review what your kid agreed to") all source from one place.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useState }  from 'react'

import siteContent          from '../data/siteContent.js'

import styles               from './HonestyPledge.module.css'

const PLEDGE_VERSION = 'v1'

/**
 * HonestyPledge — reader's-promise card with kid-friendly pledge
 * statements, a single consent checkbox, and an accept button.
 *
 * The component holds local state for the checkbox; the parent of this
 * component decides what to DO with `onAccept` (write a challenge doc,
 * navigate forward, etc.).
 *
 * @param   {Object}   props
 * @param   {Function} props.onAccept     - Called with the pledge payload when the user confirms.
 * @param   {Function} [props.onCancel]   - Optional. Called when the user backs out.
 * @param   {string}   [props.bookTitle]  - Optional. Surfaces the specific book in the heading.
 * @param   {boolean}  [props.disabled]   - Disables the accept button (parent-controlled, e.g. while a write is in flight).
 * @returns {JSX.Element}
 */
export default function HonestyPledge({ onAccept, onCancel, bookTitle, disabled }) {

  const pledge          = siteContent.honestyPledge
  const [checked, setChecked] = useState(false)

  const handleAccept = () => {
    if (!checked || disabled) return
    onAccept({
      acceptedAt : new Date(),
      statements : pledge.statements,
      version    : PLEDGE_VERSION
    })
  }

  return (
    <section className={styles.card} aria-labelledby="pledge-title">

      <p className={styles.eyebrow}>{pledge.eyebrow}</p>
      <h2 id="pledge-title" className={styles.title}>
        {pledge.title}
      </h2>

      {bookTitle ? (
        <p className={styles.book}>
          For: <strong>{bookTitle}</strong>
        </p>
      ) : null}

      <p className={styles.intro}>{pledge.intro}</p>

      <ul className={styles.statements}>
        {pledge.statements.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <label className={styles.consentRow}>
        <input
          type    ="checkbox"
          checked ={checked}
          onChange={(e) => setChecked(e.target.checked)}
          disabled={disabled}
        />
        <span>{pledge.consentLabel}</span>
      </label>

      <div className={styles.actions}>
        <button
          type      ="button"
          className ="btn btn-loot"
          onClick   ={handleAccept}
          disabled  ={!checked || disabled}
        >
          {pledge.acceptLabel}
        </button>
        {onCancel ? (
          <button
            type      ="button"
            className ={styles.cancelBtn}
            onClick   ={onCancel}
            disabled  ={disabled}
          >
            Not yet
          </button>
        ) : null}
      </div>

      <p className={styles.footnote}>{pledge.footnote}</p>

    </section>
  )
}

HonestyPledge.pledgeVersion = PLEDGE_VERSION
