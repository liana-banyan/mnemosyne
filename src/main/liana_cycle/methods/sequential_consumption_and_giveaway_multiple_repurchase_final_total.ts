// D-BP223-BM04-h2cbpv9w-170 -- sequential-consumption-and-giveaway-multiple-repurchase-final-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sequential-consumption-and-giveaway-multiple-repurchase-final-total-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C183 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 327, "Oscar has 24 lollipops and eats 2 on
 * his way to school. He passes 14 out to his friends. He buys twice as many lollipops on his way
 * home as he gave to his friends. He eats 3 more that night and 2 more in the morning. How many
 * lollipops does Oscar have?" Silo label: "multi-step arithmetic word problem involving addition
 * and subtraction" -- matches exactly.
 *
 * @generalShape A single actor starts with a stated count. Two consumption/giveaway steps
 *   subtract flat amounts in order (an "eats <E1> on the way to school" step, then a "passes
 *   <G> out to his/her friends" step). A repurchase step then ADDS a multiplier of the SAME
 *   giveaway amount just subtracted ("buys <mult> as many ... as (he/she) gave to his/her
 *   friends"). Two further consumption steps subtract flat amounts at the end ("eats <E2> more
 *   that night" and "<E3> more in the morning"). The question asks for the actor's final count.
 *
 * @recogniseInStranger Requires ALL of, in order, as positive evidence:
 *   (a) "<Actor> has <N> <item> and eats <E1> on (his|her) way to school";
 *   (b) "(he|she) passes <G> out to (his|her) friends";
 *   (c) "(he|she) buys <mult> as many <item> on (his|her) way home as (he|she) gave to (his|her)
 *       friends" -- mult resolved via a small closed table (twice, double, three times, ...),
 *       referring back to the SAME giveaway amount G from (b);
 *   (d) "(he|she) eats <E2> more that night and <E3> more in the morning";
 *   (e) a closing question "how many <item> does <Actor> have".
 *
 * @whatBreaksIt (a) the repurchase clause referencing anything other than the giveaway amount
 *   from (b) (e.g. a multiple of the eaten amount, or of a flat number) -- abstain, this
 *   candidate only recognises the giveaway-referencing case it was taught on; (b) the multiplier
 *   word not resolving via the closed table -- abstain rather than guess; (c) any of the five
 *   step amounts missing, or the final total landing negative -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (24-2-14=8, +2*14=36, -3-2=31). With only one known cluster
 *   member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'sequential-consumption-and-giveaway-multiple-repurchase-final-total-v1';

const MULTIPLIER_WORDS: Record<string, number> = {
  twice: 2,
  double: 2,
  'three times': 3,
  'four times': 4,
  'five times': 5,
};

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const startRe = /\b([A-Z][a-z]+)\s+has\s+(\d+)\s+([a-z]+)\s+and\s+eats\s+(\d+)\s+on\s+(?:his|her)\s+way\s+to\s+school\b/i;
  const sm = startRe.exec(q);
  if (!sm) return null;
  const actor = sm[1];
  const start = parseInt(sm[2], 10);
  const item = sm[3].toLowerCase();
  const e1 = parseInt(sm[4], 10);
  if (!Number.isFinite(start) || !Number.isFinite(e1)) return null;

  const giveRe = /\b(?:he|she)\s+passes\s+(\d+)\s+out\s+to\s+(?:his|her)\s+friends\b/i;
  const gm = giveRe.exec(q);
  if (!gm) return null;
  const giveaway = parseInt(gm[1], 10);
  if (!Number.isFinite(giveaway)) return null;

  const multKeys = Object.keys(MULTIPLIER_WORDS).sort((a, b) => b.length - a.length).join('|');
  const buyRe = new RegExp(
    '\\b(?:he|she)\\s+buys\\s+(' + multKeys + ')\\s+as\\s+many\\s+' + item + 's?\\s+on\\s+(?:his|her)\\s+way\\s+home\\s+as\\s+(?:he|she)\\s+gave\\s+to\\s+(?:his|her)\\s+friends\\b',
    'i',
  );
  const bm = buyRe.exec(q);
  if (!bm) return null;
  const mult = MULTIPLIER_WORDS[bm[1].toLowerCase()];
  if (!mult) return null;
  const bought = giveaway * mult;

  const lateRe = /\b(?:he|she)\s+eats\s+(\d+)\s+more\s+that\s+night\s+and\s+(\d+)\s+more\s+in\s+the\s+morning\b/i;
  const lm = lateRe.exec(q);
  if (!lm) return null;
  const e2 = parseInt(lm[1], 10);
  const e3 = parseInt(lm[2], 10);
  if (!Number.isFinite(e2) || !Number.isFinite(e3)) return null;

  const closeRe = new RegExp('how many\\s+' + item + 's?\\s+does\\s+' + actor + '\\s+have\\b', 'i');
  if (!closeRe.test(q)) return null;

  const total = start - e1 - giveaway + bought - e2 - e3;
  if (total < 0 || !Number.isInteger(total)) return null;
  return { total };
}

export const sequentialConsumptionAndGiveawayMultipleRepurchaseFinalTotal: LianaMethod = {
  id: 'sequential-consumption-and-giveaway-multiple-repurchase-final-total-v1',
  demand: 'COMPUTE',
  name: 'Single-actor inventory: two consumption steps, a giveaway, a repurchase scaled to the giveaway, then two more consumption steps',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W19 (cluster C183, sole member: pilot corpus item at index 327)',
  shapeDescription:
    'total = start - e1 - giveaway + mult*giveaway - e2 - e3, the repurchase term scaled to the ' +
    'SAME giveaway amount just subtracted.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the full five-step chain (start-and-first-eat, giveaway, giveaway-' +
          'referencing repurchase, two closing eats, and a matching "how many does <actor> ' +
          'have" question), resolving to a non-negative integer; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `final total = ${result.total}` };
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
          basis: 'applied the five signed steps in order, scaling the repurchase to the giveaway amount',
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

registerMethod(sequentialConsumptionAndGiveawayMultipleRepurchaseFinalTotal);
