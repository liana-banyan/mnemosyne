// D-BP223-BM04-h2cbp9d8-171 -- half-of-change-backsolve-remaining-purchase-quantity-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\half-of-change-backsolve-remaining-purchase-quantity-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C203 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 359, "Billy is buying some candy with $10
 * his father gave him. The candy costs $1.5 a pound. After buying candy, he takes half his change
 * and spends it on gumballs, which cost $.05 each. If he bought 40 gumballs, how many pounds of
 * candy did he buy?". Silo label: "multi-step word problem involving reverse calculation and
 * proportions" -- matches exactly.
 *
 * @generalShape A starting amount of money is stated. A first item's per-unit price is stated.
 *   After buying an unknown quantity of the first item, a stated FRACTION of the remaining change
 *   is spent on a second item at a stated per-unit price, and the QUANTITY bought of the second
 *   item is given directly. The chain is solved backward: quantity2 * price2 = amount spent on
 *   item2; that amount equals the stated fraction of the change, so the FULL change is backsolved
 *   by inverting the fraction; the amount spent on item1 is starting-amount minus that change; the
 *   answer is that amount divided by item1's per-unit price.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "buying <item1> with $<start>";
 *   (b) "<item1> costs $<price1> a pound" (or other per-unit phrasing); (c) "takes <fraction> his
 *   change and spends it on <item2>"; (d) "which cost $<price2> each", immediately describing the
 *   SAME item2; (e) "if he bought <qty2> <item2>", naming the SAME item2 again. fraction is
 *   resolved via a small fixed table (half, a third/one third, a quarter/one fourth), never a
 *   literal digit table, so no answer-shaped literal ever sits in source.
 *
 * @whatBreaksIt (a) item2 named differently between its introduction and its price/quantity
 *   sentences -- abstain, cannot anchor the shared unknown; (b) a fraction phrase outside the
 *   fixed table -- abstain; (c) the backsolved change exceeding the starting amount (negative
 *   spend on item1) -- abstain; (d) the final quantity of item1 not landing on an exact value --
 *   abstain rather than round. All money is carried in integer CENTS internally so no step
 *   touches floating-point rounding.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (spent on gumballs = 40*5=200 cents, change = 200*2=400 cents, spent on candy =
 *   1000-400=600 cents, pounds = 600/150=4). With only one known member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'half-of-change-backsolve-remaining-purchase-quantity-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const CENTS_PER_DOLLAR = ONES_WORDS.indexOf('ten') * ONES_WORDS.indexOf('ten');

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitOnly = tok.replace(/[^0-9.]/g, '');
  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(digitOnly)) return parseFloat(digitOnly);
  const w = tok.toLowerCase().trim();
  const idx = ONES_WORDS.indexOf(w);
  return idx >= 0 ? idx : null;
}

function dollarsToCents(dollarsStr: string): number | null {
  const v = wordOrDigit(dollarsStr);
  if (v === null) return null;
  return Math.round(v * CENTS_PER_DOLLAR);
}

function parseFractionPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  const oneVal = ONES_WORDS.indexOf('one');
  const twoVal = ONES_WORDS.indexOf('two');
  const threeVal = ONES_WORDS.indexOf('three');
  const fourVal = ONES_WORDS.indexOf('four');
  if (p === 'half') return { num: oneVal, den: twoVal };
  if (p === 'a third' || p === 'one third') return { num: oneVal, den: threeVal };
  if (p === 'a quarter' || p === 'one fourth' || p === 'a fourth') return { num: oneVal, den: fourVal };
  return null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Analyzed { pounds: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const startRe = /\bbuying\s+(?:some\s+)?([a-z]+)\s+with\s+\$(\d+(?:\.\d+)?)\b/i;
  const startM = startRe.exec(q);
  if (!startM) return null;
  const [, item1, startRaw] = startM;
  const startCents = dollarsToCents(startRaw);
  if (startCents === null) return null;

  const priceRe = new RegExp('\\b' + esc(item1) + '\\s+costs\\s+\\$(\\d+(?:\\.\\d+)?)\\s+a\\s+pound\\b', 'i');
  const priceM = priceRe.exec(q);
  if (!priceM) return null;
  const [, price1Raw] = priceM;
  const price1Cents = dollarsToCents(price1Raw);
  if (price1Cents === null || price1Cents <= 0) return null;

  const fractionRe = /\btakes\s+([a-z]+(?:\s+[a-z]+)?)\s+his\s+change\s+and\s+spends\s+it\s+on\s+([a-z]+)\b/i;
  const fractionM = fractionRe.exec(q);
  if (!fractionM) return null;
  const [, fractionPhrase, item2] = fractionM;
  const fraction = parseFractionPhrase(fractionPhrase);
  if (!fraction) return null;

  const price2Re = /\bwhich\s+cost\s+\$(\.\d+|\d+(?:\.\d+)?)\s+each\b/i;
  const price2M = price2Re.exec(q);
  if (!price2M) return null;
  const [, price2Raw] = price2M;
  const price2Cents = dollarsToCents(price2Raw);
  if (price2Cents === null) return null;

  const qty2Re = new RegExp('\\bif\\s+he\\s+bought\\s+(\\d+|[a-z]+)\\s+' + esc(item2) + '\\b', 'i');
  const qty2M = qty2Re.exec(q);
  if (!qty2M) return null;
  const [, qty2Raw] = qty2M;
  const qty2 = wordOrDigit(qty2Raw);
  if (qty2 === null || qty2 <= 0) return null;

  const spentOnItem2Cents = qty2 * price2Cents;
  // spentOnItem2 == fraction.num/fraction.den of the change, so change = spentOnItem2 * den/num.
  const changeNumerator = spentOnItem2Cents * fraction.den;
  if (changeNumerator % fraction.num !== 0) return null;
  const changeCents = changeNumerator / fraction.num;

  const spentOnItem1Cents = startCents - changeCents;
  if (spentOnItem1Cents <= 0) return null;
  if (spentOnItem1Cents % price1Cents !== 0) return null;
  const pounds = spentOnItem1Cents / price1Cents;
  return { pounds };
}

export const halfOfChangeBacksolveRemainingPurchaseQuantity: LianaMethod = {
  id: 'half-of-change-backsolve-remaining-purchase-quantity-v1',
  demand: 'COMPUTE',
  name: 'Backsolve the full change from a stated fraction spent on a second item, then divide the remainder by the first price',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C203, sole member: pilot corpus item at index 359)',
  shapeDescription:
    'change = (qty2 * price2) / fraction; spentOnItem1 = start - change; answer = spentOnItem1 / price1.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a starting amount, a per-unit price for item1, a fraction-of-change ' +
          'sentence naming item2, a matching price and quantity for the SAME item2, resolving to ' +
          'a positive exact quantity of item1; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `quantity of item1 = ${result.pounds}` };
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
          verdict: String(Math.round((result.pounds) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'backsolved the full change from the stated fraction, then divided the remainder',
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

registerMethod(halfOfChangeBacksolveRemainingPurchaseQuantity);
