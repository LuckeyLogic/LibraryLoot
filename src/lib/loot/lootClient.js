// src/lib/loot/lootClient.js
//
// LOOT — Library Loot's admin AI assistant. Thin wrapper around the
// Firebase AI Logic SDK so the rest of the app talks to LOOT through a
// single `chat()` function and never needs to know which backend (Vertex
// AI vs. Gemini Developer API), which model, or how App Check fits in.
//
// Backend: Vertex AI (paid, GA, App Check enforced). The free Gemini
// Developer API is enabled in our Firebase project too but is reserved
// for prototype work; Vertex is what production runs against.
//
// Model: Gemini 2.5 Flash. Fast, cheap, plenty smart for assistant-style
// tool calling. Gemini 2.0 Flash + Flash-Lite shut down 2026-06-01 —
// don't pin to those.
//
// Tools: none in 9b — chat only. ITEM 9c wires the first tools
// (`lookupBookByIsbn`, `searchBooksByTitle`) once the chat plumbing is
// verified working end-to-end.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai'

import app from '../../firebase.js'

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────
//
// The system prompt is intentionally narrow in 9b: identity, audience,
// tone, hard boundaries. As we add tools (9c onward) and expand audiences
// (9f parent, 9g public), this prompt will branch per audience — we'll
// extract it into separate templates then.

const SYSTEM_PROMPT = `
You are LOOT — Library Loot's admin assistant. Library Loot is a
community-funded reading-rewards platform for libraries: adults sponsor
prizes, kids accept reading challenges, a verifiable random draw awards
donated prizes when kids complete books.

You are speaking to a librarian or admin running their tenant's
Library Loot instance. Your job is to help them manage the catalog,
review sponsor inquiries, and run prize draws.

Tone: concise, warm, gaming-energy (Fortnite-vibe age-appropriate for a
kids' reading program). Brief answers — no filler, no apologies for
limits, no "as an AI" hedging. If you don't know something or don't have
a tool for it, say so in one sentence and suggest the next step.

You only discuss running this Library Loot tenant. If asked about
unrelated topics, politely redirect to admin tasks ("Not my loot drop —
try Google. What can I help with on Library Loot?").

You currently have no tools wired up. If a librarian asks you to "do"
something (add a book, look up an ISBN, send an email), tell them tools
are coming in the next build and ask them what they're trying to
accomplish so you can help advise in the meantime.
`.trim()

// ── SDK PROVISIONING ──────────────────────────────────────────────────

const ai = getAI(app, { backend: new VertexAIBackend() })

/**
 * Cached generative model. Re-used across calls so we don't pay the
 * per-call provisioning cost. If we ever need per-call config (e.g.
 * tool sets that differ between flows), refactor to a factory.
 */
const model = getGenerativeModel(ai, {
  model            : 'gemini-2.5-flash',
  systemInstruction: SYSTEM_PROMPT
})

// ── PUBLIC API ────────────────────────────────────────────────────────

/**
 * Send a conversation to LOOT and return the next assistant message.
 *
 * @param {Array<{role: 'user'|'model', text: string}>} history
 *        Conversation so far, oldest first. Caller maintains the
 *        history; we don't persist server-side in 9b.
 * @returns {Promise<string>} The model's next message text.
 */
export async function chatWithLoot(history) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error('chatWithLoot: history must be a non-empty array')
  }

  // The SDK expects {role, parts: [{text}]} — translate from our flatter
  // shape so the rest of the app doesn't import SDK types.
  const sdkHistory = history.slice(0, -1).map((m) => ({
    role : m.role,
    parts: [{ text: m.text }]
  }))
  const latest    = history[history.length - 1]

  if (latest.role !== 'user') {
    throw new Error('chatWithLoot: last message must be from the user')
  }

  const chat = model.startChat({ history: sdkHistory })
  const res  = await chat.sendMessage(latest.text)
  return res.response.text()
}
