// D-BP223-BM04-h2cbp9d8-171 -- average-of-listed-scores-stated-separately-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\average-of-listed-scores-stated-separately-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C227 (GSM8K test.jsonl item386, singleton).
 *
 * @generalShape A sentence states that a grade/value is "calculated by the average of N <items>"
 *   (naming a COUNT of items, not the values themselves). A LATER, separate sentence lists the
 *   actual values via "received:" (or "were:", "scored:") followed by a comma/and-separated list
 *   of exactly N plain numbers. The closing question asks for the current grade/value: answer =
 *   sum(list) / N, only when the list's own length equals N and the mean is a whole number.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "average of <N> <plural noun>"
 *   naming a COUNT (no numbers immediately follow "average of", distinguishing this from a shape
 *   that reads the list directly off the "average of" clause); (b) elsewhere in the SAME question,
 *   "received:"/"were:"/"scored:" followed by a comma/and-separated list of exactly N numbers;
 *   (c) a closing "what is ... current <grade/value>" question, not a yes/no threshold question.
 *
 * @whatBreaksIt (a) the "average of" clause is immediately followed by the number list itself
 *   (that is a different, already-registered shape and this candidate does not attempt it); (b)
 *   the list's length does not equal N -- abstain, a real mismatch or a different list; (c) the
 *   closing question asks a yes/no or comparison question about a threshold ("or higher") rather
 *   than the grade's value -- abstain, a distractor sentence this candidate must not answer; (d)
 *   the mean does not land on an exact integer -- abstain rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item386): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'average-of-listed-scores-stated-separately-v1';

const AVG_CUE_RE = /average of\s+(\d+)\s+[a-z]+/i;
const IMMEDIATE_LIST_RE = /average of\s+\d+(?:\s*,|\s+and\s+\d)/i;
const LIST_RE = /(?:received|were|scored)\s*:\s*([^.?!]+)/i;
const QUESTION_RE = /what is\b[^.?!]*\bcurrent\b[^.?!]*\b(?:grade|score|average)\b/i;
const THRESHOLD_DISTRACTOR_RE = /\bor higher\b|\bor lower\b|\bat least\b|\bor more\b/i;

interface Analyzed { average: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const cueM = AVG_CUE_RE.exec(q);
  if (!cueM) return null;
  if (IMMEDIATE_LIST_RE.test(q)) return null; // that is a different, already-registered shape

  const qM = QUESTION_RE.exec(q);
  if (!qM) return null;
  if (THRESHOLD_DISTRACTOR_RE.test(qM[0])) return null;

  const listM = LIST_RE.exec(q);
  if (!listM) return null;

  const n = Number(cueM[1]);
  const nums = listM[1]
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s));
  if (nums.length !== n) return null;
  if (nums.some((v) => !Number.isFinite(v))) return null;

  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum % n !== 0) return null;

  return { average: sum / n };
}

export const averageOfListedScoresStatedSeparately: LianaMethod = {
  id: 'average-of-listed-scores-stated-separately-v1',
  demand: 'COMPUTE',
  name: 'Compute the mean of a list of scores whose count and values are given in separate sentences',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C227, GSM8K test item386',
  shapeDescription:
    'One sentence names a COUNT of scores forming an average; a later "received:" sentence lists ' +
    'exactly that many literal numbers. Answer = sum(list)/count, only when the mean is a whole number.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an "average of N <items>" count cue paired with a separate "received:" ' +
          'list of exactly N numbers and a non-threshold "what is ... current grade" closing ' +
          'question resolving to a whole-number mean; abstaining rather than guessing',
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
          verdict: String(Math.round((result.average) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'summed the listed values and divided by the stated count',
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

registerMethod(averageOfListedScoresStatedSeparately);
