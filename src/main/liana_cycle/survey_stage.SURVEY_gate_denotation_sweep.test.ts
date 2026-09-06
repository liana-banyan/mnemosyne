// ============================================================================
// THE SURVEY GATE
// ============================================================================
// FOUNDER NAMING RULING, BP163, verbatim: "call one the Perimeter and the other
// the Survey."
//
// THIS IS THE SURVEY GATE. It is the INNER gate. It runs INSIDE an already-
// running Survey and skips only SURVEY STEP 2's per-TERM denotation sweep, and
// only on the superlative-by-magnitude route (D-BP153-019).
//
// DO NOT CONFUSE IT WITH THE PERIMETER GATE, its sibling one layer out:
//   liana_terminal_engine.PERIMETER_gate_and_cost.test.ts  (D-BP164-M0-046)
// That one decides whether Survey RUNS AT ALL, and as of BP163 it defaults OFF.
//
// PERIMETER decides IF YOU COME IN. SURVEY decides WHAT YOU DO ONCE INSIDE.
// This test calls founderStep2Survey() DIRECTLY and never passes through
// liana_terminal_engine.ts, so the Perimeter default cannot affect it and did
// not break it. But note the standing consequence: with the Perimeter closed by
// default, this gate's measured saving is SECOND-ORDER. It bites only when the
// Perimeter is opened. It is not dead code.
//
// Renamed from survey_stage.superlative_denotation_survey_gate.test.ts per
// Rule 66, original preserved as a .superseded.<UTC> sibling.
// ============================================================================

// survey_stage.SURVEY_gate_denotation_sweep.test.ts -- D-BP153-019/BISHOP/seg-classify-019,
// FIX 3
//
// THE MEASURED WASTE THIS CLOSES (live run receipt LIANA_RUN_qid98_2026-08-13T00-02-41-506Z.json).
// D-BP153-017 already gated SURVEY STEP 3's per-OPTION denotation sweep off the CLASSIFY
// superlative-by-magnitude route (survey_stage.superlative_sweep_gate.test.ts, this file's own
// sibling). This run showed a DIFFERENT sweep still running on the same route: SURVEY STEP 2's
// per-TERM denotation survey (founderStep2Survey()'s own ambiguityNested loop, which calls
// surveyAskNested() -> surveyAsk(), elements/survey_ask.ts's own "SURVEY (${term}): N
// denotation(s), M discarded" line) --
//   SURVEY (Region): 9 denotation(s), 1 discarded
//   SURVEY (Densely Populated): 4 denotation(s), 6 discarded
//   SURVEY (Which): 5 denotation(s), 4 discarded
// -- two Google queries per term, against dictionary.com, Cambridge grammar, a thesaurus, and
// Reddit, none of it consulted by THE THREE QUESTIONS (classify_cascade.ts, D-BP153-017/018/019),
// which already resolve DEMAND structurally and consult owned evidence FIRST before spending a
// query of their own.
//
// TWO TESTS, same shape as survey_stage.superlative_sweep_gate.test.ts's own pair:
//   TEST 1 -- SUPERLATIVE PATH: the per-term sweep does NOT run; the transcript says SKIPPED and why.
//   TEST 2 -- SCOPE GUARD (mandatory): a NON-superlative question is UNAFFECTED -- every kept term
//     is still surveyed exactly as it ran before this ticket.
//
// surveyAskNested() (elements/survey_ask.ts) is MOCKED here (not its own internals -- that module's
// own tests, and its own live callers, already exercise it) so this test isolates the GATE this
// ticket adds, not surveyAskNested()'s own Google/Ollama behavior. This is the SAME isolation
// principle survey_stage.superlative_sweep_gate.test.ts already uses for the STEP 3 gate (there via
// a `{ challengeDetected: true }` askGoogle short-circuit); here the sweep being gated is a
// DIFFERENT function (surveyAskNested(), not founderStep3CategorizeOptions()), so a direct spy on
// that function is the precise, minimal isolation.

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('./elements/survey_ask', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./elements/survey_ask')>();
  return {
    ...actual,
    surveyAskNested: vi.fn(async (term: string) => ({
      input: term,
      nest: { input: term, levels: [], refused: true, why: 'mocked -- not exercised by this gate test' },
      levels: [],
      refused: true,
      why: 'mocked surveyAskNested() -- this test only checks whether it was CALLED, never its own internals',
    })),
  };
});

import { founderStep2Survey } from './survey_stage';
import { surveyAskNested } from './elements/survey_ask';
import type { MethodRunContext } from './method_registry';
import type { LianaTerminalEvent } from '../../shared/liana_cycle/liana_terminal_types';

const SUPERLATIVE_QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
// Structurally NOT a superlative (no "most/least ADJECTIVE" span) -- same convention this file's
// D-BP153-017 sibling test uses for its own scope-guard question.
const NON_SUPERLATIVE_QUESTION = 'Which of the following is classified as a mammal?';

function notes(events: LianaTerminalEvent[]): string[] {
  return events.filter((e) => e.kind === 'note').map((e) => e.text);
}

// Same convention every survey_stage/classify_cascade *.test.ts sibling uses -- queues canned
// Ollama /api/generate JSON responses, one per gemmaExtract() call, in order.
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

function fakeCtx() {
  const events: LianaTerminalEvent[] = [];
  let callCount = 0;
  // Call 1 (ambiguity query, Part 1): a real, usable passage -- so the ambiguity query NAMES terms
  // and the per-term sweep this ticket gates has something to gate. Every call after that
  // (operation query Part 2, then askConstraint()/askThreshold() per kept term) short-circuits via
  // `challengeDetected: true` -- the SAME zero-retry-backoff trick
  // survey_stage.superlative_sweep_gate.test.ts's own fakeCtx() already uses, so this test stays
  // fast and isolated to the ONE gate under test.
  const askGoogle = vi.fn(async () => {
    callCount++;
    if (callCount === 1) {
      return { snippet: 'A passage discussing how "world regions", "densely populated", and "NOT" could each be read differently in this question.' };
    }
    return { challengeDetected: true };
  });
  const ctx: MethodRunContext = {
    askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
    emit: (e: LianaTerminalEvent) => { events.push(e); },
  };
  return { ctx, events, askGoogle };
}

// One gemmaExtract() response -- ambiguity's own term-parsing call. Every term is a literal span of
// its own question text and carries a non-empty `impact` (FD-BP152-20 sig figs keeps it). Every
// call downstream of this one (operation, constraints, thresholds) is short-circuited by
// `challengeDetected` above before it ever reaches gemmaExtract() -- see askConstraint()'s/
// askThreshold()'s own `if (!google.ok || !google.text.trim())` early-return, checked by reading
// survey_stage.ts before writing this fixture.
function ambiguityTermsResponse(terms: Array<{ term: string; isNegation?: boolean }>): string {
  return JSON.stringify({
    terms: terms.map((t) => ({
      term: t.term,
      standardMeaning: `standard meaning of "${t.term}"`,
      alternativeMeaning: `alternative meaning of "${t.term}"`,
      impact: `changes which option answers the question`,
      isNegation: !!t.isNegation,
    })),
  });
}

describe('D-BP153-019 FIX 3: SURVEY STEP 2 per-term denotation sweep, gated off the superlative-by-magnitude route ONLY', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('TEST 1, SUPERLATIVE PATH: the per-term denotation sweep does NOT run, and the transcript states it was SKIPPED and why', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      ambiguityTermsResponse([
        { term: 'world regions' },
        { term: 'densely populated' },
        { term: 'NOT', isNegation: true },
      ]),
    ]);
    try {
      const { ctx, events } = fakeCtx();
      await founderStep2Survey(null, ctx, SUPERLATIVE_QUESTION, 'google', undefined);

      const log = notes(events);
      const gateNote = log.find((t) => /SURVEY STEP 2 PER-TERM DENOTATION SWEEP/.test(t));
      expect(gateNote).toBeDefined();
      expect(gateNote).toMatch(/SKIPPED/);
      expect(gateNote).toMatch(/superlative-by-magnitude/);
      expect(gateNote).toMatch(/D-BP153-019/);
      // THE SAVING IS STRUCTURAL, NOT JUST WORDED: surveyAskNested() itself is never called.
      expect(surveyAskNested).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 2, SCOPE GUARD (mandatory): a NON-superlative question is UNAFFECTED -- every kept term is still surveyed', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      ambiguityTermsResponse([{ term: 'mammal' }]),
    ]);
    try {
      const { ctx, events } = fakeCtx();
      await founderStep2Survey(null, ctx, NON_SUPERLATIVE_QUESTION, 'google', undefined);

      const log = notes(events);
      const gateNote = log.find((t) => /SURVEY STEP 2 PER-TERM DENOTATION SWEEP/.test(t));
      // No gate note at all on the non-superlative path -- the loop runs unconditionally, exactly
      // as it did before this ticket.
      expect(gateNote).toBeUndefined();
      // STRUCTURAL PROOF: surveyAskNested() DOES run, once per kept term.
      expect(surveyAskNested).toHaveBeenCalledTimes(1);
      expect(surveyAskNested).toHaveBeenCalledWith('mammal', ctx);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
