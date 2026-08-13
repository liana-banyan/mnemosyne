// classify_cascade.named_set_recall.test.ts -- D-BP153-014/BISHOP/seg-classify-recall-fix
// UPDATED D-BP153-016/BISHOP/seg-classify-016 (typed passages, verify-the-span)
//
// THREE BUGS, ONE DISPATCH. Bishop's own diagnosis, not re-derived here:
//
//   BUG 1: extractNamedSetMembers() under-recalls a stated list. Measured live: the real qid 98
//   passage below states "Only B (South Asia), D (Northeast United States), and E (Europe) ...",
//   and the OLD instruction (namedSetExtractionInstruction(), before this ticket) extracted only
//   {B, E} from it -- D was dropped. Attacked two ways: (a) SHARPEN the extraction instruction to
//   name the "Only X, Y, and Z" list shape explicitly and say a partial copy is wrong; (b) EXTRACT
//   THE COMPLEMENT TOO (the passage states non-membership more directly: "Options A, C, F, G, H, I
//   ... are all NOT considered...") and RECONCILE the two independent reads -- see
//   reconcileNamedSet() in classify_cascade.ts for the pure set arithmetic.
//
//   BUG 2 (this file's own regression): an empty passage must never reach either extraction. See
//   the dedicated test below and its sibling for establishFrame() in
//   classify_cascade.owned_evidence_frame.test.ts.
//
// D-BP153-016 UPDATE. `ownedPassages()` now returns typed `OwnedPassage[]` (text + kind), not bare
// strings (FD-BP153-07 FIX 1), and every extracted value must carry a verbatim SUPPORTING SPAN
// (FIX 2). This file's mocked gemmaExtract() JSON is updated in place to the new shape.
//
// THE REAL PASSAGE, verbatim from the live run (this ticket's own fixture, never paraphrased):
const REAL_PASSAGE_S1 = 'Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
  + "H (Amazon Rainforest), and I (Sahara Desert) are all correct choices because none of them are "
  + 'considered major high-density global population clusters.';
const REAL_PASSAGE_S2 = 'Only B (South Asia), D (Northeast United States), and E (Europe) qualify as '
  + 'densely populated regions on a global scale.';
const REAL_PASSAGE = `${REAL_PASSAGE_S1} ${REAL_PASSAGE_S2}`;

import { describe, test, expect, vi } from 'vitest';
import { extractNamedSetMembers, reconcileNamedSet } from './classify_cascade';
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

describe('D-BP153-014 BUG-1: extractNamedSetMembers() recall, real fixture', () => {
  // D-BP153-020 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to assert that the complement
  // recovered D purely because D was absent from the direct extraction -- i.e. that "D is a member"
  // was DERIVED from D's absence on the complement's own non-member list, not from either extraction
  // actually stating it. That is the identical arithmetic the live qid 98 bug (D-BP153-020's own
  // ticket, receipt LIANA_RUN_qid98_2026-08-13T00-54-31-659Z.json) used to manufacture seven
  // exclusions from a complement that named only two options. This fixture was encoding the bug it
  // happened to get right by coincidence (the real passage genuinely does state D is a member,
  // elsewhere) -- under FD-BP153-07's completeness gate, a direct+complement union that leaves D
  // unaccounted for (8 of 9 covered, D missing from BOTH lists) trusts NOTHING, not "trust it anyway
  // because it's probably right." See classify_cascade.complete_partition_required.test.ts for the
  // dedicated coverage of the new gate; this test now asserts the corrected behavior on the SAME
  // real fixture rather than re-deriving a different one.
  // D-BP153-023 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to assert that this single owned
  // passage's INCOMPLETE PARTITION TERMINATED the step right there (`answeredFrom: 'owned-passage'`,
  // zero queries issued). That IS the live measured bug D-BP153-023 closes (receipt
  // LIANA_RUN_qid98_2026-08-13T02-05-04-911Z.json): an INCOMPLETE partition is not an answer and
  // must fall through to a fresh query. This test now supplies a fresh-query response too (the SAME
  // under-recalled shape, still incomplete -- the safety net, D-BP153-020, unchanged) and asserts
  // the ONE query D-BP153-023 now spends where the old code spent zero.
  // D-BP153-026 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to assert exactly ONE fresh
  // query -- the fresh query's own under-recalled result was the final word. D-BP153-026 now
  // spends one targeted completion follow-up naming the ONE still-unaccounted option (D). Here
  // askGoogle's mock always returns the full REAL_PASSAGE (which genuinely does state D's
  // membership, in REAL_PASSAGE_S2's "Only B..., D..., and E..." sentence) -- but the follow-up's
  // own gemmaExtract() calls re-hit the SAME under-recall the first pass measured (the queued
  // response for the follow-up's direct read still drops D, exactly like the first pass, proving
  // the defect is a recall problem, not a passage-availability one) -- so the union is STILL
  // incomplete (D remains unaccounted for) and NOTHING is trusted, same as before this ticket,
  // now over 2 queries instead of 1.
  test('HEADLINE, D-BP153-026 UPDATED: the direct side under-recalls D and the complement does not name it either -- INCOMPLETE (8 of 9), falls through to a fresh query that is ALSO incomplete, so its one completion follow-up (D-BP153-026) is issued naming ONLY D, and it ALSO under-recalls D, so NOTHING is trusted, not a coincidentally-correct {B, D, E}', async () => {
    const originalFetch = global.fetch;
    // Simulates the MEASURED live extraction (a partial copy, D dropped) on the direct-member side
    // -- exactly what BUG-1 reports gemma4:12b actually returned for this passage -- and the
    // passage's own, more-explicit complement statement on the non-member side. Neither mock is
    // hand-picked to make the test pass by construction: the direct side is the REAL measured
    // defect, and the complement side is what the SAME passage states in its first sentence,
    // verbatim.
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })), // direct: under-recalled, D dropped
        stated_in_passage: true,
      }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })), // complement: the passage's own first sentence, in full
        stated_in_passage: true,
      }),
      // The fresh query (D-BP153-023's own fall-through, never reached before this ticket): the SAME
      // under-recalled shape comes back, proving the safety net (D-BP153-020) still holds unchanged.
      JSON.stringify({
        members: ['South Asia', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
      // D-BP153-026's own ONE completion follow-up: uncovered = {D} only, so the follow-up asks
      // ONLY about D. Its returned passage (askGoogle's mock, always REAL_PASSAGE) genuinely
      // mentions D, so extraction DOES run this time -- and the SAME measured under-recall drops D
      // again (direct: nothing; complement: nothing), leaving D still unaccounted for.
      JSON.stringify({ members: [], stated_in_passage: false }),
      JSON.stringify({ not_members: [], stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: REAL_PASSAGE }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(REAL_PASSAGE)],
      );
      // D-BP153-023: the owned passage's INCOMPLETE PARTITION did NOT answer, so it fell through
      // instead of terminating with zero queries. TWO queries now: the main fresh query plus
      // D-BP153-026's own one completion follow-up (never a third).
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.some((l) => /INCOMPLETE PARTITION on owned passage/.test(l) && /D-BP153-023/.test(l) && /falling through/.test(l))).toBe(true);
      expect(log.some((l) => /NAMED SET FOLLOW-UP \(D-BP153-026\)/.test(l) && l.includes('D) Northeast United States'))).toBe(true);
      expect(result.available).toBe(true);
      expect(result.answeredFrom).toBe('new-query');
      // THE BUG D-BP153-014 measured: the direct extraction alone (rawMembers) under-recalls --
      // still true, now read from the fresh query rather than the owned passage.
      expect(new Set(result.rawMembers)).toEqual(new Set(['B', 'E']));
      // THE CORRECTED BEHAVIOR (D-BP153-020): D is unaccounted for by BOTH extractions (direct
      // named {B,E}, complement named the OTHER six {A,C,F,G,H,I} -- neither list mentions D at
      // all), so the union covers only 8 of 9 options and the reconciliation trusts NOTHING, not
      // the coincidentally-correct {B,D,E} the old arithmetic derived from D's mere absence.
      expect(result.members).toEqual([]);
      expect(result.partitionComplete).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(result.reconciliationWhy).toMatch(/INCOMPLETE PARTITION/);
      expect(result.reconciliationWhy).toContain('D) Northeast United States');
      expect(result.reconciliationWhy).not.toMatch(/trusted despite an incomplete direct side/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('complement extraction on the real passage yields non-members {A, C, F, G, H, I}, reconciling to a complete 9-option partition', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(REAL_PASSAGE)],
      );
      expect(new Set(result.nonMembers)).toEqual(new Set(['A', 'C', 'F', 'G', 'H', 'I']));
      expect(result.members.length + result.nonMembers.length).toBe(ALL.length);
      expect(result.partitionComplete).toBe(true);
      expect(result.reconciliationWhy).toMatch(/complete partition/);
      expect(log.some((l) => /RECONCILIATION/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('a conflicting extraction (an option in BOTH lists) is reported as a finding, never silently resolved', () => {
    // Pure arithmetic (reconcileNamedSet() is I/O-free) -- an option ("E") extracted as a member by
    // one side and a non-member by the other.
    const result = reconcileNamedSet(ALL, ['B', 'D', 'E'], ['A', 'C', 'F', 'G', 'H', 'I', 'E'], OPT);
    expect(result.conflicts).toEqual(['E']);
    expect(result.partitionComplete).toBe(false);
    expect(result.why).toMatch(/CONFLICT/);
    // Neither side is silently preferred -- the conflict falls back to the direct member
    // extraction, unreconciled, rather than guessing which side is right.
    expect(result.members).toEqual(['B', 'D', 'E']);
  });

  test('an owned-evidence conflict end to end: extractNamedSetMembers() reports it via the transcript, not silently', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: REAL_PASSAGE_S2 })),
        stated_in_passage: true,
      }),
      // Hallucinated overlap: the complement extraction ALSO names Europe, citing the (real,
      // verbatim, but semantically wrong for this purpose) membership sentence as though it
      // supported exclusion -- span verification (D-BP153-016 FIX 2) checks verbatim-ness and value
      // containment, not semantic direction, so this passes span verification and is caught instead
      // by reconcileNamedSet()'s own conflict detection, one layer up.
      JSON.stringify({
        not_members: [
          ...['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
            .map((name) => ({ name, span: REAL_PASSAGE_S1 })),
          { name: 'Europe', span: REAL_PASSAGE_S2 },
        ],
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(REAL_PASSAGE)],
      );
      expect(result.conflicts).toEqual(['E']);
      expect(log.some((l) => /NAMED SET CONFLICT/.test(l) && /Europe/.test(l))).toBe(true);
      // Unresolved: falls back to the direct member extraction rather than guessing.
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-014 BUG-2 regression: an empty passage never reaches extraction', () => {
  test('extractNamedSetMembers(): available:false for a fresh-query response whose text is blank after trim', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([]); // must not be reached -- the guard fires before either extraction
    const askGoogle = vi.fn(async () => ({ results: [{ title: '', snippet: '' }] }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      expect(result.available).toBe(false);
      expect(result.members).toEqual([]);
      expect(result.rawMembers).toEqual([]);
      expect(result.nonMembers).toEqual([]);
      expect(result.via).toMatch(/empty passage/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('span verification still rejects a name whose span does not actually contain it, on EITHER side', () => {
  test('a hallucinated non-member whose span does not contain it is stripped, never trusted', async () => {
    const originalFetch = global.fetch;
    const passage = 'Only South Asia is recognized as a major global population cluster.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [{ name: 'South Asia', span: passage }], stated_in_passage: true }),
      // Hallucinates "Arctic Circle" as excluded, citing a real (verbatim) span that never mentions
      // Arctic Circle at all.
      JSON.stringify({ not_members: [{ name: 'Arctic Circle', span: passage }], stated_in_passage: true }),
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
      expect(result.nonMembers).toEqual([]); // "Arctic Circle"'s span never mentions it -- discarded
      expect(result.nonMembers).not.toContain('G');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
