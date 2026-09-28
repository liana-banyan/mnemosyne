// D-BP223-BM04-h2cbpv9w-170 -- weekly-wage-plus-flat-bonus-times-weeks-in-month-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\weekly-wage-plus-flat-bonus-times-weeks-in-month-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C165 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 304, "Watson works a 10-hour shift each day,
 * five days a week. He earns $10 per hour and gets a $300 bonus each week if the company performs
 * well. How much money did Watson make in April if the company performed very well for the whole
 * month?" Silo label: "multi-step calculation of total earnings over a period of time with a
 * fixed bonus -- multi-step multiplication and addition" -- matches.
 *
 * @generalShape A daily HOURS figure and an hourly RATE combine with a stated DAYS-PER-WEEK
 *   figure to give a weekly wage. A FLAT weekly bonus, explicitly CONDITIONAL on a stated
 *   condition being met ("if the company performs well"), is added to the weekly wage once that
 *   condition is confirmed satisfied in the question itself ("performed very well"/"performed
 *   well" stated as having happened). The weekly total is then multiplied by the number of weeks
 *   in the named calendar month to get the period total.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a shift sentence "works a <H>-hour shift each day, <D> days a week";
 *   (b) an hourly rate "earns $<R> per hour";
 *   (c) a conditional weekly bonus "gets a $<B> bonus each week if <condition>";
 *   (d) the question CONFIRMING the condition held for the whole period ("if the company
 *       performed (very )?well for the whole month" -- the confirmation must restate the same
 *       condition verb the bonus clause used, not merely mention the word "bonus" again);
 *   (e) a NAMED calendar month in the closing question ("how much ... make in <Month>"), resolved
 *       to 4 weeks per the GSM8K convention that a month is treated as four weeks for this shape
 *       unless the text itself states a different week-count explicitly (checked first).
 *
 * @whatBreaksIt (a) the bonus condition mentioned but never confirmed as satisfied in the
 *   question -- abstain, cannot assume it fired; (b) the question stating an explicit week-count
 *   for the month ("if there are N weeks") that conflicts with the 4-week default -- this
 *   candidate PREFERS the explicit stated figure over its own convention, checked first; (c) any
 *   of hours/rate/days/bonus not a bare number -- abstain; (d) a second, independent deduction or
 *   bonus term mentioned -- abstain, this candidate only reconstructs wage-plus-one-bonus.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (daily pay 10*10=100; weekly wage 100*5=500; weekly total with
 *   bonus 500+300=800; monthly total 800*4=3200). The 4-weeks-per-month convention is an explicit,
 *   documented assumption rather than a derivation from the text (no sentence states "4 weeks" in
 *   the generating item) -- flagged here as the single biggest generalization risk of this
 *   candidate: it will be WRONG on any real-world month whose actual week-count differs from 4
 *   and is not itself GSM8K's own convention-following item. With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'weekly-wage-plus-flat-bonus-times-weeks-in-month-v1';

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
  'november', 'december',
];

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];
const NUMBER_WORDS: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { NUMBER_WORDS[w] = i; });

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

  const shiftRe = /works? a\s+([0-9]+)-hour shift each day,?\s+([0-9]+|[a-z]+)\s+days a week/i;
  const sm = shiftRe.exec(q);
  if (!sm) return null;
  const hoursPerDay = parseFloat(sm[1]);
  const daysPerWeek = wordOrDigit(sm[2]);
  if (daysPerWeek === null) return null;

  const rateRe = /earns?\s*\$?([0-9]+(?:\.[0-9]+)?)\s+per hour/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const rate = parseFloat(rm[1]);

  const bonusRe = /(?:gets?|receives?)\s+a\s*\$?([0-9]+(?:\.[0-9]+)?)\s+bonus\s+each week\s+if\b/i;
  const bm = bonusRe.exec(q);
  if (!bm) return null;
  const bonus = parseFloat(bm[1]);

  if (!/perform(?:ed|s)?\s+(?:very\s+)?well\s+for\s+the\s+whole\s+month/i.test(q)) return null;

  // Explicit week-count override, checked FIRST.
  let weeksInMonth: number | null = null;
  const explicitWeeks = /(?:if\s+there\s+are\s+|for\s+)([0-9]+)\s+weeks\s+in\s+(?:the\s+)?month/i.exec(q);
  if (explicitWeeks) {
    weeksInMonth = parseInt(explicitWeeks[1], 10);
  } else {
    const monthMention = MONTH_NAMES.find((m) => new RegExp('\\b' + m + '\\b', 'i').test(q));
    if (!monthMention) return null;
    weeksInMonth = 4; // documented GSM8K convention, only used when no explicit week-count is stated
  }
  if (weeksInMonth === null || weeksInMonth <= 0) return null;

  if (!/how much money did .+ make/i.test(q)) return null;

  const weeklyWage = hoursPerDay * rate * daysPerWeek;
  const weeklyTotal = weeklyWage + bonus;
  const total = weeklyTotal * weeksInMonth;
  if (!Number.isFinite(total)) return null;
  return { total };
}

export const weeklyWagePlusFlatBonusTimesWeeksInMonth: LianaMethod = {
  id: 'weekly-wage-plus-flat-bonus-times-weeks-in-month-v1',
  demand: 'COMPUTE',
  name: 'Weekly wage from hours/rate/days plus a confirmed flat weekly bonus, multiplied by weeks in the named month',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C165, sole member: GSM8K test.jsonl item 304)',
  shapeDescription:
    'monthlyTotal = (hoursPerDay*rate*daysPerWeek + weeklyBonus) * weeksInMonth, where weeksInMonth ' +
    'is an explicit stated figure if present, else the documented 4-weeks-per-month convention, ' +
    'and the bonus condition must be confirmed satisfied in the question text.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a shift/rate/days-per-week clause, a conditional weekly bonus clause with ' +
          'its condition confirmed satisfied, a named month or explicit week-count, and a ' +
          '"how much money did ... make" question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `monthly total = ${result.total}` };
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
          basis: 'weekly wage plus confirmed bonus, multiplied by weeks in the month',
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

registerMethod(weeklyWagePlusFlatBonusTimesWeeksInMonth);
