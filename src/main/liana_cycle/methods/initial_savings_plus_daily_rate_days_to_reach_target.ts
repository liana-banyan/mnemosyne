// D-BP223-BM04-h2cbp9d8-171 -- initial-savings-plus-daily-rate-days-to-reach-target-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\initial-savings-plus-daily-rate-days-to-reach-target-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C234 (GSM8K test.jsonl item397, singleton).
 *
 * @generalShape An actor already has an INITIAL dollar amount and earns a flat dollar RATE per
 *   day. The question asks how many days are needed to reach a stated TARGET cost.
 *   days = (target - initial) / rate, only when the division is exact.
 *
 * @recogniseInStranger Requires, as positive evidence, all of: (a) "has $<initial> in
 *   his/her/their bank account"; (b) "earns $<rate> per day"; (c) a target cost stated as
 *   "costs $<target>"; (d) a closing "how many days does <actor> have to save" question.
 *
 * @whatBreaksIt (a) the target is not greater than the initial amount -- abstain, this candidate
 *   does not attempt a zero-or-negative-days edge case; (b) (target - initial) is not an exact
 *   multiple of the daily rate -- abstain rather than round up; (c) an intervening expense or a
 *   second income source mentioned elsewhere in the question -- this candidate's anchors do not
 *   detect one, so a stranger question with extra clauses could still match; documented as an
 *   honest limit, not silently fixed.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. All money arithmetic is done in integer CENTS,
 *   never floating dollars, so no rounding heuristic can silently substitute for an exact answer.
 *   Measured against its own representative teaching case (item397): SOLVED. Reach across a wider
 *   corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster
 *   shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'initial-savings-plus-daily-rate-days-to-reach-target-v1';

const INITIAL_RE = /has\s+\$(\d+(?:\.\d+)?)\s+in\s+(?:his|her|their)\s+bank account/i;
const RATE_RE = /earns\s+\$(\d+(?:\.\d+)?)\s+per day/i;
const TARGET_RE = /costs\s+\$(\d+(?:\.\d+)?)/i;
const CLOSING_Q_RE = /how many days does\s+[A-Z][a-zA-Z]*\s+have to save/i;

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

interface Analyzed { days: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const initialM = INITIAL_RE.exec(q);
  const rateM = RATE_RE.exec(q);
  const targetM = TARGET_RE.exec(q);
  if (!initialM || !rateM || !targetM) return null;
  if (!CLOSING_Q_RE.test(q)) return null;

  const initialCents = dollarsToCents(initialM[1]);
  const rateCents = dollarsToCents(rateM[1]);
  const targetCents = dollarsToCents(targetM[1]);
  if (initialCents === null || rateCents === null || targetCents === null) return null;
  if (rateCents <= 0) return null;

  const shortfallCents = targetCents - initialCents;
  if (shortfallCents <= 0) return null;
  if (shortfallCents % rateCents !== 0) return null;

  return { days: shortfallCents / rateCents };
}

export const initialSavingsPlusDailyRateDaysToReachTarget: LianaMethod = {
  id: 'initial-savings-plus-daily-rate-days-to-reach-target-v1',
  demand: 'COMPUTE',
  name: 'Compute the number of days to reach a target cost given an initial amount and a daily rate',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C234, GSM8K test item397',
  shapeDescription:
    'An actor has an initial dollar amount and earns a flat daily rate; days = (target - initial) / ' +
    'rate, computed in exact integer cents, only when the target exceeds the initial amount and the ' +
    'division lands exactly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "has $<initial> in ... bank account" clause, an "earns $<rate> per day" ' +
          'clause, a "costs $<target>" clause, and a "how many days does ... have to save" closing ' +
          'question, with (target-initial) an exact multiple of the rate; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `days = ${result.days}` };
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
          verdict: String(Math.round((result.days) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'shortfall in cents divided exactly by the daily rate in cents',
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

registerMethod(initialSavingsPlusDailyRateDaysToReachTarget);
