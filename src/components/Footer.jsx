// src/components/Footer.jsx
//
// Persistent site footer. Carries the Luckey Logic credit, top-level legal
// links, and the Epic Games trademark disclaimer (required on every page
// per the Fan Content Policy stance — see SPEC.md §7).
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React                  from 'react'
import { Link }               from 'react-router-dom'

import siteContent            from '../data/siteContent.js'

import styles                 from './Footer.module.css'

/**
 * Footer — site-wide footer with credit, nav, and the trademark disclaimer.
 *
 * @returns {JSX.Element}
 */
export default function Footer() {

  const { brand, footer, legal } = siteContent

  return (
    <footer className={styles.footerWrap}>
      <div className={`container ${styles.footerInner}`}>

        <div className={styles.col}>
          <p className={styles.brand}>{brand.name}</p>
          <p className={styles.tagline}>{brand.tagline}</p>
          <p className={styles.credit}>
            {footer.credit}
            {' '}
            <a href={footer.sourceUrl} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </div>

        <nav className={styles.col} aria-label="Footer navigation">
          <p className={styles.colTitle}>Site</p>
          <Link to="/">Home</Link>
          <Link to="/about">About the program</Link>
          <Link to="/donors">Donors</Link>
          <Link to="/faq">FAQ</Link>
        </nav>

        <nav className={styles.col} aria-label="Legal">
          <p className={styles.colTitle}>Legal</p>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>

      </div>

      <div className={`container ${styles.legalBlock}`}>
        <p className="legal-fine">{legal.epicGamesDisclaimer}</p>
        <p className="legal-fine">
          © {footer.copyrightYear} {brand.operatedBy}. Released under the MIT License.
        </p>
      </div>
    </footer>
  )
}
