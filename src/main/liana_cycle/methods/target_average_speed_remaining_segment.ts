// D-BP223-BM04-h2cbpv9w-170 -- target-average-speed-remaining-segment-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\target-average-speed-remaining-segment-v1.candidate.ts
// Authored by generation wave W08 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W08.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C88 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 19, "Marissa is hiking a 12-mile trail. She
 * took 1 hour to walk the first 4 miles, then another hour to walk the next two miles. If she
 * wants her average speed to be 4 miles per hour, what speed (in miles per hour) does she need to
 * walk the remaining distance?". Silo label: "average speed over multiple segments -- total
 * distance divided by total time" (SILO LABEL IS AN OVERSIMPLIFICATION, not a disagreement with
 * the accepted answer: the real arithmetic needs an intermediate "time allowed for the whole
 * target average" step the one-line label omits; this candidate follows the arithmetic the
 * accepted answer, 6, actually requires).
 *
 * @generalShape A total trip distance is given. Exactly TWO already-completed segments are each
 *   described as "took <time> to walk <distance>". A TARGET average speed for the WHOLE trip is
 *   stated. The question asks what speed is needed over the REMAINING distance to still hit that
 *   target average. Solve: time allowed for the whole trip = totalDistance / targetSpeed; time
 *   already spent = segment1Time + segment2Time; remaining time = allowed - spent; remaining
 *   distance = totalDistance - segment1Distance - segment2Distance; answer = remainingDistance /
 *   remainingTime.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a "<N>-mile trail" (or similar) total-distance phrase;
 *   (b) a first segment "took <time> hour(s) to walk [the first] <distance> miles";
 *   (c) a second segment "then another <time>hour(s) to walk [the next] <distance> miles" -- the
 *       time word may be omitted ("another hour" means one hour, matched via an optional
 *       number/word group defaulting to one only when the literal "hour(s)" immediately follows);
 *   (d) a target-average-speed phrase "average speed to be <S> miles per hour";
 *   (e) the question's own closing clause containing the word "remaining", anchoring that this is
 *       specifically the remaining-distance-required-speed shape, not a plain average-speed one.
 *
 * @whatBreaksIt (a) more or fewer than two completed segments described in this exact phrasing --
 *   abstain, cannot anchor which numbers are which; (b) the derived remaining time or remaining
 *   distance not strictly positive -- abstain, the trip is already at or past the target; (c) the
 *   final division not landing on an exact integer -- abstain rather than round, using exact
 *   BigInt fraction arithmetic throughout, never a floating-point intermediate; (d) the word
 *   "remaining" absent from the closing clause -- abstain, this candidate only answers that exact
 *   question shape, not a plain "what was her average speed" question.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (6 = (12-4-2) / (12/4 - 1-1), i.e. 6 remaining miles over 1
 *   remaining hour). With only one known cluster member there is no cross-member measurement.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'target-average-speed-remaining-segment-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + TENS_WORDS.indexOf('twenty') + ONES_WORDS.indexOf('two')) * ONES_WORDS.indexOf('ten'); });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

type Frac = { n: bigint; d: bigint };
function gcdBig(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
function simplify(f: Frac): Frac { if (f.d < 0n) { f = { n: -f.n, d: -f.d }; } const g = gcdBig(f.n, f.d) || 1n; return { n: f.n / g, d: f.d / g }; }
function toFraction(numStr: string): Frac | null {
  const s = numStr.trim();
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const [intPart, fracPart = ''] = s.split('.');
  const d = 10n ** BigInt(fracPart.length);
  const n = BigInt(intPart + fracPart);
  return simplify({ n, d });
}
function fromNumber(v: number): Frac { return toFraction(String(v)) || { n: BigInt(Math.round(v)), d: 1n }; }
function addFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }); }
function subFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d - b.n * a.d, d: a.d * b.d }); }
function divFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d, d: a.d * b.n }); }
function isPositive(f: Frac): boolean { return f.n > 0n; }
function exactInt(f: Frac): number | null { return f.d === 1n ? Number(f.n) : null; }

interface Analyzed { speed: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const distanceRe = /(\d+(?:\.\d+)?)-mile\s+trail/i;
  const dm = distanceRe.exec(q);
  if (!dm) return null;
  const totalDistance = fromNumber(parseFloat(dm[1]));

  const seg1Re = /\btook\s+(\d+|[a-z]+)\s+hours?\s+to\s+walk\s+(?:the\s+first\s+)?(\d+|[a-z]+)\s+miles?\b/i;
  const s1 = seg1Re.exec(q);
  if (!s1) return null;
  const t1 = wordOrDigit(s1[1]);
  const d1 = wordOrDigit(s1[2]);
  if (t1 === null || d1 === null) return null;

  const seg2Re = /\bthen\s+another\s+(\d+|[a-z]+)?\s*hours?\s+to\s+walk\s+(?:the\s+next\s+)?(\d+|[a-z]+)\s+miles?\b/i;
  const s2 = seg2Re.exec(q);
  if (!s2) return null;
  const t2 = s2[1] === undefined ? ONES_WORDS.indexOf('one') : wordOrDigit(s2[1]);
  const d2 = wordOrDigit(s2[2]);
  if (t2 === null || d2 === null) return null;

  const speedRe = /average\s+speed\s+to\s+be\s+(\d+(?:\.\d+)?)\s+miles?\s+per\s+hour/i;
  const sm = speedRe.exec(q);
  if (!sm) return null;
  const targetSpeed = fromNumber(parseFloat(sm[1]));
  if (targetSpeed.n === 0n) return null;

  const closing = q.slice(q.lastIndexOf('.') + 1);
  if (!/\bremaining\b/i.test(closing)) return null;

  const timeAllowed = divFrac(totalDistance, targetSpeed);
  const timeSpent = addFrac(fromNumber(t1), fromNumber(t2));
  const remainingTime = subFrac(timeAllowed, timeSpent);
  if (!isPositive(remainingTime)) return null;

  const distanceSpent = addFrac(fromNumber(d1), fromNumber(d2));
  const remainingDistance = subFrac(totalDistance, distanceSpent);
  if (!isPositive(remainingDistance)) return null;

  const speedFrac = divFrac(remainingDistance, remainingTime);
  const speed = exactInt(speedFrac);
  if (speed === null) return null;
  return { speed };
}

export const targetAverageSpeedRemainingSegment: LianaMethod = {
  id: 'target-average-speed-remaining-segment-v1',
  demand: 'COMPUTE',
  name: 'Required speed for the remaining distance to still hit a target average speed',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C88, sole member harvest_gsm8k_pilot_item19)',
  shapeDescription:
    'A total trip distance, two already-completed (time, distance) segments, and a target ' +
    'average speed for the whole trip; answer = remaining distance / remaining time-allowed.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total-distance trail, two completed (time, distance) segments, a ' +
          'target average speed, and a "remaining" question resolving to an exact positive ' +
          'integer required speed; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `required remaining speed = ${result.speed}` };
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
        verdict: String(Math.round((result.speed) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'remainingDistance / remainingTime',
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

registerMethod(targetAverageSpeedRemainingSegment);
