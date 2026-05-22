# Library Loot — Claude Code Project Guide
> **Library Loot | Community-funded reading rewards for libraries**
> Developed by **Luckey Logic LLC** | © 2026 Luckey Logic LLC
> Last updated: 2026-05-20

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
- **Cover image upload (follow-up):** when the API doesn't return a usable cover URL (or it's wrong), admins can upload their own. File stages in form state until save; `optimizeImage` resizes to 600px-max JPG before upload; uploaded to deterministic per-book path `/{tenant}/books/{isbn13}/cover.jpg`; download URL goes into `coverUrl`, the Storage path goes into a new `coverStoragePath` field on the book doc so we know to clean it up. Replace, clear, AND delete all release the Storage object when the book had one (best-effort `deleteObject`). External URLs continue to work — coverStoragePath stays null in that case. See SPEC.md §3.1 for the schema fields.

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

#### [~] ITEM 3e — Cover image: URL validity + cycle-through fallback + AI find

Surfaced 2026-05-15 during ITEM 3d testing. The Steam Train, Dream Train book had `coverUrl: https://covers.openlibrary.org/b/isbn/9781452152172-L.jpg` saved, but that URL **doesn't actually load a real image** — Open Library returns a 1×1 placeholder pixel when they don't have the cover. Our code never noticed. Also: when both APIs genuinely have no cover, there's no automated way to find one.

**Three-tier fix when we get to it:**

**[✅] Tier 1 — Validate the URL before adopting it** (shipped 2026-05-20)
- `verifyCoverUrl(url)` helper in `bookLookup.js` — HEAD-fetches each candidate URL with a 5s timeout. Drops on 404 or when `content-length` is suspiciously small (<1000 bytes — Open Library's 1×1 placeholder is ~100 bytes). On network error or HEAD-blocked CDN: KEEPS the URL (better false-positive than dropping a legit cover).
- Appends `?default=false` to `covers.openlibrary.org` URLs so OL 404s on real absence instead of serving the placeholder pixel. The returned URL keeps the flag; future re-renders will show a broken-image icon rather than a silent fake if the cover ever disappears.
- Applied inside both `fromOpenLibrary` and `fromGoogleBooks` (ISBN-lookup path). The title-search path (`searchOpenLibrary` / `searchGoogleBooks`) intentionally skips the HEAD check — 5 candidates × 5s timeout would balloon LOOT's `searchBooksByTitle` tool latency; the validity check fires once the user actually picks an ISBN.
- Status-quo behavior preserved for AdminBooks: when the saved coverUrl in an existing book is no longer reachable, the admin sees a broken image. The "red border + needs replacement hint" UI is still pending and slot in cleanly with Tier 2.

**Tier 2 — "Try next source" button on the Cover URL field in the form** (~45 min)
- Below the Cover URL input, a button labelled e.g. **"🔁 Try Google Books cover"** (when current source is Open Library) or **"🔁 Try Open Library cover"** (when current source is Google Books).
- Each press cycles to the next source's cover URL (validated via Tier 1 HEAD check).
- After exhausting Open Library + Google Books, the button becomes **"🤖 Ask AI to find one"** which triggers Tier 3.

**Tier 3 — AI web search for cover URL** (~varies based on Tier-3 design)
- New tool / Cloud Function that asks an AI to web-search for the book's cover image, returning a verified URL or null. Must NOT hallucinate — if no real source confirmed, return null and admin uploads manually.
- Implementation likely batches with the LOOT web-search work in ITEM 9c.3 — same external API key + same security model.

**Tier 4 — Last resort: upload + background removal** (stretch)
- Manual upload path already exists. Stretch: client-side or Cloud-Function background removal (subject isolation) before storing — uses a model like ModNet or rembg, run on demand at admin's request. Nice-to-have, not blocking.

#### [~] ITEM 3f — Summary quality: detect placeholder garbage + cycle + AI fallback

Surfaced 2026-05-15 during ITEM 3d testing. Open Library sometimes returns useless distributor-catalog blurbs as the summary — example: `"PK Childrens Plus, Inc. Accelerated Reader LG 2.8 0.5 158536."` That's an Accelerated Reader code (`LG 2.8 0.5 158536` = Lower Grades, reading-level 2.8, 0.5 AR points, AR quiz ID 158536), not a book description. Same shape as ITEM 3e (cycle through sources, AI fallback) but for the summary field.

**Three-tier fix:**

**[✅] Tier 1 — Heuristic to detect placeholder summaries** (shipped 2026-05-20)
- `looksLikePlaceholderSummary(text)` helper in `bookLookup.js`. Catches:
  - Empty / under 60 chars of prose
  - Contains `Accelerated Reader` or `AR Quiz`
  - Matches the AR-code shape `[A-Z]{2}\s+\d+\.\d+\s+\d+\.\d+\s+\d{4,}` (e.g. `LG 2.8 0.5 158536`)
  - Other catalog systems' embedded codes (`BL:`, `Lexile:`)
  - Distributor-blurb shape — short string ending in `, Inc.` or `, Inc`
- When a fetched summary fails the heuristic, the adapter sets `summary: ''` and returns. The book still surfaces (title / cover / authors / etc. are preserved), but the admin form opens with a blank Summary field — clear signal to type one in. Cross-source fallback inside `lookupBookByIsbn` (OL empty → try Google Books) lands with Tier 2 / Tier 3.

**Tier 2 — "Try next source" button on Summary field** (~30 min)
- Same UX as Tier 2 of 3e — button cycles through Open Library → Google Books → AI source.
- Each press fetches the next source's summary, runs the heuristic, and uses it only if non-placeholder.

**Tier 3 — AI web search for summary** (~varies, batch with 9c.3)
- New tool / Cloud Function that asks an AI to web-search for a real summary, citing the source. Must NOT hallucinate — return null if no real source found.

**Concrete example of what good looks like** (Claude Chat search for the same ISBN returned this in 30s):
> "A bedtime picture book from the team behind Goodnight, Goodnight, Construction Site. As night falls, a dream train pulls into the station with an unusual animal crew — monkeys, kangaroos, elephants, polar bears, tortoises — who load each car with cargo suited to their talents: bananas in the boxcar, balls in the hopper, paints in the tankers, ice cream in the reefer. Once aboard, the animals tuck into beds on the flatbed cars and the train rolls into the night. Gentle rhyming text full of onomatopoeia and dreamy pastel illustrations make this a wind-down read for ages 3–6."

That's the bar.

#### [✅] ITEM 3g — Subject tags: filter garbage + curate

Shipped 2026-05-20.

- `looksLikeGarbageSubject(s)` filter added in `bookLookup.js` and applied inside `dedupeSubjects()` before the cap kicks in. Catches:
  - Strings containing `:` or `=` (`nyt:graphic-books-and-manga=2021-10-10`, `bisac:JUV019000`, `lcsh:fre--`, etc.) — catalog-system identifiers
  - Strings under 3 chars
  - Pure-numeric / Dewey-decimal-shaped strings (`813.54`, `2021`, `--`)
  - Library-of-Congress controlled-vocabulary entries via an explicit `LOC_VOCAB_BLOCKLIST` set: `juvenile literature` / `juvenile fiction` / `juvenile works` / `juvenile nonfiction` / `juvenile non-fiction` / their `children's …` equivalents.
- Decided AGAINST adding a separate `awards[]` field for v1. Human-readable strings like `"New York Times bestseller"` aren't bad as subjects — they describe the book to a reader. The actual offender was the URL-shaped variant (`nyt:…=2021-10-10`), which the `:`/`=` filter catches. Awards-as-distinct-field is an additive change we can layer on later if the admin UI ever wants to render them differently (gold badge in the corner, etc.); for now, less schema is more.
- Applied universally via `dedupeSubjects` — both `fromOpenLibrary` and `fromGoogleBooks` benefit.
- AdminBooks form already lets the admin curate subjects manually after a lookup; this just prevents bad data from auto-populating in the first place.

**Operator follow-up:** re-run `scripts/refresh-book-metadata.js` to rinse the new heuristics through any existing books that were added before this shipped. Same command as before; the script never clobbers admin-curated values, so it's safe to re-run.

#### [✅] ITEM 3d — Book series + subjects metadata

Extended the Book Firestore doc shape to include three new fields so the catalog supports richer search:

- **`series`** (string | null) — name of the series this book belongs to, e.g. `"The Baby-Sitters Club Graphix"`. Null for standalone titles.
- **`seriesNumber`** (number | null) — position within the series (1, 2, 3…). Null when the source doesn't specify (single-edition standalones; Google Books often omits).
- **`subjects`** (string[], max 6) — subject / genre / category tags, e.g. `["Friendship", "Middle school", "Family"]`.

Sources: Open Library returns `series` (string, sometimes with trailing `#N`) and `subjects` (array of `{name, url}` objects). Google Books returns `categories` (for subjects) and a sparse `seriesInfo.bookDisplayNumber` (for the number — never the name reliably; admin fills that in manually if it matters).

Implementation:
- `src/utils/bookLookup.js` — both `fromOpenLibrary` and `fromGoogleBooks` extract the new fields; `parseSeries()` helper splits `"Series Name #3"` into `{name, number}`; `dedupeSubjects()` collapses case-insensitive duplicates and caps at 6.
- `src/pages/admin/AdminBooks.jsx` — form gained Series / Series # row + Subjects field (comma-separated, split on save). Hydrates from lookup results AND from existing book docs when editing. Save handler writes the new fields on create + update.
- `src/lib/loot/lootTools.js` — `searchCatalog` accepts new `series` and `subject` criteria (both substring-matched against the book's stored values, normalized for punctuation). Chip label adapts. Match-result shape now includes `series`, `seriesNumber`, `subjects` so LOOT can mention them when reporting results.
- `src/lib/loot/lootClient.js` — system prompt gains intent→call examples for series ("any BSC books?" → `{series: "Baby-Sitters Club"}`) and subject ("books about friendship?" → `{subject: "friendship"}`) queries, plus a hedge note that older catalog adds may have empty `subjects` arrays.
- `scripts/refresh-book-metadata.js` (NEW) — backfill script that re-fetches metadata for every book in the catalog and populates the new fields without overwriting admin-curated values. Re-runnable.
- `scripts/README.md` — documents the new script.

No rule changes (books were already `public read, admin write`; the new fields ride the existing permissions).

#### [✅] ITEM 3c — Public book browse + per-book detail page

- New `/books` page (`src/pages/Books.jsx` + `.module.css`) — anonymous-readable grid of `active: true` books. Sorted newest-added first. Empty state explains the librarian's still setting up the shelf; loading state shows a brief "loading the shelf…" line. Each tile links to `/books/:isbn`.
- New `/books/:isbn` page (`src/pages/BookDetail.jsx` + `.module.css`) — public detail view. Full cover, title, authors, year, reading level, ISBN, summary. URL accepts hyphenated ISBNs (`normalizeIsbn` upstream of the lookup). Three CTA variants on the same page:
  - **Inactive book** — surfaces a notice instead of the Accept block, but keeps the detail readable so a kid reading something the library has paused can still see it. Link back to /books.
  - **Active book, signed-out visitor** — "Sign in to accept this challenge" with a `state={{ from: { pathname: '/books/:isbn' } }}` redirect so post-login returns here.
  - **Active book, signed-in user** — "Coming soon" callout. Honest framing: real challenge acceptance lands in ITEM 5; this page doesn't promise more than the platform delivers today.
- Navbar + Footer — added **Books** link between Home and About (Navbar) / right after Home (Footer).
- The Home page's primary CTA "See the books" → `/books` was always pointed here; it now lands on a real page instead of NotFound.
- Rules: ITEM 2c already deployed public read on `/{tenantId}/_main/books/{bookId}`, so no rule changes needed.

### ITEM 9 — LOOT (Admin AI Assistant) + Sponsor Flow (sliced)

The sponsor pieces from the original ITEM 4 are absorbed into 9d/9e because Miguel wants AI helping with sponsor intake from day one. ITEM 4 shrinks to the residual prize-inventory bits below.

#### [✅] ITEM 9a — Operator setup

- Vertex AI API enabled in Google Cloud (`aiplatform.googleapis.com`, labeled "Agent Platform API" in the new console UI).
- Firebase AI Logic enabled. Both backends (Gemini Developer API + Vertex AI Gemini API) are enabled at the project level; we use **Vertex AI** in client code.
- AI Monitoring enabled, 100% sampling rate during dev.
- App Check enabled with reCAPTCHA Enterprise. Library Loot Web App registered, enforcement ON.
  - Site key (public, in client code): `6LeSUPAsAAAAAPotOzNECOIVpXsxgDtj7hvYNsGl`.
  - Debug token for Miguel's iMac registered in Firebase Console → App Check → Apps → Manage debug tokens. Lives in `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN` (gitignored).
- Decision lock-in: stuck with classic reCAPTCHA v3 key terminology in Firebase's UI even though the provider is Enterprise (the registration UI uses "secret key" wording loosely — Enterprise's actual auth happens via the project's IAM, not the v3 secret. Working setup is the source of truth.)

#### [✅] ITEM 9b — LOOT chat shell (admin only, no tools)

- Bumped `firebase` SDK from `^10.14.0` to `^12.13.0` so the canonical `firebase/ai` namespace is available (v10 only had `firebase/vertexai-preview`). All existing services (auth, firestore, storage, functions, app-check) remain API-stable for our usage.
- New `src/firebase/appCheck.js` — initializes App Check with `ReCaptchaEnterpriseProvider`. Wires `self.FIREBASE_APPCHECK_DEBUG_TOKEN` from `.env.local` BEFORE `initializeAppCheck()` runs, only when `import.meta.env.DEV` is true. Production never sees the debug token.
- `src/firebase.js` — side-effect imports `./firebase/appCheck.js` at the bottom (after default export) so every consumer transparently picks up App Check.
- New `src/lib/loot/lootClient.js` — wraps Firebase AI Logic SDK. Vertex AI backend, **Gemini 2.5 Flash** model (2.0 Flash + Flash-Lite shut down 2026-06-01, do not pin to those). System prompt: LOOT identity + audience (librarian/admin) + tone (Fortnite-vibe, kid-program-appropriate) + boundaries (Library-Loot-only topics). Exports a single `chatWithLoot(history)` function.
- New `src/components/loot/`:
  - `LootButton.jsx` — floating bottom-right launcher. State (`open`/`closed`) persists in `sessionStorage` under `ll_loot_open_v1`.
  - `LootPanel.jsx` — chat surface. 380×600 on desktop, fullscreen on mobile. Header shows name + model + Clear + Close. Conversation history persists in `sessionStorage` under `ll_loot_history_v1`. Esc closes. Enter sends, Shift+Enter newline. Greets by first name if signed-in user has `displayName`.
  - `LootMessage.jsx` — message bubble. User = purple gradient right; LOOT = night-soft left with cyan thinking-dots while pending.
- `src/components/AdminLayout.jsx` — mounts `<LootButton />` at layout root. Available on every `/admin/*` route, never on public pages.
- Vibe lock-in: LOOT is a proper noun (no acronym). Header references "loot drop" / "what are we looting today" — keeps it on-brand without forcing an awkward initialism.

#### [ ] ITEM 9c — First tools wired (admin assistant gains hands)

- Tool: `lookupBookByIsbn(isbn)` — reuses `src/utils/bookLookup.js`. Returns normalized book metadata.
- Tool: `searchBooksByTitle(title)` — reuses Open Library/Google Books title search.
- LOOT can now answer "Is _Steam Train Dream Train_ in our catalog?" with a real lookup. System prompt updated: drop the "tools are coming in the next build" hedge once they're live.

#### [✅] ITEM 9c.2 — Mirror Auth profile into Firestore user docs

Surfaced 2026-05-15 during navbar debugging: `displayName` and `photoURL` live in Firebase Auth, not Firestore. Admin views (sponsor inquiry review in 9e, future user list pages, LOOT conversation logs in 9c.1) need names without going through the Admin SDK on the server side.

**Scope:**
- Extend `/{tenant}/_main/users/{uid}` shape to include mirrored profile fields: `displayName`, `photoURL`, `email`, `lastSeenAt`.
- Write the mirror on every sign-in via AuthContext (after the existing `bootstrapTenantClaim` call). Idempotent — only writes if a field changed.
- Listen for Auth's `onIdTokenChanged` (fires when profile is updated via `updateProfile`) and re-mirror.
- Firestore rules: extend `/{tenant}/_main/users/{uid}` write rules so a user can self-write the mirrored fields (`displayName`, `photoURL`, `email`, `lastSeenAt`) but no others — same shape as the future onboarding-ack rule (ITEM 12).
- Backfill script: `scripts/backfill-user-profiles.js`, mirrors the existing `backfill-user-claims.js` pattern. Pulls every Auth user, writes their profile into the matching Firestore user doc.
- One-time admin: a tiny `/account/profile` page (or settings card) where parents can edit their displayName + photo. Defers detailed implementation to a later UI pass; the data layer is what's blocking.

Lands before 9e (admin sponsor review) so the admin can see "submitted by Jane Doe" rather than just a UID.

#### ITEM 9c.1 — LOOT conversation logging + weekly digest (sliced)

After reading MCL Central's GUNNY logging pattern (functions/index.js `adminChat` + `generateChatInsights` + `GunnyChatInsights.jsx`), sliced 9c.1 into three thin items so the workflow rule about one complex change at a time stays clean:

  - **9c.1a** — Client-side logging from LootPanel + Firestore rules.
  - **9c.1b** — Scheduled Cloud Function `generateLootInsights` (weekly digest via Gemini).
  - **9c.1c** — Admin `/admin/loot` viewer page for digests + raw transcripts.

#### [✅] ITEM 9c.1a — LOOT conversation logging (client + rules)

Implemented in 9c.1a (2026-05-15):

- New `src/lib/loot/lootLogger.js` — exports `logLootSession({sessionId, user, tenantClaim, audience, history, sessionStartFlag})` + `getOrCreateLootSessionId()`. Uses `setDoc(..., {merge: true})` with a one-time `getDoc` existence check (per-mount cached on a ref) so `sessionStartedAt` only writes on the first turn of a session, not every turn. Cap of 50 turns per doc to keep size bounded.
- `LootPanel.jsx` — sessionId generated from `getOrCreateLootSessionId()` (per-tab, persistent across reloads via sessionStorage); each user/tool/model turn carries a `timestampMs`; `logLootSession` is called after each model reply with an accumulator of all turns added during the exchange (user → tool* → model). Non-fatal failures only console.warn; chat keeps working.
- Doc shape at `/{tenant}/_main/lootSessions/{sessionId}`: `{sessionId, userUid, userDisplayName, userEmail, tenantId, audience: 'admin', sessionStartedAt, lastTurnAt, turns: [{role, text|name|args, timestampMs}]}`.
- Firestore rules: read by any tenant admin (MCL pattern — admin group benefits from collective visibility); create + update gated on the session's owning UID matching `request.auth.uid`; delete by any tenant admin (operator control + future retention).
- LOOT system prompt updated with a LOGGING & TRANSPARENCY section so LOOT can answer "is this conversation logged?" honestly when asked.

Audience labels: 'admin' for now. 'parent' / 'anon' arrive in 9f / 9g and will use the same logger + doc shape with the audience field flipped. Rules will need to widen at that point.

Miguel surfaced this need on 2026-05-15 during 9b verification, after spotting LOOT confidently hallucinating a "ticket-based prize draw" mechanic that doesn't exist. The weekly digest (9c.1b) will help catch those hallucinations early before they shape an admin's mental model of how the platform works.

#### [✅] ITEM 9c.3 — LOOT web-search tool (close the GUNNY capability gap)

Surfaced 2026-05-15. Miguel asked LOOT for a real book summary and a working cover URL; LOOT couldn't do either because we only gave it `lookupBookByIsbn` / `searchBooksByTitle` / `isBookInCatalog` / `searchCatalog`. None of those reach the broader web. Meanwhile Claude Chat (Anthropic, browser tool) answered the same question in 30 seconds with a high-quality summary, source-cited, no hallucination.

**Shipped 2026-05-19.** Two new HTTPS-callable Cloud Functions plus the matching LOOT tools:

- `functions/src/lootWebSearch.js` — Brave Search API, admin-claim required, 50 searches per UID per day, safesearch=strict (kids' reading program). Brave key via `defineSecret('BRAVE_SEARCH_API_KEY')` — never in source. Quota lives in a server-only `/_loot_meta/{tenant_uid_date}` doc updated in a transaction.
- `functions/src/lootFetchPage.js` — Server-side fetch + `cheerio`-based readable-text extraction (strips script/style/nav/header/footer/aside/forms; picks densest of article/main/[role=main]/body; normalizes whitespace; caps at 10K chars). 24h cache at `/_loot_url_cache/{sha256_url}`. Hard caps: 5MB HTML download, 10s timeout, 100 fetches per UID per day. SSRF defense: refuses non-http(s), blocks localhost / private IP ranges (127.x, 10.x, 192.168.x, 172.16-31.x, 169.254.x, .local, .internal).
- `firestore.rules` — added deny-all blocks for `_loot_meta` and `_loot_url_cache` (server-only collections, matching the `_setup_tokens` pattern).
- Client-side `src/lib/loot/lootTools.js` — new `searchWeb({query, count?})` and `fetchPage({url})` tool declarations + implementations + chip display entries (`🌐 Searching the web for "..."`, `📄 Reading <hostname>`).
- LOOT system prompt — new web-tool guidance, golden-path examples, and a hard CITATION & HONESTY block that requires every web-sourced claim to carry the URL and forbids invention when search turns up nothing.

App Check stays OFF on the new callables to match the rest of `functions/` until the project-wide App Check setup gets cleaned up (separate tracked task).

**Operator next steps for Miguel** (the human; not code):
1. Sign up for [Brave Search API](https://brave.com/search/api/) — free tier 2000 queries/month, no card.
2. Set the secret in Firebase Secret Manager: `firebase functions:secrets:set BRAVE_SEARCH_API_KEY`.
3. Deploy: `firebase deploy --only firestore:rules,functions`.
4. Try a real prompt in LOOT: "Find a real summary for Steam Train Dream Train — Open Library is giving me garbage." LOOT should call `searchWeb` → `fetchPage` and return a real summary with the source URL cited.

**Unblocks downstream items:**
- ITEM 3e Tier 3 (AI fallback for cover URLs) can now use `searchWeb` + `fetchPage`.
- ITEM 3f Tier 3 (AI fallback for summaries) can now use the same.
- ITEM 9e (admin sponsor review) can verify sponsor businesses through `searchWeb`.
- ITEM 9g (public LOOT) will reuse this backend with stricter quotas + the token-gate pattern.

---

#### Original design notes (kept for posterity — superseded by the shipped notes above)

**The diagnosis:** this isn't a Gemini-vs-Claude limitation, it's a Library Loot **setup** limitation. Gemini 2.5 Flash supports tool calling just as well as Anthropic Claude; we just didn't wire a web-search tool. GUNNY (MCL Central's Anthropic-based assistant) has access to `web_search` because Anthropic ships that as a built-in tool. Vertex AI doesn't ship one out of the box, so we have to wire it ourselves.

**Scope:**

**Tier 1 — Pick a web search provider + add a Cloud Function intermediary.**
- Options:
  - **Brave Search API** — free tier (2000 queries/month), no card required, returns clean JSON results with snippets + URLs.
  - **Google Custom Search JSON API** — 100 free queries/day, has card-required configuration, OK quality.
  - **Bing Web Search API** (now Azure) — paid only, no free tier for new accounts.
  - **Tavily** — purpose-built for LLM agents, has free tier + cited results.
- **Recommend: Brave** for the free tier + no-card-required setup. Tavily as backup if Brave's results aren't great.
- New Cloud Function `lootWebSearch({query, count?})` — onCall, admin-only, uses the configured search API. Returns `[{title, url, snippet, source}]`. Server-side so the API key never leaks to the browser, and so we can centrally rate-limit / log.

**Tier 2 — Add the tool to LOOT.**
- New `searchWeb(query)` tool in `src/lib/loot/lootTools.js`. Calls the Cloud Function via `httpsCallable`. Returns search results to the model.
- New chip label: `🌐 Searching the web for "..."`.
- System prompt update: tell LOOT it can search the web for general questions (summaries, cover candidates, book recommendations, sponsor brand verification, etc.) — but it MUST cite the source URL in its reply, and if it can't find a real source it MUST say so plainly instead of making something up.

**Tier 3 — Add a `fetchPage(url)` follow-up tool** so LOOT can read the full text of a search result if the snippet isn't enough.
- Cloud Function `lootFetchPage({url})` — uses a server-side fetch + readability extraction (e.g. mozilla/readability), returns clean text up to ~10K chars. Caches for 24h.
- New tool `fetchPage(url)` in lootTools.js.

**Tier 4 — Wire these for the summary + cover-URL workflows in 3e/3f.**
- The "🤖 Ask AI to find one" buttons in 3e (cover URL) and 3f (summary) call into the same search + fetch tools. Same backend, different UI surfaces. The AI does the "find a real summary / cover URL" work transparently.

**Cost model:** Brave's free tier (2000 queries/month) is way more than one library uses. We'd never pay. Even at scale, Brave is $5/1000 queries.

**Security model:**
- All web search goes through Cloud Functions (App Check enforced) — the browser never holds the API key.
- Admin-only via custom claims. Public LOOT (9g) gets a separately-scoped web tool with stricter rate limits + the token-gate pattern.
- Logged into the LOOT conversation log so admin can audit what was searched.

#### [ ] ITEM 9c.1b — Weekly insights Cloud Function (`generateLootInsights`)

- Scheduled Cloud Function, Monday 06:00 UTC. Multi-tenant iteration (v1 = just `luckey-logic`).
- Reads `/{tenant}/_main/lootSessions` where `lastTurnAt >= 7d ago`. Samples up to 200 user messages.
- Sends the sample to Vertex AI Gemini 2.5 Flash for a summary covering: top admin pain points, common workflows, off-program refusals, things LOOT couldn't answer, recommended UI/tool improvements.
- Writes result to `/{tenant}/_main/lootInsights/{YYYY-WNN}` with shape `{weekId, generatedAt, totalSessions, totalMessages, summary, byUser: [...]}`.
- No email. Insights live in Firestore; 9c.1c reads them.

#### [ ] ITEM 9c.1c — Admin LOOT insights viewer

- New `/admin/loot` page. Lists weekly insights (most recent first); admin can drill into individual session transcripts (raw `lootSessions` docs).
- Transcripts render via the existing `LootMessage` component so chat history reads identically to the live chat.
- Useful for tuning the system prompt + spotting common admin pain points worth turning into tools or UI changes.

#### [ ] ITEM 9d — Public sponsor intake form (no AI on the public side)

- Replace the `/sponsor` placeholder page with a real intake form.
- Fields: name, email, business name (optional), website (optional), donation description (required textarea), anonymous toggle, message (optional). **Plus optional book suggestion:** title (free text) + optional ISBN (validated against `utils/isbn.js`, supports the camera scanner).
- Writes to `/{tenant}/_main/sponsorInquiries/{id}` with shape per SPEC.md (extend to include `suggestedBookTitle`, `suggestedBookIsbn`, `suggestedBookResolved`).
- Firestore rules: `create` allowed for anyone (anonymous public form); `read/update/delete` admin-only.
- **No AI in the public form** — App Check + public Gemini calls would blow our cost budget. AI helps the admin AFTER inquiries land.

#### [ ] ITEM 9e — Admin sponsor-inquiries review + LOOT tools for it

- New `/admin/sponsors` page. List view with status chips (`new` → `contacted` → `received` → `closed`), sort by date. Detail view: full inquiry, status state machine, admin notes textarea.
- New LOOT tools wired for this flow:
  - `addBookToCatalog(isbn)` — if the sponsor suggested a book not in our catalog, LOOT can add it.
  - `draftReplyEmail(inquiryId, tone)` — drafts a reply email. Admin copies/sends manually for v1; no SendGrid yet.
  - `flagReadingLevelMismatch(suggestedBookId)` — quick "does this book fit the kid age range of an open challenge?" check.
- "Open in LOOT" button on inquiry detail loads the inquiry context as a system message in LOOT's chat.

#### [ ] ITEM 9f — LOOT for authenticated parents (`/account`)

- Same `LootButton`/`LootPanel`, mounted in `Account.jsx` (or a parent-layout wrapper).
- Different system prompt: parent-facing tone, knows about the kid sub-profiles, can answer "How do I add a kid?" / "Why is my kid not verified yet?" / etc.
- No rate-limiting yet — authenticated parents are a trusted audience.

#### [ ] ITEM 9g — Public LOOT (anon visitors, sponsor-onboarding focus)

- LOOT available on public pages. Primary purpose: help would-be sponsors understand the program, then route them to the intake form.
- **Rate limit + token gate** — match MCL-Central's pattern. (When we get here, read `/Users/miguelbrown/LuckeyLogic/Programming/WebBasedProjects/mcl-central` for the exact implementation.)
  - 15 questions per anonymous session.
  - At question 10, LOOT softly warns about the cap.
  - Sponsor inquiry form submission auto-issues a token (Firestore doc with TTL + remaining-question budget) that lifts the cap for a set period.
- Cost protection: anonymous Gemini calls go through a Cloud Function intermediary (NOT direct from the browser) so we can enforce the budget server-side, log usage, and kill-switch if abuse spikes.

### [ ] ITEM 10 — Sponsor Accounts (invite-only)

**Lock-in (2026-05-15):** invite-only sponsor signup, identical pattern to the first-admin setup-token flow. Open signup is **forbidden** — keeps inappropriate businesses (dispensaries, age-restricted products, etc.) off the platform. Sponsors apply via inquiry → admin reviews → admin issues invite token → sponsor signs up via that token.

- New `sponsor` custom claim alongside `admin` + `parent`.
- `/{tenant}/_main/sponsors/{sponsorId}` — name, type (individual|business), logoPath, website, message, anonymous, linkedInquiryId, prizeIds[], createdAt.
- `/sponsor/dashboard` (or similar) — sponsor sees their donated prizes, draw history (how many times each was awarded), their custom "thank-you" content (ITEM 11).
- Sponsor logo upload → Firebase Storage at `/{tenant}/sponsors/{sponsorId}/logo.{ext}`. Admin-write to public-read, with admin approval gating the public surface.
- Email-invite Cloud Function — admin clicks "Invite to sponsor portal" on a `received` inquiry, function issues a one-time setup token (mirrors `issueSetupToken`/`claimSetupToken` from ITEM 2b).

### [ ] ITEM 11 — Sponsor Thank-You / Prize-Won Experience

- Sponsor uploads: short text message + ONE image (no video for v1). Examples: "Congrats! Free ice cream at our shop with this coupon" + a coupon image. Sponsor handles their own redemption mechanism (QR code, barcode, plain words on the image, etc.) — Library Loot just displays whatever they upload.
- **Admin approval gates publish.** Every text + image goes to an admin queue; the sponsor's thank-you content is INVISIBLE on the kid's win screen until approved. Re-approval required if the sponsor edits.
- When the prize draw approves a redemption tied to this sponsor, the kid's celebration screen shows the sponsor's content.
- Sponsor dashboard surfaces a "shown to N kids" counter and "last shown DATE."
- COPPA-relevant: all kid-facing sponsor content goes through admin review. Sponsor cannot push to kid surfaces directly.

### [ ] ITEM 4 — Prize Inventory Management (residual after 9d/9e absorbed sponsor intake)

- `/{tenant}/_main/prizes/{prizeId}` — kind (Fortnite-only enum v1), label, qtyAvailable, active, sponsorId (FK to ITEM 10), inquiryId (FK to original `sponsorInquiry`).
- Public Donors page surfacing sponsor recognition (from `sponsors` collection, only `approved + non-anonymous` entries).
- Admin bulk prize-entry tool: when a sponsor drops off a stack of physical V-Bucks gift cards, librarian enters qty + denomination in one form.
- Convert-inquiry-to-prize-record flow: admin marks an inquiry as `received`, picks "Generate prize record(s)" → opens a quick-fill form pre-populated from the inquiry data.

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

### [ ] ITEM 12 — First-time user onboarding (inline coachmarks)

**Must ship before public launch.** New users won't know what every UI element does — the LOOT button is obvious to the builder, opaque to a librarian who's never seen it. This item adds a discoverable, dismissable, per-user-tracked layer of "what is this?" hints.

**v1 pattern (this item): inline coachmarks only.**
- Small pulsing dot + lightning glyph next to a hotspot.
- Click → popover with 1-2 sentence explainer + "Got it" button.
- Click "Got it" → ack stored in Firestore, coachmark never shows again for that user + hotspot.
- Each hotspot has a stable string ID + a version number. Bump the version when a feature materially changes (e.g. "LOOT now does book lookups too" after 9c lands) and the coachmark fires again to teach the new capability — without resetting acks for unrelated hotspots.

**v2 pattern (deferred — separate future item):** first-visit guided tour. Multi-step spotlight overlay on first arrival to `/admin` or `/account` that walks through the page's primary features in sequence. Same Firestore-backed ack store; one tour completion = bulk ack for all hotspots in the tour. Surfacing it once v1 has shipped + we've learned what new users actually struggle with.

#### Data shape

Per-user, in the existing user doc:

```js
/{tenant}/_main/users/{uid}
  ...existing fields...
  onboarding: {
    acks: {
      'loot-button'      : { ackedAt: <ts>, version: 1 },
      'admin-tenant-id'  : { ackedAt: <ts>, version: 1 },
      'isbn-scanner'     : { ackedAt: <ts>, version: 1 },
      'add-child-card'   : { ackedAt: <ts>, version: 1 },
      'verified-badge'   : { ackedAt: <ts>, version: 1 },
      // ...one entry per hotspot the user has dismissed
    }
  }
```

**Firestore rules:** extend `/{tenant}/_main/users/{uid}` so a user can self-write only the `onboarding.acks` subfield (not the whole doc — prevents privilege escalation). Admins keep full write per existing rules.

#### Scope decisions (locked in 2026-05-15)

- **Anonymous users — NO onboarding.** Public LOOT (9g) and other anon surfaces ship without coachmarks. Onboarding requires an authenticated user we can store acks against.
- **Universal hotspot definitions in source.** v1 defines the hotspot catalog in `src/lib/onboarding/hotspots.js`. Per-tenant customization (a library editing the hint text for their own site) deferred to a later item if/when asked.
- **Visual style:** gold-bordered popover, LOOT lightning glyph (`⚡`) in the header, "Got it" button. Tokens: `--loot-gold`, `--loot-gold-bright` for the border + glow, `--neon-purple` for the popover surface, `--hud-white` for the body text. Matches LOOT chat's existing visual identity so the two read as one onboarding voice.

#### Files to create

- `src/lib/onboarding/hotspots.js` — universal catalog. Each entry: `{id, title, body, version}`. Source of truth for what fires where.
- `src/hooks/useOnboardingAck.js` — hook for the React side. Reads the user's ack state from Firestore (live `onSnapshot`), returns `{ acked: boolean, isLoading: boolean, ack: () => void }`. `ack()` writes to Firestore.
- `src/components/Coachmark.jsx` + `.module.css` — pulsing dot + popover component. Takes a hotspot ID prop, renders nothing if already acked. Positions itself relative to its parent (or accepts an anchor ref).
- `src/components/CoachmarkProvider.jsx` (maybe — TBD during scoping) — context-aware coordinator that only allows one coachmark visible at a time so we don't pile them on a busy page.

#### Files to modify (initial hotspots — wire each with `<Coachmark id="...">`)

- `src/components/loot/LootButton.jsx` — coachmark on the floating button. `loot-button` v1: "Tap LOOT for help — answers about books, sponsors, and how to use this admin panel."
- `src/components/AdminLayout.jsx` — coachmark on the tenant ID line. `admin-tenant-id` v1: "This is your library's data root. Each library's data lives here in isolation — nothing leaks across tenants."
- `src/pages/admin/AdminBooks.jsx` — coachmark on the "Scan barcode" button. `isbn-scanner` v1: "Tap to scan a book's barcode with your camera — fastest way to add a book to the catalog."
- `src/pages/Account.jsx` — `add-child-card` v1: "Add each kid as a sub-profile here. We only collect first name + optional birth year." And on the pending-verification badge after a child is added: `verified-badge` v1: "Bring your kid to the library — a librarian verifies them in person before they can earn prizes."

(More hotspots to identify during scoping. Each NEW surface shipped AFTER ITEM 12 lands should include its own hotspot in the same commit.)

#### Acceptance check before declaring 12 done

- A fresh test user (clean Firestore user doc) signs in and sees every initial-hotspot coachmark on the appropriate surface.
- Clicking "Got it" persists the ack within the session AND across browsers (Firestore-backed, not localStorage).
- Bumping a hotspot's `version` in source re-fires the coachmark for everyone, even users who acked v1.
- Skipping a coachmark doesn't break the underlying feature — every hotspot is "wrapped around" its anchor, not "blocking" it.
- No coachmarks render for unauthenticated visitors.

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

### 2026-05-20 (night) — Docs site fix (@module tags everywhere)

Operator hit the docs site at `library-loot.web.app/docs/` and saw only source-code views, no actual documentation pages. Diagnosis: every source file had `// ` file-header comments but no `/** @module */` JSDoc block, so `members.modules` was empty during the JSDoc render and only the source-code fallback nav showed up. (MCL Central's docs work because every file there declares `@module`.)

- **New `scripts/add-jsdoc-modules.js`** — idempotent one-shot Node script that walks the JSDoc include paths and prepends a `/** ... @module path/Name */` block to every `.js`/`.jsx` file that doesn't already declare one. Extracts the block's prose description from the file's existing `// ` header (the lines between the path line and "Created by"), word-wraps to ~78 chars so the block reads cleanly in source, and caps very long descriptions at 500 chars with a `…` truncation. Re-runnable — files that already have `@module` are skipped. Commit it for repeatable use on any new file added later.
- **51 source files gained an @module block**: every file in `src/components`, `src/pages`, `src/context`, `src/data`, `src/firebase` (and `firebase.js`), `src/hooks`, `src/lib`, `src/model` (LastModified.js skipped — already had one), `src/utils`, plus `src/App.jsx` and `src/main.jsx`. Each block uses `path/Name` form: `components/Navbar`, `pages/admin/AdminBooks`, `lib/loot/lootClient`, `utils/bookLookup`, etc.
- **`jsdoc.config.json`** — added `src/utils`, `src/lib`, `src/model` to the include list. The first two were silently missing entirely from the docs before this commit; the third had files but none reachable via include.
- **`jsdoc-template/publish.js`** — added three new entries to `DIR_GROUPS` so the new module pages bucket cleanly in the sidebar:
  - `firebase/` → "Firebase"
  - `lib/loot/` → "LOOT"  (more specific than the generic lib/, must come before it in array order)
  - `lib/` → "Libraries"
- **TypeScript-style JSDoc cleanup in `lootClient.js` + `lootTools.js`**: pre-existing `{role: string, text?: string, ...}` and `{{query: string, count?: number}}` patterns were throwing JSDoc 4 parse errors (CLAUDE.md style guide explicitly forbids that syntax). Rewrote to plain `@param {Object}` + prose-described properties. The docs now build with zero errors.
- **Output**: 53 `module-*.html` pages generated (51 newly-tagged + 1 LastModified + 1 App). The docs site at `library-loot.web.app/docs/` now shows the JSDoc-rendered prose + parameter tables + return values + member lists with a "View Source" link to the source code view. Matches MCL Central's behavior.
- **Operator habit going forward**: when adding a new file in any of the included paths, either write the `@module` block by hand or run `node scripts/add-jsdoc-modules.js` to back-fill — the script is idempotent and safe.

### 2026-05-20 (evening) — Round 2: AI fallback button in diff rows

After the Round 1.5 diff fixes shipped and the operator verified, jumped into Round 2 — the 🤖 Find via AI button that closes the loop on Kristy and the Snobs's empty summary row. The button pays off the 9c.3 web-search capability for the catalog-editing workflow specifically.

- **New `src/lib/loot/aiFieldFetch.js`** — `findFieldViaAI({book, field})` wrapper around `chatWithLoot`. Sends a focused single-turn prompt with a locked-down output format (`SUMMARY: ...\nSOURCE: ...`), parses the structured response, returns either `{value, source}` or `{error}`. The CITATION & HONESTY block in LOOT's system prompt does the heavy lifting — every value comes with a real URL or the function refuses to surface it.
- **Sentinel-driven refusal handling.** The prompt explicitly tells LOOT to emit `SUMMARY: (none) / SOURCE: (none)` when no real source is found. `parseStructuredResponse` checks for that and returns `{error: "No real source found..."}`. Also refuses values that come with `SOURCE: (none)` — the whole point of the button is CITED content, never unverified prose.
- **Field whitelist for the button.** Only fields with a template in `FIELD_PROMPTS` get the button. v1 ships with just `summary`. Cover URL is intentionally NOT included — `fetchPage`'s cheerio extraction strips `<img>` tags during text extraction, so reaching image URLs would need either a new image-search Cloud Function or an enhanced `fetchPage` that returns image URLs alongside text. Tracked as Round 2.5.
- **DiffRow UI additions** (`RefreshDiffModal.jsx` + `.module.css`):
  - "🤖 Find via AI" button rendered next to the "New" label when the field is whitelisted. Cyan border + cyan text matches LOOT's chat visual identity so it reads as the same character.
  - Inline spinner inside the button while the AI works (5-15s typical — searchWeb + fetchPage + Gemini extraction).
  - Input/textarea is disabled during the fetch so the operator can't fight the result that's coming in.
  - On success: result populates the editable input, the row's checkbox auto-checks (so the operator doesn't have to remember to tick it), and a "🔗 Source: <hostname>" chip appears below the input. Chip is a real link to the source page (target="_blank") for verification.
  - On error: red error message below the input. Button flips to "🤖 Try again" so the operator can re-roll. Button text also flips to "🤖 Try again" after a successful fetch — operator can re-roll if the first answer wasn't ideal.
  - `aiBusy` / `aiError` / `aiSource` carried per-row in modal state so each field fetches independently.
- **Quota consumption.** Each button click costs 1 web search + ~1 page fetch against the existing 50/day search + 100/day fetch caps from 9c.3. Quota errors surface as `aiError`. Operator can see usage via Firebase Functions logs (`firebase functions:log --only lootWebSearch`) or the `/_loot_meta` Firestore collection.
- **Pass-through context fix**: modal now takes the whole `book` object (was `bookTitle` only) so `findFieldViaAI` can build the prompt with title + authors + ISBN + year. AdminBooks.jsx wiring updated to match.

The Kristy scenario after this commit:
- Refresh → modal opens with Summary row (kind="destructive", unchecked).
- Operator clicks 🤖 Find via AI on the Summary row.
- LOOT searches Brave for "Kristy and the Snobs by Ann M. Martin book summary", fetches the top promising result (probably the Scholastic page or Goodreads), extracts a real 2-4 sentence kid-appropriate summary, cites the URL.
- Summary text lands in the input (editable!), source URL appears as a chip below, checkbox auto-checks.
- Operator can tweak the wording inline, click "Apply selected", form opens with the new summary, hit Save.

Build clean (+1 module for aiFieldFetch.js, +2KB CSS for the new button/source/error styles, +4KB JS). No new deps. No Cloud Function changes — entirely a client-side feature built on top of the 9c.3 backend.

Round 2.5 (cover URL via image search) and Round 3 (vite-plugin-mkcert for HTTPS dev) still pending.

### 2026-05-20 (late afternoon) — Diff-quality follow-up

Operator hit Refresh on Kristy and the Snobs and the diff modal lit up with 5 rows, ALL defaulting to unchecked — nothing was actionable. Investigation found three real bugs that the modal was correctly surfacing as noise:

1. **Title + subtitle weren't being combined.** OL returns `title="Kristy and the Snobs"` + `subtitle="a Graphic Novel"` as two separate fields. My code in `fromOpenLibrary` (and `fromGoogleBooks`) only read `title`. So every book with a subtitle would show up as a "Will replace your existing value" diff against an admin who'd combined them. New `combineTitle(title, subtitle)` helper joins them with `: ` separator and capitalizes the subtitle's first letter (OL's catalog style is "a Graphic Novel" — readers write "A Graphic Novel"). Applied in `fromOpenLibrary`, `fromGoogleBooks`, `searchOpenLibrary`, `searchGoogleBooks`. Title diffs disappear for the dozens of books where admin already curated the combined form.
2. **Subjects diff was a whole-array replace.** Existing 6 tags vs API's 1 tag → modal proposed "Will replace your existing value" with 1 tag, blowing away 6 admin-curated ones. New `diffSubjectsRow` does additive set-merge: compute `additions = apiSubjects - existingSubjects` (case-insensitive), cap by `SUBJECTS_CAP - existingCount` room remaining, surface only when room exists AND there are genuine new tags. The diff is **additive-only** — existing tags never disappear by default. If the operator wants to remove a tag, they edit the input inline. kindLabel override: "Will add new tag: 'X'" (single) or "Will add N new tags" (multiple). Defaults to checked. For Kristy with 6 curated tags already (full), no subjects row appears at all.
3. **OL `work.description` wasn't being read.** Some OL works have descriptions on the works record even when bibkeys has no notes/excerpts. New fallback in the deeper chain: try `work.description` (handles both string and `{type, value}` shapes) when bibkeys summary is empty or fails the placeholder heuristic. Won't help every book (Kristy's works record genuinely has no description), but every other book that previously came back blank will gain a real summary candidate.

Built `kindLabel` field into the diff row shape so individual rows can override the default kind chip text — used by the additive subjects row to say "Will add 1 new tag" instead of the generic "Will populate empty field". Modal honors `row.kindLabel || diffKindLabel(row.kind)`.

Decided AGAIN to defer `awards[]` as a separate field. The additive subjects merge handles the immediate case ("New York Times bestseller" lands in subjects when room exists) without a schema change. Operator's mental model expected awards[] — we'll revisit if real catalog usage shows bestseller info actually deserves its own visual treatment.

Build clean (no dep / rule / config changes). Round 2 (AI fallback button per row for the truly-blank API fields) is the next slice — that's where 9c.3 starts paying real dividends.

### 2026-05-20 (afternoon) — Refresh diff modal + script rinse pass

- **Surfaced from operator testing**: after the morning's Tier 1 heuristic commit landed and the operator re-ran `refresh-book-metadata.js`, Steam Train Dream Train's bad cover URL was still in place. Diagnosis: the script was scoped to ITEM 3d (series/subjects backfill ONLY) and never touched cover/summary fields. The UI Refresh button DID apply the heuristics, but it overwrote the whole form with API values — including manually-curated good prose that the operator had already typed in. Both gaps fixed in this slice.
- **Script changes** (`scripts/refresh-book-metadata.js`):
  - Mirrored `verifyCoverUrl`, `looksLikePlaceholderSummary`, `looksLikeGarbageSubject`, and the new `LOC_VOCAB_BLOCKLIST` set from `src/utils/bookLookup.js`. Kept-in-sync-by-hand pattern matches what the script already does for `dedupe` and `parseSeries`.
  - New two-pass main loop: Pass 1 RINSES existing data (HEAD-checks coverUrl, runs the placeholder heuristic on summary, re-cleans subjects through the now-stricter filter). Pass 2 does the 3d backfill from the API (only when admin hasn't curated `series` already).
  - **Critical contract**: the script never overwrites GOOD data with API data. It only CLEARS values that the heuristic identifies as bad. The interactive comparison-and-merge lives in the AdminBooks Refresh modal, not here.
  - Summary line expanded to break out `rinsedFields` vs `backfilledOnly` vs `cleanAlready` so operator re-runs surface what changed honestly.
- **UI Refresh button changes**: replaced the "API result overwrites the form" behavior with a per-field diff modal.
  - New `src/utils/bookDiff.js` — `computeBookDiff(existing, fresh)` returns a list of `{field, label, inputType, hint, oldValue, newValue, kind, defaultChecked}` rows for every field that differs. Eight fields are diffed: title, authors, publishedYear, coverUrl, summary, series, seriesNumber, subjects. ReadingLevel is admin-only (never API), source / coverStoragePath / isbn13 are out of scope for the diff.
  - New `src/components/RefreshDiffModal.jsx` + `.module.css` — modal-style overlay with one row per diff. Each row carries a smart-default checkbox, the old value (read-only display), and an EDITABLE input/textarea prefilled with the new API value (so the admin can tweak before applying). Rationale chip per row in cyan / loot-gold / magenta based on kind. Footer: "Select all" ↔ "Deselect all" toggle, Cancel, Apply selected. Esc closes; backdrop tap closes.
  - **Smart defaults** (the operator-protection contract):
    - Populate-empty (was empty, API has value) → ☑ checked. Additive, no risk.
    - Clear-existing (was set, heuristic-cleared API value) → ☐ unchecked. Protects manually-written prose.
    - Replace-existing (both set, differ) → ☐ unchecked. Ambiguous, operator chooses.
  - `handleRefresh` in `AdminBooks.jsx` rewritten: lookup → compute diff → if rows.length is 0 show "Already up to date" notice (new `.notice` style in `Admin.module.css`, cyan accent, distinct from the error magenta); otherwise open modal. Apply merges checked changes into form state and opens the edit form for final tweaks before Save.
  - **The Steam Train scenario is now safe by default**: if the operator manually wrote a good summary, the Refresh modal shows the row with kind="destructive" and the checkbox defaults to ☐ unchecked. The operator can blindly hit "Apply selected" and the summary stays.
- **AI fallback (Tier 3 for 3e + 3f) deferred to a follow-up slice**: the operator asked whether Brave / LOOT could auto-find a real cover or summary when the heuristic clears garbage. Right call but meaningfully larger scope (a "🤖 Find via AI" button per row in the diff modal that calls the 9c.3 `searchWeb` + `fetchPage` Cloud Functions). Tracked as Round 2.
- **vite-plugin-mkcert for HTTPS dev tracked as Round 3** — separate concern, unblocks scanner testing on operator's iPhone over LAN. iOS Safari requires HTTPS for `navigator.mediaDevices`; localhost is exempt but LAN IPs aren't.
- **Pricing reality (Brave)**: confirmed during 9c.3 deploy — Brave's "free" tier is $5/month auto-applied credits (≈1000 search requests at $5/1000), card required for signup, spend cap can be set to free-tier-only in their dashboard.
- **Other pending operator follow-ups (still open)**:
  - Re-run the (now-extended) `refresh-book-metadata.js` to rinse existing books with the new heuristics applied to coverUrl + summary fields.
  - Spot-check Steam Train Dream Train post-rinse — coverUrl should clear (script returns null after HEAD-checks 404 with `?default=false`), summary should clear (AR-code placeholder caught by heuristic).
  - Don't push the button! (`9781402287466`): verified during testing — heuristic correctly cleared the OL "K-3 Medialog, Inc. 190 Lexile. 4-8." catalog blurb. Real cover preserved.
  - Google Books API quota hit `0` during testing — separate issue (GCP project-side enforcement, not the public 100k/day tier). Worth a look at `books.googleapis.com` quota for project `624717413613` when convenient.
  - App Check provider config cleanup (carried over from earlier sessions).

### 2026-05-20 (morning) — Data-quality polish (3g done; 3e/3f Tier 1 done)

- **Single-file batched PR.** All three heuristics landed in `src/utils/bookLookup.js` — no schema changes, no new deps, no rules touched. The natural compounding follow-up to 9c.3.
- **9c.3 verification in production happened first.** Three live tests in LOOT all passed cleanly: real Kirkus summary for *Steam Train Dream Train* with cited URL, honest "couldn't find it" on a made-up series, real sponsor-business lookup for a Pemberville pizza place that pivoted to the actual nearby business. CITATION & HONESTY block is sticking; tool routing is selecting the right tool; chips render correctly. Brave key set + functions deployed; spend cap set to free tier in Brave's dashboard.
- **Pricing correction.** Brave's "free tier" turned out to be $5/month auto-applied credits (≈ 1000 search requests at $5/1000), NOT 2000 queries/month free as I'd originally documented. AND a card IS required for the credits-only plan. Updated documentation accordingly. Quota cap (50 web searches + 100 page fetches per UID per day) NOT lowered — Miguel wants to watch real usage and tune later.
- **Heuristic decisions locked:**
  - **3g** — Skipped the `awards[]` separate field. Human-readable bestseller strings ("New York Times bestseller") pass through fine as subjects. The actual offender was the URL-shaped variant which the `:`/`=` filter catches cleanly. Less schema = less migration risk.
  - **3e Tier 1** — HEAD-check with 5s timeout; drop on 404 or content-length < 1000 bytes; on network error KEEP the URL (better false-positive than dropping a legit cover). OL URLs get `?default=false` appended so they 404 honestly going forward.
  - **3f Tier 1** — Clear the summary to empty string when the heuristic fires. Cross-source merging (OL empty → try Google Books) was OUT of scope — sticks with Tier 2 (cycle button) and Tier 3 (AI fallback via 9c.3).
- **Title-search path skips the HEAD check on purpose.** `searchOpenLibrary` and `searchGoogleBooks` return up to 5 candidates — running 5 HEAD probes × 5s timeout would balloon LOOT's `searchBooksByTitle` tool latency. The validity check fires once the user picks a specific ISBN.
- **Operator follow-up (for Miguel, when convenient):**
  - Re-run `scripts/refresh-book-metadata.js` so existing books (Steam Train Dream Train, Kristy and the Snobs, etc.) pick up the cleaned heuristics:
    ```
    GOOGLE_APPLICATION_CREDENTIALS="/Users/miguelbrown/LuckeyLogic/Admin/library-loot-firebase-adminsdk-fbsvc-f997eb8924.json" \
      node /Users/miguelbrown/LuckeyLogic/Programming/WebBasedProjects/library-loot/scripts/refresh-book-metadata.js
    ```
    Script never clobbers admin-curated values; safe to re-run.
  - After refresh: spot-check Steam Train Dream Train — cover URL should change (or the front-end shows broken-image on the bad URL since `?default=false` is appended); summary should clear to empty.
  - App Check provider config cleanup (still tracked from earlier sessions).
- **Next session candidates** (ordered by impact-per-hour):
  - **3e Tier 2 + 3f Tier 2** — "Try next source" cycle buttons in AdminBooks UI. Now that Tier 1 lands, the user-visible failure modes (empty summary, broken cover) need the cycle button to be one-click recoverable.
  - **3e Tier 3 + 3f Tier 3** — "🤖 Ask AI to find one" buttons that call into the now-shipped `searchWeb` / `fetchPage`. Most satisfying lift once Tier 2 ships — this is where 9c.3 starts paying real dividends.
  - **9c.1b** — Weekly insights Cloud Function. Building it before there's a real corpus of conversations would produce a sparse digest; better to let LOOT chat usage accumulate first.
  - **Quota viewer** (`/admin/loot/usage`) — small slice that opens read access on `_loot_meta` to tenant admins and renders a usage table. Defer unless Miguel actually wants the visibility.

### 2026-05-19 — ITEM 9c.3 (LOOT web-search tool)

- **9c.3 shipped.** Two new Cloud Functions (`lootWebSearch` + `lootFetchPage`), `cheerio` added to `functions/`, deny-all rules for `_loot_meta` + `_loot_url_cache`, two new LOOT tools wired into the model + chip layer, system prompt expanded with web examples and a hard CITATION & HONESTY block. Build clean, lint clean. See the ITEM 9c.3 build-list entry for the full shipped notes + operator deploy steps.
- **Design choices locked during the build:**
  - HTML extraction: **cheerio** (CJS-compatible, lightweight, no jsdom dependency). Mozilla Readability would give better quality on news articles, but linkedom is ESM-only and jsdom is ~10MB; cheerio's manual extraction is good enough for v1 and ships in minutes instead of hours.
  - App Check: **OFF on the new callables**, matching the existing pattern. The platform-wide App Check provider config still needs cleanup before launch; enforcing on these two in isolation would block dev. Once App Check is healthy, flip `enforceAppCheck: true` on both `onCall` configs.
  - Rate limits: **50 web searches + 100 page fetches per UID per day.** Counters live in the same `/_loot_meta/{tenant_uid_date}` doc, incremented in a Firestore transaction so concurrent calls can't race past the cap.
  - URL cache: **24h, keyed by SHA-256 of the canonical URL.** Old docs sit until manually cleaned; future TTL policy could automate that.
  - Safesearch: **strict.** Library Loot is a kids' reading program — we never want LOOT surfacing adult content even if an admin's query lands borderline.
- **SSRF defense.** `lootFetchPage` rejects non-http(s) schemes and blocks the obvious private-network targets (localhost, 127.x, 10.x, 192.168.x, 172.16-31.x, 169.254.x, .local, .internal). Not a complete defense — DNS rebinding could in principle still slip through — but it stops the accidental + trivially-malicious cases. Worth revisiting if/when public LOOT (9g) lands.
- **The "never invent" guardrail.** New `CITATION & HONESTY` block in the system prompt: every web-sourced claim MUST carry the URL inline; if searches genuinely turn up nothing, LOOT says so and asks for a different query — it doesn't make something up. This is the same hallucination-resistance discipline Miguel surfaced when LOOT confidently invented a "ticket-based prize draw" in 9b.
- **Operator pending work (Miguel, when you have a minute):**
  - Sign up for Brave Search API → grab the key.
  - `firebase functions:secrets:set BRAVE_SEARCH_API_KEY`
  - `firebase deploy --only firestore:rules,functions`
  - First real prompt to verify end-to-end: "Find a real summary for Steam Train Dream Train — Open Library is giving me garbage."
- **Other pending items from the previous session still open:**
  - Re-run `scripts/refresh-book-metadata.js` after deeper-chain enrichment landed in 3d so existing books pick up the richer series + works-endpoint subjects.
  - Manually curate Kristy and the Snobs (set series "The Baby-Sitters Club Graphix" #10; replace NYT-tag subjects with curated ones).
  - App Check provider config cleanup (separate from this item; tracked above).
- **Next session candidates** (in order of impact-per-hour now that 9c.3 has unblocked the AI fallbacks):
  - **3g** — Filter catalog-system garbage out of `dedupeSubjects()` (smallest cleanest win, no new deps).
  - **3e Tier 1 + 3f Tier 1** — Heuristics in `bookLookup.js` (URL validity check + summary placeholder detection). Batchable.
  - **3e Tier 2 + 3f Tier 2** — "Try next source" cycle buttons in AdminBooks. Same shape; batchable.
  - **3e Tier 3 + 3f Tier 3** — "Ask AI to find one" buttons that call into the now-shipped `searchWeb` / `fetchPage` tools.
  - **9c.1b** — Weekly insights Cloud Function (next natural continuation of the conversation-logging work).

### 2026-05-15 — ITEM 9a + 9b

- **ITEM 9 sliced and re-scoped.** Original ITEM 4 absorbed sponsor intake into 9d/9e because Miguel wants AI helping with sponsor flow from day one. ITEM 4 shrunk to residual prize inventory. New items added: ITEM 10 (sponsor accounts, invite-only) and ITEM 11 (sponsor thank-you / prize-won screen, admin-approved).
- **9a (operator setup) done.** Vertex AI API + Firebase AI Logic + App Check + reCAPTCHA Enterprise + debug token all wired in the Firebase Console. Site key in source (public); debug token in `.env.local` (gitignored); secret-key-shaped credential pasted into App Check provider config server-side.
- **9b (LOOT shell) done.** Floating chat button on `/admin/*`, opens a panel that talks to Gemini 2.5 Flash via Vertex AI. Conversation persists in sessionStorage per session. No tools yet — those land in 9c. First successful chat (verified in dev): `"hi"` → `"Hey! Ready to level up some readers? What's on the quest list today?"` — system prompt landing the Fortnite-vibe tone.
- **LOOT system-prompt tuning, mid-9b verification.** First version was too restrictive — "Who is the author of _Steam Train, Dream Train_?" got refused with "Not my loot drop — try Google" even though the book is in the catalog and authorship is squarely within scope. Loosened the prompt to explicitly cover books/authors/reading levels/program logistics/sponsor strategy/COPPA basics/platform-itself questions, and tightened the refusal list to truly off-program topics (recipes, sports, news, generic coding, personal advice). Also discovered LOOT was confidently inventing a "ticket-based prize draw" mechanic that doesn't exist — added a `GROUND TRUTH` block to the system prompt that documents the actual per-completion verifiable random draw against the active prize pool (every completion → one prize, randomization on WHICH prize) and explicitly tells LOOT not to invent mechanics it can't ground in the docs or its tools. New tracked sub-item (9c.1) for LOOT conversation logging + weekly digest so we catch future hallucinations early.
- **Navbar bugs fixed (truncation + mobile menu).** "Hi, Miguel" was clipping to "Hi, Mi..." because of a defensive `max-width: 12ch; overflow: hidden; text-overflow: ellipsis` on `.greeting` that pre-dated the upstream `greeting()` helper's first-name-only collapse. Cap was never needed once we stopped rendering raw emails. Removed entirely; only `white-space: nowrap` remains. Also wired outside-tap + Escape dismiss for the mobile hamburger menu — refs on the toggle button and the nav panel; a `pointerdown` handler at the document level closes the menu when a tap lands outside both. Effect is only attached while the menu is open (no event handler in the common closed state). Verified: tap-outside closes, tap-toggle still toggles, tap-link still navigates + closes, Escape closes.
- **3 new tracked items surfaced from ITEM 3d testing (2026-05-15):**
  - **3e (expanded)** — Cover URL validity check + cycle-through-sources button + AI fallback. Steam Train Dream Train was carrying a "valid-looking" OL cover URL that actually serves a 1×1 placeholder pixel; we never noticed.
  - **3f (new)** — Summary quality. Heuristic to detect placeholder garbage (`Accelerated Reader LG 2.8 0.5 158536` is an AR catalog code, not a description) + cycle through sources + AI fallback to fetch real summaries.
  - **3g (new)** — Subject tag quality. Filter garbage like `nyt:graphic-books-and-manga=2021-10-10` before it lands in `subjects[]`. Move bestseller-list metadata into a separate `awards[]` field if we want to keep it.
- **ITEM 9c.3 added (LOOT web-search tool).** Miguel observed that GUNNY (MCL Central, Anthropic Claude) can answer "find me a summary for this book" while LOOT (Library Loot, Gemini 2.5 Flash via Vertex AI) cannot. Diagnosis: it's not a Gemini-vs-Claude capability gap — Gemini's tool-calling is fully featured. The gap is that Anthropic ships a built-in `web_search` tool that GUNNY inherits, while Vertex AI doesn't, so we need to wire it ourselves. Plan: Cloud Function intermediary calling Brave Search API (free tier 2000 queries/month), exposed to LOOT as a `searchWeb(query)` tool + a `fetchPage(url)` follow-up. Server-side so the API key never leaks. Same backend powers the "AI find" buttons in 3e (cover URL) and 3f (summary).
- **ITEM 3d shipped — book series + subjects metadata.** Surfaced during LOOT verification when a user asked "do we have any baby-sitters club books?" and LOOT couldn't match Kristy and the Snobs (in the catalog) to the BSC series — no `series` field existed on book docs. Added `series` (string|null), `seriesNumber` (number|null), `subjects` (string[], cap 6) to the book Firestore shape. Both APIs (Open Library + Google Books) populate them at lookup time; admin can edit them in AdminBooks; `searchCatalog` accepts new `series` + `subject` criteria with the same punctuation-normalized substring matching used for title/author. Backfill via `scripts/refresh-book-metadata.js` — re-runnable, never clobbers admin-curated values. No rule changes (books were already public-read, admin-write).
- **ITEM 9c.1a shipped — LOOT conversation logging.** Modeled after MCL Central's `adminChatLogs` pattern: one doc per session keyed by per-tab UUID, full turns array overwritten on each model response (capped at 50 turns), `setDoc(..., {merge: true})` with a one-time getDoc check to keep `sessionStartedAt` from being clobbered on subsequent writes. New `src/lib/loot/lootLogger.js` exports `logLootSession()` + `getOrCreateLootSessionId()` so future audiences (parents 9f, anon 9g) can reuse the same write path. Tool-call chips are included in the persisted turns so the future transcript viewer matches the live chat. Rules: read by any tenant admin; create + update gated on the session's owning UID; delete by any admin. System prompt updated with a LOGGING & TRANSPARENCY section so LOOT answers honestly if asked. 9c.1b (digest function) and 9c.1c (admin viewer) follow as separate items. Skipped LastModified on session docs by design — the natural shape of a chat log (lastTurnAt + always-growing turns array) is its own audit trail.
- **ITEM 9c.2 shipped — Auth profile mirror + LastModified accountability.** AuthContext gained a new effect that gates on bootstrap success (`claims.tenant` set) and, when a user signs in OR their auth-user object changes mid-session, reads the user's Firestore doc and writes mirrored fields (`displayName`, `photoURL`, `email`) when they've drifted. Two distinct timestamp concepts now live on the doc:
  - **`lastSeenAt`** — activity signal. Bumped on sign-in or every 5+ min of active session regardless of changes. 5-minute freshness floor on writes to avoid token-refresh spam.
  - **`lastModified`** — an embedded `LastModified` object `{byName, byUUID, date, state}` (ported from MCL Central's `model/LastModified.js`). Bumped ONLY when the mirrored fields actually changed. The previous value is archived to a write-once `lastModifieds` subcollection in the same `writeBatch`, giving us a permanent accountability trail without inflating the user doc.
- New file `src/model/LastModified.js` is the canonical embed pattern (call `lastModified.toDict()` inside the parent's `toFirestore`; rehydrate via `LastModified.fromDict(data.lastModified)`). Future models (sponsors, prizes, redemptions, etc.) follow the same shape so the admin audit experience is consistent across the platform.
- Firestore rules updated: per-field-diff self-update via `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'photoURL', 'email', 'lastSeenAt', 'lastModified'])` — same pattern ITEM 12's onboarding-acks rule will follow. New rule for the audit subcollection `/{tenantId}/_main/users/{uid}/lastModifieds/{lmId}` — read by self or admin, create by self or admin (so the batch write succeeds), but **update and delete are permanently forbidden** (immutable history).
- New `scripts/backfill-user-profiles.js` walks Auth users and syncs profile fields into existing docs; the script also archives any previous `lastModified` value into the audit subcollection and attributes its own changes to `{byName: 'backfill-user-profiles.js', byUUID: 'system'}` so backfills are distinguishable from user-driven edits in the audit trail.
- **Rules must be deployed (`firebase deploy --only firestore:rules`) before the new client code can write — otherwise the mirror silently fails with a permission error and the doc just doesn't update.**
- **Original tracked-bug entry for 9c.2** — mirror Auth profile (`displayName`, `photoURL`, `email`, `lastSeenAt`) into the `/{tenant}/_main/users/{uid}` Firestore doc. Surfaced when Miguel asked why his name doesn't live in Firestore. Reality: Firebase Auth holds it, Firestore only has `role` + timestamps. Admin views in 9e and beyond will need names without going through the server-side Admin SDK. Lands before 9e.
- **ITEM 12 spec'd — first-time user onboarding (inline coachmarks v1).** Surfaced when Miguel pointed out that he knows what the LOOT button does because he built it; a new admin / parent doesn't. Design locked: inline coachmarks only for v1 (first-visit tour deferred to v2), per-user Firestore ack store with hotspot-id + version so material feature changes can re-fire the coachmark, universal hotspot catalog in source (per-tenant customization deferred), no onboarding for anonymous visitors, gold-bordered popover matching LOOT's visual identity. Must ship before public launch. Initial hotspots: LOOT button, admin tenant ID, ISBN scanner, add-child card, pending-verification badge. New surfaces shipped after ITEM 12 lands should include their own hotspot definitions in the same commit.
- **Mobile body-scroll lock — iOS Safari needed the heavier pattern.** First pass used `document.body.style.overflow = 'hidden'`, which works on desktop browsers but Safari ignores it once a touch-drag gesture starts. Replaced with the snapshot-scrollY + `position: fixed` + negative-top + `width: 100%` lock pattern, plus `overscroll-behavior: contain` on the message scroller as defense-in-depth, plus a blurred backdrop element behind the panel on mobile (`backdrop-filter: blur(8px) saturate(140%)`) so the fullscreen LOOT feels like its own surface and tapping the backdrop closes the panel.
- **Bug landed mid-build — App Check init order.** First pass had App Check initialized via a side-effect import from `main.jsx`, which fired AFTER `getAuth()` / `getFirestore()` / etc. were already called via `AuthContext`'s transitive load of `firebase.js`. Service clients were provisioned before App Check was wired and never attached tokens to requests (100% of dev requests showed as "outdated client / missing token" in App Check metrics). Fixed by refactoring `src/firebase/appCheck.js` to export `initAppCheck(app)` as a pure function (no top-level side effects, no import from `firebase.js`), and calling it from `firebase.js` between `initializeApp(...)` and the service getters. Future Firebase services added to this codebase must be created AFTER the `initAppCheck` call.
- **`firebase` SDK bumped 10.14.1 → 12.13.0** to get the canonical `firebase/ai` namespace (v10 only had `firebase/vertexai-preview`). Production build clean; no breaking changes for our usage pattern.
- **Open bug surfaced (track for a near-term fix):** Navbar truncates the signed-in user's name to `Hi, Mi...` on the admin shell (and possibly other signed-in routes). Likely a CSS `text-overflow: ellipsis` on a too-narrow container. Investigate `Navbar.module.css` (and possibly `AdminLayout.module.css` for the `.who` line in the sidebar header — its `title` attribute already carries the full name as a hover tooltip, but the visible truncation is the issue).
- **Design lock-ins for downstream items:**
  - **9g** (public LOOT): match MCL-Central's rate-limit + token pattern. Read mcl-central source directly when we reach that item.
  - **ITEM 10** (sponsor signup): **invite-only**. No open signup. Sponsors apply via inquiry → admin reviews + approves → admin issues invite token (mirror first-admin setup-token flow). Brand-safety filter against inappropriate businesses (dispensaries, age-restricted products) is intentional.
  - **ITEM 11** (sponsor thank-you screen): **image + text only** for v1, no video. Admin approval REQUIRED before any kid-facing surface shows the content. Sponsor handles their own redemption (QR/barcode/words — Library Loot just displays what they upload). COPPA-relevant: all kid-facing sponsor content moderated.

### 2026-05-12 — Project kickoff

- Project concept defined: community-funded reading rewards. Adults sponsor, kids read, verifiable random draw awards a donated prize. **The site never handles money.** All v1 donations are physical drop-offs at the library (V-Bucks gift cards, Fortnite Legos, posters, action figures). The librarian logs them into the prize pool.
- Decisions locked: MIT license; Firebase backend only (Auth + Firestore + Storage + Functions + Hosting); Google + Email/Password + Facebook auth; AI-assisted quiz generation with librarian approval; Firebase AI Logic (Gemini 2.0 Flash) over Anthropic API for transferability; multi-tenant per-org root collection from day one; CLAUDE.md and SPEC.md committed (public repo).
- **v1 prizes are Fortnite-only** — V-Bucks, Legos, action figures, apparel, posters. Rationale: keeps the site squarely inside the Epic Games Fan Content Policy. Mixing non-Fortnite prizes (Amazon, Nintendo, etc.) shifts the framing toward "branding used to promote unrelated commerce," which is exactly what the Fan Content Policy doesn't cleanly cover. Revisit only if/when we drop Fortnite branding.
- Fan Content Policy stance: keep the hero PNG with Fortnite-character likenesses, ship with prominent disclaimers in the footer and in About / ToS / Privacy, make the art easily swappable at first sign of pushback. No commercial use anywhere in the pipeline.
- Origin story added: Jackson (Miguel's son) asked if he could earn V-Bucks for reading books at the school book fair — that's the entire idea. The fan-art-style portrait `JAMBO.png` sits in a dedicated story section on the About page.
- ITEM 0 complete: Vite/React scaffold, theme, layout shell, six pages, hero bg + Summer of Library Loot logo wired in, origin-story section on About. Assets currently served from `public/assets/`; ITEM 1 migrates them to Firebase Storage.
- ITEM 1 complete: Firebase project wired in (`library-loot`); `firebase init` set up Firestore + Functions (Node 22) + Hosting (static, not the Web Frameworks experiment) + Storage; deny-by-default rules deployed except public-read on `/{tenantId}/assets/**`; three optimized assets uploaded to Storage under `/luckey-logic/assets/{hero,branding,story}/`; `public/assets/` and `temp folder for assets/` deleted; GitHub Actions workflows installed with `FIREBASE_SERVICE_ACCOUNT_LIBRARY_LOOT` secret. The new transparent-background logo (RGBA, alpha=0 in corners) replaces the earlier flood-filled version. First push triggers the live deploy via Actions.
