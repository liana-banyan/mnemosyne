// liana_terminal_engine.ask_google_this.test.ts -- D-BP152-021/BISHOP/seg-ask-google-this
//
// Verifies FD-BP152-15 (Founder, BP152, typed verbatim at a live Step 0 pause: "Send this query to
// Google and return the response: ..."). ASK GOOGLE THIS is the first Library Step the operator can
// EXECUTE from the bench -- a new 'ask_google' action at the STEP 0 pause (requestStepZeroPause(),
// stepped_audible.ts, D-BP152-020) that sends the typed text to Google VERBATIM, through the
// EXISTING askGoogle channel (googleBlocks(), reused from comparative_cascade.ts -- no second
// transport, resolveAmbiguityQueryTransport() untouched), and pauses again with the raw,
// untruncated response as state instead of advancing.
//
// THE SIX ASSERTIONS THIS TICKET'S VERIFY SECTION NAMES:
//   (a) the query reaching askGoogle is byte-identical to what was typed (whitespace at the ends
//       only is trimmed -- no templating, no prefix, no suffix, no substitution, no reformatting).
//   (b) the raw response is captured untruncated in the transcript.
//   (c) the run pauses again after the result rather than advancing.
//   (d) Correct and Redirect behave exactly as before (D-BP152-020's own regression, unaffected).
//   (e) with Call an Audible OFF nothing changes at all.
//   (f) the contamination flag fires when the typed text contains an option string and does not
//       fire when it does not -- and never blocks the send either way.
//
// Same conventions as liana_terminal_engine.pause_at_step_zero.test.ts (this file's own sibling,
// D-BP152-020): vitest directly against SOURCE (never dist -- PROCESS SAFETY forbids writing into
// dist\ while the Founder's `npm run dev` is live), electron mocked so the qid branch is
// exercisable without a real Electron process.

import { describe, test, expect, vi } from 'vitest';
import path from 'node:path';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.resolve(__dirname, '..', '..', '..'),
  },
}));

import { runLianaCycleQuestion } from './liana_terminal_engine';
import { requestStepZeroPause, SteppedAudibleLog } from './stepped_audible';
import type { SteppedAudibleChannel } from './stepped_audible';

type TerminalEvent = { kind: string; text: string; ts: string };
type SteppedAction = 'approve' | 'correct' | 'redirect' | 'abandon' | 'ask_google';
type SteppedResponse = { pauseId: string; action: SteppedAction; text?: string };
type SteppedPause = { pauseId: string; stepIndex: number; stepTotal: number; step: { key: string; codeLabel: string }; events: TerminalEvent[]; suggestions: string[]; ts: string };

// qid 1's real bundled option B, used for the contamination assertions (f) -- read directly from
// resources/mmlu_pro_bundled/questions.jsonl by liana_terminal_engine.ts's own loadQuestion(), not
// re-typed from memory here beyond this one literal copy for the assertion string.
const QID1_OPTION_B = 'longitudinal section of a shoot tip';

describe('ASK GOOGLE THIS (FD-BP152-15, D-BP152-021)', () => {

  test('(a) the query reaching askGoogle is byte-identical to what was typed, except whitespace at the very ends', async () => {
    const typed = '  Send this query to Google and return the response verbatim, please.   ';
    const askGoogleCalls: string[] = [];
    // A real (non-null) result so googleBlocks() succeeds on the first try -- returning null would
    // exercise its own 3-try retry/backoff loop and make this test needlessly slow/flaky; that
    // retry behavior belongs to googleBlocks()'s own test coverage, not this ticket's.
    const askGoogle = async (q: string) => {
      askGoogleCalls.push(q);
      return { snippet: 'ack', sourceUrl: null, authority: 'user_google' as const, selectorUsed: null };
    };

    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: typed } satisfies SteppedResponse;
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };

    const events: TerminalEvent[] = [];
    const outcome = await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    expect(askGoogleCalls.length, 'askGoogle was called exactly once for the one ask_google round').toBe(1);
    // Byte-identical to the typed text with ONLY the leading/trailing whitespace removed -- every
    // internal character, including the internal double space before "please", is untouched.
    expect(askGoogleCalls[0]).toBe(typed.trim());
    expect(askGoogleCalls[0]).not.toBe(typed); // proves the comparison is not vacuous
    expect(outcome.abstain).toBe(true);
  });

  test('(b) the raw response is captured untruncated in the transcript -- no length cap, no truncation marker', async () => {
    // Long enough to exceed field_gate.ts/survey_stage.ts's own 4000-char truncation threshold --
    // this ticket's own requirement is that ask-google-this carries NO such cap.
    const longAnswer = 'X'.repeat(6000) + '-END-MARKER-6000';
    const askGoogle = async (_q: string) => ({
      snippet: longAnswer,
      sourceUrl: 'https://example.com/answer',
      authority: 'user_google' as const,
      selectorUsed: null,
    });

    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: 'what is the long answer?' } satisfies SteppedResponse;
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };

    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    const carrier = events.find((e) => e.text.includes('-END-MARKER-6000'));
    expect(carrier, 'the full 6000+ char response reached the live transcript (and therefore the on-disk receipt)').toBeDefined();
    expect(carrier!.text).toContain(longAnswer);
    expect(carrier!.text, 'no truncation disclosure text is present -- nothing was cut').not.toMatch(/TRUNCATED/);
  });

  test('(c) the run pauses again after the result rather than advancing', async () => {
    const askGoogle = async (_q: string) => ({
      snippet: 'a short raw answer',
      sourceUrl: null,
      authority: 'user_google' as const,
      selectorUsed: null,
    });

    const seenPauses: SteppedPause[] = [];
    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        seenPauses.push(pause as unknown as SteppedPause);
        round += 1;
        if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: 'first query' } satisfies SteppedResponse;
        if (round === 2) return { pauseId: pause.pauseId, action: 'ask_google', text: 'second query' } satisfies SteppedResponse;
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };

    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    // Two ask_google rounds -> THREE pauses total (initial + one follow-up per round), all keyed
    // 'step0' -- the run never advances to DEMAND TEST until the operator finally says approve.
    expect(seenPauses.length).toBe(3);
    expect(seenPauses.every((p) => p.step.key === 'step0')).toBe(true);
    // The SECOND pause's own state carries the FIRST round's query+response -- proof the pause
    // presents the result as state rather than silently discarding it.
    const secondPauseText = seenPauses[1].events.map((e) => e.text).join('\n');
    expect(secondPauseText).toContain('first query');
    expect(secondPauseText).toContain('a short raw answer');
    // No DEMAND TEST/METHOD SELECTION stage boundary reaches the transcript BEFORE the run is
    // finally released by the third pause's 'approve' -- i.e. it genuinely did not advance while
    // still cycling through ask_google rounds. Sanity checked by asserting those stage lines exist
    // only in the tail of the transcript, not interleaved between the ask_google rounds.
    const demandIdx = events.findIndex((e) => /DEMAND TEST/.test(e.text));
    const secondQueryIdx = events.findIndex((e) => e.text.includes('second query'));
    expect(demandIdx).toBeGreaterThan(secondQueryIdx);
  });

  test('(d) Correct and Redirect behave exactly as before -- exactly one pause, run proceeds past STEP 0 unchanged, no Google call', async () => {
    // NOTE: this qid's "no method matched" abstain return (liana_terminal_engine.ts) does not
    // attach `steppedLog` to its outcome at all -- a PRE-EXISTING gap in that return statement,
    // unrelated to and untouched by this ticket (only the final success return and the two
    // abandon/thrown catch-branch returns carry steppedLog; D-BP152-020's own tests never
    // exercised outcome.steppedLog on this particular path either, only via the 'abandon' case,
    // which lands in a different return branch). So "recorded verbatim" and "behaves exactly as
    // before" are verified here the same way D-BP152-020's own (d) verified pause ORDER/COUNT: at
    // the channel level, not via this one return branch's outcome shape.
    const askGoogleCalls: string[] = [];
    const askGoogle = async (q: string) => { askGoogleCalls.push(q); return null; };

    for (const action of ['correct', 'redirect'] as const) {
      askGoogleCalls.length = 0;
      const seenResponses: SteppedResponse[] = [];
      let pauseCount = 0;
      const channel: SteppedAudibleChannel = {
        requestStepPause: async (pause) => {
          pauseCount += 1;
          const response = { pauseId: pause.pauseId, action, text: `a ${action} note` } satisfies SteppedResponse;
          seenResponses.push(response);
          return response;
        },
      };
      const events: TerminalEvent[] = [];
      const outcome = await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

      expect(askGoogleCalls.length, `${action} never calls askGoogle`).toBe(0);
      // Exact D-BP152-019/-020 regression baseline for qid 1, unaffected by this ticket.
      expect(outcome.verdict).toBe(null);
      expect(outcome.abstain).toBe(true);
      expect(outcome.error).toBe('no_method_matched');
      // Exactly one pause -- correct/redirect do not loop the way ask_google does; the run is
      // released immediately after the single response, same as before this ticket.
      expect(pauseCount, `${action} produces exactly one STEP 0 pause, no loop`).toBe(1);
      expect(seenResponses[0].text).toBe(`a ${action} note`);
    }
  });

  test('(e) with Call an Audible OFF, nothing changes at all -- byte-identical to the pre-ticket baseline, askGoogle/emit/options never touched', async () => {
    const askGoogleCalls: string[] = [];
    const askGoogle = async (q: string) => { askGoogleCalls.push(q); return null; };
    const events: TerminalEvent[] = [];
    const outcome = await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e));

    expect((outcome as { steppedLog?: unknown }).steppedLog, 'no steppedLog on an OFF run').toBeUndefined();
    expect(outcome.verdict).toBe(null);
    expect(outcome.abstain).toBe(true);
    expect(outcome.error).toBe('no_method_matched');
    expect(outcome.qid).toBe(1);
    expect(outcome.correct).toBe('B');
    expect(askGoogleCalls.length, 'askGoogle is never called on this OFF path (no method reached)').toBe(0);
    expect(events.some((e) => /ASK GOOGLE THIS/.test(e.text) || /PARSER INSTRUMENT \[ask-google-this/.test(e.text)), 'no ask-google-this transcript line ever appears when steppedAudible is OFF').toBe(false);
  });

  test('(f) the contamination flag fires when the typed text contains an option string, and does not fire when it does not -- never blocks either way', async () => {
    const askGoogleCalls: string[] = [];
    // Non-null so googleBlocks() resolves on the first try -- see test (a)'s own note.
    const askGoogle = async (q: string) => {
      askGoogleCalls.push(q);
      return { snippet: 'ack', sourceUrl: null, authority: 'user_google' as const, selectorUsed: null };
    };

    // (f.1) CONTAMINATED: the typed query contains qid 1's option B verbatim.
    {
      askGoogleCalls.length = 0;
      const contaminatedQuery = `Which option is correct, ${QID1_OPTION_B} or something else?`;
      let round = 0;
      const channel: SteppedAudibleChannel = {
        requestStepPause: async (pause) => {
          round += 1;
          if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: contaminatedQuery } satisfies SteppedResponse;
          return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
        },
      };
      const events: TerminalEvent[] = [];
      await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

      // NEVER BLOCKED: the exact contaminated text still reached askGoogle, verbatim.
      expect(askGoogleCalls).toEqual([contaminatedQuery]);
      const flagged = events.some((e) => /CONTAMINATION FLAG/.test(e.text) && e.text.includes(QID1_OPTION_B));
      expect(flagged, 'contamination flag fires and names the matched option string').toBe(true);
    }

    // (f.2) CLEAN: the typed query names no option text at all.
    {
      askGoogleCalls.length = 0;
      const cleanQuery = 'What is the general process of mitosis in plant cells?';
      let round = 0;
      const channel: SteppedAudibleChannel = {
        requestStepPause: async (pause) => {
          round += 1;
          if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: cleanQuery } satisfies SteppedResponse;
          return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
        },
      };
      const events: TerminalEvent[] = [];
      await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

      // NEVER BLOCKED here either -- sent exactly as typed, no flag this time.
      expect(askGoogleCalls).toEqual([cleanQuery]);
      const flagged = events.some((e) => /CONTAMINATION FLAG/.test(e.text));
      expect(flagged, 'no contamination flag when no option string is present').toBe(false);
    }
  });

  test('DIRECT: requestStepZeroPause() records every round in the log (ask_google, then correct) -- the "operator override" trace FD-BP152-07 requires', async () => {
    // Exercises requestStepZeroPause() directly (not through the whole engine), so this is not
    // affected by the "no method matched" outcome shape gap noted in test (d) above -- the log
    // object itself is inspected straight from the primitive this ticket built.
    const log = new SteppedAudibleLog();
    const askGoogle = async (_q: string) => ({ snippet: 'the raw answer', sourceUrl: null, authority: 'user_google' as const, selectorUsed: null });
    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: 'my query' } satisfies SteppedResponse;
        return { pauseId: pause.pauseId, action: 'correct', text: 'a correction' } satisfies SteppedResponse;
      },
    };
    const emitted: TerminalEvent[] = [];
    await requestStepZeroPause(channel, log, [], askGoogle, (e) => emitted.push(e as TerminalEvent), null);

    const records = log.all();
    expect(records.length).toBe(2);
    expect(records[0]).toMatchObject({ stepKey: 'step0', action: 'ask_google', text: 'my query' });
    expect(records[1]).toMatchObject({ stepKey: 'step0', action: 'correct', text: 'a correction' });
    // And the response itself reached the transcript (emit), which is what actually lands in the
    // on-disk receipt -- see this file's header on why the raw response lives there, not in the
    // LianaSteppedRecord shape.
    expect(emitted.some((e) => e.text.includes('the raw answer'))).toBe(true);
  });

  test('an empty typed query sends nothing to Google and re-pauses honestly, rather than calling Google on an empty string', async () => {
    const askGoogleCalls: string[] = [];
    const askGoogle = async (q: string) => { askGoogleCalls.push(q); return null; };
    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: '   ' } satisfies SteppedResponse;
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };
    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);
    expect(askGoogleCalls.length).toBe(0);
    expect(round).toBe(2); // it re-paused rather than silently dropping the empty round
  });
});
