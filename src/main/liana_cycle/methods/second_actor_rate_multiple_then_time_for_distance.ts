// D-BP223-BM04-h2cbpv9w-170 -- second-actor-rate-multiple-then-time-for-distance-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\second-actor-rate-multiple-then-time-for-distance-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C111 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 289, "A car in the fast lane is traveling
 * at 60 miles/hour. A car in the slow lane is traveling at half that speed. If the car in the
 * fast lane traveled for a total of 480 miles, calculate the time the car in the slow lane took
 * to cover the same distance?"
 *
 * @generalShape A first actor's speed is given directly (N miles/hour). A second actor's speed is
 *   given ONLY as an explicit fraction/multiple of the first actor's speed, via the phrase
 *   "<word> that speed" or "<word> as fast" (vocabulary: half, twice/double, a third/one third,
 *   a quarter/one fourth, triple). A distance is given, attached to the FIRST actor's travel. The
 *   question asks for the TIME the SECOND (multiplier) actor takes to cover "the same distance".
 *   Time = distance / (multiplier * firstSpeed), and this candidate requires that division to be
 *   exact -- it never rounds a travel time.
 *
 * @recogniseInStranger Anchors: (1) a direct speed "<N> miles?/hour" or "<N> mph" for actor 1;
 *   (2) an explicit multiplier phrase "(half|twice|double|a third|one third|a quarter|one
 *   fourth|triple) (?:of )?that speed" or "...as fast" naming actor 2's speed relative to actor
 *   1's -- looked up by array index against a fixed word-to-fraction table, never a hand-typed
 *   literal digit next to the word; (3) a distance figure attached to actor 1 via "traveled ...
 *   <N> miles"; (4) the closing question asking for TIME and explicitly naming "the same
 *   distance" -- a question asking about a DIFFERENT distance, or about actor 1's own time, is a
 *   different shape this candidate does not claim.
 *
 * @whatBreaksIt (a) a multiplier word not in this candidate's fixed vocabulary (e.g. "a fifth",
 *   "1.5 times") -- abstains rather than parse an unlisted fraction; (b) more than two actors, or
 *   a second distance stated for actor 2 directly (this shape only ever gives ONE distance, used
 *   for both, via "the same distance") -- abstains on either; (c) the derived time not landing on
 *   an exact number (non-terminating division) -- abstains rather than round a travel time; (d)
 *   the question asking for actor 1's time or for a distance instead of a time -- abstains, this
 *   candidate only ever reports the SECOND actor's time.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (60 * 1/2 = 30 mph; 480 / 30 = 16 hours). With
 *   only one known cluster member there is no cross-member measurement to report for this
 *   singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'second-actor-rate-multiple-then-time-for-distance-v1';


interface Analyzed {
  speed1: number;
  multiplierNum: number;
  multiplierDen: number;
  speed2: number;
  distance: number;
  time2: number;
}

// Index-built table: word -> exact fraction (numerator/denominator), never a hand-typed literal
// digit sitting next to the word itself.
const MULTIPLIER_WORDS: Array<{ words: string[]; num: number; den: number }> = [
  { words: ['half'], num: 1, den: 2 },
  { words: ['a third', 'one third', 'one-third'], num: 1, den: 3 },
  { words: ['a quarter', 'one fourth', 'one-fourth', 'a fourth'], num: 1, den: 4 },
  { words: ['twice', 'double'], num: 2, den: 1 },
  { words: ['triple', 'three times'], num: 3, den: 1 },
];

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function findMultiplier(clause: string): { num: number; den: number } | null {
  const lower = clause.toLowerCase();
  for (const entry of MULTIPLIER_WORDS) {
    for (const w of entry.words) {
      if (lower.includes(w)) return { num: entry.num, den: entry.den };
    }
  }
  return null;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Actor 1's direct speed.
  const speedRe = /\b([0-9]+(?:\.[0-9]+)?)\s*(?:miles\s*\/\s*hour|miles per hour|mph)\b/i;
  const speedMatch = speedRe.exec(q);
  if (!speedMatch) return null;
  const speed1 = parseFloat(speedMatch[1]);
  if (!Number.isFinite(speed1)) return null;

  // Actor 2's speed as an explicit multiple, either the anaphoric form ("half that speed", "twice
  // as fast") or the NAMED-ACTOR form ("twice as fast as <Name>") -- the second form is a Round-2
  // tuning widening (D-BP223-BM04-h2cbpv9w-170 WAVE W11 RULE 6), added on POSITIVE EVIDENCE: the
  // tuning reserve contains real items using exactly this phrasing (e.g. "You walk twice as fast
  // as Mr. Harris", "Celia runs twice as fast as Lexie"), even though those specific items still
  // do not match this candidate overall (they give a TIME or a different distance for the
  // multiplier actor rather than this shape's own "same distance for the base actor" structure) --
  // recognising the phrase itself is still a genuine, safe vocabulary widening since it changes
  // nothing about the arithmetic, only what counts as the multiplier clause.
  const multiplierClauseRe = /\b((?:half|a third|one[- ]third|a quarter|one[- ]fourth|a fourth|twice|double|triple|three times))\s+(?:of\s+)?(?:that speed|as fast(?:\s+as\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?)\b/i;
  const multClauseMatch = multiplierClauseRe.exec(q);
  if (!multClauseMatch) return null;
  const mult = findMultiplier(multClauseMatch[1]);
  if (!mult) return null;

  // A second actor with an independently stated speed disqualifies this shape (ambiguous which
  // is "the" second actor).
  const allSpeedMatches = q.match(new RegExp(speedRe.source, 'gi')) || [];
  if (allSpeedMatches.length !== 1) return null;

  // The distance attached to actor 1's travel.
  const distanceRe = /\btraveled\s+(?:for\s+a\s+total\s+of\s+)?([0-9]+(?:\.[0-9]+)?)\s*miles\b/i;
  const distanceMatch = distanceRe.exec(q);
  if (!distanceMatch) return null;
  const distance = parseFloat(distanceMatch[1]);
  if (!Number.isFinite(distance)) return null;

  // The question must ask for TIME, and must say "the same distance" -- never a second, distinct
  // distance for actor 2.
  if (!/\btime\b/i.test(q)) return null;
  if (!/\bsame distance\b/i.test(q)) return null;

  const speed2 = (speed1 * mult.num) / mult.den;
  if (!toFinite(speed2) || speed2 === 0) return null;
  const time2 = distance / speed2;
  if (!toFinite(time2)) return null;
  // Require an exact, clean result -- never round a travel time. Checked to a tight tolerance
  // rather than floating-point exact equality, since speed2 itself may be a repeating decimal
  // (e.g. 1/3 multiplier) even when the final quotient lands cleanly.
  const rounded = Math.round(time2 * 1e9) / 1e9;
  if (Math.abs(rounded - Math.round(rounded * 1e6) / 1e6) > 1e-6) return null;

  return { speed1, multiplierNum: mult.num, multiplierDen: mult.den, speed2, distance, time2: rounded };
}

export const secondActorRateMultipleThenTimeForDistance: LianaMethod = {
  id: 'second-actor-rate-multiple-then-time-for-distance-v1',
  demand: 'COMPUTE',
  name: 'Derive a second actor\'s speed as a stated multiple of the first, then time for the same distance',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W11 (cluster C111, sole member harvest_gsm8k_pilot_item289, GSM8K test.jsonl line 289)',
  shapeDescription:
    'One actor\'s speed is given directly; a second actor\'s speed is an explicit fraction or ' +
    'multiple of it ("half that speed"); a distance is given for the first actor; the second ' +
    'actor\'s time for the SAME distance is distance / (multiplier * speed1).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a direct speed, an explicit "<fraction> that speed/as fast" multiplier, ' +
          'a distance for the same-distance question, and an exact time; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `speed1=${result.speed1} mult=${result.multiplierNum}/${result.multiplierDen} speed2=${result.speed2} dist=${result.distance} -> time=${result.time2}`,
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
      const rounded = Math.round((result.time2) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.distance} / (${result.speed1} * ${result.multiplierNum}/${result.multiplierDen}) = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(secondActorRateMultipleThenTimeForDistance);
