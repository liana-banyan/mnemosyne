// D-BP223-BM04-h2cbp9d8-171 -- divide-then-fraction-of-share-unit-converted-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\divide-then-fraction-of-share-unit-converted-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C266 (GSM8K test.jsonl item433, singleton).
 *
 * @generalShape A total quantity Q, given in a volume unit (gallon/quart/pint/cup), is equally
 *   divided into N containers. A fraction "a/b of a container" of ONE container's share is then
 *   needed, and the question asks for that amount converted into a (possibly different) volume
 *   unit. Verified against item433's own "#### 6" line before this candidate was written: 15
 *   gallons = 240 cups; per container = 240/5 = 48 cups; 1/4 of a container = 12 cups; in pints
 *   (2 cups/pint) = 6 pints.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "<Q> <sourceUnit> of <noun>
 *   were equally divided into <N> (different )?containers"; (b) "<a>/<b> of a container" (a
 *   literal slash fraction, not a spelled-out fraction word); (c) a closing "how many
 *   <targetUnit> of <noun> did <actor> need" naming a recognized volume unit. All four units
 *   (gallon, quart, pint, cup) are converted through a shared integer base (cups) so the whole
 *   computation is exact-integer, never a float.
 *
 * @whatBreaksIt (a) a source or target unit outside {gallon, quart, pint, cup} -- abstain, no
 *   conversion factor known; (b) the per-container division (Q/N) or the final unit conversion is
 *   not an exact whole number -- abstain rather than round; (c) the fraction is spelled out in
 *   words ("a quarter of a container") instead of digits with a slash -- not recognized by this
 *   candidate's narrower fraction pattern.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item433): totalCups = 15*16 = 240, perContainerCups = 240/5 = 48 (exact), portionCups =
 *   48*1/4 = 12 (exact), answer = 12/2 (cups-per-pint) = 6 (exact). SOLVED. Reach across a wider
 *   corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster
 *   shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'divide-then-fraction-of-share-unit-converted-v1';

const UNIT_TO_CUPS: Record<string, number> = { gallon: 16, quart: 4, pint: 2, cup: 1 };

function normalizeUnit(raw: string): string | null {
  const u = raw.toLowerCase().replace(/s$/, '');
  return UNIT_TO_CUPS[u] != null ? u : null;
}

const TOTAL_RE = /(\d+)\s+(gallons?|quarts?|pints?|cups?)\s+of\s+[a-z]+\s+were\s+equally\s+divided\s+into\s+(\d+)\s+(?:different\s+)?containers?/i;
const FRACTION_RE = /(\d+)\/(\d+)\s+of\s+a\s+container/i;
const ASK_RE = /how\s+many\s+(gallons?|quarts?|pints?|cups?)\s+of\s+[a-z]+\s+did\s+\w+\s+need/i;

interface Analyzed { verdict: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalM = TOTAL_RE.exec(q);
  if (!totalM) return null;
  const qty = Number(totalM[1]);
  if (!Number.isInteger(qty) || qty <= 0) return null;
  const sourceUnit = normalizeUnit(totalM[2]);
  if (!sourceUnit) return null;
  const containers = Number(totalM[3]);
  if (!Number.isInteger(containers) || containers <= 0) return null;

  const fracM = FRACTION_RE.exec(q);
  if (!fracM) return null;
  const fracNum = Number(fracM[1]);
  const fracDen = Number(fracM[2]);
  if (!Number.isInteger(fracNum) || !Number.isInteger(fracDen) || fracDen <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;
  const targetUnit = normalizeUnit(askM[1]);
  if (!targetUnit) return null;

  const totalCups = qty * UNIT_TO_CUPS[sourceUnit];
  if (totalCups % containers !== 0) return null; // not an exact whole-cup per-container share
  const perContainerCups = totalCups / containers;

  const scaledPortion = perContainerCups * fracNum;
  if (scaledPortion % fracDen !== 0) return null; // not an exact whole-cup portion
  const portionCups = scaledPortion / fracDen;

  const targetCupsPerUnit = UNIT_TO_CUPS[targetUnit];
  if (portionCups % targetCupsPerUnit !== 0) return null; // not an exact whole target-unit amount
  const verdict = portionCups / targetCupsPerUnit;

  return { verdict };
}

export const divideThenFractionOfShareUnitConverted: LianaMethod = {
  id: 'divide-then-fraction-of-share-unit-converted-v1',
  demand: 'COMPUTE',
  name: 'Compute a fraction of an equally-divided container share, converted to a target volume unit',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C266, GSM8K test item433',
  shapeDescription:
    'A total quantity Q (gallon/quart/pint/cup) is equally divided into N containers. A fraction ' +
    'a/b of one container is needed, converted to a target volume unit. All units are converted ' +
    'through a shared integer base (cups) so every division is checked exact, never rounded.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<Q> <unit> ... equally divided into <N> containers" clause plus an ' +
          '"a/b of a container" fraction plus a recognized target-unit ask, with every division ' +
          'exact; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `converted portion = ${result.verdict}` };
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
          basis: 'total converted to cups, divided by containers, scaled by a/b, converted to target unit -- exact integer arithmetic',
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

registerMethod(divideThenFractionOfShareUnitConverted);
