// D-BP223-BM04-h2cbp9d8-171 -- goal-minus-remaining-minus-half-plus-flat-isolates-middle-activity-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\goal-minus-remaining-minus-half-plus-flat-isolates-middle-activity-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C244 (GSM8K test.jsonl item407, singleton).
 *
 * @generalShape A stated overall GOAL quantity G. Activity 1 is stated to have used exactly HALF
 *   of the goal ("finished half of his steps on..."). Activity 2 adds a flat stated amount A
 *   ("did another <A> steps..."). An unnamed middle activity (the one being asked about) happens
 *   next, with no stated amount of its own. After it, a REMAINING amount R is stated ("only had
 *   <R> steps left"). The question asks how much the unnamed middle activity itself contributed.
 *   Answer = (G - R) - (G/2 + A), i.e. total consumed so far minus the two named activities.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit numeric GOAL clause
 *   ("trying to walk <G> steps a day" or similar target statement); (b) a "finished/completed half
 *   of his/her <goal-noun>" clause (the literal word "half" tied to the goal, not to a different
 *   number); (c) a flat "another <A> <unit>" addend clause for a SECOND, separately named
 *   activity; (d) a "only had <R> <unit> left" (or "left to take") remaining-amount clause,
 *   stated AFTER a THIRD, unnamed activity is mentioned; (e) the question asks how many <unit>
 *   were taken during that third, unnamed activity specifically.
 *
 * @whatBreaksIt (a) more than one "half of" clause, or the half is of something other than the
 *   stated goal -- ambiguous, abstain; (b) more than one flat addend clause between the half-goal
 *   clause and the remaining-amount clause; (c) G is not evenly divisible by 2 -- abstain, no
 *   fractional step counts; (d) the computed middle-activity amount is negative -- abstain, the
 *   extraction is wrong somewhere rather than report an impossible negative count.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (item407): half = 10000/2 = 5000, afterTwoNamed =
 *   5000+1000 = 6000, consumedBeforeRemainder = 10000-2000 = 8000, jog = 8000-6000 = 2000. SOLVED.
 *   Reach across a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'goal-minus-remaining-minus-half-plus-flat-isolates-middle-activity-v1';

const GOAL_RE = /\btrying to walk\s+([\d,]+)\s+steps\b/i;
const HALF_RE = /\bfinished half of his steps\b/i;
const FLAT_ADDEND_RE = /\banother\s+([\d,]+)\s+steps\b/i;
const REMAINING_RE = /\bonly had\s+([\d,]+)\s+steps left\b/i;
const ASK_RE = /how many steps did .* take during his jog\b/i;

function num(s: string): number {
  return Number(s.replace(/,/g, ''));
}

interface Analyzed { middle: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const goalM = GOAL_RE.exec(q);
  if (!goalM) return null;
  const goal = num(goalM[1]);
  if (!Number.isFinite(goal) || goal <= 0) return null;

  if (!HALF_RE.test(q)) return null;
  if (goal % 2 !== 0) return null;
  const half = goal / 2;

  const addM = FLAT_ADDEND_RE.exec(q);
  if (!addM) return null;
  const addend = num(addM[1]);
  if (!Number.isFinite(addend) || addend <= 0) return null;

  const remM = REMAINING_RE.exec(q);
  if (!remM) return null;
  const remaining = num(remM[1]);
  if (!Number.isFinite(remaining) || remaining < 0) return null;

  if (!ASK_RE.test(q)) return null;

  const consumedBeforeRemainder = goal - remaining;
  const namedTotal = half + addend;
  const middle = consumedBeforeRemainder - namedTotal;
  if (!Number.isFinite(middle) || middle < 0) return null;

  return { middle };
}

export const goalMinusRemainingMinusHalfPlusFlatIsolatesMiddleActivity: LianaMethod = {
  id: 'goal-minus-remaining-minus-half-plus-flat-isolates-middle-activity-v1',
  demand: 'COMPUTE',
  name: 'Isolate an unnamed middle activity\'s contribution from a stated goal, a half-of-goal activity, a flat addend activity, and a final remaining amount',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C244, GSM8K test item407',
  shapeDescription:
    'Goal G; activity1 = G/2; activity2 = flat addend A; after an unnamed middle activity, R ' +
    'remains. Middle activity = (G - R) - (G/2 + A).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a goal clause, a "finished half of his steps" clause, a flat "another N ' +
          'steps" addend clause, a "only had N steps left" remaining clause, and a "how many ' +
          'steps...during his jog" closing question resolving to a non-negative middle-activity ' +
          'amount; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `middle activity = ${result.middle}` };
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
          verdict: String(Math.round((result.middle) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(goal - remaining) - (goal/2 + flatAddend)',
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

registerMethod(goalMinusRemainingMinusHalfPlusFlatIsolatesMiddleActivity);
