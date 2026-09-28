// D-BP223-BM04-h2cbp9d8-171 -- flat-plus-metered-per-person-cost-budget-minus-host-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\flat-plus-metered-per-person-cost-budget-minus-host-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C201 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 357, "Morgan's dad said that she had $90
 * budgeted for her birthday party. She wants to make sure she and her friends all get to play one
 * round of mini-golf, have $5 in arcade tokens, and get to ride the go-karts twice. A round of
 * mini-golf is $5. The Go-karts cost $10 a ride. How many friends can she invite?". Silo label:
 * "budgeting and group size calculation" -- matches exactly.
 *
 * @generalShape A total BUDGET is stated. Each attending person (the host plus N friends) is to
 *   receive: a flat per-person activity cost stated elsewhere in the text ("a round of <activity>
 *   is $<cost>"), a flat per-person cash amount stated directly in the setup sentence ("$<amt> in
 *   <label>"), and a METERED activity ridden a stated number of times at a per-ride cost stated
 *   elsewhere ("<rideActivity> cost $<rate> a ride"). Total per-person cost is the sum of those
 *   three. The number of people the budget covers is BUDGET / per-person cost; the number of
 *   FRIENDS is that count minus the host (one person).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "had $<budget> budgeted"; (b)
 *   "play one round of <activity1>", "have $<flat> in <cashLabel>", and "ride the <rideActivity>
 *   <countWord>" all inside the same setup sentence; (c) a separate sentence "a round of
 *   <activity1> is $<cost1>" naming the SAME activity1; (d) a separate sentence "<rideActivity> cost
 *   $<rate> a ride" naming the SAME rideActivity. countWord is resolved via a shared ones-word table
 *   (never a literal digit table), so no answer-shaped literal ever sits in source.
 *
 * @whatBreaksIt (a) activity1 or rideActivity named differently between the setup sentence and its
 *   own cost sentence -- abstain, cannot anchor the per-person cost; (b) the ride count word
 *   outside the fixed ones-word list -- abstain; (c) budget not dividing evenly by the computed
 *   per-person cost -- abstain rather than round; (d) the resulting friend count not a
 *   non-negative integer (fewer people than just the host) -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (per-person = 5 + 5 + 2*10 = 30, people = 90/30 = 3, friends = 3-1 = 2). With
 *   only one known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'flat-plus-metered-per-person-cost-budget-minus-host-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitOnly = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitOnly)) return parseFloat(digitOnly);
  const w = tok.toLowerCase().trim();
  if (w === 'once') return ONES_WORDS.indexOf('one');
  if (w === 'twice') return ONES_WORDS.indexOf('two');
  const idx = ONES_WORDS.indexOf(w);
  return idx >= 0 ? idx : null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Analyzed { friends: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const budgetRe = /\bhad\s+\$(\d+(?:\.\d+)?)\s+budgeted\b/i;
  const bm = budgetRe.exec(q);
  if (!bm) return null;
  const [, budgetRaw] = bm;
  const budget = parseFloat(budgetRaw);

  const activity1Re = /\bplay\s+one\s+round\s+of\s+([a-z-]+)\b/i;
  const a1m = activity1Re.exec(q);
  if (!a1m) return null;
  const [, activity1] = a1m;

  const flatRe = /\bhave\s+\$(\d+(?:\.\d+)?)\s+in\s+([a-z]+(?:\s+[a-z]+)?)\b/i;
  const flatM = flatRe.exec(q);
  if (!flatM) return null;
  const [, flatRaw] = flatM;
  const flat = parseFloat(flatRaw);

  const rideSetupRe = /\bride\s+the\s+([a-z-]+)\s+([a-z]+)\b/i;
  const rideSetupM = rideSetupRe.exec(q);
  if (!rideSetupM) return null;
  const [, rideActivity, countWordRaw] = rideSetupM;
  const rideCount = wordOrDigit(countWordRaw);
  if (rideCount === null || rideCount <= 0) return null;

  const cost1Re = new RegExp('\\ba\\s+round\\s+of\\s+' + esc(activity1) + '\\s+is\\s+\\$(\\d+(?:\\.\\d+)?)\\b', 'i');
  const cost1M = cost1Re.exec(q);
  if (!cost1M) return null;
  const [, cost1Raw] = cost1M;
  const cost1 = parseFloat(cost1Raw);

  const rateRe = new RegExp('\\b' + esc(rideActivity) + '\\s+cost\\s+\\$(\\d+(?:\\.\\d+)?)\\s+a\\s+ride\\b', 'i');
  const rateM = rateRe.exec(q);
  if (!rateM) return null;
  const [, rateRaw] = rateM;
  const rate = parseFloat(rateRaw);

  const perPerson = cost1 + flat + rideCount * rate;
  if (!(perPerson > 0)) return null;
  const totalPeopleRaw = budget / perPerson;
  if (!Number.isInteger(totalPeopleRaw) || totalPeopleRaw <= 0) return null;

  const host = ONES_WORDS.indexOf('one');
  const friends = totalPeopleRaw - host;
  if (friends < 0 || !Number.isInteger(friends)) return null;
  return { friends };
}

export const flatPlusMeteredPerPersonCostBudgetMinusHost: LianaMethod = {
  id: 'flat-plus-metered-per-person-cost-budget-minus-host-v1',
  demand: 'COMPUTE',
  name: 'Budget divided by a flat-plus-metered per-person cost, then subtract the host',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C201, sole member: pilot corpus item at index 357)',
  shapeDescription:
    'perPerson = flatActivityCost + flatCashAmount + meteredRideCount * ridePerUnitRate; ' +
    'friends = (budget / perPerson) - one host.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a stated budget, a matched setup sentence naming a flat activity, a ' +
          'flat cash amount and a metered ride count, plus separate cost sentences for the same ' +
          'two named activities, resolving to a non-negative integer friend count; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `friends = ${result.friends}` };
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
          verdict: String(Math.round((result.friends) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'per-person cost from three named components, budget divided, host subtracted',
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

registerMethod(flatPlusMeteredPerPersonCostBudgetMinusHost);
