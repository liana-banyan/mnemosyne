// classify_cascade.completion_follow_up.test.ts -- D-BP153-026/BISHOP/seg-classify-026
//
// THE MEASURED FAILURE (live run, receipt LIANA_RUN_qid98_2026-08-13T02-58-52-307Z.json). THE
// SOFTBALLS' fresh query finally reached user_gemini (D-BP153-024) and answered SEVEN of nine
// options -- a real, on-topic, per-option accounting, just an incomplete one:
//   FRAME: ANSWERED BY: user_gemini (user_gemini:settled)
//   FRAME: direct extraction excludes D) Northeast United States, G) Arctic Circle, H) Amazon
//          Rainforest, I) Sahara Desert, complement states B) South Asia, C) North Africa,
//          F) Central Asia
//   FRAME RECONCILIATION: INCOMPLETE PARTITION -- {A) South America, E) Europe} unaccounted for
//   FRAME: 0 option(s) are not world regions -- (none); 9 of 9 remain in frame
// D-BP153-020's own complete-partition gate correctly refused to trust the partial answer -- that
// gate is UNRELAXED by this ticket -- but the run then simply gave up on A and E, even though the
// question itself demanded an accounting of every option. The terminator got 9 MINUS {B,D,E} = 6
// candidates (A,C,F,G,H,I) instead of the 3 it should have had.
//
// THE RULE UNDER TEST: THE COMPLETION FOLLOW-UP. When a partition comes back INCOMPLETE from a
// fresh query, ask ONE targeted follow-up naming ONLY the unaccounted-for options, then reconcile
// again -- the first pass's own values are never discarded, only added to. AT MOST ONE follow-up
// per question: if the follow-up is ALSO incomplete, the existing safety net stands (zero
// exclusions, still-unaccounted options named, no third attempt).
//
// SCOPE: this file exercises establishFrame() (QUESTION 1, THE SOFTBALLS -- the exact shape the
// live bug measured) and extractNamedSetMembers() (QUESTION 2, THE NAMED SET, which shares the
// SAME reconcileNamedSet() choke point and the identical follow-up mechanism). runDiscriminator()
// (QUESTION 3) is NOT modified by this ticket -- see classify_cascade.ts's own D-BP153-026 section
// header for why (STAGE D's `missingKind` notion is a per-candidate gap, not a two-sided
// partition, and no test here or in this ticket's own dispatch requires extending the follow-up
// there).

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
 *  /api/generate JSON responses, one per gemmaExtract() call, in order. An exhausted queue throws
 *  inside the mock's async body, which gemmaExtract()'s own try/catch turns into a silent `null`
 *  (verified by classify_cascade.conversational_authority_routing.test.ts's own header) -- so a
 *  test that expects the follow-up to be abandoned before extraction may under-queue on purpose. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

// THE EXACT LIVE SHAPE (receipt LIANA_RUN_qid98_2026-08-13T02-58-52-307Z.json): direct excludes
// {D, G, H, I}, complement includes {B, C, F} -- {A, E} unaccounted for by either side.
const FIRST_PASS_PASSAGE = 'D (Northeast United States), G (Arctic Circle), H (Amazon Rainforest), and '
  + 'I (Sahara Desert) are not properly considered here. B (South Asia), C (North Africa), and '
  + 'F (Central Asia) are considered valid entries here.';
// The follow-up's own returned passage -- states A and E, completing the partition.
const FOLLOW_UP_COMPLETING_PASSAGE = 'A (South America) and E (Europe) are considered valid entries here.';

describe('D-BP153-026 TEST 1 (HEADLINE): establishFrame(), the exact live shape -- 7 of 9 answered, follow-up completes the partition', () => {
  test('FAIL-BEFORE / PASS-AFTER: the follow-up is issued naming ONLY A and E, the union is a complete partition, and the trusted exclusions come from it', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // First pass (main fresh query): the exact live shape.
      JSON.stringify({
        not_members: ['Northeast United States', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South Asia', 'North Africa', 'Central Asia'].map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      // Follow-up: direct side states nothing new excluded.
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // Follow-up: complement states A and E ARE world regions -- completes the partition.
      JSON.stringify({
        members: ['South America', 'Europe'].map((name) => ({ name, span: FOLLOW_UP_COMPLETING_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? FIRST_PASS_PASSAGE : FOLLOW_UP_COMPLETING_PASSAGE };
    });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // HEADLINE ASSERTION, PASS-AFTER: the follow-up fired, named ONLY the two unaccounted-for
      // options, and the RE-RECONCILED union is a complete partition whose exclusions are trusted
      // -- this is the exact behavior that is ABSENT before this ticket (fail-before: zero
      // exclusions, no follow-up issued at all, `askGoogle` called only once). See this file's own
      // verification note: this assertion was confirmed to FAIL on the pre-ticket source (source
      // stashed, test run, `askGoogle` called once and `frame.excluded` empty) and to PASS after
      // the fix was restored.
      expect(askGoogle).toHaveBeenCalledTimes(2); // the main fresh query, PLUS the one follow-up
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME FOLLOW-UP: ANSWERED BY/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME FOLLOW-UP RECONCILIATION \(D-BP153-026/.test(l) && /complete partition/.test(l))).toBe(true);
      expect(frame.partitionComplete).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      // The union: direct {D,G,H,I} plus follow-up direct {} = {D,G,H,I}; complement {B,C,F} plus
      // follow-up complement {A,E} = {A,B,C,E,F} -- together all 9, so the trusted exclusions are
      // exactly the union's own direct side.
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'E', 'F']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-026 TEST 2: the follow-up names ONLY the unaccounted-for options', () => {
  test('the composed follow-up query string contains A and E and does NOT contain the other seven option letters/labels', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Northeast United States', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South Asia', 'North Africa', 'Central Asia'].map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      // The follow-up query text is captured before extraction is attempted -- a challenge on the
      // follow-up's own askGoogle call is enough; this test needs the QUERY STRING, not an answer.
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      if (call === 1) return { snippet: FIRST_PASS_PASSAGE };
      return { challengeDetected: true }; // the follow-up's own call: no usable answer, fine for this test
    });
    try {
      const { note, log } = notes();
      await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      const followUpQueryLine = log.find((l) => l.includes('FRAME FOLLOW-UP: query SENT to Google'));
      expect(followUpQueryLine).toBeDefined();
      // Contains ONLY the two unaccounted-for options.
      expect(followUpQueryLine).toContain('A) South America');
      expect(followUpQueryLine).toContain('E) Europe');
      // Does NOT contain any of the other seven option letters/labels (checked by their full
      // "L) Label" shape, the same shape list() produces, so a bare substring like "I" inside
      // another word can never false-positive).
      for (const [L, label] of Object.entries(OPT)) {
        if (L === 'A' || L === 'E') continue;
        expect(followUpQueryLine).not.toContain(`${L}) ${label}`);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-026 TEST 3: AT MOST ONE follow-up -- a follow-up that is ALSO incomplete never triggers a second one', () => {
  // D-BP153-029 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to assert that the STILL-
  // incomplete union (E remains unaccounted for) discarded EVERYTHING, including the four
  // DIRECTLY STATED exclusions {D,G,H,I} the first pass's own verified spans established -- the
  // exact over-correction D-BP153-029 closes (this is literally the live measured failure's own
  // shape: a real dispatch, HEADLINE test below in this same file, differs only in which follow-up
  // response was queued). The corrected rule: an incomplete union discards only the
  // COMPLEMENT-DERIVED INFERENCE (the "all minus non-members" arithmetic), never the directly
  // stated values -- {D,G,H,I} stay trusted, only E's status (and the complement's own inference)
  // is withheld.
  test('the follow-up names only A, answers only A, E stays unaccounted -- no third query, the four DIRECTLY STATED exclusions are retained, not a zero-credit wipe', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Northeast United States', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South Asia', 'North Africa', 'Central Asia'].map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      // Follow-up direct: nothing new excluded.
      JSON.stringify({ not_members: [], stated_in_passage: false }),
      // Follow-up complement: names ONLY A, not E -- the follow-up is ALSO incomplete.
      JSON.stringify({
        members: [{ name: 'South America', span: 'A (South America) is considered a valid entry here.' }],
        stated_in_passage: true,
      }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? FIRST_PASS_PASSAGE : 'A (South America) is considered a valid entry here.' };
    });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // TWO queries total -- the main fresh query and the ONE follow-up -- never a third attempt
      // even though the follow-up itself came back incomplete (E is still unaccounted for).
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.filter((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l)).length).toBe(1); // exactly one follow-up issued
      expect(frame.partitionComplete).toBe(false);
      // D-BP153-029: the DIRECTLY STATED exclusions are retained -- the complement-derived inference
      // (which would have put A and E's non-mentioned siblings back in, or wiped {D,G,H,I} out) is
      // what is discarded, not the four spans the first pass itself verified.
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /INCOMPLETE PARTITION/.test(l) && l.includes('E) Europe'))).toBe(true);
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /RETAINED/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-026 TEST 4: a complete fresh answer -> NO follow-up issued', () => {
  test('a fresh query naming all nine options in one pass never triggers the follow-up -- ONE query only', async () => {
    const originalFetch = global.fetch;
    const completePassage = 'South America, South Asia, Northeast United States, and Europe are each classified as '
      + 'continental or subcontinental world regions. North Africa and Central Asia are classified as '
      + 'colloquial geographic areas, not world regions. Arctic Circle, Amazon Rainforest, and Sahara '
      + 'Desert are each classified as biomes, not world regions.';
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: completePassage })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South America', 'South Asia', 'Northeast United States', 'Europe']
          .map((name) => ({ name, span: completePassage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: completePassage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      expect(askGoogle).toHaveBeenCalledTimes(1); // no follow-up -- the first pass already completed
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['C', 'F', 'G', 'H', 'I']));
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-026 TEST 5: a complete OWNED answer -> no fresh query and no follow-up at all', () => {
  test('an owned passage answering completely on the first try never reaches the fresh-query path, so the follow-up never fires', async () => {
    const originalFetch = global.fetch;
    const passage = 'Arctic Circle, Amazon Rainforest, and Sahara Desert are biomes, not world regions. '
      + 'South America, South Asia, North Africa, Northeast United States, Europe, and Central Asia are '
      + 'all legitimate world regions.';
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        members: ['South America', 'South Asia', 'North Africa', 'Northeast United States', 'Europe', 'Central Asia']
          .map((name) => ({ name, span: passage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => { throw new Error('must never be called -- the owned passage is complete'); });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.partitionComplete).toBe(true);
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-026: extractNamedSetMembers() (QUESTION 2, THE NAMED SET) shares the identical follow-up mechanism', () => {
  test('HEADLINE: a fresh query answers 7 of 9, the follow-up names ONLY the 2 unaccounted-for options and completes the partition', async () => {
    const originalFetch = global.fetch;
    // Direct names {B, D} as members, complement names {A, C, F, G, H} as non-members -- {E, I}
    // unaccounted for.
    const firstPassPassage = 'B (South Asia) and D (Northeast United States) are named as members here. '
      + 'A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), and '
      + 'H (Amazon Rainforest) are named as non-members here.';
    const followUpPassage = 'E (Europe) is named as a member here. I (Sahara Desert) is named as a non-member here.';
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States'].map((name) => ({ name, span: firstPassPassage })),
        stated_in_passage: true,
      }),
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest']
          .map((name) => ({ name, span: firstPassPassage })),
        stated_in_passage: true,
      }),
      // Follow-up direct: names E as a member.
      JSON.stringify({ members: [{ name: 'Europe', span: followUpPassage }], stated_in_passage: true }),
      // Follow-up complement: names I as a non-member -- together with E, completes the partition.
      JSON.stringify({ not_members: [{ name: 'Sahara Desert', span: followUpPassage }], stated_in_passage: true }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? firstPassPassage : followUpPassage };
    });
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );

      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.some((l) => /NAMED SET FOLLOW-UP \(D-BP153-026\)/.test(l))).toBe(true);
      const followUpLine = log.find((l) => l.includes('NAMED SET FOLLOW-UP (D-BP153-026)'));
      expect(followUpLine).toContain('E) Europe');
      expect(followUpLine).toContain('I) Sahara Desert');
      for (const L of ['A', 'B', 'C', 'D', 'F', 'G', 'H']) {
        expect(followUpLine).not.toContain(`${L}) ${OPT[L]}`);
      }
      expect(result.partitionComplete).toBe(true);
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
