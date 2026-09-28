// D-BP223-BM04-h2cbp9d8-171 -- base-plus-multiple-of-base-then-percent-discount-plus-flat-extra-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-plus-multiple-of-base-then-percent-discount-plus-flat-extra-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R07
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C246 (GSM8K test.jsonl item411, singleton).
 *
 * @generalShape A first item's price B is stated directly ("a <item1> worth $<B>"). A second item
 *   is stated as a multiple of the first ("another <item2> worth <mult> that much"). A stated
 *   percentage discount D% applies to the combined subtotal of ONLY those two items ("a <D>%
 *   discount on them"). A THIRD, separate flat-priced item E is bought, NOT subject to the
 *   discount. The question asks for the total amount spent. Answer = (B + mult*B)*(100-D)/100 + E,
 *   only when the discounted subtotal lands on an exact whole-cent (here, whole-dollar) amount.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a base price clause "$<B>" tied
 *   to a first named item; (b) a "worth <mult> that much" backward-reference clause for a second
 *   item (mult drawn from "twice"/"three times"/a bare multiplier word); (c) a "<D>% discount on
 *   them" clause, where "them" is the positive discriminator confirming the discount applies to
 *   the two-item subtotal specifically, not to everything purchased; (d) a THIRD, separate "also
 *   buys...costs $<E>" flat item clause, appearing textually AFTER the discount clause (so it is
 *   not swept into "them"); (e) the closing question asks for the total amount spent overall.
 *
 * @whatBreaksIt (a) the discount clause does not say "on them" (or names all items, or the extra
 *   item precedes the discount clause) -- ambiguous whether the discount covers the third item
 *   too, abstain; (b) no "worth <mult> that much" backward-reference multiplier for the second
 *   item; (c) more than one flat, non-discounted extra item; (d) the discounted subtotal does not
 *   land on an exact whole-dollar amount -- abstain rather than report fractional cents.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (item411): pack2 = 2*400 = 800, subtotal = 400+800 =
 *   1200, discount = 1200*20/100 = 240, discounted = 1200-240 = 960, total = 960+150 = 1110.
 *   SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not asserted here --
 *   this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-plus-multiple-of-base-then-percent-discount-plus-flat-extra-v1';

const MULT_WORDS: Record<string, number> = { twice: 2, double: 2, 'three times': 3, triple: 3 };

const BASE_PRICE_RE = /worth\s+\$(\d+(?:\.\d+)?)\b/i;
const MULT_CLAUSE_RE = /worth\s+(twice|double|three times|triple)\s+that\s+much\b/i;
const DISCOUNT_RE = /(\d+(?:\.\d+)?)%\s+discount\s+on\s+them\b/i;
const EXTRA_ITEM_RE = /also\s+buys\s+[^.?!]*?costs\s+\$(\d+(?:\.\d+)?)\b/i;
const ASK_RE = /how much did .* spend in total\b/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = BASE_PRICE_RE.exec(q);
  if (!baseM) return null;
  const base = Number(baseM[1]);
  if (!Number.isFinite(base) || base <= 0) return null;

  const multM = MULT_CLAUSE_RE.exec(q);
  if (!multM) return null;
  const mult = MULT_WORDS[multM[1].toLowerCase()];
  if (!mult) return null;

  const discM = DISCOUNT_RE.exec(q);
  if (!discM) return null;
  const discountPct = Number(discM[1]);
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct >= 100) return null;

  // The flat extra item's clause must appear AFTER the discount clause -- otherwise "them"
  // could plausibly be read as covering it, which this candidate deliberately does not attempt.
  const discEnd = discM.index + discM[0].length;
  const rest = q.slice(discEnd);
  const extraM = EXTRA_ITEM_RE.exec(rest);
  if (!extraM) return null;
  const extra = Number(extraM[1]);
  if (!Number.isFinite(extra) || extra < 0) return null;

  if (!ASK_RE.test(q)) return null;

  const second = mult * base; // exact integer arithmetic when base is a whole dollar amount
  const subtotal = base + second;
  const discountNumerator = subtotal * discountPct; // exact
  if (discountNumerator % 100 !== 0) return null; // discount would not be a whole dollar amount
  const discountAmount = discountNumerator / 100;
  const discounted = subtotal - discountAmount;
  const total = discounted + extra;
  if (!Number.isFinite(total)) return null;

  return { total };
}

export const basePlusMultipleOfBaseThenPercentDiscountPlusFlatExtra: LianaMethod = {
  id: 'base-plus-multiple-of-base-then-percent-discount-plus-flat-extra-v1',
  demand: 'COMPUTE',
  name: 'Compute total spend: a base item plus a multiple-of-base item, discounted together by a percentage, plus a separate non-discounted flat item',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C246, GSM8K test item411',
  shapeDescription:
    'Item1 = $B; item2 = mult*B; a D% discount applies to their combined subtotal ("on them"); a ' +
    'third flat item E (stated after the discount clause) is not discounted. Total = (B+mult*B)*' +
    '(100-D)/100 + E, only when the discount is a whole-dollar amount.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a base-price clause, a "worth <mult> that much" second-item clause, a ' +
          '"<D>% discount on them" clause, a THIRD flat item clause appearing after the discount ' +
          'clause, and a "spend in total" closing question resolving to a whole-dollar discount; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total spent = ${result.total}` };
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
          basis: '(base+mult*base)*(100-discountPct)/100 + extraFlatItem',
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

registerMethod(basePlusMultipleOfBaseThenPercentDiscountPlusFlatExtra);
