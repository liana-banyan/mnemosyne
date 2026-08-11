// script_runner.test.ts -- D-BP152-041/BISHOP/seg-script-format-and-runner
//
// Covers this ticket's assertions (a), (b), (c), (e), and (f). See script.test.ts for (d).
//   (a) a script of three steps executes them in the authored order, state threaded through.
//   (b) reordering the same three ids changes the execution order.
//   (c) a nested script runs inline and the transcript shows the nesting.
//   (e) a failing step stops the run and names the id, with no partial-state continuation.
//   (f) importing the module executes nothing.

import { describe, test, expect } from 'vitest';
import { makeMethodIdentity, type ResolvedRef, type Script } from './script';
import { describeStateChange, runScript, type MethodExecutor } from './script_runner';

const ATTRIBUTED_TEST = {
  kind: 'ATTRIBUTED' as const,
  founderRuling: 'BP152',
  quote: 'stack methods in whatever order I want',
  citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP152.md FD-BP152-20',
};

interface DemoState {
  log: string[];
  total: number;
}

function scriptOf(name: string, stepIds: string[]): Script {
  return {
    identity: makeMethodIdentity(name, 1),
    description: `test script ${name}`,
    steps: stepIds.map((id) => ({ id, attribution: ATTRIBUTED_TEST })),
    savedBy: 'test',
    savedAt: '2026-08-11T00:00:00.000Z',
  };
}

function makeCatalog(methodIds: string[], scripts: Script[] = []): (id: string) => ResolvedRef {
  return (id: string): ResolvedRef => {
    const nested = scripts.find((s) => s.identity.id === id);
    if (nested) return { kind: 'script', script: nested };
    if (methodIds.includes(id)) {
      const [name, numberStr] = id.split(':');
      return { kind: 'method', identity: makeMethodIdentity(name, Number(numberStr)) };
    }
    return { kind: 'unresolved' };
  };
}

/** Appends its own id to state.log and adds `amount` to state.total -- deterministic, so ordering
 *  and threading are directly observable in the assertions below. */
function makeAppendExecutor(amounts: Record<string, number>): MethodExecutor<DemoState> {
  return (identity, state) => ({
    log: [...state.log, identity.id],
    total: state.total + (amounts[identity.id] ?? 0),
  });
}

describe('script_runner.ts -- assertion (a): authored order, state threaded through', () => {
  test('three steps execute in authored order, each receiving the prior step\'s output', async () => {
    const script = scriptOf('three-step', ['step-a:1', 'step-b:1', 'step-c:1']);
    const resolve = makeCatalog(['step-a:1', 'step-b:1', 'step-c:1']);
    const execute = makeAppendExecutor({ 'step-a:1': 1, 'step-b:1': 10, 'step-c:1': 100 });

    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, execute);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.finalState.log).toEqual(['step-a:1', 'step-b:1', 'step-c:1']);
      expect(result.finalState.total).toBe(111); // 1, then +10 = 11, then +100 = 111 -- threaded
      expect(result.steps.map((s) => s.id)).toEqual(['step-a:1', 'step-b:1', 'step-c:1']);
      expect(result.steps.every((s) => s.status === 'ok')).toBe(true);
      expect(result.steps.every((s) => typeof s.durationMs === 'number')).toBe(true);
    }
  });
});

describe('script_runner.ts -- assertion (b): reordering the same three ids changes execution order', () => {
  test('a differently-ordered script of the same three ids produces a different run order and total', async () => {
    const resolve = makeCatalog(['step-a:1', 'step-b:1', 'step-c:1']);
    // total is order-sensitive: each step multiplies-then-adds using the running total, so swapping
    // order changes the arithmetic, not just the log order.
    const execute: MethodExecutor<DemoState> = (identity, state) => {
      const deltas: Record<string, number> = { 'step-a:1': 1, 'step-b:1': 10, 'step-c:1': 100 };
      return { log: [...state.log, identity.id], total: state.total * 2 + (deltas[identity.id] ?? 0) };
    };

    const forward = scriptOf('order-forward', ['step-a:1', 'step-b:1', 'step-c:1']);
    const reversed = scriptOf('order-reversed', ['step-c:1', 'step-b:1', 'step-a:1']);

    const forwardResult = await runScript<DemoState>(forward, { log: [], total: 0 }, resolve, execute);
    const reversedResult = await runScript<DemoState>(reversed, { log: [], total: 0 }, resolve, execute);

    expect(forwardResult.ok).toBe(true);
    expect(reversedResult.ok).toBe(true);
    if (forwardResult.ok && reversedResult.ok) {
      expect(forwardResult.finalState.log).toEqual(['step-a:1', 'step-b:1', 'step-c:1']);
      expect(reversedResult.finalState.log).toEqual(['step-c:1', 'step-b:1', 'step-a:1']);
      expect(forwardResult.finalState.total).not.toBe(reversedResult.finalState.total);
    }
  });
});

describe('script_runner.ts -- assertion (c): a nested script runs inline, transcript shows nesting', () => {
  test('a script containing a nested script runs the nested steps inline, recorded as children', async () => {
    const nested = scriptOf('nested-pair', ['inner-x:1', 'inner-y:1']);
    const top = scriptOf('outer-with-nested', ['outer-start:1', 'nested-pair:1', 'outer-end:1']);
    const resolve = makeCatalog(['outer-start:1', 'inner-x:1', 'inner-y:1', 'outer-end:1'], [nested]);
    const execute = makeAppendExecutor({});

    const result = await runScript<DemoState>(top, { log: [], total: 0 }, resolve, execute);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The state was threaded straight through the nested script -- inline execution.
      expect(result.finalState.log).toEqual(['outer-start:1', 'inner-x:1', 'inner-y:1', 'outer-end:1']);

      expect(result.steps.map((s) => ({ id: s.id, kind: s.kind, depth: s.depth }))).toEqual([
        { id: 'outer-start:1', kind: 'method', depth: 0 },
        { id: 'nested-pair:1', kind: 'script', depth: 0 },
        { id: 'outer-end:1', kind: 'method', depth: 0 },
      ]);

      const nestedRecord = result.steps[1];
      expect(nestedRecord.kind).toBe('script');
      expect(nestedRecord.children).toBeDefined();
      expect(nestedRecord.children!.map((c) => ({ id: c.id, kind: c.kind, depth: c.depth }))).toEqual([
        { id: 'inner-x:1', kind: 'method', depth: 1 },
        { id: 'inner-y:1', kind: 'method', depth: 1 },
      ]);
    }
  });
});

describe('script_runner.ts -- assertion (e): a failing step stops the run, no partial-state continuation', () => {
  test('a step that throws stops the run, names the failing id, and no later step runs', async () => {
    const script = scriptOf('will-fail', ['step-a:1', 'step-fails:1', 'step-c:1']);
    const resolve = makeCatalog(['step-a:1', 'step-fails:1', 'step-c:1']);
    const execute: MethodExecutor<DemoState> = (identity, state) => {
      if (identity.id === 'step-fails:1') throw new Error('deliberate test failure at step-fails:1');
      return { log: [...state.log, identity.id], total: state.total };
    };

    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, execute);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedId).toBe('step-fails:1');
      expect(result.error).toContain('deliberate test failure');
      // Only step-a ran successfully before the failure; step-c never ran.
      expect(result.steps.map((s) => s.id)).toEqual(['step-a:1', 'step-fails:1']);
      expect(result.steps[0].status).toBe('ok');
      expect(result.steps[1].status).toBe('failed');
      // state at failure reflects step-a only -- step-c's effect never happened.
      expect(result.stateAtFailure.log).toEqual(['step-a:1']);
    }
  });

  test('a step that fails inside a nested script bubbles the real leaf id up, and the outer run stops', async () => {
    const nested = scriptOf('nested-with-failure', ['inner-ok:1', 'inner-fails:1']);
    const top = scriptOf('outer-catches-nested-failure', ['outer-start:1', 'nested-with-failure:1', 'outer-end:1']);
    const resolve = makeCatalog(['outer-start:1', 'inner-ok:1', 'inner-fails:1', 'outer-end:1'], [nested]);
    const execute: MethodExecutor<DemoState> = (identity, state) => {
      if (identity.id === 'inner-fails:1') throw new Error('nested failure');
      return { log: [...state.log, identity.id], total: state.total };
    };

    const result = await runScript<DemoState>(top, { log: [], total: 0 }, resolve, execute);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedId).toBe('inner-fails:1'); // the real leaf, not the wrapping script id
      expect(result.steps.map((s) => s.id)).toEqual(['outer-start:1', 'nested-with-failure:1']);
      expect(result.steps[1].status).toBe('failed');
      expect(result.steps[1].children?.map((c) => c.id)).toEqual(['inner-ok:1', 'inner-fails:1']);
      // outer-end never ran.
      expect(result.stateAtFailure.log).toEqual(['outer-start:1', 'inner-ok:1']);
    }
  });

  test('an unresolved step id stops the run and names that id', async () => {
    const script = scriptOf('has-unknown-step', ['step-a:1', 'ghost:9']);
    const resolve = makeCatalog(['step-a:1']);
    const execute = makeAppendExecutor({});

    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, execute);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedId).toBe('ghost:9');
      expect(result.error).toContain('does not resolve');
    }
  });
});

describe('script_runner.ts -- describeStateChange (support for "what it changed")', () => {
  test('reports added/removed/changed top-level keys between two plain objects', () => {
    expect(describeStateChange({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })).toBe('added c; changed b');
  });

  test('reports no change when nothing differs', () => {
    expect(describeStateChange({ a: 1 }, { a: 1 })).toBe('no change');
  });
});

describe('script_runner.ts -- assertion (f): importing this module executes nothing', () => {
  test('exposes only functions -- reachable with no import-time side effect having thrown or blocked', () => {
    expect(typeof runScript).toBe('function');
    expect(typeof describeStateChange).toBe('function');
  });
});
