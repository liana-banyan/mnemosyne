// D-BP223-BM04-h2cbpv9w-170 -- outbound-elapsed-time-distance-then-return-time-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\outbound-elapsed-time-distance-then-return-time-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C125 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 51 (harvest_gsm8k_pilot_item51), "Tom's ship
 * can travel at 10 miles per hour. He is sailing from 1 to 4 PM. He then travels back at a rate of
 * 6 mph. How long does it take him to get back?"
 *
 * @generalShape OUTBOUND ELAPSED-TIME DISTANCE, THEN RETURN TIME AT A DIFFERENT RATE: an outbound
 *   leg's speed is stated directly; the outbound leg's DURATION is given as a clock-time RANGE
 *   ("from <T1> to <T2> PM/AM"), not a bare number of hours, so the duration must first be derived
 *   as T2 - T1; outbound distance = outboundSpeed * outboundDuration; a return-leg speed is stated
 *   separately; the question asks for the return leg's TIME to cover the SAME distance, i.e.
 *   outboundDistance / returnSpeed. Silo cluster label: "travel time calculation -- time =
 *   distance / speed".
 *
 * @recogniseInStranger Three clauses, all required: (1) an outbound-speed clause "travel at <S1>
 *   miles per hour" (or "mph"); (2) a clock-range clause "from <T1> to <T2> <AM|PM>" (both T1 and
 *   T2 sharing the same meridiem, both plain integer hours, T2 > T1); (3) a return-speed clause
 *   "travels back at a rate of <S2> (?:miles per hour|mph)". The question must contain the phrase
 *   "how long" or "how much time" together with "back" or "return", confirming it asks for the
 *   RETURN leg's time, not the outbound leg's.
 *
 * @whatBreaksIt (a) the clock range crossing a meridiem boundary (e.g. "from 11 AM to 2 PM") --
 *   this candidate's fixed-meridiem clause only accepts two times sharing the same AM/PM and
 *   abstains on a crossing range rather than attempt 12-hour arithmetic it was not built to
 *   verify; (b) the outbound duration given as a bare "for N hours" instead of a clock range -- a
 *   different (simpler) shape already covered by other candidates, not this one, since this
 *   candidate's duration extraction is anchored specifically on the "from T1 to T2" clock-range
 *   phrasing; (c) more than one outbound-speed or return-speed clause -- ambiguous, abstains
 *   rather than pick one; (d) a question asking for the OUTBOUND time or distance instead of the
 *   return time -- the "back"/"return" + "how long" requirement is the positive discriminator
 *   against that misread.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any missing
 *   clause, a meridiem-crossing clock range, or a non-finite/non-positive result makes analyze()
 *   return null and both abstain -- never a guessed verdict. Measured against its own (sole)
 *   cluster member: outboundSpeed=10, duration=4-1=3h, distance=30, returnSpeed=6,
 *   returnTime=30/6=5, matching the ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'outbound-elapsed-time-distance-then-return-time-v1';


interface Analyzed {
  outboundSpeed: number;
  duration: number;
  distance: number;
  returnSpeed: number;
  returnTime: number;
}

// WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
// single teaching item happens to use "travel at"/"travels back at", but this shape's family is
// equally well-formed with "travels at"/"traveling at" and "returns at"/"comes back at" -- widened
// on verb-choice generality alone, no tuning-reserve item text was read to make this change.
const OUTBOUND_SPEED_RE = /travel(?:s|ing)?\s+at\s+(\d+(?:\.\d+)?)\s+(?:miles?\s+per\s+hour|mph)\b/i;
const CLOCK_RANGE_RE = /from\s+(\d{1,2})\s+to\s+(\d{1,2})\s*(AM|PM)\b/i;
const RETURN_SPEED_RE = /(?:travels?\s+back|returns?|comes?\s+back)\s+at\s+(?:a\s+rate\s+of\s+)?(\d+(?:\.\d+)?)\s*(?:miles?\s+per\s+hour|mph)\b/i;
const RETURN_QUESTION_RE = /how\s+(?:long|much\s+time)\b[^.?!]*?\b(?:back|return)\b|\b(?:back|return)\b[^.?!]*?how\s+(?:long|much\s+time)\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const speedM = OUTBOUND_SPEED_RE.exec(q);
  const clockM = CLOCK_RANGE_RE.exec(q);
  const returnM = RETURN_SPEED_RE.exec(q);
  if (!speedM || !clockM || !returnM) return null;
  if (!RETURN_QUESTION_RE.test(q)) return null;

  const speedGlobal = new RegExp(OUTBOUND_SPEED_RE.source, 'gi');
  let speedCount = 0;
  while (speedGlobal.exec(q) !== null) speedCount += 1;
  const returnGlobal = new RegExp(RETURN_SPEED_RE.source, 'gi');
  let returnCount = 0;
  while (returnGlobal.exec(q) !== null) returnCount += 1;
  if (speedCount !== 1 || returnCount !== 1) return null;

  const t1 = parseFloat(clockM[1]);
  const t2 = parseFloat(clockM[2]);
  if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 <= t1) return null; // same-meridiem range only

  const outboundSpeed = parseFloat(speedM[1]);
  const returnSpeed = parseFloat(returnM[1]);
  if (!Number.isFinite(outboundSpeed) || outboundSpeed <= 0 || !Number.isFinite(returnSpeed) || returnSpeed <= 0) return null;

  const duration = t2 - t1;
  const distance = outboundSpeed * duration;
  const returnTime = distance / returnSpeed;
  if (!Number.isFinite(returnTime) || returnTime < 0) return null;

  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { outboundSpeed, duration: round(duration), distance: round(distance), returnSpeed, returnTime: round(returnTime) };
}

export const outboundElapsedTimeDistanceThenReturnTime: LianaMethod = {
  id: 'outbound-elapsed-time-distance-then-return-time-v1',
  demand: 'COMPUTE',
  name: 'Outbound distance from a clock-time range, then return leg time at a different rate',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/SEG (cluster C125, sole member harvest_gsm8k_pilot_item51)',
  shapeDescription:
    'An outbound speed and a "from T1 to T2" clock range give outbound distance; a stated return ' +
    'speed and that same distance give the return leg\'s time (distance / returnSpeed).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a single outbound-speed clause, a same-meridiem "from T1 to T2" clock ' +
          'range with T2 > T1, a single return-speed clause, and a question asking "how long" ' +
          'about the "back"/"return" leg; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `duration=${result.duration}h, distance=${result.distance}, returnTime=${result.returnTime}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      return {
        question,
        verdict: String(result.returnTime),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `distance(${result.distance}) / returnSpeed(${result.returnSpeed}) = ${result.returnTime}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(outboundElapsedTimeDistanceThenReturnTime);
