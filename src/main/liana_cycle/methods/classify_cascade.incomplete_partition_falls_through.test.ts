// classify_cascade.incomplete_partition_falls_through.test.ts -- D-BP153-023/BISHOP/seg-classify-023
// UPDATED D-BP153-032/BISHOP/seg-classify-032 (stated-kind extraction shape)
//
// THE MEASURED FAILURE (live run, receipt LIANA_RUN_qid98_2026-08-13T02-05-04-911Z.json). The frame
// extracted the biomes correctly for the first time, from an owned passage, and then STOPPED --
// answered from owned evidence with an incomplete accounting rather than falling through.
//
// ROOT CAUSE: owned-evidence-first (FD-BP153-04) consulted an owned passage, got a PARTIAL answer,
// the completeness rule correctly rejected it, and the question then TERMINATED right there --
// without ever issuing the fresh query D-BP153-021 reworded specifically to force a complete
// accounting.
//
// THE RULE UNDER TEST: INCOMPLETE IS NOT ANSWERED. An owned passage that yields an INCOMPLETE
// accounting has NOT answered the question, and the step must fall through to the next owned
// passage, and then to the fresh query.
//
// D-BP153-032, RESHAPED. THE SOFTBALLS (establishFrame(), QUESTION 1) no longer extract a direct/
// complement exclusion pair -- they extract a STATED KIND per option plus a stated category
// denotation (extractFrameKinds()/applyFrameKindElimination(), classify_cascade.ts). "INCOMPLETE"
// now means "some option(s) have no stated kind" (missingKind, establishFrame()'s own owned-passage
// loop) -- the identical D-BP153-023 rule, restated for the new shape: a passage that leaves any
// option's kind unaccounted for has NOT fully answered THE SOFTBALLS and falls through, exactly as
// an incomplete direct/complement partition used to. Every fixture below is rewritten against that
// shape; the underlying fall-through CONTRACT is unchanged.
//
// SCOPE: this file exercises establishFrame() (QUESTION 1, THE SOFTBALLS) directly -- the exact
// shape the live bug measured.

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
import { establishFrame } from './classify_cascade';
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
const REGION_KIND = 'continental or subcontinental world region';
const COLLOQUIAL_KIND = 'colloquial geographic area';
const BIOME_KIND = 'biome';

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

// The exact live shape (biomes stated, three of nine stated as regions, six unaccounted for: A, C, D
// never get a stated kind, and no categoryKind is stated either).
const INCOMPLETE_PASSAGE = 'G (Arctic Circle), H (Amazon Rainforest), and I (Sahara Desert) represent the '
  + 'extreme sparsely populated biomes, not world regions. B (South Asia), E (Europe), and F (Central '
  + `Asia) are each classified as a "${REGION_KIND}", the proper denotation of a world region.`;
const INCOMPLETE_RESPONSE = JSON.stringify({
  kinds: [
    { name: 'South Asia', kind: REGION_KIND, span: INCOMPLETE_PASSAGE },
    { name: 'Europe', kind: REGION_KIND, span: INCOMPLETE_PASSAGE },
    { name: 'Central Asia', kind: REGION_KIND, span: INCOMPLETE_PASSAGE },
    { name: 'Arctic Circle', kind: BIOME_KIND, span: INCOMPLETE_PASSAGE },
    { name: 'Amazon Rainforest', kind: BIOME_KIND, span: INCOMPLETE_PASSAGE },
    { name: 'Sahara Desert', kind: BIOME_KIND, span: INCOMPLETE_PASSAGE },
  ],
  category_kind: REGION_KIND,
  category_kind_span: INCOMPLETE_PASSAGE,
  stated_in_passage: true,
});

/** A COMPLETE, all-nine stated-kind passage + reply -- excludes exactly `excludedLetters`. */
function fullCoverage(excludedLetters: string[], span: string): string {
  return JSON.stringify({
    kinds: ALL.map((L) => ({
      name: OPT[L],
      kind: excludedLetters.includes(L) ? (['C', 'F'].includes(L) ? COLLOQUIAL_KIND : BIOME_KIND) : REGION_KIND,
      span,
    })),
    category_kind: REGION_KIND,
    category_kind_span: span,
    stated_in_passage: true,
  });
}

describe('TEST 1 (HEADLINE): an owned passage yielding an INCOMPLETE stated-kind accounting falls through to a fresh query that returns a COMPLETE one', () => {
  test('the fresh query IS issued, and its complete answer is used -- not the zero-exclusion, zero-query termination the live bug produced', async () => {
    const originalFetch = global.fetch;
    // A source obeying D-BP153-021/D-BP153-032's reworded query: a stated classification for every
    // one of the nine options, PLUS a stated category denotation -- the SAME shape
    // classify_cascade.frame_query_full_accounting.test.ts's own TEST 2 already proves
    // establishFrame()'s fresh-query path can consume.
    const completePassage = 'South America, South Asia, Northeast United States, and Europe are each '
      + `classified as a "${REGION_KIND}" -- the proper denotation of a world region. North Africa and `
      + `Central Asia are classified as a "${COLLOQUIAL_KIND}", not world regions. Arctic Circle, Amazon `
      + `Rainforest, and Sahara Desert are each classified as a "${BIOME_KIND}", not world regions.`;
    global.fetch = queuedFetch([
      // Owned passage: states kinds for B, E, F (region) and G, H, I (biome) -- A, C, D never get a
      // stated kind. INCOMPLETE.
      INCOMPLETE_RESPONSE,
      // The fresh query (D-BP153-023's own fall-through): a COMPLETE accounting of all nine.
      fullCoverage(['C', 'F', 'G', 'H', 'I'], completePassage),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: completePassage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(INCOMPLETE_PASSAGE)],
      );

      // THE HEADLINE ASSERTION: askGoogle WAS called -- the live bug never called it at all.
      expect(askGoogle).toHaveBeenCalledTimes(1);
      // The transcript names WHY: the owned passage's own INCOMPLETE accounting, and that the step
      // is falling through, not silently stopping.
      expect(log.some((l) => /INCOMPLETE on owned passage 1 of 1/.test(l) && /D-BP153-023/.test(l))).toBe(true);
      expect(log.some((l) => l.includes('INCOMPLETE on owned passage') && /falling through to a fresh query/.test(l))).toBe(true);
      // The COMPLETE fresh-query answer is what is actually used -- not the empty/zero-exclusion
      // reading the live bug published.
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['C', 'F', 'G', 'H', 'I']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 2: an owned passage yielding a COMPLETE stated-kind accounting still costs ZERO queries (owned-evidence-first intact)', () => {
  test('a passage stating a complete accounting on the first try answers from owned evidence, no fall-through, no query', async () => {
    const originalFetch = global.fetch;
    const passage = `Arctic Circle, Amazon Rainforest, and Sahara Desert are each a "${BIOME_KIND}", not `
      + `world regions. South America, South Asia, North Africa, Northeast United States, Europe, and `
      + `Central Asia are each a "${REGION_KIND}", the proper denotation of a world region.`;
    global.fetch = queuedFetch([fullCoverage(['G', 'H', 'I'], passage)]);
    const askGoogle = vi.fn(async () => { throw new Error('must never be called -- the owned passage is complete'); });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['G', 'H', 'I']));
      // No fall-through note -- this passage answered on the first try.
      expect(log.some((l) => /INCOMPLETE on owned passage/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 3: two owned passages, first INCOMPLETE, second COMPLETE -- the second is used, still ZERO queries', () => {
  test('falls through from the first (incomplete) owned passage to the second (complete) one, never reaching the query path', async () => {
    const originalFetch = global.fetch;
    const completePassage = `Arctic Circle, Amazon Rainforest, and Sahara Desert are each a "${BIOME_KIND}", `
      + `not world regions. South America, South Asia, North Africa, Northeast United States, Europe, `
      + `and Central Asia are each a "${REGION_KIND}", the proper denotation of a world region.`;
    global.fetch = queuedFetch([
      // Passage 1: INCOMPLETE_PASSAGE -- states B, E, F, G, H, I; A, C, D unaccounted for, falls
      // through.
      INCOMPLETE_RESPONSE,
      // Passage 2: a COMPLETE accounting -- answers.
      fullCoverage(['G', 'H', 'I'], completePassage),
    ]);
    const askGoogle = vi.fn(async () => { throw new Error('must never be called -- the second owned passage is complete'); });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(INCOMPLETE_PASSAGE), owned(completePassage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(log.some((l) => /INCOMPLETE on owned passage 1 of 2/.test(l) && /falling through to the next owned passage/.test(l))).toBe(true);
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.ownedPassageIndex).toBe(1); // the SECOND passage answered, not the first
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['G', 'H', 'I']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 4: owned INCOMPLETE and the fresh query is ALSO incomplete -- the safety net is unchanged', () => {
  // D-BP153-026: a fresh query that comes back INCOMPLETE spends exactly ONE targeted follow-up
  // naming only the still-unaccounted options before giving up -- here that follow-up (askGoogle's
  // mocked response is the SAME passage every call, which never mentions any of the seven still-
  // unaccounted options) finds nothing new, so the safety net's own OUTCOME (zero exclusions among
  // the unaccounted, the rest named) is unchanged, but the query count is 2, not 1.
  test('zero exclusions trusted among the unaccounted, the unaccounted-for options are named, the run proceeds -- never a further fall-through past the one fresh query PLUS its one completion follow-up', async () => {
    const originalFetch = global.fetch;
    const freshText = 'South America and Europe are legitimate world regions.';
    global.fetch = queuedFetch([
      INCOMPLETE_RESPONSE,
      // The fresh query ALSO comes back incomplete -- only two of nine options named, both given
      // the SAME self-referential kind as the category itself (available, but seven unaccounted).
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'world region', span: freshText },
          { name: 'Europe', kind: 'world region', span: freshText },
        ],
        category_kind: 'world region',
        category_kind_span: freshText,
        stated_in_passage: true,
      }),
      // D-BP153-026's own ONE follow-up never reaches extraction here: askGoogle's mock always
      // returns the SAME passage, which names none of the seven still-unaccounted options, so the
      // follow-up is abandoned by its own passageMentionsAnyLabel() guard before gemmaExtract() is
      // ever called again -- no further queued responses are consumed.
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshText }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(INCOMPLETE_PASSAGE)],
      );
      // TWO queries: the main fresh query, plus D-BP153-026's own ONE completion follow-up -- never
      // a THIRD attempt, and never one query per missing option.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.available).toBe(true); // a category kind WAS stated -- answered, zero exclusions among the unaccounted
      expect(frame.excluded).toEqual([]);
      expect(frame.partitionComplete).toBe(false);
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME FOLLOW-UP: the source's passage.*names NONE/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /UNACCOUNTED/.test(l))).toBe(true);
      // The unaccounted-for options from the FRESH query's own incomplete reconciliation are named.
      for (const optLetter of ['B', 'C', 'D', 'F', 'G', 'H', 'I']) {
        expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && l.includes(`${optLetter}) ${OPT[optLetter]}`))).toBe(true);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 5: the fall-through note names the unaccounted-for options, not just "incomplete"', () => {
  test('the transcript line for the rejected owned passage names each option that never got a stated kind', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      INCOMPLETE_RESPONSE,
      // Fresh query: also unavailable (challengeDetected short-circuits with zero retries) -- this
      // test only needs the OWNED passage's own fall-through note, not a second answer.
    ]);
    const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
    try {
      const { note, log } = notes();
      await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(INCOMPLETE_PASSAGE)],
      );
      // B, E, F (region) and G, H, I (biome) got a stated kind -- A, C, and D are the three
      // genuinely unaccounted-for options, and the note must name all three.
      const fallThroughLine = log.find((l) => l.includes('INCOMPLETE on owned passage'));
      expect(fallThroughLine).toBeDefined();
      for (const optLetter of ['A', 'C', 'D']) {
        expect(fallThroughLine).toContain(`${optLetter}) ${OPT[optLetter]}`);
      }
      expect(fallThroughLine).toMatch(/falling through to a fresh query/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
