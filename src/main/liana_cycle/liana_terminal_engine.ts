// liana_terminal_engine.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// THE LIANA CYCLE TERMINAL'S ENTRY POINT -- now a METHOD REGISTRY dispatcher, not a single
// hardcoded cascade. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149.eblet.md
// Founder, BP149, verbatim: "put this engine behind the terminal, so I just type the
// question... exactly... I guide, I train, I give the Human Nuance, and you record (through
// Mnemosynec) and learn and apply... the POINT is that that won't cover EVERY question. But I
// will. And so will other human operators, which will teach the Substrate in the Cooperative."
//
// THIS FILE REPLACES the previous liana_terminal_engine.ts (D-BP149-034), which was a port of
// an OLDER, INCOMPLETE cascade (stages 0/1/2/5 only, one hardcoded elimination path applied to
// every question regardless of shape). BP149 measured that cascade against six real questions
// and found it terminates on exactly one of them (qid 98, the only one with an orderable
// property) -- the other five have no property to rank and would silently abstain or, worse,
// run the ranking machinery on a question it does not fit and produce confident nonsense. The
// fix is not a better cascade; it is knowing WHEN a cascade applies at all. See the canon above
// for the full ruling.
//
// WHAT THIS FILE DOES NOW: parses the Founder's input (a bundled qid, or free text with
// optionally embedded lettered options), asks EVERY registered method's shapeTest() whether it
// fits, and either (a) runs the one method that matches, (b) reports a known-but-unimplemented
// method matched (a stub, e.g. definitional-cascade today), or (c) says plainly that no method
// fits, lists what IS on file and why none applied, and invites the Founder to work the
// question by hand -- never runs a method whose shape test failed. See method_registry.ts for
// the registry itself and src/main/liana_cycle/methods/*.ts for the two methods this ticket
// registers.
//
// DOES NOT TOUCH src/main/plow/plow_mc_answerer.ts. Fully separate module, separate engine.
// index.ts's IPC wiring ('liana-terminal-run' handler, the heartbeat write after this resolves)
// is UNCHANGED by this ticket -- runLianaCycleQuestion's signature is byte-identical to the
// file it replaces, so nothing outside this directory needed to change.

import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { app } from 'electron';
import type { LianaSc01Result, LianaTerminalEvent, LianaTerminalOutcome } from '../../shared/liana_cycle/liana_terminal_types';
import { explainSelection, listMethods, selectMethod } from './method_registry';
// D-BP150-003 -- the Demand Test. Runs before method selection; see its own header for exactly
// which half of the canon it implements and which half is still a scaffold.
// D-BP152-039 REMOVAL: `determineDemand` (the CUES-table lookup) is no longer imported here -- its
// only call site in this file was the removed `else` branch (see runLianaCycleQuestion()'s own
// D-BP152-039 comment, below); demand_test.ts itself is untouched, and other callers of
// determineDemand() elsewhere in the estate are unaffected.
// D-BP153-001 adds determineDemandFromQuestionStructure -- the LAST-RESORT structural path, tried
// only after all three surveyed-ask derivations refuse. See its own header in demand_test.ts.
import { describeDemand, determineDemandFromAmbiguityNested, determineDemandFromOperationAnswer, determineDemandFromQuestionStructure, determineDemandFromSurveyedAsk } from './demand_test';
import type { DemandResult } from './demand_test';
import type { AskGoogleFn, ConversationalAuthorityFn, EmitFn, MethodQuestionInput, MethodRunContext, OwnedPassage } from './method_registry';
// D-BP154-008/BISHOP/S8/seg-mortgage, ADDITIVE. THE MORTGAGE -- see cross_acquisition.ts's own
// header for the full ruling (FD-BP153-04 boundary 4, lifted). The ONE call site below (this
// file's own `ownedPassages()` builder) is the sole consumer of this import.
import { buildPriorAcquisitionOwnedPassages } from './evidence/cross_acquisition';
// D-BP151-026/BISHOP/seg-contingency-operator (Contingency Operator: Survey Splice), ORIGIN.
// Founder, BP151, Q-20: "This is a case for Contingency Operators. Do it, and see if it works
// before I ratify." runSurveyStage() (Founder steps 2, 3, 4, 6) was built D-BP151-025 but never
// spliced into this dispatcher -- see survey_stage.ts's own header, "NOT WIRED INTO
// liana_terminal_engine.ts's DISPATCH BY THIS TICKET". D-BP152-039 REMOVAL: this import used to
// be gated by isContingencyOperatorSurveySpliceEnabled() (a boolean param + env-var gate that
// defaulted OFF); per FD-BP152-20/FD-BP152-09 that gate is REMOVED and runSurveyStage() is now
// called unconditionally, every run -- see runLianaCycleQuestion()'s own D-BP152-039 comment.
import { runSurveyStage } from './survey_stage';
import type { SurveyStageResult } from './survey_stage';
// D-BP164-M0-046/BISHOP/M0/seg-survey-gating-and-cost-wiring. Two ADDITIVE modules: the cache
// half of BP158's "cache forever" ruling (survey_cache.ts), and the production wiring of
// D-BP159-009_cost_axis.js's own dollar-priced Google leg (cost_instrument.ts, D-BP164-M0-044's
// own measured gap). See resolveSurveyEnabled() and the Survey call site below for the gate this
// restores, and the runLianaCycleQuestion() outer wrapper below for the cost-ledger wiring.
import { surveyCacheKey, safeDefaultSurveyCacheStore } from './survey_cache';
import type { SurveyCacheStore } from './survey_cache';
import { wrapAskGoogleWithCostInstrument, summarizeGoogleCostLedger, runWithLlmCostLedger, summarizeLlmCostLedger } from './cost_instrument';
import type { GoogleCallCostRecord } from './cost_instrument';
// D-BP152-016/BISHOP/seg-sc01-wire-and-score. Scores what Survey (immediately above) already
// produced -- no new query, no model call, no altered control flow. REUSED, not forked: this is
// the exact scoreSc01PivotTerms() built and committed at D-BP152-015 (f66c4386), unmodified.
import { scoreSc01PivotTerms } from './sc01_pivot_terms_scorer';
// D-BP150-001 (Call an Audible). See audible.ts's header for why this is a decorator around the
// injected askGoogle rather than a restructuring of the method modules.
import { AudibleAbandoned, AudibleLog, wrapAskGoogleWithAudible } from './audible';
import type { AudibleChannel } from './audible';
// D-BP151-023 (Stepped Audible). See stepped_audible.ts's header for why this is a SECOND,
// separate decorator (per-Founder-step granularity) rather than a replacement for the per-call
// one above, and for why it is scoped to the comparative-cascade method only.
import { SteppedAudibleAbandoned, SteppedAudibleLog, buildUpfrontStepList, requestStepZeroPause, wrapForSteppedAudible } from './stepped_audible';
import type { SteppedAudibleChannel } from './stepped_audible';
// D-BP152-051/BISHOP/seg-assisted-mode (Assisted Mode). See assisted_mode.ts's header for why
// this is a THIRD, independent decorator around the same injected askGoogle parameter -- not a
// combination of, or a replacement for, Call an Audible or Stepped Audible above. Founder ruling,
// BP152, verbatim: "Yes make it a mode. But also, can we not automate WHILE using that mode?"
import { AssistedModeAbandoned, AssistedModeLog, normalizeRunMode, wrapAskGoogleWithAssistedMode } from './assisted_mode';
import type { RunMode } from './assisted_mode';
// Registering a method is a side effect of importing its module (see each file's own
// `registerMethod(...)` call at the bottom). Both are imported here, and ONLY here, so the
// registry is fully populated before the first `runLianaCycleQuestion` call, regardless of
// which other file happens to import this one first.
import './methods/comparative_cascade';
import './methods/definitional_cascade';
// D-BP152-035 (Stage 1/3) -- THE CLASSIFY CASCADE, demand: 'CLASSIFY'. Wired here so it is
// reachable the same way as the other two methods (built but not wired is the Founder's own
// standing complaint, FD-BP152-08); see classify_cascade.ts's own header for the ruling this
// implements.
import './methods/classify_cascade';
// D-BP153-008 -- the three demand types with no runner (IDENTIFY, INFER, LOCATE-IN-FRAMEWORK),
// registered with `run: null` so a question demanding one of them reports "recognized shape, not
// yet taught" instead of "no method matches". Those are different findings and this registry's own
// header (method_registry.ts:30-35) requires keeping them apart. A live qid 98 run ended
// `no_method_matched` on exactly this gap. See untaught_shapes.ts for why no runners were invented.
import './methods/untaught_shapes';

// Re-exported so index.ts's existing closure (`(question) =>
// runBrowserAuthorityQueryFromMain({...})`) keeps type-checking against exactly the same shape
// it always has -- this ticket does not change index.ts.
export type { AskGoogleFn, EmitFn };

function nowIso(): string {
  return new Date().toISOString();
}
function say(emit: EmitFn, text: string): void {
  emit({ kind: 'header', text, ts: nowIso() });
}
function note(emit: EmitFn, text: string): void {
  emit({ kind: 'note', text, ts: nowIso() });
}

/** D-BP152-049 STAGE 3/4. What "state the question" produces -- extracted verbatim from STEP 0's
 *  own inline block below (unchanged in content or order) so a NameNumbered 'StateTheQuestion:1'
 *  Composer step (library/state_the_question_step.ts) can call the EXACT SAME logic rather than a
 *  second transcription of it. Founder, BP152, verbatim: "I think we need to add a step 'State
 *  the Question'... I still think we need it so I can add it to my stack, just in case I want to
 *  go back to it in the same sequence script I make; or any other purpose." */
export interface StateTheQuestionResult {
  source: string;
  question: string;
  options: Record<string, string> | null;
  optionsExist: boolean;
  qid?: number;
}

/** Emits the SAME stage/say/note lines Step 0 always has, in the SAME order, and returns the SAME
 *  state either caller reads: the question verbatim, its options verbatim (or an honest note that
 *  none exist), the options-exist flag, and the source. Pure aside from the `emit` calls -- no
 *  Google call, no pause, no mutation of anything outside the events it emits. `input` is
 *  intentionally the same shape MethodQuestionInput already carries (qid?, question, options), so
 *  script_bridge.ts's runOneStep() (which already has a MethodQuestionInput in hand) can call this
 *  directly with no reshaping. */
export function emitStateTheQuestion(
  emit: EmitFn,
  input: { qid?: number; question: string; options: Record<string, string> | null },
): StateTheQuestionResult {
  const source = input.qid != null
    ? `qid ${input.qid} (bundled MMLU-Pro corpus, resources/mmlu_pro_bundled/questions.jsonl)`
    : 'free text (not in the bundled corpus)';
  const optionsExist = input.options != null;
  emit({
    kind: 'stage',
    text: '-> STEP 0 -- STATE THE QUESTION, FULLY (Founder, BP152, verbatim: "Remember. the FIRST thing to do is to state the question, fully." FD-BP152-14)',
    ts: nowIso(),
  });
  say(emit, input.qid != null ? `qid ${input.qid}` : 'free-text question');
  note(emit, `   SOURCE: ${source}`);
  note(emit, `   QUESTION (verbatim, complete): ${input.question}`);
  note(emit, `   OPTIONS EXIST: ${optionsExist}`);
  if (input.options) {
    note(emit, `   OPTIONS (verbatim, complete): ${Object.entries(input.options).map(([k, v]) => `${k}) ${v}`).join('  ')}`);
  } else {
    note(emit, '   (no lettered option list -- typed as a bare question)');
  }
  return { source, question: input.question, options: input.options, optionsExist, qid: input.qid };
}

// D-BP152-039/BISHOP/seg-gate-removal-and-sigfigs, STAGE 1 -- THE GATE IS REMOVED, NOT DEFAULTED
// ON. Founder, BP152, verbatim (FD-BP152-20): "fix the gate properly so survey doesn't need the
// env var." And, the architecture ruling that makes it a removal rather than a flip:
// FD-BP152-09, verbatim: "Survey needs to just be a method step, that I can apply or not, as part
// of a script that is applied... There are no modes and no flags."
//
// WHAT USED TO LIVE HERE: isContingencyOperatorSurveySpliceEnabled(contingencyOperatorSurvey),
// a boolean-param-plus-CONTINGENCY_OPERATOR_SURVEY_SPLICE-env-var gate that defaulted OFF.
// D-BP152-012 removed its UI control per the Founder's ruling that the splice is not a button --
// which left a flag with no switch, reachable only by hand-typing the env var. Per FD-BP152-09
// (no modes, no flags) SURVEY IS SIMPLY PART OF THE ACCEPTED SCRIPT: it runs on every run, always.
// The function, the env var, and every read of either are REMOVED, not renamed and left OFF.
//
// DISCLOSED REGRESSION RISK (carried from the earlier pass of this ruling and still true):
// turning Survey on for every run may change results on questions that previously reached a
// method via the CUES table (determineDemand(), demand_test.ts) -- the OFF path below (which used
// to call that table INSTEAD of Survey) no longer exists; every run now derives DEMAND from the
// surveyed ask. A regression risk the Founder has been told about, not hidden.

/** D-BP151-032/BISHOP/seg-ambiguity-to-demand: resolves SURVEY STEP 2's ambiguity-query transport.
 *  Same param+env-var `isXEnabled()` shape as isContingencyOperatorSurveySpliceEnabled() above --
 *  the pattern the Founder named to match -- but the POLARITY IS NOT FLIPPED this time: undefined
 *  (and no `AMBIGUITY_QUERY_TRANSPORT=gemma` override) resolves to 'google', the SHIPPED default,
 *  matching every OTHER cited resolver's "undefined = the shipped behavior" direction.
 *
 *  ATTRIBUTED: Founder, BP151, relayed addendum, verbatim: "I want to always run it on google,
 *  which should be the default that can be changed in Mnemosynec at will." An explicit `'gemma'`
 *  argument (only reachable today via index.ts's IPC parameter -- see this ticket's return,
 *  "THINGS I NOTICED AND DID NOT DO", for why no renderer UI control was added) or the env
 *  override selects the local model instead. This function only routes; it never falls back on
 *  its own -- if Google is unreachable, askAmbiguity() (survey_stage.ts) refuses rather than
 *  silently trying 'gemma'. UNCHANGED by D-BP152-039 -- that ticket removes the OTHER gate
 *  (Survey Splice, below this function's former neighbor) per FD-BP152-20; this transport gate
 *  and its env var are explicitly out of that ticket's scope ("Do NOT touch... the transports"). */
function resolveAmbiguityQueryTransport(ambiguityQueryTransport: 'google' | 'gemma' | undefined): 'google' | 'gemma' {
  if (ambiguityQueryTransport === 'gemma') return 'gemma';
  if (ambiguityQueryTransport === 'google') return 'google';
  if (process.env.AMBIGUITY_QUERY_TRANSPORT === 'gemma') return 'gemma';
  return 'google';
}

// D-BP164-M0-046/BISHOP/M0/seg-survey-gating-and-cost-wiring -- THE GATE IS RESTORED, WITH THE
// OPPOSITE DEFAULT FROM BEFORE. D-BP152-039 (FD-BP152-20/FD-BP152-09, "no modes and no flags")
// made Survey run unconditionally and REMOVED the gate that used to sit here, not merely turned
// it off. BP150's own ratified R-1 (canon_liana_methods_are_compositions_of_named_elements_
// bp150.eblet.md): "Survey runs unconditionally, before method selection, and its output feeds
// every shapeTest()." That is what D-BP152-039 built, correctly, per that ruling.
//
// BP158, LATER, after a REAL Google throttle at ~18 consecutive queries (canon_survey_sparingly_
// cache_forever_bp158vault.eblet.md), reversed the SPIRIT of R-1 without anyone updating this
// call site: Founder, verbatim, quoted in that canon: "I don't want to apply methods
// indiscriminately to all the questions... AND we DON'T really need to, to denote all the
// answers, before we apply." Tonight, BP164, restated live and even more directly: "I don't want
// to automatically run survey, it uses google calls without purpose, and the Liana Cycle explains
// this." THE LATER RULING GOVERNS -- this function implements BP158/BP164, not R-1's
// "unconditionally", as the record now states it.
//
// D-BP164-M0-044 measured (and this ticket's own dispatch repeats): BP158's own text names WHAT
// to cut (survey scope: "only the terms the current decision actually turns on") and orders
// caching ("cache forever"), but it never states a precise, code-checkable CONDITION for "this
// question does or does not need a live Survey call". Inventing one (e.g. "skip Survey when a
// method is already known") was flagged unratified by the prior dispatch and is NOT invented
// here either. What ships instead, exactly as this ticket's own order requires: the cache (see
// survey_cache.ts, always consulted first, REGARDLESS of this flag -- a cache hit costs nothing,
// so BP158's "sparingly" has no argument against reusing a free answer) plus this EXPLICIT
// opt-in flag, DEFAULT OFF. The gating condition itself (when should a FRESH, uncached question
// survey automatically) is left on the Founder's desk -- see this ticket's own return.
//
// `surveyEnabled` reuses the exact parameter this file has threaded end-to-end since D-BP151-026
// under the name `contingencyOperatorSurvey` (renderer -> preload -> index.ts -> here) --
// D-BP152-039 left it ACCEPTED-AND-IGNORED rather than delete it precisely so a future ticket
// could revive it without touching every lockstep caller; this is that ticket. NO caller
// (index.ts, preload.ts, LianaCycleTab.tsx, script_bridge.ts) needed to change: the parameter is
// positional, and the one live caller (index.ts's 'liana-terminal-run' handler) already passes
// whatever the renderer sends, which is `undefined` on every build (its own UI control was
// removed D-BP152-012 and never rebuilt) -- so production gets the new default, OFF, for free.
function resolveSurveyEnabled(surveyEnabled: boolean | undefined): boolean {
  if (surveyEnabled === true) return true;
  if (surveyEnabled === false) return false;
  if (process.env.LIANA_SURVEY_ENABLED === '1') return true;
  return false;
}

/** Empty, structurally-valid stand-ins for the four Survey sub-results, used ONLY on the
 *  SKIPPED (opt-in flag OFF, no cache hit) path so every downstream reader of `surveyResult`
 *  (demand derivation, SC-01 scoring) sees a real, honestly-labeled "nothing surveyed" value
 *  instead of a crash or an undefined. Mirrors the EXACT shape survey_stage.ts's own runSurveyStage()
 *  already uses for its own "SKIPPED" step3 case (FD-BP152-01/D-BP153-017) -- not a new pattern. */
function buildSkippedSurveyResult(askText: string): SurveyStageResult {
  const why = 'SURVEY SKIPPED -- the opt-in flag (surveyEnabled) is OFF and no cached answer exists for this '
    + 'exact question (BP158/BP164: "I don\'t want to automatically run survey, it uses google calls without '
    + 'purpose"). Zero Google calls were made. DEMAND falls through to the structural path or reports UNKNOWN, '
    + 'exactly as it does on a live Survey run that resolves no term.';
  return {
    askText,
    term: null,
    termWhy: why,
    step2: { term: null, nested: null, ambiguity: null, ambiguityNested: [], negationNamed: false, constraints: [], operation: null, thresholdQuestions: [], why },
    step3: { perOption: null, grouping: null, why },
    step4: { term: null, field: null, verified: false, why },
    step6: { named: [], eliminated: [], eliminatedLetters: [], why },
    askNegated: false,
    neverAnswersTheQuestion: true,
    why,
  };
}

/** D-BP152-011/BISHOP/seg-splice-toggle -- WHICH OF THE THREE INPUTS ACTUALLY GOVERNED THIS RUN.
 *  Founder, BP152, verbatim ask: "so can you make the one line change. or tell me what button to
 *  push to make it so." Neither gate above tracked this before this ticket -- they only ever
 *  returned the resolved value, not which precedence rung produced it. FD-BP152-07 requires every
 *  run to record what governed it; against a 44% single-run noise floor (feedback_never_cite_a_
 *  single_run_receipt_noise_floor_bp149.md) nobody could otherwise tell a UI toggle from drift.
 *  Read-only -- mirrors each resolver's own precedence exactly and calls neither resolver's
 *  behavior into question. `uiExplicit` is true only when the caller passed a value the resolver
 *  itself treats as an override (contingencyOperatorSurvey===true; ambiguityQueryTransport==='google'
 *  or 'gemma'); `envOn` is the resolver's own env-var check, reused verbatim. */
function resolveGateSource(uiExplicit: boolean, envOn: boolean): 'ui' | 'env' | 'default' {
  if (uiExplicit) return 'ui';
  if (envOn) return 'env';
  return 'default';
}

// D-BP152-039 REMOVAL -- getLianaTerminalGateEnvState() used to live here: read-only
// introspection of the Survey Splice env var (removed above, FD-BP152-20) plus the ambiguity
// transport env var, for a renderer toggle to show effective env state before a run. Its own UI
// control (D-BP151-026's Survey Splice toggle) was already removed by D-BP152-012, and grep
// confirms no renderer file ever called `window.electronAPI.lianaTerminalGateEnvState()` --
// zero callers, so removing it breaks nothing. Removed together with its 'liana-terminal-run'
// sibling IPC handler ('liana-terminal-gate-env-state', index.ts) and its preload.ts/amplify.d.ts
// declarations, rather than left calling a gate that no longer exists (that would itself be the
// "dead flag left behind" this stage's own VERIFY section forbids).

// ─────────────────────────── bundle lookup (unchanged convention) ───────────────────────────

interface BundledQuestion {
  question_id: number;
  question: string;
  options: string[];
  answer: string;
  category?: string;
  /** D-BP154-030/BISHOP-SEG/S30/seg-humannuance, ADDITIVE/OPTIONAL. Backfilled offline by
   *  scripts/backfill_mmlu_pro_origin_src.mjs for the standing 20 (HARDWIRE-01 line 242) -- the
   *  MMLU-Pro item's own stated origin (e.g. "ori_mmlu-high_school_geography"), read live from
   *  TIGER-Lab/MMLU-Pro's own `src` column, never re-derived. Absent on every row this pass has
   *  not touched. See that script's header for the full mechanism and
   *  resources/mmlu_pro_bundled/origin_provenance/ for the fuller provenance record this field
   *  only points into. */
  origin_src?: string;
}

function resolveBundledDatasetPath(): string {
  const packaged = typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'mmlu_pro_bundled', 'questions.jsonl')
    : null;
  if (app.isPackaged && packaged) return packaged;
  return resolve(app.getAppPath(), 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
}

function loadQuestion(qid: number): BundledQuestion | null {
  const bundlePath = resolveBundledDatasetPath();
  if (!fs.existsSync(bundlePath)) return null;
  const rows = fs
    .readFileSync(bundlePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as BundledQuestion);
  return rows.find((r) => r.question_id === qid) ?? null;
}

const letter = (i: number) => String.fromCharCode(65 + i);

// ─────────────────────────── input parsing ───────────────────────────
// THE INPUT IS A QUESTION. The Founder types a question (or a qid); both are accepted. A qid
// loads its real options from the bundled corpus. Free text may carry its own lettered option
// list inline ("Question text? A) foo B) bar C) baz", the same shape the Founder's own
// hand-worked questions already use, e.g. qid98_his_words.mjs's `list()` helper) -- when at
// least two `L)` markers are found, everything before the first one is the question and each
// marker starts that option's text. Free text with no lettered options at all has no option
// pool for any registry method to eliminate among; it is handled honestly in the "no method
// matches" branch below, not silently answered as a bare fact lookup (that generic fallback is
// exactly what the BP149 ruling replaces -- see this file's header).

// D-BP152-043/BISHOP/seg-scratch-composer -- EXPORT ONLY, ADDITIVE, NO BEHAVIOR CHANGE. `export`
// added to this pre-existing interface and the two functions below it so
// library/script_bridge.ts (the composer's IPC entry) can parse the operator's typed input the
// SAME way runLianaCycleQuestion() always has, rather than re-deriving a second parser -- the
// same "don't build a second one" discipline this ticket's dispatch was told to follow for
// script.ts/script_runner.ts. Neither function's body, nor ParsedInput's shape, is touched; every
// call site inside this file (parseQid/parseFreeText calls a few lines below) is unchanged.
export interface ParsedInput {
  qid?: number;
  question: string;
  options: Record<string, string> | null;
  correctAnswer?: string;
  qidNotFound?: boolean;
  /** D-BP154-030, ADDITIVE/OPTIONAL -- see BundledQuestion.origin_src above and
   *  MethodQuestionInput.originSrc (method_registry.ts) for the full chain this is threaded
   *  through. Undefined for free-text input and for any bundled qid not yet backfilled. */
  originSrc?: string;
  /** D-BP154-041/BISHOP-SEG/S41/seg-purpose, ADDITIVE/OPTIONAL. FD-BP154-16: the artifact's own
   *  stated `category` field (BundledQuestion.category, already on disk, never invented) is one of
   *  the three admissible sources for a Question Purpose candidate ("the question's own stem...
   *  the artifact's `src`... and its category -- all stated fields"). Threaded through the exact
   *  same optional-field discipline `originSrc` already established just above: undefined for
   *  free-text input or a row with no `category` on file, never guessed. Only purpose_step.ts
   *  reads this field. */
  category?: string;
}

export function parseQid(qid: number): ParsedInput {
  const q = loadQuestion(qid);
  if (!q) return { qid, question: '', options: null, qidNotFound: true };
  const opts: Record<string, string> = {};
  q.options.forEach((o, i) => { opts[letter(i)] = o; });
  return {
    qid, question: q.question, options: opts, correctAnswer: q.answer, originSrc: q.origin_src,
    category: q.category,
  };
}

export function parseFreeText(input: string): ParsedInput {
  const markerRe = /(?:^|\s)([A-J])\)\s*/g;
  const matches = [...input.matchAll(markerRe)];
  if (matches.length < 2) return { question: input, options: null };
  const first = matches[0];
  const question = input.slice(0, first.index).trim();
  const options: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const L = m[1];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? input.length : input.length;
    options[L] = input.slice(start, end).trim();
  }
  return { question: question || input, options };
}

// ─────────────────────────── entry point ───────────────────────────

/** Runs one question through the terminal: parse the input, ask the method registry which
 *  (if any) registered method fits its shape, and either run that method, report a
 *  known-but-unimplemented match, or say plainly that nothing fits and invite the Founder to
 *  teach the next one. Never runs a method whose shape test failed. Never throws -- an internal
 *  failure is reported as an 'error' event plus an abstained outcome, matching this estate's
 *  honest-abstain-over-fabrication rule. */
async function runLianaCycleQuestionInner(
  input: string,
  askGoogle: AskGoogleFn,
  emit: EmitFn,
  /** D-BP150-001 (Call an Audible), ADDITIVE/OPTIONAL. Null or omitted = audible mode OFF, in
   *  which case wrapAskGoogleWithAudible returns `askGoogle` itself by reference and this run is
   *  byte-for-byte the run it would have been before this parameter existed. Every pre-audible
   *  caller keeps compiling and behaving identically. */
  audible?: AudibleChannel | null,
  /** D-BP151-023 (Stepped Audible), ADDITIVE/OPTIONAL. Null or omitted = stepped mode OFF, in
   *  which case wrapForSteppedAudible() returns the SAME MethodRunContext object by reference and
   *  this run is byte-for-byte the run it would have been before this parameter existed. Every
   *  pre-stepped-audible caller (including one that only ever passed `audible`) keeps compiling
   *  and behaving identically. Independent of `audible` above -- either, both, or neither may be
   *  armed; see stepped_audible.ts's header for what combining them does and does not change. */
  steppedAudible?: SteppedAudibleChannel | null,
  /** D-BP164-M0-046 REVIVAL, ATTRIBUTED (BP158 + tonight's live BP164 restatement: "I don't want
   *  to automatically run survey, it uses google calls without purpose"). NO LONGER ACCEPTED-AND-
   *  IGNORED -- see resolveSurveyEnabled() (above in this file) for the gate this now drives.
   *  `undefined`/omitted (every existing caller today -- the renderer control that used to set
   *  this was removed D-BP152-012 and never rebuilt) or explicit `false` = Survey does NOT run a
   *  fresh live query for this run; a CACHED prior answer for this exact question is still used
   *  if one exists (survey_cache.ts, unconditional, BP158 "cache forever"). Explicit `true`, or
   *  `LIANA_SURVEY_ENABLED=1`, re-arms the D-BP152-039 unconditional-per-run Survey behavior this
   *  parameter used to be ignored under. DISCLOSED REGRESSION RISK, carried forward and reversed
   *  in direction from D-BP152-039's own disclosure: every run that does NOT explicitly opt in
   *  (which, as of this ticket, is every existing production caller) now derives DEMAND without
   *  Survey's surveyed-ask/operation/ambiguity paths -- only the UNCHANGED structural path
   *  (determineDemandFromQuestionStructure()) can still resolve a demand; every other question
   *  reports DEMAND UNKNOWN honestly rather than fabricating one. This is the Founder's own
   *  ordered tradeoff (fewer unwanted Google calls, more honest abstains), not a bug. */
  contingencyOperatorSurvey?: boolean,
  /** D-BP151-032, ADDITIVE/OPTIONAL. Only consulted when `contingencyOperatorSurvey` is on (SURVEY
   *  STEP 2's ambiguity query does not run at all otherwise). undefined = resolveAmbiguityQueryTransport()'s
   *  default, 'google' (Founder-ordered, relayed BP151 addendum: "I want to always run it on
   *  google, which should be the default that can be changed in Mnemosynec at will."); 'gemma' (or
   *  the AMBIGUITY_QUERY_TRANSPORT=gemma env override) selects the local model instead. Every
   *  pre-existing caller (which passes nothing for this parameter) is unaffected on the OFF path
   *  and gets the new Google default on the ON path -- there is no prior behavior to preserve here
   *  since this parameter and the ambiguity-to-demand wiring it feeds ship together. */
  ambiguityQueryTransport?: 'google' | 'gemma',
  /** D-BP152-044/BISHOP/seg-last-mile-gemini, ADDITIVE/OPTIONAL. Founder, BP152, verbatim ruling:
   *  "fix the last mile - let the liana cycle ask gemini". Undefined for every caller that does
   *  not pass it (byte-identical to before this ticket -- SURVEY's own askAmbiguity()/
   *  askOperation() (survey_stage.ts) go straight to Google when this is absent, exactly as they
   *  always have). When present, threaded straight into SURVEY's own MethodRunContext (below) so
   *  its two META-questions (the ambiguity query, the operation query) try this FIRST and fall
   *  back to Google -- see survey_stage.ts's obtainMetaQuestionPassage() for the full ruling.
   *  index.ts's 'liana-terminal-run' handler is the one caller that supplies this; the Composer's
   *  own runScratchComposer() call site (library/script_bridge.ts, this ticket's own FORBIDDEN
   *  "script runner") is untouched and simply never passes it. */
  askConversationalAuthority?: ConversationalAuthorityFn,
  /** D-BP152-051 (Assisted Mode), ADDITIVE/OPTIONAL. Undefined/omitted or 'automated' (the
   *  default) = today's behavior, byte-identical to before this ticket -- see this file's own
   *  runLianaCycleQuestion() wrapper (below) for the ONE place `mode` is normalized and stamped
   *  onto the outcome, and assisted_mode.ts's header for why 'assisted' never falls back to
   *  automated silently even if `assistedChannel` is missing (checked immediately below). */
  mode?: RunMode,
  /** D-BP152-051, ADDITIVE/OPTIONAL. The pause channel assisted mode raises its per-call pauses
   *  on -- SAME SteppedAudibleChannel type and SAME IPC round trip `steppedAudible` above already
   *  uses (see assisted_mode.ts's header: reused capture path, not a second one), but gated
   *  INDEPENDENTLY of `steppedAudible` -- assisted mode must not silently depend on the Stepped
   *  Audible bench toggle also being on. Only consulted when `mode === 'assisted'`. */
  assistedChannel?: SteppedAudibleChannel | null,
  // D-BP154-008, ADDITIVE/OPTIONAL, placed LAST -- see runLianaCycleQuestion()'s own D-BP154-008
  // comment on this same parameter, above, for the full ruling.
  currentAcquisitionId?: string,
  /** D-BP164-M0-046, ADDITIVE/OPTIONAL, placed LAST -- same "no existing call site shifts
   *  meaning" convention as currentAcquisitionId above. Undefined for every existing caller
   *  (index.ts's IPC handler, every pre-existing test): the Survey call site below then
   *  constructs the real, disk-persisted FileSurveyCacheStore itself (survey_cache.ts's own
   *  defaultSurveyCacheFilePath(), lazily, so `electron.app` is never touched by a caller that
   *  never reaches this branch). A caller that supplies its own store (every fixture test this
   *  ticket adds) gets a fully isolated, disk-free cache -- no test can pollute or be polluted by
   *  the real production cache file, and no test needs to mock `electron` merely to exercise the
   *  cache-hit path. */
  surveyCache?: SurveyCacheStore,
): Promise<LianaTerminalOutcome> {
  const trimmed = input.trim();
  const runMode = normalizeRunMode(mode);
  // FOUNDER, BP152, verbatim: "if they can just turn off the spigot, then nothing works." A run
  // ordered into assisted mode with no channel to pause on must NEVER silently continue as
  // automated -- that would be exactly the silent degrade his ruling forbids. Fails loudly and
  // honestly (an abstain naming why), never falls through to issuing a request itself.
  if (runMode === 'assisted' && !assistedChannel) {
    emit({
      kind: 'error',
      text: 'ASSISTED MODE requested but no assisted-mode channel is available -- refusing to fall back to automated mode (that would be the exact silent degrade the Founder\'s ruling forbids, RULINGS_BP152.md). Nothing was sent to Google.',
      ts: nowIso(),
    });
    return {
      question: trimmed,
      verdict: null,
      abstain: true,
      freeText: !/^\d+$/.test(trimmed),
      error: 'assisted_mode_channel_unavailable',
      options: null,
      mode: runMode,
    };
  }
  const resolvedAmbiguityQueryTransport = resolveAmbiguityQueryTransport(ambiguityQueryTransport);
  // D-BP152-039 REMOVAL -- `contingencyOperatorSurveyOn`/`variant`/`contingencyOperatorSurveySource`
  // used to live here, gating Survey behind a boolean. Per FD-BP152-20/FD-BP152-09 the gate is
  // removed, not defaulted on: Survey runs unconditionally below, so there is nothing left to
  // resolve, source, or tag a `variant` literal with. `outcome.variant` on the RETURN statements
  // below is no longer ever forced to `'contingency-operator-survey-splice'` by this function --
  // it is left to whatever the selected method itself set (e.g. comparative_cascade.ts's OWN,
  // separate 'contingency-operator-abstain-clues' variant, untouched by this ticket) via the
  // `...outcome` spread each return already does; a run that reaches no method carries no variant
  // at all, honestly, since there is no longer a splice decision to report.
  const ambiguityQueryTransportSource = resolveGateSource(
    ambiguityQueryTransport === 'google' || ambiguityQueryTransport === 'gemma',
    process.env.AMBIGUITY_QUERY_TRANSPORT === 'gemma',
  );
  // Declared outside the try so the catch below can still return everything the operator typed
  // before they abandoned -- Founder, BP149: "a walk that throws away your annotations because
  // you quit early is worse than no walk."
  const audibleLog = new AudibleLog();
  const steppedLog = new SteppedAudibleLog();
  // D-BP152-051, ADDITIVE. Declared outside the try for the SAME reason audibleLog/steppedLog
  // are -- "keeps every note" (Founder, BP149) applies to an assisted-mode abandon exactly as it
  // does to the other two.
  const assistedLog = new AssistedModeLog();
  try {
    // D-BP152-051, LAW 5 (HARDWIRE-23: the receipt shows which rule fired). Requirement 2: "the
    // mode is recorded on every run, in the transcript and the receipt" -- this line is the
    // transcript half (index.ts's 'liana-terminal-run' handler already writes the full `events`
    // array as the receipt's transcript); `mode` on the returned LianaTerminalOutcome (stamped by
    // this file's own runLianaCycleQuestion() wrapper, below) is the receipt-field half. Emitted
    // UNCONDITIONALLY, on every run, so a later reader never has to infer automated from the
    // absence of an "assisted" line.
    note(emit, `   MODE: ${runMode.toUpperCase()} (D-BP152-051 -- ${runMode === 'assisted' ? 'the operator issues every query on his own browser; this app never sends one' : "today's automated behavior, the default"})`);
    // D-BP152-039 -- THE RECEIPT LINE, kept per Law 5 (HARDWIRE-23: the receipt shows which rule
    // fired) even though Survey is no longer optional: the transcript must still state that
    // Survey ran, so a reader never has to infer it from the absence of a "SURVEY SPLICE: OFF"
    // line that no longer exists. Ambiguity Transport (a SEPARATE, still-live gate, untouched by
    // this ticket) keeps its own source line exactly as before.
    note(
      emit,
      '   GATES -- Survey: ALWAYS ON (gate removed, FD-BP152-20 -- "fix the gate properly so survey '
      + `doesn't need the env var") · Ambiguity Transport: ${resolvedAmbiguityQueryTransport} `
      + `(source: ${ambiguityQueryTransportSource})`,
    );
    let parsed: ParsedInput;
    if (/^\d+$/.test(trimmed)) {
      parsed = parseQid(Number(trimmed));
      if (parsed.qidNotFound) {
        emit({ kind: 'error', text: `qid ${parsed.qid} not found in the bundled corpus (resources/mmlu_pro_bundled/questions.jsonl)`, ts: nowIso() });
        return { qid: parsed.qid, question: '', verdict: null, abstain: true, freeText: false, error: 'qid not in bundle', options: null };
      }
    } else {
      parsed = parseFreeText(trimmed);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────────
    // D-BP153-003 -- THE KEY SPLIT. THE ANSWER KEY IS NOW STRUCTURALLY OUT OF THE METHOD'S REACH.
    //
    // `parseQid()` attaches the bundled corpus's `answer` field as `correctAnswer`, and this
    // object used to carry it straight into every `shapeTest()` and every `run()`. The estate has
    // a standing rule against tuning toward the key, and it has been honored -- a BP153 audit of
    // all five `const KEY = input.correctAnswer` sites (classify_cascade.ts:914/969/1437,
    // comparative_cascade.ts:963, definitional_cascade.ts:204) found KEY used in exactly three
    // ways, ALL of them after the verdict already exists: printing `key=` in a result line,
    // computing `ok = verdict === KEY`, and setting `correct` on the returned outcome. It never
    // touched elimination, criteria selection, query construction, or pool filtering.
    //
    // So nothing is being fixed here. What is being removed is the POSSIBILITY. The rule was
    // enforced by discipline, and discipline is the layer that fails silently -- which is the
    // same lesson six days of silently-skipped commit guards taught this estate on the night this
    // was written. A method can no longer read the key because it is no longer handed one.
    //
    // WHY NO METHOD FILE NEEDED EDITING: every KEY use site was already written
    // `KEY != null ? ... : ...` to handle the free-text case, where there has never been a key.
    // Blinding the input simply puts every run on the path free-text runs always took.
    //
    // WHERE THE KEY STILL LIVES: with the ENGINE, which needs it to score, and which only ever
    // applies it AFTER `method.run()` has returned (see the reattachment at this function's
    // return). Scoring after the fact is structurally safe; handing the key to the thing being
    // scored is not.
    // ─────────────────────────────────────────────────────────────────────────────────────────
    const methodInput: MethodQuestionInput = {
      qid: parsed.qid,
      question: parsed.question,
      options: parsed.options,
      // correctAnswer deliberately NOT set. See the block comment above.
    };
    const freeText = parsed.qid == null;

    // D-BP152-051, THE ONE INJECTION POINT. Wrapping `askGoogle` HERE, before Step 0's pause,
    // before Survey's own MethodRunContext, and before the selected method's baseCtx (all three
    // below use `effectiveAskGoogle` from this point on, never the raw `askGoogle` parameter
    // directly) guarantees NO outbound Google request escapes assisted mode anywhere in this run
    // -- not the method's own queries, not Survey's two META-questions, not a Step-0 "ask Google
    // this" round -- without editing Step 0, Survey, or any cascade file. This is the SAME
    // decorator principle audible.ts's own header explains (D-BP149-041's MethodRunContext
    // injection point); the only difference is WHERE this ticket applies it -- once, at the
    // source, rather than only around the selected method's own context the way Call an Audible
    // does (see that decorator's own narrower scope, line ~695 below, which is intentionally NOT
    // extended to cover Survey -- not this ticket's concern, and not touched).
    // OFF-STAYS-IDENTICAL: `mode !== 'assisted'` (the default) means `wrapAskGoogleWithAssistedMode`
    // returns `askGoogle` ITSELF, by reference -- so `effectiveAskGoogle === askGoogle` on every
    // automated run and every one of this file's existing automated-mode behaviors, byte for
    // byte, is unchanged (see this ticket's own deliverable for the identity proof).
    const effectiveAskGoogle = wrapAskGoogleWithAssistedMode(
      askGoogle,
      runMode === 'assisted' ? (assistedChannel ?? null) : null,
      emit,
      assistedLog,
      parsed.options,
    );

    // D-BP152-019/BISHOP/seg-step-zero -- STEP 0: STATE THE QUESTION, FULLY (FD-BP152-14).
    // Founder, BP152, verbatim: "Remember. the FIRST thing to do is to state the question,
    // fully." Asked whether this is a new step before vetting or a correction to how step 1 was
    // recorded, he ruled: "The first is correct" -- its own step, preceding vetting, numbered
    // STEP 0 (not inserted as a new 1) so every existing Founder-step reference (STAGE 0 = step
    // 1, stepped_audible.ts's COMPARATIVE_CASCADE_STEP_DEFS, steps 13-18, etc.) keeps its number.
    //
    // WAS PREAMBLE BEFORE THIS TICKET: the two say()/note() lines this replaces ran before the
    // step list began, emitted no 'stage' boundary, and owned no state a scrub could return to.
    // This is now a real step on the SAME kind:'stage' convention every other step boundary in
    // this file already uses (e.g. '-> DEMAND TEST...' / '-> METHOD SELECTION...' below) -- no
    // new event kind invented. Its state snapshot is the note() lines immediately below the stage
    // line, the SAME emit()/note() mechanism every other transcript fact already uses to land in
    // the run receipt (no new receipt field, file, or directory -- index.ts's
    // 'liana-terminal-run' handler already writes the full `events` array as `transcript`).
    //
    // FD-BP152-14's minimum, and DELIBERATELY ONLY this much -- this does NOT design the general
    // step-state shape (candidate pool / denotations / demand / eliminations / discards,
    // LIANA_CYCLE_BENCH_SPEC.md §3.2); that is spec build item 4 and is out of this ticket's
    // scope:
    //   - the question text, verbatim and complete;
    //   - the option list, verbatim and complete, AND an explicit boolean for whether options
    //     exist at all -- Founder, FD-BP152-08: "with the question and the answer possibilties
    //     (if they exist, which they do on this one but on others may not)". A question with no
    //     options is a first-class case, handled explicitly below (OPTIONS EXIST: false plus the
    //     honest "(no lettered option list...)" line), not an edge case and not a silent empty
    //     list.
    //   - the source of the question (qid + corpus, or free text).
    // D-BP152-049 STAGE 3/4: the emit sequence and source/optionsExist computation below were
    // extracted, unchanged, into emitStateTheQuestion() (this file, above) so a NameNumbered
    // 'StateTheQuestion:1' Composer step can reuse the EXACT SAME logic rather than a second
    // transcription of it. This call site's own behavior is byte-identical to before extraction:
    // same events, same order, same `emitStep0` capture-then-forward wrapper below it.
    //
    // D-BP152-020/BISHOP/seg-pause-at-step-zero -- captured locally, in addition to being forwarded
    // to `emit` as always, so the STEP 0 pause below (when Call an Audible/Stepped Audible is on)
    // can present exactly the events this block produced -- the SAME verbatim/options-exist/source
    // state the transcript already carries, reused rather than re-derived a second time. `emitStep0`
    // changes NOTHING about what reaches the live transcript or the receipt: every event still goes
    // through the same `emit` this block always called, in the same order.
    const step0Events: LianaTerminalEvent[] = [];
    const emitStep0: EmitFn = (evt) => { step0Events.push(evt); emit(evt); };
    const step0State = emitStateTheQuestion(emitStep0, { qid: parsed.qid, question: parsed.question, options: parsed.options });
    const step0Source = step0State.source;
    const step0OptionsExist = step0State.optionsExist;

    // D-BP152-020/BISHOP/seg-pause-at-step-zero -- PAUSE AT STEP 0, BEFORE ANY WORK HAPPENS.
    // Founder, FD-BP152-08, verbatim: "it loads the question first. Then it tells me what the
    // next step WILL be." Nothing above this point has issued a Google call (Step 0 states the
    // question straight from parseQid()/parseFreeText(); Survey, the Demand Test and method
    // selection all run AFTER this point) -- so this is a genuine step boundary with no askGoogle
    // call for stepped_audible.ts's own buffer-then-flush mechanism to hang a pause on. See
    // requestStepZeroPause()'s own doc comment (stepped_audible.ts) for why it is a direct,
    // top-level `await` here instead of routed through wrapForSteppedAudible()/classifyStageText().
    // A true no-op (returns immediately, logs nothing) when `steppedAudible` is null -- the
    // OFF-stays-identical guarantee every other stepped/audible decorator in this file already
    // gives; every downstream line, branch and return statement is byte-identical whether this
    // call paused or not. Throws SteppedAudibleAbandoned on an 'abandon' response, caught by this
    // function's own existing catch block below (no new catch branch was added).
    if (steppedAudible) {
      note(emitStep0, '   STEPPED AUDIBLE is ON -- this run stops at STEP 0, before any query is issued, so you can see the question and its state before anything else happens. It waits until you respond; there is no timer.');
    }
    // D-BP152-021/BISHOP/seg-ask-google-this -- `askGoogle` (the raw, unwrapped injected
    // function -- the SAME channel every method call and Survey call already resolves to; Call an
    // Audible's per-call wrapper is applied later, only around the selected method's own context,
    // and is irrelevant here since Step 0 precedes method selection entirely), `emit` (so an
    // ask_google exchange reaches the SAME live transcript/receipt every other line already does),
    // and `parsed.options` (Step 0's own option pool, for the FD-BP152-15 contamination flag) are
    // all additive -- see requestStepZeroPause()'s own doc comment for why none of the three is
    // ever touched on the `steppedAudible == null` no-op path or on a run that never types
    // `ask_google`.
    await requestStepZeroPause(steppedAudible ?? null, steppedLog, step0Events, effectiveAskGoogle, emit, parsed.options);

    // D-BP164-M0-046 REVIVAL -- see resolveSurveyEnabled()'s own header (above in this file) for
    // the full ruling this restores: BP150 R-1 (unconditional) was correct when built, BP158 and
    // tonight's live BP164 restatement reversed its SPIRIT ("I don't want to automatically run
    // survey, it uses google calls without purpose"), and this call site was never updated until
    // now. Three paths below, in priority order: (1) a cached prior answer for this EXACT
    // question is always checked first and reused for zero calls, regardless of the flag --
    // BP158 "cache forever" has no argument against reusing a free answer; (2) the flag ON, no
    // cache hit -- runs Survey live, exactly as D-BP152-039 built it, then caches the result; (3)
    // the flag OFF (the default, and every existing production caller today), no cache hit --
    // Survey is skipped, zero Google calls, DEMAND falls through to the unchanged structural path
    // or reports UNKNOWN honestly.
    let demandResult: DemandResult;
    let surveyResult: SurveyStageResult;
    // D-BP152-016. Populated (or explicitly errored) below -- SC-01 scores FounderStep2Result,
    // which only Survey produces. Declared here so every return statement below this point can
    // carry it forward regardless of which path the run takes afterward (demand-unknown abstain,
    // method-not-taught abstain, or a real verdict).
    let sc01Result: LianaSc01Result | null = null;
    let sc01ScoringError: string | null = null;
    // D-BP152-016/BISHOP/seg-sc01-wire-and-score, EXTRACTED (unchanged logic, now callable from
    // both the cache-hit and the live-survey path below, so it is not duplicated). SC-01 scores
    // whatever FounderStep2Result this run ended up with -- no new query, no model call, byte-
    // identical whether scoring succeeds, finds nothing, or throws. GATED so a throw here can
    // never abort the run: "A scorer that can kill a run is worse than no scorer" (dispatch).
    const scoreSc01ForThisRun = (step2: SurveyStageResult['step2']): void => {
      try {
        const scored = scoreSc01PivotTerms(parsed.qid ?? -1, parsed.question, step2);
        sc01Result = scored;
        emit({ kind: 'result', text: `SC-01 (pivot terms named and defined): ${scored.why}`, ts: nowIso() });
        for (const t of scored.terms) {
          note(
            emit,
            `   SC-01 term "${t.term}": verbatimInQuestion=${t.verbatimInQuestion}, carriesTriple=${t.carriesTriple}, `
              + `hasNamedSourceDefinition=${t.hasNamedSourceDefinition}, countsTowardStrictCount=${t.countsTowardStrictCount}`,
          );
          // FD-BP152-12: every distinct meaning, in full and uncollapsed -- never truncated, never
          // reduced to a count.
          t.enumeratedMeanings.forEach((m, i) => {
            note(
              emit,
              `      meaning ${i + 1}/${t.enumeratedMeanings.length} [from ${m.fromLevel}, register: ${m.register ?? 'unstated'}, `
                + `source: ${m.sourceTitle || m.sourceUrl || '(no named source)'}]: "${m.sentence}"`,
            );
          });
        }
      } catch (e) {
        sc01ScoringError = e instanceof Error ? e.message : String(e);
        emit({ kind: 'note', text: `   SC-01 SCORING ERRORED (non-fatal, run continues unaffected): ${sc01ScoringError}`, ts: nowIso() });
      }
    };
    {
      const surveyEnabledResolved = resolveSurveyEnabled(contingencyOperatorSurvey);
      const cacheKey = surveyCacheKey(parsed.question, parsed.options);
      // Lazily constructed, and SAFE outside a real Electron process (safeDefaultSurveyCacheStore()
      // falls back to a no-op NullSurveyCacheStore rather than throwing -- see its own header for
      // the exact crash this guard fixes, measured against this codebase's own pre-existing tests).
      const cacheStore: SurveyCacheStore = surveyCache ?? safeDefaultSurveyCacheStore();
      const cachedSurvey = await cacheStore.get(cacheKey);
      if (cachedSurvey) {
        // ── PATH 1: CACHE HIT -- zero Google calls, regardless of surveyEnabledResolved ────────
        surveyResult = cachedSurvey;
        emit({
          kind: 'stage',
          text: '-> SURVEY -- CACHE HIT (BP158 "cache forever": persist every denotation obtained, resolve from the store on a '
            + 'second encounter, zero network cost) -- reusing a prior surveyed answer for this exact question, no Google call made',
          ts: nowIso(),
        });
        note(emit, `   cache key (sha256 of normalized question+options): ${cacheKey}`);
        scoreSc01ForThisRun(surveyResult.step2);
      } else if (surveyEnabledResolved) {
        // ── PATH 2: LIVE SURVEY (opt-in flag ON) -- exactly the D-BP152-039 unconditional body ──
        emit({
          kind: 'stage',
          text: '-> SURVEY -- Survey (Founder steps 2, 3, 4, 6) runs before method selection, and DEMAND is derived from the surveyed ask (surveyEnabled=true, no cache hit for this question -- BP164 opt-in path)',
          ts: nowIso(),
        });
        // Survey's own MethodRunContext. Reuses the SAME injected askGoogle by reference (raw, not
        // wrapped by wrapAskGoogleWithAudible -- see this ticket's return, THINGS I NOTICED AND DID
        // NOT DO, for why Call an Audible's per-call pause was not extended to cover Survey's own
        // Google calls; that was not ordered here). wrapForSteppedAudible('survey', ...) below IS
        // wired -- that is Part 3's own requirement, not an extra.
        // D-BP152-044, ADDITIVE: `askConversationalAuthority` threaded straight through (undefined on
        // every caller that omits it -- byte-identical then). NOTE: when Stepped Audible is ON for
        // survey, wrapForSteppedAudible() below returns a NEW ctx object carrying only
        // { askGoogle, emit } (stepped_audible.ts, this ticket's own FORBIDDEN "pause plumbing", not
        // touched) -- on that combination the two META-questions honestly fall back to Google, same
        // as if this were never wired, rather than crashing or fabricating an authority.
        // FD-BP153-04, ADDITIVE: an honest empty accessor, not omitted -- Survey is about to fetch
        // its own first passage, so nothing is owned yet at this point in the run. Present (not
        // undefined) so a reader of this ctx does not need to guess whether ownedPassages is
        // supported here at all; see MethodRunContext.ownedPassages's own doc comment
        // (method_registry.ts) for the full ruling this field implements.
        const surveyCtx: MethodRunContext = {
          askGoogle: effectiveAskGoogle, emit, askConversationalAuthority, ownedPassages: () => [],
        };
        const surveyStepWrap = wrapForSteppedAudible('survey', surveyCtx, steppedAudible ?? null, steppedLog);
        if (steppedAudible) {
          const surveyStepDefs = buildUpfrontStepList('survey');
          if (surveyStepDefs) {
            emit({ kind: 'stage', text: `-> STEPPED AUDIBLE -- SURVEY: ${surveyStepDefs.length} step(s) this phase will execute, listed before the first one starts`, ts: nowIso() });
            surveyStepDefs.forEach((d, i) => {
              const head = d.attribution === 'ATTRIBUTED'
                ? `step ${i + 1}/${surveyStepDefs.length}: ${d.codeLabel}  ->  Founder step ${d.founderStepNumber}, verbatim: "${d.founderWords}"  (${d.founderSource})`
                : `step ${i + 1}/${surveyStepDefs.length}: ${d.codeLabel}  ->  UNATTRIBUTED -- TARE, no Founder order`;
              note(emit, `   ${head}`);
            });
          }
        }
        surveyResult = await runSurveyStage(parsed.question, parsed.options, surveyStepWrap.ctx, {
          // D-BP151-032: already-resolved value (param + env override), passed straight through --
          // survey_stage.ts invents no default of its own beyond matching this same polarity.
          ambiguityQueryTransport: resolvedAmbiguityQueryTransport,
        });
        try {
          await surveyStepWrap.finish();
        } catch (e) {
          if (e instanceof SteppedAudibleAbandoned) {
            note(emit, '   STEPPED AUDIBLE abandoned during SURVEY -- Survey\'s own findings above are unaffected; every step response up to and including this one is kept.');
          } else {
            throw e;
          }
        }
        // BP158 "cache forever" -- persist this real answer so the NEXT run with this exact
        // question (cache-hit path above) never pays for it again. Non-fatal on any disk failure
        // (FileSurveyCacheStore's own rule); a cache-write failure never affects this run's own
        // result.
        await cacheStore.set(cacheKey, parsed.question, surveyResult);
        scoreSc01ForThisRun(surveyResult.step2);
      } else {
        // ── PATH 3: SKIPPED -- opt-in flag OFF (the default), no cache hit -- zero Google calls ──
        surveyResult = buildSkippedSurveyResult(parsed.question);
        emit({
          kind: 'stage',
          text: '-> SURVEY -- SKIPPED (surveyEnabled is OFF, the default -- BP158/BP164, Founder verbatim: "I don\'t want to '
            + 'automatically run survey, it uses google calls without purpose") -- zero Google calls made for this question',
          ts: nowIso(),
        });
        scoreSc01ForThisRun(surveyResult.step2);
      }
      // D-BP152-005, PART 2 -- the operation query (FD-BP152-05) is the DIRECT signal for exactly
      // this value: Founder, BP152, verbatim, quoted at askOperation()'s own header
      // (survey_stage.ts). Computed once, here, so demandPath and demandResult below never call
      // determineDemandFromOperationAnswer() twice. Tried BEFORE the indirect ambiguityNested
      // derivation, since determineDemandFromAmbiguityNested()'s own header already says
      // RANK/CLASSIFY/IDENTIFY/INFER are "NOT YET DERIVABLE" from that path alone -- operation
      // asks for the demand directly; ambiguityNested infers it from denotations of OTHER terms.
      // Canon R-5 governs the operation answer itself (demand_test.ts's own function): an
      // unmappable or absent answer yields `demand: null`, never a guess, and never a silent fall
      // back to determineDemand()'s CUES table -- that table is not called anywhere on this
      // branch; a null operation result only ever falls through to the pre-existing ambiguityNested
      // derivation, named explicitly in demandPath below.
      const operationDemandResult = surveyResult.step2.operation
        ? determineDemandFromOperationAnswer(surveyResult.step2.operation.rawAnswer)
        : null;

      // PART 2 (pre-existing, D-BP151-032): demand comes from the surveyed ask, WIRED not
      // rewritten. Step 2's own output (SurveyAskNestedResult) is exactly
      // determineDemandFromSurveyedAsk()'s expected input (demand_test.ts). When Step 2 took the
      // NO-TERM/ambiguity path instead (step2.nested stays null there BY DESIGN -- see
      // survey_stage.ts's own doc comment on that field), D-BP152-005's operation answer is tried
      // first (see immediately above); only when THAT produced no demand does step2.ambiguityNested
      // carry the fallback -- one nested survey per source-named term, fed to
      // determineDemandFromAmbiguityNested() (demand_test.ts), which itself calls
      // determineDemandFromSurveyedAsk() -- the SAME function -- once per named term and reports
      // UNKNOWN rather than choosing among them if they disagree (that function's own header). Only
      // when STEP 2 found NEITHER a term NOR a usable operation answer NOR any ambiguity-named term
      // is there nothing to derive a demand from at all -- reported honestly as demand unknown
      // (canon R-5: a teaching prompt, not a fabricated guess), the same refusal shape
      // survey_stage.ts's own steps already use.
      //
      // LAW 5 (HARDWIRE-23): the receipt names which path produced the demand -- 'nested',
      // 'operation', 'ambiguity', or 'none' -- in the transcript line emitted immediately below,
      // independent of demandResult.derivedFrom (which stays 'surveyed-ask' for all three
      // surveyed-ask-derived paths; the PATH distinction is a finer-grained fact than the
      // derivedFrom enum currently carries).
      // D-BP153-001 -- THE STRUCTURAL PATH, LAST. Computed once, here, so demandPath and
      // demandResult below never call determineDemandFromQuestionStructure() twice (the same shape
      // operationDemandResult uses immediately above).
      //
      // ORDERING IS LOAD-BEARING: this is tried ONLY after all three surveyed-ask paths have
      // produced nothing, so it can never override a demand the survey actually derived. It exists
      // because qid 98 proved a run can die with every component behaving correctly: SURVEY STEP 2
      // honestly found no term, the ambiguity query honestly returned terms that were not literal
      // spans of the question, sig-figs honestly dropped all of them, and the run ended
      // DEMAND: UNKNOWN before method selection -- while extractSuperlativeMatch(), which
      // classify_cascade.ts's own run() already trusts to route this exact question, matched it the
      // whole time. See determineDemandFromQuestionStructure()'s own header (demand_test.ts) for
      // why calling that existing detector is a wiring fix and not a widened gate.
      const structuralDemandResult = determineDemandFromQuestionStructure(parsed.question);

      const demandPath: 'nested' | 'operation' | 'ambiguity' | 'structural' | 'none' = surveyResult.step2.nested
        ? 'nested'
        : operationDemandResult?.demand
          ? 'operation'
          : surveyResult.step2.ambiguityNested.length
            ? 'ambiguity'
            : structuralDemandResult.demand
              ? 'structural'
              : 'none';
      note(emit, `   DEMAND PATH: ${demandPath} (Law 5, HARDWIRE-23 -- names which SURVEY STEP 2 result produced the demand below)`);
      demandResult = surveyResult.step2.nested
        ? determineDemandFromSurveyedAsk(surveyResult.step2.nested)
        : operationDemandResult?.demand
          ? operationDemandResult
          : surveyResult.step2.ambiguityNested.length
            ? determineDemandFromAmbiguityNested(surveyResult.step2.ambiguityNested)
            : structuralDemandResult.demand
              ? structuralDemandResult
              : {
                demand: null,
                why: `SURVEY STEP 2 did not resolve a term to survey (${surveyResult.step2.why}) -- nothing to derive DEMAND from via the surveyed ask, and the question's own grammar carries no structural superlative either (${structuralDemandResult.why}); this is a teaching prompt (canon R-5), not a fabricated guess`,
                derivedFrom: 'surveyed-ask',
              };
      emit({ kind: 'stage', text: '-> DEMAND TEST (SURVEYED ASK) -- what operation must this answer perform?', ts: nowIso() });
      note(emit, `   ${describeDemand(demandResult)}`);
    }

    emit({ kind: 'stage', text: '-> METHOD SELECTION -- checking every method on file', ts: nowIso() });
    const methods = listMethods();
    for (const row of explainSelection(methodInput, demandResult.demand)) {
      note(emit, `   ${row.method.id} (${row.method.name}): ${row.eligible ? 'ELIGIBLE' : 'not run'} -- ${row.reason}`);
    }

    const selection = selectMethod(methodInput, demandResult.demand);
    if (!selection) {
      const roster = methods.map((m) => `${m.id} [serves ${m.demand}] [taught by: ${m.taughtBy}]`).join('\n     ');
      // NAME THE DEMAND IN THE REFUSAL. Canon R-5: the operator must learn WHAT KIND of method is
      // missing, not merely that one is. "No method matches" tells him nothing he can act on;
      // "nothing on file serves INFER" tells him exactly what to teach next.
      const headline = demandResult.demand
        ? `NO METHOD SERVES THIS DEMAND -- nothing on file performs ${demandResult.demand}.`
        : 'DEMAND UNKNOWN -- the operation this answer must perform could not be determined, so no method may run.';
      emit({ kind: 'result', text: headline, ts: nowIso() });
      note(emit, `   Methods on file:\n     ${roster}`);
      note(emit, '   This is not a failure -- it is the next teaching opportunity. Work this one by hand; the Liana Cycle records what you did and it becomes the next method.');
      return {
        qid: parsed.qid,
        question: parsed.question,
        verdict: null,
        correct: parsed.correctAnswer,
        abstain: true,
        freeText,
        error: demandResult.demand ? 'no_method_matched' : 'demand_unknown',
        options: parsed.options,
        ...(sc01Result ? { sc01: sc01Result } : {}),
        ...(sc01ScoringError ? { sc01ScoringError } : {}),
      };
    }

    const { method, shape } = selection;
    say(emit, `METHOD SELECTED: ${method.name} (${method.id})`);
    note(emit, `   why: ${shape.reason}`);
    note(emit, `   taught by: ${method.taughtBy}`);

    if (!method.run) {
      emit({ kind: 'result', text: `NOT YET TAUGHT -- ${method.name} is a registered method whose shape matched, but it has no runner yet.`, ts: nowIso() });
      note(emit, '   This is a known shape, not an unknown one -- the Founder has not walked a case for it yet. That is the next teaching session.');
      return { qid: parsed.qid, question: parsed.question, verdict: null, correct: parsed.correctAnswer, abstain: true, freeText, error: 'method_not_yet_taught', method: method.id, options: parsed.options, ...(sc01Result ? { sc01: sc01Result } : {}), ...(sc01ScoringError ? { sc01ScoringError } : {}) };
    }

    if (audible) {
      note(emit, '   CALL AN AUDIBLE is ON -- this run stops before every Google query and again on what comes back. It waits until you say go; there is no timer.');
    }
    // D-BP151-023 -- REQUIREMENT A: THE STEP LIST, SHOWN UP FRONT, BEFORE THE FIRST STEP RUNS.
    // Static per method (buildUpfrontStepList() reads no live state) so it can be printed here,
    // before `method.run()` is even called. A method this ticket did not map (see
    // stepped_audible.ts's header) gets an honest "not covered" line instead of an invented list.
    if (steppedAudible) {
      const stepDefs = buildUpfrontStepList(method.id);
      if (stepDefs) {
        emit({ kind: 'stage', text: `-> STEPPED AUDIBLE -- ${stepDefs.length} steps this run will execute, listed before the first one starts`, ts: nowIso() });
        stepDefs.forEach((d, i) => {
          const head = d.attribution === 'ATTRIBUTED'
            ? `step ${i + 1}/${stepDefs.length}: ${d.codeLabel}  ->  Founder step ${d.founderStepNumber}, verbatim: "${d.founderWords}"  (${d.founderSource})`
            : `step ${i + 1}/${stepDefs.length}: ${d.codeLabel}  ->  UNATTRIBUTED -- TARE, no Founder order`;
          note(emit, `   ${head}`);
        });
        note(emit, '   STEPPED AUDIBLE is ON -- this run stops once per step above, after it completes and before the next begins. It waits until you respond; there is no timer.');
      } else {
        note(emit, `   STEPPED AUDIBLE has no step map for method "${method.id}" -- this run proceeds WITHOUT per-step pausing (same as stepped audible OFF). See stepped_audible.ts's header for why (scoped to comparative-cascade only).`);
      }
    }
    // FD-BP153-04, ADDITIVE: hands the selected method back the raw passages Survey (immediately
    // above) already acquired THIS RUN -- the ambiguity query's and the operation query's own
    // rawGooglePassage (survey_stage.ts's own INSTRUMENT-ONLY fields, D-BP152-004/005, unmodified)
    // -- so a method's own query-issuing step can try extraction from OWNED evidence before
    // spending a new query (the Founder's ruling; see MethodRunContext.ownedPassages's own doc
    // comment, method_registry.ts, for the measurement behind it). Non-empty strings only. OWNED
    // MEANS THIS RUN ONLY: read live off `surveyResult`, already sitting in memory from the block
    // above -- never the evidence store on disk, never a prior acquisition.
    //
    // D-BP153-016, FIX 1, TYPED: each passage is now tagged with the QUESTION IT WAS ACQUIRED TO
    // ANSWER -- 'ambiguity' for the ambiguity meta-question's own passage, 'operation' for the
    // operation meta-question's own. THE RULING THIS CLOSES: the live 2026-08-12T20:39Z run pointed
    // classify_cascade.ts's extractors at the ambiguity passage (which enumerates ALTERNATIVE
    // meanings and is, by construction, full of counterfactuals) and mined a counterfactual clause
    // as an assertion. `kind` is what lets an extractor refuse that passage outright, structurally,
    // rather than by convention. `sourceQuery` carries the literal query text (Survey's own
    // `askedText`) through for audit, when the caller has it.
    //
    // D-BP154-008/BISHOP/S8/seg-mortgage -- THE MORTGAGE, FD-BP153-04 BOUNDARY 4 LIFTED. Computed
    // HERE (not inside the `ownedPassages()` closure below) because building it is a disk read
    // plus, on a Google match, one pass of googleBlocks()'s own async text assembly -- and this
    // function is already `async` at the point Survey's `askedText` values exist, while
    // `MethodRunContext.ownedPassages` itself is a SYNCHRONOUS accessor every existing consumer
    // (establishFrame()/extractNamedSetMembers()/runDiscriminator(), classify_cascade.ts) already
    // calls without an `await`. Pre-computing the list here and having the closure below simply
    // return it keeps that type, and every existing consumer, byte-identical.
    //
    // SCOPED TO A BUNDLED QID ONLY. `parsed.qid == null` (free-text input) is excluded entirely:
    // evidence_store.ts's own `slugFor(null)` buckets every free-text acquisition under one shared
    // 'free-text' file, which does not identify a single question -- reaching across acquisitions
    // for a store that cannot uniquely address the qid would risk mixing one free-text question's
    // evidence into an unrelated one's run, so this only ever fires for a bundled qid.
    //
    // `fullQueryText`, NOT `askedText` -- survey_stage.ts's own AmbiguityQueryResult/
    // OperationQueryResult.askedText is only the STATIC clause (resources/liana_survey_queries.json);
    // the text ACTUALLY sent (and therefore what a prior acquisition's own EvidenceRecord.query
    // holds) is `askText + optionsBlock + askedText`, carried in the D-BP154-008 `fullQueryText`
    // field added alongside it. Matching against the shorter `askedText` would search for a string
    // no live run ever actually sent and never find anything -- see that field's own doc comment,
    // survey_stage.ts, for the full ruling. Undefined (the 'gemma' transport, or no Survey result at
    // all) is skipped by buildPriorAcquisitionOwnedPassages() itself, never a crash.
    const priorAcquisitionPassages = parsed.qid != null
      ? await buildPriorAcquisitionOwnedPassages(
        parsed.qid,
        [
          { kind: 'ambiguity', askedText: surveyResult.step2.ambiguity?.fullQueryText },
          { kind: 'operation', askedText: surveyResult.step2.operation?.fullQueryText },
        ],
        { excludeAcquisitionId: currentAcquisitionId },
      )
      : [];
    const baseCtx: MethodRunContext = {
      askGoogle: wrapAskGoogleWithAudible(effectiveAskGoogle, audible ?? null, emit, audibleLog),
      emit,
      // D-BP153-025 -- THE MISSING WIRE. `askConversationalAuthority` existed, was recording-wrapped
      // in index.ts, and was handed to `surveyCtx` above -- and was never put on the METHOD's
      // context. So Survey could ask Gemini and the three questions could not.
      //
      // MEASURED, live run 2026-08-13T02:48:03Z (LIANA_RUN_qid98_2026-08-13T02-48-03-120Z.json):
      // D-BP153-024 had already routed the frame to try the conversational authority first, and the
      // transcript read "FRAME: no conversational authority is wired for this call -- falling back
      // to Google". It then sent a nine-item per-option accounting question to WEB SEARCH, got
      // `nobox+organic(5)`, and correctly reported the frame unavailable because the passage named
      // none of the options.
      //
      // This is the estate's signature defect for the eighth time this session: a value exists, one
      // hop fails to carry it, and the downstream message reads like a decision ("falling back to
      // Google") rather than like a missing wire. See
      // Asteroid-ProofVault/state/eblets/CANON/canon_signature_defect_one_hop_fails_to_carry_the_value_bp153.
      //
      // OPTIONAL AND ADDITIVE: undefined when no conversational authority was supplied to this run,
      // in which case every method behaves exactly as it did before D-BP153-024.
      askConversationalAuthority,
      ownedPassages: (): OwnedPassage[] => {
        const out: OwnedPassage[] = [];
        const amb = surveyResult.step2.ambiguity;
        if (amb && amb.rawGooglePassage && amb.rawGooglePassage.trim()) {
          out.push({ text: amb.rawGooglePassage, kind: 'ambiguity', sourceQuery: amb.askedText });
        }
        const op = surveyResult.step2.operation;
        if (op && op.rawGooglePassage && op.rawGooglePassage.trim()) {
          out.push({ text: op.rawGooglePassage, kind: 'operation', sourceQuery: op.askedText });
        }
        // D-BP154-008 -- ADDED AFTER this run's own two entries above, so every existing
        // owned-passage loop (establishFrame()/extractNamedSetMembers()/runDiscriminator(),
        // classify_cascade.ts, unmodified) tries a live, this-run answer FIRST; reaching across
        // acquisitions only ever adds a candidate, never displaces this run's own. See this
        // function's own D-BP154-008 comment, above `baseCtx`, for how `priorAcquisitionPassages`
        // is computed.
        out.push(...priorAcquisitionPassages);
        return out;
      },
    };
    const stepWrap = wrapForSteppedAudible(method.id, baseCtx, steppedAudible ?? null, steppedLog);
    const outcome = await method.run(methodInput, stepWrap.ctx);
    try {
      // D-BP151-023 -- flushes the trailing step buffer (STAGE 5b + the TERMINATOR notes that
      // follow it with no further 'stage' event in between -- see stepped_audible.ts's header,
      // "THE ONE GAP THIS DOES LEAVE"). A true no-op when stepped audible never armed.
      await stepWrap.finish();
    } catch (e) {
      if (e instanceof SteppedAudibleAbandoned) {
        // The method has ALREADY resolved `outcome` by the time this final pause fires (finish()
        // only runs after `await method.run()` above returns) -- abandoning the final review does
        // not retroactively un-produce a verdict the cascade already reached. "Abandoning keeps
        // every note" (Founder, BP149) is honored here by keeping BOTH the real outcome and the
        // stepped log up to and including this abandon record, rather than discarding either.
        note(emit, '   STEPPED AUDIBLE abandoned at the final review pause -- the run\'s own outcome above is unaffected; every step response up to and including this one is kept.');
      } else {
        throw e;
      }
    }
    // D-BP153-003 -- THE KEY REJOINS HERE, AND ONLY HERE. `method.run()` has already returned;
    // its verdict was produced by code that could not see the key (see the key-split block where
    // `methodInput` is built). Scoring is therefore structurally after the fact, which is the
    // whole point. The methods' own `ok`/`correct` fields now come back undefined (their
    // `KEY != null` guards take the free-text branch), so these two lines are the sole source of
    // both. Order matters: this must sit AFTER `...outcome` so it overrides rather than merges
    // under it.
    const scoredCorrect = parsed.correctAnswer;
    const scoredOk = scoredCorrect != null && outcome.verdict != null
      ? outcome.verdict === scoredCorrect
      : undefined;
    return {
      ...outcome,
      ...(scoredCorrect != null ? { correct: scoredCorrect } : {}),
      ...(scoredOk !== undefined ? { ok: scoredOk } : {}),
      method: method.id,
      options: parsed.options,
      ...(audibleLog.length ? { audibleLog: audibleLog.all() } : {}),
      ...(steppedLog.length ? { steppedLog: steppedLog.all() } : {}),
      ...(assistedLog.length ? { assistedLog: assistedLog.all() } : {}),
      ...(sc01Result ? { sc01: sc01Result } : {}),
      ...(sc01ScoringError ? { sc01ScoringError } : {}),
    };
  } catch (e) {
    // THE OPERATOR ENDING A RUN IS NOT AN ERROR, and must not be transcribed as one. It is an
    // honest abstain that keeps every note typed on the way to it.
    if (e instanceof AudibleAbandoned) {
      emit({ kind: 'result', text: 'AUDIBLE ABANDONED -- run stopped by operator. Everything you typed is kept.', ts: nowIso() });
      return {
        question: trimmed,
        verdict: null,
        abstain: true,
        freeText: !/^\d+$/.test(trimmed),
        error: 'audible_abandoned',
        options: null,
        audibleLog: audibleLog.all(),
        ...(steppedLog.length ? { steppedLog: steppedLog.all() } : {}),
      };
    }
    // D-BP151-023 -- an EARLY step-pause abandon (any pause before the final one, thrown from
    // inside the wrapped askGoogle mid-run) propagates up through `method.run()` exactly like
    // AudibleAbandoned above, since comparative_cascade.ts catches neither. Distinct branch, same
    // "keeps every note" guarantee.
    if (e instanceof SteppedAudibleAbandoned) {
      emit({ kind: 'result', text: 'STEPPED AUDIBLE ABANDONED -- run stopped by operator. Everything you typed is kept.', ts: nowIso() });
      return {
        question: trimmed,
        verdict: null,
        abstain: true,
        freeText: !/^\d+$/.test(trimmed),
        error: 'stepped_audible_abandoned',
        options: null,
        ...(audibleLog.length ? { audibleLog: audibleLog.all() } : {}),
        steppedLog: steppedLog.all(),
      };
    }
    // D-BP152-051 -- an assisted-mode pause abandon, same "keeps every note" guarantee as the two
    // branches immediately above (audible.ts's AudibleAbandoned, stepped_audible.ts's
    // SteppedAudibleAbandoned). Distinct branch, same discipline: the run's own outcome is an
    // honest abstain, never a fabricated verdict, and every round typed on the way to the abandon
    // is kept in `assistedLog`.
    if (e instanceof AssistedModeAbandoned) {
      emit({ kind: 'result', text: 'ASSISTED MODE ABANDONED -- run stopped by operator. Everything captured so far is kept.', ts: nowIso() });
      return {
        question: trimmed,
        verdict: null,
        abstain: true,
        freeText: !/^\d+$/.test(trimmed),
        error: 'assisted_mode_abandoned',
        options: null,
        ...(audibleLog.length ? { audibleLog: audibleLog.all() } : {}),
        ...(steppedLog.length ? { steppedLog: steppedLog.all() } : {}),
        assistedLog: assistedLog.all(),
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    emit({ kind: 'error', text: `terminal threw: ${msg}`, ts: nowIso() });
    return {
      question: trimmed,
      verdict: null,
      abstain: true,
      freeText: !/^\d+$/.test(trimmed),
      error: msg,
      options: null,
      ...(audibleLog.length ? { audibleLog: audibleLog.all() } : {}),
      ...(steppedLog.length ? { steppedLog: steppedLog.all() } : {}),
      ...(assistedLog.length ? { assistedLog: assistedLog.all() } : {}),
    };
  }
}

// D-BP152-051, THIN WRAPPER -- THE ONE PLACE `mode` IS STAMPED, GUARANTEED ON EVERY EXIT PATH.
//
// `runLianaCycleQuestionInner` above has many return statements (the qid-not-found early exit,
// the two mid-run abstains, three catch branches, the success path) -- editing `mode` into every
// one individually would be exactly the kind of change HARDWIRE-23 LAW 5 exists to guard against
// missing: "the receipt names the rule and its attribution status", on every run, and a single
// forgotten return site would silently produce a receipt with no `mode` field at all. Wrapping the
// whole function once, and spreading `mode` over whatever it returns, makes that structurally
// impossible to miss rather than a discipline to remember at each of eight call sites.
//
// Public signature is otherwise BYTE-IDENTICAL to before this ticket: every parameter up to and
// including `askConversationalAuthority` is unchanged, in the same order: existing callers
// (index.ts's 'liana-terminal-run' handler, this file's own tests) that pass nothing for `mode`/
// `assistedChannel` get `mode: 'automated'` stamped onto their outcome and nothing else different
// -- the ONLY new externally-visible fact on an automated run is that `outcome.mode` is now
// explicitly `'automated'` instead of absent, which is this ticket's own requirement 2 (a run
// whose governing setting leaves no trace makes the receipt a lie) applied to the DEFAULT case
// too, not only the assisted one.
export async function runLianaCycleQuestion(
  input: string,
  askGoogle: AskGoogleFn,
  emit: EmitFn,
  audible?: AudibleChannel | null,
  steppedAudible?: SteppedAudibleChannel | null,
  contingencyOperatorSurvey?: boolean,
  ambiguityQueryTransport?: 'google' | 'gemma',
  askConversationalAuthority?: ConversationalAuthorityFn,
  mode?: RunMode,
  assistedChannel?: SteppedAudibleChannel | null,
  // D-BP154-008, ADDITIVE/OPTIONAL, placed LAST so no existing call site (none of which pass an
  // 11th argument) shifts meaning -- same convention every other trailing parameter in this
  // signature already follows. THE MORTGAGE, TICKET_D-BP154-008_THE_MORTGAGE.md: the evidence
  // acquisition THIS run is currently writing (index.ts's `evidenceSession.acquisitionId`, when
  // this run is wired to the evidence store at all), so the cross-acquisition lookup below never
  // "reuses" a record this run is itself in the middle of producing -- see
  // cross_acquisition.ts's own header, `excludeAcquisitionId`. Undefined for every caller that
  // omits it (every pre-existing test, library/script_bridge.ts's Composer path): excludes
  // nothing beyond what qid and the query already select, never a crash or a behavior change on
  // that path.
  currentAcquisitionId?: string,
  // D-BP164-M0-046, ADDITIVE/OPTIONAL, placed LAST -- passthrough only, so a caller (every
  // fixture test this ticket adds) can inject an isolated cache store; see runLianaCycleQuestionInner's
  // own doc comment on this same parameter for the full ruling.
  surveyCache?: SurveyCacheStore,
): Promise<LianaTerminalOutcome> {
  // D-BP164-M0-046, ADDITIVE, ALWAYS ON -- unlike `contingencyOperatorSurvey`/`mode` above, this
  // is never gated: it only OBSERVES what askGoogle already does, never changes what it returns
  // or how it behaves (see cost_instrument.ts's own header). Wrapping the RAW askGoogle HERE,
  // before Inner (and every decorator Inner itself layers on top -- Assisted Mode, Audible,
  // Survey's own ctx) ever sees it, is the SAME "one injection point" principle D-BP152-051
  // already established at this exact call site: it counts every real call this run makes
  // anywhere (every method, Survey, Step 0's own "ask Google this") exactly once, at its true
  // source, regardless of which OTHER decorator wraps it further inside Inner.
  const googleCostLedger: GoogleCallCostRecord[] = [];
  const costInstrumentedAskGoogle = wrapAskGoogleWithCostInstrument(askGoogle, (r) => googleCostLedger.push(r));
  // D-BP164-M0-068/BISHOP/M0/seg-cu -- SAME "one wrapping point, ALWAYS ON" principle as the
  // Google leg above, applied to the LLM/token leg. runWithLlmCostLedger() gives THIS single call
  // to runLianaCycleQuestionInner() its own isolated AsyncLocalStorage ledger scope; every
  // gemmaExtract() call anywhere underneath it (any method, any depth) pushes into that SAME scope
  // via cost_instrument.ts's recordLlmCall(), with no parameter threading required through the
  // methods/ctx layers in between. See cost_instrument.ts's own header for the full finding this
  // closes (SEG-CI, D-BP164-M0-057: the production instrument never measured an LLM token before
  // this ticket) and for why this is a SEPARATE, clearly-labeled leg rather than folded into
  // costLedger/costSummary above -- Google search cost and LLM/token cost are two different real
  // things, and neither one is silently absorbed into the other's numbers.
  const { result: outcome, ledger: llmCostLedger } = await runWithLlmCostLedger(() => runLianaCycleQuestionInner(
    input,
    costInstrumentedAskGoogle,
    emit,
    audible,
    steppedAudible,
    contingencyOperatorSurvey,
    ambiguityQueryTransport,
    askConversationalAuthority,
    mode,
    assistedChannel,
    currentAcquisitionId,
    surveyCache,
  ));
  // ALWAYS present (empty array/zero-call summary on a run that made no Google calls at all) --
  // same "an override that leaves no trace makes the receipt a lie" rule `mode` above follows
  // (FD-BP152-07), applied to cost accounting: a reader must never have to infer "zero calls"
  // from the field's ABSENCE. llmCostLedger/llmCostSummary follow the identical convention,
  // ALWAYS present, empty/zero on a run that made no real Ollama calls (e.g. ambiguityQueryTransport
  // stayed 'google' the whole run, or no method reached gemmaExtract() at all).
  return {
    ...outcome,
    mode: normalizeRunMode(mode),
    costLedger: googleCostLedger,
    costSummary: summarizeGoogleCostLedger(googleCostLedger),
    llmCostLedger,
    llmCostSummary: summarizeLlmCostLedger(llmCostLedger),
  };
}
