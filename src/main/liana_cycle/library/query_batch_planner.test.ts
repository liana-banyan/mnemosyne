// query_batch_planner.test.ts -- D-BP152-051/BISHOP/seg-assisted-mode, STAGE 2/2
//
// Deterministic, offline: no network call, no model call, no file I/O -- planBatches() is pure
// text handling (extractPlaceholderRefs()) over an in-memory Script.

import { describe, test, expect } from 'vitest';
import type { Script, ScriptStepRef } from './script';
import { makeMethodIdentity } from './script';
import { matchBatchAnswers, planBatches, roundCount } from './query_batch_planner';

const ATTR: ScriptStepRef['attribution'] = {
  kind: 'TARE',
  note: 'test fixture, not a real Founder order',
};

function step(id: string, queryText?: string): ScriptStepRef {
  return { id, attribution: ATTR, queryText };
}

function script(steps: ScriptStepRef[]): Script {
  return {
    identity: makeMethodIdentity('TestScript', 1),
    description: 'test fixture',
    steps,
    savedBy: 'test',
    savedAt: new Date(0).toISOString(),
  };
}

describe('planBatches -- his own worked stack is fully sequential (3 rounds of 1)', () => {
  test('FD-BP152-21 worked example: step2 (ask), step3 (refs 2), step4 (refs 3) -- 3 rounds', () => {
    const s = script([
      step('AskGoogle:1', 'Ask Google "what is the specific population density threshold?"'),
      step('DefineTheTerm:1', 'What factors affect the [insert stored result from 1.]?'),
      step('AskGoogle:2', 'Which of these answers qualify as affected by [insert stored result from 2.]'),
    ]);
    const plan = planBatches(s);
    expect(plan.unresolvable).toEqual([]);
    expect(plan.rounds.map((r) => r.queries.map((q) => q.id))).toEqual([
      ['AskGoogle:1'],
      ['DefineTheTerm:1'],
      ['AskGoogle:2'],
    ]);
    expect(roundCount(plan)).toBe(3);
  });
});

describe('planBatches -- two genuinely independent queries land in ONE round', () => {
  test('neither references the other -- batched together', () => {
    const s = script([
      step('Q:1', 'Ask Google "what is X?"'),
      step('Q:2', 'Ask Google "what is Y?"'),
    ]);
    const plan = planBatches(s);
    expect(plan.rounds).toEqual([{ round: 1, queries: expect.arrayContaining([
      expect.objectContaining({ id: 'Q:1' }),
      expect.objectContaining({ id: 'Q:2' }),
    ]) }]);
    expect(plan.rounds[0].queries).toHaveLength(2);
    expect(roundCount(plan)).toBe(1);
  });

  test('a third query depending on one of the pair waits for round 2', () => {
    const s = script([
      step('Q:1', 'Ask Google "what is X?"'),
      step('Q:2', 'Ask Google "what is Y?"'),
      step('Q:3', 'Given [insert stored result from Q:1.], which applies?'),
    ]);
    const plan = planBatches(s);
    expect(plan.rounds).toHaveLength(2);
    expect(plan.rounds[0].queries.map((q) => q.id).sort()).toEqual(['Q:1', 'Q:2']);
    expect(plan.rounds[1].queries.map((q) => q.id)).toEqual(['Q:3']);
  });
});

describe('planBatches -- referenced by position instead of id', () => {
  test('a position ref ("1.") resolves the same as an id ref', () => {
    const s = script([
      step('Q:1', 'Ask Google "what is X?"'),
      step('Q:2', 'Given [insert stored result from 1.], which applies?'),
    ]);
    const plan = planBatches(s);
    expect(plan.rounds.map((r) => r.queries.map((q) => q.id))).toEqual([['Q:1'], ['Q:2']]);
  });
});

describe('planBatches -- a structural (non-query) step forces a round boundary', () => {
  test('a step with no queryText closes the batch before and after it', () => {
    const s = script([
      step('Q:1', 'Ask Google "what is X?"'),
      step('StateTheQuestion:1'), // no queryText -- structural
      step('Q:2', 'Ask Google "what is Y?"'),
    ]);
    const plan = planBatches(s);
    expect(plan.structuralStepIds).toEqual(['StateTheQuestion:1']);
    // Q:1 and Q:2 do not depend on each other, but the structural step between them still forces
    // two separate rounds -- see this file's own header on why batch membership must never imply
    // an execution order the real runner would not itself produce.
    expect(plan.rounds.map((r) => r.queries.map((q) => q.id))).toEqual([['Q:1'], ['Q:2']]);
  });

  test('a later query may reference a structural step\'s stored result with no error', () => {
    const s = script([
      step('StateTheQuestion:1'),
      step('Q:1', 'Given [insert stored result from StateTheQuestion:1.], what is X?'),
    ]);
    const plan = planBatches(s);
    expect(plan.unresolvable).toEqual([]);
    expect(plan.rounds.map((r) => r.queries.map((q) => q.id))).toEqual([['Q:1']]);
  });
});

describe('planBatches -- an unresolvable reference is reported, never silently batched (requirement f\'s planning-time analogue)', () => {
  test('a reference to a step that does not exist in this script is named, not guessed', () => {
    const s = script([
      step('Q:1', 'Given [insert stored result from 99.], what is X?'),
    ]);
    const plan = planBatches(s);
    expect(plan.rounds).toEqual([]);
    expect(plan.unresolvable).toHaveLength(1);
    expect(plan.unresolvable[0].step.id).toBe('Q:1');
    expect(plan.unresolvable[0].missingRefs).toEqual(['99']);
  });

  test('a forward/self reference can never resolve (matches stored_results.ts\'s own real-run semantics) and is reported', () => {
    const s = script([
      step('Q:1', 'Given [insert stored result from 2.], what is X?'),
      step('Q:2', 'Ask Google "what is Y?"'),
    ]);
    const plan = planBatches(s);
    expect(plan.unresolvable).toHaveLength(1);
    expect(plan.unresolvable[0].step.id).toBe('Q:1');
    // Q:2 itself has no placeholder and is perfectly plannable -- one bad reference does not
    // poison an unrelated step.
    expect(plan.rounds.map((r) => r.queries.map((q) => q.id))).toEqual([['Q:2']]);
  });
});

describe('planBatches -- a script with no query-bearing steps at all plans zero rounds', () => {
  test('qid 98\'s default run is NOT an authored Script (comparative_cascade.ts is opaque code, not '
    + 'a stack of queryText-bearing steps) -- this is the honest shape that finding takes: an empty '
    + 'script (or one built only from structural steps) has nothing to batch', () => {
    const s = script([step('StateTheQuestion:1'), step('ComparativeCascade:1')]);
    const plan = planBatches(s);
    expect(plan.rounds).toEqual([]);
    expect(roundCount(plan)).toBe(0);
    expect(plan.structuralStepIds).toEqual(['StateTheQuestion:1', 'ComparativeCascade:1']);
  });
});

describe('matchBatchAnswers -- unambiguous matching by ref, never by paste order (requirement f)', () => {
  const s = script([
    step('Q:1', 'Ask Google "what is X?"'),
    step('Q:2', 'Ask Google "what is Y?"'),
    step('Q:3', 'Ask Google "what is Z?"'),
  ]);
  const round = planBatches(s).rounds[0];

  test('answers pasted IN declared order bind correctly', () => {
    const result = matchBatchAnswers(round, [
      { ref: '1', text: 'answer to X' },
      { ref: '2', text: 'answer to Y' },
      { ref: '3', text: 'answer to Z' },
    ]);
    expect(result.missing).toEqual([]);
    expect(result.unrecognizedRefs).toEqual([]);
    expect(result.matched.map((m) => [m.query.id, m.text])).toEqual([
      ['Q:1', 'answer to X'],
      ['Q:2', 'answer to Y'],
      ['Q:3', 'answer to Z'],
    ]);
  });

  test('answers pasted OUT OF ORDER still bind to the correct query -- never mis-bound', () => {
    const result = matchBatchAnswers(round, [
      { ref: '3', text: 'answer to Z' },
      { ref: '1', text: 'answer to X' },
      { ref: '2', text: 'answer to Y' },
    ]);
    expect(result.missing).toEqual([]);
    expect(result.matched.map((m) => [m.query.id, m.text])).toEqual([
      ['Q:1', 'answer to X'],
      ['Q:2', 'answer to Y'],
      ['Q:3', 'answer to Z'],
    ]);
  });

  test('a ref by Name:Number id works the same as a ref by position', () => {
    const result = matchBatchAnswers(round, [{ ref: 'Q:2', text: 'answer to Y' }]);
    expect(result.matched).toEqual([{ query: round.queries.find((q) => q.id === 'Q:2'), text: 'answer to Y' }]);
  });

  test('a missing answer is named, not silently dropped or mis-bound to a neighbor', () => {
    const result = matchBatchAnswers(round, [
      { ref: '1', text: 'answer to X' },
      { ref: '3', text: 'answer to Z' },
    ]);
    expect(result.missing.map((q) => q.id)).toEqual(['Q:2']);
    expect(result.matched.map((m) => m.query.id)).toEqual(['Q:1', 'Q:3']);
  });

  test('a ref that does not belong to this round is reported as unrecognized, never guessed into a slot', () => {
    const result = matchBatchAnswers(round, [
      { ref: '1', text: 'answer to X' },
      { ref: '99', text: 'stray answer' },
    ]);
    expect(result.unrecognizedRefs).toEqual(['99']);
    expect(result.missing.map((q) => q.id)).toEqual(['Q:2', 'Q:3']);
    expect(result.matched.map((m) => m.query.id)).toEqual(['Q:1']);
  });

  test('answering the same ref twice keeps the LAST value (operator self-correction), not flagged as an error', () => {
    const result = matchBatchAnswers(round, [
      { ref: '1', text: 'first draft' },
      { ref: '1', text: 'corrected answer' },
    ]);
    expect(result.matched.find((m) => m.query.id === 'Q:1')?.text).toBe('corrected answer');
  });

  test('zero answers supplied: every query in the round is reported missing', () => {
    const result = matchBatchAnswers(round, []);
    expect(result.matched).toEqual([]);
    expect(result.missing.map((q) => q.id)).toEqual(['Q:1', 'Q:2', 'Q:3']);
  });
});

describe('planBatches -- resolveKind lets a nested script be reported honestly rather than mis-planned', () => {
  test('a step resolving to "script" is listed in opaqueNestedIds, not structuralStepIds, and still forces a round boundary', () => {
    const s = script([
      step('Q:1', 'Ask Google "what is X?"'),
      step('Survey:1'),
      step('Q:2', 'Given [insert stored result from Survey:1.], what is Y?'),
    ]);
    const plan = planBatches(s, (id) => (id === 'Survey:1' ? 'script' : 'method'));
    expect(plan.opaqueNestedIds).toEqual(['Survey:1']);
    expect(plan.structuralStepIds).toEqual([]);
    expect(plan.rounds.map((r) => r.queries.map((q) => q.id))).toEqual([['Q:1'], ['Q:2']]);
  });
});
