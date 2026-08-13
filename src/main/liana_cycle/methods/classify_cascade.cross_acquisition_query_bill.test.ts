// classify_cascade.cross_acquisition_query_bill.test.ts -- D-BP154-008/BISHOP/S8/seg-mortgage
//
// THE MORTGAGE, EXERCISED AGAINST THE REAL, UNMODIFIED classify_cascade.ts EXTRACTION PIPELINE.
//
// Ticket: TICKET_D-BP154-008_THE_MORTGAGE.md. This file proves the boundary lift
// (method_registry.ts's OwnedPassage.acquisitionId, FD-BP153-04 boundary 4) is READ correctly by
// code that already existed and is UNMODIFIED here: establishFrame()'s owned-passage loop, FIX 1
// (REJECTED_OWNED_PASSAGE_KINDS, an ambiguity-kind passage may never source a what-IS claim), FIX
// 2 (verify-the-span, a value with no verbatim span is discarded and counted), and THE QUERY
// BILL's new PRIOR ACQUISITION bucket (classify_cascade.ts, noteOwnedSource()/queryBillNote()).
//
// Same offline convention every classify_cascade.*.test.ts sibling uses: askGoogle is a local
// stub, global.fetch (gemmaExtract()'s own Ollama channel) is monkey-patched per test. Nothing
// live, nothing touching the real evidence store (this file never imports evidence_store.ts --
// `OwnedPassage.acquisitionId` etc. are set directly on plain test fixtures, exactly as every
// other classify_cascade.*.test.ts sibling builds its `owned()` fixtures).

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });
import { establishFrame, runSuperlativeByMagnitude, extractSuperlativeMatch } from './classify_cascade';
import type { MethodRunContext, MethodQuestionInput, OwnedPassage } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States',
  E: 'Europe', F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);
const CATEGORY = 'world regions';
const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

const PRIOR_ACQUISITION_ID = 'EVIDENCE_qid98_2026-08-10T03-00-00-000Z_priortest';
const PRIOR_ACQUIRED_AT = '2026-08-10T03:00:00.000Z';
const PRIOR_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours, arbitrary but fixed

/** A live, THIS-RUN owned passage -- no `acquisitionId` -- exactly the shape every existing
 *  classify_cascade.*.test.ts sibling's own `owned()` helper already builds. */
const owned = (text: string, kind = 'operation'): OwnedPassage => ({ text, kind });

/** A passage reused from a PRIOR acquisition (D-BP154-008) -- the ONLY difference from `owned()`
 *  above is the three provenance fields method_registry.ts's OwnedPassage now carries. */
const ownedPrior = (text: string, kind = 'operation'): OwnedPassage => ({
  text, kind, acquisitionId: PRIOR_ACQUISITION_ID, acquiredAt: PRIOR_ACQUIRED_AT, ageMsAtUse: PRIOR_AGE_MS,
});

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

const REAL_PASSAGE_S1 = 'Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
  + "H (Amazon Rainforest), and I (Sahara Desert) are all correct choices because none of them are "
  + 'considered major high-density global population clusters.';
const REAL_PASSAGE_S2 = 'Only B (South Asia), D (Northeast United States), and E (Europe) qualify as '
  + 'densely populated regions on a global scale.';
const REAL_PASSAGE_S3 = "South America (A), South Asia (B), Northeast United States (D), and Europe (E) "
  + "are each classified as a 'candidate region', the proper denotation of a world region. North "
  + "Africa (C) and Central Asia (F) are classified as a 'colloquial area', not a world region. Arctic "
  + "Circle (G), Amazon Rainforest (H), and Sahara Desert (I) are classified as a 'biome', not a world "
  + 'region.';
const REAL_PASSAGE = `${REAL_PASSAGE_S1} ${REAL_PASSAGE_S2} ${REAL_PASSAGE_S3}`;
const FRAME_KINDS_RESPONSE = JSON.stringify({
  kinds: [
    { name: 'South America', kind: 'candidate region', span: REAL_PASSAGE_S3 },
    { name: 'South Asia', kind: 'candidate region', span: REAL_PASSAGE_S3 },
    { name: 'North Africa', kind: 'colloquial area', span: REAL_PASSAGE_S3 },
    { name: 'Northeast United States', kind: 'candidate region', span: REAL_PASSAGE_S3 },
    { name: 'Europe', kind: 'candidate region', span: REAL_PASSAGE_S3 },
    { name: 'Central Asia', kind: 'colloquial area', span: REAL_PASSAGE_S3 },
    { name: 'Arctic Circle', kind: 'biome', span: REAL_PASSAGE_S3 },
    { name: 'Amazon Rainforest', kind: 'biome', span: REAL_PASSAGE_S3 },
    { name: 'Sahara Desert', kind: 'biome', span: REAL_PASSAGE_S3 },
  ],
  category_kind: 'candidate region',
  category_kind_span: REAL_PASSAGE_S3,
  stated_in_passage: true,
});

describe('D-BP154-008 TEST 1 -- FAIL-BEFORE / PASS-AFTER, actually performed', () => {
  test('BEFORE: no owned evidence at all -> a fresh query IS issued', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false })]);
    const askGoogle = vi.fn(async () => ({ snippet: 'off-topic, names no option' }));
    try {
      const { note } = notes();
      await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => []);
      expect(askGoogle).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('AFTER: the SAME frame, now owned by a PRIOR ACQUISITION -> answered with NO query issued', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([FRAME_KINDS_RESPONSE]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [ownedPrior(REAL_PASSAGE)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.ownedPassageIndex).toBe(0);
      // REAL_PASSAGE_S3's own kinds: {A,B,D,E} = candidate region (the category kind), {C,F} =
      // colloquial area, {G,H,I} = biome -- excluded is everything that differs from the category
      // kind, i.e. C, F, G, H, I.
      expect(new Set(frame.excluded)).toEqual(new Set(['C', 'F', 'G', 'H', 'I']));
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-008 TEST 4 -- an ambiguity-kind passage from a PRIOR acquisition is REJECTED for a what-IS claim', () => {
  test('the EXISTING FD-BP153-07 FIX 1 rejection fires identically on a prior-acquisition-sourced ambiguity passage', async () => {
    const originalFetch = global.fetch;
    // Falls through to the fresh query after rejection -- one gemma call for that fresh draw.
    global.fetch = queuedFetch([JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false })]);
    const askGoogle = vi.fn(async () => ({ snippet: 'off-topic, names no option' }));
    const ambiguityPassage = 'If "populated" is read ecologically instead of by human census, several of these '
      + 'options would flip which side of the category they fall on -- South America (A), South Asia (B).';
    try {
      const { note, log } = notes();
      await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [ownedPrior(ambiguityPassage, 'ambiguity')],
      );
      // The passage was REJECTED (never extracted from), so the run had nothing usable and fell
      // through to a fresh query -- proving the rejection actually fired rather than being skipped.
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(log.some((l) => /REJECTED an owned passage of kind 'ambiguity'/.test(l))).toBe(true);
      expect(log.some((l) => /FD-BP153-07 FIX 1/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-008 TEST 5 -- a value with no verbatim span from a PRIOR acquisition is DISCARDED and counted', () => {
  test('the EXISTING FD-BP153-07 FIX 2 verify-the-span discard fires identically on reused evidence', async () => {
    const originalFetch = global.fetch;
    // gemmaExtract() claims a span that does NOT appear verbatim in the prior-acquisition passage
    // below (the real passage never says this sentence) -- FIX 2 must discard it regardless of
    // where the passage came from. The frame is left with an incomplete stated-kind read (only 3 of
    // 9 options got a REAL span), so it falls through to the fresh query afterward.
    const FABRICATED_SPAN = 'This exact sentence does not appear anywhere in the real passage.';
    global.fetch = queuedFetch([
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'candidate region', span: REAL_PASSAGE_S3 },
          { name: 'South Asia', kind: 'candidate region', span: REAL_PASSAGE_S3 },
          { name: 'North Africa', kind: 'colloquial area', span: REAL_PASSAGE_S3 },
          { name: 'Northeast United States', kind: 'candidate region', span: FABRICATED_SPAN },
          { name: 'Europe', kind: 'candidate region', span: FABRICATED_SPAN },
          { name: 'Central Asia', kind: 'colloquial area', span: FABRICATED_SPAN },
          { name: 'Arctic Circle', kind: 'biome', span: FABRICATED_SPAN },
          { name: 'Amazon Rainforest', kind: 'biome', span: FABRICATED_SPAN },
          { name: 'Sahara Desert', kind: 'biome', span: FABRICATED_SPAN },
        ],
        category_kind: 'candidate region',
        category_kind_span: REAL_PASSAGE_S3,
        stated_in_passage: true,
      }),
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }), // fresh-query fallback draw
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'off-topic, names no option' }));
    try {
      const { note, log } = notes();
      await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [ownedPrior(REAL_PASSAGE)],
      );
      expect(log.some((l) => /discarded \d+ value\(s\) with no verbatim supporting span/.test(l))).toBe(true);
      // The incomplete read (6 of 9 discarded) fell through to a fresh query -- proving the discard
      // was real, not a silent pass.
      expect(askGoogle).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-008 TESTS 6/7 -- THE QUERY BILL: PRIOR ACQUISITION bucket, provenance, and reconciliation', () => {
  test('THE SOFTBALLS and THE NAMED SET both resolve from a PRIOR acquisition -- 0 queries issued, bucketed separately from OWNED EVIDENCE (this run), provenance named for each', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      FRAME_KINDS_RESPONSE, // THE SOFTBALLS
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }), // THE NAMED SET, direct
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        ownedPassages: () => [ownedPrior(REAL_PASSAGE)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      const outcome = await runSuperlativeByMagnitude(input, ctx, match);

      expect(askGoogle).not.toHaveBeenCalled();
      expect(outcome.verdict).toBe('A');

      const notesTexts = events.filter((e) => e.kind === 'note').map((e) => e.text);
      const bill = notesTexts.find((t) => /QUERY BILL/.test(t));
      expect(bill).toBeDefined();

      // TEST 6: the bucket counts sum to the questions actually attempted -- 0 answered from
      // OWNED EVIDENCE (this run, none supplied), 2 answered from a PRIOR ACQUISITION, 0 new.
      expect(bill).toMatch(/0 of 2 question\(s\) asked \(THE SOFTBALLS, THE NAMED SET\) answered from OWNED EVIDENCE/);
      expect(bill).toMatch(/2 of 2 question\(s\) answered from a PRIOR ACQUISITION \(D-BP154-008, FD-BP153-04 boundary 4 lifted\), no new query \(THE SOFTBALLS, THE NAMED SET\)/);
      // Pre-existing D-BP153-028 leading clause and authority split are UNCHANGED.
      expect(bill).toMatch(new RegExp(`${askGoogle.mock.calls.length} quer`));
      expect(bill).toMatch(/\(0 to the conversational authority, 0 to Google\)/);

      // TEST 7: provenance named for EVERY reused passage -- acquisition id, timestamp, age.
      const provenanceLines = notesTexts.filter((t) => /REUSED EVIDENCE PROVENANCE/.test(t));
      expect(provenanceLines.length).toBeGreaterThanOrEqual(1);
      expect(provenanceLines.some((l) => l.includes(PRIOR_ACQUISITION_ID))).toBe(true);
      expect(provenanceLines.some((l) => l.includes(PRIOR_ACQUIRED_AT))).toBe(true);
      expect(provenanceLines.some((l) => /age .* at time of use/.test(l))).toBe(true);
      // Never a staleness/cutoff decision named in the transcript -- reporting only.
      expect(provenanceLines.every((l) => !/stale|expired|too old|cutoff/i.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('a MIX -- THE SOFTBALLS from a PRIOR acquisition, THE NAMED SET from THIS RUN\'s own -- buckets each correctly, never conflating the two', async () => {
    const originalFetch = global.fetch;
    // owned[0] (the PRIOR passage) carries ONLY the frame-kind statement (S1+S3), never S2 (the
    // named-set statement) -- so THE SOFTBALLS resolves on owned[0], but THE NAMED SET's own
    // direct+complement attempt against owned[0] comes back empty on BOTH sides and falls through
    // to owned[1] (THIS RUN's own, full REAL_PASSAGE, which DOES carry S2).
    const FRAME_ONLY_PASSAGE = `${REAL_PASSAGE_S1} ${REAL_PASSAGE_S3}`;
    global.fetch = queuedFetch([
      FRAME_KINDS_RESPONSE, // THE SOFTBALLS, resolves on owned[0] (the PRIOR passage)
      JSON.stringify({ members: [], stated_in_passage: false }), // NAMED SET direct on owned[0] -- empty
      JSON.stringify({ not_members: [], stated_in_passage: false }), // NAMED SET complement on owned[0] -- empty
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }), // NAMED SET direct on owned[1] (THIS RUN's own) -- real members
      JSON.stringify({ not_members: [], stated_in_passage: false }), // NAMED SET complement on owned[1]
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'THIS MUST NEVER BE REACHED' }));
    try {
      const events: LianaTerminalEvent[] = [];
      const ctx: MethodRunContext = {
        askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
        emit: (e) => events.push(e),
        // owned[0] is the PRIOR acquisition (answers THE SOFTBALLS); owned[1] is THIS RUN's own
        // (answers THE NAMED SET) -- exercises both buckets in one run.
        ownedPassages: () => [ownedPrior(FRAME_ONLY_PASSAGE), owned(REAL_PASSAGE)],
      };
      const input: MethodQuestionInput = { qid: 98, question: QUESTION, options: OPT, correctAnswer: 'A' };
      const match = extractSuperlativeMatch(QUESTION)!;

      await runSuperlativeByMagnitude(input, ctx, match);
      expect(askGoogle).not.toHaveBeenCalled();

      const notesTexts = events.filter((e) => e.kind === 'note').map((e) => e.text);
      const bill = notesTexts.find((t) => /QUERY BILL/.test(t));
      expect(bill).toMatch(/1 of 2 question\(s\) asked \(THE SOFTBALLS, THE NAMED SET\) answered from OWNED EVIDENCE, no new query \(THE NAMED SET\)/);
      expect(bill).toMatch(/1 of 2 question\(s\) answered from a PRIOR ACQUISITION \(D-BP154-008, FD-BP153-04 boundary 4 lifted\), no new query \(THE SOFTBALLS\)/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
