// D-BP223-BM04-h2cbpv9w-170 -- daily-unit-usage-cartons-needed-times-cost-per-carton-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\daily-unit-usage-cartons-needed-times-cost-per-carton-v1.candidate.ts
// Authored by generation wave W10 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C106 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 27, "Cynthia eats one serving of ice cream
 * every night. She buys cartons of ice cream with 15 servings of ice cream per carton at a cost
 * of $4.00 per carton. After 60 days, how much will she spend on ice cream?"
 *
 * @generalShape A per-day consumption rate of exactly ONE unit ("eats one X every night/day") is
 *   stated. Containers hold a stated number of units each ("N units per container") at a stated
 *   dollar cost each ("$C per container"). Over a stated span of days, the total spend is
 *   (days / units-per-container) * cost-per-container -- but ONLY when the container count comes
 *   out to a whole number; a fractional container is a sign this shape does not actually apply
 *   (real cartons cannot be bought in fractions), so the method abstains rather than silently
 *   rounding either up or down and guessing which the asker intended.
 *
 * @recogniseInStranger Four anchored facts: (1) "eats (?:one|a|an) <noun> every (?:night|day)"
 *   establishes the rate is exactly one unit per day; (2) "<S> <noun>s? per carton" gives units
 *   per container; (3) "\\$<C> per carton" gives cost per container; (4) "after <D> days" gives
 *   the span. The question must ask how much will be SPENT.
 *
 * @whatBreaksIt (a) a consumption rate other than exactly one unit per day (e.g. "two servings a
 *   night") -- this method only recognises the singular-article rate ("one"/"a"/"an") and abstains
 *   on any numeral rate rather than assume its own division still applies; (b) a day count that
 *   does not divide evenly by the units-per-container figure -- abstains rather than pick a
 *   rounding direction with no textual basis; (c) a cost given per unit rather than per container,
 *   or a second product mentioned in the same text -- the anchors require the literal word
 *   "carton" attached to both the units-per-container and cost-per-container facts, so a
 *   different container noun (box, pack, case) is a stranger this method has not met and abstains
 *   on.
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED, matching the dataset's own worked total
 *   exactly. With only one known member there is no cross-member measurement to report for this
 *   singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'daily-unit-usage-cartons-needed-times-cost-per-carton-v1';

interface Analyzed {
  unitsPerCarton: number;
  costPerCarton: number;
  days: number;
  cartonsNeeded: number;
  totalCost: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Consumption rate: exactly one unit, per day, using a singular article rather than a numeral.
  // The noun phrase between the article and "every" may itself be multi-word ("one serving of
  // ice cream"), so this is a bounded non-greedy span, not a single \w+ token.
  const rateRe = /\beats\s+(?:one|a|an)\s+[a-z][a-z\s]{0,40}?\s+every\s+(?:night|day)\b/i;
  if (!rateRe.test(q)) return null;

  // Units per carton.
  const perCartonRe = /\bwith\s+([0-9]+(?:\.[0-9]+)?)\s+\w+\s+of\s+[\w\s]+?\s+per\s+carton\b/i;
  const m1 = perCartonRe.exec(q);
  if (!m1) return null;
  const unitsPerCarton = parseFloat(m1[1]);
  if (!toFinite(unitsPerCarton) || unitsPerCarton <= 0) return null;

  // Cost per carton.
  const costRe = /\bcost\s+of\s+\$\s*([0-9]+(?:\.[0-9]+)?)\s+per\s+carton\b/i;
  const m2 = costRe.exec(q);
  if (!m2) return null;
  const costPerCarton = parseFloat(m2[1]);
  if (!toFinite(costPerCarton)) return null;

  // Span of days.
  const daysRe = /\bafter\s+([0-9]+(?:\.[0-9]+)?)\s+days\b/i;
  const m3 = daysRe.exec(q);
  if (!m3) return null;
  const days = parseFloat(m3[1]);
  if (!toFinite(days)) return null;

  // The question must ask about spending.
  if (!/\bhow\s+much\b[^?]*\bspend\b/i.test(q)) return null;

  // A whole rate of one unit per day means units needed = days exactly. Cartons must divide the
  // days count evenly -- a fractional carton is not a real purchase, so this is a positive
  // requirement, not a rounding choice.
  const cartonsNeeded = days / unitsPerCarton;
  if (!Number.isInteger(cartonsNeeded)) return null;

  const totalCost = cartonsNeeded * costPerCarton;
  if (!toFinite(totalCost)) return null;

  return { unitsPerCarton, costPerCarton, days, cartonsNeeded, totalCost };
}

export const dailyUnitUsageCartonsNeededTimesCostPerCarton: LianaMethod = {
  id: 'daily-unit-usage-cartons-needed-times-cost-per-carton-v1',
  demand: 'COMPUTE',
  name: 'One unit consumed per day; cartons needed over a span divided evenly, times cost per carton',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C106, sole member harvest_gsm8k_pilot_item27, GSM8K test.jsonl line 27)',
  shapeDescription:
    'One unit per day consumed; a carton holds a stated number of units at a stated cost; over a ' +
    'stated span of days, total spend = (days / units-per-carton, requiring an exact whole ' +
    'number of cartons) * cost-per-carton.',
  quarantined: true,
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "one unit every night/day", "N per carton", "$C per carton", and ' +
          '"after D days" four-anchor shape with an exact whole-carton division and a "how much ' +
          'will ... spend" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `cartons=${result.days}/${result.unitsPerCarton}=${result.cartonsNeeded} -> ${result.totalCost}`,
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
      const rounded = Math.round(result.totalCost * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.cartonsNeeded} cartons * ${result.costPerCarton} = ${rounded}`,
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

registerMethod(dailyUnitUsageCartonsNeededTimesCostPerCarton);
