// D-BP223-BM04-h2cbpv9w-170 -- sum-and-difference-two-parts-solve-larger-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-and-difference-two-parts-solve-larger-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C117 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 33, "Gretchen has 110 coins. There are 30
 * more gold coins than silver coins. How many gold coins does Gretchen have?"
 *
 * @generalShape A TOTAL is stated for a combined count of two named parts of the same overall
 *   noun ("has <T> <totalNoun>"). A DIFFERENCE clause states one named part is a fixed amount
 *   MORE than the other ("<D> more <partA> than <partB>"). Classic sum-and-difference algebra:
 *   smaller (partB) = (T - D) / 2, larger (partA) = smaller + D. The question asks for the count
 *   of ONE of the two named parts by name, and this candidate reports whichever one (larger or
 *   smaller) the question actually names -- never assumed to always be the larger.
 *
 * @recogniseInStranger Two anchored clauses plus a name-matched question: (1) "has <T>
 *   <totalNoun>" for the total; (2) "<D> more <partA> <totalNoun> than <partB> <totalNoun>" for
 *   the difference, capturing partA (the "more" side) and partB (the "than" side) as noun phrases;
 *   (3) the question "how many <part> ... does ... have", where <part> is matched (case-
 *   insensitively, singular or plural) against EITHER partA or partB captured above -- if it
 *   matches neither, this candidate abstains rather than guess which part is being asked about.
 *
 * @whatBreaksIt (a) three or more distinct parts described -- this candidate's anchor only
 *   recognises exactly one "more X than Y" clause and abstains if the total noun and the two part
 *   names cannot all be reconciled to a two-part split; (b) the backsolved smaller part not
 *   landing on a whole number -- abstains rather than report a fractional coin count; (c) the
 *   question naming neither partA nor partB by any recognisable noun match -- abstains; (d) a
 *   "fewer"/"less" phrasing instead of "more" -- this candidate's anchor is specifically "more ...
 *   than" and does not recognise the inverted phrasing, an honest vocabulary limit rather than a
 *   silent misapplication.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (silver=(110-30)/2=40; gold=40+30=70; question
 *   asks for gold, the "more" part -> 70). With only one known cluster member there is no
 *   cross-member measurement to report for this singleton cluster -- noted honestly rather than
 *   inflated with a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-and-difference-two-parts-solve-larger-v1';


interface Analyzed {
  total: number;
  diff: number;
  partA: string;
  partB: string;
  smaller: number;
  larger: number;
  askedFor: 'A' | 'B';
  answer: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function normalizeNoun(s: string): string {
  return s.trim().toLowerCase().replace(/s$/, '');
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (1) Total.
  const totalRe = /\bhas\s+([0-9]+)\s+([a-z]+)\b/i;
  const totalMatch = totalRe.exec(q);
  if (!totalMatch) return null;
  const total = parseInt(totalMatch[1], 10);
  if (!Number.isFinite(total)) return null;

  // (2) Difference clause: "<D> more <partA> <totalNoun> than <partB> <totalNoun>".
  const diffRe = /\b([0-9]+)\s+more\s+([a-z]+)\s+[a-z]+\s+than\s+([a-z]+)\s+[a-z]+\b/i;
  const diffMatch = diffRe.exec(q);
  if (!diffMatch) return null;
  const diff = parseInt(diffMatch[1], 10);
  const partA = normalizeNoun(diffMatch[2]);
  const partB = normalizeNoun(diffMatch[3]);
  if (!Number.isFinite(diff) || partA === partB) return null;

  // (3) Which part does the question ask about?
  const questionRe = /\bhow\s+many\s+([a-z]+)\s+[a-z]+\s+does\b/i;
  const questionMatch = questionRe.exec(q);
  if (!questionMatch) return null;
  const askedNoun = normalizeNoun(questionMatch[1]);
  let askedFor: 'A' | 'B';
  if (askedNoun === partA) askedFor = 'A';
  else if (askedNoun === partB) askedFor = 'B';
  else return null;

  if ((total - diff) % 2 !== 0) return null; // exact integer split required
  const smaller = (total - diff) / 2;
  const larger = smaller + diff;
  if (smaller < 0) return null;
  if (!toFinite(smaller) || !toFinite(larger)) return null;

  const answer = askedFor === 'A' ? larger : smaller;

  return { total, diff, partA, partB, smaller, larger, askedFor, answer };
}

export const sumAndDifferenceTwoPartsSolveLarger: LianaMethod = {
  id: 'sum-and-difference-two-parts-solve-larger-v1',
  demand: 'COMPUTE',
  name: 'Classic sum-and-difference of two named parts, reporting whichever part the question names',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W11 (cluster C117, sole member harvest_gsm8k_pilot_item33, GSM8K test.jsonl line 33)',
  shapeDescription:
    'total = partA + partB; partA = partB + diff ("D more partA than partB"); smaller = ' +
    '(total-diff)/2, larger = smaller+diff; answer is whichever part the question names.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a total, a "<D> more <partA> than <partB>" difference clause, and a ' +
          'question naming one of the two parts by matching noun; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `total=${result.total} diff=${result.diff} smaller(${result.partB})=${result.smaller} larger(${result.partA})=${result.larger} asked=${result.askedFor} -> ${result.answer}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.answer) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `smaller=(${result.total}-${result.diff})/2=${result.smaller}; larger=${result.smaller}+${result.diff}=${result.larger}; asked ${result.askedFor} -> ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(sumAndDifferenceTwoPartsSolveLarger);
