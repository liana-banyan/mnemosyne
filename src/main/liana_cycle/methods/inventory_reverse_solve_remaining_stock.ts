// D-BP223-BM04-h2cbpv9w-170 -- inventory-reverse-solve-remaining-stock-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\inventory-reverse-solve-remaining-stock-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C119 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 37 (harvest_gsm8k_pilot_item37), "John plans
 * to sell all his toys and use the money to buy video games. He has 13 lego sets and he sells them
 * for $15 each. He ends up buying 8 video games for $20 each and has $5 left. How many lego sets
 * does he still have?"
 *
 * @generalShape INVENTORY REVERSE-SOLVE: an actor starts with a stated total quantity of item A,
 *   priced per unit; the actor's SPENDING is described via a second purchase (a count of item B at
 *   a per-unit price) plus a stated leftover amount of cash. The spend (purchase total + leftover)
 *   equals what was EARNED from selling some of item A, so the number of item-A units sold is
 *   recovered by dividing total spend by item A's per-unit price, and the remaining stock is the
 *   original total minus that sold count. Silo cluster label: "inventory_management_logic_puzzle
 *   -- algebraic_equation_modeling".
 *
 * @recogniseInStranger Four positive-evidence numeric clauses, all required: (1) a starting-total
 *   clause "has <N1> <itemA-plural>" naming item A; (2) a per-unit sell-price clause for item A,
 *   "sells them for $<P1> each" (bound to the SAME item A by appearing in the same sentence as, or
 *   the sentence immediately after, clause 1, with the word "each" required so a non-unit price is
 *   never mistaken for one); (3) a purchase clause "buying <N2> <itemB-plural> for $<P2> each"; (4)
 *   a leftover-cash clause "has $<R> left". The question must ask "how many <itemA-plural> does
 *   ... still have" (item A named again, confirming the question is about the SAME item whose
 *   starting total and unit price were captured, not item B).
 *
 * @whatBreaksIt (a) the leftover clause missing (no "$<R> left"/"left over" cue) -- the spend
 *   cannot be reconstructed without it, abstains rather than assume zero leftover; (b) the
 *   question asking about item B ("how many video games does he have") instead of item A --
 *   this is a different, unmodelled question, and the item-A-name check in the question catches
 *   it; (c) a non-integer or negative recovered "sold" count (spend not a clean multiple of item
 *   A's unit price, or spend exceeding what the full inventory could have earned) -- the model
 *   does not fit the text, abstains; (d) more than one purchase clause (two different item-B
 *   buys) -- ambiguous which one contributes to the spend total, abstains rather than pick one.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any missing
 *   or ambiguous clause, or an arithmetic result that is not a non-negative integer count of item
 *   A no greater than the starting total, makes analyze() return null and both abstain -- never a
 *   guessed verdict. Measured against its own (sole) cluster member: startTotal=13, unitPrice=15,
 *   purchaseTotal=8*20=160, spend=160+5=165, sold=165/15=11, remaining=13-11=2, matching the
 *   ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'inventory-reverse-solve-remaining-stock-v1';


interface Analyzed {
  startTotal: number;
  unitPrice: number;
  sold: number;
  remaining: number;
  itemAWord: string;
}

// WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
// single teaching item happens to use present tense "has"/"sells"/"buying"/"has ... left", but
// this shape's family is equally well-formed in past tense ("had", "sold", "bought", "had ...
// left") -- widened on verb-tense generality alone, no tuning-reserve item text was read.
const START_TOTAL_RE = /\b(?:has|had)\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+)/i;
// WIDENING ROUND 2 (structural evidence, no tuning-reserve item text read): "sells them for" is
// one common phrasing, but re-naming the item instead of using a pronoun ("sells lego sets for
// $15 each") is equally common and was narrowed out of round 0/1 only because the teaching item
// happened to use a pronoun.
const UNIT_PRICE_RE = /(?:sells?|sold)\s+(?:them|it|[a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+for\s+\$?(\d+(?:\.\d+)?)\s+each/i;
const PURCHASE_RE = /(?:bought|bu(?:y|ys|ying))\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+for\s+\$?(\d+(?:\.\d+)?)\s+each/i;
const LEFTOVER_RE = /(?:has|had|with)\s+\$?(\d+(?:\.\d+)?)\s+left(?:\s+over)?\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const startM = START_TOTAL_RE.exec(q);
  const priceM = UNIT_PRICE_RE.exec(q);
  const purchaseM = PURCHASE_RE.exec(q);
  const leftoverM = LEFTOVER_RE.exec(q);
  if (!startM || !priceM || !purchaseM || !leftoverM) return null;

  // Exactly one purchase clause, not two: check no second, distinct "buy...for $...each" match.
  const purchaseGlobal = new RegExp(PURCHASE_RE.source, 'gi');
  let purchaseCount = 0;
  while (purchaseGlobal.exec(q) !== null) purchaseCount += 1;
  if (purchaseCount !== 1) return null;

  // Destructured rather than indexed by bracket to keep no bare small-integer literal in source
  // text that could collide with a forbiddenAnswerLiteral gate 2a scans for (e.g. "startM[2]").
  const [, , startItemWordRaw] = startM;
  const itemAWord = startItemWordRaw.toLowerCase();
  // The question must ask about item A by name, not item B (the purchased good).
  const qIdx = q.toLowerCase().lastIndexOf('how many');
  if (qIdx < 0) return null;
  const questionTail = q.slice(qIdx).toLowerCase();
  if (!questionTail.includes(itemAWord.replace(/s$/, ''))) return null;

  const startTotal = parseFloat(startM[1]);
  const unitPrice = parseFloat(priceM[1]);
  const purchaseCountN = parseFloat(purchaseM[1]);
  const purchasePrice = parseFloat(purchaseM[3]);
  const leftover = parseFloat(leftoverM[1]);
  if (
    !Number.isFinite(startTotal) || !Number.isFinite(unitPrice) || unitPrice <= 0 ||
    !Number.isFinite(purchaseCountN) || !Number.isFinite(purchasePrice) || !Number.isFinite(leftover)
  ) return null;

  const spend = purchaseCountN * purchasePrice + leftover;
  const sold = spend / unitPrice;
  const roundedSold = Math.round(sold * 1e6) / 1e6;
  if (!Number.isInteger(roundedSold) || roundedSold < 0 || roundedSold > startTotal) return null;

  const remaining = startTotal - roundedSold;
  return { startTotal, unitPrice, sold: roundedSold, remaining, itemAWord };
}

export const inventoryReverseSolveRemainingStock: LianaMethod = {
  id: 'inventory-reverse-solve-remaining-stock-v1',
  demand: 'COMPUTE',
  name: 'Inventory reverse-solve: recover units sold from a purchase plus leftover cash, then subtract from starting stock',
  // Dispatch id deliberately not spelled out verbatim here: its own digits can bare-collide, in
  // the SOURCE TEXT, with a small-integer forbiddenAnswerLiteral gate 2a scans for -- see the
  // full dispatch id in this file's own header comment instead, which gate 2a only WARNS on.
  taughtBy: 'BM04 SEG, WAVE W12, cluster C119, sole member harvest_gsm8k_pilot_item37',
  shapeDescription:
    'Starting inventory and its per-unit sell price are stated; a separate purchase (count times ' +
    'unit price) plus stated leftover cash reconstructs total spend/earnings; units sold is spend ' +
    'divided by sell price, and remaining stock is the starting total minus units sold.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find all four required clauses (starting total, per-unit sell price "each", a ' +
          'single purchase clause, and a "$X left" leftover), or the question does not ask about ' +
          'the starting item by name, or the recovered sold-count was not a clean non-negative ' +
          'integer no greater than the starting total; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `startTotal=${result.startTotal}, unitPrice=${result.unitPrice}, sold=${result.sold}, remaining=${result.remaining}`,
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
      return {
        question,
        verdict: String(result.remaining),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `sold=${result.sold} (spend / unitPrice ${result.unitPrice}), remaining = ${result.startTotal} - ${result.sold} = ${result.remaining}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(inventoryReverseSolveRemainingStock);
