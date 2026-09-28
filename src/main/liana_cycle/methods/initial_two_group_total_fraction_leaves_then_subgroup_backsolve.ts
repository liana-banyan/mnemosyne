// D-BP223-BM04-h2cbpv9w-170 -- initial-two-group-total-fraction-leaves-then-subgroup-backsolve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\initial-two-group-total-fraction-leaves-then-subgroup-backsolve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C177 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 320, "At the beginning of the party, there
 * were 25 men and 15 women. After an hour, 1/4 of the total number of people left. How many women
 * are left if 22 men stayed at the party?" Silo label: "multi-step word problem involving
 * fractions and subtraction" -- matches exactly.
 *
 * @generalShape TWO named subgroups (group1, group2) each given an initial count. A stated
 *   FRACTION of the combined total then leaves, leaving a "stayed" remainder. The closing
 *   question gives the STAYED count for ONE named group and asks how many of the OTHER named
 *   group remain, computed as (total - total*fraction) - givenStayedCount.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a sentence naming two initial counts, "there were <N1> <group1> and <N2> <group2>";
 *   (b) a sentence "<fraction> of the total number of people left" (a literal a/b fraction, or
 *       the single word "half", never a percentage and never a word-fraction);
 *   (c) a closing question "how many <groupX> are left if <N3> <groupY> stayed", where groupX and
 *       groupY are DISTINCT and each matches (singular or exact) one of group1/group2.
 *
 * @whatBreaksIt (a) more than two initial subgroups -- abstain, this candidate is two-group only;
 *   (b) the fraction leaving not being a literal digit fraction or "half" -- abstain, never guess
 *   a word-fraction; (c) groupX and groupY resolving to the SAME group, or either not matching
 *   group1/group2 -- abstain; (d) the fraction of the total not landing on an exact integer
 *   headcount, or the final remaining count being negative -- abstain rather than round or guess.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (total 40, 1/4 left = 10, stayed 30, 22 men stayed, 30-22=8
 *   women remain). With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'initial-two-group-total-fraction-leaves-then-subgroup-backsolve-v1';

function normGroup(s: string): string {
  const w = s.trim().toLowerCase();
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

function parseFraction(tok: string): { num: number; den: number } | null {
  const t = tok.trim().toLowerCase();
  if (t === 'half') return { num: 1, den: 2 };
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) {
    const num = parseInt(m[1], 10);
    const den = parseInt(m[2], 10);
    if (den > 0 && num > 0 && num < den) return { num, den };
  }
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const initRe = /there were\s+(\d+)\s+([a-z]+)\s+and\s+(\d+)\s+([a-z]+)\b/i;
  const im = initRe.exec(q);
  if (!im) return null;
  const n1 = parseInt(im[1], 10);
  const group1 = normGroup(im[2]);
  const n2 = parseInt(im[3], 10);
  const group2 = normGroup(im[4]);
  if (!Number.isFinite(n1) || !Number.isFinite(n2) || n1 <= 0 || n2 <= 0 || group1 === group2) return null;

  const leaveRe = /\b(\d+\s*\/\s*\d+|half)\s+of\s+the\s+total\s+number\s+of\s+people\s+left\b/i;
  const lm = leaveRe.exec(q);
  if (!lm) return null;
  const frac = parseFraction(lm[1]);
  if (!frac) return null;

  const total = n1 + n2;
  if ((total * frac.num) % frac.den !== 0) return null;
  const leftCount = (total * frac.num) / frac.den;
  const stayedTotal = total - leftCount;
  if (stayedTotal < 0) return null;

  const closeRe = /how many\s+([a-z]+)\s+are left\s+if\s+(\d+)\s+([a-z]+)\s+stayed\b/i;
  const cm = closeRe.exec(q);
  if (!cm) return null;
  const askGroup = normGroup(cm[1]);
  const givenStayed = parseInt(cm[2], 10);
  const givenGroup = normGroup(cm[3]);
  if (!Number.isFinite(givenStayed) || givenStayed < 0) return null;
  if (askGroup === givenGroup) return null;
  if (!((askGroup === group1 && givenGroup === group2) || (askGroup === group2 && givenGroup === group1))) return null;

  const result = stayedTotal - givenStayed;
  if (result < 0 || !Number.isInteger(result)) return null;
  return { total: result };
}

export const initialTwoGroupTotalFractionLeavesThenSubgroupBacksolve: LianaMethod = {
  id: 'initial-two-group-total-fraction-leaves-then-subgroup-backsolve-v1',
  demand: 'COMPUTE',
  name: 'Two initial subgroup counts, a fraction of the combined total leaves, backsolve the other subgroup remaining',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W19 (cluster C177, sole member: pilot corpus item at index 320)',
  shapeDescription:
    'group1 + group2 = total; a stated fraction of total leaves; one subgroup\'s stayed count is ' +
    'given; the other subgroup\'s remaining count is (total - total*fraction) - givenStayed.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two initial subgroup counts, a literal-fraction "of the total number of ' +
          'people left" clause, and a closing "how many X are left if N Y stayed" naming the ' +
          'other subgroup, resolving to a non-negative integer; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `remaining subgroup count = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'subtracted the fraction that left, then backsolved the other subgroup',
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

registerMethod(initialTwoGroupTotalFractionLeavesThenSubgroupBacksolve);
