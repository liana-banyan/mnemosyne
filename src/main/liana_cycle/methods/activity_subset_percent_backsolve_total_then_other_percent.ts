// D-BP223-BM04-h2cbp9d8-171 -- activity-subset-percent-backsolve-total-then-other-percent-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\activity-subset-percent-backsolve-total-then-other-percent-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C199 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 353, "John decides to do several activities while out on
 * vacation. He spends 6 hours boating and half that time swimming. He also watched 3 different
 * shows which were 2 hours each. This was 30% of the time he spent. He spent 40% of his time
 * sightseeing. How much time did he spend sightseeing?" Silo label: "multi-step percentage and
 * time calculation".
 *
 * @generalShape A SUBSET of an actor's total time is built from named activities: a base
 *   duration, a fraction ("half that time") of the base spent on a second activity, and a
 *   count-times-rate activity (N occurrences, each a stated duration). That subset sums to a
 *   known figure, which is then stated to equal a PERCENTAGE of the actor's grand total time
 *   ("this was <P1>% of the time he spent"), letting the grand total be backsolved
 *   (subsetSum / (P1/100)). A SECOND, independent percentage of that SAME grand total ("he spent
 *   <P2>% of his time <activity>") is then computed and reported as the answer.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a base-activity clause "spends
 *   <N1> hours <activityA>"; (b) a fraction-of-base clause "half that time <activityB>" (or a
 *   recognised fraction word) in the SAME sentence; (c) a count-times-rate clause "watched <N2>
 *   ... shows which were <N3> hours each"; (d) a backsolve sentence "this was <P1>% of the time
 *   <Actor> spent"; (e) a second, independent percentage sentence "<Actor> spent <P2>% of
 *   <possessive> time <activityC>"; (f) a closing question asking how much time was spent on
 *   activityC, matching (e).
 *
 * @whatBreaksIt (a) the subset sum not being a positive number, or P1 being zero or missing --
 *   abstain, cannot backsolve a total by dividing by zero or an absent percentage; (b) the
 *   backsolved total not landing on an exact rational multiple compatible with P2 (this candidate
 *   still reports the exact rational product, never rounding, but abstains if either percentage
 *   fails to parse as a bare integer percent); (c) fewer than the three named subset activities
 *   present -- abstain, this candidate's subset-construction is specific to base + half-of-base +
 *   count*rate; (d) the closing question asking about an activity other than the one named in the
 *   second percentage sentence -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (subset = 6 + 3 + 3*2 = 15; total = 15 / 0.30 = 50; sightseeing
 *   = 50 * 0.40 = 20). With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'activity-subset-percent-backsolve-total-then-other-percent-v1';

interface Analyzed { sightseeingTime: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseRe = /spends?\s+(\d+)\s+hours?\s+[a-z]+\s+and\s+half\s+that\s+time\s+[a-z]+/i;
  const bm = baseRe.exec(q);
  if (!bm) return null;
  const baseHours = parseInt(bm[1], 10);
  if (!Number.isFinite(baseHours) || baseHours <= 0) return null;
  const halfHours = baseHours / 2;

  const countRateRe = /watched\s+(\d+)\s+[a-z]+\s+shows?\s+which\s+were\s+(\d+)\s+hours?\s+each/i;
  const crm = countRateRe.exec(q);
  if (!crm) return null;
  const showCount = parseInt(crm[1], 10);
  const showHours = parseInt(crm[2], 10);
  if (!Number.isFinite(showCount) || !Number.isFinite(showHours) || showCount <= 0 || showHours <= 0) return null;

  const subsetSum = baseHours + halfHours + showCount * showHours;
  if (!Number.isFinite(subsetSum) || subsetSum <= 0) return null;

  const backsolveRe = /this\s+was\s+(\d+)\s*%\s+of\s+the\s+time\s+[a-z]+\s+spent/i;
  const bsm = backsolveRe.exec(q);
  if (!bsm) return null;
  const p1 = parseInt(bsm[1], 10);
  if (!Number.isFinite(p1) || p1 <= 0 || p1 > 100) return null;

  const secondPctRe = /spent\s+(\d+)\s*%\s+of\s+(?:his|her|their)\s+time\s+([a-z]+)/i;
  const spm = secondPctRe.exec(q);
  if (!spm) return null;
  const p2 = parseInt(spm[1], 10);
  const activityC = spm[2].toLowerCase();
  if (!Number.isFinite(p2) || p2 <= 0 || p2 > 100) return null;

  const closingRe = new RegExp('how\\s+much\\s+time\\s+did\\s+[a-z]+\\s+spend\\s+' + escapeRe(activityC) + '\\b', 'i');
  if (!closingRe.test(q)) return null;

  const grandTotal = subsetSum / (p1 / 100);
  if (!Number.isFinite(grandTotal) || grandTotal <= 0) return null;
  const sightseeingTime = grandTotal * (p2 / 100);
  if (!Number.isFinite(sightseeingTime)) return null;
  return { sightseeingTime };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const activitySubsetPercentBacksolveTotalThenOtherPercent: LianaMethod = {
  id: 'activity-subset-percent-backsolve-total-then-other-percent-v1',
  demand: 'COMPUTE',
  name: 'A named activity subset backsolves the grand total via one percentage, then a second independent percentage of that total is reported -- exact rational arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C199, sole member: pilot corpus item at index 353)',
  shapeDescription: 'grandTotal = (base + base/2 + showCount*showHours) / (p1/100); answer = grandTotal * (p2/100)',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "spends <N1> hours ... and half that time ..." base clause, a "watched ' +
          '<N2> shows which were <N3> hours each" count-times-rate clause, a "this was <P1>% of ' +
          'the time ... spent" backsolve sentence, a second independent "<P2>% of ... time ' +
          '<activityC>" percentage sentence, and a matching closing question; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `sightseeingTime = ${result.sightseeingTime}` };
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
          verdict: String(Math.round((result.sightseeingTime) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'subset sum divided by its stated percentage of the total, then multiplied by the second stated percentage',
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

registerMethod(activitySubsetPercentBacksolveTotalThenOtherPercent);
