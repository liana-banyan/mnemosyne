// entity_resolution.test.ts -- D-BP154-047/BISHOP-SEG/S47/seg-lawten
//
// MECHANISM TEST THROUGHOUT (FD-BP153-06): every case below uses INVENTED vocabulary (Zorvexia,
// Quintara, etc.) -- proving the resolver would survive on names it has never seen, never that it
// happens to know real-world geography.

import { describe, expect, it } from 'vitest';
import { resolveNameToOption } from './entity_resolution';

const OPT: Record<string, string> = {
  A: 'Zorvexia', B: 'Northern Quintara', C: 'Blexmoor Isles', D: 'Trentavale',
};

describe('resolveNameToOption -- exact match', () => {
  it('resolves a byte-identical name', () => {
    expect(resolveNameToOption('Zorvexia', OPT)).toEqual({ letter: 'A', method: 'exact' });
  });
  it('is case/whitespace tolerant only, still "exact"', () => {
    expect(resolveNameToOption('  zorvexia  ', OPT)).toEqual({ letter: 'A', method: 'exact' });
  });
});

describe('resolveNameToOption -- leading list-letter prefix (the "B) " shape)', () => {
  it('strips a leading "L) " token the source echoed from its own list() formatting', () => {
    expect(resolveNameToOption('D) Trentavale', OPT)).toEqual({ letter: 'D', method: 'list-prefix-stripped' });
  });
});

describe('resolveNameToOption -- stated bracketed CODE (the M49-shape)', () => {
  it('matches via a code found in the annotation, when the caller supplies knownCodes', () => {
    const knownCodes = { C: 'QX-77' };
    expect(resolveNameToOption('Blexmoor Region (QX-77)', OPT, knownCodes)).toEqual({ letter: 'C', method: 'stated-code' });
  });

  it('never matches a code that was not supplied by the caller -- no invented bridge', () => {
    // "QX-77" is nowhere in knownCodes here -- falls through to alias/plural, which also fail,
    // since "Blexmoor Region" is not "Blexmoor Isles" under any mechanical fold.
    const r = resolveNameToOption('Blexmoor Region (QX-77)', OPT);
    expect(r.letter).toBeNull();
    expect(r.method).toBe('unstated');
  });

  it('a square-bracketed code resolves the same way as parentheses', () => {
    const knownCodes = { B: 'NQ-04' };
    expect(resolveNameToOption('Quintara North [NQ-04]', OPT, knownCodes)).toEqual({ letter: 'B', method: 'stated-code' });
  });
});

describe('resolveNameToOption -- stated parenthetical ALIAS (no code, source names the option itself)', () => {
  it('resolves via the base name once its own trailing annotation is stripped', () => {
    expect(resolveNameToOption('Trentavale (a coastal territory)', OPT)).toEqual({ letter: 'D', method: 'stated-alias' });
  });

  it('resolves via the ANNOTATION text itself when the base does not match but the alias does', () => {
    // The source's own phrasing: "officially listed as Zorvexia" -- the annotation IS the bridge.
    expect(resolveNameToOption('The Western Reach (officially Zorvexia)', OPT)).toEqual({ letter: 'A', method: 'stated-alias' });
  });

  it('never invents an alias that was not in the text -- an unrelated annotation stays UNSTATED', () => {
    const r = resolveNameToOption('Mysteria (a fictional place)', OPT);
    expect(r.letter).toBeNull();
    expect(r.method).toBe('unstated');
  });
});

describe('resolveNameToOption -- singular/plural fold, mechanical only', () => {
  it('folds a trailing "s" on the extracted name', () => {
    const opt: Record<string, string> = { A: 'Zorvex' };
    expect(resolveNameToOption('Zorvexs', opt)).toEqual({ letter: 'A', method: 'plural-fold' });
  });

  it('folds a trailing "s" on the OPTION side too (symmetric)', () => {
    const opt: Record<string, string> = { A: 'Trentavales' };
    expect(resolveNameToOption('Trentavale', opt)).toEqual({ letter: 'A', method: 'plural-fold' });
  });

  it('never folds a trailing "ss" (not a plural marker)', () => {
    const opt: Record<string, string> = { A: 'Quintaross' };
    const r = resolveNameToOption('Quintaros', opt);
    expect(r.letter).toBeNull();
  });
});

describe('resolveNameToOption -- absence is omission, always', () => {
  it('an empty/whitespace name is UNSTATED, never a candidate', () => {
    expect(resolveNameToOption('', OPT)).toEqual({ letter: null, method: 'unstated' });
    expect(resolveNameToOption('   ', OPT)).toEqual({ letter: null, method: 'unstated' });
  });

  it('a name with no relation to any option, in any known shape, is UNSTATED -- never a fuzzy nearest match', () => {
    expect(resolveNameToOption('Completely Unrelated Fictional Land', OPT)).toEqual({ letter: null, method: 'unstated' });
  });

  it('a non-string raw value is UNSTATED, never a crash or a guess', () => {
    expect(resolveNameToOption(undefined, OPT)).toEqual({ letter: null, method: 'unstated' });
    expect(resolveNameToOption(42, OPT)).toEqual({ letter: null, method: 'unstated' });
  });
});

describe('resolveNameToOption -- combined shapes (the exact live-measured composites)', () => {
  it('a list-prefix name that ALSO carries a stated code resolves via the earliest applicable method (list-prefix-stripped, since the base then matches exactly)', () => {
    expect(resolveNameToOption('B) Northern Quintara', OPT)).toEqual({ letter: 'B', method: 'list-prefix-stripped' });
  });
});
