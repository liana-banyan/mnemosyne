// classify_cascade.frame_complement_not_trusted_when_direct_discarded.test.ts --
// D-BP153-019/BISHOP/seg-classify-019, FIX 2 -- RETIRED FOR THE SOFTBALLS BY D-BP153-032, residual
// coverage kept below
//
// THE ORIGINAL MEASURED FAILURE (live run 2026-08-13T00-02-41Z, receipt
// LIANA_RUN_qid98_2026-08-13T00-02-41-506Z.json). D-BP153-018 fired correctly on the DIRECT
// extraction (six spurious exclusions discarded as property spans), then the COMPLEMENT side put
// them straight back, because its own spans never repeated the property phrase.
//
// D-BP153-019's OWN FIX (WHOLESALE REJECTION: when the direct side extracted values and ALL were
// discarded as property spans, the complement is not trusted EITHER, and the whole passage is
// rejected) is RETIRED for THE SOFTBALLS by D-BP153-032. THE SOFTBALLS no longer extract a direct/
// complement pair at all (frameExtractionInstruction()/frameComplementExtractionInstruction()/
// extractFrameBothSides(), RETIRED) -- they extract ONE stated kind per option
// (extractFrameKinds()/extractDiscriminatorKinds()) and apply D-BP153-018's property-span discard to
// THAT single read, per option, independently (classify_cascade.ts's own D-BP153-032 section
// header). There is no "complement putting a discarded value back" shape left to guard against: an
// option's own kind is either genuinely stated (and kept) or it is not (discarded or never stated,
// either way UNACCOUNTED) -- one option's discard can never affect another option's own
// independently-verified kind. THE RESIDUAL INVARIANT this file still proves: a property-tainted
// span is NEVER trusted as a stated kind, regardless of how many OTHER options' kinds were also
// discarded or survived -- see classify_cascade.property_not_membership.test.ts for the primary,
// per-option coverage of this same D-BP153-018 rule against the new shape; this file keeps its own
// TESTS 2-4 (genuine, non-property-tainted category statements still work) updated to the new shape,
// since they test a still-live invariant from a different angle (own passages, own wording).

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: this file's own fixtures each mock exactly ONE response per base
// question -- pinning LB_DRAW_REPEATS=1 keeps every existing assertion in this file (call counts,
// single-draw extraction) valid. drawWithAgreement()'s own repeats===1 path is a pure pass-through,
// BYTE-IDENTICAL to this file's pre-D-BP153-031 behavior (see classify_cascade.ts's own D-BP153-031
// section header and resolveDrawRepeats()). The channel-variance repeat/disagreement behavior itself
// is covered by classify_cascade.repeated_draws.test.ts, not here.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });
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

describe('D-BP153-019 TEST 1 (HEADLINE), RESTATED FOR D-BP153-032: a property-tainted stated kind is NEVER trusted, however many options it covers', () => {
  test('establishFrame() discards every property-tainted kind -- zero exclusions from the tainted passage, not the six the live bug produced', async () => {
    const originalFetch = global.fetch;
    // THE EXACT MEASURED SENTENCE: six options' ONLY candidate "kind" statement is really a claim
    // about the SUPERLATIVE PROPERTY, not a taxonomic classification.
    const propertySentence = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic "
      + "Circle), H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's "
      + 'most densely populated regions.';
    const smallOpt: Record<string, string> = {
      A: OPT.A, C: OPT.C, F: OPT.F, G: OPT.G, H: OPT.H, I: OPT.I,
    };
    const smallAll = Object.keys(smallOpt);
    global.fetch = queuedFetch([JSON.stringify({
      kinds: smallAll.map((L) => ({ name: smallOpt[L], kind: PROPERTY, span: propertySentence })),
      category_kind: null,
      category_kind_span: '',
      stated_in_passage: true,
    })]);
    const askGoogle = vi.fn(async () => ({ results: [{ title: '', snippet: '' }] }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, smallAll, smallOpt, note,
        () => [owned(propertySentence)], PROPERTY,
      );
      // THE HEADLINE ASSERTION: zero exclusions -- not the six the live bug produced by trusting a
      // property-only claim as category membership.
      expect(frame.excluded).toEqual([]);
      expect(frame.included).toEqual([]);
      // Every one of the six is DISCARDED, individually, and the transcript names each one and
      // quotes the offending span.
      for (const L of smallAll) {
        expect(log.some((l) => l.includes(`DISCARDED ${L})`) && l.includes('D-BP153-018') && l.includes(propertySentence))).toBe(true);
      }
      // No category denotation was ever (validly) stated either -- the frame is UNAVAILABLE, never
      // guessed (D-BP153-032's own "never guess" rule, restated: a wholly property-tainted passage
      // is functionally the same as a passage that never discussed the category at all).
      expect(frame.available).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-019 TEST 2: a genuine category exclusion still excludes (no property language, untouched by FIX 2)', () => {
  test('a stated kind with no property language is kept and excludes correctly', async () => {
    const originalFetch = global.fetch;
    const categorySpan = 'The Amazon Rainforest is a "biome", not a world region.';
    const categoryDenotation = 'South America is a "legitimate world region", the proper denotation of a world region.';
    const passage = `${categorySpan} ${categoryDenotation}`;
    const smallOpt: Record<string, string> = { H: 'Amazon Rainforest', A: 'South America' };
    const smallAll = Object.keys(smallOpt);
    global.fetch = queuedFetch([JSON.stringify({
      kinds: [
        { name: 'Amazon Rainforest', kind: 'biome', span: categorySpan },
        { name: 'South America', kind: 'legitimate world region', span: categoryDenotation },
      ],
      category_kind: 'legitimate world region',
      category_kind_span: categoryDenotation,
      stated_in_passage: true,
    })]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, smallAll, smallOpt, note,
        () => [owned(passage)], PROPERTY,
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

describe('D-BP153-019 TEST 3: a genuine, complete stated-kind accounting is trusted end to end', () => {
  test('"South America, Europe, and South Asia are world regions; the rest are not" -- a COMPLETE accounting is trusted, not rejected', async () => {
    const originalFetch = global.fetch;
    const includedSpan = 'South America, Europe, and South Asia are each a "legitimate world region", the '
      + 'proper denotation of a world region;';
    const excludedSpan = 'the Sahara Desert, North Africa, Northeast United States, Central Asia, the Arctic '
      + 'Circle, and Amazon Rainforest are each "not a legitimate world region".';
    const passage = `${includedSpan} ${excludedSpan}`;
    global.fetch = queuedFetch([JSON.stringify({
      kinds: [
        { name: 'South America', kind: 'legitimate world region', span: includedSpan },
        { name: 'Europe', kind: 'legitimate world region', span: includedSpan },
        { name: 'South Asia', kind: 'legitimate world region', span: includedSpan },
        { name: 'Sahara Desert', kind: 'not a legitimate world region', span: excludedSpan },
        { name: 'North Africa', kind: 'not a legitimate world region', span: excludedSpan },
        { name: 'Northeast United States', kind: 'not a legitimate world region', span: excludedSpan },
        { name: 'Central Asia', kind: 'not a legitimate world region', span: excludedSpan },
        { name: 'Arctic Circle', kind: 'not a legitimate world region', span: excludedSpan },
        { name: 'Amazon Rainforest', kind: 'not a legitimate world region', span: excludedSpan },
      ],
      category_kind: 'legitimate world region',
      category_kind_span: includedSpan,
      stated_in_passage: true,
    })]);
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
      expect(frame.included).toEqual(expect.arrayContaining(['A', 'E', 'B']));
      expect(new Set(frame.excluded)).toEqual(new Set(['I', 'C', 'D', 'F', 'G', 'H']));
      expect(log.some((l) => /discarded/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-019 TEST 4, RESTATED FOR D-BP153-032: a partial stated-kind accounting establishes only what was stated, never the rest', () => {
  // D-BP153-023/D-BP153-026 UPDATE, RECORDED HERE EXPLICITLY. An owned passage stating a kind for
  // only THREE of nine options is INCOMPLETE (the identical D-BP153-023 rule, restated for the
  // stated-kind shape) -- falls through to a fresh query, then its own ONE completion follow-up
  // (D-BP153-026), both of which find nothing new here (the source only ever discusses B, D, E).
  test('the source states a kind for only three of nine -- INCOMPLETE, falls through to a fresh query and its one completion follow-up; the six unaccounted options are never guessed', async () => {
    const originalFetch = global.fetch;
    const passage = 'B (South Asia), D (Northeast United States), and E (Europe) are each a "legitimate '
      + 'world region", the proper denotation of a world region.';
    const response = JSON.stringify({
      kinds: [
        { name: 'South Asia', kind: 'legitimate world region', span: passage },
        { name: 'Northeast United States', kind: 'legitimate world region', span: passage },
        { name: 'Europe', kind: 'legitimate world region', span: passage },
      ],
      category_kind: 'legitimate world region',
      category_kind_span: passage,
      stated_in_passage: true,
    });
    global.fetch = queuedFetch([
      response, // owned passage attempt -- incomplete, falls through
      response, // fresh query -- the SAME source, still incomplete
      response, // D-BP153-026's own one completion follow-up -- still nothing new
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(passage)], PROPERTY,
      );
      // TWO queries: the main fresh query plus D-BP153-026's own one completion follow-up -- the
      // owned-passage attempt itself never calls askGoogle.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.some((l) => /INCOMPLETE on owned passage/.test(l) && /D-BP153-023/.test(l) && /falling through/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(true);
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      // The three stated members are reflected; the six unaccounted options are never guessed
      // excluded (D-BP153-032's per-option rule, never an "all minus what was named" inference).
      expect(frame.included).toEqual(expect.arrayContaining(['B', 'D', 'E']));
      expect(frame.excluded).toEqual([]);
      expect(frame.partitionComplete).toBe(false);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /UNACCOUNTED/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
