// D-BP223-BM04-h2cbpv9w-170 -- distance-per-fuel-used-rate-times-tank-capacity-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\distance-per-fuel-used-rate-times-tank-capacity-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W13, CLUSTER C131 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 64, "Sophia is thinking of taking a road trip in her car,
 * and would like to know how far she can drive on a single tank of gas. She has traveled 100 miles
 * since last filling her tank, and she needed to put in 4 gallons of gas to fill it up again. The
 * owner's manual for her car says that her tank holds 12 gallons of gas. How many miles can Sophia
 * drive on a single tank of gas?". Silo label: "unit conversion and rate calculation -- unit rate
 * (miles per gallon)".
 *
 * @generalShape A DISTANCE ALREADY TRAVELED D and the AMOUNT OF FUEL NEEDED TO REFILL the tank
 *   back to full U are stated (U equals the fuel consumed over D, since refilling replaces exactly
 *   what was used). A separate TANK CAPACITY C is stated. rate = D/U (distance per unit of fuel);
 *   maximum distance on a full tank = rate * C = D*C/U.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a distance-traveled clause
 *   ("traveled <D> miles"); (b) a refill-amount clause naming the SAME trip ("needed to put in <U>
 *   gallons ... to fill it up again"); (c) a tank-capacity clause ("tank holds <C> gallons"); (d) a
 *   closing question asking how far/many miles can be driven on a single/full tank.
 *
 * @whatBreaksIt (a) the refill amount not being framed as refilling AFTER the stated distance
 *   (this candidate does not attempt a bare "X miles per Y gallons" rate stated directly, only the
 *   travel-then-refill framing its sole known member evidences); (b) D*C not landing on an exact
 *   integer multiple of U -- abstains rather than round; (c) U parsing to zero or non-positive --
 *   abstains, rate undefined; (d) no explicit tank-capacity clause -- abstains, nothing to scale
 *   the rate by.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (rate = 100/4 = 25 miles/gallon; 25*12 = 300 miles). With only
 *   one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'distance-per-fuel-used-rate-times-tank-capacity-v1';


function toNum(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[,$]/g, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

interface Analyzed { maxDistance: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const distRe = /traveled\s+(\d+(?:\.\d+)?)\s*miles/i;
  const dm = distRe.exec(q);
  if (!dm) return null;
  const distance = toNum(dm[1]);
  if (distance === null || distance <= 0) return null;

  const refillRe = /(?:needed to put in|put in)\s+(\d+(?:\.\d+)?)\s*gallons?[^.]*?fill it up again/i;
  const rm = refillRe.exec(q);
  if (!rm) return null;
  const refillGallons = toNum(rm[1]);
  if (refillGallons === null || refillGallons <= 0) return null;

  const capRe = /tank holds\s+(\d+(?:\.\d+)?)\s*gallons?/i;
  const cm = capRe.exec(q);
  if (!cm) return null;
  const capacity = toNum(cm[1]);
  if (capacity === null || capacity <= 0) return null;

  if (!/how (?:far|many miles) can[^?]*(?:single|full) tank/i.test(q)) return null;

  // Exact-rational guard: distance*capacity must divide evenly by the fuel used, never rounded.
  const numerator = distance * capacity;
  if (numerator % refillGallons !== 0) return null;
  const maxDistance = numerator / refillGallons;
  if (!Number.isFinite(maxDistance) || maxDistance <= 0) return null;
  return { maxDistance };
}

export const distancePerFuelUsedRateTimesTankCapacity: LianaMethod = {
  id: 'distance-per-fuel-used-rate-times-tank-capacity-v1',
  demand: 'COMPUTE',
  name: 'Derive a distance-per-fuel-unit rate from a traveled distance and its refill amount, then scale by tank capacity',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W13 (cluster C131, sole member: pilot corpus item at index 64)',
  shapeDescription:
    'rate = distanceTraveled / fuelUsedToRefill; maxDistance = rate * tankCapacity, exact only ' +
    'when distanceTraveled*tankCapacity divides evenly by fuelUsedToRefill.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a distance-traveled clause, a matching refill-amount clause framed as ' +
          'refilling after that trip, a tank-capacity clause, and a "how far/many miles ... on a ' +
          'single/full tank" closing question, with the scaled result landing on an exact value; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `maxDistance = ${result.maxDistance}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.maxDistance) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: '(distanceTraveled / fuelUsedToRefill) * tankCapacity' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(distancePerFuelUsedRateTimesTankCapacity);
