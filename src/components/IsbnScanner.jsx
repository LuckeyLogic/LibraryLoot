// src/components/IsbnScanner.jsx
//
// Camera-based barcode scanner that resolves a book's ISBN. Powered by
// @zxing/browser, which wraps getUserMedia + the ZXing format readers.
//
// Behavior:
//   - Mounts as a full-screen overlay with a video viewfinder.
//   - Prefers the rear-facing camera on mobile (`facingMode: environment`).
//   - On scan: validates the value against utils/isbn (EAN-13 barcodes
//     ARE ISBN-13s when starting with 978 or 979). Rejects non-book
//     barcodes silently so the user can keep scanning.
//   - On match: fires `onScan(isbn13)` with the canonical ISBN-13
//     digits and stops the camera.
//   - On cancel / Escape / unmount: stops the camera cleanly.
//
// Permissions:
//   - First open prompts the browser for camera access. If denied, an
//     in-overlay help block explains how to enable in browser settings
//     and offers a "Type it instead" fallback.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader }            from '@zxing/browser'

import useLockBodyScroll                        from '../hooks/useLockBodyScroll.js'

import { isValidIsbn, normalizeIsbn }          from '../utils/isbn.js'

import styles                                  from './IsbnScanner.module.css'

/**
 * IsbnScanner — full-screen camera overlay that resolves an ISBN
 * barcode and fires `onScan(isbn13)` once.
 *
 * @param   {Object}   props
 * @param   {Function} props.onScan    - Called with a normalized ISBN-13 digit string.
 * @param   {Function} props.onClose   - Called when the user dismisses the scanner.
 * @returns {JSX.Element}
 */
export default function IsbnScanner({ onScan, onClose }) {

  const videoRef        = useRef(null)
  const readerRef       = useRef(null)
  const controlsRef     = useRef(null)
  const cancelledRef    = useRef(false)

  const [status,    setStatus]    = useState('starting')   // 'starting' | 'scanning' | 'found' | 'denied' | 'error'
  const [statusMsg, setStatusMsg] = useState('Starting camera…')
  const [lastSeen,  setLastSeen]  = useState(null)         // shown when a barcode was scanned but rejected as non-ISBN

  // Lock background page scroll while the camera overlay is up so a stray
  // swipe doesn't scroll the admin page behind the viewfinder.
  useLockBodyScroll()

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Initialize the scanner once on mount; tear it down on unmount.
  useEffect(() => {
    cancelledRef.current = false
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width     : { ideal: 1280 },
        height    : { ideal: 720 }
      }
    }

    ;(async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, _err, ctrls) => {
            if (cancelledRef.current) return
            if (!result) return

            const text   = result.getText()
            const isbn13 = normalizeIsbn(text)
            if (isbn13 && isValidIsbn(text)) {
              // Got an ISBN. Stop and notify.
              ctrls.stop()
              cancelledRef.current = true
              setStatus('found')
              setStatusMsg(`Found ISBN ${isbn13}`)
              if (onScan) onScan(isbn13)
            } else {
              // Some other barcode (UPC for a non-book, etc.) — show
              // the text briefly and keep scanning.
              setLastSeen(text)
            }
          }
        )
        controlsRef.current = controls
        if (cancelledRef.current) {
          controls.stop()
          return
        }
        setStatus('scanning')
        setStatusMsg('Point the camera at the barcode on the back of the book.')
      } catch (err) {
        // NotAllowedError → camera permission was denied
        // NotFoundError   → no camera available on this device
        const denied =
          err && (err.name === 'NotAllowedError' || /permission/i.test(err.message || ''))
        const noCam =
          err && (err.name === 'NotFoundError' || /no devices|no camera/i.test(err.message || ''))

        setStatus(denied ? 'denied' : (noCam ? 'no-camera' : 'error'))
        setStatusMsg(
          denied ? 'Camera access was denied.' :
          noCam  ? 'No camera found on this device.' :
                   (err && err.message ? err.message : 'Couldn\'t open the camera.')
        )
      }
    })()

    return () => {
      cancelledRef.current = true
      if (controlsRef.current) {
        try { controlsRef.current.stop() } catch (_) { /* noop */ }
        controlsRef.current = null
      }
      readerRef.current = null
    }
  }, [onScan])

  return (
    <div
      className ={styles.overlay}
      role      ="dialog"
      aria-modal="true"
      aria-label="Scan an ISBN barcode"
      onClick   ={(e) => {
        // Clicks on the dark margin (not on the inner panel) close the
        // overlay, mirroring the avatar lightbox behavior.
        if (e.target === e.currentTarget) onClose && onClose()
      }}
    >
      <button
        type      ="button"
        className ={styles.close}
        onClick   ={() => onClose && onClose()}
        aria-label="Close scanner"
      >
        ×
      </button>

      <div className={styles.inner}>

        <div className={styles.videoWrap}>
          {/* video must be muted + playsInline to autoplay on mobile Safari */}
          <video
            ref       ={videoRef}
            className ={styles.video}
            autoPlay
            muted
            playsInline
          />
          <div className={styles.guide} aria-hidden="true">
            <div className={styles.guideCorner + ' ' + styles.tl} />
            <div className={styles.guideCorner + ' ' + styles.tr} />
            <div className={styles.guideCorner + ' ' + styles.bl} />
            <div className={styles.guideCorner + ' ' + styles.br} />
          </div>
        </div>

        <p className={styles.status} aria-live="polite">
          {statusMsg}
        </p>

        {lastSeen && status === 'scanning' ? (
          <p className={styles.lastSeen}>
            Saw barcode <code>{lastSeen}</code> — not an ISBN. Try the barcode on
            the back cover near the publisher info.
          </p>
        ) : null}

        {status === 'denied' ? (
          <div className={styles.help}>
            <p>
              <strong>Allow camera access</strong> in your browser settings (click
              the camera icon next to the address bar) and reload. Or just type
              the ISBN by hand:
            </p>
            <button
              type      ="button"
              className ="btn btn-primary"
              onClick   ={() => onClose && onClose()}
            >
              Type it instead
            </button>
          </div>
        ) : null}

        {status === 'no-camera' || status === 'error' ? (
          <div className={styles.help}>
            <p>{statusMsg}</p>
            <button
              type      ="button"
              className ="btn btn-primary"
              onClick   ={() => onClose && onClose()}
            >
              Type it instead
            </button>
          </div>
        ) : null}

      </div>
    </div>
  )
}
