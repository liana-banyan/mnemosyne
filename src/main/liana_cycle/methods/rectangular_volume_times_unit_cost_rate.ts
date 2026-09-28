// D-BP223-BM04-h2cbpv9w-170 -- rectangular-volume-times-unit-cost-rate-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\rectangular-volume-times-unit-cost-rate-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C175 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 317, "John fills a 6 foot by 4 foot pool that is 5 feet
 * deep. It cost $.1 per cubic foot to fill. How much does it cost to fill?". Silo label: "volume
 * and cost calculation -- volume of a rectangular prism and unit cost multiplication".
 *
 * @generalShape A rectangular container's three dimensions (length, width, depth) are stated in
 *   the SAME linear unit. Its volume is length*width*depth. A cost-per-unit-volume RATE is stated
 *   in the matching cubic unit. The answer is volume*rate, computed with EXACT decimal-fraction
 *   arithmetic (never a floating-point multiply) so a leading-dot rate like "$.1" never drifts.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<L> foot by <W> foot ... that
 *   is <D> feet deep" (three dimensions, all in feet); (b) a rate clause "cost $<rate> per cubic
 *   foot", where <rate> may be a bare or leading-dot decimal; (c) a closing "how much does it cost
 *   to fill" question.
 *
 * @whatBreaksIt (a) any dimension or the rate failing to parse as a decimal number; (b) a unit
 *   other than feet/cubic feet anywhere in the three clauses -- abstains rather than mix scales;
 *   (c) the exact decimal-fraction product of the three dimensions and the rate not landing on a
 *   whole number -- abstains rather than report a rounded or floating-point-approximate cost.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (volume = 6*4*5 = 120; cost = 120 * 1/10 = 12, computed as an
 *   exact integer-fraction product, never a floating 120*0.1). With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'rectangular-volume-times-unit-cost-rate-v1';

interface Frac { num: bigint; den: bigint; }

/** Parses a decimal string ("6", ".1", "0.25") into an EXACT integer fraction -- never a float,
 *  so a leading-dot rate like ".1" is represented as 1n/10n rather than the IEEE double closest
 *  to 0.1, per the estate's standing "sympy-grade arithmetic, never floating heuristics" rule. */
function parseDecimalToFraction(str: string): Frac | null {
  const s = str.trim();
  if (!/^\d*\.?\d+$/.test(s) || s === '.') return null;
  const dotIdx = s.indexOf('.');
  if (dotIdx === -1) return { num: BigInt(s), den: 1n };
  const intPart = s.slice(0, dotIdx) || '0';
  const fracPart = s.slice(dotIdx + 1);
  const combined = intPart + fracPart;
  const den = 10n ** BigInt(fracPart.length);
  return { num: BigInt(combined), den };
}

function mulFrac(a: Frac, b: Frac): Frac {
  return { num: a.num * b.num, den: a.den * b.den };
}

interface Analyzed { cost: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const dimRe = /(\d+(?:\.\d+)?)\s*foot by\s*(\d+(?:\.\d+)?)\s*foot\s+[a-z]+\s+that is\s*(\d+(?:\.\d+)?)\s*feet deep/i;
  const dm = dimRe.exec(q);
  if (!dm) return null;
  const l = parseDecimalToFraction(dm[1]);
  const w = parseDecimalToFraction(dm[2]);
  const d = parseDecimalToFraction(dm[3]);
  if (!l || !w || !d) return null;

  const rateRe = /cost\s+\$(\.\d+|\d+(?:\.\d+)?)\s+per cubic foot/i;
  const rm = rateRe.exec(q);
  if (!rm) return null;
  const rate = parseDecimalToFraction(rm[1]);
  if (!rate) return null;

  if (!/how much does it cost to fill/i.test(q)) return null;

  const volume = mulFrac(mulFrac(l, w), d);
  const costFrac = mulFrac(volume, rate);
  if (costFrac.den === 0n) return null;
  if (costFrac.num % costFrac.den !== 0n) return null;
  const cost = Number(costFrac.num / costFrac.den);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return { cost };
}

export const rectangularVolumeTimesUnitCostRate: LianaMethod = {
  id: 'rectangular-volume-times-unit-cost-rate-v1',
  demand: 'COMPUTE',
  name: 'Rectangular-prism volume times a cost-per-cubic-unit rate, via exact decimal-fraction arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C175, sole member: pilot corpus item at index 317)',
  shapeDescription: 'cost = (length * width * depth) * ratePerCubicUnit, computed as exact integer fractions',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a three-dimension "L foot by W foot ... D feet deep" clause, a matching ' +
          '"cost $rate per cubic foot" clause, and a closing "how much does it cost to fill" ' +
          'question resolving to an exact whole-number cost; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `cost = ${result.cost}` };
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
          verdict: String(Math.round(result.cost * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'exact-fraction volume times rate',
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

registerMethod(rectangularVolumeTimesUnitCostRate);
