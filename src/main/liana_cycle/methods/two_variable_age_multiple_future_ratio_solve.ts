// D-BP223-BM04-h2cbpv9w-170 -- two-variable-age-multiple-future-ratio-solve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W02).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-variable-age-multiple-future-ratio-solve-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W02, CLUSTER C45 (1 silo member, high confidence, singleton).
 * Silo shape label: SIMULTANEOUS_TWO_VARIABLE_LINEAR_EQUATIONS (two unknowns solved via two
 * equations together, not one at a time). Source:
 * methods.harvest_gsm8k_pilot_item279_age_related_word_problem. Representative teaching case,
 * GSM8K test.jsonl lineIndex 279 (Ruby and Sam's ages): "Ruby is 6 times older than Sam. In 9
 * years, Ruby will be 3 times as old as Sam. How old is Sam now?"
 *
 * @generalShape Two people's CURRENT ages are related by a stated multiple (R = k1 x S). Their
 *   ages a stated number of years in the FUTURE are related by a DIFFERENT multiple ((R+Y) = k2 x
 *   (S+Y)). Substituting the first equation into the second and solving for the younger/base
 *   variable gives S = Y(k2-1) / (k1-k2), following this specific dataset's own convention that
 *   "N times older than" means the same thing as "N times as old as" (a simple multiple, not
 *   N+1). Two equations, two unknowns, solved together -- never one variable derived independently
 *   of the other.
 *
 * @recogniseInStranger Requires: (a) a "<NameA> is <k1> times older than <NameB>" or "<NameA> is
 *   <k1> times as old as <NameB>" clause naming the same two people the rest of the question uses;
 *   (b) an "In <Y> years, <NameA> will be <k2> times as old as <NameB>" clause referencing the
 *   SAME two names in the SAME roles as (a); (c) a "how old is <Name> now" question naming one of
 *   the two people. The candidate answers for whichever of the two names the question asks about
 *   (the base, or the multiple of the base via k1).
 *
 * @whatBreaksIt A "times younger" or "times as young as" relation (a different, unsupported
 *   direction); k1 equal to k2 (the two equations become dependent -- no unique solution via this
 *   method, abstain rather than divide by zero); a non-integer or non-positive solved age (a
 *   strong signal of a misparse -- ages here are whole positive numbers, so this candidate refuses
 *   a fractional or negative result rather than reporting it); a name in the future-clause that
 *   does not match either name from the current-age clause, or a swapped role (the future clause's
 *   "will be" subject must be the SAME person as the current clause's multiple subject).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, using exact
 *   integer arithmetic and an integer-result check (never a floating decimal comparison). Measured
 *   against its own (sole) cluster member: SOLVED (Y=9, k1=6, k2=3, S = 9x(3-1)/(6-3) = 6). With
 *   only one known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'two-variable-age-multiple-future-ratio-solve-v1';

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

const RATIO_RE = /([A-Z][a-zA-Z]*)\s+is\s+(\w+)\s+times\s+(?:older\s+than|as\s+old\s+as)\s+([A-Z][a-zA-Z]*)\b/i;
const FUTURE_RE = /[Ii]n\s+(\w+)\s+years?,?\s+([A-Z][a-zA-Z]*)\s+will\s+be\s+(\w+)\s+times\s+as\s+old\s+as\s+([A-Z][a-zA-Z]*)\b/;
const QUESTION_RE = /how\s+old\s+is\s+([A-Z][a-zA-Z]*)\s+now\b/i;

interface Analyzed {
  age: number;
  parts: string[];
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ratio = RATIO_RE.exec(q);
  const future = FUTURE_RE.exec(q);
  const question = QUESTION_RE.exec(q);
  if (!ratio || !future || !question) return null;

  const nameA = ratio[1]; // the "k1 times" multiple, e.g. Ruby
  const nameB = ratio[3]; // the base, e.g. Sam
  // POSITIVE EVIDENCE: the future clause must name the SAME two people in the SAME roles --
  // subject of "will be" is the multiple-person, "as old as" object is the base-person.
  if (future[2] !== nameA || future[4] !== nameB) return null;

  const k1 = wordOrDigit(ratio[2]);
  const y = wordOrDigit(future[1]);
  const k2 = wordOrDigit(future[3]);
  if ([k1, k2, y].some((v) => v === null)) return null;
  if (k1 === k2) return null; // dependent equations, no unique solution via this method.

  const numerator = (y as number) * ((k2 as number) - 1);
  const denominator = (k1 as number) - (k2 as number);
  if (denominator === 0 || numerator % denominator !== 0) return null;
  const baseAge = numerator / denominator;
  if (!Number.isInteger(baseAge) || baseAge <= 0) return null;

  const targetName = question[1];
  let answerAge: number;
  if (targetName === nameB) {
    answerAge = baseAge;
  } else if (targetName === nameA) {
    answerAge = baseAge * (k1 as number);
  } else {
    return null; // question asks about a third name we cannot resolve.
  }
  if (!Number.isFinite(answerAge) || answerAge < 0) return null;
  return {
    age: answerAge,
    parts: [`${nameB}=${baseAge}`, `${nameA}=${baseAge * (k1 as number)}`, `asked:${targetName}`],
  };
}


export const twoVariableAgeMultipleFutureRatioSolveMethod: LianaMethod = {
  id: 'two-variable-age-multiple-future-ratio-solve-v1',
  demand: 'COMPUTE',
  name: 'Solve two ages from a current-multiple relation and a future-multiple relation together',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W02 (cluster C45, sole member harvest_gsm8k_pilot_item279)',
  shapeDescription:
    'Current ages related by one multiple, future ages (same two people, same roles) related by ' +
    'a different multiple; substitutes and solves both equations together for an integer age.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find a matching current-multiple plus same-roles future-multiple age relation',
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
            const rounded = Math.round((result.age) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: result.parts.join(', '),
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
registerMethod(twoVariableAgeMultipleFutureRatioSolveMethod);
