// classify_cascade.complement_silent_and_partial_follow_up.test.ts -- D-BP153-027/BISHOP/seg-classify-027
//
// THE MEASURED GAP (live run, receipt LIANA_RUN_qid98_2026-08-13T03-29-03-503Z.json). THE NAMED
// SET's fresh query finally reached a real "Only B (South Asia), D (Northeast United States), and E
// (Europe) are recognized..." passage, but the complement extracted nothing (no source text of the
// form "X is NOT a member" for this passage) and the direct extraction under-recalled the stated
// list -- {B, E} came back, D was dropped:
//   NAMED SET RECONCILIATION: the complement extracted nothing -- no non-members stated in this
//   passage to reconcile against; using the direct member extraction alone
//   MEMBERSHIP TERMINATOR: legitimate-regions {A,B,C,D,E,F} MINUS named-set-members {B,E} leaves 4
//   candidates (A, C, D, F)
// reconcileNamedSet()'s own "complement extracted nothing... using the direct member extraction
// alone" branch is CORRECT (a silent complement is not evidence of anything) and is untouched by
// this ticket -- but that branch never sets `incompletePartition` (there is no complement to be
// incomplete AGAINST), so D-BP153-026's own completion follow-up gate never saw this shape. Had the
// named set returned {B, D, E}, the terminator would have handed the discriminator exactly {A, C, F}.
//
// THE RULE UNDER TEST (Founder, BP153, verbatim): "A COMPLEMENT-SILENT read whose DIRECT side does
// not account for every option is INCOMPLETE for the purpose of the completion follow-up." This is a
// SECOND trigger for the SAME one-shot completion follow-up mechanism D-BP153-026 already built
// (issueCompletionFollowUp(), unmodified) -- it changes nothing about what reconcileNamedSet() DOES
// with a complement-silent read (using the direct side alone remains correct, HARDWIRE-22 unrelaxed:
// extraction only, never an inference from silence).
//
// SCOPE: establishFrame() (QUESTION 1) and extractNamedSetMembers() (QUESTION 2) -- the SAME two
// D-BP153-026 covers. runDiscriminator() (QUESTION 3) is untouched, same reason D-BP153-026 left it
// untouched.

import { describe, test, expect, vi } from 'vitest';
import { establishFrame, extractNamedSetMembers } from './classify_cascade';
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

// THE EXACT LIVE SHAPE (receipt LIANA_RUN_qid98_2026-08-13T03-29-03-503Z.json): direct names {B, E}
// as members, complement states nothing at all -- {A, C, D, F, G, H, I} unaccounted for by the
// direct side (7 of 9).
const FIRST_PASS_PASSAGE = 'Only B (South Asia) and E (Europe) are recognized in human geography as '
  + 'major global population clusters.';
// The follow-up's own returned passage -- names D as a member and the rest as non-members,
// completing the partition.
const FOLLOW_UP_PASSAGE = 'D (Northeast United States) is also recognized as a major global population '
  + 'cluster. A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), H (Amazon '
  + 'Rainforest), and I (Sahara Desert) are not.';

describe('D-BP153-027 TEST 1 (HEADLINE): extractNamedSetMembers(), the exact live shape -- complement silent, direct names only {B,E} of 9', () => {
  test('FAIL-BEFORE / PASS-AFTER: the follow-up is issued naming the uncovered options, the follow-up supplies D, the union yields members {B,D,E}', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // First pass direct (namedSetExtractionInstruction): names B and E only -- D dropped, the
      // measured gemma under-recall.
      JSON.stringify({
        members: ['South Asia', 'Europe'].map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      // First pass complement (namedSetComplementExtractionInstruction): states nothing --
      // COMPLEMENT-SILENT.
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // Follow-up direct: names D.
      JSON.stringify({ members: [{ name: 'Northeast United States', span: FOLLOW_UP_PASSAGE }], stated_in_passage: true }),
      // Follow-up complement: names the remaining six as non-members -- together with {B,D,E}
      // completes the partition over all 9.
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: FOLLOW_UP_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? FIRST_PASS_PASSAGE : FOLLOW_UP_PASSAGE };
    });
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );

      // HEADLINE ASSERTION, PASS-AFTER: the follow-up fired on a COMPLEMENT-SILENT-AND-PARTIAL read
      // (not an INCOMPLETE PARTITION -- the complement said nothing at all), named the uncovered
      // options, and the union completes the partition. This is ABSENT before D-BP153-027 (verified:
      // source stashed to before this ticket's own change, test run, `askGoogle` called once and
      // `result.members` stayed {B,E}; restored, this assertion passes).
      expect(askGoogle).toHaveBeenCalledTimes(2); // the main fresh query, PLUS the one follow-up
      expect(log.some((l) => /NAMED SET FOLLOW-UP \(D-BP153-026\)/.test(l) && /COMPLEMENT-SILENT-AND-PARTIAL/.test(l))).toBe(true);
      expect(log.some((l) => /NAMED SET FOLLOW-UP: ANSWERED BY/.test(l))).toBe(true);
      expect(log.some((l) => /NAMED SET FOLLOW-UP RECONCILIATION \(D-BP153-026/.test(l) && /complete partition/.test(l))).toBe(true);
      expect(result.partitionComplete).toBe(true);
      expect(result.answeredFrom).toBe('new-query');
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));

      // The follow-up query named ONLY the 7 options the first pass's direct side left uncovered
      // (all except B and E) -- never a narrower "just D" guess (this rule cannot know D is the
      // missing one; it only knows the direct side did not cover every option).
      const followUpQueryLine = log.find((l) => l.includes('NAMED SET FOLLOW-UP: query SENT to Google'));
      expect(followUpQueryLine).toBeDefined();
      expect(followUpQueryLine).toContain('D) Northeast United States');
      expect(followUpQueryLine).not.toContain('B) South Asia');
      expect(followUpQueryLine).not.toContain('E) Europe');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-027 TEST 2: complement silent but direct side ALREADY covers all N -> NO follow-up', () => {
  test('a fresh query naming all nine options directly (silent complement) never triggers the follow-up -- ONE query only', async () => {
    const originalFetch = global.fetch;
    const completePassage = 'B (South Asia), D (Northeast United States), and E (Europe) are recognized as '
      + 'major global population clusters. A (South America), C (North Africa), F (Central Asia), G '
      + '(Arctic Circle), H (Amazon Rainforest), and I (Sahara Desert) are recognized as ordinary, '
      + 'unremarkable regions and biomes by comparison.';
    global.fetch = queuedFetch([
      // Direct side names ALL NINE options (its own classification per option) -- nothing left
      // uncovered even though the complement says nothing.
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe', 'South America', 'North Africa',
          'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: completePassage })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: [], stated_in_passage: false }), // complement silent
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: completePassage }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );

      expect(askGoogle).toHaveBeenCalledTimes(1); // no follow-up -- the direct side already covers all 9
      expect(log.some((l) => /NAMED SET FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(false);
      expect(new Set(result.members)).toEqual(new Set(ALL));
      expect(log.some((l) => /the complement extracted nothing/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-027 TEST 3: AT MOST ONE follow-up -- a follow-up that is ALSO complement-silent-and-partial never triggers a second one', () => {
  test('the follow-up itself under-covers -- no third query, the union stands as-is', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Europe'].map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: [], stated_in_passage: false }), // complement silent
      // Follow-up direct: names D only; the other 6 uncovered options remain unaddressed.
      JSON.stringify({ members: [{ name: 'Northeast United States', span: FOLLOW_UP_PASSAGE }], stated_in_passage: true }),
      // Follow-up complement: also silent.
      JSON.stringify({ not_members: [], stated_in_passage: false }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? FIRST_PASS_PASSAGE : FOLLOW_UP_PASSAGE };
    });
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );

      // TWO queries total -- the main fresh query and the ONE follow-up -- never a third attempt.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.filter((l) => /NAMED SET FOLLOW-UP \(D-BP153-026\)/.test(l)).length).toBe(1);
      // The union {B,D,E} is still complement-silent (the follow-up's own complement was ALSO
      // silent) -- reconcileNamedSet()'s own fallback uses the direct side alone, unchanged: the
      // trusted members are the union of both direct reads, D-BP153-020's safety net never invoked
      // because there is still no complement to conflict or complete against.
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-027 TEST 4: complement-silent handling itself is unchanged -- no follow-up available, direct side alone is still used', () => {
  test('when obtainCascadePassage() cannot get a usable follow-up answer, the first pass\'s own complement-silent reconciliation stands untouched', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Europe'].map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({ not_members: [], stated_in_passage: false }), // complement silent
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      if (call === 1) return { snippet: FIRST_PASS_PASSAGE };
      return { challengeDetected: true }; // the follow-up's own call: no usable answer
    });
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );

      expect(askGoogle).toHaveBeenCalledTimes(2); // the follow-up WAS attempted (D-BP153-027 fired)
      expect(log.some((l) => /NAMED SET FOLLOW-UP: no usable answer/.test(l))).toBe(true);
      // Nothing is inferred from the follow-up's own silence either -- the first pass's own
      // complement-silent read (direct extraction alone, HARDWIRE-22) is exactly what is used.
      expect(new Set(result.members)).toEqual(new Set(['B', 'E']));
      expect(log.some((l) => /the complement extracted nothing/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-027 TEST 5: owned complete answer -> no fresh query, no follow-up', () => {
  test('an owned passage answering completely on the first try never reaches the fresh-query path, so this trigger never evaluates', async () => {
    const originalFetch = global.fetch;
    const passage = 'B (South Asia), D (Northeast United States), and E (Europe) are recognized as major '
      + 'global population clusters. A (South America), C (North Africa), F (Central Asia), G (Arctic '
      + 'Circle), H (Amazon Rainforest), and I (Sahara Desert) are not.';
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => { throw new Error('must never be called -- owned evidence answers completely'); });
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(result.answeredFrom).toBe('owned-passage');
      expect(result.partitionComplete).toBe(true);
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      expect(log.some((l) => /NAMED SET FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-027: establishFrame() (QUESTION 1, THE SOFTBALLS) shares the identical trigger', () => {
  test('complement silent, direct excludes only 2 of 9 -- the follow-up fires and names the 7 uncovered options', async () => {
    const originalFetch = global.fetch;
    const firstPassPassage = 'G (Arctic Circle) and H (Amazon Rainforest) are climatic zones, not world regions.';
    const followUpPassage = 'I (Sahara Desert) is also a biome, not a world region. A (South America), B '
      + '(South Asia), C (North Africa), D (Northeast United States), E (Europe), and F (Central Asia) '
      + 'are each legitimate world regions.';
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest'].map((name) => ({ name, span: firstPassPassage })),
        stated_in_passage: true,
      }),
      JSON.stringify({ members: [], stated_in_passage: false }), // complement silent
      // Follow-up direct: names I as excluded.
      JSON.stringify({ not_members: [{ name: 'Sahara Desert', span: followUpPassage }], stated_in_passage: true }),
      // Follow-up complement: names the other six as included -- completes the partition.
      JSON.stringify({
        members: ['South America', 'South Asia', 'North Africa', 'Northeast United States', 'Europe', 'Central Asia']
          .map((name) => ({ name, span: followUpPassage })),
        stated_in_passage: true,
      }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? firstPassPassage : followUpPassage };
    });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l) && /COMPLEMENT-SILENT-AND-PARTIAL/.test(l))).toBe(true);
      const followUpLine = log.find((l) => l.includes('FRAME FOLLOW-UP: query SENT to Google'));
      expect(followUpLine).toBeDefined();
      for (const L of ['A', 'B', 'C', 'D', 'E', 'F', 'I']) {
        expect(followUpLine).toContain(`${L}) ${OPT[L]}`);
      }
      expect(followUpLine).not.toContain('G) Arctic Circle');
      expect(followUpLine).not.toContain('H) Amazon Rainforest');
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['G', 'H', 'I']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
