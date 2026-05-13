// src/pages/ForParents.jsx
//
// Parent & Guardian guide — walks parents through every step from "what
// is this?" to "I picked up my kid's prize at the library." Designed to
// be scannable (TL;DR up top, numbered steps, callout boxes) and to
// address the standard parent concerns up front (data, safety, time
// commitment, what their kid actually does).
//
// Content is mostly in this component — the structure is stable and the
// guide will evolve in place. The tenant-specific operator contact + COPPA
// email come from useTenantSettings so a library hosting their own Library
// Loot instance sees their own contact info on this page.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import Disclaimer         from '../components/Disclaimer.jsx'

import useTenantSettings  from '../hooks/useTenantSettings.js'

import siteContent        from '../data/siteContent.js'

import styles             from './ForParents.module.css'

/**
 * ForParents — narrative walkthrough of Library Loot from a parent's POV.
 *
 * @returns {JSX.Element}
 */
export default function ForParents() {

  const { brand }   = siteContent
  const { support } = useTenantSettings()

  return (
    <article className={`container ${styles.wrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>For Parents &amp; Guardians</p>
        <h1 className={styles.title}>Your guide to Library Loot</h1>
        <p className={styles.lede}>
          A walkthrough of how the program works from the parent / guardian side —
          what you do, what your kid does, what data we collect, how prizes
          actually get handed out, and how to back out at any time.
        </p>
      </header>

      {/* ── TL;DR ── */}
      <section className={styles.tldr} aria-label="Summary">
        <h2 className={styles.tldrTitle}>The short version</h2>
        <ul className={styles.tldrList}>
          <li>You create an account. Your kid doesn&apos;t. They participate as a sub-profile under yours.</li>
          <li>We collect your kid&apos;s <strong>first name</strong> and (optional) <strong>birth year</strong>. Nothing else. No photo, no last name, no email, no address.</li>
          <li>Your kid reads a book they picked from the library&apos;s active reward shelf. After reading, they take a short quiz or check off the book with the librarian in person.</li>
          <li>You or the librarian approve the completion. A verifiable random draw selects one prize from the donated pool, recognizing the donor.</li>
          <li>You pick the physical prize (a V-Bucks gift card, a Fortnite Lego set, a poster, etc.) up at the library. <strong>The platform never holds money or codes.</strong></li>
          <li>You can delete your kid&apos;s profile at any time from your account.</li>
        </ul>
      </section>

      <Disclaimer tone="soft" />

      {/* ── 1 — ACCOUNT ── */}
      <section className={styles.section}>
        <p className={styles.stepNum}>Step 1</p>
        <h2>Make a parent account</h2>
        <p>
          Sign up at <Link to="/signup">/signup</Link> with either Google sign-in or
          email + password. You&apos;re asked to confirm you&apos;re 18+ and that
          you accept the <Link to="/privacy">Privacy Policy</Link> and
          {' '}<Link to="/terms">Terms of Service</Link> — these are required
          checkboxes, not buried fine print.
        </p>
        <p>
          Your account is the ONLY login for your family. Your kid does not get
          their own login. There&apos;s no messaging between users on the platform,
          adult-to-adult or otherwise, so there&apos;s no surface for a stranger to
          reach your child.
        </p>
      </section>

      {/* ── 2 — ADD A KID ── */}
      <section className={styles.section}>
        <p className={styles.stepNum}>Step 2</p>
        <h2>Add your child as a sub-profile</h2>
        <p>
          From your account dashboard, click <strong>Add a kid</strong>. You enter:
        </p>
        <ul>
          <li><strong>First name only.</strong> Used to greet them in the app and to recognize them on their Library Loot Champion certificate. Never displayed publicly.</li>
          <li><strong>Birth year (optional).</strong> Year only, no full DOB. Used to match books to reading level. You can skip this.</li>
          <li><strong>An avatar.</strong> Picked from a pack of fan-art-style avatars uploaded by the librarian. No photo upload — your kid&apos;s face never enters our system.</li>
        </ul>
        <p>
          That&apos;s the entire data collection. No last name, no email, no phone,
          no address, no photo. The full COPPA framework is in the
          {' '}<Link to="/privacy">Privacy Policy</Link>.
        </p>
        <aside className={styles.callout}>
          <p>
            <strong>Why so little data?</strong> Because COPPA says collect the
            minimum needed to run the program — and that&apos;s genuinely all we
            need. There&apos;s no business reason to collect more.
          </p>
        </aside>
      </section>

      {/* ── 3 — VERIFY ── */}
      <section className={styles.section}>
        <p className={styles.stepNum}>Step 3</p>
        <h2>Get your kid verified at the library — one time</h2>
        <p>
          Before any prize draw fires for your kid, the librarian needs to meet
          them in person and flip a <strong>verified</strong> flag on their profile.
          This is the program&apos;s main anti-cheat: it makes "create 10 fake
          kids and farm prizes" structurally impossible.
        </p>
        <p>
          The verification is once per kid, ever. Bring your kid by the library
          when you&apos;re grabbing a book, mention you signed up for Library Loot,
          and the librarian flips the bit. Your kid can browse the site and even
          accept challenges and take quizzes before verification — they just
          can&apos;t win a prize until they&apos;re verified.
        </p>
      </section>

      {/* ── 4 — PICK A BOOK ── */}
      <section className={styles.section}>
        <p className={styles.stepNum}>Step 4</p>
        <h2>Pick a book with an active reward</h2>
        <p>
          Two paths:
        </p>
        <ul>
          <li>
            <strong>At the library</strong> — there&apos;s a display shelf of
            books with active rewards. Each has a small QR code your kid scans;
            it accepts the challenge on the site automatically (you have to be
            signed in on your phone).
          </li>
          <li>
            <strong>From this site</strong> — browse the active challenges page,
            click the book, click <strong>Accept</strong>. The book gets reserved
            for your kid to read, and a hold can be placed at the library.
          </li>
        </ul>
        <p>
          Only one active challenge per kid at a time — keeps the program focused
          and prevents the "claim a hundred books to lock other kids out" failure
          mode.
        </p>
        <p>
          Books are labeled with an age range. Books with broad appeal — Harry
          Potter, Percy Jackson — are labeled <em>"ages 8 and up"</em> with no upper
          bound, so older kids can still pick them. Books strictly targeted at
          younger readers (picture books, early readers) have a maximum age too,
          which triggers a gentle warning if your high-schooler picks one. The
          librarian sees the warning at approval. You can leave a comment for the
          librarian on the challenge if there&apos;s a good reason your kid wants
          to read outside their normal range (a kid with a learning difference
          re-reading a favorite, for example).
        </p>
      </section>

      {/* ── 5 — READ + QUIZ ── */}
      <section className={styles.section}>
        <p className={styles.stepNum}>Step 5</p>
        <h2>Read the book. Prove they read it.</h2>
        <p>
          Your kid reads at their own pace. When they&apos;re done, they prove
          they actually read it — and that&apos;s a deliberate, non-AI-cheatable
          step.
        </p>
        <p>
          Verification options (the librarian picks the default per book):
        </p>
        <ul>
          <li>
            <strong>Quiz mode.</strong> 8 multiple-choice questions sampled
            randomly from a pool of 15–20 the librarian approved per book.
            Questions test specific recall — names of minor characters, scene
            order, specific dialogue — stuff that&apos;s only in the book itself,
            not in any summary an AI could regurgitate. Time-limited (~10 min)
            so per-question Googling isn&apos;t practical.
          </li>
          <li>
            <strong>Oral check-off.</strong> Your kid talks the librarian
            through the story at the desk. No site grading, no surface to cheat
            against.
          </li>
          <li>
            <strong>Parent sign-off.</strong> You have a short conversation with
            your kid and confirm they read it. Honor system — meant for at-home
            programs.
          </li>
        </ul>
        <aside className={styles.callout}>
          <p>
            <strong>Why no written book reports?</strong> Because any kid can
            feed a book title to ChatGPT and get a written summary in seconds.
            We&apos;re trying to incentivize <em>reading</em>, not writing,
            so we make the verification something an AI can&apos;t do
            for them.
          </p>
        </aside>
      </section>

      {/* ── 6 — APPROVAL + DRAW ── */}
      <section className={styles.section}>
        <p className={styles.stepNum}>Step 6</p>
        <h2>Approval and the random prize draw</h2>
        <p>
          A librarian or parent (depending on the verification mode) approves the
          completion. The platform then fires a Cloud Function that performs a
          verifiable random draw against the active prize pool.
        </p>
        <p>
          The "verifiable" part is the important word: the draw pulls a random
          value from <a href="https://drand.love" target="_blank" rel="noreferrer">drand</a>,
          a publicly verifiable randomness beacon run by an international
          consortium of universities and labs (falling back to random.org if
          drand is unreachable). Every input — the entropy values, the prize
          pool snapshot at draw time, the algorithm version — is recorded in an
          append-only audit document. Anyone with the audit ID can re-run the
          math and confirm the draw wasn&apos;t rigged.
        </p>
        <p>
          The result screen shows your kid the prize they won, the donor&apos;s
          name (or "Anonymous donor"), and the donor&apos;s logo if it&apos;s a
          local business. They see that their reading was funded by a real person
          in the community.
        </p>
      </section>

      {/* ── 7 — PRIZE PICKUP ── */}
      <section className={styles.section}>
        <p className={styles.stepNum}>Step 7</p>
        <h2>Pick the prize up at the library</h2>
        <p>
          You stop by the library and the librarian hands over the physical or
          digital card. The platform <strong>never transmits gift card codes
          electronically</strong>. Hand-off is in person.
        </p>
        <p>
          If the prize is a V-Bucks gift card, you scratch it off and your kid
          redeems it on their account the same way you would any retail-purchased
          card. The transaction with Epic Games is between you and Epic — Library
          Loot just connected a reader to a card a sponsor donated.
        </p>
      </section>

      {/* ── EDGE CASES ── */}
      <section className={styles.section}>
        <h2>What if the prize pool is empty?</h2>
        <p>
          The platform shows a live count of available prizes on the home page
          and on every book&apos;s detail page, so you and your kid see what&apos;s
          actually in the pool before accepting a challenge. <strong>Prizes are
          not guaranteed</strong> — the pool is funded by community donations
          that come and go.
        </p>
        <p>
          If your kid completes a challenge and the pool is dry, they get a
          <strong> Library Loot Champion certificate</strong> with their first
          name, the book title, and the librarian&apos;s signature. The reading
          counts; the certificate is real recognition; the prize pool refills as
          donations come in.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What if I want my kid to stop participating?</h2>
        <p>
          From your account, open the kid&apos;s profile and click <strong>Delete
          profile</strong>. Everything tied to that kid disappears — their
          challenges, their quiz attempts, their prize history. The only
          exception is the prize-draw audit doc: that survives in anonymized
          form (your kid&apos;s identifier is replaced with "deleted") because
          the platform&apos;s public verifiability depends on past draws being
          re-checkable. The audit can no longer be linked back to your kid.
        </p>
        <p>
          You can also delete your entire account, which deletes all child
          sub-profiles at once. Cascading deletion happens server-side.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What if Epic Games asks Library Loot to stop using Fortnite branding?</h2>
        <p>
          Short version: your kid&apos;s progress and any already-won prizes
          are unaffected. The Fortnite-styled visuals come down and the program
          rebrands to a brand-agnostic reading-rewards program with broader
          prize categories. <strong>V-Bucks cards already donated stay in the
          pool</strong> until they&apos;re won — Epic&apos;s policy restricts
          how you BRAND a program, not who can give away cards purchased at
          retail.
        </p>
        <p>
          The full operational plan is in our public repo at{' '}
          <a href={siteContent.footer.sourceUrl} target="_blank" rel="noreferrer">
            github.com/LuckeyLogic/LibraryLoot
          </a>{' '}— SPEC.md §11. The summary lives in the <Link to="/faq">FAQ</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Where to ask questions</h2>
        <p>
          The operator of this Library Loot instance is your point of contact for
          everything — COPPA requests, sponsorship inquiries, missing prizes,
          account help.
        </p>
        <p className={styles.contactBlock}>
          <strong>{support.organizationName}</strong><br />
          <a href={`mailto:${support.programContactEmail}`}>{support.programContactEmail}</a>
        </p>
        <p className="muted">
          For shorter answers see the <Link to="/faq">FAQ</Link>. For the program
          itself see <Link to="/about">About</Link>. The {brand.name} platform is
          open-source under the MIT License at{' '}
          <a href={siteContent.footer.sourceUrl} target="_blank" rel="noreferrer">
            github.com/LuckeyLogic/LibraryLoot
          </a>.
        </p>
      </section>

    </article>
  )
}
