# Library Loot — Developer Reference

**Luckey Logic LLC · Public Repo**

Auto-generated API reference for the Library Loot multi-tenant reading-rewards platform. Browse components, pages, context providers, models, and utilities using the **Contents** panel on the right. Type into the filter to narrow the list. Use the in-file text search on a source page to jump between matches.

> This documentation is generated locally with `npm run docs`. The output (`docs/`) is gitignored — regenerate at any time and the contents stay in sync with the current `main` branch.

## Quick Links

| Area | Lives in | What's in it |
|------|----------|--------------|
| Pages | `src/pages/` | Top-level route pages rendered by React Router — Home, About, Donors, Sponsor, Login, Signup, AdminSetup, Terms, Privacy, NotFound |
| Components | `src/components/` | Shared UI — Navbar, Footer, Disclaimer, PrivateRoute, AdminRoute |
| Context | `src/context/` | `AuthContext` / `useAuth` — auth state, sign-in helpers, custom-claim reads |
| Firebase | `src/firebase.js`, `src/firebase/tenant.js` | Firebase client init and the single-source-of-truth tenant root helper |
| Site content | `src/data/siteContent.js` | All user-facing copy, brand info, fallback support contact |

## Where things live

- **Firestore data model** — see `SPEC.md` at the repo root (canonical schema, prize-selection algorithm, COPPA stance, legal disclaimers, handoff procedure).
- **Build list + decisions** — see `CLAUDE.md` at the repo root (item-by-item status, session notes, style guide).
- **Cloud Functions** — under `functions/src/`. Each callable lives in its own module. Not currently documented here; JSDoc points at `src/` only.
- **Operator scripts** — under `scripts/`. Use a service-account JSON to provision tenants, backfill claims, and inspect users.

## Conventions

- 2-space indentation across all source.
- CSS variables only — never hardcode colors. Tokens live in `src/styles/tokens.css` and are shared between the React app and this docs site.
- JSDoc on every component, exported function, model class, and utility.
- Multi-tenant: every Firestore / Storage path routes through `src/firebase/tenant.js`. No hardcoded tenant IDs anywhere in app code.
