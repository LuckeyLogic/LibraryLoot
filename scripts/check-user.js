// scripts/check-user.js
//
// Created by Miguel Brown on 2026-05-13.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// Inspects a Firebase Auth user. Prints their UID, email, providers,
// custom claims, and the contents of their user doc under the active
// tenant root in Firestore. Read-only — never mutates.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node check-user.js <emailOrUid> [tenantId]
//
//   <emailOrUid>   Required. Email address OR a Firebase Auth UID.
//   [tenantId]     Optional. Tenant root to look up the user doc under.
//                  Defaults to `luckey-logic`.

"use strict";

const admin = require("firebase-admin");

const [, , identifier, tenantArg] = process.argv;
const DEFAULT_TENANT = tenantArg || "luckey-logic";

if (!identifier) {
  console.error("ERROR: <emailOrUid> is required.");
  console.error("Usage: GOOGLE_APPLICATION_CREDENTIALS=... \\");
  console.error("         node check-user.js <emailOrUid> [tenantId]");
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS must be set.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const auth = admin.auth();
const db   = admin.firestore();

const isLikelyEmail = (s) => typeof s === "string" && s.includes("@");

async function main() {
  let userRecord;
  try {
    userRecord = isLikelyEmail(identifier) ?
      await auth.getUserByEmail(identifier) :
      await auth.getUser(identifier);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.error(`No user found for "${identifier}".`);
      process.exit(2);
    }
    throw err;
  }

  const claims    = userRecord.customClaims || {};
  const tenant    = claims.tenant || null;
  const isAdmin   = claims.admin === true;
  const providers = (userRecord.providerData || []).map((p) => p.providerId);

  console.log("");
  console.log("─".repeat(72));
  console.log(`  USER: ${userRecord.email || "(no email)"}`);
  console.log("─".repeat(72));
  console.log(`  UID:               ${userRecord.uid}`);
  console.log(`  Display name:      ${userRecord.displayName || "(none)"}`);
  console.log(`  Providers:         ${providers.length ? providers.join(", ") : "(none)"}`);
  console.log(`  Created:           ${userRecord.metadata.creationTime}`);
  console.log(`  Last signed in:    ${userRecord.metadata.lastSignInTime}`);
  console.log(`  Email verified:    ${userRecord.emailVerified}`);
  console.log(`  Disabled:          ${userRecord.disabled}`);
  console.log("");
  console.log("  ── CUSTOM CLAIMS ──");
  if (Object.keys(claims).length === 0) {
    console.log("    (none)");
  } else {
    for (const [k, v] of Object.entries(claims)) {
      console.log(`    ${k}: ${JSON.stringify(v)}`);
    }
  }
  console.log("");
  console.log(`    → tenant: ${tenant || "(not set — needs bootstrap)"}`);
  console.log(`    → admin:  ${isAdmin ? "yes" : "no"}`);
  console.log("");

  // ── Firestore user doc lookup ──
  const lookupTenant = tenant || DEFAULT_TENANT;
  const userRef = db
    .collection(lookupTenant)
    .doc("_main")
    .collection("users")
    .doc(userRecord.uid);

  const snap = await userRef.get();

  console.log(`  ── USER DOC (${lookupTenant}/_main/users/${userRecord.uid}) ──`);
  if (!snap.exists) {
    console.log("    (no doc — needs bootstrap)");
  } else {
    const data = snap.data();
    for (const [k, v] of Object.entries(data)) {
      // Firestore Timestamps serialize awkwardly; format nicely.
      const formatted =
        v && typeof v.toDate === "function" ? v.toDate().toISOString() :
        typeof v === "object" ? JSON.stringify(v) :
        v;
      console.log(`    ${k}: ${formatted}`);
    }
  }
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
