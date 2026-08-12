// classify_cascade.membership_terminator.test.ts -- D-BP153-013/BISHOP/seg-membership-terminator
//
// THE HAND DERIVATION THIS PROVES, ENCODED VERBATIM (Bishop's dispatch, not re-derived here):
// qid 98, key A. Step 1 THE FRAME (establishFrame(), already built, NOT re-tested here --
// classify_cascade.frame.test.ts and classify_cascade.owned_evidence_frame.test.ts already cover
// it) narrows to legitimate world regions. Q1's own real BP153 evidence (see
// classify_cascade.frame.test.ts's own FRAME_KEPT_STRICT/FRAME_EXCLUDED_BIOMES constants, reused
// here rather than re-derived) named ONLY South Asia, Northeast US, Europe, and South America as
// legitimate world regions -- Central Asia and North Africa were never in that framing (Google's
// own entity labels tagged them "Colloquial area", not continent), so the real frame excludes
// {C, F, G, H, I}, not merely the three biomes {G, H, I}. Step 2 THE NAMED SET
// (extractNamedSetMembers(), this ticket) reads which of the legitimate regions the SAME source
// itself names as members of "the world's most densely populated regions" -- the REAL evidence
// quoted below names exactly three: South Asia, Northeast US, Europe. Step 3 PUT THEM TOGETHER
// (runMembershipTerminator(), this ticket): legitimate-regions MINUS named-set-members = {A}
// (South America), UNIQUE.
//
// THE REAL EVIDENCE, verbatim from the live BP153 run's evidence store (this ticket's own
// dispatch, quoted exactly, never paraphrased):
const REAL_PASSAGE = 'Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
  + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
  + 'densely populated regions. Only B (South Asia), D (Northeast United States), and E (Europe) are '
  + 'recognized in human geography as major global population clusters. Among the non-dense options, '
  + 'G, H, and I represent the extreme sparsely populated biomes (cold, wet, and dry lands).';

import { describe, test, expect, vi } from 'vitest';
import {
  extractNamedSetMembers, runMembershipTerminator, runSuperlativeByMagnitude, extractSuperlativeMatch,
} from './classify_cascade';
import type { MethodRunContext, MethodQuestionInput } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

// qid 98's option letters, same fixture classify_cascade.frame.test.ts and
// classify_cascade.owned_evidence_frame.test.ts already use.
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
// The real frame this ticket relies on, per classify_cascade.frame.test.ts's own FRAME_KEPT_STRICT
// (['A','B','D','E']) -- NOT re-derived here, only its exclusion complement is restated:
const FRAME_EXCLUDED_REAL = ['C', 'F', 'G', 'H', 'I'];
const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

/** Same convention classify_cascade.owned_evidence_frame.test.ts already established: queues
 *  canned Ollama /api/generate JSON responses, one per gemmaExtract() call, in order. See that
 *  file's own header for why the cast to `typeof fetch` is narrow and deliberate (D-BP153-012). */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

describe('runMembershipTerminator() -- STEP 3, pure, no I/O', () => {
  test('THE HEADLINE ARITHMETIC: legitimate {A,B,D,E} minus members {B,D,E} = unique A', () => {
    const result = runMembershipTerminator(ALL, FRAME_EXCLUDED_REAL, ['B', 'D', 'E'], OPT);
    expect(result.candidates).toEqual(['A']);
    expect(result.unique).toBe('A');
    expect(result.why).toMatch(/UNIQUE/);
  });

  test('not-unique case: members = {B,D} only (E missing) -> candidates = {A,E}, abstain, both named', () => {
    const result = runMembershipTerminator(ALL, FRAME_EXCLUDED_REAL, ['B', 'D'], OPT);
    expect(new Set(result.candidates)).toEqual(new Set(['A', 'E']));
    expect(result.unique).toBeNull();
    expect(result.why).toContain('A) South America');
    expect(result.why).toContain('E) Europe');
    expect(result.why).toMatch(/not\s+unique, abstaining/);
  });

  test('zero-candidates case: every legitimate option is also a named member -> abstain, not a crash', () => {
    const result = runMembershipTerminator(ALL, FRAME_EXCLUDED_REAL, ['A', 'B', 'D', 'E'], OPT);
    expect(result.candidates).toEqual([]);
    expect(result.unique).toBeNull();
    expect(result.why).toMatch(/ZERO candidates/);
  });

  test('never a tiebreak: the terminator can return ANY letter as unique, not just A', () => {
    // Named-set members = everything except C -- legitimate {A,B,D,E} minus members {A,B,D} (E is
    // NOT a legitimate region here, out of frame) leaves {E}, proving this is not hardcoded to A.
    const result = runMembershipTerminator(ALL, FRAME_EXCLUDED_REAL, ['A', 'B', 'D'], OPT);
    expect(result.candidates).toEqual(['E']);
    expect(result.unique).toBe('E');
  });

  test('pure: does not mutate its input arrays', () => {
    const all = [...ALL];
    const excluded = [...FRAME_EXCLUDED_REAL];
    const members = ['B', 'D', 'E'];
    runMembershipTerminator(all, excluded, members, OPT);
    expect(all).toEqual(ALL);
    expect(excluded).toEqual(FRAME_EXCLUDED_REAL);
    expect(members).toEqual(['B', 'D', 'E']);
  });
});

describe('extractNamedSetMembers() -- STEP 2, owned-evidence-first (mirrors establishFrame())', () => {
  test('an owned passage stating explicit members answers with ZERO queries issued', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ members: ['South Asia', 'Northeast United States', 'Europe'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [REAL_PASSAGE],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(result.available).toBe(true);
      expect(result.answeredFrom).toBe('owned-passage');
      expect(result.ownedPassageIndex).toBe(0);
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l) && /passage 1 of 1/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('appearsIn() rejects a member the passage does not actually contain -- never trusted', async () => {
    const originalFetch = global.fetch;
    const passage = 'Only B (South Asia) is recognized as a major global population cluster.';
    // Model hallucinates an ADDITIONAL member ("Europe") the passage never states.
    global.fetch = queuedFetch([
      JSON.stringify({ members: ['South Asia', 'Europe'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [passage],
      );
      expect(result.members).toEqual(['B']);
      expect(result.members).not.toContain('E');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('an owned passage yielding nothing is inconclusive, not "no members" -- tries the next passage', async () => {
    const originalFetch = global.fetch;
    const offTopic = 'Population density is measured in people per square kilometer worldwide.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({ members: ['South Asia'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [offTopic, 'Only South Asia is a major global population cluster.'],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(result.answeredFrom).toBe('owned-passage');
      expect(result.ownedPassageIndex).toBe(1);
      expect(result.members).toEqual(['B']);
      expect(log.some((l) => /did not name any members -- falling through/.test(l))).toBe(false); // only one owned passage failed, not all
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('no owned passages at all falls straight to the query path, unchanged from establishFrame()\'s own contract', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ members: ['Arctic Circle'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'Arctic Circle is stated as a member here.' }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(result.answeredFrom).toBe('new-query');
      expect(result.ownedPassageIndex).toBeNull();
      expect(result.members).toEqual(['G']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('D-BP153-010, mirrored: an EMPTY passage from a fresh query is UNAVAILABLE, never "no members"', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([]); // must not even be reached -- an empty passage never reaches gemmaExtract()
    // googleBlocks() returns ok:true with an EMPTY joined text when the raw payload has an organic
    // result whose title/snippet are both empty strings (a real page that loaded but said nothing)
    // -- reproduces the ok:true/empty-text case in ONE attempt, no retry backoff, same as the
    // production incident D-BP153-010 documents (unlike a plain `{snippet:''}` with no results,
    // which googleBlocks() reads as a genuine miss and retries 3x with backoff, needlessly slow here).
    const askGoogle = vi.fn(async () => ({ results: [{ title: '', snippet: '' }] }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      expect(result.available).toBe(false);
      expect(result.members).toEqual([]);
      expect(result.via).toMatch(/empty passage/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askGoogle returning nothing usable at all -- UNAVAILABLE, not empty', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([]);
    // challengeDetected short-circuits googleBlocks() to 0 further retries (its own documented
    // "HALT" branch) -- a `null`/no-result answer instead would make googleBlocks() retry 3x with
    // (4s, 8s) backoff sleeps, needlessly slow for a unit test that only needs res.ok:false.
    const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      expect(result.available).toBe(false);
      expect(result.members).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('runSuperlativeByMagnitude() wiring -- STAGE M runs before Stage A/B, and falls through cleanly', () => {
  test('THE HEADLINE, end to end: real passage as owned evidence for BOTH frame and named set -> UNIQUE verdict A, ZERO askGoogle calls, orderings never issued', async () => {
    const originalFetch = global.fetch;
    // Two gemmaExtract() calls total for this run: the frame's own extraction (Step 1, already
    // built, unmodified), then the named set's own extraction (Step 2, this ticket) -- BOTH read
    // from the SAME single owned passage, exactly the way the real qid 98 evidence store held one
    // passage answering both. No THIRD call happens, because Stage A's litmus loop and Stage B's
    // four ordering queries never run -- the queuedFetch() queue running dry would fail this test
    // loudly if they did.
    global.fetch = queuedFetch([
      // Frame extraction (establishFrame(), unmodified) -- the real BP153 frame result: only
      // South America, South Asia, Northeast US, Europe were named legitimate world regions.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'],
        stated_in_passage: true,
      }),
      // Named-set extraction (extractNamedSetMembers(), this ticket).
      JSON.stringify({ members: ['South Asia', 'Northeast United States', 'Europe'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED -- the whole point of the terminator' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [REAL_PASSAGE],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION);
      expect(match).not.toBeNull();

      const outcome = await runSuperlativeByMagnitude(input, ctx, match!);

      expect(askGoogle).not.toHaveBeenCalled(); // THE POINT: no ordering query, no frame query, no named-set query
      expect(outcome.abstain).toBe(false);
      expect(outcome.verdict).toBe('A');
      expect(outcome.ok).toBe(true);
      expect(outcome.basis).toMatch(/MEMBERSHIP TERMINATOR/);

      const stageNotes = events.filter((e) => e.kind === 'stage').map((e) => e.text);
      expect(stageNotes.some((t) => /STAGE M/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE A/.test(t))).toBe(false); // never reached
      expect(stageNotes.some((t) => /STAGE B/.test(t))).toBe(false); // never reached -- the saved queries
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('not-unique named set -> falls through to the EXISTING magnitude path (Stage A runs), never picks among survivors', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Frame extraction: same real frame as above.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'],
        stated_in_passage: true,
      }),
      // Named-set extraction: only TWO of the three members named -- not unique (candidates {A,E}).
      JSON.stringify({ members: ['South Asia', 'Northeast United States'], stated_in_passage: true }),
    ]);
    // Beyond this point (Stage A's litmus-strip loop) askGoogle is used and returns nothing usable,
    // so the loop and the route abstain honestly rather than crash -- this test is only checking
    // that STAGE A is REACHED, not what it concludes. challengeDetected short-circuits googleBlocks()
    // to 0 retries per call (see the extractNamedSetMembers() tests above for why `null` would make
    // every one of Stage A's several queries pay a 3x/backoff retry cost here).
    const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [REAL_PASSAGE],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      expect(outcome.basis).not.toMatch(/MEMBERSHIP TERMINATOR/);
      const stageNotes = events.filter((e) => e.kind === 'stage').map((e) => e.text);
      expect(stageNotes.some((t) => /STAGE M/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE A/.test(t))).toBe(true); // fell through, reached unchanged
      expect(askGoogle).toHaveBeenCalled(); // Stage A's litmus loop DID issue queries -- unchanged path
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('named set UNAVAILABLE (owned passage yields nothing, fresh query also comes back nothing) -> falls through to the existing magnitude path unchanged', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Frame extraction (Step 1, unmodified): resolves fine from the owned passage, as always.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'],
        stated_in_passage: true,
      }),
      // Named-set extraction (Step 2) tries the SAME owned passage per FD-BP153-04's contract (each
      // stage tries owned evidence independently) but this time the extraction honestly finds
      // nothing -- D-BP153-010's rule: inconclusive, not "no members". Falls through to a fresh
      // query, which askGoogle (mocked to return null below) cannot answer either.
      JSON.stringify({ members: [], stated_in_passage: false }),
    ]);
    // challengeDetected short-circuits googleBlocks() to 0 retries per call -- the named-set query,
    // then Stage A's own queries, all come back nothing, fast.
    const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [REAL_PASSAGE],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      expect(outcome.basis).not.toMatch(/MEMBERSHIP TERMINATOR/);
      const stageNotes = events.filter((e) => e.kind === 'stage').map((e) => e.text);
      expect(stageNotes.some((t) => /STAGE M/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE A/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
