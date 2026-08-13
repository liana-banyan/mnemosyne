// classify_cascade.repeated_draws.test.ts -- D-BP153-031/BISHOP/seg-repeated-draws
//
// Bishop diagnosed THE CHANNEL VARIANCE FINDING from four consecutive live runs, not re-diagnosed
// here (see classify_cascade.ts's own D-BP153-031 section header, above establishFrame(), for the
// full ruling this file proves): the SAME question, to the SAME authority, on consecutive runs,
// returned wildly different named sets for qid 98 --
//   run 03-57Z: members {B, E}
//   run 04-55Z: members {B, D, E}   <- correct
//   run 06-40Z: members {C}          <- one member, and the wrong one
// Every fix before this ticket made the DERIVATION sound; none made the INPUT stable. THE RULE: ask
// each base question more than once and require the independent draws to AGREE before the answer is
// trusted; a disagreement is a FINDING, reported, never silently resolved (never an intersection, a
// union, a majority vote, or a first-draw pick).
//
// THIS FILE DOES NOT SET LB_DRAW_REPEATS -- every test below runs under the REAL default (2),
// exactly the config a live run uses, so these tests exercise the actual production behavior, not a
// pinned-off escape hatch (that escape hatch, LB_DRAW_REPEATS=1, is TEST 3 below, and its OWN point
// is to prove it reproduces the pre-ticket behavior exactly -- every OTHER classify_cascade.*.test.ts
// file pins LB_DRAW_REPEATS=1 in its own beforeEach/afterEach specifically so ITS OWN fixtures, which
// predate repeated draws, stay single-draw; this file is the one place the multi-draw behavior itself
// is proven).

import { describe, test, expect, vi } from 'vitest';
import {
  establishFrame, extractNamedSetMembers, runDiscriminator, runSuperlativeByMagnitude, extractSuperlativeMatch,
} from './classify_cascade';
import type { MethodRunContext, MethodQuestionInput, OwnedPassage } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

// qid 98's option letters -- same fixture every sibling classify_cascade.*.test.ts file uses.
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
const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

/** Same convention every sibling classify_cascade.*.test.ts file already establishes: queues canned
 *  Ollama /api/generate JSON responses, one per gemmaExtract() call, in order. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

describe('TEST 1, THE HEADLINE: two draws returning DIFFERENT member sets -> disagreement, never trusted', () => {
  // THE EXACT MEASURED SHAPE (this file's own header): draw 1 returns a passage naming {B, D, E}
  // (run 04-55Z, correct); draw 2 returns a passage naming only {C} (run 06-40Z, wrong). Before this
  // ticket, extractNamedSetMembers() asked ONCE and trusted whatever single draw came back -- on the
  // {C}-only draw, the run would have trusted members={C} and handed it straight to the membership
  // terminator, which is the exact live bug (receipt LIANA_RUN_qid98_2026-08-13T06-40-53-268Z.json).
  const DRAW1_PASSAGE = 'Only B (South Asia), D (Northeast United States), and E (Europe) are '
    + 'recognized in human geography as major global population clusters.';
  const DRAW2_PASSAGE = 'Only C (North Africa) is recognized as a major global population cluster.';

  test('FAIL-BEFORE / PASS-AFTER: disagreement is reported as a finding, the question is treated as UNAVAILABLE, nothing is trusted -- no intersection, no union, no majority, no first-draw pick', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Draw 1: direct extraction names {B, D, E}; complement is silent.
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: DRAW1_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // Draw 2: direct extraction names ONLY {C}; complement is silent.
      JSON.stringify({ members: [{ name: 'North Africa', span: DRAW2_PASSAGE }], stated_in_passage: true }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn()
      .mockResolvedValueOnce({ snippet: DRAW1_PASSAGE })
      .mockResolvedValueOnce({ snippet: DRAW2_PASSAGE });
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );

      // Exactly two independent draws issued -- the default LB_DRAW_REPEATS, never more, never
      // short-circuited after the first.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(result.drawsIssued).toBe(2);
      expect(result.drawRepeats).toBe(2);

      // THE POINT: disagreement never resolves to ANY of {B,D,E}, {C}, their union {B,C,D,E}, or
      // their intersection (empty, which would be indistinguishable from "resolved to nothing"). The
      // question is UNAVAILABLE, exactly the same state an unanswerable question already produces.
      expect(result.available).toBe(false);
      expect(result.members).toEqual([]);
      expect(result.via).toBe('draw-disagreement');
      expect(result.reconciliationWhy).toMatch(/disagreed/i);
      expect(result.reconciliationWhy).toMatch(/D-BP153-031/);

      // The FINDING itself is reported in the transcript, naming both draws' own result sets.
      const disagreementLine = log.find((l) => /DISAGREEMENT/.test(l) && /D-BP153-031/.test(l));
      expect(disagreementLine).toBeDefined();
      expect(disagreementLine).toMatch(/THE CHANNEL VARIANCE FINDING/);
      expect(disagreementLine).toMatch(/never an intersection, a union, a majority vote, or a first-draw pick/);
      expect(log.some((l) => /members \{B,D,E\}/.test(l))).toBe(true);
      expect(log.some((l) => /members \{C\}/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 2: two draws returning the SAME set -> trusted, behavior identical to today', () => {
  test('agreement: both draws name the identical member set, and it is trusted', async () => {
    const originalFetch = global.fetch;
    const MEMBER_SENTENCE = 'Only B (South Asia), D (Northeast United States), and E (Europe) are '
      + 'recognized in human geography as major global population clusters.';
    const NON_MEMBER_SENTENCE = 'A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
      + 'H (Amazon Rainforest), and I (Sahara Desert) are not among them.';
    const PASSAGE = `${MEMBER_SENTENCE} ${NON_MEMBER_SENTENCE}`;
    // A COMPLETE partition (all 9 options covered, zero conflicts) -- deliberately, so this test
    // proves agreement/trust in isolation, without also exercising D-BP153-026/027's own completion
    // follow-up (that interaction has its own dedicated TEST 5, below).
    const NON_MEMBERS = ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'];
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: MEMBER_SENTENCE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: NON_MEMBERS.map((name) => ({ name, span: NON_MEMBER_SENTENCE })), stated_in_passage: true }),
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: MEMBER_SENTENCE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: NON_MEMBERS.map((name) => ({ name, span: NON_MEMBER_SENTENCE })), stated_in_passage: true }),
    ]);
    // A constant-return mock (the same convention every sibling test file already uses) is itself a
    // stand-in for "the same authority, asked twice, agrees" -- both draws receive the identical
    // passage, so their extracted result sets agree byte-for-byte.
    const askGoogle = vi.fn(async () => ({ snippet: PASSAGE }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(result.drawsIssued).toBe(2);
      expect(result.drawRepeats).toBe(2);
      expect(result.available).toBe(true);
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      expect(result.via).not.toBe('draw-disagreement');
      expect(log.some((l) => /independent draw\(s\) AGREE/.test(l))).toBe(true);
      expect(log.some((l) => /DISAGREEMENT/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 3: LB_DRAW_REPEATS=1 -> exactly one query per question, byte-identical to today', () => {
  test('repeats disabled: one draw, no wrapper notes, same result a single-draw call already produced', async () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env.LB_DRAW_REPEATS;
    process.env.LB_DRAW_REPEATS = '1';
    const MEMBER_SENTENCE = 'Only B (South Asia), D (Northeast United States), and E (Europe) are '
      + 'recognized in human geography as major global population clusters.';
    const NON_MEMBER_SENTENCE = 'A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
      + 'H (Amazon Rainforest), and I (Sahara Desert) are not among them.';
    const PASSAGE = `${MEMBER_SENTENCE} ${NON_MEMBER_SENTENCE}`;
    const NON_MEMBERS = ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'];
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: MEMBER_SENTENCE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: NON_MEMBERS.map((name) => ({ name, span: NON_MEMBER_SENTENCE })), stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: PASSAGE }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      expect(askGoogle).toHaveBeenCalledTimes(1); // exactly one query, never two
      expect(result.drawsIssued).toBe(1);
      expect(result.drawRepeats).toBe(1);
      expect(result.available).toBe(true);
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      // BYTE-IDENTICAL LOGGING: with repeats===1, drawWithAgreement() emits NONE of its own
      // "DRAW N of..."/"independent draw(s) AGREE" notes -- the transcript reads exactly as it did
      // before this ticket existed.
      expect(log.some((l) => /DRAW 1 of/.test(l))).toBe(false);
      expect(log.some((l) => /independent draw\(s\) AGREE/.test(l))).toBe(false);
      expect(log.some((l) => /D-BP153-031/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
      if (originalEnv === undefined) delete process.env.LB_DRAW_REPEATS; else process.env.LB_DRAW_REPEATS = originalEnv;
    }
  });
});

describe('TEST 4: owned evidence complete -> ZERO queries, no repeats, unchanged', () => {
  test('an owned passage answers outright -- no draw is ever issued, drawsIssued/drawRepeats are unset', async () => {
    const PASSAGE = 'Only B (South Asia), D (Northeast United States), and E (Europe) are '
      + 'recognized in human geography as major global population clusters.';
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(PASSAGE)],
      );
      expect(askGoogle).not.toHaveBeenCalled(); // owned evidence is used once, at zero query cost --
      // it is a complete answer already in memory, never a draw from a noisy channel, so it is never
      // multiplied by LB_DRAW_REPEATS.
      expect(result.answeredFrom).toBe('owned-passage');
      expect(result.available).toBe(true);
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      expect(result.drawsIssued).toBeUndefined();
      expect(result.drawRepeats).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 5: draws agree but the agreed result is incomplete -> the completion follow-up fires ONCE, not once per draw', () => {
  test('both draws agree on a partial, complement-silent reading -- exactly one completion follow-up is issued afterward', async () => {
    const originalFetch = global.fetch;
    // Names only ONE of the nine options directly; the complement is silent both times -- a
    // COMPLEMENT-SILENT-AND-PARTIAL read (D-BP153-027), the same shape that already earns ONE
    // completion follow-up before this ticket. Both draws receive the IDENTICAL passage (a constant
    // mock, same convention TEST 2 uses), so they AGREE -- the repeats run FIRST, agree, and only
    // THEN does the (still single) follow-up fire.
    const freshPassage = 'Arctic Circle is stated as a member here.';
    global.fetch = queuedFetch([
      // Draw 1: direct + complement.
      JSON.stringify({ members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // Draw 2: direct + complement, byte-identical to draw 1 (the mock returns the same passage).
      JSON.stringify({ members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // The ONE completion follow-up's own direct + complement -- finds nothing new (same
      // content-free shape the pre-ticket sibling test in classify_cascade.membership_terminator.
      // test.ts already covers for the single-draw case).
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      // 2 draws (agreeing) + 1 follow-up = 3 total askGoogle calls -- the follow-up is NEVER
      // multiplied by the repeats; it fires once, after agreement, per this file's own header.
      expect(askGoogle).toHaveBeenCalledTimes(3);
      expect(result.drawsIssued).toBe(2); // the BASE question's own draw count -- the follow-up is
      // counted separately (as a completion follow-up), never folded into drawsIssued.
      expect(result.drawRepeats).toBe(2);
      expect(result.answeredFrom).toBe('new-query');
      expect(result.members).toEqual(['G']); // the follow-up found nothing new; the first pass's own
      // directly-stated member is retained (D-BP153-029), never a wipe.
      const followUpLines = log.filter((l) => / FOLLOW-UP \(D-BP153-026\):/.test(l));
      expect(followUpLines).toHaveLength(1); // exactly once, never once per draw
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 6: the query bill reports the repeat count and the number of draws issued, and it reconciles', () => {
  test('STAGE D fires on a fresh query, both draws agree on an abstain -- the bill names LB_DRAW_REPEATS and the draw count, and they reconcile with the raw query count', async () => {
    const originalFetch = global.fetch;
    const REAL_PASSAGE_S1 = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
      + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
      + 'densely populated regions.';
    const REAL_PASSAGE_S2 = 'Only B (South Asia), D (Northeast United States), and E (Europe) are '
      + 'recognized in human geography as major global population clusters.';
    const REAL_PASSAGE = `${REAL_PASSAGE_S1} ${REAL_PASSAGE_S2}`;
    global.fetch = queuedFetch([
      // Frame: owned evidence resolves it outright (direct + D-BP153-017 complement).
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }),
      // Named set: owned evidence resolves it outright too -- STAGE M leaves {A}, actually UNIQUE,
      // so STAGE D would never fire on THIS reading; reduce the named set to only TWO of three
      // members so STAGE M is non-unique and STAGE D actually runs, proving the bill on a route that
      // DOES spend draws.
      JSON.stringify({
        members: ['South Asia', 'Northeast United States'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
    ]);
    // STAGE D's own base question: both draws come back challengeDetected (a constant mock -- both
    // draws agree on "no usable answer"), so THE SOFTBALLS/THE NAMED SET spend zero fresh queries
    // (owned evidence) and STAGE D spends exactly its own repeats.
    const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(REAL_PASSAGE)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      await runSuperlativeByMagnitude(input, ctx, match);

      // STAGE D issues exactly LB_DRAW_REPEATS (2) draws, both agreeing on ABSTAIN.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      const notesTexts = events.filter((e) => e.kind === 'note').map((e) => e.text);
      const bill = notesTexts.find((t) => /QUERY BILL/.test(t));
      expect(bill).toBeDefined();
      expect(bill).toMatch(/LB_DRAW_REPEATS=2 \(D-BP153-031\)/);
      expect(bill).toMatch(/2 draws issued/);
      // RECONCILES: the raw query count the bill states up front (2, both to Google, since no
      // conversational authority is threaded here) matches the draw count named later in the SAME
      // bill -- the repeats are INCLUDED IN, never on top of, the headline query count.
      expect(bill).toMatch(/^\s*QUERY BILL: 2 queries issued this run \(0 to the conversational authority, 2 to Google\)/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('BOUNDARY: repeated draws can only ever cause an ABSTAIN or a trusted agreement, never select an answer letter', () => {
  test('establishFrame() disagreement -> unavailable, exactly the FD-BP153-01 consequence-2 abstain state', async () => {
    const originalFetch = global.fetch;
    const DRAW1 = 'For EACH of these: South America is a continent, South Asia is a continent, '
      + 'Northeast United States is a sub-national zone, Europe is a continent, North Africa is a '
      + 'colloquial area, Central Asia is a colloquial area, Arctic Circle is a biome, Amazon '
      + 'Rainforest is a biome, Sahara Desert is a biome.';
    const DRAW2 = 'For EACH of these: South America is a biome, South Asia is a continent, '
      + 'Northeast United States is a sub-national zone, Europe is a continent, North Africa is a '
      + 'continent, Central Asia is a colloquial area, Arctic Circle is a biome, Amazon Rainforest '
      + 'is a biome, Sahara Desert is a biome.';
    global.fetch = queuedFetch([
      // Draw 1: direct exclusion read names the three biomes; complement silent.
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: DRAW1 })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }),
      // Draw 2: DIFFERENT exclusion set (South America now a biome, North Africa now a continent).
      JSON.stringify({
        not_members: ['South America', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: DRAW2 })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn()
      .mockResolvedValueOnce({ snippet: DRAW1 })
      .mockResolvedValueOnce({ snippet: DRAW2 });
    try {
      const { note } = notes();
      const result = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
      );
      expect(result.available).toBe(false);
      expect(result.excluded).toEqual([]);
      expect(result.via).toBe('draw-disagreement');
      // NEVER a selected letter -- an unavailable frame can only ever lead to an abstain downstream
      // (FD-BP153-01 consequence 2), the identical consequence a frame that could never be
      // established at all already has.
      expect(result.reconciliationWhy).not.toMatch(/\b[A-I]\) /);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('runDiscriminator() disagreement -> ABSTAIN naming every candidate, never a unique letter', async () => {
    const CANDIDATES = ['A', 'C', 'F'];
    const DRAW1 = 'South America is a Continent. North Africa is a Colloquial area. Central Asia is '
      + 'a Colloquial area. The category world region properly denotes a Continent.';
    const DRAW2 = 'South America is a Continent. North Africa is a Continent. Central Asia is a '
      + 'Colloquial area. The category world region properly denotes a Colloquial area.';
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: DRAW1 },
          { name: 'North Africa', kind: 'Colloquial area', span: DRAW1 },
          { name: 'Central Asia', kind: 'Colloquial area', span: DRAW1 },
        ],
        category_kind: 'Continent',
        category_kind_span: DRAW1,
        stated_in_passage: true,
      }),
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: DRAW2 },
          { name: 'North Africa', kind: 'Continent', span: DRAW2 },
          { name: 'Central Asia', kind: 'Colloquial area', span: DRAW2 },
        ],
        category_kind: 'Colloquial area',
        category_kind_span: DRAW2,
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn()
      .mockResolvedValueOnce({ snippet: DRAW1 })
      .mockResolvedValueOnce({ snippet: DRAW2 });
    try {
      const { note } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, CANDIDATES, OPT, note,
      );
      expect(result.unique).toBeNull();
      expect(new Set(result.survivors)).toEqual(new Set(CANDIDATES));
      expect(result.eliminations).toEqual([]);
      expect(result.why).toMatch(/disagreed/i);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
