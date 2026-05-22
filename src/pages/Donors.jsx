/**
 * Donor recognition page. Placeholder grid for ITEM 0 — real donor data wires up
 * in ITEM 4 (prize management + sponsor branding).
 * @module pages/Donors
 */
// src/pages/Donors.jsx
//
// Donor recognition page. Placeholder grid for ITEM 0 — real donor data
// wires up in ITEM 4 (prize management + sponsor branding).
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import siteContent        from '../data/siteContent.js'

import styles             from './Donors.module.css'

/**
 * Donors — public recognition page for community sponsors.
 *
 * @returns {JSX.Element}
 */
export default function Donors() {

  const { brand } = siteContent

  return (
    <section className={`container ${styles.wrap}`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Sponsors &amp; donors</p>
        <h1 className={styles.title}>The community making this possible</h1>
        <p className={styles.lede}>
          Every prize in the pool was donated by someone — a parent, a grandparent, a
          neighbor, a local business. When a kid wins, they see who made it possible.
        </p>
      </header>

      <div className={styles.placeholderCard}>
        <h2 className={styles.placeholderTitle}>Donor wall coming soon</h2>
        <p>
          The donor recognition grid will land once the sponsor management tools are
          live. Want to be the first name on the wall?
        </p>
        <p className={styles.contactLine}>
          Email <a href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a> or
          {' '}<Link to="/about">read more about the program</Link>.
        </p>
      </div>
    </section>
  )
}
