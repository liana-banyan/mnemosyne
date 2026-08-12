// classify_cascade.softballs_doublecheck_and_query_bill.test.ts -- D-BP153-017/BISHOP/seg-classify-017
//
// TICKET_D-BP153-017_THE_THREE_QUESTIONS.md, ITEMS 3 AND 4, tested directly against SOURCE (never
// dist), same offline convention every classify_cascade.*.test.ts sibling already uses: askGoogle
// is a local stub, global.fetch (gemmaExtract()'s own Ollama channel) is monkey-patched per test,
// nothing live anywhere in this file.
//
// ITEM 3 -- THE DOUBLECHECK, APPLIED TO THE SOFTBALLS. D-BP153-014 already built direct+complement
// reconciliation for THE NAMED SET (extractNamedSetMembers()); this ticket reuses that EXACT
// pattern (reconcileNamedSet(), unchanged) for establishFrame(). His own QC, FD-BP153-07, verbatim:
// "ask it both directions and require agreement." A disagreement is a FINDING, reported, never
// silently resolved.
//
// ITEM 4 -- THE QUERY BILL. At the end of a run, ONE note names: queries issued, how many of THE
// THREE QUESTIONS were answered from owned evidence, and that the denotation sweep was skipped.
// This file asserts the note's own numbers against the REAL mock call counts, not a second,
// independently-derived guess.

import { describe, test, expect, vi } from 'vitest';
import { establishFrame, runSuperlativeByMagnitude, extractSuperlativeMatch } from './classify_cascade';
import type { MethodRunContext, MethodQuestionInput, OwnedPassage } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

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

describe('D-BP153-017 ITEM 3: THE DOUBLECHECK applied to THE SOFTBALLS (establishFrame())', () => {
  test('direct and complement AGREE (a clean, conflict-free partition) -- the reconciled exclusion set is used, and the transcript names the reconciliation', async () => {
    const originalFetch = global.fetch;
    const passage = 'Arctic Circle, Amazon Rainforest, and Sahara Desert represent biomes, not world regions. '
      + 'South America, South Asia, North Africa, Northeast United States, Europe, and Central Asia are all '
      + 'recognized as legitimate world regions.';
    global.fetch = queuedFetch([
      // Direct (NOT category): the biomes.
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
      // Complement (IS category): the SAME six the direct side implicitly kept -- a clean partition.
      JSON.stringify({
        members: ['South America', 'South Asia', 'North Africa', 'Northeast United States', 'Europe', 'Central Asia']
          .map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F']));
      expect(frame.conflicts).toEqual([]);
      expect(frame.partitionComplete).toBe(true);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /complete partition/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('direct and complement CONFLICT (one name placed on BOTH sides) -- reported as a FINDING, never silently resolved; the direct exclusion is used unreconciled', async () => {
    const originalFetch = global.fetch;
    const passage = 'Arctic Circle represents a biome, not a world region. Arctic Circle is also recognized as '
      + 'a legitimate world region.';
    global.fetch = queuedFetch([
      // Direct (NOT category): G excluded.
      JSON.stringify({ not_members: [{ name: 'Arctic Circle', span: passage }], stated_in_passage: true }),
      // Complement (IS category): the SAME passage ALSO states G IS the category -- a genuine conflict.
      JSON.stringify({ members: [{ name: 'Arctic Circle', span: passage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.conflicts).toEqual(['G']);
      // Unresolved: falls back to the direct exclusion extraction rather than guessing which side is right.
      expect(frame.excluded).toEqual(['G']);
      expect(log.some((l) => /FRAME CONFLICT/.test(l) && /D-BP153-017/.test(l) && /G\) Arctic Circle/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /CONFLICT/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-017 ITEM 4: THE QUERY BILL', () => {
  const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
  const REAL_PASSAGE_S1 = 'Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
    + "H (Amazon Rainforest), and I (Sahara Desert) are all correct choices because none of them are "
    + 'considered major high-density global population clusters.';
  const REAL_PASSAGE_S2 = 'Only B (South Asia), D (Northeast United States), and E (Europe) qualify as '
    + 'densely populated regions on a global scale.';
  const REAL_PASSAGE = `${REAL_PASSAGE_S1} ${REAL_PASSAGE_S2}`;

  test('ZERO queries: both THE SOFTBALLS and THE NAMED SET resolve from owned evidence -- the bill says 0 issued, 2 of 2 answered from owned evidence, 1 sweep skipped', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }), // frame's own complement -- empty
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(REAL_PASSAGE)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      expect(askGoogle).not.toHaveBeenCalled();
      expect(outcome.verdict).toBe('A');

      const notesTexts = events.filter((e) => e.kind === 'note').map((e) => e.text);
      const bill = notesTexts.find((t) => /QUERY BILL/.test(t));
      expect(bill).toBeDefined();
      // THE POINT: the number in the note matches the REAL mock call count, not an independent guess.
      expect(bill).toMatch(new RegExp(`${askGoogle.mock.calls.length} quer`));
      expect(bill).toMatch(/2 of 2 question\(s\)/);
      expect(bill).toMatch(/THE SOFTBALLS/);
      expect(bill).toMatch(/THE NAMED SET/);
      expect(bill).toMatch(/1 per-option denotation sweep SKIPPED/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('a route that DOES spend a query: the bill\'s query count matches askGoogle\'s real call count exactly', async () => {
    const originalFetch = global.fetch;
    // Frame and named set both resolve from owned evidence (zero queries there); STAGE D's
    // discriminator falls through to its own ONE fresh query (same fixture
    // classify_cascade.discriminator.test.ts already uses for this exact shape).
    const FRAME_PASSAGE = 'G (Arctic Circle), H (Amazon Rainforest), and I (Sahara Desert) represent the extreme '
      + 'sparsely populated biomes (cold, wet, and dry lands), not world regions.';
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: FRAME_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }), // frame's own complement -- empty
      JSON.stringify({ members: [], stated_in_passage: false }), // named set direct on FRAME_PASSAGE -- off-topic
      JSON.stringify({ not_members: [], stated_in_passage: false }), // named set complement on FRAME_PASSAGE
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }), // named set direct on REAL_PASSAGE (owned[1])
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
        stated_in_passage: true,
      }), // named set complement on REAL_PASSAGE
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }), // discriminator owned attempt
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }), // discriminator fresh query's own extraction
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America, North Africa, and Central Asia are each large geographic areas.' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(FRAME_PASSAGE), owned(REAL_PASSAGE)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      await runSuperlativeByMagnitude(input, ctx, match);

      expect(askGoogle).toHaveBeenCalledTimes(1); // the discriminator's own one query
      const notesTexts = events.filter((e) => e.kind === 'note').map((e) => e.text);
      const bill = notesTexts.find((t) => /QUERY BILL/.test(t));
      expect(bill).toBeDefined();
      expect(bill).toMatch(/^ {3}QUERY BILL: 1 query issued this run/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
