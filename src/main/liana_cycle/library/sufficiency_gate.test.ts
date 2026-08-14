// sufficiency_gate.test.ts -- D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 2/3

import { describe, expect, it } from 'vitest';
import { checkSufficiency, PURPOSE_PRECONDITION_POLICY_VERSION } from './sufficiency_gate';

describe('checkSufficiency', () => {
  it('THE ACCEPTANCE TEST: reaches INSUFFICIENT EVIDENCE on qid 98\'s nine-option shape, from the option count alone', () => {
    const r = checkSufficiency('NEGATED_SUPERLATIVE_MEMBERSHIP', 9);
    expect(r.sufficient).toBe(false);
    expect(r.reason).toMatch(/INSUFFICIENT EVIDENCE/);
    expect(r.preconditionId).toBe('negated-superlative-member-bound');
    expect(r.policyVersion).toBe(PURPOSE_PRECONDITION_POLICY_VERSION);
  });

  it('never reads which option is which -- only takes a count, no options parameter exists', () => {
    expect(checkSufficiency.length).toBe(2);
  });

  it('is sufficient for a small option set (e.g. 5 options -> 4 required members, at the bound)', () => {
    const r = checkSufficiency('NEGATED_SUPERLATIVE_MEMBERSHIP', 5);
    expect(r.sufficient).toBe(true);
  });

  it('is insufficient one past the bound (6 options -> 5 required members)', () => {
    const r = checkSufficiency('NEGATED_SUPERLATIVE_MEMBERSHIP', 6);
    expect(r.sufficient).toBe(false);
  });

  it('reports an honest "no precondition declared" for UNCLASSIFIED, never a fabricated pass', () => {
    const r = checkSufficiency('UNCLASSIFIED', 9);
    expect(r.sufficient).toBe(true);
    expect(r.preconditionId).toBe('none-declared');
    expect(r.reason).toMatch(/no declared precondition/);
  });

  it('is deterministic and pure -- same input, same output, called twice', () => {
    const a = checkSufficiency('NEGATED_SUPERLATIVE_MEMBERSHIP', 9);
    const b = checkSufficiency('NEGATED_SUPERLATIVE_MEMBERSHIP', 9);
    expect(a).toEqual(b);
  });
});
