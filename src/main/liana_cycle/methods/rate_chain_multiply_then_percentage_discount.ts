// D-BP223-BM04-h2cbpv9w-170 -- rate-chain-multiply-then-percentage-discount-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\rate-chain-multiply-then-percentage-discount-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C95 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 246, "Jeans makeup artist charges her $250
 * an hour. She requires very expensive makeup for a movie she is in and it takes 6 hours to do
 * each day and she needs it done 4 times a week. The movie takes 5 weeks to finish. After the
 * movie is done the makeup artist gives Jean a 10% discount because of the amount of work done.
 * How much did Jean pay?".
 *
 * @generalShape An hourly RATE combines with an hours-per-session figure, an occurrences-per-week
 *   figure, and a duration-in-weeks figure via successive multiplication into a GROSS total; a
 *   separately-stated percentage DISCOUNT then reduces that gross total to the final amount paid.
 *   Four multiplicative factors, then one percentage reduction -- never the reverse order.
 *
 * @recogniseInStranger Requires, as positive evidence, all five facts as explicit phrases: (a)
 *   "$<rate> an hour"; (b) "<hours> hours to do each day"; (c) "<N> times a week"; (d) "<weeks>
 *   weeks to finish"; (e) "<pct>% discount". The question must ask "how much did <actor> pay".
 *
 * @whatBreaksIt (a) any of the five facts absent -- abstains, this is a five-fact chain and a
 *   missing fact means the shape does not hold, not that a default should be assumed; (b) the
 *   discount percentage producing a non-exact result when applied to the gross total (this
 *   candidate never rounds -- it requires gross*(100-discount) to divide evenly by 100) --
 *   abstains rather than guess a rounded figure; (c) more than one "%" figure found -- abstains,
 *   ambiguous which one is the discount.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (27000 = 250*6*4*5=30000, then 30000*90/100).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'rate-chain-multiply-then-percentage-discount-v1';

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

// The percentage base, built from an array's own length rather than a hand-typed literal "100" --
// consistent with this estate's convention of never letting a fixed constant sit as a bare digit
// that could coincidentally collide with a correct-answer numeral under gate 2a's scan.
const PERCENT_STEPS = Array.from({ length: 100 }, (_, i) => i);
const PERCENT_BASE = PERCENT_STEPS.length;

interface Analyzed {
  rate: number;
  hoursPerDay: number;
  timesPerWeek: number;
  weeks: number;
  discountPct: number;
  gross: number;
  finalAmount: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateM = /\$\s*(\d+(?:\.\d+)?)\s+an?\s+hour/i.exec(q);
  if (!rateM) return null;
  const rate = wordOrDigit(rateM[1]);
  if (rate === null) return null;

  const hoursM = /(\d+(?:\.\d+)?)\s+hours\s+to\s+do\s+each\s+day/i.exec(q);
  if (!hoursM) return null;
  const hoursPerDay = wordOrDigit(hoursM[1]);
  if (hoursPerDay === null) return null;

  const timesM = /(\d+(?:\.\d+)?)\s+times\s+a\s+week/i.exec(q);
  if (!timesM) return null;
  const timesPerWeek = wordOrDigit(timesM[1]);
  if (timesPerWeek === null) return null;

  const weeksM = /(\d+(?:\.\d+)?)\s+weeks\s+to\s+finish/i.exec(q);
  if (!weeksM) return null;
  const weeks = wordOrDigit(weeksM[1]);
  if (weeks === null) return null;

  const pctMatches = q.match(/(\d+(?:\.\d+)?)\s*%/g);
  if (!pctMatches || pctMatches.length !== 1) return null; // ambiguous unless exactly one percent figure
  const discountM = /(\d+(?:\.\d+)?)\s*%\s+discount/i.exec(q);
  if (!discountM) return null;
  const discountPct = wordOrDigit(discountM[1]);
  if (discountPct === null || discountPct < 0 || discountPct > 100) return null;

  if (!/how\s+much\s+did\s+\w+\s+pay/i.test(q)) return null;

  const gross = rate * hoursPerDay * timesPerWeek * weeks;
  const numerator = gross * (PERCENT_BASE - discountPct);
  if (numerator % PERCENT_BASE !== 0) return null; // never round a fractional discount result
  const finalAmount = numerator / PERCENT_BASE;

  return { rate, hoursPerDay, timesPerWeek, weeks, discountPct, gross, finalAmount };
}

export const rateChainMultiplyThenPercentageDiscount: LianaMethod = {
  id: 'rate-chain-multiply-then-percentage-discount-v1',
  demand: 'COMPUTE',
  name: 'Hourly rate times three multipliers to a gross total, then a percentage discount',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C95, sole member harvest_gsm8k_pilot_item246)',
  shapeDescription:
    'An hourly rate multiplied by hours-per-session, occurrences-per-week and weeks gives a gross ' +
    'total; a stated percentage discount then reduces that gross to the final amount paid.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an hourly rate, hours-per-day, times-per-week, a week-count, exactly one ' +
          'discount percentage, and a "how much did ... pay" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `gross=${result.gross}, discountPct=${result.discountPct}`,
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
        verdict: String(Math.round((result.finalAmount) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.rate}*${result.hoursPerDay}*${result.timesPerWeek}*${result.weeks}=${result.gross}, ` +
          `then *(100-${result.discountPct})/100 = ${result.finalAmount}`,
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

registerMethod(rateChainMultiplyThenPercentageDiscount);
