// src/lib/loot/lootLogger.js
//
// LOOT conversation logger. Mirrors MCL Central's adminChatLogs pattern
// (functions/index.js — adminChat handler): one Firestore doc per
// chat session, whose `turns` array is overwritten on every model
// response. Multi-tenant by nature: docs live at
// /{tenantId}/_main/lootSessions/{sessionId}, with rules allowing
// any tenant admin to read all sessions but only the session owner
// to write.
//
// First write of a session includes `sessionStartedAt`; subsequent
// writes only update `lastTurnAt` + `turns`. We avoid clobbering
// sessionStartedAt by doing a one-time `getDoc` check at the start
// of a session lifecycle to determine whether the doc exists; after
// that the caller's flag stays true and we skip the read.
//
// Failures are non-fatal — LOOT keeps chatting even if the log
// write fails. ITEM 9c.1b (the scheduled digest function) reads
// from this collection.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
}             from 'firebase/firestore'

import { db } from '../../firebase.js'

// Hard cap on persisted turns per session doc — keeps doc size bounded
// even on very long conversations. The digest function (9c.1b) only
// reads user messages anyway, and a transcript viewer (9c.1c) can show
// "earlier turns truncated" if a session ever exceeds this.
const MAX_TURNS_PER_SESSION = 50

/**
 * Write the latest state of a LOOT session to Firestore.
 *
 * Idempotent per turn: caller invokes after every model response and
 * after any tool-call chip was added. Each write replaces the turns
 * array with the most recent up-to-50 turns.
 *
 * @param {Object} params
 * @param {string} params.sessionId         - Per-tab UUID for this LOOT session.
 * @param {Object} params.user              - Firebase Auth user object (.uid, .displayName, .email).
 * @param {string} params.tenantClaim       - The user's tenant ID custom claim.
 * @param {string} params.audience          - Audience label: 'admin' for now; 'parent' / 'anon' in future items.
 * @param {Array}  params.history           - Full in-memory conversation history (user / model / tool turns).
 * @param {Object} [params.sessionStartFlag] - Mutable flag ref so we only do the existence check once per session lifetime.
 * @returns {Promise<void>}
 */
export async function logLootSession({
  sessionId,
  user,
  tenantClaim,
  audience,
  history,
  sessionStartFlag
}) {

  if (!sessionId || !user || !tenantClaim) return
  if (!Array.isArray(history) || history.length === 0) return

  try {
    const ref = doc(db, tenantClaim, '_main', 'lootSessions', sessionId)

    // Determine whether this is the first write for this session.
    // `sessionStartFlag` is the caller's per-mount ref so we don't
    // re-read on every turn. After a page reload the ref resets, so
    // we do a one-time getDoc check to know whether to include
    // sessionStartedAt (writing it again would clobber the original).
    let isFirstWrite = false
    if (sessionStartFlag && !sessionStartFlag.checked) {
      const snap = await getDoc(ref)
      isFirstWrite = !snap.exists()
      sessionStartFlag.checked = true
      sessionStartFlag.exists  = !isFirstWrite
    } else if (sessionStartFlag) {
      isFirstWrite = !sessionStartFlag.exists
    }

    const data = {
      sessionId,
      userUid        : user.uid,
      userDisplayName: user.displayName || null,
      userEmail      : user.email       || null,
      tenantId       : tenantClaim,
      audience       : audience || 'admin',
      turns          : history.slice(-MAX_TURNS_PER_SESSION),
      lastTurnAt     : serverTimestamp()
    }
    if (isFirstWrite) {
      data.sessionStartedAt = serverTimestamp()
      if (sessionStartFlag) sessionStartFlag.exists = true
    }

    await setDoc(ref, data, { merge: true })
  } catch (e) {
    // Non-fatal — LOOT keeps chatting. The most likely cause during
    // dev is that the new firestore.rules block for lootSessions
    // hasn't been deployed yet. Run:
    //   firebase deploy --only firestore:rules
    // eslint-disable-next-line no-console
    console.warn('[loot-log] failed to log session (non-fatal)', e)
  }
}

/**
 * Get or create a per-tab session ID. The same ID is reused for the
 * lifetime of the browser tab so reloads / re-opens of the panel
 * keep appending to the same Firestore session doc.
 *
 * @returns {string}
 */
export function getOrCreateLootSessionId() {

  const KEY = 'll_loot_session_id_v1'
  try {
    const existing = sessionStorage.getItem(KEY)
    if (existing) return existing
    const fresh = (crypto.randomUUID()).replace(/-/g, '')
    sessionStorage.setItem(KEY, fresh)
    return fresh
  } catch (e) {
    // sessionStorage can throw in private-mode Safari; fall back to a
    // per-call UUID. The session won't be appendable after reload in
    // that environment, but each session-write still goes through.
    return (crypto.randomUUID()).replace(/-/g, '')
  }
}
