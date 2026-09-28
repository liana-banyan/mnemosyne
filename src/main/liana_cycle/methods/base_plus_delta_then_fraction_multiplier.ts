// D-BP223-BM04-h2cbpv9w-170 -- base-plus-delta-then-fraction-multiplier-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-plus-delta-then-fraction-multiplier-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C74 (1 member, sole member
 * harvest_gsm8k_pilot_item160_multi_step_arithmetic_problem). Representative teaching case:
 * GSM8K test.jsonl line 160 (a tank's water depth across Monday/Tuesday/Wednesday).
 *
 * @generalShape Three named periods (days) appear in order. Period 1 has a directly-stated base
 *   quantity. Period 2's quantity is period 1's quantity plus a directly-stated additive delta
 *   ("N <unit> more"). Period 3's quantity is a WORD-STATED FRACTION (e.g. "two thirds") of
 *   period 2's quantity, explicitly anchored by the phrase "of what it was on <period 2>". The
 *   question asks for period 3's quantity.
 *
 * @recogniseInStranger Cut the text at the interrogative. Split into sentences, each tagged with
 *   the day name(s) it mentions. Sentence 1 must carry a day plus "depth of N <unit>" (or an
 *   equivalent base-value phrase) -- the BASE. A later sentence must carry a day plus "N <unit>
 *   more" -- the DELTA, tagged to its own day. A further sentence must carry a day plus a
 *   word-fraction ("<number word> <halves/thirds/quarters/...>") AND the literal back-reference
 *   "of what it was on <the delta's day>" -- the FRACTION. Fire only when all three are found,
 *   the fraction's back-reference day exactly matches the delta's day, and the fractional
 *   arithmetic divides out exactly.
 *
 * @whatBreaksIt (a) a delta described as "less"/"fewer" (subtraction) rather than "more" --
 *   out of scope for this narrow shape, correctly left unmatched; (b) a fraction with no explicit
 *   "of what it was on <day>" back-reference -- without it, which period the fraction applies to
 *   is a guess, not a recognition; (c) a non-exact fraction result (the combined value is not an
 *   exact multiple of the fraction's denominator).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (missing base/delta/fraction, a mismatched back-reference day, a non-exact division)
 *   makes the method ABSTAIN: verdict null, abstain true. Gate 1 (own generating question, GSM8K
 *   line 160): SOLVED, verdict 16, matching the corpus's own "#### 16".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-plus-delta-then-fraction-multiplier-v1';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const NUM_TO_VAL: Record<string, number> = {};
NUM_WORDS.forEach((w, i) => { NUM_TO_VAL[w] = i; });

const DENOM_WORDS: Record<string, number> = {
  half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fourth: 4, fourths: 4,
  fifth: 5, fifths: 5, sixth: 6, sixths: 6, seventh: 7, sevenths: 7, eighth: 8, eighths: 8,
  ninth: 9, ninths: 9, tenth: 10, tenths: 10,
};

const DAY_RE = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/;
const BASE_RE = /depth of\s+(\d+(?:\.\d+)?)\s*(?:feet|inches|meters|cm)?/i;
const DELTA_RE = /(\d+(?:\.\d+)?)\s*(?:feet|inches|meters|cm)?\s*more\b/i;
const FRAC_RE =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(halves|half|thirds|third|quarters|quarter|fourths|fourth|fifths|fifth|sixths|sixth|sevenths|seventh|eighths|eighth|ninths|ninth|tenths|tenth)\b/i;
const REF_RE = /of what it was on\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;

interface Analyzed {
  base: number;
  delta: number;
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const interrogative = /what is|how (many|much|deep|long)/i;
  const im = interrogative.exec(q);
  const body = im ? q.slice(0, im.index) : q;
  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);

  let base: number | null = null;
  let delta: number | null = null;
  let deltaDay: string | null = null;
  let numerator: number | null = null;
  let denom: number | null = null;
  let refDay: string | null = null;

  for (const s of sentences) {
    const day = DAY_RE.exec(s);
    if (!day) continue;

    if (base === null) {
      const b = BASE_RE.exec(s);
      if (b) { base = parseFloat(b[1]); continue; }
    }
    if (delta === null) {
      const d = DELTA_RE.exec(s);
      if (d) { delta = parseFloat(d[1]); deltaDay = day[1]; continue; }
    }
    if (numerator === null) {
      const f = FRAC_RE.exec(s);
      if (f) {
        const num = NUM_TO_VAL[f[1].toLowerCase()];
        const den = DENOM_WORDS[f[2].toLowerCase()];
        if (num !== undefined && den !== undefined) {
          numerator = num;
          denom = den;
          const refM = REF_RE.exec(s);
          refDay = refM ? refM[1] : null;
        }
      }
    }
  }

  if (base === null || delta === null || numerator === null || denom === null) return null;
  if (!refDay || refDay !== deltaDay) return null; // fraction must explicitly anchor to the
  // period the delta itself describes -- otherwise which period it multiplies is a guess

  const midValue = base + delta;
  const scaledNumerator = midValue * numerator;
  if (scaledNumerator % denom !== 0) return null; // sympy-grade: only exact rational results
  const answer = scaledNumerator / denom;
  if (!Number.isFinite(answer)) return null;

  return { base, delta, answer };
}

export const basePlusDeltaThenFractionMultiplier: LianaMethod = {
  id: 'base-plus-delta-then-fraction-multiplier-v1',
  demand: 'COMPUTE',
  name: 'Base value plus an additive delta, then a word-fraction multiplier of that sum',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (cluster C74, representative harvest_gsm8k_pilot_item160)',
  shapeDescription:
    'A base quantity on day 1; day 2 adds a stated delta to it; day 3 is a word-stated fraction ' +
    '("two thirds") of day 2\'s value, explicitly anchored by "of what it was on <day 2>".',
  quarantined: true,
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a base value, an additive delta on a later day, and a word-fraction ' +
          'explicitly anchored back to that same delta day with an exact rational result; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `base=${result.base}, delta=${result.delta}` };
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
            basis: `(${result.base} + ${result.delta}) * fraction = ${result.answer}`,
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

registerMethod(basePlusDeltaThenFractionMultiplier);
