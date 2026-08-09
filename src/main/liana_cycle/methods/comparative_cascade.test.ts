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
const { toPerSqKm, evaluateComparativeTerminator, orderOfMagnitude, isAbstainCluesModeEnabled, buildAbstainCluesReport } = mod;

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

// ── 5. D-BP151-024/BISHOP/seg-value-convergence: evaluateComparativeTerminator() ───────────────
//
// SUPERSEDES the D-BP151-020/FIX-1-era tests below (that design gated a hard number on VOTE
// convergence -- Founder Ruling 2, BP151, corrects the underlying reading of his qid-98
// conclusion: "consistently across all questions" names his VALUE agreeing with itself, not an
// option winning a vote count). Three Founder rulings tested here, all BP151:
//   Ruling 1 (Q-13a): "yes remove it" -- sole-survivor auto-declare no longer exists.
//   Ruling 2: "Value convergence is undeniable, so that one ... only if value convergence is
//   non-existent, it trumps vote convergence every time."
//   Ruling 3 (the "agree" fork, answered same ticket): "Order of magnitude works as the basis" --
//   see detectValueConvergence()'s and orderOfMagnitude()'s own doc comments in
//   comparative_cascade.ts for the full citation and the verification against his own qid-98 data.

console.log('\ncomparative_cascade.test.ts -- D-BP151-024: evaluateComparativeTerminator()\n');

// 5a0. orderOfMagnitude() itself, direct: the exact numbers this ticket's own citations depend on,
// plus the 99/101 boundary the ticket asked to be identified explicitly.
{
  assert(orderOfMagnitude(22) === 1, 'orderOfMagnitude(22) is 10^1 (tens)', String(orderOfMagnitude(22)));
  assert(orderOfMagnitude(33) === 1, 'orderOfMagnitude(33) is 10^1 (tens) -- same as 22', String(orderOfMagnitude(33)));
  assert(orderOfMagnitude(175) === 2, 'orderOfMagnitude(175) is 10^2 (hundreds)', String(orderOfMagnitude(175)));
  assert(orderOfMagnitude(1192) === 3, 'orderOfMagnitude(1192) is 10^3 (thousands, Java\'s real qid-98 figure)', String(orderOfMagnitude(1192)));
  assert(orderOfMagnitude(100) === 2, 'orderOfMagnitude(100) is exactly 10^2, not 10^1 -- the floating-point epsilon guard holds at an exact power of ten', String(orderOfMagnitude(100)));
  assert(orderOfMagnitude(99) === 1, 'BOUNDARY: orderOfMagnitude(99) is 10^1', String(orderOfMagnitude(99)));
  assert(orderOfMagnitude(101) === 2, 'BOUNDARY: orderOfMagnitude(101) is 10^2 -- DIFFERENT from 99 even though only 2 apart (strict reading, not smoothed)', String(orderOfMagnitude(101)));
}

// 5a. (ticket item a) HIS REAL qid-98 CASE: A's value self-agrees across two framings (25, 25 --
// exact equality is a trivially passing case of "same order of magnitude") while the VOTES are
// split and would, by themselves, favor B (2 votes vs A's 1). Value convergence must OVERRIDE the
// vote signal -- exactly Ruling 2's "it trumps vote convergence every time".
{
  const pool = ['A', 'B'];
  const densities = { A: 25, B: 34 };
  const leastVotes = { A: 1, B: 2 }; // votes alone would pick B
  const densityObservations = { A: [25, 25], B: [34] }; // A self-agrees exactly; B has only 1 observation
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', densityObservations);
  assert(r.verdict === 'A', 'his real qid-98 exact-repeat (A: 25, 25) terminates on VALUE CONVERGENCE, overriding votes that favored B', JSON.stringify(r));
  assert(/value convergence/i.test(r.basis) && /Value convergence is undeniable/.test(r.basis), 'the verdict basis carries Founder Ruling 2\'s own words, not a vote-count claim', r.basis);
}

// 5a2. THE FORK, NOW ANSWERED: his own real 22-vs-33 spread (South America's own qid-98 figures,
// RECOVERED_BP144.md lines 76/210) -- previously reported UNDETERMINED under the exact-equality
// floor, now AGREES because 22 and 33 share order of magnitude 10^1. Votes are split (favor B,
// same shape as 5a) -- value convergence must still override.
{
  const pool = ['A', 'B'];
  const densities = { A: 22, B: 34 }; // both voted-least options covered, so the coverage precondition does not withhold branch 1
  const leastVotes = { A: 1, B: 2 };
  const densityObservations = { A: [22, 33], B: [34] }; // his own real spread for A
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', densityObservations);
  assert(r.verdict === 'A', 'his real 22-vs-33 spread now AGREES (both 10^1) and terminates on value convergence -- the fork is resolved', JSON.stringify(r));
  assert(/order of magnitude/i.test(r.basis) || r.notes.some((n) => /order of magnitude/i.test(n)), 'the receipt names order-of-magnitude as the agreement test that fired', JSON.stringify(r));
}

// 5a3. A GENUINE cross-magnitude disagreement (not the old undetermined-fork case -- an honest
// NO under the now-answered rule): 25 (10^1) vs 250 (10^2) for the same option must NOT agree.
// Falls through to the vote fallback since no value convergence exists.
{
  const pool = ['A', 'B'];
  const densities = { A: 25, B: 500 }; // both voted-least options covered, so the coverage precondition does not withhold branch 1
  const leastVotes = { B: 2, A: 0 };
  const densityObservations = { A: [25, 250] }; // same option, two orders of magnitude apart
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', densityObservations);
  assert(r.verdict === 'B', 'a genuine cross-magnitude spread (25 vs 250) does NOT self-agree -- falls through to the vote fallback (B)', JSON.stringify(r));
  assert(r.notes.some((n) => /NOT self-agreeing/.test(n)), 'the receipt records that A was evaluated and found not to self-agree, not silently skipped', JSON.stringify(r.notes));
}

// 5a4. THE BOUNDARY CASE, exercised inside the real terminator: 99 and 101 for the same option
// straddle the 10^2 power-of-ten boundary. Per the ticket's instruction, this is the STRICT
// reading (not smoothed) -- they do NOT agree, even though the numeric gap (2) is far smaller than
// 5a2's agreeing 22-vs-33 gap (11).
{
  const pool = ['A', 'B'];
  const densities = { A: 99 };
  const leastVotes: Record<string, number> = {};
  const densityObservations = { A: [99, 101] };
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', densityObservations);
  assert(r.verdict === null, 'the 99-vs-101 boundary case does NOT self-agree under the strict order-of-magnitude test, and nothing else fires -- ABSTAIN', JSON.stringify(r));
  assert(r.notes.some((n) => /NOT self-agreeing/.test(n) && /10\^1, 10\^2/.test(n)), 'the receipt shows the two different orders of magnitude (10^1, 10^2) explicitly, not just a bare rejection', JSON.stringify(r.notes));
}

// 5b. (ticket item b) NO VALUES AT ALL -- falls back to votes. Coverage precondition (ATTRIBUTED,
// D-BP151-013 FIX 3, unchanged) still withholds branch 1 when the voted-least option has no
// resolved value; branch 2 (votes) fires as the FALLBACK per Ruling 2's precedence.
{
  const pool = ['A', 'B'];
  const densities: Record<string, number> = {};
  const leastVotes = { A: 3, B: 0 };
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === 'A', 'with no values at all, the vote fallback fires', JSON.stringify(r));
  assert(/TARE/.test(r.basis), 'the vote rule itself is still labeled TARE (unattributed, pre-existing) even though the PRECEDENCE letting it fire is attributed', r.basis);
}

// 5c. (ticket item c) NEITHER FIRES -- no values, no votes -- ABSTAIN.
{
  const pool = ['A', 'B'];
  const densities: Record<string, number> = {};
  const leastVotes: Record<string, number> = {};
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === null, 'neither value convergence nor vote convergence exists -- ABSTAIN', JSON.stringify(r));
}

// 5d. (ticket item d) ELIMINATION LEAVING ONE OPTION NO LONGER AUTO-DECLARES IT -- Ruling 1
// (Q-13a: "yes remove it"). A sole survivor with NO value and NO vote data reaching either branch
// must ABSTAIN, not be auto-declared the answer.
{
  const pool = ['G'];
  const densities: Record<string, number> = {};
  const leastVotes: Record<string, number> = {};
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === null, 'sole survivor with no value/vote signal now ABSTAINS -- sole-survivor auto-declare is REMOVED (Ruling 1, Q-13a)', JSON.stringify(r));
  assert(r.notes.some((n) => /REMOVED/.test(n) && /Q-13a/.test(n)), 'the receipt names Ruling 1/Q-13a as the reason sole survivor did not auto-fire', JSON.stringify(r.notes));
}

// 5d2. Companion to 5d: a sole survivor is NOT forbidden from ever being the answer -- it must
// EARN the verdict from branch 2 (votes) like any other pool, not receive it merely for being
// alone. Distinguishes "sole survivor removed" from "sole survivor can never win".
{
  const pool = ['G'];
  const densities: Record<string, number> = {};
  const leastVotes = { G: 1 }; // G genuinely earns a vote-fallback verdict
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(r.verdict === 'G', 'a sole survivor that actually earns branch 2 (votes) still terminates -- removal only deleted the AUTOMATIC declare, not the option\'s ability to win on the merits', JSON.stringify(r));
  assert(/TARE/.test(r.basis), 'earned via the vote fallback (TARE), not the removed sole-survivor rule', r.basis);
}

// 5e. HIS REAL JAVA FIGURES (RECOVERED_BP144.md lines 98/220/233/245: "Exceeds 1,100", "~1,192",
// "1,192", "~1,160+"), all thousands, all order of magnitude 10^3 -- self-agrees, same as South
// America's own tens, at a completely different magnitude. Demonstrates the rule is not tuned to
// one option's scale.
{
  const pool = ['H'];
  const densities = { H: 1100 };
  const leastVotes: Record<string, number> = {};
  const densityObservations = { H: [1100, 1192, 1192, 1160] };
  const r = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', densityObservations);
  assert(r.verdict === 'H', 'Java\'s real qid-98 readings (1,100/1,192/1,192/1,160), all 10^3, self-agree independent of scale', JSON.stringify(r));
}

// ── 6. D-BP151-027/BISHOP/seg-abstain-clues: isAbstainCluesModeEnabled() + buildAbstainCluesReport() ──
//
// Contingency Operator, Founder's own design (FD-BP151-26). Pure-function tests only, same reason
// section 5's own header gives for not exercising run() directly: no live askGoogle reachable from
// this same-process test, and this ticket's own "DO NOT RUN THE PIPELINE" rule. Every fixture below
// re-derives its expected evaluateComparativeTerminator() outcome from the SAME rules section 5
// already tests (untouched by this ticket) so each case is provably a genuine abstain first, before
// asserting anything about the clues report built from it.

console.log('\ncomparative_cascade.test.ts -- D-BP151-027: Contingency Operator, abstain clues\n');

// 6a. OFF BY DEFAULT: undefined param, no env var set.
{
  delete process.env.COMPARATIVE_ABSTAIN_CLUES;
  assert(isAbstainCluesModeEnabled(undefined) === false, 'CO defaults OFF: undefined param, no env var');
  assert(isAbstainCluesModeEnabled(false) === false, 'CO stays OFF: explicit false param, no env var');
}

// 6b. env var escape hatch, same convention as isContingencyOperatorSurveySpliceEnabled()
// (D-BP151-026, liana_terminal_engine.ts) and isAdjudicationAlwaysModeEnabled() before it.
{
  process.env.COMPARATIVE_ABSTAIN_CLUES = '1';
  assert(isAbstainCluesModeEnabled(undefined) === true, 'CO turns ON via COMPARATIVE_ABSTAIN_CLUES=1 env var when the param is undefined');
  delete process.env.COMPARATIVE_ABSTAIN_CLUES;
  assert(isAbstainCluesModeEnabled(undefined) === false, 'CO returns OFF once the env var is unset again (no sticky state)');
}

// 6c. explicit param true turns it on regardless of env var.
{
  assert(isAbstainCluesModeEnabled(true) === true, 'CO turns ON via explicit true param');
}

// 6d. SIGNAL 1 (sole-survivor): the EXACT fixture as test 5d (a sole survivor, no value/vote
// signal, that ABSTAINS per Ruling 1/Q-13a).
{
  const pool = ['G'];
  const OPT = { G: 'Sahara Desert' };
  const densities: Record<string, number> = {};
  const leastVotes: Record<string, number> = {};
  const term = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  assert(term.verdict === null, 'sanity: the 5d fixture still abstains (untouched by this ticket)');
  const report = buildAbstainCluesReport(pool, OPT, densities, leastVotes, 'densely populated', {}, term.notes);
  assert(report.runnersUp.length === 1, 'sole-survivor fixture yields exactly one runner-up', JSON.stringify(report));
  assert(report.runnersUp[0].letter === 'G' && report.runnersUp[0].signal === 'sole-survivor', 'the one runner-up is G, labeled sole-survivor', JSON.stringify(report.runnersUp));
  assert(/^GUESS:/.test(report.runnersUp[0].guess), 'the runner-up is labeled a GUESS, verbatim per the Founder\'s own instruction', report.runnersUp[0].guess);
  assert(/Q-13a/.test(report.runnersUp[0].basis) && /yes remove it/.test(report.runnersUp[0].basis), 'the basis names Ruling 1/Q-13a, the sole-survivor removal, by name', report.runnersUp[0].basis);
}

// 6e. SIGNALS 2 + 3 on the same pool: a tied, non-majority vote (A=1, B=1 -- no strict majority,
// same shape as section 5's own tie handling) where B never resolves a value, so the coverage
// precondition withholds branch 1 for the WHOLE pool -- A and C's resolved values are both
// reported coverage-incomplete, and A/B are both reported vote-count.
{
  const pool = ['A', 'B', 'C'];
  const OPT = { A: 'South America', B: 'Western Europe', C: 'Java' };
  const densities = { A: 25, C: 1150 }; // B never resolves a value
  const leastVotes = { A: 1, B: 1 }; // tie -- no strict majority
  const densityObservations = { A: [25, 250], C: [1150, 1192] };
  const term = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', densityObservations);
  assert(term.verdict === null, 'tie vote (A=1,B=1) with B uncovered -- neither branch fires, genuine ABSTAIN', JSON.stringify(term));
  const report = buildAbstainCluesReport(pool, OPT, densities, leastVotes, 'densely populated', densityObservations, term.notes);
  const bySignal = (s: string) => report.runnersUp.filter((c) => c.signal === s);
  assert(bySignal('vote-count').length === 2, 'both A and B (tied, 1 vote each) are reported as vote-count clues', JSON.stringify(report.runnersUp));
  const covInc = bySignal('coverage-incomplete');
  assert(
    covInc.length === 2 && covInc.some((c) => c.letter === 'A') && covInc.some((c) => c.letter === 'C'),
    'A and C (both have resolved values, but branch 1 was withheld because B never resolved one) are BOTH reported coverage-incomplete',
    JSON.stringify(report.runnersUp),
  );
  assert(!bySignal('value-no-convergence').length, 'value-no-convergence does not fire when branch 1 was WITHHELD -- coverage-incomplete is the correct signal instead, never both for the same withheld run', JSON.stringify(report.runnersUp));
  for (const c of report.runnersUp) {
    assert(/^GUESS:/.test(c.guess), `runner-up ${c.letter}/${c.signal} is labeled a GUESS`, c.guess);
    assert(typeof c.basis === 'string' && c.basis.length > 0, `runner-up ${c.letter}/${c.signal} carries a non-empty basis`, JSON.stringify(c));
  }
}

// 6f. SIGNAL 4 (value-no-convergence): coverage IS complete (both options have a resolved value)
// and there are NO votes at all (so branch 2 cannot fire either), but neither option self-agrees
// across framings -- the LOWEST resolved value is named, per the Founder's own example wording
// ("its value was lowest but did not converge").
{
  const pool = ['A', 'B'];
  const OPT = { A: 'South America', B: 'Western Europe' };
  const densities = { A: 25, B: 500 };
  const leastVotes = { A: 0, B: 0 };
  const densityObservations = { A: [25, 250], B: [500, 5000] }; // BOTH span magnitudes -- neither self-agrees
  const term = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', densityObservations);
  assert(term.verdict === null, 'no votes, no self-agreement -- genuine ABSTAIN', JSON.stringify(term));
  const report = buildAbstainCluesReport(pool, OPT, densities, leastVotes, 'densely populated', densityObservations, term.notes);
  const vnc = report.runnersUp.filter((c) => c.signal === 'value-no-convergence');
  assert(vnc.length === 1 && vnc[0].letter === 'A', 'A (lowest resolved value, 25) is the value-no-convergence clue, not B (500)', JSON.stringify(report.runnersUp));
  assert(/Order of magnitude works as the basis/.test(vnc[0].basis), 'the basis cites the Founder\'s own order-of-magnitude ruling', vnc[0].basis);
}

// 6g. NO INVENTED RANKING: every clue object carries exactly the five documented fields (letter,
// optionText, signal, guess, basis) -- no score/rank/weight field anywhere, on a fixture that
// abstains via a genuine tie (both branches decline) so multiple signal types fire together.
{
  const pool = ['A', 'B'];
  const OPT = { A: 'South America', B: 'Western Europe' };
  const densities = { A: 25, B: 500 };
  const leastVotes = { A: 1, B: 1 }; // tie -- branch 2 finds no winner
  const term = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated', {});
  assert(term.verdict === null, 'tied votes, no observations -- genuine ABSTAIN', JSON.stringify(term));
  const report = buildAbstainCluesReport(pool, OPT, densities, leastVotes, 'densely populated', {}, term.notes);
  assert(report.runnersUp.length > 1, 'sanity: more than one clue fired on this fixture (vote-count x2 plus value-no-convergence)', JSON.stringify(report.runnersUp));
  for (const c of report.runnersUp) {
    const keys = Object.keys(c).sort();
    assert(JSON.stringify(keys) === JSON.stringify(['basis', 'guess', 'letter', 'optionText', 'signal']), `clue for ${c.letter}/${c.signal} carries exactly the five documented fields, no invented score/rank field`, JSON.stringify(keys));
  }
}

// 6h. whyAbstained is HARVESTED VERBATIM from the terminator's own notes, never synthesized: every
// string in it must already be present (by value) in term.notes.
{
  const pool = ['G'];
  const OPT = { G: 'Sahara Desert' };
  const densities: Record<string, number> = {};
  const leastVotes: Record<string, number> = {};
  const term = evaluateComparativeTerminator(pool, densities, leastVotes, 'densely populated');
  const report = buildAbstainCluesReport(pool, OPT, densities, leastVotes, 'densely populated', {}, term.notes);
  assert(report.whyAbstained.length > 0, 'whyAbstained is non-empty for a genuine abstain', JSON.stringify(report));
  assert(report.whyAbstained.every((n: string) => term.notes.includes(n)), 'every whyAbstained line is HARVESTED VERBATIM from term.notes, not synthesized', JSON.stringify(report.whyAbstained));
}

// 6i. OFF-IDENTITY PROOF: the exact conditional-spread expression run() uses (see
// comparative_cascade.ts run(), the ABSTAIN return statement) to attach the CO's extra fields onto
// the returned LianaTerminalOutcome, mirrored here verbatim -- run() itself cannot be exercised
// without a live askGoogle (this ticket's own "DO NOT RUN THE PIPELINE" rule). When OFF, the spread
// contributes ZERO keys: the returned object's shape is identical to every pre-BP151-027 abstain
// return, and verdict/abstain/basis are untouched either way.
{
  function buildOutcomeTail(abstainCluesOn: boolean, abstainClues: unknown) {
    const base = { qid: undefined, question: 'q', verdict: null, correct: undefined, abstain: true, freeText: true, basis: 'no terminator condition met' };
    return { ...base, ...(abstainCluesOn ? { variant: 'contingency-operator-abstain-clues' as const, abstainClues } : {}) };
  }
  const off = buildOutcomeTail(false, { runnersUp: [{ letter: 'X' }] });
  const on = buildOutcomeTail(true, { runnersUp: [{ letter: 'X' }] });
  assert(!('variant' in off) && !('abstainClues' in off), 'CO OFF: the outcome carries no variant/abstainClues keys at all -- byte-identical shape to every pre-existing abstain return', JSON.stringify(Object.keys(off)));
  assert('variant' in on && on.variant === 'contingency-operator-abstain-clues' && 'abstainClues' in on, 'CO ON: the outcome carries the variant tag and the report', JSON.stringify(Object.keys(on)));
  assert(off.verdict === null && off.abstain === true, 'CO OFF: verdict/abstain fields are untouched (null/true), same as always', JSON.stringify(off));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
