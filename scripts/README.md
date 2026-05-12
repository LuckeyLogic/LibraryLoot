# Library Loot — Operator Scripts

Local-only operator scripts for provisioning, export, and import. None of these run in the browser, in Cloud Functions, or in CI — they're meant to be invoked by hand by the project operator with a service-account JSON.

---

## Prereqs

1. **Service account JSON.** Firebase Console → Project Settings → Service accounts → **Generate new private key**. Save the downloaded JSON **outside** this repo (suggested: `~/.firebase-keys/library-loot-admin.json`). Do **not** commit it — `.gitignore` already excludes `service-account*.json` as a safety net.
2. **Node 20+.** (Matches Firebase CLI and Cloud Functions runtime.)
3. **Install local deps once:** `cd scripts && npm install`.

The scripts authenticate via Application Default Credentials. Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of your service-account JSON whenever you run a script.

---

## `seed-tenant.js` — Provision a new tenant

Creates a fresh tenant root under `/{tenantId}/_main` in Firestore with sane defaults, and issues a one-time setup token the first admin pastes at `/admin/setup` to claim admin access.

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.firebase-keys/library-loot-admin.json \
  node seed-tenant.js <tenantId> [contactEmail] [tenantName]
```

- `<tenantId>` — required, lowercase kebab-case. Becomes the Firestore top-level collection key. Examples: `luckey-logic`, `pembervill-public-library`.
- `[contactEmail]` — optional, populates `_main.support.{program,coppa,privacy}ContactEmail`. Can be edited later in the admin settings panel.
- `[tenantName]` — optional human-readable name. Defaults to a Title-Cased rewrite of `<tenantId>`.

**Output:** prints the plaintext setup token to stdout exactly once. Copy it immediately. Only its SHA-256 hash is stored in Firestore — the plaintext cannot be recovered. Token expires in 30 days.

**To bootstrap your first admin (one-time):**

```bash
cd scripts
npm install

GOOGLE_APPLICATION_CREDENTIALS=~/.firebase-keys/library-loot-admin.json \
  node seed-tenant.js luckey-logic libraryloot@luckeylogic.com "Luckey Logic Demo"
```

Then visit https://library-loot.web.app/admin/setup, sign in with the account you want to be admin, paste the token, click **Claim admin role**.

---

## Coming in later items

- `export-tenant.js` — dump a tenant's Firestore root + Storage prefix into a portable bundle (ITEM 8).
- `import-tenant.js` — restore a bundle into another Firebase project (ITEM 8).
- `delete-tenant.js` — final-step removal from the source project after handoff (ITEM 8).

---

## Safety reminders

- **Never paste your service-account JSON into chat / email / a public commit.** It grants full admin rights to the entire Firebase project.
- **Never commit the plaintext setup token.** It grants admin on the bound tenant for 30 days.
- **Rotate the service-account key** if it's ever exposed: Firebase Console → Project Settings → Service accounts → "Manage all service accounts" → disable the leaked key → create a new one.
