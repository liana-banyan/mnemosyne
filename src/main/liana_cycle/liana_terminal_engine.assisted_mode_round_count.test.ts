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
//
// D-BP154-008/BISHOP/S8/seg-mortgage, ADDITIVE ISOLATION. THE MORTGAGE wires
// liana_terminal_engine.ts's `ownedPassages()` builder to consult PRIOR acquisitions on disk for
// qid 98 (cross_acquisition.ts) whenever `parsed.qid != null` -- true on every run this file
// makes. Left unisolated, this instrument's own pinned number would silently depend on whatever
// real qid-98 evidence happens to sit in the live HARDWIRE\LEDGER\LIANA_EVIDENCE store on
// whichever machine runs it (23 acquisitions there as of this ticket, and growing every time
// Bishop runs qid 98 live) -- exactly the kind of environment-dependent flake this file's own
// header claims NOT to have ("Deterministic, offline"). `LB_EVIDENCE_DIR` is pointed at an empty,
// per-test temp directory (evidence_store.ts's own `resolveEvidenceDir()` env override, the SAME
// mechanism evidence_store.test.ts already relies on) so the lookup always finds nothing and this
// instrument's number depends only on this file's own stub, exactly as before this ticket.

import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';

let isolatedEvidenceDir: string;
let originalLbEvidenceDir: string | undefined;
beforeEach(() => {
  originalLbEvidenceDir = process.env.LB_EVIDENCE_DIR;
  isolatedEvidenceDir = mkdtempSync(join(tmpdir(), 'lb-round-count-isolation-'));
  process.env.LB_EVIDENCE_DIR = isolatedEvidenceDir;
});
afterEach(() => {
  if (originalLbEvidenceDir === undefined) delete process.env.LB_EVIDENCE_DIR;
  else process.env.LB_EVIDENCE_DIR = originalLbEvidenceDir;
  rmSync(isolatedEvidenceDir, { recursive: true, force: true });
});

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
    //
    // RE-PINNED AGAIN, 21 -> 3, D-BP153-017 (THE THREE QUESTIONS AND THE DOUBLECHECK). THIS IS THE
    // WHOLE POINT OF THIS TICKET, NOT AN INCIDENTAL SIDE EFFECT. Measured TWICE in isolation on this
    // build, both runs identical (3). BUILD ITEM 1 gates SURVEY STEP 3's per-option denotation sweep
    // (rounds 3-20 under the previous pin -- 9 options x 2 Google queries, FD-BP152-01's fallback)
    // OFF the superlative-by-magnitude route: qid 98 carries a structural superlative
    // (extractSuperlativeMatch() matches, the SAME regex classify_cascade.ts's own run() tests to
    // ROUTE this exact question), so the gate now fires BEFORE Step 3 ever issues a single query for
    // it. The 18-query sweep this ticket's own measurement named ("12 of the first 14 evidence
    // records were the per-option denotation sweep... not one contributed to a derivation") is gone
    // from this run entirely, not merely deferred.
    //   Round 1: SURVEY STEP 2's ambiguity query (Part 1, FD-BP151 addendum) -- unchanged.
    //   Round 2: SURVEY STEP 2's operation query (Part 2, FD-BP152-05) -- unchanged; still resolves
    //     no demand under this instrument's content-free capture, so SURVEY STEP 3's PRE-EXISTING
    //     predicate (`!operationDemandForGate?.demand`) would ALSO have let the sweep run here --
    //     it is the NEW superlative gate, not the old one, that skips it (see
    //     survey_stage.superlative_sweep_gate.test.ts's own SCOPE GUARD test for the isolated proof
    //     that the OLD predicate is untouched and still fires on a non-superlative question).
    //   Round 3: establishFrame()'s own fresh query ("Which of these are world regions...") -- THE
    //     SOFTBALLS, QUESTION 1. Same content-free synthetic capture as every prior re-pin, so FIX 3
    //     ("reject a passage that cannot source the claim", D-BP153-016, unchanged by this ticket)
    //     rejects it before gemmaExtract() is ever called -- frame.available:false, honestly
    //     UNAVAILABLE, ABSTAIN IMMEDIATELY. Per FD-BP153-01 consequence 2 ("a magnitude result with
    //     no frame is NOT definitive"), STAGE M (THE NAMED SET, QUESTION 2) and STAGE D (THE
    //     DISCRIMINATOR, QUESTION 3) are never reached -- the SAME shape the 21-round baseline's own
    //     round 21 already had, just reached 18 rounds sooner. THE DOUBLECHECK's own complement
    //     extraction (establishFrame()'s second gemmaExtract() call, D-BP153-017 BUILD ITEM 3) is
    //     ALSO never reached here: FIX 3's guard runs BEFORE extractFrameBothSides() is even called,
    //     so this instrument cannot show it firing -- see
    //     classify_cascade.softballs_doublecheck_and_query_bill.test.ts's own ITEM 3 tests for the
    //     isolated, real-content proof of the complement direction and its conflict-reporting.
    // ABSTAIN IS STILL EXPECTED HERE, unchanged from every prior re-pin's own note above: this
    // instrument's content-free capture can never name an option, so an honest abstain is correct.
    // What must never come back is `demand_unknown` -- outcome.method stays 'classify-cascade' below.
    //
    // CHECKED AND CONFIRMED UNCHANGED AT 3, D-BP153-023 (INCOMPLETE IS NOT ANSWERED). Measured
    // TWICE in isolation on this ticket's own build, both runs identical (3) -- NOT re-pinned,
    // because it did not move, and this file's own rule is to report what the instrument says, not
    // what a prior ticket's own note predicted it would say. D-BP153-023 changes what a caller does
    // when an owned/fresh-query passage extracts something for SOME but not all options (falls
    // through to the next source instead of terminating). This instrument's synthetic capture is the
    // SAME content-free string on every pause -- it names ZERO of the nine option labels, so
    // establishFrame()'s FIX 3 guard (`passageMentionsAnyLabel`, D-BP153-016, unchanged by this
    // ticket) rejects it BEFORE extraction is ever attempted, on both the owned-passage loop and
    // round 3's own fresh query. The run never reaches reconcileNamedSet() at all here, so it never
    // produces an INCOMPLETE PARTITION for D-BP153-023's new fall-through to act on -- it hits the
    // EARLIER "frame is UNAVAILABLE, no option named" abstain instead (D-BP153-016's own path),
    // exactly as every re-pin back to D-BP153-017 already documented. D-BP153-023's fall-through
    // only fires on a passage that names AT LEAST ONE option but not all of them -- a shape this
    // all-or-nothing synthetic stub cannot produce (it is either off-topic for every option at once,
    // or -- on real evidence -- on-topic for options it actually names). See
    // classify_cascade.frame_complement_not_trusted_when_direct_discarded.test.ts's own D-BP153-023
    // TEST 4 and classify_cascade.named_set_recall.test.ts's own HEADLINE test for the isolated,
    // real-content proof that the fall-through DOES spend the extra query on a passage shaped that
    // way; this instrument's own content-free stub simply never is one.
    //
    // RE-PINNED AGAIN, 3 -> 4, D-BP153-031 (REPEATED DRAWS, THE CHANNEL VARIANCE FINDING). Measured
    // TWICE in isolation on this ticket's own build, both runs identical (4). THE SOFTBALLS' own base
    // question is now drawn LB_DRAW_REPEATS times (default 2), independently, BEFORE establishFrame()
    // decides anything -- this instrument's assisted channel hands back the SAME content-free
    // synthetic capture string for EVERY pause, so both draws of round 3's own question are
    // byte-identical and AGREE (drawWithAgreement()'s own "N independent draw(s) AGREE" branch), never
    // a disagreement -- but agreement still costs the SECOND draw's own round. Round 3 and round 4 are
    // that pair: same query text both times (see the two identical "For EACH of the following..."
    // entries in the sample queries logged above), same content-free capture both times, same FIX 3
    // rejection both times ("no option named" -- passageMentionsAnyLabel fails) -- so the AGREED
    // outcome is still frame.available:false, and STAGE M/STAGE D are still never reached, exactly as
    // every prior re-pin already established. This is the cost of repeated-draw agreement made
    // visible, not a new code path: `LB_DRAW_REPEATS=1` (the escape hatch D-BP153-031 itself requires)
    // reproduces the pre-ticket 3-round count exactly -- see
    // classify_cascade.repeated_draws.test.ts's own TEST 3 for that proof in isolation.
    //
    // RE-PINNED AGAIN, 4 -> 6, D-BP154-001 (THE INVALID DRAW). Measured on this ticket's own build;
    // the shape is deterministic under this instrument (every capture is the SAME content-free
    // string), so a second run reproduces it exactly. THE BUG THIS RE-PIN IS THE RECEIPT FOR: before
    // this ticket, two draws that BOTH said "no option named" were treated as AGREEING (identical
    // `resultKey`s) and trusted outright -- the previous 3/4-round re-pin's own paragraph, above,
    // says so explicitly ("both draws of round 3's own question... AGREE"). THE RULE (this ticket's
    // own ticket file, verbatim) names that the SAME defect as a good draw being vetoed by a bad
    // one: "agreement on an empty result is not corroboration." A draw whose passage names none of
    // the question's options is now classified INVALID (passageMentionsAnyLabel() false, the SAME
    // FIX 3 predicate D-BP153-016 already used) and is REPLACED, under a cap of
    // `LB_DRAW_MAX_INVALID_REPLACEMENTS = 2` extra attempts, rather than trusted.
    //   Round 1-2: unchanged (the 2 Survey meta-queries).
    //   Round 3: THE SOFTBALLS' draw 1 of 2 -- content-free capture, INVALID (no option named),
    //     discarded, replacement taken.
    //   Round 4: replacement 1 of 2 -- SAME content-free capture, STILL invalid, discarded,
    //     replacement taken.
    //   Round 5: replacement 2 of 2 -- SAME content-free capture, STILL invalid, cap now exhausted.
    //   Round 6: only 0 of the required 2 VALID draws were ever obtained after 4 attempts (2 + the
    //     cap of 2) -- CAPTURE FAILURE (D-BP154-001), honestly distinct from the previous re-pin's
    //     "AGREE" outcome, though it reaches the SAME frame.available:false / ABSTAIN consequence
    //     downstream (Per FD-BP153-01 consequence 2, STAGE M/STAGE D are still never reached).
    // Two more rounds than the previous pin is the correct, measured cost of no longer letting a
    // repeatedly-failed capture masquerade as corroborated agreement -- not a regression. On content
    // that DOES name an option (any real acquisition, or classify_cascade.repeated_draws.test.ts's
    // own fixtures), a single invalid draw is replaced ONCE and the run proceeds normally; this
    // instrument's worst case (every draw invalid, every time) is deliberately the cap's own ceiling.
    //
    // CHECKED AND CONFIRMED UNCHANGED AT 6, D-BP154-008 (THE MORTGAGE). Measured on this ticket's
    // own build under the isolated, empty `LB_EVIDENCE_DIR` this file's own beforeEach now sets
    // (see this file's header, D-BP154-008 paragraph) -- NOT re-pinned, because it did not move.
    // liana_terminal_engine.ts's `ownedPassages()` builder now also consults PRIOR acquisitions
    // (cross_acquisition.ts), but an EMPTY evidence directory has none to find, so the two Survey
    // meta-questions and every downstream owned-passage check behave exactly as they did before
    // this ticket -- the same content-free-capture, every-draw-invalid shape D-BP154-001's own
    // paragraph above already documents, unaffected by a lookup that finds nothing. This is the
    // instrument correctly reporting "no evidence owned, no evidence to reach across acquisitions
    // for either" -- see classify_cascade.cross_acquisition_query_bill.test.ts and
    // liana_terminal_engine.cross_acquisition_owned_evidence.test.ts for the isolated,
    // REAL-evidence proof that a seeded prior acquisition DOES reduce this count.
    // ─────────────────────────────────────────────────────────────────────────────────────────
    expect(rounds).toBe(6);
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
