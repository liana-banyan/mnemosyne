#!/usr/bin/env node
// generate_mmlu_pro_bundle.mjs — BP132 Yoke #21/#22 follow-up fix.
// Extended BP134 Yoke #32 Phase F (corpus fix, before the button/verifiability work).
//
// One-off generator (run manually, output is committed) that samples a real,
// evenly-spaced subset of the curated TIGER-Lab/MMLU-Pro corpus at
// LianaBanyanPlatform/lb-reproducibility-pack/datasets/mmlu_pro_per_domain/
// and writes it to resources/mmlu_pro_bundled/questions.jsonl so the packaged
// app ships with real questions on a fresh install (that source path lives
// outside this repo, in a sibling monorepo folder, and will not exist on a
// stranger's machine).
//
// Root-cause note (2026-07-23): a prior pass reported this corpus directory
// as "empty" -- that was wrong. It contains 14 domain subfolders / ~11,000
// real curated questions; the earlier check simply never recursed into the
// subfolders. Corrected here.
//
// BP134 Yoke #32 Phase F fix #1 (category normalization): the sibling corpus's
// `source_category` field for one domain is the literal string "computer science"
// (a space), while every canonical domain list in this app (per_domain_q_banks.ts
// ALL_DOMAINS, the TestItOutTab/ClipboardCaptureModal DOMAIN_OPTIONS, this repo's
// own resources/mmlu_pro/ vendored dir) uses "computer_science" (an underscore).
// That mismatch meant an exact-match "5 per category" sampler could never find
// the computer_science bucket in the bundled corpus. normalizeCategory() below
// fixes it at generation time so every consumer sees one consistent spelling.
// AUDIT (before this fix): grepped src/ for the literal "computer science" string
// -- the only two hits are unrelated UI display labels in CatacombsTab.tsx /
// CatacombsContributePanel.tsx ('04_computer_science' -> "Computer Science"),
// not category-matching logic. No consumer relies on the space-variant spelling.
//
// BP134 Yoke #32 Phase F fix #2 (law gap): `law` has never had a questions.json in
// the sibling lb-reproducibility-pack corpus (META.json claims 1106 questions,
// SEAL.sha256 exists, but the actual question file was never written -- a genuine
// upstream curation gap, verified by checking both this repo's vendored copy AND
// the sibling repo's source). Per Truth-Always (never fabricate data), 10 REAL law
// questions were live-fetched from the canonical TIGER-Lab/MMLU-Pro dataset via
// the HuggingFace datasets-server /filter endpoint (category='law', src=
// ori_mmlu-professional_law, verified 2026-07-26) and vendored to
// resources/mmlu_pro_bundled/law_fallback_source.json so this script can keep
// regenerating deterministically offline. LAW_FALLBACK is used only when the
// sibling corpus has no law/questions.json -- if that gap is ever closed upstream,
// this script prefers the real corpus file automatically (see the loop below).
//
// Usage: node scripts/generate_mmlu_pro_bundle.mjs

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const CORPUS_DIR = join(
  '..',
  'LianaBanyanPlatform',
  'lb-reproducibility-pack',
  'datasets',
  'mmlu_pro_per_domain',
);
const PER_DOMAIN = 10;
const OUT_DIR = join('resources', 'mmlu_pro_bundled');
const OUT_PATH = join(OUT_DIR, 'questions.jsonl');
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');
const LAW_FALLBACK_PATH = join(OUT_DIR, 'law_fallback_source.json');

function letterFromIndex(i) {
  return String.fromCharCode(65 + i);
}

function evenlySpacedIndices(length, count) {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = length / count;
  const out = [];
  for (let i = 0; i < count; i++) out.push(Math.floor(i * step));
  return out;
}

/** "computer science" -> "computer_science"; already-underscored/lowercase values pass through unchanged. */
function normalizeCategory(cat) {
  return String(cat).trim().toLowerCase().replace(/\s+/g, '_');
}

function loadLawFallback(qidStart) {
  if (!existsSync(LAW_FALLBACK_PATH)) {
    console.warn(`[law fallback] ${LAW_FALLBACK_PATH} not found -- law category will remain a gap.`);
    return [];
  }
  const rows = JSON.parse(readFileSync(LAW_FALLBACK_PATH, 'utf8'));
  let qid = qidStart;
  return rows.map((r) => ({
    question_id: qid++,
    question: r.question,
    options: r.options,
    answer: r.answer,
    answer_index: r.answer_index,
    category: 'law',
    source_id: r.source_id ?? null,
    src: 'tiger-lab-mmlu-pro-live-fetch-bp134', // distinct provenance: live HF datasets-server fetch, not the sibling per-domain corpus
  }));
}

function main() {
  if (!existsSync(CORPUS_DIR)) {
    console.error(`Corpus dir not found: ${CORPUS_DIR}`);
    console.error('This script must be run from the mnemosyne repo root, with LianaBanyanPlatform checked out as a sibling folder.');
    process.exit(1);
  }
  const domains = readdirSync(CORPUS_DIR).filter((d) => statSync(join(CORPUS_DIR, d)).isDirectory());
  const out = [];
  let qid = 1;
  let skippedDomains = [];

  for (const domain of domains.sort()) {
    const qPath = join(CORPUS_DIR, domain, 'questions.json');
    if (!existsSync(qPath)) {
      skippedDomains.push(domain);
      continue;
    }
    const raw = JSON.parse(readFileSync(qPath, 'utf8'));
    const arr = Array.isArray(raw) ? raw : raw.questions;
    if (!Array.isArray(arr) || arr.length === 0) {
      skippedDomains.push(domain);
      continue;
    }
    const picks = evenlySpacedIndices(arr.length, PER_DOMAIN);
    for (const idx of picks) {
      const q = arr[idx];
      const answerIndex = q.options.indexOf(q.correct_answer);
      if (answerIndex === -1) {
        console.warn(`Skipping ${domain}[${idx}] (source_id=${q.source_id}) -- correct_answer not found in options`);
        continue;
      }
      out.push({
        question_id: qid++,
        question: q.question,
        options: q.options,
        answer: letterFromIndex(answerIndex),
        answer_index: answerIndex,
        category: normalizeCategory(q.source_category || domain),
        source_id: q.source_id ?? null,
        src: 'tiger-lab-mmlu-pro-curated',
      });
    }
  }

  // Phase F fix #2: fill the law gap from the vendored live-fetch fallback whenever the
  // sibling corpus itself has no law/questions.json (the case today, and for the
  // foreseeable future -- see the header note).
  if (skippedDomains.includes('law')) {
    const lawQuestions = loadLawFallback(qid);
    qid += lawQuestions.length;
    out.push(...lawQuestions);
    if (lawQuestions.length > 0) {
      skippedDomains = skippedDomains.filter((d) => d !== 'law');
    }
  }

  writeFileSync(OUT_PATH, out.map((q) => JSON.stringify(q)).join('\n') + '\n', 'utf8');

  // Corpus manifest -- Phase F item 3 persists a hash of this into every receipt so a
  // receipt can be verified against the exact corpus version it was scored against.
  const categoryCounts = {};
  for (const q of out) categoryCounts[q.category] = (categoryCounts[q.category] ?? 0) + 1;
  const sha256 = createHash('sha256').update(readFileSync(OUT_PATH)).digest('hex');
  const manifest = {
    version: '0.9.4',
    generatedAt: new Date().toISOString(),
    totalQuestions: out.length,
    sha256,
    categories: Object.entries(categoryCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => ({ category, count })),
    domainsSkippedFromLiveCorpus: skippedDomains,
    lawSource: out.some((q) => q.src === 'tiger-lab-mmlu-pro-live-fetch-bp134')
      ? 'live HF datasets-server fetch (BP134 Yoke #32 Phase F) -- see law_fallback_source.json'
      : null,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${out.length} real MMLU-Pro questions across ${Object.keys(categoryCounts).length} categories to ${OUT_PATH}`);
  console.log(`Manifest (sha256=${sha256.slice(0, 12)}...) written to ${MANIFEST_PATH}`);
  if (skippedDomains.length > 0) {
    console.log(`Skipped domains (no questions.json found -- known gap): ${skippedDomains.join(', ')}`);
  }
}

main();
