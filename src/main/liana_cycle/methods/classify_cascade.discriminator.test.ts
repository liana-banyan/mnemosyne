// classify_cascade.discriminator.test.ts -- D-BP153-015/BISHOP/seg-discriminator
// UPDATED D-BP153-016/BISHOP/seg-classify-016 (typed passages, verify-the-span)
//
// STAGE D, THE DISCRIMINATOR. Fires ONLY when STAGE M (the membership terminator,
// classify_cascade.membership_terminator.test.ts) leaves MORE THAN ONE candidate. See
// classify_cascade.ts's own "STAGE D: THE DISCRIMINATOR" section header for the full derivation
// and TICKET_D-BP153-015_THE_DISCRIMINATOR.md for the Founder's rulings this implements.
//
// D-BP153-016 UPDATE. `ownedPassages()` now returns typed `OwnedPassage[]` (text + kind), not bare
// strings (FD-BP153-07 FIX 1), and every extracted kind (and category_kind) must carry a verbatim
// SUPPORTING SPAN (FIX 2). A passage naming NONE of the candidates under test is rejected before
// extraction is even attempted (FIX 3) -- FRAME_PASSAGE (below) never names South America, North
// Africa, or Central Asia, so the wiring tests' own STAGE D owned-evidence attempt against it is
// now a mechanical, no-query rejection rather than an extraction that honestly finds nothing; the
// end-to-end outcomes are unchanged (see the inline notes at each wiring test).
//
// THE REAL FIXTURE, verbatim (never paraphrased, same passage
// classify_cascade.named_set_recall.test.ts already quotes as its own REAL_PASSAGE, and the exact
// passage the ticket's own "WHY THIS EXISTS" section quotes):
const WHY_PASSAGE_S1 = 'Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
  + "H (Amazon Rainforest), and I (Sahara Desert) are all correct choices because none of them are "
  + 'considered major high-density global population clusters.';
const WHY_PASSAGE_S2 = 'Only B (South Asia), D (Northeast United States), and E (Europe) qualify as '
  + 'densely populated regions on a global scale.';
const WHY_PASSAGE = `${WHY_PASSAGE_S1} ${WHY_PASSAGE_S2}`;
// A SEPARATE passage stating the frame's own biome exclusion -- the ticket's own WHY section notes
// the live run's frame came from a DIFFERENT passage than the named-set passage above; this mirrors
// that split rather than inventing a single passage that does both jobs.
const FRAME_PASSAGE = 'G (Arctic Circle), H (Amazon Rainforest), and I (Sahara Desert) represent the extreme '
  + 'sparsely populated biomes (cold, wet, and dry lands), not world regions.';

import { describe, test, expect, vi } from 'vitest';
import {
  runDiscriminator, applyDiscriminatorElimination, runSuperlativeByMagnitude, extractSuperlativeMatch,
} from './classify_cascade';
import type { MethodRunContext, MethodQuestionInput, OwnedPassage } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

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
const CATEGORY = 'world regions';
// STAGE M's own real output on the WHY_PASSAGE/FRAME_PASSAGE pair: legitimate regions {A,B,C,D,E,F}
// (frame excludes G,H,I) minus named-set members {B,D,E} = {A,C,F} -- South America, North Africa,
// Central Asia. Not re-derived here as arithmetic (classify_cascade.membership_terminator.test.ts
// already covers runMembershipTerminator() itself) -- this file starts from that result and tests
// what STAGE D does with it.
const CANDIDATES = ['A', 'C', 'F'];
const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

// D-BP153-016: wraps a bare passage string as an OwnedPassage of kind 'operation'.
const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

/** Same convention every classify_cascade.*.test.ts sibling already uses -- queues canned Ollama
 *  /api/generate JSON responses, one per gemmaExtract() call, in order. See
 *  classify_cascade.owned_evidence_frame.test.ts's own header (D-BP153-012) for why the cast to
 *  `typeof fetch` is narrow and deliberate. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

describe('applyDiscriminatorElimination() -- STAGE D pure arithmetic, no I/O', () => {
  test('all candidates known, distinct kinds, categoryKind matches one -- eliminates the mismatches, unique survivor', () => {
    const result = applyDiscriminatorElimination(
      CANDIDATES,
      { A: 'Continent', C: 'Colloquial area', F: 'Colloquial area' },
      'Continent',
      CATEGORY,
      OPT,
    );
    expect(result.unique).toBe('A');
    expect(result.survivors).toEqual(['A']);
    expect(result.eliminations.map((e) => e.letter).sort()).toEqual(['C', 'F']);
    expect(result.eliminations.every((e) => /Colloquial area/.test(e.reason))).toBe(true);
  });

  test('partial information (one candidate has no stated kind) -- no elimination performed', () => {
    const result = applyDiscriminatorElimination(
      CANDIDATES,
      { A: 'Continent', C: 'Colloquial area', F: null },
      'Continent',
      CATEGORY,
      OPT,
    );
    expect(result.unique).toBeNull();
    expect(result.survivors).toEqual(CANDIDATES);
    expect(result.eliminations).toEqual([]);
    expect(result.why).toMatch(/partial information does not eliminate/);
  });

  test('all candidates share the same stated kind -- no distinction to eliminate on', () => {
    const result = applyDiscriminatorElimination(
      CANDIDATES,
      { A: 'Continent', C: 'Continent', F: 'Continent' },
      'Continent',
      CATEGORY,
      OPT,
    );
    expect(result.unique).toBeNull();
    expect(result.survivors).toEqual(CANDIDATES);
    expect(result.eliminations).toEqual([]);
    expect(result.why).toMatch(/no distinction to eliminate on/);
  });

  test('kinds differ but the category kind was never stated -- no elimination (never assumed)', () => {
    const result = applyDiscriminatorElimination(
      CANDIDATES,
      { A: 'Continent', C: 'Colloquial area', F: 'Colloquial area' },
      null,
      CATEGORY,
      OPT,
    );
    expect(result.unique).toBeNull();
    expect(result.survivors).toEqual(CANDIDATES);
    expect(result.eliminations).toEqual([]);
    expect(result.why).toMatch(/does not state which kind properly denotes/);
  });

  test('stated category kind does not match any candidate kind present -- unusable, no elimination', () => {
    const result = applyDiscriminatorElimination(
      CANDIDATES,
      { A: 'Continent', C: 'Colloquial area', F: 'Colloquial area' },
      'Subcontinent',
      CATEGORY,
      OPT,
    );
    expect(result.unique).toBeNull();
    expect(result.survivors).toEqual(CANDIDATES);
    expect(result.eliminations).toEqual([]);
    expect(result.why).toMatch(/does not match any of them/);
  });

  test('never a tiebreak: two candidates share the category kind -- abstain naming both, not forced', () => {
    const result = applyDiscriminatorElimination(
      CANDIDATES,
      { A: 'Continent', C: 'Colloquial area', F: 'Continent' },
      'Continent',
      CATEGORY,
      OPT,
    );
    expect(result.unique).toBeNull();
    expect(new Set(result.survivors)).toEqual(new Set(['A', 'F']));
    expect(result.eliminations.map((e) => e.letter)).toEqual(['C']);
  });

  test('pure: does not mutate its input', () => {
    const candidates = [...CANDIDATES];
    const kinds = { A: 'Continent', C: 'Colloquial area', F: 'Colloquial area' };
    applyDiscriminatorElimination(candidates, kinds, 'Continent', CATEGORY, OPT);
    expect(candidates).toEqual(CANDIDATES);
    expect(kinds).toEqual({ A: 'Continent', C: 'Colloquial area', F: 'Colloquial area' });
  });
});

describe('runDiscriminator() -- STAGE D, owned-evidence-first (mirrors establishFrame()/extractNamedSetMembers())', () => {
  test('TEST 1: candidates.length <= 1 -- discriminator never fires, no query issued', async () => {
    const askGoogle = vi.fn(async () => { throw new Error('must never be called -- candidates.length <= 1'); });
    const { note, log } = notes();
    const result = await runDiscriminator(
      askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ['A'], OPT, note,
    );
    expect(askGoogle).not.toHaveBeenCalled();
    expect(result.answeredFrom).toBe('not-fired');
    expect(result.unique).toBe('A');
    expect(log.length).toBe(0);
  });

  test('TEST 2: an owned passage stating a distinction resolves with ZERO queries, receipt says FROM OWNED EVIDENCE', async () => {
    const originalFetch = global.fetch;
    const s1 = "According to Google's own entity classification, South America is labeled a Continent.";
    const s2 = 'North Africa is labeled a Colloquial area, not a formally defined world region.';
    const s3 = 'Central Asia is also labeled a Colloquial area.';
    const s4 = 'Only a Continent is properly considered a world region.';
    const ownedPassage = `${s1} ${s2} ${s3} ${s4}`;
    global.fetch = queuedFetch([
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: s1 },
          { name: 'North Africa', kind: 'Colloquial area', span: s2 },
          { name: 'Central Asia', kind: 'Colloquial area', span: s3 },
        ],
        category_kind: 'Continent',
        category_kind_span: s4,
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note, () => [owned(ownedPassage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(result.unique).toBe('A');
      expect(result.answeredFrom).toBe('owned-passage');
      expect(result.ownedPassageIndex).toBe(0);
      expect(result.eliminations.map((e) => e.letter).sort()).toEqual(['C', 'F']);
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l) && /passage 1 of 1/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 3: nothing owned -- exactly ONE query issued, never one per candidate', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America, North Africa, and Central Asia are each large geographic areas.' }));
    try {
      const { note, log } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note,
      );
      expect(askGoogle).toHaveBeenCalledTimes(1); // ONE query for THREE candidates, never one each
      expect(result.answeredFrom).toBe('new-query');
      expect(log.some((l) => l.includes('DISCRIMINATOR:') && l.includes('What kind of'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 4, NEGATIVE (required): source states no usable distinction -- ABSTAIN, all candidates named, no elimination performed', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America, North Africa, and Central Asia are each large regions of the world, spanning many countries.' }));
    try {
      const { note } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note,
      );
      expect(result.unique).toBeNull();
      expect(new Set(result.survivors)).toEqual(new Set(CANDIDATES));
      expect(result.eliminations).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // D-BP153-023 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to assert that a SINGLE owned
  // passage stating a kind for only SOME survivors TERMINATED the step right there (`askGoogle`
  // asserted never called, "no elimination performed" as the final answer with zero queries spent).
  // That is the SAME premature-termination shape D-BP153-023 closes for THE SOFTBALLS/THE NAMED SET,
  // applied here to STAGE D's own completeness notion (a stated kind for EVERY candidate, not just
  // some): partial per-candidate coverage is not an answer and must fall through to a fresh query.
  // This test now supplies a fresh-query response too (the SAME partial shape, still missing Central
  // Asia -- proving the safety net is unchanged: an incomplete fresh query is still the final,
  // no-elimination answer) and asserts the ONE query D-BP153-023 now spends where the old code spent
  // zero.
  test('TEST 5: a distinction stated for only SOME survivors -- INCOMPLETE, falls through to a fresh query (D-BP153-023); the fresh query is ALSO incomplete, so no elimination is performed (safety net unchanged)', async () => {
    const originalFetch = global.fetch;
    const s1 = 'South America is a Continent.';
    const s2 = 'North Africa is a Colloquial area.';
    const passage = `${s1} ${s2} Central Asia is not characterized in this passage at all.`;
    global.fetch = queuedFetch([
      // Owned passage: South America and North Africa get a stated kind, Central Asia does not --
      // INCOMPLETE (missingKind = [F]), falls through instead of terminating.
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: s1 },
          { name: 'North Africa', kind: 'Colloquial area', span: s2 },
        ],
        category_kind: 'Continent',
        category_kind_span: s1,
        stated_in_passage: true,
      }),
      // The fresh query (D-BP153-023's own fall-through, never reached before this ticket): the SAME
      // partial shape comes back -- Central Asia still uncharacterized -- proving the safety net
      // (partial information does not eliminate) still holds unchanged.
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: 'South America is a Continent, per this source.' },
          { name: 'North Africa', kind: 'Colloquial area', span: 'North Africa is a Colloquial area, per this source.' },
        ],
        category_kind: 'Continent',
        category_kind_span: 'South America is a Continent, per this source.',
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America is a Continent, per this source. North Africa is a Colloquial area, per this source.' }));
    try {
      const { note, log } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note, () => [owned(passage)],
      );
      // D-BP153-023: ONE query issued -- the owned passage's partial kind coverage did NOT answer,
      // so it fell through instead of terminating with zero queries the way the old code did.
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(log.some((l) => /INCOMPLETE on owned passage/.test(l) && /D-BP153-023/.test(l) && /Central Asia/.test(l) && /falling through/.test(l))).toBe(true);
      expect(result.answeredFrom).toBe('new-query');
      expect(result.unique).toBeNull();
      expect(new Set(result.survivors)).toEqual(new Set(CANDIDATES));
      expect(result.eliminations).toEqual([]);
      expect(result.why).toMatch(/partial information does not eliminate/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // D-BP153-023 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to supply only ONE owned passage
  // and assert `askGoogle` was never called even though the hallucination-discard left Central Asia's
  // kind unknown (a partial read that, before this ticket, still wrongly TERMINATED the step). Since
  // partial per-candidate coverage now falls through (D-BP153-023, same rule TEST 5 above exercises
  // against a fresh query), this test now adds a SECOND owned passage that fully and correctly
  // characterizes all three candidates, so the loop falls through from the hallucinated/incomplete
  // first passage to the complete second one -- still zero queries issued, and proving the
  // hallucination never contaminates the final trusted result.
  test('TEST 6: a span that does not actually contain the hallucinated kind is discarded, leaving the passage INCOMPLETE -- it falls through (D-BP153-023) to a second, complete owned passage; the hallucination never contaminates the final trusted result', async () => {
    const originalFetch = global.fetch;
    const s1 = 'South America is a Continent.';
    const s2 = 'North Africa is a Colloquial area.';
    const hallucinatedPassage = `${s1} ${s2}`;
    // A second, fully-characterized owned passage -- same shape TEST 2 (above) already uses.
    const t1 = "According to Google's own entity classification, South America is labeled a Continent.";
    const t2 = 'North Africa is labeled a Colloquial area, not a formally defined world region.';
    const t3 = 'Central Asia is also labeled a Colloquial area.';
    const t4 = 'Only a Continent is properly considered a world region.';
    const completePassage = `${t1} ${t2} ${t3} ${t4}`;
    // Model hallucinates a kind for Central Asia ("Subcontinent") the FIRST passage never states --
    // its only offered span is real passage text that never mentions "Subcontinent" at all, so it is
    // discarded, leaving that passage's own kind coverage INCOMPLETE (missingKind = [F]).
    global.fetch = queuedFetch([
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: s1 },
          { name: 'North Africa', kind: 'Colloquial area', span: s2 },
          { name: 'Central Asia', kind: 'Subcontinent', span: s1 },
        ],
        category_kind: 'Continent',
        category_kind_span: s1,
        stated_in_passage: true,
      }),
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: t1 },
          { name: 'North Africa', kind: 'Colloquial area', span: t2 },
          { name: 'Central Asia', kind: 'Colloquial area', span: t3 },
        ],
        category_kind: 'Continent',
        category_kind_span: t4,
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => { throw new Error('must never be called -- owned evidence answers on the second passage'); });
    try {
      const { note, log } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note,
        () => [owned(hallucinatedPassage), owned(completePassage)],
      );
      // D-BP153-023: the transcript names Central Asia as the unaccounted-for candidate and says the
      // step is falling through -- never silent about why the first passage did not answer.
      expect(log.some((l) => /INCOMPLETE on owned passage/.test(l) && /D-BP153-023/.test(l) && /Central Asia/.test(l) && /falling through/.test(l))).toBe(true);
      expect(askGoogle).not.toHaveBeenCalled();
      expect(result.answeredFrom).toBe('owned-passage');
      expect(result.ownedPassageIndex).toBe(1); // the SECOND passage answered, not the first
      // The hallucination never survives into the final result -- the trusted kinds come from the
      // second, verified passage.
      expect(result.kinds.A).toBe('Continent');
      expect(result.kinds.C).toBe('Colloquial area');
      expect(result.kinds.F).toBe('Colloquial area');
      expect(result.unique).toBe('A');
      expect(result.eliminations.map((e) => e.letter).sort()).toEqual(['C', 'F']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('runSuperlativeByMagnitude() wiring -- STAGE D fires when STAGE M leaves more than one candidate (D-BP153-015)', () => {
  test('TEST 7, REAL-FIXTURE END TO END: frame excludes G/H/I, members {B,D,E}, STAGE M yields {A,C,F}, STAGE D runs -- resolves on a stated distinction or abstains naming {A,C,F}; NEVER asserts the letter is A', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // STAGE 0 FRAME: owned[0]=FRAME_PASSAGE states the biomes explicitly -- resolves here.
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: FRAME_PASSAGE })),
        stated_in_passage: true,
      }),
      // D-BP153-017, THE DOUBLECHECK: establishFrame()'s own complement (which-IS-the-category)
      // extraction against the SAME owned[0]=FRAME_PASSAGE -- the passage states nothing in that
      // shape, so this is empty; the direct exclusion read above already resolved the frame.
      JSON.stringify({ members: [], stated_in_passage: false }),
      // STAGE M NAMED SET: owned[0]=FRAME_PASSAGE tried first, direct+complement -- off-topic, nothing.
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // STAGE M NAMED SET: owned[1]=WHY_PASSAGE, direct+complement -- resolves reconciled {B,D,E}.
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: WHY_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: WHY_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
      // STAGE D DISCRIMINATOR: owned[0]=FRAME_PASSAGE names NONE of the candidates {A,C,F} --
      // D-BP153-016 FIX 3 rejects it mechanically before extraction, so this queued (empty) response
      // is simply never consumed for it; owned[1]=WHY_PASSAGE DOES name all three candidates and
      // consumes the next slot, honestly stating no kind.
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
      // STAGE D DISCRIMINATOR: the one fresh query also comes back with no stated kind distinction.
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America, North Africa, and Central Asia are each large geographic areas.' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(FRAME_PASSAGE), owned(WHY_PASSAGE)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      const stageNotes = events.filter((e) => e.kind === 'stage').map((e) => e.text);
      expect(stageNotes.some((t) => /STAGE M/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE D/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE A/.test(t))).toBe(false); // STAGE D's own result is terminal here
      expect(askGoogle).toHaveBeenCalledTimes(1); // ONE query total (the discriminator's), not per candidate

      // THE POINT OF THIS TEST: do NOT assert outcome.verdict === 'A' -- assert the mechanism only.
      if (outcome.abstain) {
        expect(outcome.verdict).toBeNull();
        expect(outcome.basis).toMatch(/DISCRIMINATOR/);
        expect(outcome.basis).toContain('A) South America');
        expect(outcome.basis).toContain('C) North Africa');
        expect(outcome.basis).toContain('F) Central Asia');
      } else {
        expect(outcome.basis).toMatch(/stated kind/);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('REQUIRED POSITIVE (FD-BP153-06, TRAIN ON TRUTH RUN BLIND): the real-fixture end-to-end run derives A, and the receipt shows a STATED basis -- a correct letter with an unstated basis fails this test', async () => {
    const originalFetch = global.fetch;
    const ds1 = "According to Google's own entity classification, South America is labeled a Continent.";
    const ds2 = 'North Africa is labeled a Colloquial area, not a formally defined world region.';
    const ds3 = 'Central Asia is also labeled a Colloquial area.';
    const ds4 = 'Only a Continent is properly considered a world region.';
    const discriminatorPassage = `${ds1} ${ds2} ${ds3} ${ds4}`;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: FRAME_PASSAGE })),
        stated_in_passage: true,
      }),
      // D-BP153-017, THE DOUBLECHECK: establishFrame()'s own complement extraction against the
      // same owned[0]=FRAME_PASSAGE -- empty (nothing stated in that shape); the direct exclusion
      // read above already resolved the frame.
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: WHY_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: WHY_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
      // STAGE D DISCRIMINATOR: owned[0]=FRAME_PASSAGE names none of {A,C,F} -- FIX 3 rejects it
      // mechanically (no query consumed for it); owned[1]=WHY_PASSAGE names all three but states no
      // kind -- falls through to a NEW QUERY.
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
      // THE fresh query's own extraction -- this is where the STATED distinction comes from.
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: ds1 },
          { name: 'North Africa', kind: 'Colloquial area', span: ds2 },
          { name: 'Central Asia', kind: 'Colloquial area', span: ds3 },
        ],
        category_kind: 'Continent',
        category_kind_span: ds4,
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: discriminatorPassage }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [owned(FRAME_PASSAGE), owned(WHY_PASSAGE)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      // THE LETTER:
      expect(outcome.abstain).toBe(false);
      expect(outcome.verdict).toBe('A');
      expect(outcome.ok).toBe(true);
      // THE STATED BASIS -- FD-BP153-06: a correct letter with an unstated basis is a BP149 repeat
      // and must fail this test. This asserts the receipt actually names the stated distinction, not
      // just the bare letter.
      expect(outcome.basis).toMatch(/DISCRIMINATOR/);
      expect(outcome.basis).toContain('Continent');
      expect(outcome.basis).toContain('Colloquial area');
      expect(outcome.basis).toMatch(/stated kind/);

      const stageNotes = events.filter((e) => e.kind === 'stage').map((e) => e.text);
      expect(stageNotes.some((t) => /STAGE D/.test(t))).toBe(true);
      expect(stageNotes.some((t) => /STAGE A/.test(t))).toBe(false);
      expect(askGoogle).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
