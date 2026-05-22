/**
 * Public per-book page at /books/:isbn. Anonymous-readable. Shows the cover,
 * title, authors, year, reading level, summary, and a CTA block that adapts to
 * the visitor's auth state: - Signed out → "Sign in to accept this challenge" →
 * /login bounce. - Signed in → "Coming soon" callout; the real
 * challenge-acceptance flow lands in ITEM 5. Inactive books show a notice
 * instead of the CTA so a stale bookmark or link doesn't dead-end. The book
 * detail is still readable so a kid can finish reading something…
 * @module pages/BookDetail
 */
// src/pages/BookDetail.jsx
//
// Public per-book page at /books/:isbn. Anonymous-readable. Shows the
// cover, title, authors, year, reading level, summary, and a CTA block
// that adapts to the visitor's auth state:
//
//   - Signed out → "Sign in to accept this challenge" → /login bounce.
//   - Signed in  → "Coming soon" callout; the real challenge-acceptance
//                  flow lands in ITEM 5.
//
// Inactive books show a notice instead of the CTA so a stale bookmark
// or link doesn't dead-end. The book detail is still readable so a
// kid can finish reading something the library has paused.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState }      from 'react'
import { Link, useParams }                  from 'react-router-dom'
import { onSnapshot }                       from 'firebase/firestore'

import Disclaimer                           from '../components/Disclaimer.jsx'

import { useAuth }                          from '../context/AuthContext.jsx'

import { tenantDoc }                        from '../firebase/tenant.js'

import { isValidIsbn, normalizeIsbn }       from '../utils/isbn.js'

import styles                               from './BookDetail.module.css'

/**
 * BookDetail — public single-book page.
 *
 * @returns {JSX.Element}
 */
export default function BookDetail() {

  const { isbn }      = useParams()
  const { user }      = useAuth()

  const [book,    setBook]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Normalize whatever's in the URL to canonical ISBN-13 — the route
  // accepts hyphenated ISBNs out of the URL bar too.
  const normalized = isValidIsbn(isbn) ? normalizeIsbn(isbn) : null

  useEffect(() => {
    if (!normalized) {
      setBook(null)
      setLoading(false)
      return undefined
    }
    const unsub = onSnapshot(
      tenantDoc('books', normalized),
      (snap) => {
        setBook(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      (err) => {
        setError(err.message || String(err))
        setLoading(false)
      }
    )
    return () => unsub()
  }, [normalized])

  if (!normalized) {
    return (
      <section className={`container ${styles.wrap}`}>
        <NotFoundCard isbn={isbn} />
      </section>
    )
  }

  if (loading) {
    return (
      <section className={`container ${styles.wrap}`}>
        <p className={styles.skeleton}>Loading…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className={`container ${styles.wrap}`}>
        <div className={styles.error} role="alert">
          Couldn&apos;t load this book: {error}
        </div>
      </section>
    )
  }

  if (!book) {
    return (
      <section className={`container ${styles.wrap}`}>
        <NotFoundCard isbn={normalized} />
      </section>
    )
  }

  const authors = (book.authors || []).join(', ')

  return (
    <article className={`container ${styles.wrap}`}>

      <p className={styles.breadcrumb}>
        <Link to="/books">← All books</Link>
      </p>

      <div className={styles.layout}>

        <div className={styles.coverWrap}>
          {book.coverUrl ? (
            <img
              src      ={book.coverUrl}
              alt      ={`Cover of ${book.title}`}
              className={styles.coverImage}
              loading  ="eager"
            />
          ) : (
            <span className={styles.coverFallback}>📖</span>
          )}
        </div>

        <div className={styles.body}>

          <h1 className={styles.title}>{book.title}</h1>
          {authors ? (
            <p className={styles.authors}>{authors}</p>
          ) : null}

          <ul className={styles.factList}>
            {book.publishedYear ? (
              <li><span className={styles.factLabel}>Year</span>{' '}{book.publishedYear}</li>
            ) : null}
            {book.readingLevel ? (
              <li><span className={styles.factLabel}>Level</span>{' '}{book.readingLevel}</li>
            ) : null}
            <li>
              <span className={styles.factLabel}>ISBN</span>{' '}
              <code className={styles.isbn}>{book.isbn13}</code>
            </li>
            {book.active ? null : (
              <li className={styles.inactiveTag}>Not currently accepting challenges</li>
            )}
          </ul>

          {book.summary ? (
            <section className={styles.summarySection}>
              <h2 className={styles.summaryTitle}>About this book</h2>
              <p className={styles.summary}>{book.summary}</p>
            </section>
          ) : null}

          {/* ── CTA BLOCK ── */}
          <section className={styles.ctaBlock}>
            {book.active ? <ChallengeCta user={user} bookIsbn={book.isbn13} /> : <InactiveNotice />}
          </section>

        </div>
      </div>

      <Disclaimer tone="soft" />

    </article>
  )
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Subcomponents                                                         */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * ChallengeCta — adapts to the visitor's auth state. Real
 * challenge-acceptance lives in ITEM 5; this is the placeholder that
 * doesn't promise more than the platform delivers today.
 *
 * @param   {Object}  props
 * @param   {Object?} props.user
 * @param   {string}  props.bookIsbn
 * @returns {JSX.Element}
 */
function ChallengeCta({ user, bookIsbn }) {
  if (!user) {
    return (
      <div className={styles.ctaCardSignedOut}>
        <p className={styles.ctaHeading}>Want to read this for a prize?</p>
        <p className={styles.ctaBody}>
          Library Loot accounts are for parents and guardians. Sign in (or
          create an account) and your kid&apos;s sub-profile can accept this
          challenge once the librarian opens it up.
        </p>
        <div className={styles.ctaActions}>
          <Link
            to        ="/login"
            state     ={{ from: { pathname: `/books/${bookIsbn}` } }}
            className ="btn btn-primary"
          >
            Sign in
          </Link>
          <Link
            to        ="/signup"
            state     ={{ from: { pathname: `/books/${bookIsbn}` } }}
            className ="btn btn-ghost"
          >
            Create account
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.ctaCardSignedIn}>
      <p className={styles.ctaHeading}>Challenge acceptance — coming soon</p>
      <p className={styles.ctaBody}>
        We&apos;re wiring the challenge-acceptance flow in the next platform
        release. Once it lands, you&apos;ll pick which kid is taking on this
        book, your kid takes the reader&apos;s promise, and they&apos;re off.
        In the meantime: pick this book up at the library and start reading.
      </p>
      <div className={styles.ctaActions}>
        <Link to="/account" className="btn btn-primary">My account</Link>
        <Link to="/for-parents" className="btn btn-ghost">How it works</Link>
      </div>
    </div>
  )
}

/**
 * InactiveNotice — explains why the "Accept" button isn't here.
 *
 * @returns {JSX.Element}
 */
function InactiveNotice() {
  return (
    <div className={styles.inactiveCard}>
      <p className={styles.ctaHeading}>This book isn&apos;t accepting challenges right now.</p>
      <p className={styles.ctaBody}>
        Your librarian may have paused it temporarily (e.g., while updating the
        quiz pool). The book detail stays here so you can still see it —
        check back later, or pick a different one from the catalog.
      </p>
      <Link to="/books" className="btn btn-primary">Browse all books</Link>
    </div>
  )
}

/**
 * NotFoundCard — shown when the URL ISBN doesn't parse or doesn't match
 * any book in the catalog.
 *
 * @param   {Object}  props
 * @param   {string?} props.isbn
 * @returns {JSX.Element}
 */
function NotFoundCard({ isbn }) {
  return (
    <div className={styles.notFound}>
      <h1 className={styles.notFoundTitle}>Book not found</h1>
      <p className={styles.ctaBody}>
        We couldn&apos;t find a book {isbn ? <>with ISBN <code>{isbn}</code></> : 'at this URL'}{' '}
        in our catalog. Either the link is wrong or the book was removed.
      </p>
      <Link to="/books" className="btn btn-primary">Browse all books</Link>
    </div>
  )
}
