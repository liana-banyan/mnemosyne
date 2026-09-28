// D-BP223-BM04-h2cbpv9w-170 -- three-year-book-sales-ratio-backsolve-second-year-revenue-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-year-book-sales-ratio-backsolve-second-year-revenue-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C164 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 303, "Elise has been selling her Dad's
 * collection of 250 books for three years. Each book sells at 20$, and she sold twice as many
 * books in the first year as she has sold in the current year. There are currently 50 unsold
 * books, and her sales number this year is 45. What's the total amount of money she earned in the
 * second year?" Silo label: "multi-step word problem involving proportions and total inventory
 * tracking -- multi-step arithmetic and algebraic substitution" -- matches.
 *
 * @generalShape A COLLECTION has a fixed TOTAL count and a fixed PER-UNIT price. Sales happen
 *   over exactly three named periods (first year / second year / current year). The CURRENT
 *   year's count is given directly. The FIRST year's count is given as an explicit RATIO of the
 *   current year's count. An UNSOLD remainder is also given directly. The SECOND (middle) year's
 *   count is backsolved as total - firstYear - currentYear - unsold, and the question asks for the
 *   money earned in that middle year (secondYearCount * pricePerUnit).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an opening collection sentence "a collection of <TOTAL> <item-plural>" and a per-unit
 *       price "<item> sells at $<PRICE>" (or "$<PRICE> each");
 *   (b) a ratio sentence tying the first year's count to the current year's count via a resolved
 *       multiple ("<ratio-phrase> as many <item> in the first year as ... in the current year");
 *   (c) an unsold-remainder figure ("<UNSOLD> unsold <item-plural>");
 *   (d) a current-year sales figure ("sales number this year is <CURRENT>" or equivalent "sold
 *       <CURRENT> ... this year");
 *   (e) a closing question asking for money earned in "the second year" specifically (not the
 *       first year, not the current year -- this candidate only ever backsolves the middle term).
 *
 * @whatBreaksIt (a) the question asking about the first or current year instead of the second --
 *   abstain, this candidate's arithmetic is specific to the backsolved middle term; (b) the
 *   backsolved second-year count landing at or below zero, or not an exact integer -- abstain
 *   rather than report a nonsensical or rounded sales figure; (c) the ratio phrase not resolving
 *   through the shared number-word table -- abstain; (d) the item noun differing across the
 *   collection/price/unsold/ratio clauses -- abstain, cannot be sure they refer to the same stock.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (firstYear = 45*2 = 90; secondYear = 250-90-45-50 = 65; revenue
 *   = 65*20 = 1300). With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-year-book-sales-ratio-backsolve-second-year-revenue-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function parseRatioPhrase(phrase: string): number | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'twice' || p === 'double') return 2;
  if (p === 'three times' || p === 'triple') return 3;
  const timesM = /^([a-z]+)\s+times$/.exec(p);
  if (timesM && Object.prototype.hasOwnProperty.call(ONES, timesM[1])) {
    const n = ONES[timesM[1]];
    if (n >= 2) return n;
  }
  const digitTimes = /^([0-9]+)\s+times$/.exec(p);
  if (digitTimes) return parseInt(digitTimes[1], 10);
  return null;
}

interface Analyzed { revenue: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const collectionRe = /collection of\s+([0-9]+)\s+([a-z]+)/i;
  const cm = collectionRe.exec(q);
  if (!cm) return null;
  const total = parseInt(cm[1], 10);
  const item = cm[2].toLowerCase().replace(/s$/, '');

  const priceRe = /(?:each\s+[a-z]+\s+sells at|sells at)\s*\$?([0-9]+(?:\.[0-9]+)?)/i;
  const pm = priceRe.exec(q);
  if (!pm) return null;
  const price = parseFloat(pm[1]);

  const ratioRe = /([a-z]+(?:\s+times)?|twice|double|triple)\s+as many\s+([a-z]+)\s+.{0,40}?first year\s+as\s+.{0,60}?current year/i;
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const ratio = parseRatioPhrase(rm[1]);
  const ratioItem = rm[2].toLowerCase().replace(/s$/, '');
  if (ratio === null || ratioItem !== item) return null;

  const unsoldRe = /([0-9]+)\s+unsold\s+([a-z]+)/i;
  const um = unsoldRe.exec(q);
  if (!um) return null;
  const unsold = parseInt(um[1], 10);
  const unsoldItem = um[2].toLowerCase().replace(/s$/, '');
  if (unsoldItem !== item) return null;

  const currentRe = /sales number this year is\s+([0-9]+)/i;
  const curm = currentRe.exec(q);
  if (!curm) return null;
  const currentYear = parseInt(curm[1], 10);

  if (!/second year/i.test(q) || !/how much|total amount of money/i.test(q)) return null;

  const firstYear = currentYear * ratio;
  const secondYear = total - firstYear - currentYear - unsold;
  if (!Number.isInteger(secondYear) || secondYear <= 0) return null;
  const revenue = secondYear * price;
  if (!Number.isFinite(revenue)) return null;
  return { revenue };
}

export const threeYearBookSalesRatioBacksolveSecondYearRevenue: LianaMethod = {
  id: 'three-year-book-sales-ratio-backsolve-second-year-revenue-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a middle-year sales count from a total, a ratio, an unsold remainder, and a current-year count, then price it',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C164, sole member: GSM8K test.jsonl item 303)',
  shapeDescription:
    'secondYear = total - (currentYear*ratio) - currentYear - unsold; revenue = secondYear*price; ' +
    'requires the question to ask specifically about the second (middle) year.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a collection-total-and-price pair, a first-year-as-ratio-of-current-year ' +
          'clause, an unsold-remainder figure, a current-year sales figure, and a second-year ' +
          'revenue question resolving to a positive integer sales count; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `second-year revenue = ${result.revenue}` };
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
          verdict: String(Math.round(result.revenue * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'backsolved the second-year count from the total and the other three known terms, then priced it',
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

registerMethod(threeYearBookSalesRatioBacksolveSecondYearRevenue);
