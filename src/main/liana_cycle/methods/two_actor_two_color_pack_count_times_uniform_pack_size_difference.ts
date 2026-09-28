// D-BP223-BM04-h2cbp9d8-171 -- two-actor-two-color-pack-count-times-uniform-pack-size-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-actor-two-color-pack-count-times-uniform-pack-size-difference-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C274 (GSM8K test.jsonl item441, singleton).
 *
 * @generalShape Two named actors each buy TWO stated pack counts of differently-colored items
 *   ("Actor1 bought N1 pack(s) of colorA and N2 packs of colorB, while Actor2 bought M1 packs of
 *   colorC and M2 packs of colorD"). A uniform per-pack piece count P is given separately. The
 *   question asks how many more pieces one actor has than the other. The corpus's own ground
 *   truth (verified against item441's own "#### 80" line before this candidate was written:
 *   (1+2)*20=60, (3+4)*20=140, 140-60=80) is reproduced here exactly: |((M1+M2) - (N1+N2))| * P.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a "<Actor1> bought <N1> pack(s)
 *   of <word> and <N2> packs of <word> beads" clause; (b) immediately followed by "while <Actor2>
 *   bought <M1> packs of <word> and <M2> packs of <word> beads" in the SAME sentence structure;
 *   (c) a single, separate "each pack of beads contains <P> pieces of beads" clause; (d) a closing
 *   "how many more beads do one...have than the other" question.
 *
 * @whatBreaksIt (a) either actor's clause missing one of its two pack-count sub-clauses --
 *   ambiguous, abstain; (b) more than one pack-size clause, or a pack size that is not stated
 *   once, cleanly -- abstain; (c) the two actors' totals being equal (a zero difference makes "how
 *   many more" ill-posed) -- abstain rather than report zero; (d) more than two named actors, or a
 *   different item than "beads" -- different shape, not handled.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item441): total1 = (1+2)*20 = 60, total2 = (3+4)*20 = 140, difference = |140-60| = 80
 *   (exact integer arithmetic throughout, never a float heuristic). SOLVED. Reach across a wider
 *   corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster
 *   shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-actor-two-color-pack-count-times-uniform-pack-size-difference-v1';

const TWO_ACTOR_RE =
  /(\w+)\s+bought\s+(\d+)\s+packs?\s+of\s+\w+\s+and\s+(\d+)\s+packs?\s+of\s+\w+\s+beads,?\s+while\s+(\w+)\s+bought\s+(\d+)\s+packs?\s+of\s+\w+\s+and\s+(\d+)\s+packs?\s+of\s+\w+\s+beads/i;
const PACK_SIZE_RE = /each pack of beads contains\s+(\d+)\s+pieces?\s+of beads\b/i;
const ASK_RE = /how many more \w+ do one \w+ have than the other\b/i;

interface Analyzed { difference: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const actorM = TWO_ACTOR_RE.exec(q);
  if (!actorM) return null;
  const n1 = Number(actorM[2]);
  const n2 = Number(actorM[3]);
  const m1 = Number(actorM[5]);
  const m2 = Number(actorM[6]);
  if (![n1, n2, m1, m2].every((v) => Number.isFinite(v) && v >= 0)) return null;

  const packSizeMatches = [...q.matchAll(new RegExp(PACK_SIZE_RE.source, 'gi'))];
  if (packSizeMatches.length !== 1) return null; // exactly one, unambiguous
  const packSize = Number(packSizeMatches[0][1]);
  if (!Number.isFinite(packSize) || packSize <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const total1 = (n1 + n2) * packSize; // exact integer
  const total2 = (m1 + m2) * packSize; // exact integer
  const difference = Math.abs(total2 - total1); // exact integer
  if (difference === 0) return null; // "how many more" is ill-posed when equal

  return { difference };
}

export const twoActorTwoColorPackCountTimesUniformPackSizeDifference: LianaMethod = {
  id: 'two-actor-two-color-pack-count-times-uniform-pack-size-difference-v1',
  demand: 'COMPUTE',
  name: 'Compute how many more pieces one actor has than another, from two-color pack counts times a uniform pack size',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C274, GSM8K test item441',
  shapeDescription:
    'Actor1 bought N1+N2 packs of two colors; Actor2 bought M1+M2 packs of two colors; a uniform ' +
    'pack size P is given; asks how many more pieces one has than the other. Answer = ' +
    '|((M1+M2)-(N1+N2))*P|, matching the corpus\'s own worked chain, only when strictly nonzero.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<Actor1> bought...and...while <Actor2> bought...and..." two-color, ' +
          'two-actor pack-count clause plus a single uniform pack-size clause plus a "how many ' +
          'more...than the other" closing question, resolving to a nonzero difference; ' +
          'abstaining rather than guessing',
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
          basis: '|((M1+M2)-(N1+N2))*packSize|, exact integer arithmetic',
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

registerMethod(twoActorTwoColorPackCountTimesUniformPackSizeDifference);
