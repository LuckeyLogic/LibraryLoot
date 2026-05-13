// src/pages/Privacy.jsx
//
// Privacy Policy. Pre-launch draft — COPPA-aware shape but a real attorney
// should review before the program accepts its first real challenge.
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
 * TenantSupplement — renders an optional legal supplement string as paragraph
 * blocks (plain text, split on double newlines). Returns null when no
 * supplement is set, so the layout collapses cleanly.
 *
 * @param   {Object}  props
 * @param   {string?} props.body       - Plain-text supplement.
 * @param   {string}  props.heading    - Section heading.
 * @param   {string}  props.orgName    - Operator's display name.
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
        Loot instance in addition to the base policy above.
      </p>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </section>
  )
}

/**
 * Privacy — Privacy Policy page.
 *
 * @returns {JSX.Element}
 */
export default function Privacy() {

  // `support` + `legal` resolve from /{tenantId}/_main with siteContent
  // defaults. Tenant admins edit these via /admin/settings.
  const { brand }            = siteContent
  const { support, legal }   = useTenantSettings()

  return (
    <article className={`container ${styles.legalWrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className="muted">Effective: 2026-05-12 · Operated by {support.organizationName}</p>
      </header>

      <div className={styles.draftBanner}>
        <strong>DRAFT.</strong> This document is a pre-launch draft. It reflects our
        intended COPPA approach and will be reviewed by counsel before the platform
        accepts its first real challenge.
      </div>

      <section>
        <h2>About this document</h2>
        <p>
          Library Loot is a platform that any library or community organization can
          host for their community. This page is the <strong>base Privacy Policy</strong>
          {' '}— the platform-wide minimum that applies to every Library Loot
          instance regardless of who operates it.
        </p>
        <p>
          A specific library that operates a Library Loot instance may publish
          additional tenant-specific terms (their contact, their data-retention
          practices, etc.). Where a tenant supplement and this base policy overlap:
          the base controls for platform-wide topics (COPPA, what we collect, who
          processes the data); the supplement controls for tenant-specific topics
          (who the operator is, how prizes are physically distributed). A
          supplement may <em>add</em> protections but cannot <em>lower</em> the
          protections in this base policy.
        </p>
      </section>

      <section>
        <h2>1. What we collect</h2>
        <p>From adults (parents, guardians, sponsors, librarians):</p>
        <ul>
          <li>Display name and email (Firebase Authentication).</li>
          <li>Account role (parent, librarian, admin).</li>
          <li>Sponsorship records (which prizes a sponsor has donated).</li>
          <li>Audit records of administrative actions taken (for accountability).</li>
        </ul>

        <p>From children (entered by their parent/guardian):</p>
        <ul>
          <li>First name only.</li>
          <li>Birth year only — no full date of birth.</li>
          <li>Reading-challenge activity: which books were accepted, quiz answers,
              completion status, prizes won.</li>
        </ul>

        <p>
          We do <strong>not</strong> collect last names, photos, addresses, phone
          numbers, or email addresses for children. We do not allow children to log
          in directly — every action involving a child is taken by their parent or
          guardian through the parent&apos;s account.
        </p>
      </section>

      <section>
        <h2>2. How we use it</h2>
        <p>
          Information is used only to run the reading-challenge program: to track
          challenge progress, run prize draws, recognize donors, and operate the
          library&apos;s instance. We do not sell data, run advertising, or share
          data with third parties beyond the service providers that host the
          platform (described below).
        </p>
      </section>

      <section>
        <h2>3. Service providers</h2>
        <ul>
          <li><strong>Firebase / Google Cloud</strong> — hosting, authentication,
              database, file storage, and serverless functions.</li>
          <li><strong>Open Library</strong> / Google Books — book metadata and
              cover images (queries use ISBN only; no child data is sent).</li>
          <li><strong>Vertex AI (Gemini)</strong> — used to draft candidate quiz
              questions from a book&apos;s metadata. No child data is ever sent
              to the AI; only the book&apos;s public metadata.</li>
          <li><strong>drand</strong> / random.org — public randomness sources for
              the prize draw. No personal data is sent.</li>
        </ul>
      </section>

      <section>
        <h2>4. COPPA — Children&apos;s Online Privacy</h2>
        <p>
          {brand.name} is designed around COPPA from the ground up. Children do not
          have direct accounts. A parent or guardian must create the account, accept
          this Privacy Policy, and add each child as a sub-profile.
        </p>
        <p>
          Parents have the right at any time to:
        </p>
        <ul>
          <li>Review the information collected about their child.</li>
          <li>Request changes or corrections.</li>
          <li>Delete the child&apos;s sub-profile and associated activity.</li>
          <li>Refuse further data collection.</li>
        </ul>
        <p>
          Requests can be made in-app through the parent dashboard, or by emailing
          the operator of this Library Loot instance at
          {' '}<a href={`mailto:${support.coppaContactEmail}`}>{support.coppaContactEmail}</a>.
          We respond within 30 days.
        </p>
      </section>

      <section>
        <h2>5. Retention</h2>
        <p>
          Child profile data is retained while the child is an active participant
          and for a reasonable period after, to support the parent&apos;s ability
          to review past activity. Inactive profiles (no activity for 18 months)
          are archived and then deleted. Prize draw audit records are retained in
          anonymized form (child identifiers replaced with &ldquo;deleted&rdquo;)
          to preserve the platform&apos;s public auditability.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          Data is stored in Firebase (Firestore + Storage) with security rules
          that enforce per-tenant isolation. Only authenticated users with the
          appropriate role can access their own data. We do not store passwords —
          authentication is delegated to Firebase Authentication, which uses
          industry-standard hashing.
        </p>
      </section>

      <Disclaimer tone="prominent" />

      <TenantSupplement
        heading="Additional privacy terms from the operator"
        body   ={legal.privacyPolicySupplement}
        orgName={support.organizationName}
      />

      <section>
        <h2>7. Contact</h2>
        <p>
          For privacy questions or COPPA requests, email the operator of this
          instance at
          {' '}<a href={`mailto:${support.coppaContactEmail}`}>{support.coppaContactEmail}</a>.
          For an overview of the program, see <Link to="/about">About the program</Link>.
        </p>
      </section>

    </article>
  )
}
