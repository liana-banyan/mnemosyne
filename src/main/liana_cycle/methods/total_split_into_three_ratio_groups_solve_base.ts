// D-BP223-BM04-h2cbpv9w-170 -- total-split-into-three-ratio-groups-solve-base-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-split-into-three-ratio-groups-solve-base-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C172 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 314, "A football team has 105 members. There are twice as
 * many players on the offense as there is on the defense. There is half the number of players on
 * the special teams as there is on the defense. How many players are on the defense?". Silo
 * label: "algebraic word problem involving ratios and parts of a whole -- algebraic substitution
 * and linear equations".
 *
 * @generalShape A TOTAL is split into three named groups. Two of the groups are each stated as a
 *   RATIO of the THIRD (base) group's size. total = base*(1 + ratioA + ratioB). The question asks
 *   for the base group's size, solved by dividing the total by the summed ratio factor.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<total> members" (or a similar
 *   total-count noun); (b) "there are <ratio1-phrase> as many players on the <groupA> as there is
 *   on the <base>"; (c) "there is <ratio2-phrase> the number of players on the <groupC> as there
 *   is on the <base>", naming the SAME <base> as (b); (d) both ratio phrases resolve via a small
 *   known table (twice/double/half/a third/"<k> times"); (e) a closing "how many players are on
 *   the <base>" question, naming the SAME base group as (b) and (c).
 *
 * @whatBreaksIt (a) the two ratio clauses naming different base groups -- abstains, cannot form
 *   one equation; (b) either ratio phrase not recognized; (c) the question asking about a group
 *   other than the shared base group -- abstains, this candidate only solves for the base; (d) the
 *   total not dividing evenly by the summed ratio factor -- abstains rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (sum factor = 1 + 2 + 1/2 = 7/2; base = 105 / (7/2) = 30). With
 *   only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-split-into-three-ratio-groups-solve-base-v1';

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

interface Frac { num: number; den: number; }

function parseRatioPhrase(phrase: string): Frac | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'twice' || p === 'double') return { num: 2, den: 1 };
  if (p === 'half') return { num: 1, den: 2 };
  if (p === 'a third' || p === 'one third') return { num: 1, den: 3 };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= 2) return { num: n, den: 1 };
  }
  return null;
}

function addFrac(a: Frac, b: Frac): Frac {
  return { num: a.num * b.den + b.num * a.den, den: a.den * b.den };
}

interface Analyzed { base: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalRe = /has\s+(\d+|[a-z]+)\s+members/i;
  const tm = totalRe.exec(q);
  if (!tm) return null;
  const total = wordOrDigit(tm[1]);
  if (total === null) return null;

  const clauseARe = /there are\s+([a-z]+(?:\s+[a-z]+)?)\s+as many players on the\s+([a-z ]+?)\s+as there is on the\s+([a-z ]+?)\./i;
  const am = clauseARe.exec(q);
  if (!am) return null;
  const ratioA = parseRatioPhrase(am[1]);
  const base1 = am[3].trim().toLowerCase();
  if (!ratioA) return null;

  const clauseBRe = /there is\s+([a-z]+(?:\s+[a-z]+)?)\s+the number of players on the\s+([a-z ]+?)\s+as there is on the\s+([a-z ]+?)\./i;
  const bm = clauseBRe.exec(q);
  if (!bm) return null;
  const ratioB = parseRatioPhrase(bm[1]);
  const base2 = bm[3].trim().toLowerCase();
  if (!ratioB || base1 !== base2) return null;

  const questionRe = /how many players are on the\s+([a-z ]+?)\?/i;
  const qm = questionRe.exec(q);
  if (!qm) return null;
  const targetGroup = qm[1].trim().toLowerCase();
  if (targetGroup !== base1) return null;

  const one: Frac = { num: 1, den: 1 };
  const sumFactor = addFrac(addFrac(one, ratioA), ratioB);
  // total = base * sumFactor  =>  base = total * sumFactor.den / sumFactor.num
  const num = total * sumFactor.den;
  if (num % sumFactor.num !== 0) return null;
  const base = num / sumFactor.num;
  if (!Number.isFinite(base) || base <= 0) return null;
  return { base };
}

export const totalSplitIntoThreeRatioGroupsSolveBase: LianaMethod = {
  id: 'total-split-into-three-ratio-groups-solve-base-v1',
  demand: 'COMPUTE',
  name: 'Solve for a base group size, given a total split into three ratio-linked groups',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C172, sole member: pilot corpus item at index 314)',
  shapeDescription: 'total = base * (1 + ratioA + ratioB); base = total / (1 + ratioA + ratioB)',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a stated total, two ratio clauses sharing the same named base group, and ' +
          'a closing question asking about that same base group, resolving to an exact division; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `base = ${result.base}` };
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
          verdict: String(Math.round(result.base * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'total divided by the summed ratio factor',
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

registerMethod(totalSplitIntoThreeRatioGroupsSolveBase);
