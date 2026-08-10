// liana_terminal_engine.sc01_crash_safety.test.ts -- D-BP152-016/BISHOP/seg-sc01-wire-and-score
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as liana_terminal_engine.contingency_operator.test.ts (copied
// verbatim): requires the COMPILED dist/main/liana_cycle/*.js, same extensionless-import
// deviation, same "run after npm run build:main" instruction.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\liana_terminal_engine.sc01_crash_safety.test.ts
//
// WHAT THIS TESTS, per D-BP152-016's own VERIFY section ("assert by source-level test that a run
// whose scoring throws still completes and still writes its receipt" -- the receipt-write half of
// that sentence lives in index.ts's IPC handler, outside this engine module's own scope, and is
// unconditional on outcome.sc01/outcome.sc01ScoringError either being present -- see index.ts's
// 'liana-terminal-run' handler, which writes the JSON receipt in the SAME try block regardless of
// which of those two fields is set. This test covers the half that IS inside this module: a
// throwing scoreSc01PivotTerms() must not throw OUT of runLianaCycleQuestion(), must not change
// the run's own verdict/abstain/error, and must leave a plain, honest trace in the transcript):
//
//   1. scoreSc01PivotTerms() monkey-patched to throw a known Error BEFORE
//      liana_terminal_engine.js is required (same spy/patch technique the contingency-operator
//      test already uses on demand_test.js/survey_stage.js -- patching the property on the
//      module's own exports object, which liana_terminal_engine.js reads at CALL time, not at
//      import time).
//   2. runLianaCycleQuestion(..., contingencyOperatorSurvey: true) on a Survey-Splice-eligible
//      input resolves (does not reject/throw) despite the patched scorer throwing on every call.
//   3. The returned outcome carries `sc01ScoringError` (the thrown message, verbatim) and carries
//      NO `sc01` key -- mutually exclusive, per liana_terminal_types.ts's own doc comment.
//   4. The transcript contains exactly one 'note' event matching "SC-01 SCORING ERRORED", proving
//      the failure is disclosed, not swallowed silently.
//   5. REGRESSION, same input, SAME variant flag, scorer NOT patched (restored): the run reaches
//      the identical demand/error outcome as the patched run -- proving the patched scorer's throw
//      changed NOTHING about the run's own verdict/abstain/error/demand path, only whether `sc01`
//      or `sc01ScoringError` is present.

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

type TerminalEvent = { kind: string; text: string; ts: string };

const liDir = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'liana_cycle');

// ── PATCH, BEFORE liana_terminal_engine.js IS REQUIRED ──────────────────────────────────────────
const sc01Mod = require(path.join(liDir, 'sc01_pivot_terms_scorer.js'));
const originalScoreSc01PivotTerms = sc01Mod.scoreSc01PivotTerms;
const THROWN_MESSAGE = 'D-BP152-016 TEST: deliberate scorer failure, must not abort the run';
let patchedCallCount = 0;
sc01Mod.scoreSc01PivotTerms = (...args: unknown[]) => {
  patchedCallCount += 1;
  throw new Error(THROWN_MESSAGE);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineMod = require(path.join(liDir, 'liana_terminal_engine.js')) as typeof import('./liana_terminal_engine');
const { runLianaCycleQuestion } = engineMod;

const fakeAskGoogle = async (_q: string) => null;

console.log('liana_terminal_engine.sc01_crash_safety.test.ts -- D-BP152-016\n');

// A free-text question with no quoted/cued term and no lettered options -- reaches SURVEY STEP 2's
// no-term/ambiguity path (askText present, so askAmbiguity() is attempted) with zero real network
// dependency (fakeAskGoogle returns null, which googleBlocks() reports as an honest unreachable
// result -- the SAME shape every other test in this suite already relies on), then proceeds to
// SURVEY STEP 3/4/6 and finally "no method matches" -- reaching runSurveyStage()'s return and this
// engine's own scoring call point on every single run, patched or not.
const input = 'A plain declarative sentence with nothing quoted and no defines-cue in it at all.';

// ── 1-4. PATCHED: the scorer throws on every call ───────────────────────────────────────────────
const eventsPatched: TerminalEvent[] = [];
const before = patchedCallCount;
let threw = false;
let outcomePatched: Awaited<ReturnType<typeof runLianaCycleQuestion>> | null = null;
try {
  outcomePatched = await runLianaCycleQuestion(
    input,
    fakeAskGoogle,
    (e: TerminalEvent) => eventsPatched.push(e),
    null,
    null,
    true, // contingencyOperatorSurvey: ON -- SC-01 has nothing to score otherwise
  );
} catch {
  threw = true;
}
const after = patchedCallCount;

assert(!threw, 'PATCHED: runLianaCycleQuestion() did NOT throw/reject even though the scorer threw on every call');
assert(after > before, 'PATCHED: the patched scoreSc01PivotTerms() WAS actually called at least once (sanity -- proves this test exercises the real call site, not a no-op)');
assert(!!outcomePatched, 'PATCHED: an outcome object was still returned');
assert(outcomePatched?.sc01 === undefined, 'PATCHED: outcome carries NO `sc01` key (a thrown scoring attempt produces no result to report)');
assert(outcomePatched?.sc01ScoringError === THROWN_MESSAGE, 'PATCHED: outcome.sc01ScoringError carries the thrown message verbatim', outcomePatched?.sc01ScoringError);
const erroredNotes = eventsPatched.filter((e) => e.kind === 'note' && e.text.includes('SC-01 SCORING ERRORED'));
assert(erroredNotes.length === 1, 'PATCHED: the transcript contains exactly one "SC-01 SCORING ERRORED" note -- the failure is disclosed, not swallowed silently', `found ${erroredNotes.length}`);
assert(!!erroredNotes[0] && erroredNotes[0].text.includes(THROWN_MESSAGE), 'PATCHED: that note carries the real thrown message, not a generic placeholder');
assert(typeof outcomePatched?.abstain === 'boolean', 'PATCHED: outcome.abstain is still a normal boolean -- the run reached its own honest conclusion despite the scoring failure');

// ── 5. REGRESSION: restore the real scorer, same input, same variant -- identical run outcome ───
sc01Mod.scoreSc01PivotTerms = originalScoreSc01PivotTerms;
const eventsReal: TerminalEvent[] = [];
const outcomeReal = await runLianaCycleQuestion(input, fakeAskGoogle, (e: TerminalEvent) => eventsReal.push(e), null, null, true);

assert(outcomeReal.abstain === outcomePatched?.abstain, 'REGRESSION: abstain is IDENTICAL whether the scorer threw or ran for real');
assert(outcomeReal.error === outcomePatched?.error, 'REGRESSION: error code is IDENTICAL whether the scorer threw or ran for real', `real=${outcomeReal.error} patched=${outcomePatched?.error}`);
assert(outcomeReal.verdict === outcomePatched?.verdict, 'REGRESSION: verdict is IDENTICAL (both null on this no-method-matches input) whether the scorer threw or ran for real');
// The real (unpatched) scorer ran against the SAME no-term/ambiguity-unusable path fakeAskGoogle
// produces -- it legitimately finds ZERO named terms (Google unreachable via the fake), so `sc01`
// is present with strictCount 0, never `sc01ScoringError`. This is the honest-empty-result shape,
// not a second failure.
assert(outcomeReal.sc01ScoringError === undefined, 'REGRESSION: the real scorer does NOT error on this input (an honest empty ambiguity result, not a scoring failure)');
assert(outcomeReal.sc01 !== undefined, 'REGRESSION: the real scorer DID produce an sc01 result this time (proves the patch, not some other gate, was what suppressed it above)');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}

})().catch((e) => {
  console.error('UNCAUGHT:', e);
  process.exitCode = 1;
});
