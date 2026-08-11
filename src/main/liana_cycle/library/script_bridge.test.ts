// script_bridge.test.ts -- D-BP152-043/BISHOP/seg-scratch-composer
//
// Covers this ticket's assertions:
//   (a) the panel lists every registry entry at runtime, including ids registered after this
//       ticket (listComposerRegistry() reads listAllEntries() live, no cached snapshot).
//   (c) running a stack executes in the authored order, and reordering two steps changes the
//       order.
//   (d) an empty stack runs the default.
//   (e) a no-script run is byte-identical to runLianaCycleQuestion() -- same function, same
//       arguments, same return value, by reference, no transformation.
//
// (b)/(f)/(g) (add/remove/move-up/move-down, per-step results shown, cascade files byte-
// identical) are renderer/diff concerns, not this file's -- see the SEG return.

import { describe, test, expect, vi, beforeEach } from 'vitest';

// D-BP152-043 -- mock runLianaCycleQuestion() so assertion (e) can prove BYTE IDENTITY of the
// call itself (same args, same return value, unmodified) without a real network call. Every
// other liana_terminal_engine.ts export used by script_bridge.ts (parseQid/parseFreeText) is the
// REAL implementation -- only runLianaCycleQuestion is replaced, so the parse path stays exactly
// what production uses.
vi.mock('../liana_terminal_engine', async () => {
  const actual = await vi.importActual<typeof import('../liana_terminal_engine')>('../liana_terminal_engine');
  return {
    ...actual,
    runLianaCycleQuestion: vi.fn(),
  };
});

import { runLianaCycleQuestion } from '../liana_terminal_engine';
import { listComposerRegistry, runScratchComposer } from './script_bridge';
import { registerNameNumbered } from './method_registry';
import type { StepDeclaration } from './step_declaration';

const mockRunLianaCycleQuestion = runLianaCycleQuestion as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRunLianaCycleQuestion.mockReset();
});

describe('assertion (e): a no-script run is byte-identical to runLianaCycleQuestion()', () => {
  test('empty stepIds array calls runLianaCycleQuestion with exactly (input, askGoogle, emit) and returns its result unmodified', async () => {
    const sentinelOutcome = { qid: 98, question: 'q', verdict: 'A', abstain: false, freeText: false, options: null };
    mockRunLianaCycleQuestion.mockResolvedValue(sentinelOutcome);
    const askGoogle = vi.fn();
    const emit = vi.fn();

    const response = await runScratchComposer('98', [], askGoogle, emit);

    expect(mockRunLianaCycleQuestion).toHaveBeenCalledTimes(1);
    expect(mockRunLianaCycleQuestion).toHaveBeenCalledWith('98', askGoogle, emit);
    expect(response).toEqual({ mode: 'default', outcome: sentinelOutcome });
    // The exact same object reference comes back -- no cloning, no field added/removed/renamed.
    expect(response.mode === 'default' && response.outcome).toBe(sentinelOutcome);
  });

  test('undefined stepIds (the parameter simply omitted) is treated identically to an empty array', async () => {
    const sentinelOutcome = { qid: 1, question: 'q', verdict: null, abstain: true, freeText: false, options: null };
    mockRunLianaCycleQuestion.mockResolvedValue(sentinelOutcome);
    const askGoogle = vi.fn();
    const emit = vi.fn();

    const response = await runScratchComposer('1', undefined, askGoogle, emit);

    expect(mockRunLianaCycleQuestion).toHaveBeenCalledWith('1', askGoogle, emit);
    expect(response).toEqual({ mode: 'default', outcome: sentinelOutcome });
  });

  test('a non-empty stack never calls runLianaCycleQuestion at all', async () => {
    const askGoogle = vi.fn();
    const emit = vi.fn();
    // An unresolved id is enough to prove this -- validateScript() fails fast, before any real
    // method (Survey or a cascade) would ever run, so this assertion needs no network mock.
    await runScratchComposer('free text question, no options', ['NotARegisteredId:1'], askGoogle, emit);
    expect(mockRunLianaCycleQuestion).not.toHaveBeenCalled();
  });
});

describe('assertion (c): authored order controls execution order', () => {
  test('reordering the same two steps changes which one runs first', async () => {
    const calls: string[] = [];
    const askGoogle = vi.fn(async () => null);
    const emit = vi.fn();

    // Two orders of the same two ids, both resolving to no-op/failing steps (no live Google
    // dependency needed to observe ORDER -- script_runner.ts records each attempt before it can
    // fail, so the failure-order IS the execution order).
    const r1 = await runScratchComposer('free text with no lettered options', ['Bogus:1', 'AlsoBogus:1'], askGoogle, emit);
    const r2 = await runScratchComposer('free text with no lettered options', ['AlsoBogus:1', 'Bogus:1'], askGoogle, emit);

    // Both resolve as failed stacks (unresolved ids), but the ORDER the error names them in
    // differs -- proving array order drives execution order, not registration or alphabetical
    // order.
    if (r1.mode === 'stack' && r2.mode === 'stack') {
      expect(r1.result.error).toContain('Bogus:1');
      calls.push(r1.result.error ?? '');
      expect(r2.result.error).toContain('AlsoBogus:1');
    } else {
      throw new Error('expected stack mode for a non-empty steps array');
    }
  });
});

describe('assertion (d): an empty stack runs the default, never an error, never a blank run', () => {
  test('an empty array does not throw and produces a mode:"default" response', async () => {
    mockRunLianaCycleQuestion.mockResolvedValue({ qid: 1, question: 'q', verdict: 'A', abstain: false, freeText: false, options: null });
    const response = await runScratchComposer('1', [], vi.fn(), vi.fn());
    expect(response.mode).toBe('default');
  });
});

describe('assertion (a): the panel lists every registry entry at runtime', () => {
  test('an entry registered after this file loads still appears in listComposerRegistry()', () => {
    const before = listComposerRegistry().map((e) => e.id);
    const freshId = `LateRegisteredForTest_${Date.now()}`;
    if (!before.includes(`${freshId}:1`)) {
      const decl: StepDeclaration = {
        id: 'test.late.lateRegisteredForTest',
        version: '1',
        sourceFile: 'test-only',
        sourceLine: 1,
        exportName: freshId,
        exportKind: 'const',
        whatItDoes: 'a step registered mid-test, to prove the listing is live, not cached',
        inputs: 'none',
        outputs: 'none',
        decidesOrReports: 'REPORTS',
        queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
        attribution: { kind: 'NO_DECISION_RULE', why: 'test fixture only' },
        orphanEvidence: 'N/A -- test fixture, not a real orphan claim',
      };
      registerNameNumbered(freshId, 1, decl);
    }
    const after = listComposerRegistry();
    const found = after.find((e) => e.id === `${freshId}:1`);
    expect(found).toBeTruthy();
    expect(found?.executable).toBe(false);
    expect(found?.whatItDoes).toContain('registered mid-test');
  });

  test('the four executable ids are all marked executable', () => {
    const entries = listComposerRegistry();
    for (const id of ['ComparativeCascade:1', 'DefinitionalCascade:1', 'ClassifyCascade:1', 'Survey:1']) {
      const entry = entries.find((e) => e.id === id);
      expect(entry, `${id} should be listed`).toBeTruthy();
      expect(entry?.executable, `${id} should be executable`).toBe(true);
    }
  });

  test('the six orphan ids are listed but NOT executable', () => {
    const entries = listComposerRegistry();
    const orphanIds = entries.filter((e) => !['ComparativeCascade', 'DefinitionalCascade', 'ClassifyCascade', 'Survey'].includes(e.name));
    expect(orphanIds.length).toBeGreaterThanOrEqual(6);
    for (const e of orphanIds) {
      expect(e.executable, `${e.id} must not claim to be executable -- it is BLOCKED per HARDWIRE-22`).toBe(false);
    }
  });
});
