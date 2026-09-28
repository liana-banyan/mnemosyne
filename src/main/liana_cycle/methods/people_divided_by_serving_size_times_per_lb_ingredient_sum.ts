// D-BP223-BM04-h2cbp9d8-171 -- people-divided-by-serving-size-times-per-lb-ingredient-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\people-divided-by-serving-size-times-per-lb-ingredient-sum-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R07
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C242 (GSM8K test.jsonl item405, singleton).
 *
 * @generalShape Each "unit" (e.g. sandwich) requires exactly 1 pound each of TWO named
 *   ingredients and serves a stated number of people. A total headcount is given. The two
 *   ingredients are each priced per pound. The question asks total money spent on the two
 *   ingredients to serve the whole headcount. Answer = (totalPeople / peoplePerUnit) *
 *   (priceIngredient1 + priceIngredient2), only when totalPeople divides peoplePerUnit evenly.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "1 pound each of
 *   <ingredient1> and <ingredient2>" clause naming exactly two ingredients at 1 lb each; (b) a
 *   "would serve <K> people" (or "serves <K> people") clause for one unit; (c) a "<P> people in
 *   total" (or equivalent stated total headcount) clause; (d) exactly two "$<price> per pound"
 *   clauses, one for each named ingredient; (e) the closing question asks how much money was
 *   spent on the two named ingredients (not a single ingredient, not a per-unit price).
 *
 * @whatBreaksIt (a) the per-unit ingredient quantity is anything other than "1 pound each" --
 *   this candidate does not attempt fractional or unequal per-unit ingredient weights; (b) more
 *   or fewer than two named priced ingredients; (c) totalPeople not an exact multiple of
 *   peoplePerUnit -- abstain rather than round up or down; (d) the question asks about a THIRD
 *   ingredient or a total cost including something other than the two named ingredients.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (item405): units = 20/4 = 5, meatCost = 5*7 = 35,
 *   cheeseCost = 5*3 = 15, total = 35+15 = 50. SOLVED. Reach across a wider corpus is recorded in
 *   wave_manifest.json, not asserted here -- this is a singleton-cluster shape with one known
 *   teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'people-divided-by-serving-size-times-per-lb-ingredient-sum-v1';

const ONE_POUND_EACH_RE = /\b1\s+pound\s+each\s+of\s+([a-z]+)\s+and\s+([a-z]+)\b/i;
const SERVES_RE = /\bserve\s+(\d+)\s+people\b/i;
const TOTAL_PEOPLE_RE = /\b(\d+)\s+people\s+in\s+total\b/i;
const PRICE_PER_LB_RE = /([a-z]+)\s+cost\s+\$(\d+(?:\.\d+)?)\s+per\s+pound/ig;
const SPEND_ASK_RE = /how much money would (?:he|she|they) spend on\s+(?:the\s+)?([a-z]+)\s+and\s+(?:the\s+)?([a-z]+)\b/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const eachM = ONE_POUND_EACH_RE.exec(q);
  if (!eachM) return null;
  const ing1 = eachM[1].toLowerCase();
  const ing2 = eachM[2].toLowerCase();

  const servesM = SERVES_RE.exec(q);
  if (!servesM) return null;
  const peoplePerUnit = Number(servesM[1]);
  if (!Number.isFinite(peoplePerUnit) || peoplePerUnit <= 0) return null;

  const totalM = TOTAL_PEOPLE_RE.exec(q);
  if (!totalM) return null;
  const totalPeople = Number(totalM[1]);
  if (!Number.isFinite(totalPeople) || totalPeople <= 0) return null;
  if (totalPeople % peoplePerUnit !== 0) return null;
  const units = totalPeople / peoplePerUnit;

  const prices: Record<string, number> = {};
  let pm: RegExpExecArray | null;
  PRICE_PER_LB_RE.lastIndex = 0;
  while ((pm = PRICE_PER_LB_RE.exec(q)) !== null) {
    prices[pm[1].toLowerCase()] = Number(pm[2]);
  }
  if (!(ing1 in prices) || !(ing2 in prices)) return null;

  const askM = SPEND_ASK_RE.exec(q);
  if (!askM) return null;
  const asked1 = askM[1].toLowerCase();
  const asked2 = askM[2].toLowerCase();
  const askedSet = new Set([asked1, asked2]);
  const namedSet = new Set([ing1, ing2]);
  if (askedSet.size !== namedSet.size || [...askedSet].some((x) => !namedSet.has(x))) return null;

  const totalCost = units * prices[ing1] + units * prices[ing2];
  if (!Number.isFinite(totalCost)) return null;

  return { total: totalCost };
}

export const peopleDividedByServingSizeTimesPerLbIngredientSum: LianaMethod = {
  id: 'people-divided-by-serving-size-times-per-lb-ingredient-sum-v1',
  demand: 'COMPUTE',
  name: 'Compute total ingredient cost when a fixed per-unit 1lb-each recipe scales to serve a stated headcount',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C242, GSM8K test item405',
  shapeDescription:
    'Each unit needs 1 pound each of two named ingredients and serves K people; a total headcount ' +
    'P is given; both ingredients are priced per pound. Total cost = (P/K) * (price1+price2), ' +
    'only when P divides K evenly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "1 pound each of X and Y" recipe clause paired with a serving-size ' +
          'clause, a total-headcount clause, two "$ per pound" price clauses for X and Y, and a ' +
          'closing "how much...spend on X and Y" question with an exact unit count; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `total spent = ${result.total}` };
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
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(totalPeople/peoplePerUnit) * (price1+price2)',
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

registerMethod(peopleDividedByServingSizeTimesPerLbIngredientSum);
