/**
 * A single message bubble in the LOOT chat. User messages right-aligned on a
 * purple gradient; LOOT messages left-aligned on the night surface.
 * `pending=true` swaps the text for an animated "thinking" indicator that the
 * panel renders while waiting on Gemini.
 * @module components/loot/LootMessage
 */
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
import ReactMarkdown        from 'react-markdown'
import remarkGfm            from 'remark-gfm'

import { LOOT_TOOL_DISPLAY } from '../../lib/loot/lootTools.js'

import styles               from './LootMessage.module.css'

// Custom element renderers so markdown inside a LOOT bubble inherits
// our brand styling instead of the browser defaults. Anchor tags open
// in a new tab; code blocks get a contained, slightly-darker surface.
const MARKDOWN_COMPONENTS = {
  a: ({ node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
  code({ node, inline, className, children, ...props }) {
    if (inline) {
      return <code className={styles.inlineCode} {...props}>{children}</code>
    }
    return (
      <pre className={styles.codeBlock}>
        <code className={className} {...props}>{children}</code>
      </pre>
    )
  }
}

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
          // Render markdown so Gemini's natural output formatting
          // (bold, italic, lists, links, code) shows up properly
          // instead of as raw asterisks. react-markdown sanitizes
          // HTML by default — no XSS risk from model output.
          // remark-gfm adds GitHub-flavored extras (tables, task
          // lists, strikethrough, autolinks) for the cases where
          // LOOT decides to use them.
          //
          // User messages are also markdown-rendered for consistency,
          // but they're typically a single line of plain text — the
          // overhead is negligible.
          <div className={styles.markdown}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components   ={MARKDOWN_COMPONENTS}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
