/**
 * Firebase initialization for Library Loot. Web App config keys are NOT secrets
 * — they're scoped by Firestore / Storage Security Rules + Firebase Authorized
 * Domains. Service-account JSONs, Function admin credentials, and OAuth client
 * secrets ARE secrets and live in Firebase Secret Manager / GitHub Actions
 * secrets, NEVER in source. `measurementId` is included for reference but
 * Firebase Analytics is NOT initialized here by default — our Privacy Policy
 * disallows analytics on pages a child interacts…
 * @module firebase
 */
// src/firebase.js
//
// Firebase initialization for Library Loot.
//
// Web App config keys are NOT secrets — they're scoped by Firestore /
// Storage Security Rules + Firebase Authorized Domains. Service-account
// JSONs, Function admin credentials, and OAuth client secrets ARE secrets
// and live in Firebase Secret Manager / GitHub Actions secrets, NEVER in
// source.
//
// `measurementId` is included for reference but Firebase Analytics is NOT
// initialized here by default — our Privacy Policy disallows analytics on
// pages a child interacts with. If we ever wire analytics, do it
// conditionally and only on adult-only routes.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { initializeApp } from 'firebase/app'
import { getAuth }       from 'firebase/auth'
import { getFirestore }  from 'firebase/firestore'
import { getStorage }    from 'firebase/storage'
import { getFunctions }  from 'firebase/functions'

import { initAppCheck }  from './firebase/appCheck.js'

/**
 * Firebase Web App config — live values from the Firebase Console
 * (Project Settings → Your apps → Web app → Firebase SDK snippet).
 */
const firebaseConfig = {
  apiKey           : 'AIzaSyDXQ31-RxUJi3xalom0AJIbdCZvpSBwi0E',
  authDomain       : 'library-loot.firebaseapp.com',
  projectId        : 'library-loot',
  storageBucket    : 'library-loot.firebasestorage.app',
  messagingSenderId: '924711260253',
  appId            : '1:924711260253:web:22c570b25026cf310fbdb4',
  measurementId    : 'G-YHLFHW0JRD'
}

const app = initializeApp(firebaseConfig)

// App Check MUST be initialized AFTER `initializeApp` and BEFORE the
// service getters below. Reason: each service getter provisions a
// network client bound to the app's current App Check state. If App
// Check is set up later, the service clients stay App-Check-less for
// the lifetime of the page and never attach tokens to requests.
// `initAppCheck` lives in ./firebase/appCheck.js as a pure function
// (no top-level side effects, no import from this file) so we can call
// it from here without a circular dep.
export const appCheck  = initAppCheck(app)

export const auth      = getAuth(app)
export const db        = getFirestore(app)
export const storage   = getStorage(app)
export const functions = getFunctions(app)

export default app
