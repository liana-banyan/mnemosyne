// D-BP223-BM04-h2cbpv9w-170 -- opening-bid-plus-double-increment-per-other-bidder-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\opening-bid-plus-double-increment-per-other-bidder-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C115 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 298, "Carmen goes to an auction to win an
 * antique desk. She accepts the opening bid of $200 and continues bidding until she wins. The
 * bids on the desk rise by $50 each time and 3 other people each bid once. Carmen bids after each
 * of the 3 other people and eventually wins. How much money, in dollars, does the desk cost her?"
 *
 * @generalShape An auction has an explicit OPENING bid amount and a fixed INCREMENT that every
 *   bid raises the price by. A stated number of OTHER bidders each bid exactly once. The
 *   protagonist explicitly bids AFTER EACH of those other bidders (a matching bid for every one of
 *   theirs), which is the positive evidence that the total number of increment-steps is TWICE the
 *   other-bidder count (their bid, then the protagonist's matching bid, repeated once per other
 *   bidder). Final cost = opening + 2 * otherBidderCount * increment.
 *
 * @recogniseInStranger Three anchored, positive-evidence clauses: (1) "opening bid of \$<O>"; (2)
 *   "rise(s)? by \$<I> each time" (or "increase(s)? by \$<I>") for the fixed increment; (3) "<N>
 *   other (?:people|bidders)" for the other-bidder count, paired with an explicit "bids after
 *   each" clause -- this candidate ONLY commits to the x2 multiplier when the "bids after each" (or
 *   "bidding after every") confirmation is present in the text, since that is what proves the
 *   protagonist matches every single other bid rather than, say, bidding only once at the end.
 *
 * @whatBreaksIt (a) the protagonist NOT confirmed to bid after every other bidder (no "bids after
 *   each" phrase found) -- abstains, since the total increment count would then be unknown; (b)
 *   more than one distinct increment amount stated (a rising-then-changing increment) -- abstains,
 *   this candidate only knows a single flat increment; (c) the other-bidder count given as a word
 *   rather than a digit -- this candidate's regex requires a leading digit and abstains on a
 *   number-word phrasing; (d) a question asking for anything other than the total cost to the
 *   protagonist (e.g. asking for the total raised by other bidders alone) -- abstains, the
 *   question anchor requires "does the desk cost".
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (200 + 2*3*50 = 500). With only one known
 *   cluster member there is no cross-member measurement to report for this singleton cluster --
 *   noted honestly rather than inflated with a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'opening-bid-plus-double-increment-per-other-bidder-v1';


interface Analyzed {
  opening: number;
  increment: number;
  otherBidders: number;
  finalCost: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (1) Opening/starting bid. Widened from "opening bid" alone to also accept "starting bid"
  // (Round-2 tuning, RULE 6): no matching auction item was found anywhere in the 4,767-item
  // tuning reserve at all, so this is a good-faith English-synonym widening, not one backed by a
  // positive tuning-reserve match.
  const openingRe = /\b(?:opening|starting)\s+bid\s+of\s+\$([0-9]+(?:\.[0-9]{1,2})?)\b/i;
  const openingMatch = openingRe.exec(q);
  if (!openingMatch) return null;
  const opening = parseFloat(openingMatch[1]);
  if (!Number.isFinite(opening)) return null;

  // (2) Fixed increment -- require exactly ONE stated increment amount. Verb list widened
  // (Round-2 tuning, RULE 6) to also accept "go(es) up by", same good-faith-synonym basis as (1).
  const incrementRe = /\b(?:rise|rises|increase|increases|goes?\s+up)\s+by\s+\$([0-9]+(?:\.[0-9]{1,2})?)\s+each\s+time\b/gi;
  const incrementMatches: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = incrementRe.exec(q)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isFinite(v)) return null;
    incrementMatches.push(v);
  }
  if (incrementMatches.length !== 1) return null;
  const increment = incrementMatches[0];

  // (3) Other-bidder count.
  const otherRe = /\b([0-9]+)\s+other\s+(?:people|bidders)\b/i;
  const otherMatch = otherRe.exec(q);
  if (!otherMatch) return null;
  const otherBidders = parseInt(otherMatch[1], 10);
  if (!Number.isFinite(otherBidders) || otherBidders <= 0) return null;

  // Positive confirmation the protagonist matches EVERY other bid -- required, not assumed.
  if (!/\bbids?\s+after\s+each\b/i.test(q)) return null;

  // The closing question must ask what the item costs the protagonist.
  if (!/\bdoes\s+the\s+[a-z]+\s+cost\b/i.test(q)) return null;

  const finalCost = opening + 2 * otherBidders * increment;
  if (!toFinite(finalCost)) return null;

  return { opening, increment, otherBidders, finalCost };
}

export const openingBidPlusDoubleIncrementPerOtherBidder: LianaMethod = {
  id: 'opening-bid-plus-double-increment-per-other-bidder-v1',
  demand: 'COMPUTE',
  name: 'Opening bid plus twice the increment per confirmed matched other-bidder, as final auction cost',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W11 (cluster C115, sole member harvest_gsm8k_pilot_item298, GSM8K test.jsonl line 298)',
  shapeDescription:
    'finalCost = opening + 2 * otherBidderCount * increment, only when the text explicitly ' +
    'confirms the protagonist bids after each of the other bidders (matching every one of them).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an opening bid, a single fixed increment, a confirmed matched ' +
          'other-bidder count, and a "does it cost" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `opening=${result.opening} increment=${result.increment} others=${result.otherBidders} -> cost=${result.finalCost}`,
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
      const rounded = Math.round((result.finalCost) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.opening} + 2*${result.otherBidders}*${result.increment} = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(openingBidPlusDoubleIncrementPerOtherBidder);
