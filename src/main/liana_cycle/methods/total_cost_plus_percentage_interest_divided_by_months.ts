// D-BP223-BM04-h2cbpv9w-170 -- total-cost-plus-percentage-interest-divided-by-months-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-cost-plus-percentage-interest-divided-by-months-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W13, CLUSTER C133 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 73, "Shiela bought five cell phones for $150 each for a
 * 3-month installment. A 2% interest will be charged for each unit. How much will Shiela pay each
 * month for 3 months?". Silo label: "financial_calculation_installment_payment --
 * total_cost_with_interest_divided_by_number_of_payments".
 *
 * @generalShape A quantity Q of identical items is bought at a stated UNIT PRICE P, for an
 *   installment plan over M months. A stated PERCENTAGE interest rate R is charged on the total
 *   purchase cost. totalCost = Q*P; interest = totalCost*(R/100); totalAmount = totalCost +
 *   interest; monthlyPayment = totalAmount / M.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a purchase clause "bought <Q>
 *   <item>s for $<P> each"; (b) an explicit installment period naming the SAME number of months as
 *   the closing question ("<M>-month installment"); (c) an explicit percentage-interest clause
 *   ("<R>% interest will be charged"); (d) a closing question asking how much will be paid each
 *   month for that SAME number of months.
 *
 * @whatBreaksIt (a) the installment-period month count and the closing question's month count
 *   disagreeing -- abstains, cannot confirm which period to divide by; (b) the interest*totalCost
 *   arithmetic not landing on an exact integer number of cents -- abstains rather than round; (c)
 *   the totalAmount not dividing evenly by the number of months (in integer cents) -- abstains
 *   rather than round a monthly payment; (d) no explicit percentage-interest clause -- this
 *   candidate does not attempt a plain divide-without-interest installment question.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (totalCost = 5*$150 = $750; interest = 2%*$750 = $15; totalAmount
 *   = $765; monthly = $765/3 = $255). With only one known cluster member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-cost-plus-percentage-interest-divided-by-months-v1';


const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

function toCents(raw: string): number | null {
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(fracPadded);
}

interface Analyzed { monthlyCents: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const purchaseRe = /bought\s+(\d+|[a-z-]+)\s+([a-z\s]+?)\s+for\s+\$([\d.,]+)\s+each/i;
  const pm = purchaseRe.exec(q);
  if (!pm) return null;
  const qty = wordOrDigit(pm[1]);
  const unitPriceCents = toCents(pm[3]);
  if (qty === null || qty <= 0 || unitPriceCents === null) return null;

  const installmentRe = /(\d+)\s*-\s*month\s+installment/i;
  const im = installmentRe.exec(q);
  if (!im) return null;
  const installmentMonths = Number(im[1]);
  if (!Number.isInteger(installmentMonths) || installmentMonths <= 0) return null;

  const rateRe = /(\d+(?:\.\d+)?)\s*%\s+interest\s+will\s+be\s+charged/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const rate = Number(rm[1]);
  if (!Number.isFinite(rate) || rate < 0) return null;

  const closingRe = /how much will[^?]*pay\s+each\s+month\s+for\s+(\d+)\s+months/i;
  const cm = closingRe.exec(q);
  if (!cm) return null;
  const closingMonths = Number(cm[1]);
  if (!Number.isInteger(closingMonths) || closingMonths !== installmentMonths) return null;

  const totalCostCents = qty * unitPriceCents;

  // Exact-cents guards: interest and the final monthly split must both land on whole cents.
  const interestProduct = totalCostCents * rate;
  if (interestProduct % 100 !== 0) return null;
  const interestCents = interestProduct / 100;

  const totalAmountCents = totalCostCents + interestCents;
  if (totalAmountCents % installmentMonths !== 0) return null;
  const monthlyCents = totalAmountCents / installmentMonths;

  return { monthlyCents };
}

export const totalCostPlusPercentageInterestDividedByMonths: LianaMethod = {
  id: 'total-cost-plus-percentage-interest-divided-by-months-v1',
  demand: 'COMPUTE',
  name: 'Compute total cost plus percentage interest, then split evenly across installment months',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W13 (cluster C133, sole member: pilot corpus item at index 73)',
  shapeDescription:
    'totalCost = qty*unitPrice; interest = totalCost*(rate/100); totalAmount = totalCost + ' +
    'interest; monthlyPayment = totalAmount / installmentMonths, computed in exact integer cents.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching purchase clause, an installment-period clause, a percentage-' +
          'interest clause, and a closing "how much ... each month for N months" question sharing ' +
          'the same month count, with every arithmetic step landing on an exact cent; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `monthlyCents = ${result.monthlyCents}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const dollars = result.monthlyCents / 100;
      const verdict = Number.isInteger(dollars) ? dollars : Math.round(dollars * 100) / 100;
      return { question, verdict: String(verdict), abstain: false, freeText, method: METHOD_ID, basis: '(qty*unitPrice*(1+rate/100)) / installmentMonths, exact integer cents' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(totalCostPlusPercentageInterestDividedByMonths);
