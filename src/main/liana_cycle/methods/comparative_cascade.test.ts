// comparative_cascade.test.ts -- D-BP151-013/BISHOP/seg-qid98-repair
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as rooting_rule.test.ts, plow_derived_quantity_reconciler.test.ts,
// crystal_store.test.ts, hex_terminal_telemetry.test.ts.
//
// SAME DEVIATION those files' own headers already document: comparative_cascade.ts has
// extensionless imports of sibling .ts modules (`from '../method_registry'`,
// `from '../register_gate_loader'`, `from '../../../shared/liana_cycle/liana_terminal_types'`).
// Node's native TypeScript type-stripping `require()` resolves those via strict ESM resolution,
// which does not probe the `.ts` extension. This test requires the COMPILED
// dist/main/liana_cycle/methods/comparative_cascade.js.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\methods\comparative_cascade.test.ts
//
// WHAT THIS TESTS: FIX 2 (D-BP151-013) -- toPerSqKm() must prove a candidate value carries a
// real area-RATE unit before it is trusted, and must return an honest null (never a passthrough)
// otherwise. Every literal string below is copied verbatim from the qid 98 receipt:
//   C:\Users\Administrator\Documents\LianaBanyanPlatform\HARDWIRE\LEDGER\LIANA_RUNS\
//     LIANA_RUN_qid98_2026-08-09T17-58-57-921Z.json
// and from the human-readable transcript the Founder read in full:
//   C:\Users\Administrator\Downloads\LianaCyleActualReasoningQid98.md (lines 269, 280, 210/212,
//   225).
//
// toPerSqKm() is a pure function (value, unit, context) -> {ok:true,...} | {ok:false, reason} --
// no network, no model, no Electron API touched. Only public/exported behavior is asserted here;
// this file does not reach into register_gate.mjs, the retry loop, or the coverage-precondition
// terminator logic (those need MethodRunContext/emit plumbing and a live askGoogle -- out of
// reach for a same-process pure-function test, and exercising them is what the Founder's own
// live run is for, per this ticket's "DO NOT RUN THE PIPELINE" rule).

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

const distPath = path.join(
  __dirname, '..', '..', '..', '..', 'dist', 'main', 'liana_cycle', 'methods', 'comparative_cascade.js',
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./comparative_cascade');
const { toPerSqKm, evaluateComparativeTerminator } = mod;

console.log('comparative_cascade.test.ts -- FIX 2 (D-BP151-013): toPerSqKm() unit-RATE proof\n');

// ── 1. THE EXACT TWO DEFECT VALUES FROM THE qid 98 RECEIPT -- must now be REJECTED ──────────
//
// Receipt (LIANA_RUN_qid98_...json line 501 / transcript line 269): Europe's figure came from
// the Statista block title "European Union - population density from 2012 to 2022". Gemma's own
// unit field was "to 2022" -- itself not a unit -- and the OLD code used the value anyway.
{
  const r = toPerSqKm(2012, 'to 2022', 'European Union - population density from 2012 to 2022');
  assert(r.ok === false, 'Europe/2012 (unit "to 2022", the exact qid 98 defect) is REJECTED, not passed through');
  if (!r.ok) assert(/calendar-year|no recognized area-RATE/i.test(r.reason), 'rejection reason names the calendar-year or missing-unit cause', r.reason);
}

// Receipt (line 517 / transcript line 280): Central Asia's figure came from the Unicef block
// title "Generation 2050 in Central Asia". Gemma's own unit field was literally "none".
{
  const r = toPerSqKm(2050, 'none', 'Generation 2050 in Central Asia');
  assert(r.ok === false, 'Central Asia/2050 (unit "none", the exact qid 98 defect) is REJECTED, not passed through');
}

// ── 2. REAL DENSITY STRINGS FROM THE SAME RUN -- must still be ACCEPTED ─────────────────────
//
// South America (transcript line 225): "52.9 persons per square kilometer" -- the value the
// terminator actually used as the (wrongly sole) low anchor. Must keep working after FIX 2.
{
  const r = toPerSqKm(52.9, 'persons per square kilometer', 'Ecuador is the most densely populated country of South America, with a population density of 52.9 persons per square kilometer.');
  assert(r.ok === true, 'South America/52.9 "persons per square kilometer" is ACCEPTED');
  if (r.ok) assert(Math.abs(r.value - 52.9) < 1e-9, 'South America/52.9 value is unconverted (already per km2)', String(r.value));
}

// Europe's OWN real value from stage 5 (Q10) -- transcript line 210/212: "72 people per square
// kilometer" from the bulk sort-by-density pass. This is the value FIX 2's own overwrite-guard
// (see comparative_cascade.ts's stage-5b call site) must let survive once the 2012 candidate
// above is correctly rejected instead of overwriting it.
{
  const r = toPerSqKm(72, undefined, 'Europe: 72 people per square kilometer');
  assert(r.ok === true, 'Europe/72 "people per square kilometer" (context-only unit, no unit field) is ACCEPTED');
}

// South Asia's real figure the receipt shows the extractor found but never attributed --
// included here only to prove toPerSqKm() itself has no problem with it (the miss is upstream,
// in attribution -- see this ticket's write-up, NOT fixed here per the explicit instruction not
// to loosen attribution).
{
  const r = toPerSqKm(329, 'per Km\u00b2', 'The population density in Southern Asia is 329 per Km\u00b2 (852 people per mi\u00b2).');
  assert(r.ok === true, 'South Asia/329 "per Km\u00b2" (superscript, capitalized) is ACCEPTED -- proves the superscript fold works');
}

// Sahara Desert's real figure -- "10 people per square kilometer" -- same note as South Asia
// above: toPerSqKm() accepts it; the run-time miss is attribution (the box snippet never says
// "Sahara"), not this function.
{
  const r = toPerSqKm(10, undefined, 'Population density increases as aridity decreases. It ranges from 10 people per square kilometer in the deserts to 71 people in the dry sub-humid (rangelands) areas.');
  assert(r.ok === true, 'Sahara Desert/10 "people per square kilometer" is ACCEPTED');
}

// ── 3. THE "km 2" SPACE FORM AND A BARE-AREA (NOT A RATE) FIGURE ────────────────────────────
//
// Northeast United States, transcript line 251: "320 people per square mile (120 people/km 2)"
// -- the space-separated superscript-as-space convention some sources use. Must be recognized as
// a rate now that the regex tolerates an optional space before the trailing digit.
{
  const r = toPerSqKm(120, undefined, 'It is also the most densely populated region in the United States, with 320 people per square mile (120 people/km 2).');
  assert(r.ok === true, 'Northeast US/120 "people/km 2" (space before the digit) is ACCEPTED');
}

// The SAME passage's total-area figure -- "469,630 km 2" -- carries the identical "km 2" suffix
// but is an AREA, not a RATE (no "per"/"each"/"/" anywhere near it). FIX 2's rate-marker
// requirement must reject this even though the bare unit characters match a density's.
{
  const r = toPerSqKm(469630, 'km 2', 'The U.S. Census Bureau defines the Northeast United States as having a total area of 181,324 mi 2 (469,630 km 2), making it the smallest region of the United States by total area.');
  assert(r.ok === false, 'Northeast US/469630 "km 2" (a bare AREA, no rate marker) is REJECTED, not accepted as a density');
}

// ── 4. MAGNITUDE ALONE IS NEVER A REJECTION REASON WHEN A REAL UNIT IS PRESENT ──────────────
//
// A contrived but legitimate density figure inside the 1000-2100 "plausible calendar year"
// range, WITH a real rate unit -- must be accepted. The unit decides, never the magnitude alone.
{
  const r = toPerSqKm(2050, 'people per square kilometer', 'A contrived very dense city-state has 2050 people per square kilometer.');
  assert(r.ok === true, 'A genuinely unit-carrying value (2050 "people per square kilometer") in the calendar-year numeric range is still ACCEPTED -- magnitude alone never rejects');
}

// A bare integer outside the calendar-year range, with no unit at all, must still be rejected
// (via the general no-recognized-unit branch, not the calendar-year branch) -- sanity check that
// the two rejection paths both terminate at ok:false.
{
  const r = toPerSqKm(9999, undefined, 'some passage with no unit at all mentioning 9999');
  assert(r.ok === false, 'A bare integer with no unit, outside the calendar-year range, is still REJECTED (general no-unit path)');
}

// ── 5. FIX 1 (D-BP151-020/BISHOP/seg-98-three-fixes): evaluateComparativeTerminator() ──────────
//
// This is the pure-function extraction of the terminator (no behavior change from the inline
// version it replaces -- see the function's own doc comment in comparative_cascade.ts). Tests the
// REMOVAL of the unattributed 1.5x separation gate and its replacement with the Founder's own
// terminator: the hard-number lowest option must ALSO be the cross-framing convergence winner
// (leastVotes), reusing the pre-existing convergence branch's own strict-majority rule (a
// pre-existing, unfixed TARE -- not loosened or tightened by this test).

console.log('\ncomparative_cascade.test.ts -- FIX 1 (D-BP151-020): evaluateComparativeTerminator()\n');

// 5a. THE FOUNDER'S OWN 25-vs-34 CASE. His qid-98 hand-worked figures: South America 25, Europe
// 34 -- a 1.36x separation. The OLD >=1.5x gate would have withheld this verdict (1.36 < 1.5).
// With the gate removed, the hard-number branch must now fire on convergence: A (South America)
// is both the lowest hard number AND the option leastVotes already converged on across the other
// framings (stages 1/3/4), exactly as his qid-98 walkthrough converged on A "across all
// questions" before he ever cited the density figure.
{
  const pool = ['A', 'B'];
  const densities = { A: 25, B: 34 };
  const leastVotes = { A: 3, B: 0 }; // A converged as least-property across 3 other framings
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === 'A', 'Founder\'s 25-vs-34 case (1.36x, below the old 1.5x gate) now TERMINATES on convergence', JSON.stringify(r));
  assert(/consistently across all questions/.test(r.basis), 'the verdict basis carries the Founder\'s own attribution, not a magnitude claim', r.basis);
}

// 5b. A case that WOULD have fired the old 1.5x gate (huge separation) but does NOT converge --
// the hard-number lowest option (A) is not what the other framings converged on (B). Must NOT
// fire the hard-number branch on magnitude alone; falls through to the pre-existing
// convergence-only fallback, which itself finds B (matching the actual cross-framing signal).
{
  const pool = ['A', 'B'];
  const densities = { A: 5, B: 500 }; // 100x separation -- would have blasted through the old 1.5x gate
  const leastVotes = { B: 4, A: 0 }; // every other framing converged on B, not A
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === 'B', 'a huge hard-number separation (100x) does NOT override a genuine cross-framing convergence on a different option', JSON.stringify(r));
  assert(/TARE/.test(r.basis), 'a verdict reached via the pre-existing convergence-only fallback is labeled TARE in its basis, not silently presented as attributed', r.basis);
}

// 5c. GENUINELY NON-CONVERGENT: hard numbers are covered and clean, but the cross-framing votes
// are tied (no majority winner under the pre-existing, unfixed strict-majority rule) -- must
// ABSTAIN (no verdict from ANY branch: not hard-number, not convergence-fallback, not sole
// survivor, since two options remain in the pool).
{
  const pool = ['A', 'B'];
  const densities = { A: 10, B: 20 };
  const leastVotes = { A: 1, B: 1 }; // tie -- no strict-majority winner
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === null, 'a genuine non-convergence (tied votes, no majority winner) ABSTAINS rather than guessing from the hard number alone', JSON.stringify(r));
}

// 5d. The coverage precondition (ATTRIBUTED, D-BP151-013 FIX 3, tare-sweep row #12) must still
// withhold the HARD-NUMBER branch specifically when an option voted least-property by stages 3/4
// is missing a resolved value -- unchanged by FIX 1's extraction. The pool here has only two
// options (A, B), so with the hard-number branch withheld, the pre-existing convergence-only
// fallback (branch 2, unaffected by the coverage precondition -- it never looks at densities at
// all) correctly still produces its own verdict from leastVotes alone; that branch's own
// pre-existing behavior is what row 5b above already covers, so this case only asserts that the
// hard-number branch itself was withheld, not that the whole terminator abstains.
{
  const pool = ['A', 'B'];
  const densities = { A: 25 }; // B is voted least but has NO resolved value
  const leastVotes = { B: 2, A: 1 };
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.notes.some((n) => /WITHHELD/.test(n)), 'coverage precondition (FIX 3, D-BP151-013) still emits WITHHELD for the hard-number branch when a voted-least option has no value -- unchanged by FIX 1', JSON.stringify(r.notes));
  assert(!/ATTRIBUTED/.test(r.basis), 'the eventual verdict (from the unaffected convergence-only fallback) is NOT mislabeled as the ATTRIBUTED hard-number rule', r.basis);
}

// 5e. SOLE SURVIVOR (pre-existing, unattributed TARE, tare-sweep row #11) must still fire when
// exactly one option remains in the pool and neither of the first two branches produced a verdict
// -- unchanged by FIX 1's extraction.
{
  const pool = ['G'];
  const densities: Record<string, number> = {};
  const leastVotes: Record<string, number> = {};
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === 'G', 'sole-survivor fallback (pre-existing TARE, tare-sweep row #11) still fires -- unchanged by FIX 1', JSON.stringify(r));
  assert(/TARE/.test(r.basis), 'sole-survivor basis is labeled TARE, not silently presented as attributed', r.basis);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
