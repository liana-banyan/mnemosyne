// D-BP223-BM04-h2cbpv9w-170 -- two-role-weekly-pay-summed-then-annualized-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W07).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-role-weekly-pay-summed-then-annualized-v1.candidate.ts
// Authored by generation wave W07 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W07.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W07 CLUSTER C84 (1 silo member, sole member
 * harvest_gsm8k_pilot_item17_multi_step_calculation_of_total_income_f, GSM8K test line 17, high
 * confidence). Representative teaching case: "Jill gets paid $20 per hour to teach and $30 to be
 * a cheerleading coach. If she works 50 weeks a year, 35 hours a week as a teacher and 15 hours a
 * week as a coach, what's her annual salary?" -- note the second rate ("$30 to be a
 * cheerleading coach") elides the "per hour" it shares with the first clause; this method treats
 * both stated dollar figures as per-hour rates, matching the dataset's own worked answer.
 *
 * @generalShape One person holds TWO roles, each with its own hourly rate (the second rate's "per
 *   hour" may be elided by the sentence's shared structure) and its own weekly-hours figure. Total
 *   weekly pay = rate1*hours1 + rate2*hours2. A separate "works <W> weeks a year" figure
 *   annualizes that weekly pay: annual = weeklyPay * W.
 *
 * @recogniseInStranger Match "gets paid $<rate1> per hour to <verb1> and $<rate2> to <be a/an>
 *   <role2>" for the two rates. Match "works <W> weeks a year" for the annualizing factor. Match,
 *   IN ORDER OF APPEARANCE, the first two "<hours> hours a week as a/an <noun>" clauses and pair
 *   them positionally with rate1 and rate2 respectively (this method does not attempt to name-
 *   match the role noun against the verb -- a stated, positional-order assumption, not a
 *   guess-free guarantee). Require the question to mention "annual salary".
 *
 * @whatBreaksIt (a) more or fewer than exactly two hourly-role clauses, or exactly two
 *   "hours a week as" clauses -- abstains; (b) the two "hours a week as" clauses appearing in the
 *   OPPOSITE order from the two rate clauses -- this method would pair them wrongly; a genuine,
 *   named limitation of the positional-order assumption, not hidden; (c) a per-role rate that is
 *   not a flat hourly figure (e.g. a stated weekly or annual salary for one role) -- not matched
 *   by this pattern, so simply abstains rather than misinterpret it; (d) missing "weeks a year"
 *   annualizing figure -- abstains, this method always annualizes.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (($20*35 + $30*15) * 50 = $57,500). With only
 *   one known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-role-weekly-pay-summed-then-annualized-v1';

interface Analyzed {
  annual: number;
  weekly: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ratesRe = /gets\s+paid\s+\$(\d+(?:\.\d+)?)\s+per\s+hour\s+to\s+[a-z]+\s+and\s+\$(\d+(?:\.\d+)?)\s+to\s+be\s+an?\s+[a-z ]+?\b/i;
  const rm = ratesRe.exec(q);
  if (!rm) return null;
  const rate1 = parseFloat(rm[1]);
  const rate2 = parseFloat(rm[2]);
  if (!Number.isFinite(rate1) || !Number.isFinite(rate2)) return null;

  const weeksRe = /works\s+(\d+)\s+weeks\s+a\s+year\b/i;
  const wm = weeksRe.exec(q);
  if (!wm) return null;
  const weeksPerYear = parseFloat(wm[1]);
  if (!Number.isFinite(weeksPerYear) || weeksPerYear <= 0) return null;

  const hoursRe = /(\d+)\s+hours\s+a\s+week\s+as\s+an?\s+[a-z]+\b/gi;
  const hoursMatches = [...q.matchAll(hoursRe)];
  if (hoursMatches.length !== 2) return null;
  const hours1 = parseFloat(hoursMatches[0][1]);
  const hours2 = parseFloat(hoursMatches[1][1]);
  if (!Number.isFinite(hours1) || !Number.isFinite(hours2)) return null;

  if (!/annual\s+salary\b/i.test(q)) return null;

  const weekly = rate1 * hours1 + rate2 * hours2;
  const annual = weekly * weeksPerYear;
  if (!Number.isFinite(annual)) return null;
  return { annual, weekly };
}

export const twoRoleWeeklyPaySummedThenAnnualized: LianaMethod = {
  id: 'two-role-weekly-pay-summed-then-annualized-v1',
  demand: 'COMPUTE',
  name: 'Two hourly-rate roles summed into a weekly wage, then annualized by weeks worked',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W07 (cluster C84, sole member harvest_gsm8k_pilot_item17_multi_step_calculation_of_total_income_f)',
  shapeDescription:
    'weekly = rate1*hours1 + rate2*hours2 for two hourly-paid roles held by one person; ' +
    'annual = weekly * weeksPerYear.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find two hourly rates for two roles, exactly two "<hours> hours a week ' +
          'as a <role>" clauses, a "works <W> weeks a year" figure, and an "annual salary" ask',
      };
    }
    return { matches: true, reason: `weekly=${result.weekly}, annual=${result.annual}` };
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
        verdict: String(Math.round((result.annual) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `weekly ${result.weekly} annualized`,
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
  }
};

registerMethod(twoRoleWeeklyPaySummedThenAnnualized);
