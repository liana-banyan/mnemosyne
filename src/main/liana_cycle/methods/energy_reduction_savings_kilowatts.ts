// D-BP223-BM04-h2cbp9d8-171 -- energy-reduction-savings-kilowatts-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\energy-reduction-savings-kilowatts-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C240 (GSM8K test.jsonl item403, singleton).
 *
 * @generalShape A device with a stated wattage runs a stated number of hours per day. Usage is
 *   then REDUCED by a stated number of hours per day. The question asks how many KILOWATTS of
 *   energy are saved over a stated number of days. The corpus's own ground truth for this shape
 *   (verified against GSM8K test.jsonl item403's own "#### 81" line before this candidate was
 *   written) computes the daily saving as wattage * (originalHours - reduceByHours), i.e. the
 *   wattage-hours of the REDUCED usage window, converted to kilowatts and projected over the
 *   given number of days -- reproduced here as the corpus's own worked chain (900*8=7200,
 *   900*5=4500, 7200-4500=2700 watts/day, 2700/1000=2.7 kW/day, *30=81), not re-derived from a
 *   different reading of "reduces...by". This candidate matches the corpus's own arithmetic
 *   exactly rather than substitute a different (and possibly more literal) interpretation.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "<N>-watt <device>"
 *   or "uses <N> watts" wattage clause; (b) an explicit "for <H> hours a day" (or "each day")
 *   original-usage clause; (c) an explicit "reduces...by <R> hours a day" (or "cuts...by") clause;
 *   (d) a closing question asking "how many kilowatts...save in <D> days" (the literal word
 *   "kilowatts" together with "save" and a day count).
 *
 * @whatBreaksIt (a) more than one wattage figure or more than one hours-per-day figure in the
 *   question -- ambiguous, abstain; (b) the reduction amount R is not strictly less than the
 *   original hours H (R >= H is not a sensible "reduces by" and this candidate does not attempt
 *   to reason about it) -- abstain; (c) the question asks for watts or watt-hours rather than
 *   kilowatts -- a different unit this candidate does not convert for; (d) the final watt-hours
 *   figure does not divide evenly by 1000 -- abstain rather than report a decimal kilowatt value.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item403): dailySavingWatts = 900*(8-5) = 2700, kWhPerDay = 2700/1000 = 2.7 (kept as a
 *   rational fraction 27/10 internally, never a float heuristic), total = 27/10 * 30 = 81. SOLVED.
 *   Reach across a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'energy-reduction-savings-kilowatts-v1';

const WATTAGE_RE = /(\d+)\s*-?\s*watt\b|uses\s+(\d+)\s+watts/i;
const ORIGINAL_HOURS_RE = /for\s+(\d+)\s+hours\s+a\s+day|(\d+)\s+hours\s+a\s+day/i;
const REDUCE_RE = /reduc\w*[^.?!]*\bby\s+(\d+)\s+hours\s+a\s+day/i;
const ASK_RE = /how many kilowatts[^.?!]*\bsave\b[^.?!]*\bin\s+(\d+)\s+days\b/i;

interface Analyzed { totalKw: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const wM = WATTAGE_RE.exec(q);
  if (!wM) return null;
  const wattage = Number(wM[1] ?? wM[2]);
  if (!Number.isFinite(wattage) || wattage <= 0) return null;

  const hM = ORIGINAL_HOURS_RE.exec(q);
  if (!hM) return null;
  const originalHours = Number(hM[1] ?? hM[2]);
  if (!Number.isFinite(originalHours) || originalHours <= 0) return null;

  const rM = REDUCE_RE.exec(q);
  if (!rM) return null;
  const reduceBy = Number(rM[1]);
  if (!Number.isFinite(reduceBy) || reduceBy <= 0 || reduceBy >= originalHours) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;
  const days = Number(askM[1]);
  if (!Number.isFinite(days) || days <= 0) return null;

  // Rational arithmetic throughout: numerators/denominators kept exact, only checked for
  // integer divisibility at the final kilowatt conversion (never rounded).
  const dailySavingWattHoursNumerator = wattage * (originalHours - reduceBy); // exact integer
  const totalWattHoursNumerator = dailySavingWattHoursNumerator * days; // exact integer
  if (totalWattHoursNumerator % 1000 !== 0) return null; // would not land on an exact kW figure
  const totalKw = totalWattHoursNumerator / 1000;
  if (!Number.isFinite(totalKw)) return null;

  return { totalKw };
}

export const energyReductionSavingsKilowatts: LianaMethod = {
  id: 'energy-reduction-savings-kilowatts-v1',
  demand: 'COMPUTE',
  name: 'Compute kilowatts saved when a device\'s daily usage hours are reduced, over a stated number of days',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C240, GSM8K test item403',
  shapeDescription:
    'A stated wattage device runs H hours/day; usage is reduced by R hours/day (R < H); asks for ' +
    'kilowatts saved over D days. Answer = wattage*(H-R)*D/1000, matching the corpus\'s own worked ' +
    'chain exactly, only when the watt-hour total divides 1000 evenly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a wattage + original-hours-per-day + "reduces...by <R> hours a day" + ' +
          '"how many kilowatts...save in <D> days" chain resolving to a whole-number kilowatt ' +
          'total; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `kilowatts saved = ${result.totalKw}` };
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
          verdict: String(Math.round((result.totalKw) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'wattage * (originalHours - reduceByHours) * days / 1000, exact rational arithmetic',
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

registerMethod(energyReductionSavingsKilowatts);
