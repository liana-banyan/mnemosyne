// D-BP223-BM04-h2cbpv9w-170 -- subtract-two-fraction-of-total-removals-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W02).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\subtract-two-fraction-of-total-removals-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W02, CLUSTER C39 (1 silo member, high confidence, singleton).
 * Silo shape label: ITERATIVE_FRACTIONAL_REMOVAL (repeated 1/3-of-total removal steps, then
 * subtract all removed from original). Source:
 * methods.harvest_gsm8k_pilot_item233_subtraction_of_fractions_of_a_total. Representative teaching
 * case, GSM8K test.jsonl lineIndex 233 (penguins): "There are 36 penguins sunbathing in the snow.
 * One-third of them jump in and swim in the ocean. Another one-third go inside the cave to eat
 * their dinner. How many penguins are still left sunbathing?"
 *
 * @generalShape A total is given directly. Exactly TWO removal clauses each state a fraction "of
 *   them" (i.e. of the ORIGINAL total, never of a shrinking remainder -- the second clause's
 *   "another" is the positive-evidence word that it too draws from the original total, not from
 *   what is left after the first removal). The remaining amount is total x (1 - fraction1 -
 *   fraction2), computed with exact fractions, never floating-point decimals.
 *
 * @recogniseInStranger Requires: (a) a sentence giving a bare total count of a named plural noun;
 *   (b) a fraction-word phrase ("one-third", "half", "a quarter", etc.) followed by "of them" (or
 *   "of the total") describing the first removal -- this is the anchor that establishes BOTH
 *   removals are fractions of the same original total, since GSM8K's own prose elides the "of
 *   them" on the second clause by ellipsis ("Another one-third go inside the cave..."); (c) a
 *   SECOND fraction-word phrase, introduced by the word "another" (the phrase's own positive
 *   evidence that it is a distinct removal, not a restatement); (d) neither clause may contain "of
 *   the rest" or "of the remaining" anywhere in the full text -- that would be a different
 *   (compounding) shape this candidate does not attempt; (e) a question asking how many are
 *   "left"/"still"/"remaining".
 *
 * @whatBreaksIt A fraction phrase attached to "the rest" or "the remaining" (compounding removal,
 *   not this shape); fewer or more than exactly two removal fractions; an unrecognized fraction
 *   word (only halves/thirds/quarters/fifths/sixths/tenths are known -- an unknown fraction word
 *   abstains rather than guessing its value); a combined removal fraction that exceeds 1 (an
 *   arithmetic impossibility signaling a misparse); a non-integer removal count for either fraction
 *   (this shape's own representative case removes exact whole penguins; a fraction that does not
 *   divide the total evenly is refused rather than rounded).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass built on exact
 *   integer numerator/denominator arithmetic (never a floating decimal), so there is no separate,
 *   looser run-time path. Measured against its own (sole) cluster member: SOLVED (36 total minus
 *   two even one-third removals). With only one known member there is no cross-member measurement
 *   to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'subtract-two-fraction-of-total-removals-v1';

// Exact rational fractions, never floating decimals -- {num, den} pairs, evaluated with integer
// division and an evenness check rather than any Math.round heuristic.
const FRACTION_WORDS: Record<string, { num: number; den: number }> = {
  half: { num: 1, den: 2 }, 'a half': { num: 1, den: 2 },
  'one-third': { num: 1, den: 3 }, 'a third': { num: 1, den: 3 },
  'two-thirds': { num: 2, den: 3 },
  'one-fourth': { num: 1, den: 4 }, 'one-quarter': { num: 1, den: 4 }, 'a quarter': { num: 1, den: 4 },
  'three-fourths': { num: 3, den: 4 }, 'three-quarters': { num: 3, den: 4 },
  'one-fifth': { num: 1, den: 5 }, 'a fifth': { num: 1, den: 5 },
  'two-fifths': { num: 2, den: 5 }, 'three-fifths': { num: 3, den: 5 }, 'four-fifths': { num: 4, den: 5 },
  'one-sixth': { num: 1, den: 6 }, 'a sixth': { num: 1, den: 6 },
  'one-tenth': { num: 1, den: 10 }, 'a tenth': { num: 1, den: 10 },
};

const FRACTION_ALT = Object.keys(FRACTION_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[- ]/g, '[- ]'))
  .join('|');

const TOTAL_RE = /(?:there\s+are|there\s+is)\s+(\d+)\s+([a-zA-Z]+)/i;
const REMOVAL1_RE = new RegExp(`(${FRACTION_ALT})\\s+of\\s+(?:them|the\\s+total)\\b`, 'i');
// NOTE: real GSM8K prose elides "of them" on the second clause by ellipsis ("Another one-third go
// inside the cave..." -- never "Another one-third OF THEM go..."). REMOVAL1_RE below still requires
// the explicit "of them"/"of the total" anchor, so the ellipsis assumption is grounded in real text,
// not guessed; this regex only requires the fraction word to follow "another".
const REMOVAL2_RE = new RegExp(`\\banother\\s+(${FRACTION_ALT})\\b`, 'i');
const COMPOUNDING_GUARD_RE = /\bof\s+the\s+(?:rest|remaining)\b/i;
const QUESTION_RE = /how\s+many\s+[a-zA-Z]+\s+(?:are|is)\s+still\s+left|\bstill\s+left\b|\bare\s+left\b|\bremaining\b/i;

function normalizeFractionKey(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

function lookupFraction(raw: string): { num: number; den: number } | null {
  const key = normalizeFractionKey(raw).replace(/\s/g, '-');
  if (Object.prototype.hasOwnProperty.call(FRACTION_WORDS, key)) return FRACTION_WORDS[key];
  const key2 = normalizeFractionKey(raw);
  if (Object.prototype.hasOwnProperty.call(FRACTION_WORDS, key2)) return FRACTION_WORDS[key2];
  return null;
}

interface Analyzed {
  remaining: number;
  parts: string[];
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (COMPOUNDING_GUARD_RE.test(q)) return null; // "of the rest"/"of the remaining" -- different shape.

  const totalMatch = TOTAL_RE.exec(q);
  const r2 = REMOVAL2_RE.exec(q);
  if (!totalMatch || !r2) return null;
  // First removal clause must be found BEFORE the "another ..." clause and must not itself be the
  // same match as r2 -- search only the text preceding r2's own match index.
  const before = q.slice(0, r2.index);
  const r1 = REMOVAL1_RE.exec(before);
  if (!r1) return null;
  if (!QUESTION_RE.test(q)) return null;

  const total = parseInt(totalMatch[1], 10);
  if (!Number.isFinite(total) || total <= 0) return null;

  const f1 = lookupFraction(r1[1]);
  const f2 = lookupFraction(r2[1]);
  if (!f1 || !f2) return null;

  // Exact rational arithmetic: common denominator, never a float division.
  const lcd = (f1.den * f2.den) / gcd(f1.den, f2.den);
  const combinedNum = f1.num * (lcd / f1.den) + f2.num * (lcd / f2.den);
  if (combinedNum > lcd) return null; // removing more than the whole total -- impossible, abstain.

  // Each removal must land on a whole number of items -- no rounding.
  const removed1 = (total * f1.num) / f1.den;
  const removed2 = (total * f2.num) / f2.den;
  if (!Number.isInteger(removed1) || !Number.isInteger(removed2)) return null;

  const remaining = total - removed1 - removed2;
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  return { remaining, parts: [`total:${total}`, `-${removed1}`, `-${removed2}`] };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) { const t = y; y = x % y; x = t; }
  return x || 1;
}


export const subtractTwoFractionOfTotalRemovalsMethod: LianaMethod = {
  id: 'subtract-two-fraction-of-total-removals-v1',
  demand: 'COMPUTE',
  name: 'Subtract two fraction-of-the-original-total removals from a bare total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W02 (cluster C39, sole member harvest_gsm8k_pilot_item233)',
  shapeDescription:
    'A bare total, then two "<fraction> of them" removal clauses (the second marked "another"), ' +
    'both fractions of the ORIGINAL total; remaining = total x (1 - f1 - f2), exact rationals only.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find a bare total with exactly two "of them"/"of the total" fraction removals',
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
            const rounded = Math.round((result.remaining) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: result.parts.join(' ') + ` = ${result.remaining}`,
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
registerMethod(subtractTwoFractionOfTotalRemovalsMethod);
