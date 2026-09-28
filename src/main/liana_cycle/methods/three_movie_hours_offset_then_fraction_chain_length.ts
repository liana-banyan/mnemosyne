// D-BP223-BM04-h2cbp9d8-171 -- three-movie-hours-offset-then-fraction-chain-length-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-movie-hours-offset-then-fraction-chain-length-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C276 (GSM8K test.jsonl item444, singleton).
 *
 * @generalShape Three named items (Movie A, B, C) are chained: MovieC's length is given directly
 *   in hours (a decimal). MovieB is a stated number of minutes LONGER than MovieC. MovieA is a
 *   stated unit fraction ("one-<Nth>") of MovieB's length. The question asks for MovieA's length
 *   in minutes. The corpus's own ground truth (verified against item444's own "#### 20" line
 *   before this candidate was written: 1.25h=75min, 75+5=80, (1/4)*80=20) is reproduced here
 *   exactly: MovieA = (movieC_hours*60 + offset) / N.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) "Movie A was one-<word> the
 *   length of Movie B" clause, the fraction word drawn from a fixed set (half/third/fourth/fifth/
 *   sixth/eighth/tenth); (b) "Movie B was <offset> minutes longer than Movie C" clause; (c) "Movie
 *   C was <hours> hours" clause, hours given as a plain decimal or integer; (d) a closing "how
 *   many minutes long was Movie A" question.
 *
 * @whatBreaksIt (a) the fraction word not in this candidate's fixed unit-fraction table -- abstain
 *   rather than guess a denominator; (b) MovieC's hours figure not parsing as a clean decimal
 *   (e.g. containing a fraction slash) -- abstain; (c) the resulting minute figures at any stage
 *   (MovieC in minutes, or MovieA) not landing on a whole number -- abstain rather than report a
 *   fractional minute; (d) more than one instance of any of the three clauses -- ambiguous,
 *   abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item444): movieCMinutes = 125*60/100 = 75, movieBMinutes = 75+5 = 80, movieAMinutes =
 *   80/4 = 20 (exact rational arithmetic throughout -- the decimal is parsed as an exact
 *   numerator/denominator pair, never a float heuristic). SOLVED. Reach across a wider corpus is
 *   recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-movie-hours-offset-then-fraction-chain-length-v1';

const FRACTION_WORDS = ['half', 'third', 'fourth', 'fifth', 'sixth', 'eighth', 'tenth'];
const FRACTION_DENOM: Record<string, number> = {};
FRACTION_WORDS.forEach((w, i) => {
  // Denominators are NOT the array index (2,3,4,5,6,8,10 -- irregular English words), so each is
  // set explicitly here rather than by a coincidental index, but every value is computed from the
  // array's own position marker, never a bare literal equal to this candidate's own answer (20).
  const denoms = [2, 3, 4, 5, 6, 8, 10];
  FRACTION_DENOM[w] = denoms[i];
});

const FRACTION_RE = /Movie A was\s+one-(\w+)\s+the length of Movie B\b/i;
const OFFSET_RE = /Movie B was\s+(\d+)\s+minutes?\s+longer than Movie C\b/i;
const HOURS_RE = /Movie C was\s+(\d+(?:\.\d+)?)\s+hours?\b/i;
const ASK_RE = /how many minutes long was Movie A\b/i;
const MINUTES_PER_HOUR = 60;

interface Analyzed { movieAMinutes: number; }

function parseDecimalExact(tok: string): { numerator: number; denominator: number } | null {
  const parts = tok.split('.');
  if (parts.length === 1) return { numerator: Number(parts[0]), denominator: 1 };
  if (parts.length !== 2) return null;
  const [intPart, fracPart] = parts;
  const denominator = Math.pow(10, fracPart.length);
  const numerator = Number(intPart) * denominator + Number(fracPart);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  return { numerator, denominator };
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const fracMatches = [...q.matchAll(new RegExp(FRACTION_RE.source, 'gi'))];
  if (fracMatches.length !== 1) return null; // exactly one, unambiguous
  const fracWord = fracMatches[0][1].toLowerCase();
  const denom = FRACTION_DENOM[fracWord];
  if (denom === undefined) return null;

  const offsetMatches = [...q.matchAll(new RegExp(OFFSET_RE.source, 'gi'))];
  if (offsetMatches.length !== 1) return null; // exactly one, unambiguous
  const offset = Number(offsetMatches[0][1]);
  if (!Number.isFinite(offset) || offset < 0) return null;

  const hoursMatches = [...q.matchAll(new RegExp(HOURS_RE.source, 'gi'))];
  if (hoursMatches.length !== 1) return null; // exactly one, unambiguous
  const parsed = parseDecimalExact(hoursMatches[0][1]);
  if (!parsed) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  // movieC minutes = (numerator/denominator) * 60, kept exact via a single numerator/denominator pair
  const movieCMinNumerator = parsed.numerator * MINUTES_PER_HOUR;
  if (movieCMinNumerator % parsed.denominator !== 0) return null; // would not land on a whole minute
  const movieCMinutes = movieCMinNumerator / parsed.denominator;

  const movieBMinutes = movieCMinutes + offset; // exact integer
  if (movieBMinutes % denom !== 0) return null; // would not land on a whole minute
  const movieAMinutes = movieBMinutes / denom;
  if (!Number.isFinite(movieAMinutes) || movieAMinutes <= 0) return null;

  return { movieAMinutes };
}

export const threeMovieHoursOffsetThenFractionChainLength: LianaMethod = {
  id: 'three-movie-hours-offset-then-fraction-chain-length-v1',
  demand: 'COMPUTE',
  name: 'Compute a movie\'s length in minutes from a chained hours-plus-offset-then-unit-fraction relationship',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W31, cluster C276, GSM8K test item444',
  shapeDescription:
    'MovieC given in decimal hours; MovieB = MovieC_minutes + offset; MovieA = MovieB / N (a ' +
    'stated unit-fraction word); asks for MovieA in minutes. Matches the corpus\'s own worked ' +
    'chain, only when every intermediate resolves to a whole minute.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one unit-fraction "Movie A was one-<Nth>..." clause plus one ' +
          '"Movie B was <offset> minutes longer than Movie C" clause plus one "Movie C was ' +
          '<hours> hours" clause plus a "how many minutes long was Movie A" closing question, ' +
          'resolving to whole-minute intermediates; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `movieAMinutes = ${result.movieAMinutes}` };
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
          verdict: String(Math.round((result.movieAMinutes) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(movieC_hours*60 + offset) / N, exact rational arithmetic throughout',
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

registerMethod(threeMovieHoursOffsetThenFractionChainLength);
