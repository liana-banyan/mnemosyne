// plow_generator_cascade.test.ts
// SEG: D-BP148-003/BISHOP/M1/seg-genticket
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as src/main/crystal/crystal_store.test.ts,
// src/main/hex_terminal_telemetry.test.ts, and src/main/mnem_eblet_store.test.ts (this file's
// closest sibling in that convention, D-BP148-007).
//
// SAME DEVIATION AS mnem_eblet_store.test.ts, STATED EXPLICITLY (do not "fix" this by trying the
// raw-.ts path again -- it was tried and empirically fails here too, same root cause):
// plow_generator_cascade.ts has PRE-EXISTING (not introduced by this ticket) extensionless imports
// of sibling .ts modules (`from './plow_mc_elimination_cascade'`, `from './compute_sidecar'`).
// Node's native TypeScript type-stripping `require()` resolves those via strict ESM resolution,
// which does not probe the `.ts` extension -- confirmed by direct repro this ticket:
//   node -e "require('./src/main/plow/compute_sidecar.ts')"
//   -> Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\canonical_pipeline'
// So this test requires the COMPILED dist/main/plow/plow_generator_cascade.js, exactly the same
// "drive the compiled output, not ts-node/raw TypeScript" bar this ticket's own "prove the far end"
// instruction imposes for everything else.
//
// Run (after `npm run build:main`):
//   node src\main\plow\plow_generator_cascade.test.ts
//
// SCOPE: this file tests the five generator functions' PURE PARSING/GATING logic against synthetic,
// hand-written response text -- it has NO network dependency and proves nothing about a real model's
// actual behavior. The FAR-END proof against real qid 85 / qid 98 data, dispatched to a real live
// Ollama model, is a separate, uncommitted scratchpad script (per this ticket's own scope: OWNS is
// the module plus its own test file, not a live-network proof script) -- see this ticket's own
// report for that script's real, honestly-reported output.

(async function main(): Promise<void> {

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const distPath = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'plow', 'plow_generator_cascade.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gen = require(distPath) as typeof import('./plow_generator_cascade');

// ── Synthetic fixture, mirrors receipt 038's real qid 98 option shape (verified this ticket,
// C:\Users\Administrator\Downloads\038mnemo_mesh_test_receipt_2026-08-03T21-28-38-365Z.json,
// question_id 98) -- same letters/text, so this unit test's shape matches the far-end proof's real
// shape without depending on any live network call itself.
const worldRegionsOptions = [
  { letter: 'A', text: 'South America' },
  { letter: 'B', text: 'South Asia' },
  { letter: 'C', text: 'North Africa' },
  { letter: 'D', text: 'Northeast United States' },
  { letter: 'E', text: 'Europe' },
  { letter: 'F', text: 'Central Asia' },
  { letter: 'G', text: 'Arctic Circle' },
  { letter: 'H', text: 'Amazon Rainforest' },
  { letter: 'I', text: 'Sahara Desert' },
];
const worldRegionsStem =
  "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

// ── Test G1: inverse-complement generation ──────────────────────────────────────────────────────
console.log('\nTest G1 -- inverse complement generation');
{
  const noNegation = gen.generateInverseComplementCandidates(
    'Which of these statements correctly explains bias?',
    worldRegionsOptions,
    'irrelevant',
  );
  assert(noNegation.applied === false, 'non-negated stem is a no-op (nothing to invert)');

  const noResponse = gen.generateInverseComplementCandidates(worldRegionsStem, worldRegionsOptions, null);
  assert(noResponse.applied === true && noResponse.generatedCandidates.length === 0,
    'negated stem with no response abstains honestly', JSON.stringify(noResponse));

  const withResponse = gen.generateInverseComplementCandidates(
    worldRegionsStem,
    worldRegionsOptions,
    'The regions considered most densely populated are B) South Asia and D) Northeast United States.',
  );
  assert(withResponse.applied === true, 'negated stem with a response applies');
  assert(
    withResponse.generatedCandidates.includes('A'),
    'complement of {B,D} includes A (South America) as a generated candidate',
    JSON.stringify(withResponse.generatedCandidates),
  );
  assert(!withResponse.generatedCandidates.includes('B') && !withResponse.generatedCandidates.includes('D'),
    'complement excludes the affirmed letters B and D');
}

// ── Test G2: bidirectional ranking generation ───────────────────────────────────────────────────
console.log('\nTest G2 -- bidirectional ranking generation');
{
  const consistentMostToLeast = 'Most to least: B, D, E, F, C, H, I, A';
  const consistentLeastToMost = 'Least to most: A, I, H, C, F, E, D, B';
  const consistent = gen.generateFromBidirectionalRanking(
    worldRegionsOptions,
    consistentMostToLeast,
    consistentLeastToMost,
    'least',
  );
  assert(consistent.consistent === true, 'exact-reverse rankings are consistent', consistent.trace);
  assert(consistent.generatedCandidate === 'A',
    'least-polarity reads the tail of most-to-least (A) as the generated candidate',
    String(consistent.generatedCandidate));

  const mostPolarity = gen.generateFromBidirectionalRanking(
    worldRegionsOptions,
    consistentMostToLeast,
    consistentLeastToMost,
    'most',
  );
  assert(mostPolarity.generatedCandidate === 'B',
    'most-polarity reads the head of most-to-least (B) as the generated candidate',
    String(mostPolarity.generatedCandidate));

  const inconsistent = gen.generateFromBidirectionalRanking(
    worldRegionsOptions,
    'Most to least: B, D, E',
    'Least to most: A, I, H',
    'least',
  );
  assert(inconsistent.consistent === false && inconsistent.generatedCandidate === null,
    'a source that cannot reverse its own ranking generates nothing (never forced)', inconsistent.trace);

  const noData = gen.generateFromBidirectionalRanking(worldRegionsOptions, null, null, 'least');
  assert(noData.noData === true && noData.generatedCandidate === null,
    'no response on either direction is NO DATA, not a forced pass', noData.trace);
}

// ── Test G3: re-included control pass ───────────────────────────────────────────────────────────
console.log('\nTest G3 -- re-included control pass');
{
  const validLetters = new Set(worldRegionsOptions.map((o) => o.letter));

  const reconfirmed = gen.generateReIncludedCandidates(
    ['C', 'F'],
    validLetters,
    'Control ranking, least to most: C, F, A, I, H, E, D, B',
    'least',
    'least_to_most',
  );
  assert(reconfirmed.generatedCandidates.length === 0,
    'previously-eliminated letters reconfirmed at the same extreme generate nothing',
    reconfirmed.trace);

  const contradicted = gen.generateReIncludedCandidates(
    ['C', 'F'],
    validLetters,
    'Control ranking, least to most: A, I, H, E, D, B, C, F',
    'least',
    'least_to_most',
  );
  assert(contradicted.generatedCandidates.includes('C') && contradicted.generatedCandidates.includes('F'),
    'previously-eliminated letters that move OFF the expected extreme are flagged reintroduced',
    contradicted.trace);

  const noneEliminated = gen.generateReIncludedCandidates([], validLetters, 'irrelevant', 'least');
  assert(noneEliminated.applied === false, 'nothing previously eliminated is a clean no-op');
}

// ── Test G4: hard-number termination ────────────────────────────────────────────────────────────
console.log('\nTest G4 -- hard-number termination');
{
  const statsText = [
    'A) South America: 22 people per km2',
    'B) South Asia: 303 people per km2',
    'C) North Africa: 32 people per km2',
    'D) Northeast United States: 150 people per km2',
    'E) Europe: 181 people per km2',
    'F) Central Asia: 12 people per km2',
    'G) Arctic Circle: 0.1 people per km2',
    'H) Amazon Rainforest: 4 people per km2',
    'I) Sahara Desert: 2 people per km2',
  ].join('\n');

  const leastPolarity = gen.generateFromHardNumberStats(worldRegionsOptions, statsText, 'least');
  assert(leastPolarity.readings.filter((r: { value: number | null }) => r.value !== null).length >= 2,
    'at least 2 options got a matched numeric reading', JSON.stringify(leastPolarity.readings));
  // Honest note: G) Arctic Circle (0.1) is numerically the true minimum in this synthetic fixture,
  // not A -- this test is deliberately checking the MECHANISM (does it correctly find the true
  // extreme of whatever numbers it is given), not re-asserting a specific letter. The real-data
  // far-end proof (qid 98's actual correct answer A) is run separately, live, against a real model.
  assert(leastPolarity.generatedCandidate === 'G',
    'least polarity correctly finds the numeric minimum in the synthetic fixture (mechanism proof)',
    String(leastPolarity.generatedCandidate));

  const noResponse = gen.generateFromHardNumberStats(worldRegionsOptions, null, 'least');
  assert(noResponse.generatedCandidate === null, 'no stats response abstains honestly');

  const tooClose = gen.generateFromHardNumberStats(
    worldRegionsOptions,
    'A) South America: 100.0 people per km2\nB) South Asia: 100.01 people per km2',
    'least',
  );
  assert(tooClose.generatedCandidate === null,
    'values within the required-precision margin abstain rather than force a pick', tooClose.trace);
}

// ── Test G5: register determination (wraps runRegisterResolutionStage, never edits it) ─────────
console.log('\nTest G5 -- register determination generation');
{
  const biasOptions = [
    { letter: 'A', text: 'It describes a process that results in a sample that does not represent the population.' },
    { letter: 'B', text: 'It describes a process that results in a sample that is too large or too small.' },
    { letter: 'C', text: 'It describes a process that uses a random sampling method.' },
    { letter: 'D', text: 'It describes a process that results in a sample that perfectly represents the population.' },
    { letter: 'E', text: 'It describes a sample that is not representative of the population.' },
    { letter: 'F', text: 'It describes a process that always results in accurate estimates.' },
    { letter: 'G', text: "It describes the influence of the researcher's personal beliefs on the outcome of the study." },
    { letter: 'H', text: 'It describes a lack of randomization in the sampling process.' },
    { letter: 'I', text: 'It describes a process where the sampling method has no influence on the outcome of the study.' },
    { letter: 'J', text: 'It describes a process that creates estimates that are too high on average or too low on average.' },
  ];
  const biasStem = 'Which of these statements correctly explains bias?';

  const noVerification = gen.generateFromRegisterDetermination(biasStem, biasOptions, null);
  assert(noVerification.generatedCandidates.length === 0,
    'no verification lookup supplied abstains (mandatory-verification-or-abstain, inherited)',
    noVerification.trace);

  const verified = gen.generateFromRegisterDetermination(biasStem, biasOptions, {
    query: 'what is bias in statistics',
    definitionText:
      'Statistical bias is a systematic error that causes results or estimates to differ from the ' +
      'true values of a population.',
    registerClaimed: 'statistics',
    source: 'test-fixture',
  });
  assert(verified.generatedCandidates.length > 0,
    'a real verified definition generates at least one candidate from the FULL option universe',
    verified.trace);
  console.log(`    generated: [${verified.generatedCandidates.join(',')}]`);
}

// ── Test: composite runGeneratorCascade unions only rules that actually ran ────────────────────
console.log('\nTest composite -- runGeneratorCascade');
{
  const result = gen.runGeneratorCascade({
    stemText: worldRegionsStem,
    options: worldRegionsOptions,
    polarity: 'least',
    inverseResponseText: 'The regions considered most densely populated are B) South Asia and D) Northeast United States.',
    mostToLeastResponseText: 'Most to least: B, D, E, F, C, H, I, A',
    leastToMostResponseText: 'Least to most: A, I, H, C, F, E, D, B',
    // hardNumberStatsResponseText and registerVerification deliberately omitted -- those rules
    // must report as not having run, not as having run-and-found-nothing.
  });
  assert(result.generatedCandidates.includes('A'),
    'composite union includes A from both G1 (complement) and G2 (ranking tail)',
    JSON.stringify(result.generatedCandidates));
  assert(result.g4.generatedCandidate === null && result.g4.readings.length === 0,
    'G4 correctly reports no input supplied, not a false "ran and found nothing"',
    result.g4.trace);
  assert(result.g5.generatedCandidates.length === 0,
    'G5 correctly reports no verification supplied', result.g5.trace);
}

// ── Summary ──────────────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
