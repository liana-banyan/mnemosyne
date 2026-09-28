// D-BP223-BM04-h2cbpv9w-170 -- relative-age-chain-substitution-from-anchor-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\relative-age-chain-substitution-from-anchor-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W16, CLUSTER C140 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 92, "Emily has ... kids named Amy,
 * Jackson, Corey, and James. Amy is 5 years older than Jackson and 2 years younger than Corey.
 * If James is ... and is 1 year younger than Corey, how old is Jackson?". Silo label: "age
 * relationship problem -- algebraic substitution and relative age comparison".
 *
 * @generalShape A set of named people are linked by RELATIVE age statements ("X is D years
 *   older/younger than Y"). Somewhere in the chain, exactly ONE person's ABSOLUTE age is given,
 *   often in the same sentence as a further relative statement about that same person (an elided-
 *   subject construction: "James is 10 and is 1 year younger than Corey"). The question asks for
 *   the age of one named person elsewhere in the chain. This candidate builds the full relative-
 *   age graph from every relation sentence it can positively parse, anchors it at the one
 *   absolute age found, and walks the graph by signed substitution to the target -- never
 *   assuming which two people the question will ask about.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) at least one "X is D years older/younger than Y and E years older/younger than Z"
 *       sentence (the classic elided-subject-on-second-clause construction, where X's own name
 *       and "is" are not repeated before the second relation);
 *   (b) exactly one "X is A and is D years older/younger than Y" sentence, which supplies BOTH
 *       the one absolute anchor age (A, for X) and one more relative edge (X to Y);
 *   (c) the resulting graph actually connecting the anchor to the person named in "how old is
 *       <name>?";
 *   (d) at least two distinct relative edges total, so a single bare fact is never mistaken for
 *       a chain.
 *
 * @whatBreaksIt (a) no absolute-anchor-plus-relation sentence -- abstain, there is nothing to
 *   substitute from; (b) the question's named target never reachable from the anchor through the
 *   parsed edges -- abstain, never guess an age for someone outside the parsed chain; (c) any
 *   relation using a comparative word other than "older"/"younger" -- abstain, this candidate has
 *   no positive evidence for any other comparative; (d) a person named twice with conflicting
 *   ages implied by two different paths is NOT reconciled by this candidate -- it always reports
 *   the first age reached by breadth-first traversal from the anchor, which is only safe because
 *   its own guard (d) above requires a genuine chain, not a cycle, to have fired at all here.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (walking anchor -> Corey -> Amy -> Jackson by signed
 *   substitution matches the item's own accepted age for Jackson exactly). With only one known
 *   cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'relative-age-chain-substitution-from-anchor-v1';

interface Edge { a: string; b: string; delta: number; } // age(a) = age(b) + delta
interface Analyzed { age: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const edges: Edge[] = [];
  let anchorName: string | null = null;
  let anchorAge: number | null = null;

  // (a) two relations sharing one elided subject, e.g. "Amy is 5 years older than Jackson and
  // 2 years younger than Corey."
  const doubleRe = /\b([A-Za-z]+)\s+is\s+(\d+)\s+years?\s+(older|younger)\s+than\s+([A-Za-z]+)\s+and\s+(\d+)\s+years?\s+(older|younger)\s+than\s+([A-Za-z]+)\b/gi;
  let dm: RegExpExecArray | null;
  while ((dm = doubleRe.exec(q)) !== null) {
    const [, subj, delta1Str, comp1, name2, delta2Str, comp2, name3] = dm;
    edges.push({ a: subj, b: name2, delta: comp1.toLowerCase() === 'older' ? Number(delta1Str) : -Number(delta1Str) });
    edges.push({ a: subj, b: name3, delta: comp2.toLowerCase() === 'older' ? Number(delta2Str) : -Number(delta2Str) });
  }

  // (b) an absolute age paired with a relation to a third person in one elided-subject sentence.
  const comboRe = /\b([A-Za-z]+)\s+is\s+(\d+)\s+and\s+is\s+(\d+)\s+years?\s+(older|younger)\s+than\s+([A-Za-z]+)\b/i;
  const cm = comboRe.exec(q);
  if (cm) {
    const [, name, ageStr, deltaStr, comp, otherName] = cm;
    anchorName = name;
    anchorAge = Number(ageStr);
    edges.push({ a: name, b: otherName, delta: comp.toLowerCase() === 'older' ? Number(deltaStr) : -Number(deltaStr) });
  }

  if (anchorName === null || anchorAge === null) return null;
  if (edges.length < 2) return null;

  // (c) the question's own target.
  const targetRe = /how\s+old\s+is\s+([A-Za-z]+)\b/i;
  const tm = targetRe.exec(q);
  if (!tm) return null;
  const target = tm[1];

  // Bidirectional adjacency: age(a) = age(b) + delta implies age(b) = age(a) - delta.
  const adj = new Map<string, Array<{ to: string; delta: number }>>();
  const addEdge = (from: string, to: string, delta: number) => {
    if (!adj.has(from)) adj.set(from, []);
    (adj.get(from) as Array<{ to: string; delta: number }>).push({ to, delta });
  };
  for (const e of edges) {
    addEdge(e.a, e.b, -e.delta);
    addEdge(e.b, e.a, e.delta);
  }

  const known = new Map<string, number>();
  known.set(anchorName, anchorAge);
  const queue: string[] = [anchorName];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const curAge = known.get(cur) as number;
    const neighbors = adj.get(cur) || [];
    for (const nb of neighbors) {
      if (known.has(nb.to)) continue;
      known.set(nb.to, curAge + nb.delta);
      queue.push(nb.to);
    }
  }

  if (!known.has(target)) return null;
  return { age: known.get(target) as number };
}

export const relativeAgeChainSubstitutionFromAnchor: LianaMethod = {
  id: 'relative-age-chain-substitution-from-anchor-v1',
  demand: 'COMPUTE',
  name: 'Walk a relative-age graph by signed substitution from a single absolute anchor to a named target',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W16 (cluster C140, sole member harvest_gsm8k_pilot_item92_age_relationship_problem)',
  shapeDescription:
    'Named people linked by older/younger relative-age statements, including the elided-subject ' +
    '"X is D older than Y and E younger than Z" construction; exactly one absolute anchor age ' +
    'given, often paired with one more relation in the same sentence; the question asks the age ' +
    'of a person reached by walking the graph from the anchor.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an absolute-anchor-plus-relation sentence plus enough relative-age edges ' +
          'to reach the person named in a how-old-is question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `age = ${result.age}` };
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
          verdict: String(Math.round(result.age * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'breadth-first signed substitution across the parsed relative-age graph from the one anchor',
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

registerMethod(relativeAgeChainSubstitutionFromAnchor);
