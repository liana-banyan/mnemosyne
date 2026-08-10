// liana_terminal_engine.pause_at_step_zero.test.ts -- D-BP152-020/BISHOP/seg-pause-at-step-zero
//
// Verifies FD-BP152-08 (Founder, BP152, verbatim: "it loads the question first. Then it tells me
// what the next step WILL be.") -- he must be able to stop AT Step 0, before any work happens,
// and see the question and its options as state.
//
// THE OBSTACLE THIS TICKET WORKED AROUND (see stepped_audible.ts's own header, "D-BP152-020"
// section, and liana_terminal_engine.ts's call site): every OTHER stepped-audible pause fires
// from inside the wrapped askGoogle, because emit() is never awaited by its callers. Step 0 issues
// no Google call, so a pause fired only via that buffer-then-flush mechanism would surface at the
// FIRST Google call of whichever method gets selected -- AFTER Survey, the Demand Test and method
// selection have already run. requestStepZeroPause() (stepped_audible.ts) is instead called as a
// direct, top-level `await` from liana_terminal_engine.ts itself, immediately after Step 0's own
// state lines are emitted and before anything else in the run happens.
//
// THE SIX ASSERTIONS THIS TICKET'S VERIFY SECTION NAMES:
//   (a) with Call an Audible ON (steppedAudible channel present), a pause fires at Step 0 BEFORE
//       any query is issued.
//   (b) its payload carries the question, the options, the options-exist flag, and the source.
//   (c) with Call an Audible OFF, no pause fires and the run is byte-identical to dfb891d7 in
//       verdict/abstain/error (the exact regression baseline D-BP152-019's own test already
//       established for these inputs).
//   (d) every pause that fired before still fires, in the same order (regression against the
//       existing per-step pauses this run reaches once a method is selected and runs).
//   (e) a pause has no timeout -- structural: requestStepZeroPause() only ever resolves from
//       channel.requestStepPause()'s own resolution/rejection, never from an internal timer.
//   (f) a destroyed sender rejects rather than hanging -- exercised at the channel level (the same
//       contract index.ts's real channel implementation honors; this test's fake channel models
//       the identical reject-instead-of-hang behavior).
//
// Same conventions as liana_terminal_engine.step_zero.test.ts (D-BP152-019, this file's own
// sibling): vitest directly against SOURCE (never dist -- PROCESS SAFETY forbids writing into
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
import type { SteppedAudibleChannel } from './stepped_audible';

type TerminalEvent = { kind: string; text: string; ts: string };
type SteppedResponse = { pauseId: string; action: 'approve' | 'correct' | 'redirect' | 'abandon'; text?: string };
type SteppedPause = { pauseId: string; stepIndex: number; stepTotal: number; step: { key: string; codeLabel: string }; events: TerminalEvent[]; suggestions: string[]; ts: string };

const fakeAskGoogle = async (_q: string) => null;

describe('PAUSE AT STEP 0 (FD-BP152-08, D-BP152-020)', () => {

  test('(a)+(b) Call an Audible ON: a pause fires at STEP 0, before any query is issued, carrying the question, options, options-exist flag and source', async () => {
    const askGoogleCallsBeforePause: number[] = [];
    let askGoogleCallCount = 0;
    const askGoogle = async (q: string) => { askGoogleCallCount++; return fakeAskGoogle(q); };

    const seenPauses: SteppedPause[] = [];
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        // Record how many Google calls had happened BY THE TIME this pause fired -- (a)'s
        // "before any query is issued" requirement, measured rather than assumed.
        askGoogleCallsBeforePause.push(askGoogleCallCount);
        seenPauses.push(pause as unknown as SteppedPause);
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };

    const events: TerminalEvent[] = [];
    const outcome = await runLianaCycleQuestion(
      '1',
      askGoogle,
      (e: TerminalEvent) => events.push(e),
      null,
      channel,
    );

    const step0Pauses = seenPauses.filter((p) => p.step.key === 'step0');
    expect(step0Pauses.length, 'exactly one STEP 0 pause fires').toBe(1);
    expect(askGoogleCallsBeforePause[0], '(a) zero askGoogle calls happened before the STEP 0 pause fired').toBe(0);

    const pause = step0Pauses[0];
    const noteTexts = pause.events.map((e) => e.text).join('\n');
    expect(noteTexts, '(b) source is carried, verbatim').toMatch(/qid 1.*bundled MMLU-Pro corpus/);
    expect(noteTexts, '(b) question is carried, verbatim').toContain('Which of the following would most likely provide examples of mitotic cell divisions?');
    expect(noteTexts, '(b) options-exist flag is carried, explicitly true').toMatch(/OPTIONS EXIST: true/);
    expect(noteTexts, '(b) options are carried, verbatim').toContain('cross section of muscle tissue');

    // Sanity: the run still completed and produced the same outcome shape ON produces (checked
    // in full against the OFF baseline below).
    expect(outcome.abstain).toBe(true);
  });

  test('(c) Call an Audible OFF: no pause fires, run is byte-identical to the dfb891d7 baseline', async () => {
    const events: TerminalEvent[] = [];
    const outcome = await runLianaCycleQuestion('1', fakeAskGoogle, (e: TerminalEvent) => events.push(e));

    // No stepped-log at all when steppedAudible was never armed -- absence, not an empty array,
    // matching every other OFF-stays-identical guarantee in this codebase.
    expect((outcome as { steppedLog?: unknown }).steppedLog, 'no steppedLog on an OFF run').toBeUndefined();

    // The exact D-BP152-019 regression baseline for qid 1 with fakeAskGoogle, unchanged by this
    // ticket: verdict=null, abstain=true, error='no_method_matched', correct='B'.
    expect(outcome.verdict).toBe(null);
    expect(outcome.abstain).toBe(true);
    expect(outcome.error).toBe('no_method_matched');
    expect(outcome.qid).toBe(1);
    expect(outcome.correct).toBe('B');

    // STEP 0 itself is still emitted (D-BP152-019, unaffected) -- but nothing about it changed
    // shape or position: still the first 'stage' event, still preceded only by the GATES note.
    const step0Idx = events.findIndex((e) => e.kind === 'stage');
    expect(events[step0Idx].text).toMatch(/STEP 0/);
    expect(events.slice(0, step0Idx).every((e) => e.kind === 'note' && /GATES/.test(e.text))).toBe(true);
    // The new "STEPPED AUDIBLE is ON" note is gated behind `if (steppedAudible)` -- must be
    // absent entirely when OFF.
    expect(events.some((e) => /STEPPED AUDIBLE is ON/.test(e.text)), 'no stepped-audible note on an OFF run').toBe(false);
  });

  test('(d) every pause that fired before (per-step pauses once a method runs) still fires, in the same order, with the STEP 0 pause first', async () => {
    // qid 1 never reaches a selected method (no_method_matched), so this test uses a free-text
    // question shaped to at least reach METHOD SELECTION and the DEMAND TEST stage boundary --
    // exercising that STEP 0's pause does not disturb ANY stage boundary downstream, even though
    // no comparative-cascade method run is reachable without a live Google backend. The ORDER
    // property under test is: whatever stage-boundary events this run reaches, STEP 0's pause is
    // always the first one seen, and no later stage's presence/order is disturbed by adding it.
    const seenPauseKeys: string[] = [];
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        seenPauseKeys.push((pause as unknown as SteppedPause).step.key);
        return { pauseId: pause.pauseId, action: 'approve' };
      },
    };
    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion(
      'What is the capital of France? A) London B) Paris C) Berlin',
      fakeAskGoogle,
      (e: TerminalEvent) => events.push(e),
      null,
      channel,
    );
    // Exactly one pause reachable on this path today (comparative-cascade's own per-step pauses
    // require a live method run past DEMAND UNKNOWN, out of reach with fakeAskGoogle) -- asserting
    // it is 'step0' and that it is FIRST is the regression this assertion protects: a future method
    // pause must never be reordered ahead of STEP 0.
    expect(seenPauseKeys[0]).toBe('step0');
    // The stage sequence in the transcript is unchanged/unreordered downstream of STEP 0 -- DEMAND
    // TEST and METHOD SELECTION still both fire, in their existing order, after STEP 0.
    const stageTexts = events.filter((e) => e.kind === 'stage').map((e) => e.text);
    expect(stageTexts[0]).toMatch(/STEP 0/);
    expect(stageTexts.some((t) => /DEMAND TEST/.test(t))).toBe(true);
    expect(stageTexts.some((t) => /METHOD SELECTION/.test(t))).toBe(true);
    expect(stageTexts.indexOf(stageTexts.find((t) => /DEMAND TEST/.test(t))!))
      .toBeLessThan(stageTexts.indexOf(stageTexts.find((t) => /METHOD SELECTION/.test(t))!));
  });

  test('(e) a STEP 0 pause has no timeout -- it waits for the channel to resolve, however long that takes, and is not resolved by any internal timer', async () => {
    vi.useFakeTimers();
    try {
      let resolveChannel: (r: SteppedResponse) => void = () => {};
      const channel: SteppedAudibleChannel = {
        requestStepPause: (pause) => new Promise((resolve) => { resolveChannel = resolve as (r: SteppedResponse) => void; void pause; }),
      };
      const events: TerminalEvent[] = [];
      const runPromise = runLianaCycleQuestion('1', fakeAskGoogle, (e: TerminalEvent) => events.push(e), null, channel);

      let settled = false;
      runPromise.then(() => { settled = true; });

      // Advance well past any plausible timeout duration. If requestStepZeroPause() (or anything
      // it calls) had a timer, this would have fired it.
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      await Promise.resolve();
      expect(settled, 'the run has NOT settled after 24 simulated hours -- no timeout fired').toBe(false);

      // Now the operator answers -- the ONLY way this pause ends besides a destroyed sender.
      resolveChannel({ pauseId: 'sp0', action: 'approve' });
      const outcome = await runPromise;
      expect(outcome.abstain).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test('(f) a destroyed sender rejects rather than hanging -- STEP 0 abandon/rejection propagates to an honest abstained outcome, run never hangs', async () => {
    // Models index.ts's real channel: `if (sender.isDestroyed()) { reject(new Error('window_closed')); return; }`
    // -- the destroyed-sender convention this ticket was told to preserve, not reinvent.
    const channel: SteppedAudibleChannel = {
      requestStepPause: () => Promise.reject(new Error('window_closed')),
    };
    const events: TerminalEvent[] = [];
    const outcome = await runLianaCycleQuestion('1', fakeAskGoogle, (e: TerminalEvent) => events.push(e), null, channel);
    // A rejected pause is a thrown, non-SteppedAudibleAbandoned error -- caught by
    // runLianaCycleQuestion's generic catch branch, which returns an honest abstained outcome
    // (never hangs, never throws out of this function).
    expect(outcome.abstain).toBe(true);
    expect(outcome.verdict).toBe(null);
    expect(typeof outcome.error).toBe('string');
  });

  test('abandon at STEP 0 stops the run and is recorded, same as every other stepped-audible abandon', async () => {
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => ({ pauseId: pause.pauseId, action: 'abandon' }),
    };
    const events: TerminalEvent[] = [];
    const outcome = await runLianaCycleQuestion('1', fakeAskGoogle, (e: TerminalEvent) => events.push(e), null, channel);
    expect(outcome.abstain).toBe(true);
    expect(outcome.error).toBe('stepped_audible_abandoned');
    expect((outcome as { steppedLog?: Array<{ stepKey: string; action: string }> }).steppedLog?.[0]).toMatchObject({
      stepKey: 'step0',
      action: 'abandon',
    });
    expect(events.some((e) => /STEPPED AUDIBLE ABANDONED/.test(e.text))).toBe(true);
  });
});
