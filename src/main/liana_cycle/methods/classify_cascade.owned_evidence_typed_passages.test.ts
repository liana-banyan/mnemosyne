// classify_cascade.owned_evidence_typed_passages.test.ts -- D-BP153-016/BISHOP/seg-classify-016
//
// THE MEASURED FAILURE THIS TICKET CLOSES (live run 2026-08-12T20:39Z, receipt
// LIANA_RUN_qid98_2026-08-12T20-39-01-893Z.json). All three owned-evidence extractors ran from
// OWNED EVIDENCE with zero queries and produced nonsense -- the extractors were pointed at the
// AMBIGUITY passage. Its verbatim text includes:
//   "If 'populated' is interpreted ecologically, the Amazon Rainforest flips from being one of the
//   least human-populated regions to one of the most densely populated places on Earth in terms of
//   living organisms and species biodiversity."
// That is a COUNTERFACTUAL. The extractor read it as an assertion. appearsIn() passed it because
// the words "Amazon Rainforest" literally appear. The OTHER owned passage that run held was 197
// characters of Gemini UI chrome: "Interpreting the Prompt Gemini said Answer now Thinking Your
// lianabanyan.com chats aren't used to improve our models. Gemini is AI and can make mistakes."
//
// THE RULING, FD-BP153-07 (RULINGS_BP153.md), THREE FIXES:
//   FIX 1 -- TYPE THE PASSAGES. `OwnedPassage.kind` (method_registry.ts) names WHAT QUESTION a
//   passage was acquired to answer. establishFrame(), extractNamedSetMembers(), and
//   runDiscriminator() all reject kind 'ambiguity' outright -- an ambiguity passage exists to
//   enumerate ALTERNATIVE meanings and may never source a claim about what IS.
//   FIX 2 -- VERIFY THE SPAN, NOT THE STRING. Every extraction that yields option letters now also
//   returns, per value, the verbatim SUPPORTING SPAN. A value with no span, or an unverifiable
//   span, is DISCARDED and the discard is COUNTED and reported in a note.
//   FIX 3 -- REJECT A PASSAGE THAT CANNOT SOURCE THE CLAIM. A passage naming NONE of the option
//   labels this extraction is about cannot state anything about them -- mechanical, general, never a
//   word list.
//
// THIS FILE covers exactly the six scenarios the dispatch requires, using extractNamedSetMembers()
// as "the named-set extractor" the dispatch names throughout. Same offline convention every
// classify_cascade.*.test.ts sibling already uses: askGoogle is a local stub, global.fetch
// (gemmaExtract()'s own Ollama channel) is monkey-patched per test, nothing live anywhere in this
// file.

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

// THE REAL AMBIGUITY PASSAGE, verbatim, quoted exactly from the dispatch -- the counterfactual that
// produced "Amazon Rainforest" as a member of the world's most densely populated regions.
const AMBIGUITY_PASSAGE = "If 'populated' is interpreted ecologically, the Amazon Rainforest flips from being "
  + 'one of the least human-populated regions to one of the most densely populated places on Earth '
  + 'in terms of living organisms and species biodiversity.';

// THE REAL 197-CHARACTER GEMINI UI CHROME PASSAGE, verbatim, quoted exactly from the dispatch.
const GEMINI_UI_CHROME_PASSAGE = 'Interpreting the Prompt Gemini said Answer now Thinking Your '
  + "lianabanyan.com chats aren't used to improve our models. Gemini is AI and can make mistakes.";

// D-BP153-016: wraps a bare passage string as a typed OwnedPassage.
const owned = (text: string, kind: string): OwnedPassage => ({ text, kind });

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

describe('D-BP153-016 TEST 1 -- THE HEADLINE REGRESSION: an ambiguity-kind passage may never source a named-set claim', () => {
  test('the real ambiguity passage (verbatim) never yields Amazon Rainforest as a member, and the rejection is noted', async () => {
    const originalFetch = global.fetch;
    // If the ambiguity-kind rejection did NOT exist, this queued response is exactly what a model
    // reading the counterfactual sentence literally would return: "Amazon Rainforest" copied as a
    // member, citing the counterfactual clause itself as its "span" (which IS verbatim in the
    // passage -- this is precisely why FIX 2's span check alone cannot close this defect; FIX 1's
    // kind rejection is what has to fire, before extraction is even attempted).
    global.fetch = queuedFetch([
      JSON.stringify({
        members: [{ name: 'Amazon Rainforest', span: AMBIGUITY_PASSAGE }],
        stated_in_passage: true,
      }),
    ]);
    // No usable fresh-query answer either -- this isolates the assertion to what OWNED EVIDENCE
    // alone produced, per the dispatch's own framing ("all three stages ran from OWNED EVIDENCE
    // with zero queries").
    const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(AMBIGUITY_PASSAGE, 'ambiguity')],
      );

      // THE POINT: no member at all, and specifically never H (Amazon Rainforest).
      expect(result.members).toEqual([]);
      expect(result.members).not.toContain('H');
      expect(result.rawMembers).not.toContain('H');

      // THE RECEIPT SAYS WHY: the ambiguity-kind passage was rejected outright, never extracted from.
      expect(log.some((l) => /REJECTED an owned passage of kind 'ambiguity'/.test(l))).toBe(true);
      expect(log.some((l) => /FIX 1/.test(l))).toBe(true);
      // And because the gemmaExtract() call never happened (the passage was rejected before
      // extraction), the queued "Amazon Rainforest" response above was never consumed -- proving the
      // rejection fired BEFORE extraction, not merely that its output was later discarded.
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-016 TEST 2 -- an operation-kind passage still yields the real named set, each member with a verbatim span', () => {
  test('"Only B, D, and E qualify..." (kind: operation) yields exactly {B, D, E}, each backed by a verbatim span', async () => {
    const originalFetch = global.fetch;
    const operationPassage = 'Only B (South Asia), D (Northeast United States), and E (Europe) qualify as '
      + 'densely populated regions on a global scale.';
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: operationPassage })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(operationPassage, 'operation')],
      );

      expect(askGoogle).not.toHaveBeenCalled();
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      // EACH ONE with a verbatim supporting span -- not merely present, but the actual span this
      // ticket's FIX 2 requires every extraction to carry.
      expect(result.memberSpans.B).toBe(operationPassage);
      expect(result.memberSpans.D).toBe(operationPassage);
      expect(result.memberSpans.E).toBe(operationPassage);
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-016 TEST 3 -- SPAN VERIFICATION: a span that is not verbatim in the passage discards the value, and the discard is counted', () => {
  test('a member whose offered span does not actually appear in the passage (paraphrased) is discarded, and the note counts it', async () => {
    const originalFetch = global.fetch;
    const passage = 'Only B (South Asia) is recognized as a major global population cluster.';
    global.fetch = queuedFetch([
      JSON.stringify({
        members: [
          { name: 'South Asia', span: passage }, // genuine, verbatim
          // Paraphrased, NOT a verbatim substring of the passage -- fails spanIsVerbatim().
          { name: 'Northeast United States', span: 'D is one of the densest metro corridors in North America' },
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
        () => [owned(passage, 'operation')],
      );

      expect(result.members).toEqual(['B']);
      expect(result.members).not.toContain('D');
      expect(log.some((l) => /discarded 1 value/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-016 TEST 4 -- a value with NO span at all is discarded', () => {
  test('a member entry with an empty/missing span is discarded, never trusted on bare name+appearsIn alone', async () => {
    const originalFetch = global.fetch;
    const passage = 'Only B (South Asia), D (Northeast United States), and E (Europe) qualify as densely '
      + 'populated regions on a global scale.';
    global.fetch = queuedFetch([
      JSON.stringify({
        members: [
          { name: 'South Asia', span: passage },
          { name: 'Northeast United States', span: '' }, // no span at all
          { name: 'Europe' }, // span field omitted entirely
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
        () => [owned(passage, 'operation')],
      );

      expect(result.members).toEqual(['B']);
      expect(result.members).not.toContain('D');
      expect(result.members).not.toContain('E');
      expect(log.some((l) => /discarded 2 value/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-016 TEST 5 -- REJECT A PASSAGE THAT CANNOT SOURCE THE CLAIM (mechanical, general)', () => {
  test('the real 197-character Gemini UI chrome passage is rejected because it names none of the option labels', async () => {
    const originalFetch = global.fetch;
    // Only ONE response queued -- if the UI-chrome passage were (wrongly) sent to gemmaExtract(),
    // queuedFetch() throws and the test fails loudly rather than silently passing.
    const freshPassage = 'Arctic Circle is stated as a member here.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        () => [owned(GEMINI_UI_CHROME_PASSAGE, 'operation')],
      );

      expect(log.some((l) => /REJECTED an owned passage/.test(l) && /FIX 3/.test(l))).toBe(true);
      // Rejected mechanically -- falls through to the (mocked) fresh query, same as if no owned
      // evidence had ever been supplied.
      // D-BP153-027: the fresh query's direct side names only G (1 of 9); the complement call
      // exhausts queuedFetch() (only ONE response is queued here) and comes back null/empty --
      // COMPLEMENT-SILENT-AND-PARTIAL, so the ONE completion follow-up fires and goes straight to
      // askGoogle again. The follow-up's own extraction also lands on the exhausted queue and adds
      // nothing, so `members` is unchanged.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(result.answeredFrom).toBe('new-query');
      expect(result.members).toEqual(['G']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('establishFrame() applies the identical FIX 3 rejection to the same passage', async () => {
    const originalFetch = global.fetch;
    const freshPassage = 'Arctic Circle is a climatic zone, not a world region.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note,
        () => [owned(GEMINI_UI_CHROME_PASSAGE, 'operation')],
      );
      expect(log.some((l) => /REJECTED an owned passage/.test(l) && /FIX 3/.test(l))).toBe(true);
      // D-BP153-027: same COMPLEMENT-SILENT-AND-PARTIAL shape as the sibling test above (fresh-query
      // direct side names only G of 9, complement silent) -- the ONE completion follow-up fires.
      // `excluded` is unchanged.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.excluded).toEqual(['G']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-016 TEST 6 -- no ownedPassages accessor at all behaves identically to before this ticket', () => {
  test('extractNamedSetMembers(): omitting the accessor entirely falls straight to the query path, unchanged', async () => {
    const originalFetch = global.fetch;
    const freshPassage = 'Arctic Circle is stated as a member here.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note } = notes();
      // No sixth argument at all -- the exact call shape every pre-this-ticket call site used.
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      // D-BP153-027: direct names only G (1 of 9), complement is silent (queuedFetch() only has ONE
      // response) -- COMPLEMENT-SILENT-AND-PARTIAL, so the ONE completion follow-up fires and goes
      // straight to askGoogle again. `members` is unchanged.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(result.answeredFrom).toBe('new-query');
      expect(result.ownedPassageIndex).toBeNull();
      expect(result.members).toEqual(['G']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('establishFrame(): omitting the accessor entirely falls straight to the query path, unchanged', async () => {
    const originalFetch = global.fetch;
    const freshPassage = 'Arctic Circle is a climatic zone, not a world region.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);
      // D-BP153-027: same COMPLEMENT-SILENT-AND-PARTIAL shape as the sibling test above (direct
      // names only G of 9, complement silent) -- the ONE completion follow-up fires. `excluded` is
      // unchanged.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.ownedPassageIndex).toBeNull();
      expect(frame.excluded).toEqual(['G']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
