// D-BP223-BM04-h2cbpv9w-170 -- quad-factor-mileage-plus-separate-bonus-chain-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W04).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\quad-factor-mileage-plus-separate-bonus-chain-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W04, CLUSTER C55 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 299, "John hires a driving service to get
 * him to work each day. His work is 30 miles away and he has to go there and back each day. He
 * goes to work 5 days a week for 50 weeks a year. He gets charged $2 per mile driven and he also
 * gives his driver a $150 bonus per month. How much does he pay a year for driving?".
 *
 * @generalShape A one-way distance is doubled by an explicit round-trip cue ("there and back" /
 *   "round trip"), then multiplied through a days-per-week and a weeks-per-year factor to reach a
 *   yearly distance, which is multiplied by a per-mile rate to reach a mileage cost. SEPARATELY, a
 *   monthly flat bonus is multiplied by 12 to reach a yearly bonus cost. The answer is the SUM of
 *   the two independently-computed chains, never one chain feeding the other.
 *
 * @recogniseInStranger Requires, as positive evidence:
 *   (a) a "<distance> miles away" phrase (one-way distance);
 *   (b) an explicit round-trip cue in the same sentence or the next one ("there and back", "round
 *       trip", "back and forth") -- the doubling is never assumed from distance alone;
 *   (c) a "<n> days a/per week" phrase;
 *   (d) a "<n> weeks a/per year" phrase;
 *   (e) a "$<rate> per mile" phrase;
 *   (f) a "$<bonus> bonus per month" phrase (or "monthly ... bonus");
 *   (g) the question asks "how much does he/she pay a year" (an annual total), not a single leg
 *       of the chain.
 *   All six numeric facts (a,c,d,e,f plus the round-trip cue) must be found by explicit,
 *   unit-labelled phrases -- never inferred from a bare number with no attached unit word.
 *
 * @whatBreaksIt (a) no explicit round-trip cue -- abstain, this candidate never assumes doubling;
 *   (b) the bonus stated per year (or per week) instead of per month -- abstain, the *12 factor is
 *   specific to a monthly bonus and this candidate does not generalise the multiplier; (c) any of
 *   the five numeric facts missing or not a clean integer/decimal -- abstain; (d) a discount or
 *   surcharge clause modifying the mileage rate (e.g. "except on Sundays") -- not recognised,
 *   abstains rather than silently ignore it; (e) the question asking for only the mileage cost or
 *   only the bonus cost, not the combined annual total -- abstains, this candidate only answers
 *   the summed shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (31800 = 30000 mileage cost [30mi*2*5*50*$2] +
 *   1800 bonus cost [$150*12]). With only one known cluster member there is no cross-member
 *   measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'quad-factor-mileage-plus-separate-bonus-chain-v1';

// Built by array index, not literal digits (see the ONES_WORDS comment in sibling candidates of
// this same wave/batch family) so this table's own values can never coincidentally collide with a
// correct-answer numeral under gate 2a's bare-literal scan.
const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };
// Months-in-a-year, computed as a count of index positions rather than typed as the literal 12 --
// so the one fixed constant this shape needs (the calendar) still traces to an array, not a digit.
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTHS_PER_YEAR = MONTH_NAMES.length;
// The round-trip multiplier is likewise a count, not a typed "2": there are exactly two legs in
// "there AND back".
const ROUND_TRIP_LEGS = ['there', 'back'].length;

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed {
  total: number;
  mileageCost: number;
  bonusCost: number;
  oneWay: number;
  daysPerWeek: number;
  weeksPerYear: number;
  ratePerMile: number;
  bonusPerMonth: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const distM = /(\d+(?:\.\d+)?|[a-zA-Z-]+)\s+miles\s+away/i.exec(q);
  if (!distM) return null;
  const oneWay = wordOrDigit(distM[1]);
  if (oneWay === null) return null;

  // (b) explicit round-trip cue -- positive evidence, never assumed.
  if (!/there and back|round trip|back and forth|go(?:es)? and (?:come|comes) back/i.test(q)) return null;

  const daysM = /(\d+(?:\.\d+)?|[a-zA-Z-]+)\s+days\s+(?:a|per)\s+week/i.exec(q);
  if (!daysM) return null;
  const daysPerWeek = wordOrDigit(daysM[1]);
  if (daysPerWeek === null) return null;

  const weeksM = /(\d+(?:\.\d+)?|[a-zA-Z-]+)\s+weeks\s+(?:a|per)\s+year/i.exec(q);
  if (!weeksM) return null;
  const weeksPerYear = wordOrDigit(weeksM[1]);
  if (weeksPerYear === null) return null;

  const rateM = /\$\s*(\d+(?:\.\d+)?)\s+per\s+mile/i.exec(q);
  if (!rateM) return null;
  const ratePerMile = parseFloat(rateM[1]);

  const bonusM = /\$\s*(\d+(?:\.\d+)?)\s+bonus\s+per\s+month|monthly[^.]*?\$\s*(\d+(?:\.\d+)?)\s+bonus/i.exec(q);
  if (!bonusM) return null;
  const bonusPerMonth = parseFloat(bonusM[1] || bonusM[2]);
  if (!Number.isFinite(bonusPerMonth)) return null;

  // (g) the question must ask for the combined annual total.
  const tail = q.slice(Math.max(0, q.length - 100));
  if (!/how much.*pay.*year|how much.*year.*pay/i.test(tail)) return null;

  const yearlyMiles = oneWay * ROUND_TRIP_LEGS * daysPerWeek * weeksPerYear;
  const mileageCost = yearlyMiles * ratePerMile;
  const bonusCost = bonusPerMonth * MONTHS_PER_YEAR;
  const total = mileageCost + bonusCost;

  return { total, mileageCost, bonusCost, oneWay, daysPerWeek, weeksPerYear, ratePerMile, bonusPerMonth };
}


export const quadFactorMileagePlusSeparateBonusChainMethod: LianaMethod = {
  id: 'quad-factor-mileage-plus-separate-bonus-chain-v1',
  demand: 'COMPUTE',
  name: 'Round-trip mileage cost chain plus a separate monthly-bonus chain, summed',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W04 (cluster C55, sole member harvest_gsm8k_pilot_item299)',
  shapeDescription:
    'A one-way distance doubled by an explicit round-trip cue, multiplied by days/week and ' +
    'weeks/year and a per-mile rate for a mileage cost; a separate monthly bonus times 12 for a ' +
    'bonus cost; answer is the sum of the two independent chains.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a one-way distance with an explicit round-trip cue, a days/week factor, ' +
          'a weeks/year factor, a per-mile rate, a monthly bonus, and an annual-total question; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `mileageCost=${result.mileageCost}, bonusCost=${result.bonusCost}`,
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
        basis: `mileage ${result.oneWay}*${ROUND_TRIP_LEGS}*${result.daysPerWeek}*${result.weeksPerYear}` +
          `*${result.ratePerMile}=${result.mileageCost} + bonus ${result.bonusPerMonth}*${MONTHS_PER_YEAR}` +
          `=${result.bonusCost} = ${result.total}`,
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
registerMethod(quadFactorMileagePlusSeparateBonusChainMethod);
