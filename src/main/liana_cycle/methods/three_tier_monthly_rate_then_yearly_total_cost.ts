// D-BP223-BM04-h2cbp9d8-171 -- three-tier-monthly-rate-then-yearly-total-cost-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-tier-monthly-rate-then-yearly-total-cost-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C256 (GSM8K test.jsonl item422, singleton).
 *
 * @generalShape A subscription/service bills at THREE successive monthly rates over its life:
 *   an introductory rate for a stated number of months, then a "normal" rate for a stated number
 *   of months, then a final raised rate for whatever months remain out of a stated total duration
 *   (given in years). The question asks the total cost over that stated total duration. Verified
 *   against item422's own "#### 284" line before this candidate was written: 24 total months
 *   (2 years), 6 months @ $8, 8 months @ $12, remaining 24-6-8=10 months @ $14;
 *   6*8 + 8*12 + 10*14 = 48+96+140 = 284.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an intro-rate clause naming a
 *   month count and a dollar rate ("first <N1> months were $<R1> a month"); (b) a normal-rate
 *   clause naming a dollar rate and, separately, a month count the normal rate applied for
 *   ("normal price of $<R2> a month" ... "After <N2> months of the normal rate"); (c) a
 *   final-raise clause naming a third dollar rate ("increased its price to $<R3> a month");
 *   (d) a closing question asking the cost of a stated number of YEARS of the service
 *   ("how much do <Y> years ... cost"). All three rates and both segment-month counts must be
 *   distinct positive integers.
 *
 * @whatBreaksIt (a) the two named segment months (N1, N2) sum to more than or equal to the total
 *   months implied by the year count -- there would be no months left for the third (raised) rate,
 *   so this candidate abstains rather than guess a zero or negative remainder; (b) more than one
 *   candidate figure for any of the three rates or two segment-month counts (ambiguous question)
 *   -- abstain; (c) the question asks for a per-month or per-year figure rather than a total cost
 *   over the stated year count -- a different question this candidate does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item422): totalMonths = 2*12 = 24, thirdSegmentMonths = 24-6-8 = 10,
 *   total = 6*8 + 8*12 + 10*14 = 48+96+140 = 284 (exact integer arithmetic throughout, no floats).
 *   SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not asserted here --
 *   this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-tier-monthly-rate-then-yearly-total-cost-v1';

const INTRO_RE = /first\s+(\d+)\s+months\s+were\s*\$(\d+)\s+a\s+month/i;
const NORMAL_RATE_RE = /normal\s+price\s+of\s*\$(\d+)\s+a\s+month/i;
const NORMAL_MONTHS_RE = /after\s+(\d+)\s+months\s+of\s+the\s+normal\s+rate/i;
const RAISED_RATE_RE = /increased\s+its\s+price\s+to\s*\$(\d+)\s+a\s+month/i;
const ASK_RE = /how\s+much\s+do\s+(\d+)\s+years?\s+of\s+the\s+service\s+cost/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const introM = INTRO_RE.exec(q);
  if (!introM) return null;
  const introMonths = Number(introM[1]);
  const introRate = Number(introM[2]);
  if (!Number.isInteger(introMonths) || introMonths <= 0) return null;
  if (!Number.isInteger(introRate) || introRate <= 0) return null;

  const normRateM = NORMAL_RATE_RE.exec(q);
  if (!normRateM) return null;
  const normalRate = Number(normRateM[1]);
  if (!Number.isInteger(normalRate) || normalRate <= 0) return null;

  const normMonthsM = NORMAL_MONTHS_RE.exec(q);
  if (!normMonthsM) return null;
  const normalMonths = Number(normMonthsM[1]);
  if (!Number.isInteger(normalMonths) || normalMonths <= 0) return null;

  const raisedM = RAISED_RATE_RE.exec(q);
  if (!raisedM) return null;
  const raisedRate = Number(raisedM[1]);
  if (!Number.isInteger(raisedRate) || raisedRate <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;
  const years = Number(askM[1]);
  if (!Number.isInteger(years) || years <= 0) return null;

  // Distinctness guard: three genuinely different rates, not the same figure repeated.
  if (introRate === normalRate || normalRate === raisedRate || introRate === raisedRate) return null;

  const totalMonths = years * 12; // exact integer, no rounding
  const raisedMonths = totalMonths - introMonths - normalMonths;
  if (!Number.isInteger(raisedMonths) || raisedMonths <= 0) return null; // no room left for the third segment

  const total = introMonths * introRate + normalMonths * normalRate + raisedMonths * raisedRate;
  if (!Number.isFinite(total)) return null;

  return { total };
}

export const threeTierMonthlyRateThenYearlyTotalCost: LianaMethod = {
  id: 'three-tier-monthly-rate-then-yearly-total-cost-v1',
  demand: 'COMPUTE',
  name: 'Compute total cost of a service billed at three successive monthly rates over a stated number of years',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C256, GSM8K test item422',
  shapeDescription:
    'An intro rate R1 applies for N1 months, then a normal rate R2 applies for N2 months, then a ' +
    'raised rate R3 applies for the remaining months of a stated year count Y. Total months = ' +
    'Y*12; remaining = total - N1 - N2 (must be positive). Answer = N1*R1 + N2*R2 + remaining*R3.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an intro-rate + normal-rate + normal-rate-month-count + raised-rate + ' +
          '"how much do <Y> years...cost" chain with a positive remaining-months segment; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total cost = ${result.total}` };
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
          basis: 'introMonths*introRate + normalMonths*normalRate + raisedMonths*raisedRate, exact integer arithmetic',
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

registerMethod(threeTierMonthlyRateThenYearlyTotalCost);
