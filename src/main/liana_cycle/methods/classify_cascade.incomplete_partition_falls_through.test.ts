// classify_cascade.incomplete_partition_falls_through.test.ts -- D-BP153-023/BISHOP/seg-classify-023
//
// THE MEASURED FAILURE (live run, receipt LIANA_RUN_qid98_2026-08-13T02-05-04-911Z.json). The frame
// extracted the biomes correctly for the first time, from an owned passage, and then STOPPED:
//   FRAME: answered FROM OWNED EVIDENCE (passage 1 of 1, already acquired this run -- NO NEW QUERY
//          ISSUED) -- direct extraction excludes G) Arctic Circle, H) Amazon Rainforest,
//          I) Sahara Desert, complement states B) South Asia, E) Europe, F) Central Asia ...
//   FRAME RECONCILIATION: INCOMPLETE PARTITION -- members {G,H,I} and non-members {B,E,F} do NOT
//          together account for every option
//   FRAME: 9 of 9 option(s) remain in frame
// Same on the named set: members {B,D,E} + non-members {A,F} = 5 of 9, rejected as incomplete.
//
// ROOT CAUSE: owned-evidence-first (FD-BP153-04) consulted an owned passage, got a PARTIAL answer,
// the complete-partition rule (FD-BP153-07/D-BP153-020) correctly rejected it, and the question then
// TERMINATED right there -- without ever issuing the fresh query D-BP153-021 reworded specifically
// to force a complete accounting. That reworded query had therefore never run live.
//
// THE RULE UNDER TEST: INCOMPLETE IS NOT ANSWERED. An owned passage that yields an INCOMPLETE
// PARTITION has NOT answered the question, and the step must fall through to the next owned
// passage, and then to the fresh query -- reconciling FD-BP153-04 (consult owned evidence first,
// it's free) with FD-BP153-07 (a partial answer establishes nothing): consult owned evidence first;
// if what you own does not COMPLETELY answer, keep looking, and then ask properly.
//
// SCOPE: this file exercises establishFrame() (QUESTION 1, THE SOFTBALLS) directly -- the exact
// shape the live bug measured. extractNamedSetMembers() (QUESTION 2, THE NAMED SET) shares the
// SAME reconcileNamedSet() choke point and the identical gate shape; its own owned-passage-loop
// coverage lives in classify_cascade.named_set_recall.test.ts's own re-pinned HEADLINE test (D-BP153-023
// UPDATED) and classify_cascade.frame_complement_not_trusted_when_direct_discarded.test.ts's own
// TEST 4, both updated by this same ticket. runDiscriminator() (QUESTION 3)'s own equivalent
// completeness notion (a stated kind for EVERY candidate, not merely some) is covered in
// classify_cascade.discriminator.test.ts's own TEST 5/TEST 6.

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

// The exact live shape (biomes excluded, three of nine named as members, six unaccounted for).
const INCOMPLETE_PASSAGE = 'G (Arctic Circle), H (Amazon Rainforest), and I (Sahara Desert) represent the '
  + 'extreme sparsely populated biomes, not world regions. Only B (South Asia), E (Europe), and '
  + 'F (Central Asia) are named here as members.';

describe('TEST 1 (HEADLINE): an owned passage yielding an INCOMPLETE partition falls through to a fresh query that returns a COMPLETE one', () => {
  test('the fresh query IS issued, and its complete answer is used -- not the zero-exclusion, zero-query termination the live bug produced', async () => {
    const originalFetch = global.fetch;
    // A source obeying D-BP153-021's reworded query: a stated classification for every one of the
    // nine options -- the SAME shape classify_cascade.frame_query_full_accounting.test.ts's own
    // TEST 2 already proves establishFrame()'s fresh-query path can consume.
    const completePassage = 'South America, South Asia, Northeast United States, and Europe are each '
      + 'classified as continental or subcontinental world regions. North Africa and Central Asia are '
      + 'classified as colloquial geographic areas, not world regions. Arctic Circle, Amazon Rainforest, '
      + 'and Sahara Desert are each classified as biomes, not world regions.';
    global.fetch = queuedFetch([
      // Owned passage: direct excludes the three biomes {G,H,I}, complement names three as members
      // {B,E,F} -- union covers six of nine; A, C, and D are unaccounted for by EITHER extraction --
      // INCOMPLETE PARTITION.
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South Asia', 'Europe', 'Central Asia'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
      // The fresh query (D-BP153-023's own fall-through): a COMPLETE accounting of all nine.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: completePassage })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South America', 'South Asia', 'Northeast United States', 'Europe']
          .map((name) => ({ name, span: completePassage })),
        stated_in_passage: true,
      }),
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
      // The transcript names WHY: the owned passage's own INCOMPLETE PARTITION, and that the step is
      // falling through, not silently stopping.
      expect(log.some((l) => /INCOMPLETE PARTITION on owned passage 1 of 1/.test(l) && /D-BP153-023/.test(l))).toBe(true);
      expect(log.some((l) => l.includes('INCOMPLETE PARTITION on owned passage') && /falling through to a fresh query/.test(l))).toBe(true);
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

describe('TEST 2: an owned passage yielding a COMPLETE partition still costs ZERO queries (owned-evidence-first intact)', () => {
  test('a passage stating a complete partition on the first try answers from owned evidence, no fall-through, no query', async () => {
    const originalFetch = global.fetch;
    const passage = 'Arctic Circle, Amazon Rainforest, and Sahara Desert are biomes, not world regions. '
      + 'South America, South Asia, North Africa, Northeast United States, Europe, and Central Asia are '
      + 'all legitimate world regions.';
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
      expect(log.some((l) => /INCOMPLETE PARTITION on owned passage/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 3: two owned passages, first INCOMPLETE, second COMPLETE -- the second is used, still ZERO queries', () => {
  test('falls through from the first (incomplete) owned passage to the second (complete) one, never reaching the query path', async () => {
    const originalFetch = global.fetch;
    const completePassage = 'Arctic Circle, Amazon Rainforest, and Sahara Desert are biomes, not world regions. '
      + 'South America, South Asia, North Africa, Northeast United States, Europe, and Central Asia are '
      + 'all legitimate world regions.';
    global.fetch = queuedFetch([
      // Passage 1: INCOMPLETE_PASSAGE (defined above) -- direct excludes the three biomes, complement
      // names only THREE of nine as members -- six unaccounted for, falls through.
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South Asia', 'Europe', 'Central Asia'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
      // Passage 2: a COMPLETE partition -- answers.
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: completePassage })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South America', 'South Asia', 'North Africa', 'Northeast United States', 'Europe', 'Central Asia']
          .map((name) => ({ name, span: completePassage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => { throw new Error('must never be called -- the second owned passage is complete'); });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(INCOMPLETE_PASSAGE), owned(completePassage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(log.some((l) => /INCOMPLETE PARTITION on owned passage 1 of 2/.test(l) && /falling through to the next owned passage/.test(l))).toBe(true);
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
  // D-BP153-026 UPDATE, RECORDED HERE EXPLICITLY. Before this ticket, a fresh query that came back
  // INCOMPLETE was the final word -- "ONE query, never a second attempt." D-BP153-026 now spends
  // exactly ONE targeted follow-up naming only the still-unaccounted options before giving up --
  // here that follow-up (askGoogle's mocked response is the SAME passage every call, which never
  // mentions any of the seven still-unaccounted options) finds nothing new, so the safety net's own
  // OUTCOME is unchanged (zero exclusions, still-unaccounted options named) but the query count is
  // now 2, not 1: the main fresh query plus the one follow-up D-BP153-026 always issues when a
  // fresh query comes back incomplete.
  test('zero exclusions trusted, the unaccounted-for options are named, the run proceeds -- never a further fall-through past the one fresh query PLUS its one completion follow-up', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South Asia', 'Europe', 'Central Asia'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
      // The fresh query ALSO comes back incomplete -- only two of nine options named.
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      JSON.stringify({
        members: ['South America', 'Europe'].map((name) => ({ name, span: 'South America and Europe are legitimate world regions.' })),
        stated_in_passage: true,
      }),
      // D-BP153-026's own ONE follow-up never reaches extraction here: askGoogle's mock always
      // returns the SAME passage, which names none of the seven still-unaccounted options, so the
      // follow-up is abandoned by its own passageMentionsAnyLabel() guard before gemmaExtract() is
      // ever called again -- no further queued responses are consumed.
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America and Europe are legitimate world regions.' }));
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
      expect(frame.available).toBe(true); // answered -- with zero exclusions, a legitimate outcome
      expect(frame.excluded).toEqual([]);
      expect(frame.partitionComplete).toBe(false);
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME FOLLOW-UP: the source's passage.*names NONE/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /INCOMPLETE PARTITION/.test(l))).toBe(true);
      // The unaccounted-for options from the FRESH query's own incomplete reconciliation are named.
      for (const optLetter of ['B', 'C', 'D', 'F', 'G', 'H', 'I']) {
        expect(log.some((l) => l.includes('INCOMPLETE PARTITION') && l.includes(`${optLetter}) ${OPT[optLetter]}`))).toBe(true);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 5: the fall-through note names the unaccounted-for options, not just "incomplete"', () => {
  test('the transcript line for the rejected owned passage names each option neither extraction addressed', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South Asia', 'Europe', 'Central Asia'].map((name) => ({ name, span: INCOMPLETE_PASSAGE })),
        stated_in_passage: true,
      }),
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
      // members {G,H,I} (direct) union non-members {B,E,F} (complement) covers six of nine -- A, C,
      // and D are the three genuinely unaccounted-for options, and the note must name all three.
      const fallThroughLine = log.find((l) => l.includes('INCOMPLETE PARTITION on owned passage'));
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
