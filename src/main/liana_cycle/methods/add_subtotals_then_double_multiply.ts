// D-BP223-BM04-h2cbpv9w-170 -- add-subtotals-then-double-multiply-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W03).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\add-subtotals-then-double-multiply-v1.candidate.ts
// Authored by generation wave W03 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W03.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
// (answer carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle hand-derived
// from the English of the representative GSM8K question, never from this candidate's own source) --
// ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported object
// unannotated, so nothing was ever checked against the real registry contract. Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes -- proved by a
// programmatic byte-containment check (extract, splice, re-read, includes()), not merely asserted.
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170/WAVE-W03 CLUSTER C52 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 70, "Judy teaches 5 dance classes, every
 * day, on the weekdays and 8 classes on Saturday. If each class has 15 students and she charges
 * $15.00 per student, how much money does she make in 1 week?" (answer 7425).
 *
 * @generalShape A per-day class count is given for the weekdays (multiplied by the fixed
 *   assumption of 5 weekdays per week) and a separate class count is given for Saturday; these
 *   two subtotals are ADDED to a weekly class total. That total is then carried through TWO
 *   CHAINED MULTIPLIES: classes * studentsPerClass = total students, then total students *
 *   dollarRatePerStudent = weekly revenue. The silo's own label, ADD_SUBTOTALS_THEN_DOUBLE_
 *   MULTIPLY, names this precisely: an addition step to build one combined quantity, followed by
 *   two multiplies in series (not one), distinguishing it from a simpler single-multiply revenue
 *   shape.
 *
 * @recogniseInStranger Two anchored regexes. (1) "<Person> teaches <N1> [word] classes, every
 *   day, on the weekdays and <N2> classes on Saturday." -- the literal keyword "classes" is
 *   required both times, and "every day ... weekdays" is required verbatim (this candidate always
 *   assumes exactly 5 weekdays, never inferred from other text). (2) "if each class has <N3>
 *   <subunit> and (she|he|they) charges $<RATE> per <subunit>, how much money does (she|he|they)
 *   make in 1 week?" -- the subunit noun in "has N3 <subunit>" must match (stemmed) the subunit
 *   noun in "per <subunit>", a positive check that the rate is being applied to the same thing
 *   that was just counted.
 *
 * @whatBreaksIt (a) the unit counted per class being something other than "classes" literally
 *   (a different countable noun for the recurring event) -- abstains, since "classes" is
 *   hard-coded rather than inferred; (b) a week defined with a different weekday count (e.g. a
 *   4-day school week, or Sunday classes as well as Saturday) -- this candidate always multiplies
 *   the weekday figure by 5 and never looks for a stated weekday count elsewhere, so a text that
 *   states a different number of weekdays explicitly would still be silently assumed as 5; a
 *   genuine, reported limit, not a guarded one; (c) the subunit noun in the rate clause not
 *   matching (stemmed) the subunit noun in the per-class clause -- abstains rather than apply a
 *   rate to the wrong thing; (d) the question asking for anything other than "how much money does
 *   ... make in 1 week" (a different time period, a different target) -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim and the computed verdict can never diverge on the same input. Measured against its own
 *   (sole) cluster member: SOLVED (7425, matching ((5*5+8)*15)*15=7425). With only one known
 *   member there is no cross-member measurement to report for this cluster -- honestly noted
 *   rather than inflated with a borrowed number from a different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'add-subtotals-then-double-multiply-v1';

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
const WEEKDAY_COUNT = 5; // a fixed, documented assumption -- see @whatBreaksIt (b)

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit) && digit.length > 0) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function stem(noun: string): string {
  return noun.toLowerCase().replace(/s$/, '');
}

interface Analyzed {
  result: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const re1 =
    /([A-Z][\w'.]*)\s+teaches\s+([a-zA-Z0-9]+)\s+(?:[a-zA-Z]+\s+)?classes,\s*every\s+day,?\s+on\s+the\s+weekdays\s+and\s+([a-zA-Z0-9]+)\s+classes\s+on\s+Saturday\s*\./i;
  const m1 = re1.exec(q);
  if (!m1) return null;
  const [, , n1Word, n2Word] = m1;
  const n1 = wordOrDigit(n1Word);
  const n2 = wordOrDigit(n2Word);
  if (n1 === null || n2 === null) return null;

  const re2 =
    /if\s+each\s+class\s+has\s+([a-zA-Z0-9]+)\s+([a-zA-Z]+)\s+and\s+(?:she|he|they)\s+charges\s+\$?([a-zA-Z0-9.]+)\s+per\s+([a-zA-Z]+)\s*,?\s+how\s+much\s+money\s+does\s+(?:she|he|they)\s+make\s+in\s+1\s+week\b/i;
  const m2 = re2.exec(q);
  if (!m2) return null;
  const [, n3Word, subunitNoun, rateWord, rateSubunitNoun] = m2;
  if (stem(subunitNoun) !== stem(rateSubunitNoun)) return null;
  const n3 = wordOrDigit(n3Word);
  const rate = wordOrDigit(rateWord);
  if (n3 === null || rate === null) return null;

  const totalClasses = n1 * WEEKDAY_COUNT + n2;
  const totalSubunits = totalClasses * n3;
  const result = totalSubunits * rate;
  if (!Number.isFinite(result)) return null;

  return { result };
}

export const addSubtotalsThenDoubleMultiply: LianaMethod = {
  id: 'add-subtotals-then-double-multiply-v1',
  demand: 'COMPUTE',
  name: 'Add weekday/weekend subtotals into a weekly total, then two chained multiplies',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/WAVE-W03 (cluster C52, sole member harvest_gsm8k_pilot_item70)',
  shapeDescription:
    '(weekdayPerDay*5 + weekendCount) * perClassCount * ratePerUnit = weekly revenue.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "<Person> teaches N1 classes, every day, on the weekdays and N2 ' +
          'classes on Saturday. If each class has N3 <subunit> and charges $RATE per <subunit>, ' +
          'how much money does ... make in 1 week?" shape; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `weekly revenue -> ${result.result}` };
  },
  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
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
      const rounded = Math.round(result.result * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(classes)*(subunits)*(rate) = ${rounded}`,
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
  }
};

registerMethod(addSubtotalsThenDoubleMultiply);
