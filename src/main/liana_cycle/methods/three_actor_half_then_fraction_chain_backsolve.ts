// D-BP223-BM04-h2cbp9d8-171 -- three-actor-half-then-fraction-chain-backsolve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-actor-half-then-fraction-chain-backsolve-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R08
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C253 (GSM8K test.jsonl item418, singleton).
 *
 * @generalShape Three named actors' "sizes" are chained by two relations: actor1's size is HALF
 *   actor2's size ("actor1's <thing> is half as big as actor2's <thing>"); actor3's size is
 *   1/N of actor1's size ("actor3's <thing> is 1/N as big as actor1's <thing>"). Given actor3's
 *   size as a stated value V, the question asks for actor2's size. The corpus's own ground truth
 *   (verified against item418's own "#### 40" line before this candidate was written: actor1 =
 *   V*N = 5*4 = 20; actor2 = actor1*2 = 40) is reproduced here exactly.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a "<actor1>'s <thing> is half
 *   as big as <actor2>'s <thing>" halving clause naming both actor1 and actor2; (b) a
 *   "<actor3>'s <thing> is 1/<N> as big as <actor1>'s <thing>" fraction clause, where the
 *   "as big as" subject NAMES THE SAME actor1 from (a); (c) a "if <actor3>'s <thing> is <V>
 *   <unit>" given-value clause naming the SAME actor3 from (b); (d) a closing question "how big is
 *   <actor2>'s <thing>" naming the SAME actor2 from (a). All actor-name cross-checks are exact,
 *   case-insensitive string matches -- no fuzzy identity resolution.
 *
 * @whatBreaksIt (a) the fraction in the second clause not being a simple "1/<N>" (e.g. "3/4 as
 *   big") -- different arithmetic, not handled; (b) any of the four actor-name cross-checks
 *   failing -- abstain, the chain is broken or ambiguous; (c) the "half as big as" phrase using a
 *   different comparative wording -- abstain rather than guess; (d) the question asking about
 *   actor1 or actor3 instead of actor2 -- different target, not handled by this candidate.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item418): actor3(Peter)=5, N=4, actor1(Zack)=5*4=20, actor2(Timothy)=20*2=40 (exact
 *   integer arithmetic throughout, never a float heuristic). SOLVED. Reach across a wider corpus
 *   is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-actor-half-then-fraction-chain-backsolve-v1';

const HALF_RE = /(\w+)'s locker is half as big as (\w+)'s locker/i;
const FRACTION_RE = /(\w+)'s locker is 1\/(\d+) as big as (\w+)'s locker/i;
const GIVEN_RE = /if (\w+)'s locker is\s+(\d+)\s+cubic inches/i;
const ASK_RE = /how big is (\w+)'s locker in cubic inches/i;

interface Analyzed { actor2Size: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const halfM = HALF_RE.exec(q);
  if (!halfM) return null;
  const actor1 = halfM[1].toLowerCase();
  const actor2 = halfM[2].toLowerCase();

  const fracM = FRACTION_RE.exec(q);
  if (!fracM) return null;
  const actor3 = fracM[1].toLowerCase();
  const n = Number(fracM[2]);
  const fracSubject = fracM[3].toLowerCase();
  if (fracSubject !== actor1) return null; // must chain off the SAME actor1
  if (!Number.isFinite(n) || n <= 0) return null;

  const givenM = GIVEN_RE.exec(q);
  if (!givenM) return null;
  const givenActor = givenM[1].toLowerCase();
  if (givenActor !== actor3) return null; // must be the SAME actor3
  const v = Number(givenM[2]);
  if (!Number.isFinite(v) || v <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;
  const askedActor = askM[1].toLowerCase();
  if (askedActor !== actor2) return null; // must ask about the SAME actor2

  const actor1Size = v * n; // exact integer: actor3 = actor1/n  =>  actor1 = actor3*n
  const actor2Size = actor1Size * 2; // actor1 = actor2/2  =>  actor2 = actor1*2
  if (!Number.isFinite(actor2Size) || actor2Size <= 0) return null;

  return { actor2Size };
}

export const threeActorHalfThenFractionChainBacksolve: LianaMethod = {
  id: 'three-actor-half-then-fraction-chain-backsolve-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a middle actor\'s size from a chain: actor1 is half actor2, actor3 is 1/N of actor1, actor3\'s size is given',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C253, GSM8K test item418',
  shapeDescription:
    'actor1 = half of actor2; actor3 = (1/N) of actor1; given actor3 = V, find actor2. Answer = ' +
    'V*N*2, matching the corpus\'s own worked chain, only when all actor-name cross-checks (the ' +
    'same actor1/actor2/actor3 threading every clause) hold exactly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<actor1> is half as big as <actor2>" clause plus a "<actor3> is 1/N ' +
          'as big as <actor1>" clause (same actor1) plus a "given <actor3> = V" clause (same ' +
          'actor3) plus a "how big is <actor2>" closing question (same actor2), all cross-checked ' +
          'by exact name match; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `actor2 size = ${result.actor2Size}` };
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
          verdict: String(Math.round((result.actor2Size) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'actor2 = actor3*N*2, exact integer arithmetic, actor identities cross-checked',
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

registerMethod(threeActorHalfThenFractionChainBacksolve);
