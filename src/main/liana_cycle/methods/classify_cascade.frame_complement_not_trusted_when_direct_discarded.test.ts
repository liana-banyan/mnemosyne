// classify_cascade.frame_complement_not_trusted_when_direct_discarded.test.ts --
// D-BP153-019/BISHOP/seg-classify-019, FIX 2
//
// THE MEASURED FAILURE (live run 2026-08-13T00-02-41Z, receipt
// LIANA_RUN_qid98_2026-08-13T00-02-41-506Z.json). D-BP153-018 fired correctly on the DIRECT
// extraction -- all six spurious exclusions discarded, each noted "its supporting span asserts the
// SUPERLATIVE PROPERTY ('densely populated'), not category membership". Then the COMPLEMENT side
// put them straight back:
//   FRAME: ... direct extraction excludes (none), complement states B) South Asia, D) Northeast
//   United States, E) Europe
//   FRAME RECONCILIATION: complement (non-members {B,D,E}) trusted despite an incomplete direct
//   side -- {A,C,F,G,H,I}
//   FRAME: 3 of 9 option(s) remain in frame -- B, D, E
//   MEMBERSHIP TERMINATOR: legitimate {B,D,E} MINUS members {B,D,E} leaves ZERO -> fell through to
//   magnitude route, 76 evidence records.
//
// WHY D-BP153-018 ALONE DID NOT CATCH THIS. discardPropertyContaminatedSpans() IS already applied
// to both the direct and complement reads (see classify_cascade.ts's own extractFrameBothSides()) --
// but it only discards a value whose OWN verified span contains the property phrase, literally. The
// complement's own spans for B/D/E ("Only B..., D..., and E... qualify") never repeat "densely
// populated" -- that phrase was stated once, in the PRECEDING sentence, about the SAME passage's
// direct-side values -- so the per-span substring check has nothing to match against on the
// complement side, even though the whole passage is unambiguously about the property, not the
// category.
//
// THE RULE UNDER TEST (D-BP153-019, FIX 2): when the direct side extracted values and ALL of them
// were discarded as property spans (case b, as opposed to case a -- the direct side genuinely found
// nothing at all), that is itself evidence the PASSAGE is about the property, not the category -- so
// the complement is not trusted either; the whole frame extraction from that passage is rejected,
// exactly as if the passage had yielded nothing extractable.

import { describe, test, expect, vi } from 'vitest';
import { establishFrame, extractSuperlativeMatch } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
const MATCH = extractSuperlativeMatch(QUESTION)!;
const PROPERTY = MATCH.property; // derived from the question's own grammar, expected "densely populated"

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

// THE REAL PASSAGE (owned_evidence_frame.test.ts's own firstSentence, extended with the SAME
// live sentence's own complement clause -- "Only B..., D..., and E... qualify"). This is the exact
// sentence shape the live run measured: one property statement naming the six non-members, followed
// immediately by a second clause naming the three that "qualify" WITHOUT repeating the property
// phrase in that second clause's own span.
const REAL_PASSAGE = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
  + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
  + 'densely populated regions. Only B (South Asia), D (Northeast United States), and E (Europe) qualify.';
const DIRECT_SPAN = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
  + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
  + 'densely populated regions.';
// THE MEASURED GAP: this span does NOT contain "densely populated" -- it is the complement clause
// ALONE, exactly what gemmaExtract() copied out for B/D/E in the live run.
const COMPLEMENT_SPAN = 'Only B (South Asia), D (Northeast United States), and E (Europe) qualify.';

describe('D-BP153-019 TEST 1 (HEADLINE): the complement is not trusted when the direct side was emptied by property discards', () => {
  test('establishFrame() rejects the WHOLE passage -- zero exclusions from either direction, not the six the live bug produced', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Call 1: frameExtractionInstruction() (direct exclusion / not_members read). Six letters,
      // all sourced from the property-asserting span -- D-BP153-018 correctly discards every one.
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: DIRECT_SPAN })),
        stated_in_passage: true,
      }),
      // Call 2: frameComplementExtractionInstruction() (inclusion read). THE MEASURED GAP: three
      // letters, sourced from a span that never repeats the property phrase -- D-BP153-018's own
      // per-span check does not discard these.
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: COMPLEMENT_SPAN })),
        stated_in_passage: true,
      }),
      // Call 3: the fresh-query fallback's own frameExtractionInstruction() read, reached because
      // the owned passage is rejected wholesale and establishFrame() falls through. Nothing to
      // extract from the empty fresh-query passage below -- this response is never reached (the
      // empty-passage guard returns before any gemmaExtract() call), kept only so queuedFetch()
      // never throws if that assumption is ever wrong.
      JSON.stringify({ not_members: [], stated_in_passage: true }),
    ]);
    // The fresh-query fallback (only reached if the owned passage is rejected, which is exactly
    // what this test proves) returns an ok:true response with an EMPTY passage in ONE attempt --
    // same reproduction classify_cascade.owned_evidence_frame.test.ts's own D-BP153-014 BUG-2
    // regression test uses, so no retry backoff slows this test down.
    const askGoogle = vi.fn(async () => ({ results: [{ title: '', snippet: '' }] }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(REAL_PASSAGE)], PROPERTY,
      );
      // THE HEADLINE ASSERTION: zero exclusions AND zero inclusions from the owned passage -- not
      // the six exclusions {A,C,F,G,H,I} the live bug produced by trusting the complement.
      expect(frame.excluded).toEqual([]);
      expect(frame.included).toEqual([]);
      // The rejection is explicit in the transcript, naming why.
      expect(log.some((l) => l.includes('D-BP153-019') && l.includes('REJECTED') && /property/i.test(l))).toBe(true);
      expect(log.some((l) => /REJECTED this passage's frame extraction ENTIRELY/.test(l))).toBe(true);
      expect(log.some((l) => l.includes('the direct side extracted 6 value(s) and ALL were discarded'))).toBe(true);
      // The owned passage was rejected wholesale -- falls through to the fresh query, which itself
      // returns nothing usable, so the frame ends UNAVAILABLE, never fabricating an exclusion set.
      expect(frame.available).toBe(false);
      expect(frame.via).toMatch(/empty passage/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-019 TEST 2: a genuine category exclusion still excludes from the direct side (case (a)/no discard preserved)', () => {
  test('a span stating what a thing IS INSTEAD, with no property language, is kept and excluded -- untouched by FIX 2', async () => {
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
      expect(log.some((l) => /D-BP153-019, FIX 2.*REJECTED/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-019 TEST 3: a genuine category complement still works from the complement side', () => {
  // D-BP153-020 UPDATE, RECORDED HERE EXPLICITLY. The original fixture named only ONE option
  // directly (Sahara Desert) and THREE via the complement (South America, Europe, South Asia),
  // leaving five of nine options (C, D, F, G, H) unaccounted for by EITHER extraction -- an
  // incomplete partition. Under FD-BP153-07's completeness gate (D-BP153-020) that no longer trusts
  // ANY exclusion, so the direct span now also states the remaining five explicitly, making this a
  // genuine, complete 9-option partition split across both sides -- preserving this test's own
  // point (a genuine complement is not wrongly rejected by D-BP153-019's FIX 2) without relying on
  // the same incomplete-partition trust the live D-BP153-020 bug exploited.
  test('"South America, Europe, and South Asia are world regions; the rest are not" -- a COMPLETE partition split across both sides is trusted, not rejected', async () => {
    const originalFetch = global.fetch;
    const complementSpan = 'South America, Europe, and South Asia are world regions;';
    const directSpan = 'the Sahara Desert, North Africa, Northeast United States, Central Asia, and the '
      + 'Arctic Circle and Amazon Rainforest are not world regions.';
    const passage = `${complementSpan} ${directSpan}`;
    global.fetch = queuedFetch([
      // Direct read: the OTHER six options, stated as NOT world regions -- one span, no property
      // language at all (this fixture's own `property` argument below is empty, so D-BP153-018's
      // discard check no-ops regardless).
      JSON.stringify({
        not_members: ['Sahara Desert', 'North Africa', 'Northeast United States', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest']
          .map((name) => ({ name, span: directSpan })),
        stated_in_passage: true,
      }),
      // Complement read: the remaining three values genuinely stated to BE world regions.
      JSON.stringify({
        members: ['South America', 'Europe', 'South Asia'].map((name) => ({ name, span: complementSpan })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      // No superlative property in play for this plain category question -- property is empty,
      // matching every pre-D-BP153-018 call site's own no-op behavior.
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(passage)], '',
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(frame.partitionComplete).toBe(true);
      // The complement's three genuine members are reflected: the other six are excluded, the
      // reconciled set does not falsely re-exclude South America/Europe/South Asia.
      expect(frame.included).toEqual(expect.arrayContaining(['A', 'E', 'B']));
      expect(new Set(frame.excluded)).toEqual(new Set(['I', 'C', 'D', 'F', 'G', 'H']));
      expect(log.some((l) => /D-BP153-019, FIX 2.*REJECTED/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-019 TEST 4: case (a) direct-genuinely-empty is preserved for a COMPLETE complement -- D-BP153-020 corrects the incomplete case', () => {
  // D-BP153-020 UPDATE, RECORDED HERE EXPLICITLY. The original fixture had the direct side extract
  // NOTHING and the complement name only THREE of nine options (South Asia, Northeast United
  // States, Europe), then asserted the complement was "trusted exactly as it always has been" with
  // the other six (A, C, F, G, H, I) reconciled as excluded. That is the IDENTICAL arithmetic and
  // the IDENTICAL shape (direct silent, complement names a strict subset) as the live D-BP153-020
  // bug this ticket closes -- the only difference is which two-or-three options the complement
  // happened to name. It was never safe; it was untested against the case that actually broke,
  // because "case (a)" (D-BP153-019) was only ever about protecting a genuine signal from FIX 2's
  // own rejection, never about whether a genuine-but-PARTIAL signal should be trusted. This test now
  // asserts the corrected behavior: case (a) (direct genuinely empty, never a discard) still
  // reaches this branch and is still NOT wrongly discarded by D-BP153-019's own machinery, but
  // FD-BP153-07's completeness gate (D-BP153-020) is a SEPARATE, later check that still applies --
  // a partial complement establishes nothing. See TEST 3 (above) for the complete-partition sibling
  // that DOES get trusted, and classify_cascade.complete_partition_required.test.ts for the
  // dedicated gate coverage.
  // D-BP153-023 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to assert that a single owned
  // passage yielding an INCOMPLETE PARTITION TERMINATED the step right there (`answeredFrom:
  // 'owned-passage'`, zero queries issued) -- that IS the live measured bug D-BP153-023 closes
  // (receipt LIANA_RUN_qid98_2026-08-13T02-05-04-911Z.json): an INCOMPLETE partition is not an
  // answer, and must fall through to a fresh query rather than stopping here. This test now supplies
  // a fresh-query response too (the SAME shape, still incomplete -- proving D-BP153-020's safety net
  // is unchanged: an incomplete fresh query is still the final, "nothing trusted" answer) and asserts
  // the ONE query D-BP153-023 now spends, where the old code spent zero.
  test('the direct side extracts NOTHING and the complement names only a strict subset -- INCOMPLETE, falls through to a fresh query (D-BP153-023); the fresh query is ALSO incomplete, so NOTHING is trusted (safety net unchanged)', async () => {
    const originalFetch = global.fetch;
    const passage = 'Only B (South Asia), D (Northeast United States), and E (Europe) are recognized as major population clusters.';
    global.fetch = queuedFetch([
      // Owned passage. Direct read: genuinely nothing extracted -- an empty list, not six discarded
      // values. Complement read: three genuine members -- but six of nine options (A, C, F, G, H, I)
      // are never mentioned by EITHER extraction -- INCOMPLETE PARTITION, falls through.
      JSON.stringify({ not_members: [], stated_in_passage: true }),
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
      // The fresh query (D-BP153-023's own fall-through, never reached before this ticket): the SAME
      // incomplete shape comes back, proving the safety net (D-BP153-020) still holds unchanged.
      JSON.stringify({ not_members: [], stated_in_passage: true }),
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(passage)], PROPERTY,
      );
      // D-BP153-023: ONE query issued -- the owned passage's INCOMPLETE PARTITION did NOT answer,
      // so it fell through instead of terminating with zero queries the way the old code did.
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(log.some((l) => /INCOMPLETE PARTITION on owned passage/.test(l) && /D-BP153-023/.test(l) && /falling through/.test(l))).toBe(true);
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      // Case (a) still reaches reconciliation (never wrongly REJECTED by D-BP153-019's own FIX 2
      // machinery, which is specific to case (b) -- all-direct-values-discarded-as-property).
      expect(log.some((l) => /D-BP153-019, FIX 2.*REJECTED/.test(l))).toBe(false);
      // D-BP153-020: the complement named only three of nine options -- the union is incomplete, so
      // NOTHING is trusted. Not the {A,C,F,G,H,I} the old, pre-D-BP153-020 arithmetic derived purely
      // from those six options' absence on the complement's own (incomplete) list.
      expect(frame.included).toEqual(expect.arrayContaining(['B', 'D', 'E']));
      expect(frame.excluded).toEqual([]);
      expect(frame.partitionComplete).toBe(false);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /INCOMPLETE PARTITION/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
