// survey_stage.term_span.test.ts -- D-BP152-052/BISHOP/seg-term-span-and-routing, STAGE 1/2
//
// THE MEASURED FAILURE THIS CLOSES, verbatim from the completed live run
// (C:\Users\Administrator\Downloads\latestTest.md, line 561):
//   "DEMAND: UNKNOWN -- SURVEY STEP 2 did not resolve a term to survey (no quoted/cued term --
//   issued the Founder's ambiguity query instead, via GOOGLE; 4 term(s) named by the source
//   ("words", "phrases", "meaning", "fundamentally"), 0 surveyed further (FD-BP152-20 sig figs:
//   stated impact...), 4 dropped (no stated impact)"
//
// Every one of those four "ambiguous terms" is a word FROM the Founder's own ambiguity query
// ("what words or phrases in this question could be understood with a different meaning that
// would fundamentally change the meaning of what is being asked?"), never named in the QUESTION
// itself ("Which of the following world regions is NOT considered one of the world's most densely
// populated regions?"). This closes that: a named term must verify as a literal span of the
// QUESTION (literalSubjectSpan(), elements/method_question_generator.ts, reused unmodified) or it
// is dropped, logged with a reason distinct from the separate FD-BP152-20 "no stated impact" drop.
//
// Same convention as this file's sibling, survey_stage.conversational_authority.test.ts: vitest
// directly against SOURCE, never dist (PROCESS SAFETY forbids writing into dist\). No electron mock
// needed -- survey_stage.ts has zero electron dependency (see its own header).

import { describe, test, expect } from 'vitest';
import { askAmbiguity, founderStep2Survey } from './survey_stage';
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

function noteTexts(events: TerminalEvent[]): string[] {
  return events.filter((e) => e.kind === 'note').map((e) => e.text);
}

function mockOllamaFetch(ambiguityTerms: unknown[]) {
  return async (_url: unknown, opts: { body: string }) => ({
    json: async () => ({ response: JSON.stringify({ terms: ambiguityTerms }) }),
  });
}

const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

describe('D-BP152-052 -- a named ambiguous term must be a literal span of the QUESTION', () => {
  test('the exact measured failure: all four terms named are words from OUR OWN ambiguity query, none from the question -- all four DROPPED, distinct from the sig-figs drop', async () => {
    const originalFetch = global.fetch;
    // The exact four terms the live run's source named (latestTest.md line 561) -- every one a
    // word lifted from the Founder's own ambiguity query text, not the question.
    (global as any).fetch = mockOllamaFetch([
      { term: 'words', standardMeaning: 'a', alternativeMeaning: 'b', impact: '', isNegation: false },
      { term: 'phrases', standardMeaning: 'a', alternativeMeaning: 'b', impact: '', isNegation: false },
      { term: 'meaning', standardMeaning: 'a', alternativeMeaning: 'b', impact: '', isNegation: false },
      { term: 'fundamentally', standardMeaning: 'a', alternativeMeaning: 'b', impact: '', isNegation: false },
    ]);
    const { ctx, events } = fakeCtx({
      askGoogle: async () => ({
        snippet: 'a passage that names words, phrases, meaning, fundamentally as ambiguous',
        sourceUrl: 'https://example.com/x',
        authority: 'user_google' as const,
        selectorUsed: 'organic',
        citations: [],
      }),
    });
    try {
      const r = await askAmbiguity(QUESTION, ctx, 'google');
      // All four are dropped BEFORE `terms` is even populated -- none survive to the sig-figs step.
      expect(r.terms.length).toBe(0);
      expect(r.termsDroppedNotInQuestion.length).toBe(4);
      expect(r.termsDroppedNotInQuestion.map((t) => t.term).sort()).toEqual(['fundamentally', 'meaning', 'phrases', 'words']);
      const notes = noteTexts(events);
      for (const term of ['words', 'phrases', 'meaning', 'fundamentally']) {
        expect(notes.some((t) => t.includes(`ambiguity term "${term}" DROPPED -- not a literal span of the QUESTION`))).toBe(true);
      }
      expect(notes.some((t) => /TERM SPAN CHECK \[ambiguity, D-BP152-052\] kept 0 of 4/.test(t))).toBe(true);
      // Distinct from the separate FD-BP152-20 sig-figs drop -- that filter never ran (askAmbiguity()
      // alone does not apply it; founderStep2Survey() does, and only to terms that already survived
      // this span check), so its own "SIG FIGS [...] DROPPED" line never appears here.
      expect(notes.some((t) => /SIG FIGS \[ambiguity, FD-BP152-20\] DROPPED/.test(t))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('a term that IS a literal span of the question survives; a term that is not is dropped -- mixed case, both counts reported', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetch([
      { term: 'densely populated', standardMeaning: 'people per sq mile', alternativeMeaning: 'total population', impact: 'changes which region qualifies', isNegation: false },
      { term: 'fundamentally', standardMeaning: 'a', alternativeMeaning: 'b', impact: 'c', isNegation: false },
    ]);
    const { ctx, events } = fakeCtx({
      askGoogle: async () => ({
        snippet: 'a passage',
        sourceUrl: 'https://example.com/x',
        authority: 'user_google' as const,
        selectorUsed: 'organic',
        citations: [],
      }),
    });
    try {
      const r = await askAmbiguity(QUESTION, ctx, 'google');
      expect(r.terms.length).toBe(1);
      expect(r.terms[0].term).toBe('densely populated');
      expect(r.termsDroppedNotInQuestion.length).toBe(1);
      expect(r.termsDroppedNotInQuestion[0].term).toBe('fundamentally');
      const notes = noteTexts(events);
      expect(notes.some((t) => /TERM SPAN CHECK \[ambiguity, D-BP152-052\] kept 1 of 2/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('founderStep2Survey(): the two drop counts (not-in-question vs no-stated-impact) are reported SEPARATELY in the SURVEY STEP 2 transcript line', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = async (_url: unknown, opts: { body: string }) => {
      const body = JSON.parse(opts.body);
      const prompt: string = body.prompt || '';
      if (/"answer":"the operation exactly/.test(prompt)) {
        return { json: async () => ({ response: JSON.stringify({ answer: '' }) }) };
      }
      // Three terms: one a literal span WITH stated impact (survives both filters), one a literal
      // span with NO stated impact (survives the span check, dropped by sig figs), one NOT a
      // literal span at all (dropped by the span check, D-BP152-052).
      return {
        json: async () => ({
          response: JSON.stringify({
            terms: [
              { term: 'densely populated', standardMeaning: 'a', alternativeMeaning: 'b', impact: 'changes the answer', isNegation: false },
              { term: 'regions', standardMeaning: 'a', alternativeMeaning: 'b', impact: '', isNegation: false },
              { term: 'fundamentally', standardMeaning: 'a', alternativeMeaning: 'b', impact: 'c', isNegation: false },
            ],
          }),
        }),
      };
    };
    const { ctx, events } = fakeCtx({
      askGoogle: async () => ({
        snippet: 'a passage',
        sourceUrl: 'https://example.com/x',
        authority: 'user_google' as const,
        selectorUsed: 'organic',
        citations: [],
      }),
    });
    try {
      await founderStep2Survey(null, ctx, QUESTION, 'google');
      const notes = [...events].filter((e) => e.kind === 'note' || e.kind === 'result').map((e) => e.text);
      const summaryLine = notes.find((t) => t.startsWith('SURVEY STEP 2: no quoted/cued term'));
      expect(summaryLine).toBeDefined();
      // 1 dropped not-in-question ("fundamentally"), 1 dropped no-stated-impact ("regions").
      expect(summaryLine).toMatch(/1 dropped \(not a literal span of the question, D-BP152-052\)/);
      expect(summaryLine).toMatch(/1 dropped \(no stated impact\)/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
