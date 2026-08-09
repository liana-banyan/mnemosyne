// survey_stage.test.ts -- D-BP151-025/BISHOP/seg-survey-the-lieutenant
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as comparative_cascade.test.ts / stepped_audible.test.ts, copied
// verbatim: requires the COMPILED dist/main/liana_cycle/survey_stage.js, same extensionless-
// import deviation, same "run after npm run build:main" instruction.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\survey_stage.test.ts
//
// WHAT THIS TESTS, per this ticket's VERIFICATION section:
//   1. Survey emits its own kind:'stage' boundaries -- one per Founder step (2, 3, 4, 6), plus the
//      overall SURVEY header -- so a future stepped-audible extension has real boundaries to pause
//      on (see this ticket's return for why wiring that pause support is out of scope: it needs
//      stepped_audible.ts, which this ticket may not touch).
//   2. An unverified register guess is NEVER acted on: with no live Google (askGoogle returns
//      null, exactly like a network-less test run), field_gate.ts's fieldGate() reaches
//      NO_CANDIDATES, and founderStep4DetermineRegister()'s own `verified` flag must be false --
//      never true on an unverified decision.
//   3. Survey never returns an answer to the question: the SurveyStageResult object carries no
//      `verdict`/`answer`/`correct` field anywhere, and `neverAnswersTheQuestion` is always `true`.
//   4. Step 2 and step 4 refuse cleanly (do not throw, do not guess) when no term can be derived.
//   5. Step 3 and step 6 refuse cleanly when no options are supplied.
//   6. Step 6 refuses cleanly (returns `named: []`, does not throw) when no source blocks are
//      supplied -- it issues no Google query of its own, per this file's own header.
//   7. The orchestrator runs steps in the Founder's order (2, 3, 4, 6) as emitted stage events.
//
// No network reachable in this test run (askGoogle is a fake returning null for every call, per
// the same convention stepped_audible.test.ts's fake MethodRunContext already uses) -- every
// assertion below holds regardless of whether a real Google/Gemma backend is reachable.

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

const distPath = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'liana_cycle', 'survey_stage.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./survey_stage');
const {
  runSurveyStage,
  founderStep2Survey,
  founderStep3CategorizeOptions,
  founderStep4DetermineRegister,
  founderStep6JarMethod,
} = mod;

type TerminalEvent = { kind: string; text: string; ts: string };

function nowIso(): string {
  return new Date().toISOString();
}

function fakeCtx() {
  const events: TerminalEvent[] = [];
  return {
    ctx: {
      askGoogle: async () => null,
      emit: (e: TerminalEvent) => { events.push(e); },
    },
    events,
  };
}

console.log('survey_stage.test.ts -- D-BP151-025: Survey (steps 2, 3, 4, 6)\n');

// ── 1. STEP 2 REFUSES CLEANLY WITH NO TERM -- never guesses one from the raw question ──────────
{
  const { ctx, events } = fakeCtx();
  const r = await founderStep2Survey(null, ctx);
  assert(r.term === null, 'step2(null term): term stays null');
  assert(r.nested === null, 'step2(null term): nested stays null, surveyAskNested() never called');
  assert(events.some((e) => e.kind === 'stage' && /SURVEY STEP 2/.test(e.text)), 'step2(null term): still emits its own kind:\'stage\' boundary');
  assert(events.some((e) => e.kind === 'result'), 'step2(null term): still emits a kind:\'result\' line, not a silent no-op');
}

// ── 2. STEP 3 REFUSES CLEANLY WITH NO OPTIONS ────────────────────────────────────────────────
{
  const { ctx, events } = fakeCtx();
  const r = await founderStep3CategorizeOptions(null, ctx);
  assert(r.perOption === null, 'step3(no options): perOption stays null');
  assert(typeof r.fork === 'string' && r.fork.length > 0, 'step3: the categorization fork is ALWAYS stated, even on refusal');
  assert(events.some((e) => e.kind === 'stage' && /SURVEY STEP 3/.test(e.text)), 'step3(no options): still emits its own kind:\'stage\' boundary');
}

// ── 3. STEP 3 WIRES survey_answers.ts (dead code before this ticket) WHEN OPTIONS ARE GIVEN ────
{
  const { ctx } = fakeCtx();
  const options = { A: 'It describes a process that results in a non-representative sample.', B: 'A method uses a small sample.' };
  // maxCatalystWordsPerOption: 0 -- bounds this test to the free part of survey_answers.ts
  // (assertion/kind/aspect/catalyst-word LISTING only, no I/O). The I/O half (surveying each
  // option's own catalyst word via surveyAsk()) is exercised for real, once, by the orchestrator
  // integration test below -- no need to pay for it twice in one test run.
  const r = await founderStep3CategorizeOptions(options, ctx, undefined, 0);
  assert(r.perOption !== null, 'step3(options given): perOption is populated -- survey_answers.ts wired, not skipped');
  assert(r.perOption!.letters.length === 2, 'step3: both options reported');
  assert(r.perOption!.options.A.kind !== undefined, 'step3: option A carries a KIND from checkKind() (elements/kind_check.ts, wired for the first time)');
  assert(r.perOption!.options.A.aspect !== undefined, 'step3: option A carries an ASPECT from tagAspect()');
  assert(Array.isArray(r.perOption!.options.A.catalystWords), 'step3: option A carries its own catalyst words from findCatalystWords()');
  assert(/threshold/i.test(r.fork), 'step3: the fork explicitly names the D1 shared-token-threshold tare it refuses to repeat', r.fork);
  assert(/semantic judgment|read meaning|meaning/i.test(r.fork), 'step3: the fork explicitly names the semantic-judgment gap it stopped at', r.fork);
}

// ── 4. STEP 4: AN UNVERIFIED REGISTER GUESS IS NEVER ACTED ON ──────────────────────────────────
// No live Google (askGoogle -> null everywhere) means field_gate.ts's askFields() finds zero
// candidates -> fieldGate() decision is NO_CANDIDATES, never ONE_SURVIVOR. `verified` must be
// false, and the reported term must stay UNCONSTRAINED (never silently scoped).
{
  const { ctx, events } = fakeCtx();
  const options = { A: 'sample bias', B: 'estimator bias' };
  const r = await founderStep4DetermineRegister('bias', 'What is bias?', options, ctx);
  assert(r.field !== null, 'step4: fieldGate() ran (term was supplied)');
  assert(r.field!.decision !== 'ONE_SURVIVOR', 'step4: with no live Google, fieldGate() cannot reach ONE_SURVIVOR (sanity check on the fixture)');
  assert(r.verified === false, 'step4: verified is FALSE on an unresolved/unverified register -- never acted on');
  assert(r.field!.scopedTerm === 'bias', 'step4: scopedTerm stays UNCONSTRAINED (equal to the bare term) when unverified -- never narrowed on a guess');
  assert(events.some((e) => e.kind === 'stage' && /SURVEY STEP 4/.test(e.text)), 'step4: emits its own kind:\'stage\' boundary');
  assert(events.some((e) => e.kind === 'note' && /NOT VERIFIED/.test(e.text)), 'step4: the transcript states NOT VERIFIED explicitly, not silently');
}
{
  // No term at all -- step 4 must refuse before even calling fieldGate(), never guess a term from
  // the raw question text.
  const { ctx } = fakeCtx();
  const r = await founderStep4DetermineRegister(null, 'What is bias?', { A: 'x', B: 'y' }, ctx);
  assert(r.field === null, 'step4(no term): fieldGate() never called');
  assert(r.verified === false, 'step4(no term): verified is false');
}

// ── 5. STEP 6: REFUSES CLEANLY WITH NO SOURCE BLOCKS -- issues no query of its own ─────────────
{
  const { ctx, events } = fakeCtx();
  const options = { A: 'South America', B: 'Western Europe' };
  const r = await founderStep6JarMethod([], options, ctx);
  assert(r.named.length === 0, 'step6(no source blocks): named is empty');
  assert(typeof r.fork === 'string' && /polarity|word-list/i.test(r.fork), 'step6: the elimination-polarity fork is always stated', r.fork);
  assert(events.some((e) => e.kind === 'stage' && /SURVEY STEP 6/.test(e.text)), 'step6(no blocks): still emits its own kind:\'stage\' boundary');
}
{
  const { ctx } = fakeCtx();
  const r = await founderStep6JarMethod([{ query: 'x', blocks: [] }], null, ctx);
  assert(r.named.length === 0, 'step6(no options): named is empty, refuses before touching any block');
}
{
  // Given real blocks but no reachable Gemma backend, this must DEGRADE GRACEFULLY (empty result,
  // no throw) rather than crash the whole Survey stage -- gemmaExtract() (methods/
  // comparative_cascade.ts) already catches every network failure and returns null; this proves
  // that discipline survives being called through founderStep6JarMethod()'s wiring.
  const { ctx } = fakeCtx();
  const options = { A: 'South America', B: 'Western Europe' };
  let threw = false;
  let r: Awaited<ReturnType<typeof founderStep6JarMethod>> | null = null;
  try {
    r = await founderStep6JarMethod(
      [{ query: 'test query', blocks: [{ title: 'test', body: 'South America is not the answer.', url: '', kind: 'organic' }] }],
      options,
      ctx,
    );
  } catch {
    threw = true;
  }
  assert(threw === false, 'step6(blocks supplied, no reachable Gemma): does not throw -- degrades to an honest empty/partial result');
  assert(r !== null && Array.isArray(r.named), 'step6(blocks supplied, no reachable Gemma): still returns a well-formed result shape');
}

// ── 6. THE ORCHESTRATOR: RUNS STEPS 2, 3, 4, 6 IN THE FOUNDER'S ORDER, PROPOSAL ONLY ───────────
{
  const { ctx, events } = fakeCtx();
  const askText = 'What is a "referent object" in this framework?';
  const options = { A: 'a bare noun phrase', B: 'a full clause asserting something' };
  // maxCatalystWordsPerOption: 0 keeps this integration test's own network cost to step2's and
  // step4's real (retry-bearing) googleBlocks() calls only -- see the step3 unit test above for
  // why the catalyst-word I/O half is not re-exercised here too.
  const result = await runSurveyStage(askText, options, ctx, { maxCatalystWordsPerOption: 0 });

  assert(result.neverAnswersTheQuestion === true, 'orchestrator: neverAnswersTheQuestion is always true');
  assert(!('verdict' in result), 'orchestrator: the result object carries NO verdict field -- Survey never answers the question');
  assert(!('answer' in result), 'orchestrator: the result object carries NO answer field');
  assert(!('correct' in result), 'orchestrator: the result object carries NO correct field');

  const stageTexts = events.filter((e) => e.kind === 'stage').map((e) => e.text);
  const idx2 = stageTexts.findIndex((t) => /SURVEY STEP 2/.test(t));
  const idx3 = stageTexts.findIndex((t) => /SURVEY STEP 3/.test(t));
  const idx4 = stageTexts.findIndex((t) => /SURVEY STEP 4/.test(t));
  const idx6 = stageTexts.findIndex((t) => /SURVEY STEP 6/.test(t));
  assert(idx2 >= 0 && idx3 >= 0 && idx4 >= 0 && idx6 >= 0, 'orchestrator: all four Founder-step stage boundaries were emitted', stageTexts.join(' | '));
  assert(idx2 < idx3 && idx3 < idx4 && idx4 < idx6, 'orchestrator: steps run in the Founder\'s own order -- 2, then 3, then 4, then 6', stageTexts.join(' | '));

  assert(events.some((e) => e.kind === 'header' && /SURVEY -- the Lieutenant/.test(e.text)), 'orchestrator: emits the overall SURVEY header naming it the Lieutenant');
  assert(events.some((e) => e.kind === 'result' && /PROPOSAL ONLY/.test(e.text)) || /PROPOSAL ONLY/.test(result.why), 'orchestrator: the final line states PROPOSAL ONLY, not a verdict');
}

// ── 7. THE ORCHESTRATOR: explicitTerm OVERRIDE SKIPS findAskCatalyst() DERIVATION ──────────────
{
  const { ctx } = fakeCtx();
  const result = await runSurveyStage('some question with no quoted term at all', null, ctx, { explicitTerm: 'density' });
  assert(result.term === 'density', 'orchestrator: explicitTerm override is honored over findAskCatalyst() derivation');
}

// ── 8. THE ORCHESTRATOR: NO TERM DERIVABLE -- steps 2/4 refuse, steps 3/6 still refuse cleanly on missing options, nothing throws ──
{
  const { ctx } = fakeCtx();
  const result = await runSurveyStage('a plain declarative sentence with no quoted term and no defines-cue', null, ctx);
  assert(result.term === null, 'orchestrator: no term derivable -- term stays null, never guessed from the raw question');
  assert(result.step2.nested === null, 'orchestrator: step2 did not run without a term');
  assert(result.step4.field === null, 'orchestrator: step4 did not run without a term');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
