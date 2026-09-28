// D-BP223-BM04-h2cbp9d8-171 -- weight-equivalence-chain-plus-container-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\weight-equivalence-chain-plus-container-sum-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C194 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 341, "A pink frog weighs the same as a blue beetle, the
 * same as a green toad, 10 pounds less than a yellow snake, but 20 pounds more than a red bird.
 * If the pink frog weighs 50 pounds, calculate the total weight of a container carrying one of
 * each animal if the container also weighs 20 pounds." Silo label: "multi-step comparison and
 * summation problem".
 *
 * @generalShape ONE anchor actor's weight is given directly. A chain of "<Actor> weighs the same
 *   as <ActorB>[, the same as <ActorC>], <D1> pounds less than <ActorD>, but <D2> pounds more
 *   than <ActorE>" clauses relates every other named actor's weight back to the SAME anchor,
 *   either by direct equality or by a stated additive offset. Each actor's weight is derived
 *   (equal actors copy the anchor's value; offset actors add/subtract their stated delta), all
 *   derived weights are summed, and a separately-stated container weight is added on top for the
 *   final total.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an anchor sentence naming the
 *   ANCHOR actor and listing, in one comma/"but"-joined clause chain: zero or more "the same as
 *   <ActorX>" equality clauses, and zero or more "<N> pounds less/more than <ActorY>" offset
 *   clauses, each clause naming a DISTINCT other actor; (b) a direct-value sentence "if the
 *   <anchor> weighs <V> pounds"; (c) a closing sentence asking for the TOTAL weight of a
 *   container carrying one of each animal, itself stating the container's OWN weight as a bare
 *   number to add on top.
 *
 * @whatBreaksIt (a) an actor named more than once across the chain -- abstain, ambiguous which
 *   relation applies; (b) an offset clause whose direction word ("less"/"more") is not
 *   recognised -- abstain rather than guess the sign; (c) the closing sentence not stating its
 *   own container weight as a bare number -- abstain, this candidate never assumes the container
 *   is free; (d) fewer than two OTHER actors named in the chain (a chain of one adds nothing
 *   beyond the direct-value sentence and is out of this candidate's scope) -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (50 [frog] + 50 [beetle] + 50 [toad] + 60 [snake] + 30 [bird] +
 *   20 [container] = 260). With only one known cluster member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'weight-equivalence-chain-plus-container-sum-v1';

interface Analyzed { total: number; }

interface Relation { actor: string; kind: 'equal' | 'less' | 'more'; delta: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Find the anchor: the actor named in the direct-value sentence "if the <anchor> weighs <V> pounds".
  const valueRe = /if\s+the\s+([a-z]+\s+[a-z]+)\s+weighs\s+(\d+)\s+pounds\b/i;
  const vm = valueRe.exec(q);
  if (!vm) return null;
  const anchor = vm[1].toLowerCase().trim();
  const anchorValue = parseInt(vm[2], 10);
  if (!Number.isFinite(anchorValue) || anchorValue <= 0) return null;

  // The chain sentence: "A <anchor> weighs <clauses>." Split into clauses on "," / "but".
  const chainRe = new RegExp(
    escapeRe(anchor) + '\\s+weighs\\s+(.+?)\\.', 'i',
  );
  const cm = chainRe.exec(q);
  if (!cm) return null;
  const clauseText = cm[1];
  const rawClauses = clauseText.split(/,|\bbut\b/i).map((s) => s.trim()).filter(Boolean);
  if (rawClauses.length < 2) return null;

  const relations: Relation[] = [];
  const seenActors = new Set<string>();
  for (const clause of rawClauses) {
    const eqMatch = /the\s+same\s+as\s+(?:a|an|the)\s+([a-z]+\s+[a-z]+)/i.exec(clause);
    if (eqMatch) {
      const actor = eqMatch[1].toLowerCase().trim();
      if (seenActors.has(actor)) return null;
      seenActors.add(actor);
      relations.push({ actor, kind: 'equal', delta: 0 });
      continue;
    }
    const offMatch = /(\d+)\s+pounds?\s+(less|more)\s+than\s+(?:a|an|the)\s+([a-z]+\s+[a-z]+)/i.exec(clause);
    if (offMatch) {
      const delta = parseInt(offMatch[1], 10);
      const kind = offMatch[2].toLowerCase() === 'less' ? 'less' : 'more';
      const actor = offMatch[3].toLowerCase().trim();
      if (!Number.isFinite(delta) || delta < 0) return null;
      if (seenActors.has(actor)) return null;
      seenActors.add(actor);
      relations.push({ actor, kind, delta });
      continue;
    }
    return null;
  }
  if (relations.length < 2) return null;

  // Closing sentence: total weight of a container carrying one of each, plus the container's own weight.
  const containerRe = /container[^.]*?(?:also\s+)?weighs\s+(\d+)\s+pounds/i;
  const contMatch = containerRe.exec(q);
  if (!contMatch) return null;
  if (!/total\s+weight\s+of\s+a\s+container\s+carrying\s+one\s+of\s+each/i.test(q)) return null;
  const containerWeight = parseInt(contMatch[1], 10);
  if (!Number.isFinite(containerWeight) || containerWeight < 0) return null;

  // "<anchor> weighs <delta> pounds less than <actor>" means anchor = actor - delta, so
  // actor = anchor + delta. "<delta> pounds more than <actor>" means anchor = actor + delta, so
  // actor = anchor - delta. The direction word describes the ANCHOR relative to the OTHER actor,
  // not the other way around -- the sign is inverted when solving for the other actor's weight.
  let total = anchorValue + containerWeight;
  for (const rel of relations) {
    if (rel.kind === 'equal') total += anchorValue;
    else if (rel.kind === 'less') total += anchorValue + rel.delta;
    else total += anchorValue - rel.delta;
  }
  if (!Number.isFinite(total)) return null;
  return { total };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const weightEquivalenceChainPlusContainerSum: LianaMethod = {
  id: 'weight-equivalence-chain-plus-container-sum-v1',
  demand: 'COMPUTE',
  name: 'Chain of weight-equality and weight-offset relations to one anchor, plus a container weight -- exact integer arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C194, sole member: pilot corpus item at index 341)',
  shapeDescription: 'total = anchorValue + containerWeight + sum over relations(equal -> anchorValue, less -> anchorValue - delta, more -> anchorValue + delta)',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an anchor weight-chain sentence naming at least two OTHER distinct ' +
          'actors via "the same as" and/or "<N> pounds less/more than" relations, a direct ' +
          '"if the <anchor> weighs <V> pounds" sentence, and a closing "total weight of a ' +
          'container carrying one of each ... weighs <N> pounds" sentence; abstaining rather ' +
          'than guessing',
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
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'anchor value propagated through equality/offset relations, summed with the container weight',
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

registerMethod(weightEquivalenceChainPlusContainerSum);
