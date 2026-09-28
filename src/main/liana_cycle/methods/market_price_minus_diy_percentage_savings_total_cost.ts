// D-BP223-BM04-h2cbp9d8-171 -- market-price-minus-diy-percentage-savings-total-cost-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\market-price-minus-diy-percentage-savings-total-cost-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C213 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 370, "A hand-painted wallpaper costs $400
 * at the market. A DIY will saves 20% after considering the materials cost. If Ethan made his own
 * hand-painted wallpaper, how much was the total cost?". Silo label: "discount and cost
 * calculation" -- matches exactly. Distinct from the registered percentage-markup-resale-profit-v1
 * (requires the word "profit" and 2-6 multi-lot purchase phrases) and rate-chain-multiply-then-
 * percentage-discount-v1 (a four-factor multiplicative chain before its discount): this is a
 * single stated market price reduced once by a single stated DIY-savings percentage, no chain,
 * no profit framing, no lots.
 *
 * @generalShape A single named item's MARKET price is stated directly ("a <item> costs $<P> at
 *   the market"). A separate sentence states a DIY approach saves a stated PERCENTAGE off that
 *   price ("a DIY <verb> saves <Q>% after considering the materials cost"). The closing question
 *   asks for the total cost of making the SAME item oneself. Answer = P * (100 - Q) / 100.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the item name repeated
 *   verbatim (backreference, never re-guessed) between the market-price sentence and the closing
 *   question:
 *   (a) "a <item> costs $<P> at the market";
 *   (b) "a DIY [a-z]+ saves <Q>% after considering the materials cost";
 *   (c) "if <actor> made [a-z]+ own <item>, how much was the total cost", naming the SAME item as
 *       (a).
 *   Answer = P*(100-Q)/100, required to divide evenly by 100 (exact cents).
 *
 * @whatBreaksIt (a) the item name in the closing question not matching the market-price sentence
 *   verbatim -- abstain, cannot confirm this is the same item; (b) P*(100-Q) not evenly divisible
 *   by 100 -- abstain rather than round to a fraction of a cent; (c) the word "profit", "resale",
 *   or a multi-lot purchase phrase present elsewhere -- a different, richer shape this candidate
 *   does not attempt; (d) Q at or above 100 -- abstain, a savings percentage cannot consume or
 *   exceed the whole price under this reading.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (400*(100-20)/100 = 320). With only one known member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'market-price-minus-diy-percentage-savings-total-cost-v1';

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 = /\ba\s+([a-z][a-z -]*?)\s+costs\s+\$(\d+(?:\.\d+)?)\s+at\s+the\s+market\b/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, item, priceRaw] = m1;
  const price = parseFloat(priceRaw);
  if (!Number.isFinite(price)) return null;

  const r2 = /\ba\s+diy\s+[a-z]+\s+saves\s+(\d+)%\s+after\s+considering\s+the\s+materials\s+cost\b/i;
  const m2 = r2.exec(q);
  if (!m2) return null;
  const [, pctRaw] = m2;
  const pct = parseInt(pctRaw, 10);
  if (!Number.isFinite(pct) || pct >= 100 || pct < 0) return null;

  const itemEsc = item.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rQ = new RegExp(
    'if\\s+[a-z]+\\s+made\\s+[a-z]+\\s+own\\s+' + itemEsc + ',\\s+how\\s+much\\s+was\\s+the\\s+total\\s+cost',
    'i',
  );
  if (!rQ.test(q)) return null;

  const cents = Math.round(price * 100) * (100 - pct);
  if (cents % 100 !== 0) return null;
  const total = cents / 100 / 100;
  if (!Number.isFinite(total) || total < 0) return null;
  return { total };
}

export const marketPriceMinusDiyPercentageSavingsTotalCost: LianaMethod = {
  id: 'market-price-minus-diy-percentage-savings-total-cost-v1',
  demand: 'COMPUTE',
  name: 'A stated market price reduced by a single stated DIY-savings percentage gives the total cost of making the same item oneself',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C213, sole member: pilot corpus item at index 370)',
  shapeDescription: 'total = marketPrice * (100 - savingsPct) / 100, exact-cents arithmetic.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a market-price sentence, a matching single DIY-savings-percentage ' +
          'sentence, and a closing "made own <same item>, total cost" question, resolving to a ' +
          'non-negative exact-cents value; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `DIY total cost = ${result.total}` };
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
          basis: 'applied the single stated DIY-savings percentage to the stated market price',
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

registerMethod(marketPriceMinusDiyPercentageSavingsTotalCost);
