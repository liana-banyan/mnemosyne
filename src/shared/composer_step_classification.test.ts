// composer_step_classification.test.ts -- D-BP154-035/BISHOP-SEG/S35/seg-purefunction
//
// FAIL-BEFORE/PASS-AFTER for applyKeyedAnswerLabel() (FD-BP154-11's amendment to FD-BP154-05's own
// ANSWERED row) -- did not exist before this ticket, so every test below fails on main with
// "applyKeyedAnswerLabel is not exported". Also carries a handful of regression tests for the
// pre-existing classifyComposerStepResult() to document the blind classes this new function reads.

import { describe, test, expect } from 'vitest';
import {
  applyKeyedAnswerLabel, classifyComposerStepResult,
} from './composer_step_classification';

describe('classifyComposerStepResult -- pre-existing behavior, unchanged (regression guard)', () => {
  test('ok:false is ABSTAIN regardless of any other field', () => {
    expect(classifyComposerStepResult({ ok: false, error: 'boom' })).toEqual({
      cls: 'ABSTAIN', detail: 'boom', statedCount: 0,
    });
  });

  test('a terminator-shaped result that abstains is ABSTAIN', () => {
    const c = classifyComposerStepResult({ ok: true, abstain: true, abstainReason: 'more than one survivor' });
    expect(c.cls).toBe('ABSTAIN');
  });

  test('a terminator-shaped verdict with no corroborated feeder steps is ANSWERED', () => {
    const c = classifyComposerStepResult({ ok: true, abstain: false, verdict: 'A', basisStepClasses: ['ANSWERED'] });
    expect(c.cls).toBe('ANSWERED');
  });
});

describe('applyKeyedAnswerLabel -- FD-BP154-11: the ANSWERED row amendment, qid 98 exactly', () => {
  test('no key available -- classification returned completely unchanged, no `keyed` field added', () => {
    const blind = { cls: 'ABSTAIN' as const, detail: 'more than one survivor', statedCount: 0 };
    const out = applyKeyedAnswerLabel(blind, null, undefined);
    expect(out).toEqual(blind);
    expect('keyed' in out).toBe(false);
  });

  test('qid 98\'s own case, verbatim from the ruling: blind ABSTAIN + a key relabels to ANSWERED, stating both facts', () => {
    const blind = { cls: 'ABSTAIN' as const, detail: 'more than one survivor left (A, C, F)', statedCount: 0 };
    const out = applyKeyedAnswerLabel(blind, null, 'A');
    expect(out.cls).toBe('ANSWERED');
    expect(out.detail).toBe(
      'ANSWERED -- keyed answer: A. Not independently proven from the item text and admitted category evidence.',
    );
    expect(out.keyed).toEqual({ answer: 'A', matchesVerdict: null });
  });

  test('blind PROVEN is left exactly as reported -- the key is attached as metadata only, never the reason for the badge', () => {
    const blind = { cls: 'PROVEN' as const, detail: 'verdict A, every contributing step independently corroborated', statedCount: 1 };
    const out = applyKeyedAnswerLabel(blind, 'A', 'A');
    expect(out.cls).toBe('PROVEN');
    expect(out.detail).toBe(blind.detail);
    expect(out.keyed).toEqual({ answer: 'A', matchesVerdict: true });
  });

  test('blind CORROBORATED is left exactly as reported when it AGREES with the key -- own basis never overridden', () => {
    const blind = { cls: 'CORROBORATED' as const, detail: 'verdict A, at least one contributing step independently corroborated', statedCount: 1 };
    const out = applyKeyedAnswerLabel(blind, 'A', 'A');
    expect(out.cls).toBe('CORROBORATED');
    expect(out.detail).toBe(blind.detail);
    expect(out.keyed?.matchesVerdict).toBe(true);
  });

  test('blind ANSWERED (mechanism-based, not keyed) is left exactly as reported, with `keyed` attached', () => {
    const blind = { cls: 'ANSWERED' as const, detail: '3 stated, verbatim span verified, no corroboration yet', statedCount: 3 };
    const out = applyKeyedAnswerLabel(blind, 'B', 'B'); // AGREES -- keyed metadata only, detail untouched
    expect(out.cls).toBe('ANSWERED');
    expect(out.detail).toBe(blind.detail);
    expect(out.keyed).toEqual({ answer: 'B', matchesVerdict: true });
  });

  test('the amended ABSTAIN-to-ANSWERED relabel never invents PROVEN or CORROBORATED -- a key alone can never earn a tier stronger than ANSWERED', () => {
    const blind = { cls: 'ABSTAIN' as const, detail: 'every option was eliminated', statedCount: 0 };
    const out = applyKeyedAnswerLabel(blind, null, 'G');
    expect(out.cls).not.toBe('PROVEN');
    expect(out.cls).not.toBe('CORROBORATED');
    expect(out.cls).toBe('ANSWERED');
  });
});

describe('applyKeyedAnswerLabel -- D-BP154-039: a disagreeing verdict must say so explicitly, never pass silently', () => {
  // THE LIVE DEFECT THIS SUITE LOCKS IN: LIANA_COMPOSER_RUN_qid98_2026-08-14T21-59-51-048Z.json --
  // a complete, seven-step run reached VERDICT F (Central Asia), classified CORROborATED, while the
  // key is A. `keyedTerminatorLabel.keyed.matchesVerdict` was already `false` in that receipt, but
  // nothing in `detail` or the top-level `basis` said so -- the disagreement was computed and
  // buried, never surfaced. These tests prove the fix at the classification level; script_bridge.
  // keyed_terminator_label.test.ts proves it end to end through the real run path.

  test('blind CORROBORATED DISAGREEING with the key: `cls` is untouched (never downgraded), but `detail` now states the disagreement explicitly', () => {
    const blind = { cls: 'CORROBORATED' as const, detail: 'verdict F, at least one contributing step independently corroborated', statedCount: 1 };
    const out = applyKeyedAnswerLabel(blind, 'F', 'A');
    expect(out.cls).toBe('CORROBORATED'); // never silently downgraded/upgraded -- the mechanism's own tier stands
    expect(out.detail).toBe(
      'verdict F, at least one contributing step independently corroborated  ||  DISAGREES WITH '
      + 'KEYED ANSWER A: the evidence admitted does not entail the keyed answer.',
    );
    expect(out.keyed).toEqual({ answer: 'A', matchesVerdict: false });
  });

  test('blind ANSWERED DISAGREEING with the key also states the disagreement explicitly', () => {
    const blind = { cls: 'ANSWERED' as const, detail: '3 stated, verbatim span verified, no corroboration yet', statedCount: 3 };
    const out = applyKeyedAnswerLabel(blind, 'B', 'A');
    expect(out.cls).toBe('ANSWERED');
    expect(out.detail).toContain('DISAGREES WITH KEYED ANSWER A');
    expect(out.keyed).toEqual({ answer: 'A', matchesVerdict: false });
  });

  test('blind PROVEN DISAGREEING with the key ALSO states it -- PROVEN is not exempted (a "proven" wrong answer must never be quieter than a weaker one)', () => {
    const blind = { cls: 'PROVEN' as const, detail: 'verdict F, every contributing step independently corroborated', statedCount: 1 };
    const out = applyKeyedAnswerLabel(blind, 'F', 'A');
    expect(out.cls).toBe('PROVEN');
    expect(out.detail).toContain('DISAGREES WITH KEYED ANSWER A');
  });

  test('AGREEMENT never triggers the disagreement text, at any class', () => {
    const blind = { cls: 'CORROBORATED' as const, detail: 'verdict A, at least one contributing step independently corroborated', statedCount: 1 };
    const out = applyKeyedAnswerLabel(blind, 'A', 'A');
    expect(out.detail).not.toContain('DISAGREES');
    expect(out.detail).toBe(blind.detail);
  });

  test('no verdict to compare (verdictLetter null, non-ABSTAIN class does not occur in practice, but the function must not crash or fabricate a disagreement) -- matchesVerdict is null, not coerced to a false disagreement', () => {
    const blind = { cls: 'ANSWERED' as const, detail: 'x', statedCount: 1 };
    const out = applyKeyedAnswerLabel(blind, null, 'A');
    expect(out.keyed?.matchesVerdict).toBeNull();
    expect(out.detail).not.toContain('DISAGREES'); // null is not `false` -- never a fabricated disagreement
  });
});
