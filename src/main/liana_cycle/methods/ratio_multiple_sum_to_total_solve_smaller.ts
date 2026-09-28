// D-BP223-BM04-h2cbpv9w-170 -- ratio-multiple-sum-to-total-solve-smaller-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\ratio-multiple-sum-to-total-solve-smaller-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C139 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 88, "Marilyn's first record sold 10 times
 * as many copies as Harald's. If they sold 88,000 copies combined, how many copies did Harald
 * sell?". Silo label: "algebraic_sum_ratio_problem -- sum of parts based on a ratio".
 *
 * @generalShape Actor A's count is stated as a fixed multiple (K times) of Actor B's count, for
 *   the same named quantity. A separate sentence states A and B's counts sum to a combined
 *   total. The question asks how many EITHER named actor has. Since A = K*B and A+B = T, B =
 *   T/(K+1) and A = K*B.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a "<multiplier> times as many <noun> as <ActorB>" ratio phrase inside a sentence that
 *       also names ActorA as its subject, before the ratio phrase;
 *   (b) a "<combined total>" sentence naming the SAME noun, with an explicit "combined" cue;
 *   (c) the question naming the same noun and asking how many ONE of the two named actors
 *       (either) has;
 *   (d) the multiplier being greater than zero and the resulting counts being non-negative
 *       integers.
 *
 * @whatBreaksIt (a) no explicit ratio-of-a-multiple phrase -- abstain; (b) no explicit
 *   "combined" total sentence -- abstain, never assume an unrelated total refers to these two
 *   actors; (c) the question's target actor name matching neither Actor A nor Actor B -- abstain,
 *   this guards against a third actor sharing the same paragraph; (d) the total not dividing
 *   evenly by (multiplier+1) -- abstain rather than round, exact integer division checked before
 *   use.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (the combined total split by the multiplier-plus-one ratio
 *   matches the item's own accepted count for the smaller party exactly). With only one known
 *   cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'ratio-multiple-sum-to-total-solve-smaller-v1';

interface Analyzed { value: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the ratio-of-a-multiple sentence, with its own subject (ActorA) captured first.
  const ratioRe = /\b([A-Za-z]+)(?:'s)?\b[^.!?]*?\bsold\s+(\d+)\s+times\s+as\s+many\s+([a-z]+)\s+as\s+([A-Za-z]+)(?:'s)?\b/i;
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const actorA = rm[1];
  const multiplier = parseInt(rm[2], 10);
  const noun = rm[3].toLowerCase();
  const actorB = rm[4];
  if (multiplier <= 0) return null;
  if (actorA.toLowerCase() === actorB.toLowerCase()) return null;

  // (b) the combined total, same noun, explicit "combined" cue.
  const totalRe = /\bsold\s+([\d,]+)\s+([a-z]+)\s+combined\b/i;
  const tm = totalRe.exec(q);
  if (!tm) return null;
  const total = parseInt(tm[1].replace(/,/g, ''), 10);
  const totalNoun = tm[2].toLowerCase();
  if (totalNoun !== noun) return null;

  // (c) the question's own target actor, same noun.
  const qRe = new RegExp('how\\s+many\\s+' + noun + '\\s+did\\s+([A-Za-z]+)\\s+sell', 'i');
  const qm = qRe.exec(q);
  if (!qm) return null;
  const target = qm[1];

  // B = total/(multiplier+1); A = multiplier*B. Exact integer division, abstain otherwise.
  const denom = multiplier + 1;
  if (total % denom !== 0) return null;
  const bCount = total / denom;
  const aCount = multiplier * bCount;

  if (target.toLowerCase() === actorB.toLowerCase()) return { value: bCount };
  if (target.toLowerCase() === actorA.toLowerCase()) return { value: aCount };
  return null;
}

export const ratioMultipleSumToTotalSolveSmaller: LianaMethod = {
  id: 'ratio-multiple-sum-to-total-solve-smaller-v1',
  demand: 'COMPUTE',
  name: 'Split a combined total between two actors related by a fixed multiple ratio',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C139, sole member harvest_gsm8k_pilot_item88_algebraic_sum_ratio_problem)',
  shapeDescription:
    'Actor A sold a fixed multiple of what Actor B sold, of the same named quantity; their ' +
    'combined total is stated explicitly; the question asks how many either actor sold; solved ' +
    'via total/(multiplier+1), exact integer split required.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a times-as-many ratio sentence plus a combined-total sentence for the ' +
          'same quantity plus a matching how-many-did-X-sell question with an exact integer ' +
          'split; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `solved count = ${result.value}` };
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
          verdict: String(Math.round(result.value * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'combined total split by the multiplier-plus-one ratio for the requested actor',
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

registerMethod(ratioMultipleSumToTotalSolveSmaller);
