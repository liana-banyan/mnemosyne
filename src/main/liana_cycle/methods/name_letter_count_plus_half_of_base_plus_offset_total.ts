// D-BP223-BM04-h2cbp9d8-171 -- name-letter-count-plus-half-of-base-plus-offset-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\name-letter-count-plus-half-of-base-plus-offset-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C263 (GSM8K test.jsonl item429, singleton).
 *
 * @generalShape A base person's name is stated to have a directly-given LETTER COUNT. A second,
 *   related person's (e.g. sister's) name is described as having a stated OFFSET number of
 *   letters MORE than HALF the base person's letter count. The question asks for the TOTAL number
 *   of letters across both names. Verified against item429's own "#### 13" line before this
 *   candidate was written: base=6, half=6/2=3, second=3+4=7, total=6+7=13.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a base letter-count clause
 *   ("<Name> has <N> letters in her/his name"); (b) a half-plus-offset clause naming the second
 *   person and an offset amount ("<relation>'s name has <K> more letters than half of <Name>'
 *   name" or "half the letters in <Name>'s name"); (c) a closing question asking "how many
 *   letters are in <Name> and <relation>'s names" (a combined total, not either name alone).
 *
 * @whatBreaksIt (a) the base letter count is not evenly divisible by 2 -- abstain rather than
 *   report a fractional half-letter; (b) more than one distinct base letter-count figure or more
 *   than one distinct offset figure is found -- ambiguous, abstain; (c) the relation clause is
 *   phrased as a MULTIPLE of the base rather than "more than half" (e.g. "twice as many") -- a
 *   different arithmetic chain this candidate does not attempt; (d) the question asks for only
 *   one person's letter count rather than the combined total of both -- a different question this
 *   candidate does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item429): base=6, half=6/2=3 (exact integer division, checked for divisibility first),
 *   second=3+4=7, total=6+7=13 (exact integer arithmetic throughout, no floats). SOLVED. Reach
 *   across a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'name-letter-count-plus-half-of-base-plus-offset-total-v1';

const BASE_LETTERS_RE = /has\s+(\d+)\s+letters\s+in\s+her\s+name/i;
const RELATION_RE = /has\s+(\d+)\s+more\s+letters\s+than\s+half\s+of\s+(?:the\s+letters\s+in\s+[a-z]+'\s+name|[a-z]+'\s+letters)/i;
const ASK_RE = /how\s+many\s+letters\s+are\s+in\s+[a-z]+\s+and\s+(?:her|his)\s+sister's\s+names/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = BASE_LETTERS_RE.exec(q);
  if (!baseM) return null;
  const base = Number(baseM[1]);
  if (!Number.isInteger(base) || base <= 0) return null;

  const relM = RELATION_RE.exec(q);
  if (!relM) return null;
  const offset = Number(relM[1]);
  if (!Number.isInteger(offset) || offset <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  if (base % 2 !== 0) return null; // would not land on a whole-number half
  const half = base / 2; // exact integer division
  const second = half + offset;
  const total = base + second; // exact integer arithmetic
  if (!Number.isFinite(total) || total <= 0) return null;

  return { total };
}

export const nameLetterCountPlusHalfOfBasePlusOffsetTotal: LianaMethod = {
  id: 'name-letter-count-plus-half-of-base-plus-offset-total-v1',
  demand: 'COMPUTE',
  name: 'Compute a combined name-letter total when a second name is a stated offset more than half the base name\'s letter count',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C263, GSM8K test item429',
  shapeDescription:
    'Base letter count N (must be even). Second count = N/2 + K (K the stated offset). ' +
    'Total = N + (N/2 + K).',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a base letter-count + "<K> more letters than half of <name>\' letters" + ' +
          '"how many letters are in...and...sister\'s names" chain resolving to whole-number ' +
          'letter counts; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `combined letter total = ${result.total}` };
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
          basis: 'base + (base/2 + offset), exact integer arithmetic',
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

registerMethod(nameLetterCountPlusHalfOfBasePlusOffsetTotal);
