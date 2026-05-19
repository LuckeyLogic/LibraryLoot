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

import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes
}                                              from 'firebase/storage'

import { useAuth }                             from '../../context/AuthContext.jsx'

import IsbnScanner                             from '../../components/IsbnScanner.jsx'

import { storage }                             from '../../firebase'
import {
  tenantCollection,
  tenantDoc,
  tenantStoragePath
}                                              from '../../firebase/tenant.js'

import { isValidIsbn, normalizeIsbn }          from '../../utils/isbn.js'
import { lookupBookByIsbn }                    from '../../utils/bookLookup.js'
import {
  formatBytes,
  optimizeImage
}                                              from '../../utils/imageOptimize.js'

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
    isbn13                : isbn13 || '',
    title                 : '',
    authors               : '',          // comma-separated input; split on save
    publishedYear         : '',
    coverUrl              : '',
    coverStoragePath      : null,
    pendingCoverFile      : null,        // File staged for upload on save
    pendingCoverPreviewUrl: null,        // URL.createObjectURL for in-form preview
    summary               : '',
    readingLevel          : '',
    series                : '',          // string; null on save when blank
    seriesNumber          : '',          // string in form, Number on save
    subjects              : '',          // comma-separated; split on save
    source                : 'manual'
  }
}

/**
 * Hydrate the form from a lookup result.
 *
 * @param {Object} hit  Normalized result from utils/bookLookup.lookupBookByIsbn (BookLookupResult).
 * @returns {Object}
 */
function formFromLookup(hit) {
  return {
    isbn13                : hit.isbn13,
    title                 : hit.title || '',
    authors               : (hit.authors || []).join(', '),
    publishedYear         : hit.publishedYear ? String(hit.publishedYear) : '',
    coverUrl              : hit.coverUrl || '',
    coverStoragePath      : null,        // API-sourced; not in Storage
    pendingCoverFile      : null,
    pendingCoverPreviewUrl: null,
    summary               : hit.summary || '',
    readingLevel          : '',
    series                : hit.series || '',
    seriesNumber          : hit.seriesNumber != null ? String(hit.seriesNumber) : '',
    subjects              : (hit.subjects || []).join(', '),
    source                : hit.source
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
  const [scannerOpen,  setScannerOpen]  = useState(false)

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

  // ── Lookup (called from form submit AND from scanner-success) ──
  const performLookup = async (rawIsbn) => {
    setLookupError(null)
    setSaveError(null)

    if (!isValidIsbn(rawIsbn)) {
      setLookupError('That doesn\'t look like a valid ISBN (10 or 13 digits, hyphens are fine).')
      return
    }
    const isbn13 = normalizeIsbn(rawIsbn)

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

  const handleLookup = (event) => {
    if (event && event.preventDefault) event.preventDefault()
    return performLookup(isbnInput)
  }

  const handleScanResult = (isbn13) => {
    setScannerOpen(false)
    setIsbnInput(isbn13)
    // Auto-trigger the lookup so a successful scan flows straight into
    // the review pane — that's the whole point of scanning.
    performLookup(isbn13)
  }

  // ── Refresh metadata from the web for an existing book ──
  // Re-runs the Open Library + Google Books lookup for the book's ISBN,
  // opens the edit form pre-filled with the fresh API data, and lets
  // the admin review/edit before saving. Preserves Storage-backed
  // cover paths so we don't lose an admin-uploaded image during a
  // metadata refresh.
  const handleRefresh = async (book) => {
    setLookupError(null)
    setSaveError(null)
    setLooking(true)
    try {
      const hit = await lookupBookByIsbn(book.isbn13)
      if (!hit) {
        setLookupError(
          `Couldn't refresh "${book.title}" — Open Library and Google Books returned nothing for ISBN ${book.isbn13}. You can still edit manually.`
        )
        return
      }
      setEditingId(book.id)
      setForm({
        ...formFromLookup(hit),
        // Preserve admin-curated cover Storage state — formFromLookup
        // resets these to null since they're API-sourced. The admin
        // can still swap to the API-sourced coverUrl manually below.
        coverStoragePath      : book.coverStoragePath || null,
        // Honor admin's existing reading-level choice — the API
        // never returns this and we shouldn't reset it on refresh.
        readingLevel          : book.readingLevel || ''
      })
    } catch (e) {
      setLookupError(`Refresh failed: ${e.message || e}`)
    } finally {
      setLooking(false)
    }
  }

  // ── Edit existing ──
  const handleEdit = (book) => {
    setEditingId(book.id)
    setForm({
      isbn13                : book.isbn13 || '',
      title                 : book.title || '',
      authors               : (book.authors || []).join(', '),
      publishedYear         : book.publishedYear ? String(book.publishedYear) : '',
      coverUrl              : book.coverUrl || '',
      coverStoragePath      : book.coverStoragePath || null,
      pendingCoverFile      : null,
      pendingCoverPreviewUrl: null,
      summary               : book.summary || '',
      readingLevel          : book.readingLevel || '',
      series                : book.series || '',
      seriesNumber          : book.seriesNumber != null ? String(book.seriesNumber) : '',
      subjects              : Array.isArray(book.subjects) ? book.subjects.join(', ') : '',
      source                : book.source || 'manual'
    })
    setSaveError(null)
    // Scroll to top so the editor is visible.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFormFieldChange = (field) => (event) => {
    setForm((prev) => {
      const next = { ...prev, [field]: event.target.value }
      // If the user types into the Cover URL field while there's a
      // staged file upload, they're abandoning the upload in favor of
      // the typed URL — drop the staged file + revoke its preview URL.
      if (field === 'coverUrl' && prev.pendingCoverFile) {
        if (prev.pendingCoverPreviewUrl) URL.revokeObjectURL(prev.pendingCoverPreviewUrl)
        next.pendingCoverFile       = null
        next.pendingCoverPreviewUrl = null
      }
      return next
    })
  }

  // File picker → stage the file + generate a local preview URL. The
  // actual Storage upload happens on form save, so cancelling never
  // leaves an orphan object in the bucket.
  const handleCoverFile = (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    setForm((prev) => {
      if (prev.pendingCoverPreviewUrl) URL.revokeObjectURL(prev.pendingCoverPreviewUrl)
      return {
        ...prev,
        pendingCoverFile      : file,
        pendingCoverPreviewUrl: URL.createObjectURL(file)
      }
    })
    // Reset the input so picking the same file again still fires onChange.
    event.target.value = ''
  }

  const handleClearCover = () => {
    setForm((prev) => {
      if (prev.pendingCoverPreviewUrl) URL.revokeObjectURL(prev.pendingCoverPreviewUrl)
      return {
        ...prev,
        coverUrl              : '',
        // Keep coverStoragePath as-is — handleSave deletes the Storage
        // object when the saved cover no longer references it.
        pendingCoverFile      : null,
        pendingCoverPreviewUrl: null
      }
    })
  }

  const closeForm = () => {
    if (form && form.pendingCoverPreviewUrl) {
      URL.revokeObjectURL(form.pendingCoverPreviewUrl)
    }
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
    const summary       = (form.summary || '').trim()
    const readingLevel  = form.readingLevel || null
    const series        = (form.series || '').trim() || null
    const seriesNumberRaw = (form.seriesNumber || '').trim()
    const seriesNumber  = seriesNumberRaw ? Number(seriesNumberRaw) : null
    const subjects      = (form.subjects || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)         // mirror MAX_SUBJECTS from bookLookup.js

    setSaving(true)
    try {
      // ── Cover commit logic ──────────────────────────────────────────
      // Three possible end states:
      //   (a) staged file present → upload, set new url + storagePath,
      //       delete previous Storage object if any
      //   (b) form.coverUrl points at an external URL while a previous
      //       Storage object existed → delete the Storage object
      //   (c) coverUrl is empty (user cleared) while a previous Storage
      //       object existed → delete the Storage object
      //   default: keep coverUrl + coverStoragePath as-is
      let coverUrl         = (form.coverUrl || '').trim() || null
      let coverStoragePath = form.coverStoragePath || null

      if (form.pendingCoverFile) {
        // (a) Upload to Storage at the deterministic per-book path.
        const { blob } = await optimizeImage(form.pendingCoverFile, {
          maxDimension: 600,
          quality     : 0.85,
          type        : 'image/jpeg'
        })
        const newPath  = tenantStoragePath('books', isbn13, 'cover.jpg')
        const newRef   = storageRef(storage, newPath)
        await uploadBytes(newRef, blob, {
          contentType : 'image/jpeg',
          cacheControl: 'public, max-age=3600'
        })
        const newUrl = await getDownloadURL(newRef)

        // If a previous Storage object lives at a DIFFERENT path, delete
        // it. Same-path uploads overwrite — no separate delete needed.
        if (coverStoragePath && coverStoragePath !== newPath) {
          try { await deleteObject(storageRef(storage, coverStoragePath)) }
          catch (_) { /* OK if already gone */ }
        }

        coverUrl         = newUrl
        coverStoragePath = newPath
      } else if (coverStoragePath) {
        // No new upload — but did the user swap to an external URL or
        // clear the field? Detect by URL containing the Storage object's
        // path-encoded segment.
        const looksLikeStorage =
          coverUrl && coverUrl.includes(encodeURIComponent(coverStoragePath))
        if (!looksLikeStorage) {
          // (b) or (c) — release the old Storage object.
          try { await deleteObject(storageRef(storage, coverStoragePath)) }
          catch (_) { /* OK if already gone */ }
          coverStoragePath = null
        }
      }

      // ── Firestore write ─────────────────────────────────────────────
      if (editingId) {
        await updateDoc(tenantDoc('books', editingId), {
          isbn13,
          title        : cleanTitle,
          authors      : authorsList,
          publishedYear,
          coverUrl,
          coverStoragePath,
          summary,
          readingLevel,
          series,
          seriesNumber,
          subjects,
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
          coverUrl,
          coverStoragePath,
          summary,
          readingLevel,
          series,
          seriesNumber,
          subjects,
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
      // Best-effort: clean up the Storage cover BEFORE the Firestore
      // doc disappears. If the Storage delete fails we still remove
      // the doc — an orphan object in Storage is recoverable; an
      // orphan Firestore doc isn't.
      if (book.coverStoragePath) {
        try { await deleteObject(storageRef(storage, book.coverStoragePath)) }
        catch (_) { /* OK if already gone or rules block */ }
      }
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
            <button
              type      ="button"
              onClick   ={() => setScannerOpen(true)}
              className ={`btn btn-secondary ${bookStyles.scanBtn}`}
              disabled  ={looking}
              title     ="Use the camera to scan the barcode on the back of a book"
            >
              <span aria-hidden="true" className={bookStyles.scanGlyph}>⎙</span>
              <span>Scan barcode</span>
            </button>
          </form>
          {lookupError ? (
            <div className={styles.error} role="alert">{lookupError}</div>
          ) : null}
        </section>
      ) : null}

      {/* ── SCANNER OVERLAY ── */}
      {scannerOpen ? (
        <IsbnScanner
          onScan ={handleScanResult}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

      {/* ── REVIEW / EDIT FORM ── */}
      {form ? (
        <BookForm
          form          ={form}
          isEdit        ={Boolean(editingId)}
          onFieldChange ={handleFormFieldChange}
          onCoverFile   ={handleCoverFile}
          onClearCover  ={handleClearCover}
          onSave        ={handleSave}
          onCancel      ={closeForm}
          saving        ={saving}
          error         ={saveError}
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
                onRefresh      ={handleRefresh}
                refreshing     ={looking}
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
function BookForm({
  form,
  isEdit,
  onFieldChange,
  onCoverFile,
  onClearCover,
  onSave,
  onCancel,
  saving,
  error
}) {
  // What to show in the preview pane: a locally-generated preview for
  // a staged file (highest priority — they haven't saved yet) or the
  // committed coverUrl, or the bookicon fallback.
  const previewSrc = form.pendingCoverPreviewUrl || form.coverUrl || null
  const hasAnyCover =
    Boolean(form.pendingCoverFile) ||
    Boolean((form.coverUrl || '').trim()) ||
    Boolean(form.coverStoragePath)

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
        <div className={bookStyles.coverColumn}>
          <div className={bookStyles.coverPreview}>
            {previewSrc ? (
              <img
                src      ={previewSrc}
                alt      ="Book cover preview"
                className={bookStyles.coverImage}
                loading  ="lazy"
              />
            ) : (
              <span className={bookStyles.coverFallback}>📖</span>
            )}
            {form.pendingCoverFile ? (
              <span className={bookStyles.pendingTag} title={form.pendingCoverFile.name}>
                Pending upload · {formatBytes(form.pendingCoverFile.size)}
              </span>
            ) : null}
          </div>

          {/* Cover actions — upload or clear. Hidden file input + label-as-button. */}
          <div className={bookStyles.coverActions}>
            <input
              id        ="book-cover-file"
              type      ="file"
              accept    ="image/png, image/jpeg, image/webp"
              onChange  ={onCoverFile}
              className ={bookStyles.coverFileInput}
              disabled  ={saving}
            />
            <label
              htmlFor   ="book-cover-file"
              className ={`btn btn-secondary ${bookStyles.coverUploadBtn}`}
              aria-disabled={saving}
            >
              {hasAnyCover ? 'Replace cover…' : 'Upload your own…'}
            </label>
            {hasAnyCover ? (
              <button
                type      ="button"
                onClick   ={onClearCover}
                className ={bookStyles.coverClearBtn}
                disabled  ={saving}
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className={bookStyles.coverHelp}>
            Use the URL field below for an external cover image, or upload your own
            here. Uploaded covers are stored in Firebase and clean themselves up
            when you replace or delete the book.
          </p>
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

          <div className={bookStyles.fieldRow}>
            <div className={bookStyles.field} style={{ flex: 2 }}>
              <label className={bookStyles.label}>Series</label>
              <input
                type        ="text"
                value       ={form.series}
                onChange    ={onFieldChange('series')}
                className   ={bookStyles.input}
                disabled    ={saving}
                placeholder ='e.g. "The Baby-Sitters Club Graphix"'
              />
            </div>
            <div className={bookStyles.field}>
              <label className={bookStyles.label}>Series #</label>
              <input
                type        ="number"
                value       ={form.seriesNumber}
                onChange    ={onFieldChange('seriesNumber')}
                className   ={bookStyles.input}
                disabled    ={saving}
                min         ={1}
                max         ={999}
                placeholder ="optional"
              />
            </div>
          </div>

          <div className={bookStyles.field}>
            <label className={bookStyles.label}>Subjects / genre tags</label>
            <input
              type        ="text"
              value       ={form.subjects}
              onChange    ={onFieldChange('subjects')}
              className   ={bookStyles.input}
              disabled    ={saving}
              placeholder ='Comma-separated, e.g. "Friendship, Middle school, Family"'
            />
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
function BookCard({ book, onEdit, onDelete, onToggleActive, onRefresh, refreshing }) {
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
          onClick   ={() => onRefresh(book)}
          className ={bookStyles.actionBtn}
          disabled  ={refreshing}
          title     ="Re-fetch metadata from Open Library / Google Books and review changes before saving."
        >
          {refreshing ? 'Refreshing…' : '🔄 Refresh'}
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
