// src/components/loot/LootPanel.jsx
//
// LOOT chat panel. Slides up from bottom-right on desktop, fullscreen on
// mobile. Conversation history persists in sessionStorage so navigating
// between admin routes preserves context; closing the panel keeps the
// history. Hitting "Clear chat" wipes it.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useRef, useState } from 'react'

import { useAuth }                            from '../../context/AuthContext.jsx'

import { chatWithLoot }                       from '../../lib/loot/lootClient.js'

import LootMessage                            from './LootMessage.jsx'

import styles                                 from './LootPanel.module.css'

const HISTORY_KEY = 'll_loot_history_v1'

/** Pull the saved conversation; tolerate corrupt / missing storage. */
function loadHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function saveHistory(history) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch (e) {
    // Quota exceeded / private mode — best-effort, conversation just
    // won't survive a reload. Non-fatal.
  }
}

/**
 * LootPanel — chat surface for the LOOT assistant.
 *
 * @param {Object}   props
 * @param {Function} props.onClose - Called when the panel is dismissed.
 * @returns {JSX.Element}
 */
export default function LootPanel({ onClose }) {

  const { user }                  = useAuth()
  const [history,  setHistory]    = useState(loadHistory)
  const [draft,    setDraft]      = useState('')
  const [sending,  setSending]    = useState(false)
  const [error,    setError]      = useState(null)

  const scrollerRef = useRef(null)
  const inputRef    = useRef(null)

  // Auto-scroll to the bottom whenever the conversation grows.
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, sending])

  // Persist on every history change.
  useEffect(() => { saveHistory(history) }, [history])

  // Focus the input on mount so the librarian can just start typing.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Esc closes the panel.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── HANDLERS ────────────────────────────────────────────────────
  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return

    const next = [...history, { role: 'user', text }]
    setHistory(next)
    setDraft('')
    setSending(true)
    setError(null)

    try {
      const reply = await chatWithLoot(next)
      setHistory((prev) => [...prev, { role: 'model', text: reply }])
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[LOOT] chat error', err)
      setError(
        err?.message ||
        'LOOT couldn\'t reach the model. Check your connection and try again.'
      )
      // Roll the user message back so they can retry without re-typing.
      setHistory((prev) => prev.slice(0, -1))
      setDraft(text)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleClear() {
    if (!history.length) return
    if (!window.confirm('Clear this LOOT conversation?')) return
    setHistory([])
    setError(null)
  }

  // ── RENDER ──────────────────────────────────────────────────────
  const firstName = (user?.displayName || '').trim().split(/\s+/)[0]
  const greeting  = firstName
    ? `Hey ${firstName} — what are we looting today?`
    : 'Hey — what are we looting today?'

  return (
    <aside className={styles.panel} aria-label="LOOT assistant">

      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.glyph} aria-hidden="true">⚡</span>
          <div>
            <p className={styles.brand}>LOOT</p>
            <p className={styles.tag}>Admin assistant · Gemini 2.5 Flash</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type      ="button"
            className ={styles.iconBtn}
            onClick   ={handleClear}
            disabled  ={history.length === 0}
            title     ="Clear chat"
            aria-label="Clear chat"
          >
            Clear
          </button>
          <button
            type      ="button"
            className ={styles.iconBtn}
            onClick   ={onClose}
            title     ="Close LOOT"
            aria-label="Close LOOT"
          >
            ✕
          </button>
        </div>
      </header>

      <div className={styles.scroller} ref={scrollerRef}>
        {history.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{greeting}</p>
            <p className={styles.emptyBody}>
              I can chat. Tools (book lookup, sponsor reply drafts) drop in
              the next build. Ask me anything about running this tenant —
              I'll help where I can.
            </p>
          </div>
        ) : (
          history.map((m, i) => (
            <LootMessage key={i} role={m.role} text={m.text} />
          ))
        )}

        {sending ? (
          <LootMessage role="model" text="…" pending />
        ) : null}
      </div>

      {error ? (
        <div className={styles.errorBar} role="alert">
          {error}
        </div>
      ) : null}

      <form
        className ={styles.inputBar}
        onSubmit  ={(e) => { e.preventDefault(); handleSend() }}
      >
        <textarea
          ref         ={inputRef}
          className   ={styles.input}
          value       ={draft}
          onChange    ={(e) => setDraft(e.target.value)}
          onKeyDown   ={handleKeyDown}
          // Keep this short — the textarea is narrow at panel widths
          // ~280-340px. Enter-to-send is the web convention, no need to
          // spell it out in the placeholder. Shift+Enter for newline is
          // discoverable on try.
          placeholder ="Ask LOOT…"
          rows        ={1}
          disabled    ={sending}
        />
        <button
          type      ="submit"
          className ={styles.sendBtn}
          disabled  ={sending || !draft.trim()}
          aria-label="Send"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>

    </aside>
  )
}
