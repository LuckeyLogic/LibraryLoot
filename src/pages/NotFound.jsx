/**
 * 404 page.
 * @module pages/NotFound
 */
// src/pages/NotFound.jsx
//
// 404 page.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import styles             from './NotFound.module.css'

/**
 * NotFound — 404 fallback route.
 *
 * @returns {JSX.Element}
 */
export default function NotFound() {
  return (
    <section className={`container ${styles.wrap}`}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>That page is in another dimension.</h1>
      <p className={styles.body}>
        The page you&apos;re looking for didn&apos;t drop. Let&apos;s get you back
        to base.
      </p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </section>
  )
}
