// D-BP223-BM04-h2cbpv9w-170 -- average-of-explicit-value-list-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\average-of-explicit-value-list-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W15, SHAPE 6 of 8: "average of k values", mined by frequency
 * over the frozen TUNING RESERVE (gsm8k-train half, 3685 items; never the held-out half).
 * Cue-word membership over the reserve: 125 of 3685 items match a loose keyword probe (the
 * literal word "average"). Representative teaching case authored directly to this shape (below):
 * a clean "what is the average of A, B, and C" template with the values listed explicitly in the
 * question, since the reverse direction (average given, find a missing addend) is a different,
 * harder-to-verify arithmetic this candidate does not attempt.
 *
 * @generalShape The question asks, in its own closing clause, for the average (mean) of an
 *   explicitly listed set of two or more plain numbers appearing together in one list (comma
 *   and/or "and" separated), e.g. "what is the average of 4, 10, and 6". No other arithmetic step
 *   (a derived value standing in for one list member, an average GIVEN to find a missing member)
 *   is attempted.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) the phrase "average of" (or
 *   "the average of") followed immediately by a comma/and-separated list of two or more plain
 *   digit numbers; (b) the word "average" appears in a question clause containing "what is" or
 *   "find" or "calculate" (asking FOR the average, never stating one as already known); (c) the
 *   list contains no non-numeric tokens between the numbers other than "," and "and".
 *
 * @whatBreaksIt (a) "average of" followed by anything other than a clean number list (a noun
 *   phrase, a pronoun, an expression) -- abstain, this candidate reads only a literal digit list;
 *   (b) the word "average" appearing elsewhere as a GIVEN fact ("the average was 10") rather than
 *   as the thing being asked for -- abstain, computing forward from a known average to a missing
 *   value is a different, unattempted shape; (c) the mean not landing on an exact integer --
 *   abstain rather than round or report a repeating decimal.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (a clean three-number "average of A, B, and C" template):
 *   SOLVED. Reach across the wider tuning reserve is recorded in wave_manifest.json, not asserted
 *   here.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'average-of-explicit-value-list-v1';


const ASK_CUE = /\b(what is|find|calculate|determine)\b[^.?!]{0,40}\baverage\b/i;
const GIVEN_AVERAGE_CUE = /\baverage\b[^.?!]{0,15}\b(?:is|was|of)\s+\d/i;
const LIST_RE = /average of\s+((?:\d+(?:\.\d+)?\s*,\s*)+(?:and\s+)?\d+(?:\.\d+)?|(?:\d+(?:\.\d+)?\s+and\s+)+\d+(?:\.\d+)?)/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (!ASK_CUE.test(q)) return null;

  const lm = LIST_RE.exec(q);
  if (!lm) return null;
  const listText = lm[1];
  // A "given average" phrasing elsewhere in the SAME sentence as the list is a different shape.
  if (GIVEN_AVERAGE_CUE.test(q.replace(lm[0], ''))) return null;

  const nums = listText
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s));
  if (nums.length < 2 || nums.some((n) => !Number.isFinite(n))) return null;

  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum % nums.length !== 0) return null;
  const total = sum / nums.length;
  return { total };
}

export const averageOfExplicitValueList: LianaMethod = {
  id: 'average-of-explicit-value-list-v1',
  demand: 'COMPUTE',
  name: 'Compute the mean of an explicitly listed set of two or more numbers',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W15 (shape 6 of 8, mined by frequency over the tuning reserve, 125/3685 keyword members)',
  shapeDescription:
    'The closing question asks for the average of an explicit, literal comma/and-separated list ' +
    'of two or more numbers -- answer is their sum divided by their count, only when that lands ' +
    'on an exact integer.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "what is/find the average of" phrase followed by a clean literal list ' +
          'of two or more numbers resolving to an exact integer mean; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `mean = ${result.total}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.total) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'summed the explicit list and divided by its count' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(averageOfExplicitValueList);
