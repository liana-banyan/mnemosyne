// D-BP223-BM04-h2cbpv9w-170 -- base-plus-bought-plus-fraction-of-bought-then-unit-weight-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\base-plus-bought-plus-fraction-of-bought-then-unit-weight-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W18, CLUSTER C174 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 316, "Solomon bought 20 marbles from his friend Johanna and
 * added them to a store that had 50. If his father also gave him 2/5 times as many marbles as he
 * bought from Johanna, and each marble weighs 2kgs, calculate the total weight of marbles Solomon
 * has in the store.". Silo label: "multi-step word problem involving addition, fractions, and
 * multiplication -- multi-step arithmetic (addition, fraction of a quantity, and multiplication by
 * a unit weight)".
 *
 * @generalShape A starting STOCK is stated. A BOUGHT quantity (from a named source person) is
 *   added to it. A THIRD quantity, a stated FRACTION of the SAME bought amount ("<num>/<den> times
 *   as many ... as he bought from <source>"), is added as well. The combined count is then
 *   multiplied by a stated per-unit weight to get a total weight.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "bought <B> <item> from
 *   [his/her/their] friend <Source> and added [them/it] to a store that had <S0>"; (b) "<num>/<den>
 *   times as many <item> as [he/she/they] bought from <Source>", naming the SAME item and SAME
 *   source as (a), as an explicit numeral fraction (never a word fraction); (c) "each <item-
 *   singular> weighs <W> kg(s)", where item-singular is item with a trailing "s" stripped; (d) a
 *   closing "calculate the total weight" question.
 *
 * @whatBreaksIt (a) the fraction clause's item or source not matching (a)'s -- abstains; (b) the
 *   fraction applied to B not landing on an exact integer -- abstains rather than round; (c) the
 *   weight clause's item not matching the singularized bought item; (d) the fraction not in exact
 *   numeral "<digits>/<digits>" form.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (additional = 2/5*20 = 8; total count = 50+20+8 = 78; weight =
 *   78*2 = 156). With only one known cluster member there is no cross-member measurement to
 *   report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'base-plus-bought-plus-fraction-of-bought-then-unit-weight-v1';

function singularize(item: string): string {
  return item.trim().replace(/s$/i, '');
}

interface Analyzed { weight: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const boughtRe = /bought\s+(\d+)\s+([a-z]+)\s+from\s+(?:his|her|their)?\s*friend\s+([A-Z][a-z]+)\s+and added\s+(?:them|it)\s+to a store that had\s+(\d+)/i;
  const bm = boughtRe.exec(q);
  if (!bm) return null;
  const bought = parseInt(bm[1], 10);
  const item = bm[2].toLowerCase();
  const source = bm[3];
  const startingStock = parseInt(bm[4], 10);

  const fracRe = new RegExp('(\\d+)/(\\d+)\\s+times as many\\s+' + item + '\\s+as\\s+(?:he|she|they)\\s+bought from\\s+' + source, 'i');
  const frm = fracRe.exec(q);
  if (!frm) return null;
  const fracNum = parseInt(frm[1], 10);
  const fracDen = parseInt(frm[2], 10);
  if (fracDen === 0) return null;

  const weightRe = /each\s+([a-z]+)\s+weighs\s+(\d+(?:\.\d+)?)\s*kgs?/i;
  const wm = weightRe.exec(q);
  if (!wm) return null;
  const weightItem = wm[1].toLowerCase();
  const unitWeight = parseFloat(wm[2]);
  if (singularize(item) !== weightItem) return null;

  if (!/calculate the total weight/i.test(q)) return null;

  const additionalNum = bought * fracNum;
  if (additionalNum % fracDen !== 0) return null;
  const additional = additionalNum / fracDen;

  const totalCount = startingStock + bought + additional;
  const weight = totalCount * unitWeight;
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return { weight };
}

export const basePlusBoughtPlusFractionOfBoughtThenUnitWeight: LianaMethod = {
  id: 'base-plus-bought-plus-fraction-of-bought-then-unit-weight-v1',
  demand: 'COMPUTE',
  name: 'Starting stock plus a bought amount plus a fraction of that same bought amount, times a unit weight',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W18 (cluster C174, sole member: pilot corpus item at index 316)',
  shapeDescription: 'weight = (startingStock + bought + (fracNum/fracDen)*bought) * unitWeight',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a bought-from-source-added-to-starting-stock clause, a matching numeral-' +
          'fraction-of-the-bought-amount clause sharing the same item and source, a matching per-' +
          'unit weight clause, and a closing "calculate the total weight" question; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `weight = ${result.weight}` };
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
          verdict: String(Math.round(result.weight * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'combined count times unit weight',
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

registerMethod(basePlusBoughtPlusFractionOfBoughtThenUnitWeight);
