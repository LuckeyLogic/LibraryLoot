// functions/src/claimSetupToken.js
//
// Created by Miguel Brown on 2026-05-12.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// HTTPS-callable that verifies a one-time setup token and grants admin
// custom claims on the caller's account for the tenant the token was
// issued against. See SPEC.md §8 for the design rationale.
//
// Security model:
//   - Caller must be authenticated (any Firebase Auth user).
//   - Token is verified by SHA-256 hash lookup — plaintext never compared.
//   - Token must be `used: false` and `expiresAt > now`.
//   - On success: caller gets `{admin: true, tenant}` custom claims, a
//     user doc is written under `/{tenant}/_main/users/{uid}`, and the
//     token is marked consumed (single-use).
//   - All Firestore writes happen inside a transaction so a race between
//     two concurrent claim attempts on the same token can only commit one.

const {HttpsError, onCall} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const {hashSetupToken} = require("./setupTokens");

/** Cloud Functions region (matches global default). */
const REGION = "us-central1";

exports.claimSetupToken = onCall({region: REGION}, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError(
        "unauthenticated",
        "You must be signed in before claiming a setup token.",
    );
  }

  const submitted = (request.data && typeof request.data.token === "string") ?
      request.data.token.trim() :
      "";
  if (!submitted) {
    throw new HttpsError("invalid-argument", "A setup token is required.");
  }
  if (!/^[a-fA-F0-9]{32,128}$/.test(submitted)) {
    // Tokens issued by us are 64-char lowercase hex. Loosened to a range
    // here to give a clear error rather than a generic "invalid".
    throw new HttpsError(
        "invalid-argument",
        "That doesn't look like a setup token. Tokens are 64-character " +
        "hex strings.",
    );
  }

  const tokenHash = hashSetupToken(submitted);
  const db = getFirestore();
  const tokenRef = db.collection("_setup_tokens").doc(tokenHash);

  let claimedTenant = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    if (!snap.exists) {
      throw new HttpsError(
          "not-found",
          "Invalid setup token. Double-check that you copied it exactly.",
      );
    }

    const data = snap.data();
    if (data.used === true) {
      throw new HttpsError(
          "failed-precondition",
          "This setup token has already been used.",
      );
    }
    if (data.expiresAt && data.expiresAt.toMillis &&
        data.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError(
          "failed-precondition",
          "This setup token has expired. Ask for a fresh one.",
      );
    }
    if (!data.tenant || typeof data.tenant !== "string") {
      throw new HttpsError(
          "internal",
          "Setup token is missing its tenant binding. Contact the operator.",
      );
    }

    claimedTenant = data.tenant;

    // Mark token consumed (single-use).
    tx.update(tokenRef, {
      used: true,
      usedAt: FieldValue.serverTimestamp(),
      usedBy: auth.uid,
    });

    // Create / merge the new admin's user doc under the tenant root.
    const userRef = db
        .collection(claimedTenant)
        .doc("_main")
        .collection("users")
        .doc(auth.uid);

    const userToken = auth.token || {};
    tx.set(userRef, {
      uid: auth.uid,
      role: "admin",
      displayName: userToken.name || null,
      email: userToken.email || null,
      provider: userToken.firebase && userToken.firebase.sign_in_provider ?
          userToken.firebase.sign_in_provider :
          null,
      createdAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  });

  // Set custom claims AFTER the transaction commits. Claims live in the
  // Auth service, not Firestore, so they can't participate in the txn.
  // If this step fails after the token was consumed, an operator can
  // re-run setCustomUserClaims manually using the token audit doc.
  await getAuth().setCustomUserClaims(auth.uid, {
    admin: true,
    tenant: claimedTenant,
  });

  logger.info("Setup token claimed", {
    uid: auth.uid,
    tenant: claimedTenant,
    tokenHashPrefix: tokenHash.slice(0, 12),
  });

  return {
    success: true,
    tenant: claimedTenant,
    message: "Admin role granted. Refreshing your session…",
  };
});
