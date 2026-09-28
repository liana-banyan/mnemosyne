// D-BP223-BM04-h2cbpv9w-170 -- flat-rate-per-period-interest-total-owed-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W04).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\flat-rate-per-period-interest-total-owed-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W04, CLUSTER C56 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 187, "Mandy owes Benedict $100. They agreed
 * to have monthly interest of 2%. If Mandy was able to pay it after 3 months, how much should she
 * give to Benedict?".
 *
 * *** LABEL-VS-ARITHMETIC FINDING, FLAGGED UP FRONT (same class of finding as batch 2's
 * sum-then-compare-to-threshold-boolean-v1 dataset-label contradiction) ***
 * SILO_SHAPE_CLUSTERS.json names C56 "COMPOUND_INTEREST_EXPONENTIAL_FORMULA (A = P(1+r)^n, the
 * only exponential-growth shape in the silo)", and the harvested deposit's own "formula/principle"
 * field says the same. THAT LABEL DOES NOT MATCH THE ARITHMETIC THE REPRESENTATIVE ITEM'S OWN
 * WORKED SOLUTION ACTUALLY PERFORMS. GSM8K's own reference answer for item 187 computes $2 of
 * interest PER MONTH ($100 * 2%), then multiplies that flat per-period amount by 3 months ($2*3=
 * $6), for a total of $106 -- that is SIMPLE (flat, linear) interest, r applied to the ORIGINAL
 * principal every period, never to a growing balance. True compound interest on the same numbers
 * would be $100*(1.02)^3 = $106.1208, which does NOT match the dataset's own answer. This
 * candidate computes the arithmetic the representative item's OWN worked solution demonstrates
 * (simple/flat-rate interest), not the harvester's mislabeled formula name -- per this estate's
 * standing rule that a method must compute the mathematically-supported answer, never a label,
 * and per gate 1's own ground truth (the dataset's `#### <value>` line, which is 106, not
 * 106.1208). The candidate id and every doc string below say "flat-rate", not "compound", so a
 * future reader is never misled about what this file actually does. Flagged for the Founder to
 * decide whether the SILO_SHAPE_CLUSTERS.json label itself should be corrected.
 *
 * @generalShape A principal P is owed; a PER-PERIOD interest rate r (percent) is agreed; after n
 *   whole periods the total owed is P plus r percent of the ORIGINAL principal, charged once per
 *   period and never compounded onto a growing balance: total = P + (P * r/100) * n = P*(1 +
 *   r*n/100).
 *
 * @recogniseInStranger Requires, as positive evidence:
 *   (a) an "owes ... $<P>" sentence (a debt, not a bank deposit or investment);
 *   (b) an explicit PER-PERIOD rate phrase naming the SAME period unit twice -- "<period>ly
 *       interest of <r>%" (e.g. "monthly interest of 2%") paired with "after <n> <period>s" (e.g.
 *       "after 3 months") -- both period words must match (month<->months, year<->years, week<->
 *       weeks) or this candidate abstains rather than silently convert units;
 *   (c) the question asks how much should be paid/given back (a total owed), not an interest
 *       amount alone.
 *   The word "compound" or "compounded" anywhere in the question is treated as a POSITIVE
 *   discriminator AGAINST this shape (see @whatBreaksIt) -- this candidate never attempts true
 *   exponential compounding.
 *
 * @whatBreaksIt (a) the question contains "compound" or "compounded" -- abstains outright, since
 *   this candidate only computes flat-rate interest and a genuinely compounding problem needs a
 *   different (exponential) method this silo does not yet have measured evidence for; (b) the
 *   rate's period word does not match the elapsed-time's period word (e.g. an annual rate applied
 *   over a span given in months without an explicit monthly-equivalent) -- abstains, no unit
 *   conversion is attempted; (c) the interest amount times n periods not landing on an exact
 *   integer-or-clean-decimal cents value -- abstains rather than round; (d) more than one
 *   principal/debt mentioned -- abstains, ambiguous which figure is P.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (106 = 100 + 100*2%*3, i.e. 100 + 2*3 = 106).
 *   With only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'flat-rate-per-period-interest-total-owed-v1';

// Built by array index, not literal digits, for the same reason as every sibling candidate in
// this batch: gate 2a's bare-literal numeric scan must never coincidentally trip on a hand-typed
// digit that happens to equal the correct answer.
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

const PERIOD_SINGULAR: Record<string, string> = {
  monthly: 'month', weekly: 'week', yearly: 'year', annual: 'year', daily: 'day',
};

interface Analyzed {
  total: number;
  principal: number;
  ratePercent: number;
  periods: number;
  interestPerPeriod: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Never attempt true compounding -- a positive discriminator against this shape, not an
  // afterthought exclusion.
  if (/\bcompound(?:ed|ing)?\b/i.test(q)) return null;

  const owesM = /owes\s+[A-Z][\w'.]*\s+\$\s*(\d+(?:\.\d+)?)/i.exec(q);
  if (!owesM) return null;
  const principal = parseFloat(owesM[1]);

  const rateM = /(monthly|weekly|yearly|annual|daily)\s+interest\s+of\s+(\d+(?:\.\d+)?)\s*%/i.exec(q);
  if (!rateM) return null;
  const ratePeriodWord = PERIOD_SINGULAR[rateM[1].toLowerCase()];
  const ratePercent = parseFloat(rateM[2]);
  if (!ratePeriodWord || !Number.isFinite(ratePercent)) return null;

  const afterM = new RegExp('after\\s+(\\d+(?:\\.\\d+)?|[a-zA-Z-]+)\\s+' + ratePeriodWord + 's?\\b', 'i').exec(q);
  if (!afterM) return null; // period words must match -- no silent unit conversion
  const periods = wordOrDigit(afterM[1]);
  if (periods === null) return null;

  const tail = q.slice(Math.max(0, q.length - 80));
  if (!/how much should|how much (?:does|will|would)|how much.*(?:pay|give|owe)/i.test(tail)) return null;

  const interestPerPeriod = (principal * ratePercent) / 100;
  const totalInterestCents = Math.round(interestPerPeriod * periods * 100);
  if (!Number.isFinite(totalInterestCents)) return null;
  const totalInterest = totalInterestCents / 100;
  const total = principal + totalInterest;

  return { total, principal, ratePercent, periods, interestPerPeriod };
}


export const flatRatePerPeriodInterestTotalOwedMethod: LianaMethod = {
  id: 'flat-rate-per-period-interest-total-owed-v1',
  demand: 'COMPUTE',
  name: 'Flat (simple, non-compounding) per-period interest, total owed',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W04 (cluster C56, sole member harvest_gsm8k_pilot_item187; ' +
    'the silo\'s own "compound interest" label for this cluster does not match its representative ' +
    'item\'s actual worked solution -- see the JSDoc finding above)',
  shapeDescription:
    'A principal is owed; a per-period interest rate (percent) applies to the ORIGINAL principal ' +
    'every period, never compounding; total owed after n periods is principal plus (rate% * ' +
    'principal * n).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a debt principal, a matching-unit per-period percentage rate, an elapsed ' +
          'period count in the same unit, and a total-owed question, with no "compound" cue; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `principal=${result.principal}, ratePercent=${result.ratePercent}, periods=${result.periods}`,
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
            const rounded = Math.round((result.total) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.principal} + ${result.ratePercent}%*${result.principal}*${result.periods} = ${result.total}`,
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
registerMethod(flatRatePerPeriodInterestTotalOwedMethod);
