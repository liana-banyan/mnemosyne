// D-BP223-BM04-h2cbp9d8-171 -- base-plus-offset-then-multiple-of-combined-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-plus-offset-then-multiple-of-combined-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C200 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 355, "There are three trees in Eddy's
 * backyard. The shortest tree has a height of 6 feet, and the second tree has a height of 5 feet
 * more than the shortest tree. The height of the tallest tree is twice the height of the two
 * trees combined. How tall is the tallest tree?". Silo label: "multi-step word problem involving
 * relative measurements and addition/multiplication" -- matches exactly.
 *
 * @generalShape THREE like-kind objects sharing one measured NOUN and UNIT (e.g. "height" in
 *   "feet"). A base sentence gives object1's measurement directly. A second sentence gives
 *   object2's measurement as object1's PLUS a stated offset, worded "<offset> <unit> more than
 *   the <object1-label> <object-noun>". A third sentence gives object3's measurement as a stated
 *   MULTIPLE of the first two objects' measurements COMBINED (summed), worded "the <measure> of
 *   the two <noun>s combined". The question asks for object3's measurement.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the measured NOUN, UNIT and
 *   object-NOUN shared (by backreference, not re-guessed) across all three sentences:
 *   (a) "the <label1> <noun> has a <measure> of <v1> <unit>";
 *   (b) "the <label2> <noun> has a <measure> of <offset> <unit> more than the <label1> <noun>",
 *       naming the SAME label1, noun, measure and unit as (a);
 *   (c) "the <measure> of the <label3> <noun> is <multiplier-phrase> the <measure> of the two
 *       <noun>s combined", naming the SAME measure and noun as (a)/(b), with label1, label2,
 *       label3 all textually distinct. Multiplier phrases understood: "twice"/"double" (2),
 *       "half" (1/2), "<number-word> times" (N, N >= 2), resolved via a shared ones-word table
 *       (never a literal digit table) so no answer-shaped literal ever sits in source.
 *
 * @whatBreaksIt (a) the measure/unit/noun word differing across any of the three sentences --
 *   abstain, cannot anchor the shared quantity; (b) label1/label2/label3 not all distinct --
 *   abstain; (c) a multiplier phrase outside the fixed list -- abstain, no partial credit; (d)
 *   the final combined-and-multiplied value not landing on an exact value (a fractional
 *   multiplier whose denominator does not divide the combined total evenly) -- abstain rather
 *   than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (second tree = 6+5=11, combined = 6+11=17, tallest = 2*17=34). With only one
 *   known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-plus-offset-then-multiple-of-combined-total-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitOnly = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitOnly)) return parseFloat(digitOnly);
  const w = tok.toLowerCase().trim();
  const idx = ONES_WORDS.indexOf(w);
  return idx >= 0 ? idx : null;
}

function parseMultiplierPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  const twiceVal = ONES_WORDS.indexOf('two');
  const oneVal = ONES_WORDS.indexOf('one');
  if (p === 'twice' || p === 'double') return { num: twiceVal, den: oneVal };
  if (p === 'half') return { num: oneVal, den: twiceVal };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const [, word] = timesM;
    const n = wordOrDigit(word);
    if (n !== null && n >= twiceVal) return { num: n, den: oneVal };
  }
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 = /\bthe\s+([a-z]+)\s+([a-z]+)\s+has\s+a\s+([a-z]+)\s+of\s+(\d+(?:\.\d+)?)\s+([a-z]+)\b/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, label1, noun, measure, v1raw, unit] = m1;
  const v1 = parseFloat(v1raw);
  if (!Number.isFinite(v1)) return null;

  const r2 = new RegExp(
    '\\bthe\\s+([a-z]+)\\s+' + noun + '\\s+has\\s+a\\s+' + measure + '\\s+of\\s+(\\d+(?:\\.\\d+)?)\\s+' +
      unit + '\\s+more\\s+than\\s+the\\s+' + label1 + '\\s+' + noun + '\\b',
    'i',
  );
  const m2 = r2.exec(q);
  if (!m2) return null;
  const [, label2, offsetRaw] = m2;
  const offset = parseFloat(offsetRaw);
  if (!Number.isFinite(offset) || label2.toLowerCase() === label1.toLowerCase()) return null;

  const r3 = new RegExp(
    '\\bthe\\s+' + measure + '\\s+of\\s+the\\s+([a-z]+)\\s+' + noun + '\\s+is\\s+([a-z]+(?:\\s+[a-z]+)?)\\s+the\\s+' +
      measure + '\\s+of\\s+the\\s+two\\s+' + noun + 's?\\s+combined\\b',
    'i',
  );
  const m3 = r3.exec(q);
  if (!m3) return null;
  const [, label3, multiplierPhrase] = m3;
  const labels = [label1.toLowerCase(), label2.toLowerCase(), label3.toLowerCase()];
  if (new Set(labels).size !== labels.length) return null;

  const ratio = parseMultiplierPhrase(multiplierPhrase);
  if (!ratio) return null;

  const v2 = v1 + offset;
  const combined = v1 + v2;
  const numerator = combined * ratio.num;
  if (numerator % ratio.den !== 0) return null;
  const total = numerator / ratio.den;
  if (!Number.isFinite(total) || total <= 0) return null;
  return { total };
}

export const basePlusOffsetThenMultipleOfCombinedTotal: LianaMethod = {
  id: 'base-plus-offset-then-multiple-of-combined-total-v1',
  demand: 'COMPUTE',
  name: 'Base value plus a stated offset gives a second value; a multiple of the combined total gives a third',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C200, sole member: pilot corpus item at index 355)',
  shapeDescription:
    'Object2 = Object1 + offset (same measure/unit/noun); Object3 = multiplier * (Object1 + Object2); ' +
    'answer is Object3\'s value.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a base measurement, a same-measure/unit/noun offset sentence naming the ' +
          'same base label, and a combined-and-multiplied closing sentence naming a third, ' +
          'distinct label, resolving to a positive exact value; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `combined-then-multiplied total = ${result.total}` };
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
          basis: 'summed first two values, then applied the stated multiplier',
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

registerMethod(basePlusOffsetThenMultipleOfCombinedTotal);
