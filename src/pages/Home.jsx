/**
 * Landing page. Hero, How It Works steps, prize categories, sponsor CTA.
 * @module pages/Home
 */
// src/pages/Home.jsx
//
// Landing page. Hero, How It Works steps, prize categories, sponsor CTA.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import Disclaimer         from '../components/Disclaimer.jsx'

import siteContent        from '../data/siteContent.js'

import styles             from './Home.module.css'

/**
 * Home — landing page. Hero + how-it-works + prize categories + sponsor CTA.
 *
 * @returns {JSX.Element}
 */
export default function Home() {

  const { hero, howItWorks, prizeCategories, sponsorCTA, brand } = siteContent

  return (
    <>
      {/* ── HERO ── */}
      <section
        className={styles.hero}
        style    ={hero.imageUrl ? { backgroundImage: `url(${hero.imageUrl})` } : undefined}
      >
        <div className={styles.heroOverlay} aria-hidden="true" />

        <div className={`container ${styles.heroInner}`}>
          {hero.logoUrl ? (
            <img
              src      ={hero.logoUrl}
              alt      ="Summer of Library Loot"
              className={styles.heroLogo}
            />
          ) : (
            <p className={styles.eyebrow}>{hero.eyebrow}</p>
          )}

          <h1 className={styles.headline}>{hero.headline}</h1>
          <p className={styles.subhead}>{hero.subhead}</p>

          <div className={styles.heroCtaRow}>
            <Link to={hero.primaryCtaPath} className="btn btn-primary">
              {hero.primaryCtaLabel}
            </Link>
            <Link to={hero.secondaryCtaPath} className="btn btn-ghost">
              {hero.secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className={`section ${styles.howSection}`}>
        <div className="container">
          <h2 className="section-title">How it works</h2>

          <div className={styles.stepGrid}>
            {howItWorks.map(step => (
              <article key={step.step} className={styles.stepCard}>
                <span className={styles.stepBadge}>{step.step}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIZE CATEGORIES ── */}
      <section className={`section ${styles.prizesSection}`}>
        <div className="container">
          <h2 className="section-title">What kids can win</h2>
          <p className={styles.sectionLede}>
            Prizes come from the community. Sponsors choose what they donate — kids choose what
            book to read. The draw is random and verifiable.
          </p>

          <ul className={styles.prizeGrid}>
            {prizeCategories.map(prize => (
              <li
                key      ={prize.label}
                className={`${styles.prizeChip} ${styles[`tone_${prize.tone}`]}`}
              >
                {prize.label}
              </li>
            ))}
          </ul>

          <Disclaimer tone="soft" />
        </div>
      </section>

      {/* ── SPONSOR CTA ── */}
      <section className={`section ${styles.sponsorSection}`}>
        <div className={`container ${styles.sponsorInner}`}>
          <h2 className={styles.sponsorTitle}>{sponsorCTA.title}</h2>
          <p className={styles.sponsorBody}>{sponsorCTA.body}</p>
          <Link to={sponsorCTA.ctaPath} className="btn btn-loot">
            {sponsorCTA.ctaLabel}
          </Link>
          <p className={styles.sponsorFineprint}>
            Run by {brand.operatedBy}. {brand.name} takes no cut of donated funds.
          </p>
        </div>
      </section>
    </>
  )
}
