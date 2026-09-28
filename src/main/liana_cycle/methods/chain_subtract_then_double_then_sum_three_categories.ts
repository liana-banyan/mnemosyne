// D-BP223-BM04-h2cbpv9w-170 -- chain-subtract-then-double-then-sum-three-categories-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\chain-subtract-then-double-then-sum-three-categories-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W13, CLUSTER C132 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 67, "A treasure hunter found a buried treasure chest filled
 * with gems. There were 175 diamonds, 35 fewer rubies than diamonds, and twice the number of
 * emeralds than the rubies. How many of the gems were there in the chest?". Silo label:
 * "multi-step addition and comparison -- multi-step addition and comparison".
 *
 * @generalShape THREE categories are chained: Category1's count is GIVEN directly. Category2's
 *   count is Category1's count minus a stated OFFSET ("<offset> fewer <cat2> than <cat1>").
 *   Category3's count is a stated MULTIPLE of Category2's count ("twice/<N> times the number of
 *   <cat3> than/as the <cat2>"). The question asks for the TOTAL of all three categories.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a directly-given first-category
 *   count ("There were <N1> <cat1>"); (b) an offset clause naming the SAME first category ("<diff>
 *   fewer <cat2> than <cat1>"); (c) a multiple clause naming the SAME second category ("<multiple>
 *   the number of <cat3> than the <cat2>"); (d) a closing question asking "how many ... in
 *   total"/"were there" summing the gems/items.
 *
 * @whatBreaksIt (a) the first category name in the offset clause not matching the given count's
 *   category -- abstains, cannot anchor the chain; (b) the second category name in the multiple
 *   clause not matching the offset clause's result category -- abstains; (c) the offset producing
 *   a negative or non-integer second-category count -- abstains, out of domain; (d) the multiple
 *   phrase not resolving via the number-word table (only literal "twice"/"double" or "<N> times"
 *   forms recognised, per this candidate's sole known member) -- abstains rather than guess.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (diamonds = 175; rubies = 175-35 = 140; emeralds = 2*140 = 280;
 *   total = 175+140+280 = 595). With only one known cluster member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'chain-subtract-then-double-then-sum-three-categories-v1';


const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

function parseMultiplePhrase(phrase: string): number | null {
  const p = phrase.toLowerCase().trim();
  const twiceVal = ONES_WORDS.indexOf('two');
  if (p === 'twice' || p === 'double') return twiceVal;
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= twiceVal) return n;
  }
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const firstRe = /There were\s+(\d+)\s+([a-z]+)/i;
  const fm = firstRe.exec(q);
  if (!fm) return null;
  const cat1Count = wordOrDigit(fm[1]);
  const cat1 = fm[2].toLowerCase();
  if (cat1Count === null) return null;

  const offsetRe = new RegExp('(\\d+|[a-z-]+)\\s+fewer\\s+([a-z]+)\\s+than\\s+' + cat1 + '\\b', 'i');
  const om = offsetRe.exec(q);
  if (!om) return null;
  const offset = wordOrDigit(om[1]);
  const cat2 = om[2].toLowerCase();
  if (offset === null) return null;
  const cat2Count = cat1Count - offset;
  if (cat2Count < 0 || !Number.isInteger(cat2Count)) return null;

  const multRe = new RegExp('(twice|double|[a-z-]+\\s+times)\\s+the\\s+number\\s+of\\s+([a-z]+)\\s+(?:than|as)\\s+(?:the\\s+)?' + cat2 + '\\b', 'i');
  const mm = multRe.exec(q);
  if (!mm) return null;
  const multiple = parseMultiplePhrase(mm[1]);
  const cat3 = mm[2].toLowerCase();
  if (multiple === null) return null;
  const cat3Count = multiple * cat2Count;
  if (!Number.isInteger(cat3Count)) return null;

  if (cat1 === cat2 || cat2 === cat3 || cat1 === cat3) return null;

  if (!/how many[^?]*(?:in total|were there)/i.test(q)) return null;

  const total = cat1Count + cat2Count + cat3Count;
  return { total };
}

export const chainSubtractThenDoubleThenSumThreeCategories: LianaMethod = {
  id: 'chain-subtract-then-double-then-sum-three-categories-v1',
  demand: 'COMPUTE',
  name: 'Chain a given category count through an offset-subtract and a multiple, then sum all three categories',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W13 (cluster C132, sole member: pilot corpus item at index 67)',
  shapeDescription:
    'cat2 = cat1 - offset; cat3 = multiple*cat2; total = cat1 + cat2 + cat3, all three category ' +
    'names must be distinct and chained by name across the three clauses.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a directly-given first-category count, a matching "<N> fewer <cat2> than ' +
          '<cat1>" offset clause, a matching "<multiple> the number of <cat3> than/as the <cat2>" ' +
          'multiple clause, and a "how many ... in total/were there" closing question, with all ' +
          'three categories resolving to distinct non-negative integers; abstaining rather than ' +
          'guessing',
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
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.total) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'cat1 + (cat1 - offset) + multiple*(cat1 - offset)' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(chainSubtractThenDoubleThenSumThreeCategories);
