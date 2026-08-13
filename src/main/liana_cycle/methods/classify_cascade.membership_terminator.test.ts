// classify_cascade.membership_terminator.test.ts -- D-BP153-013/BISHOP/seg-membership-terminator
// UPDATED D-BP153-016/BISHOP/seg-classify-016 (typed passages, verify-the-span)
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
// D-BP153-016 UPDATE. `ownedPassages()` now returns typed `OwnedPassage[]` (text + kind), not bare
// strings (FD-BP153-07 FIX 1), and every extracted value must carry a verbatim SUPPORTING SPAN
// (FIX 2). This file's fixtures and mocked gemmaExtract() JSON are updated in place to the new
// shape; the arithmetic and derivation under test are unchanged.
//
// THE REAL EVIDENCE, verbatim from the live BP153 run's evidence store (this ticket's own
// dispatch, quoted exactly, never paraphrased):
const REAL_PASSAGE_S1 = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
  + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
  + 'densely populated regions.';
const REAL_PASSAGE_S2 = 'Only B (South Asia), D (Northeast United States), and E (Europe) are '
  + 'recognized in human geography as major global population clusters.';
const REAL_PASSAGE_S3 = 'Among the non-dense options, G, H, and I represent the extreme sparsely '
  + 'populated biomes (cold, wet, and dry lands).';
// D-BP153-018 ADDITION, NOT part of the original verbatim live-run quote above (S1-S3). THE
// HEADLINE test below (and only that test) used to source its frame exclusion for ALL FIVE of
// {C,F,G,H,I} from REAL_PASSAGE_S1's span alone -- but S1 states ONLY the superlative PROPERTY
// ("...NOT considered among the world's most densely populated regions"), which D-BP153-018 now
// correctly refuses as evidence of CATEGORY membership (that is the exact bug this ticket closes).
// This file's OWN header comment (above) already explains WHY C and F are legitimately excluded --
// "Google's own entity labels tagged them 'Colloquial area', not continent" -- that fact was
// documented but never actually quoted into the passage text; this sentence supplies it, in a
// genuine, property-free, category-only shape, so THE HEADLINE test can keep proving the real
// arithmetic (frame excludes {C,F,G,H,I}, unique verdict A) without relying on a property-answering
// span to do it.
const REAL_PASSAGE_S4 = 'North Africa (C) and Central Asia (F) are classified by entity type as a '
  + 'colloquial area, not a continent, while Arctic Circle (G), Amazon Rainforest (H), and Sahara '
  + 'Desert (I) are climatic biomes -- none of the five is classified as a world region.';
const REAL_PASSAGE = `${REAL_PASSAGE_S1} ${REAL_PASSAGE_S2} ${REAL_PASSAGE_S3} ${REAL_PASSAGE_S4}`;

import { describe, test, expect, vi } from 'vitest';
import {
  extractNamedSetMembers, runMembershipTerminator, runSuperlativeByMagnitude, extractSuperlativeMatch,
} from './classify_cascade';
import type { MethodRunContext, MethodQuestionInput, OwnedPassage } from '../method_registry';
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

// D-BP153-016: wraps a bare passage string as an OwnedPassage of kind 'operation'.
const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

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
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(REAL_PASSAGE)],
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

  test('a span that does not actually contain the hallucinated member is discarded -- never trusted', async () => {
    const originalFetch = global.fetch;
    const passage = 'Only B (South Asia) is recognized as a major global population cluster.';
    // Model hallucinates an ADDITIONAL member ("Europe") the passage never states -- its only
    // offered span is real passage text that does not mention Europe at all.
    global.fetch = queuedFetch([
      JSON.stringify({
        members: [
          { name: 'South Asia', span: passage },
          { name: 'Europe', span: passage },
        ],
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(passage)],
      );
      expect(result.members).toEqual(['B']);
      expect(result.members).not.toContain('E');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('an owned passage that yields NOTHING extractable is inconclusive, not "no members" -- tries the next passage', async () => {
    const originalFetch = global.fetch;
    // Names NO option at all -- D-BP153-016 FIX 3 rejects it mechanically, before extraction, so it
    // contributes ZERO gemmaExtract() calls.
    const offTopic = 'Population density is measured in people per square kilometer worldwide.';
    const onTopicPassage = 'Only South Asia is a major global population cluster.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [{ name: 'South Asia', span: onTopicPassage }], stated_in_passage: true }), // passage 2: direct
      JSON.stringify({ not_members: [], stated_in_passage: false }), // passage 2: complement
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(offTopic), owned(onTopicPassage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(result.answeredFrom).toBe('owned-passage');
      // offTopic was REJECTED mechanically (FIX 3) before ever reaching extraction -- onTopicPassage
      // is the only one tried, so its index in the FILTERED array is 0.
      expect(result.ownedPassageIndex).toBe(0);
      expect(result.members).toEqual(['B']);
      expect(log.some((l) => /REJECTED an owned passage/.test(l) && /FIX 3/.test(l))).toBe(true);
      expect(log.some((l) => /did not name any members -- falling through/.test(l))).toBe(false); // the surviving passage answered
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('no owned passages at all falls straight to the query path, unchanged from establishFrame()\'s own contract', async () => {
    const originalFetch = global.fetch;
    const freshPassage = 'Arctic Circle is stated as a member here.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      // D-BP153-027: direct names only G (1 of 9); the complement call exhausts queuedFetch() (only
      // ONE response is queued here) and comes back null/empty -- COMPLEMENT-SILENT-AND-PARTIAL, so
      // the ONE completion follow-up fires and goes straight to askGoogle again (no conversational
      // authority threaded). The follow-up's own extraction also lands on the exhausted queue and
      // adds nothing, so `members` is unchanged.
      expect(askGoogle).toHaveBeenCalledTimes(2);
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
    // THREE gemmaExtract() calls total for this run: the frame's own direct exclusion extraction
    // (Step 1, unmodified) and its D-BP153-017 complement (both empty of anything new -- the
    // direct read alone resolves the frame), then the named set's own DIRECT extraction (Step 2,
    // D-BP153-014) -- all read from the SAME single owned passage, exactly the way the real qid 98
    // evidence store held one passage answering both. The named set's own COMPLEMENT call finds
    // the queue exhausted and fails silently (gemmaExtract()'s own catch-and-return-null), which is
    // fine: the direct read alone already resolves this test's own arithmetic.
    global.fetch = queuedFetch([
      // Frame extraction (establishFrame(), unmodified) -- the real BP153 frame result: only
      // South America, South Asia, Northeast US, Europe were named legitimate world regions.
      // D-BP153-018: sourced from REAL_PASSAGE_S4 (the genuine, property-free category span), NOT
      // S1 -- S1 states only the superlative PROPERTY and is exactly the span the live qid 98 bug
      // wrongly used for this same claim; see REAL_PASSAGE_S4's own comment above for why.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S4 })),
        stated_in_passage: true,
      }),
      // D-BP153-017, THE DOUBLECHECK: establishFrame()'s own complement extraction against the
      // SAME owned passage -- empty (nothing stated in that shape); the direct exclusion read
      // above already resolved the frame.
      JSON.stringify({ members: [], stated_in_passage: false }),
      // Named-set extraction (extractNamedSetMembers(), this ticket).
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED -- the whole point of the terminator' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(REAL_PASSAGE)],
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

  // D-BP153-015, BEHAVIOR CHANGE FROM BEFORE THIS TICKET, RECORDED HERE. Before STAGE D existed, a
  // non-unique, 2-candidate STAGE M result fell straight through to Stage A's litmus-strip loop
  // (the title and assertions below used to say exactly that). STAGE D now fires in between --
  // "fires ONLY when STAGE M leaves more than one candidate" -- and its own PUBLISH-or-ABSTAIN
  // result is terminal, so Stage A is no longer reached for this case. See classify_cascade.ts's
  // own "STAGE D: THE DISCRIMINATOR" section header for the full derivation, and
  // classify_cascade.discriminator.test.ts for STAGE D's own dedicated coverage (owned-evidence-
  // first, one query never one per candidate, the required POSITIVE/NEGATIVE tests).
  test('D-BP153-015: not-unique named set -> STAGE D (the discriminator) fires and terminates the route; Stage A is no longer reached for this case', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Frame extraction: same real frame as above.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
      // D-BP153-017, THE DOUBLECHECK: establishFrame()'s own complement extraction against the
      // same owned passage -- empty; the direct exclusion read above already resolved the frame.
      JSON.stringify({ members: [], stated_in_passage: false }),
      // Named-set direct extraction: only TWO of the three members named -- not unique (candidates {A,E}).
      JSON.stringify({
        members: ['South Asia', 'Northeast United States'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
      // Named-set complement extraction (D-BP153-014's own second gemmaExtract() call): REAL_PASSAGE
      // states nothing in complement shape for this reduced reading -- nothing stated.
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // STAGE D's own owned-evidence attempt against the SAME passage: REAL_PASSAGE is about
      // density, not KIND -- nothing extractable, falls through to STAGE D's one query below.
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
    ]);
    // STAGE D spends its own ONE query here (never Stage A's several) -- askGoogle returns
    // challengeDetected, so it aborts fast (0 retries) and ABSTAINS naming {A, E}. That abstain is
    // now the terminal result of this route: Stage A's litmus-strip loop is never reached, which is
    // the entire point of this ticket -- an honest ABSTAIN naming the survivors replaces the old
    // silent fall-through into a magnitude ranking that had no principled distinction to rank on.
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

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      expect(outcome.basis).not.toMatch(/MEMBERSHIP TERMINATOR/);
      expect(outcome.basis).toMatch(/DISCRIMINATOR/);
      expect(outcome.abstain).toBe(true);
      expect(outcome.verdict).toBeNull();
      const stageNotes = events.filter((e) => e.kind === 'stage').map((e) => e.text);
      expect(stageNotes.some((t) => /STAGE M/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE D/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE A/.test(t))).toBe(false); // no longer reached -- STAGE D terminates
      expect(askGoogle).toHaveBeenCalledTimes(1); // STAGE D's own ONE query, never Stage A's several
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('named set UNAVAILABLE (owned passage yields nothing, fresh query also comes back nothing) -> falls through to the existing magnitude path unchanged', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Frame extraction (Step 1, unmodified): resolves fine from the owned passage, as always.
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
      // D-BP153-017, THE DOUBLECHECK: establishFrame()'s own complement extraction against the
      // same owned passage -- empty; the direct exclusion read above already resolved the frame.
      JSON.stringify({ members: [], stated_in_passage: false }),
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
        ownedPassages: () => [owned(REAL_PASSAGE)],
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
