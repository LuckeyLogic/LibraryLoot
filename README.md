# Library Loot

> **Community-funded reading rewards for libraries.**
> A web app where adults sponsor reading challenges, kids accept and complete them, and the site randomly awards a donated prize. The platform takes no cut — every dollar goes to prizes.
>
> Built by **[Luckey Logic LLC](https://github.com/LuckeyLogic)** · MIT licensed.

---

## What it is

Adults (parents, grandparents, neighbors, local businesses) sponsor a specific book with a prize donation. A child accepts the challenge through the library's Library Loot site, reads the book, and proves they read it (quiz mode, oral check-off, or librarian sign-off — no written reports, because kids would just feed the prompt to an AI). On approval, a Cloud Function runs a verifiable random draw against the donated-prize pool and awards one prize.

- **Free to participate.** No fees, no ads, no rake.
- **Multi-tenant.** Each library gets its own isolated data root in Firestore + Firebase Storage. When a library wants to host their own instance, a migration script moves their root collections out — no shared data, no lingering coupling.
- **Built to be handed off.** Every architectural decision favors making it easy for a library or partner org to take operational ownership.

## What's here today

| Status | Item |
|---|---|
| 🚧 | ITEM 0 — Scaffold (in progress) |
| ⏳ | ITEM 1 — Firebase project wiring + initial deploy |
| ⏳ | ITEM 2 — Auth (Google + Email/Password + Facebook) + parent/child sub-profile model |
| ⏳ | ITEM 3 — Book management (ISBN scan + Open Library API) |
| ⏳ | ITEM 4 — Prize management + sponsor branding upload |
| ⏳ | ITEM 5 — Challenge lifecycle + quiz verification |
| ⏳ | ITEM 6 — Verifiable random prize draw (real-world entropy chain) |
| ⏳ | ITEM 7 — Public browse + printable display-table cards |
| ⏳ | ITEM 8 — Handoff scripts (export / import / setup playbook) |

See [SPEC.md](./SPEC.md) for the canonical data model, prize-selection algorithm, COPPA approach, and disclaimers. See [CLAUDE.md](./CLAUDE.md) for the project guide used by anyone (or any AI assistant) working on this code.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run docs     # JSDoc → docs/
```

Firebase wiring lands in ITEM 1. Until then, the app runs as a static front-end shell with placeholder data.

## License

[MIT](./LICENSE). © 2026 Luckey Logic LLC.

### Trademark

"Fortnite" and "V-Bucks" are trademarks of Epic Games, Inc. This program is not affiliated with or endorsed by Epic Games. Fortnite-related visual elements are used as Fan Content under Epic's [Fan Content Policy](https://www.epicgames.com/site/en-US/fan-art-policy) and may be removed at any time.
