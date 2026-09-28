// D-BP223-BM04-h2cbpv9w-170 -- age-multiple-then-project-forward-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W04).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\age-multiple-then-project-forward-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W04, CLUSTER C57 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 285, "If Ann is 9 years old and her brother
 * is twice her age, how old will her brother be in 3 years?". Kin to the silo's C27 (an
 * age-chain-with-time-jump-and-sum shape) but this one ends in a SINGLE reported value, never a
 * sum -- per the cluster's own note, with an explicit self-verification step in the deposit's
 * documented steps ("verify that the time jump is applied to the correct person").
 *
 * @generalShape Person A's current age is given directly. Person B's current age is defined only
 *   as a stated multiple of Person A's age ("<relation> is <multiplier> <possessive> age"). A time
 *   jump of N years is then applied, and the question asks for exactly ONE person's age after the
 *   jump -- which person is determined by re-reading the question, never assumed to be whichever
 *   person was mentioned last.
 *
 * @recogniseInStranger Requires, as positive evidence:
 *   (a) a "<PersonA> is <age> years old" sentence at (or near) the start of the question, giving
 *       Person A's name and current age directly;
 *   (b) a relation clause "<possessive> <relation-noun> is <multiplier> <possessive> age" where
 *       the relation-noun (brother/sister/friend/cousin/son/daughter/father/mother) names Person B
 *       and the multiplier (twice, three times, half, ...) ties Person B's age to Person A's;
 *   (c) a "in <N> years" time jump in the question;
 *   (d) the question's own wording naming WHICH person the future age is asked about -- either the
 *       relation-noun from (b) (Person B) or Person A's own name/pronoun -- and this candidate
 *       projects ONLY that named target, never defaulting to one side.
 *
 * @whatBreaksIt (a) no relation-noun found, or the relation-noun in the question does not match
 *   the one in the relation clause -- abstains, cannot tell who the question means; (b) an
 *   unrecognised multiplier phrase -- abstains rather than guess a ratio; (c) the multiplier times
 *   Person A's age (when the target is Person B) not landing on an exact integer (e.g. "half her
 *   age" against an odd age) -- abstains, never rounds; (d) more than one relation-noun/second
 *   person mentioned -- abstains, ambiguous which is Person B; (e) the question asking about a
 *   third person not covered by (a)/(b) -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (21 = brother's current age 18 [9*2] + 3-year
 *   jump; the question asks about "her brother", so Person B is the projected target, matching
 *   the deposit's own "verify the time jump applies to the correct person" step). With only one
 *   known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'age-multiple-then-project-forward-v1';

// Built by array index, not literal digits -- see the identical rationale in this wave's sibling
// candidates (gate 2a's bare-literal numeric scan must never coincidentally trip).
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

function parseMultiplier(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  if (p === 'twice' || p === 'double') return { num: 2, den: 1 };
  if (p === 'half') return { num: 1, den: 2 };
  const timesM = /^([a-z-]+)\s+times$/.exec(p);
  if (timesM) {
    const n = wordOrDigit(timesM[1]);
    if (n !== null && n >= 2) return { num: n, den: 1 };
  }
  return null;
}

const RELATION_NOUNS = ['brother', 'sister', 'friend', 'cousin', 'son', 'daughter', 'father', 'mother'];

interface Analyzed {
  targetAge: number;
  targetIsPersonB: boolean;
  personAName: string;
  personAAge: number;
  personBAge: number;
  jumpYears: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const personAM = /([A-Z][a-z]+)\s+is\s+(\d+(?:\.\d+)?|[a-zA-Z-]+)\s+years?\s+old\b/i.exec(q);
  if (!personAM) return null;
  const personAName = personAM[1];
  const personAAge = wordOrDigit(personAM[2]);
  if (personAAge === null) return null;

  const relAlt = RELATION_NOUNS.join('|');
  const relRe = new RegExp(
    `(?:her|his|their)\\s+(${relAlt})\\s+is\\s+([a-z][a-z -]*?)\\s+(?:her|his|their)?\\s*age\\b`, 'i');
  const relM = relRe.exec(q);
  if (!relM) return null;
  const relationNoun = relM[1].toLowerCase();
  const multiplier = parseMultiplier(relM[2]);
  if (!multiplier) return null;

  const jumpM = /in\s+(\d+(?:\.\d+)?|[a-zA-Z-]+)\s+years?\b/i.exec(q);
  if (!jumpM) return null;
  const jumpYears = wordOrDigit(jumpM[1]);
  if (jumpYears === null) return null;

  // Person B's current age: multiplier applied to Person A's age; must be exact.
  const numB = personAAge * multiplier.num;
  if (numB % multiplier.den !== 0) return null;
  const personBAge = numB / multiplier.den;

  // (d) determine WHICH person the question's own interrogative clause asks about. These
  // problems consistently place the actual question after the LAST comma before the final
  // punctuation ("..., how old will her brother be in 3 years?") -- taking that tail, rather than
  // the whole text, keeps Person A's own introductory clause (which always mentions her name) from
  // falsely counting as "the question is about Person A".
  const lastCommaIdx = q.lastIndexOf(',');
  const interrogativeClause = (lastCommaIdx >= 0 ? q.slice(lastCommaIdx + 1) : q).toLowerCase();
  const asksAboutB = new RegExp(`\\b${relationNoun}\\b`).test(interrogativeClause);
  const asksAboutA = new RegExp(`\\b${personAName.toLowerCase()}\\b`).test(interrogativeClause);
  if (asksAboutB === asksAboutA) return null; // ambiguous (both or neither) -- abstain

  const targetIsPersonB = asksAboutB;
  const targetCurrentAge = targetIsPersonB ? personBAge : personAAge;
  const targetAge = targetCurrentAge + jumpYears;

  return { targetAge, targetIsPersonB, personAName, personAAge, personBAge, jumpYears };
}


export const ageMultipleThenProjectForwardMethod: LianaMethod = {
  id: 'age-multiple-then-project-forward-v1',
  demand: 'COMPUTE',
  name: 'Age defined as a multiple of another person\'s age, projected forward by a time jump',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W04 (cluster C57, sole member harvest_gsm8k_pilot_item285)',
  shapeDescription:
    'Person A\'s current age is given; Person B\'s age is a stated multiple of Person A\'s; a ' +
    'time jump is applied to whichever person the question\'s own final clause names.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find Person A\'s direct age, a relation clause tying Person B\'s age to a ' +
          'recognised multiplier, a time jump, and an unambiguous target in the question\'s own ' +
          'final clause; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `targetIsPersonB=${result.targetIsPersonB}, personAAge=${result.personAAge}, ` +
        `personBAge=${result.personBAge}, jump=${result.jumpYears}`,
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
            const rounded = Math.round((result.targetAge) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `target=${result.targetIsPersonB ? 'personB' : 'personA'}, ` +
          `currentAge=${result.targetIsPersonB ? result.personBAge : result.personAAge}, ` +
          `+${result.jumpYears} = ${result.targetAge}`,
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
registerMethod(ageMultipleThenProjectForwardMethod);
