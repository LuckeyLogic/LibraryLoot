# Library Loot — Specification

> **Canonical data model, prize-selection algorithm, COPPA approach, legal disclaimers, and handoff procedure.**
> This document is the authoritative source for any data-shape, behavior, or compliance question. Code conflicts with SPEC lose.
>
> Maintained by **Luckey Logic LLC** | Last updated 2026-05-12

---

## 1. Product summary

**Library Loot** is a web app that lets adults sponsor reading challenges on specific books, kids accept and complete them, and the platform performs a verifiable random draw against a donated-prize pool to award a prize. **The platform does not handle money. Ever.** Sponsors buy or supply prizes themselves and physically drop them off at the library — the library logs them into the prize pool. The site handles the random *selection*; the library handles the physical prize.

### v1 prize scope — Fortnite only

All v1 prizes are Fortnite-themed: V-Bucks gift cards, Fortnite Legos, Fortnite action figures, posters, apparel, etc. This is a deliberate choice to keep the site's branding squarely inside Epic Games' Fan Content Policy — Fortnite art + Fortnite prizes reads as fan creative work celebrating the Fortnite world. Mixing in unrelated prize categories (Amazon, Nintendo, etc.) would shift the framing toward "Fortnite branding used to promote unrelated commerce," which the Fan Content Policy doesn't clearly cover. Revisit only if/when we drop the Fortnite branding.

### Core flow

1. Librarian / admin adds books to the site by scanning ISBN (Open Library API → metadata + cover).
2. Sponsor (parent, grandparent, neighbor, local business) physically drops off a Fortnite prize at the library. They submit a sponsorship form on the site (or email the library directly) to register intent.
3. Librarian receives the prize, logs it into the prize pool via the admin panel, and attaches the sponsor's recognition info (name, optional logo, optional message).
4. A child, through their parent's account, accepts a challenge on a book.
5. Child reads the book.
6. Child completes the reading verification (quiz, oral check-off, or librarian/parent sign-off).
7. Librarian or parent approves the completion.
8. Cloud Function performs a verifiable random draw against the active prize pool.
9. Result screen shows the prize + the donor's recognition (name / logo / message).
10. Prize is handed over in person at the library — the site never transmits or stores gift card codes, redemption codes, or any other thing-of-value.

---

## 2. Multi-tenant architecture

Each library (or community org) is a **tenant** with its own isolated data root. v1 hosts all tenants inside Luckey Logic's Firebase project. Migration scripts let any tenant move their data into their own Firebase project later.

### Tenant IDs

- Lowercase, kebab-case, stable forever.
- Examples: `luckey-logic`, `pembervill-public-library`, `toledo-lucas-county-public-library`.

### Firestore layout

```
/{tenantId}/_main                              ← settings doc
/{tenantId}/_main/books/{bookId}
/{tenantId}/_main/books/{bookId}/quizPool/{questionId}
/{tenantId}/_main/prizes/{prizeId}
/{tenantId}/_main/sponsors/{sponsorId}
/{tenantId}/_main/users/{uid}
/{tenantId}/_main/users/{uid}/children/{childId}
/{tenantId}/_main/challenges/{challengeId}
/{tenantId}/_main/redemptions/{redemptionId}
```

### Storage layout

```
/{tenantId}/assets/hero/...
/{tenantId}/assets/branding/logo.{png|svg}
/{tenantId}/books/{bookId}/cover.jpg           ← cached from Open Library
/{tenantId}/sponsors/{sponsorId}/logo.{png|jpg}
```

### Rules

- All Firestore reads and writes route through `src/firebase/tenant.js`. No hardcoded tenant IDs in app code.
- Firestore Security Rules deny all requests by default. Allow only if the caller's auth claim `tenant` matches the document's tenant root.
- Storage Rules mirror the same boundary.
- No `collectionGroup` queries across tenants without explicit per-tenant scoping.
- Cloud Functions read tenant settings from `/{tenantId}/_main` (single `getDoc` per invocation; no live listeners on hot paths).

### Settings document `_main`

```js
{
  tenantId          : 'luckey-logic',
  tenantName        : 'Luckey Logic Demo',
  active            : true,

  // ── SUPPORT / CONTACT ──
  // These fields are the source of truth for the operator of THIS tenant.
  // The About / Privacy / Terms pages render these values, not anything from
  // siteContent. Once a library takes over their instance, only this block
  // needs to change for every legal contact across the site to update.
  support: {
    organizationName     : 'Luckey Logic LLC',
    programContactEmail  : 'libraryloot@luckeylogic.com',
    coppaContactEmail    : 'libraryloot@luckeylogic.com',
    privacyContactEmail  : 'libraryloot@luckeylogic.com',
    operatorAddress      : null,         // optional mailing address for legal correspondence
    contactBlurb         : 'Library Loot for this site is operated by Luckey Logic LLC.'
  },

  verification: {
    quizEnabled         : true,
    quizMinScore        : 0.7,           // 70% of 8 sampled questions
    quizTimeLimitMin    : 10,
    oralCheckoffEnabled : true,
    parentSignoffEnabled: true
  },
  entropy: {
    providers : ['drand', 'random_org', 'crypto_random'],
    algorithm : 'weighted-index-v1'
  },
  branding: {
    logoPath  : 'luckey-logic/assets/branding/logo.png',
    accentHex : '#9D4EDD'
  }
}
```

**Editing rules:**

- Only authenticated admins for this tenant (custom claim `admin: true, tenant: <this tenant>`) may write `_main`.
- The `support` block is the canonical operator contact. After handoff to a new org, this block becomes their information and Luckey Logic is no longer the right contact.
- The Privacy Policy text must always render `support.coppaContactEmail` (not anything hardcoded) so a tenant transition automatically updates every legal disclosure.

---

## 3. Data model

### 3.1 Book

```js
{
  id            : string,            // Firestore doc ID
  isbn13        : string,
  title         : string,
  authors       : string[],
  coverPath     : string,            // Storage path (cached from API)
  publishedYear : number | null,
  readingLevel  : string | null,     // 'EarlyReader' | 'Grade3-5' | 'MiddleGrade' | 'YA'
  summary       : string,            // from API, used by quiz generator
  addedBy       : string,            // uid
  addedAt       : Timestamp,
  active        : boolean,
  quizApproved  : boolean            // true once librarian has approved the quiz pool
}
```

### 3.2 Quiz question (subcollection of Book)

```js
{
  id              : string,
  question        : string,
  choices         : string[],        // 4 choices, multiple-choice only
  correctIndex    : number,          // 0-3
  source          : 'ai' | 'manual',
  approvedBy      : string,          // librarian uid
  approvedAt      : Timestamp,
  difficulty      : 'easy' | 'medium' | 'hard'
}
```

### 3.3 Prize

```js
{
  id             : string,
  kind           : 'vbucks' | 'fortnite-toys' | 'fortnite-legos' | 'fortnite-apparel' | 'fortnite-posters' | 'fortnite-other',
  label          : string,           // 'V-Bucks $10 Card', 'Fortnite Battle Bus Lego Set'
  valueUsd       : number | null,    // optional retail value for the library's records; never shown to kids
  qtyTotal       : number,           // donated quantity
  qtyAvailable   : number,           // remaining (decremented on each draw)
  donorId        : string,           // → sponsors/{donorId}
  receivedAt     : Timestamp,        // when the library physically received the prize
  active         : boolean
}
```

**v1 constraint:** every `kind` value is Fortnite-themed. The site never stores a gift card code, redemption code, or any handle that could be used to redeem the prize. The prize itself is a physical object (or paper card) sitting in the library — the Firestore doc is just a label.

### 3.4 Sponsor (donor)

```js
{
  id           : string,
  displayName  : string,
  type         : 'individual' | 'business',
  message      : string,             // optional recognition note
  logoPath     : string | null,      // Storage path
  websiteUrl   : string | null,
  anonymous    : boolean,            // if true, public surfaces hide displayName
  createdAt    : Timestamp
}
```

### 3.5 User

```js
{
  uid          : string,             // = Firebase Auth uid
  role         : 'admin' | 'parent',
  displayName  : string,
  email        : string,
  createdAt    : Timestamp
}
```

Custom auth claims: `{ admin: boolean, tenant: string }`. Set via Cloud Function on user provisioning. The client never writes claims.

### 3.6 Child (subcollection of User)

Minimum-PII profile. The parent is the COPPA consent agent.

```js
{
  id         : string,
  firstName  : string,               // first name only
  birthYear  : number | null,        // year only, no full DOB
  avatarSeed : string,               // for procedural avatar (no photos)
  createdAt  : Timestamp
}
```

### 3.7 Challenge

```js
{
  id              : string,
  bookId          : string,
  childId         : string,          // FK into /users/{parentUid}/children
  parentUid       : string,
  sponsorRequired : boolean,         // true if the prize pool must be non-empty to redeem
  state           : 'open' | 'accepted' | 'submitted' | 'approved' | 'rewarded' | 'expired' | 'rejected',
  acceptedAt      : Timestamp | null,
  submittedAt     : Timestamp | null,
  approvedBy      : string | null,   // uid (librarian or parent)
  approvedAt      : Timestamp | null,
  redemptionId    : string | null,   // → redemptions/{id} once drawn
  quizResult: {                      // optional, present if verification was quiz
    score         : number,          // 0.0 - 1.0
    questionIds   : string[],        // sampled questions
    answers       : number[],        // chosen indices
    completedAt   : Timestamp
  } | null
}
```

### 3.8 Redemption (immutable audit trail)

```js
{
  id                  : string,
  challengeId         : string,
  childId             : string,
  algorithmVersion    : 'weighted-index-v1',
  prizePoolSnapshot   : [                       // active prizes at draw time
    { prizeId, label, qtyAvailableAtDraw }
  ],
  entropyChain        : [
    { source: 'drand', round: 4012331, randomness: '0xabc...', signedAt: Timestamp },
    { source: 'random_org', requestId: '...', randomness: '0xdef...', fetchedAt: Timestamp }
    // Final fallback recorded explicitly if used.
  ],
  selectedPrizeId     : string,
  selectedPrizeLabel  : string,
  donorIdAtDraw       : string,
  donorRecognition    : { displayName, message, logoPath, anonymous },
  drawnAt             : Timestamp
}
```

A redemption doc is **append-only**. Security rules forbid update/delete. Anyone with the redemption ID can audit the draw.

---

## 4. Verifiable random prize draw

The draw is the trust anchor of the whole program. Every parameter that feeds it must be recorded in the redemption doc.

### Entropy chain

Cloud Function `redeemPrize(challengeId)` builds the random seed from external sources, in priority order:

1. **drand** (`https://api.drand.sh/public/latest`) — the League of Entropy public randomness beacon. Free, signed, publicly verifiable. Each round publishes a 32-byte randomness value.
2. **random.org** Signed Random Integer API — fallback if drand is unreachable. Requires a free API key.
3. **`crypto.randomBytes(32)`** — final fallback if both upstreams fail. **Flagged in the audit doc** so a verifier knows the draw was server-only and can request a re-draw if policy requires it.

The function tries (1), then (2), then (3). It records **every attempt** (success or failure) in `entropyChain`.

### Algorithm `weighted-index-v1`

```
seed       = SHA256(entropyChain[*].randomness ++ challengeId ++ drawnAt)
seedInt    = uint256(seed)
totalQty   = sum(prizePoolSnapshot[i].qtyAvailableAtDraw)
index      = seedInt mod totalQty
selected   = walk the snapshot incrementing a cumulative sum until cumulative > index
```

`challengeId` and `drawnAt` are mixed in so two redemptions in the same drand round with the same prize pool still produce different draws.

### Why this is verifiable

- The redemption doc contains every input: the entropy values, the timestamp, the challenge ID, the snapshot of the prize pool at draw time, and the algorithm version.
- Anyone — auditor, parent, librarian, the kid themselves — can SHA-256 the recorded inputs, repeat the math, and arrive at the same `selectedPrizeId`.
- drand randomness is signed and timestamped by an independent international consortium. random.org randomness includes a server-side signature in its signed-integer API. Neither value is under Luckey Logic's control.

### What we do NOT do

- We never seed `Math.random` and call it. Standard PRNGs are reproducible from their seed — exactly what Miguel called out as the problem with graphing-calculator randomness.
- We never pick the prize before the entropy is fetched.
- We never let an admin "pick a winner."

---

## 5. Reading verification

A core constraint: kids cannot fake their way to a reward by feeding the book to an AI.

### v1 modes (configurable per tenant in `_main.verification`)

| Mode | How it works | Cheat resistance |
|---|---|---|
| **Quiz** | Multiple-choice from a librarian-approved pool of 15-20 questions per book. Sampled 8 questions per attempt, time-limited (~10 min). | Strong if questions target specific recall (minor characters, scene order, location of specific scenes) — not summary-derivable facts. AI generation is allowed but **librarian approval is mandatory**; the librarian filters out questions a kid could answer from a Wikipedia summary. |
| **Oral check-off** | Child answers librarian questions verbally at the desk. No site grading. | Very strong — no digital surface to cheat against. |
| **Parent sign-off** | Parent confirms reading after a short conversation. No site grading. | Depends on the parent. Designed for at-home programs. |

### Reader's promise (honor-system pledge at challenge acceptance)

At the moment a child (or their parent acting for them) accepts a challenge on a book, a kid-readable honor-system pledge appears before the challenge document is created. Single-checkbox consent, single accept button. The pledge text + version is **snapshotted** into the challenge document so a librarian reviewing a completion six months later sees the exact promise that was taken at the time, even after the platform's pledge copy has been edited.

**Pledge content** (lives in `siteContent.honestyPledge`, version-stamped):

> Reader's promise — Quick promises before we start.
> Just a few honest promises. These are between you and the librarian — nobody's secretly checking, but they're how the program stays fair for every reader.
> - I haven't read this book before.
> - I'll read the whole book myself, or have a grown-up read it to me.
> - I won't ask ChatGPT or any AI helper to read the book or answer the quiz for me.
> - If I get stuck, I'll ask a grown-up — not the internet.
> ☐ I promise to keep these.
> [ I promise — accept challenge ]
> *Your grown-up will see this promise when they approve your finished book.*

**Recorded on the challenge document:**

```js
challenge.pledge = {
  acceptedAt: Timestamp,
  version   : 'v1',
  statements: [ ... snapshot of the four pledge statements ... ]
}
```

**Surfaces that show the pledge again:**

- The librarian / parent approval view (so the human approving a completion sees exactly what the kid promised).
- The parent dashboard's "review what your kid agreed to" detail panel.

**Why a pledge instead of stronger gating**: a determined cheater can still cheat — the structural defenses (verified-in-person flag, librarian approval, recall-quiz design, time limit) are what actually stop bulk abuse. The pledge is a *light* social-pressure layer, kid-readable, that makes the honest path the obvious one. The Library Loot UX deliberately treats kids as honest participants by default and uses physical / human gates (librarian verification + librarian approval) as the real anti-cheat.

The reusable React component is `src/components/HonestyPledge.jsx`.

### Quiz authoring flow

1. Librarian opens the book in the admin panel.
2. Clicks "Generate quiz pool" — Cloud Function calls Gemini 2.0 Flash with the book's metadata + summary + reading level, prompting for 20 specific-recall multiple-choice questions.
3. The generated pool lands in the `quizPool` subcollection with `source: 'ai'`, `approvedBy: null`.
4. Librarian reviews each question, edits if needed, approves (or rejects). Only approved questions can be sampled at quiz time.
5. Once at least 12 questions are approved, the book's `quizApproved` flag flips to `true`.

Librarians may also write questions by hand — those land with `source: 'manual'` and skip step 2.

### Cheat-resistance principles

- Time limit (~10 min) makes per-question Googling friction.
- Sampling means two kids see different questions on the same book.
- Specific-recall prompts (minor character names, scene sequence, specific dialogue) are not in public summaries.
- A final human approval (librarian or parent) is the gate before the redemption fires — no purely-automated reward.

---

## 6. COPPA approach

Library Loot collects information about minors (likely under 13). COPPA applies. v1 stance:

### What we collect about children

- **First name only** (no last name).
- **Birth year** (optional; year only, no full DOB).
- **No email, no phone, no photo, no address.**
- A non-identifying `avatarSeed` string used to render a procedural avatar (no real photo upload).

### Parent as the consent agent

- Only adults register accounts (Firebase Auth: Google / Email / Facebook).
- Children are sub-profiles under a parent account.
- The parent reads and accepts the Privacy Policy on the child's behalf when creating the child profile.
- Parent can view, edit, or delete the child profile at any time. Deletion cascades to the child's challenges and quiz attempts (redemption audit docs are anonymized — `childId` replaced with `'deleted'` — but the random-draw audit trail itself is retained for the platform's integrity).

### What we never do

- No public child names or photos.
- No site messaging between adults and children, or between children.
- No third-party trackers, no advertising, no analytics on pages a child interacts with.
- No retention beyond program need; an annual cleanup script archives child profiles inactive >18 months.

### Privacy Policy must always disclose

- Categories of information collected.
- Purpose of collection (running the reading challenge).
- Third parties data is shared with (Firebase / Google as the data processor; Open Library / Google Books for book metadata only; Gemini for quiz generation only on book metadata, never on child data).
- Parent rights: review, delete, refuse further collection.
- Contact email for COPPA requests — **must** be sourced from `/{tenantId}/_main.support.coppaContactEmail`, never hardcoded. After handoff, the receiving organization is the right COPPA contact for their tenant; Luckey Logic stops being the right answer the moment they take ownership.

---

## 7. Legal disclaimers

### 7.1 Epic Games disclaimer

The canonical disclaimer string lives at `siteContent.legal.epicGamesDisclaimer`:

> "Fortnite and V-Bucks are trademarks of Epic Games, Inc. This program is not affiliated with or endorsed by Epic Games."

It appears in:

- Site footer (every page).
- About page, prominently.
- Terms of Service.
- Privacy Policy.
- Any marketing copy that mentions V-Bucks.
- The `LICENSE` file (trailing trademark notice section).

If Epic ever requests removal of any Fortnite-styled visual or reference, Luckey Logic complies immediately and updates the hero asset + any affected copy via a `siteContent.js` change + Storage upload.

### 7.2 Two-layer Terms / Privacy: base + tenant supplement

Library Loot ships a **base** Privacy Policy and Terms of Service that apply to every instance regardless of who operates it. Individual tenants can OPTIONALLY publish a **supplement** that adds tenant-specific terms (the library's own contact, jurisdiction, in-person pickup rules, local data-retention practices, etc.). Both layers render on the same page; the precedence rules are explicit.

#### Where supplements live

```js
// /{tenantId}/_main.legal
{
  privacyPolicySupplement: '<markdown>',   // optional, edited via admin panel
  privacyPolicySupplementUpdatedAt: Timestamp | null,
  termsSupplement:         '<markdown>',
  termsSupplementUpdatedAt: Timestamp | null
}
```

ITEM 2e exposes a textarea per supplement in the admin Settings panel. Empty / unset = no supplement appears.

#### Precedence rules (the actual contract)

Render order on each legal page:

1. **Base policy** (the current Privacy / Terms text — same on every tenant).
2. **Tenant supplement** (if present), in a clearly-labeled section: "Additional terms from \<organization name\>".
3. Footer trademark + COPPA contact, both pulled from the tenant's `_main.support`.

Conflict resolution, stated verbatim in the base policy:

> **The base policy and any tenant supplement together form this agreement. Where they overlap:
> - The **base** policy controls for platform-wide topics: COPPA, the categories of information collected, the third-party service providers (Firebase, Open Library, Gemini), the prize-draw verifiability mechanism, and the open-source codebase.
> - The **supplement** controls for tenant-specific topics: who the operator is, how prizes are physically distributed at that library, the operator's contact information, and any local-law obligations the operator is subject to.
> - A supplement may **add** protections but cannot **lower** the protections in the base policy. Conflicts that try to lower base-policy protections (e.g., a supplement trying to allow advertising or third-party data sharing the base forbids) resolve in favor of the base.**

This protects users (the base floor cannot be eroded), gives tenants real autonomy (the supplement covers the topics they actually own), and gives Luckey Logic a clean answer when asked "whose terms apply?" — both, with this precedence.

#### Admin UI (ITEM 2e)

- Markdown editor for each supplement.
- "Save" updates the supplement + its `updatedAt` timestamp.
- Preview pane shows the rendered base + supplement so the admin sees exactly what users see.
- Plain-language note above the editor: "Adding terms here adds to Library Loot's base policy — it can't replace it."

---

## 8. First-admin bootstrap (provisioning a new tenant)

Every new tenant needs a way to land its first authenticated admin securely, without anyone (Luckey Logic OR the library) having to touch the Firebase Console. The Console is fragile (any misclick can break security rules) and assumes a level of comfort the librarian shouldn't need.

### Setup token flow

1. **Provisioning.** Luckey Logic runs `scripts/seed-tenant.js <tenantId> <contactEmail>` (ITEM 8). The script:
   - Creates `/{tenantId}/_main` with default settings.
   - Generates a one-time setup token (32 random bytes, hex-encoded — 64 chars).
   - Stores its **hash** (SHA-256) — never the plaintext — in a global meta collection:
     ```
     /_setup_tokens/{tokenHash}
       tenant     : 'pembervill-public-library'
       expiresAt  : Timestamp (now + 30 days)
       used       : false
       contactEmail: 'librarian@pembervilllibrary.org'
     ```
   - Prints the plaintext token to the operator (Luckey Logic) once. It is never stored or recoverable. Treat it like an API secret.

2. **Handoff.** Luckey Logic sends the plaintext token to the library's first admin via a secure channel (signed email, in-person handoff, encrypted message). Includes the link: `https://<tenant-site>/admin/setup`.

3. **Claim.** The first admin opens `/admin/setup`, picks a sign-in method (Google, Email/Password, Facebook), completes auth in the browser, then pastes the setup token. The browser calls a Cloud Function `claimSetupToken({ token })`:
   - Computes SHA-256 of the submitted token.
   - Looks up `/_setup_tokens/{tokenHash}`.
   - Verifies `used == false`, `expiresAt > now`.
   - Reads the authenticated caller's `uid`.
   - Sets custom claims `{ admin: true, tenant: '<tenantId>' }` on the caller.
   - Creates `/{tenantId}/_main/users/{uid}` with `role: 'admin'`.
   - Marks the token `used: true, usedAt: now, usedBy: uid`. Used tokens are kept for audit but cannot be re-claimed.
4. **First admin can invite more admins.** From their dashboard, the first admin can issue further admin invites — same token mechanic, but generated and emailed automatically from inside the app. No need for Luckey Logic to be involved past the first one.

### Why this is safe

- The plaintext token is never in Firestore — only its hash is. A read of the entire `_setup_tokens` collection still gives no claimable tokens.
- Single-use — once claimed, the token is locked.
- Time-limited — expires in 30 days; expired tokens cannot be claimed even if leaked.
- Tied to one tenant — a token issued for `pembervill-public-library` can never grant admin on `luckey-logic`.
- The Cloud Function is the only path that sets custom claims. The client never writes claims directly.

### Why this avoids the Firebase Console

The Console requires a Firebase account on the project. After handoff, Luckey Logic is no longer a project owner — the library is. The library's admin claims their account through the app via the setup token, with no Console access ever required. Luckey Logic never has to provision admins on a library's behalf and is no longer responsible for their data once the handoff is complete.

---

## 9. Handoff procedure

When a library wants to take operational ownership:

1. **Pre-handoff conversation** — confirm what the library wants to host, who their admins are, what their custom domain is.
2. **Library creates their own Firebase project** (Spark plan to start; upgrade as needed).
3. **Run `scripts/export-tenant.js {tenantId}`** in Luckey Logic's project — produces a portable bundle (`tenant-{tenantId}-{date}.tar.gz`) containing all Firestore docs and Storage objects under their tenant root.
4. **Library imports the bundle** with `scripts/import-tenant.js` against their new Firebase project.
5. **Library deploys** the same source code with their new Firebase Web App config in `src/firebase.js` (or via the `setup-new-project.md` checklist).
6. **Smoke-test the new instance** (login, scan a book, run a quiz, perform a draw).
7. **Run `scripts/delete-tenant.js {tenantId}`** in Luckey Logic's project — removes the tenant root from Firestore + Storage. Library is now sole owner.
8. **Post-handoff support** — Luckey Logic stays available for code questions; the library owns their billing, content, and users.

The handoff scripts and playbook are ITEM 8.

---

## 10. Persistence keys / app state

Client-side persistence is minimal. We use `localStorage` only for:

- `ll.activeChildId` — which child profile the parent is currently acting as
- `ll.lastTenant` — the tenant the user last logged into, for routing back after auth

Anything else lives in Firestore.

---

## 11. Contingency plan — Fortnite branding withdrawal

Operational playbook for the scenario where Library Loot has to remove its Fortnite-themed branding. The public-facing FAQ at `/faq` summarizes this for users; this section is the operator's reference.

### 11.1 Triggers

Any of the following kicks off the plan:

- Epic Games sends a cease-and-desist, DMCA notice, or otherwise revokes Fan Content Policy permission.
- Counsel review (Luckey Logic's or a tenant's) advises a change.
- A library that has taken operational ownership chooses to rebrand voluntarily.

### 11.2 Critical invariant — existing prizes are safe

**Giving away V-Bucks gift cards purchased commercially is independent of the Fan Content Policy.** The policy restricts BRANDING and PROMOTION using Epic IP; it does not restrict who can hand out gift cards purchased at retail. This is a meaningful distinction:

- A library that bought a $10 V-Bucks card at Target can give that card to a kid as a prize, with or without Fan Content Policy permission. That's normal commercial gift-card distribution.
- What the Fan Content Policy permits is the *creative work* surrounding it — Fortnite-styled art, marketing copy that says "Read for V-Bucks", etc. If Epic withdraws permission, that creative wrapper comes down; the cards themselves stay legal as prizes.

Therefore, after a withdrawal:

- Existing V-Bucks cards in the donated pool stay in the pool until they're won.
- Already-completed redemptions are honored as drawn.
- Already-accepted challenges complete normally — read, quiz, draw, prize.
- The branding around the program changes, not the program's mechanics.

### 11.3 Operator actions (target: complete within 24 hours)

| What | Where | How |
|---|---|---|
| Swap hero asset | `siteContent.hero.imageUrl` | Upload new (original) art to Firebase Storage; replace URL string. One commit. |
| Remove "Summer of Library Loot" logo's Fortnite-styled glyph | `siteContent.hero.logoUrl` | Same — new logo PNG to Storage; URL swap. |
| Strip Fortnite / V-Bucks references from marketing copy | `siteContent.hero.*`, `howItWorks`, `prizeCategories`, `sponsorCTA` | Rewrite to brand-agnostic. Open prize categories to a wider set. |
| Remove Epic Games disclaimer | `siteContent.legal.epicGamesDisclaimer` | Set to empty string. About, Privacy, Terms, Footer, FAQ all source from this — emptying it removes everywhere. |
| Update FAQ entry on Fortnite affiliation | `siteContent.faq` | Rewrite to "we previously used Fortnite-styled art under Fan Content terms; we no longer do." |
| Note the change in CLAUDE.md session notes | `CLAUDE.md` | Record date, reason, response. |
| Email all parent accounts | Cloud Function or one-off mailer | 48-hour communication window. Template below. |

### 11.4 What does NOT change

- The platform's name (**Library Loot** — a generic phrase, not Epic IP).
- The color palette (purple / blue / gold — not Epic-trademarked).
- The display font (**Bungee** — public-domain-equivalent, not Burbank).
- The data model, the prize-draw verification mechanism, the COPPA approach.
- Open-source license and public repo.
- Multi-tenant architecture and handoff scripts.

### 11.5 Communication template (to all parent accounts)

> Subject: Library Loot is dropping Fortnite branding — your child's progress is unaffected
>
> Hi,
>
> Library Loot is retiring the Fortnite-styled visuals and "V-Bucks" wording on our site. Why doesn't matter much for you — what matters is what happens to your child's participation, which is:
>
> - Whatever they're reading, they keep reading. Their quiz works. Their prize draw fires when they finish.
> - If they've already won a prize, they still get it.
> - V-Bucks gift cards already donated to the program will still be given out to the kids who earn them. Epic's policy is about how you BRAND a program, not who can give the cards away.
> - Going forward, prize categories broaden — Amazon books, Nintendo eShop, PlayStation/Xbox, local store cards, etc.
>
> The program keeps running. Just looks different.
>
> If you have questions, reach the operator of this Library Loot instance at \<programContactEmail>. The full operational details are in our public repo at github.com/LuckeyLogic/LibraryLoot (SPEC.md §11).
>
> — \<operatorName>

### 11.6 Tenant-coordination (multi-tenant edge cases)

If the trigger comes during Luckey Logic's hosting of multiple tenants:

- The codebase change is applied platform-wide automatically — single source, single deploy.
- Tenant admins are notified the same day so they can communicate with their own users.

If a tenant has migrated to their own Firebase project:

- That tenant operates independently and is responsible for their own response.
- Luckey Logic posts the recommended branch (post-Fortnite) and a migration note as a courtesy. Tenants choose whether to merge.

### 11.7 Audit trail

Every step lands in a normal git commit on `main` so the public record reflects what changed, when, and why. No private channel; this is operationally transparent by design.

---

## 12. Roadmap pointers

Detailed item list lives in `CLAUDE.md`. This SPEC.md only locks behavior contracts and data shapes. When a contract changes, update this file in the same commit as the code.
