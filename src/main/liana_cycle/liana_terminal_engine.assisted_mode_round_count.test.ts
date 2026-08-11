// liana_terminal_engine.assisted_mode_round_count.test.ts -- D-BP152-051/BISHOP/seg-assisted-mode
//
// MEASURES, RATHER THAN CLAIMS, how many assisted-mode rounds qid 98's DEFAULT run (no authored
// Script/stack -- the plain 'liana-terminal-run' path) needs under CURRENT code at this ticket's
// build point. Per this estate's own standing rule ("never report a self-measured quantity
// without an instrument"), this file IS that instrument -- the deliverable's own reported number
// must trace back to this test's actual output, not to a guess.
//
// STUB CONVENTION REUSED, NOT INVENTED: `fakeAskGoogle` (always returns null) is the SAME
// deterministic, offline stub liana_terminal_engine.contingency_operator.test.ts already
// established for this exact file. CAVEAT, disclosed rather than hidden: this counts rounds under
// the "every Google query comes back empty" path. A live run that receives real answers may take
// a DIFFERENT number of rounds if any branch in Survey or the selected method only fires on a
// non-null result -- this measures the always-null path specifically, not a claim about every
// possible live run.
//
// Deterministic, offline: no network call anywhere in this file -- the assisted-mode channel
// stub below resolves every pause immediately and synchronously (no timers), so this test cannot
// hang and needs no network.

import path from 'node:path';
import { describe, test, expect, vi } from 'vitest';

// SAME MOCK, SAME CONVENTION as liana_terminal_engine.ask_google_this.test.ts /
// liana_terminal_engine.step_zero.test.ts (this file's own siblings) -- qid parsing
// (parseQid()/resources/mmlu_pro_bundled/questions.jsonl) reads Electron's `app.isPackaged`/
// `app.getAppPath()` to locate the bundled corpus; vitest runs outside Electron, so those two
// fields are stubbed exactly as the existing tests already stub them. Not invented for this file.
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.resolve(__dirname, '..', '..', '..'),
  },
}));

import { runLianaCycleQuestion } from './liana_terminal_engine';
import type { LianaTerminalEvent } from '../../shared/liana_cycle/liana_terminal_types';
import type { SteppedAudibleChannel } from './stepped_audible';
import type { LianaSteppedResponse } from '../../shared/liana_cycle/liana_terminal_types';

const fakeAskGoogle = async (_q: string) => null;

describe('MEASURED: qid 98\'s default run, assisted mode, round count', () => {
  // 20 rounds, each running Survey's real (non-network, synchronous-stub) parsing logic, took
  // ~15-29s observed locally -- comfortably over vitest's 5000ms default. 60000ms named
  // explicitly (not left to a CLI --testTimeout flag) so `npx vitest run` alone reproduces this
  // result without a special invocation.
  test('counts every assisted-mode pause a real qid-98 run raises under the always-null-askGoogle stub', async () => {
    let rounds = 0;
    const capturedQueries: string[] = [];
    // SAFETY NET, TEST-ONLY: assisted mode is correctly built to wait FOREVER on a genuinely
    // empty capture (no timer, ever -- see assisted_mode.ts's own header). An automated stub
    // cannot honestly simulate "Google returned nothing" the way fakeAskGoogle's `null` does
    // (an empty capture means WAIT, not "here is an empty answer") -- so this stub returns a
    // small, honest, clearly-synthetic non-empty string each time, letting the real cascade code
    // decide what happens next exactly as it would on any other unhelpful-but-present answer.
    // The hard cap below is a TEST SAFETY NET ONLY (never shipped code) -- if the real engine
    // ever loops past a sane bound that is itself a finding, reported as a thrown test failure
    // rather than a silently hung CI run.
    const MAX_ROUNDS_SAFETY_NET = 60;
    const assistedChannel: SteppedAudibleChannel = {
      requestStepPause: async (pause): Promise<LianaSteppedResponse> => {
        rounds += 1;
        if (rounds > MAX_ROUNDS_SAFETY_NET) {
          throw new Error(`MEASUREMENT SAFETY NET: exceeded ${MAX_ROUNDS_SAFETY_NET} assisted-mode rounds -- stopping the test rather than hanging; this is itself a finding.`);
        }
        // Records the exact query text this pause presented, so the deliverable can quote a
        // sample rather than only a bare count.
        const lastNote = [...pause.events].reverse().find((e) => e.text.includes('query for you to issue'));
        if (lastNote) capturedQueries.push(lastNote.text);
        return {
          pauseId: pause.pauseId,
          action: 'nexus_capture',
          nexusCapturedText: '(test instrument: synthetic non-empty capture, no real search performed)',
          nexusSurface: 'google',
          nexusUrl: 'https://www.google.com/search?q=test',
          nexusContainerUsed: 'main',
          nexusCitations: [],
        };
      },
    };
    const events: LianaTerminalEvent[] = [];
    const outcome = await runLianaCycleQuestion(
      '98',
      fakeAskGoogle,
      (e) => events.push(e),
      null,
      null,
      undefined,
      undefined,
      undefined,
      'assisted',
      assistedChannel,
    );

    expect(outcome.mode).toBe('assisted');
    // eslint-disable-next-line no-console
    console.log(`MEASURED qid 98 assisted-mode round count (synthetic-capture instrument): ${rounds}`);
    console.log(`MEASURED sample query text(s): ${JSON.stringify(capturedQueries.slice(0, 3))}`);

    // PINNED, not just logged: 2 (the two-part ambiguity+operation query, FD-BP152-05) + 18
    // (Survey's per-option denotation sweep, 9 options x 2 queries each, the FD-BP152-01
    // fallback) = 20, ending in the SAME "demand_unknown" abstain RULINGS_BP152.md's own qid-98
    // receipts report when the captured text carries nothing the ambiguity/operation parser can
    // extract -- exactly what a synthetic, content-free capture honestly produces. This assertion
    // is the instrument: if a future change to Survey/the demand test alters this run's shape,
    // this test fails loudly and names the new number rather than silently going stale.
    expect(rounds).toBe(20);
    expect(outcome.abstain).toBe(true);
    expect(outcome.error).toBe('demand_unknown');
    expect(outcome.method).toBeUndefined();
    expect(events.length).toBeGreaterThan(0);
  }, 60000);
});
