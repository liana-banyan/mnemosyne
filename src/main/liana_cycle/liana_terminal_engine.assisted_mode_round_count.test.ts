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
    // RAISED AT BP153, D-BP153-001: was 60, which sat 6 rounds above the then-measured 20. The
    // measured count is now 54, so a 60-cap would convert the next small shape change into an
    // unhelpful throw instead of letting this instrument report the new number -- which is the
    // whole purpose of the file. Still a TEST SAFETY NET ONLY, never shipped code: a genuine
    // runaway loop still fails the test rather than hanging CI.
    const MAX_ROUNDS_SAFETY_NET = 120;
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

    // eslint-disable-next-line no-console
    console.log(`MEASURED outcome: ${JSON.stringify({ abstain: outcome.abstain, error: outcome.error, method: outcome.method, verdict: outcome.verdict })}`);

    // ─────────────────────────────────────────────────────────────────────────────────────────
    // RE-PINNED AT BP153, D-BP153-001. THE INSTRUMENT DID ITS JOB -- read this before changing it.
    //
    // The previous pin was `rounds === 20`, ending `demand_unknown`, `method === undefined`. That
    // was an accurate measurement of a run that DIED at the demand test: SURVEY STEP 2 resolved no
    // term, so no method could ever be selected, so 20 rounds was simply how far a dead run got.
    // This file's own comment said it would "fail loudly and name the new number rather than
    // silently going stale" if a change altered the run's shape. D-BP153-001 altered it on purpose,
    // and this test failed loudly, exactly as designed. It is being re-pinned, not relaxed.
    //
    // WHAT CHANGED: DEMAND derivation now has a fourth, last-resort path that reads the question's
    // own grammar (determineDemandFromQuestionStructure(), demand_test.ts) when all three
    // surveyed-ask paths refuse. qid 98 carries a structural superlative ("most densely
    // populated"), so DEMAND now resolves to CLASSIFY, classify-cascade is selected, and the run
    // proceeds into the method instead of abstaining at the gate.
    //
    // WHY 54 AND NOT A ROUND NUMBER: measured, twice, in isolation, both runs identical (54, ~41s).
    // It is not a target. If it moves again, this assertion should fail again.
    //
    // RE-PINNED AGAIN, 54 -> 55, D-BP153-006 (THE FRAME). It moved again, and again on purpose.
    // FD-BP153-01 ("make the ruling that a superlative resolves by magnitude RIGHT by making it
    // complete with the frame") added ONE query ahead of the ranking: establishFrame(), which asks
    // which options are members of the question's category at all, so biomes are never ranked
    // against continents. Exactly +1 round, which is itself the confirmation that the frame is one
    // query and not one per option -- the Founder's own rule, BP151: "we got rid of four answers
    // with ONE google search." A frame that cost 9 rounds here would mean it had been built
    // per-option and would need rejecting on volume grounds alone.
    //
    // RE-PINNED AGAIN, 55 -> 56, D-BP153-013 (THE MEMBERSHIP TERMINATOR). Wires STAGE M
    // (extractNamedSetMembers() + runMembershipTerminator(), FD-BP152-19 applied to a NAMED SET)
    // between the frame and Stage A/B, and it too spends exactly ONE query when it cannot resolve
    // from owned evidence -- same "one query, not one per option" discipline the frame itself was
    // held to above. THIS SPECIFIC INSTRUMENT is the one case where the terminator's own promise
    // (save the ordering queries when it resolves) does NOT pay off: `assistedChannel` above hands
    // back the SAME synthetic, content-free capture string for every pause, which never states a
    // named-set member for anything, so STAGE M can never resolve here -- it always falls through
    // to the EXISTING magnitude path unchanged, having spent its one query for nothing. On REAL
    // evidence (qid 98's actual BP153 acquisition, see classify_cascade.membership_terminator.test.ts's
    // own headline test) STAGE M resolves from OWNED evidence with ZERO new queries and skips Stage
    // A/B's remaining rounds entirely -- the opposite direction this synthetic-content instrument
    // cannot show, because "resolves" requires evidence that actually names members, and this stub
    // never provides any.
    //
    // ABSTAIN IS STILL EXPECTED HERE AND IS NOT A DEFECT: `fakeAskGoogle` returns null and every
    // capture is the synthetic content-free string above, so the cascade receives no real density
    // data for any option. An honest abstain on content-free input is the correct behavior -- the
    // point of this instrument is WHERE the run stops, not that it produces a verdict. What must
    // never come back is `demand_unknown`: that is the specific failure D-BP153-001 closed.
    //
    // RE-PINNED AGAIN, 56 -> 23, D-BP153-015 (THE DISCRIMINATOR). Measured, twice, in isolation,
    // both runs identical (23). This is a DROP, not the +1 every prior stage added, and the
    // direction is correct, not a regression: STAGE D fires whenever STAGE M leaves MORE THAN ONE
    // candidate, and under THIS instrument's content-free stub, STAGE M's frame and named set both
    // resolve to empty (nothing excluded, nothing named a member), so candidates = ALL NINE options
    // -- exactly the "more than one" case STAGE D exists to intercept. STAGE D spends its own ONE
    // query (same "one query, not one per option" discipline every stage here is held to), gets the
    // same content-free capture back, states no distinction, and ABSTAINS -- honestly, and MUCH
    // earlier than before. Before this ticket, that same 9-candidate non-unique result fell straight
    // through to Stage A's litmus-strip loop and Stage B's four ordering queries, which is where the
    // bulk of the old 56 rounds were actually spent (per-criterion, per-option evaluation). STAGE D
    // now short-circuits that expensive, evidence-free ranking with a fast, honest abstain instead --
    // fewer wasted rounds is the intended shape of this ticket, not a defect in the instrument. On
    // REAL evidence (classify_cascade.discriminator.test.ts's own REQUIRED POSITIVE test) STAGE D
    // resolves to the correct letter on a STATED kind distinction; this synthetic-content instrument
    // still cannot show that direction, for the same reason noted above for STAGE M.
    //
    // RE-PINNED AGAIN, 23 -> 21, D-BP153-016 (TYPE THE PASSAGES, VERIFY THE SPAN). Measured TWICE
    // in isolation (both the pre-ticket baseline and this ticket's own build), full query-by-query
    // trace taken both times (a throwaway instrumented copy of this same test, deleted after use --
    // not shipped). Rounds 1-20 are byte-identical either way (the 2 Survey meta-queries + the
    // 18-query per-option denotation sweep, D-BP153-03's own "18 definitions nobody read"). Round 21
    // (establishFrame()'s own fresh query, "Which of these are world regions...") is ALSO issued
    // either way -- same query, same round. The divergence is what happens to round 21's ANSWER:
    // this instrument's assisted channel hands back the SAME content-free synthetic capture string
    // for every pause ("(test instrument: synthetic non-empty capture, no real search performed)"),
    // which names NONE of the nine option labels.
    //   BEFORE this ticket: that non-empty-but-off-topic text passed establishFrame()'s only guard
    //   (D-BP153-010's "an empty passage is unavailable" check -- this text is not empty), reached
    //   gemmaExtract(), and came back with nothing stated -- frame.available:true, excluded:[]. A
    //   frame that examined nothing and a frame that confirmed nothing excluded read identically to
    //   the caller, so the run proceeded into STAGE M (round 22, the named-set query) and then STAGE
    //   D (round 23, the discriminator query), both doomed to the same "nothing stated" fate on the
    //   same content-free evidence.
    //   AFTER this ticket: FIX 3 ("reject a passage that cannot source the claim", applied to the
    //   fresh-query path exactly as it is to owned evidence) recognizes BEFORE calling gemmaExtract()
    //   at all that a passage naming none of the nine options cannot state anything about them --
    //   frame.available:false, honestly UNAVAILABLE rather than "confirmed nothing excluded". Per
    //   FD-BP153-01 consequence 2 ("a magnitude result with no frame is NOT definitive"), an
    //   unavailable frame ABSTAINS IMMEDIATELY, right there -- STAGE M and STAGE D are never reached.
    // Two fewer rounds is two fewer queries spent finishing an extraction whose evidence could never
    // have supported an answer -- the same direction every prior STAGE-D-class re-pin in this file
    // has moved (fewer wasted rounds on content-free evidence is the intended shape of this whole
    // BP153 arc, not a defect in the instrument).
    // ─────────────────────────────────────────────────────────────────────────────────────────
    expect(rounds).toBe(21);
    expect(outcome.error).not.toBe('demand_unknown');
    expect(outcome.method).toBe('classify-cascade');
    expect(events.length).toBeGreaterThan(0);
    // TIMEOUT RAISED AT BP153, D-BP153-001: was 60000. The run is now 54 rounds and measured ~41s
    // in isolation on this machine -- comfortable alone, but a BP153 verification SEG running the
    // full liana_cycle suite concurrently saw this same test exhaust 60000ms under load. The
    // failure was scheduling pressure, not logic. 120000 gives the measured ~41s real headroom so
    // a loaded machine does not produce a phantom failure that reads like a regression.
  }, 120000);
});
