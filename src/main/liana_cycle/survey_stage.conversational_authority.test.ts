// survey_stage.conversational_authority.test.ts -- D-BP152-044/BISHOP/seg-last-mile-gemini
//
// Founder, BP152, verbatim ruling: "fix the last mile - let the liana cycle ask gemini". The
// measured wall: SURVEY's two META-questions (the ambiguity query, askAmbiguity(); the operation
// query, askOperation()) went to Google -- a document lookup that cannot answer a question ABOUT
// a question -- and came back an off-topic passage (qid 98,
// HARDWIRE\LEDGER\LIANA_RUNS\LIANA_RUN_qid98_2026-08-11T18-09-09-616Z.json). This ticket wires a
// new, OPTIONAL `ctx.askConversationalAuthority` (method_registry.ts) that askAmbiguity()/
// askOperation() try FIRST for those two queries only, via a new shared helper
// (obtainMetaQuestionPassage(), survey_stage.ts), falling back to the pre-existing
// `googleBlocks(ctx.askGoogle, ...)` path on any non-ok result.
//
// Same convention as this file's siblings (demand_test.six_demand_types.test.ts,
// liana_terminal_engine.pause_at_step_zero.test.ts): vitest directly against SOURCE, never dist
// (PROCESS SAFETY forbids writing into dist\ while the Founder's own app may be running). No
// electron mock needed -- survey_stage.ts and everything it imports (method_registry.ts,
// methods/comparative_cascade.ts, query_text_loader.ts, elements/*, demand_test.ts) has zero
// electron dependency, same as survey_stage.test.ts's own header already documents.
//
// THIS TICKET'S OWN SEVEN ASSERTIONS, mapped to the describe/test blocks below:
//   (a) the ambiguity and operation queries route to the conversational authority when it answers
//       -> "askAmbiguity() -- conversational authority answers", "askOperation() -- conversational
//          authority answers"
//   (b) every other query still goes to Google unchanged
//       -> "founderStep2Survey() -- constraint/threshold questions never read
//          askConversationalAuthority" + "askAmbiguity()/askOperation() -- undefined
//          askConversationalAuthority is byte-identical to the pre-existing Google-only path"
//   (c) threads never cross authorities
//       -> NOT re-tested here -- this ticket reuses createNexusRunThreadContext()/
//          runMachineDrivenNexusQuery() (D-BP152-030R/031/033) completely unchanged; that
//          guarantee is already unit-tested in browser_authority_types.run_thread_context.test.ts
//          and nexus_authority_persistent_session.machine_driven.test.ts. What THIS file verifies
//          is that index.ts's askConversationalAuthority closure is the ONLY thing threaded into
//          survey_stage.ts, and that survey_stage.ts itself never invents a second query/thread
//          concept -- see "askAmbiguity()/askOperation() -- the query text handed to the
//          conversational authority is byte-identical to the query text handed to Google".
//   (d) an unavailable or refused conversational authority falls back to Google, not a hang
//       -> "askAmbiguity() -- conversational authority refuses, falls back to Google",
//          "askOperation() -- conversational authority refuses, falls back to Google"
//   (e) the transcript records which authority answered each meta-question
//       -> every test below asserts on the emitted PARSER INSTRUMENT note lines directly, plus
//          "answeredByAuthority" is asserted on the returned result
//   (f) no judgment prompt was added
//       -> "askAmbiguity()/askOperation() -- the query text handed to the conversational authority
//          is byte-identical to the query text handed to Google" (the SAME askedText/query is sent
//          to whichever surface answers -- no additional rate/judge/decide instruction is built
//          anywhere in this file)
//   (g) the three cascade files are byte-identical -- verified by `git diff` in the deliverable,
//       not by a test in this file (nothing in this file touches comparative_cascade.ts,
//       definitional_cascade.ts, or classify_cascade.ts -- gemmaExtract()/googleBlocks() are
//       IMPORTED, unmodified, same as survey_stage.ts's own pre-existing usage).

import { describe, test, expect } from 'vitest';
import { askAmbiguity, askOperation, founderStep2Survey } from './survey_stage';
import type { ConversationalAuthorityResult, MethodRunContext } from './method_registry';

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

function noteTexts(events: TerminalEvent[]): string[] {
  return events.filter((e) => e.kind === 'note').map((e) => e.text);
}

// Mocks gemmaExtract()'s own Ollama call (comparative_cascade.ts's global fetch()) so no real
// Ollama instance is required to run this file -- same technique survey_stage.test.ts's own 1h/1i/
// 1j/1k/1l blocks already use. Distinguishes the ambiguity-shape call from the operation-shape call
// by inspecting the outgoing prompt's declared JSON shape, same technique those blocks use to tell
// apart the ambiguity call from the per-term constraint call.
function mockOllamaFetch(ambiguityTerms: unknown[], operationAnswer: string) {
  return async (_url: unknown, opts: { body: string }) => {
    const body = JSON.parse(opts.body);
    const prompt: string = body.prompt || '';
    if (/"answer":"the operation exactly/.test(prompt)) {
      return { json: async () => ({ response: JSON.stringify({ answer: operationAnswer }) }) };
    }
    return { json: async () => ({ response: JSON.stringify({ terms: ambiguityTerms }) }) };
  };
}

const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

describe('D-BP152-044 -- askAmbiguity(): the ambiguity meta-question tries a conversational authority first', () => {
  test('conversational authority answers -- Google is never called, the transcript names the authority', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetch(
      [{ term: 'densely populated', standardMeaning: 'people per sq mile', alternativeMeaning: 'total population', impact: 'changes which region qualifies', isNegation: false }],
      'ranked',
    );
    let googleCalls = 0;
    let convoCalls = 0;
    const askConversationalAuthority = async (question: string): Promise<ConversationalAuthorityResult> => {
      convoCalls++;
      return { ok: true, text: `Gemini answering: "${question}" -- densely populated could mean two things.`, citations: ['https://gemini.example/answer'], via: 'user_gemini:settled', authority: 'user_gemini' };
    };
    const { ctx, events } = fakeCtx({
      askGoogle: async () => { googleCalls++; return null; },
      askConversationalAuthority,
    });
    try {
      const r = await askAmbiguity(QUESTION, ctx, 'google');
      expect(googleCalls).toBe(0);
      expect(convoCalls).toBe(1);
      expect(r.modelUnreachable).toBe(false);
      expect(r.answeredByAuthority).toBe('user_gemini');
      expect(r.terms.length).toBe(1);
      expect(r.citations).toEqual(['https://gemini.example/answer']);
      const notes = noteTexts(events);
      expect(notes.some((t) => /PARSER INSTRUMENT \[ambiguity\] query SENT to conversational authority/.test(t))).toBe(true);
      expect(notes.some((t) => /PARSER INSTRUMENT \[ambiguity\] ANSWERED BY: user_gemini/.test(t))).toBe(true);
      expect(notes.some((t) => /query SENT to Google/.test(t))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('conversational authority refuses (operator engaged) -- falls back to Google, never hangs', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetch(
      [{ term: 'densely populated', standardMeaning: 'a', alternativeMeaning: 'b', impact: 'c', isNegation: false }],
      'ranked',
    );
    let googleCalls = 0;
    const askConversationalAuthority = async (): Promise<ConversationalAuthorityResult> =>
      ({ ok: false, text: '', citations: [], via: 'user_gemini:refused(window_visible_operator_may_be_using_it)', authority: 'user_gemini' });
    const { ctx, events } = fakeCtx({
      askGoogle: async () => {
        googleCalls++;
        return {
          snippet: '"densely populated" standardly means people per square mile.',
          sourceUrl: 'https://example.com/densely-populated',
          authority: 'user_google' as const,
          selectorUsed: 'answer_box',
          citations: [],
        };
      },
      askConversationalAuthority,
    });
    try {
      const r = await askAmbiguity(QUESTION, ctx, 'google');
      expect(googleCalls).toBeGreaterThan(0);
      expect(r.answeredByAuthority).toBe('google');
      expect(r.modelUnreachable).toBe(false);
      expect(r.terms.length).toBe(1);
      const notes = noteTexts(events);
      expect(notes.some((t) => /conversational authority UNAVAILABLE .*refused\(window_visible_operator_may_be_using_it\)/.test(t))).toBe(true);
      expect(notes.some((t) => /falling back to Google/.test(t))).toBe(true);
      expect(notes.some((t) => /query SENT to Google \(untruncated, verbatim\)/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('conversational authority refuses AND Google is unreachable -- an honest refusal, never a fabrication', async () => {
    // googleBlocks() (methods/comparative_cascade.ts, imported unmodified) retries 3 times with a
    // 4s/8s backoff when askGoogle keeps returning null -- real behavior this test deliberately
    // exercises (the fallback truly reaches Google, not a short-circuit), so it needs more than
    // vitest's default 5s test timeout.
    const askConversationalAuthority = async (): Promise<ConversationalAuthorityResult> =>
      ({ ok: false, text: '', citations: [], via: 'user_gemini:failed(disabled)', authority: 'user_gemini' });
    const { ctx } = fakeCtx({ askGoogle: async () => null, askConversationalAuthority });
    const r = await askAmbiguity(QUESTION, ctx, 'google');
    expect(r.modelUnreachable).toBe(true);
    expect(r.terms.length).toBe(0);
    expect(r.answeredByAuthority).toBeNull();
    expect(r.why).toMatch(/No source was reachable/);
  }, 15000);

  test('undefined askConversationalAuthority -- falls back to Google, and D-BP152-052 makes the fallback say why', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetch(
      [{ term: 'densely populated', standardMeaning: 'a', alternativeMeaning: 'b', impact: 'c', isNegation: false }],
      'ranked',
    );
    let googleCalls = 0;
    const { ctx, events } = fakeCtx({
      askGoogle: async () => {
        googleCalls++;
        return {
          snippet: '"densely populated" standardly means people per square mile.',
          sourceUrl: 'https://example.com/densely-populated',
          authority: 'user_google' as const,
          selectorUsed: 'answer_box',
          citations: [],
        };
      },
      // askConversationalAuthority intentionally omitted -- every pre-existing MethodRunContext
      // construction site (script_bridge.ts's Composer path, e.g.) never passes it.
    });
    try {
      const r = await askAmbiguity(QUESTION, ctx, 'google');
      expect(googleCalls).toBe(1);
      expect(r.answeredByAuthority).toBe('google');
      const notes = noteTexts(events);
      // Never attempted -- there is nothing to try when the field itself is undefined.
      expect(notes.some((t) => /query SENT to conversational authority/.test(t))).toBe(false);
      expect(notes.some((t) => /ANSWERED BY:/.test(t))).toBe(false);
      // D-BP152-052: the fallback is no longer silent -- it now says WHY, distinct from the
      // "conversational authority UNAVAILABLE" wording used when it WAS tried and refused/failed
      // (see the sibling test above, "conversational authority refuses...").
      expect(notes.some((t) => /no conversational authority is wired for this call/.test(t))).toBe(true);
      expect(notes.some((t) => /query SENT to Google \(untruncated, verbatim\)/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP152-044 -- askOperation(): the operation meta-question tries a conversational authority first', () => {
  test('conversational authority answers -- Google is never called', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetch([], 'ranked');
    let googleCalls = 0;
    let convoCalls = 0;
    const askConversationalAuthority = async (question: string): Promise<ConversationalAuthorityResult> => {
      convoCalls++;
      return { ok: true, text: `Gemini: this question about "${question}" wants things ranked.`, citations: [], via: 'user_gemini:settled', authority: 'user_gemini' };
    };
    const { ctx, events } = fakeCtx({
      askGoogle: async () => { googleCalls++; return null; },
      askConversationalAuthority,
    });
    try {
      const r = await askOperation(QUESTION, ctx, 'google');
      expect(googleCalls).toBe(0);
      expect(convoCalls).toBe(1);
      expect(r.rawAnswer).toBe('ranked');
      expect(r.answeredByAuthority).toBe('user_gemini');
      const notes = noteTexts(events);
      expect(notes.some((t) => /PARSER INSTRUMENT \[operation\] ANSWERED BY: user_gemini/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('conversational authority refuses (window not open) -- falls back to Google', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetch([], 'ranked');
    let googleCalls = 0;
    const askConversationalAuthority = async (): Promise<ConversationalAuthorityResult> =>
      ({ ok: false, text: '', citations: [], via: 'user_gemini:failed(disabled)', authority: 'user_gemini' });
    const { ctx } = fakeCtx({
      askGoogle: async () => {
        googleCalls++;
        return {
          snippet: 'This question wants things ranked.',
          sourceUrl: 'https://example.com/op',
          authority: 'user_google' as const,
          selectorUsed: 'answer_box',
          citations: [],
        };
      },
      askConversationalAuthority,
    });
    try {
      const r = await askOperation(QUESTION, ctx, 'google');
      expect(googleCalls).toBeGreaterThan(0);
      expect(r.rawAnswer).toBe('ranked');
      expect(r.answeredByAuthority).toBe('google');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('the query text handed to the conversational authority is byte-identical to the query text handed to Google -- no judgment prompt added', async () => {
    // googleBlocks() retries 3 times (4s/8s backoff) when askGoogle keeps returning null -- see
    // the sibling "Google is unreachable" test above for why this needs more than vitest's
    // default 5s timeout. Every retry sends the SAME query text, which is exactly what this test
    // checks (asserted via .every() below, not just the first call).
    const seenQueries: string[] = [];
    const askConversationalAuthority = async (question: string): Promise<ConversationalAuthorityResult> => {
      seenQueries.push(question);
      return { ok: false, text: '', citations: [], via: 'user_gemini:failed(disabled)', authority: 'user_gemini' };
    };
    const googleQueries: string[] = [];
    const { ctx } = fakeCtx({
      askGoogle: async (q: string) => { googleQueries.push(q); return null; },
      askConversationalAuthority,
    });
    await askOperation(QUESTION, ctx, 'google');
    expect(seenQueries.length).toBe(1);
    expect(googleQueries.length).toBeGreaterThan(0);
    // The SAME string reaches both surfaces -- the Founder's own question text plus the Founder's
    // own operation query, nothing added (no "rate", "judge", "decide", "evaluate" instruction).
    expect(googleQueries.every((q) => q === seenQueries[0])).toBe(true);
    expect(seenQueries[0]).toContain(QUESTION);
    expect(/rate|judge|evaluate|decide which/i.test(seenQueries[0])).toBe(false);
  }, 15000);
});

describe('D-BP152-044 -- every OTHER Survey query still goes straight to Google, unaffected', () => {
  test('founderStep2Survey(): constraint and threshold questions never read askConversationalAuthority', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = async (_url: unknown, opts: { body: string }) => {
      const body = JSON.parse(opts.body);
      const prompt: string = body.prompt || '';
      if (/"answer":"the operation exactly/.test(prompt)) {
        return { json: async () => ({ response: JSON.stringify({ answer: 'ranked' }) }) };
      }
      if (/CONSTRAINT QUESTION:|specific definition and scale being|THRESHOLD/.test(prompt)) {
        return { json: async () => ({ response: JSON.stringify({ answer: 'a stated constraint answer' }) }) };
      }
      return { json: async () => ({ response: JSON.stringify({ terms: [{ term: 'densely populated', standardMeaning: 'a', alternativeMeaning: 'b', impact: 'c', isNegation: false }] }) }) };
    };
    let convoCalls = 0;
    const askConversationalAuthority = async (): Promise<ConversationalAuthorityResult> => {
      convoCalls++;
      return { ok: true, text: 'should never be reached by a non-meta query', citations: [], via: 'user_gemini:settled', authority: 'user_gemini' };
    };
    let googleCalls = 0;
    const { ctx } = fakeCtx({
      askGoogle: async () => {
        googleCalls++;
        return {
          snippet: 'a real google passage',
          sourceUrl: 'https://example.com/x',
          authority: 'user_google' as const,
          selectorUsed: 'answer_box',
          citations: [],
        };
      },
      askConversationalAuthority,
    });
    try {
      const r = await founderStep2Survey(null, ctx, QUESTION, 'google');
      // askAmbiguity (1) + askOperation (1) both went to the conversational authority; the
      // constraint question (1 per named term) and the threshold question (1 per named term) did
      // NOT -- convoCalls stays exactly 2 (ambiguity + operation), never grows with the number of
      // named terms' own constraint/threshold questions.
      expect(convoCalls).toBe(2);
      expect(googleCalls).toBeGreaterThan(0);
      expect(r.constraints.length).toBeGreaterThan(0);
      expect(r.constraints[0].obtained).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
