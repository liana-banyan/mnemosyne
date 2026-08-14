// script_bridge.keyed_terminator_label.test.ts -- D-BP154-036/BISHOP-SEG/S36/seg-wireit
//
// THE KEY-BLINDNESS PROOF Founder's own dispatch demands: "Prove that with a test: with the key
// present, the survivor set must be byte-identical to the run with the key absent." Runs the REAL
// runComposedStack() (script_bridge.ts) twice -- once with MethodQuestionInput.correctAnswer set,
// once with it absent -- everything else byte-identical, and asserts:
//   1. The Terminator:1 step's OWN raw result (survivors/eliminated/verdict/abstain/abstainReason
//      -- everything runTerminatorStep() itself computed) is byte-identical whether or not the key
//      was present. This is the literal proof: the key changed nothing the mechanism decided.
//   2. `keyedTerminatorLabel` DOES differ: absent with no key, present (ABSTAIN relabeled to
//      ANSWERED, FD-BP154-11's own qid-98 wording) with one.
//
// Stacks ONLY 'Terminator:1' -- it asks no query of its own (terminator_step.ts's own header) and
// its `_ctx` parameter is unused, so a MethodRunContext whose askGoogle/askConversationalAuthority
// both throw proves, structurally, that this test's own network stub is never touched either.

import { describe, test, expect } from 'vitest';
import { buildComposerRunBasis, runComposedStack } from './script_bridge';
import type { ComposedRunResult, ComposerStepOutcome } from './script_bridge';
import { applyKeyedAnswerLabel, classifyComposerStepResult } from '../../../shared/composer_step_classification';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

const OPT: Record<string, string> = { A: 'South America', B: 'South Asia', C: 'North Africa' };

function throwingCtx(): MethodRunContext {
  return {
    askGoogle: async () => { throw new Error('KEY-BLINDNESS TEST: askGoogle must never be called by Terminator:1'); },
    askConversationalAuthority: async () => { throw new Error('KEY-BLINDNESS TEST: askConversationalAuthority must never be called by Terminator:1'); },
    emit: () => {},
  };
}

describe('runComposedStack -- FD-BP154-11 key-blindness proof: the key never changes what the mechanism decides', () => {
  test('Terminator:1 with NO feeder steps stacked: same survivors/eliminated/abstain whether or not correctAnswer is present', async () => {
    const withoutKey: MethodQuestionInput = { qid: 98, question: 'q', options: OPT };
    const withKey: MethodQuestionInput = { qid: 98, question: 'q', options: OPT, correctAnswer: 'A' };

    const resultWithoutKey = await runComposedStack(['Terminator:1'], withoutKey, throwingCtx());
    const resultWithKey = await runComposedStack(['Terminator:1'], withKey, throwingCtx());

    expect(resultWithoutKey.ok).toBe(true);
    expect(resultWithKey.ok).toBe(true);

    const termWithoutKey = resultWithoutKey.results.find((r) => r.id === 'Terminator:1')?.raw;
    const termWithKey = resultWithKey.results.find((r) => r.id === 'Terminator:1')?.raw;
    // THE PROOF: byte-identical TerminatorResult -- survivors, eliminated, verdict, abstain,
    // abstainReason, contradiction, everything the mechanism itself computed.
    expect(JSON.stringify(termWithKey)).toBe(JSON.stringify(termWithoutKey));
    expect(termWithKey).toEqual(termWithoutKey);

    // Sanity: this fixture genuinely abstains (no feeder steps stacked -> no eliminations -> 3
    // survivors) -- otherwise "byte-identical" would be a vacuous claim over a degenerate case.
    expect((termWithoutKey as { abstain: boolean }).abstain).toBe(true);
    expect((termWithoutKey as { survivors: string[] }).survivors).toEqual(['A', 'B', 'C']);

    // The LABEL, meanwhile, DOES differ -- that's the whole point of FD-BP154-11: the key is
    // visible in the label without ever touching the decision above.
    expect(resultWithoutKey.keyedTerminatorLabel?.keyed).toBeUndefined();
    expect(resultWithoutKey.keyedTerminatorLabel?.cls).toBe('ABSTAIN');
    expect(resultWithKey.keyedTerminatorLabel?.cls).toBe('ANSWERED');
    expect(resultWithKey.keyedTerminatorLabel?.detail).toBe(
      'ANSWERED -- keyed answer: A. Not independently proven from the item text and admitted category evidence.',
    );
    expect(resultWithKey.keyedTerminatorLabel?.keyed).toEqual({ answer: 'A', matchesVerdict: null });
  });

  test('no correctAnswer on the input -> keyedTerminatorLabel is null-keyed (no label fabricated)', async () => {
    const input: MethodQuestionInput = { qid: 99, question: 'q', options: OPT };
    const result = await runComposedStack(['Terminator:1'], input, throwingCtx());
    expect(result.keyedTerminatorLabel?.keyed).toBeUndefined();
  });

  test('Terminator:1 absent from the stack -> keyedTerminatorLabel is null (nothing to label)', async () => {
    const input: MethodQuestionInput = { qid: 98, question: 'q', options: OPT, correctAnswer: 'A' };
    const result = await runComposedStack([], input, throwingCtx());
    expect(result.keyedTerminatorLabel).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP154-039/BISHOP-SEG/S39/seg-disagreement. THE LIVE DEFECT: LIANA_COMPOSER_RUN_qid98_
// 2026-08-14T21-59-51-048Z.json -- a complete seven-step run reached a REAL, unique-survivor
// VERDICT (F, Central Asia) while the key is A, and neither the receipt's `basis`
// ("VERDICT F) Central Asia", two words) nor the keyed label's own `detail` said the two
// disagreed. runComposedStack() cannot reach that scenario in a unit test without live network
// (every feeder step that could produce a real elimination needs a live authority) -- so this
// suite tests buildComposerRunBasis() directly against a fixture shaped exactly like that receipt's
// own `composerResult`, the same discipline terminator_step.test.ts's own fixture-based tests
// already use for deriveTerminatorEliminations(). THE BLINDNESS PROOF here is structural, not
// re-executed: buildComposerRunBasis() and applyKeyedAnswerLabel() both take `result.results`
// (which carries the survivor set) as a read-only input and never write back into it -- the SAME
// `results` array is passed to both the disagreeing-key and no-key calls below, so the survivor
// set is not merely "equal", it is the identical object both times; nothing in either function has
// a code path capable of touching it.

const REAL_VERDICT_OPT: Record<string, string> = {
  A: 'South America', C: 'North Africa', E: 'Europe', F: 'Central Asia',
};

function realVerdictResults(): ComposerStepOutcome[] {
  // Shaped exactly like the live qid-98 receipt's own Terminator:1 raw result (survivors A/C/E/F
  // narrowed to a unique verdict F via a magnitude ranking) -- verbatim structure, trimmed to the
  // fields buildComposerRunBasis()/classifyComposerStepResult() actually read.
  const terminatorRaw = {
    ok: true,
    stepsConsulted: { 'Softballs:1': 'ok', 'NamedSet:1': 'ok', 'Discriminator:1': 'ok', 'Magnitude:1': 'ok', 'HumanNuance:1': 'ok' },
    eliminated: [{ letter: 'B', name: 'South Asia', sourceStep: 'NamedSet:1', reason: 'source states this IS the superlative property', span: 'South Asia is explicitly one of the world\'s most densely populated regions' }],
    survivors: ['A', 'C', 'E', 'F'],
    contradiction: null,
    verdict: 'F',
    verdictName: 'Central Asia',
    abstain: false,
    abstainReason: null,
    basisStepClasses: ['ANSWERED', 'CORROBORATED', 'ANSWERED', 'ANSWERED', 'ANSWERED'],
    magnitudeBasis: { targetExtreme: 'least', property: 'world\'s most densely populated regions', span: 'Europe > North Africa > South America > Central Asia' },
    frameMatchBuckets: { affirmedNonMember: [], affirmedMember: ['A', 'C', 'E', 'F'], unstated: [] },
    incomplete: false,
  };
  const summary = 'TERMINATOR -- VERDICT F) Central Asia  ||  ELIMINATED: B) South Asia [NamedSet:1: source states this IS the superlative property -- "South Asia is explicitly one of the world\'s most densely populated regions"]  ||  MAGNITUDE BASIS: target=least of "world\'s most densely populated regions" -- "Europe > North Africa > South America > Central Asia"  ||  run complete -- all consulted steps green';
  return [{ id: 'Terminator:1', summary, raw: terminatorRaw }];
}

describe('buildComposerRunBasis -- D-BP154-039: a verdict basis is at least as rich as an abstain, and a disagreeing key is never silent', () => {
  test('a VERDICT basis now carries the FULL summary text (eliminations, magnitude basis), not a bare "VERDICT X) Name"', () => {
    const results = realVerdictResults();
    const result: ComposedRunResult = { ok: true, steps: [], results, keyedTerminatorLabel: null };
    const basis = buildComposerRunBasis(result);
    expect(basis).not.toBeNull();
    expect(basis).toContain('ELIMINATED');
    expect(basis).toContain('South Asia');
    expect(basis).toContain('MAGNITUDE BASIS');
    // THE OLD DEFECT, locked out: the pre-fix basis was exactly this bare string with nothing else.
    expect(basis).not.toBe('VERDICT F) Central Asia');
  });

  test('THE LIVE DEFECT, fixed: a disagreeing key makes the basis say so explicitly, FIRST, before the full detail', () => {
    const results = realVerdictResults();
    const blind = classifyComposerStepResult(results[0].raw);
    const keyedTerminatorLabel = applyKeyedAnswerLabel(blind, 'F', 'A'); // key is A, verdict is F -- DISAGREES
    const result: ComposedRunResult = { ok: true, steps: [], results, keyedTerminatorLabel };
    const basis = buildComposerRunBasis(result);
    expect(basis).not.toBeNull();
    expect(basis!.startsWith('VERDICT F -- DISAGREES WITH KEYED ANSWER A')).toBe(true);
    expect(basis).toContain('The evidence admitted does not entail the keyed answer');
    // AND the full elimination detail still follows -- the disagreement note ADDS to the basis, it
    // does not replace or shorten it.
    expect(basis).toContain('ELIMINATED');
    expect(basis).toContain('MAGNITUDE BASIS');
  });

  test('THE BLINDNESS PROOF: the survivor set (result.results) is the SAME object whether the key agrees, disagrees, or is absent -- buildComposerRunBasis()/applyKeyedAnswerLabel() only ever READ it', () => {
    const results = realVerdictResults();
    const blindForDisagree = classifyComposerStepResult(results[0].raw);
    const disagreeing = applyKeyedAnswerLabel(blindForDisagree, 'F', 'A');
    const blindForAgree = classifyComposerStepResult(results[0].raw);
    const agreeing = applyKeyedAnswerLabel(blindForAgree, 'F', 'F');

    const resultNoKey: ComposedRunResult = { ok: true, steps: [], results, keyedTerminatorLabel: null };
    const resultDisagree: ComposedRunResult = { ok: true, steps: [], results, keyedTerminatorLabel: disagreeing };
    const resultAgree: ComposedRunResult = { ok: true, steps: [], results, keyedTerminatorLabel: agreeing };

    // Literally the same array reference every time -- not merely deep-equal.
    expect(resultNoKey.results).toBe(results);
    expect(resultDisagree.results).toBe(results);
    expect(resultAgree.results).toBe(results);
    const survivors = (results[0].raw as { survivors: string[] }).survivors;
    expect(survivors).toEqual(['A', 'C', 'E', 'F']);

    // The three bases differ ONLY in whether/how they mention the key -- the eliminated/magnitude
    // detail (the actual mechanism output) is identical text in all three.
    const noKeyBasis = buildComposerRunBasis(resultNoKey)!;
    const disagreeBasis = buildComposerRunBasis(resultDisagree)!;
    const agreeBasis = buildComposerRunBasis(resultAgree)!;
    expect(noKeyBasis).not.toContain('DISAGREES');
    expect(agreeBasis).not.toContain('DISAGREES');
    expect(disagreeBasis).toContain('DISAGREES WITH KEYED ANSWER A');
    // strip each basis down to the shared summary tail and confirm it is byte-identical across all three.
    const sharedTail = results[0].summary;
    expect(noKeyBasis).toBe(sharedTail);
    expect(agreeBasis).toBe(sharedTail);
    expect(disagreeBasis.endsWith(sharedTail)).toBe(true);
  });

  test('an ABSTAIN basis is the full summary text too (symmetry -- a verdict and an abstain now carry the same richness)', () => {
    const abstainRaw = {
      ok: true, abstain: true, verdict: null,
      abstainReason: 'more than one survivor left (A, C, F) -- no stated distinction separated them further.',
    };
    const summary = 'TERMINATOR -- ABSTAIN: more than one survivor left (A, C, F) -- no stated distinction separated them further.  ||  ELIMINATED: (none)  ||  SURVIVORS: A, C, F';
    const results: ComposerStepOutcome[] = [{ id: 'Terminator:1', summary, raw: abstainRaw }];
    const result: ComposedRunResult = { ok: true, steps: [], results, keyedTerminatorLabel: null };
    expect(buildComposerRunBasis(result)).toBe(summary);
  });

  test('no Terminator:1 in results -> null, never a fabricated basis', () => {
    const result: ComposedRunResult = { ok: true, steps: [], results: [], keyedTerminatorLabel: null };
    expect(buildComposerRunBasis(result)).toBeNull();
  });
});
