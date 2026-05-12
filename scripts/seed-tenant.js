// scripts/seed-tenant.js
//
// Created by Miguel Brown on 2026-05-12.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// Provisioning script for a new tenant root. Creates the
// `/{tenantId}/_main` settings doc with sane defaults and issues a
// one-time setup token that the tenant's first admin pastes at
// `/admin/setup` to claim admin permissions.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node seed-tenant.js <tenantId> [contactEmail] [tenantName]
//
//   <tenantId>      Required. Lowercase kebab-case. Becomes the Firestore
//                   top-level collection key. Examples: luckey-logic,
//                   pembervill-public-library.
//   [contactEmail]  Optional. Populates _main.support.{program,coppa,
//                   privacy}ContactEmail. Can be edited later via the
//                   admin settings panel (ITEM 2e).
//   [tenantName]    Optional. Human-readable display name. Defaults to a
//                   Title-Cased rewrite of <tenantId>.
//
// HOW TO OBTAIN A SERVICE ACCOUNT JSON
// ─────────────────────────────────────────────────────────────────────────
//   1. Firebase Console → Project Settings → Service accounts
//   2. Click "Generate new private key"
//   3. Save the downloaded JSON OUTSIDE this repo (e.g. ~/.firebase-keys/).
//      .gitignore already excludes `service-account*.json` from the
//      working tree as a safety net, but don't rely on that.
//   4. Set GOOGLE_APPLICATION_CREDENTIALS to its absolute path.
//   5. NEVER share, commit, or paste the contents anywhere.
//
// SECURITY
// ─────────────────────────────────────────────────────────────────────────
//   The script prints the plaintext setup token EXACTLY ONCE — only its
//   SHA-256 hash is stored in Firestore. If the operator loses the token
//   before it's claimed, delete the doc at /_setup_tokens/{hash} and
//   re-run the script. There is no way to recover the plaintext.

"use strict";

const crypto = require("crypto");
const admin  = require("firebase-admin");

const [, , tenantIdArg, contactEmailArg, tenantNameArg] = process.argv;

// ── ARG VALIDATION ──
if (!tenantIdArg) {
  console.error("ERROR: tenantId is required.\n");
  console.error("Usage: GOOGLE_APPLICATION_CREDENTIALS=... \\");
  console.error("         node seed-tenant.js <tenantId> [contactEmail] [tenantName]");
  process.exit(1);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tenantIdArg)) {
  console.error(`ERROR: tenantId "${tenantIdArg}" must be lowercase kebab-case.`);
  console.error("       (e.g. luckey-logic, pembervill-public-library)");
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS must be set to a path");
  console.error("       containing a service-account JSON downloaded from the");
  console.error("       Firebase Console.");
  process.exit(1);
}

const tenantId    = tenantIdArg;
const contactMail = contactEmailArg || null;
const tenantName  = tenantNameArg ||
  tenantId
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// ── ADMIN SDK INIT ──
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

// ── DEFAULT SETTINGS BODY ──
function buildTenantMainDoc() {
  return {
    tenantId,
    tenantName,
    active: true,

    support: {
      organizationName    : tenantName,
      programContactEmail : contactMail || "TBD",
      coppaContactEmail   : contactMail || "TBD",
      privacyContactEmail : contactMail || "TBD",
      operatorAddress     : null,
      contactBlurb        :
        `Library Loot for this site is operated by ${tenantName}.`
    },

    verification: {
      quizEnabled         : true,
      quizMinScore        : 0.7,
      quizTimeLimitMin    : 10,
      oralCheckoffEnabled : true,
      parentSignoffEnabled: true
    },

    entropy: {
      providers: ["drand", "random_org", "crypto_random"],
      algorithm: "weighted-index-v1"
    },

    branding: {
      logoPath  : null,
      accentHex : "#9D4EDD"
    },

    createdAt    : admin.firestore.FieldValue.serverTimestamp(),
    schemaVersion: 1
  };
}

async function main() {
  const tenantRef = db.collection(tenantId).doc("_main");
  const snap      = await tenantRef.get();
  if (snap.exists) {
    console.error(`ERROR: tenant "${tenantId}" already exists.`);
    console.error("       Aborting to avoid overwriting live settings.");
    process.exit(2);
  }

  // Create _main settings doc.
  await tenantRef.set(buildTenantMainDoc());

  // Generate setup token: 32 random bytes → 64-char hex.
  const plaintext = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(plaintext, "utf8")
    .digest("hex");

  const TTL_DAYS  = 30;
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.collection("_setup_tokens").doc(tokenHash).set({
    tenant   : tenantId,
    used     : false,
    expiresAt,
    issuedBy : "seed-tenant-script",
    issuedAt : admin.firestore.FieldValue.serverTimestamp(),
    note     : `Provisioned via seed-tenant.js for ${tenantId}`
  });

  // ── OUTPUT ──
  console.log("");
  console.log("═".repeat(72));
  console.log(`  TENANT PROVISIONED: ${tenantId}`);
  console.log("═".repeat(72));
  console.log("");
  console.log("  _main doc:               /" + tenantId + "/_main");
  console.log("  _main.support contact:   " + (contactMail || "TBD (edit later)"));
  console.log("  tenantName:              " + tenantName);
  console.log("");
  console.log("  SETUP TOKEN — copy this NOW. Expires in 30 days.");
  console.log("  Only its SHA-256 hash is stored in Firestore; the plaintext");
  console.log("  cannot be recovered.");
  console.log("");
  console.log("    " + plaintext);
  console.log("");
  console.log("  Next steps:");
  console.log("    1. Open https://library-loot.web.app/admin/setup");
  console.log("    2. Sign in with the Firebase Auth account you want as");
  console.log(`       the first admin of "${tenantId}".`);
  console.log("    3. Paste the token above and click \"Claim admin role.\"");
  console.log("");
  console.log("═".repeat(72));
  console.log("");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
