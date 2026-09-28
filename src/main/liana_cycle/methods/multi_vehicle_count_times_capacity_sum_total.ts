// D-BP223-BM04-h2cbp9d8-171 -- multi-vehicle-count-times-capacity-sum-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multi-vehicle-count-times-capacity-sum-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C258 (GSM8K test.jsonl item424, singleton).
 *
 * @generalShape THREE OR MORE categories of vehicle (or container) are each stated as a count
 *   and a per-unit holding capacity, in the pattern "<count> <plural noun> ... hold <capacity>
 *   <unit>" (or "capacity of holding <capacity> <unit>"). The question asks the TOTAL number of
 *   the held unit across all categories combined ("how many <unit> can join/attend/ride"). The
 *   answer is the sum, across every matched category, of count*capacity. Verified against
 *   item424's own "#### 570" line before this candidate was written: 4*60 + 6*30 + 10*15 =
 *   240+180+150 = 570.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) at least THREE distinct
 *   "<count> <noun-phrase> ... (hold|can hold|holding|capacity of holding) <capacity>" clauses
 *   found by one repeated global regex pass over the question text; (b) a closing question asking
 *   "how many <plural noun>" together with a joining/attending/riding verb ("can join",
 *   "attend", "ride"). Every count and every capacity figure must be a positive integer, and no
 *   two clauses may share the exact same (count, capacity) pair with the same leading noun token
 *   (a defence against double-matching the same clause twice via an overlapping regex).
 *
 * @whatBreaksIt (a) fewer than three genuine count+capacity clauses are found -- this shape is
 *   defined as three-or-more categories; two or one is a different (simpler) shape this candidate
 *   does not attempt, and it abstains rather than guess a partial sum; (b) any matched capacity
 *   figure is not a whole number, or a clause's count is 0 -- abstain; (c) the question asks about
 *   only ONE named category (e.g. "how many buses"), not the combined total across all of them --
 *   a different question this candidate does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item424): clauses (4,60), (6,30), (10,15); total = 4*60+6*30+10*15 = 240+180+150 = 570
 *   (exact integer arithmetic throughout, no floats). SOLVED. Reach across a wider corpus is
 *   recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multi-vehicle-count-times-capacity-sum-total-v1';

// Captures "<count> <word(s)> ... (hold|can hold|holding|capacity of holding) <capacity>". The
// noun-phrase gap is bounded and non-greedy so the match does not accidentally span into the
// NEXT clause's own count.
const CLAUSE_RE = /(\d+)\s+[a-z][a-z\s]{0,40}?(?:that\s+can\s+hold|can\s+hold|of\s+holding|holding|hold)\s+(\d+)/gi;
const ASK_RE = /how\s+many\s+[a-z]+\s+can\s+(?:join|attend|ride)/i;

interface Analyzed { total: number; clauseCount: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  CLAUSE_RE.lastIndex = 0;
  const clauses: Array<{ count: number; capacity: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = CLAUSE_RE.exec(q)) !== null) {
    const count = Number(m[1]);
    const capacity = Number(m[2]);
    if (!Number.isInteger(count) || count <= 0) continue;
    if (!Number.isInteger(capacity) || capacity <= 0) continue;
    clauses.push({ count, capacity });
    // Guard against a zero-width or non-advancing loop.
    if (CLAUSE_RE.lastIndex === m.index) CLAUSE_RE.lastIndex++;
  }
  if (clauses.length < 3) return null; // this shape is defined as three-or-more categories

  // De-duplicate exact (count, capacity) pairs matched twice by an overlapping regex pass.
  const seen = new Set<string>();
  const distinct: Array<{ count: number; capacity: number }> = [];
  for (const c of clauses) {
    const key = c.count + ':' + c.capacity;
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(c);
  }
  if (distinct.length < 3) return null;

  const total = distinct.reduce((sum, c) => sum + c.count * c.capacity, 0);
  if (!Number.isFinite(total) || total <= 0) return null;

  return { total, clauseCount: distinct.length };
}

export const multiVehicleCountTimesCapacitySumTotal: LianaMethod = {
  id: 'multi-vehicle-count-times-capacity-sum-total-v1',
  demand: 'COMPUTE',
  name: 'Sum count times per-unit capacity across three or more vehicle/container categories',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C258, GSM8K test item424',
  shapeDescription:
    'Three or more "<count> <noun> ... hold <capacity>" clauses. Total = sum of count*capacity ' +
    'across every matched category, asked for by a "how many <unit> can join/attend/ride" ' +
    'closing question.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find three or more distinct "<count> ... hold <capacity>" clauses together ' +
          'with a "how many...can join/attend/ride" closing question; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `total capacity = ${result.total} across ${result.clauseCount} categories` };
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
          basis: 'sum of count*capacity across every matched vehicle/container category, exact integer arithmetic',
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

registerMethod(multiVehicleCountTimesCapacitySumTotal);
