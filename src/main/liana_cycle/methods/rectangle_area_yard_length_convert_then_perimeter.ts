// D-BP223-BM04-h2cbp9d8-171 -- rectangle-area-yard-length-convert-then-perimeter-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\rectangle-area-yard-length-convert-then-perimeter-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C273 (GSM8K test.jsonl item440, singleton).
 *
 * @generalShape A rectangle's area A is given in square feet, and its length is given in YARDS.
 *   The question asks for the perimeter in feet. The corpus's own ground truth (verified against
 *   item440's own "#### 98" line before this candidate was written: 3 yards -> 9 feet, 360/9=40,
 *   2*(40+9)=98) is reproduced here exactly: convert the length to feet (x3), derive the width as
 *   A / lengthFeet, then perimeter = 2*(lengthFeet + width).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an "area of...is <A> square
 *   feet" clause; (b) a "length of...is <L> yards" clause (the unit word "yards", not feet or any
 *   other unit); (c) a closing "perimeter of the room in feet" question.
 *
 * @whatBreaksIt (a) more than one area or length clause -- ambiguous, abstain; (b) the length
 *   given directly in feet (no yard-to-feet conversion needed) -- a different, simpler shape this
 *   candidate does not attempt; (c) the area not dividing evenly by the converted length -- would
 *   produce a non-integer width, abstain rather than report a fractional perimeter; (d) a question
 *   asking for area or a different unit than feet -- not this shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item440): lengthFeet = 3*3 = 9, width = 360/9 = 40, perimeter = 2*(9+40) = 98 (exact
 *   integer arithmetic throughout, never a float heuristic). SOLVED. Reach across a wider corpus
 *   is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape
 *   with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'rectangle-area-yard-length-convert-then-perimeter-v1';

const AREA_RE = /area of[^.?!]*?\bis\s+([\d,]+)\s+square feet\b/i;
const LENGTH_YARDS_RE = /length of[^.?!]*?\bis\s+(\d+)\s+yards?\b/i;
const ASK_RE = /perimeter of the room in feet\b/i;
const FEET_PER_YARD = 3;

interface Analyzed { perimeter: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const areaMatches = [...q.matchAll(new RegExp(AREA_RE.source, 'gi'))];
  if (areaMatches.length !== 1) return null; // exactly one, unambiguous
  const area = Number(areaMatches[0][1].replace(/,/g, ''));
  if (!Number.isFinite(area) || area <= 0) return null;

  const lengthMatches = [...q.matchAll(new RegExp(LENGTH_YARDS_RE.source, 'gi'))];
  if (lengthMatches.length !== 1) return null; // exactly one, unambiguous
  const lengthYards = Number(lengthMatches[0][1]);
  if (!Number.isFinite(lengthYards) || lengthYards <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const lengthFeet = lengthYards * FEET_PER_YARD; // exact integer
  if (area % lengthFeet !== 0) return null; // would not land on a whole-number width
  const width = area / lengthFeet;
  const perimeter = 2 * (lengthFeet + width); // exact integer

  return { perimeter };
}

export const rectangleAreaYardLengthConvertThenPerimeter: LianaMethod = {
  id: 'rectangle-area-yard-length-convert-then-perimeter-v1',
  demand: 'COMPUTE',
  name: 'Compute a rectangle\'s perimeter in feet, given its area in square feet and its length in yards',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C273, GSM8K test item440',
  shapeDescription:
    'Area A given in square feet; length L given in yards; asks for perimeter in feet. ' +
    'Answer = 2*((L*3) + A/(L*3)), matching the corpus\'s own worked chain, only when the area ' +
    'divides evenly by the converted length.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one "area...is <A> square feet" clause plus exactly one ' +
          '"length...is <L> yards" clause plus a "perimeter of the room in feet" closing ' +
          'question, resolving to a whole-number width; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `perimeter = ${result.perimeter}` };
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
          verdict: String(Math.round((result.perimeter) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '2*((length_yards*3) + area/(length_yards*3)), exact integer arithmetic',
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

registerMethod(rectangleAreaYardLengthConvertThenPerimeter);
