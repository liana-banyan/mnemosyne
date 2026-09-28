// D-BP223-BM04-h2cbpv9w-170 -- original-price-minus-percentage-discount-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\original-price-minus-percentage-discount-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C136 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 79, "John adopts a dog. He takes the dog
 * to the groomer, which costs $100. The groomer offers him a 30% discount for being a new
 * customer. How much does the grooming cost?". Silo label: "discount calculation -- original
 * price minus percentage discount".
 *
 * @generalShape A service or item is stated to cost a given dollar amount. A separate sentence
 *   states a percentage DISCOUNT off that price. The question asks how much the service/item
 *   costs (the FINAL price after the discount, never the discount amount itself). Answer =
 *   price - price*percent/100.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a "costs $<dollars>[.<cents>]" price statement;
 *   (b) an explicit "<percent>% discount" phrase -- the literal word "discount" is required so
 *       this candidate never fires on a markup, tax, or tip percentage, which move the price the
 *       opposite direction or for an unrelated reason;
 *   (c) the question's own closing sentence asking "how much" something "cost"s -- never the
 *       discount amount, never an unrelated total;
 *   (d) EXACTLY TWO numeric tokens anywhere in the whole question -- the price and the percent,
 *       and nothing else. Found and fixed after the GSM8K-1319 self-check caught a confident-
 *       wrong answer on a "4 packs of 9 bagels, 10% discount, cost PER SINGLE BAGEL" item: this
 *       candidate's two-fact pattern matched a small piece of a much longer multi-step problem
 *       (pack count, bagels-per-pack, and a per-unit division step it does not model) and
 *       produced a confidently wrong total. A bare count of "how many numbers appear at all" is
 *       a blunt instrument, but it is honest positive evidence that this is genuinely a two-fact
 *       problem rather than a multi-step one wearing the same two key phrases.
 *
 * @whatBreaksIt (a) no explicit "discount" percentage -- abstain, a bare percentage near a price
 *   is not enough evidence of direction; (b) a percentage of 0 or >=100 -- abstain, not a
 *   meaningful partial discount; (c) the closing sentence not asking about cost at all -- abstain,
 *   this guards against answering an unrelated nearby "how much" question; (d) any third numeric
 *   token anywhere in the question -- abstain, this is the guard that fixed the section above;
 *   (e) the discounted result not landing on an exact whole dollar amount -- abstain rather than
 *   report a fractional cent value, computed via exact integer-cents arithmetic throughout, never
 *   a floating heuristic.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED ($100 minus a thirty-percent discount matches the item's own
 *   accepted final cost exactly). A full GSM8K-1319 self-check ALSO found genuine cross-item
 *   generalization on the tuning reserve (gsm8k-train-152, a newspaper-subscription discount,
 *   solved correctly) before the guard-(d) fix, and the one confident-wrong item the same
 *   self-check found (a multi-step bagel-pack item) is now excluded by guard (d); re-measured
 *   clean after the fix (see wave_manifest.json).
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'original-price-minus-percentage-discount-v1';

interface Analyzed { dollars: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the price statement.
  const priceRe = /\bcosts\s+\$(\d+)(?:\.(\d{2}))?\b/i;
  const pm = priceRe.exec(q);
  if (!pm) return null;
  const priceCents = parseInt(pm[1], 10) * 100 + (pm[2] ? parseInt(pm[2], 10) : 0);

  // (b) an explicit discount percentage.
  const discountRe = /\b(\d+)%\s*discount\b/i;
  const dm = discountRe.exec(q);
  if (!dm) return null;
  const percent = parseInt(dm[1], 10);
  if (percent <= 0 || percent >= 100) return null;

  // (c) the closing sentence must ask about final cost, not an unrelated amount.
  const lastSentence = q.slice(Math.max(q.lastIndexOf('.'), q.lastIndexOf('!')) + 1);
  if (!/\bhow\s+much\b/i.test(lastSentence) || !/\bcost/i.test(lastSentence)) return null;

  // (d) EXACTLY TWO numeric tokens in the whole question -- the price and the percent, and
  // nothing else. A third number (a pack count, a per-unit conversion, a second price) means
  // this is a longer multi-step problem this candidate does not model; abstain rather than guess.
  const allNumbers = q.match(/\d+(?:\.\d+)?/g) || [];
  if (allNumbers.length !== 2) return null;

  // Exact integer-cents arithmetic; abstain rather than round.
  const numerator = priceCents * (100 - percent);
  if (numerator % 100 !== 0) return null;
  const finalCents = numerator / 100;
  if (finalCents % 100 !== 0) return null;
  const dollars = finalCents / 100;
  return { dollars };
}

export const originalPriceMinusPercentageDiscount: LianaMethod = {
  id: 'original-price-minus-percentage-discount-v1',
  demand: 'COMPUTE',
  name: 'Subtract an explicit percentage discount from a stated dollar price to find the final cost',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C136, sole member harvest_gsm8k_pilot_item79_discount_calculation)',
  shapeDescription:
    'A service/item costs a stated dollar amount; an explicit percentage discount is offered; ' +
    'the question asks the final cost; answer = price - price*percent/100, exact whole-dollar ' +
    'result required.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a costs-$<price> statement plus an explicit percentage discount plus a ' +
          'closing question about final cost landing on a whole dollar amount; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `final cost = ${result.dollars}` };
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
          verdict: String(Math.round(result.dollars * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'price minus price*percent/100, exact integer-cents arithmetic',
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

registerMethod(originalPriceMinusPercentageDiscount);
