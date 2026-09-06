// umbrella_or_school_check.test.ts -- D-BP213-XO-64/BISHOP-XO/seg-composer-methods, LEG 3
//
// KORSAIKOFF GATE, ANSWERED. The only name-token match is umbrella_or_school_check.ts itself, the
// SUBJECT of this suite -- no existing test covers its shapeTest() at all.
//
// THE GUARD THIS FILE ADDS: shapeTest() MUST return matches:true on this method's own founding
// example -- dataset question_id 5152 (bundled mnemosyne corpus field question_id 92), answer key
// E. run() MUST return the honest UMBRELLA=true, step-9, BOTH-LIVE (B and E), low-confidence
// abstain on that same question today (per the spec's own disclaimer that step 8 alone would not
// have produced E outright) -- NEVER a forced single-letter E, which would be exactly the
// post-hoc-fitted-to-the-key failure mode this whole leg exists to avoid.
//
// THE BLIND RE-TEST (the actual point of this dispatch, D-BP213-XO-64): shapeTest() MUST ALSO
// fire on question_id 5065 ("According to The Federalist Papers, ..."), a HELD-OUT question this
// method's TAUGHT_FOUNDING_MOVE_MAP was never carved from, proving the TRIGGER generalizes; run()
// on that same question MUST abstain with CANNOT DECIDE, proving the RESOLUTION machinery does
// NOT yet generalize past its one founding label -- both facts asserted explicitly, neither
// papered over.
//
// electron is mocked on the same pattern as withheld_curve_shift_guard.test.ts / set_equivalence_
// match.test.ts -- never actually reached by shapeTest() or run() (neither does I/O beyond
// ctx.emit), the mock throws if anything ever does reach it.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => { throw new Error('app.getPath must never be reached by shapeTest()/run()'); }, isPackaged: false },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
}));

import { umbrellaOrSchoolCheckMethod, __xo64TestHooks } from './umbrella_or_school_check';
import type { MethodQuestionInput } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

const letter = (i: number): string => String.fromCharCode(65 + i);

/** Loads a bundled-corpus row by its INTERNAL qid (the bundled file's own question_id field,
 *  1..140), same convention as set_equivalence_match.test.ts's loadQuestionId6418(). Verifies the
 *  row's source_id (the REAL dataset question_id) matches what the header/report cite, so a future
 *  edit to the bundled fixture cannot silently desync this test from the crosswalk. */
function loadBundledRow(internalQid: number, expectSourceId: string, expectAnswer: string): MethodQuestionInput {
  const bundlePath = join(__dirname, '..', '..', '..', '..', 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
  const rows = readFileSync(bundlePath, 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as { question_id: number; source_id: string; question: string; options: string[]; answer: string });
  const row = rows.find((r) => r.question_id === internalQid);
  if (!row) throw new Error(`internal qid ${internalQid} not found in resources/mmlu_pro_bundled/questions.jsonl -- fixture missing, cannot run this guard`);
  expect(row.source_id).toBe(expectSourceId);
  expect(row.answer).toBe(expectAnswer);
  const options: Record<string, string> = {};
  row.options.forEach((o, i) => { options[letter(i)] = o; });
  return { question: row.question, options, qid: row.question_id, correctAnswer: row.answer };
}

/** question_id 5065 ("According to The Federalist Papers, ...") is NOT in the 140-row bundled
 *  corpus, so it is loaded directly off the full 12,032-row dataset, same file the step-1 scan
 *  read. This is the genuine HELD-OUT question -- verified by direct dataset lookup, not
 *  reconstructed from memory. */
function loadHeldOutQuestion5065(): MethodQuestionInput {
  const datasetPath = 'C:\\Users\\Administrator\\Documents\\DATASETS\\MMLU-Pro\\mmlu-pro-test.jsonl';
  const lines = readFileSync(datasetPath, 'utf-8').split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    const row = JSON.parse(line) as { question_id: number; question: string; options: string[]; answer: string };
    if (row.question_id === 5065) {
      expect(row.question).toMatch(/^According to The Federalist Papers,/);
      const options: Record<string, string> = {};
      row.options.forEach((o, i) => { options[letter(i)] = o; });
      return { question: row.question, options, qid: row.question_id, correctAnswer: row.answer };
    }
  }
  throw new Error('question_id 5065 not found in mmlu-pro-test.jsonl -- cannot run the blind held-out guard');
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

describe('umbrella_or_school_check.ts shapeTest() -- founding example regression guard', () => {
  it('matches its own founding example, dataset question_id 5152 (internal qid 92)', () => {
    const input = loadBundledRow(92, '5152', 'E');
    const result = umbrellaOrSchoolCheckMethod.shapeTest(input);
    expect(result.matches, `shapeTest refused on its own founding example: ${result.reason}`).toBe(true);
  });

  it('extracts operator "Within" and label "Critical Security Studies" from question_id 5152', () => {
    const input = loadBundledRow(92, '5152', 'E');
    const found = __xo64TestHooks.findOperatorLabel(input.question);
    expect(found).toEqual({ operator: 'Within', label: 'Critical Security Studies' });
  });

  it('classifies "Critical Security Studies" as UMBRELLA-shaped (ends in "Studies")', () => {
    expect(__xo64TestHooks.isUmbrellaShapedLabel('Critical Security Studies')).toBe(true);
  });

  it('classifies a bare personal name as NOT umbrella-shaped', () => {
    expect(__xo64TestHooks.isUmbrellaShapedLabel('Erikson')).toBe(false);
    expect(__xo64TestHooks.isUmbrellaShapedLabel('Abraham Maslow')).toBe(false);
  });

  it('rejects a question with fewer than 2 options', () => {
    const input: MethodQuestionInput = { question: 'Within X, what is Y?', options: { A: 'one' } };
    const result = umbrellaOrSchoolCheckMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });

  it('rejects a stem with no attribution operator', () => {
    const input: MethodQuestionInput = {
      question: 'What is the capital of France?',
      options: { A: 'Paris', B: 'Lyon' },
    };
    const result = umbrellaOrSchoolCheckMethod.shapeTest(input);
    expect(result.matches).toBe(false);
    expect(result.reason).toMatch(/no attribution operator/);
  });
});

describe('umbrella_or_school_check.ts shapeTest() -- BLIND HELD-OUT RE-TEST, question_id 5065', () => {
  it('fires on question_id 5065 ("The Federalist Papers"), a question the taught map was never carved from', () => {
    const input = loadHeldOutQuestion5065();
    const result = umbrellaOrSchoolCheckMethod.shapeTest(input);
    expect(result.matches, `shapeTest refused on the held-out question: ${result.reason}`).toBe(true);
  });

  it('extracts operator "According to" and label "The Federalist Papers" from question_id 5065', () => {
    const input = loadHeldOutQuestion5065();
    const found = __xo64TestHooks.findOperatorLabel(input.question);
    expect(found).toEqual({ operator: 'According to', label: 'The Federalist Papers' });
  });
});

describe('umbrella_or_school_check.ts run() -- founding example, honest step-9 both-live abstain', () => {
  it('abstains with BOTH B and E live, low confidence -- never a forced single letter E', async () => {
    const input = loadBundledRow(92, '5152', 'E');
    const { ctx, events } = makeCtx();
    const outcome = await umbrellaOrSchoolCheckMethod.run!(input, ctx);
    expect(outcome.abstain).toBe(true);
    expect(outcome.verdict).toBeNull();
    expect(outcome.basis).toMatch(/UMBRELLA=true/);
    expect(outcome.basis).toMatch(/BOTH LIVE CANDIDATES/);
    expect(outcome.basis).toMatch(/\bB\b/);
    expect(outcome.basis).toMatch(/\bE\b/);
    const stageEvent = events.find((e) => e.text?.includes('umbrella-or-school-check founding move'));
    expect(stageEvent, 'no founding-move fact event emitted').toBeDefined();
  });

  it('never calls askGoogle (zero model/network calls, by design)', async () => {
    const input = loadBundledRow(92, '5152', 'E');
    const { ctx } = makeCtx();
    const outcome = await umbrellaOrSchoolCheckMethod.run!(input, ctx);
    expect(outcome.basis).not.toMatch(/askGoogle must never be reached/);
  });

  // D-BP213-XO-64 N=20 RECEIPT, same discipline as leg2's own N=20 test -- this method makes zero
  // model calls and is pure code plus a static taught-map table, so its output is deterministic
  // by construction; this proves that determinism against the REAL production run() 20 times
  // rather than asserting it from reading the code.
  it('N=20: identical both-live abstain every time, zero askGoogle calls total', async () => {
    const input = loadBundledRow(92, '5152', 'E');
    const outcomes: { verdict: string | null; abstain: boolean; basis: string | undefined }[] = [];
    let askGoogleCallCount = 0;
    for (let i = 0; i < 20; i += 1) {
      const { ctx } = makeCtx();
      const wrappedCtx = { ...ctx, askGoogle: async () => { askGoogleCallCount += 1; return ctx.askGoogle(); } };
      // eslint-disable-next-line no-await-in-loop -- deliberately sequential, per dispatch order.
      const outcome = await umbrellaOrSchoolCheckMethod.run!(input, wrappedCtx);
      outcomes.push({ verdict: outcome.verdict, abstain: outcome.abstain, basis: outcome.basis });
    }
    const verdictCounts = outcomes.reduce<Record<string, number>>((acc, o) => {
      const key = o.abstain ? 'ABSTAIN' : String(o.verdict);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    // eslint-disable-next-line no-console -- deliberate receipt output for the dispatch report.
    console.log('N=20 verdict distribution (founding example):', JSON.stringify(verdictCounts));
    expect(verdictCounts).toEqual({ ABSTAIN: 20 });
    expect(new Set(outcomes.map((o) => o.basis)).size).toBe(1); // identical basis text every run
    expect(askGoogleCallCount).toBe(0);
  });
});

describe('umbrella_or_school_check.ts run() -- BLIND HELD-OUT RE-TEST, question_id 5065', () => {
  it('abstains with CANNOT DECIDE (no taught entry for "The Federalist Papers") -- the resolution ' +
    'half does NOT yet generalize past its one founding label, reported honestly, not papered over', async () => {
    const input = loadHeldOutQuestion5065();
    const { ctx, events } = makeCtx();
    const outcome = await umbrellaOrSchoolCheckMethod.run!(input, ctx);
    expect(outcome.abstain).toBe(true);
    expect(outcome.verdict).toBeNull();
    expect(outcome.basis).toMatch(/CANNOT DECIDE/);
    expect(outcome.basis).toMatch(/PLATYPUS/);
    expect(outcome.basis).toMatch(/no entry in the taught founding-move map/);
    // No founding-move fact event should be emitted for this label -- the lookup failed before
    // any axis/POS/survivor computation ran.
    const stageEvent = events.find((e) => e.text?.includes('umbrella-or-school-check founding move'));
    expect(stageEvent).toBeUndefined();
  });

  it('never calls askGoogle on the held-out question either', async () => {
    const input = loadHeldOutQuestion5065();
    const { ctx } = makeCtx();
    const outcome = await umbrellaOrSchoolCheckMethod.run!(input, ctx);
    expect(outcome.basis).not.toMatch(/askGoogle must never be reached/);
  });
});
