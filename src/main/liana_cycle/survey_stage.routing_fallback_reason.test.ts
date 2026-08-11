// survey_stage.routing_fallback_reason.test.ts -- D-BP152-052/BISHOP/seg-term-span-and-routing,
// STAGE 2/2
//
// THE MEASURED FAILURE THIS CLOSES. The completed live run
// (C:\Users\Administrator\Downloads\latestTest.md) shows "via GOOGLE" with NO conversational-
// authority attempt logged at all (line 45's "PARSER INSTRUMENT [ambiguity] query SENT to Google"
// has no preceding "query SENT to conversational authority" line) even though index.ts's
// 'liana-terminal-run' handler always constructs `askConversationalAuthority` (D-BP152-044) -- and
// the run itself shows Stepped Audible ON ("STEPPED AUDIBLE is ON" at line 19).
//
// ROOT CAUSE, DIAGNOSED: stepped_audible.ts's wrapForSteppedAudible() returned a NEW
// MethodRunContext object carrying only `{ askGoogle, emit }` whenever Stepped Audible was armed
// for the 'survey' phase (channel non-null and methodId 'survey') -- `askConversationalAuthority`
// was silently dropped, even though liana_terminal_engine.ts's surveyCtx (the object passed INTO
// wrapForSteppedAudible) carried it. survey_stage.ts's obtainMetaQuestionPassage() only tries the
// conversational authority when `ctx.askConversationalAuthority` is truthy -- with it dropped, that
// whole `if` block never ran, and (before this ticket) nothing said why: the fallback looked like a
// deliberate "go straight to Google" choice instead of a plumbing accident.
//
// THIS FILE PROVES TWO THINGS: (1) the root-cause fix -- wrapForSteppedAudible() now threads
// `askConversationalAuthority` through unwrapped, by reference, so it survives being armed for
// 'survey' -- and (2) the MINIMUM FIX the ticket requires regardless of cause -- a fallback to
// Google is never silent again, whether the field was dropped (now fixed) or was never wired by the
// caller at all (a distinct, legitimate case -- e.g. library/script_bridge.ts's Composer path).
//
// NOT TOUCHED, PROVEN BY WHAT THIS FILE DOES NOT DO: the operator-engagement guard
// (probeNexusAuthorityOperatorEngagement(), nexus_authority_persistent_session.ts) and index.ts's
// askConversationalAuthority closure are UNCHANGED -- see this ticket's own deliverable for the
// `git diff --stat` proof. This file never imports either; it only proves the PLUMBING between
// wrapForSteppedAudible() and obtainMetaQuestionPassage() no longer drops what the caller wired.
//
// Same convention as this file's sibling, survey_stage.conversational_authority.test.ts: vitest
// directly against SOURCE, never dist (PROCESS SAFETY forbids writing into dist\). No electron mock
// needed -- survey_stage.ts and stepped_audible.ts both have zero electron dependency (see each
// file's own header).

import { describe, test, expect } from 'vitest';
import { askAmbiguity } from './survey_stage';
import { wrapForSteppedAudible, SteppedAudibleLog } from './stepped_audible';
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

function mockOllamaFetch(ambiguityTerms: unknown[]) {
  return async (_url: unknown, opts: { body: string }) => ({
    json: async () => ({ response: JSON.stringify({ terms: ambiguityTerms }) }),
  });
}

const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

describe('D-BP152-052 -- a fallback to Google always records why the conversational path was not used', () => {
  test('ROOT CAUSE FIX: wrapForSteppedAudible() no longer drops askConversationalAuthority -- the SAME field survives the wrap, by reference', () => {
    let convoCalls = 0;
    const askConversationalAuthority = async (): Promise<ConversationalAuthorityResult> => {
      convoCalls++;
      return { ok: true, text: 'x', citations: [], via: 'user_gemini:settled', authority: 'user_gemini' };
    };
    const baseCtx: MethodRunContext = { askGoogle: async () => null, emit: () => {}, askConversationalAuthority };
    const log = new SteppedAudibleLog();
    const channel = { requestStepPause: async () => ({ pauseId: 'x', action: 'approve' as const }) };
    const wrap = wrapForSteppedAudible('survey', baseCtx, channel, log);
    // Before D-BP152-052: `wrap.ctx.askConversationalAuthority` was undefined here (the returned
    // object literal only ever named askGoogle/emit) -- exactly what silenced the routing defect.
    expect(wrap.ctx.askConversationalAuthority).toBe(askConversationalAuthority);
    expect(convoCalls).toBe(0); // not invoked merely by wrapping -- proves this is a pass-through, not a call
  });

  test('END TO END, the shape of the measured failure: Stepped Audible armed for survey + askConversationalAuthority wired -- the conversational authority IS attempted, not silently skipped', async () => {
    let convoCalls = 0;
    let googleCalls = 0;
    const askConversationalAuthority = async (question: string): Promise<ConversationalAuthorityResult> => {
      convoCalls++;
      return { ok: true, text: `Gemini answering: "${question}"`, citations: [], via: 'user_gemini:settled', authority: 'user_gemini' };
    };
    const events: TerminalEvent[] = [];
    const baseCtx: MethodRunContext = {
      askGoogle: async () => { googleCalls++; return null; },
      emit: (e: TerminalEvent) => { events.push(e); },
      askConversationalAuthority,
    };
    const log = new SteppedAudibleLog();
    const channel = { requestStepPause: async () => ({ pauseId: 'x', action: 'approve' as const }) };
    // Same call shape liana_terminal_engine.ts's own surveyCtx/wrapForSteppedAudible('survey', ...)
    // call site uses (D-BP152-044's own comment there names this exact combination as the one that
    // "honestly fall[s] back to Google" before this fix).
    const wrap = wrapForSteppedAudible('survey', baseCtx, channel, log);
    const r = await askAmbiguity(QUESTION, wrap.ctx, 'google');
    expect(convoCalls).toBe(1);
    expect(googleCalls).toBe(0);
    expect(r.answeredByAuthority).toBe('user_gemini');
    const notes = events.filter((e) => e.kind === 'note').map((e) => e.text);
    expect(notes.some((t) => /query SENT to conversational authority/.test(t))).toBe(true);
  });

  test('a caller that genuinely never wires askConversationalAuthority (undefined, not dropped) gets an explanatory transcript line, never silence', async () => {
    const { ctx, events } = fakeCtx({
      askGoogle: async () => ({
        snippet: 'a passage',
        sourceUrl: 'https://example.com/x',
        authority: 'user_google' as const,
        selectorUsed: 'organic',
        citations: [],
      }),
    });
    const originalFetch = global.fetch;
    (global as any).fetch = mockOllamaFetch([]);
    try {
      await askAmbiguity(QUESTION, ctx, 'google');
      const notes = noteTexts(events);
      expect(notes.some((t) => /no conversational authority is wired for this call/.test(t))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
