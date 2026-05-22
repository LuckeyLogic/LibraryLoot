/**
 * "About the program" page — explains what Library Loot is, who it's for, how
 * money flows (it doesn't through the platform), and how draws are made fairly.
 * Includes the prominent Epic Games disclaimer.
 * @module pages/About
 */
// src/pages/About.jsx
//
// "About the program" page — explains what Library Loot is, who it's for,
// how money flows (it doesn't through the platform), and how draws are made
// fairly. Includes the prominent Epic Games disclaimer.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import Disclaimer         from '../components/Disclaimer.jsx'

import useTenantSettings  from '../hooks/useTenantSettings.js'

import siteContent        from '../data/siteContent.js'

import styles             from './About.module.css'

/**
 * About — long-form explanation of Library Loot for parents, librarians,
 * potential sponsors, and curious visitors.
 *
 * @returns {JSX.Element}
 */
export default function About() {

  // `support` resolves from /{tenantId}/_main.support with siteContent
  // defaults as the fallback for any unset field — see useTenantSettings.
  const { brand, story } = siteContent
  const { support }      = useTenantSettings()

  return (
    <article className={`container ${styles.aboutWrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>About the program</p>
        <h1 className={styles.title}>{brand.name}</h1>
        <p className={styles.lede}>{brand.blurb}</p>
      </header>

      <Disclaimer tone="prominent" />

      {/* ── ORIGIN STORY ── */}
      <section className={`${styles.section} ${styles.storySection}`}>
        <div className={styles.storyImageWrap}>
          <img
            src      ={story.imageUrl}
            alt      ={story.imageAlt}
            className={styles.storyImage}
            loading  ="lazy"
          />
        </div>
        <div className={styles.storyCopy}>
          <h2>{story.title}</h2>
          <p>{story.body}</p>
          <p className={styles.storySignoff}>{story.signoff}</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Who it&apos;s for</h2>
        <p>
          {brand.name} is for libraries and the families they serve. It&apos;s for kids
          who don&apos;t need another lecture on why reading is good — they need a real
          reason to start, and something to look forward to when they finish. It&apos;s for
          parents and neighbors who want a way to encourage that without buying their
          way into it: anyone can sponsor a prize, including individuals, families, and
          local businesses.
        </p>
      </section>

      <section className={styles.section}>
        <h2>How the money works</h2>
        <p>
          Sponsors purchase gift cards directly — the cards never pass through
          {' '}{brand.name}. We don&apos;t process payments, take a percentage, or hold
          balances. The site tracks which prizes have been donated, and when a child
          earns a draw, our Cloud Function randomly picks one from the donated pool.
          The library hands over the physical or digital card in person. The site
          handles the random <em>selection</em>; the gift card itself stays with the
          library until a kid earns it.
        </p>
        <p className="muted">
          {brand.operatedBy} pays the hosting bill while a library is on the shared
          instance. When a library wants to take over operations, we transfer their
          data into their own Firebase project so they own their billing, their
          users, and their content end-to-end.
        </p>
      </section>

      <section className={styles.section}>
        <h2>How we keep the draw fair</h2>
        <p>
          The prize draw uses public, third-party randomness. By default, the function
          pulls a value from <a href="https://drand.love" target="_blank" rel="noreferrer">drand</a>,
          a publicly verifiable randomness beacon run by an international consortium of
          universities and labs. If drand can&apos;t be reached, the function falls back
          to <a href="https://www.random.org" target="_blank" rel="noreferrer">random.org</a>&apos;s
          signed integer API, then to the server&apos;s OS-level random generator as a
          last resort.
        </p>
        <p>
          Every draw is recorded in an append-only audit document. The audit captures
          the entropy source(s) used, the snapshot of the prize pool at draw time, and
          the algorithm version. Anyone with the audit ID can re-run the math and
          confirm the result. No human — librarian, sponsor, parent, or developer —
          can rig a draw.
        </p>
      </section>

      <section className={styles.section}>
        <h2>How we keep kids safe</h2>
        <p>
          Kids do not have their own logins. A parent or guardian creates an account
          and adds each child as a sub-profile. We collect a first name and (optional)
          birth year — nothing else. No last names, no photos, no email, no phone, no
          address. Children never see public messages from strangers; no in-site
          messaging at all between adults and kids.
        </p>
        <p>
          See the <Link to="/privacy">Privacy Policy</Link> for the full details,
          including how to request review or deletion of a child profile.
        </p>
        <p className="muted">
          For COPPA requests (review, edit, delete child profile data), contact
          {' '}<a href={`mailto:${support.coppaContactEmail}`}>{support.coppaContactEmail}</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Who runs this instance</h2>
        <p>
          {support.contactBlurb} For program questions, sponsorship inquiries, or
          COPPA requests on this instance of Library Loot, reach out at
          {' '}<a href={`mailto:${support.programContactEmail}`}>{support.programContactEmail}</a>.
        </p>
        <p className="muted">
          Library Loot is built so each library that adopts it controls its own data and
          its own contact information. The contact above is the operator of this
          specific instance and the right point of contact for everything to do with
          your child&apos;s participation here.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What sponsors get</h2>
        <p>
          Every prize you donate gets credited to you, by name or business, whenever a
          kid wins it. Local businesses can upload a logo and a short shout-out
          message. If you prefer to stay anonymous, the recognition simply reads
          &ldquo;Anonymous donor&rdquo; — but the kid still sees the prize was made
          possible by the community.
        </p>
        <p>
          Want to start sponsoring? <Link to="/donors">See current donors</Link> or
          {' '}<Link to="/sponsor">sponsor a prize</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>About the platform</h2>
        <p>
          {brand.name} is open source under the MIT License. The code lives at
          {' '}<a href="https://github.com/LuckeyLogic/LibraryLoot" target="_blank" rel="noreferrer">
            github.com/LuckeyLogic/LibraryLoot
          </a>. Any library or community organization is welcome to fork it, host their
          own, or contact {brand.operatedBy} about hosting on the shared instance.
        </p>
        <p>
          Have a question we didn&apos;t cover here — including what happens if
          Epic Games asks us to stop using Fortnite branding? See the
          {' '}<Link to="/faq">FAQ</Link>. The short version: your child&apos;s
          progress and any already-won prizes are unaffected; the program
          continues with broader prize categories.
        </p>
        <p>
          Built by {brand.operatedBy}.
        </p>
      </section>

    </article>
  )
}
