// src/pages/admin/AdminAvatars.jsx
//
// CRUD for the tenant's default avatar pack. Lives at /admin/avatars.
//
// Pipeline on upload:
//   1. User picks one or more image files.
//   2. Files land in a "staged" list where the admin names each one
//      (default name derived from filename, editable inline).
//   3. Admin clicks "Upload all". Each staged file:
//        a. Optimized client-side via utils/imageOptimize (resize to
//           512×512 max, re-encode as PNG to preserve transparency).
//        b. Optimized Blob uploaded to /{tenant}/avatars/{avatarId}.png
//           in Firebase Storage.
//        c. Metadata doc written at /{tenant}/_main/avatars/{avatarId}
//           with id, name, storagePath, downloadUrl, createdAt.
//   4. Resize Images Firebase Extension fires automatically and produces
//      thumbnails under /{tenant}/avatars/thumbs/ (we don't reference
//      them yet; the parent-dashboard picker in ITEM 2d can use them
//      later if grid performance matters).
//
// Names of existing avatars are inline-editable on the tile — click the
// name → type → Enter / blur to save, Escape to cancel.
//
// Each avatar tile shows the transparent PNG on top of a Fortnite-vibe
// gradient — Miguel's intent: source PNGs have no background, the
// gradient is the "container" parents see in the picker.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
}                                  from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
}                                  from 'firebase/storage'

import { storage }                 from '../../firebase'
import {
  tenantCollection,
  tenantDoc,
  tenantStoragePath
}                                  from '../../firebase/tenant.js'

import {
  formatBytes,
  optimizeImage
}                                  from '../../utils/imageOptimize.js'

import styles                      from './Admin.module.css'
import avatarStyles                from './AdminAvatars.module.css'

/**
 * Derives a friendly default name from an uploaded filename. Strips the
 * extension, replaces underscores / hyphens with spaces, and trims. Returns
 * "Avatar" if nothing useful remains.
 *
 * @param   {string} filename
 * @returns {string}
 */
function defaultNameFor(filename) {
  return (
    (filename || '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Avatar'
  )
}

/**
 * AdminAvatars — manage the tenant's default avatar pack.
 *
 * @returns {JSX.Element}
 */
export default function AdminAvatars() {

  const [avatars,   setAvatars]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [listError, setListError] = useState(null)

  // Staged files: picked but not yet uploaded. The admin edits each name
  // here before hitting "Upload all". { id, file, name }
  const [staged, setStaged] = useState([])

  // Active uploads: { id, name, status, error, sizeBefore, sizeAfter }
  const [uploads, setUploads] = useState([])
  const fileInputRef          = useRef(null)

  // Inline-rename state for existing tiles in the grid.
  const [editingId,   setEditingId]   = useState(null)
  const [editingName, setEditingName] = useState('')

  // Lightbox: which avatar (if any) is open at full size.
  const [viewing, setViewing] = useState(null)

  // ── Close lightbox on Escape ──
  useEffect(() => {
    if (!viewing) return
    const onKey = (e) => {
      if (e.key === 'Escape') setViewing(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [viewing])

  // ── Live subscription to the avatars collection ──
  // Sort newest-first client-side to avoid needing a composite index for
  // `orderBy('createdAt', 'desc')` until the pack grows large enough to
  // justify it.
  useEffect(() => {
    const unsub = onSnapshot(
      tenantCollection('avatars'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0
            const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0
            return tb - ta
          })
        setAvatars(list)
        setLoading(false)
      },
      (err) => {
        setListError(err.message || String(err))
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  // ── Upload a single file: optimize → Storage → Firestore ──
  const uploadOne = useCallback(async (file, queueId, displayName) => {
    const mark = (patch) =>
      setUploads((prev) =>
        prev.map((u) => (u.id === queueId ? { ...u, ...patch } : u))
      )

    try {
      mark({ status: 'optimizing' })
      const optimized = await optimizeImage(file, {
        maxDimension: 512,
        type        : 'image/png'
      })
      mark({
        status    : 'uploading',
        sizeBefore: optimized.sizeBefore,
        sizeAfter : optimized.sizeAfter
      })

      // Generate a stable avatar ID — UUID without dashes for a cleaner
      // Storage path. crypto.randomUUID is widely supported in modern browsers.
      const avatarId = (crypto.randomUUID()).replace(/-/g, '')
      const path     = tenantStoragePath('avatars', `${avatarId}.png`)
      const objRef   = ref(storage, path)

      await uploadBytes(objRef, optimized.blob, {
        contentType : 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      })
      const downloadUrl = await getDownloadURL(objRef)

      const finalName = (displayName && displayName.trim()) || defaultNameFor(file.name)

      await setDoc(tenantDoc('avatars', avatarId), {
        id          : avatarId,
        name        : finalName,
        storagePath : path,
        downloadUrl,
        createdAt   : serverTimestamp()
      })

      mark({ status: 'done' })
      // Auto-clear the done entry after a moment.
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== queueId))
      }, 2500)
    } catch (e) {
      mark({ status: 'error', error: e.message || String(e) })
    }
  }, [])

  // Stage picked files in the review list; admin edits names before upload.
  const handleFiles = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const newStaged = files.map((file) => ({
      id  : `${Date.now()}_${file.name}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: defaultNameFor(file.name)
    }))
    setStaged((prev) => [...prev, ...newStaged])

    // Reset the input so picking the same file again still re-fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const updateStagedName = (id, name) => {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  const removeStaged = (id) => {
    setStaged((prev) => prev.filter((s) => s.id !== id))
  }

  const clearStaged = () => setStaged([])

  const uploadAllStaged = () => {
    if (staged.length === 0) return

    // Snapshot into the upload queue and fire each upload in parallel.
    const queue = staged.map((s) => ({
      id        : s.id,
      name      : s.name,
      status    : 'queued',
      sizeBefore: s.file.size,
      sizeAfter : null,
      error     : null
    }))
    setUploads((prev) => [...queue, ...prev])
    staged.forEach((s) => uploadOne(s.file, s.id, s.name))
    setStaged([])
  }

  // ── Inline rename of existing avatars ──
  const startRename = (avatar) => {
    setEditingId(avatar.id)
    setEditingName(avatar.name)
  }

  const cancelRename = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveRename = async (avatar) => {
    const next = editingName.trim()
    if (!next || next === avatar.name) {
      cancelRename()
      return
    }
    try {
      await updateDoc(tenantDoc('avatars', avatar.id), {
        name      : next,
        updatedAt : serverTimestamp()
      })
    } catch (e) {
      window.alert(`Couldn’t rename: ${e.message || e}`)
    } finally {
      cancelRename()
    }
  }

  const handleDelete = async (avatar) => {
    const ok = window.confirm(
      `Delete "${avatar.name}"? Children who have picked this avatar will get a default fallback.`
    )
    if (!ok) return

    try {
      // Delete the Storage object first; the Resize Images extension's
      // thumb cleanup is automatic on object delete.
      try {
        await deleteObject(ref(storage, avatar.storagePath))
      } catch (e) {
        // If the object is already gone, continue to delete the doc.
        if (!/storage\/object-not-found/.test(e.code || '')) throw e
      }
      await deleteDoc(tenantDoc('avatars', avatar.id))
    } catch (e) {
      window.alert(`Couldn't delete avatar: ${e.message || e}`)
    }
  }

  return (
    <article className={styles.page}>

      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Avatars</p>
        <h1 className={styles.title}>Default avatar pack</h1>
        <p className={styles.lede}>
          Parents pick from this pack when adding a child profile. Upload
          transparent PNGs — the picker tiles render them on a gradient
          background. Files are resized to 512&times;512 max and re-encoded
          as PNG client-side before upload.
        </p>
      </header>

      {/* ── UPLOAD CONTROL ── */}
      <section className={avatarStyles.uploadCard}>
        <div className={avatarStyles.uploadInner}>
          <p className={avatarStyles.uploadHeading}>Upload avatars</p>
          <p className={avatarStyles.uploadHelp}>
            PNG with transparent background. Pick one or many — each file gets
            a name field below before you commit to upload.
          </p>
          <input
            ref       ={fileInputRef}
            id        ="avatar-files"
            type      ="file"
            accept    ="image/png, image/jpeg, image/webp"
            multiple
            onChange  ={handleFiles}
            className ={avatarStyles.fileInput}
          />
          <label htmlFor="avatar-files" className={`btn btn-primary ${avatarStyles.fileLabel}`}>
            Choose files…
          </label>
        </div>

        {/* Staged files — name each then upload all */}
        {staged.length > 0 ? (
          <div className={avatarStyles.stagedBlock}>
            <p className={avatarStyles.stagedHeading}>
              Ready to upload ({staged.length})
            </p>
            <ul className={avatarStyles.stagedList}>
              {staged.map((s) => (
                <li key={s.id} className={avatarStyles.stagedItem}>
                  <span className={avatarStyles.stagedFile} title={s.file.name}>
                    {s.file.name} · {formatBytes(s.file.size)}
                  </span>
                  <input
                    type      ="text"
                    value     ={s.name}
                    onChange  ={(e) => updateStagedName(s.id, e.target.value)}
                    className ={avatarStyles.stagedInput}
                    placeholder="Display name"
                    maxLength ={60}
                    aria-label={`Name for ${s.file.name}`}
                  />
                  <button
                    type      ="button"
                    onClick   ={() => removeStaged(s.id)}
                    className ={avatarStyles.stagedRemove}
                    aria-label={`Remove ${s.file.name} from upload list`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className={avatarStyles.stagedActions}>
              <button
                type      ="button"
                onClick   ={uploadAllStaged}
                className ="btn btn-primary"
              >
                Upload all ({staged.length})
              </button>
              <button
                type      ="button"
                onClick   ={clearStaged}
                className ={avatarStyles.stagedClear}
              >
                Clear staged
              </button>
            </div>
          </div>
        ) : null}

        {/* In-flight upload queue */}
        {uploads.length > 0 ? (
          <ul className={avatarStyles.queue}>
            {uploads.map((u) => (
              <li key={u.id} className={`${avatarStyles.queueItem} ${avatarStyles[`status_${u.status}`]}`}>
                <span className={avatarStyles.queueName}>{u.name}</span>
                <span className={avatarStyles.queueStatus}>
                  {u.status === 'queued'     && 'queued…'}
                  {u.status === 'optimizing' && 'optimizing…'}
                  {u.status === 'uploading'  && (
                    <>
                      uploading
                      {' '}{formatBytes(u.sizeAfter || 0)}
                      {u.sizeBefore ? ` (from ${formatBytes(u.sizeBefore)})` : ''}
                    </>
                  )}
                  {u.status === 'done'       && (
                    <>done · {formatBytes(u.sizeAfter || 0)} (from {formatBytes(u.sizeBefore || 0)})</>
                  )}
                  {u.status === 'error'      && `error: ${u.error}`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ── CURRENT AVATARS GRID ── */}
      <section>
        <h2 className={avatarStyles.sectionTitle}>
          Current pack
          <span className={avatarStyles.count}>
            {loading ? '…' : `${avatars.length} avatar${avatars.length === 1 ? '' : 's'}`}
          </span>
        </h2>

        {listError ? (
          <div className={styles.error}>Couldn&apos;t load avatars: {listError}</div>
        ) : null}

        {!loading && avatars.length === 0 ? (
          <p className="muted">No avatars yet. Upload some above.</p>
        ) : (
          <div className={avatarStyles.grid}>
            {avatars.map((a) => (
              <article key={a.id} className={avatarStyles.tile}>
                <button
                  type      ="button"
                  className ={avatarStyles.tileSurface}
                  onClick   ={() => setViewing(a)}
                  aria-label={`View ${a.name} at full size`}
                >
                  <img
                    src      ={a.downloadUrl}
                    alt      ={a.name}
                    className={avatarStyles.tileImage}
                    loading  ="lazy"
                  />
                  <span className={avatarStyles.tileZoom} aria-hidden="true">⛶</span>
                </button>

                {editingId === a.id ? (
                  <input
                    autoFocus
                    type      ="text"
                    value     ={editingName}
                    maxLength ={60}
                    onChange  ={(e) => setEditingName(e.target.value)}
                    onBlur    ={() => saveRename(a)}
                    onKeyDown ={(e) => {
                      if (e.key === 'Enter')  { e.preventDefault(); e.target.blur() }
                      if (e.key === 'Escape') { cancelRename() }
                    }}
                    className ={avatarStyles.tileRenameInput}
                    aria-label={`Rename ${a.name}`}
                  />
                ) : (
                  <button
                    type      ="button"
                    className ={avatarStyles.tileNameBtn}
                    onClick   ={() => startRename(a)}
                    title     ="Click to rename"
                  >
                    {a.name}
                    <span className={avatarStyles.tileNamePencil} aria-hidden="true">✏︎</span>
                  </button>
                )}

                <button
                  type      ="button"
                  className ={avatarStyles.tileDelete}
                  onClick   ={() => handleDelete(a)}
                  aria-label={`Delete ${a.name}`}
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── LIGHTBOX ── */}
      {viewing ? (
        <div
          className ={avatarStyles.lightbox}
          onClick   ={() => setViewing(null)}
          role      ="dialog"
          aria-modal="true"
          aria-label={`${viewing.name} — full size`}
        >
          <button
            type      ="button"
            className ={avatarStyles.lightboxClose}
            onClick   ={(e) => { e.stopPropagation(); setViewing(null) }}
            aria-label="Close"
          >
            ×
          </button>
          <div
            className ={avatarStyles.lightboxInner}
            onClick   ={(e) => e.stopPropagation()}
          >
            <div className={avatarStyles.lightboxSurface}>
              <img
                src      ={viewing.downloadUrl}
                alt      ={viewing.name}
                className={avatarStyles.lightboxImage}
              />
            </div>
            <p className={avatarStyles.lightboxName}>{viewing.name}</p>
            <p className={`${avatarStyles.lightboxHint} ${avatarStyles.lightboxHintDesktop}`}>
              Click outside or press <kbd>Esc</kbd> to close.
            </p>
            <p className={`${avatarStyles.lightboxHint} ${avatarStyles.lightboxHintTouch}`}>
              Tap outside to close.
            </p>
          </div>
        </div>
      ) : null}

    </article>
  )
}
