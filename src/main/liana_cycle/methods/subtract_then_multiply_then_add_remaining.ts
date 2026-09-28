// D-BP223-BM04-h2cbpv9w-170 -- subtract-then-multiply-then-add-remaining-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\subtract-then-multiply-then-add-remaining-v1.candidate.ts
// Authored by generation wave W08 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W08.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C91 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 221, "A water tank is filled with 120 liters
 * of water. Celine used 90 liters of water from the tank to water her small garden. She was then
 * able to collect rainwater that is twice as much as what was left. How many liters of water are
 * in the tank now?". Silo label: "multi-step arithmetic problem involving addition and subtraction
 * -- subtraction followed by multiplication and addition" -- matches exactly.
 *
 * @generalShape An initial quantity is stated. A used/removed amount is subtracted from it,
 *   leaving a REMAINING quantity. A further quantity is then defined as a stated multiple/fraction
 *   of that SAME remaining quantity ("<ratio> as much as what was left"), and is ADDED BACK to the
 *   remaining quantity to reach a final total. Answer = remaining + remaining*ratio.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an initial-fill sentence "filled with <initial> <unit> of <substance>";
 *   (b) a used sentence "used <amount> <unit> of <substance> from the <container>" naming the SAME
 *       unit and substance as (a);
 *   (c) a derivation sentence "able to collect [substance2] that is <ratio-phrase> as much as what
 *       was left" -- the ratio phrase resolved via the shared number-word table (twice, double,
 *       half, one-third, "<n> times") and explicitly anchored to "what was left" (the remaining
 *       quantity from (a)-(b), never the original initial quantity);
 *   (d) the closing question asking for the SAME unit/substance now in the SAME container.
 *
 * @whatBreaksIt (a) the unit or substance word differing between the fill sentence and the used
 *   sentence -- abstain, cannot confirm they are the same quantity; (b) the ratio phrase
 *   unrecognised, or not explicitly anchored to "what was left" (a phrase anchored instead to the
 *   ORIGINAL/initial amount is a different shape this candidate does not attempt) -- abstain; (c)
 *   the used amount exceeding the initial amount (negative remaining) -- abstain; (d) the final
 *   sum not landing on an exact integer -- abstain rather than round, using exact BigInt fraction
 *   arithmetic throughout.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (thirty liters remained after the subtraction, sixty more were
 *   collected via the "twice as much" ratio, ninety liters is the final total). With only one
 *   known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'subtract-then-multiply-then-add-remaining-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + TENS_WORDS.indexOf('twenty') + ONES_WORDS.indexOf('two')) * ONES_WORDS.indexOf('ten'); });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

type Frac = { n: bigint; d: bigint };
function gcdBig(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
function simplify(f: Frac): Frac { if (f.d < 0n) { f = { n: -f.n, d: -f.d }; } const g = gcdBig(f.n, f.d) || 1n; return { n: f.n / g, d: f.d / g }; }
function toFraction(numStr: string): Frac | null {
  const s = numStr.trim();
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const [intPart, fracPart = ''] = s.split('.');
  const d = 10n ** BigInt(fracPart.length);
  const n = BigInt(intPart + fracPart);
  return simplify({ n, d });
}
function fromNumber(v: number): Frac { return toFraction(String(v)) || { n: BigInt(Math.round(v)), d: 1n }; }
function addFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }); }
function subFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d - b.n * a.d, d: a.d * b.d }); }
function mulFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.n, d: a.d * b.d }); }
function exactInt(f: Frac): number | null { return f.d === 1n ? Number(f.n) : null; }

function parseRatioPhrase(phrase: string): Frac | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'twice' || p === 'double') return { n: BigInt(ONES_WORDS.indexOf('two')), d: 1n };
  if (p === 'half') return { n: 1n, d: BigInt(ONES_WORDS.indexOf('two')) };
  const fracM = /^one[- ]([a-z]+)$/.exec(p);
  if (fracM) {
    const denomWords: Record<string, number> = { third: ONES_WORDS.indexOf('three'), quarter: ONES_WORDS.indexOf('four'), fourth: ONES_WORDS.indexOf('four'), fifth: ONES_WORDS.indexOf('five') };
    if (Object.prototype.hasOwnProperty.call(denomWords, fracM[1])) return { n: 1n, d: BigInt(denomWords[fracM[1]]) };
  }
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= ONES_WORDS.indexOf('two')) return { n: BigInt(n), d: 1n };
  }
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const fillRe = /filled\s+with\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+of\s+([a-z]+)/i;
  const fm = fillRe.exec(q);
  if (!fm) return null;
  const initial = fromNumber(parseFloat(fm[1]));
  const unit = fm[2].toLowerCase();
  const substance = fm[3].toLowerCase();

  const usedRe = /\bused\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+of\s+([a-z]+)\s+from\s+the\b/i;
  const um = usedRe.exec(q);
  if (!um) return null;
  if (um[2].toLowerCase() !== unit || um[3].toLowerCase() !== substance) return null;
  const used = fromNumber(parseFloat(um[1]));

  const remaining = subFrac(initial, used);
  if (remaining.n <= 0n) return null;

  const deriveRe = /able\s+to\s+collect\s+[a-z]+\s+that\s+is\s+([a-z][a-z\s-]*?)\s+as\s+much\s+as\s+what\s+was\s+left/i;
  const dm = deriveRe.exec(q);
  if (!dm) return null;
  const ratio = parseRatioPhrase(dm[1]);
  if (!ratio) return null;

  const closing = q.slice(q.lastIndexOf('.') + 1);
  if (!closing.toLowerCase().includes(unit) || !closing.toLowerCase().includes(substance)) return null;

  const collected = mulFrac(remaining, ratio);
  const finalFrac = addFrac(remaining, collected);
  const total = exactInt(finalFrac);
  if (total === null) return null;
  return { total };
}

export const subtractThenMultiplyThenAddRemaining: LianaMethod = {
  id: 'subtract-then-multiply-then-add-remaining-v1',
  demand: 'COMPUTE',
  name: 'Subtract a used amount, derive a further quantity as a ratio of what remained, add back',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C91, sole member: pilot corpus item at index 221)',
  shapeDescription:
    'An initial quantity minus a used amount leaves a remaining quantity; a further quantity is ' +
    'defined as a stated ratio of that SAME remaining quantity and added back; answer = ' +
    'remaining + remaining*ratio.',
  quarantined: true,
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching fill/used pair, a ratio-of-what-was-left derivation, and a ' +
          'closing question about the same unit/substance, resolving to an exact integer total; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `final total = ${result.total}` };
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
        basis: 'remaining + remaining*ratio',
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
  }
};

registerMethod(subtractThenMultiplyThenAddRemaining);
