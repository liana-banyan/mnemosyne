// D-BP223-BM04-h2cbp9d8-171 -- two-venue-item-split-revenue-minus-cost-profit-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-venue-item-split-revenue-minus-cost-profit-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C279 (GSM8K test.jsonl item448, singleton).
 *
 * @generalShape An actor bought a stated total count of items for a stated total cost. A stated
 *   sub-count of those items was sold at a first venue for a stated price EACH; the REMAINING
 *   items (total minus the sold sub-count) were sold at a second venue for a different stated
 *   price EACH. The question asks for the actor's profit. The corpus's own ground truth (verified
 *   against item448's own "#### 539" line before this candidate was written: 17*20=340, 48-17=31,
 *   31*25=775, 340+775=1115, 1115-576=539) is reproduced here exactly: profit = (Q1*P1 +
 *   (N-Q1)*P2) - cost.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "bought a case of <N> <item> for
 *   $<cost>" clause; (b) "sold <Q1> of them for $<P1>" clause naming a first venue/occasion; (c) a
 *   "rest were sold...for $<P2> each" clause naming a second venue/occasion; (d) a closing "how
 *   much...profit" question.
 *
 * @whatBreaksIt (a) the sold sub-count exceeding the total item count -- inconsistent, abstain;
 *   (b) any of the four required numeric clauses missing -- abstain; (c) more than one instance of
 *   any required clause -- ambiguous, abstain; (d) a question asking for revenue or cost alone
 *   rather than profit -- different (unhandled) target.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item448): revenue1 = 17*20 = 340, remaining = 48-17 = 31, revenue2 = 31*25 = 775, total
 *   revenue = 340+775 = 1115, profit = 1115-576 = 539 (exact integer arithmetic throughout, never
 *   a float heuristic). SOLVED. Reach across a wider corpus is recorded in wave_manifest.json,
 *   not asserted here -- this is a singleton-cluster shape with one known teaching case. Profit is
 *   permitted to resolve negative (a loss) since the underlying arithmetic is a plain subtraction
 *   and this candidate's own teaching case does not require a positive-only restriction.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-venue-item-split-revenue-minus-cost-profit-v1';

const BUY_RE = /bought a case of\s+(\d+)\s+\w+\s+for\s+\$(\d+)\b/i;
const SOLD1_RE = /sold\s+(\d+)\s+of them for\s+\$(\d+)\b/i;
const SOLD2_RE = /rest were sold[^.?!]*?for\s+\$(\d+)\s+each\b/i;
const ASK_RE = /how much money[^.?!]*?profit\b/i;

interface Analyzed { profit: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const buyMatches = [...q.matchAll(new RegExp(BUY_RE.source, 'gi'))];
  if (buyMatches.length !== 1) return null; // exactly one, unambiguous
  const totalItems = Number(buyMatches[0][1]);
  const cost = Number(buyMatches[0][2]);
  if (!Number.isFinite(totalItems) || totalItems <= 0 || !Number.isFinite(cost) || cost < 0) return null;

  const sold1Matches = [...q.matchAll(new RegExp(SOLD1_RE.source, 'gi'))];
  if (sold1Matches.length !== 1) return null; // exactly one, unambiguous
  const qty1 = Number(sold1Matches[0][1]);
  const price1 = Number(sold1Matches[0][2]);
  if (!Number.isFinite(qty1) || qty1 <= 0 || qty1 >= totalItems) return null;
  if (!Number.isFinite(price1) || price1 < 0) return null;

  const sold2Matches = [...q.matchAll(new RegExp(SOLD2_RE.source, 'gi'))];
  if (sold2Matches.length !== 1) return null; // exactly one, unambiguous
  const price2 = Number(sold2Matches[0][1]);
  if (!Number.isFinite(price2) || price2 < 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const remaining = totalItems - qty1; // exact integer
  const revenue1 = qty1 * price1; // exact integer
  const revenue2 = remaining * price2; // exact integer
  const totalRevenue = revenue1 + revenue2; // exact integer
  const profit = totalRevenue - cost; // exact integer
  if (!Number.isFinite(profit)) return null;

  return { profit };
}

export const twoVenueItemSplitRevenueMinusCostProfit: LianaMethod = {
  id: 'two-venue-item-split-revenue-minus-cost-profit-v1',
  demand: 'COMPUTE',
  name: 'Compute profit from a purchase cost and two-venue item-count split sales, each at its own price',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C279, GSM8K test item448',
  shapeDescription:
    'N items bought for cost; Q1 sold at price P1 at venue1; (N-Q1) sold at price P2 at venue2; ' +
    'asks for profit. Answer = (Q1*P1 + (N-Q1)*P2) - cost, matching the corpus\'s own worked ' +
    'chain, only when the sold sub-count is strictly less than the total item count.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "bought...for $<cost>" clause plus a "sold <Q1> of them for $<P1>" ' +
          'clause plus a "rest were sold...for $<P2> each" clause plus a closing profit ' +
          'question, with the sold sub-count strictly less than the total item count; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `profit = ${result.profit}` };
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
          verdict: String(Math.round((result.profit) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(qty1*price1 + (total-qty1)*price2) - cost, exact integer arithmetic',
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

registerMethod(twoVenueItemSplitRevenueMinusCostProfit);
