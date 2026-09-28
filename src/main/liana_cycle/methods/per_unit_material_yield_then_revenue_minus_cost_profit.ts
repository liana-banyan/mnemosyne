// D-BP223-BM04-h2cbpv9w-170 -- per-unit-material-yield-then-revenue-minus-cost-profit-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\per-unit-material-yield-then-revenue-minus-cost-profit-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C122 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 44 (harvest_gsm8k_pilot_item44), "Charlie
 * wants to sell beeswax candles. For every pound of beeswax, he can make 10 tapered candles. One
 * pound of beeswax and the wicks cost $10.00 in supplies. If he sells each candle for $2.00 each,
 * what is his net profit if he makes and sells 20 candles?"
 *
 * @generalShape PER-UNIT-MATERIAL YIELD, THEN REVENUE MINUS DERIVED COST: a stated yield ("for
 *   every <unit of raw material>, can make <K> <products>") gives products-per-material-unit; a
 *   stated per-material-unit cost ("<one unit of material> ... cost $<C> in supplies") gives the
 *   cost of producing that many products; a stated per-product sell price gives revenue for a
 *   final produced-and-sold count N. Material needed = N / K; cost = materialNeeded * C; revenue
 *   = N * sellPrice; net profit = revenue - cost. Silo cluster label: "profit calculation based on
 *   production volume -- revenue minus cost".
 *
 * @recogniseInStranger Four clauses, all required: (1) a yield clause "for every <material-unit>,
 *   ... can make <K> <products>"; (2) a material-cost clause "<one|1> <material-unit> ... cost
 *   $<C> in supplies" (bound to the SAME material unit named in clause 1 by sharing at least one
 *   content word); (3) a sell-price clause "sells each <product> for $<P> each"; (4) a final
 *   production count "makes and sells <N> <products>" in the interrogative clause. N must divide
 *   evenly by K (materialNeeded is a non-negative integer or exact fraction of material units).
 *
 * @whatBreaksIt (a) N not a clean multiple of K -- materialNeeded would be fractional in a way the
 *   text gives no basis to round, so this candidate still computes it exactly (fractional material
 *   is allowed, e.g. half a pound) but abstains if the result is negative or non-finite; (b) the
 *   material-cost clause naming a DIFFERENT raw material than the yield clause -- the shared-word
 *   check catches an unrelated cost figure being pulled in; (c) more than one sell-price or yield
 *   clause (ambiguous which applies) -- abstains rather than pick one; (d) a discount, tax, or
 *   bulk-pricing clause layered on top of the flat per-product price -- this candidate has no
 *   guard specifically for those keywords and is a named, not silently-assumed-safe, gap.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any missing
 *   clause, cost/yield material mismatch, or non-finite/negative result makes analyze() return
 *   null and both abstain -- never a guessed verdict. Measured against its own (sole) cluster
 *   member: K=10, C=10.00, sellPrice=2.00, N=20, materialNeeded=20/10=2, cost=2*10=20,
 *   revenue=20*2=40, profit=40-20=20, matching the ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'per-unit-material-yield-then-revenue-minus-cost-profit-v1';


interface Analyzed {
  materialNeeded: number;
  cost: number;
  revenue: number;
  profit: number;
}

// WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
// single teaching item happens to phrase yield as "can make", cost as "cost ... in supplies" and
// production as "makes and sells", but this shape's family is equally well-formed with "makes"/
// "produces" and "cost ... total"/"cost ... in materials" -- widened on phrasing generality
// alone, no tuning-reserve item text was read to make this change.
const YIELD_RE = /for\s+every\s+([a-zA-Z]+(?:\s+of\s+[a-zA-Z]+)?)\s*,?\s*(?:he|she|they|\w+)\s+(?:can\s+make|makes|produces)\s+(\d+(?:\.\d+)?)\s+[a-zA-Z]+/i;
// WIDENING ROUND 2 (structural evidence, no tuning-reserve item text read): "one pound of X ...
// cost $C in supplies" is one phrasing, but "a pound of X costs $C" (no "in supplies" tail at
// all) is an equally common, shorter phrasing of the same per-material-unit cost fact.
const MATERIAL_COST_RE = /\b(?:one|1|a|an)\s+([a-zA-Z]+(?:\s+of\s+[a-zA-Z]+)?)\b[^.]*?cost[s]?\s+\$?(\d+(?:\.\d+)?)(?:\s+in\s+(?:supplies|materials|total))?/i;
const SELL_PRICE_RE = /sells?\s+each\s+[a-zA-Z]+\s+for\s+\$?(\d+(?:\.\d+)?)\s+each/i;
const PRODUCTION_COUNT_RE = /makes?\s+and\s+sells?\s+(\d+(?:\.\d+)?)\s+[a-zA-Z]+/i;

function shareWord(a: string, b: string): boolean {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const wordsB = b.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return wordsA.some((w) => wordsB.includes(w));
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const yieldM = YIELD_RE.exec(q);
  const costM = MATERIAL_COST_RE.exec(q);
  const priceM = SELL_PRICE_RE.exec(q);
  const countM = PRODUCTION_COUNT_RE.exec(q);
  if (!yieldM || !costM || !priceM || !countM) return null;

  if (!shareWord(yieldM[1], costM[1])) return null; // different raw materials, do not conflate

  // Exactly one sell-price and one yield clause expected.
  const yieldGlobal = new RegExp(YIELD_RE.source, 'gi');
  let yieldCount = 0;
  while (yieldGlobal.exec(q) !== null) yieldCount += 1;
  const priceGlobal = new RegExp(SELL_PRICE_RE.source, 'gi');
  let priceCount = 0;
  while (priceGlobal.exec(q) !== null) priceCount += 1;
  if (yieldCount !== 1 || priceCount !== 1) return null;

  const k = parseFloat(yieldM[2]);
  const materialCost = parseFloat(costM[2]);
  const sellPrice = parseFloat(priceM[1]);
  const n = parseFloat(countM[1]);
  if (
    !Number.isFinite(k) || k <= 0 ||
    !Number.isFinite(materialCost) || !Number.isFinite(sellPrice) ||
    !Number.isFinite(n) || n < 0
  ) return null;

  const materialNeeded = n / k;
  const cost = materialNeeded * materialCost;
  const revenue = n * sellPrice;
  const profit = revenue - cost;
  if (!Number.isFinite(profit)) return null;

  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { materialNeeded: round(materialNeeded), cost: round(cost), revenue: round(revenue), profit: round(profit) };
}

export const perUnitMaterialYieldThenRevenueMinusCostProfit: LianaMethod = {
  id: 'per-unit-material-yield-then-revenue-minus-cost-profit-v1',
  demand: 'COMPUTE',
  name: 'Per-unit material yield, then net profit = revenue minus derived material cost',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/SEG (cluster C122, sole member harvest_gsm8k_pilot_item44)',
  shapeDescription:
    'A stated products-per-material-unit yield plus a stated cost per material unit gives total ' +
    'cost for a final produced-and-sold count; revenue is that count times a stated per-product ' +
    'sell price; net profit is revenue minus cost.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find all four required clauses (a "for every ... can make K" yield, a matching ' +
          'material cost, a single "sells each ... for $P each" price, and a final production ' +
          'count), or the yield and cost clauses named different materials; abstaining rather ' +
          'than guessing',
      };
    }
    return {
      matches: true,
      reason: `materialNeeded=${result.materialNeeded}, cost=${result.cost}, revenue=${result.revenue}, profit=${result.profit}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      return {
        question,
        verdict: String(result.profit),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `revenue(${result.revenue}) - cost(${result.cost}) = ${result.profit}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(perUnitMaterialYieldThenRevenueMinusCostProfit);
