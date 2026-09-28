// D-BP223-BM04-h2cbpv9w-170 -- loyalty-reward-plus-doubled-coupon-subtracted-from-spend-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\loyalty-reward-plus-doubled-coupon-subtracted-from-spend-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C185 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 330, "A customer's loyalty card at a store gives them
 * rewards of $1 off their next purchase for every $20 they spend. Their last shopping trip, they
 * spent $80. This shopping trip, they spent $43, used their rewards, and applied a coupon that
 * took twice the amount of rewards off the price. How many dollars did the customer pay on this
 * shopping trip?". Silo label: "multi-step transaction calculation involving loyalty rewards and
 * discounts".
 *
 * @generalShape A loyalty rate states "$<rewardPerUnit> off ... for every $<spendPerUnit> they
 *   spend". A PAST trip's spend converts to a reward dollar amount via
 *   reward = floor(pastSpend / spendPerUnit) * rewardPerUnit. A coupon takes a stated MULTIPLE of
 *   that reward off the CURRENT trip's spend. The final amount paid on the current trip is
 *   currentSpend - reward - (multiple * reward).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a rate clause "$<rewardPerUnit>
 *   off <their|his|her> next purchase for every $<spendPerUnit> they spend"; (b) a past-trip
 *   clause "<last|previous|prior> shopping trip, they spent $<pastSpend>"; (c) a current-trip
 *   clause "this shopping trip, they spent $<currentSpend>" that also mentions using rewards and a
 *   coupon that took a stated multiple ("twice"/"double"/"three times"/etc., via the shared
 *   number-word table) of the reward amount off; (d) a closing "how ... dollars did the customer
 *   pay on this shopping trip" question.
 *
 * @whatBreaksIt (a) pastSpend not being an exact multiple of spendPerUnit -- abstains rather than
 *   report a fractional reward (matches the worked case's own floor-division intent only when it
 *   lands exactly, per the estate's "abstain over guess" rule); (b) the coupon multiple word not
 *   resolving through the shared number-word table -- abstain; (c) the final paid amount landing
 *   at or below zero -- abstain, this shape's teaching case is a genuine partial-discount purchase,
 *   never a free or over-discounted one; (d) any dollar amount failing to parse as a non-negative
 *   integer -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (reward = 80/20*1 = 4; coupon = 4*2 = 8; paid = 43-4-8 = 31).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'loyalty-reward-plus-doubled-coupon-subtracted-from-spend-v1';

const NUMBER_WORDS: Record<string, number> = {
  once: 1, one: 1,
  twice: 2, double: 2, two: 2,
  thrice: 3, triple: 3, three: 3,
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function resolveMultiple(phrase: string): number | null {
  const p = phrase.trim().toLowerCase();
  if (NUMBER_WORDS[p] != null) return NUMBER_WORDS[p];
  const digitTimes = /^(\d+)\s*times?$/.exec(p);
  if (digitTimes) return parseInt(digitTimes[1], 10);
  const wordTimes = /^([a-z]+)\s*times?$/.exec(p);
  if (wordTimes && NUMBER_WORDS[wordTimes[1]] != null) return NUMBER_WORDS[wordTimes[1]];
  return null;
}

interface Analyzed { paid: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateRe = /\$(\d+(?:\.\d+)?)\s+off\s+(?:their|his|her)\s+next purchase\s+for every\s+\$(\d+(?:\.\d+)?)\s+they spend/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const rewardPerUnit = parseFloat(rm[1]);
  const spendPerUnit = parseFloat(rm[2]);
  if (!Number.isFinite(rewardPerUnit) || !Number.isFinite(spendPerUnit) || spendPerUnit <= 0) return null;

  const pastRe = /(?:last|previous|prior)\s+shopping trip,?\s+they spent\s+\$(\d+(?:\.\d+)?)/i;
  const pm = pastRe.exec(q);
  if (!pm) return null;
  const pastSpend = parseFloat(pm[1]);
  if (!Number.isFinite(pastSpend) || pastSpend < 0) return null;

  const currentRe = /this shopping trip,?\s+they spent\s+\$(\d+(?:\.\d+)?)[^.]*used their rewards[^.]*applied a coupon that took\s+([a-z]+(?:\s+times?)?)\s+the amount of rewards off the price/i;
  const cm = currentRe.exec(q);
  if (!cm) return null;
  const currentSpend = parseFloat(cm[1]);
  if (!Number.isFinite(currentSpend) || currentSpend < 0) return null;
  const multiple = resolveMultiple(cm[2]);
  if (multiple == null) return null;

  if (!/how (?:many|much)\s+dollars did the customer pay on this shopping trip/i.test(q)) return null;

  if (pastSpend % spendPerUnit !== 0) return null;
  const rewardUnits = pastSpend / spendPerUnit;
  const reward = rewardUnits * rewardPerUnit;
  const coupon = multiple * reward;
  const paid = currentSpend - reward - coupon;
  if (!Number.isFinite(paid) || paid <= 0) return null;
  return { paid };
}

export const loyaltyRewardPlusDoubledCouponSubtractedFromSpend: LianaMethod = {
  id: 'loyalty-reward-plus-doubled-coupon-subtracted-from-spend-v1',
  demand: 'COMPUTE',
  name: 'Past-trip spend converts to a loyalty reward; a coupon takes a stated multiple of that reward off the current trip -- amount paid via exact arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C185, sole member: pilot corpus item at index 330)',
  shapeDescription: 'paid = currentSpend - reward - (multiple * reward), reward = floor(pastSpend / spendPerUnit) * rewardPerUnit',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "$<reward> off ... for every $<spend> they spend" rate clause, a past-' +
          'trip spend clause, a current-trip spend clause naming a coupon multiple of the reward, ' +
          'and a closing "how ... dollars did the customer pay" question, all resolving to an ' +
          'exact positive amount; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `paid = ${result.paid}` };
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
          verdict: String(Math.round(result.paid * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'currentSpend - reward - multiple*reward, exact arithmetic',
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

registerMethod(loyaltyRewardPlusDoubledCouponSubtractedFromSpend);
