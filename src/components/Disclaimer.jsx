// src/components/Disclaimer.jsx
//
// Reusable inline disclaimer block. Use this anywhere on a page that
// references Fortnite or V-Bucks prominently, in addition to the always-on
// footer disclaimer.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React           from 'react'

import siteContent     from '../data/siteContent.js'

import styles          from './Disclaimer.module.css'

/**
 * Disclaimer — inline Epic Games trademark disclaimer block.
 *
 * @param   {Object}  props
 * @param   {string}  [props.tone='soft']  - Visual emphasis. 'soft' (default) for in-page placement, 'prominent' for the About / Terms pages where the disclaimer is part of the story. (Optional)
 * @returns {JSX.Element}
 */
export default function Disclaimer({ tone = 'soft' }) {

  const className = `${styles.disclaimer} ${tone === 'prominent' ? styles.prominent : styles.soft}`

  return (
    <aside className={className} aria-label="Legal disclaimer">
      <p className={styles.text}>{siteContent.legal.epicGamesDisclaimer}</p>
    </aside>
  )
}
