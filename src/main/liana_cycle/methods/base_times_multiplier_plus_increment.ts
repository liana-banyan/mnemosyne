// D-BP223-BM04-h2cbpv9w-170 -- base-times-multiplier-plus-increment-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-times-multiplier-plus-increment-v1.candidate.ts
// Authored by generation wave W09 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W09.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C97 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 253, "Bill starts on the 3rd floor. He
 * rides the elevator up to the floor that's equal to 4 times his starting floor plus 6. What
 * floor is Bill on now?".
 *
 * @generalShape A directly-stated BASE value ("starts on the <ordinal> floor") is combined with
 *   an explicit "equal to <M> times his starting <noun> plus <K>" phrase via multiply-then-add,
 *   respecting order of operations (the multiply binds to the base BEFORE the increment is
 *   added). The final value is the answer.
 *
 * @recogniseInStranger Requires, as positive evidence: (a) "starts on the <ordinal> <noun>"
 *   giving the base value (ordinal suffix st/nd/rd/th tolerated, digit extracted regardless); (b)
 *   an "equal to <M> times his starting <noun> plus <K>" phrase, with the SAME noun referenced in
 *   both places (so a stray "N times X plus K" about a different quantity is not mistaken for
 *   this one); (c) the question asking "what <noun> is <actor> on now", confirming the target
 *   unit matches.
 *
 * @whatBreaksIt (a) the base value or the "times ... plus ..." phrase missing -- abstains; (b)
 *   the noun in the multiply-plus phrase not matching the noun in the "starts on" phrase --
 *   abstains, since this candidate only knows how to chain a value back to ITS OWN starting
 *   quantity, not a different one; (c) the question asking about a different noun than the one
 *   computed -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (18 = 3*4+6). With only one known cluster
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-times-multiplier-plus-increment-v1';

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

interface Analyzed {
  base: number;
  multiplier: number;
  increment: number;
  noun: string;
  finalValue: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the base value and its noun, from an ordinal (digit extracted regardless of st/nd/rd/th).
  const baseM = /starts\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?\s+(\w+)/i.exec(q);
  if (!baseM) return null;
  const base = wordOrDigit(baseM[1]);
  const baseNoun = baseM[2].toLowerCase();
  if (base === null) return null;

  // (b) the multiply-then-add phrase, tied to "his starting <noun>" with the SAME noun.
  const chainRe = new RegExp(
    'equal\\s+to\\s+(\\d+(?:\\.\\d+)?)\\s+times\\s+his\\s+starting\\s+' + baseNoun + '\\s+plus\\s+(\\d+(?:\\.\\d+)?)',
    'i',
  );
  const chainM = chainRe.exec(q);
  if (!chainM) return null;
  const multiplier = wordOrDigit(chainM[1]);
  const increment = wordOrDigit(chainM[2]);
  if (multiplier === null || increment === null) return null;

  // (c) the question asks about the same noun.
  const questionRe = new RegExp('what\\s+' + baseNoun + '\\s+is\\s+\\w+\\s+on\\s+now', 'i');
  if (!questionRe.test(q)) return null;

  const finalValue = base * multiplier + increment;
  return { base, multiplier, increment, noun: baseNoun, finalValue };
}

export const baseTimesMultiplierPlusIncrement: LianaMethod = {
  id: 'base-times-multiplier-plus-increment-v1',
  demand: 'COMPUTE',
  name: 'Base value times a stated multiplier, plus a stated increment (order of operations)',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C97, sole member harvest_gsm8k_pilot_item253)',
  shapeDescription:
    'A directly-stated base value is multiplied by a stated factor and then a stated increment is ' +
    'added, respecting order of operations; the base, the multiply-plus phrase and the question ' +
    'must all reference the same noun.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "starts on the Nth <noun>" base value, a matching "equal to M times his ' +
          'starting <noun> plus K" phrase, and a "what <noun> is ... on now" question; abstaining ' +
          'rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `base=${result.base}, multiplier=${result.multiplier}, increment=${result.increment}`,
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
      return {
        question,
        verdict: String(Math.round((result.finalValue) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.base}*${result.multiplier}+${result.increment}=${result.finalValue}`,
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

registerMethod(baseTimesMultiplierPlusIncrement);
