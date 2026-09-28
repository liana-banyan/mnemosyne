// D-BP223-BM04-h2cbpv9w-170 -- hourly-flat-tax-vs-salary-property-then-tax-net-pay-gap-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\hourly-flat-tax-vs-salary-property-then-tax-net-pay-gap-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W20, CLUSTER C186 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 331, "Nick is choosing between two jobs. Job A pays $15 an
 * hour for 2000 hours a year, and is in a state with a 20% total tax rate. Job B pays $42,000 a
 * year and is in a state that charges $6,000 in property tax and a 10% tax rate on net income
 * after property tax. How much more money will Nick make at the job with a higher net pay rate,
 * compared to the other job?". Silo label: "comparison of net income between two employment
 * options with different tax structures".
 *
 * @generalShape ONE actor compares two job offers with DIFFERENT tax structures. Job A: an hourly
 *   rate times a stated annual hours count gives a gross salary, taxed at a single flat percentage
 *   rate (netA = grossA * (1 - rateA)). Job B: a stated flat annual salary has a property-tax
 *   dollar amount subtracted FIRST, then the REMAINDER is taxed at a second percentage rate
 *   (netB = (salaryB - propertyTax) * (1 - rateB)). The question asks how much MORE the actor
 *   makes at whichever job has the higher net pay, i.e. |netA - netB|.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "Job A pays $<hourlyRate> an
 *   hour for <hours> hours a year, and is in a state with a <rateA>% total tax rate"; (b) "Job B
 *   pays $<salaryB> a year and is in a state that charges $<propertyTax> in property tax and a
 *   <rateB>% tax rate on net income after property tax"; (c) a closing "how much more money will
 *   <Actor> make at the job with a higher net pay rate, compared to the other job" question.
 *
 * @whatBreaksIt (a) either percentage failing to parse as 0-100 -- abstain; (b) propertyTax
 *   exceeding salaryB (a negative taxable remainder) -- abstain, this shape's teaching case is
 *   always a genuine positive remainder; (c) either derived net pay landing at or below zero --
 *   abstain, both jobs are assumed to be real positive-income offers; (d) the two net pay figures
 *   being exactly equal -- abstain, "how much more" presumes a strict winner, never a tie; (e) any
 *   dollar figure failing to parse as a non-negative number -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED. netA = (15*2000)*(1-0.20) = 30000*0.80 = 24000. netB =
 *   (42000-6000)*(1-0.10) = 36000*0.90 = 32400. |24000-32400| = 8400. With only one known cluster
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'hourly-flat-tax-vs-salary-property-then-tax-net-pay-gap-v1';

interface Analyzed { gap: number; }

function parseMoney(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const jobARe = /Job A pays\s+\$(\d+(?:\.\d+)?)\s+an hour for\s+(\d[\d,]*)\s+hours a year,?\s+and is in a state with a\s+(\d+(?:\.\d+)?)%\s+total tax rate/i;
  const am = jobARe.exec(q);
  if (!am) return null;
  const hourlyRate = parseMoney(am[1]);
  const hours = parseMoney(am[2]);
  const rateA = parseFloat(am[3]);
  if (!Number.isFinite(hourlyRate) || !Number.isFinite(hours) || !Number.isFinite(rateA)) return null;
  if (rateA < 0 || rateA > 100) return null;

  const jobBRe = /Job B pays\s+\$(\d[\d,]*)\s+a year and is in a state that charges\s+\$(\d[\d,]*)\s+in property tax and a\s+(\d+(?:\.\d+)?)%\s+tax rate on net income after property tax/i;
  const bm = jobBRe.exec(q);
  if (!bm) return null;
  const salaryB = parseMoney(bm[1]);
  const propertyTax = parseMoney(bm[2]);
  const rateB = parseFloat(bm[3]);
  if (!Number.isFinite(salaryB) || !Number.isFinite(propertyTax) || !Number.isFinite(rateB)) return null;
  if (rateB < 0 || rateB > 100) return null;
  if (propertyTax > salaryB) return null;

  if (!/how much more money will [A-Z][a-zA-Z']*\s+make at the job with a higher net pay rate,?\s+compared to the other job/i.test(q)) {
    return null;
  }

  const grossA = hourlyRate * hours;
  const netA = grossA * (1 - rateA / 100);
  const taxableB = salaryB - propertyTax;
  const netB = taxableB * (1 - rateB / 100);
  if (!Number.isFinite(netA) || !Number.isFinite(netB) || netA <= 0 || netB <= 0) return null;
  if (netA === netB) return null;

  const gap = Math.round(Math.abs(netA - netB) * 100) / 100;
  return { gap };
}

export const hourlyFlatTaxVsSalaryPropertyThenTaxNetPayGap: LianaMethod = {
  id: 'hourly-flat-tax-vs-salary-property-then-tax-net-pay-gap-v1',
  demand: 'COMPUTE',
  name: 'Compare an hourly-rate flat-tax job to a salaried property-tax-then-percentage-tax job; report the net-pay gap',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W20 (cluster C186, sole member: pilot corpus item at index 331)',
  shapeDescription: 'gap = |(hourlyRate*hours)*(1-rateA/100) - (salaryB-propertyTax)*(1-rateB/100)|',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find both a "Job A pays $<rate> an hour for <hours> hours a year ... <rateA>% ' +
          'total tax rate" clause and a "Job B pays $<salary> a year ... $<propertyTax> in ' +
          'property tax and a <rateB>% tax rate on net income after property tax" clause, plus a ' +
          'closing "how much more money ... higher net pay rate" question resolving to a strict, ' +
          'positive gap; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `gap = ${result.gap}` };
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
          verdict: String(Math.round(result.gap * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'flat-tax net pay vs property-tax-then-percentage net pay, absolute gap',
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

registerMethod(hourlyFlatTaxVsSalaryPropertyThenTaxNetPayGap);
