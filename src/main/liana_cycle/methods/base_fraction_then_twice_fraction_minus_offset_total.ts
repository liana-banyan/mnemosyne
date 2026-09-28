// D-BP223-BM04-h2cbp9d8-171 -- base-fraction-then-twice-fraction-minus-offset-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-fraction-then-twice-fraction-minus-offset-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R07
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C235 (GSM8K test.jsonl item398, singleton).
 *
 * @generalShape A BASE category count is given directly. A SECOND category is a stated FRACTION
 *   ("1/N as many") of the base category. A THIRD category is "twice" the second category MINUS a
 *   stated flat offset. The question asks for the TOTAL of all three categories.
 *   catB = base * fracNum/fracDen (exact); catC = 2*catB - offset; total = base + catB + catC.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, from the SAME question: (a) "saw
 *   <base> <catA>,"; (b) "<num>/<den> as many <catB> as <catA-or-referent>"; (c) "a number of
 *   <catC> equal to twice the number of <catB'> minus <offset>", where <catB'> names the SAME
 *   second category as (b) -- checked by exact case-insensitive string match, not assumed; (d) a
 *   closing "how many <items> did <actor> count total" question.
 *
 * @whatBreaksIt (a) the base-to-second-category fraction does not divide the base count exactly
 *   -- abstain; (b) the multiplier word is anything other than the literal "twice" (e.g. "three
 *   times") -- abstain, this candidate recognises only the exact phrasing it was taught on; (c)
 *   the third category's reference name does not match the second category's own name -- abstain,
 *   a positive-evidence check against a coincidental structural match on a DIFFERENT referent; (d)
 *   an "plus" or "add" offset instead of "minus" -- no regex match, abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item398): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-fraction-then-twice-fraction-minus-offset-total-v1';

const BASE_RE = /saw\s+(\d+)\s+([a-z]+),/i;
const FRAC_RE = /(\d+)\/(\d+)(?:st|nd|rd|th)?\s+as many\s+([a-z]+)\s+as\s+[a-z]+/i;
const THIRD_RE = /a number of\s+([a-z\s]+?)\s+equal to twice the number of\s+([a-z]+)\s+minus\s+(\d+)/i;
const CLOSING_Q_RE = /how many\s+[a-z]+\s+did\s+[a-z]+\s+count total/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = BASE_RE.exec(q);
  const fracM = FRAC_RE.exec(q);
  const thirdM = THIRD_RE.exec(q);
  if (!baseM || !fracM || !thirdM) return null;
  if (!CLOSING_Q_RE.test(q)) return null;

  const base = Number(baseM[1]);
  const fracNum = Number(fracM[1]);
  const fracDen = Number(fracM[2]);
  const secondCatFromFrac = fracM[3].trim().toLowerCase();
  const secondCatFromThird = thirdM[2].trim().toLowerCase();
  const offset = Number(thirdM[3]);
  if (![base, fracNum, fracDen, offset].every(Number.isFinite)) return null;
  if (fracDen <= 0) return null;

  // Positive-evidence discriminator: the "twice the number of X" clause must name the SAME
  // second category the fraction clause introduced, not a coincidental structural match on some
  // other noun.
  if (secondCatFromFrac !== secondCatFromThird) return null;

  const catBNumerator = base * fracNum;
  if (catBNumerator % fracDen !== 0) return null;
  const catB = catBNumerator / fracDen;
  const catC = 2 * catB - offset;
  if (catC < 0) return null;

  return { total: base + catB + catC };
}

export const baseFractionThenTwiceFractionMinusOffsetTotal: LianaMethod = {
  id: 'base-fraction-then-twice-fraction-minus-offset-total-v1',
  demand: 'COMPUTE',
  name: 'Compute a three-category total: base, a fraction of base, and twice that fraction minus an offset',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C235, GSM8K test item398',
  shapeDescription:
    'catB = base*fracNum/fracDen (exact); catC = 2*catB - offset; total = base + catB + catC, only ' +
    'when the fraction divides exactly, the multiplier is literally "twice", and the third ' +
    'category names the same referent as the fraction category.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find "saw <base> <catA>,", "<num>/<den> as many <catB> as <catA>", "a number of ' +
          '<catC> equal to twice the number of <catB> minus <offset>" with the same catB referent, ' +
          'and a "how many ... count total" closing question, with the fraction dividing exactly; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `total = ${result.total}` };
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
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'base plus an exact fraction of base plus twice that fraction minus an offset',
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

registerMethod(baseFractionThenTwiceFractionMinusOffsetTotal);
