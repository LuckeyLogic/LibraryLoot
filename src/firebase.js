// src/firebase.js
//
// Firebase initialization for Library Loot.
//
// This is a PLACEHOLDER for ITEM 0. The real Firebase Web App config is wired
// in during ITEM 1, after the Firebase project is initialized and the Web App
// is registered. The placeholder lets ITEM 0 build cleanly without exposing
// the real keys to the public repo before they're ready.
//
// Web App config keys are NOT secrets — they're scoped by Firestore /
// Storage Security Rules + your authorized domains. Service-account JSONs,
// Function admin credentials, and OAuth client secrets ARE secrets and live
// in Firebase Secret Manager / GitHub Actions secrets, NEVER in source.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { initializeApp } from 'firebase/app'
import { getAuth }       from 'firebase/auth'
import { getFirestore }  from 'firebase/firestore'
import { getStorage }    from 'firebase/storage'
import { getFunctions }  from 'firebase/functions'

/**
 * Firebase Web App config — REPLACE in ITEM 1 with the real values from the
 * Firebase Console (Project Settings → Your apps → Web app → Firebase SDK
 * snippet → Config).
 */
const firebaseConfig = {
  apiKey           : 'PLACEHOLDER_API_KEY',
  authDomain       : 'PLACEHOLDER.firebaseapp.com',
  projectId        : 'library-loot',
  storageBucket    : 'PLACEHOLDER.appspot.com',
  messagingSenderId: 'PLACEHOLDER_SENDER_ID',
  appId            : 'PLACEHOLDER_APP_ID'
}

const app = initializeApp(firebaseConfig)

export const auth      = getAuth(app)
export const db        = getFirestore(app)
export const storage   = getStorage(app)
export const functions = getFunctions(app)

export default app
