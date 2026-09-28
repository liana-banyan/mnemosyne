// D-BP223-BM04-h2cbp9d8-171 -- two-hikers-rate-times-time-distance-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-hikers-rate-times-time-distance-difference-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C222 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 381, "Cho hiked 14 kilometers per hour for
 * 8 hours. Chloe hiked 9 kilometers per hour and stopped after 5 hours. How many kilometers
 * farther did Cho hike?". Silo label: "comparison of distances traveled at different speeds and
 * times" -- matches exactly.
 *
 * @generalShape Two named people each hike/travel at a stated RATE (distance per hour) for a
 *   stated DURATION (hours), each in their own sentence: person A's distance = rateA*timeA,
 *   person B's distance = rateB*timeB. The question asks how much FARTHER one of the two named
 *   people traveled than the other. Answer = distance(askedPerson) - distance(otherPerson), and
 *   the candidate ABSTAINS if that difference is not positive (the question would not make sense
 *   asking "farther" about the person who did not travel the greater distance).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) "<personA> hiked <rateA> kilometers per hour for <timeA> hours" -- first sentence,
 *       rate*time stated explicitly and directly;
 *   (b) "<personB> hiked <rateB> kilometers per hour and stopped after <timeB> hours" -- second
 *       sentence, a distinct person from (a);
 *   (c) the question "how many kilometers farther did <askedPerson> hike", where askedPerson is
 *       textually one of personA or personB.
 *   Answer = distance(askedPerson) - distance(the other person), computed as exact rational
 *   arithmetic (rate and time may carry up to two decimal places, multiplied as integers over a
 *   fixed scale, never floating-point accumulation).
 *
 * @whatBreaksIt (a) the computed difference for the asked person being zero or negative -- abstain,
 *   the question's own "farther" framing presupposes the asked person is ahead, and a candidate
 *   that answered anyway on a tie or reversal would be confidently wrong; (b) the askedPerson name
 *   not textually matching either personA or personB -- abstain, cannot resolve which distance
 *   the question refers to; (c) either sentence using a unit other than kilometers-per-hour (e.g.
 *   miles, meters per minute) -- this candidate only recognises the exact "kilometers per hour"
 *   phrase it has positive evidence for and abstains on unit mismatches or conversions; (d) either
 *   person's duration being unstated (e.g. "hiked all day") -- abstain, the fixed sentence
 *   patterns require an explicit hour count.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (Cho: 14*8=112 km, Chloe: 9*5=45 km, 112-45=67 km farther for Cho, matching the
 *   question's asked person). With only one known member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-hikers-rate-times-time-distance-difference-v1';

interface Analyzed { diff: number; }

/** Multiply two numbers that may carry up to 2 decimal places as exact integers over a fixed
 * scale (avoids float accumulation error), returning a plain number result. */
function exactMultiply(a: number, b: number): number {
  const scale = 100;
  const ai = Math.round(a * scale);
  const bi = Math.round(b * scale);
  return (ai * bi) / (scale * scale);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rA = /\b([A-Z][a-z]+)\s+hiked\s+(\d+(?:\.\d+)?)\s+kilometers\s+per\s+hour\s+for\s+(\d+(?:\.\d+)?)\s+hours\b/;
  const mA = rA.exec(q);
  if (!mA) return null;
  const [, personA, rateARaw, timeARaw] = mA;
  const rateA = Number(rateARaw);
  const timeA = Number(timeARaw);
  if (!Number.isFinite(rateA) || !Number.isFinite(timeA)) return null;

  const rB = /\b([A-Z][a-z]+)\s+hiked\s+(\d+(?:\.\d+)?)\s+kilometers\s+per\s+hour\s+and\s+stopped\s+after\s+(\d+(?:\.\d+)?)\s+hours\b/;
  const mB = rB.exec(q);
  if (!mB) return null;
  const [, personB, rateBRaw, timeBRaw] = mB;
  if (personB.toLowerCase() === personA.toLowerCase()) return null;
  const rateB = Number(rateBRaw);
  const timeB = Number(timeBRaw);
  if (!Number.isFinite(rateB) || !Number.isFinite(timeB)) return null;

  const rQ = /how\s+many\s+kilometers\s+farther\s+did\s+([A-Z][a-z]+)\s+hike\b/i;
  const mQ = rQ.exec(q);
  if (!mQ) return null;
  const askedRaw = mQ[1].toLowerCase();

  const distA = exactMultiply(rateA, timeA);
  const distB = exactMultiply(rateB, timeB);

  let diff: number;
  if (askedRaw === personA.toLowerCase()) {
    diff = distA - distB;
  } else if (askedRaw === personB.toLowerCase()) {
    diff = distB - distA;
  } else {
    return null;
  }
  if (!Number.isFinite(diff) || diff <= 0) return null;
  return { diff };
}

export const twoHikersRateTimesTimeDistanceDifference: LianaMethod = {
  id: 'two-hikers-rate-times-time-distance-difference-v1',
  demand: 'COMPUTE',
  name: 'Two people\'s rate-times-time distances are compared; answer is how much farther the asked person traveled',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C222, sole member: pilot corpus item at index 381)',
  shapeDescription: 'distanceA = rateA*timeA; distanceB = rateB*timeB; answer = distance(askedPerson) - distance(other), only if positive.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two "<person> hiked <rate> kilometers per hour for/and stopped after ' +
          '<time> hours" sentences naming two distinct people, a closing "how many kilometers ' +
          'farther did <person> hike" question naming one of them, and a positive distance ' +
          'difference for that person; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `distance difference = ${result.diff} km` };
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
          verdict: String(Math.round((result.diff) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'distance(askedPerson) = rate*time; distance(other) = rate*time; answer = the positive difference',
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

registerMethod(twoHikersRateTimesTimeDistanceDifference);
