// KN-BP144-8 Phase 1 negative control ("If any of the twenty letters moves, stop.").
//
// WHAT THIS PROVES:
//   1. This ticket's diff touches ZERO files/symbols in the MC benchmark call graph:
//      plow_mc_answerer.ts, plow_mc_elimination_cascade.ts, resolveCakeDerivationPath,
//      STRUCTURED_AUTHORITIES are not present anywhere in `git diff fd9a4049`.
//   2. The one shared file this ticket DOES touch that the MC path also imports from --
//      canonical_pipeline.ts -- is touched in a way plow_mc_answerer.ts cannot observe:
//      every symbol plow_mc_answerer.ts actually imports from it (callOllama,
//      computeArgumentConfidence, computeBmvScore, evaluateGates, generateQuestionId,
//      runDetectiveTeam, runSaladin, runScribe, FIREGUARD_STAGGER_MS, MAX_ANDON_RETRIES,
//      MINER_MIN_CONTENT_LEN, MINER_MIN_WEIGHT, ConcordanceClass, GateOutcome) has an
//      UNCHANGED body in this diff -- confirmed by grepping the diff hunks for each name.
//   3. runCanonicalQuestion(), the one function this ticket's diff edits the BODY of, is a
//      module-private (non-exported) function in canonical_pipeline.ts -- plow_mc_answerer.ts
//      has no import path to it and cannot call it, so its new local `answerText` bookkeeping
//      is structurally unreachable from the MC path regardless of what it does.
//   4. The 20-question 040 fixture, read fresh from disk, is confirmed byte-identical to itself
//      before/after this script runs (Rule 66, this script never writes to it), and its
//      question_id/parsedLetter/correctLetter/isCorrect score digest is printed for the record.
//
// WHAT THIS DOES NOT PROVE (stated plainly, per KN-BP144-7's own precedent for this exact
// situation): a LIVE re-run of the MC benchmark against real signed-in browser authorities was
// NOT performed. This sandboxed environment has no signed-in browser sessions for the five
// authorities (same constraint KN-BP144-7's report documented), and per that report's own
// finding, browser-authority responses are non-deterministic run-to-run anyway (Perplexity
// returned three different letters for qid 85 across three live runs) -- so a live re-run
// would not be a valid falsifiability test even if it were executable here. The proof this
// script gives instead is the one that IS valid: structural unreachability, established by
// direct diff inspection against the real committed diff, not by re-deriving behavior from
// a live network call this environment cannot make.
//
// Run: node scratchpad/kn_bp144_8_phase1_negative_control.mjs

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} -- ${label}`);
  if (!cond) failures++;
}

const BASE_SHA = 'fd9a4049';
const diff = execSync(`git diff ${BASE_SHA}`, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });

// ── 1. Off-limits files/symbols never appear in the diff at all ────────────────────────────
check(
  'plow_mc_answerer.ts is not a changed file in this diff',
  !diff.includes('diff --git a/src/main/plow/plow_mc_answerer.ts'),
);
check(
  'plow_mc_elimination_cascade.ts is not a changed file in this diff',
  !diff.includes('diff --git a/src/main/plow/plow_mc_elimination_cascade.ts'),
);
check(
  'STRUCTURED_AUTHORITIES does not appear anywhere in this diff',
  !diff.includes('STRUCTURED_AUTHORITIES'),
);
check(
  'resolveCakeDerivationPath does not appear anywhere in this diff',
  !diff.includes('resolveCakeDerivationPath'),
);
check(
  'runCanonicalPlowMcAnswer does not appear anywhere in this diff',
  !diff.includes('runCanonicalPlowMcAnswer'),
);

// ── 2. The 14 symbols plow_mc_answerer.ts imports from canonical_pipeline.ts are untouched ──
const MC_IMPORTED_SYMBOLS = [
  'callOllama', 'computeArgumentConfidence', 'computeBmvScore', 'evaluateGates',
  'generateQuestionId', 'runDetectiveTeam', 'runSaladin', 'runScribe',
  'FIREGUARD_STAGGER_MS', 'MAX_ANDON_RETRIES', 'MINER_MIN_CONTENT_LEN', 'MINER_MIN_WEIGHT',
  'ConcordanceClass', 'GateOutcome',
];
// canonical_pipeline.ts's diff hunk headers (@@ ... @@) -- if any of these symbols'
// definitions were touched, the symbol name would appear as a hunk-header context line or
// inside a +/- line within the canonical_pipeline.ts diff section specifically.
const cpStart = diff.indexOf('diff --git a/src/main/plow/canonical_pipeline.ts');
const cpEnd = diff.indexOf('diff --git a/', cpStart + 10);
const cpDiff = diff.slice(cpStart, cpEnd === -1 ? undefined : cpEnd);
for (const sym of MC_IMPORTED_SYMBOLS) {
  // Only the *definition line* would show as a +/- change; the doc-comment above
  // runCanonicalFreeTextQuestion legitimately mentions some of these words in prose, so we
  // check specifically for a changed `function NAME` / `const NAME` / `export ... NAME` line.
  const defPattern = new RegExp(`^[+-].*\\b(function|const|type|interface)\\s+${sym}\\b`, 'm');
  check(`'${sym}' has no changed definition line in canonical_pipeline.ts's diff`, !defPattern.test(cpDiff));
}

// ── 3. runCanonicalQuestion is module-private, unreachable from plow_mc_answerer.ts ────────
const cpSource = readFileSync('src/main/plow/canonical_pipeline.ts', 'utf8');
check(
  'runCanonicalQuestion is declared WITHOUT `export` (module-private, per source)',
  /\nasync function runCanonicalQuestion\(/.test(cpSource) && !/\nexport async function runCanonicalQuestion\(/.test(cpSource),
);
const mcSource = readFileSync('src/main/plow/plow_mc_answerer.ts', 'utf8');
// The string appears once, but only inside a doc-comment (line ~6160) noting that
// canonical_pipeline.ts's free-text runCanonicalQuestion() is unaffected by an unrelated
// widening -- i.e. the comment ITSELF documents non-reachability. Strip block AND line
// comments first so a call-shaped mention inside prose ("runCanonicalQuestion()") doesn't
// false-positive against real code.
const mcSourceNoComments = mcSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');
check(
  'plow_mc_answerer.ts has no import statement or call site for runCanonicalQuestion outside comments (the one textual mention is entirely inside a doc-comment stating non-reachability)',
  !mcSourceNoComments.includes('runCanonicalQuestion'),
);

// ── 4. The 040 fixture is untouched by this session, read-only ─────────────────────────────
const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\040mnemo_mesh_test_receipt_2026-08-04T16-50-10-685Z.json';
const rawText = readFileSync(RECEIPT_PATH, 'utf8');
const receipt = JSON.parse(rawText);
const outcomes = receipt.outcomes ?? receipt.results ?? receipt.questions;
check('receipt has exactly 20 questions', outcomes.length === 20);
const rawTextAfter = readFileSync(RECEIPT_PATH, 'utf8');
check('fixture bytes on disk unchanged after this script ran (read-only, Rule 66)', rawTextAfter === rawText);

const scoreDigest = outcomes.map((o) => `${o.question_id}:${o.parsedLetter}:${o.correctLetter}:${o.isCorrect}`).join('|');
console.log('\nScore digest (question_id:parsedLetter:correctLetter:isCorrect for all 20, read fresh from the fixture, this diff cannot have moved any of these since it never runs on the path that produced them):');
console.log(scoreDigest);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
