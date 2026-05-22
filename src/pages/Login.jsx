/**
 * Sign-in page. Google one-tap OR email/password. On success, navigates back to
 * the page the user was trying to reach (location.state.from) or to the home
 * page.
 * @module pages/Login
 */
// src/pages/Login.jsx
//
// Sign-in page. Google one-tap OR email/password. On success, navigates
// back to the page the user was trying to reach (location.state.from) or
// to the home page.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState }   from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth }                      from '../context/AuthContext.jsx'

import styles                           from './Auth.module.css'

/**
 * Login — Google + Email/Password sign-in page.
 *
 * @returns {JSX.Element}
 */
export default function Login() {

  const { user, signInWithGoogle, signInWithEmail, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)

  // Where to bounce after a successful sign-in.
  const redirectTo = (location.state && location.state.from && location.state.from.pathname) || '/'

  // Clear any context-level error when this page mounts.
  useEffect(() => {
    clearError()
  }, [clearError])

  // If already signed in, skip the form entirely.
  useEffect(() => {
    if (user) {
      navigate(redirectTo, { replace: true })
    }
  }, [user, navigate, redirectTo])

  const handleGoogle = async () => {
    setLocalError(null)
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
    if (!email || !password) {
      setLocalError('Please enter both your email and password.')
      return
    }
    setSubmitting(true)
    try {
      await signInWithEmail(email.trim(), password)
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.authWrap}>
      <div className={styles.card}>

        <p className={styles.eyebrow}>Welcome back</p>
        <h1 className={styles.title}>Sign in to Library Loot</h1>
        <p className={styles.subtitle}>
          Parent and librarian accounts only. Kids participate through their
          parent&apos;s account.
        </p>

        <button
          type      ="button"
          className ={styles.googleBtn}
          onClick   ={handleGoogle}
          disabled  ={submitting}
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        <div className={styles.divider}>or</div>

        <form className={styles.form} onSubmit={handleEmail}>

          <div className={styles.field}>
            <label htmlFor="login-email" className={styles.label}>Email</label>
            <input
              id        ="login-email"
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
            <label htmlFor="login-password" className={styles.label}>Password</label>
            <input
              id        ="login-password"
              type      ="password"
              autoComplete="current-password"
              value     ={password}
              onChange  ={(e) => setPassword(e.target.value)}
              className ={styles.input}
              disabled  ={submitting}
              required
            />
          </div>

          <button
            type      ="submit"
            className ={`btn btn-primary ${styles.submit}`}
            disabled  ={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {localError ? (
          <div className={styles.error} role="alert">{localError}</div>
        ) : null}

        <p className={styles.foot}>
          New here? <Link to="/signup">Create an account</Link>
        </p>

      </div>
    </section>
  )
}

/**
 * GoogleGlyph — inline SVG of the multicolor Google "G" mark for the
 * Continue-with-Google button. Avoids loading a bitmap or relying on a CDN.
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
