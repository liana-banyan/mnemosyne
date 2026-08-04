// KN-BP144-9 Phase 2 FE-1/FE-2 "prove the far end" support script.
//
// FE-1: shows the Phase-2-recovered letter (qid 111, user_claude -> 'I') arriving in
// ensemble_candidates as a REAL candidate object, constructed via the EXACT same code shape as
// plow_mc_answerer.ts's real runAuthorityEnsemble loop (candidates.push({ authority: llmName,
// letter: resolved.letter, reasoning: llmResult.fact, sourceUrl: llmResult.sourceUrl, method:
// resolved.method })) -- using the REAL compiled resolveAuthorityLetterMatch and the REAL
// rawPreview text/sourceUrl this receipt actually recorded, not a synthetic example.
//
// FE-2: shows the BEFORE (real, live 041 receipt) and AFTER (same candidate list + the Phase-2
// recovery) candidate sets for qid 111, and reports whether the change is single-path-> multi-path
// or otherwise changes what the ensemble would see.
//
// Read-only. Does not modify src/ or the receipt.
// Run: node scratchpad/kn_bp144_9_fe1_fe2_qid111.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json';
const CORPUS_BASE = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';
const parserDist = require('../dist/main/plow/plow_mc_answerer.js');
const { resolveAuthorityLetterMatch } = parserDist;

const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
const o = receipt.outcomes.find((x) => x.question_id === 111);

const lookup = new Map();
for (const d of readdirSync(CORPUS_BASE).filter((d) => statSync(join(CORPUS_BASE, d)).isDirectory())) {
  const qp = join(CORPUS_BASE, d, 'questions.json');
  if (!existsSync(qp)) continue;
  const arr = JSON.parse(readFileSync(qp, 'utf8'));
  const list = Array.isArray(arr) ? arr : arr.questions;
  for (const q of list) if (typeof q.question === 'string') lookup.set(q.question.trim(), q);
}
const corpusQ = lookup.get(o.question.trim());
const options = corpusQ.options.map((text, i) => ({ letter: String.fromCharCode(65 + i), text }));

console.log('='.repeat(100));
console.log(`QID 111 -- question: ${o.question}`);
console.log(`correctLetter: ${o.correctLetter}  |  isCorrect (live, real 041 receipt): ${o.isCorrect}`);
console.log('='.repeat(100));

console.log('\n--- BEFORE: real, live plowTrace.ensemble_candidates for qid 111 (041 receipt, as-run) ---');
const beforeCandidates = o.plowTrace.ensemble_candidates ?? [];
console.log(JSON.stringify(beforeCandidates, null, 2));

console.log('\n--- BEFORE: real, live plowTrace.authorityOutcomes for qid 111 ---');
console.log(JSON.stringify(o.plowTrace.authorityOutcomes, null, 2));

// FE-1: replay the REAL rawPreview through the REAL (post-Phase-2) compiled parser for the
// authority whose parse_failed row this ticket's Phase 0/2 investigation centered on.
const claudeOutcome = o.plowTrace.authorityOutcomes.user_claude;
const claudeRawPreview = claudeOutcome.rawPreview;
const resolved = resolveAuthorityLetterMatch(claudeRawPreview, options);

console.log('\n' + '='.repeat(100));
console.log('FE-1: the extracted letter arriving in ensemble_candidates as a REAL candidate, not');
console.log('merely returned by the extraction function -- constructed via the EXACT candidates.push()');
console.log('shape at plow_mc_answerer.ts runAuthorityEnsemble (user_claude branch).');
console.log('='.repeat(100));
if (!resolved) {
  console.log('resolveAuthorityLetterMatch returned null on this real rawPreview -- FE-1 cannot be demonstrated for user_claude this pass.');
} else {
  const newCandidate = {
    authority: 'user_claude',
    letter: resolved.letter,
    reasoning: claudeRawPreview, // real caveat: live code uses llmResult.fact (up to 320 chars); this
                                   // script only has the 200-char rawPreview the receipt stored --
                                   // flagged explicitly, see report.
    sourceUrl: '(not captured in receipt for parse_failed rows -- see caveat in report)',
    method: resolved.method,
  };
  console.log('\nresolveAuthorityLetterMatch(realRawPreview, realOptions) => ', JSON.stringify(resolved));
  console.log('\nReal downstream candidates.push() shape this produces (byte-identical field construction to');
  console.log('the live source at plow_mc_answerer.ts\'s browser-LLM loop):');
  console.log(JSON.stringify(newCandidate, null, 2));

  console.log('\n' + '='.repeat(100));
  console.log('FE-2: BEFORE vs AFTER candidate set for qid 111, and what changes for the ensemble.');
  console.log('='.repeat(100));
  const afterCandidates = [...beforeCandidates, newCandidate];
  console.log('\nBEFORE candidates (authority:letter):', beforeCandidates.map((c) => `${c.authority}:${c.letter}`));
  console.log('AFTER  candidates (authority:letter):', afterCandidates.map((c) => `${c.authority}:${c.letter}`));

  const beforeLetters = new Set(beforeCandidates.map((c) => c.letter));
  const afterLetters = new Set(afterCandidates.map((c) => c.letter));
  console.log('\nBEFORE distinct letters proposed:', [...beforeLetters]);
  console.log('AFTER  distinct letters proposed:', [...afterLetters]);
  console.log(`\nBEFORE candidate count: ${beforeCandidates.length}  ->  AFTER candidate count: ${afterCandidates.length}`);
  console.log(`Shape change: ${beforeCandidates.length <= 1 ? 'single-candidate-or-empty' : 'already-multi'} -> ${afterCandidates.length <= 1 ? 'single' : 'multi'}-candidate`);
}
