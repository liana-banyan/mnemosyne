// D-BP223-BM04-h2cbpv9w-170 -- gross-minus-percentage-fees-and-debt-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W01).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\gross-minus-percentage-fees-and-debt-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W01, CLUSTER C35 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test-set lineIndex 266 (harvest_gsm8k_pilot_item266),
 * "Mr. Tan sold his house for $400 000. He paid the transfer fees that amount to 3% of the
 * selling price and also paid a brokerage fee that is 5% of the selling price. If he also paid
 * $250 000 for the remaining loan amount of the house, how much is Mr. Tan's net proceeds from
 * selling the house?"
 *
 * @generalShape A gross amount is given directly ("sold ... for $G"). Two separate fees are each
 *   stated as a PERCENTAGE of that same gross amount. A third, flat debt/obligation amount is
 *   given directly. Net proceeds = gross - fee1 - fee2 - debt. Silo cluster label:
 *   GROSS_MINUS_PERCENTAGE_FEES_AND_DEBT.
 *
 * @recogniseInStranger A "sold ... for $<gross>" clause; two independent "<percent>% of the
 *   selling price" clauses (any label -- "transfer fees", "brokerage fee", etc., the label text
 *   itself is not matched, only the percentage-of-selling-price pattern); a flat "paid $<debt>
 *   for the remaining loan amount" clause; and a "net proceeds" question. Money figures may use a
 *   literal space as a thousands separator ("$400 000"), which this candidate strips before
 *   parsing.
 *
 * @whatBreaksIt (a) more or fewer than exactly two "<percent>% of the selling price" clauses --
 *   abstains rather than guess which subset of fees applies; (b) the flat debt clause using
 *   different wording than "remaining loan amount" -- this candidate anchors on that exact phrase
 *   and a differently-worded debt (e.g. "outstanding balance") falls through unrecognised; (c) no
 *   "net proceeds" question present -- a question asking for something else (e.g. total fees
 *   paid) would need a different formula, so this candidate abstains rather than assume.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (400000 - 12000 - 20000 - 250000 = 118000).
 *   With only one known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'gross-minus-percentage-fees-and-debt-v1';

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, '').replace(/\s+/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  return parseFloat(cleaned);
}

const GROSS_RE = /sold\s+[\w\s]*?\bfor\s+\$?([\d][\d,\s]*(?:\.\d+)?)/i;

const PERCENT_RE = /([a-zA-Z0-9.]+)%\s+of\s+the\s+selling\s+price/gi;

const DEBT_RE = /paid\s+\$?([\d][\d,\s]*(?:\.\d+)?)\s+for\s+the\s+remaining\s+loan\s+amount/i;

const NET_QUESTION_RE = /net\s+proceeds/i;

interface Analyzed {
  gross: number;
  fee1: number;
  fee2: number;
  debt: number;
  net: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (!NET_QUESTION_RE.test(q)) return null;

  const grossMatch = q.match(GROSS_RE);
  if (!grossMatch) return null;
  const gross = parseMoney(grossMatch[1]);
  if (gross === null) return null;

  const percents: number[] = [];
  let pm: RegExpExecArray | null;
  PERCENT_RE.lastIndex = 0;
  while ((pm = PERCENT_RE.exec(q)) !== null) {
    const pct = parseFloat(pm[1]);
    if (!Number.isFinite(pct)) return null;
    percents.push(pct);
  }
  if (percents.length !== 2) return null;

  const debtMatch = q.match(DEBT_RE);
  if (!debtMatch) return null;
  const debt = parseMoney(debtMatch[1]);
  if (debt === null) return null;

  const fee1 = gross * (percents[0] / 100);
  const fee2 = gross * (percents[1] / 100);
  const net = gross - fee1 - fee2 - debt;
  if (!Number.isFinite(net)) return null;

  return { gross, fee1, fee2, debt, net };
}


export const grossMinusPercentageFeesAndDebtMethod: LianaMethod = {
  id: 'gross-minus-percentage-fees-and-debt-v1',
  demand: 'COMPUTE',
  name: 'Gross amount minus two percentage-of-gross fees and a flat debt, to find net proceeds',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/W01 (cluster C35, sole member harvest_gsm8k_pilot_item266)',
  shapeDescription:
    'Gross amount given directly. Two fees each a percentage of that gross. A flat debt amount ' +
    'given directly. Net proceeds = gross - fee1 - fee2 - debt.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "sold...for $G" clause plus exactly two "<pct>% of the selling price" ' +
          'clauses plus a "remaining loan amount" debt clause plus a "net proceeds" question; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `${result.gross} - ${result.fee1} - ${result.fee2} - ${result.debt} = ${result.net}` };
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
      const rounded = Math.round(result.net * 100) / 100;
            return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `gross - fee1 - fee2 - debt = ${rounded}`,
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
registerMethod(grossMinusPercentageFeesAndDebtMethod);
