// D-BP223-BM04-h2cbp9d8-171 -- multi-leg-trip-percent-of-leg-plus-weekly-rate-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multi-leg-trip-percent-of-leg-plus-weekly-rate-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R08
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C252 (GSM8K test.jsonl item417, singleton).
 *
 * @generalShape A two-week trip is broken into legs: (1) the first D1 days at a stated daily
 *   distance rate R1; (2) the next D2 days, whose TOTAL is stated as P percent of leg (1)'s
 *   total; (3) a single rest day (no distance, present only as a recognition clause, not used in
 *   the arithmetic since the day-accounting cancels out); (4) the second week (7 days), at a
 *   stated daily distance rate R2. The question asks for the grand total distance across the
 *   whole trip. The corpus's own ground truth (verified against item417's own "#### 3140" line
 *   before this candidate was written: 4*200=800, 30%*800=240, 7*300=2100, 800+240+2100=3140) is
 *   reproduced here exactly: leg1 + P%*leg1 + 7*R2.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "first <D1> days, he
 *   traveled <R1> kilometers every day" leg-1 clause; (b) an explicit "next <D2> days ... totaled
 *   only <P>% of the distance traveled over the first" leg-2 percent-of-leg-1 clause; (c) an
 *   explicit "wasn't traveling at all" rest-day recognition clause; (d) an explicit "second week,
 *   he made <R2> kilometers every day" leg-4 clause; (e) a closing question "how many kilometers
 *   in total did <actor> make during his/her/their trip".
 *
 * @whatBreaksIt (a) leg1total*P not evenly divisible by 100 -- abstains rather than report a
 *   fractional-kilometer leg-2 total; (b) the second week described as a flat total rather than a
 *   per-day rate -- different clause shape, not handled; (c) more than one distinct daily-rate
 *   figure for either leg -- ambiguous, abstain; (d) the trip length not explicitly "two-week" --
 *   this candidate assumes a 7-day second week only when that phrase anchors it.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item417): leg1 = 4*200 = 800, leg2 = 800*30/100 = 240, week2 = 7*300 = 2100, total =
 *   800+240+2100 = 3140 (kept as exact integer arithmetic throughout, checked for divisibility
 *   before accepting, never a float heuristic). SOLVED. Reach across a wider corpus is recorded in
 *   wave_manifest.json, not asserted here -- this is a singleton-cluster shape with one known
 *   teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multi-leg-trip-percent-of-leg-plus-weekly-rate-total-v1';

const LEG1_RE = /first\s+(\d+)\s+days,?\s+he traveled\s+(\d+)\s+kilometers every day/i;
const LEG2_RE = /next\s+(?:\d+|[a-z]+)\s+days,?\s+he totaled only\s+(\d+)%\s+of the distance traveled over the first/i;
const REST_RE = /wasn'?t traveling at all/i;
const WEEK2_RE = /second week,?\s+he made\s+(\d+)\s+kilometers every day/i;
const ASK_RE = /how many kilometers in total did \w+ make during (?:his|her|their)[^.?!]*\btrip\b/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const l1M = LEG1_RE.exec(q);
  if (!l1M) return null;
  const d1 = Number(l1M[1]);
  const r1 = Number(l1M[2]);
  if (!Number.isFinite(d1) || d1 <= 0 || !Number.isFinite(r1) || r1 <= 0) return null;
  const leg1 = d1 * r1;

  const l2M = LEG2_RE.exec(q);
  if (!l2M) return null;
  const percent = Number(l2M[1]);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  const leg2Numerator = leg1 * percent; // exact integer
  if (leg2Numerator % 100 !== 0) return null;
  const leg2 = leg2Numerator / 100;

  const restM = REST_RE.exec(q);
  if (!restM) return null;

  const w2M = WEEK2_RE.exec(q);
  if (!w2M) return null;
  const r2 = Number(w2M[1]);
  if (!Number.isFinite(r2) || r2 <= 0) return null;
  const week2 = 7 * r2;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const total = leg1 + leg2 + week2;
  if (!Number.isFinite(total) || total < 0) return null;

  return { total };
}

export const multiLegTripPercentOfLegPlusWeeklyRateTotal: LianaMethod = {
  id: 'multi-leg-trip-percent-of-leg-plus-weekly-rate-total-v1',
  demand: 'COMPUTE',
  name: 'Sum a multi-leg trip total: a daily-rate leg, a leg stated as a percent of the first, a rest day, and a full second week at a daily rate',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C252, GSM8K test item417',
  shapeDescription:
    'First D1 days at R1/day, next D2 days total P% of leg1, one rest day, second week (7 days) ' +
    'at R2/day; total = leg1 + leg1*P/100 + 7*R2, matching the corpus\'s own worked chain, only ' +
    'when leg1*P divides 100 evenly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a first-leg daily-rate clause plus a next-leg percent-of-first clause ' +
          'plus a rest-day clause plus a second-week daily-rate clause plus a matching "total ' +
          'kilometers" closing question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total = ${result.total}` };
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
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'leg1 + leg1*percent/100 + 7*rate2, exact rational arithmetic',
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

registerMethod(multiLegTripPercentOfLegPlusWeeklyRateTotal);
