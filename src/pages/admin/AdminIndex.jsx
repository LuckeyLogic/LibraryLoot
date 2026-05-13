// src/pages/admin/AdminIndex.jsx
//
// Landing page at /admin. Quick links + a snapshot of the tenant's live
// settings (organization name, contact emails, supplement-set state).
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import useTenantSettings  from '../../hooks/useTenantSettings.js'

import styles             from './Admin.module.css'

/**
 * AdminIndex — admin dashboard overview page.
 *
 * @returns {JSX.Element}
 */
export default function AdminIndex() {

  const { support, legal, loading } = useTenantSettings()

  const supplementCount =
    (legal.privacyPolicySupplement ? 1 : 0) +
    (legal.termsSupplement         ? 1 : 0)

  return (
    <article className={styles.page}>

      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Admin overview</p>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.lede}>
          Manage this Library Loot instance from one place. Edit operator contact info,
          legal supplements, and the avatar pack — all changes take effect immediately
          on the public site.
        </p>
      </header>

      <section className={styles.cardGrid}>

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

        <article className={styles.card}>
          <p className={styles.cardEyebrow}>Avatars</p>
          <h2 className={styles.cardTitle}>Coming next</h2>
          <p className={styles.cardLine}>
            Upload + manage the default avatar pack parents pick from
            when adding a child profile.
          </p>
          <Link to="/admin/avatars" className={`btn btn-ghost ${styles.cardCta}`}>
            Go to avatars
          </Link>
        </article>

      </section>

    </article>
  )
}
