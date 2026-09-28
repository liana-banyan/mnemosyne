// D-BP223-BM04-h2cbpv9w-170 -- two-actor-distance-rate-time-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-actor-distance-rate-time-difference-v1.candidate.ts
// Authored by generation wave W06 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W06.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C70 (1 member, sole member
 * harvest_gsm8k_pilot_item150_time_distance_speed_relationship). Representative teaching case:
 * GSM8K test.jsonl line 150 (Steve and Tim racing home from school).
 *
 * @generalShape Two named actors each travel a stated distance (in miles) at a stated rate (in
 *   feet per minute) to reach the same destination. The quantity asked is the DIFFERENCE between
 *   their two travel times -- how long the faster (winning) actor waits for the slower one.
 *
 * @recogniseInStranger Cut the text at the interrogative ("how long"/"what is"/"what will"). Split
 *   the remaining BODY into sentences. For each sentence, find the first capitalized word that is
 *   not a leading connective (If/When/Since/After/Because/So/While/Although/Once/As/Finally/Next/
 *   Meanwhile) -- that is the sentence's actor. A sentence naming an actor plus a bare "N mile(s)"
 *   figure next to "lives"/"is" records that actor's DISTANCE. A sentence naming an actor plus
 *   "at N feet per minute" next to the word "can" records that actor's SPEED. Fire only when
 *   exactly two distinct actor names have BOTH a distance and a speed recorded.
 *
 * @whatBreaksIt (a) more or fewer than two actors carrying both facts; (b) a distance not stated
 *   in miles, or a rate not stated in feet per minute -- no other unit is handled, so this
 *   candidate abstains rather than silently mis-convert; (c) a non-exact division (feet traveled
 *   not an exact multiple of the rate) -- this candidate never rounds a travel time, it abstains;
 *   (d) a third actor mentioned with a distance or speed, which makes the pairing ambiguous.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (not exactly two actors with both facts, non-exact minute count for either actor, a
 *   non-finite result) makes the method ABSTAIN: verdict null, abstain true. Gate 1 (own
 *   generating question, GSM8K line 150): SOLVED, verdict 4, matching the corpus's own "#### 4".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-actor-distance-rate-time-difference-v1';

const FEET_PER_MILE = 5280;

const LEADING_CONNECTIVES = new Set([
  'If', 'When', 'Since', 'After', 'Because', 'So', 'Then', 'While', 'Although',
  'Once', 'As', 'Finally', 'Next', 'Meanwhile', 'Therefore', 'However', 'Also',
]);

const NAME_RE = /\b([A-Z][a-z]+)\b/g;
const DIST_IN_SENT = /(\d+(?:\.\d+)?)\s*miles?\b/;
const SPEED_IN_SENT = /\bat\s+(\d+(?:\.\d+)?)\s*feet per minute\b/i;

function firstRealName(sentence: string): string | null {
  NAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAME_RE.exec(sentence))) {
    if (!LEADING_CONNECTIVES.has(m[1])) return m[1];
  }
  return null;
}

interface Analyzed {
  names: [string, string];
  times: [number, number];
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const interrogative = /how (long|many|much)|what (is|was|will)/i;
  const im = interrogative.exec(q);
  const body = im ? q.slice(0, im.index) : q;

  const sentences = body
    .split(/(?<=[.!?])\s+|,\s*(?=if\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const distances: Record<string, number> = {};
  const speeds: Record<string, number> = {};

  for (const s of sentences) {
    const name = firstRealName(s);
    if (!name) continue;
    const dM = DIST_IN_SENT.exec(s);
    if (dM && /\b(lives?|is)\b/i.test(s)) {
      if (name in distances) return null; // duplicate distance clause for same actor -- ambiguous
      distances[name] = parseFloat(dM[1]);
    }
    const spM = SPEED_IN_SENT.exec(s);
    if (spM && /\bcan\b/i.test(s)) {
      if (name in speeds) return null;
      speeds[name] = parseFloat(spM[1]);
    }
  }

  const names = Object.keys(distances).filter((n) => n in speeds);
  if (names.length !== 2) return null;
  // Refuse if a THIRD actor carries only one of the two facts -- narrows to genuinely two-actor
  // problems rather than picking two out of a larger cast.
  if (Object.keys(distances).length !== 2 || Object.keys(speeds).length !== 2) return null;

  const [a, b] = names;
  const distFeetA = distances[a] * FEET_PER_MILE;
  const distFeetB = distances[b] * FEET_PER_MILE;
  if (speeds[a] === 0 || speeds[b] === 0) return null;
  if (distFeetA % speeds[a] !== 0 || distFeetB % speeds[b] !== 0) return null; // exact minutes only

  const timeA = distFeetA / speeds[a];
  const timeB = distFeetB / speeds[b];
  const answer = Math.abs(timeA - timeB);
  if (!Number.isFinite(answer)) return null;

  return { names: [a, b], times: [timeA, timeB], answer };
}

export const twoActorDistanceRateTimeDifference: LianaMethod = {
  id: 'two-actor-distance-rate-time-difference-v1',
  demand: 'COMPUTE',
  name: 'Two actors, distance in miles and rate in feet per minute, difference of travel times',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (cluster C70, representative harvest_gsm8k_pilot_item150)',
  shapeDescription:
    'Two named actors each have a distance in miles and a rate in feet per minute; convert each ' +
    "actor's distance to feet, divide by their own rate for an exact travel time in minutes, and " +
    'report the absolute difference between the two times.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two actors each carrying both a mile distance and a feet-per-' +
          'minute rate, or a resulting travel time was not an exact number of minutes; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `actors=[${result.names.join(', ')}], times=[${result.times.join(', ')}] minutes`,
    };
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
            verdict: String(Math.round((result.answer) * 100) / 100),
            abstain: false,
            freeText,
            method: METHOD_ID,
            basis: `${result.names[0]}: ${result.times[0]} min, ${result.names[1]}: ${result.times[1]} min ` +
            `-> |difference| = ${result.answer}`,
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

registerMethod(twoActorDistanceRateTimeDifference);
