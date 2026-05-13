// src/pages/Account.jsx
//
// Parent dashboard at /account. PrivateRoute-wrapped. Shows the signed-in
// parent's child sub-profiles and lets them create / edit / delete kids.
//
// Subscribes to:
//   /{tenantId}/_main/users/{parentUid}/children    — the kid list
//   /{tenantId}/_main/avatars                       — to render avatars on cards
//
// Rules in place (ITEM 2c) already allow the parent CRUD on their own
// children subcollection; no rule changes needed here.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useMemo, useState } from 'react'
import { Link }                                from 'react-router-dom'
import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
}                                              from 'firebase/firestore'

import { useAuth }                             from '../context/AuthContext.jsx'

import ChildCard                               from '../components/ChildCard.jsx'
import ChildForm                               from '../components/ChildForm.jsx'

import {
  tenantCollection,
  tenantDoc
}                                              from '../firebase/tenant.js'

import styles                                  from './Account.module.css'

/**
 * Account — parent dashboard for managing child sub-profiles.
 *
 * @returns {JSX.Element}
 */
export default function Account() {

  const { user } = useAuth()

  const [children,    setChildren]    = useState([])
  const [avatars,     setAvatars]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [listError,   setListError]   = useState(null)

  const [showForm,    setShowForm]    = useState(false)
  const [editingId,   setEditingId]   = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState(null)

  // Live subscription to this parent's children at
  // /{tenant}/_main/users/{uid}/children. tenantCollection() accepts path
  // segments crossing through the user doc.
  useEffect(() => {
    if (!user) return
    const colRef = tenantCollection('users', user.uid, 'children')
    const unsub  = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0
            const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0
            return ta - tb     // oldest first — first kid added stays on the left
          })
        setChildren(list)
        setLoading(false)
      },
      (err) => {
        setListError(err.message || String(err))
        setLoading(false)
      }
    )
    return () => unsub()
  }, [user])

  // Live subscription to the tenant's avatar pack (so cards can render
  // the avatar image from the avatarId reference).
  useEffect(() => {
    const unsub = onSnapshot(
      tenantCollection('avatars'),
      (snap) => {
        setAvatars(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      // Avatar list errors are non-fatal — cards fall back to a letter.
      () => {}
    )
    return () => unsub()
  }, [])

  const avatarById = useMemo(() => {
    const map = new Map()
    for (const a of avatars) map.set(a.id, a)
    return map
  }, [avatars])

  const editingChild = useMemo(
    () => children.find((c) => c.id === editingId) || null,
    [children, editingId]
  )

  // ── Form open / close ──
  const openAddForm = () => {
    setEditingId(null)
    setSaveError(null)
    setShowForm(true)
  }
  const openEditForm = (child) => {
    setEditingId(child.id)
    setSaveError(null)
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setSaveError(null)
  }

  // ── Save (create or update) ──
  const handleSave = async ({ firstName, birthYear, avatarId }) => {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    try {
      if (editingId) {
        // Update existing.
        await updateDoc(
          tenantDoc('users', user.uid, 'children', editingId),
          {
            firstName,
            birthYear,
            avatarId,
            updatedAt: serverTimestamp()
          }
        )
      } else {
        // Create new. Doc ID is a UUID without dashes.
        const childId = (crypto.randomUUID()).replace(/-/g, '')
        await setDoc(
          tenantDoc('users', user.uid, 'children', childId),
          {
            id        : childId,
            firstName,
            birthYear,
            avatarId,
            verified  : false,
            verifiedBy: null,
            verifiedAt: null,
            createdAt : serverTimestamp(),
            updatedAt : null
          }
        )
      }
      closeForm()
    } catch (e) {
      setSaveError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──
  const handleDelete = async (child) => {
    if (!user) return
    const ok = window.confirm(
      `Delete ${child.firstName}'s profile? All challenges and quiz attempts for this kid are removed too. This can't be undone.`
    )
    if (!ok) return
    try {
      await deleteDoc(tenantDoc('users', user.uid, 'children', child.id))
    } catch (e) {
      window.alert(`Couldn't delete: ${e.message || e}`)
    }
  }

  const greeting = (() => {
    if (!user) return null
    if (user.displayName && user.displayName.trim().length > 0) {
      return user.displayName.trim().split(' ')[0]
    }
    if (user.email) return user.email.split('@')[0].split('.')[0]
    return 'there'
  })()

  return (
    <article className={`container ${styles.wrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>My account</p>
        <h1 className={styles.title}>
          Hi, {greeting} — welcome to Library Loot
        </h1>
        <p className={styles.lede}>
          Add your kid(s) here. Each kid is a sub-profile under your account —
          they never log in directly. You can add, edit, or delete a kid&apos;s
          profile any time. First name only, no photos, no last names — see
          {' '}<Link to="/for-parents">For Parents</Link> for the full COPPA
          framework.
        </p>
      </header>

      {/* ── ADD / EDIT FORM ── */}
      {showForm ? (
        <section className={styles.formWrap}>
          <ChildForm
            initialValue={editingChild}
            onSave      ={handleSave}
            onCancel    ={closeForm}
            saving      ={saving}
            error       ={saveError}
          />
        </section>
      ) : (
        <div className={styles.addRow}>
          <button
            type      ="button"
            onClick   ={openAddForm}
            className ="btn btn-primary"
          >
            + Add a kid
          </button>
          <span className={styles.addHelp}>
            New here? Read the <Link to="/for-parents">For Parents guide</Link> first.
          </span>
        </div>
      )}

      {/* ── CHILDREN LIST ── */}
      <section>
        <h2 className={styles.sectionTitle}>
          Your kids
          <span className={styles.count}>
            {loading ? '…' : `${children.length} ${children.length === 1 ? 'kid' : 'kids'}`}
          </span>
        </h2>

        {listError ? (
          <div className={styles.error}>
            Couldn&apos;t load kids: {listError}
          </div>
        ) : null}

        {!loading && children.length === 0 ? (
          <p className={styles.empty}>
            No kids yet. Click <strong>Add a kid</strong> above to add your first
            sub-profile.
          </p>
        ) : (
          <div className={styles.grid}>
            {children.map((c) => (
              <ChildCard
                key     ={c.id}
                child   ={c}
                avatar  ={c.avatarId ? avatarById.get(c.avatarId) : null}
                onEdit  ={openEditForm}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── NEXT STEPS HINT ── */}
      {children.length > 0 ? (
        <section className={styles.nextStep}>
          <h2>Next: get your kid verified at the library</h2>
          <p>
            Before any prize draw fires for your kid, the librarian needs to meet
            them in person and flip the verified flag on their profile. Bring
            your kid by the library when you&apos;re grabbing a book — verification
            is once per kid, ever. They can browse the site and accept challenges
            before verification; the verified flag gates the prize draw at the
            end of a completion, not the reading itself.
          </p>
        </section>
      ) : null}

    </article>
  )
}
