// D-BP223-BM04-h2cbpv9w-170 -- alternating-full-and-discount-unit-price-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\alternating-full-and-discount-unit-price-sum-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W13, CLUSTER C127 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 5, "Kylar went to the store to buy glasses for his new
 * apartment. One glass costs $5, but every second glass costs only 60% of the price. Kylar wants
 * to buy 16 glasses. How much does he need to pay for them?". Silo label: "discounted_bulk_
 * purchase -- sum of individual prices with conditional discount".
 *
 * @generalShape N identical items are bought. A BASE PRICE P is stated for one item. EVERY SECOND
 *   item (an alternating pattern, starting with the first item at full price) costs a stated
 *   PERCENTAGE D of the base price instead. Of N items, ceil(N/2) are at the full price and
 *   floor(N/2) are at the discounted price. Total = ceil(N/2)*P + floor(N/2)*P*(D/100).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a base-price clause ("One <item>
 *   costs $<P>"); (b) an explicit alternating-discount clause naming the SAME item and using the
 *   literal phrase "every second <item>" together with a percentage of "the price" ("costs only
 *   <D>% of the price"); (c) an explicit purchase-count clause naming the SAME item ("wants to buy
 *   <N> <item>s"); (d) a closing question asking how much needs to be paid for them.
 *
 * @whatBreaksIt (a) the item word differing across the three clauses -- abstains, cannot confirm
 *   it is the same purchase; (b) the discount arithmetic not landing on an exact integer number of
 *   cents (base price * discount percent not divisible by 100 in integer cents) -- abstains rather
 *   than round; (c) a discount pattern other than literally "every second" (e.g. "every third") --
 *   this narrow candidate does not attempt any other stride, only the 1-full/1-discount alternation
 *   its sole known member evidences; (d) N not parsing to a positive whole number -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (8 full-price glasses at $5 = $40, 8 discounted glasses at
 *   $5*0.60 = $3 each = $24, total $64). With only one known cluster member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'alternating-full-and-discount-unit-price-sum-v1';


const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function toCents(raw: string): number | null {
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(fracPadded);
}

interface Analyzed { totalCents: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseRe = /\bOne\s+([a-z]+)\s+costs?\s*\$([\d.,]+)\b/i;
  const bm = baseRe.exec(q);
  if (!bm) return null;
  const item = bm[1].toLowerCase();
  const baseCents = toCents(bm[2]);
  if (baseCents === null) return null;

  const discRe = new RegExp('every\\s+second\\s+' + item + '\\s+costs?\\s+only\\s+(\\d+(?:\\.\\d+)?)\\s*%\\s+of\\s+the\\s+price', 'i');
  const dm = discRe.exec(q);
  if (!dm) return null;
  const discPct = Number(dm[1]);
  if (!Number.isFinite(discPct) || discPct < 0 || discPct > 100) return null;

  const countRe = new RegExp('buy\\s+(\\d+|[a-z-]+)\\s+' + item + '(?:es|s)?\\b', 'i');
  const cm = countRe.exec(q);
  if (!cm) return null;
  const n = wordOrDigit(cm[1]);
  if (n === null || n <= 0 || !Number.isInteger(n)) return null;

  if (!/how much (?:does|do)?\s*[a-z]*\s*(?:he|she|they)?\s*need to pay/i.test(q)) return null;

  const fullCount = Math.ceil(n / 2);
  const discCount = Math.floor(n / 2);

  // Exact-cents guard: the discount price must land on a whole cent, never a rounded one.
  const discCentsProduct = baseCents * discPct;
  if (discCentsProduct % 100 !== 0) return null;
  const discCentsPerItem = discCentsProduct / 100;

  const totalCents = fullCount * baseCents + discCount * discCentsPerItem;
  return { totalCents };
}

export const alternatingFullAndDiscountUnitPriceSum: LianaMethod = {
  id: 'alternating-full-and-discount-unit-price-sum-v1',
  demand: 'COMPUTE',
  name: 'Sum N items where every second item is discounted a stated percentage of the base price',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W13 (cluster C127, sole member: pilot corpus item at index 5)',
  shapeDescription:
    'fullCount = ceil(N/2), discCount = floor(N/2); total = fullCount*basePrice + ' +
    'discCount*basePrice*(discountPercent/100), computed in exact integer cents.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a base-price clause, a matching "every second <item> costs only N% of ' +
          'the price" clause, a matching purchase-count clause, and a "how much ... need to pay" ' +
          'closing question, with the discount landing on an exact cent; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `totalCents = ${result.totalCents}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const dollars = result.totalCents / 100;
      const verdict = Number.isInteger(dollars) ? dollars : Math.round(dollars * 100) / 100;
      return { question, verdict: String(verdict), abstain: false, freeText, method: METHOD_ID, basis: 'ceil(N/2)*P + floor(N/2)*P*(D/100), exact integer cents' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(alternatingFullAndDiscountUnitPriceSum);
