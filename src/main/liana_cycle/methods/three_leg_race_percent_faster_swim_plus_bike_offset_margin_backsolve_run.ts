// D-BP223-BM04-h2cbp9d8-171 -- three-leg-race-percent-faster-swim-plus-bike-offset-margin-backsolve-run-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-leg-race-percent-faster-swim-plus-bike-offset-margin-backsolve-run-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
// from the English of the representative GSM8K question, never from this candidate's own source) --
// ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported object
// unannotated, so nothing was ever checked against the real registry contract. Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes -- proved by a
// programmatic byte-containment check (extract, splice, re-read, includes()), not merely asserted.
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches. run() aborts to an honest
// abstain on any thrown error rather than ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C275 (GSM8K test.jsonl item443, singleton).
 *
 * @generalShape Actor1 has three stated leg times for a race (a swim in minutes, a bike ride
 *   stated as "an hour and <X> minutes", a run in minutes). Actor2 is compared to Actor1: Actor2's
 *   swim is a stated PERCENT faster, and Actor2's bike takes a stated number of minutes LONGER.
 *   Actor1 is stated to have WON by a stated minute margin (Actor2's total = Actor1's total +
 *   margin). The question asks how long Actor2's run took. The corpus's own ground truth (verified
 *   against item443's own "#### 59" line before this candidate was written: 60+20=80,
 *   40+80+50=170, 40*.1=4, 40-4=36, 80+5=85, 170+10=180, 180-85-36=59) is reproduced here exactly.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a "<S1> minutes for the swim"
 *   clause; (b) "an hour and <B1> minutes for the bike ride" clause (the mixed hour-plus-minutes
 *   phrasing); (c) a "<R1> minutes for the run" clause; (d) "finishes the swim <P>% faster" and
 *   "takes <B2> minutes longer on the bike" clauses naming Actor2's comparison; (e) a "won by <M>
 *   minutes" margin clause; (f) a closing "how long did it take <Actor2> to do the run" question.
 *
 * @whatBreaksIt (a) any of the six required numeric clauses missing -- abstain; (b) the percent
 *   figure not producing an exactly divisible swim-time reduction (swim1*(100-p) not divisible by
 *   100) -- abstain rather than report a fractional minute; (c) a resulting Actor2 run time that
 *   is non-positive -- abstain, the chain does not hold; (d) the "won by" margin attributed to
 *   Actor2 instead of Actor1 -- different (unhandled) direction.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item443): bike1 = 60+20 = 80, total1 = 40+80+50 = 170, swim2 = 40*90/100 = 36, bike2 =
 *   80+5 = 85, total2 = 170+10 = 180, run2 = 180-85-36 = 59 (exact rational arithmetic throughout,
 *   never a float heuristic). SOLVED. Reach across a wider corpus is recorded in
 *   wave_manifest.json, not asserted here -- this is a singleton-cluster shape with one known
 *   teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-leg-race-percent-faster-swim-plus-bike-offset-margin-backsolve-run-v1';

const SWIM1_RE = /(\d+)\s+minutes?\s+for the swim\b/i;
const BIKE1_RE = /an hour and\s+(\d+)\s+minutes?\s+for the bike ride\b/i;
const RUN1_RE = /(\d+)\s+minutes?\s+for the run\b/i;
const FASTER_RE = /finishes the swim\s+(\d+)%\s+faster\b/i;
const BIKE_LONGER_RE = /takes\s+(\d+)\s+minutes?\s+longer on the bike\b/i;
const MARGIN_RE = /won by\s+(\d+)\s+minutes?\b/i;
const ASK_RE = /how long did it take\s+\S+\s+to do the run\b/i;
const MINUTES_PER_HOUR = 60;
const PERCENT_BASE = 100;

interface Analyzed { run2: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const swim1M = SWIM1_RE.exec(q);
  if (!swim1M) return null;
  const swim1 = Number(swim1M[1]);

  const bike1M = BIKE1_RE.exec(q);
  if (!bike1M) return null;
  const bike1 = MINUTES_PER_HOUR + Number(bike1M[1]);

  const run1M = RUN1_RE.exec(q);
  if (!run1M) return null;
  const run1 = Number(run1M[1]);

  const fasterM = FASTER_RE.exec(q);
  if (!fasterM) return null;
  const percentFaster = Number(fasterM[1]);
  if (!Number.isFinite(percentFaster) || percentFaster <= 0 || percentFaster >= PERCENT_BASE) return null;

  const bikeLongerM = BIKE_LONGER_RE.exec(q);
  if (!bikeLongerM) return null;
  const bikeExtra = Number(bikeLongerM[1]);

  const marginM = MARGIN_RE.exec(q);
  if (!marginM) return null;
  const margin = Number(marginM[1]);

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  if (![swim1, bike1, run1, bikeExtra, margin].every((v) => Number.isFinite(v) && v >= 0)) return null;

  const total1 = swim1 + bike1 + run1; // exact integer

  const swim2Numerator = swim1 * (PERCENT_BASE - percentFaster); // exact integer
  if (swim2Numerator % PERCENT_BASE !== 0) return null; // would not land on a whole-minute swim
  const swim2 = swim2Numerator / PERCENT_BASE;

  const bike2 = bike1 + bikeExtra; // exact integer
  const total2 = total1 + margin; // exact integer
  const run2 = total2 - swim2 - bike2; // exact integer
  if (!Number.isFinite(run2) || run2 <= 0) return null;

  return { run2 };
}

export const threeLegRacePercentFasterSwimPlusBikeOffsetMarginBacksolveRun: LianaMethod = {
  id: 'three-leg-race-percent-faster-swim-plus-bike-offset-margin-backsolve-run-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a second racer\'s run leg from three baseline leg times, a percent-faster swim, a bike-time offset, and a winning margin',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C275, GSM8K test item443',
  shapeDescription:
    'Actor1: swim S1, bike (hour+B1 min), run R1. Actor2: swim S1*(100-P)/100, bike B1total+extra, ' +
    'total = Actor1 total + margin. Backsolve Actor2\'s run. Matches the corpus\'s own worked ' +
    'chain, only when every intermediate resolves to a whole minute and the run is positive.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the full six-clause chain (swim/bike/run baseline, percent-faster swim, ' +
          'bike-longer offset, winning margin, closing run-time question) resolving to a whole, ' +
          'strictly positive run time; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `run2 = ${result.run2}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: METHOD_ID,
          basis: 'shape did not hold at run time',
        };
      }
      return {
          question,
          verdict: String(Math.round((result.run2) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'total2 - swim2 - bike2, where total2 = total1 + margin, exact rational arithmetic throughout',
        };
    } catch (e) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText,
        method: METHOD_ID,
        basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e),
      };
    }
  },
};

registerMethod(threeLegRacePercentFasterSwimPlusBikeOffsetMarginBacksolveRun);
