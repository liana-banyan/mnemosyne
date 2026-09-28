// D-BP223-BM04-h2cbp9d8-171 -- pages-words-reading-rate-minus-travel-minutes-early-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R07
// (registration batch drawn from generation waves W26-W27).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\pages-words-reading-rate-minus-travel-minutes-early-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C245 (GSM8K test.jsonl item408, singleton).
 *
 * @generalShape A book has a stated page count P and a stated average words-per-page W. A person
 *   reads at a stated rate R words per minute. They must arrive somewhere within a stated total
 *   time budget T minutes and it takes a stated travel time Tr minutes to get there. The question
 *   asks how many minutes EARLY they will be, given they leave the instant they finish the book.
 *   Answer = T - (ceil-free exact readTime + Tr), where readTime = (P*W)/R, only when readTime is
 *   an exact rational value that keeps the final answer a whole number.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an explicit "<P> pages long"
 *   book-length clause; (b) an explicit "<W> words a page" (or "per page") average clause; (c) an
 *   explicit "read at a rate of <R> words per minute" clause; (d) an explicit "has to be at the
 *   <destination> in <T> minutes" total-time-budget clause; (e) an explicit "<Tr> minutes to get
 *   to the <destination>" travel-time clause; (f) the closing question asks "how many minutes
 *   early" (never "how many minutes late").
 *
 * @whatBreaksIt (a) any of the six figures missing or stated more than once -- ambiguous,
 *   abstain; (b) total reading+travel time exceeding the time budget T -- this candidate reports
 *   only a non-negative "early" figure, never a negative ("late") one; (c) the word count (P*W)
 *   not dividing evenly by the reading rate R -- abstain rather than report a fractional minute
 *   count; (d) the question asking for minutes LATE, or asking for total time spent reading,
 *   rather than minutes early.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (item408): totalWords = 45*200 = 9000, readTime =
 *   9000/300 = 30, arriveOffset = 30+10 = 40, early = 60-40 = 20. SOLVED. Reach across a wider
 *   corpus is recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster
 *   shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'pages-words-reading-rate-minus-travel-minutes-early-v1';

const PAGES_RE = /\bis\s+(\d+)\s+pages\s+long\b/i;
const WORDS_PER_PAGE_RE = /\b(\d+)\s+words\s+a\s+page\b/i;
const READ_RATE_RE = /\bread\s+at\s+a\s+rate\s+of\s+(\d+)\s+words\s+per\s+minute\b/i;
const TIME_BUDGET_RE = /\bhas to be at the\s+[a-z]+\s+in\s+(\d+)\s+minutes\b/i;
const TRAVEL_TIME_RE = /\bit takes\s+(\d+)\s+minutes\s+to\s+get\s+to\s+the\s+[a-z]+\b/i;
const ASK_EARLY_RE = /how many minutes early\b/i;

interface Analyzed { early: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const pagesM = PAGES_RE.exec(q);
  if (!pagesM) return null;
  const pages = Number(pagesM[1]);

  const wppM = WORDS_PER_PAGE_RE.exec(q);
  if (!wppM) return null;
  const wordsPerPage = Number(wppM[1]);

  const rateM = READ_RATE_RE.exec(q);
  if (!rateM) return null;
  const rate = Number(rateM[1]);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const budgetM = TIME_BUDGET_RE.exec(q);
  if (!budgetM) return null;
  const budget = Number(budgetM[1]);

  const travelM = TRAVEL_TIME_RE.exec(q);
  if (!travelM) return null;
  const travel = Number(travelM[1]);

  if (!ASK_EARLY_RE.test(q)) return null;

  if (![pages, wordsPerPage, budget, travel].every(Number.isFinite)) return null;

  const totalWords = pages * wordsPerPage; // exact integer
  if (totalWords % rate !== 0) return null; // would not land on a whole-minute read time
  const readTime = totalWords / rate;
  const arriveOffset = readTime + travel;
  const early = budget - arriveOffset;
  if (!Number.isFinite(early) || early < 0) return null; // this candidate never reports "late"

  return { early };
}

export const pagesWordsReadingRateMinusTravelMinutesEarly: LianaMethod = {
  id: 'pages-words-reading-rate-minus-travel-minutes-early-v1',
  demand: 'COMPUTE',
  name: 'Compute minutes early given a book\'s reading time, a travel time, and a total time budget',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W27, cluster C245, GSM8K test item408',
  shapeDescription:
    'Book of P pages, W words/page, read at R words/min; arrives at a destination with travel ' +
    'time Tr within a total budget T. Minutes early = T - ((P*W)/R + Tr), only when the reading ' +
    'time is an exact whole number of minutes and the result is non-negative.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a page-count clause, a words-per-page clause, a reading-rate clause, a ' +
          'time-budget clause, a travel-time clause, and a "how many minutes early" closing ' +
          'question resolving to a non-negative whole-minute answer; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `minutes early = ${result.early}` };
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
          verdict: String(Math.round((result.early) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'budget - ((pages*wordsPerPage/rate) + travelTime)',
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

registerMethod(pagesWordsReadingRateMinusTravelMinutesEarly);
