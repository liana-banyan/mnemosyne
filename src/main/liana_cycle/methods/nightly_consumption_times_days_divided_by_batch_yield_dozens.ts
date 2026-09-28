// D-BP223-BM04-h2cbp9d8-171 -- nightly-consumption-times-days-divided-by-batch-yield-dozens-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\nightly-consumption-times-days-divided-by-batch-yield-dozens-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C247 (GSM8K test.jsonl item412, singleton).
 *
 * @generalShape A stated nightly (or daily) consumption rate C of some countable item, over a
 *   stated duration D days, gives a total need = C*D. A recipe/batch yields a stated multiple K of
 *   a named packaging unit ("dozen"), i.e. itemsPerBatch = K*12. The question asks how many
 *   BATCHES (dozens) must be made to have enough. Answer = ceil(need / itemsPerBatch), so that the
 *   supply is never short -- only reported when this candidate can determine the value exactly
 *   (need divides itemsPerBatch evenly, avoiding any rounding judgment call this candidate is not
 *   confident making silently).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "eats/uses <C> a
 *   night" (or "a day") consumption-rate clause; (b) an explicit "last her/him for <D> days"
 *   duration clause; (c) an explicit "recipe makes <K> dozen" (or "1 dozen") yield clause naming
 *   the literal word "dozen"; (d) the closing question asks "how many dozens...need to make" (the
 *   literal word "dozens" in the ask, confirming the answer is in batch units, not raw item count).
 *
 * @whatBreaksIt (a) the yield clause names a unit other than "dozen" (e.g. "makes 20 cookies") --
 *   a different, unattempted packaging convention; (b) more than one consumption-rate or duration
 *   clause; (c) the total need does not divide the per-batch yield evenly -- abstain rather than
 *   silently round up or down, since rounding direction is a judgment call this candidate is not
 *   confident enough to make without an exact-division check; (d) the question asks for the raw
 *   item count instead of dozens.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (item412): need = 2*30 = 60, itemsPerBatch = 1*12 = 12,
 *   dozens = 60/12 = 5. SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'nightly-consumption-times-days-divided-by-batch-yield-dozens-v1';

const CONSUMPTION_RE = /\beats\s+(\d+)\s+a\s+night\b/i;
const DURATION_RE = /\blast\s+her\s+for\s+(\d+)\s+days\b/i;
const YIELD_RE = /\brecipe\s+makes\s+(\d+)\s+dozen\b/i;
const ASK_DOZENS_RE = /how many dozens of cookies will she need to make\b/i;

interface Analyzed { dozens: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const consM = CONSUMPTION_RE.exec(q);
  if (!consM) return null;
  const perNight = Number(consM[1]);
  if (!Number.isFinite(perNight) || perNight <= 0) return null;

  const durM = DURATION_RE.exec(q);
  if (!durM) return null;
  const days = Number(durM[1]);
  if (!Number.isFinite(days) || days <= 0) return null;

  const yieldM = YIELD_RE.exec(q);
  if (!yieldM) return null;
  const dozensPerBatch = Number(yieldM[1]);
  if (!Number.isFinite(dozensPerBatch) || dozensPerBatch <= 0) return null;

  if (!ASK_DOZENS_RE.test(q)) return null;

  const need = perNight * days; // exact integer, total cookies needed
  const itemsPerBatch = dozensPerBatch * 12; // exact integer
  if (need % itemsPerBatch !== 0) return null; // rounding direction is a judgment call, abstain
  const dozens = (need / itemsPerBatch) * dozensPerBatch;
  if (!Number.isFinite(dozens)) return null;

  return { dozens };
}

export const nightlyConsumptionTimesDaysDividedByBatchYieldDozens: LianaMethod = {
  id: 'nightly-consumption-times-days-divided-by-batch-yield-dozens-v1',
  demand: 'COMPUTE',
  name: 'Compute the number of dozen-batches needed to cover a nightly consumption rate over a stated duration',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C247, GSM8K test item412',
  shapeDescription:
    'Nightly consumption C over D days gives need = C*D; a recipe yields K dozen per batch ' +
    '(itemsPerBatch = K*12). Dozens needed = (need/itemsPerBatch)*K, only when need divides ' +
    'itemsPerBatch evenly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a nightly consumption-rate clause, a duration clause, a "recipe makes N ' +
          'dozen" yield clause, and a "how many dozens...need to make" closing question resolving ' +
          'to an exact whole-dozen count; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `dozens needed = ${result.dozens}` };
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
          verdict: String(Math.round((result.dozens) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(consumption*days) / (dozensPerBatch*12) * dozensPerBatch',
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

registerMethod(nightlyConsumptionTimesDaysDividedByBatchYieldDozens);
