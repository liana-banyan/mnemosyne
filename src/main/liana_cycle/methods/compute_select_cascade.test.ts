// compute_select_cascade.test.ts -- D-BP165-M0-022/BISHOP-M0/SEG
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as comparative_cascade.test.ts (this directory) and
// rooting_rule.test.ts/plow_derived_quantity_reconciler.test.ts/crystal_store.test.ts/
// hex_terminal_telemetry.test.ts (see comparative_cascade.test.ts's own header).
//
// SAME DEVIATION those files' own headers already document: compute_select_cascade.ts has
// extensionless imports of sibling .ts modules. Node's native TypeScript type-stripping
// require() resolves those via strict ESM resolution, which does not probe the .ts extension.
// This test requires the COMPILED dist/main/liana_cycle/methods/compute_select_cascade.js.
//
// Run (after `npx tsc -p tsconfig.main.json` in mnemosyne\):
//   node src\main\liana_cycle\methods\compute_select_cascade.test.ts
//
// WHAT THIS TESTS: only the PURE, no-I/O surfaces -- shapeTest() (the honesty gate deciding
// whether this method is even eligible), extractCandidateOptionValues() (the option-text number
// parser this method's own header explains was written fresh rather than reusing
// compute_sidecar.ts's extractNumber()), and matchComputedValueToMcqOptions() (the SELECT step's
// own exactly-one-qualifies honesty gate). run() itself makes a real network call to a local
// Ollama and is proven end-to-end by the n=50 sweep harness (D-BP165-M0-019's
// mmlu_pro_liana_cycle_sweep.cjs), not mocked here -- same division of labor
// comparative_cascade.test.ts's own header describes for its own untested surfaces.

(async function main(): Promise<void> {

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`PASS: ${label}`);
  } else {
    failed++;
    console.error(`FAIL: ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const mod = require(path.join(
  __dirname, '..', '..', '..', '..', 'dist', 'main', 'liana_cycle', 'methods', 'compute_select_cascade.js',
));

const { computeSelectCascadeMethod, extractCandidateOptionValues, matchComputedValueToMcqOptions, MCQ_MATCH_REL_TOLERANCE } = mod;

// ─── shapeTest() ────────────────────────────────────────────────────────────────────────────────

// TEST 1: a free-text question (no options at all) is REFUSED -- belongs to the three siblings.
{
  const r = computeSelectCascadeMethod.shapeTest({ question: 'What is 12 * 7 + 5?', options: null });
  assert(r.matches === false, 'free-text question (options: null) is refused', JSON.stringify(r));
  assert(/lettered option/.test(r.reason), 'reason names the missing option pool', r.reason);
}

// TEST 2: a single-option input (not a real MCQ) is REFUSED.
{
  const r = computeSelectCascadeMethod.shapeTest({ question: 'What is 2 + 2?', options: { A: '4' } });
  assert(r.matches === false, 'a single-option input is refused (>=2 required)', JSON.stringify(r));
}

// TEST 3: a real MCQ with a numeric majority and enough question-side numeric literals MATCHES.
{
  const r = computeSelectCascadeMethod.shapeTest({
    question: 'A store sells 12 apples for $3 each. What is the total cost?',
    options: { A: '$30.00', B: '$36.00', C: '$40.00', D: '$42.00' },
  });
  assert(r.matches === true, 'a numeric-majority MCQ with 2+ question literals matches', JSON.stringify(r));
}

// TEST 4: an MCQ whose options are mostly NON-numeric (a text-classification shape) is REFUSED --
// this method must not try to numeric-select over a category-label option pool.
{
  const r = computeSelectCascadeMethod.shapeTest({
    question: 'Which of the following best describes photosynthesis?',
    options: {
      A: 'A process that converts light energy into chemical energy',
      B: 'A process that breaks down glucose for energy',
      C: 'A process that fixes nitrogen from the atmosphere',
      D: '42',
    },
  });
  assert(r.matches === false, 'a mostly non-numeric option pool is refused', JSON.stringify(r));
  assert(/majority/i.test(r.reason), 'reason names the majority-numeric requirement', r.reason);
}

// TEST 5: a numeric-option MCQ whose question itself carries fewer than 2 numeric literals is
// REFUSED (nothing for the model to plausibly combine).
{
  const r = computeSelectCascadeMethod.shapeTest({
    question: 'What is the boiling point of water at sea level, in Celsius?',
    options: { A: '90', B: '100', C: '110', D: '120' },
  });
  assert(r.matches === false, 'a question with <2 numeric literals is refused even with numeric options', JSON.stringify(r));
}

// ─── extractCandidateOptionValues() ────────────────────────────────────────────────────────────

// TEST 6: a bare numeric option is captured whole, even as a lone single digit.
{
  const v = extractCandidateOptionValues('5');
  assert(v.length === 1 && v[0] === 5, 'a bare lone-digit option is captured as the whole-option case', JSON.stringify(v));
}

// TEST 7: THE POINT OF THIS FILE'S OWN NEW LOGIC (per this method's header comment) -- a
// compound option with a leading list-numbering label does NOT let that label's bare digit
// pollute the candidate set as if it were a value, while the REAL dollar amounts are captured.
{
  const v = extractCandidateOptionValues('Policy 1: $52.00, Policy 2: $182.00');
  assert(!v.includes(1) , 'the "1" in "Policy 1:" (a list-numbering label) is NOT captured as a candidate value', JSON.stringify(v));
  assert(!v.includes(2), 'the "2" in "Policy 2:" (a list-numbering label) is NOT captured as a candidate value', JSON.stringify(v));
  assert(v.includes(52), 'the real $52.00 value IS captured', JSON.stringify(v));
  assert(v.includes(182), 'the real $182.00 value IS captured', JSON.stringify(v));
}

// TEST 8: a unit-suffixed value ("5 m/s") is captured via the adjacent-unit-letter rule.
{
  const v = extractCandidateOptionValues('5 m/s');
  assert(v.includes(5), 'a unit-suffixed value is captured', JSON.stringify(v));
}

// TEST 9: a currency option with commas and cents parses to the correct float.
{
  const v = extractCandidateOptionValues('$1,234.50');
  assert(v.length === 1 && Math.abs(v[0] - 1234.50) < 1e-9, 'comma-grouped currency parses correctly', JSON.stringify(v));
}

// ─── matchComputedValueToMcqOptions() -- THE SELECT STEP'S OWN HONESTY GATE ───────────────────

// TEST 10: exactly one qualifying option -> matched.
{
  const r = matchComputedValueToMcqOptions(36, { A: '$30.00', B: '$36.00', C: '$40.00', D: '$42.00' });
  assert(r.status === 'matched' && r.letter === 'B', 'exactly one option within tolerance is matched', JSON.stringify(r));
}

// TEST 11: zero qualifying options -> honest abstain, named 'zero_match', NEVER the nearest option.
{
  const r = matchComputedValueToMcqOptions(999, { A: '$30.00', B: '$36.00', C: '$40.00', D: '$42.00' });
  assert(r.status === 'zero_match', 'zero qualifying options is an honest zero_match, not the nearest option', JSON.stringify(r));
}

// TEST 12: two qualifying options (within tolerance of each other and the computed value) ->
// honest abstain, named 'ambiguous_match', carrying both letters, NEVER silently picking one.
{
  const r = matchComputedValueToMcqOptions(100, { A: '100', B: '100.5', C: '9000' });
  assert(r.status === 'ambiguous_match', 'two qualifying options is an honest ambiguous_match', JSON.stringify(r));
  if (r.status === 'ambiguous_match') {
    assert(r.letters.length === 2 && r.letters.includes('A') && r.letters.includes('B'), 'both qualifying letters are named', JSON.stringify(r.letters));
  }
}

// TEST 13: the tolerance is genuinely relative -- a value far outside 2% of a large option value
// does not qualify.
{
  const r = matchComputedValueToMcqOptions(1000, { A: '1030', B: '5000' });
  assert(r.status === 'zero_match', `1000 is outside 2% relative tolerance of 1030 (tolerance=${MCQ_MATCH_REL_TOLERANCE})`, JSON.stringify(r));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
