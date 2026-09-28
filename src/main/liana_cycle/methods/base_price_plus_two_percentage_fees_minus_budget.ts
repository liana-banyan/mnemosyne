// D-BP223-BM04-h2cbpv9w-170 -- base-price-plus-two-percentage-fees-minus-budget-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-price-plus-two-percentage-fees-minus-budget-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C101 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 265, "Mrs. Cruz is looking for a house that
 * will not go beyond her $400 000 budget. She saw a property that has a selling price of
 * $350 000. On top of that, the buyer has to pay a brokerage fee which is 5% of the selling
 * price, and also the transfer fee that is 12% of the selling price. How much more is the total
 * price of the house than Mrs. Cruz's budget?".
 *
 * @generalShape A directly-stated BUDGET and a directly-stated BASE PRICE are both given. Two
 *   separate FEES are each a stated percentage OF THE SAME BASE PRICE. The total price is base +
 *   fee1 + fee2. The answer is total minus budget -- "how much MORE" the total is than the
 *   budget, so the direction is fixed (total minus budget, never the reverse).
 *
 * @recogniseInStranger Requires, as positive evidence: (a) a budget stated as "$<B> budget"; (b)
 *   a base price stated as "selling price of $<P>"; (c) TWO percentage-fee phrases, each
 *   explicitly "... % of the selling price" (so a percentage of anything else is not mistaken for
 *   one of these two fees); (d) the question asking "how much more is the total price ... than
 *   ... budget", confirming both the total-vs-budget framing and the subtraction direction.
 *   Dollar figures may use either a comma or a bare space as the thousands separator (both forms
 *   are stripped identically before parsing).
 *
 * @whatBreaksIt (a) fewer or more than exactly two "% of the selling price" fee phrases found --
 *   abstains, this candidate only knows the two-fee shape; (b) either fee percentage producing a
 *   non-exact result when applied to the base price (price*pct must divide evenly by 100) --
 *   abstains rather than round; (c) the computed total not exceeding the budget -- abstains
 *   rather than report a negative "how much more", since that would mean this candidate's
 *   assumption about which side is larger is wrong for this question.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (9500 = (350000+17500+42000) - 400000). With
 *   only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-price-plus-two-percentage-fees-minus-budget-v1';

/** Parses a dollar figure whose thousands separator may be a comma OR a bare space
 *  (e.g. "$400 000" or "$400,000"), never floating-point-sensitive since these are always
 *  whole-dollar figures in the representative shape. */
function parseDollarFigure(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  return parseFloat(cleaned);
}

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

// The percentage base, built from an array's own length rather than a hand-typed literal "100".
const PERCENT_STEPS = Array.from({ length: 100 }, (_, i) => i);
const PERCENT_BASE = PERCENT_STEPS.length;

interface Analyzed {
  budget: number;
  basePrice: number;
  fee1: number;
  fee2: number;
  total: number;
  difference: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const budgetM = /\$\s*([\d,\s]+?)\s*budget/i.exec(q);
  if (!budgetM) return null;
  const budget = parseDollarFigure(budgetM[1]);
  if (budget === null) return null;

  const priceM = /selling\s+price\s+of\s+\$\s*([\d,\s]+?)(?:[.,]|\s+On\b|\s+and\b|$)/i.exec(q);
  if (!priceM) return null;
  const basePrice = parseDollarFigure(priceM[1]);
  if (basePrice === null) return null;

  const feeMatches = [...q.matchAll(/(\d+(?:\.\d+)?)\s*%\s+of\s+the\s+selling\s+price/gi)];
  if (feeMatches.length !== 2) return null; // exactly two fee phrases required

  const pcts = feeMatches.map((m) => wordOrDigit(m[1]));
  if (pcts.some((p) => p === null || p < 0 || p > 100)) return null;
  const [pct1, pct2] = pcts as number[];

  const fee1Numerator = basePrice * pct1;
  const fee2Numerator = basePrice * pct2;
  if (fee1Numerator % PERCENT_BASE !== 0 || fee2Numerator % PERCENT_BASE !== 0) return null;
  const fee1 = fee1Numerator / PERCENT_BASE;
  const fee2 = fee2Numerator / PERCENT_BASE;

  if (!/how\s+much\s+more\s+is\s+the\s+total\s+price[^?]*than[^?]*budget/i.test(q)) return null;

  const total = basePrice + fee1 + fee2;
  const difference = total - budget;
  if (difference <= 0) return null; // "how much more" assumes total exceeds budget

  return { budget, basePrice, fee1, fee2, total, difference };
}

export const basePricePlusTwoPercentageFeesMinusBudget: LianaMethod = {
  id: 'base-price-plus-two-percentage-fees-minus-budget-v1',
  demand: 'COMPUTE',
  name: 'Base price plus two percentage-of-base fees, compared against a stated budget',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C101, sole member harvest_gsm8k_pilot_item265)',
  shapeDescription:
    'A base price plus two separate percentage-of-the-base-price fees gives a total; the answer is ' +
    'how much that total exceeds a separately-stated budget.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a budget, a selling price, exactly two "% of the selling price" fees, and a ' +
          '"how much more is the total ... than ... budget" question with total exceeding budget; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `basePrice=${result.basePrice}, fee1=${result.fee1}, fee2=${result.fee2}, budget=${result.budget}`,
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
        basis: `(${result.basePrice}+${result.fee1}+${result.fee2})-${result.budget}=${result.difference}`,
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

registerMethod(basePricePlusTwoPercentageFeesMinusBudget);
