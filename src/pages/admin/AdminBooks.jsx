// src/pages/admin/AdminBooks.jsx
//
// Admin catalog management at /admin/books.
//
// Three concerns on one page:
//   1. Look up a book by ISBN (Open Library → Google Books fallback).
//   2. Review and edit the looked-up metadata, then save the book to
//      /{tenant}/_main/books/{bookId}.
//   3. List existing books in a grid with active toggle, edit, delete.
//
// ITEM 3b adds the camera-based barcode scanner that auto-fills the
// ISBN input here. ITEM 3c adds the public /books browse + per-book
// detail page that consume the same collection.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useMemo, useState } from 'react'
import { Link }                                from 'react-router-dom'
import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
}                                              from 'firebase/firestore'

import { useAuth }                             from '../../context/AuthContext.jsx'

import {
  tenantCollection,
  tenantDoc
}                                              from '../../firebase/tenant.js'

import { isValidIsbn, normalizeIsbn }          from '../../utils/isbn.js'
import { lookupBookByIsbn }                    from '../../utils/bookLookup.js'

import styles                                  from './Admin.module.css'
import bookStyles                              from './AdminBooks.module.css'

const READING_LEVELS = [
  { value: '',             label: 'Not specified'         },
  { value: 'EarlyReader',  label: 'Early reader (K–2)'    },
  { value: 'Grade3-5',     label: 'Grade 3–5'             },
  { value: 'MiddleGrade',  label: 'Middle grade (6–8)'    },
  { value: 'YA',           label: 'Young adult (9–12)'    }
]

/**
 * Empty form state for a new book — used when starting from a "Not found"
 * lookup result OR explicitly clicking "enter manually".
 *
 * @param {string} isbn13
 * @returns {Object}
 */
function blankForm(isbn13) {
  return {
    isbn13       : isbn13 || '',
    title        : '',
    authors      : '',          // comma-separated input; split on save
    publishedYear: '',
    coverUrl     : '',
    summary      : '',
    readingLevel : '',
    source       : 'manual'
  }
}

/**
 * Hydrate the form from a lookup result.
 *
 * @param {import('../../utils/bookLookup.js').BookLookupResult} hit
 * @returns {Object}
 */
function formFromLookup(hit) {
  return {
    isbn13       : hit.isbn13,
    title        : hit.title || '',
    authors      : (hit.authors || []).join(', '),
    publishedYear: hit.publishedYear ? String(hit.publishedYear) : '',
    coverUrl     : hit.coverUrl || '',
    summary      : hit.summary || '',
    readingLevel : '',
    source       : hit.source
  }
}

/**
 * AdminBooks — catalog CRUD page.
 *
 * @returns {JSX.Element}
 */
export default function AdminBooks() {

  const { user } = useAuth()

  const [books,     setBooks]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [listError, setListError] = useState(null)

  // ISBN lookup input + status.
  const [isbnInput,    setIsbnInput]    = useState('')
  const [looking,      setLooking]      = useState(false)
  const [lookupError,  setLookupError]  = useState(null)

  // Form state (open for add OR edit).
  const [form,        setForm]        = useState(null)   // null = no form open
  const [editingId,   setEditingId]   = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState(null)

  // ── Live subscription to the catalog ──
  useEffect(() => {
    const unsub = onSnapshot(
      tenantCollection('books'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            // Active first, then by addedAt desc.
            if (a.active !== b.active) return a.active ? -1 : 1
            const ta = a.addedAt && a.addedAt.toMillis ? a.addedAt.toMillis() : 0
            const tb = b.addedAt && b.addedAt.toMillis ? b.addedAt.toMillis() : 0
            return tb - ta
          })
        setBooks(list)
        setLoading(false)
      },
      (err) => {
        setListError(err.message || String(err))
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  // Already-cataloged ISBNs — used to warn before re-adding a duplicate.
  const existingIsbns = useMemo(
    () => new Set(books.map((b) => b.isbn13).filter(Boolean)),
    [books]
  )

  // ── Lookup ──
  const handleLookup = async (event) => {
    if (event && event.preventDefault) event.preventDefault()
    setLookupError(null)
    setSaveError(null)

    if (!isValidIsbn(isbnInput)) {
      setLookupError('That doesn\'t look like a valid ISBN (10 or 13 digits, hyphens are fine).')
      return
    }
    const isbn13 = normalizeIsbn(isbnInput)

    if (existingIsbns.has(isbn13)) {
      const existing = books.find((b) => b.isbn13 === isbn13)
      setLookupError(`"${existing.title}" is already in the catalog. Use Edit on its card to update it.`)
      return
    }

    setLooking(true)
    try {
      const hit = await lookupBookByIsbn(isbn13)
      if (hit) {
        setForm(formFromLookup(hit))
        setEditingId(null)
      } else {
        // Lookup failed; open a manual-entry form pre-filled with the ISBN.
        setForm(blankForm(isbn13))
        setEditingId(null)
        setLookupError(
          'Couldn\'t find that ISBN in Open Library or Google Books. ' +
          'You can enter the details by hand below.'
        )
      }
    } catch (err) {
      setLookupError(err.message || String(err))
    } finally {
      setLooking(false)
    }
  }

  // ── Edit existing ──
  const handleEdit = (book) => {
    setEditingId(book.id)
    setForm({
      isbn13       : book.isbn13 || '',
      title        : book.title || '',
      authors      : (book.authors || []).join(', '),
      publishedYear: book.publishedYear ? String(book.publishedYear) : '',
      coverUrl     : book.coverUrl || '',
      summary      : book.summary || '',
      readingLevel : book.readingLevel || '',
      source       : book.source || 'manual'
    })
    setSaveError(null)
    // Scroll to top so the editor is visible.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFormFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const closeForm = () => {
    setForm(null)
    setEditingId(null)
    setSaveError(null)
  }

  // ── Save (create or update) ──
  const handleSave = async (event) => {
    event.preventDefault()
    setSaveError(null)
    if (!user) return

    const cleanTitle = (form.title || '').trim()
    if (!cleanTitle) {
      setSaveError('Title is required.')
      return
    }
    const isbn13 = normalizeIsbn(form.isbn13)
    if (!isbn13) {
      setSaveError('A valid ISBN is required.')
      return
    }
    const authorsList = (form.authors || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const publishedYear = form.publishedYear ? Number(form.publishedYear) : null
    const cleanCover    = (form.coverUrl || '').trim() || null
    const summary       = (form.summary || '').trim()
    const readingLevel  = form.readingLevel || null

    setSaving(true)
    try {
      if (editingId) {
        await updateDoc(tenantDoc('books', editingId), {
          isbn13,
          title        : cleanTitle,
          authors      : authorsList,
          publishedYear,
          coverUrl     : cleanCover,
          summary,
          readingLevel,
          source       : form.source || 'manual',
          updatedAt    : serverTimestamp()
        })
      } else {
        // Use the ISBN as the doc ID — unique per book and lets us look
        // up duplicates by reference.
        const bookId = isbn13
        await setDoc(tenantDoc('books', bookId), {
          id           : bookId,
          isbn13,
          title        : cleanTitle,
          authors      : authorsList,
          publishedYear,
          coverUrl     : cleanCover,
          summary,
          readingLevel,
          source       : form.source || 'manual',
          active       : true,
          quizApproved : false,           // ITEM 5 flips this once a quiz pool exists
          addedBy      : user.uid,
          addedAt      : serverTimestamp(),
          updatedAt    : null
        })
        setIsbnInput('')
      }
      closeForm()
    } catch (err) {
      setSaveError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Active toggle (inline on card) ──
  const handleToggleActive = async (book) => {
    try {
      await updateDoc(tenantDoc('books', book.id), {
        active   : !book.active,
        updatedAt: serverTimestamp()
      })
    } catch (err) {
      window.alert(`Couldn’t toggle active: ${err.message || err}`)
    }
  }

  // ── Delete ──
  const handleDelete = async (book) => {
    const ok = window.confirm(
      `Delete "${book.title}" from the catalog? This removes the book ` +
      `entirely. Active challenges on this book would break.`
    )
    if (!ok) return
    try {
      await deleteDoc(tenantDoc('books', book.id))
    } catch (err) {
      window.alert(`Couldn’t delete: ${err.message || err}`)
    }
  }

  return (
    <article className={styles.page}>

      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Books</p>
        <h1 className={styles.title}>Catalog</h1>
        <p className={styles.lede}>
          Add books to the reward shelf by ISBN. We auto-fetch the title,
          authors, cover, and summary from Open Library (with Google Books as a
          fallback). Edit anything before saving. ITEM 3b adds the camera-based
          barcode scanner; ITEM 3c adds the public <Link to="/about">/books</Link>
          {' '}browse page. For now: type or paste an ISBN below.
        </p>
      </header>

      {/* ── ISBN LOOKUP ── */}
      {!form ? (
        <section className={bookStyles.lookupCard}>
          <form className={bookStyles.lookupForm} onSubmit={handleLookup}>
            <div className={bookStyles.lookupField}>
              <label htmlFor="isbn-input" className={bookStyles.lookupLabel}>
                ISBN
              </label>
              <input
                id        ="isbn-input"
                type      ="text"
                value     ={isbnInput}
                onChange  ={(e) => setIsbnInput(e.target.value)}
                placeholder="978-0-545-01022-1 (10 or 13 digits, hyphens OK)"
                className ={bookStyles.lookupInput}
                disabled  ={looking}
                autoComplete="off"
                inputMode ="text"
                spellCheck={false}
              />
            </div>
            <button
              type      ="submit"
              className ="btn btn-primary"
              disabled  ={looking || !isbnInput.trim()}
            >
              {looking ? 'Looking up…' : 'Look up book'}
            </button>
          </form>
          {lookupError ? (
            <div className={styles.error} role="alert">{lookupError}</div>
          ) : null}
        </section>
      ) : null}

      {/* ── REVIEW / EDIT FORM ── */}
      {form ? (
        <BookForm
          form        ={form}
          isEdit      ={Boolean(editingId)}
          onFieldChange={handleFormFieldChange}
          onSave      ={handleSave}
          onCancel    ={closeForm}
          saving      ={saving}
          error       ={saveError}
        />
      ) : null}

      {/* ── CATALOG GRID ── */}
      <section>
        <h2 className={bookStyles.sectionTitle}>
          Current catalog
          <span className={bookStyles.count}>
            {loading ? '…' : `${books.length} ${books.length === 1 ? 'book' : 'books'}`}
          </span>
        </h2>

        {listError ? (
          <div className={styles.error}>Couldn&apos;t load books: {listError}</div>
        ) : null}

        {!loading && books.length === 0 ? (
          <p className="muted">No books yet. Look up an ISBN above to add the first one.</p>
        ) : (
          <div className={bookStyles.grid}>
            {books.map((b) => (
              <BookCard
                key            ={b.id}
                book           ={b}
                onEdit         ={handleEdit}
                onDelete       ={handleDelete}
                onToggleActive ={handleToggleActive}
              />
            ))}
          </div>
        )}
      </section>

    </article>
  )
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Inline subcomponents                                                  */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * BookForm — review / edit pane shown after a lookup OR when editing an
 * existing book. Controlled inputs flow back up through onFieldChange.
 *
 * @param   {Object}   props
 * @returns {JSX.Element}
 */
function BookForm({ form, isEdit, onFieldChange, onSave, onCancel, saving, error }) {
  return (
    <form className={bookStyles.editorCard} onSubmit={onSave}>

      <header className={bookStyles.editorHeader}>
        <p className={bookStyles.editorEyebrow}>{isEdit ? 'Editing' : 'Review & save'}</p>
        <h2 className={bookStyles.editorTitle}>
          {form.title || (isEdit ? 'Editing book' : 'New book')}
        </h2>
        {form.source && form.source !== 'manual' ? (
          <p className={bookStyles.sourceTag}>
            Fetched from <strong>{form.source === 'open-library' ? 'Open Library' : 'Google Books'}</strong>
            {' — anything below is editable.'}
          </p>
        ) : null}
      </header>

      <div className={bookStyles.editorBody}>
        <div className={bookStyles.coverPreview}>
          {form.coverUrl ? (
            <img
              src      ={form.coverUrl}
              alt      ="Book cover preview"
              className={bookStyles.coverImage}
              loading  ="lazy"
            />
          ) : (
            <span className={bookStyles.coverFallback}>📖</span>
          )}
        </div>

        <div className={bookStyles.editorFields}>

          <div className={bookStyles.field}>
            <label className={bookStyles.label}>ISBN</label>
            <input
              type      ="text"
              value     ={form.isbn13}
              onChange  ={onFieldChange('isbn13')}
              className ={bookStyles.input}
              disabled  ={saving || isEdit}
              required
            />
          </div>

          <div className={bookStyles.field}>
            <label className={bookStyles.label}>Title</label>
            <input
              type      ="text"
              value     ={form.title}
              onChange  ={onFieldChange('title')}
              className ={bookStyles.input}
              disabled  ={saving}
              maxLength ={200}
              required
            />
          </div>

          <div className={bookStyles.field}>
            <label className={bookStyles.label}>Authors</label>
            <input
              type      ="text"
              value     ={form.authors}
              onChange  ={onFieldChange('authors')}
              placeholder="Comma-separated"
              className ={bookStyles.input}
              disabled  ={saving}
            />
          </div>

          <div className={bookStyles.fieldRow}>
            <div className={bookStyles.field}>
              <label className={bookStyles.label}>Year</label>
              <input
                type      ="number"
                value     ={form.publishedYear}
                onChange  ={onFieldChange('publishedYear')}
                className ={bookStyles.input}
                disabled  ={saving}
                min       ={1500}
                max       ={2100}
              />
            </div>
            <div className={bookStyles.field}>
              <label className={bookStyles.label}>Reading level</label>
              <select
                value     ={form.readingLevel}
                onChange  ={onFieldChange('readingLevel')}
                className ={bookStyles.input}
                disabled  ={saving}
              >
                {READING_LEVELS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={bookStyles.field}>
            <label className={bookStyles.label}>Cover URL</label>
            <input
              type      ="url"
              value     ={form.coverUrl}
              onChange  ={onFieldChange('coverUrl')}
              className ={bookStyles.input}
              disabled  ={saving}
              placeholder="https://covers.openlibrary.org/b/isbn/…-L.jpg"
            />
          </div>

          <div className={bookStyles.field}>
            <label className={bookStyles.label}>Summary</label>
            <textarea
              value     ={form.summary}
              onChange  ={onFieldChange('summary')}
              className ={`${bookStyles.input} ${bookStyles.textarea}`}
              disabled  ={saving}
              rows      ={6}
              maxLength ={2000}
              placeholder="Used by the quiz generator (ITEM 5) and on the public book detail page."
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className={styles.error} role="alert">{error}</div>
      ) : null}

      <div className={bookStyles.editorActions}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Save book')}
        </button>
        <button
          type     ="button"
          onClick  ={onCancel}
          disabled ={saving}
          className={bookStyles.cancel}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/**
 * BookCard — single-book tile in the admin catalog grid.
 *
 * @returns {JSX.Element}
 */
function BookCard({ book, onEdit, onDelete, onToggleActive }) {
  const authors = (book.authors || []).join(', ')
  return (
    <article className={`${bookStyles.bookCard} ${book.active ? '' : bookStyles.bookCardInactive}`}>
      <div className={bookStyles.bookCover}>
        {book.coverUrl ? (
          <img
            src      ={book.coverUrl}
            alt      =""
            className={bookStyles.bookCoverImage}
            loading  ="lazy"
          />
        ) : (
          <span className={bookStyles.bookCoverFallback}>📖</span>
        )}
        {!book.active ? (
          <span className={bookStyles.inactiveTag}>Inactive</span>
        ) : null}
      </div>

      <div className={bookStyles.bookMeta}>
        <p className={bookStyles.bookTitle} title={book.title}>{book.title}</p>
        {authors ? <p className={bookStyles.bookAuthors} title={authors}>{authors}</p> : null}
        <p className={bookStyles.bookSubline}>
          {book.publishedYear ? <span>{book.publishedYear}</span> : null}
          {book.readingLevel ? (
            <>
              {book.publishedYear ? <span className={bookStyles.dot}>·</span> : null}
              <span>{book.readingLevel}</span>
            </>
          ) : null}
          <span className={bookStyles.dot}>·</span>
          <span title={book.quizApproved ? 'Quiz approved by librarian' : 'No approved quiz yet'}>
            {book.quizApproved ? 'Quiz ready' : 'Quiz pending'}
          </span>
        </p>
      </div>

      <div className={bookStyles.bookActions}>
        <button
          type      ="button"
          onClick   ={() => onToggleActive(book)}
          className ={`${bookStyles.actionBtn} ${book.active ? bookStyles.actionActive : ''}`}
          aria-pressed={book.active}
          title     ={book.active ? 'Mark inactive (hide from picker)' : 'Mark active (show in picker)'}
        >
          {book.active ? 'Active' : 'Inactive'}
        </button>
        <button
          type      ="button"
          onClick   ={() => onEdit(book)}
          className ={bookStyles.actionBtn}
        >
          Edit
        </button>
        <button
          type      ="button"
          onClick   ={() => onDelete(book)}
          className ={`${bookStyles.actionBtn} ${bookStyles.actionDelete}`}
        >
          Delete
        </button>
      </div>
    </article>
  )
}
