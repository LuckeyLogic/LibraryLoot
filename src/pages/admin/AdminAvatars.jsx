// src/pages/admin/AdminAvatars.jsx
//
// CRUD for the tenant's default avatar pack. Lives at /admin/avatars.
//
// Pipeline on upload:
//   1. User picks one or more image files.
//   2. Each file is optimized client-side via utils/imageOptimize (resize
//      to 512×512 max, re-encode as PNG to preserve transparency).
//   3. The optimized Blob is uploaded to Firebase Storage at
//      /{tenant}/avatars/{avatarId}.png.
//   4. A metadata doc is written at /{tenant}/_main/avatars/{avatarId}
//      with id, name, storagePath, downloadUrl, createdAt.
//   5. Resize Images Firebase Extension fires automatically and produces
//      thumbnails under /{tenant}/avatars/thumbs/ (we don't reference
//      them yet; the parent-dashboard picker in ITEM 2d can use them
//      later if grid performance matters).
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
  setDoc
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
 * AdminAvatars — manage the tenant's default avatar pack.
 *
 * @returns {JSX.Element}
 */
export default function AdminAvatars() {

  const [avatars,   setAvatars]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [listError, setListError] = useState(null)

  // Active uploads: { id, name, status, progress, error, sizeBefore, sizeAfter }
  const [uploads, setUploads] = useState([])
  const fileInputRef          = useRef(null)

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
  const uploadOne = useCallback(async (file, queueId) => {
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

      // Friendly default name from the filename.
      const niceName =
        file.name
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/[_-]+/g, ' ')
          .trim() || 'Avatar'

      await setDoc(tenantDoc('avatars', avatarId), {
        id          : avatarId,
        name        : niceName,
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

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const newEntries = files.map((file) => ({
      id        : `${Date.now()}_${file.name}_${Math.random().toString(36).slice(2, 8)}`,
      name      : file.name,
      status    : 'queued',
      sizeBefore: file.size,
      sizeAfter : null,
      error     : null
    }))
    setUploads((prev) => [...newEntries, ...prev])

    // Fire-and-forget each upload. They run in parallel — Firebase Storage
    // handles concurrency fine for small files.
    newEntries.forEach((entry, idx) => uploadOne(files[idx], entry.id))

    // Reset the input so picking the same files again re-fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = ''
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
            PNG with transparent background. Multiple files OK — they upload
            in parallel.
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
                <div className={avatarStyles.tileSurface}>
                  <img
                    src      ={a.downloadUrl}
                    alt      ={a.name}
                    className={avatarStyles.tileImage}
                    loading  ="lazy"
                  />
                </div>
                <p className={avatarStyles.tileName} title={a.name}>{a.name}</p>
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

    </article>
  )
}
