// classify_cascade.conversational_authority_routing.test.ts -- D-BP153-024/BISHOP/seg-classify-024
//
// THE MEASURED FAILURE (live run, receipt LIANA_RUN_qid98_2026-08-13T02-29-52-712Z.json). THE
// SOFTBALLS' reworded frame query (D-BP153-021/023) was finally issued, and went straight to
// askGoogle: "nobox+organic(5)" -- a page of organic web-search links -- which named NONE of the
// nine options under test, so the frame correctly refused rather than guess. In the SAME run, the
// operation meta-question (survey_stage.ts's own askOperation(), which already tries
// `ctx.askConversationalAuthority` first) went to `user_gemini` and returned usable prose. THE
// SOFTBALLS/THE NAMED SET/THE DISCRIMINATOR (establishFrame()/extractNamedSetMembers()/
// runDiscriminator()) are CONVERSATIONAL questions -- a structured, per-item accounting across
// every option -- exactly the shape a page of search-result links cannot answer.
//
// THE FIX UNDER TEST. All three functions now take a trailing, OPTIONAL `askConversationalAuthority`
// parameter and route their own fresh-query fallthrough through obtainCascadePassage()
// (classify_cascade.ts, mirrors survey_stage.ts's own obtainMetaQuestionPassage() deliberately):
// try the conversational authority first, fall back to askGoogle on any non-ok result, and go
// straight to askGoogle when no conversational authority is threaded at all (byte-identical to
// this file's own behavior before this ticket).
//
// SAME OFFLINE CONVENTION every classify_cascade.*.test.ts sibling already uses: askGoogle is a
// local stub, `global.fetch` (gemmaExtract()'s own Ollama channel) is monkey-patched per test, and
// no live network, Ollama, or Electron browser automation happens anywhere in this file.

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
import { establishFrame, extractNamedSetMembers, runDiscriminator } from './classify_cascade';
import type { MethodRunContext, OwnedPassage, ConversationalAuthorityResult } from '../method_registry';

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
const ALL = Object.keys(OPT);
const CATEGORY = 'world regions';
const CATEGORY_KIND = 'legitimate world region';
const OTHER_KIND = 'not a legitimate world region';

/** D-BP153-032: establishFrame() now extracts a STATED KIND per option plus a stated category
 *  denotation (extractFrameKinds()/applyFrameKindElimination()) in ONE gemmaExtract() call, never a
 *  direct/complement pair -- see classify_cascade.ts's own D-BP153-032 section header. Builds a
 *  COMPLETE, all-nine-options passage + reply so this file's establishFrame() tests (which are about
 *  AUTHORITY ROUTING, not about incomplete-coverage fall-through) terminate in exactly ONE
 *  acquisition, same as their original pre-D-BP153-032 shape did. */
function fullCoverageFrame(excludedLetters: string[], introText: string): { passage: string; response: string } {
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

/** Same queuedFetch() convention classify_cascade.owned_evidence_frame.test.ts already establishes
 *  -- see that file's own header for why the cast is narrow and deliberate. An exhausted queue
 *  throws, which gemmaExtract()'s own try/catch turns into a silent `null` -- so a test that only
 *  cares about ROUTING (not the extraction arithmetic, already covered by this file's siblings) may
 *  under-queue on purpose. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

/** A usable conversational answer -- same real shape classify_cascade.owned_evidence_frame.test.ts's
 *  own fixture uses for an owned passage, here returned by a mocked `askConversationalAuthority`
 *  instead. D-BP153-032: extended with a complete stated-kind response, below. */
const { passage: CONVO_PASSAGE, response: CONVO_FRAME_RESPONSE } = fullCoverageFrame(
  ['A', 'C', 'F', 'G', 'H', 'I'],
  "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
    + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
    + 'densely populated regions.',
);

function okConvo(text = CONVO_PASSAGE): ConversationalAuthorityResult {
  return { ok: true, text, citations: ['https://example.com/geography'], via: 'nexus-gemini', authority: 'user_gemini' };
}
function refusedConvo(): ConversationalAuthorityResult {
  return {
    ok: false, text: '', citations: [], via: 'nexus-window-not-open', authority: 'none',
  };
}

describe('D-BP153-024: establishFrame() tries the conversational authority before Google', () => {
  test('TEST 1, HEADLINE: a conversational authority that returns a usable passage is used, and askGoogle is NEVER called', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([CONVO_FRAME_RESPONSE]);
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- the conversational authority answered' }));
    const convo = vi.fn(async () => okConvo());
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
        undefined, // ownedPassages
        undefined, // property
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );

      expect(askGoogle).not.toHaveBeenCalled(); // THE POINT OF THE FIX
      // D-BP153-032: a single, COMPLETE stated-kind accounting answers in ONE acquisition -- no
      // incomplete-coverage fall-through, no follow-up needed.
      expect(convo).toHaveBeenCalledTimes(1);
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query'); // a fresh acquisition, just not from Google
      expect(new Set(frame.excluded)).toEqual(new Set(['A', 'C', 'F', 'G', 'H', 'I']));

      // TEST 4: THE RECEIPT SAYS WHICH -- both the transcript and the returned `via` name the
      // authority that actually answered.
      expect(log.some((l) => /ANSWERED BY: user_gemini/.test(l))).toBe(true);
      expect(frame.via).toMatch(/answered by user_gemini/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 2: a conversational authority that refuses (ok:false) falls back to askGoogle exactly as today', async () => {
    const originalFetch = global.fetch;
    const { passage: freshPassage, response } = fullCoverageFrame(['G'], 'Arctic Circle is a climatic zone, not a world region.');
    global.fetch = queuedFetch([response]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    const convo = vi.fn(async () => refusedConvo());
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, undefined, undefined,
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );

      // D-BP153-032: a single, complete stated-kind accounting answers in ONE acquisition -- no
      // follow-up needed.
      expect(convo).toHaveBeenCalledTimes(1); // tried first
      expect(askGoogle).toHaveBeenCalledTimes(1); // then fell back
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(new Set(frame.excluded)).toEqual(new Set(['G']));
      expect(frame.via).not.toMatch(/answered by/); // the Google branch is UNCHANGED -- no authority tag added
      expect(log.some((l) => /conversational authority UNAVAILABLE/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME: query SENT to Google/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 3: no conversational authority supplied at all -- behavior BYTE-IDENTICAL to before this ticket', async () => {
    const originalFetch = global.fetch;
    const { passage: freshPassage, response } = fullCoverageFrame(['G'], 'Arctic Circle is a climatic zone, not a world region.');
    global.fetch = queuedFetch([response]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note, log } = notes();
      // The exact 5-argument call shape every pre-existing call site (before this ticket) used --
      // no 6th/7th/8th argument at all.
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // D-BP153-032: a single, complete stated-kind accounting answers in ONE query -- no follow-up
      // needed (no conversational authority threaded here either).
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(new Set(frame.excluded)).toEqual(new Set(['G']));
      expect(log.some((l) => /no conversational authority is wired for this call/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 5: owned-evidence-first still wins -- a complete owned passage means NEITHER authority is queried', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([CONVO_FRAME_RESPONSE]);
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED' }));
    const convo = vi.fn(async () => okConvo());
    try {
      const { note } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
        () => [owned(CONVO_PASSAGE)], // owned evidence already answers this
        undefined,
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );

      expect(askGoogle).not.toHaveBeenCalled();
      expect(convo).not.toHaveBeenCalled(); // NEITHER authority is queried
      expect(frame.answeredFrom).toBe('owned-passage');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-024: extractNamedSetMembers() tries the conversational authority before Google', () => {
  test('TEST 1, HEADLINE: conversational authority answers, askGoogle NEVER called, receipt names the authority', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        members: ['South Asia', 'Northeast United States', 'Europe'].map((name) => ({ name, span: CONVO_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED' }));
    const convo = vi.fn(async () => okConvo());
    try {
      const { note, log } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        undefined,
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      // D-BP153-027: direct names {B,D,E} (3 of 9), complement is silent (only ONE gemma response
      // queued) -- COMPLEMENT-SILENT-AND-PARTIAL, so the ONE completion follow-up fires and tries
      // the conversational authority again. The follow-up's own extraction lands on the exhausted
      // queue and adds nothing, so `members` is unchanged.
      expect(convo).toHaveBeenCalledTimes(2);
      expect(result.available).toBe(true);
      expect(new Set(result.members)).toEqual(new Set(['B', 'D', 'E']));
      expect(log.some((l) => /ANSWERED BY: user_gemini/.test(l))).toBe(true);
      expect(result.via).toMatch(/answered by user_gemini/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 2: conversational authority refuses -- falls back to askGoogle exactly as today', async () => {
    const originalFetch = global.fetch;
    const freshPassage = 'South Asia is the most densely populated region.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [{ name: 'South Asia', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    const convo = vi.fn(async () => refusedConvo());
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, 'most', 'densely populated', ALL, OPT, note,
        undefined,
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );
      // D-BP153-027: direct names only B (1 of 9), complement is silent -- COMPLEMENT-SILENT-AND-
      // PARTIAL, so the ONE completion follow-up fires and repeats the same try-convo-then-Google
      // routing a second time. `members` is unchanged.
      expect(convo).toHaveBeenCalledTimes(2);
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(result.answeredFrom).toBe('new-query');
      expect(result.members).toEqual(['B']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 3: no conversational authority supplied -- behavior BYTE-IDENTICAL to before this ticket', async () => {
    const originalFetch = global.fetch;
    const freshPassage = 'South Asia is the most densely populated region.';
    global.fetch = queuedFetch([
      JSON.stringify({ members: [{ name: 'South Asia', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note } = notes();
      const result = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, 'most', 'densely populated', ALL, OPT, note,
      );
      // D-BP153-027: same COMPLEMENT-SILENT-AND-PARTIAL shape (direct names only B of 9, complement
      // silent, no conversational authority threaded) -- the ONE completion follow-up fires and goes
      // straight to askGoogle again. `members` is unchanged.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(result.answeredFrom).toBe('new-query');
      expect(result.members).toEqual(['B']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-024: runDiscriminator() tries the conversational authority before Google', () => {
  const CANDIDATES = ['A', 'C', 'F'];
  const DISCRIMINATOR_PASSAGE = "According to Google's own entity classification, South America is labeled a "
    + 'Continent. North Africa is labeled a Colloquial area, not a formally defined world region. Central Asia '
    + 'is also labeled a Colloquial area. Only a Continent is properly considered a world region.';

  test('TEST 1, HEADLINE: conversational authority answers, askGoogle NEVER called, receipt names the authority', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'Continent', span: "According to Google's own entity classification, South America is labeled a Continent." },
          { name: 'North Africa', kind: 'Colloquial area', span: 'North Africa is labeled a Colloquial area, not a formally defined world region.' },
          { name: 'Central Asia', kind: 'Colloquial area', span: 'Central Asia is also labeled a Colloquial area.' },
        ],
        category_kind: 'Continent',
        category_kind_span: 'Only a Continent is properly considered a world region.',
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED' }));
    const convo = vi.fn(async () => okConvo(DISCRIMINATOR_PASSAGE));
    try {
      const { note, log } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note,
        undefined,
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(convo).toHaveBeenCalledTimes(1);
      expect(result.unique).toBe('A');
      expect(log.some((l) => /ANSWERED BY: user_gemini/.test(l))).toBe(true);
      expect(result.via).toMatch(/answered by user_gemini/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 2: conversational authority refuses -- falls back to askGoogle exactly as today', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America, North Africa, and Central Asia are each large geographic areas.' }));
    const convo = vi.fn(async () => refusedConvo());
    try {
      const { note } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note,
        undefined,
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );
      expect(convo).toHaveBeenCalledTimes(1);
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(result.answeredFrom).toBe('new-query');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 3: no conversational authority supplied -- behavior BYTE-IDENTICAL to before this ticket', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'South America, North Africa, and Central Asia are each large geographic areas.' }));
    try {
      const { note } = notes();
      const result = await runDiscriminator(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, CANDIDATES, OPT, note,
      );
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(result.answeredFrom).toBe('new-query');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
