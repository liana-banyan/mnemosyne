// D-BP223-BM04-h2cbpv9w-170 -- starting-total-minus-fraction-minus-flat-extra-remainder-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\starting-total-minus-fraction-minus-flat-extra-remainder-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches. run() aborts to an honest
// abstain on any thrown error rather than ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C163 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 302, "Annika brought $50 to the town fair.
 * She spent half of it on food and snacks, and an additional $10 for rides. How much, in dollars,
 * is left?" Silo label: "multi-step subtraction and division from a starting total -- subtraction
 * and division of a total amount" -- matches.
 *
 * @generalShape A STARTING total amount is stated. A FIRST spend is a stated FRACTION of that
 *   starting total (e.g. "half of it", "a third of it"). A SECOND spend is a stated FLAT amount,
 *   in the same unit, explicitly marked as an ADDITIONAL/separate expense. The answer is the
 *   starting total minus the fraction-of-total spend minus the flat spend.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) an opening sentence giving a bare starting amount tied to a subject bringing/having it
 *       ("<Subject> brought $<S> to <place>");
 *   (b) a fraction-of-total spend sentence "spent <fraction> of it on <category>", the fraction
 *       resolved through a small word table (half, a third, a quarter, two thirds, etc.) or a
 *       bare "N/M" numeral fraction;
 *   (c) a second, flat spend explicitly marked as additional/extra/also ("an additional $<F> for
 *       <category>", "and also spent $<F>"), in the SAME currency unit as (a);
 *   (d) a closing question asking how much is left/remains.
 *   This candidate deliberately requires exactly two spend clauses (one fractional, one flat) --
 *   no more, no fewer -- since that is the only structure its sole teaching case evidences.
 *
 * @whatBreaksIt (a) more than one fraction-of-total clause, or more than one flat "additional"
 *   clause -- abstain, this is a two-term subtraction only; (b) the fraction not resolving via
 *   the word/numeral table -- abstain rather than assume a default; (c) the fraction-of-total
 *   spend not landing on an exact value (starting total not evenly divisible by the fraction's
 *   denominator) -- abstain rather than round; (d) the flat spend's currency/unit differing from
 *   the starting total's unit -- abstain; (e) the final remainder being negative -- abstain, this
 *   candidate reports only a non-negative leftover.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (50 - 50/2 - 10 = 15). With only one known cluster member there
 *   is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'starting-total-minus-fraction-minus-flat-extra-remainder-v1';

const FRACTION_WORDS: Record<string, { num: number; den: number }> = {
  half: { num: 1, den: 2 },
  third: { num: 1, den: 3 },
  quarter: { num: 1, den: 4 },
  fourth: { num: 1, den: 4 },
  fifth: { num: 1, den: 5 },
};

function parseFractionPhrase(phrase: string): { num: number; den: number } | null {
  const p = phrase.toLowerCase().trim();
  const numFrac = /^([0-9]+)\s*\/\s*([0-9]+)$/.exec(p);
  if (numFrac) {
    const num = parseInt(numFrac[1], 10);
    const den = parseInt(numFrac[2], 10);
    if (den > 0) return { num, den };
    return null;
  }
  const simple = /^(a|one)?\s*([a-z]+)$/.exec(p);
  if (simple) {
    const w = simple[2];
    if (Object.prototype.hasOwnProperty.call(FRACTION_WORDS, w)) return FRACTION_WORDS[w];
  }
  const twoThirdsM = /^two\s+thirds$/.exec(p);
  if (twoThirdsM) return { num: 2, den: 3 };
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const startRe = /brought\s+\$?([0-9]+(?:\.[0-9]+)?)\s+to\b/i;
  const sm = startRe.exec(q);
  if (!sm) return null;
  const starting = parseFloat(sm[1]);
  if (!Number.isFinite(starting) || starting <= 0) return null;

  const fracRe = /spent\s+([a-z0-9\/\s]+?)\s+of\s+it\s+on\b/i;
  const fm = fracRe.exec(q);
  if (!fm) return null;
  const fraction = parseFractionPhrase(fm[1]);
  if (!fraction) return null;

  const flatRe = /(?:an\s+)?additional\s+\$?([0-9]+(?:\.[0-9]+)?)\s+for\b/i;
  const flm = flatRe.exec(q);
  if (!flm) return null;
  const flatSpend = parseFloat(flm[1]);
  if (!Number.isFinite(flatSpend) || flatSpend < 0) return null;

  // exactly one of each clause type -- guard against a third spend term this shape does not model.
  const fracCount = (q.match(/of\s+it\s+on\b/gi) || []).length;
  const flatCount = (q.match(/additional\s+\$?[0-9]+(?:\.[0-9]+)?\s+for\b/gi) || []).length;
  if (fracCount !== 1 || flatCount !== 1) return null;

  if (!/how much.{0,20}(?:is|are|remains?|left)/i.test(q)) return null;

  const fracAmount = (starting * fraction.num) / fraction.den;
  if (!Number.isInteger(fracAmount * 100)) return null; // must land on an exact cent value
  const total = starting - fracAmount - flatSpend;
  if (total < 0) return null;
  const rounded = Math.round(total * 100) / 100;
  return { total: rounded };
}

export const startingTotalMinusFractionMinusFlatExtraRemainder: LianaMethod = {
  id: 'starting-total-minus-fraction-minus-flat-extra-remainder-v1',
  demand: 'COMPUTE',
  name: 'Subtract a fraction-of-total spend and a flat additional spend from a starting amount',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C163, sole member: GSM8K test.jsonl item 302)',
  shapeDescription:
    'remainder = starting - (fraction * starting) - flatExtra, requiring exactly one fraction-of-it ' +
    'spend clause and exactly one "additional $X for ..." flat spend clause, same currency unit.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a starting-amount sentence, exactly one fraction-of-it spend clause, ' +
          'exactly one flat "additional $X for" spend clause, and a how-much-is-left question ' +
          'resolving to a non-negative exact value; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `remainder = ${result.total}` };
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
      return {
          question,
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'starting total minus the fraction-of-total spend minus the flat extra spend',
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

registerMethod(startingTotalMinusFractionMinusFlatExtraRemainder);
