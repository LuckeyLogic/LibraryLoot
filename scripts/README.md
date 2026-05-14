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

## `check-user.js` — Inspect a Firebase Auth user

Read-only. Looks up a user by email or UID and prints their auth record, custom claims (`admin`, `tenant`), and (if a tenant is supplied) the per-tenant user profile doc at `/{tenantId}/_main/users/{uid}`. Useful for confirming claims after sign-up, debugging a "why doesn't this user see admin?" report, or seeing what role / display name / avatar a parent is wired up with.

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  node check-user.js <emailOrUid> [tenantId]
```

- `<emailOrUid>` — required. Accepts either the user's email address or the Firebase Auth UID.
- `[tenantId]` — optional. If omitted, claims are still printed but the per-tenant profile lookup is skipped.

---

## `backfill-user-claims.js` — Backfill `tenant` claim on existing users

One-shot maintenance script for the rare case where rules / Cloud Function changes leave already-signed-up users without the `tenant` custom claim. Scans Firebase Auth, finds users missing the claim, and sets it to the supplied tenant (default `luckey-logic`). Idempotent — re-running on an already-fixed user is a no-op.

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  node backfill-user-claims.js [tenantId]
```

- `[tenantId]` — optional. Defaults to `luckey-logic`.

After it runs, affected users must sign out and back in for the new claim to appear in their ID token.

---

## `check-hygiene.js` — Audit Firestore docs vs. Storage objects

Read-only. Compares Firestore docs to Storage objects under a tenant root and flags orphans in either direction:

- Storage files with no matching Firestore doc (orphan files left behind after a delete went wrong).
- Firestore docs pointing at a `storagePath` / `coverStoragePath` that no longer exists in the bucket (dangling refs).
- Docs that have a Storage-hosted `downloadUrl` / `coverUrl` but no `storagePath` field set — meaning a future delete would silently leak the file.

Also checks tenant settings (`_main.support` populated?) and surfaces expired-but-not-cleaned-up `/_setup_tokens` entries. Run it after any bulk cover-upload / avatar-import session, or any time you suspect Storage has drifted from Firestore.

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  node check-hygiene.js [tenantId]
```

- `[tenantId]` — optional. Defaults to `luckey-logic`.

Exits 0 always (so it can be piped or wrapped); the issue count is printed in the final summary line.

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
