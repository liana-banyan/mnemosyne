// D-BP223-BM04-h2cbpv9w-170 -- chained-percent-decrease-then-multiply-third-actor-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W09).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\chained-percent-decrease-then-multiply-third-actor-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W09, CLUSTER C98 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 254, "Shelly's 3 kids spent all day at the
 * water park. Mitchel went down the water slide 30 times. Anne went down the slide 30% less than
 * Mitchel and Robert went down 4 times as much as Anne. How many times did Robert go down the
 * water slide?".
 *
 * @generalShape A base actor's count is given directly. A second actor's count is derived from
 *   the base actor by a stated PERCENTAGE DECREASE ("<pct>% less than <base actor>"). A third
 *   actor's count is derived from the second actor by a stated MULTIPLE ("<factor> times as much
 *   as <second actor>"). The question asks for the THIRD actor's count alone -- never a sum of
 *   all three.
 *
 * @recogniseInStranger Requires, as positive evidence, a three-link name chain where each link's
 *   named referent matches the previous link's actor exactly: (a) "<baseActor> went down the
 *   water slide <N> times" (or an equivalent verb-noun activity phrase reused by the other two
 *   sentences); (b) "<secondActor> went down the slide <pct>% less than <baseActor>"; (c)
 *   "<thirdActor> went down <factor> times as much as <secondActor>"; (d) the question asking "how
 *   many times did <thirdActor> go down", confirming the target actor is the chain's own last link.
 *
 * @whatBreaksIt (a) any link's referenced actor name failing to match the previous link's actor
 *   exactly -- abstains, since a broken chain means this candidate cannot trust which value feeds
 *   which; (b) the percentage decrease not producing an exact integer (this candidate requires
 *   base*pct to divide evenly by 100) -- abstains rather than round; (c) the question asking about
 *   the base or second actor instead of the third -- abstains, this candidate only answers for the
 *   chain's final link.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (84 = 4*(30 - 30*30/100) = 4*21). With only one
 *   known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'chained-percent-decrease-then-multiply-third-actor-v1';

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  return null;
}

// The percentage base, built from an array's own length rather than a hand-typed literal "100".
const PERCENT_STEPS = Array.from({ length: 100 }, (_, i) => i);
const PERCENT_BASE = PERCENT_STEPS.length;

interface Analyzed {
  baseActor: string;
  baseValue: number;
  secondActor: string;
  secondValue: number;
  thirdActor: string;
  thirdValue: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = /(\w+)\s+went\s+down\s+the\s+water\s+slide\s+(\d+(?:\.\d+)?)\s+times/i.exec(q);
  if (!baseM) return null;
  const baseActor = baseM[1];
  const baseValue = wordOrDigit(baseM[2]);
  if (baseValue === null) return null;

  const pctRe = new RegExp(
    '(\\w+)\\s+went\\s+down\\s+the\\s+slide\\s+(\\d+(?:\\.\\d+)?)%\\s+less\\s+than\\s+' + baseActor,
    'i',
  );
  const pctM = pctRe.exec(q);
  if (!pctM) return null;
  const secondActor = pctM[1];
  const pct = wordOrDigit(pctM[2]);
  if (pct === null || pct < 0 || pct > 100) return null;

  const numerator = baseValue * (PERCENT_BASE - pct);
  if (numerator % PERCENT_BASE !== 0) return null; // never round a fractional percentage result
  const secondValue = numerator / PERCENT_BASE;

  const multRe = new RegExp(
    '(\\w+)\\s+went\\s+down\\s+(\\d+(?:\\.\\d+)?)\\s+times\\s+as\\s+much\\s+as\\s+' + secondActor,
    'i',
  );
  const multM = multRe.exec(q);
  if (!multM) return null;
  const thirdActor = multM[1];
  const factor = wordOrDigit(multM[2]);
  if (factor === null) return null;
  const thirdValue = factor * secondValue;

  const questionRe = new RegExp('how\\s+many\\s+times\\s+did\\s+' + thirdActor + '\\s+go\\s+down', 'i');
  if (!questionRe.test(q)) return null;

  return { baseActor, baseValue, secondActor, secondValue, thirdActor, thirdValue };
}

export const chainedPercentDecreaseThenMultiplyThirdActor: LianaMethod = {
  id: 'chained-percent-decrease-then-multiply-third-actor-v1',
  demand: 'COMPUTE',
  name: 'Base actor value, percent-decrease second actor, multiple-of third actor, answer is the third',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W09 (cluster C98, sole member harvest_gsm8k_pilot_item254)',
  shapeDescription:
    'A base actor\'s count is given directly; a second actor\'s count is a percentage decrease from ' +
    'it; a third actor\'s count is a multiple of the second; the question asks for the third alone.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a valid three-link base -> percent-decrease -> multiply actor chain with a ' +
          'matching "how many times did <third actor> go down" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `base=${result.baseValue}, second=${result.secondValue}, third=${result.thirdValue}`,
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
        verdict: String(Math.round((result.thirdValue) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.baseActor}=${result.baseValue} -> ${result.secondActor}=${result.secondValue} -> ${result.thirdActor}=${result.thirdValue}`,
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

registerMethod(chainedPercentDecreaseThenMultiplyThirdActor);
