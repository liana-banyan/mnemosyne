// verify_kn_bp141_2_cake_method_taskA.js
// KN-BP141-2 Task A verification script (THE CAKE METHOD, N-Cut/N-Pick, corrected A9/A10 + A13).
// Requires the REAL compiled dist output directly. Real question/candidate data is drawn from
// run 030's own receipt (C:\Users\Administrator\Downloads\030mnemo_mesh_test_receipt_2026-08-01T16-22-35-414Z.json)
// and the real mmlu_pro_per_domain dataset record for question_id 85 -- never hand-invented text
// for the CORE mechanism checks. The blindness-audit checks (9/10) necessarily inject a SIMULATED
// picker (a stub BrowserAuthorityBridge) since no live browser session exists in this sandbox --
// this is disclosed plainly in each check's own banner, never presented as a live network result.
'use strict';

const path = require('path');
const fs = require('fs');

const DIST = path.join(__dirname, '..', 'dist', 'main', 'plow', 'plow_mc_answerer.js');
const DIST_SIDECAR = path.join(__dirname, '..', 'dist', 'main', 'plow', 'compute_sidecar.js');
const DIST_WAN = path.join(__dirname, '..', 'dist', 'main', 'mesh_test', 'wan_dispatch.js');

const M = require(DIST);
const { parseOptionsFromPrompt } = require(DIST_SIDECAR);
const { buildMcPrompt } = require(DIST_WAN);

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

// ─── Real data: question_id 85 (run 030 receipt + mmlu_pro_per_domain/math/questions.json) ──────
const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\030mnemo_mesh_test_receipt_2026-08-01T16-22-35-414Z.json';
const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
const q85outcome = receipt.outcomes.find((o) => o.question_id === 85);
if (!q85outcome) { console.error('FATAL: qid85 not found in run 030 receipt'); process.exit(1); }
const q85Candidates = q85outcome.plowTrace.ensemble_candidates; // REAL [user_perplexity:J, specialist_swarm:A]
console.log('Real qid85 ensemble_candidates from run 030 receipt:');
console.log(JSON.stringify(q85Candidates, null, 2));

const DATASET_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';
const mathQuestions = JSON.parse(fs.readFileSync(path.join(DATASET_ROOT, 'math', 'questions.json'), 'utf8'));
const q85raw = mathQuestions.find((q) => q.source_id === '8230');
if (!q85raw) { console.error('FATAL: source_id 8230 (qid85) not found in math/questions.json'); process.exit(1); }
const q85Mmlu = {
  question_id: 85, question: q85raw.question, options: q85raw.options,
  answer: 'E', answer_index: 4, category: 'math', src: 'mmlu_pro_per_domain/math/questions.json',
};
const q85Prompt = buildMcPrompt(q85Mmlu);
const q85Options = parseOptionsFromPrompt(q85Prompt);
console.log('\nReal qid85 options (buildMcPrompt + parseOptionsFromPrompt):', JSON.stringify(q85Options));

// Real qid92 4-candidate scatter (used for shuffle/anonymization checks -- more sources = a
// better test of "no fixed slot" than qid85's 2).
const q92outcome = receipt.outcomes.find((o) => o.question_id === 92);
const q92Candidates = q92outcome.plowTrace.ensemble_candidates; // REAL [perplexity:B, google:F, claude:J, swarm:B]
console.log('\nReal qid92 ensemble_candidates (4 sources) from run 030 receipt:');
console.log(JSON.stringify(q92Candidates.map((c) => ({ authority: c.authority, letter: c.letter })), null, 2));

// ─── CHECK 1: resolveCakeDerivationPath / resolveCakeModelIdentity (A9 REVISED) ──────────────────
divider('CHECK 1 (A9 REVISED): derivation path / model identity mapping, real qid85+qid92 candidates');
for (const c of [...q85Candidates, ...q92Candidates]) {
  const dp = M.resolveCakeDerivationPath(c);
  const mi = M.resolveCakeModelIdentity(c);
  console.log(`  ${c.authority}:${c.letter} -> derivationPath="${dp}" modelIdentity="${mi}"`);
}
check(
  'user_perplexity -> browser:user_perplexity',
  M.resolveCakeDerivationPath(q85Candidates[0]) === 'browser:user_perplexity',
);
check(
  'specialist_swarm -> swarm (NOT model-counted per internal voter, A10 "VARIANCE IS NOT INDEPENDENCE")',
  M.resolveCakeDerivationPath(q85Candidates[1]) === 'swarm',
);
check('user_google -> browser:user_google', M.resolveCakeDerivationPath(q92Candidates[1]) === 'browser:user_google');
check('user_claude -> browser:user_claude', M.resolveCakeDerivationPath(q92Candidates[2]) === 'browser:user_claude');
check(
  'distinct derivation paths across qid92 4 candidates == 4 (perplexity/google/claude/swarm all distinct routes)',
  new Set(q92Candidates.map(M.resolveCakeDerivationPath)).size === 4,
);
check(
  'model identity is recorded but DIFFERENT axis than derivation path (perplexity model="perplexity")',
  M.resolveCakeModelIdentity(q85Candidates[0]) === 'perplexity',
);

// ─── CHECK 2: computeAnonymizedOrderSeed determinism (A3/A5) ────────────────────────────────────
divider('CHECK 2 (A3/A5): anonymizedOrderSeed is deterministic per question, varies across questions');
const seed85a = M.computeAnonymizedOrderSeed(q85Mmlu.question);
const seed85b = M.computeAnonymizedOrderSeed(q85Mmlu.question);
const seed92 = M.computeAnonymizedOrderSeed(q92outcome.question);
console.log(`  seed(qid85) run1=${seed85a} run2=${seed85b} seed(qid92)=${seed92}`);
check('same question -> same seed (reproducible)', seed85a === seed85b);
check('different question -> different seed', seed85a !== seed92);

// ─── CHECK 3: shuffleCakePoolForPicker -- per-picker AND per-question shuffle (A3/A7) ────────────
divider('CHECK 3 (A3/A7): per-picker shuffle varies; no candidate pinned to a fixed slot');
const q92Pool = q92Candidates.map((c) => ({ pickerKey: c.authority, letter: c.letter }));
const pickers = ['user_perplexity', 'user_claude', 'user_chatgpt', 'local_orchestrator'];
const shufflesByPicker = {};
for (const pk of pickers) {
  shufflesByPicker[pk] = M.shuffleCakePoolForPicker(q92Pool, seed92, pk).map((c) => c.pickerKey);
  console.log(`  picker=${pk.padEnd(18)} order=[${shufflesByPicker[pk].join(', ')}]`);
}
const allIdentical = pickers.every((pk) => JSON.stringify(shufflesByPicker[pk]) === JSON.stringify(shufflesByPicker[pickers[0]]));
check('NOT every picker sees an identical order (per-picker shuffle is real, A7)', !allIdentical);
// A3: "the judge's own candidate must NOT land in a fixed slot" -- check user_perplexity's OWN
// candidate's position varies across the different pickers' own shuffles for the SAME question.
const perplexityPositions = pickers.map((pk) => shufflesByPicker[pk].indexOf('user_perplexity'));
console.log(`  user_perplexity's own-candidate position across pickers: [${perplexityPositions.join(', ')}]`);
check('own-candidate position varies across pickers (not a fixed slot)', new Set(perplexityPositions).size > 1);
// Across DIFFERENT questions, same picker -- position should also vary (seed differs).
const orderQ85 = M.shuffleCakePoolForPicker(q92Pool, seed85a, 'user_perplexity').map((c) => c.pickerKey);
const orderQ92 = shufflesByPicker['user_perplexity'];
check('same picker, different question seed -> different order', JSON.stringify(orderQ85) !== JSON.stringify(orderQ92));

// ─── CHECK 4: normalizeCakeRationale (A3 normalize prose) ────────────────────────────────────────
divider('CHECK 4 (A3): normalizeCakeRationale on REAL qid92 reasoning text');
for (const c of q92Candidates) {
  const norm = M.normalizeCakeRationale(c.reasoning);
  console.log(`  ${c.authority}: raw(${c.reasoning.length} chars) -> normalized(${norm.length} chars): "${norm}"`);
  check(`${c.authority} normalized rationale has no newline`, !norm.includes('\n'));
  check(`${c.authority} normalized rationale <= raw length`, norm.length <= c.reasoning.length + 3 /* "..." */);
}

// ─── CHECK 5: buildCakeChoosePromptText + assertCakeChoosePromptIsBlind -- REAL positive proof ───
divider('CHECK 5 (A2/A3/A8): choose prompt built from REAL qid92 pool passes the blindness assertion');
const q92Labeled = M.shuffleCakePoolForPicker(
  q92Candidates.map((c) => ({ letter: c.letter, rationale: M.normalizeCakeRationale(c.reasoning) })),
  seed92, 'user_claude',
).map((c, i) => ({ label: `Source ${i + 1}`, letter: c.letter, rationale: c.rationale }));
const choosePromptReal = M.buildCakeChoosePromptText(q92outcome.question, q92Options_or_fallback(), q92Labeled);
console.log('Real anonymized CHOOSE prompt (qid92):\n---\n' + choosePromptReal + '\n---');
let blindAssertionThrew = false;
try {
  M.assertCakeChoosePromptIsBlind(choosePromptReal, q92Candidates.map((c) => c.reasoning));
} catch (e) {
  blindAssertionThrew = true;
  console.log('  UNEXPECTED throw:', e.message);
}
check('real anonymized choose prompt passes assertCakeChoosePromptIsBlind (no leak)', !blindAssertionThrew);
check('choose prompt contains NO authority name (case-insensitive scan)', !['user_perplexity', 'user_google', 'user_claude', 'specialist_swarm'].some((m) => choosePromptReal.toLowerCase().includes(m)));

function q92Options_or_fallback() {
  // Real MC options for qid92, reconstructed from the real Google query URL captured in the
  // receipt (google embeds the full option list in its query string) -- never hand-invented.
  const url = q92Candidates.find((c) => c.authority === 'user_google').sourceUrl;
  const qParam = decodeURIComponent(url.split('q=')[1]);
  return parseOptionsFromPrompt(qParam.replace(/\+/g, ' '));
}

// ─── CHECK 6 (NEGATIVE CONTROL): the assertion is REAL, not a no-op -- must THROW on a leak ──────
divider('CHECK 6 NEGATIVE CONTROL: assertCakeChoosePromptIsBlind MUST throw on a genuine leak');
let threwOnProvenance = false;
try {
  M.assertCakeChoosePromptIsBlind(choosePromptReal + '\n(this text was contributed by user_perplexity)', []);
} catch (e) { threwOnProvenance = true; }
check('throws when a provenance name leaks into the prompt', threwOnProvenance);

let threwOnCutText = false;
const rawCutText = q92Candidates[0].reasoning; // user_perplexity's raw, un-normalized reasoning
try {
  M.assertCakeChoosePromptIsBlind(choosePromptReal + '\n' + rawCutText, [rawCutText]);
} catch (e) { threwOnCutText = true; }
check('throws when a raw cut response leaks into the prompt verbatim (A2)', threwOnCutText);

// ─── CHECK 7: tallyCakePicksWithAbstain (A7 plurality, ties abstain) ─────────────────────────────
divider('CHECK 7 (A7): plurality tally, ties fall through to abstain (never first-responder)');
const t1 = M.tallyCakePicksWithAbstain(['B', 'B', 'J']);
console.log('  picks=[B,B,J] ->', JSON.stringify(t1));
check('3 picks, B has plurality -> chosenLetter=B', t1.chosenLetter === 'B' && t1.pickConvergence === 2);
const t2 = M.tallyCakePicksWithAbstain(['B', 'B', 'J', 'J']);
console.log('  picks=[B,B,J,J] ->', JSON.stringify(t2));
check('2-2 tie -> ABSTAIN (null), never first-responder B', t2.chosenLetter === null && t2.pickConvergence === 2);
const t3 = M.tallyCakePicksWithAbstain([null, null]);
console.log('  picks=[null,null] ->', JSON.stringify(t3));
check('no resolvable picks -> ABSTAIN', t3.chosenLetter === null && t3.pickConvergence === 0);
const t4 = M.tallyCakePicksWithAbstain(['E', 'E', 'E']);
check('unanimous picks -> that letter, convergence=1', t4.chosenLetter === 'E' && t4.pickConvergence === 1);

// ─── CHECK 8: resolveCakeQuadrant (A12 cross-signal) ─────────────────────────────────────────────
divider('CHECK 8 (A12): cutScatter x pickConvergence quadrant labeling');
check('scatter(3) -> convergence(1) = scatter_resolved_by_pick', M.resolveCakeQuadrant(3, 1, 3) === 'scatter_resolved_by_pick');
check('scatter(3) -> convergence(3) = scatter_persists_after_pick', M.resolveCakeQuadrant(3, 3, 3) === 'scatter_persists_after_pick');
check('zero picks = no_picks_available', M.resolveCakeQuadrant(3, 0, 0) === 'no_picks_available');
check('scatter(1) = no_real_cut_disagreement', M.resolveCakeQuadrant(1, 1, 2) === 'no_real_cut_disagreement');

// ─── CHECK 9 (A13): assignCakeRoutesRoundRobin -- pure, deterministic mesh-diversity allocator ───
divider('CHECK 9 (A13): round-robin route assignment (single-machine "run sequentially" case)');
const fullPool = M.CAKE_LOCAL_ROUTE_POOL;
console.log('  route pool:', JSON.stringify(fullPool));
check('participantCount >= pool.length returns the FULL pool', JSON.stringify(M.assignCakeRoutesRoundRobin(5, 0)) === JSON.stringify(fullPool));
const r0 = M.assignCakeRoutesRoundRobin(1, 0);
const r1 = M.assignCakeRoutesRoundRobin(1, 1);
const r2 = M.assignCakeRoutesRoundRobin(1, 2);
console.log(`  participantCount=1: round0=${JSON.stringify(r0)} round1=${JSON.stringify(r1)} round2=${JSON.stringify(r2)}`);
check('round-robin rotates which single route is assigned across question rounds', JSON.stringify(r0) !== JSON.stringify(r1));
check('round-robin wraps back after pool.length rounds', JSON.stringify(r0) === JSON.stringify(r2));

divider('SUMMARY (pure-mechanism checks 1-9)');
console.log(`Failures so far: ${failures}`);
if (failures > 0) process.exitCode = 1;
module.exports = { failures, q85Candidates, q85Mmlu, q85Options, q85outcome };
