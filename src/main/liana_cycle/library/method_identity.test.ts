// method_identity.test.ts -- D-BP152-040/BISHOP/seg-method-identity-registry
//
// Verifies (a) round-trip parse/format of `Name:Number`, and (b) malformed ids are rejected, not
// coerced. Per HARDWIRE-23 Law 4/`THE TARE RULE`, this file tests exactly what method_identity.ts
// does -- validation and string shape -- nothing about the registry (see method_registry.test.ts).

import { describe, test, expect } from 'vitest';
import { formatMethodId, makeMethodIdentity, parseMethodId } from './method_identity';

describe('formatMethodId() / parseMethodId() round-trip', () => {
  test('formatMethodId then parseMethodId reconstructs the same identity', () => {
    const id = formatMethodId('Survey', 3);
    expect(id).toBe('Survey:3');
    const parsed = parseMethodId(id);
    expect(parsed).toEqual({ name: 'Survey', number: 3, id: 'Survey:3' });
  });

  test('parseMethodId then formatMethodId reconstructs the same string', () => {
    const parsed = parseMethodId('ClassifyCascade:7');
    const reformatted = formatMethodId(parsed.name, parsed.number);
    expect(reformatted).toBe('ClassifyCascade:7');
  });

  test('makeMethodIdentity produces the same result as composing format+parse by hand', () => {
    expect(makeMethodIdentity('ComparativeCascade', 1)).toEqual(parseMethodId(formatMethodId('ComparativeCascade', 1)));
    expect(makeMethodIdentity('ComparativeCascade', 1)).toEqual({ name: 'ComparativeCascade', number: 1, id: 'ComparativeCascade:1' });
  });

  test('round-trips across many iterations of the same name -- "iterations galore"', () => {
    for (const n of [1, 2, 3, 10, 999]) {
      const identity = makeMethodIdentity('Survey', n);
      expect(identity.id).toBe(`Survey:${n}`);
      expect(parseMethodId(identity.id)).toEqual(identity);
    }
  });
});

describe('malformed ids are rejected, not coerced', () => {
  test('no colon at all', () => {
    expect(() => parseMethodId('Survey')).toThrow(/expected exactly one ":"/);
  });

  test('more than one colon', () => {
    expect(() => parseMethodId('Survey:3:extra')).toThrow(/expected exactly one ":"/);
  });

  test('empty name', () => {
    expect(() => parseMethodId(':3')).toThrow(/non-empty string/);
  });

  test('name containing whitespace padding is rejected, not trimmed', () => {
    expect(() => parseMethodId(' Survey:3')).toThrow(/whitespace/);
    expect(() => parseMethodId('Survey :3')).toThrow(/whitespace/);
  });

  test('number is zero', () => {
    expect(() => parseMethodId('Survey:0')).toThrow(/positive integer/);
  });

  test('number is negative', () => {
    expect(() => parseMethodId('Survey:-1')).toThrow(/positive integer/);
  });

  test('number has a fractional part', () => {
    expect(() => parseMethodId('Survey:1.5')).toThrow(/positive integer/);
  });

  test('number has a leading zero -- rejected, never coerced to its numeric value', () => {
    expect(() => parseMethodId('Survey:01')).toThrow(/leading zeros/);
  });

  test('number has a leading plus sign', () => {
    expect(() => parseMethodId('Survey:+1')).toThrow(/positive integer/);
  });

  test('number is non-numeric text', () => {
    expect(() => parseMethodId('Survey:abc')).toThrow(/positive integer/);
  });

  test('non-string input', () => {
    // @ts-expect-error -- deliberately passing a non-string to prove it is rejected, not coerced.
    expect(() => parseMethodId(42)).toThrow(/must be a string/);
  });

  test('formatMethodId rejects a name containing a colon rather than escaping it', () => {
    expect(() => formatMethodId('Bad:Name', 1)).toThrow(/must not contain ":"/);
  });

  test('formatMethodId rejects a non-integer number rather than truncating it', () => {
    expect(() => formatMethodId('Survey', 1.5)).toThrow(/positive integer/);
  });

  test('formatMethodId rejects number 0 -- numbers are 1-based', () => {
    expect(() => formatMethodId('Survey', 0)).toThrow(/positive integer/);
  });
});
