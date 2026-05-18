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
// Tools (ITEM 9c — wired): book lookup by ISBN, title search, and
// "is this in our catalog?" check. See ./lootTools.js for the schema
// declarations and implementations. The tool-call loop below executes
// any functionCalls the model emits, sends the results back, and
// repeats up to MAX_TOOL_ROUNDS before bailing — prevents runaway
// loops without hampering legit multi-step tool usage.
//
// Created by Miguel Brown on 5/15/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai'

import app                              from '../../firebase.js'

import { lootToolDeclarations,
         lootToolImplementations }       from './lootTools.js'

// Cap on tool-call rounds within a single user turn. Each round = the
// model emits N function calls, we execute them, send results back, and
// the model either emits more calls or produces a final text response.
// 10 is generous for legit multi-step lookups (search → confirm →
// catalog-check) while still stopping pathological loops dead. If we
// observe runaway behavior in conversation logs (ITEM 9c.1), dial down.
const MAX_TOOL_ROUNDS = 10

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
review sponsor inquiries, run prize draws, and generally make this
program easier to operate.

Tone: concise, warm, gaming-energy (Fortnite-vibe age-appropriate for a
kids' reading program). Brief answers — no filler, no apologies for
limits, no "as an AI" hedging. If you don't know something or don't have
a tool for it, say so in one sentence and suggest the next step.

WHAT'S IN SCOPE — be helpful with anything a librarian running a kids'
reading program might plausibly ask:
  - Books, authors, titles, series, reading levels, age suitability
    (even if the book isn't in this tenant's catalog yet — discuss it,
    and admin can add it)
  - Reading recommendations and program ideas
  - Sponsor outreach strategy, donation logistics, prize ideas that
    fit Library Loot (Fortnite-era reward themes for v1)
  - COPPA basics, librarian-program operational questions
  - The Library Loot platform itself: how features work, where things
    live in the admin UI, how to do a task

WHAT'S OUT OF SCOPE — refuse only when a request is clearly off-program:
  - Recipes, cooking, food
  - General coding help unrelated to running Library Loot
  - Sports trivia, news, weather, politics
  - Personal advice, relationship questions
  - Anything else that has nothing to do with books, libraries, kid
    reading programs, sponsors, or running a tenant
For those, respond briefly: "Not my loot drop — try Google. What can
I help with on Library Loot?"

TOOLS AVAILABLE — use them confidently when relevant. Don't ask
permission ("Do you want me to look that up?") — just call the tool
and report the answer. If a tool returns { error: ... }, explain the
error to the user plainly in one sentence; don't pretend the tool
worked.

  - lookupBookByIsbn(isbn): Book metadata from the wider web (Open
    Library + Google Books). Use when the user gives you an ISBN.
  - searchBooksByTitle(title): Up to 5 web matches for a title query.
    Use when the user names a book without an ISBN — then read the
    matches back and ask which one they mean if there's ambiguity.
  - isBookInCatalog(isbn): Checks whether an ISBN is in THIS tenant's
    catalog (different from lookupBookByIsbn — that's the wider web).
    Use to answer "is X in our catalog?" / "did I add Y?" questions.

Common flow: user names a book ("Is Steam Train Dream Train in our
catalog?"). Step 1: searchBooksByTitle to find the right ISBN.
Step 2: confirm with user if multiple matches. Step 3: isBookInCatalog
on the confirmed ISBN. Step 4: report the result.

FORMATTING — your replies render as Markdown in the chat. Use
**bold** and *italic* for emphasis, \`inline code\` for ISBNs and
file paths, fenced code blocks for snippets, and numbered or
bulleted lists for multi-point answers. DO NOT use raw HTML tags
like <u>, <sub>, <sup>, <span>, <div>, etc. — the renderer strips
them and they show up as literal text in the bubble. Markdown has
no underline; use bold or italic instead when the user asks for
emphasis beyond what those two cover.

You do NOT yet have tools for: adding books to the catalog, editing
tenant settings, sending sponsor emails, triggering prize draws. Those
arrive in later builds. If asked to DO one of those, say "I can't do
that yet — that tool's coming in a later build. Want me to walk you
through it manually?"

GROUND TRUTH — how Library Loot actually works. Don't invent mechanics.
If a question lands outside what's documented here AND you don't have a
tool for it, say "I'd have to check SPEC.md or ask the dev team" rather
than guessing.

  PRIZE DRAW MECHANIC (the one most often asked about — get this right):
    1. A kid accepts a reading challenge on a specific book.
    2. Kid reads the book and submits verification (quiz, oral
       check-off, or librarian sign-off — chosen per challenge).
    3. Librarian or parent approves the completion.
    4. On approval, a Cloud Function runs a VERIFIABLE RANDOM DRAW
       against the active prize pool. Entropy chain (in order, with
       fallbacks): drand → random.org → crypto.randomBytes. The draw
       writes an immutable audit doc — anyone can re-run the math
       against the snapshot and confirm the result was unrigged.
    5. Default mode: every approved completion yields ONE prize from
       the pool. The randomization is on WHICH PRIZE the kid gets,
       NOT on whether they get one. Every kid who finishes wins
       something — they just don't know which prize until the draw.
    6. (Optional/future) Admin can also configure limited-prize modes
       where a draw might yield no prize, but this is opt-in, not
       default. v1 default is "every completion wins."
    7. There is NO ticket system, NO points system, NO "earn entries
       by completing books." One completion = one prize draw. Do not
       invent ticket / point mechanics — they don't exist.

  SPONSORS:
    - Drop physical prizes off at the library. The platform NEVER
      handles money. v1 prizes are Fortnite-themed (V-Bucks gift
      cards, Fortnite Legos, posters, apparel).
    - Sponsor accounts will be invite-only (admin reviews inquiry +
      approves before issuing a signup invite). Open signup forbidden.

  MULTI-TENANT:
    - Each library runs its own tenant. Data fully isolated per-tenant.
    - All Firestore paths route through src/firebase/tenant.js — no
      hardcoded tenant IDs in app code.

  COPPA / KID DATA:
    - First name + optional birth-year only. No last name, no email,
      no photo, no address.
    - Children are sub-profiles under a parent account.
    - In-person verification at the library required before kids can
      earn prizes (anti-fraud + COPPA-safe).
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
  systemInstruction: SYSTEM_PROMPT,
  tools            : [{ functionDeclarations: lootToolDeclarations }]
})

// ── PUBLIC API ────────────────────────────────────────────────────────

/**
 * Send a conversation to LOOT and return the next assistant message.
 * Handles multi-turn tool calling internally: if the model emits
 * function calls, executes them via lootToolImplementations, sends
 * results back, and repeats until the model produces a final text
 * response or the loop cap is hit.
 *
 * History uses our flat shape (`{role, text}`) plus an additional
 * `tool` role for chip rendering — `tool` entries are NOT sent to the
 * model (Gemini reconstructs its own tool-call history from the SDK
 * chat session); they exist purely for the UI layer to render chips
 * inline with the conversation. Filtering them out before sending to
 * the SDK keeps the model's view of history clean.
 *
 * @param {Array<{role: string, text?: string, name?: string, args?: Object}>} history
 *        Conversation so far, oldest first.
 * @param {Object} [options]
 * @param {Function} [options.onToolCall]
 *        Optional callback fired when the model emits a function
 *        call, BEFORE the tool runs. Receives `{name, args}`. Lets
 *        the UI push a chip into its rendered history in real time.
 * @returns {Promise<string>} The model's final text response.
 */
export async function chatWithLoot(history, options = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error('chatWithLoot: history must be a non-empty array')
  }
  const onToolCall = typeof options.onToolCall === 'function'
    ? options.onToolCall
    : null

  // Strip tool entries — they're UI sugar, not part of the model's
  // conversation memory. The SDK's chat session tracks tool calls /
  // responses internally; we just keep user + model text turns here.
  const textOnly = history.filter((m) => m.role === 'user' || m.role === 'model')

  const sdkHistory = textOnly.slice(0, -1).map((m) => ({
    role : m.role,
    parts: [{ text: m.text }]
  }))
  const latest = textOnly[textOnly.length - 1]
  if (!latest || latest.role !== 'user') {
    throw new Error('chatWithLoot: last text turn must be from the user')
  }

  const chat = model.startChat({ history: sdkHistory })

  // First send: the user's message.
  let result = await chat.sendMessage(latest.text)

  // Tool-call loop. Each iteration: check for function calls in the
  // latest response. If present, execute them, send the function
  // responses back, and let the model continue. If no function calls,
  // we've reached a final text response — break out.
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const fnCalls = typeof result.response.functionCalls === 'function'
      ? result.response.functionCalls()
      : null

    if (!fnCalls || fnCalls.length === 0) {
      return result.response.text()
    }

    // Execute every function call in this round in parallel; the SDK
    // expects a single sendMessage with an array of functionResponse
    // parts. Notify the UI BEFORE each tool starts so the chip
    // appears while the user waits.
    const fnResponses = await Promise.all(fnCalls.map(async (call) => {
      const name = call.name
      const args = call.args || {}
      if (onToolCall) {
        try { onToolCall({ name, args }) } catch (_e) { /* ignore UI errors */ }
      }
      const impl = lootToolImplementations[name]
      let response
      if (!impl) {
        response = { error: `Unknown tool: ${name}` }
      } else {
        response = await impl(args)  // impls never throw — always return data or {error}
      }
      return {
        functionResponse: {
          name,
          response
        }
      }
    }))

    result = await chat.sendMessage(fnResponses)
  }

  // Loop cap hit. Return whatever text the model produced (may be
  // empty if it was still mid-tool-call); fall back to a friendly
  // hedge so the user isn't left with a blank message.
  const finalText = result.response.text()
  if (finalText && finalText.trim()) return finalText
  return (
    "I got stuck in a lookup loop on this one — try rephrasing? " +
    "(If this keeps happening, ping Miguel — it might mean I need a new tool.)"
  )
}
