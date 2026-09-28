// D-BP223-BM04-h2cbpv9w-170 -- convert-add-convert-mixed-unit-time-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, STAGED (not yet
// installed under mnemosyne/src -- see INSTALL_WHEN_CLAIM_CLEARS.md in this same directory).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\convert-add-convert-mixed-unit-time-sum-v1.candidate.ts
// Promoted through gate 1, gate 2a, gate 4 in
//   BISHOP_DROPZONE\D-BP223-M0-h2cbpoxk-035_PROMOTION_BATCH_2_ASDIV_CLUSTERS.md
// and re-verified CONFIDENT-WRONG-free on the real ASDiv-150 + GSM8K-1319 corpora by gate 5
// (sibling interception) in
//   BISHOP_DROPZONE\D-BP223-M0-h2cbpc0g-043_GATE_5_SIBLING_INTERCEPTION.md
// Final combined verdict, this dispatch's own live re-run of accept_gates.cjs (gate 1 then 2a
// then 4 then 5), same moment this file was generated: ACCEPT.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported
// object completely unannotated, so nothing was ever checked against the real registry
// contract -- the same disguise found and named in the earlier seven item-10 methods and in
// batch 1 (see reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md and
// D-BP223-M0-h2cbp8h8-018_BATCH_1_REGISTERED_QUARANTINED.md). Those three local interfaces are
// DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from '../method_registry'
// and the exported object is annotated against the real `LianaMethod` type, per the estate's
// standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes, from its first
// behavior-bearing declaration (`const ONES_WORDS`) through analyze()'s closing brace -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not merely
// asserted. See this dispatch's own return doc (D-BP223-BM04-h2cbpv9w-170_BATCH2_STAGED.md) for
// the exact core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three
// deleted local interfaces, the exported object's shape, shapeTest/run signatures) is new text.
//
// TRY/CATCH ADDED, matching the Founder-approved pass across the earlier seven and batch 1
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word."): run() aborts to an honest abstain on any thrown error rather than ending
// the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods()
// will never choose it once installed. Registering changes NO live run; it makes the method
// visible to listMethods() and measurable. Un-quarantining is a separate, later Founder decision
// made per batch after held-out measurement, not this dispatch's.
//
// NOT YET INSTALLED. X001 (session 1d598c24) holds a scoped claim on
// mnemosyne/src/main/liana_cycle/methods and mnemosyne/scripts as of this dispatch. This file is
// staged here, at its exact eventual target filename and contents, so installation is a
// mechanical copy once that claim clears -- see INSTALL_WHEN_CLAIM_CLEARS.md.

/**
 * D-BP223-BM0-079/BATCH-2 CLUSTER C146 (1 silo member, high confidence, singleton). Representative
 * teaching case: ASDiv item149, "Mrs. Hilt spent 1 hour and 30 minutes shoveling snow on Saturday
 * morning and 45 minutes shoveling snow on Saturday afternoon. How much total time did she spend
 * shoveling snow?".
 *
 * @generalShape Two or more durations are given in a MIX of hours and minutes; every hour count is
 *   converted to minutes (x60) and every minute count is taken as-is, then all are summed into one
 *   total expressed in minutes. A convert-add-convert sandwich (per this silo's own note, distinct
 *   from C20's RATE_TIMES_TIME_WITH_UNIT_CONVERSION, which wraps a MULTIPLY rather than an ADD).
 *
 * @recogniseInStranger Scans the whole text for every "<N> hour(s)" occurrence (digit or number
 *   word) and every "<M> minute(s)" occurrence, converts hours to minutes and sums everything.
 *   Requires at least one such match to fire at all.
 *
 * @whatBreaksIt (a) no hour or minute unit word anywhere -- abstains, nothing to convert or sum;
 *   (b) a duration given in a unit this method does not know (days, seconds) -- those tokens are
 *   simply not matched and are silently excluded from the sum, which is a real, narrow limitation:
 *   a stranger question mixing hours/minutes with a third unit would UNDER-count rather than
 *   abstain -- flagged here rather than hidden, since only one member is known and this could not
 *   be cross-checked against a sibling; (c) an hours-only or minutes-only question with no genuine
 *   mixed-unit conversion still works correctly (it is just a sum of one unit), which is safe, not
 *   a false claim of the "mixed" shape specifically.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (135 = 1*60 + 30 + 45). With only one known
 *   member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'convert-add-convert-mixed-unit-time-sum-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS, hundred: 100 };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed {
  totalMinutes: number;
  parts: string[];
}

// D-BP223-M0-GATE5 REMEDIATION (one round, positive-evidence discriminator, after gate 5 found
// this candidate CONFIDENT-WRONG on 156 of 159 GSM8K items it claimed -- see the sibling manifest
// entry for the full failing-item list). ROOT CAUSE: the guard below only ever required "found"
// on ONE OR THE OTHER of hour/minute, never both, so a GSM8K narrative mentioning a single
// "20 minutes" anywhere (Carla's download restart, for instance -- no hour mention at all) was
// treated as a completed mixed-unit conversion, when the candidate's OWN documented @generalShape
// is explicitly "durations are given in a MIX of hours and minutes". THE FIX IS POSITIVE EVIDENCE
// OF THE CANDIDATE'S OWN CLAIMED SHAPE, not a new blacklist against GSM8K: (a) require AT LEAST
// ONE hour-unit occurrence AND at least one minute-unit occurrence -- a genuine mix, matching the
// docstring rather than either unit alone; (b) require the question clause itself asks about
// total time/duration ("how much/long ... time", "total time", "how long"), so a narrative that
// merely CONTAINS an hour and a minute token in service of an unrelated computation (a rate, a
// restart penalty, a schedule) is not mistaken for "sum these durations". Both checks are
// properties of the shape this candidate was taught, not absence-of-GSM8K-marker checks.
const TIME_QUESTION_RE = /how\s+(?:much|long)[^?.]{0,40}\btime\b|total\s+time|how\s+long\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  let totalMinutes = 0;
  const parts: string[] = [];
  let hourHits = 0;
  let minHits = 0;

  const hourRe = /([a-zA-Z0-9]+)\s*hours?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = hourRe.exec(q)) !== null) {
    const v = wordOrDigit(m[1]);
    if (v !== null) { totalMinutes += v * 60; parts.push(`${v}h->${v * 60}m`); hourHits++; }
  }
  const minRe = /([a-zA-Z0-9]+)\s*minutes?\b/gi;
  while ((m = minRe.exec(q)) !== null) {
    const v = wordOrDigit(m[1]);
    if (v !== null) { totalMinutes += v; parts.push(`${v}m`); minHits++; }
  }

  // POSITIVE EVIDENCE 1: a genuine mix, both units actually present (not one alone).
  if (hourHits < 1 || minHits < 1) return null;
  // POSITIVE EVIDENCE 2: the question is actually asking for a total duration.
  if (!TIME_QUESTION_RE.test(q)) return null;
  // POSITIVE EVIDENCE 3 (second finding in the same remediation round, before this candidate was
  // accepted as fixed): gsm8k-test-830 (Britany's TikTok/songwriting week) and gsm8k-test-1288
  // (Charisma's meditation routine) both survived evidence 1+2 -- both genuinely mix hours and
  // minutes AND ask "how much time" -- yet both are WRONG (135 vs 1128; 75 vs 34), because both
  // are RECURRING schedules ("each week", "six days a week", "5 days a week") that must be
  // MULTIPLIED by a day/week count before summing, not simply added once. The representative
  // teaching case (Mrs. Hilt's Saturday shoveling) names SPECIFIC one-time occasions ("Saturday
  // morning", "Saturday afternoon"), never a recurrence count -- so a recurrence phrase is
  // positive evidence the shape is multiply-then-sum, not this candidate's flat sum, and the
  // honest move is to abstain rather than guess which day-count multiplies which duration.
  const RECURRENCE_RE = /\b(?:each|every|per)\s+(?:day|week)\b|\bdays?\s+a\s+week\b|\bweeks?\s+a\s+/i;
  if (RECURRENCE_RE.test(q)) return null;
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return null;
  return { totalMinutes, parts };
}


export const convertAddConvertMixedUnitTimeSumMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Convert mixed hour/minute durations to minutes and sum',
  taughtBy: 'D-BP223-BM0-079/SEG BATCH-2 (cluster C146, sole member harvest_asdiv_pilot_item149)',
  shapeDescription:
    'Two or more durations in a mix of hours and minutes; every hour count is converted to ' +
    'minutes and everything is summed into one total in minutes.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'found no hour/minute duration tokens to convert and sum, or the total-time-question/recurrence guard did not hold; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `parts=${JSON.stringify(result.parts)}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed -- same
    // convention as every other adapted method in this folder.
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
      const rounded = Math.round((result.totalMinutes) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.parts.join(' + ')} = ${rounded} minutes`,
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005 convention (see file header): ABSTAIN and say what
      // threw, rather than letting the exception end the engine's fall-through chain.
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
// ACCEPTED by this dispatch's own live re-run of accept_gates.cjs (gate 1 then gate 2a then gate 4
// then gate 5), matching BISHOP_DROPZONE\D-BP223-M0-h2cbpoxk-035_PROMOTION_BATCH_2_ASDIV_CLUSTERS.md and
// BISHOP_DROPZONE\D-BP223-M0-h2cbpc0g-043_GATE_5_SIBLING_INTERCEPTION.md. See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_BATCH2_STAGED.md for the full verdict table.
registerMethod(convertAddConvertMixedUnitTimeSumMethod);
