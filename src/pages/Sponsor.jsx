// src/pages/Sponsor.jsx
//
// "Become a sponsor" landing page.
//
// ITEM 0 placeholder — explains the v1 sponsorship flow (physical drop-off,
// no site-side money handling) and surfaces the per-tenant program contact.
//
// A later item (ITEM 4 — Prize / Sponsor management) replaces this body with
// a real intake form that writes a `/{tenantId}/_main/sponsorInquiries/{id}`
// doc and notifies the librarian-admin via their dashboard. The route stays
// the same so the existing CTAs keep working.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import Disclaimer         from '../components/Disclaimer.jsx'

import siteContent        from '../data/siteContent.js'

import styles             from './Sponsor.module.css'

/**
 * Sponsor — placeholder "Become a sponsor" page.
 *
 * @returns {JSX.Element}
 */
export default function Sponsor() {

  const { brand, support } = siteContent

  return (
    <section className={`container ${styles.wrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>Sponsor a prize</p>
        <h1 className={styles.title}>Help a kid earn loot for reading</h1>
        <p className={styles.lede}>
          For v1, sponsorship is hands-on. You buy or supply the prize, drop it off at
          the library, and the librarian logs it into the prize pool. The site never
          touches money. Your shout-out shows up every time a kid wins something you
          donated.
        </p>
      </header>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>What we accept (v1)</h2>
        <ul className={styles.acceptList}>
          <li>V-Bucks gift cards (any denomination)</li>
          <li>Fortnite Legos and building sets</li>
          <li>Fortnite action figures, plushies, collectibles</li>
          <li>Fortnite apparel — shirts, hats, hoodies</li>
          <li>Fortnite posters and prints</li>
          <li>Other Fortnite-themed items, new and in good condition</li>
        </ul>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>How to sponsor today</h2>
        <p>
          The full sponsor intake form lands in a later release — it&apos;ll write
          your inquiry into the program&apos;s admin dashboard automatically. For now,
          while we&apos;re standing the program up, reach out to the operator of this
          Library Loot instance directly:
        </p>
        <p className={styles.contactBlock}>
          <strong>{support.organizationName}</strong><br />
          <a href={`mailto:${support.programContactEmail}`}>
            {support.programContactEmail}
          </a>
        </p>
        <p className="muted">
          When you reach out, share: what you&apos;d like to donate, when you&apos;d
          like to drop it off, and (if you&apos;re a business) the name and logo
          you&apos;d like credited on the donor wall.
        </p>
      </div>

      <Disclaimer tone="soft" />

      <p className={styles.fineprint}>
        {brand.operatedBy} runs this instance of Library Loot today. After a library
        adopts the program for their own community, the contact above is replaced
        with that library&apos;s sponsorship contact — see
        {' '}<Link to="/about">About the program</Link> for details.
      </p>
    </section>
  )
}
