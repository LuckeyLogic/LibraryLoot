// functions/index.js
//
// Created by Miguel Brown on 2026-05-12.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// Cloud Functions entry point for Library Loot. Each callable lives in
// its own module under `src/`; this file just wires them up.

const {initializeApp} = require("firebase-admin/app");
const {setGlobalOptions} = require("firebase-functions/v2");

// Initialize the Admin SDK exactly once.
initializeApp();

// Apply project-wide function defaults. Region matches Firebase Storage /
// Firestore (nam5 multi-region) close enough; us-central1 is the standard
// for Cloud Functions. maxInstances caps run-away cost on unexpected load.
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

// ── HTTPS CALLABLES ──
const {claimSetupToken} = require("./src/claimSetupToken");
const {issueSetupToken} = require("./src/issueSetupToken");

exports.claimSetupToken = claimSetupToken;
exports.issueSetupToken = issueSetupToken;
