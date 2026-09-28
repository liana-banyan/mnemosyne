// D-BP221-BM06-009 -- percentage-markup-resale-profit-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\harvest_gsm8k_pilot_item115_profit_calculation_based_on_price_increa.candidate.ts
//
// SIXTH item-10 method filed, fifth adapted by BM06. Local `LianaQuestionInput`, `ShapeTestResult`
// and `RunResult` deleted; `: LianaMethod` on the exported object does the checking now.
//
// BEHAVIOR CORE BYTE-FOR-BYTE: `QUANTITY_WORDS`, `QUANTITY_ALT`, `LOT_RE`, `PCT_FORWARD_RE`,
// `PCT_REVERSE_RE`, `DISQUALIFYING_SALE_PRICE_RE`, `DISQUALIFYING_KEYWORDS`,
// `stripDimensionChains()`, `parseQuantityToken()`, the `Analysis` helper type and `analyze()` are
// the candidate's own bytes, diffed clean.
//
// LIKE per_unit_discount_rebate_subtraction.ts AND UNLIKE THE OTHERS, no rounding is added: the
// candidate already rounds to cents (`Math.round(profit * 100) / 100`) because the answer is money.
// Re-rounding an already-rounded currency figure would be a change dressed as a convention.
//
// NOTE: dist held an orphaned percentage_markup_resale_profit.js from 23:48:10Z, compiled from the
// earlier non-conforming source and imported by nobody. Building this file overwrites it.

/**
 * @generalShape A multi-lot resale-under-uniform-markup problem: the text hands over two or
 *   more purchased lots, each with its own quantity and its own per-unit purchase cost, then
 *   states that ALL of them are resold at a single, uniform percentage price increase over
 *   their original cost. Because the markup percentage is the same for every lot, profit
 *   collapses to one closed-form step: (markup percentage) x (sum of quantity x unit cost
 *   across every lot). No per-lot selling price ever needs to be computed and re-summed.
 *
 * @recogniseInStranger The question (a) contains the whole word "profit"; (b) yields exactly
 *   one percentage price-increase cue -- a number tagged "%" sitting next to an up/increase/
 *   raised/hiked word, in either word order ("gone up 50%" or "50% increase"), with no second
 *   such cue anywhere else in the text; (c) yields 2 to 6 distinct "lot" phrases, each a
 *   quantity (digit or number-word) followed, within the same sentence, by a purchase verb
 *   (cost/bought/paid/purchased) and then a per-unit dollar figure tagged "each"/"apiece"/
 *   "a piece"/"per <unit>"; and (d) contains no explicit direct sale-price phrase ("sells/sold/
 *   resells ... $N") and none of a short blacklist of unrelated cost adjustments (tax,
 *   shipping, discount, commission, depreciation, wholesale, compound interest, rebate,
 *   coupon) that would break the naive single-percentage formula even if every other cue is
 *   present. All conditions must hold together; any single one missing means abstain.
 *
 * @whatBreaksIt A question where the percentage increase applies to only SOME of the lots
 *   rather than uniformly to all of them (a second, differently priced markup hiding in the
 *   prose); a question with an extra flat cost -- a delivery fee, storage cost, or one-time
 *   tax -- that must be subtracted from the naive markup profit; a percentage cue that
 *   describes something other than a resale price even though an "up/increase" word sits next
 *   to it by coincidence (a defect rate, an interest rate, a population change); or a lot
 *   whose true per-unit cost is only recoverable from a stated TOTAL ("she spent $100 on ten
 *   boards" with no "each") rather than an explicit per-unit figure -- this method never
 *   infers a per-unit price by dividing a total, so it correctly finds no lot there rather
 *   than risk misreading which number is per-unit. Any of these leaves the surface cues
 *   (profit word, one percentage, plausible lot count) intact while making the single-
 *   percentage-times-total-cost formula confidently wrong.
 *
 * @whenRecognitionIsWrong shapeTest() and run() both call the same analyze() pass, so if any
 *   guard fails at either stage (the profit-word check, the disqualifying-phrase blacklist,
 *   the exactly-one-percentage check, the 2-6 lot-count window, or a lot number that fails to
 *   parse to a finite positive value) the method abstains: verdict null, abstain true. An
 *   honest abstain costs nothing -- the engine falls through to the next eligible method. A
 *   false MATCH would instead apply the single-percentage formula to the wrong set of lots (or
 *   to a percentage that was never a resale markup) and hand back a confident wrong number that
 *   ends the whole loop, which is why every guard above is written to be over-inclusive in what
 *   it refuses and quarantined:true keeps this method out of selection until it has been
 *   measured against held-out questions.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const QUANTITY_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, dozen: 12,
};
const QUANTITY_ALT = Object.keys(QUANTITY_WORDS).join('|');

// A window-bounded "lot" pattern: a quantity, then (within the same sentence) a purchase-cost
// verb, then (within a further short window) a per-unit dollar amount tagged "each"/"apiece"/
// "a piece"/"per <unit>". Requiring a purchase verb (cost/bought/paid/purchased) rather than any
// nearby dollar figure means an unrelated per-unit dollar figure in the same clause (e.g. a
// stated selling price) is not mistaken for this lot's cost.
const LOT_RE = new RegExp(
  `\\b(\\d+|${QUANTITY_ALT})\\b[^.]{0,70}?\\b(?:cost|costs|bought|paid|purchased|purchase)\\b[^.]{0,40}?\\$(\\d+(?:\\.\\d+)?)\\s*(?:each|apiece|a\\s+piece|per\\s+\\w+)`,
  'gi',
);

// A single global percentage price-INCREASE cue, checked in both word orders. More than one
// match is ambiguous (which lot(s) does each apply to?); fewer than one means there is nothing
// to derive a uniform markup from.
const PCT_FORWARD_RE = /\b(?:gone up|goes up|going up|went up|risen|rose|rising|up|increased?|increase|raised?|climbed|jumped|hiked?)\b[^.]{0,25}?(\d+(?:\.\d+)?)\s*%/gi;
const PCT_REVERSE_RE = /(\d+(?:\.\d+)?)\s*%[^.]{0,25}?\b(?:increase|increased|higher|more|hike|up)\b/gi;

// An explicit direct sale/selling dollar figure means the selling price was handed over
// directly rather than derived from the percentage markup -- a different derivation this
// method must not attempt. The keyword list catches unrelated cost adjustments that would
// break the naive "profit = pct% x total original cost" formula even when every other cue is
// present.
const DISQUALIFYING_SALE_PRICE_RE = /\b(?:sells?|selling|sold|resells?|reselling)\b[^.]{0,30}?\$\s*\d/i;
const DISQUALIFYING_KEYWORDS = [
  'discount', 'tax', 'shipping', 'commission', 'fee', 'depreciat', 'markdown',
  'wholesale', 'compound', 'interest rate', 'loss of', 'at a loss', 'rebate', 'coupon',
];

function stripDimensionChains(text: string): string {
  // "2 x 4 x 10" style board/lumber dimension strings must never be read as a quantity --
  // strip every N (x N)+ chain before lot extraction.
  return text.replace(/\d+(?:\s*[xX]\s*\d+)+/g, ' ');
}

function parseQuantityToken(token: string): number {
  const t = token.toLowerCase();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return QUANTITY_WORDS[t] ?? NaN;
}

interface Analysis {
  lots: Array<{ qty: number; unitCost: number }>;
  pct: number;
}

function analyze(rawQuestion: unknown): Analysis | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const question = rawQuestion.trim();
  const lower = question.toLowerCase();

  if (!/\bprofit\b/i.test(question)) return null;
  if (DISQUALIFYING_SALE_PRICE_RE.test(question)) return null;
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  // Exactly one percentage price-increase cue, tried in both word orders.
  const forwardMatches: string[] = [];
  PCT_FORWARD_RE.lastIndex = 0;
  let fm: RegExpExecArray | null;
  while ((fm = PCT_FORWARD_RE.exec(question)) !== null) forwardMatches.push(fm[1]);
  let pctValues = forwardMatches;
  if (pctValues.length === 0) {
    const reverseMatches: string[] = [];
    PCT_REVERSE_RE.lastIndex = 0;
    let rm: RegExpExecArray | null;
    while ((rm = PCT_REVERSE_RE.exec(question)) !== null) reverseMatches.push(rm[1]);
    pctValues = reverseMatches;
  }
  if (pctValues.length !== 1) return null;
  const pct = parseFloat(pctValues[0]);
  if (!Number.isFinite(pct) || pct <= 0) return null;

  const cleaned = stripDimensionChains(question);
  const lots: Array<{ qty: number; unitCost: number }> = [];
  LOT_RE.lastIndex = 0;
  let lm: RegExpExecArray | null;
  while ((lm = LOT_RE.exec(cleaned)) !== null) {
    const qty = parseQuantityToken(lm[1]);
    const unitCost = parseFloat(lm[2]);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) {
      return null; // a lot matched the shape but failed to parse cleanly -- abstain, never guess
    }
    lots.push({ qty, unitCost });
  }

  // The deposited shape (D-BP221-BM0-049) is specifically MULTIPLE lots, each bought at its
  // own per-unit cost, all marked up by the SAME percentage. Fewer than two lots means there
  // is nothing to distinguish this from a plain single-item markup problem (a different,
  // simpler shape); an unreasonably large count likely means the pattern matched noise rather
  // than genuine lot descriptions.
  if (lots.length < 2 || lots.length > 6) return null;

  return { lots, pct };
}

const METHOD_ID = 'percentage-markup-resale-profit-v1';

export const percentageMarkupResaleProfitMethod: LianaMethod = {
  id: METHOD_ID,
  demand: 'COMPUTE',
  name: 'Percentage-markup resale profit',
  taughtBy: 'D-BP221-BM0-075/SEG',
  shapeDescription:
    'Two or more purchased lots, each with its own quantity and per-unit cost, all resold at ' +
    'a single stated percentage price increase over their original cost; profit is that ' +
    'percentage applied to the total original cost of every lot combined.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const question = input && input.question;
    const result = analyze(question);
    if (!result) {
      return {
        matches: false,
        reason:
          'no clean set of 2-6 per-unit purchase lots plus exactly one price-increase ' +
          'percentage cue (with the "profit" word present and no disqualifying direct-sale-' +
          'price or fee/tax/discount phrasing) was found; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason:
        `found ${result.lots.length} purchase lots and a single ${result.pct}% price-increase cue`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
      if (!result) {
        return {
          question, verdict: null, abstain: true, freeText, method: METHOD_ID,
          basis: 'shape did not hold at run time',
        };
      }
      const totalCost = result.lots.reduce((sum, lot) => sum + lot.qty * lot.unitCost, 0);
      const profit = totalCost * (result.pct / 100);
      if (!Number.isFinite(profit) || profit <= 0) {
        return {
          question, verdict: null, abstain: true, freeText, method: METHOD_ID,
          basis: 'computed profit was not a sane positive number',
        };
      }
      const rounded = Math.round(profit * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis:
          `total original cost across ${result.lots.length} lots was ${totalCost}, marked up by `
          + `${result.pct}% => profit ${rounded}`,
      };
    } catch (e) {
      // TRY/CATCH PASS, D-BP223-BM0-005, on the Founder's explicit approval 2026-09-07T01:25Z:
      // "Yes do the Try/Catch pass across the seven. Approved. Word." Same shape as the XO's
      // rate_distance_unit_pace.ts, so all seven now behave identically when run() throws:
      // ABSTAIN and say what threw, rather than letting the exception end the engine's
      // fall-through chain. An abstain is free; a thrown method is not.
      return {
        question: question,
        verdict: null,
        abstain: true,
        freeText,
        method: METHOD_ID,
        basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e),
      };
    }
  },
};

// REGISTERED AT IMPORT TIME. ACCEPTED by accept_gates.cjs, gate 1 then 2a then 4: 'solves its own
// shape, carries no answer, claims 1 and steals none'. ACCEPT is silent about interface fit.
registerMethod(percentageMarkupResaleProfitMethod);
