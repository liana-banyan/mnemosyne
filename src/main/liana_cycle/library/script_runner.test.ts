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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP152-046/BISHOP/seg-stored-results-and-both-apply -- THIS TICKET'S OWN SEVEN ASSERTIONS.
// (a)-(d) landed in stage 1 (commit 38416c66, the "stored results" half); (e)/(f) ("both apply")
// are added here in stage 2. (g) (the three cascade files byte-identical) is proven by `git diff`,
// not a unit test -- see the SEG return.
//   (a) a stored result is retrievable by position and by id.
//   (b) a placeholder is substituted literally, before/after both recorded.
//   (c) a reference to a non-existent or not-yet-run step errors and names it.
//   (d) an oversized substitution reports rather than truncates.
//   (e) both applications are stored side by side and neither overwrites the other.
//   (f) disagreement is surfaced as a finding with no winner picked.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function extractLog(state: DemoState): string {
  return state.log[state.log.length - 1] ?? '(no entries yet)';
}

describe('D-BP152-046 assertion (a): a stored result is retrievable by position and by Name:Number id', () => {
  test('runScript() returns storedResults, addressable both ways, for every step that ran', async () => {
    const script = scriptOf('stores-results', ['step-a:1', 'step-b:1', 'step-c:1']);
    const resolve = makeCatalog(['step-a:1', 'step-b:1', 'step-c:1']);
    const execute = makeAppendExecutor({ 'step-a:1': 1, 'step-b:1': 10, 'step-c:1': 100 });

    const result = await runScript<DemoState>(
      script, { log: [], total: 0 }, resolve, execute, { extractResult: extractLog },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.storedResults).toEqual([
        { position: 1, id: 'step-a:1', result: 'step-a:1' },
        { position: 2, id: 'step-b:1', result: 'step-b:1' },
        { position: 3, id: 'step-c:1', result: 'step-c:1' },
      ]);
    }
  });

  test('storedResults is present (up to the point of failure) even on a failed run', async () => {
    const script = scriptOf('fails-after-one-store', ['step-a:1', 'step-fails:1']);
    const resolve = makeCatalog(['step-a:1', 'step-fails:1']);
    const execute: MethodExecutor<DemoState> = (identity, state) => {
      if (identity.id === 'step-fails:1') throw new Error('boom');
      return { log: [...state.log, identity.id], total: state.total };
    };

    const result = await runScript<DemoState>(
      script, { log: [], total: 0 }, resolve, execute, { extractResult: extractLog },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // step-a:1 completed and stored before step-fails:1 broke the run.
      expect(result.storedResults).toEqual([{ position: 1, id: 'step-a:1', result: 'step-a:1' }]);
    }
  });

  test('with no extractResult supplied, a default (JSON.stringify) still stores SOMETHING', async () => {
    const script = scriptOf('default-extractor', ['step-a:1']);
    const resolve = makeCatalog(['step-a:1']);
    const execute = makeAppendExecutor({ 'step-a:1': 1 });

    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, execute);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.storedResults).toHaveLength(1);
      expect(result.storedResults[0].result).toBe(JSON.stringify({ log: ['step-a:1'], total: 1 }));
    }
  });
});

describe('D-BP152-046 assertion (b): a placeholder substitutes literally, before/after both recorded', () => {
  test('step 2 stores a result; step 3\'s queryText references it by position and the transcript shows before/after', async () => {
    const stepIds = ['DefineTheTerm:1', 'ApplyFilter:1'];
    const script: Script = {
      identity: makeMethodIdentity('two-step-substitution', 1),
      description: 'step 2 references step 1\'s stored result, his own [insert stored result from N.] syntax',
      steps: [
        { id: 'DefineTheTerm:1', attribution: ATTRIBUTED_TEST },
        {
          id: 'ApplyFilter:1',
          attribution: ATTRIBUTED_TEST,
          queryText: 'which of these qualify given [insert stored result from 1.]?',
        },
      ],
      savedBy: 'Founder',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(stepIds);
    const seenQueryTexts: Array<string | undefined> = [];
    const execute: MethodExecutor<DemoState> = (identity, state, resolvedQueryText) => {
      seenQueryTexts.push(resolvedQueryText);
      return { log: [...state.log, identity.id], total: state.total };
    };

    const result = await runScript<DemoState>(
      script,
      { log: [], total: 0 },
      resolve,
      execute,
      { extractResult: extractLog },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The literal substitution reached the executor as resolvedQueryText -- untouched by any
      // model, verbatim splice only.
      expect(seenQueryTexts).toEqual([
        undefined, // DefineTheTerm:1 carried no queryText
        'which of these qualify given DefineTheTerm:1?',
      ]);
      const applyRecord = result.steps[1];
      expect(applyRecord.querySubstitution).toEqual({
        before: 'which of these qualify given [insert stored result from 1.]?',
        after: 'which of these qualify given DefineTheTerm:1?',
      });
      expect(applyRecord.instrumentLines?.some((l) => l.includes('PARSER INSTRUMENT'))).toBe(true);
      expect(applyRecord.instrumentLines?.some((l) => l.includes('BEFORE substitution'))).toBe(true);
      expect(applyRecord.instrumentLines?.some((l) => l.includes('AFTER substitution'))).toBe(true);
    }
  });

  test('a queryText with no placeholder passes through untouched and is still recorded', async () => {
    const script = scriptOf('plain-query-text', ['step-a:1']);
    script.steps[0].queryText = 'a plain question, nothing to insert';
    const resolve = makeCatalog(['step-a:1']);
    const execute = makeAppendExecutor({});

    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, execute, { extractResult: extractLog });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.steps[0].querySubstitution).toEqual({
        before: 'a plain question, nothing to insert',
        after: 'a plain question, nothing to insert',
      });
    }
  });
});

describe('D-BP152-046 assertion (c): a reference to a non-existent or not-yet-run step errors and names it', () => {
  test('a forward reference (to a step that has not run yet) stops the run and names the reference', async () => {
    const script: Script = {
      identity: makeMethodIdentity('forward-reference', 1),
      description: 'step 1 references step 2, which has not run yet',
      steps: [
        { id: 'step-a:1', attribution: ATTRIBUTED_TEST, queryText: 'affected by [insert stored result from 2.]' },
        { id: 'step-b:1', attribution: ATTRIBUTED_TEST },
      ],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['step-a:1', 'step-b:1']);
    const execute = makeAppendExecutor({});

    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, execute, { extractResult: extractLog });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedId).toBe('step-a:1');
      expect(result.error).toContain('"[insert stored result from 2.]"');
      expect(result.error).toContain('"2"');
      // step-b:1 never ran -- the run stopped, it did not skip ahead or guess.
      expect(result.steps.map((s) => s.id)).toEqual(['step-a:1']);
      expect(result.steps[0].status).toBe('failed');
    }
  });

  test('a reference to an id that never exists in this script errors and names it', async () => {
    const script: Script = {
      identity: makeMethodIdentity('nonexistent-reference', 1),
      description: 'references an id nothing in this run will ever produce',
      steps: [{ id: 'step-a:1', attribution: ATTRIBUTED_TEST, queryText: 'see [insert stored result from Ghost:9.]' }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['step-a:1']);
    const execute = makeAppendExecutor({});
    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, execute, { extractResult: extractLog });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Ghost:9');
  });
});

describe('D-BP152-046 assertion (d): an oversized substitution reports rather than truncates', () => {
  test('a substitution over the configured limit stops the run with a named error, and the stored result was never truncated', async () => {
    const script: Script = {
      identity: makeMethodIdentity('oversized-substitution', 1),
      description: 'step 2 pulls in a very large stored result',
      steps: [
        { id: 'step-a:1', attribution: ATTRIBUTED_TEST },
        { id: 'step-b:1', attribution: ATTRIBUTED_TEST, queryText: 'use [insert stored result from 1.]' },
      ],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['step-a:1', 'step-b:1']);
    const hugeResult = 'w'.repeat(1000);
    const execute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, identity.id], total: state.total });

    const result = await runScript<DemoState>(
      script,
      { log: [], total: 0 },
      resolve,
      execute,
      { extractResult: () => hugeResult, maxSubstitutedQueryLength: 100 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedId).toBe('step-b:1');
      expect(result.error).toContain('1004 chars');
      expect(result.error).toContain('100-char limit');
      // The oversized stored result itself was recorded, untruncated, before the refusal.
      expect(result.storedResults[0]).toEqual({ position: 1, id: 'step-a:1', result: hugeResult });
      expect(result.storedResults[0].result.length).toBe(1000);
    }
  });
});

describe('D-BP152-046 assertion (e): both applications are stored side by side, neither overwrites the other', () => {
  test('a bothApply step runs sourceExecute and execute (the Cascade) independently and stores both', async () => {
    const script: Script = {
      identity: makeMethodIdentity('both-apply-agree', 1),
      description: 'the source and the Cascade both apply the same criteria',
      steps: [{ id: 'ApplyFilter:1', attribution: ATTRIBUTED_TEST, bothApply: true }],
      savedBy: 'Founder',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['ApplyFilter:1']);
    const sourceExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'SOURCE'], total: 1 });
    const cascadeExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'CASCADE'], total: 2 });

    const result = await runScript<DemoState>(
      script,
      { log: [], total: 0 },
      resolve,
      cascadeExecute,
      { extractResult: (s) => s.log[s.log.length - 1], sourceExecute },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Neither side's own state mutation leaked into the other: current state continues from the
      // Cascade's own output (total 2), never the source's (total 1) -- BP151 not overturned.
      expect(result.finalState.total).toBe(2);
      expect(result.finalState.log).toEqual(['CASCADE']);
      const record = result.steps[0];
      expect(record.bothApply).toBeDefined();
      expect(record.bothApply?.sourceResult).toBe('SOURCE');
      expect(record.bothApply?.cascadeResult).toBe('CASCADE');
      // Both stored side by side, retrievable -- neither is missing, neither overwrote the other.
      expect(record.bothApply?.sourceResult).not.toBe(record.bothApply?.cascadeResult);
    }
  });

  test('a bothApply step with no sourceExecute supplied fails loudly rather than silently running one side', async () => {
    const script: Script = {
      identity: makeMethodIdentity('both-apply-misconfigured', 1),
      description: 'bothApply true but no sourceExecute given to runScript()',
      steps: [{ id: 'ApplyFilter:1', attribution: ATTRIBUTED_TEST, bothApply: true }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['ApplyFilter:1']);
    const cascadeExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'CASCADE'], total: 1 });

    const result = await runScript<DemoState>(script, { log: [], total: 0 }, resolve, cascadeExecute);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('bothApply');
      expect(result.error).toContain('sourceExecute');
    }
  });
});

describe('D-BP152-046 assertion (f): disagreement is surfaced as a finding, no winner picked', () => {
  test('sourceExecute and execute disagreeing sets agree: false, and the run continues (no automatic abstain)', async () => {
    const script: Script = {
      identity: makeMethodIdentity('both-apply-disagree', 1),
      description: 'source says eliminate A, Cascade says eliminate B',
      steps: [{ id: 'ApplyFilter:1', attribution: ATTRIBUTED_TEST, bothApply: true }],
      savedBy: 'Founder',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['ApplyFilter:1']);
    const sourceExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'eliminate A'], total: 0 });
    const cascadeExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'eliminate B'], total: 0 });

    const result = await runScript<DemoState>(
      script,
      { log: [], total: 0 },
      resolve,
      cascadeExecute,
      { extractResult: (s) => s.log[s.log.length - 1], sourceExecute },
    );

    expect(result.ok).toBe(true); // disagreement never aborts the run automatically
    if (result.ok) {
      const record = result.steps[0];
      expect(record.bothApply?.agree).toBe(false);
      expect(record.bothApply?.note).toContain('DISAGREEMENT');
      expect(record.bothApply?.note).toContain('no winner picked');
      // Neither side's text was declared "correct" or "chosen" -- a comparison, not a decision.
      expect(record.bothApply?.note).not.toMatch(/is correct|is chosen|selected as/i);
      // The Cascade's result is still what state continued from -- disagreement did not pick a winner
      // by silently swapping it either.
      expect(result.finalState.log).toEqual(['eliminate B']);
    }
  });

  test('agreement is recorded as corroboration, not silently discarded', async () => {
    const script: Script = {
      identity: makeMethodIdentity('both-apply-agree-note', 1),
      description: 'source and Cascade reach the same result',
      steps: [{ id: 'ApplyFilter:1', attribution: ATTRIBUTED_TEST, bothApply: true }],
      savedBy: 'Founder',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['ApplyFilter:1']);
    const sameBoth: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'same answer'], total: 0 });

    const result = await runScript<DemoState>(
      script,
      { log: [], total: 0 },
      resolve,
      sameBoth,
      { extractResult: (s) => s.log[s.log.length - 1], sourceExecute: sameBoth },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.steps[0].bothApply?.agree).toBe(true);
      expect(result.steps[0].bothApply?.note).toContain('corroboration');
    }
  });
});

describe('D-BP152-049 STAGE 2: a bare placeholder referencing a both-apply step\'s result refuses the run end-to-end (Founder, BP152, verbatim: "when a bare placeholder is used on a both-apply step, I want it to refuse and make me say which")', () => {
  test('step 2\'s bare [insert stored result from 1.] referencing bothApply step 1 stops the run and states both explicit forms', async () => {
    const script: Script = {
      identity: makeMethodIdentity('both-apply-then-bare-reference', 1),
      description: 'step 1 is bothApply; step 2 bare-references its stored result',
      steps: [
        { id: 'ApplyFilter:1', attribution: ATTRIBUTED_TEST, bothApply: true },
        { id: 'step-b:1', attribution: ATTRIBUTED_TEST, queryText: 'given [insert stored result from 1.], what next?' },
      ],
      savedBy: 'Founder',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['ApplyFilter:1', 'step-b:1']);
    const sourceExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'SOURCE'], total: 0 });
    const cascadeExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'CASCADE'], total: 0 });

    const result = await runScript<DemoState>(
      script,
      { log: [], total: 0 },
      resolve,
      cascadeExecute,
      { extractResult: (s) => s.log[s.log.length - 1], sourceExecute },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedId).toBe('step-b:1');
      expect(result.error).toContain('both-apply step');
      expect(result.error).toContain('[insert stored result from 1 (source).]');
      expect(result.error).toContain('[insert stored result from 1 (cascade).]');
      // step 1 itself completed and stored (both sides) before step 2's placeholder was refused.
      expect(result.storedResults).toHaveLength(1);
      expect(result.storedResults[0].bothApply).toEqual({ sourceResult: 'SOURCE', cascadeResult: 'CASCADE' });
    }
  });

  test('the same run succeeds when step 2 uses the explicit "(cascade)" form instead of a bare reference', async () => {
    const script: Script = {
      identity: makeMethodIdentity('both-apply-then-qualified-reference', 1),
      description: 'step 2 explicitly asks for the Cascade\'s own result',
      steps: [
        { id: 'ApplyFilter:1', attribution: ATTRIBUTED_TEST, bothApply: true },
        { id: 'step-b:1', attribution: ATTRIBUTED_TEST, queryText: 'given [insert stored result from 1 (cascade).], what next?' },
      ],
      savedBy: 'Founder',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['ApplyFilter:1', 'step-b:1']);
    const sourceExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'SOURCE'], total: 0 });
    const cascadeExecute: MethodExecutor<DemoState> = (identity, state) => ({ log: [...state.log, 'CASCADE'], total: 0 });
    const seenQueryTexts: Array<string | undefined> = [];
    const trackingCascadeExecute: MethodExecutor<DemoState> = (identity, state, resolvedQueryText) => {
      seenQueryTexts.push(resolvedQueryText);
      return cascadeExecute(identity, state);
    };

    const result = await runScript<DemoState>(
      script,
      { log: [], total: 0 },
      resolve,
      trackingCascadeExecute,
      { extractResult: (s) => s.log[s.log.length - 1], sourceExecute },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(seenQueryTexts).toEqual([undefined, 'given CASCADE, what next?']);
    }
  });
});
