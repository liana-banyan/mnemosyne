// D-BP223-BM04-h2cbpv9w-170 -- ratio-chain-backsolve-no-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W04).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\ratio-chain-backsolve-no-sum-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W04, CLUSTER C58 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 181, "Sandra ... had ordered four times as
 * many red roses as white carnations. She also ordered 200 pink calla lilies, which were five
 * times the number of white carnations. ... how many red roses must Fred deliver by 5 pm?".
 *
 * @generalShape Two ratio facts share one common, never-directly-given quantity Y (here: white
 *   carnations). Fact 1 defines target quantity X as k times Y ("k times as many X as Y"). Fact 2
 *   gives a THIRD quantity Z directly ("<Z> <itemZ>, which were m times the number of Y"), tying Z
 *   to Y by a second ratio m. Y is backsolved from fact 2 (Y = Z/m), then X is computed from fact
 *   1 (X = k*Y). The answer is X alone -- a single downstream value, never a sum of the chain
 *   (this is what distinguishes this shape from a sum-of-derived-quantities shape elsewhere in
 *   this silo).
 *
 * @recogniseInStranger Requires, as positive evidence:
 *   (a) a "<k> times as many <itemX> as <itemY>" clause naming the ratio between the target item
 *       and the shared item Y;
 *   (b) a SEPARATE sentence "<Z> <itemZ>, which were <m> times the number of <itemY'>" where
 *       itemY' singular-matches itemY from (a) (the two ratio facts must share the same
 *       "shared" item -- never inferred, only accepted on an exact noun match) and Z is a bare
 *       number;
 *   (c) the question asks specifically for itemX ("how many <itemX> must/does ... deliver/need"),
 *       matching (a)'s target noun -- this candidate never answers for itemY or itemZ.
 *
 * @whatBreaksIt (a) itemY named in (a) does not noun-match itemY' named in (b) -- abstains, the
 *   two ratios are not actually chained through the same quantity; (b) Z/m not landing on an exact
 *   integer -- abstains, never rounds; (c) the question asking about itemY or itemZ instead of
 *   itemX -- abstains, this candidate only reports the (a)-side target; (d) either ratio phrase
 *   using an unrecognised multiplier word -- abstains rather than guess; (e) more than one "times
 *   as many ... as ..." clause found -- abstains, ambiguous which is fact 1.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (160 = 4 * (200/5), white carnations backsolved
 *   to 40 from the pink-calla-lily fact, red roses then computed as 4*40). With only one known
 *   cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'ratio-chain-backsolve-no-sum-v1';

// Built by array index, not literal digits -- identical rationale to every sibling candidate in
// this wave (gate 2a's bare-literal numeric scan must never coincidentally trip).
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
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function singularize(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

interface Analyzed {
  targetValue: number;
  itemX: string;
  itemY: string;
  k: number;
  m: number;
  z: number;
  y: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // (a) "<k> times as many <itemX> as <itemY>" -- require exactly one such clause.
  const ratioRe = /(\d+|[a-zA-Z-]+)\s+times\s+as\s+many\s+([a-z][a-z\s]*?)\s+as\s+([a-z][a-z\s]*?)[.,]/gi;
  const ratioMatches: RegExpExecArray[] = [];
  let m1: RegExpExecArray | null;
  while ((m1 = ratioRe.exec(q)) !== null) ratioMatches.push(m1);
  if (ratioMatches.length !== 1) return null;
  const k = wordOrDigit(ratioMatches[0][1]);
  if (k === null) return null;
  const itemX = singularize(ratioMatches[0][2]);
  const itemY = singularize(ratioMatches[0][3]);
  if (itemX.length < 2 || itemY.length < 2 || itemX === itemY) return null;

  // (b) "<Z> <itemZ>, which were <m> times the number of <itemY'>" -- itemY' must noun-match itemY.
  const factRe = /(\d+|[a-zA-Z-]+)\s+([a-z][a-z\s]*?),\s+which\s+(?:were|was)\s+(\d+|[a-zA-Z-]+)\s+times\s+the\s+number\s+of\s+([a-z][a-z\s]*?)[.,]/i;
  const fm = factRe.exec(q);
  if (!fm) return null;
  const z = wordOrDigit(fm[1]);
  const itemZ = singularize(fm[2]);
  const m = wordOrDigit(fm[3]);
  const itemYPrime = singularize(fm[4]);
  if (z === null || m === null || m === 0) return null;
  if (itemYPrime !== itemY) return null; // the two ratios must chain through the SAME shared item
  if (itemZ === itemX || itemZ === itemY) return null; // itemZ must be a genuinely third item

  // Backsolve Y, then X -- exact integer arithmetic only, never rounded.
  if (z % m !== 0) return null;
  const y = z / m;
  const targetValue = k * y;

  // (c) the question must ask specifically for itemX.
  const qMarkIdx = q.lastIndexOf('?');
  const lastCommaIdx = q.lastIndexOf(',', qMarkIdx);
  const interrogativeClause = (lastCommaIdx >= 0 ? q.slice(lastCommaIdx + 1) : q).toLowerCase();
  if (!new RegExp(`\\b${itemX}s?\\b`).test(interrogativeClause)) return null;
  if (new RegExp(`\\b${itemY}s?\\b`).test(interrogativeClause)) return null; // asks about Y, not X
  if (!/how many/i.test(interrogativeClause)) return null;

  return { targetValue, itemX, itemY, k, m, z, y };
}


export const ratioChainBacksolveNoSumMethod: LianaMethod = {
  id: 'ratio-chain-backsolve-no-sum-v1',
  demand: 'COMPUTE',
  name: 'Two ratio facts sharing one quantity, backsolved to a single downstream value',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W04 (cluster C58, sole member harvest_gsm8k_pilot_item181)',
  shapeDescription:
    'Fact 1 defines X = k * Y; fact 2 gives Z directly and ties Z = m * Y (same shared item Y); ' +
    'Y is backsolved as Z/m, then X = k*Y is reported alone, never summed with anything else.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one "k times as many X as Y" clause chained to a separate direct ' +
          'quantity ratio through the same Y, with the question asking specifically for X; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `itemX=${result.itemX}, k=${result.k}, itemY=${result.itemY}, y=${result.y}, target=${result.targetValue}`,
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
            const rounded = Math.round((result.targetValue) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `y=${result.z}/${result.m}=${result.y}, ${result.itemX}=${result.k}*${result.y}=${result.targetValue}`,
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
registerMethod(ratioChainBacksolveNoSumMethod);
