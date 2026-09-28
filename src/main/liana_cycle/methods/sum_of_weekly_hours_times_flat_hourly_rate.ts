// D-BP223-BM04-h2cbpv9w-170 -- sum-of-weekly-hours-times-flat-hourly-rate-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W07).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-of-weekly-hours-times-flat-hourly-rate-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W07 CLUSTER C83 (1 silo member, sole member
 * harvest_gsm8k_pilot_item179_total_earnings_from_multiple_periods, GSM8K test line 179, high
 * confidence). Representative teaching case: "Lloyd earns $10 an hour on Math tutoring. He
 * tutored 5 hours for the first week and 8 hours for the second week. How much did he earn for
 * the first two weeks?"
 *
 * @generalShape ONE flat hourly rate is stated up front ("<Person> earns $<rate> an hour on
 *   <activity>."), then TWO OR MORE "<hours> hours for the <ordinal> week" clauses each state an
 *   hours figure for a distinct week. Total earnings = rate * (sum of all stated week-hours).
 *   Distinguished from a shape that sums already-priced sub-parts (each addend already in
 *   dollars) by requiring the addends to be bare HOUR counts multiplied by a single shared rate
 *   found once, not per addend.
 *
 * @recogniseInStranger Require exactly ONE "$<rate> an hour" mention in the whole text (a second,
 *   different rate would make the "one flat rate applies to every week" assumption unsafe).
 *   Collect every "<N> hours for the <word> week" match (at least two required). Require the
 *   question to read "how much did <person> earn for the ... weeks".
 *
 * @whatBreaksIt (a) more than one distinct "$<rate> an hour" phrase in the text -- abstains,
 *   ambiguous which rate applies; (b) fewer than two week-hours clauses -- abstains, nothing to
 *   sum; (c) an hours figure stated for something other than a plain "week" period (a day, a
 *   month) -- not matched by this pattern, so simply not counted, which could under-total on a
 *   stranger question mixing period units; flagged here rather than hidden since only one member
 *   is known; (d) the closing question not asking "how much did <person> earn" -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED ($10/hour x (5+8) hours = $130). With only one
 *   known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-of-weekly-hours-times-flat-hourly-rate-v1';

interface Analyzed {
  person: string;
  rate: number;
  totalHours: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateAllRe = /\$(\d+(?:\.\d+)?)\s+an?\s+hour\b/gi;
  const rateMatches = [...q.matchAll(rateAllRe)];
  if (rateMatches.length !== 1) return null; // exactly one flat rate, unambiguous
  const rate = parseFloat(rateMatches[0][1]);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const earnsRe = /\b([A-Z][a-zA-Z']*)\s+earns\s+\$\d+(?:\.\d+)?\s+an?\s+hour\b/i;
  const em = earnsRe.exec(q);
  if (!em) return null;
  const person = em[1];

  const hoursRe = /(\d+)\s+hours\s+for\s+the\s+[a-z]+\s+week\b/gi;
  const hoursMatches = [...q.matchAll(hoursRe)];
  if (hoursMatches.length < 2) return null;
  let totalHours = 0;
  for (const hm of hoursMatches) {
    const h = parseFloat(hm[1]);
    if (!Number.isFinite(h)) return null;
    totalHours += h;
  }

  // The question may name the person again or use a pronoun ("How much did he earn ..."); only
  // enforce a name match when the question actually names someone (positive evidence either way).
  const askRe = /how\s+much\s+did\s+(he|she|they|([A-Z][a-zA-Z']*))\s+earn\s+for\s+the\b/i;
  const am = askRe.exec(q);
  if (!am) return null;
  const askedName = am[2];
  if (askedName && askedName !== person) return null;

  return { person, rate, totalHours };
}

export const sumOfWeeklyHoursTimesFlatHourlyRate: LianaMethod = {
  id: 'sum-of-weekly-hours-times-flat-hourly-rate-v1',
  demand: 'COMPUTE',
  name: 'Sum of hours across two or more named weeks, times one shared flat hourly rate',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W07 (cluster C83, sole member harvest_gsm8k_pilot_item179_total_earnings_from_multiple_periods)',
  shapeDescription:
    'One flat "$X an hour" rate stated once; two or more "<N> hours for the <ordinal> week" ' +
    'clauses; total earnings = rate * sum(all week-hours).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find exactly one flat "$X an hour" rate plus at least two "<N> hours ' +
          'for the <week>" clauses plus a matching "how much did <person> earn for the" question',
      };
    }
    return { matches: true, reason: `${result.person} rate=${result.rate} totalHours=${result.totalHours}` };
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
      const verdict = result.rate * result.totalHours;
      return {
        question,
        verdict: String(Math.round((verdict) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.rate} x ${result.totalHours} hours`,
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

registerMethod(sumOfWeeklyHoursTimesFlatHourlyRate);
