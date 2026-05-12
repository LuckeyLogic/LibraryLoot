# Library Loot — Claude Code Project Guide
> **Library Loot | Community-funded reading rewards for libraries**
> Developed by **Luckey Logic LLC** | © 2026 Luckey Logic LLC
> Last updated: 2026-05-12

---

## ⚠️ IMPORTANT — READ FIRST

This file is the source of truth for every Claude Code session on this project. Before doing anything:

1. **Read this entire file**
2. **Read `SPEC.md`** at the repo root — the canonical data model, prize-selection algorithm, COPPA approach, legal disclaimers, and handoff procedure live there
3. **Read every file listed in the "Read First" section** below
4. **Scan the project structure** for unlisted files — flag, recommend, wait for Miguel's decision
5. **Check in with Miguel before starting each build item** — describe what you're about to do, wait for explicit approval
6. **Update this file after each completed item** — mark ✅, add session notes, update tech stack versions
7. **Update this file in the same commit as the work it describes.** This file IS committed to git and lives in a **public repo** — be deliberate about what you write into it

---

## 🌐 Public Repository — Extra Git Hygiene

The repo lives at [github.com/LuckeyLogic/LibraryLoot](https://github.com/LuckeyLogic/LibraryLoot) and is **public**. Everything in this section is non-negotiable.

### Never commit

- Firebase config keys for an environment that isn't strictly the public web app config (web app config keys are not secrets — they're scoped by Firestore/Storage rules + bundle ID — but any **service-account JSON, Cloud Function admin credential, OAuth client secret, or third-party API key** is forbidden).
- `.env*` files.
- Anything under `temp folder for assets/` (this folder is `.gitignore`d — local-only).
- Personal data, real user data, real submissions, real librarian credentials.
- Any image that contains recognizable third-party IP characters that we are NOT explicitly using under Fan Content terms (see "Fan Content Policy" section).

### Always

- Branch per feature (`item-N-short-description`). PR back to `main`. Squash-merge.
- Run `npm run build` before pushing.
- One feature = one PR = one commit on `main`.
- Force-push only to feature branches, never `main`.
- Commit messages: `feat: …`, `fix: …`, `docs: …`, `chore: …`. Imperative mood. Body wraps at 72.

---

## 🏷️ Multi-Tenant Architecture — CRITICAL

Library Loot is built so multiple libraries (or other community orgs) can run their own instance — either **hosted in Luckey Logic's Firebase project under their own root collection** (v1 default), or **migrated to the library's own Firebase project** when they want operational ownership.

### The rule

**Every Firestore document and Storage path lives under the active tenant's root.** No code anywhere hardcodes a tenant ID. All paths go through `src/firebase/tenant.js`.

```
Firestore                                            Storage
─────────                                            ───────
/luckey-logic/_main                                  /luckey-logic/assets/...
/luckey-logic/_main/books/{bookId}                   /luckey-logic/sponsors/{sponsorId}/logo.jpg
/luckey-logic/_main/prizes/{prizeId}
/luckey-logic/_main/sponsors/{sponsorId}
/luckey-logic/_main/users/{uid}
/luckey-logic/_main/users/{uid}/children/{childId}
/luckey-logic/_main/challenges/{challengeId}
/luckey-logic/_main/redemptions/{redemptionId}

/pembervill-public-library/_main                     /pembervill-public-library/assets/...
/pembervill-public-library/_main/books/{bookId}      ...
...
```

- The tenant ID is the top-level collection name. Each tenant gets exactly one `_main` doc holding tenant-level settings (active reward modes, configured entropy providers, organization name, etc.) plus subcollections.
- The structure under every tenant root is **identical**. Only the root key changes.
- **Firestore Security Rules** enforce that authenticated requests can only touch their own tenant's root.
- **No `collectionGroup` queries across tenants.** If we need one, it must be explicitly scoped and reviewed for tenant isolation.
- **Storage Rules** mirror the same boundary: a user's claims pin them to one tenant; rules check the first path segment against that claim.

### Provisioning a new tenant

1. Add a new top-level collection key (e.g., `pembervill-public-library`).
2. Run the seed script (ITEM 8) — creates the `_main` doc with default settings and the empty subcollections.
3. Set the tenant's logo + branding in `_main`.
4. Create the first admin user; set custom claims `{ admin: true, tenant: 'pembervill-public-library' }`.

### Handoff to another org's Firebase project

When a library wants to take operational ownership:

1. Export their tenant's Firestore root and Storage prefix using the export script (ITEM 8).
2. The library creates their own Firebase project.
3. Import the data into the new project at the same path.
4. They redeploy the same source with their new Firebase config in `src/firebase.js`.
5. Once verified, delete the tenant's root from Luckey Logic's project.

The receiving org gets the full, working system. Luckey Logic stops paying their bill. No lingering coupling.

---

## 🎨 Fan Content Policy — Fortnite / V-Bucks Usage

Library Loot uses Fortnite-styled art and references V-Bucks as a prize option under Epic Games' [Fan Content Policy](https://www.epicgames.com/site/en-US/fan-art-policy). This is **not** an Epic Games partnership.

### Constraints we always meet

- **No money flows through Library Loot.** Neither the platform, the libraries, nor Luckey Logic profits from the rewards. Funds donated for prizes go directly to prize purchases — site-side never holds gift card balances.
- **Disclaimer everywhere it could matter.** Footer of every page, About page, ToS, Privacy Policy, and any marketing copy that mentions V-Bucks. Single string source in `siteContent.legal.epicGamesDisclaimer`.
- **No claim of endorsement.** No "Fortnite-approved Library Loot," no "Powered by Epic," no Epic logos.
- **Audience-appropriate.** This is a kids' reading program; tone matches Epic's expectation for fan content.
- **Easily swappable.** Hero art and any Fortnite-styled visuals live in Firebase Storage with URLs in `siteContent.js`. Pulling them is one upload + one string change.

If Epic ever pushes back, we comply immediately, swap the art, and rename anything that depends on Fortnite branding (the site name itself — "Library Loot" — is generic and stays).

### What can ship

✅ Fortnite-*style* (vibrant gaming palette, blocky display fonts, energetic poses, loot chests, lightning).
✅ The name "Library Loot."
✅ Naming V-Bucks gift cards as one of multiple prize categories.
✅ The current hero PNG, under Fan Content terms with disclaimers in place — flagged as swappable at first sign of pushback.

### What never ships

❌ Epic Games logos, Fortnite logos, or anything implying endorsement.
❌ Roblox in any form — Miguel's explicit exclusion.
❌ Mocking Epic's official marketing layouts (don't imitate Fortnite splash screens, store pages, etc.).

---

## 🔒 Deployment & Version Control

### `.gitignore` — committed to repo, contents:

- `node_modules/`, `dist/`, `dist-ssr/`
- `.env*`, `*.pem`, `service-account*.json`
- `.firebase/`, `firebase-debug.log`
- `.DS_Store`, `.vscode/*` (with exceptions), `.idea/`
- `temp folder for assets/`
- `*.log`
- `docs/` (JSDoc output)
- `.claude/`

### `.firebaseignore` — committed to repo

Excludes everything except `dist/` from the hosting deploy. Source files, configs, CLAUDE.md, SPEC.md, README.md, LICENSE, scripts, public uploads — none of these ship to Hosting.

### What IS committed (intentional)

- `CLAUDE.md`, `SPEC.md`, `README.md`, `LICENSE` — public docs for anyone reading the repo or taking over the project.
- `src/firebase.js` — once wired in ITEM 1, contains the Firebase Web App config (not a secret — scoped by Security Rules).
- `firestore.rules`, `firestore.indexes.json`, `storage.rules` — once they exist.
- `functions/` source — Cloud Function code (no secrets in source; secrets via Firebase Secret Manager).

---

## 📐 Style Guide

Inherited from Miguel's mcl-central / sara-sorts JS style. Non-negotiable.

### Indentation & Alignment

- **2-space indentation** throughout JSX and JS files.
- Property assignments in constructors and `toDict()` methods are **right-padded to align `=`** or `:` at a consistent column:
  ```js
  this.id        = id
  this.title     = title
  this.imageUrl  = imageUrl
  ```
- In import statements, `from` keywords are **right-aligned** within each import group:
  ```js
  import React, { useState } from 'react'
  import { Link, NavLink }   from 'react-router-dom'
  import { auth }            from '../firebase'
  ```

### Brace & Bracket Style

- Opening braces `{` on the **same line** as the declaration.
- Arrow functions: `const Name = () => { ... }`.

### Spacing & Blank Lines

- **One blank line** between import groups.
- **One blank line** between class methods.
- Section dividers: `// ── SECTION NAME ──`.
- File header block at the top of every model file and component file.

### Import Ordering

1. React / React hooks
2. Third-party libraries
3. Local components
4. Local contexts / hooks
5. Local utilities / data / models
6. CSS Modules (always last)

### Component Structure Order

1. Constants / static data (outside the component)
2. Component function with JSDoc block above
3. Hook calls (grouped, aligned)
4. `useEffect` hooks
5. Handler functions
6. `return` JSX

### Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Components | PascalCase | `Navbar`, `BookCard` |
| Functions / variables / props | camelCase | `handleSubmit`, `currentUser` |
| Model classes | PascalCase | `Book`, `Challenge`, `Redemption` |
| Model methods | camelCase (new) | `toDict`, `fromDict` |
| CSS Module classes | camelCase | `styles.heroLeft`, `styles.lootChest` |
| Constants | camelCase arrays/objects; `SCREAMING_SNAKE_CASE` only for true enums | |
| Firestore converter exports | camelCase + `Converter` suffix | `bookConverter` |

### CSS Module Conventions

- One `.module.css` per component, named to match.
- Class names: **camelCase**.
- Global utility classes (`.btn`, `.container`, `.section-title`) live in `src/index.css`.
- **Never hardcode** color or font values — always `var(--neon-purple)`, `var(--font-display)`, etc.
- Inline `style={{ }}` only for true one-off overrides.

### JSDoc Standards

- Every React component, exported function, model class, utility function — all get JSDoc.
- Components: `@param {Object} props` with every prop typed and described.
- `@returns {JSX.Element}` on every component.
- Optional params wrapped `[brackets]` with `(Optional)` at the end of the description.

**Component template:**
```js
/**
 * ComponentName — One-line description of what this component renders.
 * @param {Object}   props
 * @param {string}   props.propName  - Description.
 * @returns {JSX.Element}
 */
export default function ComponentName({ propName }) {
```

---

## 📁 Read First — Library Loot Codebase

After reading this file and `SPEC.md`, read every file below and report what each does in one sentence. Confirm understanding with Miguel before changes.

```
src/main.jsx
src/App.jsx
src/index.css
src/firebase.js
src/firebase/tenant.js
src/data/siteContent.js
src/components/Navbar.jsx
src/components/Footer.jsx
src/components/Disclaimer.jsx
src/pages/Home.jsx
src/pages/About.jsx
src/pages/Donors.jsx
src/pages/Terms.jsx
src/pages/Privacy.jsx
src/pages/NotFound.jsx
package.json
vite.config.js
index.html
.gitignore
.firebaseignore
LICENSE
README.md
SPEC.md
jsdoc.config.json
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18.x |
| Build | Vite | 5.x |
| Routing | React Router | 6.x |
| Auth | Firebase Authentication (Google + Email/Password + Facebook) | 10.x |
| Database | Cloud Firestore | 10.x |
| File Storage | Firebase Storage | 10.x |
| Cloud Functions | Firebase Cloud Functions (Node 22) | TBD |
| Hosting | Firebase Hosting | — |
| AI (quiz generation, grading assistance) | Firebase AI Logic / Vertex AI — Gemini 2.0 Flash | TBD |
| Random entropy (prize draw) | drand (primary) → random.org (fallback) → `crypto.randomBytes` (final fallback) | — |
| CI/CD | GitHub Actions → Firebase Hosting (live + PR previews) | — |
| Styling | CSS Modules + global `src/index.css` | — |
| Documentation | JSDoc | 4.x |
| Version Control | Git → GitHub `LuckeyLogic/LibraryLoot` (**Public**) | — |
| Domain | TBD (subdomain of luckeyliving / luckeylogic / partner library) | — |

---

## 📋 Rules for Claude Code

1. **Multi-tenant first** — every Firestore / Storage path goes through `src/firebase/tenant.js`. No hardcoded tenant IDs in queries.
2. **Style first** — every file follows the Style Guide. Column alignment is mandatory.
3. **Check in before each build item** — describe what you're about to do, wait for explicit approval.
4. **Batch simple items** — propose batching consecutive simple items. Always ask, never assume.
5. **One complex item at a time** — Cloud Functions, Firestore rule changes, auth flows, new npm packages: always solo.
6. **Update this file after each item** — ✅ mark, session notes, tech stack versions.
7. **Public repo discipline** — never commit secrets, service accounts, real user data, or unapproved third-party IP imagery.
8. **CSS Modules only** for component styles. CSS variables for every color / font / radius. Never hardcode.
9. **JSDoc always** — every component, function, model, utility gets JSDoc.
10. **`npm run build` after major changes** to confirm no errors.
11. **Commit after each approved item** — atomic commits, descriptive messages.
12. **Don't push** until Miguel confirms it works in the browser.
13. **Compliance** — flag any feature touching child data. COPPA stance lives in SPEC.md; Privacy Policy must stay current.
14. **Luckey Logic credit** — present in the footer of all pages, never removed without explicit instruction.
15. **Epic Games disclaimer** — present in the footer and in any V-Bucks marketing copy. Source string in `siteContent.legal.epicGamesDisclaimer`.

---

## ✅ Build List

Status legend: `[ ]` not started, `[~]` in progress, `[✅]` done.

### [✅] ITEM 0 — Initial Scaffold

- Vite React app, package.json, vite.config.js, index.html
- Root configs: .gitignore, .firebaseignore, jsdoc.config.json, README.md, LICENSE, CLAUDE.md, SPEC.md
- src/firebase.js placeholder
- src/firebase/tenant.js — single source of tenant root path
- src/index.css with Fortnite-inspired palette + display fonts
- src/main.jsx + src/App.jsx with router
- src/data/siteContent.js — site-wide copy + legal disclaimers
- src/components/Navbar, Footer, Disclaimer
- src/pages/Home, About (with JAMBO origin story), Donors, Terms, Privacy, NotFound
- Hero background + Summer of Library Loot logo wired into the home page
- JAMBO origin-story section wired into the About page
- All three assets optimized and served from `public/assets/` (ITEM 1 moves them to Firebase Storage)
- JSDoc on every component
- `npm run build` passes

### [ ] ITEM 1 — Firebase Project Wiring + Initial Deploy

- Wire real Firebase Web App config into `src/firebase.js`
- `firebase init` → Firestore, Functions (Node 22), Hosting, Storage
- Deploy security rule stubs (deny-by-default)
- Upload the three optimized assets currently in `public/assets/` to Firebase Storage at `/luckey-logic/assets/`:
  - `library-loot-hero-bg.jpg` (hero)
  - `summer-of-library-loot.png` (logo)
  - `jambo.jpg` (origin-story image)
- Update `siteContent.js` URLs from `/assets/...` (public/) to the Firebase Storage download URLs
- Delete `public/assets/` (no longer needed — assets live in Storage)
- **Delete the `temp folder for assets/` directory** (already gitignored; remove from local filesystem)
- GitHub Actions workflows: `firebase-hosting-merge.yml` + `firebase-hosting-pull-request.yml`
- First deploy to confirm pipeline works end-to-end

### [ ] ITEM 2 — Auth + Roles + First-Admin Bootstrap

- Firebase Auth providers: Google Sign-In, Email/Password, Facebook
- `AuthContext` + `useAuth` hook
- `PrivateRoute` + `AdminRoute` wrappers
- Custom claims: `{ admin: bool, tenant: string }` set ONLY by Cloud Functions, never written from the client
- **First-admin setup-token flow** (see SPEC.md §8):
  - Cloud Function `claimSetupToken({ token })` — verifies hashed token in `/_setup_tokens/{hash}`, sets custom claims, creates user doc, marks token used
  - `/admin/setup` route in the app — UI for the first admin to paste their token after signing in
  - Cloud Function `issueSetupToken()` — callable by an existing admin to generate a fresh token for a new admin invite (emails the new admin a one-time link)
- Parent account page; UI to create child sub-profiles (first name only, optional birth year, no email, no last name)
- Firestore Security Rules enforcing tenant + role boundaries (deny by default; allow if `request.auth.token.tenant == resource path tenant`)
- Settings panel for admins to edit `/{tenantId}/_main.support` block (organizationName, programContactEmail, coppaContactEmail, etc.) — the About / Privacy / Terms pages start reading these live values instead of the siteContent defaults

### [ ] ITEM 3 — Book Management (Admin)

- ISBN/barcode scanner (`@zxing/browser`)
- Open Library API integration (fallback: Google Books)
- Admin "Add Book" flow: scan → fetch metadata + cover → review → save
- Book detail page (public read)
- Firestore: `/{tenant}/_main/books/{bookId}`

### [ ] ITEM 4 — Prize Management (Admin) + Donor Recognition + Sponsor Intake

- `/{tenant}/_main/prizes/{prizeId}` — kind (Fortnite-only enum v1), label, qtyAvailable, active, donorId
- `/{tenant}/_main/sponsors/{sponsorId}` — name, type (individual|business), logoPath, website, message, anonymous
- `/{tenant}/_main/sponsorInquiries/{id}` — name, email, donation description, status (new|contacted|received|closed)
- **Replace the `/sponsor` placeholder page with a real intake form** that writes to `sponsorInquiries`. The form does NOT take payment — sponsors describe what they're dropping off and how to contact them
- Sponsor logo upload → Firebase Storage at `/{tenant}/sponsors/{sponsorId}/logo.{ext}`
- Public Donors page surfacing sponsor recognition (from `sponsors` collection)
- Admin dashboard: review `sponsorInquiries`, convert an inquiry into a `sponsors` + `prizes` record once the prize is physically received at the library

### [ ] ITEM 5 — Challenge Lifecycle + Quiz Verification

- `/{tenant}/_main/challenges/{challengeId}` — state machine: open → accepted → submitted → approved → rewarded
- Quiz authoring flow: AI-assisted (Firebase AI Logic + Gemini 2.0 Flash) → librarian approval → publish
- Quiz pool of 15-20 questions per book; quiz samples 8 randomly per attempt
- Time-limited attempt; submission requires final approval from librarian or parent before reward release

### [ ] ITEM 6 — Verifiable Random Prize Draw

- Cloud Function `redeemPrize(challengeId)`:
  - Entropy chain: drand → random.org → `crypto.randomBytes`
  - Snapshot prize pool, weighted draw, decrement quantity, write immutable `/redemptions/{id}` audit doc
  - Anyone can re-run the math from the audit doc
- Result screen shows the prize + the donor recognition (logo / name / message)

### [ ] ITEM 7 — Public Browse + Display-Table Cards

- Browse active challenges page
- Per-book public landing page with reward summary
- Printable display-table card generator (one QR code per active book) for the physical library display

### [ ] ITEM 8 — Handoff Scripts

- `scripts/seed-tenant.js` — provisions a fresh tenant root with defaults
- `scripts/export-tenant.js` — dumps all Firestore docs + Storage prefix to a portable bundle
- `scripts/import-tenant.js` — restores a bundle into another Firebase project
- `scripts/setup-new-project.md` — step-by-step playbook for a library taking ownership

---

## 🚫 Blacklist

| Pattern | Reason |
|---|---|
| `.DS_Store` | macOS metadata |
| `.claude/` | Claude Code session metadata |
| `node_modules/` | Dependencies |
| `dist/` | Build output |
| `temp folder for assets/` | Local-only staging area for assets pre-Storage |
| `service-account*.json` | Firebase Admin SDK credentials — never commit |
| `.env*` | Environment files — never commit |

---

## 📝 Session Notes

### 2026-05-12 — Project kickoff

- Project concept defined: community-funded reading rewards. Adults sponsor, kids read, verifiable random draw awards a donated prize. **The site never handles money.** All v1 donations are physical drop-offs at the library (V-Bucks gift cards, Fortnite Legos, posters, action figures). The librarian logs them into the prize pool.
- Decisions locked: MIT license; Firebase backend only (Auth + Firestore + Storage + Functions + Hosting); Google + Email/Password + Facebook auth; AI-assisted quiz generation with librarian approval; Firebase AI Logic (Gemini 2.0 Flash) over Anthropic API for transferability; multi-tenant per-org root collection from day one; CLAUDE.md and SPEC.md committed (public repo).
- **v1 prizes are Fortnite-only** — V-Bucks, Legos, action figures, apparel, posters. Rationale: keeps the site squarely inside the Epic Games Fan Content Policy. Mixing non-Fortnite prizes (Amazon, Nintendo, etc.) shifts the framing toward "branding used to promote unrelated commerce," which is exactly what the Fan Content Policy doesn't cleanly cover. Revisit only if/when we drop Fortnite branding.
- Fan Content Policy stance: keep the hero PNG with Fortnite-character likenesses, ship with prominent disclaimers in the footer and in About / ToS / Privacy, make the art easily swappable at first sign of pushback. No commercial use anywhere in the pipeline.
- Origin story added: Jackson (Miguel's son) asked if he could earn V-Bucks for reading books at the school book fair — that's the entire idea. The fan-art-style portrait `JAMBO.png` sits in a dedicated story section on the About page.
- ITEM 0 complete: Vite/React scaffold, theme, layout shell, six pages, hero bg + Summer of Library Loot logo wired in, origin-story section on About. Assets currently served from `public/assets/`; ITEM 1 migrates them to Firebase Storage.
