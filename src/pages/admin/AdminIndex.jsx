// src/pages/admin/AdminIndex.jsx
//
// Landing page at /admin. Quick links + a live snapshot of the tenant's
// state — operator contact, legal supplements, book catalog size, avatar
// pack size. Each card links to the panel that owns its data.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState }   from 'react'
import { Link }                          from 'react-router-dom'
import { onSnapshot }                    from 'firebase/firestore'

import useTenantSettings                 from '../../hooks/useTenantSettings.js'

import { tenantCollection }              from '../../firebase/tenant.js'

import styles                            from './Admin.module.css'

/**
 * AdminIndex — admin dashboard overview page.
 *
 * @returns {JSX.Element}
 */
export default function AdminIndex() {

  const { support, legal, loading } = useTenantSettings()

  const [bookStats,   setBookStats]   = useState({ total: 0, active: 0, loaded: false })
  const [avatarStats, setAvatarStats] = useState({ total: 0, loaded: false })

  // Live count subscriptions — onSnapshot updates instantly when an
  // admin (in another tab, on their phone) adds a book or avatar.
  useEffect(() => {
    const unsub = onSnapshot(
      tenantCollection('books'),
      (snap) => {
        let active = 0
        snap.forEach((d) => { if (d.data().active === true) active++ })
        setBookStats({ total: snap.size, active, loaded: true })
      },
      () => setBookStats((prev) => ({ ...prev, loaded: true }))
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      tenantCollection('avatars'),
      (snap) => setAvatarStats({ total: snap.size, loaded: true }),
      () => setAvatarStats((prev) => ({ ...prev, loaded: true }))
    )
    return () => unsub()
  }, [])

  const supplementCount =
    (legal.privacyPolicySupplement ? 1 : 0) +
    (legal.termsSupplement         ? 1 : 0)

  return (
    <article className={styles.page}>

      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Admin overview</p>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.lede}>
          Manage this Library Loot instance from one place. Edit operator
          contact info, curate the book catalog and avatar pack, update legal
          supplements — all changes take effect immediately on the public site.
        </p>
      </header>

      <section className={styles.cardGrid}>

        {/* ── OPERATOR ── */}
        <article className={styles.card}>
          <p className={styles.cardEyebrow}>Operator</p>
          <h2 className={styles.cardTitle}>{loading ? '…' : support.organizationName}</h2>
          <p className={styles.cardLine}>
            <span className={styles.k}>Program:</span>{' '}
            <a href={`mailto:${support.programContactEmail}`}>{support.programContactEmail}</a>
          </p>
          <p className={styles.cardLine}>
            <span className={styles.k}>COPPA:</span>{' '}
            <a href={`mailto:${support.coppaContactEmail}`}>{support.coppaContactEmail}</a>
          </p>
          <Link to="/admin/settings" className={`btn btn-ghost ${styles.cardCta}`}>
            Edit settings
          </Link>
        </article>

        {/* ── LEGAL SUPPLEMENTS ── */}
        <article className={styles.card}>
          <p className={styles.cardEyebrow}>Legal supplements</p>
          <h2 className={styles.cardTitle}>
            {loading ? '…' : `${supplementCount} active`}
          </h2>
          <p className={styles.cardLine}>
            <span className={styles.k}>Privacy:</span>{' '}
            {legal.privacyPolicySupplement ? 'Tenant supplement set' : 'Base policy only'}
          </p>
          <p className={styles.cardLine}>
            <span className={styles.k}>Terms:</span>{' '}
            {legal.termsSupplement ? 'Tenant supplement set' : 'Base terms only'}
          </p>
          <Link to="/admin/settings" className={`btn btn-ghost ${styles.cardCta}`}>
            Manage supplements
          </Link>
        </article>

        {/* ── BOOKS ── */}
        <article className={styles.card}>
          <p className={styles.cardEyebrow}>Books</p>
          <h2 className={styles.cardTitle}>
            {bookStats.loaded ? (
              bookStats.total === 0
                ? 'No books yet'
                : `${bookStats.active} active`
            ) : '…'}
          </h2>
          {bookStats.loaded && bookStats.total > 0 ? (
            <p className={styles.cardLine}>
              <span className={styles.k}>In catalog:</span>{' '}
              {bookStats.total} {bookStats.total === 1 ? 'book' : 'books'}
              {bookStats.total > bookStats.active ? (
                <> ({bookStats.total - bookStats.active} inactive)</>
              ) : null}
            </p>
          ) : (
            <p className={styles.cardLine}>
              Add books by ISBN — scan the barcode or paste the number; we pull
              metadata + cover from Open Library / Google Books.
            </p>
          )}
          <Link to="/admin/books" className={`btn btn-ghost ${styles.cardCta}`}>
            Manage books
          </Link>
        </article>

        {/* ── AVATARS ── */}
        <article className={styles.card}>
          <p className={styles.cardEyebrow}>Avatars</p>
          <h2 className={styles.cardTitle}>
            {avatarStats.loaded ? (
              avatarStats.total === 0
                ? 'No avatars yet'
                : `${avatarStats.total} in pack`
            ) : '…'}
          </h2>
          <p className={styles.cardLine}>
            {avatarStats.loaded && avatarStats.total === 0
              ? 'Parents need at least one avatar to pick when adding a child profile.'
              : 'The default avatar pack parents pick from when adding a child profile.'}
          </p>
          <Link to="/admin/avatars" className={`btn btn-ghost ${styles.cardCta}`}>
            Manage avatars
          </Link>
        </article>

      </section>

    </article>
  )
}
