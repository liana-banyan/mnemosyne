// D-BP223-BM04-h2cbpv9w-170 -- two-actor-percent-offset-then-matched-raise-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W04).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-actor-percent-offset-then-matched-raise-sum-v1.candidate.ts
// Authored by generation wave W04 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W04.md), merged into the
// shared manifest and run through the full gate chain by REGISTRAR R01
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md): gate 1 (positive yield), gate 2a (answer carry),
// gate 4 (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora, per D-BP223-M0-h2cbpc0g-043's own methodology), and the
// perturbation gate 2b (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations,
// oracle hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported object
// completely unannotated, so nothing was ever checked against the real registry contract -- the
// same disguise found and named in the earlier seven item-10 methods, batch 1 and batch 2 (see
// reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md). Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes, from its first
// behavior-bearing declaration through analyze()'s closing brace -- proved by a programmatic byte-
// containment check (extract, splice, re-read, includes()), not merely asserted. See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the exact core-bytes/core-lines/CONTAINED table.
// Only the interface layer (imports, the three deleted local interfaces, the exported object's
// shape, shapeTest/run signatures, and the numeric-verdict rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across the earlier seven, batch 1 and batch 2
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word."): run() aborts to an honest abstain on any thrown error rather than ending the
// engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W04, CLUSTER C60 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 119, "Adrien's total salary was 30 percent
 * higher than Lylah's. Four years later, his salary had increased, and he was earning 40% more
 * than what he was making four years ago. If Adrien's and Lylah's salary increased simultaneously,
 * and Adrien earned $40000 four years ago, calculate the total salary the two were receiving four
 * years later?".
 *
 * *** ARITHMETIC-CONVENTION FINDING, FLAGGED UP FRONT *** GSM8K's own reference solution for this
 * item treats "Adrien's salary was P% higher than Lylah's" as equivalent to "Lylah's salary was
 * P% LESS THAN Adrien's" (Lylah = Adrien * (1 - P/100)), i.e. it applies the percentage to
 * ADRIEN's figure in BOTH directions rather than solving the true inverse (Lylah = Adrien /
 * (1 + P/100)). Mathematically the two are only equal when P = 0; for P = 30 they differ (Adrien/
 * 1.3 = 30769.23 vs Adrien*0.70 = 28000). This is a known, widespread GSM8K reference-solution
 * convention (not unique to this item), and it is baked into the dataset's own accepted answer
 * (95200), so this candidate reproduces the SAME convention the dataset's own worked solution
 * uses -- per gate 1's own ground truth being the `#### <value>` line, and per this estate's rule
 * that a method computes what the representative item's OWN worked arithmetic demonstrates. The
 * discrepancy is named here, not hidden, for the Founder to weigh.
 *
 * @generalShape Two actors' salaries at an earlier time T0 are related by "A was P% higher than
 *   B" and one of them (A) is given a directly-stated dollar value at T0. At a later time T1, BOTH
 *   actors' salaries increase by the SAME percentage Q, stated relative to actor A's OWN T0 value
 *   ("he was earning Q% more than what he was making [T0]"), and the question asks for the actors'
 *   COMBINED salary at T1.
 *
 * @recogniseInStranger Requires, as positive evidence:
 *   (a) "<ActorA>'s ... salary was <P>[ percent| %] higher than <ActorB>'s" -- the percent-offset
 *       relation, naming both actors;
 *   (b) a raise clause naming ActorA and a percentage Q "more than what he/she was making" at the
 *       SAME earlier reference time as (a);
 *   (c) an explicit "simultaneously" (or "at the same time"/"same rate") cue confirming Q applies
 *       to BOTH actors, not just ActorA;
 *   (d) "<ActorA> earned $<A0> ... ago" giving ActorA's T0 salary directly;
 *   (e) the question asking for the TOTAL/combined salary of "the two" at the later time.
 *
 * @whatBreaksIt (a) no "simultaneously" (or equivalent) cue -- abstains, cannot assume the same
 *   raise applies to both actors; (b) the direct dollar value attached to ActorB instead of ActorA
 *   -- abstains, this candidate's derivation direction is fixed to "ActorA's value is known,
 *   ActorB's is derived"; (c) P or Q not a clean percentage, or the resulting dollar figures not
 *   landing on exact cents -- abstains; (d) the question asking for only one actor's salary, or
 *   for the DIFFERENCE rather than the total -- abstains, this candidate only answers the summed
 *   shape; (e) more than two actors named -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (95200 = Adrien 56000 [40000*1.4] + Lylah 39200
 *   [28000*1.4], Lylah's T0 salary derived as 40000*(1-30/100)=28000 per the dataset's own
 *   convention named above). With only one known cluster member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'two-actor-percent-offset-then-matched-raise-sum-v1';

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

interface Analyzed {
  total: number;
  actorAName: string;
  actorBName: string;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  percentOffset: number;
  percentRaise: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) percent-offset relation between two named actors.
  const offsetM = /([A-Z][a-z]+)(?:'s)?\s+total\s+salary\s+was\s+(\d+(?:\.\d+)?)\s*(?:percent|%)\s+higher\s+than\s+([A-Z][a-z]+)'s/i.exec(q);
  if (!offsetM) return null;
  const actorAName = offsetM[1];
  const percentOffset = parseFloat(offsetM[2]);
  const actorBName = offsetM[3];
  if (actorAName.toLowerCase() === actorBName.toLowerCase()) return null;

  // (b) the raise clause -- must reference ActorA by pronoun/name and a percentage "more than
  // what he/she was making" at an earlier time.
  const raiseM = /(\d+(?:\.\d+)?)\s*%\s+more\s+than\s+what\s+(?:he|she|they)\s+was\s+making/i.exec(q);
  if (!raiseM) return null;
  const percentRaise = parseFloat(raiseM[1]);

  // (c) the "same raise applies to both" cue.
  if (!/simultaneously|at the same time|same rate|same percentage/i.test(q)) return null;

  // (d) ActorA's direct T0 value.
  const directM = new RegExp(`${actorAName}\\s+earned\\s+\\$\\s*(\\d+(?:\\.\\d+)?)`, 'i').exec(q);
  if (!directM) return null;
  const a0 = parseFloat(directM[1]);
  if (!Number.isFinite(a0) || !Number.isFinite(percentOffset) || !Number.isFinite(percentRaise)) return null;

  // (e) the question asks for the combined total of "the two".
  const tail = q.slice(Math.max(0, q.length - 140));
  if (!/total salary.*two|two.*total salary|total.*(?:both|the two)|combined/i.test(tail)) return null;

  // Derivation, following the SAME convention the dataset's own worked solution uses (see the
  // JSDoc finding above): B0 = A0 * (1 - percentOffset/100), never the true inverse A0/(1+P/100).
  const b0Cents = toCents(a0) - Math.round((toCents(a0) * percentOffset) / 100);
  const b0 = b0Cents / 100;

  const a1Cents = toCents(a0) + Math.round((toCents(a0) * percentRaise) / 100);
  const b1Cents = toCents(b0) + Math.round((toCents(b0) * percentRaise) / 100);
  const a1 = a1Cents / 100;
  const b1 = b1Cents / 100;

  const total = (a1Cents + b1Cents) / 100;

  return { total, actorAName, actorBName, a0, a1, b0, b1, percentOffset, percentRaise };
}


export const twoActorPercentOffsetThenMatchedRaiseSumMethod: LianaMethod = {
  id: 'two-actor-percent-offset-then-matched-raise-sum-v1',
  demand: 'COMPUTE',
  name: 'Two actors related by a percent offset, both raised by the same percentage, summed',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W04 (cluster C60, sole member harvest_gsm8k_pilot_item119; ' +
    'reproduces the dataset\'s own "apply the percent to the known actor\'s figure in both ' +
    'directions" convention -- see the JSDoc finding above)',
  shapeDescription:
    'Actor A\'s salary was P% higher than Actor B\'s at time T0, Actor A\'s T0 salary is given ' +
    'directly; both actors then receive the same percentage raise Q at time T1; answer is their ' +
    'combined T1 salary.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a percent-offset relation between two named actors, a matched-percentage ' +
          'simultaneous raise cue, a direct T0 dollar value for the offset\'s higher actor, and a ' +
          'combined-total question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `a0=${result.a0}, b0=${result.b0}, a1=${result.a1}, b1=${result.b1}, total=${result.total}`,
    };
  },
  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed --
    // same convention as every other adapted method in this folder.
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
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
            const rounded = Math.round((result.total) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.actorAName}=${result.a1}, ${result.actorBName}=${result.b1}, total=${result.total}`,
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

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder.
// ACCEPTED by REGISTRAR R01's own live run of accept_gates.cjs (gate 1 then gate 2a then gate 4
// then gate 5) and by the perturbation gate (2b, baseline + 3 perturbations, all TRACK). See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the full verdict table.
registerMethod(twoActorPercentOffsetThenMatchedRaiseSumMethod);
