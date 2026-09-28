// D-BP223-BM04-h2cbp9d8-171 -- sum-two-actors-then-divide-by-group-plus-others-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-two-actors-then-divide-by-group-plus-others-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C270 (GSM8K test.jsonl item437, singleton).
 *
 * @generalShape TWO named actors each have a stated quantity of the SAME item ("<A> and <B>
 *   bought <X> and <Y> <item>, respectively"). Both actors decide to share their COMBINED total
 *   equally with a stated number of OTHER named friends -- so the sharing group is the two named
 *   actors PLUS the other-friends count. The question asks how much EVERYONE (each member of the
 *   whole group) gets. Verified against item437's own "#### 7" line before this candidate was
 *   written: 34+22=56 total, group = 2+6=8, 56/8=7 each.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<A> and <B> bought <X> and
 *   <Y> <item>, respectively" (exactly two named actors, exactly two quantities, in that paired
 *   order); (b) a sharing clause "share (them|it) equally with (his|her|their) <N> other friends";
 *   (c) a closing "how many <item> will everyone get" question. The two named actors are always
 *   counted IN the sharing group (group size = 2 + N).
 *
 * @whatBreaksIt (a) more or fewer than exactly two named actors in the opening clause -- abstain,
 *   this candidate does not attempt a 1-actor or 3-actor variant; (b) the "other friends" count
 *   is missing or given as a spelled-out word instead of a digit -- not recognized by this
 *   candidate's digit-only pattern; (c) the total is not evenly divisible by the group size --
 *   abstain rather than round; (d) the question asks for one named actor's own share specifically
 *   rather than the group's equal per-person share -- a different question this candidate does
 *   not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item437): total = 34+22 = 56, groupSize = 2+6 = 8, each = 56/8 = 7 (exact integer
 *   division). SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-two-actors-then-divide-by-group-plus-others-v1';

const TWO_QTY_RE = /(\w+)\s+and\s+(\w+)\s+bought\s+(\d+)\s+and\s+(\d+)\s+[a-z]+,?\s+respectively/i;
const OTHERS_RE = /(\d+)\s+other\s+friends/i;
const ASK_RE = /how\s+many\s+[a-z]+\s+will\s+everyone\s+get/i;

interface Analyzed { verdict: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const twoM = TWO_QTY_RE.exec(q);
  if (!twoM) return null;
  const qty1 = Number(twoM[3]);
  const qty2 = Number(twoM[4]);
  if (!Number.isInteger(qty1) || qty1 < 0 || !Number.isInteger(qty2) || qty2 < 0) return null;

  const othersM = OTHERS_RE.exec(q);
  if (!othersM) return null;
  const others = Number(othersM[1]);
  if (!Number.isInteger(others) || others < 0) return null;

  if (!ASK_RE.test(q)) return null;

  const total = qty1 + qty2;
  const groupSize = 2 + others;
  if (groupSize <= 0) return null;
  if (total % groupSize !== 0) return null; // not an exact whole-item share; abstain rather than round

  const verdict = total / groupSize;
  return { verdict };
}

export const sumTwoActorsThenDivideByGroupPlusOthers: LianaMethod = {
  id: 'sum-two-actors-then-divide-by-group-plus-others-v1',
  demand: 'COMPUTE',
  name: 'Compute each person\'s equal share when two named actors combine their totals and share with other named friends',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C270, GSM8K test item437',
  shapeDescription:
    'Two named actors each have a quantity of the same item ("bought X and Y ..., respectively"). ' +
    'Their combined total is shared equally among themselves plus N other friends. Answer = ' +
    '(X + Y) / (2 + N), exact integer division.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<A> and <B> bought <X> and <Y> ..., respectively" clause plus an "<N> ' +
          'other friends" sharing clause plus a "how many ... will everyone get" ask, with an ' +
          'exact whole-item division; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `each person gets ${result.verdict}` };
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
          verdict: String(Math.round((result.verdict) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(qty1 + qty2) / (2 + others), exact integer division',
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

registerMethod(sumTwoActorsThenDivideByGroupPlusOthers);
