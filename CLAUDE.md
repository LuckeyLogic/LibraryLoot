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
src/context/AuthContext.jsx
src/components/Navbar.jsx
src/components/Footer.jsx
src/components/Disclaimer.jsx
src/components/PrivateRoute.jsx
src/pages/Home.jsx
src/pages/About.jsx
src/pages/Donors.jsx
src/pages/Sponsor.jsx
src/pages/Login.jsx
src/pages/Signup.jsx
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
firebase.json
firestore.rules
storage.rules
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
9. **JSDoc always** — every component, function, model, utility gets JSDoc. **Update the JSDoc and any references in `jsdoc-readme.md` in the SAME commit as the behavior change.** Docs drift quietly otherwise — the build trail (SHA + date in the docs footer) helps catch it, but the cheapest fix is not letting it happen.
10. **Periodic docs review** — when wrapping up an ITEM that materially changed how something works (new collection, renamed function, removed flow), explicitly read `jsdoc-readme.md` plus the JSDoc on every file in that area and confirm it still describes the current behavior. Treat stale prose as a bug.
11. **`npm run build` after major changes** to confirm no errors.
12. **Commit after each approved item** — atomic commits, descriptive messages.
13. **Don't push** until Miguel confirms it works in the browser.
14. **Compliance** — flag any feature touching child data. COPPA stance lives in SPEC.md; Privacy Policy must stay current.
15. **Luckey Logic credit** — present in the footer of all pages, never removed without explicit instruction.
16. **Epic Games disclaimer** — present in the footer and in any V-Bucks marketing copy. Source string in `siteContent.legal.epicGamesDisclaimer`.

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

### [✅] ITEM 1 — Firebase Project Wiring + Initial Deploy

- Real Firebase Web App config wired into `src/firebase.js` (project ID `library-loot`)
- `firebase init` completed for Firestore, Functions, Hosting, Storage, Remote Config, Extensions
- Hosting reconfigured from the Web Frameworks experiment to traditional static hosting (`"public": "dist"`) with SPA rewrite for React Router and aggressive cache headers (1 year immutable on `/assets/**`, no-cache on `*.html`)
- Functions Node engine pinned to 22 (default was 24)
- Security Rules deployed (`firebase deploy --only firestore:rules,storage`):
  - Firestore: deny-by-default (real per-tenant rules land with ITEM 2)
  - Storage: public-read on `/{tenantId}/assets/**`, deny-by-default everywhere else
- Three optimized assets uploaded to Storage and wired into `siteContent.js`:
  - `luckey-logic/assets/hero/library-loot-hero-bg.jpg`
  - `luckey-logic/assets/branding/summer-of-library-loot.png`
  - `luckey-logic/assets/story/jambo.jpg`
- `public/assets/` deleted (now in Storage)
- `temp folder for assets/` deleted (PNG originals no longer needed)
- GitHub Actions workflows generated: `firebase-hosting-merge.yml` (push to main → live) + `firebase-hosting-pull-request.yml` (PR → preview channel)
- `FIREBASE_SERVICE_ACCOUNT_LIBRARY_LOOT` GitHub secret installed by `firebase init hosting:github`

### ITEM 2 — Auth + Roles + First-Admin Bootstrap (sliced)

Broken into shippable sub-items so each is a clean PR.

#### [✅] ITEM 2a — Auth providers + AuthContext + login/signup UI

- Firebase Auth providers enabled in console: Google + Email/Password (Facebook deferred — small standalone follow-up if needed)
- `src/context/AuthContext.jsx` — `AuthProvider` + `useAuth` hook. Exposes `user`, `claims` (forward-looking, populated in 2b), `loading`, `error`, `isAdmin`, `tenantClaim`, plus `signInWithGoogle` / `signInWithEmail` / `signUpWithEmail` / `signOut`. ID token refreshed on every auth-state change so latest custom claims arrive immediately when 2b sets them.
- `src/components/PrivateRoute.jsx` — wraps a route; redirects to `/login` with `location.state.from` set so post-sign-in can bounce back. Built early; no routes use it until 2d.
- `src/pages/Login.jsx` + shared `Auth.module.css` — Google button + email/password form
- `src/pages/Signup.jsx` — same shell + two required consent checkboxes (18+ self-attestation + Privacy Policy / Terms acceptance). Submit gated on both checked. Google button also gated.
- Navbar — shows display name + Sign out when signed in; Sign in / Sign up when signed out
- Project Support email set to `libraryloot@luckeylogic.com` in Firebase Console
- Build: 79 modules, 475 KB JS / 130 KB gzipped (Firebase Auth SDK adds ~280 KB JS — could code-split later)

#### [✅] ITEM 2b — First-Admin Setup-Token Flow + Cloud Functions

- Cloud Function `claimSetupToken({ token })` deployed in `us-central1` (2nd gen, Node 22). Verifies SHA-256-hashed token, runs the consume+write+claim flow in a Firestore transaction, then sets `{ admin: true, tenant }` custom claims via Admin SDK. Single-use; 30-day TTL enforced at claim time.
- Cloud Function `issueSetupToken({ note })` deployed in `us-central1`. Caller must already have `admin: true` claim and a `tenant` claim. Generates 32 bytes hex, stores hash, returns plaintext once.
- `functions/src/setupTokens.js` — shared `hashSetupToken` helper.
- `/admin/setup` route in the app (gated by `PrivateRoute` — must sign in first). UI calls `claimSetupToken` via `httpsCallable`, force-refreshes the ID token on success so claims propagate to the AuthContext.
- `src/components/AdminRoute.jsx` — wraps a route, redirects to `/login` if unauthenticated or `/` if signed in but not admin. Built but not yet attached to any routes; 2c+ admin pages will use it.
- `scripts/seed-tenant.js` + `scripts/package.json` + `scripts/README.md` — one-off provisioning script that creates `/{tenantId}/_main` with defaults and prints a setup token plaintext to stdout. Authenticates via `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to a service-account JSON kept outside the repo.
- Artifact Registry container cleanup policy: 7 days (matches sara-sorts pattern).

#### [✅] ITEM 2c — Real Per-Tenant Firestore + Storage Rules + Tenant-Claim Bootstrap

- New Cloud Function `bootstrapTenantClaim` — HTTPS-callable, idempotent. Sets the caller's `tenant` custom claim (v1: hardcoded `luckey-logic`) and creates `/{tenant}/_main/users/{uid}` with `role: 'parent'` if missing. Fast-path early-returns if the claim is already set.
- AuthContext effect — on every sign-in, if `claims.tenant` is missing, calls `bootstrapTenantClaim`, then force-refreshes the ID token so the new claim arrives in client state immediately. Runs at most once per session.
- `claimSetupToken` updated — admin upgrade now merges into the existing parent user doc (created by `bootstrapTenantClaim`) instead of overwriting. `createdAt` is preserved; new field `promotedToAdminAt` records the admin upgrade timestamp.
- One-off `scripts/backfill-user-claims.js` — walks existing Firebase Auth users, sets the `tenant` claim and creates the user doc for any missing it. Ran clean: 1 user, already set up.
- New `firestore.rules` — per-tenant boundaries via `request.auth.token.tenant`. Helpers: `inTenant(tenantId)`, `isTenantAdmin(tenantId)`, `isSelf(uid)`. Coverage: `_setup_tokens` server-only; `_main` tenant-read/admin-write; users read by self or admin / write deny (server-only); children CRUD by parent or admin. Future collections (books, prizes, sponsors, challenges, redemptions, sponsorInquiries) get rules added per item.
- New `storage.rules` — public read on `/{tenant}/assets/**`, `/{tenant}/sponsors/{sponsorId}/**`, `/{tenant}/books/{bookId}/**`; admin-write on all of those; deny by default elsewhere.

#### [✅] ITEM 2d — Parent Dashboard + Child Sub-Profiles

- New `/account` page (`src/pages/Account.jsx`, PrivateRoute-wrapped). Live `onSnapshot` subscription to `/{tenantId}/_main/users/{uid}/children`. Header greets the parent by first name (derived via the same precedence rule as Navbar). Card grid below for existing kids.
- New `ChildCard` component (`src/components/ChildCard.jsx`) — avatar on the Fortnite-vibe gradient surface (matches the admin avatar manager and picker), first name in display font, optional age hint from birth year, **"Pending librarian verification"** badge by default OR gold **"Verified by librarian"** badge when `verified === true`. Edit / Delete actions.
- New `ChildForm` component (`src/components/ChildForm.jsx`) — controlled form for add OR edit. First name (required, max 40 chars), birth year (optional select from year range that covers ~4y-old preschoolers up to 18y-old HS seniors; "I'd rather not say" is the default), and avatar picker. Validates client-side; surfaces save errors inline.
- New `AvatarPicker` component (`src/components/AvatarPicker.jsx`) — live grid of the tenant's avatar pack from `/{tenantId}/_main/avatars`. Radio-group semantics, keyboard-accessible. Selected tile gets a gold border + corner check. Empty-state message points the parent at the librarian if the pack hasn't been populated yet.
- Child doc shape: `{ id, firstName, birthYear, avatarId, verified: false, verifiedBy, verifiedAt, createdAt, updatedAt }`. UUID-without-dashes IDs. Writes via `setDoc` (create) and `updateDoc` (edit).
- Delete confirmation prompt before removing a child doc. Server-side cascade of challenges/quiz attempts comes with ITEM 5; for now, just the child doc is removed.
- Navbar — "My account" link added in the auth slot, visible whenever a user is signed in (parent or admin). Admin still gets the Admin link in addition.
- "Next: verified at the library" callout appears below the grid once a parent has at least one kid, prepping them for the in-person step that gates the prize draw (ITEM 6).

#### ITEM 2e — Admin Dashboard (sliced)

##### [✅] ITEM 2e.1 — Admin shell + Settings panel + tenant-live legal pages

- New `useTenantSettings` hook (`src/hooks/useTenantSettings.js`) — live subscription to `/{tenantId}/_main` with `siteContent` fallbacks for unset fields. Exposes `{ settings, support, legal, loading, error }`.
- New `AdminLayout` (`src/components/AdminLayout.jsx`) — sidebar shell with tenant ID + sign-in identity + nav links (Overview / Settings / Avatars). Collapses to a top strip on mobile.
- New admin pages under `src/pages/admin/`:
  - `AdminIndex` — `/admin` landing. Operator-snapshot card, supplement-status card, "Coming next" avatars card.
  - `AdminSettings` — `/admin/settings` editor for `_main.support` (organization name, program / COPPA / privacy contact emails, mailing address, contact blurb) and `_main.legal.{privacyPolicySupplement, termsSupplement}` with `updatedAt` timestamps. Writes via `setDoc({merge:true})`.
- Navbar — adds `Admin` link in the auth slot when `useAuth().isAdmin === true`.
- About / Privacy / Terms — switched from `siteContent.support` defaults to `useTenantSettings()`. Privacy + Terms render a `TenantSupplement` section below the base policy when the tenant has supplements set (plain-text paragraphs split on double newlines).
- `firestore.rules` — `/{tenantId}/_main` is now **public-read**. The doc carries only operator contact + legal supplements + branding + verification config — none of it sensitive, all of it appropriate to surface on the public About / Privacy / Terms pages for anonymous visitors. Writes still restricted to tenant admins.
- Rules deployed via `firebase deploy --only firestore:rules`.

##### [✅] ITEM 2e.2 — Avatar manager + image optimizer

- New `src/utils/imageOptimize.js` — native Canvas-API client-side resize + recompress. Defaults to 512px longest side and PNG output to preserve transparency. Returns `{blob, width, height, sizeBefore, sizeAfter}` so the UI can show before/after byte counts. Reusable for sponsor logos (ITEM 4) and book covers (ITEM 3).
- `/admin/avatars` page (`src/pages/admin/AdminAvatars.jsx`) — CRUD for the tenant's default avatar pack.
  - Multi-file upload: pick → optimize → upload to `/{tenant}/avatars/{avatarId}.png` → write doc at `/{tenant}/_main/avatars/{avatarId}` with `{id, name, storagePath, downloadUrl, createdAt}`. Friendly default name derived from the filename.
  - In-flight queue shows per-file status (queued / optimizing / uploading / done / error) and byte savings (sizeBefore → sizeAfter). Done entries auto-clear after 2.5s.
  - Tile grid renders each transparent PNG on a Fortnite-vibe radial-gradient surface (Miguel's design: avatars are bgless, picker provides the gradient).
  - Per-tile Delete with confirmation. Removes both the Storage object and the Firestore doc. Tolerates already-deleted Storage objects so a partially-cleaned avatar can still be removed.
  - Resize Images Firebase Extension fires automatically on upload and produces thumbnails under `/{tenant}/avatars/thumbs/`. Not yet referenced by the picker — future optimization once the parent dashboard lands.
- Storage Rules — added `/{tenantId}/avatars/{file=**}` block: public read, admin write (matches the assets pattern). Deployed.
- Firestore Rules — added `/{tenantId}/_main/avatars/{avatarId}`: public read (so the picker can render the grid without auth), admin write. Deployed.
- AdminLayout sidebar — Avatars link gates correctly on `isAdmin`.

#### [✅] ITEM 2j — Parents & Guardians guide

- New `/for-parents` route (`src/pages/ForParents.jsx`). Narrative walkthrough of the parent's actual workflow: make an account → add a kid as a sub-profile → get the kid verified in-person at the library → pick a book → kid reads + quizzes → librarian/parent approval → verifiable prize draw → physical pickup at the library. Covers the standard parent concerns up front: data collection, safety, anti-cheat, what happens if Epic withdraws, how to delete a child profile.
- TL;DR block at top with ⚡-bulleted highlights so a scanner-reader gets the shape in 30 seconds; full numbered steps for the careful reader; gold-bordered callouts for the "why so little data" and "why no written reports" explanations.
- Tenant-specific operator contact via `useTenantSettings` so a library hosting their own instance sees their own contact at the bottom of the page.
- Cross-linked from Navbar (primary nav between About and Donors), Footer, and the FAQ tail block.

#### [✅] ITEM 2i — Cease-and-desist contingency plan + public FAQ

- **SPEC.md §11 — Contingency plan: Fortnite branding withdrawal.** Operational playbook covering: trigger scenarios (Epic C&D, counsel advice, voluntary rebrand), the critical invariant that existing V-Bucks gift cards stay distributable (Fan Content Policy restricts BRANDING, not commercial gift-card distribution), operator action checklist with target paths to change, what does NOT change (name, palette, font, data model), communication template to parent accounts, multi-tenant coordination, audit-trail discipline. Renumbered the existing roadmap section to §12.
- **Public FAQ page** at `/faq` driven by `siteContent.faq` (13 entries). Highlight question: "What happens if Epic asks Library Loot to stop using Fortnite branding?" — the user-friendly summary of SPEC.md §11. Other entries cover the prize-draw verifiability, anti-cheat layers, no-written-reports rationale, Roblox exclusion, COPPA data collection, deletion-then-anonymization audit policy, source code transparency, and the multi-tenant hosting model.
- **`FAQ.jsx`** uses HTML `<details>` for collapse/expand, custom styling with the ⚡ bullet marker for nested lists. Inline `**bold**` convention rendered without a markdown dep. Tail block surfaces the live tenant `support` email so users get the right contact for THIS instance (not Luckey Logic's by default after handoff).
- **Navbar + Footer** gained the FAQ link. About page gained a paragraph + link to the FAQ.

#### [✅] ITEM 2h — Docs Auto-Build + Deploy at `/docs`

- New `npm run build:all` runs `vite build` → `npm run docs` → `cp -r docs dist/docs`. Single command produces the full deploy artifact (React app + JSDoc docs site under `/docs/`). Both GitHub Actions workflows (`firebase-hosting-merge.yml` and `firebase-hosting-pull-request.yml`) call `build:all` so every push rebuilds and ships current docs.
- New `scripts/write-docs-build-info.js` runs as part of `npm run docs`. Captures the current git SHA, branch, and ISO timestamp into `jsdoc-template/static/scripts/ll-build-info.js` (gitignored — regenerated every build) as a `window.LL_BUILD` global.
- `ll-enhance.js` updated to consume `window.LL_BUILD`: replaces the footer build stamp with `Build YYYY-MM-DD HH:MM UTC · <sha> (branch)` where `<sha>` is a link to the exact GitHub commit. Also appends a "Source on GitHub" footer link. Falls back to a `<noscript>` GitHub link for JS-disabled visitors.
- Firebase Hosting serves `/docs/*` as real files; the existing SPA rewrite (`** → /index.html`) only fires for unmatched paths, so the docs site and React app coexist cleanly under one hosting target.
- Production verified: `library-loot.web.app/docs/` shows the current commit's docs after every merge.

#### [✅] ITEM 2g — Themed JSDoc Developer-Docs Site

- Adapted from the mcl-central template: copied `publish.js` + `tmpl/*` + the prettify-jsdoc/prettify-tomorrow stylesheets; bulk-renamed `mcl-` CSS / ID prefixes to `ll-`; replaced MCL branding strings in `layout.tmpl` with Library Loot equivalents; renamed `mcl-enhance.js` → `ll-enhance.js`.
- New `src/styles/tokens.css` is the single source of truth for design tokens (palette, typography, spacing, shape, effects, layout). `src/index.css` imports it; `jsdoc-template/static/styles/jsdoc-default.css` imports the same file (copied in by the `docs:sync-tokens` npm script before generation, then JSDoc copies it to `docs/styles/tokens.css`). One theme edit propagates to both surfaces.
- New `prettify-library-loot.css` syntax-highlighting stylesheet (night-purple base, gold/cyan accents).
- Drop the OpenSans webfont files mcl-central bundled — we use Google Fonts (Bungee + Nunito + JetBrains Mono) like the React app does.
- `jsdoc-readme.md` is the docs site front page.
- Output: `docs/` (gitignored). Generate locally with `npm run docs`.
- **Not deployed yet** — kept local for v1. Future task: serve at `library-loot.web.app/docs/` via a Firebase Hosting rewrite or as a separate Hosting target.

### ITEM 3 — Book Management (sliced)

#### [✅] ITEM 3a — Admin book CRUD + Open Library / Google Books lookup

- New `src/utils/isbn.js` — normalize / validate ISBN-10 and ISBN-13 with checksums; convert ISBN-10 → canonical ISBN-13. The ISBN-13 is the Firestore document ID for each book (uniqueness for free).
- New `src/utils/bookLookup.js` — fetches book metadata client-side. Open Library primary (`/api/books?bibkeys=ISBN:...&format=json&jscmd=data`); Google Books fallback (`/books/v1/volumes?q=isbn:...`). Both browser-callable (CORS-enabled, no auth). Returns a normalized `{ isbn13, title, authors, publishedYear, coverUrl, summary, source }`. Tolerates 404s and empty results gracefully so the form can degrade to manual entry.
- New `/admin/books` page (`src/pages/admin/AdminBooks.jsx`). Three concerns in one page:
  1. **ISBN lookup**: paste an ISBN → "Look up book" → review/edit pane appears with the fetched metadata. Duplicate-detection warns if the ISBN is already in the catalog.
  2. **Review / edit form**: editable cover URL, title, authors (comma-separated input → string[] on save), year, reading level (Early reader / Grade 3-5 / Middle grade / YA / Not specified), summary. Cover preview renders inline as you edit the URL. If the lookup found nothing, the form opens blank with the ISBN prefilled and a "couldn't find this — type it in by hand" hint.
  3. **Catalog grid**: live `onSnapshot` of the books collection. Cards show cover, title, authors (clamped to 2 lines + ellipsis), year + reading level + quiz status. Per-card actions: **Active toggle** (gold pill when active; flips with one tap), **Edit**, **Delete** (with confirmation). Inactive books are dimmed and tagged.
- Book Firestore doc shape:
  ```js
  { id: '<isbn13>', isbn13, title, authors: string[], coverUrl, publishedYear,
    readingLevel, summary, source: 'open-library' | 'google-books' | 'manual',
    active: true, quizApproved: false, addedBy, addedAt, updatedAt }
  ```
- `firestore.rules` — added `/{tenantId}/_main/books/{bookId}` block: public read (the catalog is publicly browseable on /books when ITEM 3c lands; the home page also reads it), admin write. Deployed to `library-loot`.
- `AdminLayout` sidebar — added "Books" nav entry between Settings and Avatars.

#### [✅] ITEM 3b — Camera-based ISBN barcode scanner

- Added `@zxing/browser` dependency (^0.2.0).
- New `src/components/IsbnScanner.jsx` — full-screen camera overlay. Uses `BrowserMultiFormatReader.decodeFromConstraints` with `facingMode: { ideal: 'environment' }` so phones pick the rear camera. Validates every read against `utils/isbn` and silently keeps scanning if the barcode isn't a valid ISBN (e.g., a UPC on the cellophane wrapper). On match: fires `onScan(isbn13)` with the canonical ISBN-13.
- Permissions UX — first open prompts the browser; denied / no-camera / error states each show a tailored help block with a "Type it instead" button that falls back to the manual ISBN input.
- Close on the × button, on backdrop click, or on Escape. Camera stream stopped on unmount via the controls returned by zxing.
- Targeting reticle overlaid on the video with four gold corner brackets.
- Wired into `/admin/books`: new **Scan barcode** button next to the ISBN input. On scan success: closes the scanner, fills the input, and auto-fires the lookup — one tap from scan to review pane.

#### Reading-level + age policy (cross-cutting; ITEM 5 wires enforcement)

- Decided in this commit: books carry both a coarse `readingLevel` bucket and fine-grained `minAge` / `maxAge` fields. `maxAge` is **optional** — leave null for books with broad appeal ("Harry Potter, ages 8 and up"); set it for books with a hard upper bound (picture books targeted at 3-6).
- Tenant setting `_main.verification.readingLevelEnforcement` picks the behavior at challenge acceptance: `'off'` / `'warn'` (default) / `'block'`. See SPEC.md §3.1.1.
- Enforcement happens at challenge acceptance (ITEM 5). Today this commit only updates the doc shape spec, the FAQ entry, the For Parents copy, and the ITEM 5 plan below.
- AdminBooks form still uses `readingLevel` only; the `minAge` / `maxAge` editor lands in a future tweak — non-blocking since ITEM 5 enforcement is what consumes them.

#### [ ] ITEM 3c — Public book browse + per-book detail page

- `/books` — public catalog grid, only `active: true` books
- `/books/:isbn` — per-book detail (cover, summary, "Accept challenge" CTA gated on sign-in)
- Home page surfaces a live count of active books with rewards

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
- **Reading-level enforcement at challenge acceptance** — see SPEC.md §3.1.1. Read `_main.verification.readingLevelEnforcement` (off / warn / block). Compute kid's age from `birthYear`; if `null`, skip enforcement. Compare against the book's `[minAge, maxAge]` (treat `maxAge: null` as no upper bound). On out-of-range with mode `'warn'`: show a soft-warning card BEFORE the HonestyPledge and record `acceptedDespiteAgeWarning: true` on the challenge doc. On `'block'`: refuse acceptance with a "pick a book in your range" message.
- **Reader's promise (honor-system pledge) at challenge acceptance** — `src/components/HonestyPledge.jsx` already exists (built during ITEM 2j). Wire it into the challenge-acceptance UI so the kid (or parent) takes the four pledge statements + single checkbox + accept button BEFORE the challenge doc is created. Snapshot the pledge text + version into the challenge doc so a librarian reviewing a completion months later sees the EXACT promise that was taken (see SPEC.md §5 Reader's promise).
- Quiz authoring flow: AI-assisted (Firebase AI Logic + Gemini 2.0 Flash) → librarian approval → publish
- Quiz pool of 15-20 questions per book; quiz samples 8 randomly per attempt
- Time-limited attempt; submission requires final approval from librarian or parent before reward release
- Librarian / parent approval view should re-display the pledge statements from the challenge document for transparency.

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

### [ ] FUTURE — Runtime Theme from Firestore (v2 multi-tenant theming)

When more than one tenant runs on the platform and they want different brand palettes without a code change, lift `src/styles/tokens.css` into Firestore at `/{tenantId}/_main.theme`. A `useThemeTokens()` hook reads the doc on app boot, builds a `:root { ... }` `<style>` tag, and injects it into `<head>`. The docs site stays static-token (it documents the *code*, not per-tenant branding).

Defer until a second real tenant asks. The current single-source-of-truth file already buys us 90% of the value with zero runtime cost.

---

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
- ITEM 1 complete: Firebase project wired in (`library-loot`); `firebase init` set up Firestore + Functions (Node 22) + Hosting (static, not the Web Frameworks experiment) + Storage; deny-by-default rules deployed except public-read on `/{tenantId}/assets/**`; three optimized assets uploaded to Storage under `/luckey-logic/assets/{hero,branding,story}/`; `public/assets/` and `temp folder for assets/` deleted; GitHub Actions workflows installed with `FIREBASE_SERVICE_ACCOUNT_LIBRARY_LOOT` secret. The new transparent-background logo (RGBA, alpha=0 in corners) replaces the earlier flood-filled version. First push triggers the live deploy via Actions.
