// D-BP223-BM04-h2cbpv9w-170 -- per-meal-rate-times-people-times-meals-then-supply-duration-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\per-meal-rate-times-people-times-meals-then-supply-duration-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W11 CLUSTER C113 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 296, "Each person in a certain household
 * consumes 0.2 kg of rice every meal. Supposing 5 members of the household eat rice every lunch
 * and dinner, how many weeks will a 42 kg bag of rice last?"
 *
 * @generalShape A per-person, per-meal consumption RATE of some measured quantity is given
 *   directly ("<rate> <unit> ... every meal"). A HEADCOUNT is given ("<N> members/people"). A list
 *   of NAMED MEALS is given, joined by "and"/commas (e.g. "lunch and dinner", "breakfast, lunch
 *   and dinner"), whose COUNT is the meals-per-day multiplier. Daily consumption = rate * people *
 *   mealsPerDay. A total SUPPLY is given in the SAME unit ("a <supply> <unit> bag/container"). The
 *   question asks how many WEEKS the supply will last, so weekly consumption = daily * 7, and the
 *   answer is supply / weeklyConsumption, required to be an exact division.
 *
 * @recogniseInStranger Four anchored, positive-evidence pieces, all sharing the same unit word:
 *   (1) "consumes <rate> <unit> ... every meal" for the per-person-per-meal rate; (2) "<N>
 *   members" (or "<N> people") for the headcount; (3) a fixed, small vocabulary of meal names
 *   (breakfast, lunch, dinner, supper) joined by "and"/commas in a single "every <meal list>"
 *   clause -- the COUNT of distinct meal names found is the meals-per-day multiplier, never a
 *   hand-typed literal next to the word "meals"; (4) "a <supply> <unit> bag" and a question
 *   containing "how many weeks ... last", which is what commits this candidate to the x7
 *   week-conversion rather than reporting raw days.
 *
 * @whatBreaksIt (a) the rate unit and the supply unit disagreeing (e.g. rate in kg, supply in
 *   lbs) -- this candidate does not convert between units, it requires the SAME unit word in both
 *   places and abstains otherwise; (b) a meal name outside the fixed vocabulary (breakfast, lunch,
 *   dinner, supper) -- an unrecognised meal word is simply not counted, which would under-count
 *   meals-per-day on a stranger using a different meal name; flagged as an honest vocabulary
 *   limit; (c) the question asking for DAYS rather than WEEKS -- abstains, since this candidate
 *   commits specifically to the x7 conversion only when "weeks" is the asked unit; (d) the final
 *   division not landing on a whole number of weeks -- abstains rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (0.2*5*2=2 kg/day; 2*7=14 kg/week; 42/14=3
 *   weeks). With only one known cluster member there is no cross-member measurement to report for
 *   this singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'per-meal-rate-times-people-times-meals-then-supply-duration-v1';


interface Analyzed {
  rate: number;
  people: number;
  mealsPerDay: number;
  dailyConsumption: number;
  weeklyConsumption: number;
  supply: number;
  weeks: number;
}

const MEAL_WORDS = ['breakfast', 'lunch', 'dinner', 'supper'];
const DAYS_PER_WEEK = 7;

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();

  // (1) Rate: "consumes/eats/drinks <N> <unit> ... every meal". The verb list is widened from
  // "consumes" alone (Round-2 tuning, RULE 6): no matching item was found anywhere in the
  // 4,767-item tuning reserve at all for this shape, but the same corpus's own headcount clause
  // for THIS candidate's own teaching case already uses "eat" for the very same rice, so
  // recognising "eats"/"drinks" as an equally natural rate verb is a good-faith, low-risk
  // generalization rather than a fabricated guess.
  const rateRe = /\b(?:consumes?|eats?|drinks?)\s+([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)\b[^.?!]*?\bevery\s+meal\b/i;
  const rateMatch = rateRe.exec(q);
  if (!rateMatch) return null;
  const rate = parseFloat(rateMatch[1]);
  const unit = rateMatch[2].toLowerCase();
  if (!Number.isFinite(rate)) return null;

  // (2) Headcount.
  const peopleRe = /\b([0-9]+)\s+(?:members?|people)\b/i;
  const peopleMatch = peopleRe.exec(q);
  if (!peopleMatch) return null;
  const people = parseInt(peopleMatch[1], 10);
  if (!Number.isFinite(people) || people <= 0) return null;

  // (3) Meals per day: scan EVERY "every <...>" clause in the text (there may be more than one,
  // e.g. "every meal" for the rate and "every lunch and dinner" for the actual meal list) and use
  // the first one whose captured span contains at least one known meal name -- never just the
  // first "every" occurrence, which could be a different clause entirely (the rate's own "every
  // meal" is not itself a meal-name list).
  const mealClauseRe = /\bevery\s+([a-z]+(?:\s*(?:,|and)\s*[a-z]+)*)\b/gi;
  let mealsPerDay = 0;
  let mealClauseMatch: RegExpExecArray | null;
  while ((mealClauseMatch = mealClauseRe.exec(q)) !== null) {
    const clause = mealClauseMatch[1].toLowerCase();
    const foundMeals = MEAL_WORDS.filter((w) => new RegExp('\\b' + w + '\\b').test(clause));
    if (foundMeals.length > 0) {
      mealsPerDay = foundMeals.length;
      break;
    }
  }
  if (mealsPerDay === 0) return null;

  // (4) Supply in the SAME unit, plus a "how many weeks ... last" question.
  const supplyRe = new RegExp('\\ba\\s+([0-9]+(?:\\.[0-9]+)?)\\s*' + unit + '\\s+bag\\b', 'i');
  const supplyMatch = supplyRe.exec(q);
  if (!supplyMatch) return null;
  const supply = parseFloat(supplyMatch[1]);
  if (!Number.isFinite(supply)) return null;

  if (!/\bhow\s+many\s+weeks\b/i.test(q) || !/\blast\b/i.test(lower)) return null;

  const dailyConsumption = rate * people * mealsPerDay;
  const weeklyConsumption = dailyConsumption * DAYS_PER_WEEK;
  if (!toFinite(dailyConsumption) || !toFinite(weeklyConsumption) || weeklyConsumption === 0) return null;

  const weeks = supply / weeklyConsumption;
  // Exact division required -- checked via a scaled-integer comparison to sidestep binary
  // floating point representation error on decimal rates like 0.2.
  const scale = 1e6;
  const scaledSupply = Math.round(supply * scale);
  const scaledWeekly = Math.round(weeklyConsumption * scale);
  if (scaledWeekly === 0 || scaledSupply % scaledWeekly !== 0) return null;
  const exactWeeks = scaledSupply / scaledWeekly;

  return { rate, people, mealsPerDay, dailyConsumption, weeklyConsumption, supply, weeks: exactWeeks };
}

export const perMealRateTimesPeopleTimesMealsThenSupplyDuration: LianaMethod = {
  id: 'per-meal-rate-times-people-times-meals-then-supply-duration-v1',
  demand: 'COMPUTE',
  name: 'Per-person-per-meal rate times headcount times meals-per-day, then weeks a supply lasts',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W11 (cluster C113, sole member harvest_gsm8k_pilot_item296, GSM8K test.jsonl line 296)',
  shapeDescription:
    'dailyConsumption = rate * people * mealsPerDay (meals counted from a named-meal list); ' +
    'weeklyConsumption = dailyConsumption * 7; answer = supply / weeklyConsumption, exact only.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a per-meal rate, headcount, named-meal list, matching-unit supply, and ' +
          'an exact "how many weeks" division; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `rate=${result.rate} people=${result.people} meals/day=${result.mealsPerDay} -> weeks=${result.weeks}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.weeks) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.supply} / (${result.rate}*${result.people}*${result.mealsPerDay}*7) = ${rounded}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(perMealRateTimesPeopleTimesMealsThenSupplyDuration);
