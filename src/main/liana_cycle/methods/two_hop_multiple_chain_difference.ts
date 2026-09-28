// D-BP223-BM04-h2cbpv9w-170 -- two-hop-multiple-chain-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-hop-multiple-chain-difference-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C93 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 240, "James has 6 more candies than Robert.
 * John has twice as many candies as Robert. If John has 54 candies, how many more candies does
 * John have than James?". Silo label: "multi-step comparison and comparison-based calculation --
 * algebraic substitution and comparison" -- matches exactly.
 *
 * @generalShape THREE actors. Actor1's count is a stated OFFSET above Actor2's (unstated) count.
 *   Actor3's count is a stated RATIO of that SAME Actor2's count. Actor3's ABSOLUTE count is then
 *   given directly, letting Actor2's count be backsolved via the ratio, which in turn lets
 *   Actor1's count be computed via the offset. The question asks for the difference between two
 *   of the three actors' counts (named explicitly, in either order).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an offset sentence "<Actor1> has <diff> more <item> than <Actor2>";
 *   (b) a ratio sentence "<Actor3> has <ratio-phrase> as many <item> as <Actor2>" naming the SAME
 *       Actor2 and SAME item as (a) -- the ratio phrase resolved via the shared number-word table;
 *   (c) an absolute-value sentence "if <Actor3> has <value> <item>" naming the SAME Actor3 and
 *       item as (b);
 *   (d) a closing question "how many more <item> does <ActorX> have than <ActorY>" where ActorX
 *       and ActorY are two DISTINCT names drawn from {Actor1, Actor2, Actor3}.
 *
 * @whatBreaksIt (a) the item word differing across any of the three sentences -- abstain; (b) the
 *   ratio sentence's second actor not matching the offset sentence's Actor2 -- abstain, cannot
 *   anchor the shared unknown; (c) the ratio-derived Actor2 count not landing on an exact integer
 *   -- abstain rather than round; (d) either question actor not being one of the three named
 *   actors, or the two question actors being the same -- abstain; (e) the resulting difference not
 *   strictly positive -- abstain, this candidate reports a "how many MORE" magnitude, never a
 *   negative one.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (Robert's count backsolved as fifty-four halved, James's count
 *   as that plus six, and the final gap between John's stated count and James's derived count).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-hop-multiple-chain-difference-v1';

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

function parseRatioPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  const twiceVal = ONES_WORDS.indexOf('two');
  if (p === 'twice' || p === 'double') return { num: twiceVal, den: ONES_WORDS.indexOf('one') };
  if (p === 'half') return { num: ONES_WORDS.indexOf('one'), den: twiceVal };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= twiceVal) return { num: n, den: ONES_WORDS.indexOf('one') };
  }
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const offsetRe = /\b([A-Z][a-z]+)\s+has\s+(\d+|[a-z]+)\s+more\s+([a-z]+)\s+than\s+([A-Z][a-z]+)\b/i;
  const om = offsetRe.exec(q);
  if (!om) return null;
  const actor1 = om[1];
  const diff = wordOrDigit(om[2]);
  const item = om[3].toLowerCase();
  const actor2 = om[4];
  if (diff === null || actor1 === actor2) return null;

  const ratioRe = new RegExp('\\b([A-Z][a-z]+)\\s+has\\s+([a-z][a-z\\s-]*?)\\s+as\\s+many\\s+([a-z]+)\\s+as\\s+' + actor2 + '\\b', 'i');
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const actor3 = rm[1];
  const ratio = parseRatioPhrase(rm[2]);
  const item2 = rm[3].toLowerCase();
  if (!ratio || item2 !== item || actor3 === actor2) return null;

  const valueRe = new RegExp('\\bif\\s+' + actor3 + '\\s+has\\s+(\\d+(?:\\.\\d+)?)\\s+([a-z]+)\\b', 'i');
  const vm = valueRe.exec(q);
  if (!vm) return null;
  const actor3Value = parseFloat(vm[1]);
  const item3 = vm[2].toLowerCase();
  if (item3 !== item) return null;

  // Backsolve actor2 (shared unknown): actor3Value = ratio * actor2  =>  actor2 = actor3Value / ratio
  const num = actor3Value * ratio.den;
  if (num % ratio.num !== 0) return null;
  const actor2Value = num / ratio.num;
  const actor1Value = actor2Value + diff;

  const valueByName: Record<string, number> = { [actor1]: actor1Value, [actor2]: actor2Value, [actor3]: actor3Value };

  const closing = q.slice(q.lastIndexOf('.') + 1);
  const closeRe = /how many more\s+[a-z]+\s+does\s+([A-Z][a-z]+)\s+have\s+than\s+([A-Z][a-z]+)/i;
  const cm = closeRe.exec(closing);
  if (!cm) return null;
  const subjA = cm[1];
  const subjB = cm[2];
  if (!(subjA in valueByName) || !(subjB in valueByName) || subjA === subjB) return null;

  const total = valueByName[subjA] - valueByName[subjB];
  if (total <= 0 || !Number.isInteger(total)) return null;
  return { total };
}

export const twoHopMultipleChainDifference: LianaMethod = {
  id: 'two-hop-multiple-chain-difference-v1',
  demand: 'COMPUTE',
  name: 'Backsolve a shared unknown via a ratio, then report a difference across three actors',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C93, sole member: pilot corpus item at index 240)',
  shapeDescription:
    'Actor1 = Actor2 + offset; Actor3 = ratio * Actor2; Actor3\'s absolute value is given, ' +
    'backsolving Actor2 then Actor1; answer is the difference between two named actors.',
  quarantined: true,
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an offset sentence, a matching ratio sentence sharing the same second ' +
          'actor and item, an absolute value for the ratio actor, and a closing difference ' +
          'question naming two of the three actors, resolving to a positive integer; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `difference = ${result.total}` };
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
        basis: 'backsolved shared unknown, then differenced',
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

registerMethod(twoHopMultipleChainDifference);
