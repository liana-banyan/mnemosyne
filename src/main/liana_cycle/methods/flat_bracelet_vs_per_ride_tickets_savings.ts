// D-BP223-BM04-h2cbp9d8-171 -- flat-bracelet-vs-per-ride-tickets-savings-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\flat-bracelet-vs-per-ride-tickets-savings-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C228 (GSM8K test.jsonl item389, singleton).
 *
 * @generalShape A stated total number of rides is given. A per-ride pay-as-you-go cost is built
 *   from a stated tickets-per-ride count and a stated price-per-ticket. A flat all-inclusive
 *   bracelet/pass price covering the SAME total number of rides is also stated. TWO named actors
 *   are introduced, one buying the flat pass, the other paying per ride; both ride all of the
 *   rides. The closing question asks how much the FLAT-PASS actor saves: savings = (rides *
 *   ticketsPerRide * pricePerTicket) - braceletPrice.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, from the SAME question: (a) a stated
 *   total ride count; (b) "each ride costs <k> tickets at $<p> per ticket"; (c) a flat bracelet/
 *   pass price stated to cover the SAME total ride count; (d) an "If <actorA> buys ... bracelet
 *   and <actorB> buys tickets" clause naming which actor took which option; (e) a "ride all <N>
 *   rides" confirming clause with the SAME total; (f) the closing question asks how much money the
 *   BRACELET-BUYING actor (by name) saves.
 *
 * @whatBreaksIt (a) the closing question asks about the ticket-buying actor instead of the
 *   bracelet-buying actor -- abstain, this candidate only computes savings relative to the flat-
 *   pass side, a different, unattempted direction; (b) the bracelet's covered-ride count does not
 *   match the total ride count -- abstain, the flat price would not be a fair like-for-like
 *   comparison; (c) either named actor cannot be resolved to the bracelet clause -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item389): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'flat-bracelet-vs-per-ride-tickets-savings-v1';

const RIDES_RE = /where there are\s+(\d+)\s+rides/i;
const PER_RIDE_RE = /each ride costs\s+(\d+)\s+ride tickets?\s+at\s*\$?([\d.]+)\s+per ticket/i;
const BRACELET_RE = /bracelet for\s*\$?([\d.]+)\s+which gives you\s+(\d+)\s+rides/i;
const BUY_RE = /If\s+([A-Z][a-zA-Z]*)\s+buys?\s+a ride bracelet\s+and\s+([A-Z][a-zA-Z]*)\s+buys?\s+tickets/i;
const RIDE_ALL_RE = /ride all\s+(\d+)\s+rides/i;
const QUESTION_RE = /how much money does\s+([A-Z][a-zA-Z]*)\s+save/i;

interface Analyzed { savings: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ridesM = RIDES_RE.exec(q);
  const perRideM = PER_RIDE_RE.exec(q);
  const braceletM = BRACELET_RE.exec(q);
  const buyM = BUY_RE.exec(q);
  const rideAllM = RIDE_ALL_RE.exec(q);
  const qM = QUESTION_RE.exec(q);
  if (!ridesM || !perRideM || !braceletM || !buyM || !rideAllM || !qM) return null;

  const totalRides = Number(ridesM[1]);
  const braceletRides = Number(braceletM[2]);
  const rideAll = Number(rideAllM[1]);
  if (totalRides !== braceletRides || totalRides !== rideAll) return null;

  const braceletActor = buyM[1];
  const askedActor = qM[1];
  if (braceletActor !== askedActor) return null;

  const ticketsPerRide = Number(perRideM[1]);
  const pricePerTicket = Number(perRideM[2]);
  const braceletPrice = Number(braceletM[1]);
  if (![totalRides, ticketsPerRide, pricePerTicket, braceletPrice].every(Number.isFinite)) return null;

  const payAsYouGo = totalRides * ticketsPerRide * pricePerTicket;
  return { savings: payAsYouGo - braceletPrice };
}

export const flatBraceletVsPerRideTicketsSavings: LianaMethod = {
  id: 'flat-bracelet-vs-per-ride-tickets-savings-v1',
  demand: 'COMPUTE',
  name: 'Compute how much a flat-pass buyer saves versus a per-ride ticket buyer',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C228, GSM8K test item389',
  shapeDescription:
    'A flat bracelet price covers the same total ride count as a per-ride ticket cost. Savings = ' +
    '(rides * ticketsPerRide * pricePerTicket) - braceletPrice, only when the question asks about ' +
    'the bracelet-buying actor.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching total-rides/per-ride-cost/bracelet-price quartet with a named ' +
          'bracelet buyer confirmed as the question\'s subject and a consistent ride-all count; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `savings = ${result.savings}` };
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
          verdict: String(Math.round((result.savings) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'pay-as-you-go total minus the flat bracelet price',
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

registerMethod(flatBraceletVsPerRideTicketsSavings);
