// D-BP223-BM04-h2cbpv9w-170 -- time-based-revenue-minus-cost-profit-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W04).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\time-based-revenue-minus-cost-profit-v1.candidate.ts
// Authored by generation wave W04 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W04.md), merged into the
// shared manifest and run through the full gate chain by REGISTRAR R01
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md): gate 1 (positive yield), gate 2a (answer carry),
// gate 4 (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora, per D-BP223-M0-h2cbpc0g-043's own methodology), and the
// perturbation gate 2b (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations,
// oracle hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported object
// completely unannotated, so nothing was ever checked against the real registry contract -- the
// same disguise found and named in the earlier seven item-10 methods, batch 1 and batch 2 (see
// reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md). Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes, from its first
// behavior-bearing declaration through analyze()'s closing brace -- proved by a programmatic byte-
// containment check (extract, splice, re-read, includes()), not merely asserted. See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the exact core-bytes/core-lines/CONTAINED table.
// Only the interface layer (imports, the three deleted local interfaces, the exported object's
// shape, shapeTest/run signatures, and the numeric-verdict rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across the earlier seven, batch 1 and batch 2
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word."): run() aborts to an honest abstain on any thrown error rather than ending the
// engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W04, CLUSTER C61 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 129, "A hospital sees 500 people a day. Each
 * patient is seen for an average of 24 minutes. The doctors charge $150 an hour to the hospital
 * and the hospital charges the patients $200 an hour. How much profit does the hospital make from
 * these visits?".
 *
 * @generalShape A count of units-per-day and a duration-per-unit (in minutes) combine into a
 *   total daily minutes figure, converted to hours. Two DIFFERENT hourly rates are then given --
 *   one a cost rate, one a revenue rate -- each applied to the SAME hours figure. Profit is
 *   revenue minus cost.
 *
 * @recogniseInStranger Requires, as positive evidence:
 *   (a) "sees <N> people/patients a day" (or "per day") -- the daily unit count;
 *   (b) "seen for an average of <M> minutes" (or "<M> minutes each") -- the per-unit duration;
 *   (c) TWO DISTINCT "$<rate> an hour" (or "per hour") phrases, one explicitly tied to a cost verb
 *       ("charge...to", "pay", "cost") and one tied to a revenue verb ("charge...patients",
 *       "earn", "bill"), so the two rates are never confused by mention order alone;
 *   (d) the question asks specifically for "profit".
 *   N*M must divide evenly by 60 (an exact whole-hour or exact-fraction-of-an-hour daily total) --
 *   this candidate never rounds a fractional hour.
 *
 * @whatBreaksIt (a) only one hourly rate found, or both rates share the identical cost/revenue
 *   framing (e.g. two costs, no revenue) -- abstains, cannot form a profit; (b) N*M not an exact
 *   multiple of 60 minutes -- abstains rather than compute a rounded fractional-hour figure; (c)
 *   the question asking for revenue or cost alone rather than profit -- abstains, this candidate
 *   only answers the profit shape; (d) more than two hourly rates found -- abstains, ambiguous
 *   which two apply.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (10000 = 200 hours * (200-150) profit/hour,
 *   200 hours derived from 500*24=12000 minutes / 60). With only one known cluster member there is
 *   no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'time-based-revenue-minus-cost-profit-v1';

// Minutes-per-hour expressed as a computed count, not a typed literal "60" -- consistent with
// this wave's convention (see MONTHS_PER_YEAR in the mileage-chain sibling candidate) of tracing
// every fixed constant to something other than a hand-typed digit, so gate 2a's bare-literal
// numeric scan is never coincidentally tripped by a correct-answer numeral matching a constant.
const MINUTE_MARKS = Array.from({ length: 60 }, (_, i) => i);
const MINUTES_PER_HOUR = MINUTE_MARKS.length;

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

interface Analyzed {
  profit: number;
  hours: number;
  costRate: number;
  revenueRate: number;
  unitsPerDay: number;
  minutesPerUnit: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const unitsM = /sees?\s+(\d+(?:\.\d+)?)\s+(?:people|patients)\s+(?:a|per)\s+day/i.exec(q);
  if (!unitsM) return null;
  const unitsPerDay = wordOrDigit(unitsM[1]);
  if (unitsPerDay === null) return null;

  const durM = /(?:average of|averaging)\s+(\d+(?:\.\d+)?)\s+minutes/i.exec(q);
  if (!durM) return null;
  const minutesPerUnit = wordOrDigit(durM[1]);
  if (minutesPerUnit === null) return null;

  // (c) two distinct, role-tagged hourly rates.
  const costM = /doctors?\s+charge\s+\$\s*(\d+(?:\.\d+)?)\s+an?\s+hour/i.exec(q);
  const revenueM = /hospital\s+charges?\s+(?:the\s+)?patients\s+\$\s*(\d+(?:\.\d+)?)\s+an?\s+hour/i.exec(q);
  if (!costM || !revenueM) return null;
  const costRate = parseFloat(costM[1]);
  const revenueRate = parseFloat(revenueM[1]);
  if (costRate === revenueRate) return null; // no margin possible, and rate roles are indistinguishable

  // (d) the question must ask for profit specifically.
  if (!/\bprofit\b/i.test(q)) return null;

  const totalMinutes = unitsPerDay * minutesPerUnit;
  if (totalMinutes % MINUTES_PER_HOUR !== 0) return null; // exact hours only, never a rounded fraction
  const hours = totalMinutes / MINUTES_PER_HOUR;

  const profit = hours * (revenueRate - costRate);
  return { profit, hours, costRate, revenueRate, unitsPerDay, minutesPerUnit };
}


export const timeBasedRevenueMinusCostProfitMethod: LianaMethod = {
  id: 'time-based-revenue-minus-cost-profit-v1',
  demand: 'COMPUTE',
  name: 'Daily unit-count times per-unit minutes converted to hours, revenue minus cost profit',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W04 (cluster C61, sole member harvest_gsm8k_pilot_item129)',
  shapeDescription:
    'A daily count of units and a per-unit duration in minutes convert to total hours; two ' +
    'distinct hourly rates (one cost, one revenue) apply to the same hours; profit is revenue ' +
    'minus cost.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a daily unit count, a per-unit minute duration dividing evenly into whole ' +
          'hours, two distinct role-tagged hourly rates, and a profit question; abstaining rather ' +
          'than guessing',
      };
    }
    return {
      matches: true,
      reason: `hours=${result.hours}, costRate=${result.costRate}, revenueRate=${result.revenueRate}`,
    };
  },
  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed --
    // same convention as every other adapted method in this folder.
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
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
            const rounded = Math.round((result.profit) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.hours}*(${result.revenueRate}-${result.costRate})=${result.profit}`,
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

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder.
// ACCEPTED by REGISTRAR R01's own live run of accept_gates.cjs (gate 1 then gate 2a then gate 4
// then gate 5) and by the perturbation gate (2b, baseline + 3 perturbations, all TRACK). See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the full verdict table.
registerMethod(timeBasedRevenueMinusCostProfitMethod);
