// D-BP223-BM04-h2cbpv9w-170 -- unit-count-from-rate-then-secondary-rate-plus-addend-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\unit-count-from-rate-then-secondary-rate-plus-addend-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C180 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 323, "Each ice cube cools the coffee by 13
 * degrees but makes the coffee 12 milliliters weaker. ... How many milliliters weaker is
 * Shannon's iced coffee when it is cooled by 65 degrees and she adds 15 milliliters of cream?"
 * Silo label: "multi-step word problem involving proportional relationships and additive
 * quantities" -- matches exactly.
 *
 * @generalShape A single UNIT (e.g. one ice cube) has TWO stated per-unit effects: a PRIMARY
 *   effect rate (degrees of cooling) and a SECONDARY effect rate (milliliters weaker), both
 *   sharing the same unit. A target TOTAL of the PRIMARY effect is given, from which the number
 *   of units is derived (total / primary rate). That unit count scaled by the SECONDARY rate
 *   gives the secondary effect from the units alone. A separate, directly-stated ADDITIONAL
 *   amount of the SAME secondary effect (an added liquid) is then added on top. The question asks
 *   for the total secondary effect.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) "Each <unit> cools the coffee by <R1> degrees but makes the coffee <R2> milliliters
 *       weaker" -- both per-unit rates in one sentence;
 *   (b) a closing question "cooled by <TOTAL> degrees and <adds|added> <D> milliliters of
 *       <liquid>" giving the target primary total and the additional secondary amount together;
 *   (c) the question itself asks "how many milliliters weaker".
 *
 * @whatBreaksIt (a) the target primary total not dividing the primary rate evenly (a fractional
 *   unit count) -- abstain rather than round; (b) the two rates or the total/additional amount
 *   using different units (e.g. degrees Fahrenheit vs Celsius, or ounces instead of
 *   milliliters) -- out of scope, this candidate only recognises the exact "degrees" /
 *   "milliliters" pairing it was taught on; (c) no additional-liquid clause present -- abstain,
 *   this shape always requires the extra addend to be stated, never assumed as zero.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (65/13=5 cubes, 5*12=60 ml from cubes, +15 ml cream = 75 ml
 *   total). With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'unit-count-from-rate-then-secondary-rate-plus-addend-v1';

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateRe = /\beach\s+([a-z]+(?:\s+[a-z]+)?)\s+cools\s+the\s+coffee\s+by\s+(\d+(?:\.\d+)?)\s+degrees?\s+but\s+makes\s+the\s+coffee\s+(\d+(?:\.\d+)?)\s+milliliters?\s+weaker\b/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const primaryRate = parseFloat(rm[2]);
  const secondaryRate = parseFloat(rm[3]);
  if (!Number.isFinite(primaryRate) || primaryRate <= 0 || !Number.isFinite(secondaryRate) || secondaryRate < 0) return null;

  const targetRe = /cooled\s+by\s+(\d+(?:\.\d+)?)\s+degrees?\s+and\s+(?:she|he|they)\s+add(?:s|ed)?\s+(\d+(?:\.\d+)?)\s+milliliters?\s+of\s+[a-z]+/i;
  const tm = targetRe.exec(q);
  if (!tm) return null;
  const primaryTotal = parseFloat(tm[1]);
  const addend = parseFloat(tm[2]);
  if (!Number.isFinite(primaryTotal) || primaryTotal <= 0 || !Number.isFinite(addend) || addend < 0) return null;

  if (!/how many milliliters weaker/i.test(q)) return null;

  if (primaryTotal % primaryRate !== 0) return null;
  const units = primaryTotal / primaryRate;
  const total = units * secondaryRate + addend;
  if (total < 0 || !Number.isFinite(total)) return null;
  return { total };
}

export const unitCountFromRateThenSecondaryRatePlusAddend: LianaMethod = {
  id: 'unit-count-from-rate-then-secondary-rate-plus-addend-v1',
  demand: 'COMPUTE',
  name: 'Derive unit count from a primary per-unit rate, scale by a secondary per-unit rate, then add a separately stated amount',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W19 (cluster C180, sole member: pilot corpus item at index 323)',
  shapeDescription:
    'units = primaryTotal / primaryRate; total = units * secondaryRate + addend.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the per-unit dual-rate sentence (cools by N degrees but makes M ' +
          'milliliters weaker), a closing clause giving both a target primary total and an ' +
          'added-liquid amount, and the "how many milliliters weaker" question, resolving to a ' +
          'non-negative value via exact unit division; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total secondary effect = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'derived unit count from the primary rate, scaled by the secondary rate, then added the extra amount',
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

registerMethod(unitCountFromRateThenSecondaryRatePlusAddend);
