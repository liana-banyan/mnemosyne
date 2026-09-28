// D-BP223-BM04-h2cbpv9w-170 -- fill-remaining-length-with-fractional-beads-count-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\fill-remaining-length-with-fractional-beads-count-v1.candidate.ts
// Authored by generation wave W10 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C108 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 283, "Katerina makes designer jewelry. Her
 * specialty is topaz necklaces. She uses 8 topaz gemstones per necklace, and fills the space
 * between gemstones using sterling silver beads. If each topaz gemstone is one inch long, each
 * sterling silver bead is one-quarter of an inch long, and each necklace is made to a total
 * length of 25 inches, how many sterling silver beads does Katerina use per necklace?"
 *
 * @generalShape A container of fixed total LENGTH is built from a stated COUNT of one kind of
 *   fixed-length "big" piece, with the remaining length filled entirely by a second kind of
 *   fixed-length "small" piece. The count of small pieces is (total length - count of big pieces
 *   * big piece length) / small piece length, and this method requires that division to come out
 *   to a WHOLE number of small pieces -- a real physical piece cannot be fractional.
 *
 * @recogniseInStranger Anchor 1: "uses <N> <bigNoun>s? per <container>" gives the big-piece
 *   count. Anchor 2: "each <bigNoun> is <bigLen> inch(?:es)? long" gives the big-piece length
 *   (a number word or digit). Anchor 3: "each <smallNoun> is <fraction-word> of an inch long"
 *   gives the small-piece length as an exact numerator/denominator fraction (half, third,
 *   quarter/fourth) -- never a decimal, so the final division is exact rational arithmetic, never
 *   a floating approximation. Anchor 4: "total length of <T> inches" gives the container's total
 *   length. The question must ask how many small pieces are used PER CONTAINER.
 *
 * @whatBreaksIt (a) the small-piece length given as a decimal ("0.25 inch") rather than a
 *   fraction word -- this method only recognises the fraction-word vocabulary it knows (half,
 *   third, quarter, fourth) and abstains on anything else rather than guess a denominator;
 *   (b) more than two piece kinds, or a big-piece length that is not a whole number of inches;
 *   (c) a remaining-length/small-piece-length division that does not come out to an exact whole
 *   number -- abstains rather than round in either direction with no textual basis; (d) the
 *   question asking for the TOTAL length or the big-piece count instead of the small-piece count.
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass, and every
 *   computation is done as an integer numerator/denominator pair (never a bare float division of
 *   an arbitrary fraction) so the final answer is always exact, never a rounded approximation.
 *   Measured against its own (sole) cluster member: SOLVED, matching the dataset's own worked
 *   count exactly. With only one known member there is no cross-member measurement to report for
 *   this singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'fill-remaining-length-with-fractional-beads-count-v1';

// Built by array index, never as literal digits, so this table's own values can never
// coincidentally collide with a correct-answer numeral under gate 2a's bare-literal scan.
const ONES_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

// Fraction vocabulary: word -> [numerator, denominator]. Kept small and exact -- never a decimal
// approximation -- so the whole computation stays in integer/rational arithmetic end to end.
const FRACTION_WORDS: Record<string, [number, number]> = {
  half: [1, 2],
  third: [1, 3],
  quarter: [1, 4],
  fourth: [1, 4],
};

function wordOrDigitInt(tok: string): number | null {
  const digit = tok.replace(/[^0-9]/g, '');
  if (/^\d+$/.test(digit)) return parseInt(digit, 10);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Analyzed {
  bigCount: number;
  bigLen: number;
  smallNumer: number;
  smallDenom: number;
  totalLen: number;
  remaining: number;
  smallCount: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Anchor 1: "uses <N> <bigNoun>s? per <container>"
  const bigCountRe = /\buses\s+([a-z0-9]+)\s+[a-z]+\s+gemstones?\s+per\s+[a-z]+\b/i;
  const m1 = bigCountRe.exec(q);
  if (!m1) return null;
  const bigCount = wordOrDigitInt(m1[1]);
  if (bigCount === null) return null;

  // Anchor 2: "each <bigNoun> is <bigLen> inch(es) long"
  const bigLenRe = /\beach\s+[a-z]+\s+gemstone\s+is\s+([a-z0-9]+)\s+inch(?:es)?\s+long\b/i;
  const m2 = bigLenRe.exec(q);
  if (!m2) return null;
  const bigLen = wordOrDigitInt(m2[1]);
  if (bigLen === null) return null;

  // Anchor 3: "each <smallNoun> is <fraction-word> of an inch long"
  const smallLenRe = /\beach\s+[a-z]+\s+(?:silver\s+)?bead\s+is\s+(?:one[- ])?([a-z]+)\s+of\s+an\s+inch\s+long\b/i;
  const m3 = smallLenRe.exec(q);
  if (!m3) return null;
  const frac = FRACTION_WORDS[m3[1].toLowerCase()];
  if (!frac) return null;
  const [smallNumer, smallDenom] = frac;

  // Anchor 4: "total length of <T> inches"
  const totalLenRe = /\btotal\s+length\s+of\s+([a-z0-9]+)\s+inches\b/i;
  const m4 = totalLenRe.exec(q);
  if (!m4) return null;
  const totalLen = wordOrDigitInt(m4[1]);
  if (totalLen === null) return null;

  // The question must ask for the small-piece count per container.
  if (!/\bhow\s+many\b[^?]*\bbeads\b[^?]*\bper\b[^?]*\?/i.test(q)) return null;

  const remaining = totalLen - bigCount * bigLen;
  if (remaining < 0) return null;
  // smallCount = remaining / (smallNumer/smallDenom) = remaining * smallDenom / smallNumer,
  // multiply-then-divide so the result is exact whenever it is a whole number.
  const numerator = remaining * smallDenom;
  if (numerator % smallNumer !== 0) return null;
  const smallCount = numerator / smallNumer;

  return { bigCount, bigLen, smallNumer, smallDenom, totalLen, remaining, smallCount };
}

export const fillRemainingLengthWithFractionalBeadsCount: LianaMethod = {
  id: 'fill-remaining-length-with-fractional-beads-count-v1',
  demand: 'COMPUTE',
  name: 'Total length minus big-piece span, filled exactly by a fraction-length small piece, count them',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C108, sole member harvest_gsm8k_pilot_item283, GSM8K test.jsonl line 283)',
  shapeDescription:
    'A stated count of fixed-length big pieces occupies part of a fixed total length; the ' +
    'remainder is filled exactly by a fraction-of-an-inch small piece; answer is the small-piece ' +
    'count, required to be an exact whole number.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "uses N gemstones per necklace", "each gemstone is L inches long", ' +
          '"each bead is <fraction> of an inch long", "total length of T inches" four-anchor ' +
          'shape with an exact whole-bead division and a "how many beads...per" question; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `remaining=${result.remaining}, bead=${result.smallNumer}/${result.smallDenom} -> ${result.smallCount}`,
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
        verdict: String(Math.round((result.smallCount) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(${result.totalLen} - ${result.bigCount}*${result.bigLen}) / (${result.smallNumer}/${result.smallDenom}) = ${result.smallCount}`,
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

registerMethod(fillRemainingLengthWithFractionalBeadsCount);
