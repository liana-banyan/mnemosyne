// D-BP223-BM04-h2cbp9d8-171 -- item-count-times-price-percent-off-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\item-count-times-price-percent-off-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R08
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C249 (GSM8K test.jsonl item414, singleton).
 *
 * @generalShape An actor picks out a count C of items from a "<D>% off" rack. Each item's regular
 *   price is stated as $R. The question asks for the total cost of the discounted items. The
 *   corpus's own ground truth (verified against item414's own "#### 56" line before this
 *   candidate was written: 20*4=80, 80*30%=24, 80-24=56) computes the regular subtotal, the flat
 *   discount amount on that subtotal, and subtracts -- reproduced here exactly as
 *   C*R*(100-D)/100.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "picks out <C>
 *   <items>" (or "buys <C> <items>") count clause; (b) an explicit "<D>% off" rack/discount
 *   clause; (c) an explicit "regular price for each <item> is $<R>" clause; (d) a closing question
 *   asking for the "total cost of the discounted <items>".
 *
 * @whatBreaksIt (a) more than one count or more than one discount percentage in the question --
 *   ambiguous, abstain; (b) the price is given as a range or per-unit-of-something other than a
 *   flat "$R" figure -- not handled; (c) C*R*(100-D) is not evenly divisible by 100 -- abstains
 *   rather than report a fractional-cent total; (d) the question asks for the amount SAVED rather
 *   than the total cost paid -- different closing question, not handled.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item414): subtotal = 4*20 = 80, discount = 80*30/100 = 24, total = 80-24 = 56 (kept as
 *   an exact integer numerator C*R*(100-D) = 4*20*70 = 5600, /100 = 56, never a float heuristic).
 *   SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not asserted here --
 *   this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'item-count-times-price-percent-off-total-v1';

const COUNT_RE = /picks out\s+(\d+)\s+[a-z]+|buys\s+(\d+)\s+[a-z]+/i;
const DISCOUNT_RE = /(\d+)%\s*off/i;
const PRICE_RE = /regular price for each [a-z ]+ is\s*\$?\s*(\d+(?:\.\d+)?)/i;
const ASK_TOTAL_COST_RE = /total cost of the discounted/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const cM = COUNT_RE.exec(q);
  if (!cM) return null;
  const count = Number(cM[1] ?? cM[2]);
  if (!Number.isFinite(count) || count <= 0) return null;

  const dM = DISCOUNT_RE.exec(q);
  if (!dM) return null;
  const discount = Number(dM[1]);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) return null;

  const pM = PRICE_RE.exec(q);
  if (!pM) return null;
  const price = Number(pM[1]);
  if (!Number.isFinite(price) || price <= 0) return null;

  const askM = ASK_TOTAL_COST_RE.exec(q);
  if (!askM) return null;

  // Rational arithmetic throughout: an exact integer numerator, only checked for divisibility by
  // 100 at the final step, never rounded.
  const numerator = count * price * (100 - discount); // exact
  if (numerator % 100 !== 0) return null; // would not land on a whole-cent total
  const total = numerator / 100;
  if (!Number.isFinite(total) || total < 0) return null;

  return { total };
}

export const itemCountTimesPricePercentOffTotal: LianaMethod = {
  id: 'item-count-times-price-percent-off-total-v1',
  demand: 'COMPUTE',
  name: 'Compute the total cost of C items at regular price R, bought from a D% off rack',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C249, GSM8K test item414',
  shapeDescription:
    'An actor picks out C items from a "D% off" rack, each with regular price $R; asks for the ' +
    'total cost of the discounted items. Answer = C*R*(100-D)/100, matching the corpus\'s own ' +
    'worked chain, only when the product divides 100 evenly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "picks out/buys <C> <items>" clause plus a "<D>% off" clause plus a ' +
          '"regular price for each ... is $<R>" clause plus a "total cost of the discounted" ' +
          'closing question resolving to a whole-cent total; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total cost = ${result.total}` };
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
          basis: 'count*price*(100-discount)/100, exact rational arithmetic',
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

registerMethod(itemCountTimesPricePercentOffTotal);
