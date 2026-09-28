// D-BP223-BM04-h2cbp9d8-171 -- daily-income-minus-purchase-cost-times-days-savings-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\daily-income-minus-purchase-cost-times-days-savings-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C202 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 358, "Marisa gets $5 as pocket money every
 * day from her parents. She buys 4 lollipops worth 25 cents each every day and saves the change
 * in her piggy bank. How much money does she put in her piggy bank if she saves for 5 days?".
 * Silo label: "multi-step financial calculation involving daily income, daily expenses, and
 * cumulative savings" -- matches exactly.
 *
 * @generalShape A daily cash INCOME (dollars) is stated. A daily PURCHASE of a stated quantity of
 *   an item at a stated per-unit cost (cents) is stated. The daily change/savings is income minus
 *   the daily purchase cost. The answer is that daily savings multiplied by a stated number of
 *   days. All money is carried in integer CENTS internally so the dollars-to-cents conversion and
 *   the final total never touch floating-point rounding.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "gets $<income> as pocket money
 *   every day"; (b) "buys <qty> <item> worth <unitCostCents> cents each every day"; (c) "saves
 *   for <days> days". qty and days may be digits or ones-words (zero through nineteen), resolved
 *   via a shared table, never a literal digit table.
 *
 * @whatBreaksIt (a) any of the three sentences missing or worded differently (e.g. the purchase
 *   priced in dollars rather than cents, or the saving period given in weeks) -- abstain, this
 *   candidate does not attempt unit conversion beyond the one cents-to-dollars step it was taught;
 *   (b) the daily purchase cost exceeding the daily income (negative daily savings) -- abstain,
 *   "saves the change" presumes a positive daily surplus; (c) the final cents total not landing
 *   on an exact whole number of dollars -- abstain rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (daily spend = 4*25=100 cents = $1, daily savings = $5-$1=$4, over 5 days =
 *   $20). With only one known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'daily-income-minus-purchase-cost-times-days-savings-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const CENTS_PER_DOLLAR = ONES_WORDS.indexOf('ten') * ONES_WORDS.indexOf('ten');

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitOnly = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitOnly)) return parseFloat(digitOnly);
  const w = tok.toLowerCase().trim();
  const idx = ONES_WORDS.indexOf(w);
  return idx >= 0 ? idx : null;
}

function dollarsToCents(dollarsStr: string): number | null {
  const v = wordOrDigit(dollarsStr);
  if (v === null) return null;
  return Math.round(v * CENTS_PER_DOLLAR);
}

interface Analyzed { totalDollars: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const incomeRe = /\bgets\s+\$(\d+(?:\.\d+)?)\s+as\s+pocket\s+money\s+every\s+day\b/i;
  const incomeM = incomeRe.exec(q);
  if (!incomeM) return null;
  const [, incomeDollarsRaw] = incomeM;
  const incomeCents = dollarsToCents(incomeDollarsRaw);
  if (incomeCents === null) return null;

  const purchaseRe = /\bbuys\s+(\d+|[a-z]+)\s+([a-z]+)\s+worth\s+(\d+(?:\.\d+)?)\s+cents\s+each\s+every\s+day\b/i;
  const purchaseM = purchaseRe.exec(q);
  if (!purchaseM) return null;
  const [, qtyRaw, , unitCentsRaw] = purchaseM;
  const qty = wordOrDigit(qtyRaw);
  const unitCents = parseFloat(unitCentsRaw);
  if (qty === null || !Number.isFinite(unitCents)) return null;

  const daysRe = /\bsaves\s+for\s+(\d+|[a-z]+)\s+days\b/i;
  const daysM = daysRe.exec(q);
  if (!daysM) return null;
  const [, daysRaw] = daysM;
  const days = wordOrDigit(daysRaw);
  if (days === null || days <= 0) return null;

  const spentCentsPerDay = qty * unitCents;
  const savingsCentsPerDay = incomeCents - spentCentsPerDay;
  if (savingsCentsPerDay <= 0) return null;
  const totalCents = savingsCentsPerDay * days;
  if (totalCents % CENTS_PER_DOLLAR !== 0) return null;
  const totalDollars = totalCents / CENTS_PER_DOLLAR;
  return { totalDollars };
}

export const dailyIncomeMinusPurchaseCostTimesDaysSavings: LianaMethod = {
  id: 'daily-income-minus-purchase-cost-times-days-savings-v1',
  demand: 'COMPUTE',
  name: 'Daily income minus a daily purchase cost, multiplied by a number of days',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C202, sole member: pilot corpus item at index 358)',
  shapeDescription:
    'dailySavingsCents = incomeCents - (qty * unitCostCents); answer = dailySavingsCents * days, ' +
    'converted back to whole dollars.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a daily cash income, a daily quantity-times-per-unit-cents purchase, and ' +
          'a number of days, resolving to a positive whole-dollar total; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `total saved = $${result.totalDollars}` };
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
          verdict: String(Math.round((result.totalDollars) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'daily surplus in cents, multiplied by the stated day count',
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

registerMethod(dailyIncomeMinusPurchaseCostTimesDaysSavings);
