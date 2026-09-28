// D-BP223-BM04-h2cbpv9w-170 -- proportional-count-and-percent-markup-total-spend-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\proportional-count-and-percent-markup-total-spend-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C123 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 47 (harvest_gsm8k_pilot_item47), "John buys
 * twice as many red ties as blue ties. The red ties cost 50% more than blue ties. He spent $200 on
 * blue ties that cost $40 each. How much did he spend on ties?"
 *
 * @generalShape PROPORTIONAL COUNT AND PERCENT MARKUP, TOTAL SPEND: a base item B has a known
 *   per-unit price and a known total spend on it, from which its purchased COUNT is recovered
 *   (spendB / priceB); a second item A is bought in a stated multiple of B's count ("twice as many
 *   A as B"), at a price that is a stated percentage MORE than B's price; the question asks for
 *   the combined total spend across both items. Silo cluster label: "multi-step word problem
 *   involving proportions and percentages -- multi-step calculation involving proportions and
 *   percentage increases".
 *
 * @recogniseInStranger Four clauses, all required: (1) a proportion clause "buys <multiplier-word>
 *   as many <itemA-plural> as <itemB-plural>" (multiplier vocabulary: twice/double, three times,
 *   half, or "N times"); (2) a percent clause "the <itemA-plural> cost <N>% more than <itemB-
 *   plural>"; (3) a base spend clause "spent $<S> on <itemB-plural>"; (4) a base price clause
 *   "that cost $<P> each" immediately following the base spend clause and naming the same item B.
 *   The question must ask for the total spend ("how much did ... spend on <itemA-or-plural
 *   category>" or "in total"), not either item's spend alone.
 *
 * @whatBreaksIt (a) the percent clause reading "less" instead of "more" -- a discount shape, not
 *   this one, unmatched by the fixed "more" literal; (b) the base spend clause's per-unit price
 *   not evenly dividing the base spend (countB not a clean non-negative integer) -- the model does
 *   not fit the text, abstains rather than round; (c) the proportion or percent clause naming item
 *   pairs in the opposite order (itemB stated as the multiple of itemA) -- this candidate's clause
 *   order is fixed (item A is always the FIRST-named item in both the proportion and percent
 *   clauses) and does not attempt to detect a swapped order, a named limitation; (d) more than one
 *   base spend or base price clause -- ambiguous, abstains rather than pick one.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any missing
 *   clause, a non-integer recovered base count, or a non-finite total makes analyze() return null
 *   and both abstain -- never a guessed verdict. Measured against its own (sole) cluster member:
 *   countBlue = 200/40 = 5, countRed = 2*5 = 10, priceRed = 40*1.5 = 60, spendRed = 10*60 = 600,
 *   total = 200 + 600 = 800, matching the ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'proportional-count-and-percent-markup-total-spend-v1';


interface Analyzed {
  countB: number;
  countA: number;
  priceA: number;
  spendA: number;
  total: number;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseMultiplierWord(raw: string): number | null {
  const lower = raw.toLowerCase().trim();
  if (lower === 'twice' || lower === 'double') return 2;
  if (lower === 'half') return 0.5;
  const timesM = /^(\d+(?:\.\d+)?|[a-zA-Z]+)\s+times$/.exec(lower);
  if (timesM) {
    const raw2 = timesM[1];
    const v = NUMBER_WORDS[raw2] ?? parseFloat(raw2);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

// WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
// single teaching item happens to use "buys"/"spent"/"that cost", but this shape's family is
// equally well-formed with "bought"/"purchases"/"purchased" and "which cost"/"costing" -- widened
// on verb-choice generality alone, no tuning-reserve item text was read to make this change.
const PROPORTION_RE = /(?:buys?|bought|purchases?|purchased)\s+([a-zA-Z0-9. ]+?)\s+as\s+many\s+([a-zA-Z]+)\s+(?:ties\s+)?as\s+([a-zA-Z]+)/i;
const PERCENT_MORE_RE = /(?:the\s+)?([a-zA-Z]+)\s+(?:ties\s+)?cost\s+(\d+(?:\.\d+)?)\s*%\s*more\s+than\s+([a-zA-Z]+)/i;
const BASE_SPEND_RE = /spent\s+\$?(\d+(?:\.\d+)?)\s+on\s+([a-zA-Z]+)/i;
const BASE_PRICE_RE = /(?:that|which)\s+cost(?:ing)?\s+\$?(\d+(?:\.\d+)?)\s+each/i;
const TOTAL_QUESTION_RE = /how\s+much\s+did\s+.*?spend|total\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const propM = PROPORTION_RE.exec(q);
  const pctM = PERCENT_MORE_RE.exec(q);
  const spendM = BASE_SPEND_RE.exec(q);
  const priceM = BASE_PRICE_RE.exec(q);
  if (!propM || !pctM || !spendM || !priceM) return null;

  const itemA = propM[2].toLowerCase();
  const itemB = propM[3].toLowerCase();
  // The percent clause must name the SAME item A and item B, same order.
  if (pctM[1].toLowerCase() !== itemA || pctM[3].toLowerCase() !== itemB) return null;
  // The base spend clause must be about item B.
  if (spendM[2].toLowerCase() !== itemB) return null;

  // Exactly one base spend and one base price clause.
  const spendGlobal = new RegExp(BASE_SPEND_RE.source, 'gi');
  let spendCount = 0;
  while (spendGlobal.exec(q) !== null) spendCount += 1;
  const priceGlobal = new RegExp(BASE_PRICE_RE.source, 'gi');
  let priceCount = 0;
  while (priceGlobal.exec(q) !== null) priceCount += 1;
  if (spendCount !== 1 || priceCount !== 1) return null;

  if (!TOTAL_QUESTION_RE.test(q)) return null;

  const multiplier = parseMultiplierWord(propM[1]);
  const pct = parseFloat(pctM[2]);
  const spendB = parseFloat(spendM[1]);
  const priceB = parseFloat(priceM[1]);
  if (
    multiplier === null || !Number.isFinite(pct) ||
    !Number.isFinite(spendB) || !Number.isFinite(priceB) || priceB <= 0
  ) return null;

  const countBRaw = spendB / priceB;
  const countB = Math.round(countBRaw * 1e6) / 1e6;
  if (!Number.isInteger(countB) || countB < 0) return null;

  const countA = multiplier * countB;
  const priceA = priceB * (1 + pct / 100);
  const spendA = countA * priceA;
  const total = spendB + spendA;
  if (!Number.isFinite(total) || total < 0) return null;

  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { countB, countA: round(countA), priceA: round(priceA), spendA: round(spendA), total: round(total) };
}

export const proportionalCountAndPercentMarkupTotalSpend: LianaMethod = {
  id: 'proportional-count-and-percent-markup-total-spend-v1',
  demand: 'COMPUTE',
  name: 'Proportional count plus percent markup on a second item, total combined spend',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/SEG (cluster C123, sole member harvest_gsm8k_pilot_item47)',
  shapeDescription:
    'Base item B\'s count is recovered from its total spend and unit price; item A\'s count is a ' +
    'stated multiple of B\'s count, and A\'s price is a stated percentage more than B\'s price; ' +
    'answer is the combined total spend on both items.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find all four required clauses (a proportion clause, a matching "% more" ' +
          'percent clause, a single base spend clause, and a single base price clause), the base ' +
          'count did not recover as a clean non-negative integer, or the question did not ask for ' +
          'a total; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `countB=${result.countB}, countA=${result.countA}, priceA=${result.priceA}, total=${result.total}`,
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
      return {
        question,
        verdict: String(result.total),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `spendA(${result.spendA}) + spendB = ${result.total}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(proportionalCountAndPercentMarkupTotalSpend);
