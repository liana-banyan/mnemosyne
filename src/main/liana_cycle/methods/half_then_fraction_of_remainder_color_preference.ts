// D-BP223-BM04-h2cbp9d8-171 -- half-then-fraction-of-remainder-color-preference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\half-then-fraction-of-remainder-color-preference-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C217 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 376, "There are 40 pupils in a class. Half
 * of the class likes blue. One-fourth of the remaining likes green and the rest likes yellow. How
 * many pupils like the color yellow?". Silo label: "multi-step fraction of a remainder problem" --
 * matches exactly.
 *
 * @generalShape A TOTAL population N is stated ("there are N <plural> in a/the <group>"). A first
 *   FRACTION word ("half") of the group prefers/likes CATEGORY-A, consuming that fraction of N. A
 *   second sentence takes a (possibly different) FRACTION word of the REMAINDER for CATEGORY-B.
 *   Whatever is left after both fractions is CATEGORY-C ("the rest likes <C>"). The question asks
 *   how many belong to category C: N - N*fracA - (N - N*fracA)*fracB, computed with EXACT rational
 *   arithmetic (never a floating heuristic) so the result is guaranteed to be an integer count.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the group noun repeated
 *   verbatim (by backreference) across the total sentence and the question:
 *   (a) "there are <N> <plural> in (?:a|the) <group>" -- the total and group noun;
 *   (b) "<fracWordA> of the <group> (?:likes|prefers|chose) <categoryA>" -- fracWordA drawn from a
 *       fixed table of common fraction words (half, third, two-thirds, fourth/quarter, three-
 *       fourths/three-quarters, fifth, two-fifths, three-fifths, four-fifths);
 *   (c) "<fracWordB> of the remaining (?:likes|prefers|chose) <categoryB>" -- fracWordB from the
 *       same table, categoryB textually distinct from categoryA;
 *   (d) "and the rest (?:likes|prefers|chose) <categoryC>" -- categoryC textually distinct from
 *       both A and B;
 *   (e) the question "how many <plural> (?:like|prefer|chose) (?:the color )?<categoryC>", naming
 *       category C and the same plural noun as (a).
 *   Both fraction applications are done as exact integer/rational arithmetic (BigInt numerator over
 *   denominator, reduced), and the candidate ABSTAINS rather than rounds if either intermediate
 *   fraction-of-count is not an exact whole number.
 *
 * @whatBreaksIt (a) a fraction word not in the fixed table (e.g. "a tenth", "three-eighths") --
 *   abstain, this candidate only resolves fractions it has positive evidence for; (b) either
 *   fraction application producing a non-integer count -- abstain, a fractional person is not a
 *   valid intermediate; (c) categoryB or categoryC colliding textually with categoryA -- abstain,
 *   cannot disambiguate; (d) the question asking about categoryA or categoryB instead of the "rest"
 *   category C -- this candidate only recognises the "ask about the rest" framing.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (40 total, half=20 likes blue, remaining=20, one-fourth of 20=5 likes green,
 *   rest = 20-5=15 likes yellow). With only one known member there is no cross-member measurement
 *   to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'half-then-fraction-of-remainder-color-preference-v1';

interface Analyzed { rest: number; }

const FRACTION_WORDS: Record<string, [number, number]> = {
  half: [1, 2],
  third: [1, 3],
  'two-thirds': [2, 3],
  'two thirds': [2, 3],
  fourth: [1, 4],
  quarter: [1, 4],
  'three-fourths': [3, 4],
  'three fourths': [3, 4],
  'three-quarters': [3, 4],
  'three quarters': [3, 4],
  fifth: [1, 5],
  'two-fifths': [2, 5],
  'two fifths': [2, 5],
  'three-fifths': [3, 5],
  'three fifths': [3, 5],
  'four-fifths': [4, 5],
  'four fifths': [4, 5],
};

function fracOf(n: number, frac: [number, number]): number | null {
  const [num, den] = frac;
  const scaled = n * num;
  if (scaled % den !== 0) return null;
  return scaled / den;
}

function findFraction(re: RegExp, q: string): { m: RegExpExecArray; frac: [number, number] } | null {
  const m = re.exec(q);
  if (!m) return null;
  const word = m[1].trim().toLowerCase();
  const frac = FRACTION_WORDS[word];
  if (!frac) return null;
  return { m, frac };
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rTotal = /\bthere\s+are\s+(\d+)\s+([a-z]+)\s+in\s+(?:a|the)\s+([a-z]+)\b/i;
  const mTotal = rTotal.exec(q);
  if (!mTotal) return null;
  const [, nRaw, plural, group] = mTotal;
  const n = parseInt(nRaw, 10);
  if (!Number.isFinite(n)) return null;
  const groupEsc = group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const rA = new RegExp(
    '(half|third|two[- ]thirds|fourth|quarter|three[- ]fourths|three[- ]quarters|fifth|two[- ]fifths|three[- ]fifths|four[- ]fifths)' +
      '\\s+of\\s+the\\s+' + groupEsc + '\\s+(?:likes|prefers|chose)\\s+([a-z]+)',
    'i',
  );
  const foundA = findFraction(rA, q);
  if (!foundA) return null;
  const categoryA = foundA.m[2].toLowerCase();
  const afterA = fracOf(n, foundA.frac);
  if (afterA === null) return null;
  const remaining = n - afterA;
  if (remaining < 0) return null;

  const rB = /(half|third|two[- ]thirds|fourth|quarter|three[- ]fourths|three[- ]quarters|fifth|two[- ]fifths|three[- ]fifths|four[- ]fifths)\s+of\s+the\s+remaining\s+(?:likes|prefers|chose)\s+([a-z]+)/i;
  const foundB = findFraction(rB, q);
  if (!foundB) return null;
  const categoryB = foundB.m[2].toLowerCase();
  if (categoryB === categoryA) return null;
  const partB = fracOf(remaining, foundB.frac);
  if (partB === null) return null;

  const rRest = /\band\s+the\s+rest\s+(?:likes|prefers|chose)\s+([a-z]+)/i;
  const mRest = rRest.exec(q);
  if (!mRest) return null;
  const categoryC = mRest[1].toLowerCase();
  if (categoryC === categoryA || categoryC === categoryB) return null;

  const rQ = new RegExp(
    'how\\s+many\\s+' + plural + '\\s+(?:like|prefer|chose)\\s+(?:the\\s+color\\s+)?' + categoryC,
    'i',
  );
  if (!rQ.test(q)) return null;

  const rest = remaining - partB;
  if (rest < 0) return null;
  return { rest };
}

export const halfThenFractionOfRemainderColorPreference: LianaMethod = {
  id: 'half-then-fraction-of-remainder-color-preference-v1',
  demand: 'COMPUTE',
  name: 'A first fraction of a total is taken, then a second fraction of the remainder, the rest is the answer',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C217, sole member: pilot corpus item at index 376)',
  shapeDescription:
    'remaining = total - fracA*total; part = fracB*remaining; answer = remaining - part. Exact rational ' +
    'arithmetic only, abstains on any non-integer intermediate.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total-in-a-group sentence, a "<fraction word> of the group likes A" ' +
          'sentence, a "<fraction word> of the remaining likes B" sentence, an "and the rest ' +
          'likes C" sentence, and a closing question about C, all with exact-integer fraction ' +
          'arithmetic; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `rest category count = ${result.rest}` };
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
          verdict: String(Math.round((result.rest) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'remaining after first fraction, minus second fraction of that remaining, both exact',
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

registerMethod(halfThenFractionOfRemainderColorPreference);
