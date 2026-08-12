// classify_cascade.property_not_membership.test.ts -- D-BP153-018/BISHOP/seg-classify-018
//
// THE MEASURED FAILURE (live run 2026-08-12T22:32Z, receipt
// LIANA_RUN_qid98_2026-08-12T22-32-08-512Z.json). THE SOFTBALLS (establishFrame(), QUESTION 1 --
// "which options are legitimate members of the category at all?") extracted its exclusion set from
// this sentence:
//   "Options A, C, F, G, H, I are all NOT considered among the world's most densely populated
//   regions."
// That sentence answers QUESTION 2 (THE NAMED SET -- "which options SCORE as densely populated?"),
// not QUESTION 1 (what a thing IS). Both questions returned the SAME set, legitimate-regions MINUS
// named-set-members left ZERO, the terminator fell through to the magnitude route, and the run
// burned 53 queries reaching an ordering disagreement.
//
// THE RULE UNDER TEST: a span that asserts the SUPERLATIVE PROPERTY is not evidence about CATEGORY
// MEMBERSHIP. establishFrame() DISCARDS a value whose own verified span mentions the property
// (hard rule); extractNamedSetMembers() only COUNTS and NOTES the symmetric case (report, not
// enforce -- a source may state membership without repeating the property phrase).
//
// THE PROPERTY STRING IS DERIVED, NEVER HARDCODED IN THIS FILE AS A TEST-ONLY LITERAL: it is read
// off the Founder's own qid-98 question text via extractSuperlativeMatch(), the exact function
// classify_cascade.ts's own run() already uses to route this class of question -- same convention
// classify_cascade.membership_terminator.test.ts and classify_cascade.discriminator.test.ts already
// use for `match`.

import { describe, test, expect, vi } from 'vitest';
import { establishFrame, extractNamedSetMembers, extractSuperlativeMatch } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
const MATCH = extractSuperlativeMatch(QUESTION)!;
const PROPERTY = MATCH.property; // derived from the question's own grammar -- expected "densely populated"

const OPT: Record<string, string> = {
  A: 'South America',
  B: 'South Asia',
  C: 'North Africa',
  D: 'Northeast United States',
  E: 'Europe',
  F: 'Central Asia',
  G: 'Arctic Circle',
  H: 'Amazon Rainforest',
  I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);
const CATEGORY = 'world regions';

const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

// Same convention every classify_cascade.*.test.ts sibling uses -- queues canned Ollama
// /api/generate JSON responses, one per gemmaExtract() call, in order.
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

describe('D-BP153-018 sanity: the property is derived, not hardcoded here', () => {
  test('extractSuperlativeMatch() on the real qid-98 question yields "densely populated"', () => {
    expect(MATCH).not.toBeNull();
    expect(PROPERTY).toBe('densely populated');
  });
});

describe('D-BP153-018 TEST 1 (HEADLINE): a span asserting the property is not evidence of category membership', () => {
  test('establishFrame() discards ALL SIX candidate exclusions when every supporting span mentions the property -- zero exclusions, not the six', async () => {
    const originalFetch = global.fetch;
    // THE EXACT MEASURED SENTENCE (owned_evidence_frame.test.ts's own `firstSentence`, reused
    // verbatim) -- this is the sentence the live bug actually pulled the (wrong) exclusion set from.
    const propertySentence = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
      + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
      + 'densely populated regions.';
    global.fetch = queuedFetch([
      // Call 1: frameExtractionInstruction() (direct exclusion / not_members read). Six letters, all
      // sourced from the SAME property-asserting span -- exactly what the live bug measured.
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: propertySentence })),
        stated_in_passage: true,
      }),
      // Call 2: frameComplementExtractionInstruction() (inclusion read). This passage never states
      // "IS a world region" positively -- nothing to extract.
      JSON.stringify({ members: [], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached -- owned evidence answers it' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(propertySentence)], PROPERTY,
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('owned-passage');
      // THE HEADLINE ASSERTION: zero exclusions, not the six the live bug produced.
      expect(frame.excluded).toEqual([]);
      // The note names each discard and quotes the offending span (D-BP153-018).
      for (const opt of ['A', 'C', 'F', 'G', 'H', 'I']) {
        expect(log.some((l) => l.includes(`DISCARDED ${opt})`) && l.includes('D-BP153-018') && l.includes(propertySentence))).toBe(true);
      }
      expect(log.some((l) => /discarded 6 value\(s\) whose supporting span asserts the SUPERLATIVE PROPERTY/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 2: a genuine category exclusion (no property phrase) still works', () => {
  test('a span stating what a thing IS INSTEAD, with no property language, is kept, not discarded', async () => {
    const originalFetch = global.fetch;
    const categorySpan = 'The Amazon Rainforest is a biome, not a world region.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [{ name: 'Amazon Rainforest', span: categorySpan }], stated_in_passage: true }),
      JSON.stringify({ members: [], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(categorySpan)], PROPERTY,
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(frame.excluded).toEqual(['H']);
      expect(log.some((l) => /DISCARDED H\)/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 3: mixed passage -- only the property-based span is discarded, the category one survives', () => {
  test('one candidate exclusion sourced from a property span is discarded; the other, sourced from a category span, is kept', async () => {
    const originalFetch = global.fetch;
    const propertySpan = "Arctic Circle is NOT considered among the world's most densely populated regions.";
    const categorySpan = 'The Amazon Rainforest is a biome, not a world region.';
    const passage = `${propertySpan} ${categorySpan}`;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: [
          { name: 'Arctic Circle', span: propertySpan },
          { name: 'Amazon Rainforest', span: categorySpan },
        ],
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(passage)], PROPERTY,
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(frame.excluded).toEqual(['H']);
      expect(frame.excluded).not.toContain('G');
      expect(log.some((l) => l.includes('DISCARDED G)') && l.includes(propertySpan))).toBe(true);
      expect(log.some((l) => l.includes('DISCARDED H)'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 4: the symmetric named-set check REPORTS, never rejects', () => {
  test('extractNamedSetMembers() counts and notes members whose span omits the property, but keeps them as members', async () => {
    const originalFetch = global.fetch;
    const memberSpan = 'Only B (South Asia) and D (Northeast United States) are recognized as major population clusters.';
    const nonMemberSpan = 'Options A (South America) and C (North Africa) are not among them.';
    const passage = `${memberSpan} ${nonMemberSpan}`;
    const subset = ['A', 'B', 'C', 'D'];
    const subOPT: Record<string, string> = { A: OPT.A, B: OPT.B, C: OPT.C, D: OPT.D };
    global.fetch = queuedFetch([
      // Call 1: namedSetExtractionInstruction() (direct member read) -- neither span mentions
      // "densely populated" at all, even though B and D genuinely ARE the named set's members.
      JSON.stringify({
        members: [
          { name: 'South Asia', span: memberSpan },
          { name: 'Northeast United States', span: memberSpan },
        ],
        stated_in_passage: true,
      }),
      // Call 2: namedSetComplementExtractionInstruction() (non-member read).
      JSON.stringify({
        not_members: [
          { name: 'South America', span: nonMemberSpan },
          { name: 'North Africa', span: nonMemberSpan },
        ],
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const namedSet = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, MATCH.direction, PROPERTY, subset, subOPT, note,
        () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(namedSet.available).toBe(true);
      // REPORT, NEVER ENFORCE: B and D are still members despite their span never mentioning the
      // property -- the symmetric check must never remove them.
      expect(namedSet.members).toContain('B');
      expect(namedSet.members).toContain('D');
      expect(log.some((l) => /REPORT ONLY/.test(l) && /D-BP153-018/.test(l) && l.includes('B) South Asia') && l.includes('D) Northeast United States'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 5: zero exclusions after discarding is a legitimate outcome, not an error', () => {
  test('when discarding empties the frame via the FRESH-QUERY path too, the run proceeds exactly as an ordinary empty-exclusion frame would', async () => {
    const originalFetch = global.fetch;
    const propertySentence = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
      + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
      + 'densely populated regions.';
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: propertySentence })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: propertySentence }));
    try {
      const { note, log } = notes();
      // No ownedPassages accessor at all -- forces the fresh-query path, not the owned-passage loop,
      // to prove the same discard-to-zero handling holds on both routes.
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, undefined, PROPERTY,
      );
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.excluded).toEqual([]);
      // Same note wording an ordinary "excluded nothing" frame would emit -- the run proceeds
      // exactly as it would have (ticket's own words), no distinct/alarming code path.
      expect(log.some((l) => /FRAME: 0 option\(s\) are not world regions and will NOT be ranked -- \(none\)/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
