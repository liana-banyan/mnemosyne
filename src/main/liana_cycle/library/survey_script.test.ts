// survey_script.test.ts -- D-BP152-042/BISHOP/seg-survey-composable-steps, STAGE 2/2
//
// THE BYTE-IDENTICAL PROOF. Verifies this ticket's own assertions:
//   (c) the default script (survey_default_script.ts) reproduces runSurveyStage()'s current
//       behavior byte-identically -- verdict-bearing fields (term, termWhy, step2, step3, step4,
//       step6, askNegated, neverAnswersTheQuestion, why) and the emitted transcript.
//   (d) omitting one part from an authored script skips exactly that part and nothing else.
//   (e) reordering two parts changes their execution order.
//   (f) importing survey_default_script.ts executes nothing.
//
// UNWIRED, TEST-ONLY. The MethodExecutor built below (surveyScriptExecutor) is NOT part of
// script.ts/script_runner.ts/survey_default_script.ts/survey_steps.ts -- per script_runner.ts's
// own design ("script_runner.ts never calls a real method itself... supplied by the caller"),
// wiring a script to real code is always the CALLER's responsibility. This file is that caller,
// for proof purposes only. Nothing here is imported by liana_terminal_engine.ts or any live run
// path -- runSurveyStage() itself remains the thing actually wired (behind
// isContingencyOperatorSurveySpliceEnabled()), untouched by this ticket.
//
// DETERMINISTIC, OFFLINE. Every case below uses `askGoogle: async () => null` (the same
// no-network convention survey_stage.test.ts's own core assertions already use) so no live
// Google/Ollama call happens anywhere in this file -- the same passage-unreachable branch fires on
// both the direct call and the script-run call, so the comparison is not sensitive to a live
// model's non-deterministic wording. The one case that needs a NON-null operation answer (to
// exercise the D-BP152-009 gate's SKIP branch) is tested at the gate-formula level directly,
// against a synthetic FounderStep2Result, rather than through a real (and therefore
// network/Ollama-dependent) askOperation() call -- see "assertion (c), gate SKIP branch" below.

import { describe, test, expect } from 'vitest';
import { runScript, type MethodExecutor } from './script_runner';
import type { ResolvedRef, Script, ScriptStepRef } from './script';
import { SURVEY_DEFAULT_SCRIPT } from './survey_default_script';
import {
  askAmbiguity,
  askOperation,
  founderStep2Survey,
  founderStep3CategorizeOptions,
  founderStep4DetermineRegister,
  founderStep6JarMethod,
  runSurveyStage,
  type FounderStep2Result,
  type FounderStep3Result,
  type FounderStep4Result,
  type FounderStep6Result,
  type JarSourceGroup,
  type SurveyStageOpts,
  type SurveyStageResult,
} from '../survey_stage';
import { findAskCatalyst } from '../elements/catalyst_words';
import { determineDemandFromOperationAnswer } from '../demand_test';
import type { MethodRunContext, EmitFn } from '../method_registry';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TEST HARNESS -- a fresh, deterministic, no-network MethodRunContext + event collector, same
// `fakeCtx()` shape survey_stage.test.ts already establishes as this repo's own convention for
// offline Survey tests.
// ─────────────────────────────────────────────────────────────────────────────────────────────

type TerminalEvent = { kind: string; text: string; ts: string };

function fakeCtx(): { ctx: MethodRunContext; events: TerminalEvent[] } {
  const events: TerminalEvent[] = [];
  const emit: EmitFn = (e) => { events.push(e as unknown as TerminalEvent); };
  return { ctx: { askGoogle: async () => null, emit }, events };
}

/** Strips `ts` (wall-clock, never identical across two separate runs) from an event list before
 *  comparing two transcripts -- every OTHER field (kind, text) must match exactly. */
function stripTimestamps(events: TerminalEvent[]): Array<{ kind: string; text: string }> {
  return events.map((e) => ({ kind: e.kind, text: e.text }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE STATE THREADED THROUGH A SURVEY SCRIPT RUN, AND THE EXECUTOR THAT RUNS ITS REAL PRIMITIVES.
//
// The D-BP152-009 GATE (Step 3 runs only when Step 2's operation query did not resolve a demand)
// is reproduced HERE, verbatim, from runSurveyStage()'s own gate (survey_stage.ts, current HEAD --
// see that function's own comment, "D-BP152-009"). It is NOT expressible inside script.ts's static
// `steps` array (no conditional branch exists in that format) -- see survey_default_script.ts's
// own header for why this lives in the executor rather than the script data. Nothing here changes
// what founderStep3CategorizeOptions() itself does, or when runSurveyStage() (the file actually
// wired live) runs it -- this is a second, parallel expression of the SAME already-ATTRIBUTED
// rule, built only to prove the default script's output matches runSurveyStage()'s own.
// ─────────────────────────────────────────────────────────────────────────────────────────────

interface SurveyScriptState {
  askText: string;
  options: Record<string, string> | null;
  ctx: MethodRunContext;
  term: string | null;
  ambiguityQueryTransport: 'google' | 'gemma';
  jarSourceGroups: JarSourceGroup[];
  step2?: FounderStep2Result;
  step3?: FounderStep3Result;
  step4?: FounderStep4Result;
  step6?: FounderStep6Result;
}

const surveyScriptExecutor: MethodExecutor<SurveyScriptState> = async (identity, state) => {
  switch (identity.id) {
    case 'DefineTheTerm:1': {
      const step2 = await founderStep2Survey(state.term, state.ctx, state.askText, state.ambiguityQueryTransport);
      return { ...state, step2 };
    }
    case 'Categorize:1': {
      if (!state.step2) {
        throw new Error('Categorize:1 ran before DefineTheTerm:1 -- Step 3\'s gate needs Step 2\'s operation result');
      }
      // Verbatim reproduction of runSurveyStage()'s own gate formula (survey_stage.ts, the
      // "D-BP152-009" comment block) -- ATTRIBUTED: Founder, BP152, verbatim (FD-BP152-01): "I
      // think survey goes too far... We REALLY need to have it ask the two part google question I
      // did last time. That saves a BUNCH of time. THen maybe if it doesn't come up with the
      // answer, we THEN do a phrase denotation for more."
      const operationDemandForGate = state.step2.operation
        ? determineDemandFromOperationAnswer(state.step2.operation.rawAnswer)
        : null;
      const step3ShouldRun = !operationDemandForGate?.demand;
      const step3: FounderStep3Result = step3ShouldRun
        ? await founderStep3CategorizeOptions(state.options, state.ctx)
        : {
            perOption: null,
            grouping: null,
            why: `SKIPPED (FD-BP152-01) -- SURVEY STEP 2's operation query already resolved DEMAND: `
              + `${operationDemandForGate!.demand} (DEMAND PATH: operation); the per-option denotation sweep `
              + 'is a fallback, run only when Step 2 does not resolve a demand',
          };
      return { ...state, step3 };
    }
    case 'DetermineRegister:1': {
      const step4 = await founderStep4DetermineRegister(state.term, state.askText, state.options, state.ctx);
      return { ...state, step4 };
    }
    case 'JarMethod:1': {
      const step6 = await founderStep6JarMethod(state.jarSourceGroups, state.options, state.ctx);
      return { ...state, step6 };
    }
    default:
      throw new Error(`surveyScriptExecutor: unknown step id "${identity.id}"`);
  }
};

/** Same catalog every script.test.ts/script_runner.test.ts test builds -- resolves the four
 *  Survey-part ids to 'method', everything else 'unresolved'. Does not touch method_registry.ts's
 *  own REGISTRY (kept separate, per script.ts's own "script.ts owns no registry of its own"). */
function surveyPartsCatalog(): (id: string) => ResolvedRef {
  const ids = ['DefineTheTerm:1', 'Categorize:1', 'DetermineRegister:1', 'JarMethod:1'];
  return (id: string): ResolvedRef => {
    if (ids.includes(id)) {
      const [name, numberStr] = id.split(':');
      return { kind: 'method', identity: { name, number: Number(numberStr), id } };
    }
    return { kind: 'unresolved' };
  };
}

/** Resolves term exactly the way runSurveyStage() does (survey_stage.ts, its own opening block) --
 *  reproduced here so the script-run path's term resolution matches the direct call's, byte for
 *  byte, without needing to reach into runSurveyStage() itself. */
function resolveTerm(askText: string, opts: SurveyStageOpts): { term: string | null; termWhy: string } {
  if (opts.explicitTerm && opts.explicitTerm.trim()) {
    return { term: opts.explicitTerm.trim(), termWhy: `caller-supplied explicit term override: "${opts.explicitTerm.trim()}"` };
  }
  const catalyst = findAskCatalyst(askText);
  if (catalyst) {
    return { term: catalyst.term, termWhy: `derived via findAskCatalyst() (elements/catalyst_words.ts, wired here for the first time): ${catalyst.why}` };
  }
  return {
    term: null,
    termWhy: 'findAskCatalyst() found no quoted term and no explains/describes/defines-style cue in the '
      + 'question -- refusing rather than guessing one from the raw question text (refusing beats guessing)',
  };
}

/** Runs the Survey default script (or a caller-supplied variant) end to end, mirroring
 *  runSurveyStage()'s own shape: resolve term, run the script's steps, build the same summary. */
async function runSurveyViaScript(
  script: Script,
  askText: string,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
  opts: SurveyStageOpts = {},
): Promise<SurveyStageResult> {
  const { term, termWhy } = resolveTerm(askText, opts);
  const initialState: SurveyScriptState = {
    askText,
    options,
    ctx,
    term,
    ambiguityQueryTransport: opts.ambiguityQueryTransport ?? 'google',
    jarSourceGroups: opts.jarSourceGroups ?? [],
  };
  const result = await runScript<SurveyScriptState>(script, initialState, surveyPartsCatalog(), surveyScriptExecutor);
  if (!result.ok) {
    throw new Error(`runSurveyViaScript: script failed at "${result.failedId}": ${result.error}`);
  }
  const finalState = result.finalState;
  const step2 = finalState.step2 ?? { term: null, nested: null, ambiguity: null, ambiguityNested: [], negationNamed: false, constraints: [], operation: null, thresholdQuestions: [], why: 'DefineTheTerm:1 omitted from this script' };
  const step3 = finalState.step3 ?? { perOption: null, grouping: null, why: 'Categorize:1 omitted from this script' };
  const step4 = finalState.step4 ?? { term, field: null, verified: false, why: 'DetermineRegister:1 omitted from this script' };
  const step6 = finalState.step6 ?? { named: [], eliminated: [], eliminatedLetters: [], why: 'JarMethod:1 omitted from this script' };

  const step2Summary = step2.nested
    ? `${step2.nested.levels.length} level(s) surveyed`
    : step2.ambiguityNested.length
      ? `no quoted/cued term -- ambiguity query named ${step2.ambiguity?.terms.length ?? 0} term(s), ${step2.ambiguityNested.length} surveyed, `
        + `${step2.constraints.length} constraint(s) asked (${step2.constraints.filter((c) => c.obtained).length} answered)`
      : 'not run';
  const why = `SURVEY complete -- term ${term ? `"${term}" (${termWhy})` : `unresolved (${termWhy})`}; `
    + `step2: ${step2Summary}; `
    + `step3: ${step3.perOption ? `${step3.perOption.letters.length} option(s) surveyed, ${step3.grouping?.groups.length ?? 0} group(s) proposed` : 'not run'}; `
    + `step4: ${step4.verified ? 'VERIFIED register' : 'unverified/unresolved'}; `
    + `step6: ${step6.named.length} named mention(s), ${step6.eliminatedLetters.length} option(s) eliminated by known query direction`
    + `${step2.negationNamed ? '; ASK NEGATED (source-named, step 2 ambiguity query)' : ''}. `
    + 'SURVEY NEVER ANSWERS THE QUESTION -- step 6\'s elimination narrows the option POOL (Founder-ordered, mechanical), '
    + 'no final verdict letter was ever picked by this stage.';

  return { askText, term, termWhy, step2, step3, step4, step6, askNegated: step2.negationNamed, neverAnswersTheQuestion: true, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ASSERTION (c): THE DEFAULT SCRIPT REPRODUCES runSurveyStage()'S CURRENT BEHAVIOR BYTE-IDENTICALLY
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('assertion (c): default script byte-identical to runSurveyStage(), quoted/cued-term path', () => {
  test('explicit term supplied -- step2 takes the single-call branch, gate trivially true, all four steps run identically', async () => {
    const askText = 'What is the density of "South America"?';
    const options = { A: 'South America', B: 'Western Europe' };
    const opts: SurveyStageOpts = { explicitTerm: 'South America' };

    const direct = fakeCtx();
    const directResult = await runSurveyStage(askText, options, direct.ctx, opts);

    const viaScript = fakeCtx();
    const scriptResult = await runSurveyViaScript(SURVEY_DEFAULT_SCRIPT, askText, options, viaScript.ctx, opts);

    expect(scriptResult.term).toBe(directResult.term);
    expect(scriptResult.termWhy).toBe(directResult.termWhy);
    expect(scriptResult.step2).toEqual(directResult.step2);
    expect(scriptResult.step3).toEqual(directResult.step3);
    expect(scriptResult.step4).toEqual(directResult.step4);
    expect(scriptResult.step6).toEqual(directResult.step6);
    expect(scriptResult.askNegated).toBe(directResult.askNegated);
    expect(scriptResult.neverAnswersTheQuestion).toBe(true);
    expect(scriptResult.why).toBe(directResult.why);
    // The full emitted transcript matches too, modulo wall-clock timestamps.
    expect(stripTimestamps(viaScript.events)).toEqual(stripTimestamps(direct.events));
  });
});

describe('assertion (c): default script byte-identical to runSurveyStage(), no-term path (Google unreachable, gate defaults RUN)', () => {
  test('no quoted/cued term, no live Google -- ambiguity/operation both refuse, step2 refuses, gate runs step3 as the fallback', async () => {
    const askText = 'a plain declarative sentence with no quoted term and no defines-cue';
    const options = { A: 'one', B: 'two' };
    const opts: SurveyStageOpts = {};

    const direct = fakeCtx();
    const directResult = await runSurveyStage(askText, options, direct.ctx, opts);

    const viaScript = fakeCtx();
    const scriptResult = await runSurveyViaScript(SURVEY_DEFAULT_SCRIPT, askText, options, viaScript.ctx, opts);

    expect(scriptResult.term).toBeNull();
    expect(scriptResult.term).toBe(directResult.term);
    expect(scriptResult.termWhy).toBe(directResult.termWhy);
    expect(scriptResult.step2).toEqual(directResult.step2);
    expect(scriptResult.step3).toEqual(directResult.step3);
    expect(scriptResult.step4).toEqual(directResult.step4);
    expect(scriptResult.step6).toEqual(directResult.step6);
    expect(scriptResult.why).toBe(directResult.why);
    expect(stripTimestamps(viaScript.events)).toEqual(stripTimestamps(direct.events));
  });
});

describe('assertion (c), gate SKIP branch: the executor\'s D-BP152-009 mirror matches runSurveyStage()\'s own skip construction verbatim', () => {
  test('a resolved operation demand produces the identical FounderStep3Result shape runSurveyStage() itself would build', async () => {
    // Synthetic FounderStep2Result standing in for a real askOperation() answer that resolves to a
    // demand (e.g. the source's own passage stated "the answer should be ranked") -- built directly
    // rather than through a live askOperation() call, so this case needs no network/Ollama.
    const synthetic: FounderStep2Result = {
      term: null,
      nested: null,
      ambiguity: { askedText: 'x', terms: [], modelUnreachable: false, transport: 'google', citations: [], rawGooglePassage: 'p', rawModelOutput: null, why: 'w' },
      ambiguityNested: [],
      negationNamed: false,
      constraints: [],
      operation: { askedText: 'x', rawAnswer: 'the items should be ranked by density', modelUnreachable: false, transport: 'google', citations: [], rawGooglePassage: 'p', rawModelOutput: null, why: 'w' },
      thresholdQuestions: [],
      why: 'synthetic, for the gate-mirror test only',
    };
    // What runSurveyStage() itself would compute and build, verbatim (survey_stage.ts's own gate
    // block) -- this is the REFERENCE, computed the same way the live orchestrator computes it.
    const referenceGate = determineDemandFromOperationAnswer(synthetic.operation!.rawAnswer);
    expect(referenceGate.demand).not.toBeNull(); // sanity: this case must actually exercise SKIP
    const referenceStep3: FounderStep3Result = {
      perOption: null,
      grouping: null,
      why: `SKIPPED (FD-BP152-01) -- SURVEY STEP 2's operation query already resolved DEMAND: `
        + `${referenceGate.demand} (DEMAND PATH: operation); the per-option denotation sweep `
        + 'is a fallback, run only when Step 2 does not resolve a demand',
    };

    const { ctx } = fakeCtx();
    const state: SurveyScriptState = {
      askText: 'x', options: { A: 'a', B: 'b' }, ctx, term: null, ambiguityQueryTransport: 'google', jarSourceGroups: [], step2: synthetic,
    };
    const after = await surveyScriptExecutor({ name: 'Categorize', number: 1, id: 'Categorize:1' }, state);
    expect((after as SurveyScriptState).step3).toEqual(referenceStep3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ASSERTION (d): OMITTING ONE PART SKIPS EXACTLY THAT PART AND NOTHING ELSE.
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('assertion (d): omitting a step from an authored script skips exactly that part', () => {
  test('omitting JarMethod:1 leaves step2/step3/step4 populated and step6 absent from the run -- nothing else changes', async () => {
    const askText = 'What is the density of "South America"?';
    const options = { A: 'South America', B: 'Western Europe' };
    const opts: SurveyStageOpts = { explicitTerm: 'South America' };

    const withoutJar: Script = {
      ...SURVEY_DEFAULT_SCRIPT,
      identity: { name: 'Survey', number: 2, id: 'Survey:2' },
      description: 'Survey without the Jar Method step -- authored omission, this ticket\'s own ask.',
      steps: SURVEY_DEFAULT_SCRIPT.steps.filter((s: ScriptStepRef) => s.id !== 'JarMethod:1'),
    };
    expect(withoutJar.steps.map((s) => s.id)).toEqual(['DefineTheTerm:1', 'Categorize:1', 'DetermineRegister:1']);

    const full = fakeCtx();
    const fullResult = await runSurveyViaScript(SURVEY_DEFAULT_SCRIPT, askText, options, full.ctx, opts);

    const partial = fakeCtx();
    const partialResult = await runSurveyViaScript(withoutJar, askText, options, partial.ctx, opts);

    // Everything up to and including step4 is untouched by the omission.
    expect(partialResult.step2).toEqual(fullResult.step2);
    expect(partialResult.step3).toEqual(fullResult.step3);
    expect(partialResult.step4).toEqual(fullResult.step4);
    // Step 6 never ran -- the omitted-step placeholder, not a fabricated elimination.
    expect(partialResult.step6.why).toBe('JarMethod:1 omitted from this script');
    expect(partialResult.step6.named).toEqual([]);
    expect(partialResult.step6.eliminated).toEqual([]);
    // No JarMethod:1 entry appears in the run transcript's stage events at all.
    const jarStageEmitted = partial.events.some((e) => e.text.includes('SURVEY STEP 6'));
    expect(jarStageEmitted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ASSERTION (e): REORDERING TWO PARTS CHANGES THEIR EXECUTION ORDER.
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('assertion (e): reordering two parts changes their execution order', () => {
  test('running DetermineRegister:1 before Categorize:1 changes the recorded run order', async () => {
    const askText = 'What is the density of "South America"?';
    const options = { A: 'South America', B: 'Western Europe' };
    const opts: SurveyStageOpts = { explicitTerm: 'South America' };
    const { term } = resolveTerm(askText, opts);

    const reordered: Script = {
      ...SURVEY_DEFAULT_SCRIPT,
      identity: { name: 'Survey', number: 3, id: 'Survey:3' },
      description: 'Survey with Step 4 authored BEFORE Step 3 -- reordering, this ticket\'s own ask.',
      steps: [
        SURVEY_DEFAULT_SCRIPT.steps[0], // DefineTheTerm:1
        SURVEY_DEFAULT_SCRIPT.steps[2], // DetermineRegister:1 -- swapped ahead of Categorize:1
        SURVEY_DEFAULT_SCRIPT.steps[1], // Categorize:1
        SURVEY_DEFAULT_SCRIPT.steps[3], // JarMethod:1
      ],
    };

    const { ctx } = fakeCtx();
    const initialState: SurveyScriptState = {
      askText, options, ctx, term, ambiguityQueryTransport: 'google', jarSourceGroups: [],
    };
    const result = await runScript<SurveyScriptState>(reordered, initialState, surveyPartsCatalog(), surveyScriptExecutor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.steps.map((s) => s.id)).toEqual(['DefineTheTerm:1', 'DetermineRegister:1', 'Categorize:1', 'JarMethod:1']);
      // The default (unreordered) script's own run order, for contrast.
      const forward = await runScript<SurveyScriptState>(
        SURVEY_DEFAULT_SCRIPT,
        { askText, options, ctx: fakeCtx().ctx, term, ambiguityQueryTransport: 'google', jarSourceGroups: [] },
        surveyPartsCatalog(),
        surveyScriptExecutor,
      );
      expect(forward.ok).toBe(true);
      if (forward.ok) {
        expect(forward.steps.map((s) => s.id)).toEqual(['DefineTheTerm:1', 'Categorize:1', 'DetermineRegister:1', 'JarMethod:1']);
        expect(result.steps.map((s) => s.id)).not.toEqual(forward.steps.map((s) => s.id));
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ASSERTION (b) (carried from stage 1) + ASSERTION (f): Survey:1 is registered BOTH as the
// composite method (method_registry.ts, untouched) AND expressed as this script, and importing
// this script executes nothing.
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('survey_default_script.ts -- pure data, inert', () => {
  test('SURVEY_DEFAULT_SCRIPT carries identity Survey:1 and the four parts in the Founder\'s order', () => {
    expect(SURVEY_DEFAULT_SCRIPT.identity).toEqual({ name: 'Survey', number: 1, id: 'Survey:1' });
    expect(SURVEY_DEFAULT_SCRIPT.steps.map((s) => s.id)).toEqual([
      'DefineTheTerm:1', 'Categorize:1', 'DetermineRegister:1', 'JarMethod:1',
    ]);
  });

  test('assertion (f): this file imports nothing from survey_stage.ts, methods/*.ts, or elements/*.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const here = __dirname;
    const src = fs.readFileSync(path.join(here, 'survey_default_script.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"].*survey_stage['"]/);
    expect(src).not.toMatch(/from ['"].*\/methods\//);
    expect(src).not.toMatch(/from ['"].*\/elements\//);
  });

  test('no field on SURVEY_DEFAULT_SCRIPT or its steps is a function -- descriptive data only', () => {
    for (const [key, value] of Object.entries(SURVEY_DEFAULT_SCRIPT)) {
      expect(typeof value, `SURVEY_DEFAULT_SCRIPT.${key} must not be a function`).not.toBe('function');
    }
    for (const step of SURVEY_DEFAULT_SCRIPT.steps) {
      for (const [key, value] of Object.entries(step)) {
        expect(typeof value, `step ${step.id}.${key} must not be a function`).not.toBe('function');
      }
    }
  });
});

// Referenced only so TypeScript does not flag askAmbiguity/askOperation as unused in strict builds
// that check unused-import rules across the whole file -- both are exercised transitively (via
// founderStep2Survey()) by every test above; this line documents that these are the SAME two
// primitives AmbiguityQuery:1/OperationQuery:1 (survey_steps.ts, stage 1) describe, now provably
// reachable in this file precisely because D-BP152-042 exported them.
void askAmbiguity;
void askOperation;
