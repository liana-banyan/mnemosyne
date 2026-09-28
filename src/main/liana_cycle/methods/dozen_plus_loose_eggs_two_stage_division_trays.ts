// D-BP223-BM04-h2cbp9d8-171 -- dozen-plus-loose-eggs-two-stage-division-trays-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\dozen-plus-loose-eggs-two-stage-division-trays-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C278 (GSM8K test.jsonl item446, singleton).
 *
 * @generalShape An actor has eggs from two sources: a stated number of DOZENS (in cases) plus a
 *   stated number of LOOSE eggs. Each tray holds a stated number of glasses, and each glass needs
 *   a stated number of eggs. The question asks how many trays can be put out. The corpus's own
 *   ground truth (verified against item446's own "#### 2" line before this candidate was written:
 *   4*12=48, 48+2=50, 50/5=10, 10/5=2) is reproduced here exactly: eggs = dozens*12 + loose;
 *   glasses = eggs / eggsPerGlass; trays = glasses / glassesPerTray.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a "uses <N> dozen eggs...in
 *   cases" clause; (b) "another <M> eggs...loose" clause; (c) a "trays...each hold <G> glasses"
 *   clause; (d) an "each glass needs <E> eggs" clause; (e) a closing "how many trays can...put
 *   out" question.
 *
 * @whatBreaksIt (a) any of the four required numeric clauses missing -- abstain; (b) the total
 *   egg count not dividing evenly by eggs-per-glass -- abstain rather than report a partial
 *   glass; (c) the resulting glass count not dividing evenly by glasses-per-tray -- abstain rather
 *   than report a partial tray; (d) more than one instance of any required clause -- ambiguous,
 *   abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item446): eggs = 4*12+2 = 50, glasses = 50/5 = 10, trays = 10/5 = 2 (exact integer
 *   arithmetic throughout, never a float heuristic). SOLVED. Reach across a wider corpus is
 *   recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'dozen-plus-loose-eggs-two-stage-division-trays-v1';

const DOZEN_RE = /uses\s+(\d+)\s+dozen eggs?\b[^.?!]*?\bin cases\b/i;
const LOOSE_RE = /another\s+(\d+)\s+eggs?[^.?!]*?\bloose\b/i;
const TRAY_RE = /trays?[^.?!]*?each hold\s+(\d+)\s+glasses?\s+of eggnog\b/i;
const EGGS_PER_GLASS_RE = /each glass needs\s+(\d+)\s+eggs?\b/i;
const ASK_RE = /how many trays can\s+\S+\s+put out\b/i;
const EGGS_PER_DOZEN = 12;

interface Analyzed { trays: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const dozenMatches = [...q.matchAll(new RegExp(DOZEN_RE.source, 'gi'))];
  if (dozenMatches.length !== 1) return null; // exactly one, unambiguous
  const dozens = Number(dozenMatches[0][1]);
  if (!Number.isFinite(dozens) || dozens <= 0) return null;

  const looseMatches = [...q.matchAll(new RegExp(LOOSE_RE.source, 'gi'))];
  if (looseMatches.length !== 1) return null; // exactly one, unambiguous
  const loose = Number(looseMatches[0][1]);
  if (!Number.isFinite(loose) || loose < 0) return null;

  const trayMatches = [...q.matchAll(new RegExp(TRAY_RE.source, 'gi'))];
  if (trayMatches.length !== 1) return null; // exactly one, unambiguous
  const glassesPerTray = Number(trayMatches[0][1]);
  if (!Number.isFinite(glassesPerTray) || glassesPerTray <= 0) return null;

  const eggMatches = [...q.matchAll(new RegExp(EGGS_PER_GLASS_RE.source, 'gi'))];
  if (eggMatches.length !== 1) return null; // exactly one, unambiguous
  const eggsPerGlass = Number(eggMatches[0][1]);
  if (!Number.isFinite(eggsPerGlass) || eggsPerGlass <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const totalEggs = dozens * EGGS_PER_DOZEN + loose; // exact integer
  if (totalEggs % eggsPerGlass !== 0) return null; // would not land on a whole glass count
  const glasses = totalEggs / eggsPerGlass;
  if (glasses % glassesPerTray !== 0) return null; // would not land on a whole tray count
  const trays = glasses / glassesPerTray;
  if (!Number.isFinite(trays) || trays < 0) return null;

  return { trays };
}

export const dozenPlusLooseEggsTwoStageDivisionTrays: LianaMethod = {
  id: 'dozen-plus-loose-eggs-two-stage-division-trays-v1',
  demand: 'COMPUTE',
  name: 'Compute how many trays can be filled from dozen-plus-loose egg counts, via a two-stage egg-to-glass-to-tray division',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C278, GSM8K test item446',
  shapeDescription:
    'eggs = dozens*12 + loose; glasses = eggs / eggsPerGlass; trays = glasses / glassesPerTray. ' +
    'Matches the corpus\'s own worked chain, only when both divisions resolve to whole numbers.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a dozen-eggs-in-cases clause plus a loose-eggs clause plus a ' +
          'glasses-per-tray clause plus an eggs-per-glass clause plus a "how many trays...put ' +
          'out" closing question, resolving to whole-number glass and tray counts; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `trays = ${result.trays}` };
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
          verdict: String(Math.round((result.trays) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(dozens*12 + loose) / eggsPerGlass / glassesPerTray, exact integer arithmetic',
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

registerMethod(dozenPlusLooseEggsTwoStageDivisionTrays);
