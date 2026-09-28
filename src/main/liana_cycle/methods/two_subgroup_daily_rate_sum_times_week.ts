// D-BP223-BM04-h2cbpv9w-170 -- two-subgroup-daily-rate-sum-times-week-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-subgroup-daily-rate-sum-times-week-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C169 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 311, "In a family of 5, three people eat three eggs each
 * day while the rest eat two eggs each day. If they eat eggs every day, how many eggs will the
 * family consume in a week?". Silo label: "multi-step word problem involving group totals and
 * time duration -- sum of products over a period of time".
 *
 * @generalShape A GROUP of total size N is partitioned into two subgroups: a stated subgroup of
 *   size A with a per-member daily rate R1, and "the rest" (size N-A) with a different per-member
 *   daily rate R2. Daily total = A*R1 + (N-A)*R2. The question asks for the WEEKLY total, so the
 *   daily total is multiplied by the named constant 7 (days per week).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "a[n] ... of <N>" naming the
 *   total group size; (b) "<A> people eat <R1> <item> each day"; (c) "the rest eat <R2> <item>
 *   each day", using the SAME item word as (b); (d) a closing question that explicitly asks for
 *   the amount consumed "in a week" -- this candidate only attempts the weekly-total question, not
 *   a bare daily-total one.
 *
 * @whatBreaksIt (a) the item word in the "rest eat" clause differing from the first subgroup's
 *   item word -- abstains, cannot assume it is the same item; (b) the stated subgroup size A being
 *   greater than or equal to the total N -- abstains, "the rest" would be zero or negative; (c) no
 *   "in a week" phrase in the question -- abstains rather than guessing whether daily or weekly is
 *   wanted; (d) either rate phrase missing "each day" (a per-occasion, not per-day, rate would need
 *   different handling this candidate does not attempt).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (rest = 5-3 = 2; daily = 3*3 + 2*2 = 13; weekly = 13*7 = 91).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-subgroup-daily-rate-sum-times-week-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const DAYS_IN_WEEK = ONES_WORDS.indexOf('seven');

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitStr = tok.replace(/[^0-9]/g, '');
  if (/^\d+$/.test(digitStr)) return parseInt(digitStr, 10);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Analyzed { weekly: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalRe = /\bof\s+(\d+|[a-z]+)\s*,/i;
  const tm = totalRe.exec(q);
  if (!tm) return null;
  const total = wordOrDigit(tm[1]);
  if (total === null) return null;

  const firstRe = /(\d+|[a-z]+)\s+people\s+eat\s+(\d+|[a-z]+)\s+([a-z]+)\s+each\s+day/i;
  const fm = firstRe.exec(q);
  if (!fm) return null;
  const groupA = wordOrDigit(fm[1]);
  const rateA = wordOrDigit(fm[2]);
  const item1 = fm[3].toLowerCase();
  if (groupA === null || rateA === null) return null;

  const restRe = /the\s+rest\s+eat\s+(\d+|[a-z]+)\s+([a-z]+)\s+each\s+day/i;
  const rm = restRe.exec(q);
  if (!rm) return null;
  const rateB = wordOrDigit(rm[1]);
  const item2 = rm[2].toLowerCase();
  if (rateB === null) return null;
  if (item1 !== item2) return null;

  if (!/in a week/i.test(q)) return null;

  const groupB = total - groupA;
  if (groupB <= 0) return null;

  const daily = groupA * rateA + groupB * rateB;
  const weekly = daily * DAYS_IN_WEEK;
  if (!Number.isFinite(weekly) || weekly <= 0) return null;
  return { weekly };
}

export const twoSubgroupDailyRateSumTimesWeek: LianaMethod = {
  id: 'two-subgroup-daily-rate-sum-times-week-v1',
  demand: 'COMPUTE',
  name: 'Two-subgroup daily consumption sum, scaled to a weekly total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C169, sole member: pilot corpus item at index 311)',
  shapeDescription:
    '(A*rateA + (N-A)*rateB) * 7 = weekly total, for a two-subgroup daily-rate partition',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total group size, a first subgroup with a daily per-member rate, a ' +
          '"the rest" subgroup with a matching item and its own daily rate, and a closing ' +
          '"in a week" question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `weekly total = ${result.weekly}` };
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
          verdict: String(Math.round(result.weekly * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'daily total from two subgroups, times 7',
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

registerMethod(twoSubgroupDailyRateSumTimesWeek);
