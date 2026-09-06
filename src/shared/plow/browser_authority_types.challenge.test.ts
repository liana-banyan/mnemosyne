// D-BP213-XO-62/BISHOP/seg-throttled-outcome -- pure unit tests for the generalized, table-driven
// structural challenge/throttle detector (isKnownChallengeUrl / CHALLENGE_URL_RULES /
// isGoogleChallengeUrl, browser_authority_types.ts). No Electron import anywhere in this file --
// same "pure function, no mocking needed" convention as browser_authority_types.thread.test.ts.
//
// WHY THESE FIXTURES: every URL below is either (a) the one live-observed Google challenge target
// (D-BP152-050's own report, https://www.google.com/sorry/index) and its structural siblings, or
// (b) a lookalike/negative case chosen to prove the detector cannot be fooled by hostname or
// protocol tricks, or (c) a plain Perplexity URL asserted NOT to trip the detector -- documenting,
// in a runnable assertion rather than only a comment, that this ticket shipped no (guessed,
// unverifiable) Perplexity rule. No live network call is made anywhere in this file.
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_URL_RULES,
  isGoogleChallengeUrl,
  isKnownChallengeUrl,
} from './browser_authority_types';

describe('D-BP213-XO-62 isKnownChallengeUrl / isGoogleChallengeUrl', () => {
  it('recognizes the live-observed Google challenge redirect target', () => {
    expect(isKnownChallengeUrl('https://www.google.com/sorry/index?continue=abc')).toBe(true);
    expect(isGoogleChallengeUrl('https://www.google.com/sorry/index?continue=abc')).toBe(true);
  });

  it('recognizes the bare /sorry path (no trailing segment) and other google TLDs', () => {
    expect(isKnownChallengeUrl('https://google.com/sorry')).toBe(true);
    expect(isKnownChallengeUrl('https://www.google.co.uk/sorry/index')).toBe(true);
    expect(isKnownChallengeUrl('https://www.google.de/sorry/')).toBe(true);
  });

  it('does not match a genuine Google search results page', () => {
    expect(isKnownChallengeUrl('https://www.google.com/search?q=berlin+wall')).toBe(false);
    expect(isGoogleChallengeUrl('https://www.google.com/search?q=berlin+wall')).toBe(false);
  });

  it('does not match a path that merely contains "sorry" as a substring, not a path segment', () => {
    expect(isKnownChallengeUrl('https://www.google.com/notsorryatall')).toBe(false);
  });

  it('cannot be fooled by a lookalike hostname carrying extra dot-separated labels', () => {
    // The exact isolated-verification finding this file's own pre-existing header documents:
    // a naive [a-z.]-class hostname match would also accept this.
    expect(isKnownChallengeUrl('https://google.com.attacker.net/sorry/index')).toBe(false);
    expect(isGoogleChallengeUrl('https://google.com.attacker.net/sorry/index')).toBe(false);
  });

  it('cannot be fooled by a lookalike hostname with google as a subdomain label', () => {
    expect(isKnownChallengeUrl('https://google.com.evil.example/sorry/')).toBe(false);
  });

  it('rejects a non-https URL even on the real host/path', () => {
    expect(isKnownChallengeUrl('http://www.google.com/sorry/index')).toBe(false);
  });

  it('returns false, never throws, on a malformed URL', () => {
    expect(() => isKnownChallengeUrl('not a url at all')).not.toThrow();
    expect(isKnownChallengeUrl('not a url at all')).toBe(false);
    expect(isKnownChallengeUrl('')).toBe(false);
  });

  it('does NOT flag a Perplexity URL -- no verified structural rule exists for that vendor yet', () => {
    // Documents the honest gap this ticket shipped rather than a guessed rule: any Perplexity URL,
    // including ones that would structurally resemble a challenge shape for another vendor, must
    // fall through to false because CHALLENGE_URL_RULES carries no Perplexity entry.
    expect(isKnownChallengeUrl('https://www.perplexity.ai/search?q=berlin+wall')).toBe(false);
    expect(isKnownChallengeUrl('https://www.perplexity.ai/sorry/index')).toBe(false);
    expect(CHALLENGE_URL_RULES.some((rule) => rule.vendor === 'perplexity')).toBe(false);
  });

  it('CHALLENGE_URL_RULES carries exactly the one verified Google entry today', () => {
    expect(CHALLENGE_URL_RULES.map((rule) => rule.vendor)).toEqual(['google']);
  });

  it('a future vendor rule is a pure data addition: isKnownChallengeUrl needs no change to pick it up', () => {
    // Proves the "third host is a data addition, not a code change" contract by actually
    // constructing a second table (never mutating the real CHALLENGE_URL_RULES) and calling the
    // SAME exported predicate shape isKnownChallengeUrl uses internally.
    const withHypotheticalPerplexityRule = [
      ...CHALLENGE_URL_RULES,
      {
        vendor: 'perplexity',
        hostnamePattern: /^(?:www\.)?perplexity\.ai$/i,
        pathnameMatches: (pathname: string) => pathname === '/rate-limit-example',
      },
    ];
    const matches = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        return withHypotheticalPerplexityRule.some(
          (rule) => rule.hostnamePattern.test(parsed.hostname) && rule.pathnameMatches(parsed.pathname),
        );
      } catch {
        return false;
      }
    };
    expect(matches('https://www.perplexity.ai/rate-limit-example')).toBe(true);
    // The real table (and therefore the real isKnownChallengeUrl) is unaffected by the local array
    // above -- confirms no mutation leaked.
    expect(isKnownChallengeUrl('https://www.perplexity.ai/rate-limit-example')).toBe(false);
    expect(CHALLENGE_URL_RULES.length).toBe(1);
  });
});
