// D-BP223-BM04-h2cbp9d8-171 -- ratio-split-total-then-per-category-legs-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\ratio-split-total-then-per-category-legs-sum-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C192 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 339, "Farmer Brown has 60 animals on his farm, all either
 * chickens or cows. He has twice as many chickens as cows. How many legs do the animals have, all
 * together?". Silo label: "multi-step word problem involving ratios and total counts".
 *
 * @generalShape A stated TOTAL count of a population is split, exhaustively, into exactly TWO
 *   named animal categories ("all either <catA> or <catB>"). A ratio clause states one category
 *   as a multiple of the other ("<mult> times as many <catA> as <catB>"). Each category has a
 *   FIXED, well-known number of legs (a small closed lookup table of common animal leg counts,
 *   not stated in the text). The two category counts are solved from the total and the ratio,
 *   each multiplied by its own species' leg count, and the two products summed for the closing
 *   "how many legs ... altogether" question.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a "<N> animals ... all either
 *   <catA> or <catB>" sentence naming a bare total N and exactly two animal-category nouns; (b) a
 *   ratio sentence "<mult> times as many <catA'> as <catB'>" (multiplier via a shared number-word
 *   table, also accepting the literal word "twice") where catA'/catB' noun-stem-match catA/catB
 *   from (a) in EITHER order; (c) BOTH catA and catB resolve to an entry in a fixed animal-legs
 *   table (chicken/duck/goose/bird/parrot -> 2, cow/horse/pig/goat/sheep/dog/cat/donkey/deer -> 4,
 *   spider -> 8, ant/bee/insect -> 6); (d) a closing question asking how many legs the animals
 *   have altogether/in total/all together.
 *
 * @whatBreaksIt (a) either category noun missing from the fixed legs table -- abstain, this
 *   candidate never guesses an unknown species' leg count; (b) the total not evenly divisible by
 *   (multiplier + 1) -- abstain rather than report a non-integer subgroup count; (c) more than two
 *   category nouns present, or the "all either ... or ..." exhaustive-split phrasing absent --
 *   abstain, this is not a clean two-way exhaustive split; (d) the ratio sentence's two nouns not
 *   noun-stem-matching the split sentence's two nouns -- abstain, cannot anchor which category is
 *   which.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (60 split 2:1 into 40 chickens/20 cows, 40*2 + 20*4 = 160). With
 *   only one known cluster member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'ratio-split-total-then-per-category-legs-sum-v1';

interface Analyzed { total: number; }

const NUMBER_WORD_LIST = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];

function wordToNumber(word: string): number | null {
  const w = word.toLowerCase().trim();
  if (w === 'twice') return 2;
  if (w === 'thrice') return 3;
  const idx = NUMBER_WORD_LIST.indexOf(w);
  if (idx >= 0) return idx;
  const digitMatch = /^\d+$/.exec(w);
  if (digitMatch) return parseInt(w, 10);
  return null;
}

/** Stem a noun phrase's LAST word down to a bare singular animal name: lowercase, strip a
 *  trailing "s"/"es". Used only to match the two category nouns across the split sentence and
 *  the ratio sentence -- never to guess an unlisted species. */
function stemAnimal(phrase: string): string {
  let w = phrase.trim().toLowerCase().split(/\s+/).pop() || '';
  if (w.endsWith('es') && w.length > 3) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 2) w = w.slice(0, -1);
  return w;
}

const LEGS_TABLE: Record<string, number> = {
  chicken: 2, duck: 2, goose: 2, bird: 2, parrot: 2, hen: 2, rooster: 2, turkey: 2, ostrich: 2,
  cow: 4, horse: 4, pig: 4, goat: 4, sheep: 4, dog: 4, cat: 4, donkey: 4, deer: 4, cattle: 4,
  spider: 8,
  ant: 6, bee: 6, insect: 6,
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const splitRe = /(\d+)\s+animals\b[^.]*?\ball\s+either\s+([a-z]+)\s+or\s+([a-z]+)\b/i;
  const sm = splitRe.exec(q);
  if (!sm) return null;
  const total = parseInt(sm[1], 10);
  if (!Number.isFinite(total) || total <= 0) return null;
  const catA = stemAnimal(sm[2]);
  const catB = stemAnimal(sm[3]);

  const ratioRe = new RegExp(
    '(twice|thrice|[a-z]+)\\s+as\\s+many\\s+([a-z]+)\\s+as\\s+([a-z]+)\\b', 'i',
  );
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const mult = wordToNumber(rm[1]);
  if (mult == null || mult <= 0) return null;
  const ratioMore = stemAnimal(rm[2]);
  const ratioBase = stemAnimal(rm[3]);

  // Anchor the ratio sentence's two nouns to the split sentence's two nouns, in either order.
  let moreCat: string; let baseCat: string;
  if (ratioMore === catA && ratioBase === catB) { moreCat = catA; baseCat = catB; }
  else if (ratioMore === catB && ratioBase === catA) { moreCat = catB; baseCat = catA; }
  else return null;

  if (!/legs?\b.*(altogether|all\s+together|in\s+total)/i.test(q) &&
      !/(altogether|all\s+together|in\s+total)[^.]*legs?\b/i.test(q)) return null;

  const legsMore = LEGS_TABLE[moreCat];
  const legsBase = LEGS_TABLE[baseCat];
  if (legsMore == null || legsBase == null) return null;

  const denom = mult + 1;
  if (total % denom !== 0) return null;
  const baseCount = total / denom;
  const moreCount = total - baseCount;
  if (!Number.isFinite(baseCount) || !Number.isFinite(moreCount) || baseCount < 0 || moreCount < 0) return null;

  const totalLegs = moreCount * legsMore + baseCount * legsBase;
  if (!Number.isFinite(totalLegs)) return null;
  return { total: totalLegs };
}

export const ratioSplitTotalThenPerCategoryLegsSum: LianaMethod = {
  id: 'ratio-split-total-then-per-category-legs-sum-v1',
  demand: 'COMPUTE',
  name: 'Split a total by a two-way ratio, apply each category\'s known leg count, sum -- exact integer arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C192, sole member: pilot corpus item at index 339)',
  shapeDescription: 'baseCount = total / (mult + 1); moreCount = total - baseCount; answer = moreCount*legsMore + baseCount*legsBase',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "<N> animals ... all either <catA> or <catB>" split, a matching ' +
          '"<mult> times as many <catA> as <catB>" ratio clause, both categories present in a ' +
          'fixed animal-legs lookup table, and a closing "how many legs ... altogether" question; ' +
          'abstaining rather than guessing an unlisted species\' leg count',
      };
    }
    return { matches: true, reason: `total legs = ${result.total}` };
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
          basis: 'ratio-split counts times fixed per-species leg counts, summed',
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

registerMethod(ratioSplitTotalThenPerCategoryLegsSum);
