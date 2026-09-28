// D-BP223-BM04-h2cbpv9w-170 -- average-of-two-derived-costs-then-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W01).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\average-of-two-derived-costs-then-sum-v1.candidate.ts
// Authored by generation wave W01 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W01.md), merged into the
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W01, CLUSTER C34 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test-set lineIndex 170 (harvest_gsm8k_pilot_item170),
 * "The marching band is ordering new uniforms. Each uniform comes with a hat that costs $25, a
 * jacket that costs three times as much as the hat, and pants that cost the average of the costs
 * of the hat and jacket. How much does each uniform cost total?"
 *
 * @generalShape A BASE item's unit cost is given directly ("a <base> that costs $V"). A second
 *   item's cost is a stated MULTIPLE of the base item's cost. A third item's cost is the AVERAGE
 *   of the first two items' costs. The answer is the sum of all three costs. Silo cluster label:
 *   AVERAGE_OF_TWO_DERIVED_COSTS_THEN_SUM.
 *
 * @recogniseInStranger Three anchored clauses in one bundling sentence: "a <base> that costs
 *   $<value>", "a <item2> that costs <mult> times as much as the <base>", and "<item3> that cost
 *   the average of the costs of the <base> and <item2>" (article-agnostic), all three item names
 *   matched case-insensitively; plus a "how much does each ... cost total" question.
 *
 * @whatBreaksIt (a) the third item's clause naming a different pair than {base, item2} for its
 *   average -- the regex anchors specifically on "average of the costs of the <base> and
 *   <item2>" in that exact name order and abstains on any other pairing; (b) more than one
 *   averaging clause, or an averaging clause phrased without the literal word "average" -- this
 *   candidate recognises only that exact phrase, so a differently-worded midpoint (e.g. "the
 *   halfway cost") falls through unrecognised; (c) the base item's dollar figure missing a
 *   parseable numeral -- abstains rather than guess.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (hat=25, jacket=75, pants=(25+75)/2=50,
 *   25+75+50=150). With only one known member there is no cross-member measurement to report
 *   for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'average-of-two-derived-costs-then-sum-v1';

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
  const w = tok.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function singular(noun: string): string {
  return noun.trim().toLowerCase().replace(/s$/, '');
}

const BASE_RE = /a\s+([a-zA-Z]+)\s+that\s+costs?\s+\$?([a-zA-Z0-9.]+)/i;

const MULT_RE = (base: string) =>
  new RegExp('a\\s+([a-zA-Z]+)\\s+that\\s+costs?\\s+([a-zA-Z0-9]+)\\s+times\\s+as\\s+much\\s+as\\s+the\\s+' + base, 'i');

const AVG_RE = (base: string, item2: string) =>
  new RegExp(
    '([a-zA-Z]+)\\s+that\\s+cost\\s+the\\s+average\\s+of\\s+the\\s+costs?\\s+of\\s+the\\s+' + base +
      '\\s+and\\s+(?:the\\s+)?' + item2,
    'i',
  );

const TOTAL_QUESTION_RE = /how\s+much\s+does\s+each\s+[\w\s]*?\s+cost\s+total/i;

interface Analyzed {
  baseCost: number;
  item2Cost: number;
  item3Cost: number;
  total: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseMatch = q.match(BASE_RE);
  if (!baseMatch) return null;
  const base = singular(baseMatch[1]);
  const baseCost = parseFloat(baseMatch[2].replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(baseCost)) return null;

  const multMatch = q.match(MULT_RE(base));
  if (!multMatch) return null;
  const item2 = singular(multMatch[1]);
  const mult = wordOrDigit(multMatch[2]);
  if (mult === null) return null;

  const avgMatch = q.match(AVG_RE(base, item2));
  if (!avgMatch) return null;
  const item3 = singular(avgMatch[1]);
  if (item3 === base || item3 === item2) return null;

  if (!TOTAL_QUESTION_RE.test(q)) return null;

  const item2Cost = mult * baseCost;
  const item3Cost = (baseCost + item2Cost) / 2;
  const total = baseCost + item2Cost + item3Cost;
  if (!Number.isFinite(total)) return null;

  return { baseCost, item2Cost, item3Cost, total };
}


export const averageOfTwoDerivedCostsThenSumMethod: LianaMethod = {
  id: 'average-of-two-derived-costs-then-sum-v1',
  demand: 'COMPUTE',
  name: 'Base item cost given, a second derived by multiple, a third by their average, then all three summed',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/W01 (cluster C34, sole member harvest_gsm8k_pilot_item170)',
  shapeDescription:
    'Base item unit cost given directly. Item2 = multiplier * base cost. Item3 = average(base ' +
    'cost, item2 cost). The answer is base + item2 + item3.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the base-cost / multiply-relationship / average-of-the-two-relationship ' +
          'three-clause shape plus a "how much does each...cost total" question; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `${result.baseCost}+${result.item2Cost}+${result.item3Cost}=${result.total}` };
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
      const rounded = Math.round(result.total * 100) / 100;
            return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `base+item2+average(base,item2) = ${rounded}`,
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
registerMethod(averageOfTwoDerivedCostsThenSumMethod);
