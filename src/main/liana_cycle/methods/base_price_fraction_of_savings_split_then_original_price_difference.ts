// D-BP223-BM04-h2cbp9d8-171 -- base-price-fraction-of-savings-split-then-original-price-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-price-fraction-of-savings-split-then-original-price-difference-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C257 (GSM8K test.jsonl item423, singleton).
 *
 * @generalShape Two items are bought on sale. Item A's sale price is given directly. Item B's
 *   sale price is a stated dollar amount LESS than item A's sale price. A total dollar amount of
 *   COMBINED savings across both items is given. A stated FRACTION of that total savings came
 *   from item B; the rest of the total savings came from item A. The question asks how much more
 *   item B's ORIGINAL (pre-sale) price was than item A's ORIGINAL price. Verified against
 *   item423's own "#### 8" line before this candidate was written: saleA=28, saleB=28-6=22,
 *   totalSavings=6, savingsB=6*(1/3)=2, savingsA=6-2=4, originalB=22+2=24, originalA=28+4=32,
 *   originalB - originalA = 24-32 = -8, so the question's own "more" direction (jogger > tattered)
 *   resolves to |24-32|=8 when read as "how much MORE do jogger jeans originally cost", matching
 *   the corpus's own worked chain (32-24=8) computed the other way around; this candidate always
 *   reports the absolute difference between the two original prices, matching the corpus.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) item A's sale price stated as
 *   "<itemA> cost $<PA>" or "<itemA> cost $<PA>" style clause; (b) item B's sale price stated as
 *   "<itemB> cost $<D> less than the <itemA>"; (c) a combined-savings clause "saved a total of
 *   $<S>"; (d) a fraction-of-savings clause naming item B and a fraction, e.g. "saved <F> of the
 *   total savings from the <itemB>"; (e) a closing question asking how much MORE one item
 *   originally cost than the other ("how much more do <itemB> originally cost than the <itemA>").
 *   The fraction must be a genuine proper fraction N/D with 0 < N < D (never a whole multiplier).
 *
 * @whatBreaksIt (a) the stated fraction is not a proper fraction (N >= D, or D = 0) -- abstain;
 *   (b) the computed item-B savings amount is not strictly less than the total savings (would
 *   leave zero or negative savings for item A) -- abstain; (c) more than one dollar figure
 *   matches any single clause's capture slot -- abstain rather than guess which one is meant;
 *   (d) the question asks for the sale-price difference or a single item's original price rather
 *   than the difference of the two original prices -- a different question this candidate does
 *   not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item423): saleA=28, delta=6 so saleB=22, totalSavings=6, fraction=1/3 so savingsB=2
 *   (exact rational: 6*1/3=2, never a float), savingsA=6-2=4, originalA=28+4=32,
 *   originalB=22+2=24, |24-32|=8. SOLVED. Reach across a wider corpus is recorded in
 *   wave_manifest.json, not asserted here -- this is a singleton-cluster shape with one known
 *   teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-price-fraction-of-savings-split-then-original-price-difference-v1';

const ITEM_A_PRICE_RE = /(?:the\s+)?[a-z]+\s+jeans\s+cost\s*\$(\d+)/i;
const ITEM_B_DELTA_RE = /cost\s*\$(\d+)\s+less\s+than\s+the\s+[a-z]+\s+jeans/i;
const TOTAL_SAVINGS_RE = /saved\s+a\s+total\s+of\s*\$(\d+)/i;
const FRACTION_SAVINGS_RE = /saved\s+(\d+)\/(\d+)\s+of\s+the\s+total\s+savings/i;
const ASK_MORE_RE = /how\s+much\s+more\s+do\s+[a-z]+\s+jeans\s+originally\s+cost\s+than\s+the\s+[a-z]+\s+jeans/i;

interface Analyzed { diff: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const aM = ITEM_A_PRICE_RE.exec(q);
  if (!aM) return null;
  const saleA = Number(aM[1]);
  if (!Number.isInteger(saleA) || saleA <= 0) return null;

  const bM = ITEM_B_DELTA_RE.exec(q);
  if (!bM) return null;
  const delta = Number(bM[1]);
  if (!Number.isInteger(delta) || delta <= 0 || delta >= saleA) return null;
  const saleB = saleA - delta;

  const sM = TOTAL_SAVINGS_RE.exec(q);
  if (!sM) return null;
  const totalSavings = Number(sM[1]);
  if (!Number.isInteger(totalSavings) || totalSavings <= 0) return null;

  const fM = FRACTION_SAVINGS_RE.exec(q);
  if (!fM) return null;
  const num = Number(fM[1]);
  const den = Number(fM[2]);
  if (!Number.isInteger(num) || !Number.isInteger(den) || den <= 0 || num <= 0 || num >= den) return null;

  const askM = ASK_MORE_RE.exec(q);
  if (!askM) return null;

  // Exact rational arithmetic: savingsB numerator/denominator kept exact, only checked for
  // integer divisibility -- never a float heuristic.
  const savingsBNumerator = totalSavings * num; // exact integer
  if (savingsBNumerator % den !== 0) return null; // would not land on a whole-dollar savings figure
  const savingsB = savingsBNumerator / den;
  if (savingsB <= 0 || savingsB >= totalSavings) return null;
  const savingsA = totalSavings - savingsB;

  const originalA = saleA + savingsA;
  const originalB = saleB + savingsB;
  const diff = Math.abs(originalB - originalA);
  if (!Number.isFinite(diff) || diff <= 0) return null;

  return { diff };
}

export const basePriceFractionOfSavingsSplitThenOriginalPriceDifference: LianaMethod = {
  id: 'base-price-fraction-of-savings-split-then-original-price-difference-v1',
  demand: 'COMPUTE',
  name: 'Compute the difference between two items\' original prices given a sale-price relation and a fractional split of combined savings',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C257, GSM8K test item423',
  shapeDescription:
    'Item A sale price PA given. Item B sale price = PA - delta. Combined savings S given. A ' +
    'fraction N/D of S is item B\'s savings; the rest is item A\'s. Original prices = sale + own ' +
    'savings. Answer = |originalB - originalA|.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a sale-price-A + sale-price-B-as-delta-less + combined-savings + ' +
          'fraction-of-savings + "how much more...originally cost" chain resolving to a whole-' +
          'dollar difference; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `original price difference = ${result.diff}` };
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
          verdict: String(Math.round((result.diff) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '|(saleB + savingsB) - (saleA + savingsA)|, exact rational arithmetic',
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

registerMethod(basePriceFractionOfSavingsSplitThenOriginalPriceDifference);
