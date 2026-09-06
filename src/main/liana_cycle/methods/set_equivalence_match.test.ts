// set_equivalence_match.test.ts -- D-BP213-XO-57/BISHOP-XO/seg-composer-methods
//
// KORSAIKOFF GATE, ANSWERED. The only name-token match is set_equivalence_match.ts itself, the
// SUBJECT of this suite -- no existing test covers its shapeTest() at all.
//
// THE GUARD THIS FILE ADDS: shapeTest() MUST return matches:true on this method's own founding
// example -- dataset question_id 6418 (bundled mnemosyne corpus field question_id 66), answer key
// H. run() MUST always abstain (CANNOT DECIDE) on that same question today, since the taught
// item-membership map is empty by design (see the method file's header), and MUST report the
// B/F paraphrase collision the Founder's own dispatch order named explicitly.
//
// electron is mocked on the same pattern as withheld_curve_shift_guard.test.ts -- never actually
// reached by shapeTest() or run() (neither does I/O beyond ctx.emit), the mock throws if anything
// ever does reach it.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => { throw new Error('app.getPath must never be reached by shapeTest()/run()'); }, isPackaged: false },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
}));

import {
  setEquivalenceMatchMethod,
  __xo57TestHooks,
  SetEquivalenceMatchQuarantineError,
  SET_EQUIVALENCE_MATCH_QUARANTINED,
} from './set_equivalence_match';
import type { MethodQuestionInput } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

const letter = (i: number): string => String.fromCharCode(65 + i);

function loadQuestionId6418(): MethodQuestionInput {
  const bundlePath = join(__dirname, '..', '..', '..', '..', 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
  const rows = readFileSync(bundlePath, 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as { question_id: number; source_id: string; question: string; options: string[]; answer: string });
  const row = rows.find((r) => r.question_id === 66);
  if (!row) throw new Error('question_id 66 (internal) not found in resources/mmlu_pro_bundled/questions.jsonl -- fixture missing, cannot run this guard');
  expect(row.source_id).toBe('6418');
  expect(row.answer).toBe('H');
  const options: Record<string, string> = {};
  row.options.forEach((o, i) => { options[letter(i)] = o; });
  return { question: row.question, options, qid: row.question_id, correctAnswer: row.answer };
}

function makeCtx() {
  const events: LianaTerminalEvent[] = [];
  return {
    ctx: {
      askGoogle: async () => { throw new Error('askGoogle must never be reached -- this method never calls out'); },
      emit: (e: LianaTerminalEvent) => { events.push(e); },
    },
    events,
  };
}

describe('set_equivalence_match.ts shapeTest() -- founding example regression guard', () => {
  it('matches its own founding example, dataset question_id 6418 (internal qid 66)', () => {
    const input = loadQuestionId6418();
    const result = setEquivalenceMatchMethod.shapeTest(input);
    expect(result.matches, `shapeTest refused on its own founding example: ${result.reason}`).toBe(true);
  });

  it('derives the exact 4-item universe {hard palate, lower first molar, upper central incisor, upper lip}', () => {
    const input = loadQuestionId6418();
    const parsed = __xo57TestHooks.parseOptions(input.options as Record<string, string>);
    const universe = __xo57TestHooks.buildUniverse(parsed);
    expect(universe).toEqual(['hard palate', 'lower first molar', 'upper central incisor', 'upper lip']);
  });

  it('detects the B/F Oxford-comma paraphrase collision the Founder named explicitly', () => {
    const input = loadQuestionId6418();
    const parsed = __xo57TestHooks.parseOptions(input.options as Record<string, string>);
    const collisions = __xo57TestHooks.findCollisions(parsed);
    expect(collisions.length).toBeGreaterThanOrEqual(1);
    const bf = collisions.find((c) => c.letters.includes('B') && c.letters.includes('F'));
    expect(bf, `no B/F collision found among: ${JSON.stringify(collisions)}`).toBeDefined();
    expect(bf?.letters).toEqual(['B', 'F']);
  });

  it('rejects a question with fewer than 2 options', () => {
    const input: MethodQuestionInput = { question: 'x', options: { A: 'hard palate' } };
    const result = setEquivalenceMatchMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });

  it('rejects an option set whose universe is too large (>6 distinct items)', () => {
    const input: MethodQuestionInput = {
      question: 'x',
      options: {
        A: 'item1, item2, item3, item4, item5, item6, item7',
        B: 'item1, item2',
        C: 'item3, item4',
      },
    };
    const result = setEquivalenceMatchMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });

  it('rejects an all-single-item option set (plain single-choice, not set-equivalence)', () => {
    const input: MethodQuestionInput = {
      question: 'x',
      options: { A: 'apples', B: 'oranges', C: 'pears' },
    };
    const result = setEquivalenceMatchMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });
});

describe('set_equivalence_match.ts run() -- QUARANTINED 2026-09-05, refuses loudly rather than abstaining', () => {
  // D-BP220-BM0-006/BISHOP-SEG, 2026-09-05: this describe block replaces the pre-fence suite,
  // which asserted run() abstains with CANNOT DECIDE. That was true and correct BEFORE the
  // quarantine fence (empty taught map, honest abstain); it is no longer this method's contract.
  // Measured (D-BP219-BM0-015_SHAPETEST_COVERAGE, D-BP219-BM0-040 canoe): shapeTest() never reads
  // the question stem, so its 273/12,032 coverage is accidental, and 50 of those 273 would
  // suppress the keyed correct answer if this method were ever taught and applied as-is. run()
  // now fails loudly instead, on every call, so a future re-teach cannot silently reactivate it.
  it('is marked quarantined on the exported method object', () => {
    expect(setEquivalenceMatchMethod.quarantined).toBe(true);
    expect(SET_EQUIVALENCE_MATCH_QUARANTINED).toBe(true);
    expect(setEquivalenceMatchMethod.quarantineReason).toMatch(/never reads the question stem/);
    expect(setEquivalenceMatchMethod.quarantineReason).toMatch(/50 of the 273/);
  });

  it('throws SetEquivalenceMatchQuarantineError on its own founding example, instead of computing or abstaining', async () => {
    const input = loadQuestionId6418();
    const { ctx, events } = makeCtx();
    await expect(setEquivalenceMatchMethod.run!(input, ctx)).rejects.toBeInstanceOf(SetEquivalenceMatchQuarantineError);
    // The refusal must also be visible in the emitted transcript, not only as a thrown value --
    // see the fenced run()'s own ctx.emit call, set_equivalence_match.ts.
    const quarantineEvent = events.find((e) => e.text?.includes('QUARANTINED'));
    expect(quarantineEvent, 'no QUARANTINED event emitted before the throw').toBeDefined();
    expect(quarantineEvent?.kind).toBe('error');
  });

  it('the thrown error message names the measured reason (never reads stem, 34 percent collisions, 50 of 273 suppress the correct answer)', async () => {
    const input = loadQuestionId6418();
    const { ctx } = makeCtx();
    let caught: unknown = null;
    try {
      await setEquivalenceMatchMethod.run!(input, ctx);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SetEquivalenceMatchQuarantineError);
    const message = (caught as Error).message;
    expect(message).toMatch(/never reads the question stem/);
    expect(message).toMatch(/34 percent/);
    expect(message).toMatch(/50 of the 273/);
    expect(message).toMatch(/SUPPRESS THE KEYED CORRECT ANSWER/);
  });

  it('never calls askGoogle (zero model/network calls, by design -- true before and after the fence)', async () => {
    const input = loadQuestionId6418();
    const { ctx } = makeCtx();
    // askGoogle throws if called. The fenced run() never reaches it either (it refuses before any
    // HALF A/HALF B logic runs at all) -- this test guards against a future edit accidentally
    // routing the quarantine check through code that touches askGoogle.
    await expect(setEquivalenceMatchMethod.run!(input, ctx)).rejects.toBeInstanceOf(SetEquivalenceMatchQuarantineError);
  });

  // D-BP213-XO-57 N=20 RECEIPT, ADAPTED FOR THE FENCE: proves the refusal is deterministic (every
  // call throws the identical message), the same discipline the pre-fence suite applied to the
  // abstain basis text.
  it('N=20: throws the identical quarantine error every time, zero askGoogle calls total', async () => {
    const input = loadQuestionId6418();
    const messages: string[] = [];
    let askGoogleCallCount = 0;
    for (let i = 0; i < 20; i += 1) {
      const { ctx } = makeCtx();
      const wrappedCtx = { ...ctx, askGoogle: async () => { askGoogleCallCount += 1; return ctx.askGoogle(); } };
      let caught: unknown = null;
      try {
        // eslint-disable-next-line no-await-in-loop -- deliberately sequential, per dispatch order.
        await setEquivalenceMatchMethod.run!(input, wrappedCtx);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(SetEquivalenceMatchQuarantineError);
      messages.push((caught as Error).message);
    }
    // eslint-disable-next-line no-console -- deliberate receipt output for the dispatch report.
    console.log('N=20 quarantine refusals:', messages.length, 'distinct messages:', new Set(messages).size);
    expect(messages.length).toBe(20);
    expect(new Set(messages).size).toBe(1); // identical refusal text every run
    expect(askGoogleCallCount).toBe(0);
  });
});

describe('set_equivalence_match.ts __xo57TestHooks.runUnguarded -- the pre-fence logic, kept for inspection only', () => {
  // The ORIGINAL run() body (HALF A report + HALF B empty-map abstain) is preserved, byte-for-byte,
  // as runUnguarded -- never wired to the registered method's own `run`, reachable only here. This
  // is what "leave it available for measurement and inspection" means for the run()-level logic
  // specifically (shapeTest() and the HALF A primitives were already exposed and are unaffected).
  it('still abstains with CANNOT DECIDE on the founding example (empty taught map, unchanged by the fence)', async () => {
    const input = loadQuestionId6418();
    const { ctx, events } = makeCtx();
    const outcome = await __xo57TestHooks.runUnguarded(input, ctx);
    expect(outcome.abstain).toBe(true);
    expect(outcome.verdict).toBeNull();
    expect(outcome.basis).toMatch(/CANNOT DECIDE/);
    expect(outcome.basis).toMatch(/PLATYPUS/);
    const collisionEvent = events.find((e) => e.text?.includes('PARAPHRASE COLLISION'));
    expect(collisionEvent, 'no PARAPHRASE COLLISION event emitted').toBeDefined();
    expect(collisionEvent?.text).toMatch(/B, F|F, B/);
  });
});
