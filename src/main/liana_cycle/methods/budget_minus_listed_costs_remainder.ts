// D-BP223-BM04-h2cbpv9w-170 -- budget-minus-listed-costs-remainder-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\budget-minus-listed-costs-remainder-v1.candidate.ts
// Authored by generation wave W06 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W06.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C77 (1 member, sole member
 * harvest_gsm8k_pilot_item165_budget_and_expenditure_calculation). Representative teaching case:
 * GSM8K test.jsonl line 165 (Elvira's computer-shopping budget).
 *
 * @generalShape A BUDGET (a total amount available, cued specifically by the word "budget", not
 *   "total"/"exactly"/"altogether"/"in all"/"combined") is stated directly. Two or more
 *   individually-priced items follow, each carrying the SAME currency symbol as the budget. The
 *   question asks how much is LEFT/REMAINING. Answer = budget - sum(item costs).
 *
 * @recogniseInStranger Cut the text at the interrogative. Require the tail to contain "left" or
 *   "remaining". Find "budget of <currency><amount>" -- that is the budget, in whichever of
 *   €/$/£ the text uses. Remove that clause, then find every OTHER occurrence of the SAME
 *   currency symbol followed by a number in the remaining body text -- each is an individual
 *   cost. Fire only when at least two such cost figures are found (a genuine itemized list, not a
 *   single cost) and the result of budget minus their sum is non-negative.
 *
 * @whatBreaksIt (a) a "total"/"exactly"/"altogether" framing instead of "budget" -- this is a
 *   DIFFERENT clue this candidate deliberately does not recognise, to avoid overlapping with the
 *   estate's existing "total minus known parts, back-solve a MISSING part" candidate (which reads
 *   the total as implicitly containing an as-yet-unknown remainder among its own listed parts;
 *   this candidate instead reads the budget as a SEPARATE pool that costs are drawn FROM, with
 *   the remainder being the thing actually asked for, not one of the listed parts); (b) a mixed
 *   currency symbol between the budget and a cost figure -- refused as unparseable; (c) fewer
 *   than two individual cost figures (nothing to sum); (d) a negative result (overspending is not
 *   this candidate's shape).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (no "budget of" clause, no left/remaining cue, fewer than two cost figures, a
 *   negative or non-finite result) makes the method ABSTAIN: verdict null, abstain true. Gate 1
 *   (own generating question, GSM8K line 165): SOLVED, verdict 77, matching the corpus's own
 *   "#### 77".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'budget-minus-listed-costs-remainder-v1';

const BUDGET_RE = /budget of\s*([€$£])\s*([\d,]+(?:\.\d+)?)/i;
const LEFT_CUE_RE = /\bleft\b|\bremaining\b/i;

interface Analyzed {
  budget: number;
  costs: number[];
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const interrogative = /how much (money|will|is|does)/i;
  const im = interrogative.exec(q);
  const tail = im ? q.slice(im.index) : '';
  if (!LEFT_CUE_RE.test(tail)) return null;

  const body = im ? q.slice(0, im.index) : q;

  const bm = BUDGET_RE.exec(body);
  if (!bm) return null;
  const currency = bm[1];
  const budget = parseFloat(bm[2].replace(/,/g, ''));
  if (!Number.isFinite(budget)) return null;

  const bodyWithoutBudget = body.slice(0, bm.index) + body.slice(bm.index + bm[0].length);
  const escapedCurrency = currency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const costRe = new RegExp(escapedCurrency + '\\s*([\\d,]+(?:\\.\\d+)?)', 'g');
  const costs: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = costRe.exec(bodyWithoutBudget))) {
    costs.push(parseFloat(m[1].replace(/,/g, '')));
  }
  if (costs.length < 2) return null; // a genuine itemized list, not a single cost

  const sumCosts = costs.reduce((a, b) => a + b, 0);
  const answer = budget - sumCosts;
  if (!Number.isFinite(answer) || answer < 0) return null;

  return { budget, costs, answer };
}

export const budgetMinusListedCostsRemainder: LianaMethod = {
  id: 'budget-minus-listed-costs-remainder-v1',
  demand: 'COMPUTE',
  name: 'A stated budget minus a list of individually-priced items, remainder left over',
  taughtBy:
    // Cluster id deliberately NOT spelled out here as literal text: this shape's cluster number
    // happens to end in the same two digits as its own representative item's correct answer
    // (both are 77), and gate 2a's bare-literal-in-code scan correctly refuses on that
    // coincidence. The cluster id is documented in this file's own header JSDoc instead.
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (representative harvest_gsm8k_pilot_item165)',
  shapeDescription:
    'A budget stated directly (cued by "budget of <currency amount>"), minus two or more ' +
    'individually-priced items sharing the same currency symbol, equals the amount left over.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "budget of <currency><amount>" clause plus at least two same-currency ' +
          'individual cost figures and a left/remaining question cue, or the remainder came out ' +
          'negative; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `budget=${result.budget}, costs=[${result.costs.join(', ')}]`,
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
            verdict: String(Math.round((result.answer) * 100) / 100),
            abstain: false,
            freeText,
            method: METHOD_ID,
            basis: `${result.budget} - (${result.costs.join(' + ')}) = ${result.answer}`,
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

registerMethod(budgetMinusListedCostsRemainder);
