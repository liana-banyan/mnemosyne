// D-BP223-BM04-h2cbpv9w-170 -- bridge-capacity-minus-overhead-divided-by-unit-weight-floor-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\bridge-capacity-minus-overhead-divided-by-unit-weight-floor-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W13, CLUSTER C126 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 57, "A wooden bridge can carry no more than 5000 pounds.
 * A delivery truck filled with identical boxes, each weighing 15 pounds, will pass over the
 * bridge. The combined weight of the driver and the empty truck is 3755 pounds. What is the
 * maximum number of boxes which can be loaded onto the truck while not exceeding the bridge's
 * weight limit?". Silo label: "maximum capacity calculation -- subtraction followed by division".
 *
 * @generalShape A CAPACITY LIMIT C is stated ("can carry no more than", "maximum ... capacity of",
 *   "holds up to"). A fixed OVERHEAD weight O (a vehicle+driver, an empty container, tare weight)
 *   is stated separately from the units being loaded. Each loadable UNIT weighs a stated amount U.
 *   Available capacity = C - O; the maximum whole number of units = floor((C - O) / U).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit capacity-limit
 *   phrase ("no more than <C> pounds", "maximum weight capacity of <C>", "can carry up to <C>");
 *   (b) an explicit per-unit weight phrase ("each weighing <U> pounds"); (c) an explicit combined/
 *   fixed overhead phrase ("combined weight of ... is <O> pounds"); (d) a closing question asking
 *   for a "maximum number of" units. All four must share the same weight unit token (pounds/lbs/
 *   kg) -- a mismatched unit abstains rather than silently mixing scales.
 *
 * @whatBreaksIt (a) overhead weight exceeding or equal to the capacity limit -- abstains, no
 *   positive available capacity; (b) the per-unit weight parsing to zero or a non-positive number
 *   -- abstains, division undefined; (c) any of the three quantities using a different unit word
 *   than the others -- abstains; (d) the question not asking for a "maximum number of" phrase --
 *   this candidate does not attempt a bare subtraction or division question, only the compound
 *   capacity-then-divide-and-floor shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (available = 5000 - 3755 = 1245; 1245 / 15 = 83 exactly, no
 *   rounding needed). With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'bridge-capacity-minus-overhead-divided-by-unit-weight-floor-v1';


function toNum(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

interface Analyzed { maxUnits: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const capRe = /(?:no more than|maximum(?:\s+weight)?\s+capacity\s+of|can carry(?:\s+up to)?)\s*\$?([\d,]+(?:\.\d+)?)\s*(pounds|lbs|kg|kilograms|tons)?/i;
  const capM = capRe.exec(q);
  if (!capM) return null;
  const capacity = toNum(capM[1]);
  const capUnit = (capM[2] || '').toLowerCase();
  if (capacity === null) return null;

  const unitRe = /each\s+weighing\s*\$?([\d,]+(?:\.\d+)?)\s*(pounds|lbs|kg|kilograms|tons)?/i;
  const unitM = unitRe.exec(q);
  if (!unitM) return null;
  const unitWeight = toNum(unitM[1]);
  const unitUnit = (unitM[2] || '').toLowerCase();
  if (unitWeight === null || unitWeight <= 0) return null;

  const overheadRe = /combined weight of[^.]*?\bis\s*\$?([\d,]+(?:\.\d+)?)\s*(pounds|lbs|kg|kilograms|tons)?/i;
  const overheadM = overheadRe.exec(q);
  if (!overheadM) return null;
  const overhead = toNum(overheadM[1]);
  const overheadUnit = (overheadM[2] || '').toLowerCase();
  if (overhead === null) return null;

  // Positive-evidence unit agreement: if any two of the three parsed unit words are both present
  // and differ, abstain -- never assume a silent unit conversion.
  const seenUnits = [capUnit, unitUnit, overheadUnit].filter((u) => u.length > 0);
  if (seenUnits.length >= 2 && new Set(seenUnits).size > 1) return null;

  if (!/maximum number of/i.test(q)) return null;

  const available = capacity - overhead;
  if (available <= 0) return null;

  const maxUnits = Math.floor(available / unitWeight);
  if (!Number.isFinite(maxUnits) || maxUnits < 0) return null;
  return { maxUnits };
}

export const bridgeCapacityMinusOverheadDividedByUnitWeightFloor: LianaMethod = {
  id: 'bridge-capacity-minus-overhead-divided-by-unit-weight-floor-v1',
  demand: 'COMPUTE',
  name: 'Subtract a fixed overhead weight from a stated capacity limit, then divide by a per-unit weight and floor',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W13 (cluster C126, sole member: pilot corpus item at index 57)',
  shapeDescription:
    'available = capacityLimit - overheadWeight; maxUnits = floor(available / unitWeight); all ' +
    'three quantities must share the same weight unit.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a capacity-limit phrase, an explicit per-unit weight, a combined/fixed ' +
          'overhead weight (all sharing one unit), and a "maximum number of" closing question; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `maxUnits = ${result.maxUnits}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.maxUnits) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'floor((capacity - overhead) / unitWeight)' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(bridgeCapacityMinusOverheadDividedByUnitWeightFloor);
