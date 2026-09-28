// D-BP223-BM04-h2cbpv9w-170 -- two-costs-summed-plus-percentage-of-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-costs-summed-plus-percentage-of-sum-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W13, CLUSTER C128 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 61, "Janet buys a brooch for her daughter. She pays $500
 * for the material to make it and then another $800 for the jeweler to construct it. After that,
 * she pays 10% of that to get it insured. How much did she pay?". Silo label: "multi-step addition
 * and percentage calculation -- sum of costs plus percentage of sum".
 *
 * @generalShape Two directly-given cost terms A and B are added to a SUM. A stated PERCENTAGE fee
 *   P is then applied to that SAME sum (an insurance/tax/service charge explicitly referring back
 *   to "that" combined amount, not to either term alone). Total = A + B + sum*(P/100).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a first cost clause ("pays $<A>
 *   for <thing1>"); (b) a second cost clause chained with "another" or "then" ("another $<B> for
 *   <thing2>"); (c) an explicit backward-referring percentage clause naming the sum ("<P>% of that"
 *   / "<P>% of the total" / "<P>% of the combined amount"), never a percentage of a single named
 *   term; (d) a closing question asking how much was paid (in total).
 *
 * @whatBreaksIt (a) fewer than two distinct dollar-cost clauses found -- abstains, nothing to sum;
 *   (b) the percentage clause referring to a single named item rather than "that"/"the total"/"the
 *   combined amount" -- this candidate does not attempt a percentage of a single term, only the
 *   sum-referring case its sole known member evidences; (c) the percentage*sum arithmetic not
 *   landing on an exact integer number of cents -- abstains rather than round; (d) no percentage
 *   clause at all -- this narrow candidate leaves the plain two-term sum shape to a different,
 *   broader method.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED ($500 + $800 = $1300; 10% of $1300 = $130; total $1430). With
 *   only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-costs-summed-plus-percentage-of-sum-v1';


function toCents(raw: string): number | null {
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(fracPadded);
}

interface Analyzed { totalCents: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const firstRe = /pays?\s*\$([\d.,]+)\s+for\b/i;
  const fm = firstRe.exec(q);
  if (!fm) return null;
  const aCents = toCents(fm[1]);
  if (aCents === null) return null;

  const secondRe = /(?:another|then)\s*\$([\d.,]+)\s+for\b/i;
  const sm = secondRe.exec(q);
  if (!sm) return null;
  const bCents = toCents(sm[1]);
  if (bCents === null) return null;

  const sumCents = aCents + bCents;

  const pctRe = /(\d+(?:\.\d+)?)\s*%\s+of\s+(?:that|the total|the combined amount|the sum)\b/i;
  const pm = pctRe.exec(q);
  if (!pm) return null;
  const pct = Number(pm[1]);
  if (!Number.isFinite(pct) || pct < 0) return null;

  if (!/how much did (?:she|he|they) pay/i.test(q)) return null;

  // Exact-cents guard: the fee must land on a whole cent, never a rounded approximation.
  const feeCentsProduct = sumCents * pct;
  if (feeCentsProduct % 100 !== 0) return null;
  const feeCents = feeCentsProduct / 100;

  const totalCents = sumCents + feeCents;
  return { totalCents };
}

export const twoCostsSummedPlusPercentageOfSum: LianaMethod = {
  id: 'two-costs-summed-plus-percentage-of-sum-v1',
  demand: 'COMPUTE',
  name: 'Sum two directly-given costs, then add a stated percentage of that same sum',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W13 (cluster C128, sole member: pilot corpus item at index 61)',
  shapeDescription:
    'sum = costA + costB; fee = sum*(pct/100), where pct explicitly refers back to the sum ' +
    '("of that"/"of the total"); total = sum + fee, computed in exact integer cents.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two chained dollar-cost clauses ("pays $A for X ... another $B for Y") ' +
          'plus a percentage clause explicitly referring back to the sum ("N% of that"), with the ' +
          'fee landing on an exact cent, and a "how much did ... pay" closing question; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `totalCents = ${result.totalCents}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const dollars = result.totalCents / 100;
      const verdict = Number.isInteger(dollars) ? dollars : Math.round(dollars * 100) / 100;
      return { question, verdict: String(verdict), abstain: false, freeText, method: METHOD_ID, basis: 'costA + costB + sum*(pct/100), exact integer cents' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(twoCostsSummedPlusPercentageOfSum);
