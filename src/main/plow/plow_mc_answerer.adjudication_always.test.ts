// plow_mc_answerer.adjudication_always.test.ts -- D-BP151-017/BISHOP/seg-adjudication-always
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as rooting_rule.test.ts, plow_derived_quantity_reconciler.test.ts,
// crystal_store.test.ts, hex_terminal_telemetry.test.ts, comparative_cascade.test.ts.
//
// This test requires the COMPILED dist/main/plow/plow_mc_answerer.js.
// Run (after `npx tsc -p tsconfig.main.json`):
//   node src\main\plow\plow_mc_answerer.adjudication_always.test.ts
//
// WHAT THIS TESTS: the Founder's BP148 ruling ("Adjudication needs to run on every answer... I
// never said stop when sources agree") as implemented by HARDWIRE-BP148-046 (commits 13b151de,
// restored at 93ca3bb1 after an accidental revert -- both already ancestors of HEAD at the time
// this test was written; this SEG (D-BP151-017) made NO production-code change, only verified).
//
// This file does not re-derive a new test of the accept-on-agreement call site (that needs a full
// AuthorityEnsembleOutcome/swarm/config plumbing this same-process pure-function test cannot
// reach). It instead calls runCandidateSourceCascadeAdjudicator directly -- the SAME exported
// function the accept-on-agreement branch at plow_mc_answerer.ts:4685 calls (identical call,
// `runCandidateSourceCascadeAdjudicator(candidates)`, over the FULL pool) when
// isAdjudicationAlwaysModeEnabled() is true, which it is by default (undefined-or-true-means-on,
// plow_mc_answerer.ts:6205-6210) -- and asserts it does NOT blindly return the 3-way-agreed
// letter G on the real qid 98 pool.

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

const distPath = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'plow', 'plow_mc_answerer.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./plow_mc_answerer');
const { runCandidateSourceCascadeAdjudicator } = mod;

console.log('plow_mc_answerer.adjudication_always.test.ts -- HARDWIRE-BP148-046 verification\n');

// ── THE REAL qid-98 CANDIDATE POOL, VERBATIM FROM THE BP148 RECORD ─────────────────────────────
// [perplexity:G, chatgpt:I, claude:G, swarm:G] -- three-way agreement on G, ChatGPT dissents I.
// The Crown's own candidate (correct answer A) never survived into this pool at all (a separate,
// already-documented defect upstream of this function -- not this test's concern). This test's
// only job: prove the shipping adjudicator, called over the FULL pool exactly as the
// adjudication-always call site calls it, does not treat 3-of-4 agreement as identity.
const qid98Pool = [
  { authority: 'user_perplexity' as const, letter: 'G', reasoning: 'perplexity said G', sourceUrl: '', method: 'test_fixture' },
  { authority: 'user_chatgpt' as const, letter: 'I', reasoning: 'chatgpt said I', sourceUrl: '', method: 'test_fixture' },
  { authority: 'user_claude' as const, letter: 'G', reasoning: 'claude said G', sourceUrl: '', method: 'test_fixture' },
  { authority: 'specialist_swarm' as const, letter: 'G', reasoning: 'swarm said G', sourceUrl: '', method: 'test_fixture' },
];

const result = runCandidateSourceCascadeAdjudicator(qid98Pool);

console.log(`  chosenLetter: ${result.chosenLetter ?? 'ABSTAIN (null)'}`);
console.log(`  eliminationLog:\n    ${result.eliminationLog.join('\n    ')}`);

// 1. Adjudication must actually be INVOKED and return real machinery output (an elimination log),
//    not a stub -- this is the "adjudicationAttempted:true" contract's own evidence.
assert(Array.isArray(result.eliminationLog) && result.eliminationLog.length > 0,
  'adjudicator was invoked and produced a real elimination log (adjudicationAttempted evidence)');

// 2. THE central claim under test: this must NOT be a blind accept of the 3-way-agreed letter G.
//    Per the BP148 record, the unmodified shipping adjudicator ABSTAINs here (G and I both
//    survive Rule 5) -- so chosenLetter must be null, and it must specifically not be 'G' reached
//    by simple majority-vote logic.
assert(result.chosenLetter !== 'G',
  'adjudicator does NOT blindly return the 3-way-agreed letter G', `got ${result.chosenLetter}`);
assert(result.chosenLetter === null,
  'adjudicator ABSTAINs on the real qid 98 pool (G and I both survive) -- matches the BP148 record',
  `got ${result.chosenLetter}`);

// 3. ChatGPT's dissenting vote must be visible in the trace -- proof the pool fed in was the FULL
//    4-candidate pool (not just the agreeing group of 3), which is the entire point of
//    HARDWIRE-BP148-046 (the old code only ever looked at agreeingGroup, never the dissenter).
assert(result.eliminationLog.some((line) => /user_chatgpt/i.test(line)) ||
  result.survivingCandidates.some((c) => c.authority === 'user_chatgpt'),
  'ChatGPT:I (the dissenter) is visible in the adjudication trace or survivors, not silently dropped');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
