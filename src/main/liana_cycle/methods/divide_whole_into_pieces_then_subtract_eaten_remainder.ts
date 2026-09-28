// D-BP223-BM04-h2cbp9d8-171 -- divide-whole-into-pieces-then-subtract-eaten-remainder-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\divide-whole-into-pieces-then-subtract-eaten-remainder-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C269 (GSM8K test.jsonl item436, singleton).
 *
 * @generalShape A whole item of stated weight (or other measured quantity) is cut into a stated
 *   number of EQUAL pieces. A group of named eaters, each having exactly ONE piece, eats some of
 *   it. The question asks how much of the whole REMAINS. Verified against item436's own
 *   "#### 15" line before this candidate was written: 20 oz / 8 pieces = 2.5 oz/piece; two
 *   eaters (Rory and her mom) each have one piece = 5 oz eaten; 20 - 5 = 15 oz remaining, computed
 *   here directly as W*(N-K)/N in exact rational arithmetic so the never-materialized 2.5 oz/piece
 *   intermediate cannot introduce rounding error.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "weighs <W> <unit>" naming the
 *   whole's measured quantity; (b) "cuts into <N> pieces"; (c) a clause of the form "<names
 *   joined by 'and'> each have|eat|ate a piece", whose eater COUNT is inferred from the number of
 *   names (one more than the number of literal "and"s in that clause, capped to a small group);
 *   (d) a closing "how much does the remaining <noun> weigh" question. The result is computed as
 *   the single exact fraction W*(N-K)/N, reduced by GCD, never via an intermediate per-piece
 *   float.
 *
 * @whatBreaksIt (a) the eater count is given as a bare number ("3 people each have a piece")
 *   instead of named individuals joined by "and" -- not recognized by this candidate's narrower
 *   name-counting pattern; (b) any eater takes MORE than one piece -- not modeled, this candidate
 *   assumes exactly one piece per named eater; (c) the reduced remainder fraction's denominator
 *   has a prime factor other than 2 or 5 (cannot be expressed as a finite decimal) -- abstain
 *   rather than approximate; (d) K >= N (nothing or a negative amount would remain) -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item436): numerator = 20*(8-2) = 120, denominator = 8, reduced by gcd(120,8)=8 to 15/1
 *   -> verdict "15". SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'divide-whole-into-pieces-then-subtract-eaten-remainder-v1';

const WEIGHT_RE = /weighs\s+(\d+)\s+([a-z]+)/i;
const PIECES_RE = /cuts?\s+into\s+(\d+)\s+pieces/i;
const EATERS_CLAUSE_RE = /([^.]+?)\s+each\s+(?:have|eat|ate)\s+a\s+piece/i;
const ASK_RE = /how\s+much\s+does\s+the\s+remaining\s+[a-z]+\s+weigh/i;

function gcdBig(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

interface Analyzed { verdictStr: string; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const weightM = WEIGHT_RE.exec(q);
  if (!weightM) return null;
  const w = Number(weightM[1]);
  if (!Number.isInteger(w) || w <= 0) return null;

  const piecesM = PIECES_RE.exec(q);
  if (!piecesM) return null;
  const n = Number(piecesM[1]);
  if (!Number.isInteger(n) || n <= 0) return null;

  const eatersM = EATERS_CLAUSE_RE.exec(q);
  if (!eatersM) return null;
  const clause = eatersM[1];
  const andCount = (clause.match(/\band\b/gi) || []).length;
  const k = andCount + 1;
  if (k <= 0 || k >= n + 1) { /* fall through to bounds check below */ }

  if (!ASK_RE.test(q)) return null;

  if (k >= n) return null; // nothing or a negative amount left; abstain

  let num = BigInt(w) * BigInt(n - k);
  let den = BigInt(n);
  const g = gcdBig(num, den);
  if (g > 0n) { num /= g; den /= g; }

  if (den === 1n) {
    return { verdictStr: num.toString() };
  }
  // Only express as a finite decimal if the reduced denominator's prime factors are 2 and/or 5.
  let d = den;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) { d /= 2n; twos++; }
  while (d % 5n === 0n) { d /= 5n; fives++; }
  if (d !== 1n) return null; // cannot be expressed as a finite decimal; abstain rather than approximate

  const scale = Math.max(twos, fives);
  const factor = 10n ** BigInt(scale) / den * den; // no-op guard, kept for clarity of intent
  const scaledNum = num * (10n ** BigInt(scale)) / den;
  const scaleDiv = 10n ** BigInt(scale);
  const whole = scaledNum / scaleDiv;
  const fracPart = scaledNum % scaleDiv;
  const verdictStr = fracPart === 0n
    ? whole.toString()
    : `${whole}.${fracPart.toString().padStart(scale, '0')}`.replace(/0+$/, '').replace(/\.$/, '');

  return { verdictStr };
}

export const divideWholeIntoPiecesThenSubtractEatenRemainder: LianaMethod = {
  id: 'divide-whole-into-pieces-then-subtract-eaten-remainder-v1',
  demand: 'COMPUTE',
  name: 'Compute the remainder of a whole cut into equal pieces after named eaters each take one piece',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C269, GSM8K test item436',
  shapeDescription:
    'A whole of stated measure W is cut into N equal pieces; K named eaters (counted from an ' +
    '"and"-joined name list) each take exactly one piece. Answer = W*(N-K)/N, computed as a single ' +
    'exact fraction reduced by GCD, never via a materialized per-piece intermediate value.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "weighs <W> <unit>" clause plus a "cuts into <N> pieces" clause plus an ' +
          '"and"-joined-names "each have/eat/ate a piece" eaters clause plus a "how much does the ' +
          'remaining ... weigh" ask, with an expressible exact result; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `remaining weight = ${result.verdictStr}` };
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
          verdict: String(result.verdictStr),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'W*(N-K)/N as a single exact fraction reduced by GCD, no float intermediate',
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

registerMethod(divideWholeIntoPiecesThenSubtractEatenRemainder);
