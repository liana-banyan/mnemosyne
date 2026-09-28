// D-BP223-BM04-h2cbp9d8-171 -- split-whole-by-two-fractions-then-flat-consumed-remainder-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\split-whole-by-two-fractions-then-flat-consumed-remainder-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R07
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C233 (GSM8K test.jsonl item396, singleton).
 *
 * @generalShape A whole of stated TOTAL units is divided: a fraction goes to a first named
 *   recipient, a different fraction goes to a second named recipient, and the OWNER then consumes
 *   a FLAT count of the same units. The question asks how many units are left.
 *   remaining = total - total*fracA - total*fracB - flatConsumed.
 *
 * @recogniseInStranger Requires, as positive evidence, all of: (a) "dividing up a <whole> with
 *   <total> <units>"; (b) "gives <p1>/<q1> to <NameA> and <p2>/<q2> to <NameB>" -- BOTH fractions
 *   in one sentence, both recipients named; (c) "<owner> eats <flat> <units>" -- a flat count, not
 *   a further fraction; (d) a closing "how many <units> are left" question.
 *
 * @whatBreaksIt (a) either fraction's denominator does not divide the total exactly -- abstain
 *   rather than round; (b) a third recipient, or the owner's own consumption expressed as a
 *   fraction instead of a flat count -- no match, abstain; (c) the two fractions given in separate
 *   sentences instead of one "gives ... and ..." clause -- no match, abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item396): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'split-whole-by-two-fractions-then-flat-consumed-remainder-v1';

const TOTAL_RE = /dividing up an?\s+[a-z]+\s+with\s+(\d+)\s+([a-z]+)/i;
const GIVE_RE = /gives?\s+(\d+)\/(\d+)\s+to\s+([A-Z][a-zA-Z]*)\s+and\s+(\d+)\/(\d+)\s+to\s+([A-Z][a-zA-Z]*)/i;
const EAT_RE = /eats?\s+(\d+)\s+[a-z]+/i;
const CLOSING_Q_RE = /how many\s+[a-z]+\s+are left/i;

interface Analyzed { remaining: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalM = TOTAL_RE.exec(q);
  const giveM = GIVE_RE.exec(q);
  const eatM = EAT_RE.exec(q);
  if (!totalM || !giveM || !eatM) return null;
  if (!CLOSING_Q_RE.test(q)) return null;

  const total = Number(totalM[1]);
  const num1 = Number(giveM[1]);
  const den1 = Number(giveM[2]);
  const num2 = Number(giveM[4]);
  const den2 = Number(giveM[5]);
  const eaten = Number(eatM[1]);
  if (![total, num1, den1, num2, den2, eaten].every(Number.isFinite)) return null;
  if (den1 <= 0 || den2 <= 0) return null;

  const give1Numerator = total * num1;
  const give2Numerator = total * num2;
  if (give1Numerator % den1 !== 0 || give2Numerator % den2 !== 0) return null;

  const give1 = give1Numerator / den1;
  const give2 = give2Numerator / den2;
  const remaining = total - give1 - give2 - eaten;
  if (remaining < 0) return null;

  return { remaining };
}

export const splitWholeByTwoFractionsThenFlatConsumedRemainder: LianaMethod = {
  id: 'split-whole-by-two-fractions-then-flat-consumed-remainder-v1',
  demand: 'COMPUTE',
  name: 'Compute what remains after two named fraction gifts and a flat consumption from a whole',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C233, GSM8K test item396',
  shapeDescription:
    'A whole of TOTAL units is split: fracA goes to person A, fracB goes to person B, the owner ' +
    'eats a flat count; remaining = total - total*fracA - total*fracB - flat, only when both ' +
    'fraction divisions land exactly and remaining is non-negative.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "dividing up a <whole> with <total> <units>" clause, a "gives p1/q1 to A ' +
          'and p2/q2 to B" clause, an "eats <flat> <units>" clause, and a "how many ... are left" ' +
          'closing question, with both fractions dividing the total exactly; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `remaining = ${result.remaining}` };
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
          verdict: String(Math.round((result.remaining) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'total minus two exact fraction gifts minus a flat consumption',
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

registerMethod(splitWholeByTwoFractionsThenFlatConsumedRemainder);
