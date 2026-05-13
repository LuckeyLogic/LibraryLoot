// src/components/ChildForm.jsx
//
// Form for creating or editing a child sub-profile. Captures the bare
// minimum permitted by the COPPA stance:
//   - First name (required, max 40 chars)
//   - Birth year (optional; year only)
//   - Avatar (optional; picked from the tenant's default pack)
//
// Pure controlled form — receives an `initialValue` (or null for "add"),
// fires `onSave(payload)` and `onCancel()`. The dashboard owns the
// Firestore write.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useState }  from 'react'

import AvatarPicker         from './AvatarPicker.jsx'

import styles               from './ChildForm.module.css'

const CURRENT_YEAR = new Date().getFullYear()
// Range that covers active library participants — 4y (preschool readers
// being read to) up to 18y (high-school seniors). Operators can tighten
// this later via tenant settings if they want.
const BIRTH_YEAR_MIN = CURRENT_YEAR - 18
const BIRTH_YEAR_MAX = CURRENT_YEAR - 4

const BIRTH_YEARS = (() => {
  const out = []
  for (let y = BIRTH_YEAR_MAX; y >= BIRTH_YEAR_MIN; y--) out.push(y)
  return out
})()

/**
 * ChildForm — controlled form for creating / editing a child sub-profile.
 *
 * @param   {Object}  props
 * @param   {Object?} [props.initialValue] - { firstName, birthYear, avatarId } or null for "add".
 * @param   {Function} props.onSave        - Called with { firstName, birthYear, avatarId }.
 * @param   {Function} props.onCancel
 * @param   {boolean}  [props.saving]
 * @param   {string?}  [props.error]
 * @returns {JSX.Element}
 */
export default function ChildForm({ initialValue, onSave, onCancel, saving, error }) {

  const isEdit = Boolean(initialValue && initialValue.firstName)

  const [firstName, setFirstName] = useState(initialValue?.firstName || '')
  const [birthYear, setBirthYear] = useState(
    initialValue?.birthYear ? String(initialValue.birthYear) : ''
  )
  const [avatarId,  setAvatarId]  = useState(initialValue?.avatarId || null)
  const [localErr,  setLocalErr]  = useState(null)

  const handleSubmit = (event) => {
    event.preventDefault()
    setLocalErr(null)

    const cleanName = firstName.trim()
    if (!cleanName) {
      setLocalErr('First name is required.')
      return
    }
    if (cleanName.length > 40) {
      setLocalErr('First name is too long — keep it under 40 characters.')
      return
    }

    onSave({
      firstName: cleanName,
      birthYear: birthYear ? Number(birthYear) : null,
      avatarId : avatarId || null
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>{isEdit ? 'Edit' : 'New'}</p>
        <h2 className={styles.title}>
          {isEdit ? `Editing ${initialValue.firstName}` : 'Add a kid'}
        </h2>
        <p className={styles.help}>
          First name only. We don&apos;t collect last names, photos, email, or
          addresses. See <em>For Parents</em> for the full COPPA framework.
        </p>
      </header>

      <div className={styles.fields}>

        <div className={styles.field}>
          <label htmlFor="cf-name" className={styles.label}>First name</label>
          <input
            id        ="cf-name"
            type      ="text"
            value     ={firstName}
            onChange  ={(e) => setFirstName(e.target.value)}
            className ={styles.input}
            maxLength ={40}
            autoComplete="off"
            required
            disabled  ={saving}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="cf-year" className={styles.label}>
            Birth year <span className={styles.optional}>(optional)</span>
          </label>
          <select
            id        ="cf-year"
            value     ={birthYear}
            onChange  ={(e) => setBirthYear(e.target.value)}
            className ={styles.input}
            disabled  ={saving}
          >
            <option value="">I&apos;d rather not say</option>
            {BIRTH_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Avatar <span className={styles.optional}>(optional)</span>
          </label>
          <AvatarPicker
            value   ={avatarId}
            onChange={setAvatarId}
            disabled={saving}
          />
        </div>

      </div>

      {(localErr || error) ? (
        <div className={styles.error} role="alert">
          {localErr || error}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          type     ="submit"
          className="btn btn-primary"
          disabled ={saving}
        >
          {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add this kid')}
        </button>
        <button
          type     ="button"
          onClick  ={onCancel}
          className={styles.cancel}
          disabled ={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
