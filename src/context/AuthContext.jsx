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

import { auth }                    from '../firebase'

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
          // claims (set by Cloud Functions when ITEM 2b lands).
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
