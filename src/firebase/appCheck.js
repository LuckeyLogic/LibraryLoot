/**
 * Firebase App Check initialization for Library Loot. App Check verifies that
 * requests coming into Firebase services (Firestore, Storage, Cloud Functions,
 * AI Logic) originate from THIS app — not from a malicious script scraping our
 * public Web App config keys and hitting Firebase directly. We use reCAPTCHA
 * Enterprise as the attestation provider; the SDK obtains a token transparently
 * on each service call. Production
 * ───────────────────────────────────────────────────────────────────── The
 * reCAPTCHA…
 * @module firebase/appCheck
 */
// src/firebase/appCheck.js
//
// Firebase App Check initialization for Library Loot.
//
// App Check verifies that requests coming into Firebase services
// (Firestore, Storage, Cloud Functions, AI Logic) originate from THIS
// app — not from a malicious script scraping our public Web App config
// keys and hitting Firebase directly. We use reCAPTCHA Enterprise as the
// attestation provider; the SDK obtains a token transparently on each
// service call.
//
// Production
// ─────────────────────────────────────────────────────────────────────
//   The reCAPTCHA Enterprise site key is a PUBLIC identifier (not a
//   secret) and lives in source. The matching "secret" half lives on
//   Firebase's servers — registered in Firebase Console → App Check →
//   Apps. We never see or store it client-side.
//
// Development (localhost)
// ─────────────────────────────────────────────────────────────────────
//   reCAPTCHA Enterprise can't run a real challenge against localhost,
//   so we set `self.FIREBASE_APPCHECK_DEBUG_TOKEN` to a per-machine
//   UUID issued in Firebase Console → App Check → Apps → ⋮ → Manage
//   debug tokens. The SDK detects this global, treats requests from this
//   machine as trusted, and skips the real attestation. The token comes
//   from .env.local (gitignored) — production never reads it.
//
// Init-order constraint
// ─────────────────────────────────────────────────────────────────────
//   App Check MUST be initialized AFTER `initializeApp(...)` returns the
//   `FirebaseApp` instance, but BEFORE `getAuth() / getFirestore() /
//   getStorage() / getFunctions() / getAI()` are called. Reason: each
//   service getter provisions a network client bound to the app's
//   current App Check state. If a service client is created before App
//   Check is wired up, it stays App-Check-less for the lifetime of the
//   page — even if App Check is initialized later, the service won't
//   start sending tokens. Symptoms: 100% of requests show as "outdated
//   client / missing token" in the App Check console.
//
//   To keep this constraint enforceable from one site, we export a
//   `initAppCheck(app)` function (no top-level side effects, no import
//   of `app` from `../firebase.js` — that would create a circular dep)
//   and call it explicitly from `src/firebase.js` between
//   `initializeApp` and the service getters.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'firebase/app-check'

const RECAPTCHA_SITE_KEY = '6LeSUPAsAAAAAPotOzNECOIVpXsxgDtj7hvYNsGl'

/**
 * Initialize Firebase App Check on the given FirebaseApp.
 *
 * Caller MUST invoke this AFTER `initializeApp(...)` and BEFORE the
 * service getters (`getAuth`, `getFirestore`, etc.) — otherwise the
 * provisioned services won't attach App Check tokens to their network
 * requests.
 *
 * In dev (`import.meta.env.DEV`), reads
 * `VITE_APPCHECK_DEBUG_TOKEN` from `.env.local` and sets the global
 * Firebase looks for to use a registered debug token instead of running
 * a real reCAPTCHA challenge against localhost. Production never reads
 * the env var.
 *
 * @param {Object} app      The `FirebaseApp` returned by `initializeApp(...)`.
 *                          (Canonical type: `import('firebase/app').FirebaseApp`,
 *                          but we don't reference it that way in JSDoc — JSDoc 4
 *                          in CI rejects `import('...').Type` syntax.)
 * @returns {Object}        The initialized `AppCheck` instance
 *                          (`import('firebase/app-check').AppCheck`).
 */
export function initAppCheck(app) {

  if (import.meta.env.DEV) {
    const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
    if (debugToken) {
      // The Firebase SDK reads this exact global name (`self` is `window`
      // in a browser page context) when initializing App Check. Setting
      // it BEFORE `initializeAppCheck` runs is what flips the SDK into
      // debug mode for this session.
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken
    } else {
      // Helpful nudge — if you forgot to set the env var, dev calls will
      // fail with cryptic 401s from Firebase. Catch it here instead.
      // eslint-disable-next-line no-console
      console.warn(
        '[appCheck] DEV mode but VITE_APPCHECK_DEBUG_TOKEN is unset. ' +
        'Firebase calls will fail with App Check errors. ' +
        'Add the token to .env.local and restart vite.'
      )
    }
  }

  return initializeAppCheck(app, {
    provider                : new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  })
}
