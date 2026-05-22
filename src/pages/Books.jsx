/**
 * Public catalog browse at /books. Shows only books with active === true.
 * Anonymous-readable (rules in ITEM 2c made /{tenantId}/_main/books
 * public-read). Each card links to /books/:isbn for the detail page. Challenge
 * acceptance from this page lands in ITEM 5; for now the cards just point at the
 * detail page.
 * @module pages/Books
 */
// src/pages/Books.jsx
//
// Public catalog browse at /books. Shows only books with active === true.
// Anonymous-readable (rules in ITEM 2c made /{tenantId}/_main/books
// public-read). Each card links to /books/:isbn for the detail page.
//
// Challenge acceptance from this page lands in ITEM 5; for now the
// cards just point at the detail page.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState }   from 'react'
import { Link }                          from 'react-router-dom'
import { onSnapshot }                    from 'firebase/firestore'

import Disclaimer                        from '../components/Disclaimer.jsx'

import { tenantCollection }              from '../firebase/tenant.js'

import styles                            from './Books.module.css'

/**
 * Books — public catalog grid of active books with rewards.
 *
 * @returns {JSX.Element}
 */
export default function Books() {

  const [books,   setBooks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      tenantCollection('books'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((b) => b.active === true)
          .sort((a, b) => {
            const ta = a.addedAt && a.addedAt.toMillis ? a.addedAt.toMillis() : 0
            const tb = b.addedAt && b.addedAt.toMillis ? b.addedAt.toMillis() : 0
            return tb - ta
          })
        setBooks(list)
        setLoading(false)
      },
      (err) => {
        setError(err.message || String(err))
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  return (
    <section className={`container ${styles.wrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>The reward shelf</p>
        <h1 className={styles.title}>Books with active challenges</h1>
        <p className={styles.lede}>
          Pick a book, read it, prove you read it, and a verifiable random draw
          gives you a prize from the community pool. New here?
          {' '}<Link to="/for-parents">See the parent guide</Link> or
          {' '}<Link to="/about">read about the program</Link>.
        </p>
      </header>

      {error ? (
        <div className={styles.error} role="alert">
          Couldn&apos;t load books: {error}
        </div>
      ) : null}

      {loading ? (
        <p className={styles.empty}>Loading the shelf…</p>
      ) : books.length === 0 ? (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>No active challenges yet</h2>
          <p>
            Your librarian is setting up the reward shelf. Check back soon, or
            ask the librarian when the first batch goes live.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {books.map((b) => (
            <BookTile key={b.id} book={b} />
          ))}
        </div>
      )}

      <Disclaimer tone="soft" />

    </section>
  )
}

/**
 * BookTile — single-card link to the detail page.
 *
 * @param   {Object} props
 * @param   {Object} props.book
 * @returns {JSX.Element}
 */
function BookTile({ book }) {

  const authors = (book.authors || []).join(', ')

  return (
    <Link
      to        ={`/books/${book.isbn13}`}
      className ={styles.tile}
      aria-label={`Open ${book.title} details`}
    >
      <div className={styles.tileCover}>
        {book.coverUrl ? (
          <img
            src      ={book.coverUrl}
            alt      =""
            className={styles.tileCoverImage}
            loading  ="lazy"
          />
        ) : (
          <span className={styles.tileCoverFallback}>📖</span>
        )}
      </div>

      <div className={styles.tileMeta}>
        <p className={styles.tileTitle} title={book.title}>{book.title}</p>
        {authors ? (
          <p className={styles.tileAuthors} title={authors}>{authors}</p>
        ) : null}
        <p className={styles.tileSubline}>
          {book.publishedYear ? <span>{book.publishedYear}</span> : null}
          {book.readingLevel ? (
            <>
              {book.publishedYear ? <span className={styles.dot}>·</span> : null}
              <span className={styles.levelTag}>{book.readingLevel}</span>
            </>
          ) : null}
        </p>
      </div>
    </Link>
  )
}
