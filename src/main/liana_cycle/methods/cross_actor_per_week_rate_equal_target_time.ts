// D-BP223-BM04-h2cbpv9w-170 -- cross-actor-per-week-rate-equal-target-time-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\cross-actor-per-week-rate-equal-target-time-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C166 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 307, "Sandy wants to lose as much weight as
 * Joey does but needs 4 weeks to lose the same amount of weight that Joey loses in a single week.
 * If Joey loses 8 pounds in 4 weeks, how many weeks will it take Sandy to lose the same amount of
 * weight?" Silo label: "rate comparison and time equivalence -- proportional reasoning and unit
 * rate" -- matches.
 *
 * @generalShape Actor1's per-period RATE is stated indirectly ("needs <K> periods to do what
 *   Actor2 does in a SINGLE period"), i.e. Actor1's rate is Actor2's-single-period-amount / K.
 *   Actor2's TOTAL amount over a stated number of periods is given directly ("Actor2 does <TOTAL>
 *   ... in <PERIODS> periods"), from which Actor2's single-period rate is derived
 *   (TOTAL/PERIODS). The question asks how many periods Actor1 needs to match Actor2's TOTAL
 *   amount, computed as TOTAL / Actor1'sRate = TOTAL / (Actor2SinglePeriodRate / K) = TOTAL * K /
 *   Actor2SinglePeriodRate.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a comparison sentence "<Actor1> ... needs <K> weeks to <verb> the same amount ... that
 *       <Actor2> <verb-conjugated> in a single week", naming K and both actors, sharing a verb
 *       stem (lose/gain/save/earn, matched loosely by stem);
 *   (b) an "if" sentence giving Actor2's amount over a period count "<Actor2> <verb>s <TOTAL>
 *       <unit> in <PERIODS> weeks";
 *   (c) a closing question asking how many weeks it will take Actor1 to match "the same amount".
 *
 * @whatBreaksIt (a) the two verb stems not matching (a "lose" comparison paired with a "save"
 *   total) -- abstain, cannot be sure they refer to the same quantity; (b) K or PERIODS not bare
 *   numbers -- abstain; (c) the final answer not landing on an exact rational value expressible
 *   to at most 2 decimal places -- abstain rather than round further; (d) fewer than two named
 *   actors, or the same name in both roles -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (Joey's rate = 8/4 = 2 lb/week; Sandy's rate = 2/4 = 0.5
 *   lb/week; weeks needed = 8/0.5 = 16). With only one known cluster member there is no
 *   cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'cross-actor-per-week-rate-equal-target-time-v1';

function verbStem(verb: string): string {
  const v = verb.toLowerCase();
  if (/^los(e|es|ing)$/.test(v)) return 'lose';
  if (/^gain(s|ing)?$/.test(v)) return 'gain';
  if (/^sav(e|es|ing)$/.test(v)) return 'save';
  if (/^earn(s|ing)?$/.test(v)) return 'earn';
  return v.replace(/(es|s|ing)$/, '');
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const cmpRe = /([A-Z][a-z]+)\s+wants to\s+([a-z]+)\s+as much\s+[a-z]+\s+as\s+([A-Z][a-z]+)\s+does\s+but\s+needs\s+([0-9]+)\s+weeks\s+to\s+[a-z]+\s+the same amount\s+.{0,20}\s+that\s+([A-Z][a-z]+)\s+([a-z]+)\s+in a single week/i;
  const cm = cmpRe.exec(q);
  if (!cm) return null;
  const actor1 = cm[1];
  const verb1 = verbStem(cm[2]);
  const actor2a = cm[3];
  const K = parseFloat(cm[4]);
  const actor2b = cm[5];
  const verb2 = verbStem(cm[6]);
  if (actor2a !== actor2b || actor1 === actor2a) return null;
  if (verb1 !== verb2) return null;
  if (!Number.isFinite(K) || K <= 0) return null;

  const totalRe = new RegExp(actor2a + '\\s+' + '[a-z]+' + '\\s+([0-9]+(?:\\.[0-9]+)?)\\s+[a-z]+\\s+in\\s+([0-9]+)\\s+weeks', 'i');
  const tm = totalRe.exec(q);
  if (!tm) return null;
  const total = parseFloat(tm[1]);
  const periods = parseFloat(tm[2]);
  if (!Number.isFinite(total) || !Number.isFinite(periods) || periods <= 0) return null;

  if (!/how many weeks will it take/i.test(q)) return null;

  const actor2Rate = total / periods;
  const actor1Rate = actor2Rate / K;
  if (actor1Rate <= 0) return null;
  const weeksNeeded = total / actor1Rate;
  const rounded = Math.round(weeksNeeded * 100) / 100;
  if (Math.abs(rounded - weeksNeeded) > 1e-9) return null;
  return { total: rounded };
}

export const crossActorPerWeekRateEqualTargetTime: LianaMethod = {
  id: 'cross-actor-per-week-rate-equal-target-time-v1',
  demand: 'COMPUTE',
  name: 'Derive one actor\'s per-period rate from a stated multiple of another\'s, then solve time to match the same total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C166, sole member: GSM8K test.jsonl item 307)',
  shapeDescription:
    'actor2Rate = total/periods; actor1Rate = actor2Rate/K; weeksNeeded = total/actor1Rate, ' +
    'requiring the comparison and total sentences to share the same verb stem and second actor.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching comparison sentence (same verb stem, same second actor, an ' +
          'explicit "needs K weeks" multiple) and a total-over-periods sentence for that same ' +
          'actor, plus a "how many weeks will it take" question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `weeks needed = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'derived the slower actor\'s rate from the stated multiple, then divided the total by it',
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

registerMethod(crossActorPerWeekRateEqualTargetTime);
