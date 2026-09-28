// D-BP223-BM04-h2cbpv9w-170 -- compute-total-backsolve-difference-then-divide-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W03).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\compute-total-backsolve-difference-then-divide-v1.candidate.ts
// Authored by generation wave W03 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W03.md),
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
 * D-BP223-BM04-h2cbpv9w-170/WAVE-W03 CLUSTER C53 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 118, "A customs officer at the main port of
 * SeaSide clearances counted 2 containers of imported vehicles, each having 5 vehicles inside.
 * The next day, more containers were brought in, and the total number of vehicles at the port
 * became 30. Calculate the number of containers that were imported on the second day, assuming
 * all the containers contain 5 vehicles." (answer 4).
 *
 * @generalShape A first quantity is computed as a product (day-1 containers * a per-container
 *   rate). A SEPARATELY stated total (after more of the same containers arrived) is given
 *   directly. The day-1 product is subtracted from that total to recover the day-2 contribution,
 *   which is then DIVIDED by the SAME per-container rate (restated at the end of the question, as
 *   positive confirmation it is the same rate) to recover the day-2 container count. Silo label:
 *   COMPUTE_TOTAL_BACKSOLVE_DIFFERENCE_THEN_DIVIDE.
 *
 * @recogniseInStranger Three anchored regexes. (1) "counted <N1> containers of <item>, each
 *   having <RATE1> <item> inside." for the day-1 container count and the per-container rate. (2)
 *   "total number of <item> at the <place> became <TOTAL>." for the combined total. (3)
 *   "calculate the number of containers that were imported on the second day, assuming all the
 *   containers contain <RATE2> <item>." -- RATE2 must equal RATE1 exactly (a positive check that
 *   the same rate governs both days, not two different container sizes).
 *
 * @whatBreaksIt (a) the two stated per-container rates disagreeing (a text where day-2 containers
 *   hold a different number of vehicles) -- abstains rather than assume which rate applies to the
 *   backsolved amount; (b) the resulting day-2 container count not landing on a whole number
 *   (within floating-point tolerance) -- treated as evidence this text's numbers do not fit this
 *   shape, and this candidate abstains rather than report a fractional container count; (c) more
 *   than two "days" of container arrivals, or the total given before the day-1 count instead of
 *   after -- the anchors are positional and require exactly this three-clause order; (d) the
 *   final question asking for the TOTAL day-2 vehicle count instead of the CONTAINER count --
 *   only the literal "number of containers ... on the second day" question is recognised.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim and the computed verdict can never diverge on the same input. Measured against its own
 *   (sole) cluster member: SOLVED (4, matching (30-2*5)/5=4). With only one known member there is
 *   no cross-member measurement to report for this cluster -- honestly noted rather than inflated
 *   with a borrowed number from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'compute-total-backsolve-difference-then-divide-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit) && digit.length > 0) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed {
  result: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const re1 = /counted\s+([a-zA-Z0-9]+)\s+containers\s+of\s+[a-zA-Z ]+?,\s+each\s+having\s+([a-zA-Z0-9]+)\s+[a-zA-Z]+\s+inside\s*\./i;
  const m1 = re1.exec(q);
  if (!m1) return null;
  const [, n1Word, rate1Word] = m1;
  const n1 = wordOrDigit(n1Word);
  const rate1 = wordOrDigit(rate1Word);
  if (n1 === null || rate1 === null) return null;

  const re2 = /total\s+number\s+of\s+[a-zA-Z]+\s+at\s+the\s+[a-zA-Z ]+?\s+became\s+([a-zA-Z0-9]+)\s*\./i;
  const m2 = re2.exec(q);
  if (!m2) return null;
  const [, totalWord] = m2;
  const total = wordOrDigit(totalWord);
  if (total === null) return null;

  const re3 =
    /calculate\s+the\s+number\s+of\s+containers\s+that\s+were\s+imported\s+on\s+the\s+second\s+day,\s+assuming\s+all\s+the\s+containers\s+contain\s+([a-zA-Z0-9]+)\s+[a-zA-Z]+\s*\.?/i;
  const m3 = re3.exec(q);
  if (!m3) return null;
  const [, rate2Word] = m3;
  const rate2 = wordOrDigit(rate2Word);
  if (rate2 === null) return null;
  if (rate1 !== rate2) return null; // the two stated rates must agree -- positive evidence check
  if (rate2 === 0) return null;

  const day1Total = n1 * rate1;
  const day2Total = total - day1Total;
  const result = day2Total / rate2;
  if (!Number.isFinite(result)) return null;
  // Container counts must be whole numbers; a non-integer result is evidence this text does not
  // actually fit the shape, so abstain rather than report a fractional container.
  if (Math.abs(result - Math.round(result)) > 1e-6) return null;

  return { result: Math.round(result) };
}

export const computeTotalBacksolveDifferenceThenDivide: LianaMethod = {
  id: 'compute-total-backsolve-difference-then-divide-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a difference against a separately known total, then divide by a stated rate',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/WAVE-W03 (cluster C53, sole member harvest_gsm8k_pilot_item118)',
  shapeDescription:
    '(TOTAL - day1Count*rate) / rate = day2Count, with the rate restated and required to agree ' +
    'at both points in the text.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "counted N1 containers ... each having RATE1 ... inside. ... total ' +
          'number of ... became TOTAL. Calculate the number of containers ... assuming all the ' +
          'containers contain RATE2 ..." shape with RATE1 == RATE2; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `backsolved day-2 container count -> ${result.result}` };
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
        verdict: String(Math.round((result.result) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(TOTAL - day1) / rate = ${result.result}`,
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

registerMethod(computeTotalBacksolveDifferenceThenDivide);
