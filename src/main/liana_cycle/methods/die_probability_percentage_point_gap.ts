// D-BP223-BM04-h2cbpv9w-170 -- die-probability-percentage-point-gap-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W07).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\die-probability-percentage-point-gap-v1.candidate.ts
// Authored by generation wave W07 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W07.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W07 CLUSTER C85 (1 silo member, sole member
 * harvest_gsm8k_pilot_item184_probability_of_independent_events_and_co, GSM8K test line 184,
 * high confidence). Representative teaching case: "Jerry is rolling a six-sided die. How much
 * more likely is it (expressed as a percentage) that he rolls a number greater than 3 than that
 * he rolls two even numbers in a row?"
 *
 * @generalShape A fair N-sided die (faces 1..N). Event A: a single roll is "greater than <T>".
 *   Event B: "two <even|odd> numbers in a row" (two independent rolls both matching the stated
 *   parity). The question asks for P(A) - P(B), expressed as a percentage-point difference.
 *
 * @recogniseInStranger Match "<N>-sided die" for the face count. Match "rolls a number greater
 *   than <T>" for event A's threshold. Match "rolls two <even|odd> numbers in a row" for event B.
 *   Require the cue phrases "expressed as a percentage" and "how much more likely" to anchor the
 *   shape. Compute countA = faces with value > T; countParity = faces matching the stated parity;
 *   P(A) = countA/N; P(B) = (countParity/N)^2 (two independent single-roll events of the same
 *   parity); answer = 100*(P(A)-P(B)), required to reduce to a whole percentage point.
 *
 * @whatBreaksIt (a) a die size or threshold this method cannot parse -- abstains; (b) the
 *   computed difference not being positive (event A is not actually more likely than event B for
 *   the given numbers) -- abstains, "how much MORE likely" presumes a positive answer and this
 *   method will not silently report a negative one; (c) the percentage-point difference not
 *   reducing to an exact whole number -- abstains rather than report a rounded or fractional
 *   percentage; (d) an event B phrased as anything other than "two <parity> numbers in a row" (a
 *   different compound-event shape) -- abstains, out of scope.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (P(>3)=3/6=50%, P(two-even-in-a-row)=
 *   (3/6)^2=25%, difference=25 percentage points). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'die-probability-percentage-point-gap-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (digit.length > 0 && /^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Analyzed {
  diffPercent: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!/expressed\s+as\s+a\s+percentage/i.test(q)) return null;
  if (!/how\s+much\s+more\s+likely/i.test(q)) return null;

  const sidesRe = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)-sided\s+die\b/i;
  const sm = sidesRe.exec(q);
  if (!sm) return null;
  const sides = wordOrDigit(sm[1]);
  if (sides === null || sides < 2) return null;

  const condARe = /rolls?\s+a\s+number\s+greater\s+than\s+(\d+|one|two|three|four|five|six|seven|eight|nine)\b/i;
  const am = condARe.exec(q);
  if (!am) return null;
  const threshold = wordOrDigit(am[1]);
  if (threshold === null) return null;

  const condBRe = /rolls?\s+two\s+(even|odd)\s+numbers?\s+in\s+a\s+row\b/i;
  const bm = condBRe.exec(q);
  if (!bm) return null;
  const parity = bm[1].toLowerCase();

  let countA = 0;
  let countParity = 0;
  for (let face = 1; face <= sides; face++) {
    if (face > threshold) countA++;
    if (parity === 'even' ? face % 2 === 0 : face % 2 === 1) countParity++;
  }

  // diffPercent = 100*(countA/sides - (countParity/sides)^2), kept as exact integer arithmetic
  // over a common denominator (sides^2) so no floating rounding enters the comparison.
  const numerator = countA * sides - countParity * countParity;
  const denominator = sides * sides;
  if (denominator === 0) return null;
  const scaled = numerator * 100;
  if (scaled <= 0) return null; // "how much MORE likely" presumes a positive gap
  if (scaled % denominator !== 0) return null; // require an exact whole percentage point
  const diffPercent = scaled / denominator;
  return { diffPercent };
}

export const dieProbabilityPercentagePointGap: LianaMethod = {
  id: 'die-probability-percentage-point-gap-v1',
  demand: 'COMPUTE',
  name: 'Die-roll probability comparison, reported as a whole percentage-point gap',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W07 (cluster C85, sole member harvest_gsm8k_pilot_item184_probability_of_independent_events_and_co)',
  shapeDescription:
    'For an N-sided die, P(single roll > threshold) minus P(two independent rolls both matching ' +
    'a stated parity), expressed as a whole percentage-point difference.',
  quarantined: true,
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find an N-sided die, a "greater than T" single-roll condition, a "two ' +
          '<parity> numbers in a row" condition, and the "expressed as a percentage"/"how much ' +
          'more likely" cues, reducing to an exact whole percentage-point gap',
      };
    }
    return { matches: true, reason: `diffPercent=${result.diffPercent}` };
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
        verdict: String(Math.round((result.diffPercent) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'exact whole percentage-point gap',
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

registerMethod(dieProbabilityPercentagePointGap);
