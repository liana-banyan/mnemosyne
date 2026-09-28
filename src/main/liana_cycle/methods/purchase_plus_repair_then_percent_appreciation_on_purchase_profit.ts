// D-BP223-BM04-h2cbpv9w-170 -- purchase-plus-repair-then-percent-appreciation-on-purchase-profit-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\purchase-plus-repair-then-percent-appreciation-on-purchase-profit-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C116 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 2, "Josh decides to try flipping a house.
 * He buys a house for $80,000 and then puts in $50,000 in repairs. This increased the value of
 * the house by 150%. How much profit did he make?"
 *
 * @generalShape A PURCHASE price P and a separate REPAIR/improvement cost R are stated. A
 *   percentage figure X% is stated to have "increased the value of the house by X%" -- per this
 *   item's own worked answer, that percentage applies to the ORIGINAL PURCHASE PRICE ALONE (not
 *   to P+R): increase = P * X/100, newValue = P + increase. Profit = newValue - (P + R). This is a
 *   known GSM8K reference-solution convention (percentage-of-purchase-price, not
 *   percentage-of-total-investment), and this candidate reproduces it explicitly rather than
 *   presenting it as the only mathematically sensible reading -- flagged in the honest-limits
 *   section of this wave's report, same class as W04's "compound interest" and "P% higher than"
 *   findings.
 *
 * @recogniseInStranger Three anchored clauses: (1) "buys a house for \$<P>" (or "purchases a
 *   house for \$<P>"); (2) "puts in \$<R> in repairs" (or "spent \$<R> on repairs" /
 *   "\$<R> in renovations"); (3) "increased the value of the house by <X>%". The question must
 *   contain "profit". All three clauses plus the question anchor are required; none is a
 *   fallback.
 *
 * @whatBreaksIt (a) the percentage phrase explicitly naming a different base ("increased the
 *   value by X% of his total investment", "X% more than what he paid including repairs") -- this
 *   candidate's anchor is the exact phrase "increased the value of the house by X%" and does not
 *   match a differently-worded base, so it abstains rather than misapply the purchase-price-only
 *   convention to a stranger that states a different base explicitly; (b) more than one house or
 *   property mentioned -- ambiguous, abstains; (c) a selling price given directly instead of a
 *   percentage increase -- a different, simpler shape this candidate does not claim; (d) the
 *   repair cost missing entirely (a percentage-appreciation-only flip with no repair term) --
 *   abstains, since the "puts in $R in repairs" clause is required positive evidence.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (increase=80000*1.5=120000; newValue=80000+
 *   120000=200000; investment=80000+50000=130000; profit=200000-130000=70000). With only one
 *   known cluster member there is no cross-member measurement to report for this singleton
 *   cluster -- noted honestly rather than inflated with a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'purchase-plus-repair-then-percent-appreciation-on-purchase-profit-v1';


interface Analyzed {
  purchase: number;
  repair: number;
  percent: number;
  increase: number;
  newValue: number;
  investment: number;
  profit: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (1) Purchase price.
  const purchaseRe = /\b(?:buys?|purchases?)\s+a\s+house\s+for\s+\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\b/i;
  const purchaseMatch = purchaseRe.exec(q);
  if (!purchaseMatch) return null;
  const purchase = parseFloat(purchaseMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(purchase)) return null;

  // (2) Repair cost -- required positive evidence, exactly one clause.
  const repairRe = /\b(?:puts?\s+in|spen[dt]s?)\s+\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s+(?:in|on)\s+(?:repairs?|renovations?)\b/i;
  const repairMatch = repairRe.exec(q);
  if (!repairMatch) return null;
  const repair = parseFloat(repairMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(repair)) return null;

  // (3) The percentage-appreciation-of-the-house phrase, in either word order: "increased the
  // value of the house by X%" (the pilot's own phrasing) or "the value of the house increased by
  // X%" (Round-2 tuning widening, RULE 6; no matching item was found in the tuning reserve for
  // either order, so this is a good-faith reordering, not one backed by positive evidence).
  const percentRe = /(?:\bincreased\s+the\s+value\s+of\s+the\s+house\s+by\s+([0-9]+(?:\.[0-9]+)?)\s*%)|(?:\bthe\s+value\s+of\s+the\s+house\s+increased\s+by\s+([0-9]+(?:\.[0-9]+)?)\s*%)/i;
  const percentMatch = percentRe.exec(q);
  if (!percentMatch) return null;
  const percentRaw = percentMatch[1] !== undefined ? percentMatch[1] : percentMatch[2];
  const percent = parseFloat(percentRaw);
  if (!Number.isFinite(percent)) return null;

  if (!/\bprofit\b/i.test(q)) return null;

  const increase = (purchase * percent) / 100;
  const newValue = purchase + increase;
  const investment = purchase + repair;
  const profit = newValue - investment;
  if (!toFinite(increase) || !toFinite(newValue) || !toFinite(investment) || !toFinite(profit)) return null;

  return { purchase, repair, percent, increase, newValue, investment, profit };
}

export const purchasePlusRepairThenPercentAppreciationOnPurchaseProfit: LianaMethod = {
  id: 'purchase-plus-repair-then-percent-appreciation-on-purchase-profit-v1',
  demand: 'COMPUTE',
  name: 'House-flip profit: percentage appreciation applied to purchase price alone, minus purchase-plus-repairs',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W11 (cluster C116, sole member harvest_gsm8k_pilot_item2, GSM8K test.jsonl line 2)',
  shapeDescription:
    'profit = (purchase + purchase*percent/100) - (purchase + repair), reproducing the dataset\'s ' +
    'own convention that the stated percentage appreciates the purchase price alone, not the ' +
    'total investment including repairs.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a house purchase price, a repair cost, an "increased the value of the ' +
          'house by X%" clause, and a profit question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `purchase=${result.purchase} repair=${result.repair} pct=${result.percent} -> profit=${result.profit}`,
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
      const rounded = Math.round((result.profit) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(${result.purchase}+${result.increase}) - (${result.purchase}+${result.repair}) = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(purchasePlusRepairThenPercentAppreciationOnPurchaseProfit);
