// src/components/loot/LootMessage.jsx
//
// A single message bubble in the LOOT chat. User messages right-aligned
// on a purple gradient; LOOT messages left-aligned on the night
// surface. `pending=true` swaps the text for an animated "thinking"
// indicator that the panel renders while waiting on Gemini.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React                from 'react'

import { LOOT_TOOL_DISPLAY } from '../../lib/loot/lootTools.js'

import styles               from './LootMessage.module.css'

/**
 * LootMessage — one chat entry. Three roles supported:
 *
 *   - 'user'   : the librarian's message (right-aligned purple bubble)
 *   - 'model'  : LOOT's response (left-aligned night-soft bubble)
 *   - 'tool'   : a tool-call chip emitted mid-conversation (e.g. "🔍
 *                Searching for X"). Rendered as a centered pill, not a
 *                bubble, so it reads as a status note rather than a
 *                voice in the conversation.
 *
 * @param {Object}  props
 * @param {string}  props.role        - 'user' | 'model' | 'tool'.
 * @param {string}  [props.text]      - Body text (for user/model bubbles).
 * @param {string}  [props.name]      - Tool name (when role === 'tool').
 * @param {Object}  [props.args]      - Tool args (when role === 'tool'); used to format the chip label.
 * @param {boolean} [props.pending]   - Show animated dots in place of text (user/model bubbles).
 * @returns {JSX.Element}
 */
export default function LootMessage({ role, text, name, args, pending = false }) {

  // ── TOOL-CALL CHIP ───────────────────────────────────────────────
  if (role === 'tool') {
    const display = (name && LOOT_TOOL_DISPLAY[name]) || null
    const emoji   = display ? display.emoji : '⚙️'
    const label   = display ? display.label(args || {}) : (name || 'Working…')
    return (
      <div className={`${styles.row} ${styles.rowTool}`}>
        <div className={styles.toolChip}>
          <span aria-hidden="true" className={styles.toolEmoji}>{emoji}</span>
          <span className={styles.toolLabel}>{label}</span>
        </div>
      </div>
    )
  }

  // ── USER / MODEL BUBBLE ──────────────────────────────────────────
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
          // Preserve newlines without dragging in a markdown lib for 9c —
          // we can swap this for a proper renderer if we want code blocks
          // / clickable links in LOOT replies.
          <p className={styles.text}>{text}</p>
        )}
      </div>
    </div>
  )
}
