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
// THE FIX (this ticket): reword the query establishFrame() sends on the FRESH-QUERY path (the
// query used ONLY when no owned passage already answers THE SOFTBALLS -- see establishFrame() in
// classify_cascade.ts) so it FORCES an accounting of EVERY option, in ONE query -- never a fan-out
// to one query per option (Founder, BP151: "we got rid of four answers with ONE google search").
// The wording now asks what each option IS (its stated classification), never whether it "is or is
// not" the category -- that framing is what invited the partial list, and it is also exactly the
// property/category conflation D-BP153-018 already guards against.
//
// WHAT THIS FILE DOES NOT TOUCH. reconcileNamedSet(), discardPropertyContaminatedSpans(),
// extractFrameBothSides(), and the two extraction instructions (frameExtractionInstruction() /
// frameComplementExtractionInstruction()) are all UNCHANGED by this ticket -- TEST 2 and TEST 3
// below exist to prove the safety net (D-BP153-020's complete-partition requirement) still holds
// exactly as before, over the NEW query's own fresh-query code path.

import { describe, test, expect, vi } from 'vitest';
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

describe('D-BP153-021 TEST 1 (HEADLINE): the composed FRAME query forces an accounting of every option', () => {
  test('the query contains every option letter+label and an explicit demand to answer for each/all', async () => {
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
    // An explicit, structural demand to answer for EVERY option -- not merely a two-part
    // is/is-not ask a source can satisfy with two examples.
    expect(frame.query).toMatch(/answer for every one/i);
    expect(frame.query).toMatch(/do not skip any/i);
    // The old two-part "is or is not" framing is gone as the query's OWN demand shape -- it may
    // still be named once, structurally, as what NOT to merely answer (see the code's own comment),
    // but the query must not repeat the old bare "which of these are X, and which of them are not
    // X" sentence that invited a two-example answer.
    expect(frame.query).not.toMatch(/^Which of these are/);
  });
});

describe('D-BP153-021 TEST 2: a source that states a kind for ALL nine options -> complete partition -> exclusions trusted', () => {
  test('fresh-query path, full accounting -> trusted exclusion set, exactly ONE query issued', async () => {
    const originalFetch = global.fetch;
    // A source obeying the new wording: a stated classification for every one of the nine options.
    const passage = 'South America, South Asia, Northeast United States, and Europe are each classified as '
      + 'continental or subcontinental world regions. North Africa and Central Asia are classified as '
      + 'colloquial geographic areas, not world regions. Arctic Circle, Amazon Rainforest, and Sahara '
      + 'Desert are each classified as biomes, not world regions.';
    global.fetch = queuedFetch([
      // Direct (NOT category): the five non-regions.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
      // Complement (IS category): the remaining four -- together the two sides name all nine.
      JSON.stringify({
        members: ['South America', 'South Asia', 'Northeast United States', 'Europe']
          .map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
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
      expect(frame.conflicts).toEqual([]);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /complete partition/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-021 TEST 3: a source that only answers for two of nine -> STILL rejected (the safety net is unchanged)', () => {
  test('fresh-query path, partial answer -> zero exclusions trusted despite the new wording demanding all', async () => {
    const originalFetch = global.fetch;
    // A source that, despite the new wording's explicit demand, still only names two of nine --
    // the exact live-bug shape (LIANA_RUN_qid98_2026-08-13T01-30-04-993Z.json). D-BP153-020's
    // complete-partition gate must still catch this; this ticket never touches that gate.
    const passage = 'South America and Europe are classified as legitimate world regions.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      JSON.stringify({
        members: ['South America', 'Europe'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      expect(askGoogle).toHaveBeenCalledTimes(1); // ONE query, even though the answer was partial
      expect(frame.available).toBe(true); // answered -- with zero exclusions, a legitimate outcome
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.partitionComplete).toBe(false);
      expect(frame.excluded).toEqual([]); // trusts nothing -- the safety net, unchanged
      expect(frame.included).toEqual(expect.arrayContaining(['A', 'E']));
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /INCOMPLETE PARTITION/.test(l))).toBe(true);
      for (const opt of ['B', 'C', 'D', 'F', 'G', 'H', 'I']) {
        expect(log.some((l) => l.includes('INCOMPLETE PARTITION') && l.includes(`${opt}) ${OPT[opt]}`))).toBe(true);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});
