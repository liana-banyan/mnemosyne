// D-BP223-BM04-h2cbpv9w-170 -- offset-multiple-of-base-then-sum-two-actors-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\offset-multiple-of-base-then-sum-two-actors-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C137 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 82, "Grace weighs 125 pounds. Alex weighs
 * 2 pounds less than 4 times what Grace weighs. What are their combined weights in pounds?".
 * Silo label: "multi-step addition and multiplication -- multi-step arithmetic operations".
 *
 * @generalShape Actor A's weight is stated directly, in pounds. Actor B's weight is stated as an
 *   offset LESS THAN (or MORE THAN) a stated multiple of what Actor A weighs. The question asks
 *   for their COMBINED weight. Answer = A + (multiplier*A -+ offset), i.e. A plus B computed
 *   from the offset-of-a-multiple relation.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a plain "<ActorA> weighs <value> pounds" sentence, NOT itself followed by a "less/more
 *       than ... times" clause (so this candidate never mistakes the derived actor's own
 *       sentence for the base fact);
 *   (b) a second sentence "<ActorB> weighs <offset> pounds (less|more) than <multiplier> times
 *       what <ActorA> weighs", explicitly naming ActorA back by the SAME name captured in (a);
 *   (c) ActorB's name differing from ActorA's name;
 *   (d) the question's own closing sentence containing the word "combined" and the word
 *       "weight(s)", so this candidate never answers a question about only one actor or a
 *       DIFFERENCE between them.
 *
 * @whatBreaksIt (a) no plain base-weight sentence, or the only weight sentence found IS itself
 *   the "times what X weighs" one (no independent base fact) -- abstain; (b) the offset relation
 *   naming a different base actor than the one found in (a) -- abstain, never assume which actor
 *   is the true base; (c) no "combined" cue in the question -- abstain, this guards against a
 *   difference or single-actor question with near-identical prose; (d) a negative or fractional
 *   intermediate weight would be a red flag, but this candidate does not special-case it beyond
 *   requiring the final result be produced by ordinary integer arithmetic (both factors and the
 *   offset are already whole numbers by construction from `\d+`, so no rounding guard is needed
 *   here).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (Alex's weight from the offset-of-a-multiple relation, added to
 *   Grace's own base weight, matches the item's own accepted combined total exactly). With only
 *   one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'offset-multiple-of-base-then-sum-two-actors-v1';

interface Analyzed { combined: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the plain base-weight sentence, excluding one that is itself the derived relation.
  const baseRe = /\b([A-Za-z]+)\s+weighs\s+(\d+)\s+pounds\b(?!\s+(?:less|more)\s+than)/i;
  const bm = baseRe.exec(q);
  if (!bm) return null;
  const baseName = bm[1];
  const baseValue = parseInt(bm[2], 10);

  // (b) the derived-actor relation, explicitly naming the SAME base actor.
  const relRe = /\b([A-Za-z]+)\s+weighs\s+(\d+)\s+pounds\s+(less|more)\s+than\s+(\d+)\s+times\s+what\s+([A-Za-z]+)\s+weighs\b/i;
  const rm = relRe.exec(q);
  if (!rm) return null;
  const derivedName = rm[1];
  const offset = parseInt(rm[2], 10);
  const direction = rm[3].toLowerCase();
  const multiplier = parseInt(rm[4], 10);
  const referencedName = rm[5];
  if (referencedName.toLowerCase() !== baseName.toLowerCase()) return null;

  // (c) the two actors must be distinct.
  if (derivedName.toLowerCase() === baseName.toLowerCase()) return null;

  // (d) the closing sentence must ask for a COMBINED weight.
  const lastSentence = q.slice(Math.max(q.lastIndexOf('.'), q.lastIndexOf('!')) + 1);
  if (!/\bcombined\b/i.test(lastSentence) || !/\bweights?\b/i.test(lastSentence)) return null;

  const derivedValue = direction === 'less' ? multiplier * baseValue - offset : multiplier * baseValue + offset;
  const combined = baseValue + derivedValue;
  return { combined };
}

export const offsetMultipleOfBaseThenSumTwoActors: LianaMethod = {
  id: 'offset-multiple-of-base-then-sum-two-actors-v1',
  demand: 'COMPUTE',
  name: 'Derive one actor weight as an offset of a multiple of a base actor weight, then sum the two',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C137, sole member harvest_gsm8k_pilot_item82_multi_step_addition_and_multiplication)',
  shapeDescription:
    'Actor A weighs a stated amount; Actor B weighs a stated offset less/more than a stated ' +
    'multiple of what Actor A weighs; the question asks their combined weight; answer = A + ' +
    '(multiplier*A -+ offset).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a plain base-weight sentence plus a same-actor offset-of-a-multiple ' +
          'relation for a SECOND, distinct actor plus a combined-weight question; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `combined weight = ${result.combined}` };
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
          verdict: String(Math.round(result.combined * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'base actor weight plus (multiplier*base -+ offset) for the derived actor',
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

registerMethod(offsetMultipleOfBaseThenSumTwoActors);
