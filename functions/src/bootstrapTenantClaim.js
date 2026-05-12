// functions/src/bootstrapTenantClaim.js
//
// Created by Miguel Brown on 2026-05-12.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// HTTPS-callable that ensures the signed-in caller has a `tenant` custom
// claim and a user document under that tenant's root. Idempotent — if the
// claim and doc are already in place this returns immediately.
//
// Called from the AuthContext on every sign-in. The callable is the
// reliable substitute for an auth-creation trigger: it requires no
// Identity Platform enable and runs synchronously from the client, so
// the moment it returns the client can force-refresh the ID token and
// be sure the claim is live.
//
// v1: the default tenant is always `luckey-logic`. v2 (multi-tenant
// hosting): resolve from hostname or a query param the signup UI passes.

"use strict";

const {HttpsError, onCall} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const REGION = "us-central1";
const DEFAULT_TENANT = "luckey-logic";

exports.bootstrapTenantClaim = onCall({region: REGION}, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError(
        "unauthenticated",
        "You must be signed in to bootstrap your tenant claim.",
    );
  }

  const token = auth.token || {};
  const existing = await getAuth().getUser(auth.uid);
  const existingClaims = existing.customClaims || {};

  // Idempotent fast-path: already bootstrapped, just return current state.
  if (existingClaims.tenant) {
    return {
      success: true,
      bootstrapped: false,
      tenant: existingClaims.tenant,
      admin: existingClaims.admin === true,
    };
  }

  // Set the tenant claim while preserving any other claims that may exist
  // (e.g. admin: true if this user was already promoted out-of-band).
  await getAuth().setCustomUserClaims(auth.uid, {
    ...existingClaims,
    tenant: DEFAULT_TENANT,
  });

  // Create / merge the parent user doc.
  const db = getFirestore();
  const userRef = db
      .collection(DEFAULT_TENANT)
      .doc("_main")
      .collection("users")
      .doc(auth.uid);

  const role = existingClaims.admin === true ? "admin" : "parent";

  await userRef.set({
    uid: auth.uid,
    role,
    displayName: token.name || existing.displayName || null,
    email: token.email || existing.email || null,
    provider: token.firebase && token.firebase.sign_in_provider ?
                    token.firebase.sign_in_provider :
                    null,
    createdAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  logger.info("Tenant claim bootstrapped", {
    uid: auth.uid,
    tenant: DEFAULT_TENANT,
    role,
  });

  return {
    success: true,
    bootstrapped: true,
    tenant: DEFAULT_TENANT,
    admin: existingClaims.admin === true,
  };
});
