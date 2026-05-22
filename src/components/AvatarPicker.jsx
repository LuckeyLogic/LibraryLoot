/**
 * Renders a grid of the tenant's default avatar pack (from
 * /{tenantId}/_main/avatars) as a picker. Each tile is a transparent PNG sitting
 * on the same Fortnite-vibe gradient the admin's avatar manager uses, so what
 * the parent sees in the picker matches exactly what the admin uploaded.
 * Controlled component: parent owns the selected `value` and gets notified via
 * `onChange(avatarId)`. Empty state guides the parent toward the librarian if
 * the pack hasn't been populated yet.
 * @module components/AvatarPicker
 */
// src/components/AvatarPicker.jsx
//
// Renders a grid of the tenant's default avatar pack (from
// /{tenantId}/_main/avatars) as a picker. Each tile is a transparent
// PNG sitting on the same Fortnite-vibe gradient the admin's avatar
// manager uses, so what the parent sees in the picker matches exactly
// what the admin uploaded.
//
// Controlled component: parent owns the selected `value` and gets
// notified via `onChange(avatarId)`. Empty state guides the parent
// toward the librarian if the pack hasn't been populated yet.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState } from 'react'
import { onSnapshot }                  from 'firebase/firestore'

import { tenantCollection }            from '../firebase/tenant.js'

import styles                          from './AvatarPicker.module.css'

/**
 * AvatarPicker — controlled grid for selecting one avatar from the
 * tenant's default pack.
 *
 * @param   {Object}            props
 * @param   {string|null}       props.value       - Currently selected avatarId, or null.
 * @param   {Function}          props.onChange    - Called with the new avatarId when the user picks one.
 * @param   {boolean}           [props.disabled]  - Disables interaction (e.g. while saving).
 * @returns {JSX.Element}
 */
export default function AvatarPicker({ value, onChange, disabled }) {

  const [avatars, setAvatars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      tenantCollection('avatars'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0
            const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0
            return tb - ta
          })
        setAvatars(list)
        setLoading(false)
      },
      (err) => {
        setError(err.message || String(err))
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  if (loading) {
    return <p className={styles.empty}>Loading avatars…</p>
  }
  if (error) {
    return <p className={styles.error}>Couldn&apos;t load avatars: {error}</p>
  }
  if (avatars.length === 0) {
    return (
      <p className={styles.empty}>
        No avatars available yet. Your librarian uploads the avatar pack — check
        back soon, or pick one later by editing your kid&apos;s profile.
      </p>
    )
  }

  return (
    <div className={styles.grid} role="radiogroup" aria-label="Pick an avatar">
      {avatars.map((a) => {
        const selected = a.id === value
        return (
          <button
            key       ={a.id}
            type      ="button"
            role      ="radio"
            aria-checked={selected}
            aria-label={a.name}
            disabled  ={disabled}
            onClick   ={() => onChange(a.id)}
            className ={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
            title     ={a.name}
          >
            <img
              src      ={a.downloadUrl}
              alt      =""
              className={styles.tileImage}
              loading  ="lazy"
            />
            {selected ? (
              <span className={styles.selectedMark} aria-hidden="true">✓</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
