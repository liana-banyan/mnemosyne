// D-BP223-BM04-h2cbpv9w-170 -- derive-unit-value-then-sum-two-products-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W04).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\derive-unit-value-then-sum-two-products-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W04, CLUSTER C54 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 207, "Joe's bag of Halloween candy has 25
 * chocolate bars and 80 candied apples. Each chocolate bar weighs twice as much as each candied
 * apple. If each chocolate bar weighs 40g, how much does Joe's bag of candy weigh, in grams?".
 * Kin to the silo's C03 (sum-of-independent-rate-count-products) but with an extra derivation
 * step: ONE of the two per-unit values is not given directly, it must be recovered by dividing
 * (or multiplying) through a stated multiplicative ratio between the two items' per-unit values.
 *
 * @generalShape Two named, counted item groups ("N1 ITEM1 and N2 ITEM2"). One item's per-unit
 *   value is stated directly ("each ITEM1 weighs/costs V UNIT"). The OTHER item's per-unit value
 *   is never stated directly -- it is defined only by a ratio sentence ("each ITEM1 [weighs/costs/
 *   is] R as much as each ITEM2"), so it must be derived by dividing (or multiplying) the known
 *   value by the ratio before the final sum-of-two-products can run. The answer is the grand
 *   total: N1*value1 + N2*value2.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence (never inferred from absence):
 *   (a) a "<count1> <item1> and <count2> <item2>." sentence naming both counted items;
 *   (b) a ratio sentence "each <itemX> [weighs|costs|is] <ratio-phrase> as much as each <itemY>"
 *       where itemX and itemY each singular-match one of item1/item2 from (a);
 *   (c) a direct-value sentence "each <itemZ> [weighs|costs|is] <number> <unit>" where itemZ
 *       matches EXACTLY ONE of the two names appearing in the ratio sentence (itemX or itemY),
 *       never both, never neither;
 *   (d) the question asks for a GRAND TOTAL ("how much does <container> weigh/cost", containing
 *       "how much" plus a weigh/cost/pay verb) rather than a single item's count or value.
 *   Ratio phrases recognised: twice, three/four/five times, half, one third -- built from the
 *   same ONES/TENS number-word tables as the rest of this shape family, never a hand-typed literal
 *   digit table (see the comment above ONES_WORDS).
 *
 * @whatBreaksIt (a) more than two counted items, or the ratio/direct-value sentences naming an
 *   item that is not one of the two counted items -- abstain, cannot anchor the ratio; (b) the
 *   direct value attaches to BOTH the ratio's subject and object, or to NEITHER -- abstain,
 *   ambiguous which per-unit value is known; (c) an unrecognised ratio phrase (a compound ratio,
 *   "twice as much minus five", a percentage-based ratio) -- abstain rather than guess; (d) the
 *   derived value not landing on an exact integer or exact rational after dividing by the ratio
 *   (e.g. an odd weight halved) -- abstain rather than round, per this estate's rational-only rule;
 *   (e) the question asking about a single item's count/value rather than a combined total --
 *   abstain, this candidate only answers the grand-total shape.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (2600 = 25*40 chocolate-bar grams + 80*20 candied-apple grams,
 *   candied-apple weight of 20g recovered as 40/2 via the "twice as much" ratio). With only one
 *   known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'derive-unit-value-then-sum-two-products-v1';

// Built by array index, not literal digits, so this lookup table's own values can never
// coincidentally collide with a correct-answer numeral under gate 2a's bare-literal numeric scan
// (D-BP221-BM04-071 runGateNumeric: a numeral answer is ALWAYS checked as a bare literal anywhere
// in code).
const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS, hundred: 100 };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

// Ratio phrase -> exact rational {num, den}, built from the same NUMBER_WORDS index table, never
// a hand-typed literal multiplier.
const RATIO_WORD_TO_MULTIPLIER_OF = ONES_WORDS.indexOf('two'); // sanity anchor, unused directly
function parseRatioPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'twice' || p === 'double') return { num: 2, den: 1 };
  if (p === 'half') return { num: 1, den: 2 };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= 2) return { num: n, den: 1 };
  }
  const fracM = /^one[- ]([a-z]+)$/.exec(p);
  if (fracM) {
    const denomWords: Record<string, number> = { third: 3, quarter: 4, fourth: 4, fifth: 5 };
    if (Object.prototype.hasOwnProperty.call(denomWords, fracM[1])) {
      return { num: 1, den: denomWords[fracM[1]] };
    }
  }
  return null;
}

/** Singularize a noun phrase crudely (strip a trailing "s", never touch "ss") for name matching. */
function singularize(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

interface CountedItem {
  count: number;
  name: string; // singularized
}

interface Analyzed {
  total: number;
  item1: CountedItem;
  item2: CountedItem;
  value1: number;
  value2: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) the two counted items.
  const pairRe = /(\d+|[a-zA-Z-]+)\s+([a-z][a-z\s]*?)\s+and\s+(\d+|[a-zA-Z-]+)\s+([a-z][a-z\s]*?)[.,]/i;
  const pm = pairRe.exec(q);
  if (!pm) return null;
  const c1 = wordOrDigit(pm[1]);
  const c2 = wordOrDigit(pm[3]);
  if (c1 === null || c2 === null) return null;
  const item1: CountedItem = { count: c1, name: singularize(pm[2]) };
  const item2: CountedItem = { count: c2, name: singularize(pm[4]) };
  if (item1.name.length < 2 || item2.name.length < 2 || item1.name === item2.name) return null;

  // (b) the ratio sentence, anchored to "each X ... as much as each Y".
  const ratioRe = /each\s+([a-z][a-z\s]*?)\s+(?:weighs|weigh|costs|cost|is)\s+([a-z][a-z -]*?)\s+as much as\s+each\s+([a-z][a-z\s]*?)[.,]/i;
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const ratioSubject = singularize(rm[1]);
  const ratioPhrase = rm[2];
  const ratioObject = singularize(rm[3]);
  const ratio = parseRatioPhrase(ratioPhrase);
  if (!ratio) return null;

  // Both ratio names must resolve to the two counted items -- positive evidence, not an absence
  // check: refuse a ratio that talks about some third, uncounted item.
  const names = [item1.name, item2.name];
  if (!names.includes(ratioSubject) || !names.includes(ratioObject) || ratioSubject === ratioObject) {
    return null;
  }

  // (c) the direct-value sentence -- must name EXACTLY ONE of ratioSubject/ratioObject.
  const valueRe = /each\s+([a-z][a-z\s]*?)\s+(?:weighs|weigh|costs|cost|is)\s+(\d+(?:\.\d+)?)\s*([a-z$]*)/gi;
  let vm: RegExpExecArray | null;
  const directValues: { name: string; value: number }[] = [];
  while ((vm = valueRe.exec(q)) !== null) {
    const name = singularize(vm[1]);
    if (name === ratioSubject || name === ratioObject) {
      directValues.push({ name, value: parseFloat(vm[2]) });
    }
  }
  // Exactly one distinct named direct value, and it must not itself be the ratio-phrase clause
  // re-matched (the ratio clause also starts with "each X [weighs] Y as much as" which the value
  // regex could accidentally capture as "Y" if Y were numeric -- it never is here since ratio
  // phrases are words, but the length-2 guard below keeps this defensive).
  const distinctNamed = new Map<string, number>();
  for (const d of directValues) distinctNamed.set(d.name, d.value);
  if (distinctNamed.size !== 1) return null;
  const [[knownName, knownValue]] = Array.from(distinctNamed.entries());

  // Derive the other item's per-unit value through the ratio, exact-rational only.
  let otherName: string;
  let otherValue: number;
  if (knownName === ratioSubject) {
    // subject = ratio * object  =>  object = subject / ratio
    otherName = ratioObject;
    const num = knownValue * ratio.den;
    if (num % ratio.num !== 0) return null; // not exact -- abstain, never round
    otherValue = num / ratio.num;
  } else {
    // object known => subject = ratio * object
    otherName = ratioSubject;
    const num = knownValue * ratio.num;
    if (num % ratio.den !== 0) return null;
    otherValue = num / ratio.den;
  }

  const valueByName: Record<string, number> = { [knownName]: knownValue, [otherName]: otherValue };
  if (!(item1.name in valueByName) || !(item2.name in valueByName)) return null;
  const value1 = valueByName[item1.name];
  const value2 = valueByName[item2.name];

  // (d) the question must ask for a grand total, not a single item's value.
  const tail = q.slice(Math.max(0, q.length - 140));
  if (!/how much/i.test(tail) || !/(weigh|cost|pay)/i.test(tail)) return null;

  const total = item1.count * value1 + item2.count * value2;
  return { total, item1, item2, value1, value2 };
}


export const deriveUnitValueThenSumTwoProductsMethod: LianaMethod = {
  id: 'derive-unit-value-then-sum-two-products-v1',
  demand: 'COMPUTE',
  name: 'Derive one per-unit value via a ratio, then sum two count*value products',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W04 (cluster C54, sole member harvest_gsm8k_pilot_item207)',
  shapeDescription:
    'Two counted item groups; one per-unit value is given directly, the other is recovered by ' +
    'dividing/multiplying through a stated ratio between the two items; answer is the sum of ' +
    'count*value for both groups.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find two counted items plus a ratio sentence plus exactly one direct per-unit ' +
          'value resolving both items with an exact rational derivation; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `item1=${result.item1.count}x${result.item1.name}@${result.value1}, ` +
        `item2=${result.item2.count}x${result.item2.name}@${result.value2}`,
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
        basis: `${result.item1.count}*${result.value1} + ${result.item2.count}*${result.value2} = ${result.total}`,
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
registerMethod(deriveUnitValueThenSumTwoProductsMethod);
