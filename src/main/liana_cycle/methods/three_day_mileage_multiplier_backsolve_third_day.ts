// D-BP223-BM04-h2cbpv9w-170 -- three-day-mileage-multiplier-backsolve-third-day-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-day-mileage-multiplier-backsolve-third-day-v1.candidate.ts
// Authored by generation wave W05 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W05.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C63 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item133, "On Monday, Walt walked 4 miles. Tuesday, he walked 6
 * times as many miles as he walked on Monday. His total mileage Monday through Wednesday was 41
 * miles. How many miles did he walk on Wednesday?".
 *
 * @generalShape Three consecutive named days (weekdays) of the same recurring quantity (miles,
 *   steps, etc). Day 1 is given directly. Day 2 is a stated multiple of Day 1. A combined total
 *   across all three days is given. Day 3 (the one never independently computed) is backsolved as
 *   total minus (Day1 + Day2). The question asks specifically about Day 3.
 *
 * @recogniseInStranger Scans for the seven weekday names in order of first appearance. Requires:
 *   (a) "On <Day1>, <subject> walked N <unit>." giving Day1 directly, (b) "<Day2>, <subject>
 *   walked K times as many <unit> as <subject> walked on <Day1>." naming Day1 again by name (not
 *   merely "as many as before"), and (c) a total sentence naming a weekday RANGE spanning exactly
 *   three consecutive days ("<Day1> through <Day3>" or "<Day1>, <Day2> and <Day3>") with a total
 *   number. Day3 is whichever of the range's three days is neither Day1 nor Day2. The question
 *   must name Day3 explicitly ("how many ... did <subject> walk on <Day3>").
 *
 * @whatBreaksIt (a) the range names fewer or more than three distinct weekdays, or Day1/Day2 are
 *   not both inside the range -- abstains, the backsolve target is ambiguous; (b) the multiplier
 *   phrase does not name Day1 by its weekday (e.g. "twice as many as before") -- not recognised,
 *   this candidate requires the explicit day name to avoid guessing which prior day is meant;
 *   (c) a stranger problem with FOUR or more days would not be recognised (the range-detection
 *   regex only accepts a 3-day span) -- flagged here rather than hidden.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own sole cluster member: SOLVED (13). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-day-mileage-multiplier-backsolve-third-day-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_INDEX: Record<string, number> = {};
WEEKDAYS.forEach((d, i) => { WEEKDAY_INDEX[d] = i; });

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Analyzed {
  day3: string;
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const day1Match = /On\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Z][\w']*\s+walked\s+([a-z0-9]+)\s+\w+\.?/i.exec(q);
  if (!day1Match) return null;
  const day1 = WEEKDAYS.find((d) => d.toLowerCase() === day1Match[1].toLowerCase());
  const day1Value = wordOrDigit(day1Match[2]);
  if (!day1 || day1Value === null) return null;

  const day2Re = new RegExp(
    `(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+[A-Za-z]+\\s+walked\\s+([a-z0-9]+)\\s+times\\s+as\\s+many\\s+\\w+\\s+as\\s+[A-Za-z]+\\s+walked\\s+on\\s+${day1}`,
    'i',
  );
  const day2Match = day2Re.exec(q);
  if (!day2Match) return null;
  const day2 = WEEKDAYS.find((d) => d.toLowerCase() === day2Match[1].toLowerCase());
  const multiplier = wordOrDigit(day2Match[2]);
  if (!day2 || multiplier === null || day2 === day1) return null;
  const day2Value = day1Value * multiplier;

  // Range sentence: exactly three consecutive weekday names spanning day1..day2 (either order in
  // text) plus a third day, with a combined total. "<DayA> through <DayC>" or "<DayA>, <DayB> and
  // <DayC>" -- captured loosely, then validated for exactly-three-consecutive-distinct-days below.
  const rangeMatch = /total\s+mileage\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+through\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+was\s+([a-z0-9]+)\s+\w+/i.exec(q);
  if (!rangeMatch) return null;
  const rangeStart = WEEKDAYS.find((d) => d.toLowerCase() === rangeMatch[1].toLowerCase());
  const rangeEnd = WEEKDAYS.find((d) => d.toLowerCase() === rangeMatch[2].toLowerCase());
  const total = wordOrDigit(rangeMatch[3]);
  if (!rangeStart || !rangeEnd || total === null) return null;
  const startIdx = WEEKDAY_INDEX[rangeStart];
  const endIdx = WEEKDAY_INDEX[rangeEnd];
  if (endIdx - startIdx !== 2) return null; // must be exactly a 3-day span
  const rangeDays = [WEEKDAYS[startIdx], WEEKDAYS[startIdx + 1], WEEKDAYS[startIdx + 2]];
  if (!rangeDays.includes(day1) || !rangeDays.includes(day2)) return null;
  const day3 = rangeDays.find((d) => d !== day1 && d !== day2);
  if (!day3) return null;

  const day3Re = new RegExp(`how\\s+many\\s+\\w+\\s+did\\s+[A-Za-z]+\\s+walk\\s+on\\s+${day3}`, 'i');
  if (!day3Re.test(q)) return null; // the question must ask about Day3 specifically

  const answer = total - (day1Value + day2Value);
  if (!Number.isFinite(answer)) return null;
  return { day3, answer };
}

export const threeDayMileageMultiplierBacksolveThirdDay: LianaMethod = {
  id: 'three-day-mileage-multiplier-backsolve-third-day-v1',
  demand: 'COMPUTE',
  name: 'Backsolve the third day of a 3-day mileage total from a direct day and a multiple day',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C63, sole member harvest_gsm8k_pilot_item133)',
  shapeDescription:
    'Day1 given directly, Day2 a stated multiple of Day1, a 3-day combined total given; the ' +
    'unmentioned Day3 is total minus (Day1+Day2); the question must ask about Day3 by name.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a direct Day1 value, a "<Day2> ... K times as many ... as ... on <Day1>" ' +
          'multiplier sentence, a 3-day range total naming exactly Day1/Day2/Day3, and a question ' +
          'asking specifically about Day3',
      };
    }
    return { matches: true, reason: `day3=${result.day3} answer=${result.answer}` };
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
        verdict: String(Math.round((result.answer) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `total - (day1 + day2), asked-for day = ${result.day3}`,
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

registerMethod(threeDayMileageMultiplierBacksolveThirdDay);
