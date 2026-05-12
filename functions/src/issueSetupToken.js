// functions/src/issueSetupToken.js
//
// Created by Miguel Brown on 2026-05-12.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// HTTPS-callable that generates a fresh single-use setup token for adding
// a new admin to the caller's tenant. Only callers with the `admin: true`
// custom claim can use this. The plaintext token is returned exactly
// once — there's no recovery if the admin loses it. See SPEC.md §8.

const crypto = require("crypto");

const {HttpsError, onCall} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {getFirestore, FieldValue, Timestamp} =
    require("firebase-admin/firestore");

const {hashSetupToken} = require("./setupTokens");

const REGION = "us-central1";
const TOKEN_TTL_DAYS = 30;
const TOKEN_BYTE_LENGTH = 32; // → 64 hex chars

exports.issueSetupToken = onCall({region: REGION}, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const token = auth.token || {};
  if (token.admin !== true) {
    throw new HttpsError(
        "permission-denied",
        "Only an existing admin can issue setup tokens.",
    );
  }

  const tenant = typeof token.tenant === "string" ? token.tenant : null;
  if (!tenant) {
    throw new HttpsError(
        "failed-precondition",
        "Your admin account is not bound to a tenant. Contact the operator.",
    );
  }

  // Optional note for audit (e.g., "for librarian-jane@example.com").
  const note = (request.data && typeof request.data.note === "string") ?
      request.data.note.slice(0, 280) :
      null;

  const plaintext = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
  const tokenHash = hashSetupToken(plaintext);
  const expiresAt = Timestamp.fromMillis(
      Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const db = getFirestore();
  await db.collection("_setup_tokens").doc(tokenHash).set({
    tenant,
    used: false,
    expiresAt,
    issuedBy: auth.uid,
    issuedAt: FieldValue.serverTimestamp(),
    note,
  });

  logger.info("Setup token issued", {
    issuedBy: auth.uid,
    tenant,
    tokenHashPrefix: tokenHash.slice(0, 12),
    expiresAtMs: expiresAt.toMillis(),
  });

  return {
    success: true,
    token: plaintext,
    tenant,
    expiresAtMs: expiresAt.toMillis(),
    expiresInDays: TOKEN_TTL_DAYS,
  };
});
