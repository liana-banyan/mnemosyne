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
import { runComposedStack } from './script_bridge';
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
