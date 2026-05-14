// scripts/check-hygiene.js
//
// READ-ONLY hygiene check that compares Firestore documents to Storage
// objects under a tenant root and reports orphans in either direction.
//
// Catches:
//   - Storage objects with no matching Firestore doc (orphan files)
//   - Firestore docs referencing a Storage path that doesn't exist
//   - Firestore docs whose download URL points at Storage but
//     coverStoragePath / avatarStoragePath isn't set (or vice versa)
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
//     node check-hygiene.js [tenantId]
//
// Created by Miguel Brown on 5/14/26.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.

"use strict";

const admin = require("firebase-admin");

const [, , tenantArg]  = process.argv;
const DEFAULT_TENANT   = tenantArg || "luckey-logic";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS must be set.");
  process.exit(1);
}

admin.initializeApp({
  credential     : admin.credential.applicationDefault(),
  storageBucket  : "library-loot.firebasestorage.app"
});

const db      = admin.firestore();
const bucket  = admin.storage().bucket();

const HEADING = (label) => `\n── ${label} ──`;
let issuesFound = 0;
function note(line)  { console.log("  " + line); }
function flag(line)  { console.log("  ✗ " + line); issuesFound++; }
function ok(line)    { console.log("  ✓ " + line); }

async function listStoragePrefix(prefix) {
  const [files] = await bucket.getFiles({ prefix });
  return files.map((f) => f.name);
}

/**
 * Reads a Firestore subcollection under /{tenantId}/_main/...
 */
async function readSubcollection(...path) {
  const ref  = db.collection(DEFAULT_TENANT).doc("_main").collection(path[0]);
  const snap = await ref.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function checkAvatars() {
  console.log(HEADING("AVATARS"));
  const docs  = await readSubcollection("avatars");
  const files = await listStoragePrefix(`${DEFAULT_TENANT}/avatars/`);

  // Resize Images extension drops generated thumbs at /thumbs/* — they're
  // expected so don't count them as orphans.
  const ownedFiles = files.filter((f) => !f.includes("/thumbs/"));
  note(`Firestore avatar docs:        ${docs.length}`);
  note(`Storage files (ex thumbs):    ${ownedFiles.length}`);

  const referencedPaths = new Set(
    docs.map((d) => d.storagePath).filter(Boolean)
  );
  const fileSet = new Set(ownedFiles);

  // Orphan files (Storage with no doc)
  const orphanFiles = ownedFiles.filter((f) => !referencedPaths.has(f));
  if (orphanFiles.length === 0) {
    ok("No orphan Storage files.");
  } else {
    orphanFiles.forEach((f) => flag(`Orphan Storage file: ${f}`));
  }

  // Orphan docs (doc references a Storage path that doesn't exist)
  const danglingRefs = docs.filter(
    (d) => d.storagePath && !fileSet.has(d.storagePath)
  );
  if (danglingRefs.length === 0) {
    ok("No dangling storagePath references.");
  } else {
    danglingRefs.forEach((d) =>
      flag(`Doc "${d.name || d.id}" → storagePath '${d.storagePath}' not in bucket`)
    );
  }

  // Docs with downloadUrl but no storagePath — these would leak on delete
  const urlButNoPath = docs.filter((d) => d.downloadUrl && !d.storagePath);
  if (urlButNoPath.length === 0) {
    ok("Every doc with downloadUrl has a storagePath set (clean delete possible).");
  } else {
    urlButNoPath.forEach((d) =>
      flag(`Doc "${d.name || d.id}" has downloadUrl but no storagePath — cleanup on delete would miss it`)
    );
  }
}

async function checkBooks() {
  console.log(HEADING("BOOKS"));
  const docs  = await readSubcollection("books");
  const files = await listStoragePrefix(`${DEFAULT_TENANT}/books/`);
  const ownedFiles = files.filter((f) => !f.includes("/thumbs/"));

  note(`Firestore book docs:          ${docs.length}`);
  note(`Storage files (ex thumbs):    ${ownedFiles.length}`);

  const referencedPaths = new Set(
    docs.map((d) => d.coverStoragePath).filter(Boolean)
  );
  const fileSet = new Set(ownedFiles);

  const orphanFiles = ownedFiles.filter((f) => !referencedPaths.has(f));
  if (orphanFiles.length === 0) {
    ok("No orphan Storage files under /books/.");
  } else {
    orphanFiles.forEach((f) => flag(`Orphan Storage file: ${f}`));
  }

  const danglingRefs = docs.filter(
    (d) => d.coverStoragePath && !fileSet.has(d.coverStoragePath)
  );
  if (danglingRefs.length === 0) {
    ok("No dangling coverStoragePath references.");
  } else {
    danglingRefs.forEach((d) =>
      flag(`Book "${d.title || d.id}" → coverStoragePath '${d.coverStoragePath}' not in bucket`)
    );
  }

  // Books with a coverUrl pointing at Storage but no coverStoragePath set
  const storageUrlButNoPath = docs.filter((d) => {
    if (!d.coverUrl) return false;
    if (d.coverStoragePath) return false;
    return d.coverUrl.includes("firebasestorage.googleapis.com");
  });
  if (storageUrlButNoPath.length === 0) {
    ok("Every Storage-hosted cover has a coverStoragePath set (clean delete possible).");
  } else {
    storageUrlButNoPath.forEach((d) =>
      flag(`Book "${d.title || d.id}" has a Storage download URL but no coverStoragePath — cleanup on delete would miss it`)
    );
  }
}

async function checkTenantSettings() {
  console.log(HEADING("TENANT SETTINGS"));
  const snap = await db.collection(DEFAULT_TENANT).doc("_main").get();
  if (!snap.exists) {
    flag(`Tenant ${DEFAULT_TENANT} has no _main settings doc.`);
    return;
  }
  const data    = snap.data();
  const support = data.support || {};
  const required = [
    "organizationName",
    "programContactEmail",
    "coppaContactEmail"
  ];
  const missing = required.filter((k) => !support[k]);
  if (missing.length === 0) {
    ok(`Support block populated (org: ${support.organizationName}).`);
  } else {
    missing.forEach((k) => flag(`Tenant settings missing support.${k}`));
  }
}

async function checkSetupTokens() {
  console.log(HEADING("SETUP TOKENS"));
  const snap = await db.collection("_setup_tokens").get();
  const all      = snap.docs.map((d) => d.data());
  const unused   = all.filter((t) => !t.used);
  const expired  = unused.filter(
    (t) => t.expiresAt && t.expiresAt.toMillis && t.expiresAt.toMillis() < Date.now()
  );

  note(`Total tokens:        ${all.length}`);
  note(`Unused:              ${unused.length}`);
  note(`Expired & unused:    ${expired.length}`);

  if (expired.length > 0) {
    flag(`${expired.length} expired-but-not-cleaned-up setup tokens (harmless but stale).`);
  } else {
    ok("No expired stragglers.");
  }
}

async function main() {
  console.log("");
  console.log("═".repeat(72));
  console.log(`  HYGIENE CHECK — ${DEFAULT_TENANT}`);
  console.log("═".repeat(72));

  await checkTenantSettings();
  await checkAvatars();
  await checkBooks();
  await checkSetupTokens();

  console.log("");
  console.log("═".repeat(72));
  if (issuesFound === 0) {
    console.log("  ✓ All clean — no orphans, no dangling references.");
  } else {
    console.log(`  ✗ ${issuesFound} issue(s) found — see flags above.`);
  }
  console.log("═".repeat(72));
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
