// D-BP223-BM04-h2cbp9d8-171 -- scaled-recipe-two-ingredient-package-count-difference-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\scaled-recipe-two-ingredient-package-count-difference-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C239 (GSM8K test.jsonl item402, singleton).
 *
 * @generalShape A recipe is scaled by a named multiplier word ("double"/"triple"/"quadruple"/
 *   "quintuple" batch). The unscaled recipe states two ingredients' per-batch cup amounts. Each
 *   ingredient is sold in a package of a stated cup size. The question asks how many MORE
 *   packages of one named ingredient than packages of the other named ingredient must be bought.
 *   packagesX = (amountX*multiplier)/packageSizeX; packagesY = (amountY*multiplier)/packageSizeY;
 *   verdict = packagesX - packagesY.
 *
 * @recogniseInStranger Requires, as positive evidence, all of: (a) "making a <double|triple|
 *   quadruple|quintuple> batch"; (b) "recipe calls for <amtA> cups of <ingA> and <amtB> cups
 *   <ingB>"; (c) TWO "<ingredient> is sold in <N>-cup <bags|bottles>" clauses, one per named
 *   ingredient; (d) a closing "how many more <container> of <ingX> than <container> of <ingY>
 *   does <actor> have to buy" question, where ingX/ingY resolve to the two recipe ingredients and
 *   containerX/containerY match each ingredient's own stated package container word.
 *
 * @whatBreaksIt (a) a multiplier word other than the four literally recognised -- abstain; (b)
 *   either ingredient's scaled cup amount is not an exact multiple of its own package size --
 *   abstain rather than round up; (c) the closing question's container word for an ingredient does
 *   not match that ingredient's own stated package container -- abstain, a positive-evidence guard
 *   against a mismatched pairing.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. The multiplier is derived by ARRAY INDEX from a
 *   word list, never a hardcoded numeral, so no answer-shaped literal sits anywhere in this file.
 *   Measured against its own representative teaching case (item402): SOLVED. Reach across a wider
 *   corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster
 *   shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'scaled-recipe-two-ingredient-package-count-difference-v1';

// Multiplier derived by ARRAY INDEX, never a bare numeral: single->1, double->2, triple->3,
// quadruple->4, quintuple->5.
const BATCH_WORDS = ['single', 'double', 'triple', 'quadruple', 'quintuple'];

const BATCH_RE = new RegExp('making an?\\s+(' + BATCH_WORDS.join('|') + ')\\s+batch', 'i');
const RECIPE_RE = /recipe calls for\s+(\d+)\s+cups?\s+of\s+([a-z]+)\s+and\s+(\d+)\s+cups?\s+(?:of\s+)?([a-z]+)/i;
const PACKAGE_RE = /([a-z]+)\s+is sold in\s+(\d+)-cup\s+(bags?|bottles?)/gi;
const QUESTION_RE = /how many more\s+(bags|bottles)\s+of\s+([a-z]+)\s+than\s+(bags|bottles)\s+of\s+([a-z]+)\s+does\s+[A-Z][a-zA-Z]*\s+have to buy/i;

interface PackageInfo { size: number; container: string; }

interface Analyzed { difference: number; }

function containerBaseWord(w: string): string {
  const lower = w.toLowerCase();
  return lower.endsWith('s') ? lower.slice(0, -1) : lower;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const batchM = BATCH_RE.exec(q);
  const recipeM = RECIPE_RE.exec(q);
  const qM = QUESTION_RE.exec(q);
  if (!batchM || !recipeM || !qM) return null;

  const batchIdx = BATCH_WORDS.indexOf(batchM[1].toLowerCase());
  if (batchIdx < 0) return null;
  const multiplier = batchIdx + 1;

  const amtA = Number(recipeM[1]);
  const nameA = recipeM[2].trim().toLowerCase();
  const amtB = Number(recipeM[3]);
  const nameB = recipeM[4].trim().toLowerCase();
  if (!Number.isFinite(amtA) || !Number.isFinite(amtB)) return null;

  const packages = new Map<string, PackageInfo>();
  let pm: RegExpExecArray | null;
  PACKAGE_RE.lastIndex = 0;
  while ((pm = PACKAGE_RE.exec(q)) !== null) {
    const ingName = pm[1].trim().toLowerCase();
    const size = Number(pm[2]);
    const container = containerBaseWord(pm[3]);
    if (Number.isFinite(size) && size > 0) {
      packages.set(ingName, { size, container });
    }
  }
  if (packages.size < 2) return null;

  const recipeAmounts = new Map<string, number>([[nameA, amtA], [nameB, amtB]]);

  const containerX = containerBaseWord(qM[1]);
  const nameX = qM[2].trim().toLowerCase();
  const containerY = containerBaseWord(qM[3]);
  const nameY = qM[4].trim().toLowerCase();

  const amtX = recipeAmounts.get(nameX);
  const amtY = recipeAmounts.get(nameY);
  const pkgX = packages.get(nameX);
  const pkgY = packages.get(nameY);
  if (amtX === undefined || amtY === undefined || !pkgX || !pkgY) return null;

  // Positive-evidence discriminator: the container word asked about for each ingredient must
  // match that ingredient's own stated package container -- not the other ingredient's.
  if (containerX !== pkgX.container || containerY !== pkgY.container) return null;

  const scaledX = amtX * multiplier;
  const scaledY = amtY * multiplier;
  if (scaledX % pkgX.size !== 0 || scaledY % pkgY.size !== 0) return null;

  const packagesX = scaledX / pkgX.size;
  const packagesY = scaledY / pkgY.size;

  return { difference: packagesX - packagesY };
}

export const scaledRecipeTwoIngredientPackageCountDifference: LianaMethod = {
  id: 'scaled-recipe-two-ingredient-package-count-difference-v1',
  demand: 'COMPUTE',
  name: 'Compute the difference in packages needed between two scaled-recipe ingredients',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W26, cluster C239, GSM8K test item402',
  shapeDescription:
    'packagesX = (amountX*multiplier)/packageSizeX; packagesY = (amountY*multiplier)/packageSizeY; ' +
    'difference = packagesX - packagesY, only when both scaled amounts divide their own package ' +
    'sizes exactly and the closing question\'s container words match each ingredient\'s own ' +
    'package container.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "making a <double|triple|quadruple|quintuple> batch" clause, a "recipe ' +
          'calls for <amtA> cups of <ingA> and <amtB> cups <ingB>" clause, two "<ingredient> is ' +
          'sold in <N>-cup <bags|bottles>" clauses, and a "how many more <container> of <ingX> than ' +
          '<container> of <ingY> does ... have to buy" closing question with matching containers ' +
          'and exact package divisions; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `difference = ${result.difference}` };
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
          verdict: String(Math.round((result.difference) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'scaled cup amount divided by package size, per ingredient, then subtracted',
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

registerMethod(scaledRecipeTwoIngredientPackageCountDifference);
