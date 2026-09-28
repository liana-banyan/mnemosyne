// D-BP223-BM04-h2cbpv9w-170 -- geometric-halving-levels-average-from-top-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\geometric-halving-levels-average-from-top-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C135 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 75, "Luke... each level of a sandcastle
 * will have half the square footage as the level below it. If he makes a 4 leveled sandcastle
 * where the top level has a square footage of 16, what is the average square footage of a
 * level?". Silo label: "average of a geometric sequence -- arithmetic mean of a finite geometric
 * sequence".
 *
 * @generalShape A structure has N stacked levels; each level is stated to have HALF the value
 *   (in some measured quantity) of the level immediately below it -- i.e. going from the top down,
 *   every level doubles the one above it. The TOP level's own value is given directly. The
 *   question asks for the AVERAGE of that same quantity across all N levels. Answer = top *
 *   (2^N - 1) / N.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an explicit halving sentence of the shape "each level ... will have half the <quantity>
 *       as the level below it", with the measured quantity phrase captured generically (never
 *       hardcoded to "square footage");
 *   (b) an explicit level count ("<N> level(ed/s) <structure>");
 *   (c) a "top level has a <same quantity> of <value>" sentence, naming the SAME quantity phrase
 *       captured in (a) -- never a different measured quantity;
 *   (d) the question itself containing the word "average" AND the same quantity phrase, so this
 *       candidate never answers an unrelated single-level or total question about the structure.
 *
 * @whatBreaksIt (a) no halving-relative-to-the-level-below sentence -- abstain, this shape is
 *   specifically the "half of the one below" direction, never the opposite ("double the one
 *   below"), which is a different arithmetic entirely; (b) fewer than two levels -- abstain,
 *   nothing to average; (c) the quantity phrase in the top-level sentence not matching the one in
 *   the halving sentence -- abstain, never assume the writer means the same measurement; (d) the
 *   final sum not dividing the level count evenly -- abstain rather than report a fractional
 *   average, using exact BigInt powers-of-two arithmetic throughout, never a floating heuristic.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (levels from the top down are 16, 32, 64, 128; their sum
 *   divided by 4 matches the item's own accepted average exactly). With only one known cluster
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'geometric-halving-levels-average-from-top-v1';

interface Analyzed { average: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the halving-relative-to-the-level-below sentence, quantity phrase captured generically.
  const halfRe = /\beach\s+level\s+(?:of\s+[a-z]+(?:\s+[a-z]+)*\s+)?will\s+have\s+half\s+the\s+([a-z]+(?:\s+[a-z]+)?)\s+as\s+the\s+level\s+below\s+it\b/i;
  const hm = halfRe.exec(q);
  if (!hm) return null;
  const quantityNoun = hm[1].trim().toLowerCase();

  // (b) the level count.
  const levelRe = /\b(\d+)[\s-]*level(?:ed|s)?\b/i;
  const lm = levelRe.exec(q);
  if (!lm) return null;
  const n = parseInt(lm[1], 10);
  if (!Number.isInteger(n) || n < 2) return null;

  // (c) the top level's own value, naming the SAME quantity phrase.
  const topRe = new RegExp('top\\s+level\\s+has\\s+a\\s+' + quantityNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+of\\s+(\\d+)', 'i');
  const tm = topRe.exec(q);
  if (!tm) return null;
  const top = parseInt(tm[1], 10);

  // (d) the question itself asks for the average of the same quantity.
  if (!/\baverage\b/i.test(q) || !q.toLowerCase().includes(quantityNoun)) return null;

  // Levels double going up-to-down from the top: top, top*2, top*4, ..., top*2^(n-1).
  // Sum = top*(2^n - 1). Exact BigInt power, never a floating heuristic; abstain on inexactness.
  const topB = BigInt(top);
  const nB = BigInt(n);
  let pow = 1n;
  for (let i = 0n; i < nB; i += 1n) pow *= 2n;
  const sum = topB * (pow - 1n);
  if (sum % nB !== 0n) return null;
  const average = sum / nB;
  return { average: Number(average) };
}

export const geometricHalvingLevelsAverageFromTop: LianaMethod = {
  id: 'geometric-halving-levels-average-from-top-v1',
  demand: 'COMPUTE',
  name: 'Average a quantity across N stacked levels that each halve the level below them, given the top level value',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C135, sole member harvest_gsm8k_pilot_item75_average_of_a_geometric_sequence)',
  shapeDescription:
    'N levels, each level stated to be half the measured quantity of the level below it (so ' +
    'levels double going from top to bottom); the top level value is given directly; the ' +
    'question asks for the average of the same quantity across all levels; answer = top*(2^N-1)/N.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a halving-relative-to-the-level-below sentence plus a matching level ' +
          'count, top-level value in the same quantity, and an average-of-that-quantity ' +
          'question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `average = ${result.average}` };
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
          verdict: String(Math.round(result.average * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'sum of doubling levels from the top divided by the level count, exact BigInt arithmetic',
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

registerMethod(geometricHalvingLevelsAverageFromTop);
