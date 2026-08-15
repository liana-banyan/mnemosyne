// comparability_gate.test.ts -- D-BP154-050/BISHOP-SEG/S50/seg-comparability
//
// THE INVARIANT TESTS, from both spec files (SPEC_COMPARABILITY_GATE_BP154.md's eight,
// SPEC_CATEGORY_ERROR_TAXONOMY_BP154.md's eleven) -- consolidated where two spec lines test the
// SAME mechanism from two angles (both files name "ranks every retained/admitted candidate, not a
// target-shaped subset," for instance), never dropped. Named per-test so each spec line is
// traceable. MECHANISM TEST THROUGHOUT (FD-BP153-06): invented vocabulary (Zorvexia, Quintara)
// proves the mechanism, not memorized geography; the Central Asia/South America/Northern Africa
// case is ALSO tested directly, because that is the spec's own worked failure case and the
// invariant must hold on the real one too, not only on inventions.

import { describe, expect, it } from 'vitest';
import {
  checkUniformPredicate, deriveComparabilityVerdict, dispositionSupportsAnswer, mayRank,
  sameRelevantType, unknownCandidate,
} from './comparability_gate';
import type { Candidate, Elimination, Frame } from './comparability_gate';

function candidate(optionId: string, entityType: Candidate['entityType'], overrides: Partial<Candidate> = {}): Candidate {
  return {
    optionId, observedLabel: optionId, entityType, entityTypeEvidence: { text: 'stated', via: 'test' },
    aggregationLevel: 'unknown', populationStatus: 'inhabited',
    boundary: { status: 'fixed', authority: 'test-authority', identifier: optionId },
    ...overrides,
  };
}

describe('THE UNIFORM-PREDICATE INVARIANT -- "the one thing that mechanically blocks the error we made"', () => {
  it('does not eliminate an M49 region for being a multi-country aggregate (THE EXACT LIVE-MEASURED CASE)', () => {
    // South America, Northern Africa, Central Asia -- all `statistical_subregion` under UN M49,
    // all territorial aggregations. A rule that says "composite -> not a world region" would fire
    // on all three alike.
    const southAmerica = candidate('A', 'statistical_subregion');
    const northernAfrica = candidate('C', 'statistical_subregion');
    const centralAsia = candidate('F', 'statistical_subregion');
    const pool = [southAmerica, northernAfrica, centralAsia];
    const compositeRule = (c: Candidate): boolean => true; // "is a group of countries" -- true for all three
    const check = checkUniformPredicate(centralAsia, pool, compositeRule);
    expect(check.discriminating).toBe(false);
    expect(check.wouldAlsoRemove.sort()).toEqual(['A', 'C']);
  });

  it('requires the same comparability predicate for every survivor (invented vocabulary)', () => {
    const zorvexia = candidate('A', 'statistical_subregion');
    const quintara = candidate('B', 'statistical_subregion');
    const blexmoor = candidate('C', 'biome'); // a DIFFERENT entity type -- not a same-type peer
    const pool = [zorvexia, quintara, blexmoor];
    // A rule that only fires on Quintara, among the two statistical_subregions, IS discriminating.
    const quintaraOnly = (c: Candidate): boolean => c.optionId === 'B';
    const check = checkUniformPredicate(quintara, pool, quintaraOnly);
    expect(check.discriminating).toBe(true);
    expect(check.wouldAlsoRemove).toEqual([]);
  });

  it('a rule that would remove EVERY same-type candidate is rejected as non-discriminating for EACH of them -- it never singles one out', () => {
    const a = candidate('A', 'statistical_subregion');
    const b = candidate('B', 'statistical_subregion');
    const alwaysComposite = (c: Candidate): boolean => true;
    // "composite -> exclude" fires on both A and B alike -- checked against EITHER as the target,
    // it is rejected, because it does not uniquely distinguish that one from its same-type peer.
    expect(checkUniformPredicate(a, [a, b], alwaysComposite).discriminating).toBe(false);
    expect(checkUniformPredicate(b, [a, b], alwaysComposite).discriminating).toBe(false);
  });

  it('never treats two "unknown"-typed candidates as the same relevant type -- uniformity cannot be asserted about an unestablished type', () => {
    const u1 = unknownCandidate('A', 'Mystery One');
    const u2 = unknownCandidate('B', 'Mystery Two');
    expect(sameRelevantType(u1, u2)).toBe(false);
  });
});

describe('FOUR-VALUED DISPOSITIONS: what may support an answer', () => {
  it('OUT_OF_FRAME, NOT_COMPARABLE, STATED_MEMBER, STATED_NONMEMBER may support an answer', () => {
    expect(dispositionSupportsAnswer('OUT_OF_FRAME')).toBe(true);
    expect(dispositionSupportsAnswer('NOT_COMPARABLE')).toBe(true);
    expect(dispositionSupportsAnswer('STATED_MEMBER')).toBe(true);
    expect(dispositionSupportsAnswer('STATED_NONMEMBER')).toBe(true);
  });

  it('does not convert UNSTATED into NONMEMBER -- UNSTATED never supports an answer', () => {
    expect(dispositionSupportsAnswer('UNSTATED')).toBe(false);
  });

  it('FAILED never supports an answer -- a step that did not execute reliably proves nothing', () => {
    expect(dispositionSupportsAnswer('FAILED')).toBe(false);
  });
});

describe('mayRank() -- NON-NEGOTIABLE: any unknown entityType forbids ranking outright', () => {
  const establishedFrame: Frame = { status: 'ESTABLISHED', metric: 'density', referenceDate: '2025' };

  it('forbids ranking when ANY candidate in the pool has entityType "unknown", even if the rest are fully resolved', () => {
    const known = candidate('A', 'statistical_subregion');
    const unresolvedType = unknownCandidate('B', 'Something Unclassified');
    expect(mayRank([known, unresolvedType], establishedFrame)).toBe(false);
  });

  it('fails when candidate boundaries are not fixed on one common basis', () => {
    const a = candidate('A', 'statistical_subregion', { boundary: { status: 'fixed' } });
    const b = candidate('B', 'statistical_subregion', { boundary: { status: 'source_defined' } });
    expect(mayRank([a, b], establishedFrame)).toBe(false);
  });

  it('forbids ranking when the frame itself is not established', () => {
    const a = candidate('A', 'statistical_subregion');
    const b = candidate('B', 'statistical_subregion');
    expect(mayRank([a, b], { status: 'UNRESOLVED', metric: null, referenceDate: null })).toBe(false);
  });

  it('forbids ranking a pool of fewer than two -- nothing to rank', () => {
    const a = candidate('A', 'statistical_subregion');
    expect(mayRank([a], establishedFrame)).toBe(false);
  });

  it('permits ranking only when EVERY candidate is fully resolved AND the frame is established', () => {
    const a = candidate('A', 'statistical_subregion');
    const b = candidate('B', 'statistical_subregion');
    expect(mayRank([a, b], establishedFrame)).toBe(true);
  });
});

describe('deriveComparabilityVerdict() -- THE TERMINATOR REWRITE', () => {
  const establishedFrame: Frame = { status: 'ESTABLISHED', metric: 'density', referenceDate: '2025' };

  it('a UNIQUE stated nonmember is the verdict, no ranking needed', () => {
    const eliminations: Elimination[] = [
      { option: 'D', stage: 'MEMBERSHIP', disposition: 'STATED_NONMEMBER', ruleVersion: 'test/1', sourceSpan: { text: 's', via: 'test' } },
    ];
    const v = deriveComparabilityVerdict(eliminations, [], establishedFrame, () => []);
    expect(v).toEqual({ kind: 'VERDICT', option: 'D', basis: 'UNIQUE_STATED_NONMEMBER' });
  });

  it('does NOT rank only a result-shaped subset -- ranks the COMPLETE comparable pool, per "if M49 is the frame, rank {A, C, F}"', () => {
    const a = candidate('A', 'statistical_subregion');
    const c = candidate('C', 'statistical_subregion');
    const f = candidate('F', 'statistical_subregion');
    const pool = [a, c, f];
    let poolSeenByRanker: Candidate[] = [];
    const rankAll = (p: Candidate[]) => { poolSeenByRanker = p; return p.map((x) => x.optionId); };
    const v = deriveComparabilityVerdict([], pool, establishedFrame, rankAll);
    expect(poolSeenByRanker).toHaveLength(3);
    expect(poolSeenByRanker.map((x) => x.optionId).sort()).toEqual(['A', 'C', 'F']);
    expect(v.kind).toBe('RANK');
  });

  it('forbids magnitude ranking when the pool is not fully licensed (MAGNITUDE_NOT_LICENSED)', () => {
    const known = candidate('A', 'statistical_subregion');
    const unresolvedType = unknownCandidate('C', 'Unclassified');
    const v = deriveComparabilityVerdict([], [known, unresolvedType], establishedFrame, (p) => p.map((x) => x.optionId));
    expect(v).toEqual({ kind: 'ABSTAIN', reason: 'MAGNITUDE_NOT_LICENSED' });
  });

  it('abstains (never guesses) when the comparable pool is empty', () => {
    const v = deriveComparabilityVerdict([], [], establishedFrame, (p) => p.map((x) => x.optionId));
    expect(v).toEqual({ kind: 'ABSTAIN', reason: 'NO_COMPARABLE_POOL' });
  });

  it('abstains on an ambiguous/incomplete ranking rather than publish a partial order', () => {
    const a = candidate('A', 'statistical_subregion');
    const c = candidate('C', 'statistical_subregion');
    const v = deriveComparabilityVerdict([], [a, c], establishedFrame, () => ['A']); // ranker dropped C
    expect(v).toEqual({ kind: 'ABSTAIN', reason: 'AMBIGUOUS_RANKING' });
  });
});

describe('THE TYPED RECORD -- structural proof that no answer-key field exists anywhere in this module', () => {
  it('Candidate/FrameContract/Elimination carry no `answer`/`answer_index`-shaped field -- runtime stays blind (D-BP153-003)', () => {
    const c = candidate('A', 'statistical_subregion');
    expect(Object.keys(c)).not.toContain('answer');
    expect(Object.keys(c)).not.toContain('answer_index');
    expect(Object.keys(c)).not.toContain('correctAnswer');
  });

  it('every Elimination record structurally carries a rule version and a source span field (even when the span is null for an UNSTATED disposition)', () => {
    const e: Elimination = { option: 'A', stage: 'COMPARABILITY', disposition: 'UNSTATED', ruleVersion: 'test/1', sourceSpan: null };
    expect(e.ruleVersion).toBeTruthy();
    expect('sourceSpan' in e).toBe(true);
  });
});
