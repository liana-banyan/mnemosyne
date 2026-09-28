#!/usr/bin/env node
// copy_main_assets.mjs -- D-BP223-BM04-X033S3-011.
//
// WHY THIS EXISTS: tsc (invoked by guarded_tsc_main.cjs for the "build:main" pipeline) only ever
// emits files it compiles from .ts/.tsx source. Several places under src/main (and the sibling
// src/shared, src/substrate trees tsconfig.main.json also includes) read a plain .json file at
// RUNTIME via fs.readFileSync(resolve(__dirname, ...)) rather than importing it as a TS module
// (e.g. src/main/proveit/seed_loader.ts's DEFAULT_SEED_CARDS_PATH / DEFAULT_MANIFEST_PATH). tsc
// never touches those files -- resolveJsonModule (already on in the base tsconfig.json) only
// causes tsc to copy a .json file it resolves through an `import`/`require` statement, and none
// of these files are ever imported that way, by design (the loader wants a plain runtime read
// that degrades gracefully when the file is missing, not a compile-time dependency). So a fresh
// `npm run build:main` produces a dist/main tree with NO seed/*.json in it at all, and a packaged
// build ships the app without its 639 seed cards. D-BP223-BM04-X033S3-010's SEG hand-staged the
// files into dist for a screenshot and flagged the gap; this script closes it for good.
//
// PATTERN CHOSEN: a plain copy step (option "b" of the two shapes considered), not
// resolveJsonModule + import (option "a"). Searched first for precedent: no other JSON file under
// src/main is shipped into dist/main today -- src/main/liana_cycle/methods/fixtures/*.json and
// src/main/marketplace/sample_plugins/*.json are read the same __dirname-relative-fs.readFileSync
// way but were never previously copied to dist either (verified: dist/main had zero .json files
// before this dispatch except the hand-staged seed pair). So there was no existing pattern to
// match exactly -- this script establishes one, generalized to every .json under the three
// compiled source roots (main, shared, substrate) rather than a seed-cards-only special case, so
// the next runtime-read JSON asset does not repeat this gap.
//
// SCOPE: copies *.json files only (the concrete gap), skips `*.superseded.*.json` siblings (Rule
// 66 backups are never shipped), skips node_modules, and mirrors the same rootDir/outDir mapping
// tsc itself uses for tsconfig.main.json (rootDir "./src", outDir "./dist" -- so
// src/main/proveit/seed/seed_cards.json -> dist/main/proveit/seed/seed_cards.json).
//
// WIRING: called from scripts/guarded_tsc_main.cjs, AFTER a successful `npx tsc -p
// tsconfig.main.json`, never before and never on a failed compile. Not added to package.json
// (out of scope for this dispatch) -- guarded_tsc_main.cjs is what "build:main" already invokes,
// so wiring it there is sufficient without touching package.json.
//
// Usage: node scripts/copy_main_assets.mjs

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '..');
const SRC_ROOT = resolve(REPO_ROOT, 'src');
const DIST_ROOT = resolve(REPO_ROOT, 'dist');

// Same three roots tsconfig.main.json's "include" lists.
const COMPILED_ROOTS = ['main', 'shared', 'substrate'];

const SUPERSEDED_PATTERN = /\.superseded\./;

/** Recursively collects every .json file under `dir`, skipping node_modules and superseded
 *  siblings, returning absolute paths. */
function walkJsonFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // root doesn't exist (e.g. no src/substrate tree at all) -- nothing to copy.
  }
  for (const entry of entries) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkJsonFiles(full, out);
    } else if (st.isFile() && entry.endsWith('.json') && !SUPERSEDED_PATTERN.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  let copied = 0;
  let skippedRoots = 0;

  for (const root of COMPILED_ROOTS) {
    const rootDir = resolve(SRC_ROOT, root);
    if (!existsSync(rootDir)) {
      skippedRoots += 1;
      continue;
    }
    const jsonFiles = walkJsonFiles(rootDir, []);
    for (const srcPath of jsonFiles) {
      const relPath = relative(SRC_ROOT, srcPath); // e.g. "main/proveit/seed/seed_cards.json"
      const destPath = join(DIST_ROOT, relPath);
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
      copied += 1;
      console.log(`[copy_main_assets] ${relPath} -> ${relative(REPO_ROOT, destPath)}`);
    }
  }

  console.log(`[copy_main_assets] done: ${copied} JSON asset(s) copied` +
    (skippedRoots ? `, ${skippedRoots} source root(s) absent (skipped)` : '') + '.');
}

main();
