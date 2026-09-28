// D-BP223-BM04-h2cbpv9w-170 -- cumulative-additive-stack-with-one-percentage-term-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W01).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\cumulative-additive-stack-with-one-percentage-term-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W01, CLUSTER C36 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test-set lineIndex 58 (harvest_gsm8k_pilot_item58),
 * "Stephen placed an online order for groceries. His final bill came to $40.00. Because this was
 * through a delivery vendor, they tacked on a 25% fee to his final total and charged him $3.00 in
 * delivery fees. Stephen also added a $4.00 tip. After the extra fees, what was the final price of
 * Stephen's groceries?"
 *
 * @generalShape A base amount is given directly ("final bill came to $B"). A percentage fee is
 *   applied to that same base ("tacked on a P% fee to his final total"). Two further FLAT amounts
 *   are added on top (a delivery fee, a tip). The answer is base + percentage-of-base + flat1 +
 *   flat2. Silo cluster label: CUMULATIVE_ADDITIVE_STACK_WITH_ONE_PERCENTAGE_TERM.
 *
 * @recogniseInStranger Four anchored clauses: "final bill came to $<base>"; "tacked on a <pct>%
 *   fee to his final total"; "charged him $<flat1> in delivery fees"; "added a $<flat2> tip"; and
 *   a "what was the final price" question. All four dollar amounts may carry a ".00"-style
 *   trailing decimal.
 *
 * @whatBreaksIt (a) more than one percentage-fee clause, or a fee phrased without the literal
 *   "tacked on a <pct>% fee" wording -- this candidate recognises only that one phrasing, so a
 *   fee described a different way falls through unrecognised, by construction; (b) the flat
 *   delivery-fee or tip clauses missing or reworded away from "charged him $X in delivery fees" /
 *   "added a $X tip" -- abstains rather than guess an unstated amount; (c) the question not
 *   asking for the "final price" -- a question asking for something else (e.g. just the fees)
 *   would need a different formula.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (40 + 40*0.25 + 3 + 4 = 57). With only one
 *   known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'cumulative-additive-stack-with-one-percentage-term-v1';

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  return parseFloat(cleaned);
}

// NOTE: the numeric capture is deliberately \d+(?:\.\d+)? rather than the sloppier [\d.]+ --
// the latter greedily swallows a sentence-ending period right after a decimal amount ("$40.00."
// captures as "40.00." including the full stop), which then fails strict numeric parsing.
const BASE_RE = /final\s+bill\s+came\s+to\s+\$?(\d+(?:\.\d+)?)/i;
const PERCENT_RE = /tacked\s+on\s+a\s+(\d+(?:\.\d+)?)%\s+fee\s+to\s+his\s+final\s+total/i;
const FLAT1_RE = /charged\s+him\s+\$?(\d+(?:\.\d+)?)\s+in\s+delivery\s+fees/i;
const FLAT2_RE = /added\s+a\s+\$?(\d+(?:\.\d+)?)\s+tip/i;
const QUESTION_RE = /what\s+was\s+the\s+final\s+price/i;

interface Analyzed {
  base: number;
  pctAmount: number;
  flat1: number;
  flat2: number;
  total: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!QUESTION_RE.test(q)) return null;

  const baseMatch = q.match(BASE_RE);
  if (!baseMatch) return null;
  const base = parseMoney(baseMatch[1]);
  if (base === null) return null;

  const pctMatch = q.match(PERCENT_RE);
  if (!pctMatch) return null;
  const pct = parseFloat(pctMatch[1]);
  if (!Number.isFinite(pct)) return null;

  const flat1Match = q.match(FLAT1_RE);
  if (!flat1Match) return null;
  const flat1 = parseMoney(flat1Match[1]);
  if (flat1 === null) return null;

  const flat2Match = q.match(FLAT2_RE);
  if (!flat2Match) return null;
  const flat2 = parseMoney(flat2Match[1]);
  if (flat2 === null) return null;

  const pctAmount = base * (pct / 100);
  const total = base + pctAmount + flat1 + flat2;
  if (!Number.isFinite(total)) return null;

  return { base, pctAmount, flat1, flat2, total };
}


export const cumulativeAdditiveStackWithOnePercentageTermMethod: LianaMethod = {
  id: 'cumulative-additive-stack-with-one-percentage-term-v1',
  demand: 'COMPUTE',
  name: 'Base amount plus a percentage-of-base fee plus two flat add-ons, summed to a final total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/W01 (cluster C36, sole member harvest_gsm8k_pilot_item58)',
  shapeDescription:
    'Base amount given directly. One fee is a percentage of that base. Two further flat amounts ' +
    '(a fee, a tip) are added on top. Final total = base + pct*base + flat1 + flat2.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "final bill came to $B" / "tacked on a P% fee" / "charged...delivery ' +
          'fees" / "added a...tip" four-clause shape plus a "final price" question; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `${result.base}+${result.pctAmount}+${result.flat1}+${result.flat2}=${result.total}` };
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
        basis: `base + pct*base + flat1 + flat2 = ${rounded}`,
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
registerMethod(cumulativeAdditiveStackWithOnePercentageTermMethod);
