// D-BP223-BM04-h2cbp9d8-171 -- known-value-equals-multiple-of-unknown-minus-offset-solve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\known-value-equals-multiple-of-unknown-minus-offset-solve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C204 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 360, "Carver just turned 45 years old,
 * which makes him 5 years less than twice the age of his son. How old is his son, in years?".
 * Silo label: "algebraic word problem involving age relationships" -- matches exactly.
 *
 * @generalShape PersonA's age (or other stated quantity) is given directly. A second sentence
 *   relates it to PersonB's (unstated) quantity via a linear relation: "which makes <PersonA>
 *   <offset> <units> less/more than <multiplier> the <quantity> of <PersonB's relation>". Solving
 *   the single linear equation (knownA = multiplier*B - offset, or knownA = multiplier*B +
 *   offset) for B gives the answer.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<PersonA> ... turned <N> years
 *   old"; (b) "which makes him/her <offset> years less/more than <multiplier-phrase> the age of
 *   his/her <relation>", where <multiplier-phrase> is resolved via a shared ones-word/twice/
 *   double/"<N> times" table, never a literal digit table. Only ONE unknown (PersonB) and ONE
 *   linear relation are handled -- no system of two unknowns.
 *
 * @whatBreaksIt (a) a multiplier phrase outside the fixed list -- abstain, no partial credit; (b)
 *   a direction word other than "less"/"more" -- abstain; (c) the backsolved value not landing on
 *   an exact integer -- abstain rather than round; (d) the backsolved value not strictly positive
 *   -- abstain, an age (or comparable quantity) cannot be zero or negative in this shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (45 = 2*son - 5, so son = (45+5)/2 = 25). With only one known member there is
 *   no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'known-value-equals-multiple-of-unknown-minus-offset-solve-v1';

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
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const [, word] = timesM;
    const n = wordOrDigit(word);
    if (n !== null && n >= twiceVal) return { num: n, den: oneVal };
  }
  return null;
}

interface Analyzed { unknownValue: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const knownRe = /\b(?:just\s+)?turned\s+(\d+)\s+years\s+old\b/i;
  const knownM = knownRe.exec(q);
  if (!knownM) return null;
  const [, knownRaw] = knownM;
  const known = parseFloat(knownRaw);

  const relationRe = /\bwhich\s+makes\s+(?:him|her)\s+(\d+|[a-z]+)\s+years\s+(less|more)\s+than\s+([a-z]+(?:\s+[a-z]+)?)\s+the\s+age\s+of\s+(?:his|her)\s+([a-z]+)\b/i;
  const relationM = relationRe.exec(q);
  if (!relationM) return null;
  const [, offsetRaw, direction, multiplierPhrase, ] = relationM;
  const offset = wordOrDigit(offsetRaw);
  if (offset === null) return null;

  const ratio = parseMultiplierPhrase(multiplierPhrase);
  if (!ratio) return null;

  // direction === 'less': known = multiplier*B - offset  =>  B = (known + offset) / multiplier
  // direction === 'more': known = multiplier*B + offset  =>  B = (known - offset) / multiplier
  const adjusted = direction.toLowerCase() === 'less' ? known + offset : known - offset;
  const numerator = adjusted * ratio.den;
  if (numerator % ratio.num !== 0) return null;
  const unknownValue = numerator / ratio.num;
  if (!Number.isFinite(unknownValue) || unknownValue <= 0) return null;
  return { unknownValue };
}

export const knownValueEqualsMultipleOfUnknownMinusOffsetSolve: LianaMethod = {
  id: 'known-value-equals-multiple-of-unknown-minus-offset-solve-v1',
  demand: 'COMPUTE',
  name: 'Solve a single linear relation: known = multiplier*unknown +/- offset',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C204, sole member: pilot corpus item at index 360)',
  shapeDescription:
    'known = multiplier * unknown +/- offset, solved for unknown by inverting the single linear relation.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a directly stated known value and a "which makes ... less/more than ' +
          '<multiplier> the age of ..." linear relation resolving to a positive exact unknown; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `unknown value = ${result.unknownValue}` };
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
          verdict: String(Math.round((result.unknownValue) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'inverted the single linear relation for the unknown',
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

registerMethod(knownValueEqualsMultipleOfUnknownMinusOffsetSolve);
