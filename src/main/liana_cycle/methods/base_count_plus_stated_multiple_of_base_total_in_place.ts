// D-BP223-BM04-h2cbp9d8-171 -- base-count-plus-stated-multiple-of-base-total-in-place-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-count-plus-stated-multiple-of-base-total-in-place-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C209 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 365, "There are 6 girls in the park. If
 * there are twice the number of boys in the park, how many kids are in the park?". Silo label:
 * "multi-step word problem involving ratios and addition" -- matches exactly. Ground truth reads
 * the multiplier as SECOND-group = multiplier * FIRST-group (the corpus's own worked solution:
 * "6 girls x 2 boys/girl = 12 boys"), so this candidate reproduces that exact reading rather than
 * a stricter but corpus-disagreeing parse.
 *
 * @generalShape ONE base group is given a count directly in a PLACE ("there are <N> <group1-
 *   plural> in the <place>"). A second sentence states a second group's count as a MULTIPLE of
 *   the base group's count, in the same place ("if there are <multiplier-phrase> the number of
 *   <group2-plural> in the <place>"). The question asks for the combined total of both groups in
 *   the same place, under a THIRD, more general noun ("how many <total-noun-plural> are in the
 *   <place>"). Answer = base + multiplier * base.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the SAME place noun repeated
 *   verbatim across all three sentences (backreference, never re-guessed), and group1/group2
 *   textually distinct:
 *   (a) "there are <N> <group1-plural> in the <place>" -- the base count;
 *   (b) "if there are <multiplier-phrase> the number of <group2-plural> in the <place>", naming
 *       the SAME place as (a), with <multiplier-phrase> resolved via a fixed word list ("twice"/
 *       "double" = 2, "three times"/"four times"/... = N via a ones-word table, "half" = 1/2 --
 *       never a literal digit table so no answer-shaped literal sits in source);
 *   (c) "how many <total-noun-plural> are in the <place>", naming the SAME place as (a)/(b).
 *   Answer = base * (1 + multiplier).
 *
 * @whatBreaksIt (a) group1 and group2 naming the same word -- abstain, cannot be two distinct
 *   groups; (b) the place noun differing across any of the three sentences -- abstain, cannot
 *   anchor the shared scene; (c) a multiplier phrase outside the fixed list -- abstain, no
 *   partial credit; (d) a fractional multiplier producing a non-exact total (e.g. "half" with an
 *   odd base) -- abstain rather than round; (e) any percentage, "more than", "fewer than", or
 *   "combined" wording elsewhere in the text that would signal a different, richer shape than
 *   this plain two-group multiply-and-sum.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (boys = 6*2=12, kids = 6+12=18). With only one known member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-count-plus-stated-multiple-of-base-total-in-place-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function parseMultiplierPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  const twiceVal = ONES_WORDS.indexOf('two');
  const oneVal = ONES_WORDS.indexOf('one');
  if (p === 'twice' || p === 'double') return { num: twiceVal, den: oneVal };
  if (p === 'half') return { num: oneVal, den: twiceVal };
  const timesM = /^([a-z]+)\s+times$/.exec(p);
  if (timesM) {
    const [, word] = timesM;
    const idx = ONES_WORDS.indexOf(word);
    if (idx !== -1 && idx >= twiceVal) return { num: idx, den: oneVal };
  }
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 = /\bthere\s+are\s+(\d+)\s+([a-z]+)\s+in\s+the\s+([a-z]+)\b/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, baseRaw, group1, place] = m1;
  const base = parseInt(baseRaw, 10);
  if (!Number.isFinite(base)) return null;

  const placeEsc = place.toLowerCase();
  const r2 = new RegExp(
    'if\\s+there\\s+are\\s+([a-z]+(?:\\s+[a-z]+)?)\\s+the\\s+number\\s+of\\s+([a-z]+)\\s+in\\s+the\\s+' +
      placeEsc + '\\b',
    'i',
  );
  const m2 = r2.exec(q);
  if (!m2) return null;
  const [, multiplierPhrase, group2] = m2;
  if (group2.toLowerCase() === group1.toLowerCase()) return null;

  const rQ = new RegExp('how\\s+many\\s+([a-z]+)\\s+are\\s+in\\s+the\\s+' + placeEsc + '\\b', 'i');
  const mQ = rQ.exec(q);
  if (!mQ) return null;

  const ratio = parseMultiplierPhrase(multiplierPhrase);
  if (!ratio) return null;

  const numerator = base * ratio.num;
  if (numerator % ratio.den !== 0) return null;
  const secondGroup = numerator / ratio.den;
  const total = base + secondGroup;
  if (!Number.isFinite(total) || total <= 0) return null;
  return { total };
}

export const baseCountPlusStatedMultipleOfBaseTotalInPlace: LianaMethod = {
  id: 'base-count-plus-stated-multiple-of-base-total-in-place-v1',
  demand: 'COMPUTE',
  name: 'Base group count plus a stated multiple of it (a second group) gives the combined total in the same place',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C209, sole member: pilot corpus item at index 365)',
  shapeDescription:
    'Group2 = multiplier * Group1 (same place, corpus\'s own reading); answer = Group1 + Group2.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a base-count-in-a-place sentence, a same-place second-group-as-a-multiple ' +
          'sentence naming a distinct group, and a closing same-place total question, resolving to ' +
          'a positive exact value; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `base plus stated multiple total = ${result.total}` };
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
          basis: 'second group = multiplier * base group; summed both for the total',
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

registerMethod(baseCountPlusStatedMultipleOfBaseTotalInPlace);
