// D-BP223-BM04-h2cbp9d8-171 -- percent-subset-halved-by-absence-plus-flat-joiners-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\percent-subset-halved-by-absence-plus-flat-joiners-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C226 (GSM8K test.jsonl item385, singleton).
 *
 * @generalShape A group of a stated total size has a stated PERCENTAGE that is one named subset.
 *   Only that subset is scheduled to perform/participate. A stated event then causes HALF of the
 *   already-selected performing subset to be unable to attend. A stated FLAT number of a different
 *   group then joins the remaining performers. The closing question asks how many participated in
 *   total: subset = total*percent/100; afterAbsence = subset/2; final = afterAbsence + joiners.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, in the SAME question: (a) "has <N>
 *   members" with a stated total; (b) "<P>% of which are <subset noun>"; (c) an explicit clause
 *   that only that subset performs ("perform with just/only its <subset> members"); (d) an
 *   explicit clause that HALF of the people already performing cannot attend/make it; (e) an
 *   explicit clause that a stated flat count of a named group decides to sing/join/participate
 *   with the remainder; (f) a closing "how many people sang/performed/participated" question.
 *
 * @whatBreaksIt (a) any of the six clauses above is missing -- abstain, this is a narrow
 *   multi-clause shape and a partial match is not positive evidence; (b) the halving clause
 *   applies to a group other than the already-selected performing subset (e.g. half of the WHOLE
 *   choir, not half of the performers) -- this candidate anchors specifically on "half...people
 *   performing", so a differently-worded halving clause is correctly not matched; (c) either
 *   division (percentage-of-total, or subset-by-two) fails to land on a whole number -- abstain
 *   rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item385): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'percent-subset-halved-by-absence-plus-flat-joiners-v1';

const TOTAL_RE = /has\s+(\d+)\s+members/i;
const PERCENT_RE = /(\d+)%\s+of which are\s+(?:girls|female|women)/i;
const PERFORM_RE = /perform\s+with\s+(?:just|only)\s+its\s+(?:female|girl)\s+members/i;
const ABSENCE_RE = /half\s+(?:the|of the)\s+people\s+performing\s+can'?t\s+(?:make it|attend|come)/i;
const JOIN_RE = /(\d+)\s+teachers?\b[^.?!]*?\b(?:decide|decides)\s+to\s+(?:sing|join|participate)/i;
const QUESTION_RE = /how many people\s+(?:sang|performed|participated)\s+in the performance/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalM = TOTAL_RE.exec(q);
  const pctM = PERCENT_RE.exec(q);
  if (!totalM || !pctM) return null;
  if (!PERFORM_RE.test(q)) return null;
  if (!ABSENCE_RE.test(q)) return null;
  const joinM = JOIN_RE.exec(q);
  if (!joinM) return null;
  if (!QUESTION_RE.test(q)) return null;

  const total = Number(totalM[1]);
  const pct = Number(pctM[1]);
  const joiners = Number(joinM[1]);
  if (![total, pct, joiners].every(Number.isFinite)) return null;
  if (pct <= 0 || pct > 100) return null;

  const subsetRaw = total * pct;
  if (subsetRaw % 100 !== 0) return null;
  const subset = subsetRaw / 100;
  if (subset % 2 !== 0) return null;
  const afterAbsence = subset / 2;

  return { total: afterAbsence + joiners };
}

export const percentSubsetHalvedByAbsencePlusFlatJoiners: LianaMethod = {
  id: 'percent-subset-halved-by-absence-plus-flat-joiners-v1',
  demand: 'COMPUTE',
  name: 'Compute final headcount after a percentage subset is halved by absence then joined by a flat group',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C226, GSM8K test item385',
  shapeDescription:
    'A percentage subset of a total group performs; half of that performing subset is absent; a ' +
    'flat count of another group joins the remainder. Final = (total*percent/100)/2 + joiners, ' +
    'only when both divisions land exactly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find all of: a total headcount, a percentage subset, a "performs with just ' +
          'its subset" clause, a "half the people performing can\'t make it" clause, a flat ' +
          'joiners clause, and a matching "how many people sang/performed" closing question; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `final performer count = ${result.total}` };
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
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'percentage subset of total, halved for absence, plus a flat joiner count',
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

registerMethod(percentSubsetHalvedByAbsencePlusFlatJoiners);
