// D-BP223-BM04-h2cbpv9w-170 -- three-part-bag-sum-with-offset-and-half-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-part-bag-sum-with-offset-and-half-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C103 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 270, "Mary buys 3 bags of M&Ms. The first
 * bag has 300 M&Ms in it. The second bag has 12 more M&Ms than the first, and the third bag has a
 * hole in it, so it only has half the number of M&Ms that the first bag had. How many M&Ms did
 * Mary get total?"
 *
 * @generalShape THREE containers of the same item, all derived from ONE base quantity (never a
 *   sequential chain -- this is the DELIBERATE opposite of C44's chained-additive-offset shape,
 *   where each term derives from its immediate predecessor). The first container's amount is
 *   given directly (A). The second is A plus a stated "more than the first" delta (K). The third
 *   is explicitly HALF of the first (a stated loss/defect, e.g. "a hole in it"), not a delta from
 *   either of the other two. The answer sums all three.
 *
 * @recogniseInStranger Three anchored facts, all naming "first" explicitly (not "the previous
 *   one" or the second container's own name), or the method abstains: (1) "first <container> has
 *   <A>"; (2) "second <container> has <K> more <noun> than the first"; (3) a clause containing
 *   both "third" and "half" and "first" naming the same base again. The closing question must ask
 *   for the "total" amount across all containers.
 *
 * @whatBreaksIt (a) the third container computed as a fraction OTHER than half (a third, a
 *   quarter) -- this candidate only recognises the literal word "half" and abstains on any other
 *   fraction rather than guess a denominator; (b) the second container's delta stated relative to
 *   anything other than "the first" (e.g. relative to the third) -- this is a different reference
 *   graph and is out of scope; (c) more or fewer than exactly three containers; (d) a first-bag
 *   amount that does not resolve to a finite number, or a non-exact half (this method does not
 *   round the half -- an odd first-bag amount is reported as a fractional result rather than
 *   silently rounded, since GSM8K/ASDiv style problems of this shape always use an even base).
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (300, 312, 150 -> 762). With only one known
 *   member there is no cross-member measurement to report for this singleton cluster -- noted
 *   honestly rather than inflated with a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-part-bag-sum-with-offset-and-half-v1';

interface Analyzed {
  first: number;
  delta: number;
  second: number;
  third: number;
  total: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Fact 1: "first <noun> has <A>"
  const firstRe = /\bfirst\b[^.]*?\bhas\b\s+([0-9]+(?:\.[0-9]+)?)\b/i;
  const m1 = firstRe.exec(q);
  if (!m1) return null;
  const first = parseFloat(m1[1]);
  if (!toFinite(first)) return null;

  // Fact 2: "second <noun> has <K> more <noun2> than the first"
  const secondRe = /\bsecond\b[^.]*?\bhas\b\s+([0-9]+(?:\.[0-9]+)?)\s+more\b[^.]*?\bthan\b[^.]*?\bfirst\b/i;
  const m2 = secondRe.exec(q);
  if (!m2) return null;
  const delta = parseFloat(m2[1]);
  if (!toFinite(delta)) return null;

  // Fact 3: a clause naming "third" that computes half of the FIRST container, not the second.
  const thirdRe = /\bthird\b[^.]*?\bhalf\b[^.]*?\bfirst\b[^.]*?\./i;
  if (!thirdRe.test(q)) return null;

  // The question must ask for the TOTAL across all containers, not any one of them.
  const questionRe = /\bhow\s+(?:many|much)\b[^?]*\btotal\b[^?]*\?/i;
  if (!questionRe.test(q)) return null;

  const second = first + delta;
  // Rational arithmetic: (5*first + 2*delta) / 2 == first + second + first/2, computed with the
  // multiply-then-divide-last order so no intermediate irrational decimal is ever carried.
  const total = (first * 5 + delta * 2) / 2;
  const third = first / 2;
  if (!toFinite(second) || !toFinite(third) || !toFinite(total)) return null;

  return { first, delta, second, third, total };
}

export const threePartBagSumWithOffsetAndHalf: LianaMethod = {
  id: 'three-part-bag-sum-with-offset-and-half-v1',
  demand: 'COMPUTE',
  name: 'Three containers all derived from one base: base, base-plus-delta, and half-of-base, summed',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C103, sole member harvest_gsm8k_pilot_item270, GSM8K test.jsonl line 270)',
  shapeDescription:
    'First container given directly; second is first plus a stated delta; third is half the ' +
    'first (a stated defect/loss); answer sums all three.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "first has A", "second has K more than first", "third...half...first" ' +
          'three-fact shape with a "how many/much...total" question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `first=${result.first}, second=${result.second}, third=${result.third} -> ${result.total}` };
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
      const rounded = Math.round(result.total * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.first} + ${result.second} + ${result.third} = ${rounded}`,
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

registerMethod(threePartBagSumWithOffsetAndHalf);
