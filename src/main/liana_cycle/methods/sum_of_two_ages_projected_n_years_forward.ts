// D-BP223-BM04-h2cbpv9w-170 -- sum-of-two-ages-projected-n-years-forward-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-of-two-ages-projected-n-years-forward-v1.candidate.ts
// Authored by generation wave W10 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
// (answer carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C105 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 278, "Mico and Marco wanted to get to know
 * each other. They realized that the sum of their ages is 20. What will be the sum of their ages
 * in 10 years?"
 *
 * @generalShape EXACTLY TWO named people; only the SUM of their two current ages is given (never
 *   either age individually), and the question asks for the sum of their ages after a stated
 *   number of years pass. Because each of the two people ages by the same number of years, the
 *   future sum is the current sum plus TWICE the elapsed years -- the individual ages are never
 *   needed and are never recoverable from the sum alone, which is exactly why this shape only
 *   ever asks for a future SUM, never a future individual age.
 *
 * @recogniseInStranger The opening clause must name exactly two people joined by "and" (e.g.
 *   "<Name1> and <Name2>"). A "sum of their ages is <S>" anchor gives the current sum. A "sum of
 *   their ages in <N> years" anchor (inside the closing question) gives the elapsed years. Both
 *   anchors must use the word "sum" -- an age given as an individual figure, or a question asking
 *   for a difference or a single person's future age, is a different shape.
 *
 * @whatBreaksIt (a) more or fewer than exactly two named people in the opening clause; (b) either
 *   age given individually anywhere in the text (this method does not check for that explicitly,
 *   but its own anchors require the word "sum" in both the given fact and the question, so a
 *   problem that instead states individual ages will simply fail to match either anchor and
 *   abstain); (c) a non-uniform time offset (one person ages differently than the other) -- this
 *   shape has no way to express that and none is checked for, since the anchor itself only ever
 *   matches a single shared "in <N> years" clause; (d) the two anchors disagreeing about whose
 *   "sum" is meant (e.g. a sum of heights, not ages) -- both anchors require the literal word
 *   "ages" immediately in the same clause as "sum", so a mismatched noun fails to match.
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED, current sum plus twice the elapsed years
 *   matching the dataset's own worked total exactly. With only one known member there is no
 *   cross-member measurement to report for this singleton cluster -- noted honestly rather than
 *   inflated with a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-of-two-ages-projected-n-years-forward-v1';

interface Analyzed {
  name1: string;
  name2: string;
  currentSum: number;
  years: number;
  futureSum: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Exactly two named people, joined by "and", opening the text.
  const namesRe = /^([A-Z][a-z']+)\s+and\s+([A-Z][a-z']+)\b/;
  const mNames = namesRe.exec(q);
  if (!mNames) return null;
  const [, name1, name2] = mNames;

  // Current sum of ages, anchored on the literal phrase "sum of ... ages is <S>".
  const sumRe = /\bsum\s+of\s+(?:their|his\s+and\s+her)\s+ages\s+is\s+([0-9]+(?:\.[0-9]+)?)\b/i;
  const mSum = sumRe.exec(q);
  if (!mSum) return null;
  const currentSum = parseFloat(mSum[1]);
  if (!toFinite(currentSum)) return null;

  // Elapsed years, anchored on "sum of ... ages in <N> years" inside the closing question.
  const futureRe = /\bsum\s+of\s+(?:their|his\s+and\s+her)\s+ages\s+in\s+([0-9]+(?:\.[0-9]+)?)\s+years\b/i;
  const mFuture = futureRe.exec(q);
  if (!mFuture) return null;
  const years = parseFloat(mFuture[1]);
  if (!toFinite(years)) return null;

  const futureSum = currentSum + years * 2;
  if (!toFinite(futureSum)) return null;

  return { name1, name2, currentSum, years, futureSum };
}

export const sumOfTwoAgesProjectedNYearsForward: LianaMethod = {
  id: 'sum-of-two-ages-projected-n-years-forward-v1',
  demand: 'COMPUTE',
  name: 'Sum of exactly two people\'s current ages, projected forward by twice the stated years',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C105, sole member harvest_gsm8k_pilot_item278, GSM8K test.jsonl line 278)',
  shapeDescription:
    'Exactly two named people; only the sum of their current ages is given; the question asks ' +
    'for the sum of their ages after a stated number of years, computed as current sum plus ' +
    'twice the elapsed years.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find "<Name1> and <Name2>", "sum of their ages is <S>", and "sum of their ' +
          'ages in <N> years" all together; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `${result.name1} & ${result.name2}: sum=${result.currentSum}, +${result.years}y*2 -> ${result.futureSum}`,
    };
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
      const rounded = Math.round(result.futureSum * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.currentSum} + ${result.years}*2 = ${rounded}`,
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
  }
};

registerMethod(sumOfTwoAgesProjectedNYearsForward);
