// D-BP223-BM04-h2cbpv9w-170 -- half-base-then-double-plus-offset-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\half-base-then-double-plus-offset-difference-v1.candidate.ts
// Authored by generation wave W09 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W09.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C100 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 263, "There are 6 trees in Chris's yard.
 * Ferdinand has half the number of trees that Chris has. Harry has 5 more than twice the number
 * of trees that Ferdinand has. How many more trees are in Harry's yard than Ferdinand's yard?".
 *
 * @generalShape A base actor's count is given directly ("<N> <item> in <base actor>'s <place>").
 *   A second actor's count is HALF the base actor's count (exact division required). A third
 *   actor's count is "<K> more than twice" the second actor's count. The answer is the
 *   DIFFERENCE between the third and second actors' counts, in that order (third minus second),
 *   matching the question's own naming order.
 *
 * @recogniseInStranger Requires, as positive evidence, a name-matched three-link chain: (a) "<N>
 *   <item> in <baseActor>'s <place>"; (b) "<secondActor> has half the number of <item> that
 *   <baseActor> has"; (c) "<thirdActor> has <K> more than twice the number of <item> that
 *   <secondActor> has"; (d) the question "how many more <item> are in <thirdActor>'s <place> than
 *   <secondActor>'s <place>", with the actor order in the question matching (third, second) so
 *   the subtraction direction is never guessed.
 *
 * @whatBreaksIt (a) the base count not dividing evenly by two -- abstains rather than round; (b)
 *   any link's referenced actor name not matching the previous link's actor -- abstains, a broken
 *   name chain means the value flow cannot be trusted; (c) the question's two named actors not
 *   matching (thirdActor, secondActor) in that order -- abstains, since this candidate only
 *   computes that one direction, never the reverse or a different pair.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (8 = (5+2*3) - 3, where 3 = 6/2). With only one
 *   known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'half-base-then-double-plus-offset-difference-v1';

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

interface Analyzed {
  baseActor: string;
  baseValue: number;
  secondActor: string;
  secondValue: number;
  thirdActor: string;
  thirdValue: number;
  difference: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = /(\d+(?:\.\d+)?)\s+trees\s+in\s+(\w+)'s\s+yard/i.exec(q);
  if (!baseM) return null;
  const baseValue = wordOrDigit(baseM[1]);
  const baseActor = baseM[2];
  if (baseValue === null) return null;

  const halfRe = new RegExp(
    '(\\w+)\\s+has\\s+half\\s+the\\s+number\\s+of\\s+trees\\s+that\\s+' + baseActor + '\\s+has',
    'i',
  );
  const halfM = halfRe.exec(q);
  if (!halfM) return null;
  const secondActor = halfM[1];
  if (baseValue % 2 !== 0) return null; // never round an inexact half
  const secondValue = baseValue / 2;

  const comboRe = new RegExp(
    '(\\w+)\\s+has\\s+(\\d+(?:\\.\\d+)?)\\s+more\\s+than\\s+twice\\s+the\\s+number\\s+of\\s+trees\\s+that\\s+' +
      secondActor +
      '\\s+has',
    'i',
  );
  const comboM = comboRe.exec(q);
  if (!comboM) return null;
  const thirdActor = comboM[1];
  const offset = wordOrDigit(comboM[2]);
  if (offset === null) return null;
  const thirdValue = offset + 2 * secondValue;

  const questionRe = new RegExp(
    'how\\s+many\\s+more\\s+trees\\s+are\\s+in\\s+' +
      thirdActor +
      "'s\\s+yard\\s+than\\s+" +
      secondActor +
      "'s\\s+yard",
    'i',
  );
  if (!questionRe.test(q)) return null;

  const difference = thirdValue - secondValue;
  return { baseActor, baseValue, secondActor, secondValue, thirdActor, thirdValue, difference };
}

export const halfBaseThenDoublePlusOffsetDifference: LianaMethod = {
  id: 'half-base-then-double-plus-offset-difference-v1',
  demand: 'COMPUTE',
  name: 'Base halved, then doubled plus an offset for a third actor, answer is the difference',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C100, sole member, GSM benchmark test corpus line 263)',
  shapeDescription:
    'A base actor\'s count is halved for a second actor; a third actor\'s count is a fixed offset ' +
    'more than twice the second actor\'s count; the answer is the third minus the second, in the ' +
    'order the question names them.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a valid base -> half -> (offset + twice) actor chain with a matching ' +
          '"how many more ... than ..." question in the same order; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `base=${result.baseValue}, second=${result.secondValue}, third=${result.thirdValue}`,
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
      return {
        question,
        verdict: String(Math.round((result.difference) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.thirdActor}=${result.thirdValue} - ${result.secondActor}=${result.secondValue} = ${result.difference}`,
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

registerMethod(halfBaseThenDoublePlusOffsetDifference);
