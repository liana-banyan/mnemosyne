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

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: this file's own fixtures each mock exactly ONE response per base
// question -- pinning LB_DRAW_REPEATS=1 keeps every existing assertion in this file (call counts,
// single-draw extraction) valid. drawWithAgreement()'s own repeats===1 path is a pure pass-through,
// BYTE-IDENTICAL to this file's pre-D-BP153-031 behavior (see classify_cascade.ts's own D-BP153-031
// section header and resolveDrawRepeats()). The channel-variance repeat/disagreement behavior itself
// is covered by classify_cascade.repeated_draws.test.ts, not here.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });
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
const CATEGORY_KIND = 'legitimate world region';
const OTHER_KIND = 'not a legitimate world region';

/** D-BP153-032: builds a COMPLETE, all-nine-options stated-kind passage + reply -- see
 *  classify_cascade.owned_evidence_frame.test.ts's own identical helper for the full rationale. */
function fullCoverage(excludedLetters: string[], introText: string): { passage: string; response: string } {
  const includedLetters = ALL.filter((L) => !excludedLetters.includes(L));
  const excludedClause = excludedLetters.length
    ? `${excludedLetters.map((L) => OPT[L]).join(', ')} ${excludedLetters.length > 1 ? 'are each' : 'is'} "${OTHER_KIND}".`
    : '';
  const includedClause = includedLetters.length
    ? `${includedLetters.map((L) => OPT[L]).join(', ')} ${includedLetters.length > 1 ? 'are each' : 'is'} "${CATEGORY_KIND}".`
    : '';
  const passage = `${introText} ${excludedClause} ${includedClause} A world region properly denotes a "${CATEGORY_KIND}".`;
  const response = JSON.stringify({
    kinds: ALL.map((L) => ({ name: OPT[L], kind: excludedLetters.includes(L) ? OTHER_KIND : CATEGORY_KIND, span: passage })),
    category_kind: CATEGORY_KIND,
    category_kind_span: passage,
    stated_in_passage: true,
  });
  return { passage, response };
}

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

// THE EXACT LIVE SHAPE (receipt LIANA_RUN_qid98_2026-08-13T02-58-52-307Z.json), restated for
// D-BP153-032's stated-kind shape: D, G, H, I are stated "not a legitimate world region"; B, C, F
// are stated "legitimate world region" (the category's own denotation) -- A, E never get a stated
// kind from the first pass.
const FIRST_PASS_PASSAGE = `Northeast United States, Arctic Circle, Amazon Rainforest, and Sahara Desert `
  + `are each "${OTHER_KIND}". South Asia, North Africa, and Central Asia are each a "${CATEGORY_KIND}". `
  + `A world region properly denotes a "${CATEGORY_KIND}".`;
const FIRST_PASS_RESPONSE = JSON.stringify({
  kinds: [
    { name: 'Northeast United States', kind: OTHER_KIND, span: FIRST_PASS_PASSAGE },
    { name: 'Arctic Circle', kind: OTHER_KIND, span: FIRST_PASS_PASSAGE },
    { name: 'Amazon Rainforest', kind: OTHER_KIND, span: FIRST_PASS_PASSAGE },
    { name: 'Sahara Desert', kind: OTHER_KIND, span: FIRST_PASS_PASSAGE },
    { name: 'South Asia', kind: CATEGORY_KIND, span: FIRST_PASS_PASSAGE },
    { name: 'North Africa', kind: CATEGORY_KIND, span: FIRST_PASS_PASSAGE },
    { name: 'Central Asia', kind: CATEGORY_KIND, span: FIRST_PASS_PASSAGE },
  ],
  category_kind: CATEGORY_KIND,
  category_kind_span: FIRST_PASS_PASSAGE,
  stated_in_passage: true,
});
// The follow-up's own returned passage -- states A and E, completing the accounting.
const FOLLOW_UP_COMPLETING_PASSAGE = `South America and Europe are each a "${CATEGORY_KIND}".`;
const FOLLOW_UP_COMPLETING_RESPONSE = JSON.stringify({
  kinds: [
    { name: 'South America', kind: CATEGORY_KIND, span: FOLLOW_UP_COMPLETING_PASSAGE },
    { name: 'Europe', kind: CATEGORY_KIND, span: FOLLOW_UP_COMPLETING_PASSAGE },
  ],
  category_kind: CATEGORY_KIND,
  category_kind_span: FOLLOW_UP_COMPLETING_PASSAGE,
  stated_in_passage: true,
});

describe('D-BP153-026 TEST 1 (HEADLINE): establishFrame(), the exact live shape -- 7 of 9 answered, follow-up completes the accounting', () => {
  test('FAIL-BEFORE / PASS-AFTER: the follow-up is issued naming ONLY A and E, the union is a complete accounting, and the trusted exclusions come from it', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      FIRST_PASS_RESPONSE, // first pass (main fresh query): the exact live shape
      FOLLOW_UP_COMPLETING_RESPONSE, // follow-up: states A and E -- completes the accounting
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
      expect(log.some((l) => /FRAME FOLLOW-UP RECONCILIATION \(D-BP153-026/.test(l))).toBe(true);
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
      FIRST_PASS_RESPONSE,
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
  // D-BP153-029/D-BP153-032 UPDATE, RECORDED HERE EXPLICITLY. This fixture used to assert that the
  // STILL-incomplete union (E remains unaccounted for) discarded EVERYTHING, including the four
  // DIRECTLY STATED exclusions {D,G,H,I} the first pass's own verified spans established -- the
  // exact over-correction D-BP153-029 closes. Restated for D-BP153-032's stated-kind shape:
  // applyFrameKindElimination() judges each option on its OWN stated kind -- an option with no
  // stated kind (E, here) is left UNACCOUNTED, never discarding any OTHER option's own directly
  // stated kind. {D,G,H,I} stay excluded; only E's own status is withheld.
  test('the follow-up names only A, answers only A, E stays unaccounted -- no third query, the four DIRECTLY STATED exclusions are retained, not a zero-credit wipe', async () => {
    const originalFetch = global.fetch;
    const followUpOnlyAPassage = `South America is a "${CATEGORY_KIND}".`;
    global.fetch = queuedFetch([
      FIRST_PASS_RESPONSE,
      // Follow-up: names ONLY A, not E -- the follow-up is ALSO incomplete.
      JSON.stringify({
        kinds: [{ name: 'South America', kind: CATEGORY_KIND, span: followUpOnlyAPassage }],
        category_kind: CATEGORY_KIND,
        category_kind_span: followUpOnlyAPassage,
        stated_in_passage: true,
      }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? FIRST_PASS_PASSAGE : followUpOnlyAPassage };
    });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // TWO queries total -- the main fresh query and the ONE follow-up -- never a third attempt
      // even though the follow-up itself came back incomplete (E never got a stated kind).
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.filter((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l)).length).toBe(1); // exactly one follow-up issued
      expect(frame.partitionComplete).toBe(false);
      // D-BP153-029/D-BP153-032: the DIRECTLY STATED exclusions are retained -- E's own missing kind
      // never blocks any OTHER option's own directly stated kind from being judged on its merits.
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'F']));
      expect(log.some((l) => /FRAME RECONCILIATION/.test(l) && /UNACCOUNTED/.test(l) && l.includes('E) Europe'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-026 TEST 4: a complete fresh answer -> NO follow-up issued', () => {
  test('a fresh query naming all nine options in one pass never triggers the follow-up -- ONE query only', async () => {
    const originalFetch = global.fetch;
    const { passage: completePassage, response } = fullCoverage(['C', 'F', 'G', 'H', 'I'], 'A complete accounting of every option follows.');
    global.fetch = queuedFetch([response]);
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
    const { passage, response } = fullCoverage(['G', 'H', 'I'], 'A complete accounting of every option follows.');
    global.fetch = queuedFetch([response]);
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
