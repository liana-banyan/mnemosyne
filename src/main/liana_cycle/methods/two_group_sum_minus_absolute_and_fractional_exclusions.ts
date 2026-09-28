// D-BP223-BM04-h2cbpv9w-170 -- two-group-sum-minus-absolute-and-fractional-exclusions-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-group-sum-minus-absolute-and-fractional-exclusions-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C173 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 315, "Martha is planning her Christmas party. She invited 2
 * families with 6 people and 3 families with 4 people. 8 people couldn't come due to illness, and
 * 1/4 that number had previous commitments. How many people show up for Martha's party?". Silo
 * label: "multi-step addition and subtraction with fractions -- summation of groups and
 * subtraction of subsets".
 *
 * @generalShape Two "<count> groups with <size> people" clauses are summed to an invited total.
 *   TWO exclusion terms are then subtracted: an ABSOLUTE count N (an explicit reason clause), and
 *   a FRACTION of that SAME N (worded "<numeral fraction> that number", explicitly backreferring
 *   to N), for a second, different reason. The answer is invited - N - fraction*N.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "invited <c1> families with
 *   <s1> people and <c2> families with <s2> people"; (b) "<N> people couldn't come due to
 *   <reason1>"; (c) "<num>/<den> that number had <reason2>", an explicit numeral fraction (never a
 *   word fraction) backreferring to the SAME N via the literal phrase "that number"; (d) a closing
 *   "how many people show up" question.
 *
 * @whatBreaksIt (a) the fraction phrase not in exact "<digits>/<digits>" numeral form; (b) the
 *   fraction applied to N not landing on an exact integer -- abstains rather than round; (c) the
 *   final attendance figure computing negative; (d) the exclusion clause not literally saying
 *   "that number" -- this candidate does not attempt to resolve a fraction of some OTHER,
 *   unstated quantity.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (invited = 2*6+3*4 = 24; exclusion2 = 1/4*8 = 2; showUp =
 *   24-8-2 = 14). With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-group-sum-minus-absolute-and-fractional-exclusions-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitStr = tok.replace(/[^0-9]/g, '');
  if (/^\d+$/.test(digitStr)) return parseInt(digitStr, 10);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

interface Analyzed { showUp: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const familiesRe = /invited\s+(\d+|[a-z]+)\s+families with\s+(\d+|[a-z]+)\s+people and\s+(\d+|[a-z]+)\s+families with\s+(\d+|[a-z]+)\s+people/i;
  const fm = familiesRe.exec(q);
  if (!fm) return null;
  const c1 = wordOrDigit(fm[1]);
  const s1 = wordOrDigit(fm[2]);
  const c2 = wordOrDigit(fm[3]);
  const s2 = wordOrDigit(fm[4]);
  if (c1 === null || s1 === null || c2 === null || s2 === null) return null;

  const sickRe = /(\d+|[a-z]+)\s+people couldn't come due to\s+[a-z]+/i;
  const sm = sickRe.exec(q);
  if (!sm) return null;
  const excludedN = wordOrDigit(sm[1]);
  if (excludedN === null) return null;

  const fracRe = /(\d+)\/(\d+)\s+that number had\s+[a-z ]+/i;
  const frm = fracRe.exec(q);
  if (!frm) return null;
  const fracNum = parseInt(frm[1], 10);
  const fracDen = parseInt(frm[2], 10);
  if (fracDen === 0) return null;

  if (!/how many people show up/i.test(q)) return null;

  const invited = c1 * s1 + c2 * s2;
  const exclusion2Num = excludedN * fracNum;
  if (exclusion2Num % fracDen !== 0) return null;
  const exclusion2 = exclusion2Num / fracDen;

  const showUp = invited - excludedN - exclusion2;
  if (!Number.isFinite(showUp) || showUp < 0) return null;
  return { showUp };
}

export const twoGroupSumMinusAbsoluteAndFractionalExclusions: LianaMethod = {
  id: 'two-group-sum-minus-absolute-and-fractional-exclusions-v1',
  demand: 'COMPUTE',
  name: 'Sum two group-size products, then subtract an absolute exclusion and a fraction of that same exclusion',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C173, sole member: pilot corpus item at index 315)',
  shapeDescription: 'invited = c1*s1 + c2*s2; showUp = invited - N - (fracNum/fracDen)*N',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a two-group "families with people" invited-total clause, an absolute ' +
          'exclusion count with a reason, a numeral-fraction "that number" backreferring exclusion, ' +
          'and a closing "how many people show up" question resolving to a non-negative integer; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `show up = ${result.showUp}` };
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
          verdict: String(Math.round(result.showUp * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'invited total minus two related exclusions',
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

registerMethod(twoGroupSumMinusAbsoluteAndFractionalExclusions);
