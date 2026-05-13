# Library Loot

> **Community-funded reading rewards for libraries.**
> A web app where adults sponsor reading challenges, kids accept and complete them, and the site randomly awards a donated prize. The platform takes no cut — every dollar goes to prizes.
>
> Built by **[Luckey Logic LLC](https://github.com/LuckeyLogic)** · MIT licensed.

**Live:** [library-loot.web.app](https://library-loot.web.app) — current build
**Developer docs:** [library-loot.web.app/docs/](https://library-loot.web.app/docs/) — auto-rebuilt on every push

---

## What it is

Adults (parents, grandparents, neighbors, local businesses) sponsor a specific book with a prize donation. A child accepts the challenge through the library's Library Loot site, reads the book, and proves they read it (quiz mode, oral check-off, or librarian sign-off — no written reports, because kids would just feed the prompt to an AI). On approval, a Cloud Function runs a verifiable random draw against the donated-prize pool and awards one prize.

- **Free to participate.** No fees, no ads, no rake. v1 takes no money through the platform — sponsors physically drop off prizes at the library.
- **All-Fortnite prizes for v1.** V-Bucks gift cards, Fortnite Legos, action figures, posters, apparel. Keeps the site cleanly inside Epic's [Fan Content Policy](https://www.epicgames.com/site/en-US/fan-art-policy).
- **Multi-tenant from day one.** Each library gets its own isolated data root in Firestore + Firebase Storage. When a library wants their own instance, a migration script moves their root out — no shared data, no lingering coupling.
- **Built to be handed off.** Every architectural decision favors making it easy for a library or partner org to take operational ownership without ever needing Firebase Console access.

## Where the project stands (2026-05-13)

| Status | Item |
|---|---|
| ✅ | ITEM 0 — Scaffold (Vite + React + theme + six pages) |
| ✅ | ITEM 1 — Firebase project wired up; first deploy live; assets in Storage |
| ✅ | ITEM 2a — Auth (Google + Email/Password) + AuthContext + login/signup |
| ✅ | ITEM 2b — First-admin setup-token flow + Cloud Functions |
| ✅ | ITEM 2c — Real per-tenant Firestore + Storage rules + tenant-claim bootstrap |
| ✅ | ITEM 2e.1 — Admin shell + Settings panel + tenant-live About / Privacy / Terms |
| ✅ | ITEM 2g — Themed JSDoc developer-docs site |
| ✅ | ITEM 2h — Docs auto-build + deploy at `/docs/` |
| 🚧 | ITEM 2e.2 — Admin avatar manager + image optimizer |
| ⏳ | ITEM 2d — Parent dashboard + child sub-profiles (with anti-cheat verified flag) |
| ⏳ | ITEM 3 — Book management (ISBN scan + Open Library API) |
| ⏳ | ITEM 4 — Prize management + sponsor branding + Sponsor intake form |
| ⏳ | ITEM 5 — Challenge lifecycle + AI-assisted quiz authoring |
| ⏳ | ITEM 6 — Verifiable random prize draw (drand → random.org → crypto entropy chain) |
| ⏳ | ITEM 7 — Public browse + printable display-table cards |
| ⏳ | ITEM 8 — Handoff scripts (export / import / setup playbook) |

See [SPEC.md](./SPEC.md) for the canonical data model, prize-selection algorithm, COPPA approach, legal disclaimers, and handoff procedure. See [CLAUDE.md](./CLAUDE.md) for the project guide used by anyone (human or AI) working on this code.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5 + React Router 6 |
| Auth | Firebase Authentication (Google + Email/Password) |
| Database | Cloud Firestore — multi-tenant, deny-by-default rules |
| File Storage | Firebase Storage — public-read on the assets prefix, admin-write |
| Backend | Firebase Cloud Functions (Node 22, 2nd gen, `us-central1`) — HTTPS callables for tenant provisioning, setup-token claims, and (future) prize draws |
| AI | Firebase AI Logic / Vertex AI — Gemini 2.0 Flash (quiz authoring, ITEM 5) |
| Random entropy | drand (League of Entropy) → random.org → `crypto.randomBytes` fallback (ITEM 6) |
| Hosting | Firebase Hosting — single site, React app at `/`, docs at `/docs/` |
| CI/CD | GitHub Actions → live + PR preview channels |
| Docs | Custom JSDoc template themed against the site's `tokens.css` |

## Quick start

```bash
npm install

npm run dev        # vite dev server  → http://localhost:5173
npm run build      # vite production build → dist/
npm run docs       # JSDoc developer docs → docs/ (local preview)
npm run build:all  # everything — vite + docs → dist/ (CI uses this)
```

After build, preview the deploy-shape locally:

```bash
python3 -m http.server 8123 --directory dist
# → http://localhost:8123/         React app
# → http://localhost:8123/docs/    developer docs
```

### Operator scripts

Local-only scripts for tenant provisioning, user backfill, and inspection. Each authenticates via a Firebase service-account JSON kept **outside** the repo (`.gitignore` excludes `service-account*.json` as a safety net regardless). See [`scripts/README.md`](./scripts/README.md).

```bash
cd scripts && npm install   # one-time

GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json \
  node seed-tenant.js <tenantId> [contactEmail] [tenantName]

GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json \
  node check-user.js <emailOrUid> [tenantId]
```

## Multi-tenant model

Every Firestore document and Storage path lives under the active tenant's root. The tenant ID is the top-level collection name. The default tenant `luckey-logic` is hosted by Luckey Logic for development and demos; a library taking operational ownership gets their own root (e.g. `pembervill-public-library`) which can be migrated to their own Firebase project later.

```
Firestore                                            Storage
─────────                                            ───────
/luckey-logic/_main                                  /luckey-logic/assets/...
/luckey-logic/_main/users/{uid}                      /luckey-logic/avatars/...
/luckey-logic/_main/books/{bookId}                   /luckey-logic/sponsors/...
...                                                  ...
```

App code never hardcodes a tenant ID — every Firestore / Storage path routes through `src/firebase/tenant.js`. See SPEC.md §2 for the full design.

## Public repo discipline

This repo is **public** at `github.com/LuckeyLogic/LibraryLoot`. Never committed: secrets, service-account JSONs, OAuth client secrets, `.env*` files, real user data, the temp folder used to stage assets pre-upload, any image containing recognizable third-party IP characters that we are NOT explicitly using under Fan Content terms.

## License

[MIT](./LICENSE). © 2026 Luckey Logic LLC.

### Trademark

"Fortnite" and "V-Bucks" are trademarks of Epic Games, Inc. This program is not affiliated with or endorsed by Epic Games. Fortnite-related visual elements are used as Fan Content under Epic's [Fan Content Policy](https://www.epicgames.com/site/en-US/fan-art-policy) and may be removed at any time.
