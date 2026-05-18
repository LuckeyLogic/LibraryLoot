// src/components/loot/LootButton.jsx
//
// Floating "open LOOT" button. Bottom-right on every admin page.
// Click toggles the LootPanel. State persists in sessionStorage so
// navigating between admin routes doesn't close the assistant.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState } from 'react'

import LootPanel                      from './LootPanel.jsx'

import styles                         from './LootButton.module.css'

const STORAGE_KEY = 'll_loot_open_v1'

/**
 * LootButton — floating launcher + mounts LootPanel when open.
 *
 * @returns {JSX.Element}
 */
export default function LootButton() {

  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch (e) {
      return false
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, isOpen ? '1' : '0')
    } catch (e) {
      // sessionStorage can throw in private-mode Safari — non-fatal,
      // just means open/closed state won't survive a reload.
    }
  }, [isOpen])

  const close = () => setIsOpen(false)

  return (
    <>
      <button
        type      ="button"
        className ={`${styles.fab} ${isOpen ? styles.fabHidden : ''}`}
        onClick   ={() => setIsOpen(true)}
        aria-label="Open LOOT assistant"
        title     ="Open LOOT"
      >
        <span aria-hidden="true" className={styles.glyph}>⚡</span>
        <span className={styles.label}>LOOT</span>
      </button>

      {isOpen ? <LootPanel onClose={close} /> : null}
    </>
  )
}
