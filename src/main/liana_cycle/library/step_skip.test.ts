// step_skip.test.ts -- D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 3/3

import { describe, expect, it } from 'vitest';
import { computeStepSkip, isSkippedMarker, SKIP_POLICY_VERSION } from './step_skip';
import type { ComposerStepOutcome } from './script_bridge';
import type { PurposeResult } from './purpose_step';
import type { NamedSetResult } from './named_set_step';
import type { DiscriminatorResult } from './discriminator_step';
import { CORPUS_META_TRUTH } from './human_nuance_step';
import type { HumanNuanceResult } from './human_nuance_step';

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
  F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};

function insufficientPurpose(): PurposeResult {
  return {
    ok: true, purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', candidates: [], survivors: [], eliminated: [],
    sufficiency: {
      purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', preconditionId: 'negated-superlative-member-bound',
      preconditionDescription: 'test', sufficient: false, reason: 'INSUFFICIENT EVIDENCE -- test', policyVersion: '1',
    },
    via: 'test',
  };
}

function sufficientPurpose(): PurposeResult {
  return {
    ok: true, purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', candidates: [], survivors: [], eliminated: [],
    sufficiency: {
      purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', preconditionId: 'negated-superlative-member-bound',
      preconditionDescription: 'test', sufficient: true, reason: 'sufficient', policyVersion: '1',
    },
    via: 'test',
  };
}

function namedSet(included: string[], ok = true): NamedSetResult {
  return {
    ok, property: 'p', query: 'q',
    included: included.map((letter) => ({ letter, name: OPT[letter], span: `${letter}) span` })),
    discarded: 0, notIncluded: Object.keys(OPT).filter((L) => !included.includes(L)), via: 'test',
  };
}

function discriminator(propertyMembers: string[], ok = true): DiscriminatorResult {
  return {
    ok, category: 'c', property: null, query: 'q', kinds: [], discardedKinds: 0, noKindStated: [],
    categoryKind: null, categoryKindDiscarded: false,
    propertyMembers: propertyMembers.map((letter) => ({ letter, name: OPT[letter], span: `${letter}) span` })),
    discardedPropertyMembers: 0, categoryEnumeration: null, categoryEnumerationDiscarded: false,
    categoryEnumerationMembers: [], discardedCategoryEnumerationMembers: 0, subregionNonMembers: [],
    discardedSubregionNonMembers: 0, registerStatement: null, registerStatementDiscarded: false,
    enumerationDisagreement: null, via: 'test',
  };
}

function humanNuanceArtifactEstablished(): HumanNuanceResult {
  return {
    ok: true, artifactClassEstablished: true, src: 'ori_mmlu-test', corpusMetaTruth: CORPUS_META_TRUTH,
    cowGuard: { applies: true, reason: 'test' }, category: 'c', frame: [], nonParticipants: [],
    originStratum: 'sand', singleAnswerPropertySurvived: null, answerDerivableFromQuestionTermsAlone: null,
    query: 'q', excluded: [], insufficientEvidence: [], consistent: [], featureRuleVersion: 'test',
    discarded: 0, unresolved: [], via: 'test',
  };
}

function humanNuanceArtifactNotEstablished(): HumanNuanceResult {
  return { ...humanNuanceArtifactEstablished(), artifactClassEstablished: false, corpusMetaTruth: null };
}

describe('isSkippedMarker', () => {
  it('recognizes a real skip marker', () => {
    expect(isSkippedMarker({ ok: false, skipped: true, skipReason: 'x' })).toBe(true);
  });
  it('rejects a real (non-skipped) result shape', () => {
    expect(isSkippedMarker({ ok: false, error: 'a real failure' })).toBe(false);
  });
  it('rejects null/undefined/primitives', () => {
    expect(isSkippedMarker(null)).toBe(false);
    expect(isSkippedMarker(undefined)).toBe(false);
    expect(isSkippedMarker('skipped')).toBe(false);
  });
});

describe('computeStepSkip -- the sufficiency-driven skip (all five query-issuing steps)', () => {
  const priorResults: ComposerStepOutcome[] = [
    { id: 'Purpose:1', summary: 's', raw: insufficientPurpose() },
  ];

  for (const id of ['Softballs:1', 'NamedSet:1', 'Discriminator:1', 'Magnitude:1', 'HumanNuance:1']) {
    it(`skips ${id} as moot when Purpose:1 found the evidence class insufficient`, () => {
      const skip = computeStepSkip(id, priorResults);
      expect(skip).not.toBeNull();
      expect(skip?.skipped).toBe(true);
      expect(skip?.ok).toBe(false);
      expect(skip?.skipReason).toMatch(/SKIPPED-AS-MOOT/);
      expect(skip?.skipReason).toContain(`v${SKIP_POLICY_VERSION}`);
    });
  }

  it('never skips Purpose:1 itself (not a candidate)', () => {
    expect(computeStepSkip('Purpose:1', priorResults)).toBeNull();
  });

  it('never skips Terminator:1 itself (not a candidate)', () => {
    expect(computeStepSkip('Terminator:1', priorResults)).toBeNull();
  });

  it('does not skip when Purpose:1 is sufficient', () => {
    const pr: ComposerStepOutcome[] = [{ id: 'Purpose:1', summary: 's', raw: sufficientPurpose() }];
    expect(computeStepSkip('Softballs:1', pr)).toBeNull();
  });

  it('does not skip when Purpose:1 has not run at all', () => {
    expect(computeStepSkip('Softballs:1', [])).toBeNull();
  });

  it('QUALIFIER 2/3: never skips on the basis of a FAILED Purpose:1', () => {
    const failedPurpose: PurposeResult = { ...insufficientPurpose(), ok: false, sufficiency: null, error: 'failed' };
    const pr: ComposerStepOutcome[] = [{ id: 'Purpose:1', summary: 's', raw: failedPurpose }];
    expect(computeStepSkip('Softballs:1', pr)).toBeNull();
  });
});

describe('computeStepSkip -- D-BP154-043 AMENDMENT: Magnitude:1 is NOT skipped when the artifact class is established', () => {
  it('does NOT skip Magnitude:1 when membership is partitioned AND HumanNuance:1 confirms the artifact class', () => {
    const pr: ComposerStepOutcome[] = [
      { id: 'NamedSet:1', summary: 's', raw: namedSet(['B']) },
      { id: 'HumanNuance:1', summary: 's', raw: humanNuanceArtifactEstablished() },
    ];
    expect(computeStepSkip('Magnitude:1', pr)).toBeNull();
  });

  it('still skips Magnitude:1 when membership is partitioned but HumanNuance:1 did NOT establish the artifact class', () => {
    const pr: ComposerStepOutcome[] = [
      { id: 'NamedSet:1', summary: 's', raw: namedSet(['B']) },
      { id: 'HumanNuance:1', summary: 's', raw: humanNuanceArtifactNotEstablished() },
    ];
    const skip = computeStepSkip('Magnitude:1', pr);
    expect(skip).not.toBeNull();
    expect(skip?.skipReason).toMatch(/FD-BP154-14/);
  });

  it('still skips Magnitude:1 when membership is partitioned and HumanNuance:1 never ran at all', () => {
    const pr: ComposerStepOutcome[] = [{ id: 'NamedSet:1', summary: 's', raw: namedSet(['B']) }];
    expect(computeStepSkip('Magnitude:1', pr)).not.toBeNull();
  });

  it('QUALIFIER 2/3: does not permit the tie-break on a FAILED HumanNuance:1, even if it claims artifactClassEstablished', () => {
    const failedHumanNuance = { ...humanNuanceArtifactEstablished(), ok: false };
    const pr: ComposerStepOutcome[] = [
      { id: 'NamedSet:1', summary: 's', raw: namedSet(['B']) },
      { id: 'HumanNuance:1', summary: 's', raw: failedHumanNuance },
    ];
    expect(computeStepSkip('Magnitude:1', pr)).not.toBeNull();
  });
});

describe('computeStepSkip -- FD-BP154-14, Magnitude:1 only, membership already partitioned', () => {
  it('skips Magnitude:1 when NamedSet:1 found a stated member (SUCCESSFUL)', () => {
    const pr: ComposerStepOutcome[] = [{ id: 'NamedSet:1', summary: 's', raw: namedSet(['B']) }];
    const skip = computeStepSkip('Magnitude:1', pr);
    expect(skip).not.toBeNull();
    expect(skip?.skipReason).toMatch(/FD-BP154-14/);
  });

  it('skips Magnitude:1 when Discriminator:1 found a stated property member (SUCCESSFUL)', () => {
    const pr: ComposerStepOutcome[] = [{ id: 'Discriminator:1', summary: 's', raw: discriminator(['B']) }];
    expect(computeStepSkip('Magnitude:1', pr)).not.toBeNull();
  });

  it('QUALIFIER 2/3: does NOT skip Magnitude:1 when NamedSet:1 FAILED, even with an included array', () => {
    const failedNamedSet = namedSet(['B'], false);
    const pr: ComposerStepOutcome[] = [{ id: 'NamedSet:1', summary: 's', raw: failedNamedSet }];
    expect(computeStepSkip('Magnitude:1', pr)).toBeNull();
  });

  it('does not skip Magnitude:1 when neither feeder found a stated member', () => {
    const pr: ComposerStepOutcome[] = [
      { id: 'NamedSet:1', summary: 's', raw: namedSet([]) },
      { id: 'Discriminator:1', summary: 's', raw: discriminator([]) },
    ];
    expect(computeStepSkip('Magnitude:1', pr)).toBeNull();
  });

  it('never applies the FD-BP154-14 check to a step other than Magnitude:1', () => {
    const pr: ComposerStepOutcome[] = [{ id: 'NamedSet:1', summary: 's', raw: namedSet(['B']) }];
    expect(computeStepSkip('HumanNuance:1', pr)).toBeNull();
  });

  it('QUALIFIER 5: re-derivable -- identical priorResults produce the identical skip decision', () => {
    const pr: ComposerStepOutcome[] = [{ id: 'NamedSet:1', summary: 's', raw: namedSet(['B']) }];
    const a = computeStepSkip('Magnitude:1', pr);
    const b = computeStepSkip('Magnitude:1', pr);
    expect(a).toEqual(b);
  });
});
