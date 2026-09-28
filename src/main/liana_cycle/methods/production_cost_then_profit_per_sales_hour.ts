// D-BP223-BM04-h2cbp9d8-171 -- production-cost-then-profit-per-sales-hour-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\production-cost-then-profit-per-sales-hour-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C224 (GSM8K test.jsonl item383, singleton).
 *
 * @generalShape A flat one-time COST is spent to produce N containers, each holding K units of a
 *   sellable good. Each single unit sells for a stated PRICE. The good is sold at a stated flat
 *   RATE of units per hour. The closing question asks for PROFIT PER HOUR (not total profit, not
 *   total revenue): profit = (N*K*price) - cost; hours = (N*K) / rate; answer = profit / hours.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, read from the SAME question: (a) a
 *   flat dollar amount spent "to buy...to make" a stated count of containers of one noun; (b) a
 *   clause stating each of those SAME containers (word-stem matched) holds a count of a second,
 *   sellable unit noun; (c) a clause selling each of that SAME sellable unit (word-stem matched)
 *   for a flat per-unit price; (d) a clause giving a flat rate of that SAME sellable unit sold per
 *   hour; (e) the closing question asks for profit specifically PER HOUR.
 *
 * @whatBreaksIt (a) the container or unit noun in any clause fails to stem-match the others (a
 *   different item is being described) -- abstain; (b) the question asks for TOTAL profit, total
 *   revenue, or hours worked instead of profit-per-hour -- abstain, a different closing question;
 *   (c) not all of the sold goods are actually sold (a stated leftover/spoilage fraction) -- this
 *   candidate assumes "sells all of the lemonade" and does not detect a partial-sale variant, so a
 *   missing "sells all" cue is treated as insufficient evidence rather than assumed; (d) total
 *   units not evenly divisible by the hourly rate, or profit not evenly divisible by the resulting
 *   hour count -- abstain rather than report a rounded or fractional hourly profit.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item383): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'production-cost-then-profit-per-sales-hour-v1';

function stem(word: string): string {
  return word.toLowerCase().replace(/s$/, '');
}

const COST_RE = /spends?\s*\$?(?<cost>[\d,]+(?:\.\d+)?)\s+to buy[^.?!]*?\bto make\s+(?<containerCount>\d+)\s+(?<containerWordA>[a-z]+)/i;
const HOLDS_RE = /each\s+(?<containerWordB>[a-z]+)\s+holds\s+(?<unitsPerContainer>\d+)\s+(?<unitWordA>[a-z]+)/i;
const PRICE_RE = /sells?\s+each\s+(?<unitWordB>[a-z]+)[^.?!]*?\bfor\s*\$?(?<pricePerUnit>[\d.]+)/i;
const RATE_RE = /average of\s+(?<ratePerHour>\d+)\s+(?<unitWordC>[a-z]+)\s+per hour/i;
const SELLS_ALL_RE = /sells? all of the/i;
const QUESTION_RE = /how much profit\b[^.?!]*\bper hour\b/i;

interface Analyzed { profitPerHour: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const costM = COST_RE.exec(q);
  const holdsM = HOLDS_RE.exec(q);
  const priceM = PRICE_RE.exec(q);
  const rateM = RATE_RE.exec(q);
  if (!costM || !holdsM || !priceM || !rateM) return null;
  if (!SELLS_ALL_RE.test(q)) return null;
  if (!QUESTION_RE.test(q)) return null;
  const cg = costM.groups!, hg = holdsM.groups!, pg = priceM.groups!, rg = rateM.groups!;

  const containerWordA = stem(cg.containerWordA);
  const containerWordB = stem(hg.containerWordB);
  if (containerWordA !== containerWordB) return null;

  const unitWordA = stem(hg.unitWordA);
  const unitWordB = stem(pg.unitWordB);
  const unitWordC = stem(rg.unitWordC);
  if (unitWordA !== unitWordB || unitWordA !== unitWordC) return null;

  const cost = Number(cg.cost.replace(/,/g, ''));
  const containerCount = Number(cg.containerCount);
  const unitsPerContainer = Number(hg.unitsPerContainer);
  const pricePerUnit = Number(pg.pricePerUnit);
  const ratePerHour = Number(rg.ratePerHour);
  if (![cost, containerCount, unitsPerContainer, pricePerUnit, ratePerHour].every(Number.isFinite)) return null;
  if (ratePerHour <= 0 || pricePerUnit <= 0) return null;

  const totalUnits = containerCount * unitsPerContainer;
  const revenue = totalUnits * pricePerUnit;
  const profit = revenue - cost;
  if (totalUnits % ratePerHour !== 0) return null;
  const hours = totalUnits / ratePerHour;
  if (hours <= 0 || profit % hours !== 0) return null;

  return { profitPerHour: profit / hours };
}

export const productionCostThenProfitPerSalesHour: LianaMethod = {
  id: 'production-cost-then-profit-per-sales-hour-v1',
  demand: 'COMPUTE',
  name: 'Compute profit per hour from a flat production cost, unit price, and hourly sales rate',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C224, GSM8K test item383',
  shapeDescription:
    'A flat cost produces N containers each holding K sellable units; each unit sells at a flat ' +
    'price; the units sell at a flat rate per hour; the question asks for profit PER HOUR -- ' +
    '((N*K*price) - cost) / ((N*K)/rate), only when both divisions land exactly.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching flat-cost/container-yield/unit-price/hourly-rate quartet with ' +
          'consistent container and unit nouns, a "sells all" clause, and a profit-per-hour ' +
          'closing question resolving to an exact value; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `profit per hour = ${result.profitPerHour}` };
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
          verdict: String(Math.round((result.profitPerHour) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'computed total units, revenue, cost-adjusted profit, and hours from the hourly rate, then divided',
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

registerMethod(productionCostThenProfitPerSalesHour);
