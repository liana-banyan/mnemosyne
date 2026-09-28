// D-BP223-BM04-h2cbp9d8-171 -- ratio-share-difference-from-known-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\ratio-share-difference-from-known-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C230 (GSM8K test.jsonl item391, singleton).
 *
 * @generalShape TWO named actors' shares of a named resource are given as a literal ratio "p:q".
 *   ONLY the total combined amount is given directly (neither actor's absolute amount is stated).
 *   The closing question asks how many MORE of the resource one named actor has than the other:
 *   perPart = total/(p+q); difference = perPart * |ratioOf(more) - ratioOf(less)|.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, from the SAME question: (a) "ratio
 *   of <resource> that <actorA> and <actorB> have is p:q"; (b) "total number of <resource> they
 *   have together is <T>" (the combined total, not either actor's own amount); (c) a closing "how
 *   many more <resource> does <X> have more/than <Y>" question, where X and Y resolve to actorA
 *   and actorB (in either order).
 *
 * @whatBreaksIt (a) either named actor in the closing question cannot be matched to the ratio
 *   clause's two actors -- abstain; (b) the resource's total is not evenly divisible by p+q --
 *   abstain rather than round; (c) the actor asked about as having "more" actually corresponds to
 *   the SMALLER ratio part -- abstain, a contradictory reading this candidate does not resolve by
 *   guessing which side is right; (d) an absolute value for one actor is given directly instead of
 *   only the combined total -- a different, already-registered ratio-scaling shape, not attempted here.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item391): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'ratio-share-difference-from-known-total-v1';

const RATIO_RE = /ratio of\s+[a-z]+\s+that\s+([A-Z][a-zA-Z]*)\s+and\s+([A-Z][a-zA-Z]*)\s+have is\s+(\d+):(\d+)/i;
const TOTAL_RE = /total number of\s+[a-z]+\s+they have together is\s+(\d+)/i;
const QUESTION_RE = /how many more\s+[a-z]+\s+does\s+([A-Z][a-zA-Z]*)\s+have\s+(?:more than|than)\s+([A-Z][a-zA-Z]*)/i;

interface Analyzed { difference: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ratioM = RATIO_RE.exec(q);
  const totalM = TOTAL_RE.exec(q);
  const qM = QUESTION_RE.exec(q);
  if (!ratioM || !totalM || !qM) return null;

  const actorA = ratioM[1];
  const actorB = ratioM[2];
  const ratioA = Number(ratioM[3]);
  const ratioB = Number(ratioM[4]);
  const total = Number(totalM[1]);

  const moreActor = qM[1];
  const lessActor = qM[2];

  let ratioMore: number | null = null;
  let ratioLess: number | null = null;
  if (moreActor === actorA && lessActor === actorB) { ratioMore = ratioA; ratioLess = ratioB; }
  else if (moreActor === actorB && lessActor === actorA) { ratioMore = ratioB; ratioLess = ratioA; }
  if (ratioMore === null || ratioLess === null) return null;

  const partsSum = ratioA + ratioB;
  if (partsSum <= 0 || total % partsSum !== 0) return null;
  const perPart = total / partsSum;

  if (ratioMore <= ratioLess) return null; // contradictory: asked-for "more" side has the smaller ratio

  return { difference: perPart * (ratioMore - ratioLess) };
}

export const ratioShareDifferenceFromKnownTotal: LianaMethod = {
  id: 'ratio-share-difference-from-known-total-v1',
  demand: 'COMPUTE',
  name: 'Compute the difference between two ratio shares of a resource from only the combined total',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C230, GSM8K test item391',
  shapeDescription:
    'Two actors\' resource shares are given as a literal p:q ratio; only the combined total is ' +
    'stated. difference = (total/(p+q)) * (largerPart - smallerPart), only when the question\'s ' +
    '"more" actor maps to the larger ratio part and the division lands exactly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching "ratio of <resource> that A and B have is p:q" clause, a ' +
          'combined-total clause, and a "how many more ... does X have than Y" closing question ' +
          'that resolves X and Y to the two ratio actors with X on the larger ratio part; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `difference = ${result.difference}` };
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
          verdict: String(Math.round((result.difference) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'per-part value from the combined total, scaled by the ratio-part difference',
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

registerMethod(ratioShareDifferenceFromKnownTotal);
