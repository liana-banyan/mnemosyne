#!/usr/bin/env node
// build_seed_corpus.mjs — D-BP155-054/BISHOP/seg-split-installer-seed-corpus
//
// Builds the eblets_default seed corpus that ships inside BOTH installer
// variants (COMPLETE and LEAN). Source is resources/chocolates/starter_chocolate.jsonl
// ONLY — never the per-category resources/chocolates/<cat>.jsonl files, because those
// files interleave "starter_chocolate:*" (hand-authored, safe) entries with
// "canonical_plow:wikipedia:*" / "canonical_plow:openalex:*" entries (verbatim
// third-party excerpts pulled from Wikipedia/OpenAlex during Plow runs). Only
// starter_chocolate.jsonl is 100% starter_chocolate provenance — verified by this
// script's own gate below, which throws if any other provenance prefix is found.
//
// This is a build-time script, not shipped itself. Regenerate with:
//   node scripts/build_seed_corpus.mjs
//
// Four hard gates applied (Founder's order, D-BP155-054):
//   1. HIS TO LICENSE — starter_chocolate.jsonl entries only (see provenance gate below).
//   2. NO SECRETS — plain short-answer facts; gitleaks run separately over the output dir.
//   3. NOT THE PRIVATE MOAT — general knowledge Q&A, zero estate/canon/HARDWIRE content.
//   4. ACTUALLY USEFUL ON FIRST RUN — demonstrative, durable, general facts across 14 domains.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SOURCE_JSONL = join(REPO_ROOT, 'resources', 'chocolates', 'starter_chocolate.jsonl');
const OUT_DIR = join(REPO_ROOT, 'resources', 'eblets_default');

const CATEGORY_DISPLAY = {
  biology: 'Biology',
  business: 'Business',
  chemistry: 'Chemistry',
  computer_science: 'Computer Science',
  economics: 'Economics',
  engineering: 'Engineering',
  health: 'Health',
  history: 'History',
  law: 'Law',
  math: 'Mathematics',
  other: 'General Knowledge',
  philosophy: 'Philosophy',
  physics: 'Physics',
  psychology: 'Psychology',
};

function loadEntries() {
  const raw = readFileSync(SOURCE_JSONL, 'utf-8');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries = lines.map((line) => JSON.parse(line));

  // GATE 1 enforcement: every entry's provenance MUST start with "starter_chocolate:".
  // Any other prefix (canonical_plow:wikipedia:*, canonical_plow:openalex:*, etc.) is
  // third-party sourced content and must never reach the seed corpus. Fail loud, not soft.
  const bad = entries.filter((e) => !String(e.provenance || '').startsWith('starter_chocolate:'));
  if (bad.length > 0) {
    throw new Error(
      `build_seed_corpus: GATE 1 FAILED — ${bad.length} entries in ${SOURCE_JSONL} do not carry ` +
      `"starter_chocolate:" provenance (found: ${[...new Set(bad.map((e) => String(e.provenance).split(':')[0]))].join(', ')}). ` +
      `Refusing to build a corpus containing possible third-party content. Fix the source file, do not widen this gate.`
    );
  }
  return entries;
}

function groupByCategory(entries) {
  const groups = new Map();
  for (const e of entries) {
    const parts = String(e.provenance).split(':');
    const cat = parts[1] || 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(e);
  }
  return groups;
}

function escapeMd(text) {
  return String(text).replace(/\r\n/g, '\n').trim();
}

function renderEbletFile(category, items) {
  const display = CATEGORY_DISPLAY[category] || category;
  const lines = [];
  lines.push(`# Seed Facts — ${display}`);
  lines.push('');
  lines.push(
    `${items.length} general-knowledge facts from MnemosyneC's own hand-authored starter set ` +
    `("starter_chocolate", not MMLU-Pro, not scraped from any third-party source). These exist so ` +
    `a fresh install has something real to recall on the very first question instead of an empty ` +
    `substrate — ask about any topic below and MnemosyneC should answer from local memory.`
  );
  lines.push('');
  lines.push('## Facts');
  lines.push('');
  for (const item of items) {
    lines.push(`**Q: ${escapeMd(item.question)}**`);
    lines.push(`A: ${escapeMd(item.answer)}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function main() {
  if (!existsSync(SOURCE_JSONL)) {
    throw new Error(`build_seed_corpus: source file not found: ${SOURCE_JSONL}`);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const entries = loadEntries();
  const groups = groupByCategory(entries);

  const manifestItems = [];
  const sortedCats = [...groups.keys()].sort();

  for (const cat of sortedCats) {
    const items = groups.get(cat);
    const filename = `seed_${cat}.eblet.md`;
    const outPath = join(OUT_DIR, filename);
    const content = renderEbletFile(cat, items);
    writeFileSync(outPath, content, 'utf-8');

    manifestItems.push({
      filename,
      category: cat,
      item_count: items.length,
      origin: 'Hand-authored by Liana Banyan Corporation ("starter_chocolate" bootstrap set), resources/chocolates/starter_chocolate.jsonl',
      provenance_prefix: 'starter_chocolate',
      third_party_content: false,
      author: 'Liana Banyan Corporation',
      license: 'SSPL-1.0',
      generated_by: 'scripts/build_seed_corpus.mjs',
      generated_at: new Date().toISOString().slice(0, 10),
    });

    console.log(`[build_seed_corpus] wrote ${filename} (${items.length} facts)`);
  }

  // Pre-existing eblets_default files — documented in the manifest too (per-component,
  // not one blanket claim), unmodified by this script.
  const preExisting = [
    {
      filename: 'welcome_to_mnemosynec.eblet.md',
      category: 'onboarding',
      origin: 'Hand-authored by Liana Banyan Corporation — generic onboarding document',
      author: 'Liana Banyan Corporation',
      license: 'SSPL-1.0',
      third_party_content: false,
    },
    {
      filename: 'how_the_wan_mesh_works.eblet.md',
      category: 'onboarding',
      origin: 'Hand-authored by Liana Banyan Corporation — generic onboarding document',
      author: 'Liana Banyan Corporation',
      license: 'SSPL-1.0',
      third_party_content: false,
    },
    {
      filename: 'adding_your_own_eblets.eblet.md',
      category: 'onboarding',
      origin: 'Hand-authored by Liana Banyan Corporation — generic onboarding document',
      author: 'Liana Banyan Corporation',
      license: 'SSPL-1.0',
      third_party_content: false,
    },
  ];

  const manifest = {
    generated_by: 'scripts/build_seed_corpus.mjs',
    generated_at: new Date().toISOString(),
    dispatch: 'D-BP155-054/BISHOP/seg-split-installer-seed-corpus',
    note: 'PROPOSED corpus — the Founder approves the final manifest before this ships in a build. Per-component origin and license; not one blanket claim.',
    source_gate: 'Every seed_*.eblet.md item is sourced exclusively from resources/chocolates/starter_chocolate.jsonl entries whose provenance field starts with "starter_chocolate:" — canonical_plow:wikipedia:* and canonical_plow:openalex:* entries present in the per-category chocolates/*.jsonl files were categorically excluded (third-party sourced, fails Gate 1).',
    total_files: manifestItems.length + preExisting.length,
    total_seed_facts: entries.length,
    items: [...preExisting, ...manifestItems],
  };

  writeFileSync(join(OUT_DIR, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log(`[build_seed_corpus] wrote MANIFEST.json (${manifest.total_files} files, ${manifest.total_seed_facts} seed facts)`);
}

main();
