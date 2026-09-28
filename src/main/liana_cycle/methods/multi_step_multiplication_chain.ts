// D-BP221-BM06-003 -- multi-step-multiplication-chain-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE.
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\harvest_gsm8k_pilot_item112_multi_step_multiplication.candidate.ts
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces, and the object carried no
// type annotation at all, so nothing ever checked it against `LianaMethod`. Four real
// incompatibilities were hiding behind that, not one naming disagreement:
//
//   candidate's own local type          the live registry's type
//   --------------------------------    ------------------------------------------
//   qid?: string                        MethodQuestionInput.qid?: number
//   options?: string[] | null           MethodQuestionInput.options: Record<string, string> | null
//   RunResult.verdict: number | null    LianaTerminalOutcome.verdict: string | null
//   no `question`, no `freeText`        both REQUIRED on LianaTerminalOutcome
//
// A CAST WOULD HAVE COMPILED AND SUPPRESSED ALL FOUR, and the engine would have received an
// outcome with no question, no freeText, and a number sitting in a string field. The XO's order was
// explicit -- NEVER CAST, ANNOTATE -- so `LianaMethod` is written on the object below and the
// compiler checks every property against the real interface. That annotation IS the check.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED. `DISQUALIFYING_KEYWORDS`,
// `countWholeWord()`, `extractPlainIntegers()` and `analyze()` below are the candidate's own bytes,
// diffed to confirm it. THAT IS LOAD-BEARING: `accept_gates.cjs` judged this method's BEHAVIOR
// (gate 1 solves its own shape, gate 2a carries no answer, gate 4 steals nothing) and returned
// ACCEPT. Edit the analysis and that ACCEPT no longer describes this file. Only the interface layer
// -- the two signatures and the returned object shapes -- is this ticket's work.
//
// ONE DELIBERATE NON-CHANGE, FLAGGED RATHER THAN SMUGGLED IN: the XO's proven
// `rate_distance_unit_pace.ts` wraps its run() body in try/catch and abstains on a throw. This file
// does NOT, because the candidate did not, and adding one would change behavior the gates measured.
// It is a real difference between the two files and it is the XO's call, not mine.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable, which is the whole point of filing it.

/**
 * @generalShape A repeated-rate multiplication chain: the text hands over a base
 *   count plus two or more "per-unit" rates (X per Y, then Y per Z, ...) that
 *   must be multiplied straight through, in the order they appear, to reach a
 *   single repeated total (cleanings per day, widgets per week, and the like).
 *   There is no addition, subtraction, division, percentage, or unit conversion
 *   anywhere in the derivation -- it is a pure product of the numbers given.
 *
 * @recogniseInStranger The question (a) contains the whole word "per" at least
 *   twice, marking at least two chained rates; (b) asks for a repeated or
 *   aggregate count ("how many times", "in total", "altogether", "per day",
 *   "each day"); (c) yields exactly 3 or 4 plain positive whole numbers in the
 *   raw text (a base count plus its rates, no more and no fewer); and (d)
 *   contains none of a deliberately long blacklist of words that signal a
 *   different derivation entirely (percent, discount, cost/price/dollar signs,
 *   area/volume/distance/speed, an equation or unknown, half/twice/double,
 *   left/remain/fewer/more-than, combined/average, and so on). All four
 *   conditions must hold together; any single one missing means abstain.
 *
 * @whatBreaksIt A fifth quantity that is a genuine red herring, or one that
 *   must be added/subtracted into the story rather than multiplied into the
 *   chain (for example, a stray "the room also seats N students" fact); a
 *   problem with two "per" phrases that describe two independent facts rather
 *   than a chain meant to be multiplied together; or a chain that secretly
 *   needs a unit conversion (minutes to hours, weeks to days) expressed as a
 *   plain number the extractor cannot distinguish from a genuine rate. Any of
 *   these make the naive straight-through product wrong while still looking,
 *   on the surface, like the target shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the same single
 *   analyze() pass, so if any one guard fails (the keyword blacklist, the
 *   "per" count, the 3-4 factor-count window, a non-integer or non-positive
 *   number) the method abstains: verdict null, abstain true. That costs
 *   nothing and the engine falls through to the next eligible method. A false
 *   MATCH, by contrast, would multiply the wrong set of numbers and hand back
 *   a confident wrong integer that ends the whole loop -- so every guard here
 *   is written to be over-inclusive in what it refuses, never in what it
 *   accepts, and quarantined:true keeps this method out of selection until it
 *   has been measured against held-out questions.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

// A deliberately long, deliberately over-inclusive list of words that signal
// this question is NOT a plain chained-multiplication problem, even if it
// happens to contain the word "per" somewhere. Any single hit disqualifies.
const DISQUALIFYING_KEYWORDS: string[] = [
  'percent', '%', 'discount', 'sale', 'profit', 'loss', 'interest',
  'more than', 'fewer', 'less than', 'left', 'remain', 'plus', 'minus',
  'subtract', 'combined', 'together with', 'half', 'twice as many',
  'double', 'triple', 'quarter', 'fraction', 'ratio', 'average', 'mean',
  'equation', 'unknown', 'variable', 'area', 'volume', 'perimeter',
  'radius', 'diameter', 'speed', 'distance', 'mph', 'km/h', 'mile',
  'kilometer', 'dollar', '$', 'cost', 'price', 'pay', 'spend', 'budget',
  'change', 'refund', 'rebate', 'tax', 'increase', 'decrease', 'raise',
];

function countWholeWord(lowerText: string, word: string): number {
  const re = new RegExp(`\\b${word}\\b`, 'g');
  const m = lowerText.match(re);
  return m ? m.length : 0;
}

// Pull plain positive whole numbers out of the raw text, skipping anything
// dressed up as currency, a percentage, a decimal, or a clock time -- those
// belong to a different shape and must not be swept into the chain.
function extractPlainIntegers(text: string): number[] {
  const results: number[] = [];
  const re = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (raw.includes('.')) continue;
    const start = m.index;
    const end = start + raw.length;
    const before = text.slice(Math.max(0, start - 1), start);
    const after = text.slice(end, end + 1);
    if (before === '$') continue;
    if (after === '%') continue;
    if (after === ':') continue;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) results.push(n);
  }
  return results;
}

function analyze(rawQuestion: unknown): { factors: number[] } | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  const lower = q.toLowerCase();

  // Must smell like a chain of repeated rates: "per" shows up at least twice.
  if (countWholeWord(lower, 'per') < 2) return null;

  // Must actually ask for a repeated/aggregate total, the hallmark of this shape.
  const asksAggregateTotal =
    /how many times/.test(lower) ||
    /in a day|per day|each day|in total|altogether/.test(lower);
  if (!asksAggregateTotal) return null;

  // Reject anything smelling additive, subtractive, financial, geometric,
  // or comparative -- those need a different derivation even when a "per"
  // phrase happens to be present somewhere in the text.
  for (const kw of DISQUALIFYING_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }

  const factors = extractPlainIntegers(q);

  // The deposited shape is a short chain: one base count and its per-unit
  // rates. Fewer than three numbers means there is nothing to chain; more
  // than four means a red herring or a second scenario is very likely
  // present, and this method must not guess which numbers belong together.
  if (factors.length < 3 || factors.length > 4) return null;
  if (factors.some((n) => !Number.isInteger(n) || n <= 0)) return null;

  return { factors };
}

export const multiStepMultiplicationChainMethod: LianaMethod = {
  id: 'multi-step-multiplication-chain-v1',
  demand: 'COMPUTE',
  name: 'Multi-step multiplication chain',
  taughtBy: 'D-BP221-BM0-075/SEG',
  shapeDescription:
    'A base count and two or more chained "per-unit" rates that must be ' +
    'multiplied straight through, in appearance order, to a single repeated total.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const question = input && input.question;
    const result = analyze(question);
    if (!result) {
      return {
        matches: false,
        reason:
          'no clean 3-4 number rate chain with a repeated-total question and ' +
          'no disqualifying keyword was found; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `found a ${result.factors.length}-number chain (${result.factors.join(' x ')}) with a repeated-total question`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // Same derivation the XO's proven file uses: a question with no options is free text. Read off
    // the input rather than assumed, so a lettered-option question is never mislabeled.
    const freeText = !input || input.options === null || input.options === undefined;

    try {

      const result = analyze(question);
      if (!result) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'multi-step-multiplication-chain-v1',
          basis: 'shape did not hold at run time',
        };
      }
      const product = result.factors.reduce((acc, n) => acc * n, 1);
      if (!Number.isFinite(product) || product <= 0) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'multi-step-multiplication-chain-v1',
          basis: 'computed product was not a sane positive number',
        };
      }
      // STRINGIFIED WITHOUT A ROUNDING STEP, and that is a decision, not an oversight. `analyze()`
      // admits only positive INTEGERS, so the product is an exact integer and the proven file's
      // `Math.round(x * 1e6) / 1e6` would be the identity here. Applying it anyway would imply a
      // floating-point precision concern this shape does not have.
      return {
        question,
        verdict: String(product),
        abstain: false,
        freeText,
        method: 'multi-step-multiplication-chain-v1',
        basis: `multiplied the chain straight through: ${result.factors.join(' x ')} = ${product}`,
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
        method: 'multi-step-multiplication-chain-v1',
        basis: 'multi-step-multiplication-chain-v1' + ' threw: ' + String((e as Error)?.message ?? e),
      };
    }
  },
};

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder and
// the same one the XO's rate_distance_unit_pace.ts uses.
//
// ACCEPTED by accept_gates.cjs (BISHOP_DROPZONE\D-BP221-BM04-TOOLS), re-run by BM06 at
// 2026-09-07T00:1xZ in the Founder's promoted order gate 1 then gate 2a then gate 4:
// 'solves its own shape, carries no answer, claims 3 and steals none'. That runner's own words:
// ACCEPT means safe to register. It is silent about INTERFACE FIT, which is what this file adds.
registerMethod(multiStepMultiplicationChainMethod);
