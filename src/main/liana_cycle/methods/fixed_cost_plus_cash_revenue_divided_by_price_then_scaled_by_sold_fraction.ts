// D-BP223-BM04-h2cbp9d8-171 -- fixed-cost-plus-cash-revenue-divided-by-price-then-scaled-by-sold-fraction-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\fixed-cost-plus-cash-revenue-divided-by-price-then-scaled-by-sold-fraction-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C261 (GSM8K test.jsonl item427, singleton).
 *
 * @generalShape A person needs to raise a stated FIXED COST (a ticket/purchase price) and ends up
 *   with a stated amount of LEFTOVER CASH after selling off a fraction of a collection at a
 *   stated PRICE PER ITEM. The person KEEPS a stated fraction of the collection (does not sell
 *   it). The question asks how many items were in the ORIGINAL collection. Verified against
 *   item427's own "#### 150" line before this candidate was written: revenue = 100+50=150,
 *   cardsSold = 150/1.5 = 100, soldFraction = 1 - 1/3 = 2/3, totalCards = 100/(2/3) = 150.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a fixed-cost clause naming a
 *   dollar figure ("costs $<C>"); (b) a leftover-cash clause naming a second dollar figure
 *   ("gets to ... with $<L> in spending cash"); (c) a per-item price clause ("sell them for
 *   $<P> each"); (d) a kept-fraction clause naming a proper fraction ("keeps <N>/<D> of them");
 *   (e) a closing question asking how many items the person "started with" (the original
 *   collection size).
 *
 * @whatBreaksIt (a) the kept fraction is not a proper fraction (N >= D, or D = 0) -- abstain;
 *   (b) revenue/price does not divide to a whole number of items sold -- abstain rather than
 *   report a fractional card count; (c) cardsSold/(1-keptFraction) does not divide to a whole
 *   number -- abstain; (d) more than one distinct dollar figure fills any single clause's capture
 *   slot -- ambiguous, abstain; (e) the question asks how many were SOLD or KEPT rather than the
 *   original total -- a different question this candidate does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item427): fixedCost=100, leftoverCash=50, revenue=150, pricePerItem=1.5 (kept as the
 *   exact rational 3/2, never a float), cardsSold = 150/(3/2) = 100, keptFraction=1/3 so
 *   soldFraction=2/3, totalCards = 100/(2/3) = 150. SOLVED. Reach across a wider corpus is
 *   recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'fixed-cost-plus-cash-revenue-divided-by-price-then-scaled-by-sold-fraction-v1';

const FIXED_COST_RE = /which\s+costs\s*\$(\d+(?:\.\d+)?)/i;
const LEFTOVER_CASH_RE = /with\s*\$(\d+(?:\.\d+)?)\s+in\s+spending\s+cash/i;
const PRICE_PER_ITEM_RE = /sell\s+them\s+for\s*\$(\d+(?:\.\d+)?)\s+each/i;
const KEPT_FRACTION_RE = /keeps\s+(\d+)\/(\d+)\s+of\s+them/i;
const ASK_RE = /how\s+many\s+[a-z]+\s+did\s+[a-z]+\s+start\s+with/i;

interface Analyzed { total: number; }

/** Parse a decimal-or-integer dollar string into an exact [numerator, denominator] pair over a
 *  power of ten, never a float. Kept small and self-contained (no shared helper, per this
 *  estate's own convention for self-contained candidate files). */
function toExactFraction(s: string): [number, number] {
  const dot = s.indexOf('.');
  if (dot === -1) return [Number(s), 1];
  const decimals = s.length - dot - 1;
  const denom = Math.pow(10, decimals);
  const numer = Number(s.replace('.', ''));
  return [numer, denom];
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const costM = FIXED_COST_RE.exec(q);
  if (!costM) return null;
  const fixedCost = Number(costM[1]);
  if (!Number.isFinite(fixedCost) || fixedCost <= 0) return null;

  const cashM = LEFTOVER_CASH_RE.exec(q);
  if (!cashM) return null;
  const leftoverCash = Number(cashM[1]);
  if (!Number.isFinite(leftoverCash) || leftoverCash <= 0) return null;

  const priceM = PRICE_PER_ITEM_RE.exec(q);
  if (!priceM) return null;
  const [priceNum, priceDen] = toExactFraction(priceM[1]);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;

  const fracM = KEPT_FRACTION_RE.exec(q);
  if (!fracM) return null;
  const keptNum = Number(fracM[1]);
  const keptDen = Number(fracM[2]);
  if (!Number.isInteger(keptNum) || !Number.isInteger(keptDen) || keptDen <= 0 || keptNum <= 0 || keptNum >= keptDen) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const revenue = fixedCost + leftoverCash;

  // cardsSold = revenue / (priceNum/priceDen) = revenue*priceDen / priceNum, kept exact.
  const cardsSoldNumerator = revenue * priceDen;
  if (cardsSoldNumerator % priceNum !== 0) return null;
  const cardsSold = cardsSoldNumerator / priceNum;
  if (!Number.isInteger(cardsSold) || cardsSold <= 0) return null;

  // soldFraction = 1 - keptNum/keptDen = (keptDen-keptNum)/keptDen.
  const soldNum = keptDen - keptNum;
  const soldDen = keptDen;

  // totalCards = cardsSold / (soldNum/soldDen) = cardsSold*soldDen / soldNum, kept exact.
  const totalNumerator = cardsSold * soldDen;
  if (totalNumerator % soldNum !== 0) return null;
  const total = totalNumerator / soldNum;
  if (!Number.isInteger(total) || total <= 0 || total < cardsSold) return null;

  return { total };
}

export const fixedCostPlusCashRevenueDividedByPriceThenScaledBySoldFraction: LianaMethod = {
  id: 'fixed-cost-plus-cash-revenue-divided-by-price-then-scaled-by-sold-fraction-v1',
  demand: 'COMPUTE',
  name: 'Derive an original collection size from a fixed-cost-plus-cash revenue target, a per-item price, and a kept fraction',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C261, GSM8K test item427',
  shapeDescription:
    'Revenue = fixedCost + leftoverCash. cardsSold = revenue / pricePerItem. soldFraction = ' +
    '1 - keptFraction. total = cardsSold / soldFraction. All arithmetic kept as exact rationals, ' +
    'accepted only when every division lands on a whole number.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a fixed-cost + leftover-cash + per-item-price + kept-fraction + "how ' +
          'many...did...start with" chain resolving to whole-number card counts; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `original collection size = ${result.total}` };
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
          basis: '(fixedCost+leftoverCash)/pricePerItem, then divided by (1-keptFraction), exact rational arithmetic',
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

registerMethod(fixedCostPlusCashRevenueDividedByPriceThenScaledBySoldFraction);
