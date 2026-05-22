/**
 * Account creation page. Google sign-in OR email/password signup. Requires the
 * user to self-attest they are 18+ and to accept the Privacy Policy + Terms of
 * Service before submit is enabled. Account creation = adult account. Children
 * participate through this account as sub-profiles created from the parent
 * dashboard (ITEM 2d).
 * @module pages/Signup
 */
// src/pages/Signup.jsx
//
// Account creation page. Google sign-in OR email/password signup. Requires
// the user to self-attest they are 18+ and to accept the Privacy Policy +
// Terms of Service before submit is enabled.
//
// Account creation = adult account. Children participate through this
// account as sub-profiles created from the parent dashboard (ITEM 2d).
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState }   from 'react'
import { Link, useNavigate }            from 'react-router-dom'

import { useAuth }                      from '../context/AuthContext.jsx'

import styles                           from './Auth.module.css'

/**
 * Signup — Google + Email/Password account creation with 18+ self-attestation
 * and Privacy Policy / Terms acceptance.
 *
 * @returns {JSX.Element}
 */
export default function Signup() {

  const { user, signInWithGoogle, signUpWithEmail, clearError } = useAuth()
  const navigate = useNavigate()

  const [displayName,     setDisplayName]     = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [confirmAdult,    setConfirmAdult]    = useState(false)
  const [confirmTerms,    setConfirmTerms]    = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [localError,      setLocalError]      = useState(null)

  // Clear context error on mount.
  useEffect(() => {
    clearError()
  }, [clearError])

  // If already signed in, skip the form.
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  // Submit is enabled only when both consent checkboxes are ticked and the
  // required form fields look filled in. Google flow has the same gate.
  const consentReady    = confirmAdult && confirmTerms
  const emailFormReady  =
    displayName.trim() &&
    email.trim()       &&
    password           &&
    password === passwordConfirm &&
    consentReady

  const handleGoogle = async () => {
    setLocalError(null)
    if (!consentReady) {
      setLocalError('Please confirm you are 18 or older and accept the policies before continuing.')
      return
    }
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEmail = async (event) => {
    event.preventDefault()
    setLocalError(null)

    if (!consentReady) {
      setLocalError('Please confirm you are 18 or older and accept the policies before continuing.')
      return
    }
    if (password !== passwordConfirm) {
      setLocalError('Passwords don\'t match. Please re-type them.')
      return
    }
    if (password.length < 6) {
      setLocalError('Use a password of at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      await signUpWithEmail(email.trim(), password, displayName.trim())
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.authWrap}>
      <div className={styles.card}>

        <p className={styles.eyebrow}>Create an account</p>
        <h1 className={styles.title}>Join Library Loot</h1>
        <p className={styles.subtitle}>
          Parents and librarians only. You&apos;ll add your child(ren) as
          sub-profiles after signing in.
        </p>

        <div className={styles.checkRow} style={{ marginBottom: '0.75rem' }}>
          <input
            id      ="signup-adult"
            type    ="checkbox"
            checked ={confirmAdult}
            onChange={(e) => setConfirmAdult(e.target.checked)}
            disabled={submitting}
          />
          <label htmlFor="signup-adult">
            I confirm I am 18 years of age or older and authorized to create this account.
          </label>
        </div>

        <div className={styles.checkRow} style={{ marginBottom: '1.25rem' }}>
          <input
            id      ="signup-terms"
            type    ="checkbox"
            checked ={confirmTerms}
            onChange={(e) => setConfirmTerms(e.target.checked)}
            disabled={submitting}
          />
          <label htmlFor="signup-terms">
            I have read and accept the
            {' '}<Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>
            {' '}and
            {' '}<Link to="/terms" target="_blank" rel="noreferrer">Terms of Service</Link>.
          </label>
        </div>

        <button
          type      ="button"
          className ={styles.googleBtn}
          onClick   ={handleGoogle}
          disabled  ={submitting || !consentReady}
          title     ={!consentReady ? 'Confirm 18+ and accept the policies first.' : ''}
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        <div className={styles.divider}>or</div>

        <form className={styles.form} onSubmit={handleEmail}>

          <div className={styles.field}>
            <label htmlFor="signup-name" className={styles.label}>Your name</label>
            <input
              id        ="signup-name"
              type      ="text"
              autoComplete="name"
              value     ={displayName}
              onChange  ={(e) => setDisplayName(e.target.value)}
              className ={styles.input}
              disabled  ={submitting}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="signup-email" className={styles.label}>Email</label>
            <input
              id        ="signup-email"
              type      ="email"
              autoComplete="email"
              value     ={email}
              onChange  ={(e) => setEmail(e.target.value)}
              className ={styles.input}
              disabled  ={submitting}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="signup-pw" className={styles.label}>Password</label>
            <input
              id        ="signup-pw"
              type      ="password"
              autoComplete="new-password"
              value     ={password}
              onChange  ={(e) => setPassword(e.target.value)}
              className ={styles.input}
              disabled  ={submitting}
              minLength ={6}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="signup-pw2" className={styles.label}>Confirm password</label>
            <input
              id        ="signup-pw2"
              type      ="password"
              autoComplete="new-password"
              value     ={passwordConfirm}
              onChange  ={(e) => setPasswordConfirm(e.target.value)}
              className ={styles.input}
              disabled  ={submitting}
              minLength ={6}
              required
            />
          </div>

          <button
            type      ="submit"
            className ={`btn btn-primary ${styles.submit}`}
            disabled  ={submitting || !emailFormReady}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {localError ? (
          <div className={styles.error} role="alert">{localError}</div>
        ) : null}

        <p className={styles.foot}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

      </div>
    </section>
  )
}

/**
 * GoogleGlyph — inline multicolor Google "G" mark for the Continue-with-Google
 * button. Duplicated from Login for now; if a third surface needs it, extract.
 * @returns {JSX.Element}
 */
function GoogleGlyph() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
