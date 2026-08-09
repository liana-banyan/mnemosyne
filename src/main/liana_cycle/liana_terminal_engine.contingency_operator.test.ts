// liana_terminal_engine.contingency_operator.test.ts -- D-BP151-026/BISHOP/seg-contingency-operator
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as comparative_cascade.test.ts / stepped_audible.test.ts /
// survey_stage.test.ts, copied verbatim: requires the COMPILED dist/main/liana_cycle/*.js, same
// extensionless-import deviation, same "run after npm run build:main" instruction.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\liana_terminal_engine.contingency_operator.test.ts
//
// WHAT THIS TESTS, per this ticket's VERIFICATION section:
//   1. VARIANT OFF (contingencyOperatorSurvey omitted, and explicit false) leaves the dispatch
//      path UNCHANGED -- PROVEN, not asserted, two ways: (a) a call-count spy on
//      determineDemand()/determineDemandFromSurveyedAsk()/runSurveyStage(), monkey-patched onto
//      the COMPILED demand_test.js/survey_stage.js module objects before liana_terminal_engine.js
//      is required (Node's require cache guarantees liana_terminal_engine.js's own
//      `(0, demand_test_1.determineDemand)(...)`-shaped calls resolve through the SAME module
//      object, so the patch is visible to it); (b) the emitted event stream (kind+text, ts
//      stripped) and the returned outcome (variant key stripped) are byte-identical between the
//      omitted-parameter call and the explicit-false call.
//   2. VARIANT ON runs Survey (kind:'stage' boundaries for Founder steps 2/3/4/6) BEFORE method
//      selection -- proven by the SURVEY STEP 2/3/4/6 stage events appearing in the transcript
//      ahead of the "METHOD SELECTION" stage event.
//   3. VARIANT ON derives DEMAND from the surveyed ask, not the CUES table -- proven by a single
//      input ("Which region is most densely populated?") that the CUES table (demand_test.ts's
//      RANK cue, "most") would classify RANK, but for which findAskCatalyst() derives no term (no
//      quotes, no explains/describes/defines cue) -- so the surveyed-ask path reports DEMAND
//      UNKNOWN instead of RANK. Same input, two different demands, depending only on the variant:
//      this cannot happen if the ON path were secretly still reading the CUES table.
//   4. The stepped audible sees Survey's own stage boundaries and labels an unmapped stage TARE:
//      (a) a live run through wrapForSteppedAudible('survey', ...) pauses on all four of Survey's
//      ATTRIBUTED steps (2, 3, 4, 6) with the correct founderStepNumber/founderWords/
//      founderSource each; (b) classifyStageText() against SURVEY_STEP_DEFS returns null for a
//      stage text with no counterpart in that table (an honest "not mapped", never a guess); (c)
//      REGRESSION -- the pre-existing TARE mechanism (STAGE 5b, comparative-cascade) still fires
//      exactly as stepped_audible.test.ts already covers, unaffected by this ticket's additive
//      `stepDefs` parameter.
//   5. Survey PROPOSES, it never answers: on a VARIANT-ON run that reaches "no method matches",
//      the outcome's own verdict is null and its error is 'no_method_matched' or 'demand_unknown'
//      -- never anything sourced from Survey's own SurveyStageResult, which carries no
//      verdict/answer/correct field anywhere (already asserted directly in survey_stage.test.ts;
//      this file checks the INTEGRATION point only, not re-deriving that element-level proof).
//
// No network reachable in this test run (askGoogle is a fake returning null for every call) --
// every assertion below holds regardless of whether a real Google/Gemma backend is reachable.

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

// ── SPY SETUP, BEFORE liana_terminal_engine.js IS REQUIRED ─────────────────────────────────────
// Patch the EXPORTED FUNCTION PROPERTIES on the demand_test.js / survey_stage.js module objects.
// Verified against the compiled output that liana_terminal_engine.js calls these as
// `(0, demand_test_1.determineDemand)(...)` / `(0, survey_stage_1.runSurveyStage)(...)` -- a
// property read at CALL TIME, not a value destructured at import time -- so patching the property
// on the cached module object is visible to every call liana_terminal_engine.js makes, without
// touching liana_terminal_engine.js itself or any source file.
const demandTestMod = require(path.join(liDir, 'demand_test.js'));
const surveyStageMod = require(path.join(liDir, 'survey_stage.js'));

const spyCounts = { determineDemand: 0, determineDemandFromSurveyedAsk: 0, determineDemandFromAmbiguityNested: 0, runSurveyStage: 0 };
const originalDetermineDemand = demandTestMod.determineDemand;
const originalDetermineDemandFromSurveyedAsk = demandTestMod.determineDemandFromSurveyedAsk;
// D-BP151-032. Same spy technique as the two above, extended to the new ambiguity-path adapter.
const originalDetermineDemandFromAmbiguityNested = demandTestMod.determineDemandFromAmbiguityNested;
const originalRunSurveyStage = surveyStageMod.runSurveyStage;

demandTestMod.determineDemand = (...args: unknown[]) => {
  spyCounts.determineDemand += 1;
  return originalDetermineDemand(...args);
};
demandTestMod.determineDemandFromSurveyedAsk = (...args: unknown[]) => {
  spyCounts.determineDemandFromSurveyedAsk += 1;
  return originalDetermineDemandFromSurveyedAsk(...args);
};
demandTestMod.determineDemandFromAmbiguityNested = (...args: unknown[]) => {
  spyCounts.determineDemandFromAmbiguityNested += 1;
  return originalDetermineDemandFromAmbiguityNested(...args);
};
surveyStageMod.runSurveyStage = (...args: unknown[]) => {
  spyCounts.runSurveyStage += 1;
  return originalRunSurveyStage(...args);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineMod = require(path.join(liDir, 'liana_terminal_engine.js')) as typeof import('./liana_terminal_engine');
const { runLianaCycleQuestion } = engineMod;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const steppedMod = require(path.join(liDir, 'stepped_audible.js')) as typeof import('./stepped_audible');
const { classifyStageText, wrapForSteppedAudible, SURVEY_STEP_DEFS, COMPARATIVE_CASCADE_STEP_DEFS, SteppedAudibleLog } = steppedMod;

const fakeAskGoogle = async (_q: string) => null;

function stripTs(events: TerminalEvent[]): Array<{ kind: string; text: string }> {
  return events.map((e) => ({ kind: e.kind, text: e.text }));
}

console.log('liana_terminal_engine.contingency_operator.test.ts -- D-BP151-026\n');

// ── 1. VARIANT OFF: byte-for-byte, PROVEN not claimed ───────────────────────────────────────────
{
  // A free-text question with NO lettered options -- takes the fully synchronous "no lettered
  // option list -> no method fits -> no method matches" path with ZERO network calls on EITHER
  // variant state, so this is a clean, deterministic input for an equivalence proof.
  const input = 'What is the capital of France?';

  const eventsOmitted: TerminalEvent[] = [];
  const before1 = { ...spyCounts };
  const outcomeOmitted = await runLianaCycleQuestion(input, fakeAskGoogle, (e: TerminalEvent) => eventsOmitted.push(e));
  const after1 = { ...spyCounts };

  const eventsFalse: TerminalEvent[] = [];
  const before2 = { ...spyCounts };
  const outcomeFalse = await runLianaCycleQuestion(input, fakeAskGoogle, (e: TerminalEvent) => eventsFalse.push(e), null, null, false);
  const after2 = { ...spyCounts };

  assert(after1.runSurveyStage === before1.runSurveyStage, 'OFF (param omitted): runSurveyStage() was NEVER called');
  assert(after1.determineDemandFromSurveyedAsk === before1.determineDemandFromSurveyedAsk, 'OFF (param omitted): determineDemandFromSurveyedAsk() was NEVER called');
  assert(after1.determineDemandFromAmbiguityNested === before1.determineDemandFromAmbiguityNested, 'OFF (param omitted): determineDemandFromAmbiguityNested() was NEVER called (D-BP151-032)');
  assert(after1.determineDemand === before1.determineDemand + 1, 'OFF (param omitted): determineDemand() (the original, untouched call) WAS called exactly once');

  assert(after2.runSurveyStage === before2.runSurveyStage, 'OFF (explicit false): runSurveyStage() was NEVER called');
  assert(after2.determineDemandFromSurveyedAsk === before2.determineDemandFromSurveyedAsk, 'OFF (explicit false): determineDemandFromSurveyedAsk() was NEVER called');
  assert(after2.determineDemandFromAmbiguityNested === before2.determineDemandFromAmbiguityNested, 'OFF (explicit false): determineDemandFromAmbiguityNested() was NEVER called (D-BP151-032)');
  assert(after2.determineDemand === before2.determineDemand + 1, 'OFF (explicit false): determineDemand() WAS called exactly once');

  assert(
    JSON.stringify(stripTs(eventsOmitted)) === JSON.stringify(stripTs(eventsFalse)),
    'OFF: the emitted event stream (kind+text) is IDENTICAL whether the parameter is omitted or explicitly false',
  );
  assert(outcomeOmitted.variant === undefined, 'OFF (param omitted): outcome carries no `variant` key at all');
  assert(outcomeFalse.variant === undefined, 'OFF (explicit false): outcome carries no `variant` key at all');
  const { variant: _v1, ...outcomeOmittedRest } = outcomeOmitted as any;
  const { variant: _v2, ...outcomeFalseRest } = outcomeFalse as any;
  assert(
    JSON.stringify(outcomeOmittedRest) === JSON.stringify(outcomeFalseRest),
    'OFF: the returned outcome object is otherwise IDENTICAL (aside from the absent `variant` key on both)',
  );
  assert(outcomeOmitted.error === 'demand_unknown' || outcomeOmitted.error === 'no_method_matched', 'OFF: sanity -- this input reaches the no-method-matches abstain path, exercising the code this proof targets', outcomeOmitted.error);
}

// ── 2/3. VARIANT ON: Survey runs before method selection; DEMAND from the surveyed ask, not CUES ─
{
  // Contains the RANK cue-word "most" (demand_test.ts's CUES table) but no quoted term and no
  // explains/describes/defines-style cue -- findAskCatalyst() derives NO term from it. So: the
  // OFF/scaffold path reads RANK straight off the string; the ON/surveyed-ask path has nothing to
  // survey a term for and reports DEMAND UNKNOWN. Same string, two different demands -- possible
  // ONLY if the ON path is not secretly still consulting the CUES table.
  const input = 'Which region is most densely populated? A) Europe B) Asia';

  const eventsOff: TerminalEvent[] = [];
  const outcomeOff = await runLianaCycleQuestion(input, fakeAskGoogle, (e: TerminalEvent) => eventsOff.push(e), null, null, false);

  const eventsOn: TerminalEvent[] = [];
  const before = { ...spyCounts };
  const outcomeOn = await runLianaCycleQuestion(input, fakeAskGoogle, (e: TerminalEvent) => eventsOn.push(e), null, null, true);
  const after = { ...spyCounts };

  assert(after.runSurveyStage === before.runSurveyStage + 1, 'ON: runSurveyStage() WAS called exactly once');
  assert(after.determineDemand === before.determineDemand, 'ON: the CUES-table determineDemand() was NEVER called');

  const offDemandLine = eventsOff.find((e) => e.kind === 'note' && /DEMAND:/.test(e.text));
  const onDemandLine = eventsOn.find((e) => e.kind === 'note' && /DEMAND:/.test(e.text));
  assert(!!offDemandLine && /DEMAND: RANK/.test(offDemandLine.text), 'OFF: the CUES table reads "most" and reports DEMAND: RANK', offDemandLine?.text);
  assert(!!onDemandLine && /DEMAND: UNKNOWN/.test(onDemandLine.text), 'ON: the surveyed ask has no derivable term and reports DEMAND: UNKNOWN, NOT RANK -- proves it is not reading the CUES table', onDemandLine?.text);
  assert(!!onDemandLine && /derived from the question string/.test(onDemandLine.text) === false, 'ON: the DEMAND line carries no "derived from the question string -- SCAFFOLD" caveat (that caveat is derivedFrom-specific and only fires for the string path)');

  const surveyStageTexts = eventsOn.filter((e) => e.kind === 'stage').map((e) => e.text);
  const idxSurvey2 = surveyStageTexts.findIndex((t) => /^-> SURVEY STEP 2\b/.test(t));
  const idxSurvey3 = surveyStageTexts.findIndex((t) => /^-> SURVEY STEP 3\b/.test(t));
  const idxSurvey4 = surveyStageTexts.findIndex((t) => /^-> SURVEY STEP 4\b/.test(t));
  const idxSurvey6 = surveyStageTexts.findIndex((t) => /^-> SURVEY STEP 6\b/.test(t));
  const idxMethodSelection = surveyStageTexts.findIndex((t) => /METHOD SELECTION/.test(t));
  assert([idxSurvey2, idxSurvey3, idxSurvey4, idxSurvey6].every((i) => i >= 0), 'ON: all four Survey stage boundaries (steps 2, 3, 4, 6) were emitted');
  assert(idxMethodSelection >= 0, 'ON: METHOD SELECTION stage was reached');
  assert(
    idxSurvey2 < idxMethodSelection && idxSurvey3 < idxMethodSelection && idxSurvey4 < idxMethodSelection && idxSurvey6 < idxMethodSelection,
    'ON: every Survey stage boundary fired BEFORE METHOD SELECTION -- Survey runs ahead of selectMethod(), as ordered',
  );
  assert(idxSurvey2 < idxSurvey3 && idxSurvey3 < idxSurvey4 && idxSurvey4 < idxSurvey6, 'ON: Survey stages fire in the Founder\'s own order (2, 3, 4, 6)');

  // Part 5: Survey PROPOSES, it never answers -- the integration point.
  assert(outcomeOn.verdict === null, 'ON: the final outcome\'s verdict is null (Survey supplied no answer; no method matched this shape either)');
  assert(outcomeOn.error === 'demand_unknown' || outcomeOn.error === 'no_method_matched', 'ON: the outcome is an honest abstain, not a fabricated answer sourced from Survey', outcomeOn.error);
  assert(outcomeOn.variant === 'contingency-operator-survey-splice', 'ON: the outcome states which variant produced the run');
  assert(outcomeOff.variant === undefined, 'OFF (same input, contrast case): outcome carries no variant key');
}

// ── 2c/2d. D-BP151-032: THE AMBIGUITY PATH IS WIRED TO DEMAND (determineDemandFromAmbiguityNested) ─
// D-BP151-031 built SURVEY STEP 2's no-term ambiguity query and populated
// `step2.ambiguityNested`, but nothing downstream consumed it -- liana_terminal_engine.ts's demand
// ternary keyed off `step2.nested` alone, which stays null on this path BY DESIGN, so qid 98-shaped
// questions always fell through to "SURVEY STEP 2 did not resolve a term to survey" and abstained
// demand_unknown regardless of what the ambiguity query found. This block proves the NEW routing:
// when `ambiguityNested` is non-empty, `determineDemandFromAmbiguityNested()` (demand_test.ts) is
// called -- a DIFFERENT function and a DIFFERENT transcript line than the old "did not resolve a
// term" fallback -- even in a fixture where the underlying nested surveys cannot find a denotation
// (deterministic here: `askGoogle` is `fakeAskGoogle`, always null, so surveyAskNested()'s own
// Google lookups for each ambiguity-named term find nothing) and the honest final answer is still
// UNKNOWN. `transport: 'gemma'` is selected explicitly (with `global.fetch` mocked) so this block
// is deterministic and does not depend on a live Ollama or Google reachable on the runner -- see
// demand_test.ts's own new unit-level assertions (this ticket) for a fixture where a demand DOES
// come out non-null, proving the reuse of determineDemandFromSurveyedAsk() actually resolves when
// the underlying survey supports it.
{
  const originalFetch = global.fetch;
  // The SAME mocked response answers whichever shape gemmaExtract() asks for -- askAmbiguity()'s
  // 'gemma' branch parses `.terms` (present here); surveyAskNested()'s own internal gemmaExtract()
  // call (for the named term's denotation) parses `.sentence`/`.register` (both absent here, so it
  // finds nothing -- an honest empty denotation set, not a crash). This is why demand still comes
  // back UNKNOWN in this block: it is proving the WIRING fires, not fabricating a resolvable case.
  const mockResponse = { terms: [{ term: 'bias', standardMeaning: 'a systematic skew', alternativeMeaning: 'a personal prejudice', impact: 'changes which reading applies', isNegation: false }] };
  (global as any).fetch = async () => ({ json: async () => ({ response: JSON.stringify(mockResponse) }) });
  try {
    // No quotes, and findAskCatalyst()'s "explains/describes/defines/means/definition of <word>"
    // rule (elements/catalyst_words.ts) requires that word to be the LAST word of the question --
    // this sentence has trailing words after "skew", so it deliberately derives NO term, taking
    // the ambiguity path this block exists to exercise.
    const input = 'In this scenario, which factor best accounts for the observed skew? A) Systematic skew B) Random noise';
    const events: TerminalEvent[] = [];
    const before = { ...spyCounts };
    const outcome = await runLianaCycleQuestion(input, fakeAskGoogle, (e: TerminalEvent) => events.push(e), null, null, true, 'gemma');
    const after = { ...spyCounts };

    assert(after.runSurveyStage === before.runSurveyStage + 1, 'ambiguity-to-demand: runSurveyStage() WAS called exactly once');

    const pathLine = events.find((e) => e.kind === 'note' && /DEMAND PATH:/.test(e.text));
    assert(!!pathLine && /DEMAND PATH: ambiguity\b/.test(pathLine.text), 'ambiguity-to-demand: the receipt names the AMBIGUITY path (Law 5, HARDWIRE-23) -- not "nested", not "none"', pathLine?.text);

    assert(after.determineDemandFromAmbiguityNested === before.determineDemandFromAmbiguityNested + 1, 'ambiguity-to-demand: determineDemandFromAmbiguityNested() WAS called exactly once -- the new routing fired');

    const onDemandLine = events.find((e) => e.kind === 'note' && /DEMAND:/.test(e.text));
    assert(!!onDemandLine && /none produced a determinable demand/.test(onDemandLine.text), 'ambiguity-to-demand: the DEMAND line carries the NEW adapter\'s own why-text (not the old "did not resolve a term" fallback text), proving determineDemandFromAmbiguityNested()\'s result -- not a stale null -- reached the transcript', onDemandLine?.text);
    assert(!!onDemandLine && /SURVEY STEP 2 did not resolve a term to survey/.test(onDemandLine.text) === false, 'ambiguity-to-demand: the OLD "did not resolve a term" fallback text is NOT what produced this UNKNOWN -- it came from the new adapter instead');

    assert(outcome.verdict === null, 'ambiguity-to-demand: verdict stays null -- Survey never answers the question');
    assert(outcome.error === 'demand_unknown' || outcome.error === 'no_method_matched', 'ambiguity-to-demand: still an honest abstain when nothing is derivable -- demand_unknown remains legitimate', outcome.error);
  } finally {
    global.fetch = originalFetch;
  }
}

// ── 2e-2h. D-BP151-032: determineDemandFromAmbiguityNested() UNIT-LEVEL, HAND-BUILT FIXTURES ────
// The block above (2c/2d) proves the WIRING fires through real Survey machinery but, by
// construction (mocked fetch/askGoogle), never resolves a real denotation, so it never proves a
// demand CAN come out non-null from the ambiguity path -- only that the mechanism is reached. This
// block closes that gap with hand-built `SurveyAskNestedResult` fixtures (bypassing Google/Ollama
// entirely -- deterministic, no network, no live model), calling
// determineDemandFromAmbiguityNested() (demand_test.js, the SAME compiled function
// liana_terminal_engine.js calls) directly. Proves: (a) a single named term whose surveyed ask
// resolves to a real demand DOES come out non-null via reuse of determineDemandFromSurveyedAsk()
// (never a second derivation), (b) two AGREEING named terms still resolve to that one demand, (c)
// two DISAGREEING named terms report UNKNOWN rather than picking a winner (HARDWIRE-23 Law 1 -- no
// priority rule was ordered), (d) zero named terms reports UNKNOWN honestly.
function fixtureNested(sentence: string | null, surveyedTerm = 'x'): any {
  return {
    input: surveyedTerm,
    nest: { input: surveyedTerm, levels: [{ label: 'whole-phrase', text: surveyedTerm, why: 'fixture' }], refused: false, why: 'fixture' },
    levels: [{
      level: { label: 'whole-phrase', text: surveyedTerm, why: 'fixture' },
      surveyedTerm,
      survey: {
        term: surveyedTerm,
        queries: [],
        denotations: sentence ? [{ sentence, sourceUrl: 'https://example.com', sourceTitle: 'fixture', register: null, registerWhy: 'fixture', aspect: 'process', why: 'fixture' }] : [],
        discarded: [],
        reusedSources: [],
        why: 'fixture',
      },
    }],
    refused: false,
    why: 'fixture',
  };
}

{
  // (a) ONE named term, resolvable -> non-null demand, via reuse (not a second derivation).
  const oneTerm = [{ term: 'bias', nested: fixtureNested('It describes a systematic skew in measurement.', 'bias') }];
  const rOne = demandTestMod.determineDemandFromAmbiguityNested(oneTerm);
  assert(rOne.demand === 'DEFINE', 'fixture(one resolvable term): demand resolves to DEFINE via determineDemandFromSurveyedAsk(), reused not reimplemented', JSON.stringify(rOne));
  assert(rOne.derivedFrom === 'surveyed-ask', 'fixture(one resolvable term): derivedFrom is surveyed-ask');

  // (b) TWO named terms, both resolve to the SAME demand -> that demand, not a coin-flip.
  const twoAgree = [
    { term: 'bias', nested: fixtureNested('It describes a systematic skew in measurement.', 'bias') },
    { term: 'skew', nested: fixtureNested('It refers to an asymmetric distortion of the data.', 'skew') },
  ];
  const rAgree = demandTestMod.determineDemandFromAmbiguityNested(twoAgree);
  assert(rAgree.demand === 'DEFINE', 'fixture(two agreeing terms): demand resolves to the AGREED value, not a first-wins tie-break', JSON.stringify(rAgree));

  // (c) TWO named terms whose surveys DISAGREE (one DEFINE via a denotation, one framework-level
  // LOCATE-IN-FRAMEWORK) -> UNKNOWN, no priority rule invented (HARDWIRE-23 Law 1).
  const frameworkNested = {
    ...fixtureNested(null, 'security'),
    levels: [{ level: { label: 'framework', text: 'Critical Security Studies', why: 'fixture' }, surveyedTerm: 'security', survey: { term: 'security', queries: [], denotations: [], discarded: [], reusedSources: [], why: 'fixture' } }],
  };
  const twoDisagree = [
    { term: 'bias', nested: fixtureNested('It describes a systematic skew in measurement.', 'bias') },
    { term: 'security', nested: frameworkNested },
  ];
  const rDisagree = demandTestMod.determineDemandFromAmbiguityNested(twoDisagree);
  assert(rDisagree.demand === null, 'fixture(two disagreeing terms): demand is UNKNOWN -- no priority rule invented among ambiguity-named terms', JSON.stringify(rDisagree));
  assert(/DISAGREE/.test(rDisagree.why), 'fixture(two disagreeing terms): the why-text names the disagreement, not a silently swallowed conflict', rDisagree.why);

  // (d) ZERO named terms -> UNKNOWN, honest, no crash.
  const rEmpty = demandTestMod.determineDemandFromAmbiguityNested([]);
  assert(rEmpty.demand === null, 'fixture(zero named terms): demand is UNKNOWN');
}

// ── 4. STEPPED AUDIBLE sees Survey's own steps, ATTRIBUTED correctly, and TARE for the unmapped ─
{
  const forwarded: TerminalEvent[] = [];
  const pausesSeen: Array<{ key: string; founderStepNumber?: number; founderWords?: string; founderSource?: string; attribution: string }> = [];
  const log = new SteppedAudibleLog();
  const baseCtx = { askGoogle: fakeAskGoogle, emit: (e: TerminalEvent) => { forwarded.push(e); } };
  const channel = {
    requestStepPause: async (pause: any) => {
      pausesSeen.push({
        key: pause.step.key,
        founderStepNumber: pause.step.founderStepNumber,
        founderWords: pause.step.founderWords,
        founderSource: pause.step.founderSource,
        attribution: pause.step.attribution,
      });
      return { pauseId: pause.pauseId, action: 'approve' as const, text: 'auto' };
    },
  };
  const wrap = wrapForSteppedAudible('survey', baseCtx as any, channel, log);
  assert(wrap.ctx !== baseCtx, 'survey phase, channel armed: wrapForSteppedAudible() returns a DIFFERENT ctx (wrapped), not the same reference');

  const emit = wrap.ctx.emit;
  const ask = wrap.ctx.askGoogle;
  emit({ kind: 'header', text: 'SURVEY -- the Lieutenant', ts: 't0' });
  emit({ kind: 'stage', text: '-> SURVEY STEP 2 -- define the term, perfunctorily, then keep looking (Founder, Excerpt 7, BP141)', ts: 't1' });
  await ask('q1');
  emit({ kind: 'stage', text: '-> SURVEY STEP 3 -- categorize the options by shared predicate, before eliminating anything (Founder, Excerpt 7, BP141, rule 12)', ts: 't2' });
  await ask('q2');
  emit({ kind: 'stage', text: '-> SURVEY STEP 4 -- determine the register: guess out loud, then check it (Founder, Excerpt 7, BP141, rule 13)', ts: 't3' });
  await ask('q3');
  emit({ kind: 'stage', text: '-> SURVEY STEP 6 -- THE JAR METHOD: report what a source NAMED, never what a word list matched (Founder, Excerpt 2, BP141, rule 2)', ts: 't4' });
  await ask('q4');
  await wrap.finish();

  assert(pausesSeen.length === 4, `exactly 4 pauses fired for Survey's 4 stage boundaries (got ${pausesSeen.length})`);
  const byKey = Object.fromEntries(pausesSeen.map((p) => [p.key, p]));
  assert(byKey.survey2?.attribution === 'ATTRIBUTED' && byKey.survey2?.founderStepNumber === 2, 'survey2 pause: ATTRIBUTED to Founder step 2');
  assert(byKey.survey3?.attribution === 'ATTRIBUTED' && byKey.survey3?.founderStepNumber === 3, 'survey3 pause: ATTRIBUTED to Founder step 3');
  assert(byKey.survey4?.attribution === 'ATTRIBUTED' && byKey.survey4?.founderStepNumber === 4, 'survey4 pause: ATTRIBUTED to Founder step 4');
  assert(byKey.survey6?.attribution === 'ATTRIBUTED' && byKey.survey6?.founderStepNumber === 6, 'survey6 pause: ATTRIBUTED to Founder step 6');
  assert(
    SURVEY_STEP_DEFS.every((d: any) => d.attribution === 'ATTRIBUTED' && !!d.founderWords && !!d.founderSource),
    'every SURVEY_STEP_DEFS entry carries founderWords + founderSource (HARDWIRE-23 Law 4)',
  );

  // An unmapped Survey-shaped stage text is refused, not guessed.
  assert(classifyStageText('-> SURVEY STEP 99 -- an invented stage nobody wrote', SURVEY_STEP_DEFS) === null, 'classifyStageText: an unrecognized SURVEY STEP number against SURVEY_STEP_DEFS -> null, not a guess');
  assert(classifyStageText('-> SOMETHING ELSE ENTIRELY', SURVEY_STEP_DEFS) === null, 'classifyStageText: unrelated stage text against SURVEY_STEP_DEFS -> null');

  // REGRESSION: the pre-existing TARE mechanism (STAGE 5b, comparative-cascade) is unaffected by
  // this ticket's additive `stepDefs` parameter -- default-parameter call is unaffected, and an
  // explicit COMPARATIVE_CASCADE_STEP_DEFS call still classifies + still carries no attribution.
  assert(classifyStageText('-> STAGE 5b -- one option per question') === 'stage5b', 'classifyStageText (default param, no second argument): STAGE 5b still classifies exactly as before this ticket');
  assert(classifyStageText('-> STAGE 5b -- one option per question', COMPARATIVE_CASCADE_STEP_DEFS) === 'stage5b', 'classifyStageText (explicit COMPARATIVE_CASCADE_STEP_DEFS): STAGE 5b still classifies');
  const stage5bDef = COMPARATIVE_CASCADE_STEP_DEFS.find((d: any) => d.key === 'stage5b');
  assert(!!stage5bDef && stage5bDef.attribution === 'TARE' && !stage5bDef.founderStepNumber, 'REGRESSION: STAGE 5b is still labeled TARE with no founderStepNumber -- the mechanism this ticket extended still labels an unmapped stage TARE');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
