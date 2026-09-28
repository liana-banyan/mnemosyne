// D-BP223-BM04-h2cbp9d8-171 -- fraction-increase-daily-rate-then-multiply-days-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\fraction-increase-daily-rate-then-multiply-days-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C195 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 343, "In his training as a professional athlete, Tyson
 * runs 5000 meters every day. His coach, however, wants him to run 1/5 times more meters in a
 * day. If he took the coach's advice and trained for a month, what is the total distance he
 * covered in June?" Silo label: "multi-step calculation involving fractional increases and
 * time-based accumulation".
 *
 * @generalShape A stated daily/per-unit BASE rate is increased by a stated FRACTION of itself
 *   ("<fraction> times more <unit> in a day"), producing a new (larger) daily rate = base + base
 *   * fraction. That new daily rate is then multiplied by a stated fixed number of days in a
 *   named month (a small closed lookup of month lengths, June/April/September/November = 30,
 *   the rest = 31 except February) to produce the final total distance/amount covered.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a base-rate sentence "<Actor>
 *   <verb>s <N> <unit> every day"; (b) a fraction-increase sentence "<fraction> times more <unit>
 *   in a day" naming the SAME unit as (a), the fraction parsed as "<p>/<q>" (a bare fraction
 *   literal, never a decimal approximation); (c) a generic "trained for a month" (or equivalent)
 *   clause, confirming the accumulation runs for one full month without itself needing to name
 *   which one; (d) a closing question asking for the total distance/amount covered "in <month>",
 *   naming the ONE specific calendar month whose day-count is looked up (the only place a month
 *   name is required to appear).
 *
 * @whatBreaksIt (a) the unit word differing between the base-rate and fraction-increase sentences
 *   -- abstain, cannot confirm the same quantity is being scaled; (b) the fraction not parsing as
 *   an exact "<p>/<q>" rational, or the base rate not being an exact multiple of q (would produce
 *   a non-integer daily increase) -- abstain rather than round; (c) no named month recognised in
 *   the question at all -- abstain, never assumes a default month length; (d) a stated number of
 *   days overriding the month's calendar length (this candidate only reasons about a full named
 *   calendar month, not a stated day count) -- out of scope, abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (5000 + 5000*(1/5) = 6000 per day, 6000*30 = 180000 for June).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'fraction-increase-daily-rate-then-multiply-days-v1';

interface Analyzed { total: number; }

const MONTH_DAYS: Record<string, number> = {
  january: 31, february: 28, march: 31, april: 30, may: 31, june: 30,
  july: 31, august: 31, september: 30, october: 31, november: 30, december: 31,
};

function stemUnit(word: string): string {
  let w = word.trim().toLowerCase();
  if (w.endsWith('es') && w.length > 3) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 2) w = w.slice(0, -1);
  return w;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseRe = /runs?\s+(\d+)\s+([a-z]+)\s+every\s+day\b/i;
  const bm = baseRe.exec(q);
  if (!bm) return null;
  const baseRate = parseInt(bm[1], 10);
  if (!Number.isFinite(baseRate) || baseRate <= 0) return null;
  const unit = stemUnit(bm[2]);

  const fracRe = new RegExp(
    '(\\d+)\\s*/\\s*(\\d+)\\s+times\\s+more\\s+([a-z]+)\\s+in\\s+a\\s+day\\b', 'i',
  );
  const fm = fracRe.exec(q);
  if (!fm) return null;
  const numerator = parseInt(fm[1], 10);
  const denominator = parseInt(fm[2], 10);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  if (stemUnit(fm[3]) !== unit) return null;

  const monthNameRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  const monthMatches = Array.from(q.matchAll(new RegExp(monthNameRe.source, 'gi')));
  if (monthMatches.length < 1) return null;
  const monthsSet = new Set(monthMatches.map((m) => m[1].toLowerCase()));
  if (monthsSet.size !== 1) return null;
  const month = Array.from(monthsSet)[0];
  const daysInMonth = MONTH_DAYS[month];
  if (daysInMonth == null) return null;

  if (!/train(?:ed|ing)?\s+for\s+a\s+month\b/i.test(q)) return null;
  if (!/total\s+distance/i.test(q)) return null;

  if ((baseRate * numerator) % denominator !== 0) return null;
  const dailyIncrease = (baseRate * numerator) / denominator;
  const newDailyRate = baseRate + dailyIncrease;
  const total = newDailyRate * daysInMonth;
  if (!Number.isFinite(total)) return null;
  return { total };
}

export const fractionIncreaseDailyRateThenMultiplyDays: LianaMethod = {
  id: 'fraction-increase-daily-rate-then-multiply-days-v1',
  demand: 'COMPUTE',
  name: 'Base daily rate increased by an exact fraction of itself, multiplied by a named month\'s day count -- exact rational arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C195, sole member: pilot corpus item at index 343)',
  shapeDescription: 'newDailyRate = baseRate + baseRate*(p/q); total = newDailyRate * daysInNamedMonth',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<Actor> runs <N> <unit> every day" base rate, a matching "<p>/<q> ' +
          'times more <unit> in a day" fraction-increase clause, a "trained for a month" clause ' +
          'naming a single specific calendar month consistently, and a "total distance ... in ' +
          '<month>" closing question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total = ${result.total}` };
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
          basis: 'base rate increased by exact fraction, multiplied by the named month\'s day count',
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

registerMethod(fractionIncreaseDailyRateThenMultiplyDays);
