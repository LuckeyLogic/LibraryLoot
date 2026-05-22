/**
 * First-admin claim page. Any signed-in user can visit this — they paste their
 * one-time setup token and the `claimSetupToken` Cloud Function verifies it and
 * grants admin custom claims for the bound tenant. Wrapped by PrivateRoute, so
 * unauthenticated visitors get bounced to /login with `from = /admin/setup`.
 * They land back here after sign-in. If the signed-in user is ALREADY an admin
 * of some tenant, the page short-circuits to a "you're already in" view instead
 * of showing the token form.
 * @module pages/AdminSetup
 */
// src/pages/AdminSetup.jsx
//
// First-admin claim page. Any signed-in user can visit this — they paste
// their one-time setup token and the `claimSetupToken` Cloud Function
// verifies it and grants admin custom claims for the bound tenant.
//
// Wrapped by PrivateRoute, so unauthenticated visitors get bounced to
// /login with `from = /admin/setup`. They land back here after sign-in.
//
// If the signed-in user is ALREADY an admin of some tenant, the page
// short-circuits to a "you're already in" view instead of showing the
// token form.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState }   from 'react'
import { Link, useNavigate }            from 'react-router-dom'
import { httpsCallable }                from 'firebase/functions'

import { useAuth }                      from '../context/AuthContext.jsx'

import { functions }                    from '../firebase'

import styles                           from './Auth.module.css'

/**
 * Maps Cloud Functions HttpsError codes to readable form errors.
 *
 * @param   {Error}   err
 * @returns {string}
 */
function readableCallableError(err) {

  const code    = err && err.code    ? err.code    : ''
  const message = err && err.message ? err.message : 'Something went wrong.'

  switch (code) {
    case 'functions/unauthenticated':
      return 'You need to sign in before claiming a setup token.'
    case 'functions/invalid-argument':
      return message
    case 'functions/not-found':
      return 'That setup token isn\'t recognized. Double-check that you copied it exactly.'
    case 'functions/failed-precondition':
      return message
    case 'functions/permission-denied':
      return 'You don\'t have permission to do that.'
    case 'functions/internal':
      return 'Something went wrong on our end. Try again in a moment.'
    default:
      return message
  }
}

/**
 * AdminSetup — paste-your-setup-token page used to bootstrap the first
 * admin of a tenant. Calls `claimSetupToken` Cloud Function.
 *
 * @returns {JSX.Element}
 */
export default function AdminSetup() {

  const { user, isAdmin, tenantClaim } = useAuth()
  const navigate                       = useNavigate()

  const [token,      setToken]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [success,    setSuccess]    = useState(null)

  // After a successful claim, navigate home (admin dashboard lands later).
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => navigate('/', { replace: true }), 1800)
    return () => clearTimeout(timer)
  }, [success, navigate])

  // ── Already-an-admin short circuit ──
  if (user && isAdmin) {
    return (
      <section className={styles.authWrap}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>You&apos;re already an admin</h1>
          <p className={styles.subtitle}>
            You have admin permissions on the tenant
            {' '}<strong>{tenantClaim || 'unknown'}</strong>. There&apos;s
            nothing to do here.
          </p>
          <Link to="/" className={`btn btn-primary ${styles.submit}`}>
            Back to home
          </Link>
        </div>
      </section>
    )
  }

  const handleClaim = async (event) => {
    event.preventDefault()
    setLocalError(null)
    setSuccess(null)

    const trimmed = token.trim()
    if (!trimmed) {
      setLocalError('Please paste your setup token.')
      return
    }

    setSubmitting(true)
    try {
      const claim  = httpsCallable(functions, 'claimSetupToken')
      const result = await claim({ token: trimmed })

      // Force-refresh the ID token so the new admin/tenant custom claims
      // arrive in the AuthContext immediately. onAuthStateChanged refires
      // when the token rotates, which our context handler re-reads claims.
      if (user) {
        await user.getIdToken(true)
      }

      const data = result && result.data ? result.data : {}
      setSuccess(
        data.message ||
        `Admin role granted${data.tenant ? ` on tenant ${data.tenant}` : ''}. Redirecting…`
      )
    } catch (e) {
      setLocalError(readableCallableError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.authWrap}>
      <div className={styles.card}>

        <p className={styles.eyebrow}>First-admin setup</p>
        <h1 className={styles.title}>Claim admin access</h1>
        <p className={styles.subtitle}>
          Paste the one-time setup token you were given. It binds your signed-in
          account to the tenant the token was issued for and grants admin
          permissions. Tokens are single-use and expire after 30 days.
        </p>

        <form className={styles.form} onSubmit={handleClaim}>

          <div className={styles.field}>
            <label htmlFor="admin-token" className={styles.label}>Setup token</label>
            <input
              id          ="admin-token"
              type        ="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck  ={false}
              value       ={token}
              onChange    ={(e) => setToken(e.target.value)}
              className   ={styles.input}
              placeholder ="64-character hex"
              disabled    ={submitting || Boolean(success)}
              required
            />
          </div>

          <button
            type      ="submit"
            className ={`btn btn-primary ${styles.submit}`}
            disabled  ={submitting || Boolean(success)}
          >
            {submitting ? 'Claiming…' : 'Claim admin role'}
          </button>
        </form>

        {success ? (
          <div
            className={styles.error}
            role     ="status"
            style    ={{ background: 'rgba(76, 201, 240, 0.12)', borderColor: 'var(--electric-blue)' }}
          >
            {success}
          </div>
        ) : null}

        {localError ? (
          <div className={styles.error} role="alert">{localError}</div>
        ) : null}

        <p className={styles.foot}>
          Don&apos;t have a token? <Link to="/">Back to home</Link> — tokens are
          issued by the existing operator of this Library Loot instance.
        </p>

      </div>
    </section>
  )
}
