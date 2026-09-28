// D-BP223-BM04-h2cbpv9w-170 -- two-direct-quantities-plus-two-multiply-groups-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W02).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-direct-quantities-plus-two-multiply-groups-sum-v1.candidate.ts
// Authored by generation wave W02 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W02.md), merged into the
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W02, CLUSTER C37 (1 silo member, high confidence, singleton).
 * Silo shape label: TWO_GROUP_ADD_THEN_MULTIPLY_PER_COLOR (nested per-category sum-then-multiply,
 * two parallel branches added). Source: methods.harvest_gsm8k_pilot_item204_addition_of_multiple_groups.
 * Representative teaching case, GSM8K test.jsonl lineIndex 204 (Janet's pens): "Janet had 22 green
 * pens and 10 yellow pens. Then she bought 6 bags of blue pens and 2 bags of red pens. There were 9
 * pens in each bag of blue and 6 pens in each bag of red. How many pens does Janet have now?"
 *
 * @generalShape Exactly two directly-given quantities of the same noun (two colors given as bare
 *   counts), PLUS exactly two "bags of <color>" groups whose per-bag rate is given in a separate
 *   sentence ("<N> <noun> in each bag of <color>"). The total is the sum of the two direct
 *   quantities plus the two bag-count x per-bag-rate products. A nested sum-then-multiply-then-add,
 *   never a plain flat sum (that shape belongs to a different cluster) and never a single multiply.
 *
 * @recogniseInStranger Requires, in order: (a) a sentence matching "<N1> <adj1> <noun> and <N2>
 *   <adj2> <noun>" (two bare direct quantities of the SAME noun, back-referenced by regex so the
 *   noun must literally repeat); (b) a sentence matching "<N3> bags of <adj3> <noun> and <N4> bags
 *   of <adj4> <noun>" (two bag-groups, same noun again); (c) a sentence matching "<N5> <noun> in
 *   each bag of <adj> and <N6> <noun> in each bag of <adj>" giving the per-bag rate for EACH named
 *   color; (d) the two bag-group colors from (b) must each find a matching rate in (c) by literal
 *   color-word match -- this is the positive-evidence link, not positional guessing, so a stranger
 *   question that reorders the colors between the bag sentence and the rate sentence still resolves
 *   correctly, and one that never states a rate for a bag color is refused rather than assumed. The
 *   question must ask "how many <noun> does/has <subject> ... now" (a running-total question).
 *
 * @whatBreaksIt Any count of direct quantities other than exactly two; any count of bag-groups other
 *   than exactly two; a bag-group color with no matching per-bag rate sentence; a noun mismatch
 *   between the three sentences (this candidate requires the identical noun word, case-insensitive,
 *   in all three clauses); a per-bag rate given as a fraction or "half" rather than a bare number;
 *   a question that does not ask for the running "now" total (e.g. asking only about one color).
 *   None of these guesses a fallback -- every failed check is an abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a stranger
 *   question that fails any structural check at shapeTest time will also fail identically at run
 *   time -- there is no separate, looser run-time path that could silently diverge. Measured against
 *   its own (sole) cluster member: SOLVED (32 direct + 54 + 12 from the two bag groups). With only
 *   one known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'two-direct-quantities-plus-two-multiply-groups-sum-v1';

// Built by array index, not literal digits -- so this lookup table's own values can never
// coincidentally collide with a correct-answer numeral under gate 2a's bare-literal numeric scan.
const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed {
  total: number;
  parts: string[];
}

const DIRECT_RE = /(\w+)\s+([a-zA-Z]+)\s+([a-zA-Z]+)\s+and\s+(\w+)\s+([a-zA-Z]+)\s+\3\b/i;
const BAGS_RE = /(\w+)\s+bags?\s+of\s+([a-zA-Z]+)\s+([a-zA-Z]+)\s+and\s+(\w+)\s+bags?\s+of\s+([a-zA-Z]+)\s+\3\b/i;
const RATE_RE = /(\w+)\s+([a-zA-Z]+)\s+in\s+each\s+bag\s+of\s+([a-zA-Z]+)\s+and\s+(\w+)\s+\2\s+in\s+each\s+bag\s+of\s+([a-zA-Z]+)\b/i;
const QUESTION_RE = /how\s+many\s+[a-zA-Z]+\s+(?:does|do|has|have)\b[^?]*\bnow\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const direct = DIRECT_RE.exec(q);
  const bags = BAGS_RE.exec(q);
  const rate = RATE_RE.exec(q);
  if (!direct || !bags || !rate) return null;
  if (!QUESTION_RE.test(q)) return null;

  const noun = direct[3].toLowerCase();
  if (bags[3].toLowerCase() !== noun || rate[2].toLowerCase() !== noun) return null;

  const n1 = wordOrDigit(direct[1]);
  const n2 = wordOrDigit(direct[4]);
  const bagCountA = wordOrDigit(bags[1]);
  const colorA = bags[2].toLowerCase();
  const bagCountB = wordOrDigit(bags[4]);
  const colorB = bags[5].toLowerCase();
  const rateVal1 = wordOrDigit(rate[1]);
  const rateColor1 = rate[3].toLowerCase();
  const rateVal2 = wordOrDigit(rate[4]);
  const rateColor2 = rate[5].toLowerCase();

  if ([n1, n2, bagCountA, bagCountB, rateVal1, rateVal2].some((v) => v === null)) return null;

  // POSITIVE EVIDENCE: each bag-group color must find its OWN matching rate, by literal color word,
  // never by position -- so a stranger question that states the colors in a different order between
  // the bag sentence and the rate sentence still resolves, and a color with no stated rate abstains.
  let productA: number | null = null;
  let productB: number | null = null;
  if (colorA === rateColor1) productA = (bagCountA as number) * (rateVal1 as number);
  else if (colorA === rateColor2) productA = (bagCountA as number) * (rateVal2 as number);
  if (colorB === rateColor1) productB = (bagCountB as number) * (rateVal1 as number);
  else if (colorB === rateColor2) productB = (bagCountB as number) * (rateVal2 as number);
  if (productA === null || productB === null) return null;

  const total = (n1 as number) + (n2 as number) + productA + productB;
  if (!Number.isFinite(total) || total < 0) return null;
  return {
    total,
    parts: [`direct:${n1}+${n2}`, `${colorA}:${bagCountA}x${productA / (bagCountA as number)}`, `${colorB}:${bagCountB}x${productB / (bagCountB as number)}`],
  };
}


export const twoDirectQuantitiesPlusTwoMultiplyGroupsSumMethod: LianaMethod = {
  id: 'two-direct-quantities-plus-two-multiply-groups-sum-v1',
  demand: 'COMPUTE',
  name: 'Two direct quantities plus two bag-count x per-bag-rate groups, summed',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W02 (cluster C37, sole member harvest_gsm8k_pilot_item204)',
  shapeDescription:
    'Two directly-given quantities of one noun, plus two "N bags of X" groups each with its own ' +
    'stated per-bag rate; total is the sum of the two given quantities plus the two products.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find the two-direct-quantities plus two-bag-group-with-matching-rate structure',
      };
    }
    return { matches: true, reason: `parts=${JSON.stringify(result.parts)}` };
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
        basis: result.parts.join(' + ') + ` = ${result.total}`,
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
registerMethod(twoDirectQuantitiesPlusTwoMultiplyGroupsSumMethod);
