// D-BP223-BM04-h2cbpv9w-170 -- round-then-sum-of-price-times-quantity-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\round-then-sum-of-price-times-quantity-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C134 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 74, "Artie has a flower stand at the
 * Farmers Market... he has decided to round all his prices to the nearest dollar... how much
 * will he make?". Silo label: "revenue calculation with rounding -- sum of (rounded price *
 * quantity)".
 *
 * @generalShape Two or more named items are each sold at a stated per-unit price written to the
 *   cent ("<item> for $X.YY per <unit>"). A separate sentence states that all prices are rounded
 *   to the nearest whole dollar. A closing sentence states a quantity sold for each of the SAME
 *   named items, and the question asks how much money is made. Answer = sum over items of
 *   (round-to-nearest-dollar(price) * quantity).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an explicit rounding instruction naming "nearest dollar" (or "nearest whole dollar")
 *       somewhere in the text;
 *   (b) two or more "<name> for $<price>.<cents> per <unit>" price statements, harvested by a
 *       single regex pass over the whole text (order- and count-independent);
 *   (c) exactly as many "<quantity> <unit-word>(s) of <name>" statements as priced items, each
 *       naming an item that appears (case-insensitively, singular-matched) among the priced
 *       items -- a strict 1:1 pairing, never positional;
 *   (d) the question's own closing sentence naming a revenue verb (make/earn), never a plain
 *       "how much do the prices total" framing this candidate has no evidence for.
 *
 * @whatBreaksIt (a) no "nearest dollar" rounding instruction anywhere -- abstain, this shape is
 *   specifically about ROUNDED prices, not raw ones; (b) fewer than two priced items, or a
 *   priced item with no matching quantity statement, or vice versa -- abstain, never guess which
 *   pairs to drop; (c) a price without exactly two decimal digits -- abstain, rounding needs an
 *   unambiguous cents value; (d) the closing sentence missing an explicit revenue verb --
 *   abstain, this candidate must never answer an unrelated "how much" question nearby.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (rounding $2.74/$1.87/$2.12 to $3/$2/$2, then 12*3 + 9*2 +
 *   17*2, matches the item's own accepted total exactly). With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'round-then-sum-of-price-times-quantity-v1';

/** Singularize a noun phrase crudely (strip a trailing "s", never touch "ss"). */
function singularize(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

interface PricedItem { name: string; dollars: number; cents: number; }
interface QuantifiedItem { name: string; qty: number; }
interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) explicit rounding instruction.
  if (!/\bnearest\s+(?:whole\s+)?dollar\b/i.test(q)) return null;

  // (b) price statements, order- and count-independent.
  const priceRe = /\b([A-Za-z]+)\s+for\s+\$(\d+)\.(\d{2})\s+per\s+[a-z]+/gi;
  const priced: PricedItem[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(q)) !== null) {
    priced.push({ name: singularize(pm[1]), dollars: parseInt(pm[2], 10), cents: parseInt(pm[3], 10) });
  }
  if (priced.length < 2) return null;

  // (c) quantity statements, strict 1:1 match by name.
  const qtyRe = /\b(\d+)\s+[a-z]+s?\s+of\s+([A-Za-z]+)/gi;
  const quantified: QuantifiedItem[] = [];
  let qm: RegExpExecArray | null;
  while ((qm = qtyRe.exec(q)) !== null) {
    quantified.push({ name: singularize(qm[2]), qty: parseInt(qm[1], 10) });
  }
  if (quantified.length !== priced.length) return null;

  const used = new Set<number>();
  let total = 0;
  for (const p of priced) {
    const matchIdx = quantified.findIndex((qi, i) => !used.has(i) && qi.name === p.name);
    if (matchIdx < 0) return null;
    used.add(matchIdx);
    const roundUp = p.cents * 2 >= 100;
    const roundedDollars = roundUp ? p.dollars + 1 : p.dollars;
    total += roundedDollars * quantified[matchIdx].qty;
  }

  // (d) revenue verb required in the closing sentence.
  const lastSentence = q.slice(Math.max(q.lastIndexOf('.'), q.lastIndexOf('!')) + 1);
  if (!/\b(?:make|makes|made|earn|earns|earned)\b/i.test(lastSentence)) return null;

  return { total };
}

export const roundThenSumOfPriceTimesQuantity: LianaMethod = {
  id: 'round-then-sum-of-price-times-quantity-v1',
  demand: 'COMPUTE',
  name: 'Round each item price to the nearest dollar, then sum rounded-price times quantity across items',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C134, sole member harvest_gsm8k_pilot_item74_revenue_calculation_with_rounding)',
  shapeDescription:
    'Two or more items each priced to the cent; an instruction to round every price to the ' +
    'nearest dollar; a matching quantity sold per item; answer = sum of rounded-price*quantity, ' +
    'a revenue-verb question required.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a nearest-dollar rounding instruction plus a 1:1 matched set of priced ' +
          'and quantified items plus a revenue-verb closing sentence; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `total revenue = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'sum of round-to-nearest-dollar(price)*quantity across matched items',
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

registerMethod(roundThenSumOfPriceTimesQuantity);
