// src/pages/Terms.jsx
//
// Terms of Service. Pre-launch draft — a real attorney should review before
// the program accepts its first real challenge. Marked as DRAFT in the body
// until that review happens.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import Disclaimer         from '../components/Disclaimer.jsx'

import useTenantSettings  from '../hooks/useTenantSettings.js'

import siteContent        from '../data/siteContent.js'

import styles             from './Legal.module.css'

/**
 * TenantSupplement — renders an optional legal supplement string as
 * paragraph blocks. Mirror of the helper in Privacy.jsx; duplicated for
 * now since the two pages are the only consumers. Lift to a shared
 * component if a third surface needs it.
 *
 * @param   {Object}  props
 * @param   {string?} props.body
 * @param   {string}  props.heading
 * @param   {string}  props.orgName
 * @returns {JSX.Element|null}
 */
function TenantSupplement({ body, heading, orgName }) {
  if (!body) return null
  const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return (
    <section>
      <h2>{heading}</h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Additional terms from <strong>{orgName}</strong>. Applies to this Library
        Loot instance in addition to the base terms above.
      </p>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </section>
  )
}

/**
 * Terms — Terms of Service page.
 *
 * @returns {JSX.Element}
 */
export default function Terms() {

  // `support` + `legal` resolve from /{tenantId}/_main with siteContent
  // defaults. Tenant admins edit these via /admin/settings.
  const { brand }            = siteContent
  const { support, legal }   = useTenantSettings()

  return (
    <article className={`container ${styles.legalWrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className="muted">Effective: 2026-05-12 · Operated by {support.organizationName}</p>
      </header>

      <div className={styles.draftBanner}>
        <strong>DRAFT.</strong> This document is a pre-launch draft. It will be
        reviewed by counsel before the platform accepts its first real reading
        challenge.
      </div>

      <section>
        <h2>About this document</h2>
        <p>
          Library Loot is a platform that any library or community organization can
          host for their community. This page is the <strong>base Terms of Service</strong>
          {' '}— the platform-wide minimum that applies to every Library Loot
          instance regardless of who operates it.
        </p>
        <p>
          A specific library that operates a Library Loot instance may publish
          additional tenant-specific terms. Where a tenant supplement and these
          base terms overlap: the base controls for platform-wide topics
          (account eligibility, prize-draw verifiability, the platform&apos;s
          non-commercial stance); the supplement controls for tenant-specific
          topics (operator identity, in-person pickup rules, local-law
          obligations). A supplement may <em>add</em> commitments but cannot
          <em> reduce</em> the protections in these base terms.
        </p>
      </section>

      <section>
        <h2>1. The program</h2>
        <p>
          {brand.name} (the &ldquo;Service&rdquo;) is a community-funded reading
          incentive program operated by {support.organizationName}. Adults sponsor
          reading challenges by donating prizes to a shared pool. Kids accept
          challenges through a parent or guardian&apos;s account, complete a
          reading verification step, and receive a randomly-selected prize from
          the donated pool. The Service does not handle payments and takes no
          fee from sponsors, libraries, or families.
        </p>
      </section>

      <section>
        <h2>2. Accounts</h2>
        <p>
          Only adults age 18 or older may create accounts. Children participate
          solely through a parent or guardian&apos;s account as a sub-profile.
          By creating a child sub-profile, the parent or guardian represents
          that they have legal authority to do so and consent to the data
          collection described in the <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>3. Prize donations and delivery</h2>
        <p>
          Sponsors purchase gift cards or arrange in-kind prizes directly. The
          Service tracks the prize as part of a pool and runs a verifiable
          random draw when a child completes a challenge. Physical or digital
          card delivery happens out-of-band — the Service does not transmit
          gift-card codes, hold balances, or process payments.
        </p>
        <p>
          Sponsors are responsible for the validity, value, and condition of
          the cards they donate. The Service is not liable for sponsor-supplied
          cards that fail to redeem.
        </p>
      </section>

      <section>
        <h2>4. Reading verification</h2>
        <p>
          The library or the parent/guardian is the final arbiter of whether a
          child has read a book. The Service provides tools (quizzes, oral
          check-off, parent sign-off) but does not certify any individual
          completion. No reward is released until a human approves it.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>
          You agree not to use the Service to harass, defraud, or distribute
          unlawful content; to misrepresent your identity or your child&apos;s
          identity; to attempt to manipulate prize draws; or to circumvent
          security or rate limits.
        </p>
      </section>

      <section>
        <h2>6. Disclaimers</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranty of any
          kind. {support.organizationName} is not liable for any loss arising from your
          use of the Service, including but not limited to gift-card delivery
          failures, third-party gift-card issuer policies, or the actions of
          other sponsors or participants.
        </p>
      </section>

      <Disclaimer tone="prominent" />

      <TenantSupplement
        heading="Additional terms from the operator"
        body   ={legal.termsSupplement}
        orgName={support.organizationName}
      />

      <section>
        <h2>7. Termination</h2>
        <p>
          {support.organizationName} may suspend or terminate an account that violates
          these terms. You may delete your account and your children&apos;s
          sub-profiles at any time; deletion procedures are described in the
          <Link to="/privacy"> Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may update these terms. Material changes will be flagged on the
          site. Continued use of the Service after a change means you accept
          the updated terms.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions? Email
          {' '}<a href={`mailto:${support.programContactEmail}`}>{support.programContactEmail}</a>.
        </p>
      </section>

    </article>
  )
}
