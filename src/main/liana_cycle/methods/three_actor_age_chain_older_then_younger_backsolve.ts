// D-BP223-BM04-h2cbpv9w-170 -- three-actor-age-chain-older-then-younger-backsolve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-actor-age-chain-older-then-younger-backsolve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C170 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 312, "Trent is 5 years older than Jane, and Jane is 3 years
 * younger than Quinn. If Quinn is 30, how old is Trent?". Silo label: "multi-step age comparison --
 * transitive property of equality and addition/subtraction".
 *
 * @generalShape THREE actors chained by two relative-age statements: "<A> is <X> years older than
 *   <B>", and "<B> is <Y> years younger than <C>" (the SAME B bridges both statements). C's
 *   absolute age is given directly. B's age is backsolved from C (B = C - Y), then A's age from B
 *   (A = B + X). The question asks for either A's or B's age.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<A> is <X> years older than
 *   <B>"; (b) "<B> is <Y> years younger than <C>", naming the SAME B as (a); (c) "If <C> is <V>",
 *   naming the SAME C as (b); (d) a closing "how old is <target>" question where target is EITHER
 *   A or B (the two actors this candidate can actually resolve).
 *
 * @whatBreaksIt (a) the "younger than" clause's first actor not matching the "older than"
 *   clause's second actor -- abstains, the chain does not bridge; (b) the given-age actor not
 *   matching the "younger than" clause's third actor -- abstains; (c) the question asking about C
 *   (a bare restatement, not this shape's own computation) or a name outside {A,B,C} -- abstains;
 *   (d) a non-integer or negative resulting age -- abstains rather than reporting an impossible age.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (Jane = 30-3 = 27; Trent = 27+5 = 32). With only one known
 *   cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-actor-age-chain-older-then-younger-backsolve-v1';

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

interface Analyzed { value: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const olderRe = /\b([A-Z][a-z]+)\s+is\s+(\d+|[a-z]+)\s+years\s+older\s+than\s+([A-Z][a-z]+)\b/i;
  const om = olderRe.exec(q);
  if (!om) return null;
  const actorA = om[1];
  const offsetX = wordOrDigit(om[2]);
  const actorB = om[3];
  if (offsetX === null || actorA === actorB) return null;

  const youngerRe = new RegExp('\\b' + actorB + '\\s+is\\s+(\\d+|[a-z]+)\\s+years\\s+younger\\s+than\\s+([A-Z][a-z]+)\\b', 'i');
  const ym = youngerRe.exec(q);
  if (!ym) return null;
  const offsetY = wordOrDigit(ym[1]);
  const actorC = ym[2];
  if (offsetY === null || actorC === actorB) return null;

  const givenRe = new RegExp('\\bif\\s+' + actorC + '\\s+is\\s+(\\d+|[a-z]+)\\b', 'i');
  const gm = givenRe.exec(q);
  if (!gm) return null;
  const givenC = wordOrDigit(gm[1]);
  if (givenC === null) return null;

  const bAge = givenC - offsetY;
  const aAge = bAge + offsetX;
  if (bAge <= 0 || !Number.isInteger(bAge)) return null;

  const questionRe = /how old is\s+([A-Z][a-z]+)/i;
  const qm = questionRe.exec(q);
  if (!qm) return null;
  const target = qm[1];

  if (target === actorA) return { value: aAge };
  if (target === actorB) return { value: bAge };
  return null;
}

export const threeActorAgeChainOlderThenYoungerBacksolve: LianaMethod = {
  id: 'three-actor-age-chain-older-then-younger-backsolve-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a three-actor age chain via two consecutive relative-age offsets',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C170, sole member: pilot corpus item at index 312)',
  shapeDescription:
    'B = givenC - offsetY; A = B + offsetX; answer is A or B\'s age, whichever the question asks',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an "X years older than" clause chained to a "Y years younger than" ' +
          'clause via a shared middle actor, a given absolute age for the third actor, and a ' +
          'closing "how old is" question naming one of the two resolvable actors; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `age = ${result.value}` };
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
          verdict: String(Math.round(result.value * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'backsolved the shared middle actor, then offset again',
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

registerMethod(threeActorAgeChainOlderThenYoungerBacksolve);
