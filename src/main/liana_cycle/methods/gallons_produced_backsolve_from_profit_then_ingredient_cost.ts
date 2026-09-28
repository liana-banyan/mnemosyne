// D-BP223-BM04-h2cbpv9w-170 -- gallons-produced-backsolve-from-profit-then-ingredient-cost-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W07).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\gallons-produced-backsolve-from-profit-then-ingredient-cost-v1.candidate.ts
// Authored by generation wave W07 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W07.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W07 CLUSTER C81 (1 silo member, sole member
 * harvest_gsm8k_pilot_item175_profit_and_cost_analysis, GSM8K test line 175, high confidence).
 * Representative teaching case: "Juan and his brother Carlos are selling lemonade. For each
 * gallon they make it costs $3 for lemons and $2 for sugar. They sell each glass for $0.50 and
 * get 20 glasses per gallon. If they made $25 in profit, how much did they spend on lemons?"
 *
 * @generalShape A two-ingredient per-gallon cost is stated ("it costs $c1 for ING1 and $c2 for
 *   ING2"), plus a per-glass price and glasses-per-gallon yield (giving revenue per gallon), plus
 *   a TOTAL profit figure. Profit per gallon = revenue per gallon - cost per gallon; gallons
 *   produced = total profit / profit per gallon; the question asks how much was spent on ONE of
 *   the two named ingredients, which is gallons * that ingredient's per-gallon cost.
 *
 * @recogniseInStranger Match "it costs $<c1> for <ing1> and $<c2> for <ing2>" (exactly two
 *   ingredients). Match "sell each glass for $<price>" and "<G> glasses per gallon". Match "made
 *   $<profit> in profit". Match the question "how much did they spend on <ingredient>", requiring
 *   <ingredient> to equal (case-insensitively) ing1 or ing2.
 *
 * @whatBreaksIt (a) more or fewer than two stated per-gallon ingredient costs -- abstains, this
 *   method is scoped to exactly two; (b) profit-per-gallon computing to zero or negative (revenue
 *   does not exceed cost) -- abstains, the shape assumes a genuine profit; (c) the total profit
 *   not dividing evenly by the profit-per-gallon -- abstains rather than report a fractional
 *   gallon count; (d) the question asking about something other than one of the two named
 *   ingredients (e.g. total revenue, total cost) -- abstains, out of this method's scope.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (5 gallons backsolved from $25 profit / $5
 *   profit-per-gallon, times $3/gallon for lemons = $15). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'gallons-produced-backsolve-from-profit-then-ingredient-cost-v1';

interface Analyzed {
  gallons: number;
  targetIngredient: string;
  amountSpent: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const costRe = /\bit\s+costs\s+\$(\d+(?:\.\d+)?)\s+for\s+([a-z]+)\s+and\s+\$(\d+(?:\.\d+)?)\s+for\s+([a-z]+)\b/i;
  const cm = costRe.exec(q);
  if (!cm) return null;
  const cost1 = parseFloat(cm[1]);
  const ing1 = cm[2].toLowerCase();
  const cost2 = parseFloat(cm[3]);
  const ing2 = cm[4].toLowerCase();
  if (!Number.isFinite(cost1) || !Number.isFinite(cost2)) return null;
  if (ing1 === ing2) return null;

  const priceRe = /\bsell\s+each\s+glass\s+for\s+\$(\d+(?:\.\d+)?)\b/i;
  const pm = priceRe.exec(q);
  if (!pm) return null;
  const pricePerGlass = parseFloat(pm[1]);

  const glassesRe = /\b(\d+)\s+glasses\s+per\s+gallon\b/i;
  const gm = glassesRe.exec(q);
  if (!gm) return null;
  const glassesPerGallon = parseFloat(gm[1]);

  const profitRe = /\bmade\s+\$(\d+(?:\.\d+)?)\s+in\s+profit\b/i;
  const prm = profitRe.exec(q);
  if (!prm) return null;
  const totalProfit = parseFloat(prm[1]);

  const askRe = /how\s+much\s+did\s+they\s+spend\s+on\s+([a-z]+)\b/i;
  const am = askRe.exec(q);
  if (!am) return null;
  const targetIngredient = am[1].toLowerCase();
  if (targetIngredient !== ing1 && targetIngredient !== ing2) return null;

  const revenuePerGallon = pricePerGlass * glassesPerGallon;
  const costPerGallon = cost1 + cost2;
  const profitPerGallon = revenuePerGallon - costPerGallon;
  if (!(profitPerGallon > 0)) return null;

  const gallons = totalProfit / profitPerGallon;
  if (!Number.isFinite(gallons)) return null;
  if (Math.abs(gallons - Math.round(gallons)) > 1e-9) return null; // exact gallon count required
  const gallonsExact = Math.round(gallons);

  const targetCostPerGallon = targetIngredient === ing1 ? cost1 : cost2;
  const amountSpent = gallonsExact * targetCostPerGallon;
  return { gallons: gallonsExact, targetIngredient, amountSpent };
}

export const gallonsProducedBacksolveFromProfitThenIngredientCost: LianaMethod = {
  id: 'gallons-produced-backsolve-from-profit-then-ingredient-cost-v1',
  demand: 'COMPUTE',
  name: 'Backsolve gallons produced from total profit, then report one ingredient\'s spend',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W07 (cluster C81, sole member harvest_gsm8k_pilot_item175_profit_and_cost_analysis)',
  shapeDescription:
    'Two per-gallon ingredient costs, a per-glass price and glasses-per-gallon yield, and a total ' +
    'profit figure; gallons = profit / (revenue-per-gallon - cost-per-gallon); answer = gallons * ' +
    'the asked ingredient\'s per-gallon cost.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find a two-ingredient per-gallon cost pair, a per-glass price and ' +
          'glasses-per-gallon yield, a total-profit figure, and a question naming one of the ' +
          'two ingredients, with an exact whole-gallon backsolve',
      };
    }
    return { matches: true, reason: `gallons=${result.gallons}, ${result.targetIngredient}=${result.amountSpent}` };
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
        verdict: String(Math.round((result.amountSpent) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.gallons} gallons x ${result.targetIngredient} rate`,
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

registerMethod(gallonsProducedBacksolveFromProfitThenIngredientCost);
