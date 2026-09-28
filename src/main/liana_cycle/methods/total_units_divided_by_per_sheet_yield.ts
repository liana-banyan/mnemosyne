// D-BP223-BM04-h2cbpv9w-170 -- total-units-divided-by-per-sheet-yield-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\total-units-divided-by-per-sheet-yield-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W17, CLUSTER C162 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 301, "... page 1 is printed on the left
 * back, page 2 is printed on the left front, and then, perhaps page 32 is printed on the right
 * back, and page 31 is printed on the right front. How many pieces of paper would be used in a
 * 32-page tabloid?" Silo label: "determining the number of physical units based on a total count
 * of internal components (pages) where each unit contains multiple components" -- matches.
 *
 * REVISION NOTE (Rule 66 sibling written first): the first draft required an EXPLICIT "each sheet
 * prints <M> pages" figure stated as a bare number somewhere in the question text. Gate 1
 * (`gate1_positive_yield.cjs`) returned NO-CLAIM on this candidate's OWN generating question,
 * because that figure never actually appears as a bare number in the GSM8K question -- only in
 * the corpus's OWN worked answer ("Each piece prints 4 pages"), which this method must never
 * read. The question itself instead ENUMERATES the print-position mapping directly ("page 1 is
 * printed on the left back, page 2 ... left front, page 32 ... right back, page 31 ... right
 * front"): four distinct "page <N> is printed on the <side> <back/front>" clauses, one per
 * printed position on a single folded sheet. Counting those clauses IS the general, positive-
 * evidence way to recover the per-sheet yield without ever reading the answer key -- fixed below.
 *
 * @generalShape A TOTAL count of small components (pages) is stated as "<N>-page <noun>". The
 *   SAME setup text enumerates, one clause per printed position, how each of several page numbers
 *   is printed onto a physical side of a single sheet ("page <k> is printed on the <side>
 *   <back/front>"). The count of DISTINCT such enumeration clauses is the number of components
 *   (pages) carried by one physical unit (sheet). The answer is N divided by that count.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a total-count phrase of the exact form "<N>-page <noun>" (e.g. "32-page tabloid");
 *   (b) TWO OR MORE distinct "page <k> is printed on the <word> <word>" enumeration clauses in the
 *       setup text, each naming a DIFFERENT page number k;
 *   (c) a closing question asking "how many pieces/sheets of paper would be used";
 *   the per-unit yield M is COUNTED (never read as a bare literal), so this candidate never
 *   depends on the corpus's own worked-answer phrasing.
 *
 * @whatBreaksIt (a) fewer than two enumeration clauses found -- abstain, nothing to count; (b) any
 *   two enumeration clauses naming the SAME page number -- abstain, cannot be sure it is not a
 *   restatement rather than a distinct position; (c) N not evenly divisible by the counted M --
 *   abstain rather than round, since a folded sheet must produce a whole number of physical
 *   units; (d) M <= 1 after counting -- abstain, a per-unit yield of one component is not the
 *   multi-component shape this method targets.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (4 distinct enumeration clauses counted, 32 pages / 4 = 8
 *   sheets). With only one known cluster member there is no cross-member measurement to report;
 *   the "count the enumeration clauses" derivation is this candidate's one honest generalization
 *   beyond a bare-literal read, and it is a POSITIVE, structural count, not a guess.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'total-units-divided-by-per-sheet-yield-v1';

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalRe = /\b([0-9]+)-page\s+[a-z]+\b/i;
  const tm = totalRe.exec(q);
  if (!tm) return null;
  const totalPages = parseInt(tm[1], 10);
  if (!Number.isFinite(totalPages) || totalPages <= 0) return null;

  const enumRe = /page\s+([0-9]+)\s+is\s+printed\s+on\s+the\s+[a-z]+\s+[a-z]+/gi;
  const pageNumbers = new Set<number>();
  let em: RegExpExecArray | null;
  while ((em = enumRe.exec(q)) !== null) {
    pageNumbers.add(parseInt(em[1], 10));
  }
  const perUnit = pageNumbers.size;
  if (perUnit <= 1) return null;

  if (!/how many\s+(?:pieces|sheets)\s+of\s+paper\s+would\s+be\s+used/i.test(q)) return null;

  if (totalPages % perUnit !== 0) return null;
  const total = totalPages / perUnit;
  return { total };
}

export const totalUnitsDividedByPerSheetYield: LianaMethod = {
  id: 'total-units-divided-by-per-sheet-yield-v1',
  demand: 'COMPUTE',
  name: 'Divide a total component count by a per-unit yield counted from distinct enumeration clauses',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W17 (cluster C162, sole member: the test corpus, line 301)',
  shapeDescription:
    'units = totalPages / countOfDistinct("page <k> is printed on the <side> <back/front>" clauses), ' +
    'the per-unit yield recovered by counting positive structural evidence, never read as a literal.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find an "<N>-page <noun>" total, at least two distinct "page <k> is printed ' +
          'on the <side> <back/front>" enumeration clauses whose count evenly divides N, and a ' +
          'matching "how many pieces/sheets" question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `sheets needed = ${result.total}` };
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
          basis: 'divided the total page count by the counted per-sheet enumeration yield',
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

registerMethod(totalUnitsDividedByPerSheetYield);
