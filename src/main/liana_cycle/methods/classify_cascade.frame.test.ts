// classify_cascade.frame.test.ts -- D-BP153-006/BISHOP/the-frame
//
// FD-BP153-01: "So make the ruling that a superlative resolves by magnitude RIGHT by making it
// complete with the frame." (Founder, BP153, verbatim.)
//
// WHAT THIS TEST PROVES, AND WHAT IT DOES NOT. It runs the ruling's arithmetic against the
// Founder's REAL BP153 evidence -- the ordering Google actually returned when he ran the method
// sweep's five questions by hand. It proves the frame changes the answer from wrong to right on
// qid 98, and it pins the exact failure the unframed route produces.
//
// It does NOT exercise runSuperlativeByMagnitude() end to end. That path calls gemmaExtract(),
// which fetches a local Ollama instance, and askGoogle, which is Electron browser automation.
// Neither is available under vitest. So this test covers the DECISION the frame makes, not the
// plumbing that fetches it. The plumbing needs a live in-app run to verify, and that is stated
// here rather than implied by a green check.
//
// THE EVIDENCE, verbatim from the Founder's BP153 return. Both directions agreed exactly (his own
// QC), so the ordering below is trustworthy and is reproduced in the source's stated order:
//   most -> least: South Asia, Northeast US, Europe, South America, Central Asia, North Africa,
//                  Sahara Desert, Amazon Rainforest, Arctic Circle
// And the source's own categorization, which is the frame:
//   continental / subcontinental divisions : South Asia, Europe, South America
//   sub-national geographic zone           : Northeast United States
//   biomes or climatic areas               : Amazon Rainforest, Sahara Desert, Arctic Circle

import { describe, test, expect } from 'vitest';

// qid 98's option letters, from resources/mmlu_pro_bundled/questions.jsonl.
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

// The ordering Google actually returned, most densely populated first.
const MOST_TO_LEAST: string[] = ['B', 'D', 'E', 'A', 'F', 'C', 'I', 'H', 'G'];

// What the source's own Q1 answer excluded as biomes / climatic areas rather than world regions.
const FRAME_EXCLUDED_BIOMES: string[] = ['H', 'I', 'G'];

// Q1's answer names only these as continental/subcontinental divisions or sub-national zones.
// Central Asia and North Africa appear nowhere in that framing, and Google's own entity labels
// tagged them "Colloquial area" rather than continent.
const FRAME_KEPT_STRICT: string[] = ['A', 'B', 'D', 'E'];

/** The route's own structural lookup: index 0 is the "most" end of a most-to-least ordering, the
 *  last index is the "least" end. Mirrors extremeOf() in classify_cascade.ts, which is
 *  module-private. A NOT-question about "most X" targets the LEAST extreme. */
const leastExtremeOf = (ordering: string[]): string | null => (ordering.length ? ordering[ordering.length - 1] : null);

describe('FD-BP153-01: a superlative resolves by magnitude INSIDE THE FRAME', () => {
  test('THE BUG, pinned: the UNFRAMED route answers G (Arctic Circle) on real evidence, and the key is A', () => {
    // This is what the route did before the frame: rank every option, take the least extreme.
    const unframed = leastExtremeOf(MOST_TO_LEAST);
    expect(unframed).toBe('G');
    expect(OPT[unframed as string]).toBe('Arctic Circle');
    // The key is A. So the unframed magnitude route is confidently WRONG on this question, which
    // is strictly worse than the abstain it produced only because it had no data.
    expect(unframed).not.toBe('A');
  });

  test('THE FIX: excluding the biomes the source itself named puts South America at the least extreme', () => {
    const framed = MOST_TO_LEAST.filter((L) => !FRAME_EXCLUDED_BIOMES.includes(L));
    // Ranking now compares only things the source called world regions.
    expect(framed).toEqual(['B', 'D', 'E', 'A', 'F', 'C']);
    // NOTE, stated rather than hidden: with ONLY the biomes removed the least extreme is C (North
    // Africa), not yet A. Biome exclusion alone is necessary and NOT sufficient.
    expect(leastExtremeOf(framed)).toBe('C');
  });

  test('THE FULL FRAME, as the source stated it, lands on A -- and matches his hand-worked run', () => {
    // Q1 named exactly these as legitimate world regions. Central Asia and North Africa were not
    // in that framing, so they are out of frame too, not merely low-density.
    const framed = MOST_TO_LEAST.filter((L) => FRAME_KEPT_STRICT.includes(L));
    expect(framed).toEqual(['B', 'D', 'E', 'A']);

    const answer = leastExtremeOf(framed);
    expect(answer).toBe('A');
    expect(OPT[answer as string]).toBe('South America');

    // AND THIS IS THE CORROBORATION THAT MATTERS. BP152 recorded the Founder's hand-worked run as
    // "South America ranked last in every ordering." In the FULL list South America is 4th of 9.
    // Inside the frame it is last. His hand-work and this evidence agree exactly, once the frame
    // he applied in his head is applied in code.
    expect(framed[framed.length - 1]).toBe('A');
    expect(MOST_TO_LEAST.indexOf('A')).toBe(3); // 4th of 9 unframed -- both facts are true at once
  });

  test('the frame is a restriction, never a reordering -- relative order is preserved exactly', () => {
    // A frame that reordered anything would be smuggling a second ranking in. It only removes.
    const framed = MOST_TO_LEAST.filter((L) => FRAME_KEPT_STRICT.includes(L));
    const positionsInOriginal = framed.map((L) => MOST_TO_LEAST.indexOf(L));
    const ascending = [...positionsInOriginal].sort((a, b) => a - b);
    expect(positionsInOriginal).toEqual(ascending);
  });

  test('D-BP153-010: an EMPTY passage is unavailable, never "the source excluded nothing"', () => {
    // Bishop's own bug, caught by the first live run of the frame (2026-08-12T16:04Z). The frame
    // query came back ok:true with EMPTY text, so the extractor found nothing in nothing, and the
    // frame reported "9 of 9 option(s) remain in frame" -- which reads exactly like "the source
    // examined all nine and confirmed every one is a world region." Those are different facts.
    //
    // Encoded here as the invariant establishFrame() must hold: an empty passage yields
    // available:false, and the route then abstains per FD-BP153-01 consequence 2. Passing all
    // nine through would be the unframed pool, which answers G on this question against a key of A.
    const emptyPassageIsUsable = (text: string): boolean => Boolean(text && text.trim());
    expect(emptyPassageIsUsable('')).toBe(false);
    expect(emptyPassageIsUsable('   \n  ')).toBe(false);
    expect(emptyPassageIsUsable('South America is a continent.')).toBe(true);

    // And the consequence: an unavailable frame must NOT degrade to ranking every option.
    const unframedWouldAnswer = leastExtremeOf(MOST_TO_LEAST);
    expect(unframedWouldAnswer).toBe('G'); // the wrong answer an empty frame would have allowed
  });

  test('an empty frame must not silently become "rank everything"', () => {
    // FD-BP153-01 consequence 2. If the frame excludes everything there is nothing to rank, and
    // the route must abstain rather than quietly falling back to the full pool. Encoded here as
    // the arithmetic the route relies on: an empty framed pool yields no extreme at all.
    const framed = MOST_TO_LEAST.filter(() => false);
    expect(framed).toHaveLength(0);
    expect(leastExtremeOf(framed)).toBeNull();
  });
});
