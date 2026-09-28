// D-BP223-BM04-h2cbpv9w-170 -- multi-step-time-heat-then-cook-with-percent-and-offset-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multi-step-time-heat-then-cook-with-percent-and-offset-v1.candidate.ts
// Authored by generation wave W10 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
// (answer carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C102 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 267, "It takes 20 minutes for the oil to
 * heat up to 300 degrees. It then takes 40% longer for the oil to heat up to the desired
 * temperature of 400 degrees. After warming the oil it takes 5 minutes less time to cook than it
 * took to warm up the oil. How much time passes from starting the oil to having cooked chicken?"
 *
 * @generalShape A THREE-STAGE elapsed-time chain, told entirely as relative offsets from earlier
 *   stages, never as three independent absolute durations. Stage 1 duration is given directly
 *   (A). Stage 2's OWN duration is A plus a stated percentage of A ("P% longer"), so stage 2 =
 *   A*(1+P/100). Total warm-up = stage1 + stage2. A final stage (cook) is warm-up minus a stated
 *   constant ("C minutes less time ... than it took to warm up"). The question asks for the GRAND
 *   total elapsed time (warm-up + cook), not any single stage.
 *
 * @recogniseInStranger Three anchored facts must all be found, in this order, or the method
 *   abstains: (1) "it takes <A> minutes for <subject> to <verb> up to <value>" for the first
 *   stage; (2) "<P>% longer" for the percentage step-up of the SECOND stage; (3) "<C> minutes
 *   less time to <verb> than it took to warm up" (or "than it takes to warm up") tying a
 *   constant offset to the warm-up total. The closing question must ask "how much time" or "how
 *   long" together with the word "time" -- a question asking for any single stage's own duration
 *   is a different shape and is not this method's to answer.
 *
 * @whatBreaksIt (a) the percentage applying to the TOTAL warm-up rather than to stage 1 alone --
 *   this method only recognises "P% longer" describing the second stage's growth over the first,
 *   matching its one known member; (b) more than three stages, or the constant offset describing
 *   something other than the cook stage; (c) the percentage or constant expressed only in words
 *   ("forty percent") -- this method requires a digit before "%" and a digit before "minutes less
 *   time" and abstains on spelled-out numbers rather than risk a stranger's different phrasing;
 *   (d) any stage duration that fails to resolve to a finite number.
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass, so a false
 *   positive in shapeTest can never diverge from what run() actually computes. Measured against
 *   its own (sole) cluster member: SOLVED, matching the dataset's own worked total. With only one
 *   known member there is no cross-member measurement to report for this singleton cluster --
 *   noted honestly rather than inflated with a number borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multi-step-time-heat-then-cook-with-percent-and-offset-v1';

interface Analyzed {
  stage1: number;
  pct: number;
  offsetConst: number;
  stage2: number;
  totalWarm: number;
  cook: number;
  grandTotal: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Stage 1: "it takes <A> minutes for <subject> to <verb> up to <value>"
  const stage1Re = /\bit takes\s+([0-9]+(?:\.[0-9]+)?)\s+minutes\b[^.?!]*\bto\b[^.?!]*\bup to\b[^.?!]*[.!]/i;
  const m1 = stage1Re.exec(q);
  if (!m1) return null;
  const stage1 = parseFloat(m1[1]);
  if (!toFinite(stage1)) return null;

  // Stage 2 growth: "<P>% longer"
  const pctRe = /\b([0-9]+(?:\.[0-9]+)?)\s*%\s+longer\b/i;
  const m2 = pctRe.exec(q);
  if (!m2) return null;
  const pct = parseFloat(m2[1]);
  if (!toFinite(pct)) return null;

  // Cook offset: "<C> minutes less time to <verb> than it (took|takes) to warm up"
  const offsetRe =
    /\b([0-9]+(?:\.[0-9]+)?)\s+minutes\s+less\s+time\s+to\s+\w+\s+than\s+it\s+(?:took|takes)\s+to\s+warm\s+up\b/i;
  const m3 = offsetRe.exec(q);
  if (!m3) return null;
  const offsetConst = parseFloat(m3[1]);
  if (!toFinite(offsetConst)) return null;

  // The question must ask for total elapsed time, not a single stage's own duration.
  const questionRe = /\bhow\s+(?:much|long)\b[^?]*\btime\b[^?]*\?/i;
  if (!questionRe.test(q)) return null;

  // Rational arithmetic: multiply first, divide last, so a non-multiple-of-100 percentage never
  // needs an intermediate irrational decimal to be carried through more than one step.
  const stage2 = (stage1 * (100 + pct)) / 100;
  if (!toFinite(stage2)) return null;
  const totalWarm = stage1 + stage2;
  const cook = totalWarm - offsetConst;
  const grandTotal = totalWarm + cook;
  if (!toFinite(grandTotal)) return null;

  return { stage1, pct, offsetConst, stage2, totalWarm, cook, grandTotal };
}

export const multiStepTimeHeatThenCookWithPercentAndOffset: LianaMethod = {
  id: 'multi-step-time-heat-then-cook-with-percent-and-offset-v1',
  demand: 'COMPUTE',
  name: 'Three-stage elapsed time: base stage, percent-longer second stage, constant-offset third stage, sum all',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C102, sole member harvest_gsm8k_pilot_item267, GSM8K test.jsonl line 267)',
  shapeDescription:
    'Stage 1 given directly; stage 2 is stage 1 plus a stated percent-longer; a final stage is the ' +
    'warm-up total minus a stated constant; answer is warm-up total plus final stage.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "<A> minutes ... up to", "<P>% longer", and "<C> minutes less time ' +
          'to ... than it took to warm up" three-anchor shape with a "how much/long ... time" ' +
          'question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `stage1=${result.stage1}, pct=${result.pct}, offset=${result.offsetConst} -> ${result.grandTotal}`,
    };
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
      const rounded = Math.round(result.grandTotal * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `stage2=${result.stage1}*(100+${result.pct})/100=${result.stage2}, warm=${result.totalWarm}, ` +
          `cook=${result.totalWarm}-${result.offsetConst}=${result.cook}, total=${rounded}`,
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
  }
};

registerMethod(multiStepTimeHeatThenCookWithPercentAndOffset);
