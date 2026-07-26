#!/usr/bin/env node
/**
 * build_chocolate_packages.mjs — BP134 Yoke #32 Phase E
 *
 * Extends the single-file `resources/chocolates/starter_chocolate.jsonl` (BP083
 * v0.3.7, generate_starter_chocolate.mjs) into the 14-category package format:
 *
 *   resources/chocolates/{category}.jsonl   (one file per MMLU-Pro domain + "other")
 *   resources/chocolates/manifest.json      ({categories:[{category,count,version,
 *                                              generated_at,source_mix}], ...})
 *
 * Reads every inventoried eblet source (the live active substrate store PLUS the
 * standalone starter pack — see SOURCES below), DEDUPES on sha256(question+answer)
 * (the live store has no dedup gate today — 34 dupes were confirmed in a 73-row
 * store at BP134 design-pass time), buckets each surviving entry by category using
 * the 3 known provenance shapes, and writes the 14 category files + manifest.
 *
 * This is the one-shot consolidator; Phase G wraps this as a library for periodic
 * re-consolidation (on quit / manual "Refresh Chocolate Pack").
 *
 * Usage: node scripts/build_chocolate_packages.mjs
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'resources', 'chocolates');
const PACK_FORMAT_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

// ── The 14 canonical domains (mirrors per_domain_q_banks.ts ALL_DOMAINS + the
//    DOMAIN_OPTIONS list shared by TestItOutTab.tsx / ClipboardCaptureModal.tsx) ──
const CATEGORIES = [
  'math', 'physics', 'chemistry', 'biology', 'computer_science', 'engineering',
  'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'health',
  'other',
];
const CATEGORY_SET = new Set(CATEGORIES);

// ── Inventoried eblet sources ────────────────────────────────────────────────
//
// Every plow writer (canonical_pipeline, andon_replow, spider/sprite registries,
// diagnosis_engine, the SubstrateSeedPanel, ...) funnels through the single
// writeVerifiedEblet() append path in mnem_eblet_store.ts, which targets exactly
// one file: {userData}/substrate/verified_eblets.jsonl. Electron's userData for
// this app ("amplify-computer" per package.json `name`, no app.setName override)
// resolves per-platform the same way Electron itself resolves it.
//
// We also read the standalone starter_chocolate.jsonl directly so the pack can be
// (re)built even on a machine/CI checkout where the app has never launched and the
// live store doesn't exist yet — it is expected to fully overlap (and therefore be
// deduped against) whatever the live store already absorbed via installStarterChocolate().
function liveSubstrateStorePath() {
  const appName = 'amplify-computer';
  switch (platform()) {
    case 'win32':
      return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), appName, 'substrate', 'verified_eblets.jsonl');
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', appName, 'substrate', 'verified_eblets.jsonl');
    default:
      return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), appName, 'substrate', 'verified_eblets.jsonl');
  }
}

function inventorySources() {
  const sources = [
    { label: 'live_substrate', path: liveSubstrateStorePath() },
    { label: 'starter_chocolate_seed', path: join(OUTPUT_DIR, 'starter_chocolate.jsonl') },
  ];
  // Operator escape hatch, mirrors MNEM_EBLET_STORE_ROOTS in mnem_eblet_store.ts.
  const extra = process.env.MNEM_CHOCOLATE_SOURCES;
  if (extra) {
    for (const p of extra.split(delimiter).map((s) => s.trim()).filter(Boolean)) {
      sources.push({ label: 'env_override', path: p });
    }
  }
  return sources.filter((s) => existsSync(s.path));
}

// ── Provenance → category parsing (3 known shapes; ambiguous -> 'other', never dropped) ──
//
//   canonical_plow:<source>:<domain>:bp083   (canonical_pipeline.ts:475)
//   starter_chocolate:<domain>:v0.3.7        (generate_starter_chocolate.mjs eblet())
//   plow-field:<domain>                      (andon_replow.ts:147)
function sourceFamilyFromProvenance(provenance) {
  if (provenance.startsWith('canonical_plow:')) return 'canonical_plow';
  if (provenance.startsWith('starter_chocolate:')) return 'starter_chocolate';
  if (provenance.startsWith('plow-field:')) return 'plow_field';
  return 'other';
}

function categoryFromProvenance(provenance) {
  const parts = provenance.split(':');
  let rawDomain;
  if (parts[0] === 'canonical_plow') {
    rawDomain = parts[2]; // canonical_plow:<source>:<domain>:bp083
  } else if (parts[0] === 'starter_chocolate') {
    rawDomain = parts[1]; // starter_chocolate:<domain>:v0.3.7
  } else if (parts[0] === 'plow-field') {
    rawDomain = parts[1]; // plow-field:<domain>
  } else {
    rawDomain = undefined;
  }
  // Normalize (defensive — Phase F fixes the "computer science" -> "computer_science"
  // producer-side bug directly, this is a belt-and-suspenders net for anything upstream).
  const normalized = (rawDomain || '').trim().toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_SET.has(normalized) ? normalized : 'other';
}

function sha256Of(question, answer) {
  return createHash('sha256').update(question + answer).digest('hex');
}

// ── Load + validate all entries from a source file ───────────────────────────
function loadSource(sourcePath) {
  const raw = readFileSync(sourcePath, 'utf8');
  const entries = [];
  let malformed = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed.question || !parsed.answer || parsed.verified !== true) continue;
      entries.push({
        question: parsed.question,
        answer: parsed.answer,
        provenance: typeof parsed.provenance === 'string' ? parsed.provenance : 'other:unknown',
        verified: true,
        sha256: sha256Of(parsed.question, parsed.answer), // recomputed — never trust stored hash
        timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
      });
    } catch {
      malformed++;
    }
  }
  return { entries, malformed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const sources = inventorySources();
  if (sources.length === 0) {
    console.warn('[ChocolatePackages] No eblet sources found on disk — nothing to consolidate.');
    process.exitCode = 1;
    return;
  }

  const seenHashes = new Set();
  /** @type {Record<string, Array<object>>} */
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  /** @type {Record<string, Record<string, number>>} */
  const sourceMixByCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, { canonical_plow: 0, starter_chocolate: 0, plow_field: 0, other: 0 }]),
  );

  let totalRead = 0;
  let totalMalformed = 0;
  let totalDuplicates = 0;

  for (const source of sources) {
    const { entries, malformed } = loadSource(source.path);
    totalRead += entries.length;
    totalMalformed += malformed;

    for (const entry of entries) {
      if (seenHashes.has(entry.sha256)) {
        totalDuplicates++;
        continue;
      }
      seenHashes.add(entry.sha256);

      const category = categoryFromProvenance(entry.provenance);
      const family = sourceFamilyFromProvenance(entry.provenance);
      byCategory[category].push(entry);
      sourceMixByCategory[category][family]++;
    }
  }

  const generatedAt = new Date().toISOString();
  const categoryManifests = [];

  for (const category of CATEGORIES) {
    const entries = byCategory[category];
    const outFile = join(OUTPUT_DIR, `${category}.jsonl`);
    const lines = entries.map((e) => JSON.stringify(e));
    // Always write the file, even if empty (0-count categories must be visible,
    // not silently absent — "ambiguous -> other, never dropped silently" applies
    // to the whole pack, not just the 'other' bucket).
    writeFileSync(outFile, lines.length > 0 ? lines.join('\n') + '\n' : '', 'utf8');

    categoryManifests.push({
      category,
      count: entries.length,
      version: PACK_FORMAT_VERSION,
      generated_at: generatedAt,
      source_mix: sourceMixByCategory[category],
    });
  }

  const manifest = {
    version: PACK_FORMAT_VERSION,
    generatedAt,
    totalEblets: seenHashes.size,
    totalSourcesRead: sources.length,
    totalRecordsRead: totalRead,
    totalDuplicatesRemoved: totalDuplicates,
    totalMalformedSkipped: totalMalformed,
    sources: sources.map((s) => ({ label: s.label, path: s.path })),
    categories: categoryManifests,
  };
  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`[ChocolatePackages] Consolidated ${sources.length} source(s) -> ${seenHashes.size} unique eblets ` +
    `(${totalDuplicates} dupes removed, ${totalMalformed} malformed skipped)`);
  console.log('Category breakdown:');
  for (const cm of categoryManifests) {
    console.log(`  ${cm.category.padEnd(18)} ${String(cm.count).padStart(4)}  ` +
      `(canonical_plow=${cm.source_mix.canonical_plow}, starter_chocolate=${cm.source_mix.starter_chocolate}, ` +
      `plow_field=${cm.source_mix.plow_field}, other=${cm.source_mix.other})`);
  }
  console.log(`[ChocolatePackages] manifest.json + 14 category files written to: ${OUTPUT_DIR}`);
}

main();
