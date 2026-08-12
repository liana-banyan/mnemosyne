// survey_stage.superlative_sweep_gate.test.ts -- D-BP153-017/BISHOP/seg-classify-017
//
// TICKET_D-BP153-017_THE_THREE_QUESTIONS.md, BUILD ITEM 1: gate the per-option denotation sweep
// (SURVEY STEP 3, founderStep3CategorizeOptions()) off the superlative-by-magnitude route. Measured
// waste, live run 2026-08-12T20:34Z: 12 of the first 14 evidence records were this sweep (18
// queries, 9 options x 2), none contributed to a derivation.
//
// TWO TESTS, per the ticket's own VERIFICATION section:
//   TEST 1 -- SUPERLATIVE PATH: the sweep does NOT run; the transcript says it was SKIPPED and why.
//   TEST 2 -- SCOPE GUARD (mandatory): a NON-superlative question is UNAFFECTED -- the sweep still
//     runs exactly where it ran before (the pre-existing FD-BP152-01 predicate, untouched).
//
// Same vitest-against-SOURCE convention this file's siblings already use (e.g.
// survey_stage.routing_fallback_reason.test.ts): no dist, no live network. `askGoogle` always
// returns null (an honest "no source reachable") for BOTH tests -- this keeps SURVEY STEP 2's own
// operation-query outcome IDENTICAL across both questions (operationDemandForGate.demand stays
// null either way, per determineDemandFromOperationAnswer(null)), so the ONLY variable between the
// two tests is the question's own structural grammar -- exactly what isolates the NEW gate
// (extractSuperlativeMatch()) from the PRE-EXISTING one (operationDemandForGate).

import { describe, test, expect, vi } from 'vitest';
import { runSurveyStage } from './survey_stage';
import type { MethodRunContext } from './method_registry';
import type { LianaTerminalEvent } from '../../shared/liana_cycle/liana_terminal_types';

const SUPERLATIVE_QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
// Structurally NOT a superlative (no "most/least ADJECTIVE" span) -- a plain CLASSIFY-shaped
// question, so SURVEY STEP 2's own no-term/ambiguity path still runs the same way.
const NON_SUPERLATIVE_QUESTION = 'Which of the following is classified as a mammal?';

const OPT: Record<string, string> = { A: 'South America', B: 'South Asia', C: 'North Africa' };

function fakeCtx() {
  const events: LianaTerminalEvent[] = [];
  // `{ challengeDetected: true }`, not plain `null` -- googleBlocks()/obtainMetaQuestionPassage()
  // (comparative_cascade.ts) retry a bare "no usable answer" with real sleep() backoff between
  // attempts; the structural challengeDetected signal halts at 0 further retries (same convention
  // classify_cascade.discriminator.test.ts and .membership_terminator.test.ts already use for this
  // exact reason). This keeps the test fast and isolates it to the GATE, not retry timing.
  const askGoogle = vi.fn(async () => ({ challengeDetected: true }));
  const ctx: MethodRunContext = {
    askGoogle: askGoogle as unknown as MethodRunContext['askGoogle'],
    emit: (e: LianaTerminalEvent) => { events.push(e); },
  };
  return { ctx, events, askGoogle };
}

function noteTexts(events: LianaTerminalEvent[]): string[] {
  return events.filter((e) => e.kind === 'note').map((e) => e.text);
}
function stageTexts(events: LianaTerminalEvent[]): string[] {
  return events.filter((e) => e.kind === 'stage').map((e) => e.text);
}

describe('D-BP153-017 BUILD ITEM 1: SURVEY STEP 3 GATE, gated off the superlative-by-magnitude route ONLY', () => {
  test('TEST 1, SUPERLATIVE PATH: the per-option denotation sweep does NOT run, and the transcript states it was SKIPPED and why', async () => {
    const originalFetch = global.fetch;
    // gemmaExtract() (Ollama) catches any fetch failure and returns null -- an unmocked fetch is
    // safe here (askAmbiguity/askOperation's own model-extraction calls simply find nothing, which
    // is the point: this test isolates the STEP 3 GATE, not what step 2 itself resolves).
    (global as any).fetch = vi.fn(async () => { throw new Error('no Ollama in this test'); });
    try {
      const { ctx, events, askGoogle } = fakeCtx();
      await runSurveyStage(SUPERLATIVE_QUESTION, OPT, ctx);

      const notes = noteTexts(events);
      const gateNote = notes.find((t) => /SURVEY STEP 3 GATE/.test(t));
      expect(gateNote).toBeDefined();
      expect(gateNote).toMatch(/SKIPPED/);
      expect(gateNote).toMatch(/superlative-by-magnitude/);
      expect(gateNote).toMatch(/D-BP153-017/);
      // THE SAVING IS STRUCTURAL, NOT JUST WORDED: founderStep3CategorizeOptions() itself is never
      // called when the gate skips -- its own "-> SURVEY STEP 3 --" stage boundary never fires.
      expect(stageTexts(events).some((t) => /SURVEY STEP 3 --/.test(t))).toBe(false);
      // askGoogle was called only for step 2's own ambiguity+operation queries (at most 2) -- never
      // the per-option sweep's own additional calls (which would be 2 per option, 6 for these 3 options).
      expect(askGoogle.mock.calls.length).toBeLessThanOrEqual(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('TEST 2, SCOPE GUARD (mandatory): a NON-superlative question is UNAFFECTED -- the sweep still runs exactly where it ran before this ticket', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = vi.fn(async () => { throw new Error('no Ollama in this test'); });
    try {
      const { ctx, events, askGoogle } = fakeCtx();
      await runSurveyStage(NON_SUPERLATIVE_QUESTION, OPT, ctx);

      const notes = noteTexts(events);
      const gateNote = notes.find((t) => /SURVEY STEP 3 GATE/.test(t));
      expect(gateNote).toBeDefined();
      // The PRE-EXISTING predicate fires (operation query resolved nothing -> demand null -> the
      // sweep proceeds "as the fallback") -- NOT the new superlative gate.
      expect(gateNote).toMatch(/RUNNING as the fallback/);
      expect(gateNote).not.toMatch(/superlative-by-magnitude/);
      // STRUCTURAL PROOF: founderStep3CategorizeOptions() DOES run -- its own stage boundary fires.
      expect(stageTexts(events).some((t) => /SURVEY STEP 3 --/.test(t))).toBe(true);
      // And it actually attempted the per-option sweep against Google -- more calls than step 2
      // alone would ever make (2), since surveyAnswers() issues its own queries per option.
      expect(askGoogle.mock.calls.length).toBeGreaterThan(2);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
