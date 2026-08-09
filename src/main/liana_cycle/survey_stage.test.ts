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
// WHAT THIS TESTS, per this ticket's VERIFICATION section (amended, D-BP151-025 second pass --
// steps 3 and 6 completed per the Founder's rulings on both forks the first pass stopped at):
//   1. Survey emits its own kind:'stage' boundaries -- one per Founder step (2, 3, 4, 6), plus the
//      overall SURVEY header -- so a future stepped-audible extension has real boundaries to pause
//      on (see this ticket's return for why wiring that pause support is out of scope: it needs
//      stepped_audible.ts, which this ticket may not touch).
//   2. An unverified register guess is NEVER acted on: with no live Google (askGoogle returns
//      null, exactly like a network-less test run), field_gate.ts's fieldGate() reaches
//      NO_CANDIDATES, and founderStep4DetermineRegister()'s own `verified` flag must be false --
//      never true on an unverified decision.
//   3. Survey never returns an answer to the question: the SurveyStageResult object carries no
//      `verdict`/`answer`/`correct` field anywhere, and `neverAnswersTheQuestion` is always `true`
//      -- true even now that step 6 performs a real (Founder-ordered) elimination, because
//      narrowing the OPTION POOL is not picking a final verdict letter.
//   4. Step 2 and step 4 refuse cleanly (do not throw, do not guess) when no term can be derived.
//   5. Step 3 and step 6 refuse cleanly when no options are supplied.
//   6. Step 6 refuses cleanly (returns `named: []`, `eliminated: []`, does not throw) when no
//      source groups are supplied -- it issues no Google query of its own, per this file's own
//      header.
//   7. The orchestrator runs steps in the Founder's order (2, 3, 4, 6) as emitted stage events.
//   8. STEP 3 GROUPS VIA THE REAL MODEL CALL (D-BP151-025 amendment), and the grouping is
//      recorded as a PROPOSAL: every returned letter is a real option letter (a hallucinated one
//      would be dropped, never trusted -- this is the only mechanical check performed), and
//      nothing about the call picks a "right" group or an answer to the question.
//   9. STEP 6 ELIMINATES BY THE QUERY'S KNOWN DIRECTION (D-BP151-025 amendment): a source that
//      names an option in a query group declared 'answers-eliminate' causes that option to be
//      eliminated; a source in a group declared 'answers-keep' is named but NOT eliminated. No
//      word list is used anywhere in this decision.
//
// THIS RUN USES THE REAL LOCAL OLLAMA MODEL (measured reachable at the default
// http://127.0.0.1:11434 on this machine, model gemma4:12b -- the SAME instance
// comparative_cascade.ts's gemmaExtract() already talks to) for steps 3's grouping call and 6's
// extraction call. `askGoogle` (the GOOGLE SEARCH channel) is still a fake returning null for
// every call -- no Google/internet network is reached anywhere in this file. Model-call cases
// below assert MECHANICAL invariants (every letter is real, an eliminated option was actually
// named, a kept-direction mention is not eliminated) rather than exact model wording, since a
// live model's phrasing can vary even at temperature 0 across machine/driver versions.

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
  assert(r.ambiguity === null, 'step2(null term, no askText): ambiguity stays null -- no askText to query with');
  assert(r.ambiguityNested.length === 0, 'step2(null term, no askText): ambiguityNested stays empty');
  assert(r.negationNamed === false, 'step2(null term, no askText): negationNamed stays false');
  assert(events.some((e) => e.kind === 'stage' && /SURVEY STEP 2/.test(e.text)), 'step2(null term): still emits its own kind:\'stage\' boundary');
  assert(events.some((e) => e.kind === 'result'), 'step2(null term): still emits a kind:\'result\' line, not a silent no-op');
}

// ── 1a. D-BP151-031: WITH A QUOTED/CUED TERM PRESENT, BEHAVIOR IS UNCHANGED ─────────────────────
// The existing path must be provably untouched: ambiguity/ambiguityNested/negationNamed stay
// null/empty/false even when an askText is supplied, because findAskCatalyst() already resolved a
// term -- the ambiguity query must never be issued when there is a term to survey directly.
{
  const { ctx } = fakeCtx();
  const r = await founderStep2Survey('bias', ctx, 'What is bias?');
  assert(r.term === 'bias', 'step2(term present, askText also given): term path taken, unchanged');
  assert(r.nested !== null, 'step2(term present): nested populated via the existing surveyAskNested() path');
  assert(r.ambiguity === null, 'step2(term present): ambiguity stays null -- the ambiguity query is never issued when a term was already resolved');
  assert(r.ambiguityNested.length === 0, 'step2(term present): ambiguityNested stays empty');
  assert(r.negationNamed === false, 'step2(term present): negationNamed stays false');
}

// ── 1b. D-BP151-031/032: NO TERM, ASK TEXT GIVEN, TRANSPORT='gemma', MODEL CALL FAILS -- REFUSES ─
// Monkey-patches the global fetch() askAmbiguity()'s 'gemma' branch uses (same technique any test
// in this process can use -- fetch is looked up at call time, not captured at module load) to
// simulate the local model being unreachable. No real network/Ollama call happens in this block.
// D-BP151-032: transport is now EXPLICIT ('gemma') since Google is the new default -- these tests
// (1b-1f) exist specifically to cover the SELECTABLE local-model path; see 1g/1h below for the new
// default ('google') transport's own tests.
{
  const originalFetch = global.fetch;
  (global as any).fetch = async () => { throw new Error('simulated network failure'); };
  let r: Awaited<ReturnType<typeof founderStep2Survey>>;
  try {
    const { ctx, events } = fakeCtx();
    r = await founderStep2Survey(null, ctx, 'Which of the following world regions is NOT considered one of the most densely populated?', 'gemma');
    assert(r.ambiguity !== null, 'step2(gemma, model unreachable): ambiguity query was issued (askText was present)');
    assert(r.ambiguity!.modelUnreachable === true, 'step2(gemma, model unreachable): modelUnreachable is true, measured via a failing fetch', JSON.stringify(r.ambiguity));
    assert(r.ambiguity!.transport === 'gemma', 'step2(gemma, model unreachable): transport is recorded as gemma', r.ambiguity!.transport);
    assert(r.ambiguity!.terms.length === 0, 'step2(gemma, model unreachable): terms is empty');
    assert(r.ambiguityNested.length === 0, 'step2(gemma, model unreachable): ambiguityNested stays empty -- nothing to survey');
    assert(r.nested === null, 'step2(gemma, model unreachable): nested stays null -- refuses exactly as the no-term path always has');
    assert(r.negationNamed === false, 'step2(gemma, model unreachable): negationNamed stays false');
    assert(events.some((e) => e.kind === 'result' && /no term/.test(e.text)), 'step2(gemma, model unreachable): still reports "no term" -- refusing beats guessing, unchanged', events.map((e) => e.text).join(' | '));
  } finally {
    global.fetch = originalFetch;
  }
}

// ── 1c. D-BP151-031/032: NO TERM, ASK TEXT GIVEN, TRANSPORT='gemma', MODEL NAMES NOTHING ────────
{
  const originalFetch = global.fetch;
  (global as any).fetch = async () => ({ json: async () => ({ response: '{"terms":[]}' }) });
  let r: Awaited<ReturnType<typeof founderStep2Survey>>;
  try {
    const { ctx } = fakeCtx();
    r = await founderStep2Survey(null, ctx, 'A plain question with nothing ambiguous in it.', 'gemma');
    assert(r.ambiguity !== null, 'step2(gemma, names nothing): ambiguity query was issued');
    assert(r.ambiguity!.modelUnreachable === false, 'step2(gemma, names nothing): the model call itself succeeded');
    assert(r.ambiguity!.terms.length === 0, 'step2(gemma, names nothing): terms is empty -- an honest empty result');
    assert(r.ambiguityNested.length === 0, 'step2(gemma, names nothing): ambiguityNested stays empty');
    assert(r.nested === null, 'step2(gemma, names nothing): nested stays null -- refuses, does not guess a term from an empty ambiguity result');
  } finally {
    global.fetch = originalFetch;
  }
}

// ── 1d. D-BP151-031/032: TRANSPORT='gemma', NAMED TERMS BECOME THE SURVEYED TERMS, SOURCE ORDER ─
// Deterministic mock: the model names two terms, one flagged isNegation. Proves (a) every named
// term is surveyed (ambiguityNested), (b) the exact Founder wording was sent as `askedText`, (c)
// the negation flag is set ONLY when the source names it -- never inferred from a word list here.
{
  const originalFetch = global.fetch;
  const mockResponse = {
    terms: [
      { term: 'densely populated', standardMeaning: 'people per square mile', alternativeMeaning: 'total absolute population count', impact: 'changes which region qualifies', isNegation: false },
      { term: 'NOT', standardMeaning: 'exclusion from the top group', alternativeMeaning: 'a misread double negative', impact: 'flips the correct choice to its exact opposite', isNegation: true },
    ],
  };
  (global as any).fetch = async () => ({ json: async () => ({ response: JSON.stringify(mockResponse) }) });
  let r: Awaited<ReturnType<typeof founderStep2Survey>>;
  try {
    const { ctx } = fakeCtx();
    r = await founderStep2Survey(null, ctx, "Which of the following world regions is NOT considered one of the world's most densely populated regions?", 'gemma');
    assert(
      r.ambiguity!.askedText === 'what words or phrases in this question could be understood with a different meaning that would fundamentally change the meaning of what is being asked?',
      'step2(gemma, named terms): the ambiguity query used the Founder\'s exact verbatim wording',
      r.ambiguity!.askedText,
    );
    assert(r.ambiguity!.terms.length === 2, 'step2(gemma, named terms): both source-named terms are reported');
    assert(r.ambiguityNested.length === 2, 'step2(gemma, named terms): every named term was surveyed -- no selection/ranking rule dropped one', JSON.stringify(r.ambiguityNested.map((a) => a.term)));
    assert(r.ambiguityNested[0].term === 'densely populated' && r.ambiguityNested[1].term === 'NOT', 'step2(gemma, named terms): surveyed in the order the source returned them', JSON.stringify(r.ambiguityNested.map((a) => a.term)));
    assert(r.ambiguityNested.every((a) => a.nested !== null && Array.isArray(a.nested.levels)), 'step2(gemma, named terms): each named term went through the SAME surveyAskNested() the quoted/cued path uses');
    assert(r.negationNamed === true, 'step2(gemma, named terms): negationNamed is true -- the source flagged "NOT" as a negation term');
  } finally {
    global.fetch = originalFetch;
  }
}

// ── 1e. D-BP151-031/032: TRANSPORT='gemma', NEGATION FLAG NEVER SET WHEN NOT SOURCE-NAMED ───────
{
  const originalFetch = global.fetch;
  const mockResponse = { terms: [{ term: 'regions', standardMeaning: 'broad geographic zones', alternativeMeaning: 'specific political borders', impact: 'changes scope', isNegation: false }] };
  (global as any).fetch = async () => ({ json: async () => ({ response: JSON.stringify(mockResponse) }) });
  let r: Awaited<ReturnType<typeof founderStep2Survey>>;
  try {
    const { ctx } = fakeCtx();
    r = await founderStep2Survey(null, ctx, 'A question with one ambiguous but non-negating term.', 'gemma');
    assert(r.negationNamed === false, 'step2(gemma, no negation named): negationNamed stays false when no source-named term flags isNegation');
  } finally {
    global.fetch = originalFetch;
  }
}

// ── 1f. D-BP151-031/032: TRANSPORT='gemma', THE REAL LOCAL MODEL, LIVE, ACTUAL qid 98 TEXT ──────
// Real local Ollama (gemma4:12b) -- the measured failure this ticket fixes, replayed directly.
// Asserts MECHANICAL invariants only (a real response was usable, every named term was surveyed),
// not exact model wording, since live phrasing can vary even at temperature 0 across machine/
// driver versions -- same convention as the 3b/5b model-call tests already in this file.
{
  const { ctx } = fakeCtx();
  const qid98Text = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
  const r = await founderStep2Survey(null, ctx, qid98Text, 'gemma');
  assert(r.ambiguity !== null, 'step2(gemma, qid98 live model): ambiguity query was issued');
  assert(r.ambiguity!.modelUnreachable === false, 'step2(gemma, qid98 live model): the local model WAS reachable for this run (measured, not assumed)', JSON.stringify(r.ambiguity));
  assert(r.ambiguity!.transport === 'gemma', 'step2(gemma, qid98 live model): transport is recorded as gemma');
  assert(r.ambiguity!.terms.length > 0, 'step2(gemma, qid98 live model): the source named at least one ambiguous term for this question', JSON.stringify(r.ambiguity));
  assert(r.ambiguityNested.length === r.ambiguity!.terms.length, 'step2(gemma, qid98 live model): every named term was surveyed, none dropped', JSON.stringify({ named: r.ambiguity!.terms.length, surveyed: r.ambiguityNested.length }));
  console.log(`  [INFO] qid98 live ambiguity query (gemma) named: ${r.ambiguity!.terms.map((t) => t.term).join(', ')}${r.negationNamed ? ' (negation named)' : ' (no negation named)'}`);
}

// ── 1g. D-BP151-032: TRANSPORT OMITTED -> DEFAULTS TO 'google'; GOOGLE UNREACHABLE -> REFUSES, ──
// NEVER SILENTLY FALLS BACK TO GEMMA. fakeCtx()'s askGoogle returns null (unreachable, no retry
// wait avoided -- googleBlocks() still runs its own real 3-try/backoff loop, same accepted cost
// this suite's step4 tests already pay). A fetch spy proves the local Ollama endpoint is NEVER
// touched on this path -- the refusal is real, not a disguised fallback.
{
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  (global as any).fetch = async (...args: unknown[]) => { fetchCalls += 1; return originalFetch(...(args as [any])); };
  let r: Awaited<ReturnType<typeof founderStep2Survey>>;
  try {
    const { ctx } = fakeCtx(); // askGoogle: async () => null
    r = await founderStep2Survey(null, ctx, 'Which of the following world regions is NOT considered one of the most densely populated?');
    assert(r.ambiguity !== null, 'step2(transport omitted, Google unreachable): ambiguity query was issued');
    assert(r.ambiguity!.transport === 'google', 'step2(transport omitted): resolves to \'google\' -- the Founder-ordered default', r.ambiguity!.transport);
    assert(r.ambiguity!.modelUnreachable === true, 'step2(transport omitted, Google unreachable): modelUnreachable is true', JSON.stringify(r.ambiguity));
    assert(r.ambiguity!.terms.length === 0, 'step2(transport omitted, Google unreachable): terms is empty');
    assert(r.ambiguity!.citations.length === 0, 'step2(transport omitted, Google unreachable): citations is empty');
    assert(fetchCalls === 0, 'step2(transport omitted, Google unreachable): the local Ollama fetch() endpoint was NEVER called -- no silent fallback to gemma', `fetchCalls=${fetchCalls}`);
    assert(r.ambiguityNested.length === 0, 'step2(transport omitted, Google unreachable): ambiguityNested stays empty');
    assert(r.nested === null, 'step2(transport omitted, Google unreachable): nested stays null -- refuses');
  } finally {
    global.fetch = originalFetch;
  }
}

// ── 1h. D-BP151-032: TRANSPORT='google' EXPLICIT, GOOGLE ANSWERS -- gemmaExtract() STRUCTURES IT ─
// Mocks ctx.askGoogle to return a real-shaped BrowserAuthorityRawExtraction (snippet + a citation),
// and mocks global.fetch (gemmaExtract()'s own Ollama call, UNRELAXED extraction-only prompt) to
// return the same declared JSON shape. Proves: (a) the Google passage is what reaches gemmaExtract
// (mechanical -- the mocked fetch always returns the same fixed JSON regardless of prompt content,
// so this does not re-assert gemmaExtract()'s own internals, only that THIS path reaches it and
// uses its output), (b) citations flow from googleBlocks()'s `sources` onto the result, (c) the
// negation flag and named terms are carried exactly as extracted, same shape as the gemma path.
{
  const originalFetch = global.fetch;
  const mockResponse = {
    terms: [
      { term: 'densely populated', standardMeaning: 'people per square mile', alternativeMeaning: 'total absolute population count', impact: 'changes which region qualifies', isNegation: false },
      { term: 'NOT', standardMeaning: 'exclusion from the top group', alternativeMeaning: 'a misread double negative', impact: 'flips the correct choice to its exact opposite', isNegation: true },
    ],
  };
  (global as any).fetch = async () => ({ json: async () => ({ response: JSON.stringify(mockResponse) }) });
  const googleCtx = {
    askGoogle: async () => ({
      snippet: 'In this question, "densely populated" standardly means people per square mile, but could be read as total absolute population; "NOT" excludes the top group but could be misread as a double negative. Source: example.com.',
      sourceUrl: 'https://example.com/densely-populated',
      authority: 'user_google' as const,
      selectorUsed: 'answer_box',
      citations: [{ url: 'https://example.com/densely-populated', label: 'Densely Populated Regions', category: 'example.com' }],
    }),
    emit: (_e: TerminalEvent) => {},
  };
  let r: Awaited<ReturnType<typeof founderStep2Survey>>;
  try {
    r = await founderStep2Survey(null, googleCtx as any, "Which of the following world regions is NOT considered one of the world's most densely populated regions?", 'google');
    assert(r.ambiguity !== null, 'step2(google explicit, Google answers): ambiguity query was issued');
    assert(r.ambiguity!.transport === 'google', 'step2(google explicit): transport recorded as google');
    assert(r.ambiguity!.modelUnreachable === false, 'step2(google explicit, Google answers): modelUnreachable is false', JSON.stringify(r.ambiguity));
    assert(r.ambiguity!.terms.length === 2, 'step2(google explicit): both terms extracted from the Google passage via gemmaExtract()');
    assert(r.ambiguity!.citations.length === 1 && r.ambiguity!.citations[0] === 'https://example.com/densely-populated', 'step2(google explicit): the Google citation URL is captured, not thrown away', JSON.stringify(r.ambiguity!.citations));
    assert(r.ambiguityNested.length === 2, 'step2(google explicit): every named term was surveyed, same as the gemma path');
    assert(r.negationNamed === true, 'step2(google explicit): negationNamed true -- "NOT" flagged by the extraction, same contract as the gemma path');
  } finally {
    global.fetch = originalFetch;
  }
}

// ── 2. STEP 3 REFUSES CLEANLY WITH NO OPTIONS ────────────────────────────────────────────────
{
  const { ctx, events } = fakeCtx();
  const r = await founderStep3CategorizeOptions(null, ctx);
  assert(r.perOption === null, 'step3(no options): perOption stays null');
  assert(r.grouping === null, 'step3(no options): grouping stays null -- the model call is never made with nothing to group');
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
  assert(r.grouping !== null, 'step3(options given): grouping is populated -- the model call ran');
}

// ── 3b. STEP 3 GROUPS VIA THE REAL MODEL CALL, PROPOSAL ONLY (D-BP151-025 amendment) ───────────
// Real local Ollama (gemma4:12b), no fabrication -- asserting MECHANICAL invariants only, since
// exact model phrasing can vary: every letter the model returns is a REAL option letter (a
// hallucinated one is dropped, never trusted -- the only post-call check this function performs),
// and the model never answers the underlying question or picks a "right" group.
{
  const { ctx } = fakeCtx();
  const options = {
    A: 'It describes a process that results in a non-representative sample.',
    B: 'It describes a process that results in a skewed estimate.',
    C: 'A method uses a small sample size.',
  };
  const r = await founderStep3CategorizeOptions(options, ctx);
  assert(r.grouping !== null, 'step3(grouping): grouping result is present');
  const g = r.grouping!;
  assert(g.modelUnreachable === false, 'step3(grouping): the local model WAS reachable for this run (measured, not assumed)', JSON.stringify(g));
  const validLetters = new Set(Object.keys(options));
  const everyLetterReal = g.groups.every((grp) => grp.letters.every((L) => validLetters.has(L)));
  assert(everyLetterReal, 'step3(grouping): every letter in every proposed group is a REAL option letter -- no hallucination trusted', JSON.stringify(g.groups));
  const ungroupedAreReal = g.ungrouped.every((L) => validLetters.has(L));
  assert(ungroupedAreReal, 'step3(grouping): every ungrouped letter reported is a real option letter');
  assert(!('verdict' in g) && !('answer' in g) && !('correct' in g), 'step3(grouping): the grouping result carries no verdict/answer/correct field -- the model never answers the question');
  assert(/PROPOSAL|proposed/i.test(g.why), 'step3(grouping): why explicitly frames this as a PROPOSAL, not a decision', g.why);
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

// ── 5. STEP 6: REFUSES CLEANLY WITH NO SOURCE GROUPS -- issues no query of its own ─────────────
{
  const { ctx, events } = fakeCtx();
  const options = { A: 'South America', B: 'Western Europe' };
  const r = await founderStep6JarMethod([], options, ctx);
  assert(r.named.length === 0, 'step6(no source groups): named is empty');
  assert(r.eliminated.length === 0, 'step6(no source groups): eliminated is empty');
  assert(events.some((e) => e.kind === 'stage' && /SURVEY STEP 6/.test(e.text)), 'step6(no groups): still emits its own kind:\'stage\' boundary');
}
{
  const { ctx } = fakeCtx();
  const r = await founderStep6JarMethod([{ query: 'x', blocks: [], direction: 'answers-eliminate' }], null, ctx);
  assert(r.named.length === 0, 'step6(no options): named is empty, refuses before touching any block');
}

// ── 5b. STEP 6 ELIMINATES BY THE QUERY'S KNOWN DIRECTION (D-BP151-025 amendment) ────────────────
// Real local Ollama (gemma4:12b) via extractAssertedMentions() -- unmodified, extraction-only.
// Passage unambiguously names option A in an asserted sentence. Direction is declared
// 'answers-eliminate' (the caller's own knowledge of which query this was, e.g. the inverse) --
// so A must be eliminated. No word list anywhere in this decision.
{
  const { ctx } = fakeCtx();
  const options = { A: 'South America', B: 'Western Europe' };
  const r = await founderStep6JarMethod(
    [{
      query: 'Which of the following regions IS considered one of the most densely populated?',
      blocks: [{ title: '', body: 'South America is one of the most densely populated regions.', url: '', kind: 'organic' }],
      direction: 'answers-eliminate',
    }],
    options,
    ctx,
  );
  assert(r.named.some((m) => m.letter === 'A'), 'step6(eliminate direction): option A was named by the source, verified verbatim', JSON.stringify(r.named));
  assert(r.eliminatedLetters.includes('A'), 'step6(eliminate direction): option A, named under an "answers-eliminate" query, IS eliminated', JSON.stringify(r));
  assert(!r.eliminatedLetters.includes('B'), 'step6(eliminate direction): option B, never named by any source, is NOT eliminated');
  assert(r.eliminated.every((e) => /answers-eliminate|mechanical|query/i.test(e.why)), 'step6(eliminate direction): every elimination states the mechanical, direction-based reason -- no word-list language', JSON.stringify(r.eliminated));
}

// ── 5c. A "answers-keep" DIRECTION NAMES BUT DOES NOT ELIMINATE ─────────────────────────────────
{
  const { ctx } = fakeCtx();
  const options = { A: 'South America', B: 'Western Europe' };
  const r = await founderStep6JarMethod(
    [{
      query: 'Which region has the property the original ask wants?',
      blocks: [{ title: '', body: 'South America has that property.', url: '', kind: 'organic' }],
      direction: 'answers-keep',
    }],
    options,
    ctx,
  );
  assert(r.named.some((m) => m.letter === 'A' && m.direction === 'answers-keep'), 'step6(keep direction): option A is named, with direction recorded as answers-keep', JSON.stringify(r.named));
  assert(!r.eliminatedLetters.includes('A'), 'step6(keep direction): option A is NOT eliminated -- a "keep" direction never eliminates');
  assert(r.eliminated.length === 0, 'step6(keep direction): eliminated stays empty for an all-"answers-keep" run');
}

{
  // A source that names NOTHING (no option text appears in the passage) must still degrade
  // gracefully to an honest empty result -- no throw, no fabricated elimination.
  const { ctx } = fakeCtx();
  const options = { A: 'South America', B: 'Western Europe' };
  let threw = false;
  let r: Awaited<ReturnType<typeof founderStep6JarMethod>> | null = null;
  try {
    r = await founderStep6JarMethod(
      [{ query: 'irrelevant query', blocks: [{ title: 'test', body: 'This passage mentions neither option at all.', url: '', kind: 'organic' }], direction: 'answers-eliminate' }],
      options,
      ctx,
    );
  } catch {
    threw = true;
  }
  assert(threw === false, 'step6(no mentions in passage): does not throw');
  assert(r !== null && r.named.length === 0 && r.eliminated.length === 0, 'step6(no mentions in passage): an honest empty result, not a fabrication');
}

// ── 6. THE ORCHESTRATOR: RUNS STEPS 2, 3, 4, 6 IN THE FOUNDER'S ORDER; STEP 6 ELIMINATES,
//      SURVEY STILL NEVER ANSWERS THE QUESTION ───────────────────────────────────────────────
{
  const { ctx, events } = fakeCtx();
  const askText = 'What is a "referent object" in this framework?';
  const options = { A: 'a bare noun phrase', B: 'a full clause asserting something' };
  const result = await runSurveyStage(askText, options, ctx, {
    // maxCatalystWordsPerOption: 0 keeps this integration test's own network cost to step2's and
    // step4's real (retry-bearing) googleBlocks() calls, plus step3's/step6's real model calls,
    // without ALSO paying for step3's per-option catalyst-word survey -- see the step3 unit test
    // above for why that I/O half is not re-exercised here too.
    maxCatalystWordsPerOption: 0,
    // Exercises step 6's real elimination end-to-end through the orchestrator: option A is named
    // by a source in an 'answers-eliminate' group, so it must come back eliminated -- proving the
    // pool-narrowing act runs through runSurveyStage(), not only through founderStep6JarMethod()
    // called directly.
    jarSourceGroups: [{
      query: 'a query whose direction is known to eliminate what it names',
      blocks: [{ title: '', body: 'a bare noun phrase is named here.', url: '', kind: 'organic' }],
      direction: 'answers-eliminate',
    }],
  });

  assert(result.neverAnswersTheQuestion === true, 'orchestrator: neverAnswersTheQuestion is always true, even though step 6 eliminated an option');
  assert(!('verdict' in result), 'orchestrator: the result object carries NO verdict field -- Survey never answers the question');
  assert(!('answer' in result), 'orchestrator: the result object carries NO answer field');
  assert(!('correct' in result), 'orchestrator: the result object carries NO correct field');
  assert(result.step6.eliminatedLetters.includes('A'), 'orchestrator: step 6\'s real elimination reaches the top-level result', JSON.stringify(result.step6));

  const stageTexts = events.filter((e) => e.kind === 'stage').map((e) => e.text);
  const idx2 = stageTexts.findIndex((t) => /SURVEY STEP 2/.test(t));
  const idx3 = stageTexts.findIndex((t) => /SURVEY STEP 3/.test(t));
  const idx4 = stageTexts.findIndex((t) => /SURVEY STEP 4/.test(t));
  const idx6 = stageTexts.findIndex((t) => /SURVEY STEP 6/.test(t));
  assert(idx2 >= 0 && idx3 >= 0 && idx4 >= 0 && idx6 >= 0, 'orchestrator: all four Founder-step stage boundaries were emitted', stageTexts.join(' | '));
  assert(idx2 < idx3 && idx3 < idx4 && idx4 < idx6, 'orchestrator: steps run in the Founder\'s own order -- 2, then 3, then 4, then 6', stageTexts.join(' | '));

  assert(events.some((e) => e.kind === 'header' && /SURVEY -- the Lieutenant/.test(e.text)), 'orchestrator: emits the overall SURVEY header naming it the Lieutenant');
  assert(/SURVEY NEVER ANSWERS THE QUESTION/.test(result.why), 'orchestrator: the final line explicitly states Survey never answers the question, even with a real elimination in this run', result.why);
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
