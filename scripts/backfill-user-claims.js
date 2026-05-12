// scripts/backfill-user-claims.js
//
// Created by Miguel Brown on 2026-05-12.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// One-off backfill that ensures every existing Firebase Auth user has
// the `tenant` custom claim and a corresponding user doc under that
// tenant's root collection. Safe to re-run — only mutates users that
// are missing claims or docs.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node backfill-user-claims.js [tenantId]
//
//   [tenantId]  Optional. Defaults to `luckey-logic`. Must match an
//               existing tenant root in Firestore.
//
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────
//   Users created BEFORE the `bootstrapTenantClaim` Cloud Function landed
//   (early ITEM 2a signups, plus the first admin from ITEM 2b) do not
//   have a tenant claim. After ITEM 2c's per-tenant Firestore Rules go
//   live, those users would hit unexpected denials. This script seeds
//   them so existing accounts work without each user having to sign in
//   again first.

"use strict";

const admin = require("firebase-admin");

const [, , tenantArg] = process.argv;
const DEFAULT_TENANT  = tenantArg || "luckey-logic";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS must be set.");
  console.error("       Path to a service-account JSON from Firebase Console.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const auth = admin.auth();
const db   = admin.firestore();

async function main() {
  // Confirm tenant root exists before mutating user claims that reference it.
  const tenantRef = db.collection(DEFAULT_TENANT).doc("_main");
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    console.error(`ERROR: tenant "${DEFAULT_TENANT}" not found.`);
    console.error("       Run seed-tenant.js for this tenant first.");
    process.exit(2);
  }

  console.log("");
  console.log("═".repeat(72));
  console.log(`  BACKFILLING tenant claims for: ${DEFAULT_TENANT}`);
  console.log("═".repeat(72));
  console.log("");

  let pageToken;
  let total       = 0;
  let claimAdded  = 0;
  let claimOk     = 0;
  let docCreated  = 0;
  let docOk       = 0;

  do {
    const result = await auth.listUsers(1000, pageToken);

    for (const userRecord of result.users) {
      total++;
      const existing = userRecord.customClaims || {};

      // ── 1. Tenant claim ──
      if (existing.tenant === DEFAULT_TENANT) {
        claimOk++;
      } else {
        await auth.setCustomUserClaims(userRecord.uid, {
          ...existing,
          tenant: DEFAULT_TENANT
        });
        claimAdded++;
        console.log(`  + claim set: ${userRecord.uid}  ${userRecord.email || "(no email)"}`);
      }

      // ── 2. User doc ──
      const userRef = db
        .collection(DEFAULT_TENANT)
        .doc("_main")
        .collection("users")
        .doc(userRecord.uid);

      const snap = await userRef.get();
      if (snap.exists) {
        docOk++;
      } else {
        const provider = userRecord.providerData && userRecord.providerData[0] ?
          userRecord.providerData[0].providerId :
          null;
        const role = existing.admin === true ? "admin" : "parent";
        await userRef.set({
          uid         : userRecord.uid,
          role,
          displayName : userRecord.displayName || null,
          email       : userRecord.email || null,
          provider,
          createdAt   : admin.firestore.FieldValue.serverTimestamp()
        });
        docCreated++;
        console.log(`  + doc  set: ${userRecord.uid}  role=${role}`);
      }
    }

    pageToken = result.pageToken;
  } while (pageToken);

  console.log("");
  console.log("═".repeat(72));
  console.log("  SUMMARY");
  console.log("═".repeat(72));
  console.log(`  Users scanned:           ${total}`);
  console.log(`  Tenant claim added:      ${claimAdded}`);
  console.log(`  Tenant claim already ok: ${claimOk}`);
  console.log(`  User docs created:       ${docCreated}`);
  console.log(`  User docs already ok:    ${docOk}`);
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
