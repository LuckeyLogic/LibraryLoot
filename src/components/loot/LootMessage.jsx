// src/components/loot/LootMessage.jsx
//
// A single message bubble in the LOOT chat. User messages right-aligned
// on a purple gradient; LOOT messages left-aligned on the night
// surface. `pending=true` swaps the text for an animated "thinking"
// indicator that the panel renders while waiting on Gemini.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React  from 'react'

import styles from './LootMessage.module.css'

/**
 * LootMessage — one chat bubble.
 *
 * @param {Object}  props
 * @param {string}  props.role     - 'user' or 'model'.
 * @param {string}  props.text     - The message body.
 * @param {boolean} [props.pending] - (Optional) Show animated dots instead of text.
 * @returns {JSX.Element}
 */
export default function LootMessage({ role, text, pending = false }) {

  const isUser = role === 'user'

  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowModel}`}>
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleModel}`}>
        {pending ? (
          <span className={styles.thinking} aria-label="LOOT is thinking">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
        ) : (
          // Preserve newlines without dragging in a markdown lib for 9b —
          // ITEM 9c can swap this for a proper renderer if we want code
          // blocks / links in LOOT replies.
          <p className={styles.text}>{text}</p>
        )}
      </div>
    </div>
  )
}
