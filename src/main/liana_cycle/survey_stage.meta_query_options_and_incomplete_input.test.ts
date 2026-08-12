// survey_stage.meta_query_options_and_incomplete_input.test.ts -- D-BP153-007/BISHOP/seg-meta-
// queries-carry-options
//
// THE EVIDENCE THIS CLOSES (verbatim, do not re-derive -- see BISHOP_DROPZONE\RULINGS_BP153.md,
// FD-BP153-03, and BISHOP_DROPZONE\BP153_LIVE_RUN_FINDING_META_QUERIES_OMIT_OPTIONS.md). A real
// qid 98 run recorded this query to the evidence store, OPTIONS MISSING:
//
//   "Which of the following world regions is NOT considered one of the world's most densely
//   populated regions?\n\nAnd then what operation does this question require in order to answer
//   it: does it want things ranked, defined, classified, or inferred from evidence? Or does it
//   want something identified, or placed within a framework?"
//
// Gemini's reply opened, verbatim: "Because specific options were omitted from your prompt, here
// are the world's primary major population clusters..." -- a REFUSAL, not an answer. The pipeline
// extracted "identified" out of that refusal, mapped it to DEMAND: IDENTIFY, and died at method
// selection.
//
// TWO INDEPENDENT FIXES, tested here, each on its own:
//   D1 -- askAmbiguity()/askOperation() now carry the question's own options in their query, so an
//     authority answering has something to answer ABOUT. Threading (not rendering) is the only
//     thing under test at the founderStep2Survey()/runSurveyStage() layer; the query-shape itself
//     is tested directly against askAmbiguity()/askOperation().
//   D2 -- statesIncompleteInput() (survey_stage.ts) makes a stated-incomplete-input passage a
//     refusal, never mined for an answer, independent of whether D1 fixed the missing options.
//
// SAME CONVENTION as this file's siblings (survey_stage.term_span.test.ts,
// survey_stage.conversational_authority.test.ts): vitest directly against SOURCE, never dist
// (PROCESS SAFETY forbids writing into dist\). No electron mock needed -- survey_stage.ts has zero
// electron dependency. Offline throughout: `askGoogle` is a local stub, `global.fetch` (the
// gemmaExtract()/Ollama channel) is monkey-patched only where a test explicitly needs it, and is
// made to THROW where a test asserts gemmaExtract() is never reached.

import { describe, test, expect } from 'vitest';
import { askAmbiguity, askOperation, statesIncompleteInput } from './survey_stage';
import { getQueryText } from './query_text_loader';
import type { MethodRunContext } from './method_registry';

type TerminalEvent = { kind: string; text: string; ts: string };

function fakeCtx(overrides: Partial<MethodRunContext> = {}) {
  const events: TerminalEvent[] = [];
  const ctx: MethodRunContext = {
    askGoogle: async () => null,
    emit: (e: TerminalEvent) => { events.push(e); },
    ...overrides,
  };
  return { ctx, events };
}

const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
const OPTIONS: Record<string, string> = {
  A: 'South America',
  B: 'South Asia',
  C: 'Western Europe',
  D: 'The Arctic Circle',
};

// The observed live phrase, verbatim (BP153_LIVE_RUN_FINDING_META_QUERIES_OMIT_OPTIONS.md), plus
// the surrounding sentence Gemini actually opened with.
const OBSERVED_REFUSAL_PASSAGE = "Because specific options were omitted from your prompt, here are the world's primary major population clusters, generally recognized by demographers and geographers.";

// A real, on-topic answer passage that happens to hedge in ordinary prose -- must NOT trip the
// predicate (guard against over-firing on "sounds unsure" language that is not a missing-input
// claim).
const NORMAL_HEDGING_PASSAGE = 'Population density is a somewhat contested measure; researchers are not entirely certain where the exact boundary of "most densely populated" lies, but South America is generally considered to have the lowest overall density among the listed regions.';

// Every test in the D1 describe block below has askGoogle answer immediately with a real, benign
// passage (so googleBlocks() succeeds on try #1 and never hits its sleep-and-retry backoff), which
// means these queries DO reach gemmaExtract() (Ollama/fetch) afterward -- each test therefore also
// stubs `global.fetch` with a small, honest, offline JSON response so no real network call happens.
// None of these tests assert anything about gemmaExtract()'s OWN output; they exist to prove the
// QUERY SENT (captured from askGoogle's own argument) has the right shape.
function mockOllamaFetchBenign() {
  return async () => ({ json: async () => ({ response: JSON.stringify({ terms: [], answer: '' }) }) });
}

describe('D-BP153-007, D1 -- askAmbiguity()/askOperation() carry the question\'s own options in their query', () => {
  test('askAmbiguity(): a query with options contains every option letter and label, between askText and askedText', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetchBenign();
    let capturedQuery = '';
    try {
      const { ctx } = fakeCtx({
        askGoogle: async (q: string) => {
          capturedQuery = q;
          return {
            snippet: 'a benign, on-topic answer passage, not used for any assertion in this test',
            sourceUrl: 'https://example.com/x',
            authority: 'user_google' as const,
            selectorUsed: 'organic',
            citations: [],
          };
        },
      });
      await askAmbiguity(QUESTION, ctx, 'google', OPTIONS);
      const askedText = getQueryText('survey.ambiguity.askedText');
      for (const [letter, label] of Object.entries(OPTIONS)) {
        expect(capturedQuery).toContain(`${letter}) ${label}`);
      }
      const expectedOptionsText = Object.keys(OPTIONS).sort().map((L) => `${L}) ${OPTIONS[L]}`).join(' ');
      expect(capturedQuery).toBe(`${QUESTION}\n\n${expectedOptionsText}\n\n${askedText}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  function benignAskGoogle(captureInto: { query: string }) {
    return async (q: string) => {
      captureInto.query = q;
      return {
        snippet: 'a benign, on-topic answer passage, not used for any assertion in this test',
        sourceUrl: 'https://example.com/x',
        authority: 'user_google' as const,
        selectorUsed: 'organic',
        citations: [],
      };
    };
  }

  test('askAmbiguity(): a null options argument produces a query byte-identical to before this ticket', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetchBenign();
    const captured = { query: '' };
    try {
      const { ctx } = fakeCtx({ askGoogle: benignAskGoogle(captured) });
      await askAmbiguity(QUESTION, ctx, 'google', null);
      const askedText = getQueryText('survey.ambiguity.askedText');
      expect(captured.query).toBe(`${QUESTION}\n\n${askedText}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askAmbiguity(): an OMITTED options argument (no 4th arg at all -- every pre-existing caller) is byte-identical too', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetchBenign();
    const captured = { query: '' };
    try {
      const { ctx } = fakeCtx({ askGoogle: benignAskGoogle(captured) });
      await askAmbiguity(QUESTION, ctx, 'google');
      const askedText = getQueryText('survey.ambiguity.askedText');
      expect(captured.query).toBe(`${QUESTION}\n\n${askedText}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askOperation(): a query with options contains every option letter and label, between askText and askedText', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetchBenign();
    const captured = { query: '' };
    try {
      const { ctx } = fakeCtx({ askGoogle: benignAskGoogle(captured) });
      await askOperation(QUESTION, ctx, 'google', OPTIONS);
      const askedText = getQueryText('survey.operation.askedText');
      for (const [letter, label] of Object.entries(OPTIONS)) {
        expect(captured.query).toContain(`${letter}) ${label}`);
      }
      const expectedOptionsText = Object.keys(OPTIONS).sort().map((L) => `${L}) ${OPTIONS[L]}`).join(' ');
      expect(captured.query).toBe(`${QUESTION}\n\n${expectedOptionsText}\n\n${askedText}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askOperation(): a null options argument produces a query byte-identical to before this ticket', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetchBenign();
    const captured = { query: '' };
    try {
      const { ctx } = fakeCtx({ askGoogle: benignAskGoogle(captured) });
      await askOperation(QUESTION, ctx, 'google', null);
      const askedText = getQueryText('survey.operation.askedText');
      expect(captured.query).toBe(`${QUESTION}\n\n${askedText}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askOperation(): an OMITTED options argument (no 4th arg at all) is byte-identical too', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetchBenign();
    const captured = { query: '' };
    try {
      const { ctx } = fakeCtx({ askGoogle: benignAskGoogle(captured) });
      await askOperation(QUESTION, ctx, 'google');
      const askedText = getQueryText('survey.operation.askedText');
      expect(captured.query).toBe(`${QUESTION}\n\n${askedText}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askAmbiguity(): an empty options object ({}) is treated the same as null/omitted -- no dangling separator', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetchBenign();
    const captured = { query: '' };
    try {
      const { ctx } = fakeCtx({ askGoogle: benignAskGoogle(captured) });
      await askAmbiguity(QUESTION, ctx, 'google', {});
      const askedText = getQueryText('survey.ambiguity.askedText');
      expect(captured.query).toBe(`${QUESTION}\n\n${askedText}`);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-007, D2 -- statesIncompleteInput(): the predicate itself', () => {
  test('detects the exact phrase observed in the live qid 98 run', () => {
    const r = statesIncompleteInput(OBSERVED_REFUSAL_PASSAGE);
    expect(r.incomplete).toBe(true);
    expect(r.matched).toBeTruthy();
    expect(r.matched!.toLowerCase()).toContain('omitted');
  });

  test('does NOT fire on a normal answer passage that merely hedges in ordinary prose (guard against over-firing)', () => {
    const r = statesIncompleteInput(NORMAL_HEDGING_PASSAGE);
    expect(r.incomplete).toBe(false);
    expect(r.matched).toBeNull();
  });

  test('does NOT fire on a plain, confident, on-topic answer passage', () => {
    const r = statesIncompleteInput('South America is the region with the lowest population density among the listed choices, per United Nations demographic data.');
    expect(r.incomplete).toBe(false);
    expect(r.matched).toBeNull();
  });
});

describe('D-BP153-007, D2 -- wired into askAmbiguity()/askOperation(): a stated-incomplete-input passage refuses instead of being mined', () => {
  test('askAmbiguity(): the observed Gemini refusal produces an honest empty result, and gemmaExtract() (Ollama/fetch) is never reached', async () => {
    const originalFetch = global.fetch;
    // If gemmaExtract() were reached despite the refusal, this would throw and fail the test --
    // proving the extraction call never happens on this branch, not merely asserting it by
    // inspection of the return value.
    (global as any).fetch = async () => { throw new Error('gemmaExtract() must not be called when statesIncompleteInput() fires'); };
    try {
      const { ctx, events } = fakeCtx({
        askGoogle: async () => ({
          snippet: OBSERVED_REFUSAL_PASSAGE,
          sourceUrl: 'https://example.com/x',
          authority: 'user_google' as const,
          selectorUsed: 'organic',
          citations: [],
        }),
      });
      const r = await askAmbiguity(QUESTION, ctx, 'google', OPTIONS);
      expect(r.terms).toEqual([]);
      expect(r.termsDroppedNotInQuestion).toEqual([]);
      expect(r.modelUnreachable).toBe(false); // the source WAS reachable -- it refused, which is different
      expect(r.rawModelOutput).toBeNull();
      expect(r.why).toMatch(/REFUSED/);
      expect(r.why).toMatch(/omitted/i);
      const notes = events.filter((e) => e.kind === 'note').map((e) => e.text);
      expect(notes.some((t) => /\[ambiguity\].*REFUSED/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askOperation(): the observed Gemini refusal produces an honest null rawAnswer, and gemmaExtract() (Ollama/fetch) is never reached', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = async () => { throw new Error('gemmaExtract() must not be called when statesIncompleteInput() fires'); };
    try {
      const { ctx, events } = fakeCtx({
        askGoogle: async () => ({
          snippet: OBSERVED_REFUSAL_PASSAGE,
          sourceUrl: 'https://example.com/x',
          authority: 'user_google' as const,
          selectorUsed: 'organic',
          citations: [],
        }),
      });
      const r = await askOperation(QUESTION, ctx, 'google', OPTIONS);
      expect(r.rawAnswer).toBeNull();
      expect(r.modelUnreachable).toBe(false);
      expect(r.rawModelOutput).toBeNull();
      expect(r.why).toMatch(/REFUSED/);
      expect(r.why).toMatch(/omitted/i);
      const notes = events.filter((e) => e.kind === 'note').map((e) => e.text);
      expect(notes.some((t) => /\[operation\].*REFUSED/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('askAmbiguity(): a normal answer passage still reaches gemmaExtract() (D2 does not suppress real answers)', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = async () => ({
      json: async () => ({ response: JSON.stringify({ terms: [] }) }),
    });
    try {
      const { ctx } = fakeCtx({
        askGoogle: async () => ({
          snippet: NORMAL_HEDGING_PASSAGE,
          sourceUrl: 'https://example.com/x',
          authority: 'user_google' as const,
          selectorUsed: 'organic',
          citations: [],
        }),
      });
      const r = await askAmbiguity(QUESTION, ctx, 'google', OPTIONS);
      // Reaching gemmaExtract() (rather than refusing before it) is what this test proves; an
      // empty terms list here is the mocked model's own honest "nothing usable" response, not a
      // sign the refusal path fired instead -- distinguished from the refusal tests above by `why`.
      expect(r.why).not.toMatch(/REFUSED/);
      expect(r.modelUnreachable).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
