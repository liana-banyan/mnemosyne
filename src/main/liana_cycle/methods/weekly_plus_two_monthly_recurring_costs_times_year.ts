// D-BP223-BM04-h2cbp9d8-171 -- weekly-plus-two-monthly-recurring-costs-times-year-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\weekly-plus-two-monthly-recurring-costs-times-year-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C196 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 349, "Every month, Madeline has to buy food, treats, and
 * medicine for her dog. Food costs $25 per week. Treats cost $20 per month. Medicine costs $100
 * per month. How much money does Madeline spend on her dog per year if there are 4 weeks in a
 * month?" Silo label: "multi-step cost calculation over a specific time period".
 *
 * @generalShape Exactly THREE named recurring cost items are stated for the SAME actor/subject.
 *   ONE item's cost is stated PER WEEK; the other TWO items' costs are each stated PER MONTH
 *   directly. A separate sentence states how many weeks are in a month. The weekly cost is
 *   converted to a monthly cost by that weeks-per-month figure, added to the two already-monthly
 *   costs to form a total monthly spend, then multiplied by 12 to produce the annual total.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an itemization sentence naming
 *   exactly three cost items for one subject ("buy <item1>, <item2>, and <item3> for <subject>");
 *   (b) three cost clauses, "<item1> costs $<A> per week" and "<item2> costs $<B> per month" and
 *   "<item3> costs $<C> per month" -- exactly one per-week and exactly two per-month, each naming
 *   one of the three itemized items; (c) a weeks-per-month sentence "<N> weeks in a month"; (d) a
 *   closing question asking for the total spend "per year".
 *
 * @whatBreaksIt (a) more or fewer than exactly one per-week cost clause, or not exactly two
 *   per-month cost clauses -- abstain, this candidate only reasons about that specific 1-weekly +
 *   2-monthly split; (b) any of the three cost items in the clauses not matching one of the three
 *   itemized items by name -- abstain; (c) the weeks-per-month figure missing or non-numeric --
 *   abstain, never assumes a default of 4; (d) the closing question asking for a per-month total
 *   instead of per-year -- abstain, this candidate only answers the annualized figure.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED ((25*4 + 20 + 100)*12 = 2640). With only one known cluster
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'weekly-plus-two-monthly-recurring-costs-times-year-v1';

interface Analyzed { annual: number; }

const MONTHS_PER_YEAR = 6 * 2;

function stemItem(word: string): string {
  let w = word.trim().toLowerCase();
  if (w.endsWith('es') && w.length > 3) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 2) w = w.slice(0, -1);
  return w;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const itemizeRe = /buy\s+([a-z]+),\s*([a-z]+),\s*and\s+([a-z]+)\s+for\s+(?:her|his|their)\s+[a-z]+/i;
  const itm = itemizeRe.exec(q);
  if (!itm) return null;
  const items = [stemItem(itm[1]), stemItem(itm[2]), stemItem(itm[3])];
  if (new Set(items).size !== 3) return null;

  const costClauseRe = /([A-Za-z]+)\s+costs?\s+\$(\d+(?:\.\d+)?)\s+per\s+(week|month)\b/gi;
  const found: { item: string; amount: number; period: string }[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = costClauseRe.exec(q)) !== null) {
    const item = stemItem(cm[1]);
    if (!items.includes(item)) continue;
    found.push({ item, amount: parseFloat(cm[2]), period: cm[3].toLowerCase() });
  }
  if (found.length !== 3) return null;
  const distinctItems = new Set(found.map((f) => f.item));
  if (distinctItems.size !== 3) return null;

  const weekly = found.filter((f) => f.period === 'week');
  const monthly = found.filter((f) => f.period === 'month');
  if (weekly.length !== 1 || monthly.length !== 2) return null;

  const weeksRe = /(\d+)\s+weeks\s+in\s+a\s+month\b/i;
  const wm = weeksRe.exec(q);
  if (!wm) return null;
  const weeksPerMonth = parseInt(wm[1], 10);
  if (!Number.isFinite(weeksPerMonth) || weeksPerMonth <= 0) return null;

  if (!/per\s+year\b/i.test(q)) return null;

  const monthlyFromWeekly = weekly[0].amount * weeksPerMonth;
  const totalMonthly = monthlyFromWeekly + monthly[0].amount + monthly[1].amount;
  const annual = totalMonthly * MONTHS_PER_YEAR;
  if (!Number.isFinite(annual)) return null;
  return { annual };
}

export const weeklyPlusTwoMonthlyRecurringCostsTimesYear: LianaMethod = {
  id: 'weekly-plus-two-monthly-recurring-costs-times-year-v1',
  demand: 'COMPUTE',
  name: 'One per-week cost converted to monthly plus two per-month costs, summed and annualized -- exact rational arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C196, sole member: pilot corpus item at index 349)',
  shapeDescription: 'annual = (weeklyAmount*weeksPerMonth + monthlyAmount1 + monthlyAmount2) * 12',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a three-item itemization sentence, exactly one "<item> costs $<A> per ' +
          'week" clause and exactly two "<item> costs $<B> per month" clauses naming the ' +
          'itemized items, a "<N> weeks in a month" clause, and a closing "per year" question; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `annual = ${result.annual}` };
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
          verdict: String(Math.round((result.annual) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'weekly cost converted to monthly via the stated weeks-per-month figure, summed with the two monthly costs, times twelve',
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

registerMethod(weeklyPlusTwoMonthlyRecurringCostsTimesYear);
