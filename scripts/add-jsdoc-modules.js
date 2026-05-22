// scripts/add-jsdoc-modules.js
//
// Created by Miguel Brown on 2026-05-20.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
// Walks every .js/.jsx file in the JSDoc include paths and prepends a
// `/** @module <path> */` JSDoc block when one isn't already present.
// That tag is what JSDoc uses to generate the module documentation
// pages (the prose + params + returns + members view) — without it,
// the docs site only renders source-code views, which is what the
// operator hit on 2026-05-20.
//
// The block reuses the file's existing `// ` header comment as the
// module description: prose between the path line and the "Created
// by" / "Copyright" lines becomes the @module description. If a file
// has no header prose, the block emits as a single-line
// `/** @module <path> */`.
//
// SAFE TO RE-RUN — any file that already declares @module is skipped.
// Use this after adding new files to keep the docs site complete.
//
// USAGE
// ─────────────────────────────────────────────────────────────────
//   node scripts/add-jsdoc-modules.js [--dry-run]
//
// --dry-run prints what would change without writing.

"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Mirror jsdoc.config.json's include list (kept in sync by hand). The
// 2026-05-20 docs-fix commit expanded this to also cover src/utils
// and src/lib — both were silently missing from the docs site.
const INCLUDE_DIRS = [
  "src/components",
  "src/pages",
  "src/context",
  "src/hooks",
  "src/data",
  "src/firebase",
  "src/lib",
  "src/utils",
  "src/model"
];
const INCLUDE_FILES = [
  "src/App.jsx",
  "src/main.jsx",
  "src/firebase.js"
];

const dryRun = process.argv.includes("--dry-run");

/**
 * Recursively yield every .js / .jsx file under `dir`.
 *
 * @param {string} dir
 * @yields {string} Absolute path.
 */
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

/**
 * Derive the @module path from an absolute file path.
 *   /…/src/components/Navbar.jsx       → "components/Navbar"
 *   /…/src/firebase.js                 → "firebase"
 *   /…/src/lib/loot/lootClient.js      → "lib/loot/lootClient"
 *
 * @param   {string} absFile
 * @returns {string}
 */
function modulePathOf(absFile) {
  const rel = path.relative(path.join(ROOT, "src"), absFile)
    .replace(/\\/g, "/");
  return rel.replace(/\.(js|jsx)$/, "");
}

/**
 * Pull the prose description out of a file's `// ` header comment.
 *
 * Expected header shape (some files vary slightly — the parser is
 * tolerant):
 *   // src/path/file.jsx
 *   //
 *   // First sentence of description.
 *   // Continued description.
 *   //
 *   // Created by Miguel Brown on …
 *
 * Returns the joined prose (max two sentences) or '' if the file has
 * no description prose between the path line and Created-by.
 *
 * @param   {string} content
 * @returns {string}
 */
function extractDescription(content) {
  const lines    = content.split("\n");
  const descLines = [];
  let started    = false;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Mark the start of the header block: the leading
    // `// src/path/file.jsx` line (or any leading `// ` line if no
    // path line is present).
    if (!started) {
      if (/^\/\/\s*src\/.+\.(?:js|jsx)$/.test(line) ||
          /^\/\/\s*[A-Za-z][\w.-]*\.(?:js|jsx)$/.test(line)) {
        started = true;
        continue;
      }
      // First non-comment, non-blank line → no header at all, bail.
      if (line && !line.startsWith("//")) break;
      // Skip blank pre-header lines.
      continue;
    }

    // Stop at the closing footer lines.
    if (/^\/\/\s*Created by/i.test(line))   break;
    if (/^\/\/\s*Copyright/i.test(line))    break;
    // Stop at the first non-comment line (end of header).
    if (line && !line.startsWith("//"))     break;

    // Strip the leading `// ` (with optional space) and gather text.
    const m = line.match(/^\/\/\s?(.*)$/);
    if (!m) continue;
    const text = m[1].trim();
    if (text) descLines.push(text);
  }
  if (descLines.length === 0) return "";

  // Join with single spaces. We used to slice at the first two
  // sentence boundaries, but the regex couldn't tell real sentence
  // endings ("...the app.") from abbreviations / version numbers
  // ("Gemini 2.5", "Vertex AI vs.") — descriptions got cut mid-
  // thought. Take the whole paragraph instead, capped at 500 chars
  // (gracefully truncated at a word boundary when longer).
  const para = descLines.join(" ").trim();
  if (para.length <= 500) return para;
  // Find a word boundary at or before the cap.
  const cap = para.lastIndexOf(" ", 500);
  return (cap > 200 ? para.slice(0, cap) : para.slice(0, 500)) + "…";
}

/**
 * Test whether the file already declares an @module tag anywhere in
 * its first ~3KB. Cheap heuristic — JSDoc reads `@module` from any
 * JSDoc block, but in practice the tag lives at the top.
 *
 * @param   {string} content
 * @returns {boolean}
 */
function alreadyHasModule(content) {
  return /@module\s+\S/.test(content.slice(0, 3000));
}

/**
 * Word-wrap a description string to ~78 char lines, prefixing each
 * continuation line with ` * ` so it reads as a clean multi-line
 * JSDoc block. The first line already has ` * ` from the caller, so
 * we only need to inject ` * ` on subsequent lines.
 *
 * Why 78: ` * ` prefix = 3 chars, plus we want the rendered line to
 * fit comfortably under 80. Wraps only on whitespace boundaries;
 * a single overlong word stays on one line rather than getting
 * mid-word-split.
 *
 * @param   {string} text
 * @param   {number} width  Target characters per line (default 78).
 * @returns {string}        Joined with `\n * ` between wrapped lines.
 */
function wrapDescription(text, width) {
  width = width || 78;
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if (cur.length + 1 + w.length <= width) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.join("\n * ");
}

/**
 * Build the JSDoc block to prepend. Multi-line form when a description
 * is available; single-line `/** @module path *​/` when not. Long
 * descriptions are word-wrapped to ~78 chars per line so the block
 * reads cleanly in source instead of stretching off the right margin.
 *
 * @param   {string} modulePath
 * @param   {string} description
 * @returns {string}
 */
function buildBlock(modulePath, description) {
  if (!description) return `/** @module ${modulePath} */\n`;
  const wrapped = wrapDescription(description, 78);
  return `/**\n * ${wrapped}\n * @module ${modulePath}\n */\n`;
}

function processFile(absFile) {
  const content = fs.readFileSync(absFile, "utf8");
  if (alreadyHasModule(content)) {
    return { skipped: true };
  }
  const modulePath  = modulePathOf(absFile);
  const description = extractDescription(content);
  const block       = buildBlock(modulePath, description);
  if (!dryRun) {
    fs.writeFileSync(absFile, block + content, "utf8");
  }
  return { skipped: false, modulePath, description };
}

// ── Main ──

const targets = [];
for (const d of INCLUDE_DIRS) {
  const full = path.join(ROOT, d);
  if (!fs.existsSync(full)) continue;
  for (const f of walk(full)) targets.push(f);
}
for (const f of INCLUDE_FILES) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) targets.push(full);
}

console.log("");
console.log("═".repeat(72));
console.log(`  ADDING @module TAGS — ${dryRun ? "DRY RUN" : "WRITING"} (${targets.length} files)`);
console.log("═".repeat(72));

let written = 0;
let skipped = 0;
let empty   = 0;

for (const file of targets) {
  const r = processFile(file);
  const rel = path.relative(ROOT, file);
  if (r.skipped) {
    skipped++;
    continue;
  }
  written++;
  if (!r.description) empty++;
  const tag = r.description ? "" : "  [no description]";
  console.log(`  + ${rel}${tag}`);
  console.log(`        @module ${r.modulePath}`);
}

console.log("");
console.log("═".repeat(72));
console.log("  SUMMARY");
console.log("═".repeat(72));
console.log(`  ${dryRun ? "Would write" : "Wrote"}:        ${written}`);
console.log(`    No description:    ${empty}  (single-line block emitted)`);
console.log(`  Skipped (already):   ${skipped}`);
console.log("");

if (dryRun) {
  console.log("  (Dry run — no files modified. Re-run without --dry-run to apply.)");
  console.log("");
}
