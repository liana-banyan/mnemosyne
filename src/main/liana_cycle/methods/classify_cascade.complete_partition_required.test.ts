// classify_cascade.complete_partition_required.test.ts -- D-BP153-020/BISHOP/seg-classify-020
//
// THE MEASURED FAILURE (live run, receipt LIANA_RUN_qid98_2026-08-13T00-54-31-659Z.json). The run
// PUBLISHED verdict A (matching the answer key) from a frame that was WRONG about seven of nine
// options:
//   FRAME: answered FROM A NEW QUERY -- direct extraction excludes (nothing), complement states
//          A) South America, E) Europe IS world regions
//   FRAME RECONCILIATION: complement trusted despite an incomplete direct side -- {B, C, D, F, G,
//          H, I}
//   FRAME: 7 option(s) are not world regions -- B) South Asia, C) North Africa, D) Northeast
//          United States, F) Central Asia, G) Arctic Circle, H) Amazon Rainforest, I) Sahara Desert
//   FRAME: 2 of 9 option(s) remain in frame -- A, E
//   MEMBERSHIP TERMINATOR: {A, E} MINUS {B, D, E} leaves exactly one: A -> PUBLISH A
//
// South Asia, North Africa, Northeast United States, and Central Asia ARE world regions -- the
// source named only A and E as world regions, and the reconciliation treated every option it FAILED
// TO MENTION as an exclusion. The right answer fell out of a frame that was wrong about seven of
// nine options; change which two the source happens to name and this yields a different letter with
// equal confidence. Right answer, wrong mechanism (BP149 pattern).
//
// THE RULE (FD-BP153-07): A COMPLETE PARTITION IS REQUIRED BEFORE ANY FRAME EXCLUSION IS TRUSTED.
// ABSENCE IS OMISSION, NEVER A STATED EXCLUSION. An exclusion may be trusted ONLY when direct UNION
// complement accounts for EVERY option in the question. See reconcileNamedSet() in
// classify_cascade.ts for the pure set arithmetic this file exercises directly, plus
// establishFrame() end to end for the exact live shape.
//
// SCOPE: this ticket ports the SAME requirement (already computed as `partitionComplete`, but
// previously only REPORTED, never ENFORCED) to the one place it was not yet enforced -- the
// `nonMembers.length > 0` branch of reconcileNamedSet(), the shared choke point BOTH
// establishFrame() (via extractFrameBothSides()) and extractNamedSetMembers() (via
// extractNamedSetBothSides()) already call. One mechanism, not two.

import { describe, test, expect, vi } from 'vitest';
import { establishFrame, reconcileNamedSet } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

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

/** Same convention every classify_cascade.*.test.ts sibling already uses -- queues canned Ollama
 *  /api/generate JSON responses, one per gemmaExtract() call, in order. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

describe('reconcileNamedSet() pure arithmetic -- D-BP153-020, the partition-completeness gate', () => {
  test('TEST 1 (HEADLINE): direct excludes nothing, complement names ONLY {A, E} out of nine -- ZERO exclusions trusted, note names the seven unaccounted-for options', () => {
    const result = reconcileNamedSet(ALL, [], ['A', 'E'], OPT);
    expect(result.members).toEqual([]);
    expect(result.partitionComplete).toBe(false);
    expect(result.why).toMatch(/INCOMPLETE PARTITION/);
    expect(result.why).not.toMatch(/trusted despite an incomplete direct side/);
    for (const opt of ['B', 'C', 'D', 'F', 'G', 'H', 'I']) {
      expect(result.why).toContain(`${opt}) ${OPT[opt]}`);
    }
  });

  test('TEST 2: complete partition from the complement alone -- complement addresses all nine options by itself -- trusted (gate opens on coverage alone, direct contributes nothing)', () => {
    // The complement direction addresses ALL nine options here (a passage that states, for every
    // single option, whether it is or is not a member) -- direct extracted nothing. Union = all 9,
    // complete, so the gate opens and the arithmetic is trusted -- the reconciled result is
    // necessarily empty (a complement that alone names all nine as NOT members reconciles to zero
    // members), which is the correct, non-trivial point: "trusted" and "empty" are independent --
    // this asserts partitionComplete/why, not merely a non-empty members list.
    const result = reconcileNamedSet(ALL, [], [...ALL], OPT);
    expect(result.partitionComplete).toBe(true);
    expect(result.why).toMatch(/complete partition/);
    expect(result.members).toEqual([]);
  });

  test('a 6-of-9 complement alone, direct silent, is NOT a complete partition -- the boundary TEST 2 sits just past', () => {
    // Contrast case for TEST 2: the complement alone must cover EVERY option, not merely most of
    // them, before the gate opens. Six of nine here leaves three genuinely unaccounted for.
    const result = reconcileNamedSet(ALL, [], ['A', 'C', 'F', 'G', 'H', 'I'], OPT);
    expect(result.partitionComplete).toBe(false);
    expect(result.members).toEqual([]);
  });

  test('TEST 3: complete partition split across both sides -- direct names 3, complement names the other 6 -> trusted', () => {
    const result = reconcileNamedSet(ALL, ['B', 'D', 'E'], ['A', 'C', 'F', 'G', 'H', 'I'], OPT);
    expect(result.partitionComplete).toBe(true);
    expect(result.why).toMatch(/complete partition/);
    expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
  });

  test('TEST 4: direct side alone complete (complement said nothing) -> trusted, unreconciled', () => {
    const result = reconcileNamedSet(ALL, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], [], OPT);
    expect(result.members).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    expect(result.why).toMatch(/complement extracted nothing/);
  });

  // D-BP153-029 UPDATE, RECORDED HERE EXPLICITLY. This test used to assert that a single
  // unaccounted-for option (I) wiped the DIRECTLY STATED members {B,D,E} to `[]`, on the theory
  // that "nothing trusted" meant literally nothing. That was the over-correction D-BP153-029
  // closes: the rule is that the COMPLEMENT-DERIVED INFERENCE (the "all minus non-members"
  // arithmetic the COMPLETE branch performs) is untrustworthy on an incomplete union -- it says
  // nothing about the directly stated members themselves, which were never inferred from anyone's
  // absence and stay trusted.
  test('TEST 5: one option unaccounted for out of nine -> the complement-derived inference is discarded, the three DIRECTLY STATED members are RETAINED, that option named in the note', () => {
    // Direct names 3 {B,D,E}, complement names 5 of the remaining 6 {A,C,F,G,H} -- I (Sahara Desert)
    // is the ONE option neither side addresses.
    const result = reconcileNamedSet(ALL, ['B', 'D', 'E'], ['A', 'C', 'F', 'G', 'H'], OPT);
    expect(result.members).toEqual(['B', 'D', 'E']);
    expect(result.partitionComplete).toBe(false);
    expect(result.why).toMatch(/INCOMPLETE PARTITION/);
    expect(result.why).toMatch(/RETAINED/);
    // The uncovered-options label names exactly {I) Sahara Desert} -- the ONE option, not a
    // false-positive substring match against the members/non-members labels also present in `why`.
    expect(result.why).toContain('{I) Sahara Desert}');
  });

  test('never derives an exclusion from an option\'s absence -- a single-option complement never implies the other eight', () => {
    const result = reconcileNamedSet(ALL, [], ['A'], OPT);
    expect(result.members).toEqual([]);
    expect(result.partitionComplete).toBe(false);
  });

  test('a conflict is still reported and left unresolved -- untouched by the completeness gate', () => {
    const result = reconcileNamedSet(ALL, ['B'], ['B'], OPT);
    expect(result.conflicts).toEqual(['B']);
    expect(result.why).toMatch(/CONFLICT/);
    expect(result.members).toEqual(['B']); // falls back to the direct extraction, unreconciled
  });
});

describe('establishFrame() end to end -- D-BP153-020, THE EXACT LIVE SHAPE (fresh-query path)', () => {
  test('HEADLINE: direct excludes nothing, complement names ONLY {A, E} -- the frame returns ZERO exclusions, not the seven the live bug produced', async () => {
    const originalFetch = global.fetch;
    const passage = 'South America and Europe are recognized as legitimate world regions.';
    global.fetch = queuedFetch([
      // Direct (NOT category): nothing stated in that shape.
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // Complement (IS category): ONLY A and E, exactly the measured live shape -- seven of nine
      // options are simply never mentioned by either direction.
      JSON.stringify({
        members: ['South America', 'Europe'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // THE HEADLINE ASSERTION: zero exclusions -- NOT {B,C,D,F,G,H,I}, the seven the live bug
      // produced by trusting a complement that only ever named two of nine options.
      expect(frame.excluded).toEqual([]);
      expect(frame.included).toEqual(expect.arrayContaining(['A', 'E']));
      expect(frame.partitionComplete).toBe(false);
      expect(frame.available).toBe(true); // answered -- with zero exclusions, a legitimate outcome
      expect(frame.answeredFrom).toBe('new-query');

      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /INCOMPLETE PARTITION/.test(l))).toBe(true);
      expect(log.some((l) => /trusted despite an incomplete direct side/.test(l))).toBe(false);
      // The note names exactly the seven unaccounted-for options.
      for (const opt of ['B', 'C', 'D', 'F', 'G', 'H', 'I']) {
        expect(log.some((l) => l.includes('INCOMPLETE PARTITION') && l.includes(`${opt}) ${OPT[opt]}`))).toBe(true);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('a complete partition split across owned-evidence direct+complement is still trusted end to end', async () => {
    const originalFetch = global.fetch;
    const passage = 'Arctic Circle, Amazon Rainforest, and Sahara Desert are biomes, not world regions. '
      + 'South America, South Asia, North Africa, Northeast United States, Europe, and Central Asia '
      + 'are all legitimate world regions.';
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South America', 'South Asia', 'North Africa', 'Northeast United States', 'Europe', 'Central Asia']
          .map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['G', 'H', 'I']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
