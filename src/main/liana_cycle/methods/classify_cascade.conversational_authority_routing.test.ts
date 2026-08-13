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

import { describe, test, expect, vi } from 'vitest';
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
 *  instead. */
const CONVO_PASSAGE = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
  + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
  + 'densely populated regions. Only B (South Asia), D (Northeast United States), and E (Europe) are '
  + 'recognized in human geography as major global population clusters.';

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
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: CONVO_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
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
    const freshPassage = 'Arctic Circle is a climatic zone, not a world region.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    const convo = vi.fn(async () => refusedConvo());
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, undefined, undefined,
        convo as unknown as MethodRunContext['askConversationalAuthority'],
      );

      expect(convo).toHaveBeenCalledTimes(1); // tried first
      expect(askGoogle).toHaveBeenCalledTimes(1); // then fell back
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.excluded).toEqual(['G']);
      expect(frame.via).not.toMatch(/answered by/); // the Google branch is UNCHANGED -- no authority tag added
      expect(log.some((l) => /conversational authority UNAVAILABLE/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME: query SENT to Google/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 3: no conversational authority supplied at all -- behavior BYTE-IDENTICAL to before this ticket', async () => {
    const originalFetch = global.fetch;
    const freshPassage = 'Arctic Circle is a climatic zone, not a world region.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [{ name: 'Arctic Circle', span: freshPassage }], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: freshPassage }));
    try {
      const { note, log } = notes();
      // The exact 5-argument call shape every pre-existing call site (before this ticket) used --
      // no 6th/7th/8th argument at all.
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.excluded).toEqual(['G']);
      expect(log.some((l) => /no conversational authority is wired for this call/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 5: owned-evidence-first still wins -- a complete owned passage means NEITHER authority is queried', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({
        not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert']
          .map((name) => ({ name, span: CONVO_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
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
      expect(convo).toHaveBeenCalledTimes(1);
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
      expect(convo).toHaveBeenCalledTimes(1);
      expect(askGoogle).toHaveBeenCalledTimes(1);
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
      expect(askGoogle).toHaveBeenCalledTimes(1);
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
