// KN-BP144-9 Phase 2 gate verification (BP144, this pass) -- Founder-approved after Phase 0.
//
// Runs the REAL COMPILED dist's resolveAuthorityLetterMatch / extractChosenLetterFromAuthorityText
// / matchFreeTextAnswerToOption (now exported from plow_mc_answerer.ts SOLELY so this script can
// import them directly -- see that file's own comment on the export) against:
//
//   (A) THE FALSE-EXTRACTION GATE -- all 32 real parse_failed rawPreview strings from the 041
//       receipt, joined against real corpus option text (same corpus-matching method as Phase 0's
//       kn_bp144_9_classify_parse_failed_041.mjs). For each row: what does the NEW parser return,
//       and -- for any non-null return -- is that letter genuinely supported by the text (hand-
//       auditable from the printed reasoning + options, per this ticket's own "report every case
//       where the parser produces a letter the text does not support" instruction)?
//
//   (B) THE NEGATIVE CONTROL -- every 'answered' outcome this run recorded for the 5 browser
//       authorities, read from plowTrace.ensemble_candidates (which carries the REAL, untruncated
//       -- up to 320 chars via distillExtraction, not the 200-char rawPreview cap -- `reasoning`
//       text and the `letter` the LIVE run actually accepted). Re-running the NEW parser against
//       that same reasoning+options must reproduce the SAME letter, for every single row, or this
//       gate fails.
//
// Read-only against the receipt; the only non-read-only artifact this script touches is its own
// stdout/output file. Does not modify anything under src/ (that edit already happened, separately,
// in plow_mc_answerer.ts -- this script only IMPORTS the resulting dist).
//
// Run: node scratchpad/kn_bp144_9_phase2_verify_real_dist.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json';
const CORPUS_BASE = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';
const BROWSER_AUTHORITY_KEYS = ['user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini'];

// The real compiled dist -- exported this pass specifically for this kind of verification.
const parserDist = require('../dist/main/plow/plow_mc_answerer.js');
const { resolveAuthorityLetterMatch } = parserDist;

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
function optionsFor(questionText) {
  const hit = lookup.get(questionText.trim());
  if (!hit) return null;
  return hit.options.map((text, i) => ({ letter: letterFromIndex(i), text }));
}

console.log('='.repeat(100));
console.log('PART A -- FALSE-EXTRACTION GATE: all 32 real parse_failed rawPreview rows, replayed');
console.log('against the REAL compiled dist (post-Phase-2-fix).');
console.log('='.repeat(100));

let totalParseFailedRows = 0;
let stillNull = 0;
let newlyExtracted = 0;
let falseExtractions = 0;
const newlyExtractedRows = [];
const falseExtractionRows = [];

for (const o of outcomes) {
  const ao = o.plowTrace && o.plowTrace.authorityOutcomes;
  if (!ao) continue;
  const options = optionsFor(o.question);
  for (const authority of BROWSER_AUTHORITY_KEYS) {
    const rec = ao[authority];
    if (!rec || rec.outcome !== 'parse_failed') continue;
    totalParseFailedRows++;
    const rawPreview = rec.rawPreview ?? '';
    if (!options) {
      console.log(`\nqid ${o.question_id} | ${authority} -- NO CORPUS MATCH, cannot replay. SKIPPED.`);
      continue;
    }
    const result = resolveAuthorityLetterMatch(rawPreview, options);
    if (!result) {
      stillNull++;
      console.log(`\nqid ${o.question_id} | ${authority} | correctLetter=${o.correctLetter} -- STILL NULL (honest non-extraction, unchanged).`);
      continue;
    }
    newlyExtracted++;
    const isCorrect = result.letter === o.correctLetter;
    const optText = options.find((x) => x.letter === result.letter)?.text ?? '(unknown)';
    console.log(`\nqid ${o.question_id} | ${authority} | correctLetter=${o.correctLetter} -- NEW EXTRACTION: '${result.letter}' (method=${result.method}, score=${result.score}) ${isCorrect ? '[MATCHES correctLetter]' : '[DOES NOT MATCH correctLetter -- HAND-AUDIT REQUIRED]'}`);
    console.log(`  extracted-option(${result.letter}) text: ${optText}`);
    console.log(`  rawPreview (${rawPreview.length} chars): ${rawPreview}`);
    newlyExtractedRows.push({ qid: o.question_id, authority, extractedLetter: result.letter, correctLetter: o.correctLetter, method: result.method, score: result.score, isCorrect, rawPreview, optText });
  }
}

console.log('\n' + '-'.repeat(100));
console.log(`PART A SUMMARY: ${totalParseFailedRows} parse_failed rows replayed.`);
console.log(`  Still null (unchanged, honest non-extraction): ${stillNull}`);
console.log(`  Newly extracted a letter: ${newlyExtracted}`);
console.log(`  Of those newly extracted, matches the corpus correctLetter: ${newlyExtractedRows.filter((r) => r.isCorrect).length}`);
console.log(`  Of those newly extracted, DOES NOT match correctLetter (requires hand-audit for false-extraction risk): ${newlyExtractedRows.filter((r) => !r.isCorrect).length}`);

console.log('\n' + '='.repeat(100));
console.log('PART B -- NEGATIVE CONTROL: every real \'answered\' ensemble_candidates row this run,');
console.log('replayed against the REAL compiled dist. Every letter must reproduce identically.');
console.log('='.repeat(100));

let totalAnsweredCandidates = 0;
let reproducedIdentically = 0;
let driftedRows = [];

for (const o of outcomes) {
  const candidates = o.plowTrace && o.plowTrace.ensemble_candidates;
  if (!Array.isArray(candidates)) continue;
  const options = optionsFor(o.question);
  for (const cand of candidates) {
    if (!BROWSER_AUTHORITY_KEYS.includes(cand.authority)) continue; // only the parser-governed authorities
    totalAnsweredCandidates++;
    if (!options) {
      console.log(`\nqid ${o.question_id} | ${cand.authority} -- NO CORPUS MATCH, cannot replay. SKIPPED (not counted toward pass/fail).`);
      totalAnsweredCandidates--;
      continue;
    }
    const replay = resolveAuthorityLetterMatch(cand.reasoning ?? '', options);
    const replayedLetter = replay ? replay.letter : null;
    const identical = replayedLetter === cand.letter;
    if (identical) {
      reproducedIdentically++;
    } else {
      driftedRows.push({ qid: o.question_id, authority: cand.authority, originalLetter: cand.letter, replayedLetter, reasoning: cand.reasoning });
      console.log(`\nqid ${o.question_id} | ${cand.authority} -- DRIFT: original letter='${cand.letter}', replayed letter='${replayedLetter}'`);
      console.log(`  reasoning: ${cand.reasoning}`);
    }
  }
}

console.log('\n' + '-'.repeat(100));
console.log(`PART B SUMMARY: ${totalAnsweredCandidates} real answered/candidate rows (5 browser authorities) replayed.`);
console.log(`  Reproduced the SAME letter: ${reproducedIdentically}`);
console.log(`  DRIFTED to a different letter or to null: ${driftedRows.length}`);
console.log(`  NEGATIVE CONTROL ${driftedRows.length === 0 ? 'PASSES' : 'FAILS'}.`);

console.log('\n' + '='.repeat(100));
console.log('GATE VERDICT (the number that decides this ticket):');
console.log(`  False-extraction count (newly-extracted rows where the letter is NOT the corpus correctLetter): ${newlyExtractedRows.filter((r) => !r.isCorrect).length}`);
console.log('='.repeat(100));
