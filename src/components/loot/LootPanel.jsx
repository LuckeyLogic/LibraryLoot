/**
 * LOOT chat panel. Slides up from bottom-right on desktop, fullscreen on mobile.
 * Conversation history persists in sessionStorage so navigating between admin
 * routes preserves context; closing the panel keeps the history. Hitting "Clear
 * chat" wipes it.
 * @module components/loot/LootPanel
 */
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
import {
  getOrCreateLootSessionId,
  logLootSession
}                                              from '../../lib/loot/lootLogger.js'

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

  const { user, tenantClaim }     = useAuth()
  const [history,  setHistory]    = useState(loadHistory)
  const [draft,    setDraft]      = useState('')
  const [sending,  setSending]    = useState(false)
  const [error,    setError]      = useState(null)

  const scrollerRef = useRef(null)
  const inputRef    = useRef(null)

  // Per-tab LOOT session ID — generated once, reused across reloads
  // of the same tab so we keep appending to the same Firestore doc.
  const sessionIdRef       = useRef(getOrCreateLootSessionId())
  // Tracks whether we've already checked Firestore for the session
  // doc's existence (so we only do that getDoc once per mount). The
  // logger mutates this object.
  const sessionStartFlagRef = useRef({ checked: false, exists: false })

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

  // Mobile-only body-scroll lock. On desktop the panel is a corner
  // overlay and we want the admin page underneath to stay scrollable.
  // On mobile the panel goes fullscreen, so background scroll should
  // be frozen — without this, dragging on a chat message bleeds
  // through to the admin page underneath.
  //
  // `document.body.style.overflow = 'hidden'` alone is NOT enough on
  // iOS Safari — Safari ignores body overflow lock once a touch-drag
  // gesture starts. The robust pattern: snapshot scrollY, then apply
  // position:fixed + negative top + width:100% to body, which fully
  // freezes the page. On cleanup, restore the styles AND scroll back
  // to where the user was so closing LOOT doesn't jump them to the
  // top of the admin page.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.matchMedia('(max-width: 600px)').matches
    if (!isMobile) return

    const scrollY = window.scrollY
    const prev    = {
      position: document.body.style.position,
      top     : document.body.style.top,
      width   : document.body.style.width,
      overflow: document.body.style.overflow
    }
    document.body.style.position = 'fixed'
    document.body.style.top      = `-${scrollY}px`
    document.body.style.width    = '100%'
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.position = prev.position
      document.body.style.top      = prev.top
      document.body.style.width    = prev.width
      document.body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [])

  // ── HANDLERS ────────────────────────────────────────────────────
  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return

    const userTurn = { role: 'user', text, timestampMs: Date.now() }
    const next     = [...history, userTurn]
    setHistory(next)
    setDraft('')
    setSending(true)
    setError(null)

    // Local accumulator of turns added during this exchange so we
    // can write the complete user → tool* → model bundle to
    // Firestore in one go at the end, without depending on React
    // state batching.
    const turnsAccum = [...next]

    try {
      // onToolCall fires once per tool the model invokes. We push a
      // 'tool' entry into history so LootMessage renders a chip
      // ("📖 Looking up ISBN 9780062074324") inline with the
      // conversation. Chips persist in sessionStorage with the rest
      // of the history so they survive a refresh — useful when
      // scrolling back later to see what LOOT actually did.
      const reply = await chatWithLoot(next, {
        onToolCall: ({ name, args }) => {
          const toolTurn = { role: 'tool', name, args, timestampMs: Date.now() }
          setHistory((prev) => [...prev, toolTurn])
          turnsAccum.push(toolTurn)
        }
      })
      const modelTurn = { role: 'model', text: reply, timestampMs: Date.now() }
      setHistory((prev) => [...prev, modelTurn])
      turnsAccum.push(modelTurn)

      // Persist this turn to Firestore (ITEM 9c.1a). Non-fatal —
      // chat keeps working if the log write fails.
      logLootSession({
        sessionId       : sessionIdRef.current,
        user,
        tenantClaim,
        audience        : 'admin',
        history         : turnsAccum,
        sessionStartFlag: sessionStartFlagRef.current
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[LOOT] chat error', err)
      setError(
        err?.message ||
        'LOOT couldn\'t reach the model. Check your connection and try again.'
      )
      // Roll everything added during this turn back so the user can
      // retry without re-typing. Find the index of the user message
      // we appended (`next`'s last entry was the user text); slice
      // history down to before that. Any tool chips added between
      // the user message and the failure get rolled back with it,
      // which is what we want — a half-finished tool chain on screen
      // would be confusing.
      const rollbackLen = next.length - 1
      setHistory((prev) => prev.slice(0, rollbackLen))
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
    <>

      {/* Mobile-only blurred backdrop. Hidden on desktop via CSS.
          Clicking/tapping it closes the panel — standard modal UX.
          Visually softens the admin page behind LOOT on phones so the
          panel feels like its own surface rather than just a fullscreen
          overlay floating on top of busy content. */}
      <div
        className   ={styles.backdrop}
        onClick     ={onClose}
        aria-hidden ="true"
      />

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
            <LootMessage
              key  ={i}
              role ={m.role}
              text ={m.text}
              name ={m.name}
              args ={m.args}
            />
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

    </>
  )
}
