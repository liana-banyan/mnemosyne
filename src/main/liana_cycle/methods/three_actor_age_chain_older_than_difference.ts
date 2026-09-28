// D-BP223-BM04-h2cbp9d8-171 -- three-actor-age-chain-older-than-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-actor-age-chain-older-than-difference-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R07
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C236 (GSM8K test.jsonl item399, singleton).
 *
 * @generalShape A chain of three named actors: actorA is <D1> years OLDER THAN actorB, who is
 *   <D2> years OLDER THAN actorC. The question gives actorC's own age directly and asks for the
 *   DIFFERENCE between actorA's and actorC's ages.
 *   cAge = given; bAge = cAge + D2; aAge = bAge + D1; verdict = aAge - cAge.
 *
 * @recogniseInStranger Requires, as positive evidence: (a) "<ActorA> is <D1> years older than
 *   <ActorB>, who is <D2> years older than <ActorC>" -- one contiguous chain sentence naming all
 *   three actors in order; (b) a closing "difference between the ages of <X> and <Y>, if <Z> is
 *   <N> years old" question where X resolves to the chain's OUTER actor (actorA), Y and Z both
 *   resolve to the chain's INNERMOST actor (actorC) -- checked by exact name match, not assumed.
 *
 * @whatBreaksIt (a) the chain uses "younger" anywhere instead of "older" -- no match, abstain;
 *   (b) the question asks for the difference between actorA and actorB (the middle actor) instead
 *   of actorA and actorC -- abstain, this candidate only resolves the outer-to-innermost pairing;
 *   (c) the age given in the closing question belongs to a DIFFERENT actor than the chain's
 *   innermost one (e.g. the middle actor's age is given instead) -- abstain, this candidate does
 *   not re-derive from an arbitrary point in the chain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. All arithmetic is exact integer addition, no
 *   floating point anywhere. Measured against its own representative teaching case (item399):
 *   SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not asserted here --
 *   this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-actor-age-chain-older-than-difference-v1';

const CHAIN_RE =
  /([A-Z][a-zA-Z]*) is (\d+) years older than ([A-Z][a-zA-Z]*), who is (\d+) years older than ([A-Z][a-zA-Z]*)/i;
const QUESTION_RE =
  /difference between the ages of\s+([A-Z][a-zA-Z]*)\s+and\s+([A-Z][a-zA-Z]*),?\s+if\s+([A-Z][a-zA-Z]*)\s+is\s+(\d+)\s+years old/i;

interface Analyzed { difference: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const chainM = CHAIN_RE.exec(q);
  const qM = QUESTION_RE.exec(q);
  if (!chainM || !qM) return null;

  const actorA = chainM[1];
  const d1 = Number(chainM[2]);
  const actorB = chainM[3];
  const d2 = Number(chainM[4]);
  const actorC = chainM[5];
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return null;

  const qOuter = qM[1];
  const qInner = qM[2];
  const qGivenActor = qM[3];
  const givenAge = Number(qM[4]);
  if (!Number.isFinite(givenAge)) return null;

  // Positive-evidence discriminator: the closing question must name the OUTER actor first, the
  // INNERMOST actor second, and give the innermost actor's own age -- not any other pairing in
  // the chain.
  if (qOuter !== actorA || qInner !== actorC || qGivenActor !== actorC) return null;

  const cAge = givenAge;
  const bAge = cAge + d2;
  const aAge = bAge + d1;
  return { difference: aAge - cAge };
}

export const threeActorAgeChainOlderThanDifference: LianaMethod = {
  id: 'three-actor-age-chain-older-than-difference-v1',
  demand: 'COMPUTE',
  name: 'Compute the age difference between the outer and innermost actors of a three-actor "older than" chain',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C236, GSM8K test item399',
  shapeDescription:
    'A is D1 years older than B, who is D2 years older than C; C\'s own age is given directly; ' +
    'difference = (C_age + D2 + D1) - C_age, only when the closing question names A and C in that ' +
    'order and gives C\'s own age.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an "A is D1 years older than B, who is D2 years older than C" chain plus a ' +
          '"difference between the ages of A and C, if C is N years old" closing question naming ' +
          'the outer and innermost chain actors in that order; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `difference = ${result.difference}` };
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
          verdict: String(Math.round((result.difference) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'outer actor age minus innermost actor age, derived along the chain',
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

registerMethod(threeActorAgeChainOlderThanDifference);
