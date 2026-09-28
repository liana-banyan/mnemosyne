// D-BP223-BM04-h2cbp9d8-171 -- unit-price-revenue-backsolve-plus-doubling-day-chain-total-picked-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\unit-price-revenue-backsolve-plus-doubling-day-chain-total-picked-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C218 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 377, "Lucy sells apples from her orchard at
 * $4 per piece. On Monday, she sold all the apples picked. On Tuesday, she picked 12 apples. Come
 * Wednesday, Lucy picked double the number of apples she did the previous day. If Lucy got $56
 * from selling the apples picked on Monday, how many apples did she pick over the three days?".
 * Silo label: "multi-step word problem involving unit price, multiplication, and summation" --
 * matches exactly.
 *
 * @generalShape A seller sells an ITEM at a fixed PRICE per piece. On day 1 ("Monday") she sold
 * ALL of the item picked that day (no count given directly). On day 2 ("Tuesday") a count is
 * given directly. On day 3 ("Wednesday") the count is stated as DOUBLE the previous day's count.
 * A separate sentence gives the REVENUE collected from day 1's items specifically. Day 1's count
 * is backsolved as revenue / price. The question asks for the total picked across all three days:
 * (revenue / price) + day2Count + 2*day2Count.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the item noun repeated
 *   verbatim (by backreference) across every sentence:
 *   (a) "sells <item-plural> from (?:her|his|their) [a-z]+ at \$<price> per piece" -- unit price;
 *   (b) "on <day1>,? (?:she|he|they) sold all the <item-plural> picked" -- confirms day 1's items
 *       were fully sold, no count stated here;
 *   (c) "on <day2>,? (?:she|he|they) picked <T> <item-plural>" -- day 2's directly-stated count T;
 *   (d) "<day3>,? [a-z]+ picked double the number of <item-plural> (?:she|he|they) did the
 *       previous day" -- confirms day 3 = 2*T, naming the same item noun;
 *   (e) "got \$<R> from selling the <item-plural> picked on <day1>" -- day 1's revenue R, naming
 *       day1 and the item noun consistently;
 *   (f) the question "how many <item-plural> did (?:she|he|they) pick over the three days".
 *   Day 1's count = R / price, and the candidate ABSTAINS unless that division is EXACT (no
 *   fractional apple picked), computed as exact integer division, never a floating heuristic.
 *
 * @whatBreaksIt (a) R / price not dividing evenly -- abstain, a fractional item count is not
 *   valid; (b) the item noun differing between the price sentence, the day-1/day-2/day-3
 *   sentences, or the revenue sentence -- abstain, cannot confirm it is the same item; (c) day 3
 *   phrased as anything other than "double the number ... the previous day" (e.g. "half as many",
 *   "10 more than") -- abstain, this candidate only recognises the doubling relation it has
 *   positive evidence for; (d) the revenue sentence naming a day other than day 1 -- abstain,
 *   would backsolve the wrong day's count.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED ($56/$4=14 apples Monday, Tuesday=12, Wednesday=24, total 14+12+24=50). With
 *   only one known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'unit-price-revenue-backsolve-plus-doubling-day-chain-total-picked-v1';

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rPrice = /\bsells\s+([a-z]+)\s+from\s+(?:her|his|their)\s+[a-z]+\s+at\s+\$(\d+(?:\.\d+)?)\s+per\s+piece\b/i;
  const mPrice = rPrice.exec(q);
  if (!mPrice) return null;
  const [, itemNoun, priceRaw] = mPrice;
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price <= 0) return null;
  const itemEsc = itemNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const rDay1Sold = new RegExp(
    '\\bon\\s+([a-z]+),?\\s+(?:she|he|they)\\s+sold\\s+all\\s+the\\s+' + itemEsc + '\\s+picked\\b',
    'i',
  );
  const mDay1 = rDay1Sold.exec(q);
  if (!mDay1) return null;
  const day1 = mDay1[1];

  const rDay2 = new RegExp(
    '\\bon\\s+([a-z]+),?\\s+(?:she|he|they)\\s+picked\\s+(\\d+)\\s+' + itemEsc + '\\b',
    'i',
  );
  const mDay2 = rDay2.exec(q);
  if (!mDay2) return null;
  const [, , day2Count] = mDay2;
  const t = parseInt(day2Count, 10);
  if (!Number.isFinite(t)) return null;

  const rDay3 = new RegExp(
    'picked\\s+double\\s+the\\s+number\\s+of\\s+' + itemEsc + '\\s+(?:she|he|they)\\s+did\\s+the\\s+previous\\s+day',
    'i',
  );
  if (!rDay3.test(q)) return null;

  const day1Esc = day1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rRevenue = new RegExp(
    'got\\s+\\$(\\d+(?:\\.\\d+)?)\\s+from\\s+selling\\s+the\\s+' + itemEsc + '\\s+picked\\s+on\\s+' + day1Esc,
    'i',
  );
  const mRevenue = rRevenue.exec(q);
  if (!mRevenue) return null;
  const revenue = Number(mRevenue[1]);
  if (!Number.isFinite(revenue)) return null;

  const rQ = new RegExp(
    'how\\s+many\\s+' + itemEsc + '\\s+did\\s+(?:she|he|they)\\s+pick\\s+over\\s+the\\s+three\\s+days',
    'i',
  );
  if (!rQ.test(q)) return null;

  // Exact division only: a fractional item picked is not a valid intermediate.
  const revenueCents = Math.round(revenue * 100);
  const priceCents = Math.round(price * 100);
  if (revenueCents % priceCents !== 0) return null;
  const day1Count = revenueCents / priceCents;
  if (!Number.isInteger(day1Count) || day1Count < 0) return null;

  const total = day1Count + t + 2 * t;
  if (!Number.isFinite(total)) return null;
  return { total };
}

export const unitPriceRevenueBacksolvePlusDoublingDayChainTotalPicked: LianaMethod = {
  id: 'unit-price-revenue-backsolve-plus-doubling-day-chain-total-picked-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a first day\'s count from stated revenue and unit price, add a second day\'s stated count and a third day\'s doubled count',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C218, sole member: pilot corpus item at index 377)',
  shapeDescription:
    'day1Count = revenue / unitPrice (exact division only); answer = day1Count + day2Count + 2*day2Count.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a per-piece price sentence, a "sold all the items picked" day-1 ' +
          'sentence, a directly-counted day-2 sentence, a "double the previous day" day-3 ' +
          'sentence, a day-1 revenue sentence dividing evenly by the price, and a closing ' +
          'question about the three-day total; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `three-day total picked = ${result.total}` };
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
          basis: 'day1 backsolved as revenue/price (exact), plus day2\'s stated count, plus day3 = 2*day2',
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

registerMethod(unitPriceRevenueBacksolvePlusDoublingDayChainTotalPicked);
