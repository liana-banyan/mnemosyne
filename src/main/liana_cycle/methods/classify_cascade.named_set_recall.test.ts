// classify_cascade.named_set_recall.test.ts -- D-BP153-014/BISHOP/seg-classify-recall-fix
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
// THE REAL PASSAGE, verbatim from the live run (this ticket's own fixture, never paraphrased):
const REAL_PASSAGE = 'Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), '
  + "H (Amazon Rainforest), and I (Sahara Desert) are all correct choices because none of them are "
  + "considered major high-density global population clusters. Only B (South Asia), D (Northeast "
  + 'United States), and E (Europe) qualify as densely populated regions on a global scale.';

import { describe, test, expect, vi } from 'vitest';
import { extractNamedSetMembers, reconcileNamedSet } from './classify_cascade';
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
  test('HEADLINE: the real fixture passage yields named-set members EXACTLY {B, D, E}', async () => {
    const originalFetch = global.fetch;
    // Simulates the MEASURED live extraction (a partial copy, D dropped) on the direct-member side
    // -- exactly what BUG-1 reports gemma4:12b actually returned for this passage -- and the
    // passage's own, more-explicit complement statement on the non-member side. Neither mock is
    // hand-picked to make the test pass by construction: the direct side is the REAL measured
    // defect, and the complement side is what the SAME passage states in its first sentence,
    // verbatim, which is exactly the corroboration BUG-1(b) exists to use.
    global.fetch = queuedFetch([
      JSON.stringify({ members: ['South Asia', 'Europe'], stated_in_passage: true }), // direct: under-recalled, D dropped
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'],
        stated_in_passage: true,
      }), // complement: the passage's own first sentence, in full
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [REAL_PASSAGE],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(result.available).toBe(true);
      // THE BUG: the direct extraction alone (rawMembers) is the measured under-recall.
      expect(new Set(result.rawMembers)).toEqual(new Set(['B', 'E']));
      // THE FIX: reconciled against the complement, the result is the complete set -- even though
      // D was never named by the direct extraction (partitionComplete is honestly false: the direct
      // side alone did not cover D), the complement is trusted and recovers it.
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      expect(result.partitionComplete).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(result.reconciliationWhy).toMatch(/trusted despite an incomplete direct side/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('complement extraction on the real passage yields non-members {A, C, F, G, H, I}, reconciling to a complete 9-option partition', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ members: ['South Asia', 'Northeast United States', 'Europe'], stated_in_passage: true }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'],
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [REAL_PASSAGE],
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
      JSON.stringify({ members: ['South Asia', 'Northeast United States', 'Europe'], stated_in_passage: true }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert', 'Europe'],
        stated_in_passage: true,
      }), // hallucinated overlap: Europe named on BOTH sides
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [REAL_PASSAGE],
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

describe('appearsIn() still rejects a name the passage does not contain, on EITHER side', () => {
  test('a hallucinated non-member not present in the passage is stripped, never trusted', async () => {
    const originalFetch = global.fetch;
    const passage = 'Only South Asia is recognized as a major global population cluster.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: ['South Asia'], stated_in_passage: true }),
      // Hallucinates "Arctic Circle" as excluded -- the word never appears in this short passage.
      JSON.stringify({ not_members: ['Arctic Circle'], stated_in_passage: true }),
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
      expect(result.nonMembers).toEqual([]); // "Arctic Circle" rejected -- not present in `passage`
      expect(result.nonMembers).not.toContain('G');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
