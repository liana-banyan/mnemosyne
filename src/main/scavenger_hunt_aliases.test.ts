// scavenger_hunt_aliases.test.ts -- D-BP223-BM0-X033-060-PRESS-0934-PREP (0.9.34, "option C")
//
// Pure unit tests for the hand-kept alias table + its whole-word substitution function, ahead
// of the integration test in scavenger_hunt.test.ts that exercises the Founder's own worked
// example end to end through findScavengerHuntMatches().

import { describe, it, expect } from 'vitest';
import { SCAVENGER_HUNT_ALIASES, applyAliases } from './scavenger_hunt_aliases';
import { normalizePhrase } from './scavenger_hunt';

describe('applyAliases', () => {
  it('the Founder\'s own worked example: "Ben Franklins Bday?" expands to "benjamin franklin birthday"', () => {
    const normalized = normalizePhrase('Ben Franklins Bday?');
    expect(normalized).toBe('ben franklins bday');
    const { expanded, fired } = applyAliases(normalized);
    expect(expanded).toBe('benjamin franklin birthday');
    expect(fired).toEqual(['ben->benjamin', 'franklins->franklin', 'bday->birthday']);
  });

  it('returns the input unchanged with an empty fired list when no alias applies', () => {
    const normalized = normalizePhrase('What is the capital of France?');
    const { expanded, fired } = applyAliases(normalized);
    expect(expanded).toBe(normalized);
    expect(fired).toEqual([]);
  });

  it('handles the empty string', () => {
    expect(applyAliases('')).toEqual({ expanded: '', fired: [] });
  });

  it('matches whole words only -- never a substring inside a longer, unrelated word', () => {
    // "ben" is a key, but "benevolent" must not be rewritten by a substring match.
    const { expanded, fired } = applyAliases('a benevolent man');
    expect(expanded).toBe('a benevolent man');
    expect(fired).toEqual([]);
  });

  it('expands a male given-name nickname: "bob" -> "robert"', () => {
    const { expanded, fired } = applyAliases('when was bob born');
    expect(expanded).toBe('when was robert born');
    expect(fired).toEqual(['bob->robert']);
  });

  it('expands a male given-name nickname: "bill" -> "william"', () => {
    const { expanded, fired } = applyAliases('bill and the flag');
    expect(expanded).toBe('william and the flag');
    expect(fired).toEqual(['bill->william']);
  });

  it('expands a male given-name nickname: "dick" -> "richard"', () => {
    const { expanded, fired } = applyAliases('dick nixon resigned');
    expect(expanded).toBe('richard nixon resigned');
    expect(fired).toEqual(['dick->richard']);
  });

  it('expands a male given-name nickname: "jim" -> "james"', () => {
    const { expanded, fired } = applyAliases('jim madison wrote');
    expect(expanded).toBe('james madison wrote');
    expect(fired).toEqual(['jim->james']);
  });

  it('expands a male given-name nickname: "mike" -> "michael"', () => {
    const { expanded, fired } = applyAliases('mike jordan played');
    expect(expanded).toBe('michael jordan played');
    expect(fired).toEqual(['mike->michael']);
  });

  it('expands a male given-name nickname: "tom" -> "thomas"', () => {
    const { expanded, fired } = applyAliases('tom jefferson wrote');
    expect(expanded).toBe('thomas jefferson wrote');
    expect(fired).toEqual(['tom->thomas']);
  });

  it('expands a male given-name nickname: "alex" -> "alexander"', () => {
    const { expanded, fired } = applyAliases('alex hamilton');
    expect(expanded).toBe('alexander hamilton');
    expect(fired).toEqual(['alex->alexander']);
  });

  it('expands a female given-name nickname: "liz" -> "elizabeth"', () => {
    const { expanded, fired } = applyAliases('liz the first');
    expect(expanded).toBe('elizabeth the first');
    expect(fired).toEqual(['liz->elizabeth']);
  });

  it('expands a female given-name nickname: "kate" -> "katherine"', () => {
    const { expanded, fired } = applyAliases('kate the great');
    expect(expanded).toBe('katherine the great');
    expect(fired).toEqual(['kate->katherine']);
  });

  it('expands a female given-name nickname: "sue" -> "susan"', () => {
    const { expanded, fired } = applyAliases('sue smith');
    expect(expanded).toBe('susan smith');
    expect(fired).toEqual(['sue->susan']);
  });

  it('expands a common written abbreviation: "govt" -> "government"', () => {
    const { expanded, fired } = applyAliases('the govt shutdown');
    expect(expanded).toBe('the government shutdown');
    expect(fired).toEqual(['govt->government']);
  });

  it('expands a common written abbreviation: "dept" -> "department"', () => {
    const { expanded, fired } = applyAliases('state dept building');
    expect(expanded).toBe('state department building');
    expect(fired).toEqual(['dept->department']);
  });

  it('expands multiple different aliases in one phrase, in encounter order', () => {
    const { expanded, fired } = applyAliases('bob and liz went to the govt mtg');
    expect(expanded).toBe('robert and elizabeth went to the government meeting');
    expect(fired).toEqual(['bob->robert', 'liz->elizabeth', 'govt->government', 'mtg->meeting']);
  });

  it('every table value is itself lowercase and contains no leftover punctuation', () => {
    for (const value of Object.values(SCAVENGER_HUNT_ALIASES)) {
      expect(value).toBe(value.toLowerCase());
      expect(value).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/);
    }
  });

  it('every table key is a single lowercase word (matches the whole-token contract)', () => {
    for (const key of Object.keys(SCAVENGER_HUNT_ALIASES)) {
      expect(key).toMatch(/^[a-z0-9]+$/);
    }
  });
});
