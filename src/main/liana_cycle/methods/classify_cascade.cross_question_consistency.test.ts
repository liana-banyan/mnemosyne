// classify_cascade.cross_question_consistency.test.ts -- D-BP153-030/BISHOP/seg-cross-question-consistency
//
// THE MEASURED FALSE PASS THIS CLOSES (live run, receipt
// LIANA_RUN_qid98_2026-08-13T04-55-00-660Z.json). That run PUBLISHED verdict A with ok=true, on a
// basis that reads, verbatim: "frame excluded [G, H, I, B, C, D, F] (new-query); named set of most
// densely populated members [B, D, E] (owned-passage); legitimate-regions {A, E} MINUS
// named-set-members {B, D, E} leaves exactly one candidate: A -- UNIQUE". THE FRAME says B (South
// Asia) and D (Northeast United States) are NOT world regions; THE NAMED SET says B and D ARE among
// the world's most densely populated REGIONS. Both cannot be true -- a member of a named subset of
// the category is a member of the category by construction. Nothing checked QUESTION 1 (the
// softballs/frame) against QUESTION 2 (the named set) before this ticket, so the run published on a
// self-contradictory basis; A survived only because the frame was over-aggressive, never because it
// was distinguished from North Africa/Central Asia on the evidence. See
// classify_cascade.ts's own "CROSS-QUESTION CONSISTENCY (D-BP153-030)" section header, immediately
// above runMembershipTerminator(), for the full ruling this file proves.
//
// qid 98's option letters, same fixture every classify_cascade.*.test.ts sibling already uses.
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
const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

// THE LIVE PASSAGE SHAPE, verbatim style: a single owned passage over-excludes B, C, D, F (reading
// "a subregion of Asia"/similar phrasing as "not a world region") in addition to the three genuine
// biomes G, H, I -- the SAME passage's named-set reading (a different extraction, same text) still
// states B, D, E are the densely-populated members. This is what produces the live contradiction:
// the two independent extractions over the same evidence disagree about whether B and D belong to
// the category at all.
const OVEREXCLUDING_FRAME_PASSAGE = 'Options B (South Asia), C (North Africa), D (Northeast United '
  + 'States), F (Central Asia), G (Arctic Circle), H (Amazon Rainforest), and I (Sahara Desert) are '
  + 'all NOT considered world regions in the formal sense.';
const NAMED_SET_PASSAGE = 'Only B (South Asia), D (Northeast United States), and E (Europe) are '
  + 'recognized in human geography as major global population clusters.';

// THE CONSISTENT SHAPE (no contradiction): the frame excludes the three genuine biomes plus North
// Africa/Central Asia (the SAME legitimate-region set classify_cascade.membership_terminator.test.ts's
// own headline fixture uses -- legitimate {A,B,D,E}), never touching B or D -- the ordinary,
// non-buggy case this ticket must leave completely unchanged: legitimate {A,B,D,E} minus named-set
// members {B,D,E} = unique candidate A.
const CONSISTENT_FRAME_PASSAGE = 'North Africa (C) and Central Asia (F) are classified by entity type '
  + 'as a colloquial area, not a continent, while Arctic Circle (G), Amazon Rainforest (H), and '
  + 'Sahara Desert (I) are climatic biomes -- none of the five is classified as a world region.';

// A SINGLE-OPTION contradiction shape: the frame over-excludes ONLY D (never B), so exactly one
// named-set member (D) is contradicted.
const SINGLE_CONTRADICTION_FRAME_PASSAGE = 'D (Northeast United States), G (Arctic Circle), H '
  + '(Amazon Rainforest), and I (Sahara Desert) are all NOT considered world regions in the formal '
  + 'sense.';

import { describe, test, expect, vi } from 'vitest';
import {
  checkFrameNamedSetConsistency, runSuperlativeByMagnitude, extractSuperlativeMatch,
} from './classify_cascade';
import type { MethodRunContext, MethodQuestionInput, OwnedPassage } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

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

describe('checkFrameNamedSetConsistency() -- pure, no I/O (D-BP153-030)', () => {
  test('TEST 2, NO CONTRADICTION: every named-set member is in frame -> consistent, no letter named', () => {
    const result = checkFrameNamedSetConsistency(['G', 'H', 'I'], ['B', 'D', 'E'], OPT);
    expect(result.consistent).toBe(true);
    expect(result.contradictions).toEqual([]);
    expect(result.why).toMatch(/no contradiction/);
  });

  test('TEST 3, SINGLE-OPTION CONTRADICTION: only D is both excluded and named a member -> contradictions=[D] only', () => {
    const result = checkFrameNamedSetConsistency(['D', 'G', 'H', 'I'], ['B', 'D', 'E'], OPT);
    expect(result.consistent).toBe(false);
    expect(result.contradictions).toEqual(['D']);
    expect(result.contradictions).not.toContain('B');
    expect(result.why).toContain('D) Northeast United States');
    expect(result.why).not.toContain('B) South Asia');
  });

  test('HEADLINE SHAPE: B and D are both excluded by the frame AND named a member -> contradictions=[B,D], both named', () => {
    const result = checkFrameNamedSetConsistency(['G', 'H', 'I', 'B', 'C', 'D', 'F'], ['B', 'D', 'E'], OPT);
    expect(result.consistent).toBe(false);
    expect(new Set(result.contradictions)).toEqual(new Set(['B', 'D']));
    expect(result.why).toContain('B) South Asia');
    expect(result.why).toContain('D) Northeast United States');
  });

  test('TEST 4, CANNOT SELECT A LETTER: the result never carries a verdict, only contradictions/consistent/why', () => {
    const result = checkFrameNamedSetConsistency(['G', 'H', 'I', 'B', 'C', 'D', 'F'], ['B', 'D', 'E'], OPT);
    expect(result).not.toHaveProperty('verdict');
    expect(result).not.toHaveProperty('unique');
  });

  test('pure: does not mutate its input arrays', () => {
    const excluded = ['G', 'H', 'I', 'B', 'C', 'D', 'F'];
    const members = ['B', 'D', 'E'];
    checkFrameNamedSetConsistency(excluded, members, OPT);
    expect(excluded).toEqual(['G', 'H', 'I', 'B', 'C', 'D', 'F']);
    expect(members).toEqual(['B', 'D', 'E']);
  });
});

describe('runSuperlativeByMagnitude() wiring -- CROSS-QUESTION CONSISTENCY runs before STAGE M (D-BP153-030)', () => {
  test('TEST 1, THE HEADLINE (the exact live shape): frame excludes {G,H,I,B,C,D,F}, named set {B,D,E} -> ABSTAIN, both B and D named, terminator never runs, NOTHING published', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Frame direct extraction: over-excludes B, C, D, F in addition to the genuine biomes G, H, I
      // -- reproduces the live shape exactly.
      JSON.stringify({
        not_members: ['South Asia', 'North Africa', 'Northeast United States', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: OVEREXCLUDING_FRAME_PASSAGE })),
        stated_in_passage: true,
      }),
      // Frame complement (D-BP153-017, THE DOUBLECHECK): nothing stated in that shape.
      JSON.stringify({ members: [], stated_in_passage: false }),
      // Named-set direct extraction, from the SAME owned evidence: B, D, E are the densely
      // populated members.
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: NAMED_SET_PASSAGE })),
        stated_in_passage: true,
      }),
      // Named-set complement: exhausted queue -- gemmaExtract() catches and returns null, exactly
      // the same shape classify_cascade.membership_terminator.test.ts's own headline test relies on.
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED -- consistency check aborts before any ordering query' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(`${OVEREXCLUDING_FRAME_PASSAGE} ${NAMED_SET_PASSAGE}`)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      // NOTHING published -- an abstain, verdict null, never a letter.
      expect(outcome.abstain).toBe(true);
      expect(outcome.verdict).toBeNull();
      expect(outcome).not.toHaveProperty('ok', true);

      // Both contradicting options named in the abstain basis.
      expect(outcome.basis).toContain('CROSS-QUESTION CONSISTENCY');
      expect(outcome.basis).toMatch(/B\) South Asia/);
      expect(outcome.basis).toMatch(/D\) Northeast United States/);
      // The terminator's own arithmetic never ran -- its distinctive wording is absent.
      expect(outcome.basis).not.toMatch(/MEMBERSHIP TERMINATOR/);

      // Both named in a note too, so a transcript reader sees the contradiction without re-deriving it.
      const noteTexts = events.filter((e) => e.kind === 'note').map((e) => e.text);
      expect(noteTexts.some((t) => /CROSS-QUESTION CONSISTENCY/.test(t) && /B\) South Asia/.test(t) && /D\) Northeast United States/.test(t))).toBe(true);
      // The membership-terminator note never fires.
      expect(noteTexts.some((t) => /MEMBERSHIP TERMINATOR:/.test(t))).toBe(false);

      // Nothing downstream ever ran: no discriminator, no litmus loop, no ordering queries.
      const stageNotes = events.filter((e) => e.kind === 'stage').map((e) => e.text);
      expect(stageNotes.some((t) => /STAGE D/.test(t))).toBe(false);
      expect(stageNotes.some((t) => /STAGE A/.test(t))).toBe(false);
      expect(stageNotes.some((t) => /STAGE B/.test(t))).toBe(false);
      expect(askGoogle).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('NO CONTRADICTION: every named-set member is in frame -> behavior completely unchanged, terminator runs and publishes', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Frame direct extraction: the three genuine biomes plus North Africa/Central Asia (their own
      // "colloquial area" entity type, not a world region) -- legitimate regions reduce to {A,B,D,E}.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: CONSISTENT_FRAME_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: NAMED_SET_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED -- the terminator resolves uniquely' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(`${CONSISTENT_FRAME_PASSAGE} ${NAMED_SET_PASSAGE}`)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      expect(outcome.abstain).toBe(false);
      expect(outcome.verdict).toBe('A');
      expect(outcome.ok).toBe(true);
      expect(outcome.basis).toMatch(/MEMBERSHIP TERMINATOR/);

      const noteTexts = events.filter((e) => e.kind === 'note').map((e) => e.text);
      expect(noteTexts.some((t) => /CROSS-QUESTION CONSISTENCY/.test(t) && /no contradiction/.test(t))).toBe(true);
      expect(askGoogle).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 3, SINGLE-OPTION CONTRADICTION end to end: only D overlaps -> still abstains, D named, B never falsely named', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Northeast United States', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: SINGLE_CONTRADICTION_FRAME_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: NAMED_SET_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(`${SINGLE_CONTRADICTION_FRAME_PASSAGE} ${NAMED_SET_PASSAGE}`)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      expect(outcome.abstain).toBe(true);
      expect(outcome.verdict).toBeNull();
      expect(outcome.basis).toMatch(/D\) Northeast United States/);
      expect(outcome.basis).not.toMatch(/B\) South Asia.*(excluded|frame)/);
      expect(askGoogle).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
