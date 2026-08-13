// classify_cascade.frame_query_full_accounting.test.ts -- D-BP153-021/BISHOP/seg-classify-021
//
// THE MEASURED FAILURE (live run, receipt LIANA_RUN_qid98_2026-08-13T01-30-04-993Z.json).
// D-BP153-020's complete-partition rule fired correctly and turned a false pass into an honest
// abstain:
//   FRAME: answered FROM A NEW QUERY -- direct extraction excludes (nothing), complement states
//          A) South America, E) Europe IS world regions
//   FRAME RECONCILIATION: INCOMPLETE PARTITION -- members {none} and non-members
//          {A) South America, E) Europe} do NOT together account for every option
//   FRAME: 9 of 9 option(s) remain in frame
//
// THE OLD QUESTION WAS THE PROBLEM. The old FRAME query asked "Which of these are ${category}, and
// which of them are not ${category}? For each one that is not, say so explicitly and say what it is
// instead." Asked that way, a source names a couple of examples and stops -- it did exactly that
// twice on real live runs. No downstream logic can repair an answer that never covered the field.
//
// THE FIX (this ticket): reword the query establishFrame() sends on the FRESH-QUERY path so it
// FORCES an accounting of EVERY option, in ONE query -- never a fan-out to one query per option
// (Founder, BP151: "we got rid of four answers with ONE google search").
//
// D-BP153-032, SUPERSEDING UPDATE, RECORDED HERE EXPLICITLY. THE MEASURED PROOF (D-BP153-032's own
// dispatch): the D-BP153-021 query above STILL asked "state exactly what it is", but the
// DOWNSTREAM EXTRACTION (frameExtractionInstruction()/frameComplementExtractionInstruction(),
// RETIRED) then asked the LOCAL MODEL to JUDGE whether each stated classification counted as
// `category` -- a judgment call that produced ~100% extraction variance on ~0% source variance
// (two draws of essentially identical text, "excludes all nine" vs "excludes three"). D-BP153-032's
// fix changes the query ONE MORE TIME (to match STAGE D's own query, dfe72680) to ALSO ask which
// stated kind properly denotes the category, and changes the DOWNSTREAM extraction to pure copying
// (extractFrameKinds(), reusing extractDiscriminatorKinds() unmodified) plus a PURE-CODE comparison
// (applyFrameKindElimination()) -- see classify_cascade.ts's own D-BP153-032 section header for the
// full ruling. TEST 1 (below) is rewritten against the query THIS ticket now sends; TESTS 2/3 are
// rewritten against the stated-kind extraction shape. reconcileNamedSet(),
// discardPropertyContaminatedSpans(), and the two RETIRED extraction instructions are UNCHANGED (the
// first two still serve THE NAMED SET; the RETIRED two no longer exist -- extractFrameBothSides()
// itself was removed by D-BP153-032, not merely superseded).

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
import type { MethodRunContext } from '../method_registry';

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

describe('D-BP153-021/D-BP153-032 TEST 1 (HEADLINE): the composed FRAME query forces an accounting of every option, AND asks what kind denotes the category', () => {
  test('the query contains every option letter+label, an explicit demand to answer for each/all, and a request for the category\'s own stated kind', async () => {
    // challengeDetected short-circuits googleBlocks() to ok:false on the FIRST attempt, no retry
    // sleeps -- this test only needs the COMPOSED query string, not a real answer.
    const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
    const { note } = notes();
    const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

    expect(askGoogle).toHaveBeenCalledTimes(1);
    expect(frame.available).toBe(false);

    // Every option letter and label appears in the composed query, in the SAME "L) label" shape
    // list(all, OPT) produces.
    for (const [L, label] of Object.entries(OPT)) {
      expect(frame.query).toContain(`${L}) ${label}`);
    }
    // D-BP153-032: the query now asks what KIND each option is (mirrors STAGE D's own query,
    // dfe72680) AND which of those kinds properly denotes the category -- never merely "is or is
    // not", the framing that invited a two-example answer and left no chance for a category
    // denotation to ever be stated at all.
    expect(frame.query).toMatch(/what kind of .*world regions.* is each of these/i);
    expect(frame.query).toMatch(/how do they differ from one another/i);
    expect(frame.query).toMatch(/which of those kinds properly denotes/i);
    expect(frame.query).not.toMatch(/^Which of these are/);
    expect(frame.query).not.toMatch(/is or is not/i);
  });
});

describe('D-BP153-032 TEST 2: a source that states a kind for ALL nine options AND the category denotation -> exclusions trusted', () => {
  test('fresh-query path, full accounting -> trusted exclusion set, exactly ONE query issued', async () => {
    const originalFetch = global.fetch;
    // A source obeying the new wording: a stated classification for every one of the nine options,
    // PLUS a stated denotation for the category itself.
    const passage = 'South America, South Asia, Northeast United States, and Europe are each classified as '
      + 'continental or subcontinental world regions -- the proper denotation of a world region. North '
      + 'Africa and Central Asia are classified as colloquial geographic areas, not world regions. Arctic '
      + 'Circle, Amazon Rainforest, and Sahara Desert are each classified as biomes, not world regions.';
    const REGION_KIND = 'continental or subcontinental world region';
    global.fetch = queuedFetch([JSON.stringify({
      kinds: [
        { name: 'South America', kind: REGION_KIND, span: passage },
        { name: 'South Asia', kind: REGION_KIND, span: passage },
        { name: 'Northeast United States', kind: REGION_KIND, span: passage },
        { name: 'Europe', kind: REGION_KIND, span: passage },
        { name: 'North Africa', kind: 'colloquial geographic area', span: passage },
        { name: 'Central Asia', kind: 'colloquial geographic area', span: passage },
        { name: 'Arctic Circle', kind: 'biome', span: passage },
        { name: 'Amazon Rainforest', kind: 'biome', span: passage },
        { name: 'Sahara Desert', kind: 'biome', span: passage },
      ],
      category_kind: REGION_KIND,
      category_kind_span: passage,
      stated_in_passage: true,
    })]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      expect(askGoogle).toHaveBeenCalledTimes(1); // ONE query for the frame, never one per option
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['C', 'F', 'G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'D', 'E']));
      expect(frame.conflicts).toEqual([]); // RETIRED shape (D-BP153-032): always empty from establishFrame() now
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /excludes/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-032 TEST 3: a source that only states a kind for two of nine -> the other seven stay UNACCOUNTED, never guessed', () => {
  // D-BP153-026, UNCHANGED BY D-BP153-032: an incomplete fresh query still spends exactly ONE
  // completion follow-up naming only the still-unaccounted options; askGoogle's mock here always
  // returns the SAME two-option passage regardless of query text, so the follow-up learns nothing
  // new -- the OUTCOME (zero exclusions from the seven unaccounted options) is unchanged from
  // D-BP153-021's own intent, restated for the stated-kind shape.
  test('fresh-query path, partial stated-kind coverage -> zero exclusions among the unaccounted seven, PLUS the one completion follow-up D-BP153-026 always spends on an incomplete fresh query', async () => {
    const originalFetch = global.fetch;
    // A source that, despite the new wording's explicit demand, still only states a kind for two of
    // nine -- the exact live-bug shape (LIANA_RUN_qid98_2026-08-13T01-30-04-993Z.json), restated:
    // both options are given the SAME self-referential kind as the category itself, which is enough
    // for applyFrameKindElimination() to include them, but says nothing about the other seven.
    const passage = 'South America and Europe are classified as legitimate world regions.';
    const kindsResponse = JSON.stringify({
      kinds: [
        { name: 'South America', kind: 'world region', span: passage },
        { name: 'Europe', kind: 'world region', span: passage },
      ],
      category_kind: 'world region',
      category_kind_span: passage,
      stated_in_passage: true,
    });
    global.fetch = queuedFetch([kindsResponse, kindsResponse]); // fresh query + D-BP153-026 follow-up, same reply both times
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // TWO queries: the main fresh query, plus D-BP153-026's own ONE completion follow-up.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(frame.available).toBe(true); // a category kind WAS stated -- answered, with zero exclusions among the unaccounted
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.partitionComplete).toBe(false); // seven options never got a stated kind
      expect(frame.excluded).toEqual([]); // trusts nothing that was never stated -- the safety net, unchanged
      expect(frame.included).toEqual(expect.arrayContaining(['A', 'E']));
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /UNACCOUNTED/.test(l))).toBe(true);
      for (const opt of ['B', 'C', 'D', 'F', 'G', 'H', 'I']) {
        expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && l.includes(`${opt}) ${OPT[opt]}`))).toBe(true);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});
