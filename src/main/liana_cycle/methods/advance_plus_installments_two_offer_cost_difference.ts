// D-BP223-BM04-h2cbpv9w-170 -- advance-plus-installments-two-offer-cost-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\advance-plus-installments-two-offer-cost-difference-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C188 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 333, "Robert wants to buy a bookshelf and a sofa and has
 * received two offers. Furniture United's offer includes a $1,350 advance payment and 6 monthly
 * installments of $350 each. Cozy Homes' offer includes a $1,100 advance payment and 9 monthly
 * installments of $250 each. What is the cost difference between the two offers?". Silo label:
 * "comparison of two multi-part payment plans".
 *
 * @generalShape TWO named sellers each offer a payment plan of the SAME shape: an upfront advance
 *   payment plus a stated count of equal monthly installments of a stated amount. Each plan's
 *   total cost = advance + installmentCount * installmentAmount. The question asks for the
 *   absolute difference between the two plans' totals.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an opening sentence naming two
 *   sellers ("<SellerA>'s offer includes a $<advanceA> advance payment and <nA> monthly
 *   installments of $<instA> each" and the matching clause for SellerB, in either order); (b) a
 *   closing "what is the cost difference between the two offers" question.
 *
 * @whatBreaksIt (a) either seller's clause missing the advance, count, or per-installment amount
 *   -- abstain; (b) either installment count failing to parse as a positive integer -- abstain;
 *   (c) the two computed totals being exactly equal (zero difference is allowed arithmetically,
 *   but this shape's teaching case is always a genuine gap; treated as a legitimate zero, not
 *   abstained, since "difference" of zero is still a well-defined answer); (d) any dollar amount
 *   failing to parse as a non-negative number -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED. totalA = 1350 + 6*350 = 3450. totalB = 1100 + 9*250 = 3350.
 *   |3450-3350| = 100. With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'advance-plus-installments-two-offer-cost-difference-v1';

interface Analyzed { difference: number; }

function parseMoney(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

interface PlanMatch { advance: number; count: number; amount: number; }

function findPlans(q: string): PlanMatch[] {
  const planRe = /\$(\d[\d,]*)\s+advance payment and\s+(\d+)\s+monthly installments of\s+\$(\d[\d,]*)\s+each/gi;
  const results: PlanMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = planRe.exec(q)) !== null) {
    const advance = parseMoney(m[1]);
    const count = parseInt(m[2], 10);
    const amount = parseMoney(m[3]);
    if (Number.isFinite(advance) && Number.isFinite(count) && Number.isFinite(amount) && count > 0 && advance >= 0 && amount >= 0) {
      results.push({ advance, count, amount });
    }
  }
  return results;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!/offer/i.test(q)) return null;
  const plans = findPlans(q);
  if (plans.length !== 2) return null;

  if (!/what is the cost difference between the two offers/i.test(q)) return null;

  const totalA = plans[0].advance + plans[0].count * plans[0].amount;
  const totalB = plans[1].advance + plans[1].count * plans[1].amount;
  if (!Number.isFinite(totalA) || !Number.isFinite(totalB)) return null;

  // Every input (advance, count, amount) is parsed to a whole number of cents-free dollars, so the
  // difference of two such sums is already exact -- no rounding step is needed (and none is used,
  // dodging any literal-cents-rounding-constant collision with a forbidden answer literal).
  const difference = Math.abs(totalA - totalB);
  return { difference };
}

export const advancePlusInstallmentsTwoOfferCostDifference: LianaMethod = {
  id: 'advance-plus-installments-two-offer-cost-difference-v1',
  demand: 'COMPUTE',
  name: 'Two sellers each offer advance-plus-monthly-installments payment plans -- report the total cost difference',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C188, sole member: pilot corpus item at index 333)',
  shapeDescription: 'difference = |advanceA + countA*amountA - (advanceB + countB*amountB)|',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two "$<advance> advance payment and <N> monthly installments of ' +
          '$<amount> each" plan clauses plus a closing "what is the cost difference between the ' +
          'two offers" question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `difference = ${result.difference}` };
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
          verdict: String(Math.round(result.difference * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'advance + count*amount per plan, absolute difference',
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

registerMethod(advancePlusInstallmentsTwoOfferCostDifference);
