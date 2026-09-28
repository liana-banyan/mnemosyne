// D-BP221-BM06-006 -- hollow-box-wall-thickness-volume-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\harvest_gsm8k_pilot_item106_volume_of_a_3d_object_with_thickness.candidate.ts
//
// SECOND of the six the XO handed to BM06 (D-BP221-BM0-118), same proven path as
// multi_step_multiplication_chain.ts. The candidate declared its own local `LianaQuestionInput`,
// `ShapeTestResult` and `RunResult` and carried NO annotation on the exported object, so nothing
// checked it against `LianaMethod`. Those three are DELETED here and `LianaMethod` is written on the
// object, which is what makes the compiler check every property. NEVER CAST, ANNOTATE -- his order.
//
// THE BEHAVIOR CORE IS BYTE-FOR-BYTE THE CANDIDATE'S. `DISQUALIFYING_KEYWORDS`, `HollowBoxShape`,
// `analyze()` and `computeInnerVolume()` are diffed clean against the source. That is deliberate:
// `accept_gates.cjs` returned ACCEPT on this method's BEHAVIOR ('solves its own shape, carries no
// answer, claims 1 and steals none'), so changing the analysis would mean the ACCEPT no longer
// describes this file.
//
// ONE PLACE THIS FILE DELIBERATELY DIFFERS FROM ITS SIBLING, AND WHY. multi_step_multiplication_chain
// stringifies its verdict with a bare String() because its analyze() admits only positive INTEGERS,
// so a rounding step there would be the identity and would imply a precision concern that does not
// exist. THIS method's analyze() uses parseFloat and admits DECIMAL dimensions, so a product of
// three subtractions can carry binary floating-point dust. It therefore uses the convention the
// XO's rate_distance_unit_pace.ts established -- Math.round(x * 1e6) / 1e6 -- BEFORE String().
// The two files differ because the shapes differ, not because nobody checked.
//
// REGISTERED QUARANTINED, so selectMethod() and selectEligibleMethods() will not choose it and no
// live run changes behavior today. Registering makes it visible to listMethods() and measurable.
//
// NOTE FOR ANYONE VERIFYING THIS: dist held an ORPHANED hollow_box_wall_thickness_volume.js from
// 23:48:10Z, compiled from the earlier non-conforming source that was then reverted. Nothing
// imported it, so it never registered. Building this file overwrites it. Check
// BISHOP_DROPZONE\D-BP221-BM06-TOOLS\verify_methods_in_dist.mjs, which tests the ENGINE IMPORT and
// not merely the file's presence, because presence alone reported that orphan as shipped.

/**
 * @generalShape A hollow rectangular-box shape: the text gives the three OUTER
 *   dimensions of a box as a single "L by W by H" chain, states one uniform
 *   wall thickness that applies to every side, and asks for the volume of the
 *   HOLLOW SPACE (the "inner" volume, "inside" volume) of one or more of those
 *   boxes -- never the outer/solid volume and never the volume of the wall
 *   material itself. The formula is: subtract twice the thickness from each
 *   outer dimension to get the three inner dimensions, multiply those three
 *   inner dimensions together for one box's inner volume, then multiply by
 *   however many identical boxes the question names (or by one, if it
 *   describes a single box with no count).
 *
 * @recogniseInStranger A stranger belongs to this shape only when ALL of the
 *   following hold in the raw question text: (a) exactly one "N [unit] by N
 *   [unit] by N [unit]" chain of three plain numbers joined by the literal
 *   word "by" (not "x", not "times") -- this is the outer shell; (b) exactly
 *   one distinct thickness value stated with the word "thick" (e.g. "walls
 *   are 1 inch thick", "1 inch thick walls"); (c) the words "volume" and
 *   either "inner" or "inside" both appear somewhere in the text, marking the
 *   ask as the hollow interior, not the shell; and (d) none of a deliberately
 *   long blacklist of words appears that signal a different shape entirely
 *   (surface area, material/paint/wood used to build it, a cylinder/pipe/
 *   sphere/cone, an open top or missing side, more than one distinct
 *   thickness). If a box-count number is also stated (e.g. "3 boxes"), it is
 *   read and multiplied in; if none is stated, the count defaults to one.
 *
 * @whatBreaksIt (1) A second, different thickness for a different wall (e.g.
 *   "the base is 2 inches thick but the sides are 1 inch thick") -- the naive
 *   single-thickness subtraction silently uses the wrong number for at least
 *   one dimension. (2) A box open on one side (no lid, no bottom) -- only two
 *   of the three dimensions should lose 2x thickness, not three, and nothing
 *   in the text tells this method that syntactically. (3) A thickness so
 *   large relative to an outer dimension that an inner dimension would be
 *   zero or negative -- physically impossible, and this method must refuse
 *   rather than report a negative or zero volume. (4) A second "L by W by H"
 *   chain describing a different-sized box in the same question -- which
 *   outer shell does the stated thickness belong to becomes ambiguous. (5) A
 *   non-rectangular hollow object (a pipe, a can, a sphere) where "thickness"
 *   means something else entirely and there is no length/width/height triple
 *   to subtract from.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the same single
 *   analyze() pass over the raw question text, so any single guard failing
 *   (no clean 3-number "by" chain, zero or more-than-one distinct thickness,
 *   missing "volume"+"inner/inside", a disqualifying keyword hit, or a
 *   computed inner dimension that is not strictly positive) makes BOTH
 *   abstain: verdict null, abstain true, and the engine falls through to the
 *   next eligible method at no cost. The real danger is the opposite case --
 *   a false MATCH on a box that looks like this shape but silently isn't one
 *   (most likely: an open-top box, or a box with two different wall
 *   thicknesses) -- because that produces a confident, wrong integer that
 *   ends the whole selection loop. Every guard here is written to reject
 *   generously and match narrowly for exactly that reason, and
 *   quarantined:true keeps this method out of live selection until it has
 *   been measured against held-out questions.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

// A deliberately long, deliberately over-inclusive list of words/phrases that
// signal this question is NOT a plain single-thickness hollow rectangular
// box, even when it does contain an "L by W by H" chain and the word "thick".
const DISQUALIFYING_KEYWORDS: string[] = [
  'surface area', 'material', 'wood', 'plastic', 'metal', 'paint',
  'used to make', 'used to build', 'how much wood', 'how much material',
  'cylinder', 'cylindrical', 'pipe', 'tube', 'sphere', 'spherical',
  'circular', 'cone', 'pyramid', 'radius', 'diameter', 'circumference',
  'open top', 'open-top', 'no lid', 'no bottom', 'without a lid',
  'one side open', 'missing a side', 'outer volume', 'total volume of the',
  'weight', 'density', 'mass',
];

const UNIT_WORD =
  '(?:inch(?:es)?|in\\.?|cm|centimeters?|centimetres?|feet|foot|ft\\.?|meters?|metres?|m\\b|yards?|yd\\.?)';

// Exactly one "N [unit] by N [unit] by N [unit]" chain -- the literal word
// "by", not "x" or "*", so an unrelated "multiply by 2" cannot trigger it.
const DIMS_RE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*${UNIT_WORD}?\\s*by\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT_WORD}?\\s*by\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT_WORD}?`,
  'gi'
);

// A thickness stated either as "walls are N [unit] thick" or "N [unit] thick
// walls" -- both directions are common phrasing in this problem family.
const THICKNESS_RE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*${UNIT_WORD}?\\s*thick`,
  'gi'
);

// A box count stated as "N box(es)" -- must be a digit immediately before the
// word, so "Each box" (no digit) never matches.
const BOX_COUNT_RE = /(\d+)\s*box(?:es)?\b/gi;

interface HollowBoxShape {
  outerL: number;
  outerW: number;
  outerH: number;
  thickness: number;
  boxCount: number;
}

function analyze(rawQuestion: unknown): HollowBoxShape | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();

  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  // Must ask for the hollow interior specifically, not the shell/outside.
  if (!lower.includes('volume')) return null;
  if (!lower.includes('inner') && !lower.includes('inside')) return null;

  // Exactly one outer-dimension chain -- zero means nothing to parse, two or
  // more means an ambiguous multi-box or multi-shape question this method
  // must not guess about.
  const dimsMatches = [...q.matchAll(DIMS_RE)];
  if (dimsMatches.length !== 1) return null;
  const [, lRaw, wRaw, hRaw] = dimsMatches[0];
  const outerL = parseFloat(lRaw);
  const outerW = parseFloat(wRaw);
  const outerH = parseFloat(hRaw);
  if (![outerL, outerW, outerH].every((n) => Number.isFinite(n) && n > 0)) return null;

  // Exactly one distinct thickness value -- more than one distinct value
  // means different walls have different thicknesses, which this method
  // cannot safely apply uniformly.
  const thicknessMatches = [...q.matchAll(THICKNESS_RE)];
  if (thicknessMatches.length === 0) return null;
  const distinctThicknesses = new Set(thicknessMatches.map((m) => parseFloat(m[1])));
  if (distinctThicknesses.size !== 1) return null;
  const thickness = [...distinctThicknesses][0];
  if (!Number.isFinite(thickness) || thickness <= 0) return null;

  // Box count: zero distinct matches defaults to a single box; more than one
  // distinct value is ambiguous and must abstain rather than pick one.
  const boxCountMatches = [...q.matchAll(BOX_COUNT_RE)];
  const distinctCounts = new Set(boxCountMatches.map((m) => parseInt(m[1], 10)));
  let boxCount = 1;
  if (distinctCounts.size === 1) {
    boxCount = [...distinctCounts][0];
  } else if (distinctCounts.size > 1) {
    return null;
  }
  if (!Number.isInteger(boxCount) || boxCount <= 0) return null;

  return { outerL, outerW, outerH, thickness, boxCount };
}

function computeInnerVolume(shape: HollowBoxShape): number | null {
  const innerL = shape.outerL - 2 * shape.thickness;
  const innerW = shape.outerW - 2 * shape.thickness;
  const innerH = shape.outerH - 2 * shape.thickness;
  // A wall thicker than half of some outer dimension makes a hollow interior
  // physically impossible along that axis -- refuse rather than report a
  // zero or negative volume.
  if (innerL <= 0 || innerW <= 0 || innerH <= 0) return null;
  const oneBoxVolume = innerL * innerW * innerH;
  if (!Number.isFinite(oneBoxVolume) || oneBoxVolume <= 0) return null;
  const total = oneBoxVolume * shape.boxCount;
  if (!Number.isFinite(total) || total <= 0) return null;
  return total;
}

export const hollowBoxWallThicknessVolumeMethod: LianaMethod = {
  id: 'hollow-box-wall-thickness-volume-v1',
  demand: 'COMPUTE',
  name: 'Hollow rectangular box inner volume with wall thickness',
  taughtBy: 'D-BP221-BM0-075/SEG',
  shapeDescription:
    'A rectangular box (or several identical ones) given by outer length, ' +
    'width and height joined with "by", plus one uniform wall thickness; the ' +
    'question asks for the inner/inside volume, found by subtracting twice ' +
    'the thickness from each outer dimension before multiplying.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const question = input && input.question;
    const shape = analyze(question);
    if (!shape) {
      return {
        matches: false,
        reason:
          'no single, unambiguous "L by W by H" outer-dimension chain with ' +
          'exactly one stated wall thickness and an explicit inner/inside ' +
          'volume ask was found; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason:
        `found outer ${shape.outerL}x${shape.outerW}x${shape.outerH} with ` +
        `thickness ${shape.thickness} across ${shape.boxCount} box(es)`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed.
    const freeText = !input || input.options === null || input.options === undefined;

    try {

      const shape = analyze(question);
      if (!shape) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'hollow-box-wall-thickness-volume-v1',
          basis: 'shape did not hold at run time',
        };
      }
      const total = computeInnerVolume(shape);
      if (total === null) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'hollow-box-wall-thickness-volume-v1',
          basis:
            'wall thickness leaves a non-positive inner dimension along at '
            + 'least one axis; a hollow interior is not physically possible '
            + 'under this reading, so refusing rather than reporting a bad number',
        };
      }
      // Rounded before stringifying because this shape admits decimal dimensions (parseFloat above),
      // so three chained subtractions can carry floating-point dust. See this file's header.
      const rounded = Math.round(total * 1e6) / 1e6;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: 'hollow-box-wall-thickness-volume-v1',
        basis:
          `inner dims (${shape.outerL}-2*${shape.thickness}) x `
          + `(${shape.outerW}-2*${shape.thickness}) x (${shape.outerH}-2*${shape.thickness}), `
          + `times ${shape.boxCount} box(es) = ${rounded}`,
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005, on the Founder's explicit approval 2026-09-07T01:25Z:
      // "Yes do the Try/Catch pass across the seven. Approved. Word." Same shape as the XO's
      // rate_distance_unit_pace.ts, so all seven now behave identically when run() throws:
      // ABSTAIN and say what threw, rather than letting the exception end the engine's
      // fall-through chain. An abstain is free; a thrown method is not.
      return {
        question: question,
        verdict: null,
        abstain: true,
        freeText,
        method: 'hollow-box-wall-thickness-volume-v1',
        basis: 'hollow-box-wall-thickness-volume-v1' + ' threw: ' + String((e as Error)?.message ?? e),
      };
    }
  },
};

// REGISTERED AT IMPORT TIME, the convention every other method module in this folder uses.
//
// ACCEPTED by accept_gates.cjs (BISHOP_DROPZONE\D-BP221-BM04-TOOLS) in the Founder's promoted order
// gate 1 then gate 2a then gate 4: 'solves its own shape, carries no answer, claims 1 and steals
// none'. That runner's own words: ACCEPT means safe to register. It is silent about INTERFACE FIT,
// which is what this file adds and what the four reverts were about.
registerMethod(hollowBoxWallThicknessVolumeMethod);
