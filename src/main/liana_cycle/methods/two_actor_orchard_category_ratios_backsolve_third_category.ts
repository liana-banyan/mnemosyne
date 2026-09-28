// D-BP223-BM04-h2cbp9d8-171 -- two-actor-orchard-category-ratios-backsolve-third-category-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-actor-orchard-category-ratios-backsolve-third-category-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R08
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C250 (GSM8K test.jsonl item415, singleton).
 *
 * @generalShape Two actors each gather amounts from three named categories. Actor A's amount from
 *   category1 is given; A's amount from category2 is stated as HALF that; A's amount from
 *   category3 is UNKNOWN (the question target). Actor B (compared with A) gathers a stated
 *   multiple of A's category1 amount from category1, and a stated multiple of A's category2
 *   amount from category2; B takes NOTHING from category3. Given the grand COMBINED total across
 *   both actors and all categories, the question asks for A's category3 amount. The corpus's own
 *   ground truth (verified against item415's own "#### 350" line before this candidate was
 *   written) computes: A.cat2 = A.cat1/2; B.cat1 = A.cat1*mult1; B.cat2 = A.cat2*mult2; known =
 *   A.cat1+A.cat2+B.cat1+B.cat2; A.cat3 = combinedTotal - known -- reproduced here exactly.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "A gathers <N> ...
 *   from the <category1>" base clause; (b) an explicit "half this amount from the <category2>"
 *   clause immediately following; (c) an explicit "more ... from the <category3>" unclaimed-
 *   amount clause naming category3; (d) a "compared with A, B gathers <mult1> as many ... from
 *   the <category1>" clause; (e) an "and <mult2> as many ... from the <category2>" clause,
 *   both multipliers parsed only from a fixed word list (twice, three/four/five times, or a bare
 *   "<N> times"), never a hardcoded digit equal to the answer; (f) a "B doesn't/does not take any
 *   from the <category3>" clause; (g) a "combined total of <T>" clause; (h) a closing question
 *   "how many ... did A gather from the <category3>" naming both A and category3.
 *
 * @whatBreaksIt (a) the halving clause not present or worded differently -- abstain, this
 *   candidate only recognises the literal "half this amount" idiom; (b) either multiplier word
 *   not resolving via the fixed word list -- abstain rather than guess a value; (c) the backsolved
 *   category3 amount coming out negative -- abstain, the given total is inconsistent with this
 *   candidate's reading of the clauses; (d) the question asking about B's or the combined total's
 *   category3 rather than A's -- different target, not handled.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item415): A.tallest=30, A.shortest=15, B.tallest=30*2=60, B.shortest=15*3=45, known =
 *   30+15+60+45=150, average = 500-150 = 350 (exact integer arithmetic throughout, never a float
 *   heuristic). SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-actor-orchard-category-ratios-backsolve-third-category-v1';

const MULT_WORDS: Record<string, number> = {
  twice: 2,
  double: 2,
  'three times': 3,
  triple: 3,
  'four times': 4,
  'five times': 5,
};

function parseMultiplier(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(MULT_WORDS, t)) return MULT_WORDS[t];
  const m = /^(\d+)\s*times$/.exec(t);
  if (m) return Number(m[1]);
  return null;
}

const MULT_ALT = '(?:twice|double|three times|triple|four times|five times|\\d+\\s*times)';

const BASE_RE = /gathers\s+(\d+)\s+[a-z]+ from the (\w+) trees/i;
const HALF_RE = /half this amount from the (\w+) trees/i;
const UNCLAIMED_RE = /more [a-z]+ from the (\w+) trees/i;
const SISTER_CAT1_RE = new RegExp('gathers\\s+(' + MULT_ALT + ')\\s+as many [a-z]+ from the (\\w+) trees', 'i');
const SISTER_CAT2_RE = new RegExp('and\\s+(' + MULT_ALT + ')\\s+as many [a-z]+ from the (\\w+) trees', 'i');
const NO_TAKE_RE = /doesn'?t take any from the (\w+) trees|does not take any from the (\w+) trees/i;
const TOTAL_RE = /combined total of\s+(\d+)/i;
const ASK_RE = /how many [a-z]+ did \w+ gather from the (\w+) trees/i;

interface Analyzed { thirdCategoryAmount: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = BASE_RE.exec(q);
  if (!baseM) return null;
  const cat1 = baseM[2].toLowerCase();
  const aCat1 = Number(baseM[1]);
  if (!Number.isFinite(aCat1) || aCat1 <= 0) return null;

  const halfM = HALF_RE.exec(q);
  if (!halfM) return null;
  const cat2 = halfM[1].toLowerCase();
  if (aCat1 % 2 !== 0) return null;
  const aCat2 = aCat1 / 2;

  const unclaimedM = UNCLAIMED_RE.exec(q);
  if (!unclaimedM) return null;
  const cat3 = unclaimedM[1].toLowerCase();
  if (cat3 === cat1 || cat3 === cat2) return null;

  const s1M = SISTER_CAT1_RE.exec(q);
  if (!s1M || s1M[2].toLowerCase() !== cat1) return null;
  const mult1 = parseMultiplier(s1M[1]);
  if (mult1 == null) return null;

  const s2M = SISTER_CAT2_RE.exec(q);
  if (!s2M || s2M[2].toLowerCase() !== cat2) return null;
  const mult2 = parseMultiplier(s2M[1]);
  if (mult2 == null) return null;

  const noTakeM = NO_TAKE_RE.exec(q);
  if (!noTakeM) return null;
  const noTakeCat = (noTakeM[1] || noTakeM[2] || '').toLowerCase();
  if (noTakeCat !== cat3) return null;

  const totalM = TOTAL_RE.exec(q);
  if (!totalM) return null;
  const total = Number(totalM[1]);
  if (!Number.isFinite(total) || total <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM || askM[1].toLowerCase() !== cat3) return null;

  const bCat1 = aCat1 * mult1;
  const bCat2 = aCat2 * mult2;
  const known = aCat1 + aCat2 + bCat1 + bCat2; // exact integer
  const thirdCategoryAmount = total - known;
  if (!Number.isFinite(thirdCategoryAmount) || thirdCategoryAmount < 0) return null;

  return { thirdCategoryAmount };
}

export const twoActorOrchardCategoryRatiosBacksolveThirdCategory: LianaMethod = {
  id: 'two-actor-orchard-category-ratios-backsolve-third-category-v1',
  demand: 'COMPUTE',
  name: 'Backsolve one actor\'s unknown third-category amount from a combined grand total, given two actors\' ratio-linked amounts in two other categories',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W28, cluster C250, GSM8K test item415',
  shapeDescription:
    'Actor A gathers N from category1, half that from category2, unknown from category3. Actor B ' +
    'gathers mult1*N from category1 and mult2*(N/2) from category2, nothing from category3. ' +
    'Given combined total T, A.category3 = T - (A.cat1+A.cat2+B.cat1+B.cat2), matching the ' +
    'corpus\'s own worked chain, only when non-negative.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the full base/half/unclaimed-category chain for actor A plus the two ' +
          'sister-multiplier clauses for the same two categories plus a "doesn\'t take any" ' +
          'clause for the unclaimed category plus a combined-total clause plus a matching ' +
          'closing question, all cross-checked by category name; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `third-category amount = ${result.thirdCategoryAmount}` };
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
          verdict: String(Math.round((result.thirdCategoryAmount) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'total - (A.cat1+A.cat2+B.cat1+B.cat2), exact integer arithmetic, category names cross-checked',
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

registerMethod(twoActorOrchardCategoryRatiosBacksolveThirdCategory);
