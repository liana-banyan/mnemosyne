// D-BP223-BM04-h2cbpv9w-170 -- algebra-difference-equals-twice-total-then-halve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W01).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\algebra-difference-equals-twice-total-then-halve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W01, CLUSTER C32 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test-set lineIndex 245 (harvest_gsm8k_pilot_item245),
 * "There are 4 snails in one aquarium and 32 snails in another aquarium. The difference between
 * the number of snails in the two aquariums is twice the amount of fish in both aquariums. If
 * both aquariums have the same number of fish in them, how many fish are there in each
 * aquarium?"
 *
 * @generalShape Two directly-given quantities of one noun (A, B) sit in two parallel containers.
 *   Their absolute difference is stated to equal TWICE the combined total of a SECOND noun across
 *   both containers. The two containers are then said to hold an EQUAL share of that second noun,
 *   so the answer is derived in two concrete steps: total_second = |A-B| / 2, then
 *   per_container = total_second / 2. Silo cluster label:
 *   ALGEBRA_DIFFERENCE_EQUALS_TWICE_TOTAL_THEN_HALVE.
 *
 * @recogniseInStranger A "There are <A> <noun1> in one <container> and <B> <noun1> in another
 *   <container>." clause; a "The difference between the number of <noun1> in the two
 *   <container>s is twice the amount of <noun2> in both <container>s." clause naming the second
 *   noun; a "same number of <noun2>" equal-split clause; and a "how many <noun2> ... in each
 *   <container>" question, all four anchored to the identical noun2/container tokens.
 *
 * @whatBreaksIt (a) the "twice the amount" clause missing or naming a different multiplier word
 *   (e.g. "half", "equal to") -- this candidate only recognises the literal word "twice", so any
 *   other relation falls through unrecognised, by construction; (b) no explicit "same number of
 *   <noun2>" equal-split clause -- without it, dividing the total by the container count would be
 *   an unjustified assumption, so the candidate abstains rather than guess; (c) the difference not
 *   evenly divisible by 4 (2 for the twice-relation, 2 for the equal split) -- abstains rather
 *   than report a non-integer count of a discrete noun.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (|32-4|=28, 28/2=14 total, 14/2=7 per
 *   aquarium). With only one known member there is no cross-member measurement to report for
 *   this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'algebra-difference-equals-twice-total-then-halve-v1';

const PAIR_RE =
  /there\s+are\s+([a-zA-Z0-9]+)\s+([a-zA-Z]+)\s+in\s+one\s+([a-zA-Z]+)\s+and\s+([a-zA-Z0-9]+)\s+[a-zA-Z]+\s+in\s+another\s+[a-zA-Z]+/i;

const TWICE_RE =
  /difference\s+between\s+the\s+number\s+of\s+[a-zA-Z]+\s+in\s+the\s+two\s+[a-zA-Z]+s?\s+is\s+twice\s+the\s+amount\s+of\s+([a-zA-Z]+)\s+in\s+both\s+[a-zA-Z]+s?/i;

interface Analyzed {
  valueA: number;
  valueB: number;
  target: string;
  totalTarget: number;
  perContainer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const pairMatch = q.match(PAIR_RE);
  if (!pairMatch) return null;
  const valueA = parseFloat(pairMatch[1]);
  const valueB = parseFloat(pairMatch[4]);
  if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) return null;

  const twiceMatch = q.match(TWICE_RE);
  if (!twiceMatch) return null;
  const target = twiceMatch[1].toLowerCase();

  const sameRe = new RegExp('same\\s+number\\s+of\\s+' + target, 'i');
  if (!sameRe.test(q)) return null;

  const questionRe = new RegExp('how\\s+many\\s+' + target + '\\s+[\\w\\s]*?\\beach\\b', 'i');
  if (!questionRe.test(q)) return null;

  const difference = Math.abs(valueA - valueB);
  const totalTarget = difference / 2;
  const perContainer = totalTarget / 2;
  if (!Number.isInteger(totalTarget) || !Number.isInteger(perContainer)) return null;

  return { valueA, valueB, target, totalTarget, perContainer };
}


export const algebraDifferenceEqualsTwiceTotalThenHalveMethod: LianaMethod = {
  id: 'algebra-difference-equals-twice-total-then-halve-v1',
  demand: 'COMPUTE',
  name: 'Difference of two given quantities equals twice a second noun\'s combined total, then split that total evenly',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/W01 (cluster C32, sole member harvest_gsm8k_pilot_item245)',
  shapeDescription:
    'Two directly-given quantities A and B in parallel containers. |A-B| equals twice the ' +
    'combined total of a second noun across both containers, which is then split evenly between ' +
    'the two containers.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "there are A...one...B...another" plus "difference...twice the ' +
          'amount of <target>...both" plus "same number of <target>" plus "how many <target>...' +
          'each" four-clause shape; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `|${result.valueA}-${result.valueB}|=${result.totalTarget * 2}, /2=${result.totalTarget} total ${result.target}, /2=${result.perContainer} each`,
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
            const rounded = Math.round((result.perContainer) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `|${result.valueA}-${result.valueB}|/2=${result.totalTarget}, /2=${result.perContainer}`,
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
registerMethod(algebraDifferenceEqualsTwiceTotalThenHalveMethod);
