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
import type { LianaTerminalEvent, LianaTerminalOutcome } from '../../shared/liana_cycle/liana_terminal_types';
import { explainSelection, listMethods, selectMethod } from './method_registry';
// D-BP150-003 -- the Demand Test. Runs before method selection; see its own header for exactly
// which half of the canon it implements and which half is still a scaffold.
import { describeDemand, determineDemand, determineDemandFromAmbiguityNested, determineDemandFromSurveyedAsk } from './demand_test';
import type { DemandResult } from './demand_test';
import type { AskGoogleFn, EmitFn, MethodQuestionInput, MethodRunContext } from './method_registry';
// D-BP151-026/BISHOP/seg-contingency-operator (Contingency Operator: Survey Splice). Founder,
// BP151, Q-20: "This is a case for Contingency Operators. Do it, and see if it works before I
// ratify." runSurveyStage() (Founder steps 2, 3, 4, 6) was built D-BP151-025 but never spliced
// into this dispatcher -- see survey_stage.ts's own header, "NOT WIRED INTO
// liana_terminal_engine.ts's DISPATCH BY THIS TICKET". This import is that splice, gated by
// isContingencyOperatorSurveySpliceEnabled() below.
import { runSurveyStage } from './survey_stage';
import type { SurveyStageResult } from './survey_stage';
// D-BP150-001 (Call an Audible). See audible.ts's header for why this is a decorator around the
// injected askGoogle rather than a restructuring of the method modules.
import { AudibleAbandoned, AudibleLog, wrapAskGoogleWithAudible } from './audible';
import type { AudibleChannel } from './audible';
// D-BP151-023 (Stepped Audible). See stepped_audible.ts's header for why this is a SECOND,
// separate decorator (per-Founder-step granularity) rather than a replacement for the per-call
// one above, and for why it is scoped to the comparative-cascade method only.
import { SteppedAudibleAbandoned, SteppedAudibleLog, buildUpfrontStepList, wrapForSteppedAudible } from './stepped_audible';
import type { SteppedAudibleChannel } from './stepped_audible';
// Registering a method is a side effect of importing its module (see each file's own
// `registerMethod(...)` call at the bottom). Both are imported here, and ONLY here, so the
// registry is fully populated before the first `runLianaCycleQuestion` call, regardless of
// which other file happens to import this one first.
import './methods/comparative_cascade';
import './methods/definitional_cascade';

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

/** D-BP151-026/BISHOP/seg-contingency-operator: resolves the CONTINGENCY OPERATOR SURVEY SPLICE
 *  variant gate. Same isXModeEnabled() resolver shape the Founder named as the pattern to match --
 *  isAdjudicationAlwaysModeEnabled() (plow_mc_answerer.ts:6205), itself mirroring
 *  isAnswerCacheModeEnabled()/isSemanticSoccerballModeEnabled()/isEscalationLadderModeEnabled()
 *  (ai_dispatch_ipc.ts): a boolean param plus an env-var escape hatch, one resolver per gate.
 *
 *  THE POLARITY IS FLIPPED, ON PURPOSE -- the one deliberate deviation from that cited pattern.
 *  Every cited example defaults ON (undefined/true = on, explicit false = the opt-out). This gate
 *  defaults OFF. Founder, BP151, verbatim: "This is a case for Contingency Operators. Do it, and
 *  see if it works before I ratify" -- and: "A Contingency Operator... is not ratified by
 *  existing." Defaulting this ON would make it the shipped behavior the moment it lands, which is
 *  exactly what he ordered NOT to happen; the env var (CONTINGENCY_OPERATOR_SURVEY_SPLICE=1)
 *  exists for the same quick-local-testing purpose the cited resolvers' own env vars serve. */
function isContingencyOperatorSurveySpliceEnabled(contingencyOperatorSurvey: boolean | undefined): boolean {
  if (contingencyOperatorSurvey === true) return true;
  return process.env.CONTINGENCY_OPERATOR_SURVEY_SPLICE === '1';
}

/** D-BP151-032/BISHOP/seg-ambiguity-to-demand: resolves SURVEY STEP 2's ambiguity-query transport.
 *  Same param+env-var `isXEnabled()` shape as isContingencyOperatorSurveySpliceEnabled() above --
 *  the pattern the Founder named to match -- but the POLARITY IS NOT FLIPPED this time: undefined
 *  (and no `AMBIGUITY_QUERY_TRANSPORT=gemma` override) resolves to 'google', the SHIPPED default,
 *  matching every OTHER cited resolver's "undefined = the shipped behavior" direction.
 *
 *  ATTRIBUTED: Founder, BP151, relayed addendum, verbatim: "I want to always run it on google,
 *  which should be the default that can be changed in Mnemosynec at will." An explicit `'gemma'`
 *  argument (only reachable today via index.ts's IPC parameter -- see this ticket's return,
 *  "THINGS I NOTICED AND DID NOT DO", for why no renderer UI control was added, matching
 *  isContingencyOperatorSurveySpliceEnabled()'s own precedent) or the env override selects the
 *  local model instead. This function only routes; it never falls back on its own -- if Google is
 *  unreachable, askAmbiguity() (survey_stage.ts) refuses rather than silently trying 'gemma'. */
function resolveAmbiguityQueryTransport(ambiguityQueryTransport: 'google' | 'gemma' | undefined): 'google' | 'gemma' {
  if (ambiguityQueryTransport === 'gemma') return 'gemma';
  if (ambiguityQueryTransport === 'google') return 'google';
  if (process.env.AMBIGUITY_QUERY_TRANSPORT === 'gemma') return 'gemma';
  return 'google';
}

// ─────────────────────────── bundle lookup (unchanged convention) ───────────────────────────

interface BundledQuestion {
  question_id: number;
  question: string;
  options: string[];
  answer: string;
  category?: string;
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

interface ParsedInput {
  qid?: number;
  question: string;
  options: Record<string, string> | null;
  correctAnswer?: string;
  qidNotFound?: boolean;
}

function parseQid(qid: number): ParsedInput {
  const q = loadQuestion(qid);
  if (!q) return { qid, question: '', options: null, qidNotFound: true };
  const opts: Record<string, string> = {};
  q.options.forEach((o, i) => { opts[letter(i)] = o; });
  return { qid, question: q.question, options: opts, correctAnswer: q.answer };
}

function parseFreeText(input: string): ParsedInput {
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
export async function runLianaCycleQuestion(
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
  /** D-BP151-026 (Contingency Operator: Survey Splice), ADDITIVE/OPTIONAL. undefined/false (and
   *  no CONTINGENCY_OPERATOR_SURVEY_SPLICE=1 env override -- see
   *  isContingencyOperatorSurveySpliceEnabled() above) = variant OFF, in which case this run takes
   *  the ORIGINAL, untouched code path below -- the exact `determineDemand(methodInput)` call and
   *  its two surrounding emit lines this file has run since D-BP150-003, byte-for-byte, nothing
   *  added, removed, or reordered. Every pre-existing caller (which passes nothing for this
   *  parameter) gets that exact path. true = the variant Founder BP151 Q-20 ordered built and
   *  tested, NOT ratified by existing: SURVEY (Founder steps 2/3/4/6, survey_stage.ts) runs before
   *  method selection, and DEMAND is derived from the surveyed ask
   *  (demand_test.ts's determineDemandFromSurveyedAsk()) instead of the CUES table. */
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
): Promise<LianaTerminalOutcome> {
  const trimmed = input.trim();
  const contingencyOperatorSurveyOn = isContingencyOperatorSurveySpliceEnabled(contingencyOperatorSurvey);
  const resolvedAmbiguityQueryTransport = resolveAmbiguityQueryTransport(ambiguityQueryTransport);
  // D-BP151-026: present on EVERY outcome this function returns, including an early/abstained/
  // thrown one, so the receipt always states which variant produced the run -- undefined (and
  // therefore omitted from the outcome object entirely, see liana_terminal_types.ts's own doc
  // comment on this field) whenever the variant is off, which keeps every OFF-path outcome object
  // identical to what this function produced before this ticket.
  const variant = contingencyOperatorSurveyOn ? ('contingency-operator-survey-splice' as const) : undefined;
  // Declared outside the try so the catch below can still return everything the operator typed
  // before they abandoned -- Founder, BP149: "a walk that throws away your annotations because
  // you quit early is worse than no walk."
  const audibleLog = new AudibleLog();
  const steppedLog = new SteppedAudibleLog();
  try {
    let parsed: ParsedInput;
    if (/^\d+$/.test(trimmed)) {
      parsed = parseQid(Number(trimmed));
      if (parsed.qidNotFound) {
        emit({ kind: 'error', text: `qid ${parsed.qid} not found in the bundled corpus (resources/mmlu_pro_bundled/questions.jsonl)`, ts: nowIso() });
        return { qid: parsed.qid, question: '', verdict: null, abstain: true, freeText: false, error: 'qid not in bundle', options: null, ...(variant ? { variant } : {}) };
      }
    } else {
      parsed = parseFreeText(trimmed);
    }

    const methodInput: MethodQuestionInput = {
      qid: parsed.qid,
      question: parsed.question,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
    };
    const freeText = parsed.qid == null;

    say(emit, parsed.qid != null ? `qid ${parsed.qid}` : 'free-text question');
    note(emit, `   ${parsed.question}`);
    if (parsed.options) {
      note(emit, `   ${Object.entries(parsed.options).map(([k, v]) => `${k}) ${v}`).join('  ')}`);
    } else {
      note(emit, '   (no lettered option list -- typed as a bare question)');
    }

    // D-BP151-026 (Contingency Operator: Survey Splice). OFF (the default -- see
    // isContingencyOperatorSurveySpliceEnabled() above) takes the `else` branch immediately below,
    // which is the untouched D-BP150-003 code this file has run since that ticket: the same two
    // emit lines, the same determineDemand(methodInput) call, nothing added, removed, or
    // reordered. ON runs SURVEY (Founder steps 2, 3, 4, 6) before method selection and derives
    // DEMAND from the surveyed ask instead.
    let demandResult: DemandResult;
    let surveyResult: SurveyStageResult | null = null;
    if (contingencyOperatorSurveyOn) {
      emit({
        kind: 'stage',
        text: '-> CONTINGENCY OPERATOR: SURVEY SPLICE is ON for this run -- Survey (Founder steps 2, 3, 4, 6) runs before method selection, and DEMAND is derived from the surveyed ask, not the CUES table (Founder, BP151, Q-20: "Splice into a Contingency Operator Variant so we can test")',
        ts: nowIso(),
      });
      // Survey's own MethodRunContext. Reuses the SAME injected askGoogle by reference (raw, not
      // wrapped by wrapAskGoogleWithAudible -- see this ticket's return, THINGS I NOTICED AND DID
      // NOT DO, for why Call an Audible's per-call pause was not extended to cover Survey's own
      // Google calls; that was not ordered here). wrapForSteppedAudible('survey', ...) below IS
      // wired -- that is Part 3's own requirement, not an extra.
      const surveyCtx: MethodRunContext = { askGoogle, emit };
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
      // PART 2: demand comes from the surveyed ask, WIRED not rewritten. Step 2's own output
      // (SurveyAskNestedResult) is exactly determineDemandFromSurveyedAsk()'s expected input
      // (demand_test.ts). D-BP151-032: when Step 2 took the NO-TERM/ambiguity path instead
      // (step2.nested stays null there BY DESIGN -- see survey_stage.ts's own doc comment on that
      // field), step2.ambiguityNested carries one nested survey per source-named term; that is fed
      // to determineDemandFromAmbiguityNested() (demand_test.ts), which itself calls
      // determineDemandFromSurveyedAsk() -- the SAME function -- once per named term and reports
      // UNKNOWN rather than choosing among them if they disagree (that function's own header). Only
      // when STEP 2 found NEITHER a term NOR any ambiguity-named term is there nothing to derive a
      // demand from at all -- reported honestly as demand unknown (canon R-5: a teaching prompt,
      // not a fabricated guess), the same refusal shape survey_stage.ts's own steps already use.
      //
      // LAW 5 (HARDWIRE-23): the receipt names which path produced the demand -- 'nested',
      // 'ambiguity', or 'none' -- in the transcript line emitted immediately below, independent of
      // demandResult.derivedFrom (which stays 'surveyed-ask' for both paths; the PATH distinction
      // is a finer-grained fact than the derivedFrom enum currently carries).
      const demandPath: 'nested' | 'ambiguity' | 'none' = surveyResult.step2.nested
        ? 'nested'
        : surveyResult.step2.ambiguityNested.length
          ? 'ambiguity'
          : 'none';
      note(emit, `   DEMAND PATH: ${demandPath} (Law 5, HARDWIRE-23 -- names which SURVEY STEP 2 result produced the demand below)`);
      demandResult = surveyResult.step2.nested
        ? determineDemandFromSurveyedAsk(surveyResult.step2.nested)
        : surveyResult.step2.ambiguityNested.length
          ? determineDemandFromAmbiguityNested(surveyResult.step2.ambiguityNested)
          : {
            demand: null,
            why: `SURVEY STEP 2 did not resolve a term to survey (${surveyResult.step2.why}) -- nothing to derive DEMAND from via the surveyed ask; this is a teaching prompt (canon R-5), not a fabricated guess`,
            derivedFrom: 'surveyed-ask',
          };
      emit({ kind: 'stage', text: '-> DEMAND TEST (SURVEYED ASK) -- what operation must this answer perform?', ts: nowIso() });
      note(emit, `   ${describeDemand(demandResult)}`);
    } else {
      // D-BP150-003 -- THE DEMAND TEST runs BEFORE method selection. Founder, BP150: determine
      // "WHICH METHOD of DATA needs to apply to the question in question... so we DON'T use it
      // wrongly." Canon: canon_the_demand_test_selects_by_operation_not_by_regex_bp150.
      // NOTE the placement is not yet the ruled one: canon R-2 puts this AFTER Survey the ASK, and
      // Survey is unbuilt on THIS path, so the derivation reads the question string and says so in
      // its own output.
      emit({ kind: 'stage', text: '-> DEMAND TEST -- what operation must this answer perform?', ts: nowIso() });
      demandResult = determineDemand(methodInput);
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
        ...(variant ? { variant } : {}),
      };
    }

    const { method, shape } = selection;
    say(emit, `METHOD SELECTED: ${method.name} (${method.id})`);
    note(emit, `   why: ${shape.reason}`);
    note(emit, `   taught by: ${method.taughtBy}`);

    if (!method.run) {
      emit({ kind: 'result', text: `NOT YET TAUGHT -- ${method.name} is a registered method whose shape matched, but it has no runner yet.`, ts: nowIso() });
      note(emit, '   This is a known shape, not an unknown one -- the Founder has not walked a case for it yet. That is the next teaching session.');
      return { qid: parsed.qid, question: parsed.question, verdict: null, correct: parsed.correctAnswer, abstain: true, freeText, error: 'method_not_yet_taught', method: method.id, options: parsed.options, ...(variant ? { variant } : {}) };
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
    const baseCtx: MethodRunContext = {
      askGoogle: wrapAskGoogleWithAudible(askGoogle, audible ?? null, emit, audibleLog),
      emit,
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
    return {
      ...outcome,
      method: method.id,
      options: parsed.options,
      ...(audibleLog.length ? { audibleLog: audibleLog.all() } : {}),
      ...(steppedLog.length ? { steppedLog: steppedLog.all() } : {}),
      ...(variant ? { variant } : {}),
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
        ...(variant ? { variant } : {}),
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
        ...(variant ? { variant } : {}),
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
      ...(variant ? { variant } : {}),
    };
  }
}
