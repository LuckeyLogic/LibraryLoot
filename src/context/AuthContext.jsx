// src/context/AuthContext.jsx
//
// Auth state + sign-in / sign-up methods for Library Loot.
//
// Wraps Firebase Auth. Exposes the current user, the parsed ID token claims
// (`admin` and `tenant` — populated by Cloud Functions in ITEM 2b), and
// helpers for Google and Email/Password sign-in. All components that need
// auth state read it via the `useAuth()` hook below.
//
// Note on claims: in ITEM 2a no Cloud Function has set claims yet, so
// `claims` will only contain Firebase's built-in claims (uid, email, etc.).
// In ITEM 2b, `claimSetupToken` sets `{ admin: true, tenant: 'luckey-logic' }`
// on the calling user. Consumers should treat missing claims as
// "regular signed-in parent user."
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
}                                  from 'react'

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile
}                                  from 'firebase/auth'

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
}                                  from 'firebase/firestore'

import { httpsCallable }            from 'firebase/functions'

import LastModified                 from '../model/LastModified.js'

import { auth, db, functions }      from '../firebase'

// How stale `lastSeenAt` can get before we re-write it. Without this
// floor, every token refresh (every hour, give or take) would write a
// fresh timestamp even when nothing else changed. With it, we cap user-
// doc writes to roughly once every 5 minutes per active session.
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000

const AuthContext = createContext(null)

/**
 * Normalizes Firebase Auth error codes into short, human-friendly strings.
 *
 * @param   {Error}  err  - Firebase Auth error (or any thrown value).
 * @returns {string}      - One-line message for display next to a form.
 */
function readableAuthError(err) {

  const code = err && err.code ? err.code : ''

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.'
    case 'auth/invalid-email':
      return 'That email address doesn\'t look right.'
    case 'auth/weak-password':
      return 'Password is too short — use at least 6 characters.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email and password don\'t match.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Please allow popups for this site.'
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    default:
      return err && err.message ? err.message : 'Sign-in failed. Please try again.'
  }
}

/**
 * AuthProvider — wraps the app and provides auth state via React Context.
 * Mount this once near the top of the tree, inside the Router.
 *
 * @param   {Object}      props
 * @param   {JSX.Element} props.children
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {

  const [user,    setUser]    = useState(null)
  const [claims,  setClaims]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── AUTH STATE SUBSCRIPTION ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // forceRefresh = true so we always pick up the latest custom
          // claims (set by Cloud Functions in ITEM 2b / 2c).
          const tokenResult = await fbUser.getIdTokenResult(true)
          setUser(fbUser)
          setClaims(tokenResult.claims)
        } catch (e) {
          setUser(fbUser)
          setClaims(null)
        }
      } else {
        setUser(null)
        setClaims(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // ── TENANT CLAIM AUTO-BOOTSTRAP ──
  // If a signed-in user is missing the tenant claim, call the
  // `bootstrapTenantClaim` Cloud Function to set it + create their
  // parent user doc. Idempotent server-side, so multiple-callers /
  // tab-races are safe. Runs at most once per user per browser session.
  useEffect(() => {
    if (loading)              return
    if (!user)                return
    if (claims && claims.tenant) return     // Already bootstrapped.

    let cancelled = false
    ;(async () => {
      try {
        const bootstrap = httpsCallable(functions, 'bootstrapTenantClaim')
        await bootstrap({})
        if (cancelled) return
        // Force-refresh the ID token to pick up the newly-set claim.
        if (auth.currentUser) {
          const refreshed = await auth.currentUser.getIdTokenResult(true)
          if (cancelled) return
          setUser({ ...auth.currentUser })
          setClaims(refreshed.claims)
        }
      } catch (e) {
        // Non-fatal: the user is still signed in, just without a tenant
        // claim. Rules will deny them until the next sign-in retries.
        // Log to the browser console so the operator can spot the issue
        // — common cause is Cloud Functions still propagating after deploy.
        // eslint-disable-next-line no-console
        console.warn('bootstrapTenantClaim failed; will retry next sign-in.', e)
      }
    })()

    return () => { cancelled = true }
  }, [user, claims, loading])

  // ── AUTH-PROFILE MIRROR ──
  // Firebase Auth holds displayName / photoURL / email; admin views,
  // future LOOT conversation logs, and Cloud Functions all need access
  // to those values via the user's Firestore doc rather than going
  // through the server-side Admin SDK. This effect mirrors them into
  // `/{tenant}/_main/users/{uid}` whenever they drift out of sync.
  //
  // Two timestamp concepts on the user doc (different semantics):
  //   - lastSeenAt:  bumped on every sign-in or 5+ min of active session,
  //                  regardless of whether anything changed. Activity
  //                  signal. Useful for "purge inactive users" etc.
  //   - lastModified: a LastModified object (byName/byUUID/date/state).
  //                   Bumped ONLY when fields actually change. Each prior
  //                   value is archived to /lastModifieds/{id} subcollection
  //                   in the same batched write — permanent audit trail.
  //
  // Gated on bootstrap success (`claims.tenant` set) so we never try to
  // write into a doc that bootstrapTenantClaim hasn't created yet.
  // Idempotent: reads the current doc, compares mirrored fields, writes
  // only if something changed (or if lastSeenAt is stale by more than
  // LAST_SEEN_REFRESH_MS). Excess re-renders cost one Firestore read.
  useEffect(() => {
    if (loading)                  return
    if (!user)                    return
    if (!claims || !claims.tenant) return

    let cancelled = false
    ;(async () => {
      try {
        const userRef = doc(
          db, claims.tenant, '_main', 'users', user.uid
        )
        const snap = await getDoc(userRef)
        if (cancelled) return
        if (!snap.exists()) {
          // Bootstrap should have created the doc — if it's missing,
          // something upstream failed. Leave a breadcrumb; do not try
          // to create the doc from the client (rules forbid that).
          // eslint-disable-next-line no-console
          console.warn('[mirror] user doc missing — bootstrap may have failed.')
          return
        }
        const current = snap.data() || {}
        const wanted = {
          displayName: user.displayName || null,
          photoURL   : user.photoURL    || null,
          email      : user.email       || null
        }
        const profileChanged = (
          current.displayName !== wanted.displayName ||
          current.photoURL    !== wanted.photoURL    ||
          current.email       !== wanted.email
        )
        const lastSeenMs = current.lastSeenAt && current.lastSeenAt.toMillis
          ? current.lastSeenAt.toMillis()
          : 0
        const lastSeenStale = (Date.now() - lastSeenMs) >= LAST_SEEN_REFRESH_MS

        if (!profileChanged && !lastSeenStale) return

        // Build the doc update. Always bump lastSeenAt (activity).
        // Only bump lastModified when fields actually changed — and
        // when we do bump it, archive the previous value to the
        // /lastModifieds subcollection in the same batch so we never
        // lose history if the main write fails.
        const batch = writeBatch(db)

        if (profileChanged) {
          const newLastModified = new LastModified({
            byName: user.displayName || user.email || '(unknown)',
            byUUID: user.uid,
            date  : serverTimestamp(),
            state : 'updated'
          }).toDict()

          // Archive the previous lastModified BEFORE we overwrite it.
          // First-ever mirror has no previous value — skip the archive.
          if (current.lastModified) {
            const archiveRef = doc(collection(userRef, 'lastModifieds'))
            batch.set(archiveRef, current.lastModified)
          }

          batch.set(userRef, {
            ...wanted,
            lastSeenAt  : serverTimestamp(),
            lastModified: newLastModified
          }, { merge: true })
        } else {
          // Activity-only refresh — don't touch lastModified.
          batch.set(userRef, {
            lastSeenAt: serverTimestamp()
          }, { merge: true })
        }

        await batch.commit()
      } catch (e) {
        // Non-fatal — auth still works without the mirror. Common
        // cause during dev: Firestore rules haven't been redeployed
        // since this code shipped (the new self-write + audit-archive
        // rules live in firestore.rules). Run
        // `firebase deploy --only firestore:rules` first.
        // eslint-disable-next-line no-console
        console.warn('[mirror] profile mirror failed (non-fatal)', e)
      }
    })()

    return () => { cancelled = true }
  }, [user, claims, loading])

  // ── SIGN-IN METHODS ──

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(auth, provider)
    } catch (e) {
      const msg = readableAuthError(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const signInWithEmail = useCallback(async (email, password) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      const msg = readableAuthError(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    setError(null)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) {
        await updateProfile(cred.user, { displayName })
        await cred.user.reload()
        // onAuthStateChanged already fired with displayName=null. updateProfile
        // does NOT re-fire the listener, so manually sync the local user state
        // to the post-update auth.currentUser. Shallow-clone so React sees a
        // new reference and rerenders consumers.
        if (auth.currentUser) {
          setUser({ ...auth.currentUser })
        }
      }
    } catch (e) {
      const msg = readableAuthError(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    try {
      await fbSignOut(auth)
    } catch (e) {
      const msg = readableAuthError(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // ── DERIVED FLAGS ──
  // `isAdmin` is true only when the Cloud Function in ITEM 2b has set the
  // admin custom claim. Until then, this is always false.
  const isAdmin     = Boolean(claims && claims.admin === true)
  const tenantClaim = claims && claims.tenant ? String(claims.tenant) : null

  const value = useMemo(() => ({
    user,
    claims,
    loading,
    error,
    isAdmin,
    tenantClaim,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    clearError
  }), [user, claims, loading, error, isAdmin, tenantClaim, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, clearError])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth — read auth state and call sign-in / sign-up / sign-out helpers.
 * Must be used inside an `<AuthProvider>`.
 *
 * @returns {Object} { user, claims, loading, error, isAdmin, tenantClaim,
 *                     signInWithGoogle, signInWithEmail, signUpWithEmail,
 *                     signOut, clearError }
 */
export function useAuth() {

  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be used inside an <AuthProvider>')
  }
  return ctx
}
