// classify_cascade.owned_evidence_frame.test.ts -- D-BP153-011/BISHOP/seg-frame-consults-owned-
// evidence-first, UPDATED D-BP153-016 (typed passages, verify-the-span), UPDATED D-BP153-032
// (stated-kind extraction shape)
//
// THE RULING THIS TESTS (FD-BP153-04, RULINGS_BP153.md, Founder, verbatim): "Before a step issues
// a new query, it must first try to answer that query by EXTRACTING from passages this run has
// already acquired. A new query is spent only when the owned evidence does not contain the
// answer."
//
// D-BP153-032, RESHAPED. THE SOFTBALLS (establishFrame(), QUESTION 1) no longer extract a direct/
// complement exclusion pair (frameExtractionInstruction()/frameComplementExtractionInstruction(),
// RETIRED, along with extractFrameBothSides()) -- they extract a STATED KIND per option plus a
// STATED category denotation (extractFrameKinds(), reusing STAGE D's own extractDiscriminatorKinds()
// unmodified), then compare the two IN PURE CODE (applyFrameKindElimination()). See
// classify_cascade.ts's own D-BP153-032 section header for the full ruling and the measured
// variance it closes. Every fixture below is rewritten against that shape. The OWNED-EVIDENCE-FIRST
// CONTRACT itself (FD-BP153-04) is UNCHANGED by this ticket and is what this file still proves:
// establishFrame() tries every usable owned passage before spending a query, in order, and a
// passage that does not FULLY account for every option's kind is INCOMPLETE (D-BP153-023, restated
// for the stated-kind shape) and falls through, exactly as an incomplete direct/complement
// partition used to.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: pinning LB_DRAW_REPEATS=1 keeps every call-count assertion in this
// file valid -- the repeated-draw wrapper only wraps the FRESH-QUERY path, and the channel-variance
// behavior itself is covered by classify_cascade.repeated_draws.test.ts, not here.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });
import { establishFrame } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

// qid 98's option letters, same fixture classify_cascade.frame.test.ts already uses.
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
const CATEGORY_KIND = 'legitimate world region';
const OTHER_KIND = 'not a legitimate world region';

// D-BP153-016: wraps a bare passage string as an OwnedPassage of kind 'operation' -- the same kind
// liana_terminal_engine.ts tags the operation query's own passage with, and a kind establishFrame()
// accepts (only 'ambiguity' is rejected, per FD-BP153-07 FIX 1).
const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

/** D-BP153-032: builds a COMPLETE, all-nine-options stated-kind passage + reply. Every option in
 *  `excludedLetters` is described (in the passage text itself, literally, so span verification
 *  actually passes) as `OTHER_KIND`; every other option is described as `CATEGORY_KIND`; and the
 *  category is stated to denote `CATEGORY_KIND`. This lets establishFrame() terminate at a SINGLE
 *  owned passage with no fall-through, isolating the ONE behavior each of this file's tests is
 *  actually about (owned-evidence-first, span verification, empty/off-topic passage rejection) from
 *  D-BP153-023's own separate incomplete-coverage fall-through (covered by its own dedicated
 *  sibling, classify_cascade.incomplete_partition_falls_through.test.ts). Returns both the PASSAGE
 *  (to hand to askGoogle/`owned()`) and the RESPONSE (to queue as the mocked gemmaExtract() reply)
 *  so the two can never drift out of sync with each other. */
function fullCoverage(excludedLetters: string[], introText: string): { passage: string; response: string } {
  const includedLetters = ALL.filter((L) => !excludedLetters.includes(L));
  const excludedClause = excludedLetters.length
    ? `${excludedLetters.map((L) => OPT[L]).join(', ')} ${excludedLetters.length > 1 ? 'are each' : 'is'} "${OTHER_KIND}".`
    : '';
  const includedClause = includedLetters.length
    ? `${includedLetters.map((L) => OPT[L]).join(', ')} ${includedLetters.length > 1 ? 'are each' : 'is'} "${CATEGORY_KIND}".`
    : '';
  const passage = `${introText} ${excludedClause} ${includedClause} A world region properly denotes a "${CATEGORY_KIND}".`;
  const response = JSON.stringify({
    kinds: ALL.map((L) => ({ name: OPT[L], kind: excludedLetters.includes(L) ? OTHER_KIND : CATEGORY_KIND, span: passage })),
    category_kind: CATEGORY_KIND,
    category_kind_span: passage,
    stated_in_passage: true,
  });
  return { passage, response };
}

/** Queues canned Ollama /api/generate JSON responses -- gemmaExtract() posts one prompt per call
 *  and this hands back the next queued `response` string in order. Throws if the queue runs out. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

/** Returns the SAME canned reply for every call -- used where the exact number of gemmaExtract()
 *  calls is not the point of the test (e.g. a hallucinated/unverifiable value that is discarded on
 *  every attempt, never just once by chance). */
function staticFetch(response: string): typeof fetch {
  return vi.fn(async () => ({ json: async () => ({ response }) })) as unknown as typeof fetch;
}

describe('FD-BP153-04: establishFrame() consults owned evidence BEFORE issuing a new query', () => {
  test('an owned passage stating a complete accounting answers the frame with ZERO queries issued', async () => {
    const originalFetch = global.fetch;
    const { passage, response } = fullCoverage(
      ['A', 'C', 'F', 'G', 'H', 'I'],
      "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), H (Amazon "
        + "Rainforest), and I (Sahara Desert) are all NOT considered among the world's most densely "
        + 'populated regions.',
    );
    global.fetch = queuedFetch([response]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );

      expect(askGoogle).not.toHaveBeenCalled(); // THE POINT OF THE RULING: no new query issued
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.ownedPassageIndex).toBe(0);
      expect(new Set(frame.excluded)).toEqual(new Set(['A', 'C', 'F', 'G', 'H', 'I']));
      expect(frame.partitionComplete).toBe(true);

      // THE RECEIPT SAYS WHICH -- the transcript must name the source, not just carry a typed field
      // no reader will see live.
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l) && /passage 1 of 1/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('absent ownedPassages (no accessor at all) falls through to the query path, unchanged from before this ticket', async () => {
    const originalFetch = global.fetch;
    const { passage, response } = fullCoverage(['G'], 'Arctic Circle is a climatic zone, not a world region.');
    global.fetch = queuedFetch([response]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      // No sixth argument at all -- the exact call shape every pre-existing call site (before this
      // ticket) used.
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      expect(askGoogle).toHaveBeenCalledTimes(1); // ONE query answers it completely -- no follow-up needed
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.ownedPassageIndex).toBeNull();
      expect(new Set(frame.excluded)).toEqual(new Set(['G']));
      expect(frame.partitionComplete).toBe(true);
      expect(log.some((l) => /FROM A NEW QUERY/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('empty ownedPassages() (Survey ran but acquired nothing usable) falls through to the query path identically', async () => {
    const originalFetch = global.fetch;
    const { passage, response } = fullCoverage(['G'], 'Arctic Circle is a climatic zone, not a world region.');
    global.fetch = queuedFetch([response]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note } = notes();
      const frameWithEmptyAccessor = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [],
      );
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(frameWithEmptyAccessor.answeredFrom).toBe('new-query');
      expect(new Set(frameWithEmptyAccessor.excluded)).toEqual(new Set(['G']));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('owned passages that are empty/whitespace-only are never sent to extraction -- D-BP153-010 extends to owned evidence', async () => {
    const originalFetch = global.fetch;
    const { passage, response } = fullCoverage(['G'], 'The Arctic Circle is a polar climatic zone, not a world region.');
    global.fetch = queuedFetch([
      // Only ONE response queued -- if the empty/whitespace passages were (wrongly) sent to
      // gemmaExtract() too, queuedFetch() throws on the second/third call and the test fails loudly
      // rather than silently passing.
      response,
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached -- the real owned passage answers it' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY,
        ALL,
        OPT,
        note,
        () => [owned(''), owned('   \n  '), owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      // The real passage was the THIRD element, but the first index the extractor actually tried
      // (empty ones filtered out before extraction) -- so its own index within the filtered array.
      expect(frame.ownedPassageIndex).toBe(0);
      expect(new Set(frame.excluded)).toEqual(new Set(['G']));
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('a stated kind whose span never actually mentions that option is discarded, never trusted', async () => {
    const originalFetch = global.fetch;
    // A complete, otherwise-valid accounting for eight options -- but the model's own JSON also
    // hallucinates a KIND for Europe, whose ONLY offered span is real passage text that never
    // actually mentions "Europe" at all (D-BP153-016 FIX 2: the option's own NAME must appear in
    // the passage, not merely the span). The SAME reply is returned on every call (staticFetch)
    // because the hallucination is not a one-off -- it recurs on the fresh query and the
    // D-BP153-026 follow-up too, exactly as a genuinely absent fact would, so Europe stays
    // UNACCOUNTED rather than ever being wrongly excluded or included.
    const EUROPELESS_ALL = ALL.filter((L) => L !== 'E');
    const EUROPELESS_OPT: Record<string, string> = { ...OPT };
    delete EUROPELESS_OPT.E;
    const includedLetters = EUROPELESS_ALL.filter((L) => L !== 'G');
    const passage = `The Arctic Circle is a polar climatic zone, not a world region. ${includedLetters.map((L) => OPT[L]).join(', ')} `
      + `are each "${CATEGORY_KIND}". Arctic Circle is "${OTHER_KIND}". A world region properly denotes a "${CATEGORY_KIND}".`;
    const hallucinatedResponse = JSON.stringify({
      kinds: [
        ...EUROPELESS_ALL.map((L) => ({ name: OPT[L], kind: L === 'G' ? OTHER_KIND : CATEGORY_KIND, span: passage })),
        { name: 'Europe', kind: CATEGORY_KIND, span: passage }, // hallucinated: "Europe" never appears in `passage`
      ],
      category_kind: CATEGORY_KIND,
      category_kind_span: passage,
      stated_in_passage: true,
    });
    global.fetch = staticFetch(hallucinatedResponse);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );
      // Europe (E)'s "kind" never verifies (its own name is absent from the passage) -- discarded on
      // every attempt, so it is never trusted as included OR excluded. G's own, genuinely-stated
      // kind survives.
      expect(frame.excluded).toContain('G');
      expect(frame.excluded).not.toContain('E');
      expect(frame.included).not.toContain('E');
      expect(log.some((l) => /discarded \d+ value/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('an owned passage that yields NOTHING extractable is inconclusive, not "excluded nothing" -- tries the next passage, then the query path', async () => {
    const originalFetch = global.fetch;
    // First owned passage is real text but never mentions ANY option at all -- D-BP153-016 FIX 3
    // rejects it mechanically, before extraction is even attempted (it cannot source a claim about
    // options it never names). A second owned passage DOES contain a complete accounting.
    const offTopicPassage = 'Population density is measured in people per square kilometer worldwide.';
    const { passage: onTopicPassage, response } = fullCoverage(
      ['I'], 'The Sahara Desert is a desert biome, not a world region.',
    );
    global.fetch = queuedFetch([response]); // passage 2: answers it
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached -- passage 2 answers it' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
        () => [owned(offTopicPassage), owned(onTopicPassage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      // offTopicPassage was REJECTED mechanically (FIX 3, names no option) before ever reaching
      // extraction -- onTopicPassage is the only one tried, so its index in the FILTERED array is 0.
      expect(frame.ownedPassageIndex).toBe(0);
      expect(new Set(frame.excluded)).toEqual(new Set(['I']));
      expect(log.some((l) => /REJECTED an owned passage/.test(l) && /FIX 3/.test(l))).toBe(true);
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l) && /passage 1 of 1/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('NONE of the owned passages contain the answer -- falls through to the query path, and the query still runs exactly as before', async () => {
    const originalFetch = global.fetch;
    // Neither passage mentions ANY option -- both are REJECTED mechanically (FIX 3), so this run's
    // owned evidence contributes ZERO gemmaExtract() calls, and falls straight to the fresh query.
    const offTopicPassage1 = 'Population density is measured in people per square kilometer worldwide.';
    const offTopicPassage2 = 'The question asks about geographic classification generally.';
    const { passage: freshPassage, response } = fullCoverage(['G'], 'Arctic Circle is a climatic zone, not a world region.');
    global.fetch = queuedFetch([response]); // the fresh query, answering completely -- no follow-up needed
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
        () => [owned(offTopicPassage1), owned(offTopicPassage2)],
      );
      expect(askGoogle).toHaveBeenCalledTimes(1); // owned evidence was tried FIRST, but both rejected; ONE fresh query
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.ownedPassageIndex).toBeNull();
      expect(new Set(frame.excluded)).toEqual(new Set(['G']));
      expect(log.filter((l) => /REJECTED an owned passage/.test(l) && /FIX 3/.test(l)).length).toBe(2);
      expect(log.some((l) => /FROM A NEW QUERY/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // D-BP153-014/BISHOP/seg-classify-recall-fix, BUG-2. establishFrame()'s own D-BP153-010 fix
  // (dc94891e) -- an EMPTY passage from a fresh query is UNAVAILABLE, never "excluded nothing".
  // UNTOUCHED by D-BP153-032: this guard fires before extraction is even attempted, on the raw
  // googleBlocks() text, the same choke point every draw already used.
  test('D-BP153-014 BUG-2 regression: an EMPTY passage from a fresh query is UNAVAILABLE, never "excluded nothing" -- establishFrame() end to end', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([]); // must not even be reached -- the guard fires before gemmaExtract()
    // Same reproduction classify_cascade.membership_terminator.test.ts's own D-BP153-010 mirror
    // uses: an organic result with empty title/snippet makes googleBlocks() return ok:true with a
    // blank-after-trim `text` in ONE attempt (no retry backoff needed here).
    const askGoogle = vi.fn(async () => ({ results: [{ title: '', snippet: '' }] }));
    try {
      const { note } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);
      expect(frame.available).toBe(false);
      expect(frame.excluded).toEqual([]);
      expect(frame.via).toMatch(/empty passage/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
