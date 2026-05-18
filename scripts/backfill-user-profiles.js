// scripts/backfill-user-profiles.js
//
// Created by Miguel Brown on 2026-05-15.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// One-off backfill that ensures every Firebase Auth user's profile
// (displayName, photoURL, email) is mirrored into their corresponding
// Firestore user doc at /{tenantId}/_main/users/{uid}. Idempotent — only
// updates docs whose mirrored fields actually differ from the current
// Auth record.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node backfill-user-profiles.js [tenantId]
//
//   [tenantId]  Optional. Defaults to `luckey-logic`. Must match an
//               existing tenant root in Firestore.
//
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────
//   ITEM 9c.2 added a client-side mirror in AuthContext that updates the
//   Firestore user doc with current Auth profile values on sign-in. That
//   covers any user who signs in AFTER the mirror lands — but for users
//   who don't return for a while, their docs stay stale. This script
//   forces a one-time backfill so admin views, future LOOT logs, and
//   sponsor-inquiry reviews can show every user's name immediately.
//
//   Also: legacy user docs were created before `photoURL` was a mirrored
//   field at all (bootstrapTenantClaim and backfill-user-claims only
//   wrote displayName + email). This script adds photoURL too.
//
//   Re-runnable: only touches docs where Auth and Firestore disagree on
//   at least one of (displayName, photoURL, email).

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

/**
 * Compare the Auth record's profile fields to the Firestore doc.
 * Returns null if everything is in sync, or an object containing the
 * mirrored values when at least one field differs (so we can pass it
 * straight into a Firestore set-with-merge).
 */
function diffProfile(userRecord, docData) {
  const wanted = {
    displayName: userRecord.displayName || null,
    photoURL   : userRecord.photoURL    || null,
    email      : userRecord.email       || null
  };
  const current = docData || {};
  const changed = (
    current.displayName !== wanted.displayName ||
    current.photoURL    !== wanted.photoURL    ||
    current.email       !== wanted.email
  );
  return changed ? wanted : null;
}

async function main() {
  const tenantRef  = db.collection(DEFAULT_TENANT).doc("_main");
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    console.error(`ERROR: tenant "${DEFAULT_TENANT}" not found.`);
    console.error("       Run seed-tenant.js for this tenant first.");
    process.exit(2);
  }

  console.log("");
  console.log("═".repeat(72));
  console.log(`  BACKFILLING profile mirror for tenant: ${DEFAULT_TENANT}`);
  console.log("═".repeat(72));
  console.log("");

  let pageToken;
  let total     = 0;
  let updated   = 0;
  let unchanged = 0;
  let missing   = 0;

  do {
    const result = await auth.listUsers(1000, pageToken);

    for (const userRecord of result.users) {
      total++;

      const userRef = db
          .collection(DEFAULT_TENANT)
          .doc("_main")
          .collection("users")
          .doc(userRecord.uid);

      const snap = await userRef.get();
      if (!snap.exists) {
        // Doc doesn't exist yet — backfill-user-claims.js handles that
        // case. Don't create from this script; it's only meant to sync
        // profile fields into existing docs.
        missing++;
        console.log(`  - missing doc: ${userRecord.uid}  ${userRecord.email || "(no email)"}  (run backfill-user-claims first)`);
        continue;
      }

      const docData = snap.data();
      const diff = diffProfile(userRecord, docData);

      // Pre-9c.2 docs (created before the mirror existed) won't have
      // a lastModified field. Seed one on first encounter even when
      // no profile fields have drifted so every existing doc gets
      // an audit shape after backfill runs.
      const needsInitialLastModified = !docData.lastModified;

      if (!diff && !needsInitialLastModified) {
        unchanged++;
        continue;
      }

      // Build per-field change diff. Empty for 'created' (genesis
      // baseline). For 'updated', list each mirrored field that
      // differs between Auth and Firestore.
      const changes = [];
      if (!needsInitialLastModified && diff) {
        const wanted = {
          displayName: userRecord.displayName || null,
          photoURL   : userRecord.photoURL    || null,
          email      : userRecord.email       || null
        };
        ["displayName", "photoURL", "email"].forEach((field) => {
          const prev = docData[field] == null ? null : docData[field];
          const next = wanted[field]   == null ? null : wanted[field];
          if (prev !== next) {
            changes.push({field, previous: prev, current: next});
          }
        });
      }

      // Build the lastModified summary attributing the change to this
      // script (not the user). 'created' state when seeding an initial
      // value on an existing doc; 'updated' when correcting drift.
      const newLastModified = {
        byName : "backfill-user-profiles.js",
        byUUID : "system",
        date   : admin.firestore.FieldValue.serverTimestamp(),
        state  : needsInitialLastModified ? "created" : "updated",
        changes
      };

      const batch = db.batch();

      if (docData.lastModified) {
        const archiveRef = userRef.collection("lastModifieds").doc();
        batch.set(archiveRef, docData.lastModified);
      }

      batch.set(userRef, {
        ...(diff || {}),
        lastSeenAt  : admin.firestore.FieldValue.serverTimestamp(),
        lastModified: newLastModified
      }, { merge: true });

      await batch.commit();

      updated++;
      const tag = diff ? "synced       " : "seeded lastMod";
      console.log(`  + ${tag}: ${userRecord.uid}  ${userRecord.displayName || userRecord.email || "(no name)"}`);
    }

    pageToken = result.pageToken;
  } while (pageToken);

  console.log("");
  console.log("═".repeat(72));
  console.log("  SUMMARY");
  console.log("═".repeat(72));
  console.log(`  Users scanned:        ${total}`);
  console.log(`  Docs updated:         ${updated}`);
  console.log(`  Already in sync:      ${unchanged}`);
  console.log(`  Doc missing (skip):   ${missing}`);
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
