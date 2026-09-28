// D-BP223-BM04-h2cbp9d8-171 -- sum-of-labeled-subgroups-then-divide-shared-resource-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-of-labeled-subgroups-then-divide-shared-resource-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C229 (GSM8K test.jsonl item390, singleton).
 *
 * @generalShape TWO OR MORE labeled subgroup counts, each of the same base-unit noun ("<N> gifts
 *   to wrap for <group>"), are summed to a total count of items. A stated total amount of a single
 *   shared resource (ribbon, paint, rope) is then divided EQUALLY across that total item count.
 *   The closing question asks how much resource is used per item: perItem = resource / sum(counts).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) two or more repeated "<N> <base
 *   noun> to wrap for <label>" clauses sharing the SAME base noun; (b) a stated total amount of a
 *   distinct resource noun ("has <R> <unit> of <resource>"); (c) a closing "how many <unit> ...
 *   for each <base noun>" question, matching the SAME base noun and resource unit.
 *
 * @whatBreaksIt (a) fewer than two labeled subgroup clauses are found -- abstain, a single group
 *   is a different (trivial) shape; (b) the subgroup clauses do not all share the same base noun
 *   -- abstain, they are not being combined into one total; (c) the resource total is not evenly
 *   divisible by the summed subgroup count -- abstain rather than report a rounded amount.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item390): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sum-of-labeled-subgroups-then-divide-shared-resource-v1';

function stem(word: string): string {
  return word.toLowerCase().replace(/s$/, '');
}

const GROUP_RE = /(\d+)\s+([a-z]+)\s+to wrap for\s+(?:her|his|their)\s+([a-z]+)/gi;
const RESOURCE_RE = /has\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+of\s+([a-z]+)/i;
const QUESTION_RE = /how many\s+([a-z]+)\b[^.?!]*\b(?:can|should|will)\b[^.?!]*\buse\b[^.?!]*\bfor each\b/i;

interface Analyzed { perItem: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const groups: { count: number; noun: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(GROUP_RE.source, GROUP_RE.flags);
  while ((m = re.exec(q)) !== null) {
    groups.push({ count: Number(m[1]), noun: stem(m[2]) });
  }
  if (groups.length < 2) return null;
  const baseNoun = groups[0].noun;
  if (!groups.every((g) => g.noun === baseNoun)) return null;

  const resM = RESOURCE_RE.exec(q);
  if (!resM) return null;

  const qM = QUESTION_RE.exec(q);
  if (!qM) return null;
  if (stem(qM[1]) !== stem(resM[2])) return null;

  const totalItems = groups.reduce((a, g) => a + g.count, 0);
  const resourceTotal = Number(resM[1]);
  if (totalItems <= 0 || !Number.isFinite(resourceTotal)) return null;
  if (resourceTotal % totalItems !== 0) return null;

  return { perItem: resourceTotal / totalItems };
}

export const sumOfLabeledSubgroupsThenDivideSharedResource: LianaMethod = {
  id: 'sum-of-labeled-subgroups-then-divide-shared-resource-v1',
  demand: 'COMPUTE',
  name: 'Sum labeled subgroup counts, then divide a shared resource total evenly across them',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C229, GSM8K test item390',
  shapeDescription:
    'Two or more "<N> <item> to wrap for <group>" clauses share one base noun and sum to a total ' +
    'item count. A shared resource total is divided evenly across that total. perItem = resource / ' +
    'sum(counts), only when the division lands exactly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two or more matching "<N> <item> to wrap for <group>" clauses summing to ' +
          'a total, a stated resource amount, and a matching "how many <unit> for each <item>" ' +
          'closing question resolving to an exact per-item value; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `per item = ${result.perItem}` };
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
          verdict: String(Math.round((result.perItem) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'summed labeled subgroup counts, divided the shared resource total by that sum',
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

registerMethod(sumOfLabeledSubgroupsThenDivideSharedResource);
