#!/usr/bin/env node
// amplify-computer/scripts/copy-hugo-bundle.mjs
//
// AMPLIFY Computer — Cephas Hugo Bundle Copy Script (BP041 / Knight P1.4)
//
// Orchestrates the full Cephas Hugo build-and-copy pipeline:
//   1. Runs `hugo --minify --gc` from Cephas/cephas-hugo/
//   2. Copies the build output (public/) into amplify-computer/static/cephas/
//   3. Reports file count + total size (for MNEMOSYNE Trial receipt)
//
// Canon refs:
//   mnemosyne_installer_bundled_offline_first_architecture_canon_bp040.eblet.md
//     → LAYER 3: <appRoot>/static/cephas/ (Hugo build output)
//   Knight P1.4 — BP041 FOREMAN-class task
//
// Usage (from amplify-computer/ root):
//   node scripts/copy-hugo-bundle.mjs
//
// Or via npm:
//   npm run build:hugo

import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Paths (relative to this script's directory) ──────────────────────────────

/** amplify-computer/ root */
const AMPLIFY_ROOT = resolve(__dirname, '..');

/** LianaBanyanPlatform/ repo root */
const REPO_ROOT    = resolve(AMPLIFY_ROOT, '..');

/** Cephas Hugo project root */
const CEPHAS_ROOT  = resolve(REPO_ROOT, 'Cephas', 'cephas-hugo');

/** Hugo build output */
const HUGO_PUBLIC  = resolve(CEPHAS_ROOT, 'public');

/** Destination inside Mnemosyne installer bundle */
const DEST         = resolve(AMPLIFY_ROOT, 'static', 'cephas');

// ── Step 1: Build Hugo ────────────────────────────────────────────────────────

console.log('[copy-hugo-bundle] Step 1: Building Cephas Hugo site...');
console.log(`[copy-hugo-bundle]   Source dir: ${CEPHAS_ROOT}`);

if (!existsSync(CEPHAS_ROOT)) {
  console.error(`[copy-hugo-bundle] ✗ Cephas root not found: ${CEPHAS_ROOT}`);
  process.exit(1);
}

try {
  execSync('hugo --minify --gc', {
    cwd:   CEPHAS_ROOT,
    stdio: 'inherit',
  });
  console.log('[copy-hugo-bundle] ✓ Hugo build complete');
} catch (err) {
  console.error('[copy-hugo-bundle] ✗ Hugo build failed:', err.message ?? err);
  process.exit(1);
}

if (!existsSync(HUGO_PUBLIC)) {
  console.error(`[copy-hugo-bundle] ✗ Hugo public/ not found after build: ${HUGO_PUBLIC}`);
  process.exit(1);
}

// ── Step 2: Clear + recreate destination ─────────────────────────────────────

console.log(`[copy-hugo-bundle] Step 2: Copying to ${DEST}`);

if (existsSync(DEST)) {
  console.log('[copy-hugo-bundle]   Removing existing static/cephas/...');
  rmSync(DEST, { recursive: true, force: true });
}

mkdirSync(DEST, { recursive: true });

// ── Step 3: Copy Hugo public/ → static/cephas/ ───────────────────────────────

cpSync(HUGO_PUBLIC, DEST, { recursive: true });

// ── Step 4: Report statistics ─────────────────────────────────────────────────

function countFilesAndBytes(dir) {
  let fileCount = 0;
  let totalBytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countFilesAndBytes(fullPath);
      fileCount  += sub.fileCount;
      totalBytes += sub.totalBytes;
    } else {
      fileCount++;
      totalBytes += statSync(fullPath).size;
    }
  }
  return { fileCount, totalBytes };
}

const { fileCount, totalBytes } = countFilesAndBytes(DEST);
const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

console.log('[copy-hugo-bundle] ✓ Cephas Hugo Bundle copied successfully');
console.log(`[copy-hugo-bundle]   Files: ${fileCount}`);
console.log(`[copy-hugo-bundle]   Size:  ${totalMB} MB (${totalBytes.toLocaleString()} bytes)`);
console.log(`[copy-hugo-bundle]   Dest:  ${DEST}`);
console.log('[copy-hugo-bundle]   MNEMOSYNE Layer 3 — COMPLETE');
