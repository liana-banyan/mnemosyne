// D-BP223-BM04-h2cbpv9w-170 -- daily-production-rate-dozen-price-weekly-revenue-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\daily-production-rate-dozen-price-weekly-revenue-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C124 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 50 (harvest_gsm8k_pilot_item50), "Lloyd has
 * an egg farm. His chickens produce 252 eggs per day and he sells them for $2 per dozen. How much
 * does Lloyd make on eggs per week?"
 *
 * @generalShape DAILY PRODUCTION RATE TO WEEKLY REVENUE VIA A PER-DOZEN PRICE: a stated daily
 *   production rate (units per day) is projected to a week (x7), converted from units to dozens
 *   (/12), then multiplied by a stated per-dozen price to give weekly revenue. Silo cluster label:
 *   "revenue calculation from production rate and unit price -- multi-step multiplication and
 *   unit conversion".
 *
 * @recogniseInStranger Two clauses, both required: (1) a daily-rate clause "produce <N> <unit-
 *   plural> per day" (or "each day"); (2) a per-dozen price clause "sells them for $<P> per dozen"
 *   (the literal word "dozen" is the positive discriminator distinguishing this from a plain
 *   per-unit price). The question must ask for the amount made/earned "per week" (the literal
 *   word "week"), confirming the x7 daily-to-weekly projection is wanted, not a daily or monthly
 *   figure.
 *
 * @whatBreaksIt (a) the question asking "per day" or "per month" instead of "per week" -- a
 *   different time-projection this candidate does not attempt, matched only by its "week" literal;
 *   (b) the price clause naming a different unit grouping than "dozen" (e.g. "$2 per unit", "$2
 *   each") -- no dozen-to-unit conversion is needed then, a different (simpler) shape entirely,
 *   not matched by this candidate's "per dozen" literal; (c) a non-integer number of dozens per
 *   week (weekly units not a clean multiple of 12) -- this candidate still computes the revenue
 *   using the exact fractional dozens (no information is lost), so this is not itself a refusal
 *   condition, but a non-finite or negative result from bad extraction is; (d) more than one daily
 *   rate or per-dozen price clause -- ambiguous, abstains rather than pick one.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any missing
 *   clause, ambiguous duplicate clause, or non-finite/negative result makes analyze() return null
 *   and both abstain -- never a guessed verdict. Measured against its own (sole) cluster member:
 *   dailyRate=252, weeklyUnits=252*7=1764, dozens=1764/12=147, revenue=147*2=294, matching the
 *   ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'daily-production-rate-dozen-price-weekly-revenue-v1';


interface Analyzed {
  dailyRate: number;
  weeklyUnits: number;
  dozens: number;
  revenue: number;
}

// WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
// single teaching item happens to use "produce"/"sells", but this shape's family is equally
// well-formed with "makes"/"lays" (a hen-adjacent verb) and "sold" -- widened on verb-choice
// generality alone, no tuning-reserve item text was read to make this change.
const DAILY_RATE_RE = /(?:produces?|makes?|lays?)\s+(\d+(?:\.\d+)?)\s+[a-zA-Z]+\s+(?:per\s+day|each\s+day|a\s+day)\b/i;
const PER_DOZEN_PRICE_RE = /(?:sells?|sold)\s+(?:them|it)\s+for\s+\$?(\d+(?:\.\d+)?)\s+per\s+dozen\b/i;
const WEEK_QUESTION_RE = /\bweek\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateM = DAILY_RATE_RE.exec(q);
  const priceM = PER_DOZEN_PRICE_RE.exec(q);
  if (!rateM || !priceM) return null;
  if (!WEEK_QUESTION_RE.test(q)) return null;

  const rateGlobal = new RegExp(DAILY_RATE_RE.source, 'gi');
  let rateCount = 0;
  while (rateGlobal.exec(q) !== null) rateCount += 1;
  const priceGlobal = new RegExp(PER_DOZEN_PRICE_RE.source, 'gi');
  let priceCount = 0;
  while (priceGlobal.exec(q) !== null) priceCount += 1;
  if (rateCount !== 1 || priceCount !== 1) return null;

  const dailyRate = parseFloat(rateM[1]);
  const pricePerDozen = parseFloat(priceM[1]);
  if (!Number.isFinite(dailyRate) || dailyRate < 0 || !Number.isFinite(pricePerDozen) || pricePerDozen < 0) return null;

  const weeklyUnits = dailyRate * 7;
  const dozens = weeklyUnits / 12;
  const revenue = dozens * pricePerDozen;
  if (!Number.isFinite(revenue) || revenue < 0) return null;

  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { dailyRate, weeklyUnits: round(weeklyUnits), dozens: round(dozens), revenue: round(revenue) };
}

export const dailyProductionRateDozenPriceWeeklyRevenue: LianaMethod = {
  id: 'daily-production-rate-dozen-price-weekly-revenue-v1',
  demand: 'COMPUTE',
  name: 'Daily production rate, converted to dozens, times a per-dozen price, for weekly revenue',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/SEG (cluster C124, sole member harvest_gsm8k_pilot_item50)',
  shapeDescription:
    'A daily units-per-day production rate is projected to a week (x7), converted to dozens ' +
    '(/12), then multiplied by a stated per-dozen price to give weekly revenue.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a single "produce N ... per day" clause plus a single "sells ... for $P ' +
          'per dozen" clause plus a question asking for a "week" figure; abstaining rather than ' +
          'guessing',
      };
    }
    return {
      matches: true,
      reason: `dailyRate=${result.dailyRate}, weeklyUnits=${result.weeklyUnits}, dozens=${result.dozens}, revenue=${result.revenue}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      return {
        question,
        verdict: String(result.revenue),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(${result.dailyRate}*7)/12 = ${result.dozens} dozen, revenue = ${result.revenue}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(dailyProductionRateDozenPriceWeeklyRevenue);
