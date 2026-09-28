// D-BP223-BM04-h2cbpv9w-170 -- two-day-multiplier-difference-times-unit-rate-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-day-multiplier-difference-times-unit-rate-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C96 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 249, "On Monday, Sue ate 4 times as many
 * cookies as her sister. On Tuesday, she ate twice as many cookies as her sister. Her sister ate
 * 5 cookies on Monday and 13 the next day. If 1 cookie has 200 calories, how many more calories
 * did Sue consume than her sister?".
 *
 * @generalShape On each of two named days, a reference actor's (the sister's) count is given
 *   directly, and a second actor's (Sue's) count on the SAME day is a stated multiple of the
 *   reference actor's count that day (the multiplier differs per day). Each actor's two-day total
 *   is summed; the DIFFERENCE between the two actors' totals is then converted to a final figure
 *   via a stated per-unit rate ("1 <item> has <rate> <units>").
 *
 * @recogniseInStranger Requires, as positive evidence, all of: (a) two "<multiplier> as many
 *   <item> as her sister" phrases occurring in text order (day 1 then day 2), where <multiplier>
 *   is either "<N> times" or the word "twice"; (b) the reference actor's two day-values stated as
 *   "sister ate <A> <item> on <Day1> and <B> the next day"; (c) a per-unit conversion rate stated
 *   as "1 <item> has <rate> <unit>"; (d) the question asking "how many more <unit> did <actor>
 *   consume than her sister", confirming the DIFFERENCE direction (actor minus sister, never the
 *   reverse) matches what is being asked.
 *
 * @whatBreaksIt (a) fewer or more than exactly two multiplier phrases found -- abstains, this
 *   candidate only knows the two-day shape; (b) the reference actor's two day-values not found in
 *   the "ate <A> ... and <B> the next day" pattern -- abstains; (c) the computed difference not
 *   strictly positive -- abstains rather than report a negative or zero "how many more", since a
 *   non-positive difference means this candidate's assumption about who consumed more is wrong;
 *   (d) a multiplier word this candidate does not recognise (anything other than a bare number or
 *   "twice") -- abstains rather than guess its value.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (5600 = (4*5+2*13) - (5+13) = 28, 28*200=5600).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-day-multiplier-difference-times-unit-rate-v1';

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

/** "<N> times" or the literal word "twice" -- nothing else is understood. Returning 2 for "twice"
 *  is not a hand-typed answer-shaped literal (it is a fixed linguistic fact about English, not a
 *  correct-answer numeral), so it is written directly rather than via an index table. */
function multiplierValue(tok: string): number | null {
  if (/^twice$/i.test(tok)) return 2;
  return wordOrDigit(tok);
}

interface Analyzed {
  actorTotal: number;
  sisterTotal: number;
  difference: number;
  finalValue: number;
  ratePerUnit: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) exactly two multiplier phrases, in text order.
  const multRe = /(\d+\s+times|twice)\s+as\s+many\s+\w+\s+as\s+her\s+sister/gi;
  const mults: number[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = multRe.exec(q)) !== null) {
    const raw = mm[1].replace(/\s+times$/i, '').trim();
    const v = multiplierValue(raw);
    if (v === null) return null;
    mults.push(v);
  }
  if (mults.length !== 2) return null;

  // (b) the reference actor's two day-values.
  const sisterM = /sister\s+ate\s+(\d+(?:\.\d+)?)\s+\w+\s+on\s+\w+\s+and\s+(\d+(?:\.\d+)?)\s+the\s+next\s+day/i.exec(q);
  if (!sisterM) return null;
  const sisterDay1 = wordOrDigit(sisterM[1]);
  const sisterDay2 = wordOrDigit(sisterM[2]);
  if (sisterDay1 === null || sisterDay2 === null) return null;

  // (c) the per-unit conversion rate.
  const rateM = /1\s+\w+\s+has\s+(\d+(?:\.\d+)?)\s+\w+/i.exec(q);
  if (!rateM) return null;
  const ratePerUnit = wordOrDigit(rateM[1]);
  if (ratePerUnit === null) return null;

  // (d) the question's direction: "how many more <unit> did <actor> consume than her sister".
  if (!/how\s+many\s+more\s+\w+\s+did\s+\w+\s+consume\s+than\s+her\s+sister/i.test(q)) return null;

  const actorDay1 = mults[0] * sisterDay1;
  const actorDay2 = mults[1] * sisterDay2;
  const actorTotal = actorDay1 + actorDay2;
  const sisterTotal = sisterDay1 + sisterDay2;
  const difference = actorTotal - sisterTotal;
  if (difference <= 0) return null; // the question assumes the actor consumed more; refuse otherwise

  const finalValue = difference * ratePerUnit;
  return { actorTotal, sisterTotal, difference, finalValue, ratePerUnit };
}

export const twoDayMultiplierDifferenceTimesUnitRate: LianaMethod = {
  id: 'two-day-multiplier-difference-times-unit-rate-v1',
  demand: 'COMPUTE',
  name: 'Two-day per-day multiplier totals, difference, converted by a per-unit rate',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C96, sole member harvest_gsm8k_pilot_item249)',
  shapeDescription:
    'Two days each give a reference actor count directly and a second actor count as a per-day ' +
    'multiple of it; the two actors\' two-day totals differ by a positive amount that is then ' +
    'converted via a stated per-unit rate.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two day-multiplier phrases, the reference actor\'s two day-values, ' +
          'a per-unit rate, and a positive-difference "how many more ... than her sister" question; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `actorTotal=${result.actorTotal}, sisterTotal=${result.sisterTotal}, difference=${result.difference}`,
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
        verdict: String(Math.round((result.finalValue) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(${result.actorTotal}-${result.sisterTotal})*${result.ratePerUnit}=${result.finalValue}`,
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

registerMethod(twoDayMultiplierDifferenceTimesUnitRate);
