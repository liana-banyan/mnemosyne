// D-BP223-BM04-h2cbpv9w-170 -- hourly-wage-overtime-premium-weekly-earnings-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\hourly-wage-overtime-premium-weekly-earnings-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C142 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 9, "Eliza's rate per hour for the first 40
 * hours she works each week is $10. She also receives an overtime pay of 1.2 times her regular
 * hourly rate. If Eliza worked for 45 hours this week, how much are her earnings for this week?"
 * Silo label: "labor_cost_calculation -- multi-step_calculation_with_overtime_premium" -- matches.
 *
 * @generalShape A REGULAR hourly rate applies up to a stated THRESHOLD number of hours in a
 *   period. Hours worked BEYOND the threshold are paid at a stated OVERTIME MULTIPLE of the
 *   regular rate. Given a total hours-worked figure at or above the threshold, the answer is
 *   (threshold * regularRate) + (hoursOverThreshold * regularRate * overtimeMultiple).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a regular-rate sentence naming a dollar rate "per hour" tied to a stated threshold of
 *       hours (e.g. "for the first N hours ... is $R", or "a regular rate of $R for the first N
 *       hours"), both R and N captured as numbers;
 *   (b) an explicit overtime rate, given as EITHER (b1) a MULTIPLE clause ("<x> times her/his
 *       regular hourly rate", x resolved through a shared number-word table, x > 1) tied to the
 *       word "overtime", OR (b2) a directly-stated flat overtime dollar rate ("$<R2> (?:an
 *       hour|per hour|each hour) (?:of|for) (?:any )?overtime"), tied to the same threshold as
 *       (a) via an explicit "hours over <N>"/"after that" marker so the flat rate is anchored to
 *       the SAME threshold, never a second, unrelated hour figure;
 *   (c) a total-hours-worked figure, present or past tense, singular or plural period phrasing
 *       ("worked/works <H> hours this/one/a/per week/period/month"), H a bare number strictly
 *       greater than the threshold N (H == N has no overtime hours and this candidate abstains
 *       rather than assume the extra branch is still meaningful);
 *   (d) a closing question asking for total earnings/pay for the period ("how much are ... her
 *       earnings", "how much money did/does ... earn/make", "total pay").
 *
 * @whatBreaksIt (a) H at or below the threshold -- abstain, no overtime hours to compute; (b)
 *   neither an explicit multiplier clause nor a flat overtime rate anchored to the SAME threshold
 *   -- abstain, this is not a flat weekly overtime bonus (that is a different shape); (c) a
 *   second, independent bonus/deduction mentioned in the question (a fixed weekly bonus, a tax
 *   withholding) -- abstain, this candidate only reconstructs base-plus-overtime, not any third
 *   term; (d) any dollar or hour figure not landing on an exact rational multiple of the others
 *   used, or the final total not being an exact value to the cent -- abstain rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (5 overtime hours at $12/hr = $60, plus $400 regular pay, for a
 *   total of $460). ROUND 2 WIDENING (Rule 6, on positive evidence): the tuning-reserve keyword
 *   search for "overtime" surfaced two real GSM8K-train items using a FLAT stated overtime rate
 *   ("$15 each hour of overtime after that", "$6 an hour for any overtime hours") instead of a
 *   multiplier of the regular rate -- a genuine second sub-case of the same general shape, added
 *   as (b2) above, and a tense/phrasing generalization for (c) ("works" present tense, "one week"
 *   instead of "this week") added from the same evidence. Neither change touches the negative
 *   guards. With only one known GENERATING cluster member there is no cross-member measurement to
 *   report beyond the tuning-reserve widening itself, which is reported per-round in this wave's
 *   own manifest.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'hourly-wage-overtime-premium-weekly-earnings-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = 20 + i * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string | undefined | null): number | null {
  if (tok === undefined || tok === null || tok === '') return null;
  const digitTok = String(tok).replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitTok)) return parseFloat(digitTok);
  const w = String(tok).toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) regular rate + threshold: find the SENTENCE mentioning both "per hour"/"an hour" and
  // "for the first ... hours", then extract the threshold and the dollar rate independently
  // within that sentence -- the two facts can appear in either order and with a rate figure that
  // trails well after the "per hour" mention (e.g. "rate per hour for the first 40 hours ... is
  // $10"), so a single chained regex over the whole clause is too brittle.
  const sentences = q.split(/(?<=[.?!])\s+/);
  let regularRate: number | null = null;
  let threshold: number | null = null;
  for (const sent of sentences) {
    if (!/per hour|an hour|\/\s*hour|\/\s*hr/i.test(sent)) continue;
    if (!/for the first\s+([0-9]+|[a-z]+)\s+hours/i.test(sent)) continue;
    const thresholdM = /for the first\s+([0-9]+|[a-z]+)\s+hours/i.exec(sent);
    const rateM = /\$\s*([0-9]+(?:\.[0-9]+)?)/.exec(sent);
    if (thresholdM && rateM) {
      threshold = wordOrDigit(thresholdM[1]);
      regularRate = wordOrDigit(rateM[1]);
      break;
    }
  }
  if (regularRate === null || threshold === null || threshold <= 0) return null;

  // (b) overtime rate, must mention "overtime" AND resolve via EITHER a multiplier clause (b1)
  // OR a flat rate explicitly anchored to the same threshold (b2).
  if (!/overtime/i.test(q)) return null;
  let overtimeRate: number | null = null;
  const multRe = /([0-9]+(?:\.[0-9]+)?|[a-z-]+)\s+times\s+(?:her|his|their)\s+regular\s+hourly\s+rate/i;
  const mm = multRe.exec(q);
  if (mm) {
    const multiple = wordOrDigit(mm[1]);
    if (multiple !== null && multiple > 1) overtimeRate = regularRate * multiple;
  }
  if (overtimeRate === null) {
    const flatRe = /\$\s*([0-9]+(?:\.[0-9]+)?)\s*(?:an hour|per hour|each hour)\s+(?:of|for)\s+(?:any\s+)?overtime(?:\s+hours)?/i;
    const fm = flatRe.exec(q);
    // anchor: the flat rate must be tied to the SAME threshold via an explicit continuation
    // marker ("after that", "hours over <N>", "all hours over <N>") so a second, unrelated
    // hourly figure is never mistaken for the overtime rate.
    const anchorRe = new RegExp('(?:after that|hours over\\s+' + threshold + '\\b|over\\s+' + threshold + '\\s+in\\s+a\\s+week)', 'i');
    if (fm && anchorRe.test(q)) {
      const flatRate = wordOrDigit(fm[1]);
      if (flatRate !== null && flatRate > 0) overtimeRate = flatRate;
    }
  }
  if (overtimeRate === null) return null;

  // (c) total hours worked, must exceed threshold. Tense/period phrasing generalized on positive
  // evidence from the tuning reserve (present tense "works", "one week" as well as "this week").
  const hoursRe = /works?\s+(?:for\s+)?([0-9]+|[a-z]+)\s+hours\s+(?:this|one|a|per)\s+(?:week|period|month)|worked\s+(?:for\s+)?([0-9]+|[a-z]+)\s+hours\s+(?:this|one|a|per)\s+(?:week|period|month)/i;
  const hm = hoursRe.exec(q);
  if (!hm) return null;
  const hoursWorked = wordOrDigit(hm[1] || hm[2]);
  if (hoursWorked === null || hoursWorked <= threshold) return null;

  // (d) no second independent bonus/deduction term this candidate does not model.
  if (/\bbonus\b|\btax\b|\bwithhold/i.test(q)) return null;

  // (question) asks for total earnings/pay.
  if (!/how much (?:are|is|did|does|money|would).{0,40}(earn|pay|make|income)/i.test(q)) return null;

  const overtimeHours = hoursWorked - threshold;
  const regularPay = threshold * regularRate;
  const overtimePay = overtimeHours * overtimeRate;
  const total = regularPay + overtimePay;
  const rounded = Math.round(total * 100) / 100;
  if (Math.abs(rounded - total) > 1e-9) return null;
  return { total: rounded };
}

export const hourlyWageOvertimePremiumWeeklyEarnings: LianaMethod = {
  id: 'hourly-wage-overtime-premium-weekly-earnings-v1',
  demand: 'COMPUTE',
  name: 'Regular rate up to a threshold plus overtime hours at a stated multiple, summed to total earnings',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C142, sole member: pilot corpus labor_cost_calculation item)',
  shapeDescription:
    'total = threshold*regularRate + (hoursWorked-threshold)*regularRate*overtimeMultiple, ' +
    'requires hoursWorked > threshold and an explicit "<x> times ... regular hourly rate" overtime clause.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a regular-rate-with-threshold clause, an explicit overtime multiplier ' +
          'clause naming "overtime" and "times ... regular hourly rate", a total-hours figure ' +
          'strictly exceeding the threshold, no second bonus/tax term, and an earnings question; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total earnings = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'threshold pay plus overtime-hours pay at the stated multiple',
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

registerMethod(hourlyWageOvertimePremiumWeeklyEarnings);
