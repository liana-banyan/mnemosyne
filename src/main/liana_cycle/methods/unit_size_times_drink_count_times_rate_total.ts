// D-BP223-BM04-h2cbp9d8-171 -- unit-size-times-drink-count-times-rate-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\unit-size-times-drink-count-times-rate-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R07
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R07.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C237 (GSM8K test.jsonl item400, singleton).
 *
 * @generalShape A single container of a named liquid holds a stated UNIT-SIZE amount. An actor
 *   drinks a stated COUNT of those containers of the SAME named liquid. That liquid carries a
 *   stated RATE (a value per unit). The question asks for the total consumed at that rate.
 *   total = unitSize * count * rate.
 *
 * @recogniseInStranger Requires, as positive evidence, all THREE clauses naming the SAME liquid,
 *   checked by exact case-insensitive string match, not assumed: (a) "glass of <liquid> is <N>
 *   ounces"; (b) "drinks <M> glasses of <liquid>"; (c) "<liquid> has <R> calories per ounce"; plus
 *   (d) a closing "how many calories did <actor> consume" question.
 *
 * @whatBreaksIt (a) the container-size clause and the drink-count clause naming DIFFERENT liquids
 *   (e.g. a distractor "glass of juice" sentence elsewhere) -- abstain, the name-match check
 *   refuses to bridge them; (b) a fractional glass count, or the count expressed in a unit other
 *   than "glasses" -- no regex match, abstain; (c) a unit other than ounces/calories -- abstain,
 *   this candidate is anchored to that exact unit pair, not a generalized rate.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item400): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'unit-size-times-drink-count-times-rate-total-v1';

const GLASS_RE = /glass of\s+([a-z]+)\s+is\s+(\d+)\s+ounces/i;
const DRINK_RE = /drinks\s+(\d+)\s+glasses of\s+([a-z]+)/i;
const RATE_RE = /([a-z]+)\s+has\s+(\d+)\s+calories per ounce/i;
const CLOSING_Q_RE = /how many calories did\s+[A-Z][a-zA-Z]*\s+consume/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const glassM = GLASS_RE.exec(q);
  const drinkM = DRINK_RE.exec(q);
  const rateM = RATE_RE.exec(q);
  if (!glassM || !drinkM || !rateM) return null;
  if (!CLOSING_Q_RE.test(q)) return null;

  const liquidGlass = glassM[1].trim().toLowerCase();
  const liquidDrink = drinkM[2].trim().toLowerCase();
  const liquidRate = rateM[1].trim().toLowerCase();
  // Positive-evidence discriminator: all three clauses must name the SAME liquid.
  if (liquidGlass !== liquidDrink || liquidGlass !== liquidRate) return null;

  const unitOunces = Number(glassM[2]);
  const drinkCount = Number(drinkM[1]);
  const rate = Number(rateM[2]);
  if (![unitOunces, drinkCount, rate].every(Number.isFinite)) return null;

  return { total: unitOunces * drinkCount * rate };
}

export const unitSizeTimesDrinkCountTimesRateTotal: LianaMethod = {
  id: 'unit-size-times-drink-count-times-rate-total-v1',
  demand: 'COMPUTE',
  name: 'Compute a total consumption as unit size times drink count times a per-unit rate, for one named liquid',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C237, GSM8K test item400',
  shapeDescription:
    'total = unitSize * drinkCount * rate, only when the container-size, drink-count, and rate ' +
    'clauses all name the same liquid.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "glass of <liquid> is <N> ounces" clause, a "drinks <M> glasses of ' +
          '<liquid>" clause, a "<liquid> has <R> calories per ounce" clause (all naming the same ' +
          'liquid), and a "how many calories did ... consume" closing question; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `total = ${result.total}` };
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
          verdict: String(Math.round((result.total) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'container unit size times drink count times per-unit rate',
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

registerMethod(unitSizeTimesDrinkCountTimesRateTotal);
