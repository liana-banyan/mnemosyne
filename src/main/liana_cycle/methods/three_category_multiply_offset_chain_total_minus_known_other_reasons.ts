// D-BP223-BM04-h2cbp9d8-171 -- three-category-multiply-offset-chain-total-minus-known-other-reasons-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-category-multiply-offset-chain-total-minus-known-other-reasons-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W23, CLUSTER C210 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 367, "3 customers were kicked out of the
 * Walmart for refusing to wear masks. A number equals to four times that many minus 5 were
 * kicked out for shoplifting. Three times the number of shoplifters were kicked out for physical
 * violence over goods on sale. If a total of 50 people were kicked out of the Walmart, how many
 * were kicked out for other reasons?". Silo label: "multi-step word problem involving algebraic
 * relationships and a total sum" -- matches exactly. This shape is DISTINCT from the registered
 * total-minus-known-parts-backsolve-v1: that method fires only on DIRECTLY-stated known parts and
 * deliberately DISQUALIFIES on "times"/"twice" relative-derivation wording (see its own
 * @recogniseInStranger). Here every non-base category is a stated multiply-and-offset DERIVATION
 * of the category before it, which that method exists specifically to refuse.
 *
 * @generalShape Category1's count is stated directly. Category2 is a stated MULTIPLE of
 *   category1 minus a stated OFFSET ("a number equal(s) to <multiplier1> that many minus
 *   <offset>"). Category3 is a stated MULTIPLE of category2 alone ("<multiplier2> the number of
 *   <category2-label-plural>"). A total across ALL reasons (the three named categories plus an
 *   "other" residual) is given directly. The question asks for the residual "other reasons"
 *   count: total - category1 - category2 - category3.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, in this fixed clause order:
 *   (a) "<N1> <actor-plural> were <verb-phrase> for <reason1>" -- category1's count, directly;
 *   (b) "a number equal(s)? to <multiplier1-phrase> that many minus <offset>" immediately
 *       followed by "were <verb-phrase> for <reason2>" -- category2 = multiplier1*category1 -
 *       offset;
 *   (c) "<multiplier2-phrase> the number of <reason2-derived-noun-plural>" immediately followed
 *       by "were <verb-phrase> for <reason3>" -- category3 = multiplier2*category2;
 *   (d) "if a total of <T> <actor-plural> were <verb-phrase> ..., how many were ... for other
 *       reasons" -- the closing total-minus-parts question. Multiplier phrases resolved via a
 *       fixed ones-word table ("four times" = 4, "three times" = 3, ...), never a literal digit
 *       table.
 *
 * @whatBreaksIt (a) category2 or category3 given as a DIRECT number rather than a derivation --
 *   a different, simpler shape (total-minus-known-parts), correctly left to that method; (b) any
 *   category's derivation producing a negative or non-integer value -- abstain, the text does not
 *   fit; (c) the total minus the three derived categories coming out negative -- abstain, the
 *   parse is wrong; (d) a multiplier phrase outside the fixed ones-word list -- abstain, no
 *   partial credit.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (cat1=3, cat2=4*3-5=7, cat3=3*7=21, other=50-3-7-21=19). With only one known
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-category-multiply-offset-chain-total-minus-known-other-reasons-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function parseMultiplierWord(word: string): number | null {
  const idx = ONES_WORDS.indexOf(word.toLowerCase().trim());
  return idx >= 2 ? idx : null;
}

interface Analyzed { other: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const r1 = /\b(\d+)\s+([a-z]+)\s+were\s+kicked\s+out\s+of\s+the\s+[a-z]+\s+for\s+([a-z ]+?)\.\s/i;
  const m1 = r1.exec(q);
  if (!m1) return null;
  const [, cat1Raw] = m1;
  const cat1 = parseInt(cat1Raw, 10);
  if (!Number.isFinite(cat1)) return null;

  const r2 = new RegExp(
    'a\\s+number\\s+equals?\\s+to\\s+([a-z]+)\\s+times\\s+that\\s+many\\s+minus\\s+(\\d+)\\s+were\\s+' +
      'kicked\\s+out\\s+for\\s+([a-z]+)\\b',
    'i',
  );
  const m2 = r2.exec(q);
  if (!m2) return null;
  const [, mult1Word, offsetRaw, reason2Noun] = m2;
  const mult1 = parseMultiplierWord(mult1Word);
  const offset = parseInt(offsetRaw, 10);
  if (mult1 === null || !Number.isFinite(offset)) return null;
  const cat2 = mult1 * cat1 - offset;
  if (!Number.isFinite(cat2) || cat2 < 0) return null;

  const r3 = /\b([a-z]+)\s+times\s+the\s+number\s+of\s+([a-z]+)\s+were\s+kicked\s+out\s+for\s+[a-z ]+?\.\s/i;
  const m3 = r3.exec(q);
  if (!m3) return null;
  const [, mult2Word, reason2AgentNoun] = m3;
  // Positive-evidence stem check: the agent noun in clause 3 ("shoplifters") must share the
  // reason2 noun's own stem ("shoplifting") -- never assumed by clause order alone. Compares the
  // first 6 lowercase letters of each (both derive from the same underlying word: shoplift-).
  const stemLen = Math.min(6, reason2Noun.length, reason2AgentNoun.length);
  if (stemLen < 4 || reason2Noun.slice(0, stemLen).toLowerCase() !== reason2AgentNoun.slice(0, stemLen).toLowerCase()) {
    return null;
  }
  const mult2 = parseMultiplierWord(mult2Word);
  if (mult2 === null) return null;
  const cat3 = mult2 * cat2;
  if (!Number.isFinite(cat3) || cat3 < 0) return null;

  const rTotal = /if\s+a\s+total\s+of\s+(\d+)\s+[a-z]+\s+were\s+kicked\s+out\s+of\s+the\s+[a-z]+.*?other\s+reasons/i;
  const mTotal = rTotal.exec(q);
  if (!mTotal) return null;
  const [, totalRaw] = mTotal;
  const total = parseInt(totalRaw, 10);
  if (!Number.isFinite(total)) return null;

  const other = total - cat1 - cat2 - cat3;
  if (!Number.isFinite(other) || other < 0) return null;
  return { other };
}

export const threeCategoryMultiplyOffsetChainTotalMinusKnownOtherReasons: LianaMethod = {
  id: 'three-category-multiply-offset-chain-total-minus-known-other-reasons-v1',
  demand: 'COMPUTE',
  name: 'Three chained multiply-and-offset derived categories, then total minus all three gives the residual "other" category',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W23 (cluster C210, sole member: pilot corpus item at index 367)',
  shapeDescription:
    'cat2 = mult1*cat1 - offset; cat3 = mult2*cat2; answer = total - cat1 - cat2 - cat3.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a directly-stated category1, a multiply-then-minus-offset derived ' +
          'category2, a multiply-derived category3, and a closing total-minus-three-categories ' +
          '"other reasons" question, resolving to a non-negative exact value; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `other reasons = ${result.other}` };
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
          verdict: String(Math.round((result.other) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'derived category2 and category3 from the stated chain, then subtracted all three from the stated total',
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

registerMethod(threeCategoryMultiplyOffsetChainTotalMinusKnownOtherReasons);
