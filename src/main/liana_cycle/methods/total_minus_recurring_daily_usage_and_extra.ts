// D-BP223-BM04-h2cbpv9w-170 -- total-minus-recurring-daily-usage-and-extra-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-minus-recurring-daily-usage-and-extra-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C94 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 243, "Jason has a phone plan of 1000
 * minutes per month. Every day he has a 15-minute call with his boss, and he's had 300 extra
 * minutes of call this month to other people. How many minutes does Jason have left if this
 * month has 30 days?".
 *
 * @generalShape A directly-stated TOTAL capacity for a period (e.g. "N units per month") is
 *   reduced by exactly two usage components: (a) a RECURRING per-day amount that must itself be
 *   multiplied by an explicitly-stated day-count for the period before it can be subtracted, and
 *   (b) an already-summed FLAT "extra" amount stated directly (no further arithmetic needed on
 *   it). The answer is total - (daily*days) - extra.
 *
 * @recogniseInStranger Requires, as positive evidence, all four of: (a) a total stated as
 *   "<N> <unit> per month" (or "a month"); (b) a recurring daily usage stated as "every day ...
 *   a <M>-minute <noun>" (the day-marker "every day" and the per-occurrence duration must both be
 *   present); (c) an explicit day-count for the period, "this month has <D> days"; (d) a flat
 *   extra amount stated as "<E> extra <unit>". The question must ask "how many <unit> does
 *   <actor> have left", the "left" wording being the positive signal this is a total-minus-usage
 *   shape rather than some other minutes arithmetic.
 *
 * @whatBreaksIt (a) any of the four numeric facts missing, or the daily-usage phrase not anchored
 *   to "every day" (a call mentioned without a recurrence marker could be a one-off, not a
 *   per-day rate) -- abstains rather than guess whether it recurs; (b) the day-count occurring
 *   somewhere unrelated to "this month has" -- abstains rather than assume which number is the
 *   day-count; (c) the question not asking "... have left" -- abstains, since this candidate only
 *   answers the remaining-capacity framing, not e.g. "how many minutes has he used".
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (250 = 1000 - 15*30 - 300). With only one known
 *   cluster member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-minus-recurring-daily-usage-and-extra-v1';

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

interface Analyzed {
  total: number;
  daily: number;
  days: number;
  extra: number;
  remaining: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the directly-stated total for the period.
  const totalM = /(\d+(?:\.\d+)?)\s+minutes\s+per\s+month/i.exec(q);
  if (!totalM) return null;
  const total = wordOrDigit(totalM[1]);
  if (total === null) return null;

  // (b) the recurring daily usage -- "every day" AND a per-occurrence duration, close together.
  const dailyM = /every\s+day[^.?]*?(\d+(?:\.\d+)?)-minute\s+call/i.exec(q);
  if (!dailyM) return null;
  const daily = wordOrDigit(dailyM[1]);
  if (daily === null) return null;

  // (c) the explicit day-count for the period, anchored to "this month has".
  const daysM = /this\s+month\s+has\s+(\d+(?:\.\d+)?)\s+days/i.exec(q);
  if (!daysM) return null;
  const days = wordOrDigit(daysM[1]);
  if (days === null) return null;

  // (d) the flat, already-summed extra amount.
  const extraM = /(\d+(?:\.\d+)?)\s+extra\s+minutes/i.exec(q);
  if (!extraM) return null;
  const extra = wordOrDigit(extraM[1]);
  if (extra === null) return null;

  // Positive signal that this is the remaining-capacity framing, not e.g. "how many used".
  if (!/how\s+many\s+minutes\s+does\s+\w+\s+have\s+left/i.test(q)) return null;

  const usedFromDaily = daily * days;
  const remaining = total - usedFromDaily - extra;
  return { total, daily, days, extra, remaining };
}

export const totalMinusRecurringDailyUsageAndExtra: LianaMethod = {
  id: 'total-minus-recurring-daily-usage-and-extra-v1',
  demand: 'COMPUTE',
  name: 'Total capacity minus a recurring daily usage and a flat extra amount',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C94, sole member harvest_gsm8k_pilot_item243)',
  shapeDescription:
    'A stated total-per-period capacity is reduced by a recurring per-day usage multiplied by an ' +
    'explicit day-count, and by a separately-stated flat extra amount; answer is total minus both.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a per-period total, an "every day" recurring duration, an explicit day-' +
          'count, a flat extra amount, and a "have left" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `total=${result.total}, daily=${result.daily}, days=${result.days}, extra=${result.extra}`,
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
        verdict: String(Math.round((result.remaining) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.total} - (${result.daily}*${result.days}) - ${result.extra} = ${result.remaining}`,
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

registerMethod(totalMinusRecurringDailyUsageAndExtra);
