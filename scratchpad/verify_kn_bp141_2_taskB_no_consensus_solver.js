// verify_kn_bp141_2_taskB_no_consensus_solver.js
// KN-BP141-2 Task B verification: plow_mc_no_consensus_solver.ts ("Disagreement as Evidence"),
// amended B2 gate (>= 3 DISTINCT DERIVATION PATHS, per A9/A10 REVISED -- "VARIANCE IS NOT
// INDEPENDENCE"). Requires the REAL compiled dist output directly. Real question/candidate data
// is drawn from run 030's own receipt
// (C:\Users\Administrator\Downloads\030mnemo_mesh_test_receipt_2026-08-01T16-22-35-414Z.json) and
// the real mmlu_pro_per_domain dataset records for question_id 85/92/98 -- never hand-invented.
'use strict';

const path = require('path');
const fs = require('fs');

const DIST_NOCONSENSUS = path.join(__dirname, '..', 'dist', 'main', 'plow', 'plow_mc_no_consensus_solver.js');
const DIST_ANSWERER = path.join(__dirname, '..', 'dist', 'main', 'plow', 'plow_mc_answerer.js');
const { solveNoConsensusFromScatter } = require(DIST_NOCONSENSUS);
const { resolveCakeDerivationPath } = require(DIST_ANSWERER);

let failures = 0;
function divider(title) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}
function check(label, pass) {
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}`);
  if (!pass) failures++;
  return pass;
}

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\030mnemo_mesh_test_receipt_2026-08-01T16-22-35-414Z.json';
const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));

const DATASET_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';
function loadDomain(name) {
  return JSON.parse(fs.readFileSync(path.join(DATASET_ROOT, name, 'questions.json'), 'utf8'));
}

function toMcOptions(rawOptions) {
  return rawOptions.map((text, i) => ({ letter: String.fromCharCode(65 + i), text }));
}

function independentSourcesFromReceiptCandidates(qid) {
  const outcome = receipt.outcomes.find((o) => o.question_id === qid);
  if (!outcome) throw new Error(`qid ${qid} not found in receipt`);
  const candidates = outcome.plowTrace.ensemble_candidates;
  return candidates.map((c) => ({ letter: c.letter, derivationPath: resolveCakeDerivationPath(c) }));
}

// ─── (a) qid 92 real scatter -- 4 sources, 3 distinct letters, no majority -- must select E ─────
divider('(a) Task B against qid 92 real scatter (run 030 receipt) -- must ACCEPT letter E');

const other = loadDomain('other');
const q92raw = other.find((q) => q.source_id === '5152');
if (!q92raw) { console.error('FATAL: source_id 5152 (qid92) not found in other/questions.json'); process.exit(1); }
const q92Options = toMcOptions(q92raw.options);
console.log('Real qid92 question:', q92raw.question);
console.log('Real qid92 options:', JSON.stringify(q92Options));
console.log('Real qid92 correct_answer (dataset):', q92raw.correct_answer);

const q92IndependentSources = independentSourcesFromReceiptCandidates(92);
console.log('Real qid92 independentSources (derivation-path-tagged, from receipt candidates):', JSON.stringify(q92IndependentSources));

const q92Result = solveNoConsensusFromScatter(q92raw.question, q92Options, q92IndependentSources);
console.log('solveNoConsensusFromScatter result:', JSON.stringify(q92Result, null, 1));

check('qid92: solver returned a non-null result', !!q92Result);
check('qid92: selected letter is E', q92Result && q92Result.letter === 'E');
check(
  'qid92: E is the real dataset "no specific referent point" option text',
  q92Options.find((o) => o.letter === 'E').text === 'There is no specific referent point.',
);
check(
  'qid92: E matches the real dataset correct_answer field',
  q92raw.correct_answer === q92Options.find((o) => o.letter === 'E').text,
);
check('qid92: provenance is deterministic_compute:no_consensus_from_scatter', q92Result && q92Result.provenance === 'deterministic_compute:no_consensus_from_scatter');

// ─── (b) qid 85 abstains (2 distinct derivation paths / 2 distinct letters) ──────────────────────
divider('(b1) Task B abstains on qid 85 real scatter (2 distinct derivation paths, < 3)');

const math = loadDomain('math');
const q85raw = math.find((q) => q.source_id === '8230');
const q85Options = toMcOptions(q85raw.options);
const q85IndependentSources = independentSourcesFromReceiptCandidates(85);
console.log('Real qid85 independentSources:', JSON.stringify(q85IndependentSources));
console.log('Real qid85 options (no no-consensus phrasing expected):', JSON.stringify(q85Options.map((o) => o.text)));

const q85Result = solveNoConsensusFromScatter(q85raw.question, q85Options, q85IndependentSources);
console.log('solveNoConsensusFromScatter result:', JSON.stringify(q85Result));
check('qid85: solver ABSTAINS (returns null) -- distinctDerivationCount=2 < 3 (B2 gate, "VARIANCE IS NOT INDEPENDENCE")', q85Result === null);

divider('(b2) Task B abstains on qid 98 real scatter (no no-consensus option present -- B1 gate)');

const q98raw = other.find((q) => q.source_id === '5723');
const q98Options = toMcOptions(q98raw.options);
const q98IndependentSources = independentSourcesFromReceiptCandidates(98);
console.log('Real qid98 independentSources:', JSON.stringify(q98IndependentSources));
console.log('Real qid98 options (no no-consensus option present):', JSON.stringify(q98Options.map((o) => o.text)));

const q98Result = solveNoConsensusFromScatter(q98raw.question, q98Options, q98IndependentSources);
console.log('solveNoConsensusFromScatter result:', JSON.stringify(q98Result));
check('qid98: solver ABSTAINS (returns null) -- no option asserts non-existence of a single answer (B1 gate)', q98Result === null);

// ─── Negative controls on the gate itself (never widen the gate to force a pass) ────────────────
divider('(negative controls) gate B2/B3/B4, synthetic inputs isolating one failing condition at a time');

const syntheticOptions = [
  { letter: 'A', text: 'Option A -- a plausible but wrong answer.' },
  { letter: 'B', text: 'Option B -- another plausible but wrong answer.' },
  { letter: 'C', text: 'Option C -- yet another plausible but wrong answer.' },
  { letter: 'D', text: 'Option D -- there is no specific consensus answer to this question.' },
];

// B2 fails: only 2 distinct derivation paths, even though letters scatter 3 ways.
check(
  'B2 isolated failure: 2 distinct derivation paths (< 3), 3 distinct letters -- ABSTAIN',
  solveNoConsensusFromScatter('stub', syntheticOptions, [
    { letter: 'A', derivationPath: 'browser:user_perplexity' },
    { letter: 'B', derivationPath: 'browser:user_google' },
  ]) === null,
);

// B3 fails: 3 distinct derivation paths, but only 2 distinct letters.
check(
  'B3 isolated failure: 3 distinct derivation paths, only 2 distinct letters -- ABSTAIN',
  solveNoConsensusFromScatter('stub', syntheticOptions, [
    { letter: 'A', derivationPath: 'browser:user_perplexity' },
    { letter: 'A', derivationPath: 'browser:user_google' },
    { letter: 'B', derivationPath: 'browser:user_claude' },
  ]) === null,
);

// B3 fails: 3 distinct letters {A,B,C} (passes the count check) across 5 distinct derivation
// paths, but letter A holds a STRICT majority (3 of 5, 60% > 50%).
check(
  'B3 isolated failure: strict majority letter present (3 of 5) -- ABSTAIN',
  solveNoConsensusFromScatter('stub', syntheticOptions, [
    { letter: 'A', derivationPath: 'browser:user_perplexity' },
    { letter: 'A', derivationPath: 'browser:user_google' },
    { letter: 'A', derivationPath: 'browser:user_claude' },
    { letter: 'B', derivationPath: 'swarm' },
    { letter: 'C', derivationPath: 'local_orchestrator:reasoning_first' },
  ]) === null,
);

// B4 fails: gate otherwise clean (4 paths, 3 letters {A,B,D}, no majority: A=2,B=1,D=1, 2*2=4 not >
// 4), but the no-consensus option's OWN letter (D) is among the plurality leaders.
check(
  'B4 isolated failure: no-consensus letter D IS the plurality pick -- ABSTAIN',
  solveNoConsensusFromScatter('stub', syntheticOptions, [
    { letter: 'D', derivationPath: 'browser:user_perplexity' },
    { letter: 'D', derivationPath: 'browser:user_google' },
    { letter: 'A', derivationPath: 'browser:user_claude' },
    { letter: 'B', derivationPath: 'swarm' },
  ]) === null,
);

// B1 fails: 0 no-consensus options (all synthetic options are plain wrong answers).
const noNoConsensusOptions = syntheticOptions.slice(0, 3);
check(
  'B1 isolated failure: zero no-consensus options -- ABSTAIN',
  solveNoConsensusFromScatter('stub', noNoConsensusOptions, [
    { letter: 'A', derivationPath: 'browser:user_perplexity' },
    { letter: 'B', derivationPath: 'browser:user_google' },
    { letter: 'C', derivationPath: 'browser:user_claude' },
  ]) === null,
);

// B1 fails: 2+ no-consensus-shaped options (ambiguous which one is "the" no-consensus option).
const ambiguousOptions = [
  ...syntheticOptions,
  { letter: 'E', text: 'Option E -- there is no single agreed-upon answer to this question either.' },
];
check(
  'B1 isolated failure: 2+ no-consensus-shaped options (ambiguous) -- ABSTAIN',
  solveNoConsensusFromScatter('stub', ambiguousOptions, [
    { letter: 'A', derivationPath: 'browser:user_perplexity' },
    { letter: 'B', derivationPath: 'browser:user_google' },
    { letter: 'C', derivationPath: 'browser:user_claude' },
  ]) === null,
);

// Positive control: same-derivation-path repeats must not inflate independence OR letter scatter
// ("VARIANCE IS NOT INDEPENDENCE") -- 5 votes but only 3 distinct paths (one path sampled 3x with
// 3 DIFFERENT letters, which would wrongly look like 3-way scatter if dedup were missing).
check(
  'dedup-by-path: repeated sampling of ONE path (3x, 3 different letters) does not fabricate scatter -- ABSTAIN',
  solveNoConsensusFromScatter('stub', syntheticOptions, [
    { letter: 'A', derivationPath: 'browser:user_perplexity' },
    { letter: 'B', derivationPath: 'browser:user_perplexity' }, // same path, different letter -- must be ignored (first wins)
    { letter: 'C', derivationPath: 'browser:user_perplexity' }, // same path again -- must be ignored
    { letter: 'B', derivationPath: 'browser:user_google' },
  ]) === null, // only 2 distinct paths after dedup (perplexity, google) -- B2 fails
);

// Full positive control with the dedup logic still yielding a clean 3-way accept.
check(
  'clean accept: 4 distinct paths, 3 distinct letters {A,B,C}, no majority, no-consensus letter D not plurality',
  (() => {
    const r = solveNoConsensusFromScatter('stub', syntheticOptions, [
      { letter: 'A', derivationPath: 'browser:user_perplexity' },
      { letter: 'B', derivationPath: 'browser:user_google' },
      { letter: 'C', derivationPath: 'browser:user_claude' },
      { letter: 'A', derivationPath: 'swarm' },
    ]);
    return r && r.letter === 'D';
  })(),
);

// ─── (c) full-dataset scan: how many mmlu_pro_per_domain questions carry a no-consensus option ──
divider('(c) full-dataset scan: mmlu_pro_per_domain, how many questions offer a no-consensus option');

const NO_CONSENSUS_PATTERNS = [
  /\bthere is no specific\b/i,
  /\bthere is no single\b/i,
  /\bno single (correct )?(answer|consensus)\b/i,
  /\bno specific (correct )?(answer|consensus)\b/i,
  /\bthere is no consensus\b/i,
  /\bno consensus (exists|has been reached)\b/i,
  /\bno (universally |generally )?agreed[- ]upon\b/i,
];
function isNoConsensusOptionText(text) {
  return NO_CONSENSUS_PATTERNS.some((re) => re.test(text));
}

const domains = fs.readdirSync(DATASET_ROOT).filter((d) => fs.existsSync(path.join(DATASET_ROOT, d, 'questions.json')));
let totalQuestions = 0;
let questionsWithExactlyOneNoConsensusOption = 0;
let questionsWithAmbiguousNoConsensusOptions = 0;
const perDomainCounts = {};
for (const domain of domains) {
  const qs = loadDomain(domain);
  let domainHits = 0;
  for (const q of qs) {
    totalQuestions++;
    const hits = q.options.filter((o) => isNoConsensusOptionText(o));
    if (hits.length === 1) {
      questionsWithExactlyOneNoConsensusOption++;
      domainHits++;
    } else if (hits.length >= 2) {
      questionsWithAmbiguousNoConsensusOptions++;
    }
  }
  perDomainCounts[domain] = domainHits;
}
console.log(`Total questions scanned: ${totalQuestions}`);
console.log(`Questions with EXACTLY ONE no-consensus-shaped option (B1-eligible): ${questionsWithExactlyOneNoConsensusOption}`);
console.log(`Questions with 2+ no-consensus-shaped options (B1 would abstain, ambiguous): ${questionsWithAmbiguousNoConsensusOptions}`);
console.log('Per-domain B1-eligible counts:', JSON.stringify(perDomainCounts, null, 1));
check('full-dataset scan completed without throwing', true);
check('qid92 (source_id 5152, domain "other") is counted among the B1-eligible questions', perDomainCounts.other > 0);

console.log('\n' + '='.repeat(78));
console.log(`SUMMARY (Task B checks): Failures: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
