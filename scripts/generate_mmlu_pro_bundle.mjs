#!/usr/bin/env node
// generate_mmlu_pro_bundle.mjs — BP132 Yoke #21/#22 follow-up fix.
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
// Usage: node scripts/generate_mmlu_pro_bundle.mjs

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CORPUS_DIR = join(
  '..',
  'LianaBanyanPlatform',
  'lb-reproducibility-pack',
  'datasets',
  'mmlu_pro_per_domain',
);
const PER_DOMAIN = 10;
const OUT_PATH = join('resources', 'mmlu_pro_bundled', 'questions.jsonl');

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
        category: q.source_category || domain,
        source_id: q.source_id ?? null,
        src: 'tiger-lab-mmlu-pro-curated',
      });
    }
  }

  writeFileSync(OUT_PATH, out.map((q) => JSON.stringify(q)).join('\n') + '\n', 'utf8');
  console.log(`Wrote ${out.length} real MMLU-Pro questions across ${domains.length - skippedDomains.length} domains to ${OUT_PATH}`);
  if (skippedDomains.length > 0) {
    console.log(`Skipped domains (no questions.json found -- known gap): ${skippedDomains.join(', ')}`);
  }
}

main();
