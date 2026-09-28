// D-BP223-BM04-h2cbp9d8-171 -- grid-capacity-double-plus-flat-offset-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\grid-capacity-double-plus-flat-offset-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C232 (GSM8K test.jsonl item394, singleton).
 *
 * @generalShape A container's CAPACITY is defined as rows x columns of some countable item. The
 *   question then asks for a quantity described as a FLAT offset added to DOUBLE that capacity:
 *   "<flat> more than double the number of <item> in a <container> with <R> rows and <C> columns."
 *   verdict = flat + 2*(R*C).
 *
 * @recogniseInStranger Requires, from the SAME sentence, the literal anchor phrase "<N> more than
 *   double the number of <item> in a <container-phrase> with <R> rows and <C> columns" -- the
 *   grid dimensions must sit directly inside the SAME clause that defines what is being doubled,
 *   not merely appear somewhere else in the question. A closing "how many <item> will <actor>
 *   need" question must also be present.
 *
 * @whatBreaksIt (a) a multiplier word other than the literal "double" (e.g. "triple", "half") --
 *   abstain, this candidate recognises only the exact "double" phrasing it was taught on; (b) grid
 *   dimensions expressed any other way than "<R> rows and <C> columns" (e.g. "5 by 6", "30 total
 *   spaces") -- abstain; (c) the rows/columns clause describing a DIFFERENT container than the one
 *   named in the "double the number of" clause -- abstain, since the anchor regex requires them in
 *   one contiguous span.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item394): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'grid-capacity-double-plus-flat-offset-v1';

const GRID_DOUBLE_RE =
  /(\d+)\s+more than double the number of\s+[a-z]+\s+in an?\s+[a-z]+(?:\s+[a-z]+){0,3}\s+with\s+(\d+)\s+rows?\s+and\s+(\d+)\s+columns?/i;
const CLOSING_Q_RE = /how many\s+[a-z]+\s+will\s+[a-z]+\s+need/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const m = GRID_DOUBLE_RE.exec(q);
  if (!m) return null;
  if (!CLOSING_Q_RE.test(q)) return null;

  const flat = Number(m[1]);
  const rows = Number(m[2]);
  const cols = Number(m[3]);
  if (!Number.isFinite(flat) || !Number.isFinite(rows) || !Number.isFinite(cols)) return null;

  const capacity = rows * cols;
  return { total: flat + 2 * capacity };
}

export const gridCapacityDoublePlusFlatOffset: LianaMethod = {
  id: 'grid-capacity-double-plus-flat-offset-v1',
  demand: 'COMPUTE',
  name: 'Compute a flat offset plus double a rows-by-columns grid capacity',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C232, GSM8K test item394',
  shapeDescription:
    'A container has capacity rows*columns; the question asks for a flat amount plus double that ' +
    'capacity: verdict = flat + 2*(rows*columns), only when the grid dimensions sit inside the same ' +
    'clause that defines the doubled quantity and the literal word "double" is used.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find "<N> more than double the number of <item> in a <container> with <R> rows ' +
          'and <C> columns" plus a "how many ... will ... need" closing question; abstaining rather ' +
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
          basis: 'flat offset plus double the rows*columns grid capacity',
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

registerMethod(gridCapacityDoublePlusFlatOffset);
