// elements/banyan_metric_standard.test.ts -- D-BP152-035/BISHOP/seg-classify-method, STAGE 3/3
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as comparative_cascade.test.ts / method_question_generator.test.ts,
// copied verbatim: requires the COMPILED dist/main/liana_cycle/elements/banyan_metric_standard.js.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\elements\banyan_metric_standard.test.ts
//
// WHAT THIS TESTS:
//   (a) the ported dimension table sums to weight 100 and matches truth_single_bp076.py's own
//       10/5/10/15/15/10/5/15/5/10 weights exactly (a silent rebalance would be an unlabeled TARE);
//   (b) the band boundaries match the Python source's printed interpretation lines verbatim
//       (90/75/60/40);
//   (c) THE CALIBRATION CHECK, per this ticket's own instruction: his two worked points --
//       "How many planets have life on them? -- the answer is 1. That we know of" (~97 in his own
//       eyeballed estimate) versus "at least 2" once a second fact arrives (~85, MORE certain about
//       the negative, LOWER score because a one-sided bound is less completely determined than a
//       closed enumeration). This test builds two metric_inputs sets that hold every dimension
//       fixed EXCEPT the two his own reasoning names as changing (independent_clusters_for_answer:
//       fewer independently-agreeing aspects once the bound replaces the enumeration;
//       confidence_label_calibration: ABSOLUTE -> HIGH), runs both through the SAME ported
//       formula, and asserts the ORDERING his ruling requires (enumeration > bound) is preserved.
//       It does NOT assert the exact values 97/85 -- those were his own illustrative estimate, not
//       derived from this 10-dimension formula, and forcing every other input to hit them would be
//       exactly the "fudging the weights" this ticket's own instruction forbids. If the ordering
//       ever inverts, this test reports that plainly rather than tuning inputs to hide it.

(function main(): void {

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

const distPath = path.join(
  __dirname, '..', '..', '..', '..', 'dist', 'main', 'liana_cycle', 'elements', 'banyan_metric_standard.js',
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./banyan_metric_standard');
const { BANYAN_METRIC_DIMENSIONS, computeBanyanMetricStandard, bandFor } = mod;

console.log('banyan_metric_standard.test.ts -- D-BP152-035 STAGE 3: ported dimensions, bands, calibration\n');

// ── 1. WEIGHTS MATCH truth_single_bp076.py:1010-1091 EXACTLY ───────────────────────────────
{
  const expected: Record<string, number> = {
    specialists_consulted: 10,
    eblets_gathered_raw: 5,
    derivative_pairs_collapsed: 10,
    independent_clusters_for_answer: 15,
    primary_text_present: 15,
    confidence_label_calibration: 10,
    stubbed_gap_acknowledged: 5,
    manual_llm_concordance: 15,
    wall_clock_latency_s: 5,
    anti_popularity_guardrails_count: 10,
  };
  for (const [name, w] of Object.entries(expected)) {
    assert(BANYAN_METRIC_DIMENSIONS[name]?.weight === w, `weight for "${name}" is ${w} (matches Python)`, `got ${BANYAN_METRIC_DIMENSIONS[name]?.weight}`);
  }
  const totalWeight = Object.values(BANYAN_METRIC_DIMENSIONS).reduce((s: number, d: { weight: number }) => s + d.weight, 0);
  assert(totalWeight === 100, 'total weight sums to 100', String(totalWeight));
}

// ── 2. BAND BOUNDARIES MATCH truth_single_bp076.py:1168-1172 EXACTLY ────────────────────────
{
  assert(bandFor(100) === 'ABSOLUTE', 'composite 100 -> ABSOLUTE');
  assert(bandFor(90) === 'ABSOLUTE', 'composite 90 -> ABSOLUTE (lower boundary inclusive)');
  assert(bandFor(89.9) === 'HIGH', 'composite 89.9 -> HIGH');
  assert(bandFor(75) === 'HIGH', 'composite 75 -> HIGH (lower boundary inclusive)');
  assert(bandFor(74.9) === 'MEDIUM', 'composite 74.9 -> MEDIUM');
  assert(bandFor(60) === 'MEDIUM', 'composite 60 -> MEDIUM (lower boundary inclusive)');
  assert(bandFor(59.9) === 'LOW', 'composite 59.9 -> LOW');
  assert(bandFor(40) === 'LOW', 'composite 40 -> LOW (lower boundary inclusive, his own floor)');
  assert(bandFor(39.9) === 'INSUFFICIENT', 'composite 39.9 -> INSUFFICIENT');
  assert(bandFor(0) === 'INSUFFICIENT', 'composite 0 -> INSUFFICIENT');
}

// ── 3. THE CALIBRATION CHECK -- his two worked points, ordering only ────────────────────────
{
  // Held fixed across both scenarios -- deliberately not maxed everywhere, to avoid tuning every
  // input toward a target number (the one thing this ticket's instruction forbids).
  const BASE = {
    specialists_consulted: 6,
    eblets_gathered_raw: 18,
    derivative_pairs_collapsed: 1,
    primary_text_present: true,
    stubbed_gap_acknowledged: 1,
    manual_llm_concordance: 0.72,
    wall_clock_latency_s: 22,
    anti_popularity_guardrails_count: 4,
  };

  // Scenario A -- "How many planets have life? 1, that we know of." A closed enumeration: every
  // aspect tested agrees, fully resolved.
  const enumerationInputs = {
    ...BASE,
    independent_clusters_for_answer: 4,
    confidence_label_calibration: 'ABSOLUTE' as const,
  };

  // Scenario B -- "at least 2" once one contradicting fact arrives. A one-sided bound: MORE
  // certain the count isn't 1, but LESS completely determined (his step 16, the quarters story) --
  // fewer independently-agreeing aspects, and the label steps down from ABSOLUTE to HIGH.
  const boundInputs = {
    ...BASE,
    independent_clusters_for_answer: 3,
    confidence_label_calibration: 'HIGH' as const,
  };

  const enumeration = computeBanyanMetricStandard(enumerationInputs);
  const bound = computeBanyanMetricStandard(boundInputs);

  console.log(`  enumeration ("1, that we know of"): composite ${enumeration.composite}/100, band ${enumeration.band}`);
  console.log(`  one-sided bound ("at least 2"):      composite ${bound.composite}/100, band ${bound.band}`);
  console.log('  his own eyeballed estimate was ~97 (enumeration) and ~85 (bound) -- this test checks the');
  console.log('  ORDERING his ruling requires, not the exact values (his numbers were illustrative, not');
  console.log('  derived from this 10-dimension formula; forcing every input to hit them would be exactly');
  console.log('  the "fudging the weights" this ticket\'s own instruction forbids).');

  assert(
    enumeration.composite > bound.composite,
    'ORDERING PRESERVED: closed enumeration scores higher than a one-sided bound (his counter-intuitive requirement)',
    `enumeration=${enumeration.composite}, bound=${bound.composite} -- if this ever fails, REPORT IT, do not tune inputs to hide it`,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
