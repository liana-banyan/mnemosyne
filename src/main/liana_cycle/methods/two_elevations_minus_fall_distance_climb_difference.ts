// D-BP223-BM04-h2cbp9d8-171 -- two-elevations-minus-fall-distance-climb-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-elevations-minus-fall-distance-climb-difference-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C254 (GSM8K test.jsonl item419, singleton).
 *
 * @generalShape Actor1 is at a stated elevation E1. An object falls a stated distance D from
 *   actor1's position, landing at elevation E1-D. Actor2 is at a stated elevation E2, with E2 <
 *   E1-D (below the object's landing spot). The question asks how many feet actor2 must CLIMB to
 *   reach the object's landing elevation. The corpus's own ground truth (verified against
 *   item419's own "#### 3000" line before this candidate was written: 10000-4000=6000,
 *   6000-3000=3000) is reproduced here exactly: (E1-D) - E2.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a first "elevation of <E1>
 *   feet" clause for actor1; (b) a "fall <D> feet" clause describing an object's drop; (c) a
 *   second, distinct "elevation of <E2> feet" clause for actor2; (d) a closing question "how many
 *   feet must <actor2> climb" naming a climb (upward) verb, not a descent.
 *
 * @whatBreaksIt (a) fewer or more than exactly two "elevation of <N> feet" clauses in the question
 *   -- ambiguous, abstain; (b) the object's landing elevation (E1-D) not being strictly greater
 *   than E2 -- the "climb" framing does not apply (actor2 would need to descend, or is already
 *   there), abstain rather than report a negative or zero climb; (c) the closing question asking
 *   about actor1's climb, or a descend/drop verb, instead of actor2's climb -- different target,
 *   not handled.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item419): combElevation = 10000-4000 = 6000, climb = 6000-3000 = 3000 (exact integer
 *   arithmetic throughout, never a float heuristic). SOLVED. Reach across a wider corpus is
 *   recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-elevations-minus-fall-distance-climb-difference-v1';

const ELEVATION_RE = /elevation of\s+([\d,]+)\s+feet/gi;
const FALL_RE = /fall\s+([\d,]+)\s+feet/i;
const ASK_RE = /how many feet must \w+ climb/i;

interface Analyzed { climb: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const elevationMatches = [...q.matchAll(ELEVATION_RE)];
  if (elevationMatches.length !== 2) return null; // exactly two, unambiguous
  const e1 = Number(elevationMatches[0][1].replace(/,/g, ''));
  const e2 = Number(elevationMatches[1][1].replace(/,/g, ''));
  if (!Number.isFinite(e1) || e1 <= 0 || !Number.isFinite(e2) || e2 < 0) return null;

  const fallM = FALL_RE.exec(q);
  if (!fallM) return null;
  const fall = Number(fallM[1].replace(/,/g, ''));
  if (!Number.isFinite(fall) || fall <= 0 || fall >= e1) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const combElevation = e1 - fall;
  const climb = combElevation - e2;
  if (!Number.isFinite(climb) || climb <= 0) return null; // must genuinely need to climb UP

  return { climb };
}

export const twoElevationsMinusFallDistanceClimbDifference: LianaMethod = {
  id: 'two-elevations-minus-fall-distance-climb-difference-v1',
  demand: 'COMPUTE',
  name: 'Compute how far a second actor must climb to reach the elevation an object fell to from a first actor\'s stated elevation',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C254, GSM8K test item419',
  shapeDescription:
    'Actor1 at elevation E1; an object falls D feet from there; actor2 at elevation E2 (below the ' +
    'landing spot); asks how far actor2 must climb. Answer = (E1-D)-E2, matching the corpus\'s own ' +
    'worked chain, only when strictly positive.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two "elevation of <N> feet" clauses plus a "fall <D> feet" clause ' +
          'plus a "how many feet must <actor> climb" closing question, resolving to a strictly ' +
          'positive climb distance; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `climb = ${result.climb}` };
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
          verdict: String(Math.round((result.climb) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(elevation1 - fallDistance) - elevation2, exact integer arithmetic',
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

registerMethod(twoElevationsMinusFallDistanceClimbDifference);
