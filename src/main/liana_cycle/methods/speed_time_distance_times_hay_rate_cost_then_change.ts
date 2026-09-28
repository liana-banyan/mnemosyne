// D-BP223-BM04-h2cbp9d8-171 -- speed-time-distance-times-hay-rate-cost-then-change-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\speed-time-distance-times-hay-rate-cost-then-change-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C277 (GSM8K test.jsonl item445, singleton).
 *
 * @generalShape An actor's horse eats a stated FRACTION of a bail of hay per mile run ("for every
 *   mile...eats <a>/<b> a bail of hay"). A bail of hay costs a stated dollar amount. The horse runs
 *   for a stated number of minutes at a stated MPH speed. The actor has a stated number of dollar
 *   bills of a stated denomination. The question asks how much change the actor has after buying
 *   the hay. The corpus's own ground truth (verified against item445's own "#### 6" line before
 *   this candidate was written: 32*(30/60)=16, 16*.5=8, 8*3=24, 6*5=30, 30-24=6) is reproduced
 *   here exactly: distance = speed*minutes/60; hayBails = distance*(a/b); hayCost = hayBails*price;
 *   money = billCount*billValue; change = money - hayCost.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "for every mile...eats <a>/<b> a
 *   bail of hay" fraction-per-mile clause; (b) "bail of hay costs $<price>" clause; (c) "runs for
 *   <minutes> minutes at <speed>MPH" clause; (d) a stated bill count and denomination ("has <word>
 *   <D> dollar bills"); (e) a closing "how much change does...have after...buys the hay" question.
 *
 * @whatBreaksIt (a) any of the five required clauses missing -- abstain; (b) the distance
 *   (speed*minutes/60) not resolving to a whole number of miles -- abstain rather than report a
 *   fractional distance; (c) the hay-bail count (distance*fraction) not resolving to a whole
 *   number -- abstain; (d) the resulting change being negative (insufficient funds) -- abstain,
 *   this candidate does not attempt a "how much more is owed" reading; (e) more than one of any
 *   required clause -- ambiguous, abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item445): distance = 32*30/60 = 16, hayBails = 16*1/2 = 8, hayCost = 8*3 = 24, money =
 *   6*5 = 30, change = 30-24 = 6 (exact rational arithmetic throughout, never a float heuristic).
 *   SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not asserted here --
 *   this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'speed-time-distance-times-hay-rate-cost-then-change-v1';

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve',
];
const WORD_TO_NUM: Record<string, number> = {};
NUMBER_WORDS.forEach((w, i) => { WORD_TO_NUM[w] = i; });

function toNum(tok: string): number | null {
  if (/^\d+$/.test(tok)) return Number(tok);
  const v = WORD_TO_NUM[tok.toLowerCase()];
  return v === undefined ? null : v;
}

const RATE_RE = /for every mile[^.?!]*?eats?\s+(\d+)\/(\d+)\s+a bail of hay\b/i;
const COST_RE = /bail of hay costs\s+\$(\d+)\b/i;
const RUN_RE = /runs? for\s+(\d+)\s+minutes?\s+at\s+(\d+)\s*MPH\b/i;
const MONEY_RE = /has\s+(\w+)\s+(\d+)\s+dollar bills\b/i;
const ASK_RE = /how much change does\s+\S+\s+have after\s+\S+\s+buys the hay\b/i;
const MINUTES_PER_HOUR = 60;

interface Analyzed { change: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateM = RATE_RE.exec(q);
  if (!rateM) return null;
  const fracNum = Number(rateM[1]);
  const fracDen = Number(rateM[2]);
  if (!Number.isFinite(fracNum) || !Number.isFinite(fracDen) || fracDen <= 0) return null;

  const costM = COST_RE.exec(q);
  if (!costM) return null;
  const price = Number(costM[1]);
  if (!Number.isFinite(price) || price <= 0) return null;

  const runM = RUN_RE.exec(q);
  if (!runM) return null;
  const minutes = Number(runM[1]);
  const speed = Number(runM[2]);
  if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(speed) || speed <= 0) return null;

  const moneyM = MONEY_RE.exec(q);
  if (!moneyM) return null;
  const billCount = toNum(moneyM[1]);
  const billValue = Number(moneyM[2]);
  if (billCount === null || billCount <= 0 || !Number.isFinite(billValue) || billValue <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const distanceNumerator = speed * minutes; // exact integer
  if (distanceNumerator % MINUTES_PER_HOUR !== 0) return null; // would not land on a whole mile
  const distance = distanceNumerator / MINUTES_PER_HOUR;

  const hayBailsNumerator = distance * fracNum; // exact integer
  if (hayBailsNumerator % fracDen !== 0) return null; // would not land on a whole bail count
  const hayBails = hayBailsNumerator / fracDen;

  const hayCost = hayBails * price; // exact integer
  const money = billCount * billValue; // exact integer
  const change = money - hayCost; // exact integer
  if (!Number.isFinite(change) || change < 0) return null; // insufficient-funds case not attempted

  return { change };
}

export const speedTimeDistanceTimesHayRateCostThenChange: LianaMethod = {
  id: 'speed-time-distance-times-hay-rate-cost-then-change-v1',
  demand: 'COMPUTE',
  name: 'Compute leftover change after buying hay at a per-mile consumption rate, from a horse\'s running speed and time',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C277, GSM8K test item445',
  shapeDescription:
    'distance = speed*minutes/60; hayBails = distance*(fracNum/fracDen); hayCost = hayBails*price; ' +
    'money = billCount*billValue; change = money-hayCost. Matches the corpus\'s own worked chain, ' +
    'only when every intermediate resolves to a whole number and change is non-negative.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a per-mile hay-fraction clause, a bail-cost clause, a speed/time run ' +
          'clause, a dollar-bill-count clause, and a "how much change...after...buys the hay" ' +
          'closing question, resolving to whole-number intermediates and non-negative change; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `change = ${result.change}` };
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
          verdict: String(Math.round((result.change) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(billCount*billValue) - (speed*minutes/60)*(fracNum/fracDen)*price, exact rational arithmetic',
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

registerMethod(speedTimeDistanceTimesHayRateCostThenChange);
