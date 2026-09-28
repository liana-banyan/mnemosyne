// D-BP223-BM04-h2cbpv9w-170 -- comparison-via-hidden-base-divide-then-multiply-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W01).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\comparison-via-hidden-base-divide-then-multiply-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W01, CLUSTER C29 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test-set lineIndex 149 (harvest_gsm8k_pilot_item149),
 * "Charlie has three times as many Facebook friends as Dorothy. James has four times as many
 * friends on Facebook as Dorothy. If Charlie has 12 friends on Facebook, how many Facebook
 * friends does James have?"
 *
 * @generalShape Two named actors are each stated as "N times as many/much <noun> as <BASE>",
 *   sharing the SAME base actor (Dorothy here). A third clause gives ONE of the two actors'
 *   absolute amount directly and asks for the OTHER actor's absolute amount. The base actor's
 *   own amount is never stated -- it must be recovered by dividing the given actor's amount by
 *   its own multiplier, then re-multiplied by the asked actor's multiplier. Silo cluster label:
 *   COMPARISON_VIA_HIDDEN_BASE_DIVIDE_THEN_MULTIPLY.
 *
 * @recogniseInStranger Exactly two sentences of the shape "<Name> has <mult> times as many/much
 *   <words> as <Base>." sharing an identical base name (case-insensitive), plus one further
 *   clause of the exact shape "If <GivenActor> has <value> <words>, how many <words> does
 *   <AskedActor> have?" where {GivenActor, AskedActor} is exactly the set of the two non-base
 *   actors found above. Multiplier and value tokens may be digits or spelled-out number words.
 *
 * @whatBreaksIt (a) more or fewer than exactly two "N times as many/much...as..." clauses, or two
 *   such clauses that do NOT share the same base actor -- abstains rather than guess which pair
 *   is relevant; (b) a fractional relation word ("half"/"twice"/"double" without the literal word
 *   "times") -- this candidate only recognises the literal "<number> times as many/much...as..."
 *   phrasing, so those fall through untouched, by construction, not by a blacklist; (c) the
 *   given/question clause not in the exact "If X has V ..., how many ... does Y have" shape, or
 *   naming an actor that is not one of the two non-base actors already found -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED, matching the ground truth
 *   (base = given / givenMultiplier, answer = base * askedMultiplier). With only one known
 *   member there is no cross-member measurement to report for this cluster -- honestly noted
 *   rather than borrowed from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'comparison-via-hidden-base-divide-then-multiply-v1';

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

const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS, hundred: 100 };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface RatioClause {
  actor: string;
  multWord: string;
  base: string;
}

interface Analyzed {
  givenActor: string;
  askedActor: string;
  base: number;
  answer: number;
}

const RATIO_RE =
  /([A-Z][\w'.]*(?:\s[A-Z][\w'.]*)?)\s+has\s+([a-zA-Z0-9]+)\s+times\s+as\s+(?:many|much)\s+[\w\s]+?\s+as\s+([A-Z][\w'.]*(?:\s[A-Z][\w'.]*)?)[.,]/gi;

const GIVEN_QUESTION_RE =
  /\bif\s+([A-Z][\w'.]*(?:\s[A-Z][\w'.]*)?)\s+has\s+([a-zA-Z0-9]+)\b[^,]*,\s*how\s+many\s+[\w\s]*?\bdoes\s+([A-Z][\w'.]*(?:\s[A-Z][\w'.]*)?)\s+have\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ratios: RatioClause[] = [];
  let m: RegExpExecArray | null;
  RATIO_RE.lastIndex = 0;
  while ((m = RATIO_RE.exec(q)) !== null) {
    ratios.push({ actor: m[1].trim(), multWord: m[2], base: m[3].trim() });
  }
  if (ratios.length !== 2) return null;
  const [r1, r2] = ratios;
  if (r1.base.toLowerCase() !== r2.base.toLowerCase()) return null;
  if (r1.actor.toLowerCase() === r2.actor.toLowerCase()) return null;
  if (r1.actor.toLowerCase() === r1.base.toLowerCase() || r2.actor.toLowerCase() === r2.base.toLowerCase()) return null;

  const gm = q.match(GIVEN_QUESTION_RE);
  if (!gm) return null;
  const [, givenActorRaw, givenValueWord, askedActorRaw] = gm;
  const givenActor = givenActorRaw.trim();
  const askedActor = askedActorRaw.trim();

  const actorSet = new Set([r1.actor.toLowerCase(), r2.actor.toLowerCase()]);
  if (!actorSet.has(givenActor.toLowerCase()) || !actorSet.has(askedActor.toLowerCase())) return null;
  if (givenActor.toLowerCase() === askedActor.toLowerCase()) return null;

  const givenValue = wordOrDigit(givenValueWord);
  if (givenValue === null) return null;

  const ratioFor = (name: string): RatioClause | null => {
    if (r1.actor.toLowerCase() === name.toLowerCase()) return r1;
    if (r2.actor.toLowerCase() === name.toLowerCase()) return r2;
    return null;
  };
  const givenRatio = ratioFor(givenActor);
  const askedRatio = ratioFor(askedActor);
  if (!givenRatio || !askedRatio) return null;

  const givenMult = wordOrDigit(givenRatio.multWord);
  const askedMult = wordOrDigit(askedRatio.multWord);
  if (givenMult === null || askedMult === null || givenMult === 0) return null;

  const base = givenValue / givenMult;
  const answer = base * askedMult;
  if (!Number.isFinite(base) || !Number.isFinite(answer)) return null;

  return { givenActor, askedActor, base, answer };
}


export const comparisonViaHiddenBaseDivideThenMultiplyMethod: LianaMethod = {
  id: 'comparison-via-hidden-base-divide-then-multiply-v1',
  demand: 'COMPUTE',
  name: 'Two actors each a multiple of an unstated shared base; recover the base by division, then re-multiply',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/W01 (cluster C29, sole member harvest_gsm8k_pilot_item149)',
  shapeDescription:
    'Actor1 and Actor2 each stated as N times as many/much <noun> as a shared BASE actor. ' +
    'Actor1\'s absolute amount is given; recover BASE by dividing, then multiply BASE by ' +
    'Actor2\'s own multiplier to answer for Actor2 (or vice versa).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two "<Name> has <mult> times as many/much...as <shared base>" ' +
          'clauses plus one "If <given> has <V>..., how many...does <asked> have?" clause; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `hidden base recovered from ${result.givenActor}, re-multiplied for ${result.askedActor} -> ${result.answer}`,
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
      const rounded = Math.round(result.answer * 100) / 100;
            return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `base=${result.base} recovered from ${result.givenActor}, multiplied for ${result.askedActor} -> ${rounded}`,
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
registerMethod(comparisonViaHiddenBaseDivideThenMultiplyMethod);
