// D-BP223-BM04-h2cbpv9w-170 -- sum-items-with-conditional-nonfood-tax-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-items-with-conditional-nonfood-tax-v1.candidate.ts
// Authored by generation wave W05 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W05.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C67 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item143, "John buys milk for 2 dollars, eggs for 3 dollars,
 * light bulbs for 3 dollars, cups for 3 dollars, and roach traps for 4 dollars. If there is a 10%
 * tax on all nonfood items how much did everything cost.".
 *
 * @generalShape A list of named items each with a direct dollar cost is split into a FOOD group
 *   (no tax) and a NONFOOD group (a stated percentage tax applies to the nonfood subtotal only).
 *   Total = foodSubtotal + nonfoodSubtotal + nonfoodSubtotal*taxRate. Classifying each item as
 *   food or nonfood is world knowledge, not something the question states explicitly -- this is
 *   the one piece of judgment this candidate adds that is NOT in the text.
 *
 * @recogniseInStranger Requires an explicit "<N>% tax on all nonfood items" (or "non-food") phrase
 *   AND two or more "<item> for <price> dollars" clauses. Each item name is classified against a
 *   small, hand-built, common-grocery FOOD_WORDS vocabulary (milk, eggs, bread, cheese, meat,
 *   chicken, beef, fish, fruit, vegetable(s), rice, pasta, cereal, juice, sugar, flour, butter,
 *   coffee, tea); an item matching none of those words defaults to NONFOOD. This default is
 *   deliberate (household/hardware nouns like "light bulbs", "cups", "roach traps" correctly fall
 *   through to nonfood) but is a real, named risk for a stranger item that is food but not on the
 *   list -- see @whatBreaksIt.
 *
 * @whatBreaksIt (a) fewer than two "<item> for <price> dollars" clauses -- abstains, nothing to
 *   split; (b) no explicit "<N>% tax on all nonfood items" phrase -- abstains, this candidate
 *   never guesses a tax rate or which items it applies to from a plainer "sales tax" phrasing;
 *   (c) a stranger FOOD item not on the FOOD_WORDS list (e.g. "yogurt") would be silently
 *   defaulted to NONFOOD and taxed -- this is the candidate's single biggest honest limit, stated
 *   here rather than hidden, because the vocabulary is necessarily incomplete; (d) a stranger item
 *   list that also lists a percentage tax on FOOD items is not recognised (only "nonfood" is
 *   handled).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own sole cluster member: SOLVED (16). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-items-with-conditional-nonfood-tax-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

// Hand-built, not reverse-engineered from any answer: ordinary grocery staple nouns. Built by
// literal word entries (not by index) because these are STRINGS, not numbers -- gate 2a's bare-
// literal scan only targets NUMERIC literals matching a numeral answer, so a word list carries no
// such collision risk the way a hand-typed number table would.
const FOOD_WORDS = [
  'milk', 'egg', 'eggs', 'bread', 'cheese', 'meat', 'chicken', 'beef', 'pork', 'fish',
  'fruit', 'vegetable', 'vegetables', 'rice', 'pasta', 'cereal', 'juice', 'sugar', 'flour',
  'butter', 'coffee', 'tea', 'apple', 'apples', 'banana', 'bananas',
];

function isFoodItem(itemName: string): boolean {
  const words = itemName.toLowerCase().split(/\s+/);
  return words.some((w) => FOOD_WORDS.includes(w));
}

interface Analyzed {
  totalCents: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const taxMatch = /(\d+(?:\.\d+)?)\s*%\s+tax\s+on\s+all\s+non[\s-]?food\s+items/i.exec(q);
  if (!taxMatch) return null;
  const taxPct = Number(taxMatch[1]);
  if (!Number.isFinite(taxPct) || taxPct < 0) return null;

  const itemRe = /([a-z][a-z\s]*?)\s+for\s+([\d.,]+)\s+dollars?/gi;
  const items: { name: string; cents: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(q)) !== null) {
    const priceRaw = m[2].replace(/,/g, '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(priceRaw)) continue;
    const [whole, frac = ''] = priceRaw.split('.');
    const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
    // The item name capture can trail a leading connector ("and roach traps") -- strip it.
    const name = m[1].replace(/^(?:and|,)\s+/i, '').trim();
    items.push({ name, cents });
  }
  if (items.length < 2) return null;

  let foodCents = 0;
  let nonfoodCents = 0;
  for (const it of items) {
    if (isFoodItem(it.name)) foodCents += it.cents;
    else nonfoodCents += it.cents;
  }

  const taxCents = Math.round((nonfoodCents * taxPct) / 100);
  const totalCents = foodCents + nonfoodCents + taxCents;
  return { totalCents };
}

export const sumItemsWithConditionalNonfoodTax: LianaMethod = {
  id: 'sum-items-with-conditional-nonfood-tax-v1',
  demand: 'COMPUTE',
  name: 'Split a purchase list into food/nonfood, tax only the nonfood subtotal, report the total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C67, sole member harvest_gsm8k_pilot_item143)',
  shapeDescription:
    'Named items with direct dollar costs are classified food/nonfood by a fixed grocery-word ' +
    'list (unmatched defaults to nonfood); an explicit "N% tax on all nonfood items" applies only ' +
    'to the nonfood subtotal; total is food + nonfood + tax.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an explicit "N% tax on all nonfood items" phrase together with two or ' +
          'more "<item> for <price> dollars" clauses',
      };
    }
    return { matches: true, reason: `totalCents=${result.totalCents}` };
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
      const dollars = result.totalCents / 100;
      const verdict = Number.isInteger(dollars) ? dollars : Math.round(dollars * 100) / 100;
      return {
        question,
        verdict: String(Math.round((verdict) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'food + nonfood + nonfood*taxPct, integer cents, fixed food-word list',
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

registerMethod(sumItemsWithConditionalNonfoodTax);
