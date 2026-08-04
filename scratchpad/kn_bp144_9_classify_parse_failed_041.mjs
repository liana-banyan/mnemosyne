// KN-BP144-9 Phase 0, item 0.2 support script: joins each parse_failed row (from
// kn_bp144_9_extract_parse_failed_041.mjs) against its question's real MC option text, so the
// taxonomy in the Phase 0 report can be checked against what the authority COULD have said,
// not just what it did say. Read-only, does not touch src/ or the receipt.
//
// The receipt itself does not store the option list (plow_mc_answerer.ts sends options to the
// authorities but the receipt only keeps question/correctLetter/parsedLetter). This script
// recovers the option text by exact full-text match of the receipt's `question` field against
// every question.json in the Founder's local lb-reproducibility-pack MMLU-Pro corpus (the same
// corpus one_click_mmlu_pro.ts's loadFromFullCorpus reads from -- this script does not
// reimplement its domain/index subsetting, it just matches on question text, which is more
// robust to it).
//
// Run: node scratchpad/kn_bp144_9_classify_parse_failed_041.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json';
const CORPUS_BASE = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';
const BROWSER_AUTHORITY_KEYS = ['user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini'];

const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
const outcomes = receipt.outcomes;

const lookup = new Map();
const domains = readdirSync(CORPUS_BASE).filter((d) => statSync(join(CORPUS_BASE, d)).isDirectory()).sort();
for (const d of domains) {
  const qp = join(CORPUS_BASE, d, 'questions.json');
  if (!existsSync(qp)) continue;
  let arr;
  try { arr = JSON.parse(readFileSync(qp, 'utf8')); } catch { continue; }
  const list = Array.isArray(arr) ? arr : arr.questions;
  if (!Array.isArray(list)) continue;
  for (const q of list) {
    if (typeof q.question === 'string') lookup.set(q.question.trim(), { options: q.options, correct_answer: q.correct_answer, domain: d });
  }
}

function letterFromIndex(i) { return String.fromCharCode(65 + i); }

const rows = [];
for (const o of outcomes) {
  const ao = o.plowTrace && o.plowTrace.authorityOutcomes;
  if (!ao) continue;
  const corpusHit = lookup.get(o.question.trim());
  for (const authority of BROWSER_AUTHORITY_KEYS) {
    const rec = ao[authority];
    if (rec && rec.outcome === 'parse_failed') {
      rows.push({
        qid: o.question_id,
        authority,
        correctLetter: o.correctLetter,
        rawPreview: rec.rawPreview ?? '',
        options: corpusHit ? corpusHit.options.map((opt, i) => `${letterFromIndex(i)}) ${opt}`) : null,
        correctOptionText: corpusHit ? corpusHit.correct_answer : null,
      });
    }
  }
}

console.log(`${rows.length} parse_failed rows joined against corpus option text.\n`);
for (const r of rows) {
  console.log('='.repeat(100));
  console.log(`qid ${r.qid} | ${r.authority} | correctLetter=${r.correctLetter}`);
  console.log(`correct option text: ${r.correctOptionText ?? '(no corpus match)'}`);
  if (r.options) console.log(`options:\n  ${r.options.join('\n  ')}`);
  console.log(`rawPreview: ${r.rawPreview}`);
}
