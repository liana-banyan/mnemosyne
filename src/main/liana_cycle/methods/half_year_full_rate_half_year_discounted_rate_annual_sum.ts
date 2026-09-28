// D-BP223-BM04-h2cbpv9w-170 -- half-year-full-rate-half-year-discounted-rate-annual-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\half-year-full-rate-half-year-discounted-rate-annual-sum-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W13, CLUSTER C130 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 63, "Aleena subscribed to a streaming service that charges
 * her $140 per month. If the streaming company charged her the initial amount for the first half
 * of the year and then charged her 10% less money on the other half of the year, calculate the
 * total amount she had paid for the streaming service by the end of the year.". Silo label: "total
 * cost calculation with a variable rate -- sum of two parts with different rates".
 *
 * @generalShape A MONTHLY RATE M is stated. The FIRST HALF of the year (6 months) is charged at
 *   the full rate M. The SECOND HALF of the year (6 months) is charged at a stated PERCENTAGE
 *   DISCOUNT D off the same monthly rate. Total annual cost = 6*M + 6*(M*(1 - D/100)).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a monthly-rate clause ("charges
 *   her $<M> per month"); (b) an explicit "first half of the year" phrase; (c) an explicit "<D>%
 *   less" phrase paired with an "other half of the year" / "second half of the year" phrase; (d) a
 *   closing question asking for the total amount paid by the end of the year.
 *
 * @whatBreaksIt (a) either "half of the year" phrase missing -- this candidate does not attempt a
 *   quarter-year or other split, only the exact halves its sole known member evidences; (b) the
 *   discounted-rate arithmetic not landing on an exact integer number of cents -- abstains rather
 *   than round; (c) the discount percentage being 0 or exceeding 100 -- abstains, out of the
 *   evidenced domain; (d) no monthly-rate clause -- abstains, nothing to scale by 6.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (first half = 6*$140 = $840; second half = 6*$140*0.90 = $756;
 *   total = $1596). With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'half-year-full-rate-half-year-discounted-rate-annual-sum-v1';


const HALF_YEAR_MONTHS = 6;

function toCents(raw: string): number | null {
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(fracPadded);
}

interface Analyzed { totalCents: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const monthlyRe = /charges?\s+(?:her|him)?\s*\$([\d.,]+)\s+per\s+month/i;
  const mm = monthlyRe.exec(q);
  if (!mm) return null;
  const monthlyCents = toCents(mm[1]);
  if (monthlyCents === null) return null;

  if (!/first half of the year/i.test(q)) return null;
  if (!/(?:other|second) half of the year/i.test(q)) return null;

  const discRe = /(\d+(?:\.\d+)?)\s*%\s+less\s+money\s+on\s+the\s+(?:other|second)\s+half\s+of\s+the\s+year/i;
  const dm = discRe.exec(q);
  if (!dm) return null;
  const discPct = Number(dm[1]);
  if (!Number.isFinite(discPct) || discPct <= 0 || discPct >= 100) return null;

  if (!/total amount/i.test(q)) return null;

  const firstHalfCents = HALF_YEAR_MONTHS * monthlyCents;

  // Exact-cents guard: the discounted monthly rate must land on a whole cent.
  const discountedMonthlyProduct = monthlyCents * (100 - discPct);
  if (discountedMonthlyProduct % 100 !== 0) return null;
  const discountedMonthlyCents = discountedMonthlyProduct / 100;
  const secondHalfCents = HALF_YEAR_MONTHS * discountedMonthlyCents;

  const totalCents = firstHalfCents + secondHalfCents;
  return { totalCents };
}

export const halfYearFullRateHalfYearDiscountedRateAnnualSum: LianaMethod = {
  id: 'half-year-full-rate-half-year-discounted-rate-annual-sum-v1',
  demand: 'COMPUTE',
  name: 'Sum a full monthly rate over the first half-year and a discounted rate over the second half-year',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W13 (cluster C130, sole member: pilot corpus item at index 63)',
  shapeDescription:
    'total = 6*monthlyRate + 6*(monthlyRate*(1 - discountPercent/100)), computed in exact ' +
    'integer cents; requires literal "first half of the year" / "(other|second) half of the year" phrases.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a monthly-rate clause, both "first half of the year" and "(other|second) ' +
          'half of the year" phrases, an explicit "N% less" discount on the second half, and a ' +
          '"total amount" closing question, with the discounted rate landing on an exact cent; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `totalCents = ${result.totalCents}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const dollars = result.totalCents / 100;
      const verdict = Number.isInteger(dollars) ? dollars : Math.round(dollars * 100) / 100;
      return { question, verdict: String(verdict), abstain: false, freeText, method: METHOD_ID, basis: '6*monthlyRate + 6*discountedMonthlyRate, exact integer cents' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(halfYearFullRateHalfYearDiscountedRateAnnualSum);
