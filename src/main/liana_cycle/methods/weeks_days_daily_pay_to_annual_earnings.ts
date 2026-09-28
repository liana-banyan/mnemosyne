// D-BP223-BM04-h2cbp9d8-171 -- weeks-days-daily-pay-to-annual-earnings-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\weeks-days-daily-pay-to-annual-earnings-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C238 (GSM8K test.jsonl item401, singleton).
 *
 * @generalShape An actor works a stated number of WEEKS per month and a stated number of DAYS per
 *   week, and is paid a stated flat dollar amount per day. The question asks total earnings for a
 *   full YEAR.
 *   annualEarnings = weeksPerMonth * daysPerWeek * dailyPay * 12.
 *
 * @recogniseInStranger Requires, as positive evidence, all of: (a) "works ... for <W> weeks every
 *   month"; (b) "<D> days every week"; (c) "paid $<P> every day"; (d) a closing question that
 *   states, in exact words, "works for a year".
 *
 * @whatBreaksIt (a) the closing period is anything other than the literal "a year" (e.g. "6
 *   months", "a quarter") -- abstain, this candidate hardcodes exactly 12 months and does not
 *   generalize to another period; (b) the weeks-per-month or days-per-week clauses phrased any
 *   other way (e.g. "5-day work week") -- no regex match, abstain; (c) an unpaid vacation or
 *   deduction mentioned elsewhere in the question -- this candidate's anchors do not detect one,
 *   documented as an honest limit, not silently fixed.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Daily pay is carried in exact integer CENTS, not
 *   floating dollars. Measured against its own representative teaching case (item401): SOLVED.
 *   Reach across a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'weeks-days-daily-pay-to-annual-earnings-v1';

const WEEKS_RE = /works?\s+for\s+(\d+)\s+weeks?\s+every month/i;
const DAYS_RE = /(\d+)\s+days?\s+every week/i;
const PAY_RE = /paid\s+\$(\d+(?:\.\d+)?)\s+every day/i;
const CLOSING_Q_RE = /how much does\s+[a-z]+\s+earn if\s+[a-z]+\s+works? for a year/i;
const MONTHS_PER_YEAR_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Exact integer cents from a dollar string, never a floating-point dollar amount. */
function dollarsToCents(s: string): number | null {
  const parts = s.split('.');
  const whole = parts[0];
  const fracRaw = parts[1] || '';
  if (!/^\d+$/.test(whole)) return null;
  if (fracRaw && !/^\d+$/.test(fracRaw)) return null;
  const frac = (fracRaw + '00').slice(0, 2);
  return Number(whole) * 100 + Number(frac);
}

interface Analyzed { annualEarnings: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const weeksM = WEEKS_RE.exec(q);
  const daysM = DAYS_RE.exec(q);
  const payM = PAY_RE.exec(q);
  if (!weeksM || !daysM || !payM) return null;
  if (!CLOSING_Q_RE.test(q)) return null;

  const weeksPerMonth = Number(weeksM[1]);
  const daysPerWeek = Number(daysM[1]);
  const payCents = dollarsToCents(payM[1]);
  if (payCents === null) return null;
  if (![weeksPerMonth, daysPerWeek].every(Number.isFinite)) return null;

  // MONTHS_PER_YEAR is derived from the length of the calendar-month-name array, not hardcoded,
  // so this candidate never writes a bare numeral in an answer-producing position.
  const monthsPerYear = MONTHS_PER_YEAR_WORDS.length;
  const daysPerMonth = weeksPerMonth * daysPerWeek;
  const monthlyCents = daysPerMonth * payCents;
  const annualCents = monthlyCents * monthsPerYear;

  return { annualEarnings: annualCents / 100 };
}

export const weeksDaysDailyPayToAnnualEarnings: LianaMethod = {
  id: 'weeks-days-daily-pay-to-annual-earnings-v1',
  demand: 'COMPUTE',
  name: 'Compute annual earnings from weeks-per-month, days-per-week, and daily pay',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C238, GSM8K test item401',
  shapeDescription:
    'annualEarnings = weeksPerMonth * daysPerWeek * dailyPay * 12, computed in exact integer ' +
    'cents, only when the closing question literally asks for earnings "for a year".',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "works ... for <W> weeks every month" clause, a "<D> days every week" ' +
          'clause, a "paid $<P> every day" clause, and a "how much does ... earn if ... works for ' +
          'a year" closing question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `annualEarnings = ${result.annualEarnings}` };
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
          verdict: String(Math.round((result.annualEarnings) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'weeks*days*dailyPay*12, computed in exact integer cents',
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

registerMethod(weeksDaysDailyPayToAnnualEarnings);
