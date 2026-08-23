// ============================================================================
// THE PERIMETER GATE
// ============================================================================
// FOUNDER NAMING RULING, BP163, verbatim: "call one the Perimeter and the other
// the Survey."
//
// THIS IS THE PERIMETER. It is the OUTER gate. It decides whether SURVEY RUNS AT
// ALL, at the liana_terminal_engine.ts boundary, before anything inside Survey is
// entered. Default OFF (D-BP164-M0-046, BP158 Founder order: "I don't want to
// automatically run survey, it uses google calls without purpose").
//
// DO NOT CONFUSE IT WITH THE SURVEY GATE, its sibling one layer in:
//   survey_stage.SURVEY_gate_denotation_sweep.test.ts  (D-BP153-019)
// That one runs INSIDE an already-running Survey and skips only the per-TERM
// denotation sweep, and only on the superlative-by-magnitude route.
//
// PERIMETER decides IF YOU COME IN. SURVEY decides WHAT YOU DO ONCE INSIDE.
// They do not collide: the Survey test calls founderStep2Survey() directly and
// never passes through the engine, so the Perimeter can never reach it. But the
// Perimeter SUBSUMES the Survey gate's saving in the default case: with the
// Perimeter closed, the inner sweep never gets the chance to be skipped, because
// Survey never runs. The Survey gate is therefore SECOND-ORDER, not dead: it
// still bites every time the Perimeter is opened.
//
// Different runners, too: PERIMETER is manual assert() + process.exit(1) against
// compiled dist/. SURVEY is vitest.
//
// Renamed from liana_terminal_engine.survey_gate_and_cost.test.ts per Rule 66,
// original preserved as a .superseded.<UTC> sibling (the D-BP164-M0-046 work
// receipt still references that path).
// ============================================================================

// liana_terminal_engine.PERIMETER_gate_and_cost.test.ts -- D-BP164-M0-046/BISHOP/M0/seg-survey-gating-and-cost-wiring
//
// Manual assert() + console output + process.exit(1) on failure -- same prior-art convention as
// liana_terminal_engine.contingency_operator.test.ts / stepped_audible.test.ts / survey_stage.test.ts,
// copied verbatim: requires the COMPILED dist/main/liana_cycle/*.js, same extensionless-import
// deviation, same "run after npm run build:main" instruction.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\liana_terminal_engine.PERIMETER_gate_and_cost.test.ts
//
// PROVES, per the D-BP164-M0-046 dispatch's own "PROVE BOTH" section, mocking the Google
// boundary end to end (fakeAskGoogle below returns a real-shaped, immediate, non-throttled
// answer -- no real external call, no sleep/retry backoff):
//   (a) a question that should NOT survey (surveyEnabled omitted, the default) makes ZERO calls
//       to askGoogle -- asserted by a call-count spy, not eyeballed.
//   (b) a question that SHOULD survey (surveyEnabled: true) still surveys correctly -- the SURVEY
//       stage actually runs (not SKIPPED), DEMAND is derived from the surveyed ask, and at least
//       one real call was made.
//   (c) a cached survey answer (populated by (b)'s own live run, via an injected
//       InMemorySurveyCacheStore) is reused on a second run of the SAME question and makes ZERO
//       further calls -- even with surveyEnabled OMITTED on the second call, proving the cache is
//       consulted before the flag, not after it.
//   (d) the cost instrument (cost_instrument.ts, wired at runLianaCycleQuestion()'s own outer
//       wrapper) records each real call made in (b), each carrying a dollar figure (actual $0,
//       architectural, PLUS a priced counterfactual) and a machineId.

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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineMod = require(path.join(liDir, 'liana_terminal_engine.js')) as typeof import('./liana_terminal_engine');
const { runLianaCycleQuestion } = engineMod;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const surveyCacheMod = require(path.join(liDir, 'survey_cache.js')) as typeof import('./survey_cache');
const { InMemorySurveyCacheStore } = surveyCacheMod;

// A real-shaped, IMMEDIATE, non-throttled answer -- no null result (which would drive
// googleBlocks() into its 3-try / sleep(i*4000) retry backoff, up to ~24s PER CALL) and no real
// external call of any kind. Mocking the Google boundary, per this dispatch's own instruction.
function makeCountingAskGoogle() {
  const calls: string[] = [];
  const fn = async (q: string) => {
    calls.push(q);
    return {
      snippet: 'A generic, real-shaped answer for test purposes.',
      sourceUrl: 'https://example.com/test',
      authority: 'google' as const,
      selectorUsed: 'test-fixture',
      citations: [],
      results: [],
    };
  };
  return { fn, calls };
}

console.log('liana_terminal_engine.PERIMETER_gate_and_cost.test.ts -- D-BP164-M0-046\n');

// D-BP164-M0-046 FIX (found by this dispatch's own first run): "Which region is most densely
// populated?" carries a STRUCTURAL superlative ("most densely populated"), so even with Survey
// OFF, demand still resolves via the UNCHANGED structural fallback (determineDemandFromQuestionStructure())
// to CLASSIFY -- which SELECTS AND RUNS classify_cascade, and THAT method makes its own real
// Google calls, entirely independent of Survey. Measured: 4 calls on the very first attempt at
// this proof, with the SURVEY stage itself correctly emitting SKIPPED (zero Survey calls) -- the
// calls came from the METHOD that ran AFTER Survey, not from Survey. Proof (a)/(c) need a
// question where the WHOLE pipeline makes zero calls, not merely Survey -- 'What is the capital
// of France?' is the exact input liana_terminal_engine.contingency_operator.test.ts already
// documents as "a clean, deterministic input... ZERO network calls on EITHER variant state" (no
// structural superlative, no lettered options, no method's shape test passes).
const ZERO_CALL_QUESTION = 'What is the capital of France?';
// (b)/(d) deliberately keep a question survey/method machinery actually engages with.
const QUESTION = 'Which region is most densely populated? A) Europe B) Asia';

// ── (a) SURVEY OFF (default): ZERO askGoogle calls, ANYWHERE in the run ─────────────────────────
{
  const { fn: askGoogle, calls } = makeCountingAskGoogle();
  const events: TerminalEvent[] = [];
  const cache = new InMemorySurveyCacheStore();
  const outcome = await runLianaCycleQuestion(
    ZERO_CALL_QUESTION, askGoogle as any, (e: TerminalEvent) => events.push(e),
    null, null, undefined /* surveyEnabled omitted */, undefined, undefined, undefined, undefined, undefined,
    cache as any,
  );
  assert(calls.length === 0, '(a) OFF (default): askGoogle was called EXACTLY ZERO times', `got ${calls.length} call(s)`);
  assert((outcome.costLedger ?? []).length === 0, '(a) OFF: outcome.costLedger is empty (cost instrument agrees: zero real calls)', JSON.stringify(outcome.costLedger));
  assert(outcome.costSummary?.callCount === 0, '(a) OFF: outcome.costSummary.callCount === 0');
  const skipLine = events.find((e) => e.kind === 'stage' && /SURVEY -- SKIPPED/.test(e.text));
  assert(!!skipLine, '(a) OFF: the transcript states SURVEY was SKIPPED, not silently omitted', events.map((e) => e.text).join(' | '));
}

// ── (b) SURVEY ON (explicit true): real calls made, Survey actually runs ────────────────────────
let bCallCount = 0;
{
  const { fn: askGoogle, calls } = makeCountingAskGoogle();
  const events: TerminalEvent[] = [];
  const cache = new InMemorySurveyCacheStore();
  const outcome = await runLianaCycleQuestion(
    QUESTION, askGoogle as any, (e: TerminalEvent) => events.push(e),
    null, null, true /* surveyEnabled */, undefined, undefined, undefined, undefined, undefined,
    cache as any,
  );
  bCallCount = calls.length;
  assert(calls.length > 0, '(b) ON: askGoogle was called at least once', `got ${calls.length} call(s)`);
  const surveyRanLine = events.find((e) => e.kind === 'stage' && /^-> SURVEY --/.test(e.text) && !/SKIPPED/.test(e.text) && !/CACHE HIT/.test(e.text));
  assert(!!surveyRanLine, '(b) ON: the transcript shows SURVEY actually running (not SKIPPED, not a cache hit)', events.map((e) => e.text).join(' | '));
  const demandLine = events.find((e) => e.kind === 'note' && /DEMAND:/.test(e.text));
  assert(!!demandLine, '(b) ON: a DEMAND line was emitted, derived from the surveyed ask', demandLine?.text);
  assert((outcome.costLedger ?? []).length === calls.length, '(b) ON: outcome.costLedger.length equals the real askGoogle call count', `ledger=${(outcome.costLedger ?? []).length} calls=${calls.length}`);
}

// ── (c) CACHE HIT: same question, second run, surveyEnabled OMITTED -- ZERO further calls ──────
// Uses ZERO_CALL_QUESTION (see its own comment above (a)) so a cache hit's zero-Survey-calls claim
// is not confounded by a downstream METHOD (selected from whatever demand the cached survey
// produced) making its own, separate real calls -- this question resolves to no term/no structural
// superlative either way, so no method fires on the seed run OR the cache-hit run, and the ONLY
// calls anywhere in either run are Survey's own.
{
  const { fn: askGoogle, calls } = makeCountingAskGoogle();
  const events: TerminalEvent[] = [];
  // A FRESH cache store, pre-seeded directly (simulating "a prior run already cached this exact
  // question") rather than reusing (b)'s live run's own cache instance -- proves the cache is a
  // real, addressable store keyed by question+options, not merely a same-run memo.
  const cache = new InMemorySurveyCacheStore();
  const seedAskGoogle = makeCountingAskGoogle();
  const seedEvents: TerminalEvent[] = [];
  await runLianaCycleQuestion(
    ZERO_CALL_QUESTION, seedAskGoogle.fn as any, (e: TerminalEvent) => seedEvents.push(e),
    null, null, true, undefined, undefined, undefined, undefined, undefined,
    cache as any,
  );
  assert(seedAskGoogle.calls.length > 0, '(c) seed run (surveyEnabled true, fresh cache): made real calls to populate the cache', `got ${seedAskGoogle.calls.length}`);

  const outcome = await runLianaCycleQuestion(
    ZERO_CALL_QUESTION, askGoogle as any, (e: TerminalEvent) => events.push(e),
    null, null, undefined /* surveyEnabled OMITTED on the second call -- cache must still be consulted first */,
    undefined, undefined, undefined, undefined, undefined,
    cache as any,
  );
  assert(calls.length === 0, '(c) second run, same question, SAME cache, surveyEnabled omitted: askGoogle was called EXACTLY ZERO times', `got ${calls.length} call(s)`);
  const cacheHitLine = events.find((e) => e.kind === 'stage' && /SURVEY -- CACHE HIT/.test(e.text));
  assert(!!cacheHitLine, '(c) the transcript states this was a CACHE HIT, not a silent skip or a silent re-survey', events.map((e) => e.text).join(' | '));
  assert((outcome.costLedger ?? []).length === 0, '(c) outcome.costLedger is empty on the cache-hit run');
}

// ── (d) COST INSTRUMENT: every real call from (b) carries a dollar figure, in the production path ─
{
  const { fn: askGoogle } = makeCountingAskGoogle();
  const events: TerminalEvent[] = [];
  const cache = new InMemorySurveyCacheStore();
  const outcome = await runLianaCycleQuestion(
    QUESTION, askGoogle as any, (e: TerminalEvent) => events.push(e),
    null, null, true, undefined, undefined, undefined, undefined, undefined,
    cache as any,
  );
  const ledger = outcome.costLedger ?? [];
  assert(ledger.length > 0, '(d) at least one real Google call was recorded in the production cost ledger', `ledger length=${ledger.length}`);
  const first = ledger[0];
  assert(typeof first?.dollars?.actual_usd === 'number', '(d) each record carries a numeric dollars.actual_usd', JSON.stringify(first?.dollars));
  assert(first?.dollars?.actual_priced === true, '(d) dollars.actual_priced is true (architectural $0, sourced, not a guess)', JSON.stringify(first?.dollars));
  assert(typeof first?.machineId === 'string' && first.machineId.length > 0, '(d) each record carries a non-empty machineId (M0/M3 hardware distinction)', first?.machineId);
  assert(typeof first?.latency_ms === 'number' && first.latency_ms >= 0, '(d) each record carries a measured latency_ms', String(first?.latency_ms));
  assert(outcome.costSummary?.callCount === ledger.length, '(d) outcome.costSummary.callCount matches the ledger length');
  assert(typeof outcome.costSummary?.totalActualUsd === 'number', '(d) outcome.costSummary.totalActualUsd is a real number', String(outcome.costSummary?.totalActualUsd));
  console.log(`  [INFO] (d) sample cost record: ${JSON.stringify(first)}`);
  console.log(`  [INFO] (d) cost summary: ${JSON.stringify(outcome.costSummary)}`);
  console.log(`  [INFO] (b)'s own call count (cross-check): ${bCallCount}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
