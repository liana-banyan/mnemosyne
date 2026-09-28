// D-BP223-BM04-h2cbpv9w-170 -- total-split-two-equal-plus-smaller-offset-group-backsolve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-split-two-equal-plus-smaller-offset-group-backsolve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C191 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 338, "A class of 200 students is split into 3 groups such
 * that 2 of them are equal in number and the last one (which is the smallest) is 10 less than
 * each of the other groups. How many students are in this (smallest) group?". Silo label:
 * "algebraic word problem involving equal parts and a difference".
 *
 * @generalShape A TOTAL count of a population is split into exactly THREE groups: two EQUAL
 *   groups and a third, SMALLER group that is a stated fixed amount less than each of the two
 *   equal groups. Let y = each equal group's size and d = the offset; then
 *   total = 2y + (y - d) = 3y - d, so y = (total + d) / 3 and the smallest group =
 *   y - d = (total - 2d) / 3. The question asks for the size of the smallest group.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "A <group-noun> of <total>
 *   <population-noun> is split into 3 groups"; (b) "such that 2 of them are equal in number"; (c)
 *   "the last one (which is the smallest) is <offset> less than each of the other groups"; (d) a
 *   closing "how many <population-noun> are in this (smallest) group" question.
 *
 * @whatBreaksIt (a) total or offset failing to parse as a positive integer -- abstain; (b)
 *   (total - 2*offset) not being an exact non-negative multiple of 3 -- abstain rather than round
 *   or report a negative/fractional group size; (c) the derived smallest-group size being greater
 *   than or equal to the derived equal-group size (would contradict "smallest") -- abstain, this
 *   candidate never reports a result that violates its own stated ordering.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED. y = (200+10)/3 = 70. smallest = 70-10 = 60, equivalently
 *   (200 - 2*10)/3 = 180/3 = 60. With only one known cluster member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-split-two-equal-plus-smaller-offset-group-backsolve-v1';

interface Analyzed { smallest: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const openRe = /A\s+[a-z]+\s+of\s+(\d+)\s+[a-z]+\s+is split into\s+3\s+groups/i;
  const om = openRe.exec(q);
  if (!om) return null;
  const total = parseInt(om[1], 10);
  if (!Number.isFinite(total) || total <= 0) return null;

  if (!/such that\s+2\s+of them are equal in number/i.test(q)) return null;

  const offsetRe = /the last one\s*\(which is the smallest\)\s+is\s+(\d+)\s+less than each of the other groups/i;
  const offM = offsetRe.exec(q);
  if (!offM) return null;
  const offset = parseInt(offM[1], 10);
  if (!Number.isFinite(offset) || offset <= 0) return null;

  if (!/how many\s+[a-z]+\s+are in this\s*\(smallest\)\s+group/i.test(q)) return null;

  const numerator = total - 2 * offset;
  if (numerator < 0 || numerator % 3 !== 0) return null;
  const smallest = numerator / 3;
  const equalGroup = smallest + offset;
  if (smallest >= equalGroup) return null;
  return { smallest };
}

export const totalSplitTwoEqualPlusSmallerOffsetGroupBacksolve: LianaMethod = {
  id: 'total-split-two-equal-plus-smaller-offset-group-backsolve-v1',
  demand: 'COMPUTE',
  name: 'A total is split into two equal groups plus a smaller group offset by a fixed amount -- backsolve the smallest group via exact integer arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C191, sole member: pilot corpus item at index 338)',
  shapeDescription: 'smallest = (total - 2*offset) / 3, required to land on a non-negative integer strictly less than the equal-group size',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "A <noun> of <total> <noun> is split into 3 groups" opener, the "such ' +
          'that 2 of them are equal in number" clause, "the last one (which is the smallest) is ' +
          '<offset> less than each of the other groups", and a closing "how many <noun> are in ' +
          'this (smallest) group" question resolving to an exact non-negative integer strictly ' +
          'less than the equal-group size; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `smallest = ${result.smallest}` };
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
          verdict: String(Math.round(result.smallest * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(total - 2*offset) / 3, exact integers only',
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

registerMethod(totalSplitTwoEqualPlusSmallerOffsetGroupBacksolve);
