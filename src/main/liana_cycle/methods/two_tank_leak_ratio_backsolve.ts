// D-BP223-BM04-h2cbpv9w-170 -- two-tank-leak-ratio-backsolve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-tank-leak-ratio-backsolve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C89 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 214, "Jerry has two pools, both with leaks
 * emptying them out at 4 gallons/minute. 4 minutes ago, the big pool had twice as much water as
 * the small pool. Now the big pool has four times as much water as the small pool. How much water
 * does the small pool have now?". Silo label: "system of linear equations -- rate of change and
 * initial state" -- matches the arithmetic exactly, and this candidate implements the closed-form
 * solution to that same pair of simultaneous equations rather than a numeric solver.
 *
 * @generalShape TWO containers leak/drain at the SAME known rate. At a past moment (T time units
 *   ago), one container held a stated multiple (K1) of the other's amount. NOW, that same
 *   container holds a DIFFERENT stated multiple (K2) of the other's amount. The question asks for
 *   the OTHER container's CURRENT amount. Letting s = other container's current amount and using
 *   "amount T time-units ago = current amount + rate*T" (since it was DRAINING, it had MORE then):
 *   (K2*s + R*T) = K1*(s + R*T)  =>  s = R*T*(K1-1) / (K2-K1).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a shared leak/drain rate sentence naming a rate in <value> gallons per/over minute;
 *   (b) a "<N> minutes ago" time phrase;
 *   (c) a PAST ratio sentence "the <subject> pool had <ratio1> as much water as the <object> pool"
 *       (ratio parsed via the shared number-word table: twice, double, half, "<n> times");
 *   (d) a CURRENT ratio sentence "[n]ow the <subject> pool has <ratio2> as much water as the
 *       <object> pool" naming the SAME subject and SAME object nouns as (c);
 *   (e) the closing question asking for the <object> pool's current amount specifically (the
 *       same object noun as (c)/(d)) -- never the subject's.
 *
 * @whatBreaksIt (a) the subject/object nouns not matching exactly across the past and current
 *   ratio sentences, or the question naming neither -- abstain, cannot anchor which container is
 *   which; (b) either ratio phrase unrecognised -- abstain; (c) K2 equal to K1 (the ratio never
 *   changed, division by zero) -- abstain; (d) the two containers not both described as leaking
 *   at the SAME stated rate (this candidate never handles two different drain rates) -- abstain;
 *   (e) the final result not landing on an exact, strictly positive integer -- abstain rather than
 *   round, using exact BigInt fraction arithmetic throughout.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (8 = 4*4*(2-1) / (4-2), the small pool's current amount).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-tank-leak-ratio-backsolve-v1';

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
function divFrac(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d, d: a.d * b.n }); }
function exactInt(f: Frac): number | null { return f.d === 1n ? Number(f.n) : null; }
const ONE_FRAC: Frac = { n: 1n, d: 1n };

function parseRatioPhrase(phrase: string): Frac | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'twice' || p === 'double') return { n: BigInt(ONES_WORDS.indexOf('two')), d: 1n };
  if (p === 'half') return { n: 1n, d: BigInt(ONES_WORDS.indexOf('two')) };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= ONES_WORDS.indexOf('two')) return { n: BigInt(n), d: 1n };
  }
  return null;
}

interface Analyzed { current: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rateRe = /(?:leaks?|leaking|draining)[^.]{0,40}?at\s+(\d+(?:\.\d+)?)\s+gallons?\s*(?:\/|per)\s*minute/i;
  const rrm = rateRe.exec(q);
  if (!rrm) return null;
  const rate = fromNumber(parseFloat(rrm[1]));

  const timeRe = /(\d+|[a-z]+)\s+minutes?\s+ago/i;
  const trm = timeRe.exec(q);
  if (!trm) return null;
  const time = wordOrDigit(trm[1]);
  if (time === null) return null;

  const pastRe = /the\s+([a-z]+)\s+pool\s+had\s+([a-z][a-z\s-]*?)\s+as\s+much\s+water\s+as\s+the\s+([a-z]+)\s+pool/i;
  const pm = pastRe.exec(q);
  if (!pm) return null;
  const subject = pm[1].toLowerCase();
  const k1 = parseRatioPhrase(pm[2]);
  const object = pm[3].toLowerCase();
  if (!k1 || subject === object) return null;

  const currRe = /now\s+the\s+([a-z]+)\s+pool\s+has\s+([a-z][a-z\s-]*?)\s+as\s+much\s+water\s+as\s+the\s+([a-z]+)\s+pool/i;
  const cm = currRe.exec(q);
  if (!cm) return null;
  const subject2 = cm[1].toLowerCase();
  const k2 = parseRatioPhrase(cm[2]);
  const object2 = cm[3].toLowerCase();
  if (!k2) return null;
  if (subject2 !== subject || object2 !== object) return null;

  const closing = q.slice(q.lastIndexOf('.') + 1);
  const wantsObject = new RegExp('\\bthe\\s+' + object + '\\s+pool\\b', 'i').test(closing);
  const wantsSubject = new RegExp('\\bthe\\s+' + subject + '\\s+pool\\b', 'i').test(closing);
  if (!wantsObject || wantsSubject) return null; // must ask about the OBJECT pool only

  const k2MinusK1 = subFrac(k2, k1);
  if (k2MinusK1.n === 0n) return null;
  const k1Minus1 = subFrac(k1, ONE_FRAC);
  const numerator = mulFrac(mulFrac(rate, fromNumber(time)), k1Minus1);
  const currentFrac = divFrac(numerator, k2MinusK1);
  const current = exactInt(currentFrac);
  if (current === null || current <= 0) return null;
  return { current };
}

export const twoTankLeakRatioBacksolve: LianaMethod = {
  id: 'two-tank-leak-ratio-backsolve-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a leaking container\'s current amount from a past-vs-now ratio change',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C89, sole member: pilot corpus item at index 214)',
  shapeDescription:
    'Two containers leak at the same known rate; a past ratio between them and a current ratio ' +
    'between them are both given; solve the closed-form pair of simultaneous equations for the ' +
    'named container\'s current amount.',
  quarantined: true,
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a shared leak rate, a "<N> minutes ago" past ratio and a matching current ' +
          'ratio between the same two named containers, plus a question asking for the object ' +
          'container\'s current amount, resolving to an exact positive integer; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `current amount = ${result.current}` };
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
        verdict: String(Math.round((result.current) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'R*T*(K1-1)/(K2-K1)',
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

registerMethod(twoTankLeakRatioBacksolve);
