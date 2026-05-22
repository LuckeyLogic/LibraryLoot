/**
 * Client-side image resize + recompress. Runs in the browser BEFORE the file is
 * uploaded to Firebase Storage, so the bytes that leave the user's machine are
 * already small. Reduces Storage cost, upload time (especially on mobile data),
 * and bandwidth on every subsequent read. Sits on top of the native Canvas API —
 * no third-party dependency. Works on every browser that supports
 * createImageBitmap + canvas.toBlob (Chrome / Safari / Firefox current, plus
 * their iOS / Android peers). Used by: - Admin…
 * @module utils/imageOptimize
 */
// src/utils/imageOptimize.js
//
// Client-side image resize + recompress. Runs in the browser BEFORE the
// file is uploaded to Firebase Storage, so the bytes that leave the
// user's machine are already small. Reduces Storage cost, upload time
// (especially on mobile data), and bandwidth on every subsequent read.
//
// Sits on top of the native Canvas API — no third-party dependency.
// Works on every browser that supports createImageBitmap + canvas.toBlob
// (Chrome / Safari / Firefox current, plus their iOS / Android peers).
//
// Used by:
//   - Admin avatar uploads (ITEM 2e.2) — PNG output to preserve transparency
//   - Sponsor logo uploads (ITEM 4)    — PNG output
//   - Book cover uploads, if any       — JPEG output
//
// The Firebase Resize Images extension still runs server-side on top of
// this — it generates additional smaller variants (thumbs) under the
// `/thumbs/` prefix. Browser-side keeps the original small; the
// extension fans it out into the sizes the UI actually needs.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

/**
 * Resizes and recompresses an image File / Blob in the browser.
 *
 * @param   {File|Blob} file                    - The picked image file.
 * @param   {Object}    [opts]
 * @param   {number}    [opts.maxDimension=512] - Longest side after resize, in px.
 *                                                The shorter side scales proportionally.
 * @param   {number}    [opts.quality=0.92]     - 0–1, used for JPEG / WebP output.
 *                                                Ignored for PNG (lossless).
 * @param   {string}    [opts.type='image/png'] - MIME type for the output blob.
 *                                                Use 'image/png' to keep transparency,
 *                                                'image/jpeg' for photos without alpha.
 * @returns {Promise<{ blob: Blob, width: number, height: number, sizeBefore: number, sizeAfter: number }>}
 */
export async function optimizeImage(file, opts = {}) {

  const maxDimension = opts.maxDimension ?? 512
  const quality      = opts.quality      ?? 0.92
  const outType      = opts.type         ?? 'image/png'

  const sizeBefore = file.size

  // Decode the file into a bitmap. createImageBitmap is faster + uses
  // less memory than the legacy <img> + canvas dance.
  const bitmap = await createImageBitmap(file)

  // Compute scale. Never upscale — if the source is already smaller than
  // maxDimension, keep it at native size.
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale   = Math.min(1, maxDimension / longest)
  const width   = Math.round(bitmap.width  * scale)
  const height  = Math.round(bitmap.height * scale)

  // Use OffscreenCanvas if available (Chrome / Firefox); fall back to a
  // regular <canvas> element on Safari < 16.4.
  let canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height)
  } else {
    canvas        = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Browser does not support a 2D canvas context.')
  }
  // Enable smoothing for downscale quality; let the browser pick the
  // best resample algorithm.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)

  // Encode. OffscreenCanvas has convertToBlob (returns a Promise);
  // legacy canvas has toBlob (callback-based).
  let blob
  if (typeof canvas.convertToBlob === 'function') {
    blob = await canvas.convertToBlob({ type: outType, quality })
  } else {
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null.'))),
        outType,
        quality
      )
    })
  }

  // Free the decoded bitmap. Big files leak memory otherwise.
  if (typeof bitmap.close === 'function') {
    bitmap.close()
  }

  return {
    blob,
    width,
    height,
    sizeBefore,
    sizeAfter: blob.size
  }
}

/**
 * Convenience: format a byte count as a human-readable string.
 *
 * @param   {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
