// purpose_step.test.ts -- D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 1/3

import { describe, expect, it, vi } from 'vitest';
import {
  buildPurposeProbeQuery,
  checkPurposeConsistency,
  derivePurposeCandidates,
  derivePurposeType,
  eliminatePurposeCandidates,
  runPurposeStep,
} from './purpose_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

const QID98_QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
const QID98_SRC = 'ori_mmlu-high_school_geography';
const QID98_CATEGORY = 'other';

function ctx(): MethodRunContext {
  return { askGoogle: vi.fn(), emit: vi.fn() };
}

describe('derivePurposeCandidates', () => {
  it('extracts a stem candidate from a "considered X" question', () => {
    const cs = derivePurposeCandidates(QID98_QUESTION, undefined, undefined);
    expect(cs).toHaveLength(1);
    expect(cs[0].source).toBe('stem');
    expect(cs[0].statement).toMatch(/densely populated regions/);
    expect(cs[0].span).toMatch(/densely populated regions/);
  });

  it('extracts a src candidate from originSrc, stripping the ori_ prefix', () => {
    const cs = derivePurposeCandidates('irrelevant?', QID98_SRC, undefined);
    const src = cs.find((c) => c.source === 'src');
    expect(src).toBeDefined();
    expect(src!.statement).toBe('this question concerns high school geography');
    expect(src!.span).toBe(QID98_SRC);
  });

  it('extracts a category candidate verbatim', () => {
    const cs = derivePurposeCandidates('irrelevant?', undefined, 'physics');
    const cat = cs.find((c) => c.source === 'category');
    expect(cat).toBeDefined();
    expect(cat!.statement).toBe('this question concerns physics');
    expect(cat!.span).toBe('physics');
  });

  it('emits all three candidates for qid 98 (SET, not one)', () => {
    const cs = derivePurposeCandidates(QID98_QUESTION, QID98_SRC, QID98_CATEGORY);
    expect(cs).toHaveLength(3);
    expect(cs.map((c) => c.source).sort()).toEqual(['category', 'src', 'stem']);
  });

  it('never reads options -- signature carries no options parameter at all', () => {
    // Structural proof, not a runtime assertion: derivePurposeCandidates has no 4th parameter.
    expect(derivePurposeCandidates.length).toBe(3);
  });

  it('emits nothing for a question with no matching shape and no metadata', () => {
    expect(derivePurposeCandidates('What is 2+2?', undefined, undefined)).toHaveLength(0);
  });
});

describe('eliminatePurposeCandidates', () => {
  it('eliminates a stoplisted category ("other") by the declared rule', () => {
    const cs = derivePurposeCandidates(QID98_QUESTION, QID98_SRC, QID98_CATEGORY);
    const { survivors, eliminated } = eliminatePurposeCandidates(cs);
    expect(survivors.map((c) => c.source).sort()).toEqual(['src', 'stem']);
    expect(eliminated).toHaveLength(1);
    expect(eliminated[0].candidate.source).toBe('category');
    expect(eliminated[0].reason).toMatch(/PURPOSE_STOPLIST/);
  });

  it('is case-insensitive and whitespace-tolerant on the stoplist', () => {
    const cs = derivePurposeCandidates('irrelevant?', undefined, '  Other  ');
    const { survivors, eliminated } = eliminatePurposeCandidates(cs);
    expect(survivors).toHaveLength(0);
    expect(eliminated).toHaveLength(1);
  });

  it('never eliminates a genuinely informative candidate', () => {
    const cs = derivePurposeCandidates('irrelevant?', undefined, 'high_school_geography');
    const { survivors, eliminated } = eliminatePurposeCandidates(cs);
    expect(survivors).toHaveLength(1);
    expect(eliminated).toHaveLength(0);
  });

  it('returns INSUFFICIENT-shaped empty survivors when every candidate is stoplisted', () => {
    const cs = derivePurposeCandidates('irrelevant?', undefined, 'other');
    const { survivors } = eliminatePurposeCandidates(cs);
    expect(survivors).toHaveLength(0);
  });
});

describe('derivePurposeType', () => {
  it('classifies qid 98 as NEGATED_SUPERLATIVE_MEMBERSHIP', () => {
    expect(derivePurposeType(QID98_QUESTION)).toBe('NEGATED_SUPERLATIVE_MEMBERSHIP');
  });

  it('classifies a direct (non-negated) superlative question as UNCLASSIFIED', () => {
    expect(derivePurposeType("Which region is considered the world's most densely populated?"))
      .toBe('UNCLASSIFIED');
  });

  it('classifies a question with no stem shape as UNCLASSIFIED', () => {
    expect(derivePurposeType('What is the capital of France?')).toBe('UNCLASSIFIED');
  });
});

describe('the probe mechanism (BUILT, not ACTIVE)', () => {
  it('buildPurposeProbeQuery never asks "is this purpose right"', () => {
    const cs = derivePurposeCandidates(QID98_QUESTION, undefined, undefined);
    const q = buildPurposeProbeQuery(cs[0], QID98_QUESTION);
    expect(q.toLowerCase()).not.toMatch(/is this purpose right/);
  });

  it('checkPurposeConsistency is mechanical: affirms on a plain yes', () => {
    expect(checkPurposeConsistency('Yes, this question is about population distribution.')).toBe(true);
  });

  it('checkPurposeConsistency is mechanical: refuses on a plain no', () => {
    expect(checkPurposeConsistency('No, it does not concern that subject.')).toBe(false);
  });
});

describe('runPurposeStep', () => {
  it('succeeds for qid 98 with a SET of survivors, spans, and purposeType', async () => {
    const input: MethodQuestionInput = {
      qid: 98, question: QID98_QUESTION, options: null, originSrc: QID98_SRC, category: QID98_CATEGORY,
    };
    const { result, summary } = await runPurposeStep(input, ctx());
    expect(result.ok).toBe(true);
    expect(result.purposeType).toBe('NEGATED_SUPERLATIVE_MEMBERSHIP');
    expect(result.candidates).toHaveLength(3);
    expect(result.survivors.map((c) => c.source).sort()).toEqual(['src', 'stem']);
    expect(result.eliminated).toHaveLength(1);
    for (const s of result.survivors) expect(s.span.length).toBeGreaterThan(0);
    expect(summary).toMatch(/PURPOSE --/);
  });

  it('computes sufficiency INSUFFICIENT for qid 98\'s real nine-option shape, from the option count alone', async () => {
    const nineOptions: Record<string, string> = {
      A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
      F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
    };
    const input: MethodQuestionInput = {
      qid: 98, question: QID98_QUESTION, options: nineOptions, originSrc: QID98_SRC, category: QID98_CATEGORY,
    };
    const { result } = await runPurposeStep(input, ctx());
    expect(result.ok).toBe(true);
    expect(result.sufficiency).not.toBeNull();
    expect(result.sufficiency!.sufficient).toBe(false);
    expect(result.sufficiency!.reason).toMatch(/INSUFFICIENT EVIDENCE/);
  });

  it('computes sufficiency SUFFICIENT for the origin four-option shape', async () => {
    const fourOptions: Record<string, string> = {
      A: 'South Asia', B: 'Europe', C: 'South America', D: 'Northeast United States',
    };
    const input: MethodQuestionInput = {
      qid: 98, question: QID98_QUESTION, options: fourOptions, originSrc: QID98_SRC, category: QID98_CATEGORY,
    };
    const { result } = await runPurposeStep(input, ctx());
    expect(result.sufficiency!.sufficient).toBe(true);
  });

  it('reports INSUFFICIENT EVIDENCE, never the least-bad purpose, when every candidate is eliminated', async () => {
    const input: MethodQuestionInput = {
      qid: 1, question: 'What is 2+2?', options: null, category: 'other',
    };
    const { result } = await runPurposeStep(input, ctx());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/INSUFFICIENT EVIDENCE/);
    expect(result.survivors).toHaveLength(0);
  });

  it('fails honestly with no question text', async () => {
    const input: MethodQuestionInput = { question: '', options: null };
    const { result } = await runPurposeStep(input, ctx());
    expect(result.ok).toBe(false);
  });

  it('never reads input.options for its own derivation (structural, no options branch)', async () => {
    const withOptions: MethodQuestionInput = {
      qid: 98, question: QID98_QUESTION, options: { A: 'x', B: 'y' }, originSrc: QID98_SRC, category: QID98_CATEGORY,
    };
    const withoutOptions: MethodQuestionInput = {
      qid: 98, question: QID98_QUESTION, options: null, originSrc: QID98_SRC, category: QID98_CATEGORY,
    };
    const a = await runPurposeStep(withOptions, ctx());
    const b = await runPurposeStep(withoutOptions, ctx());
    expect(a.result.survivors).toEqual(b.result.survivors);
    expect(a.result.candidates).toEqual(b.result.candidates);
  });
});
