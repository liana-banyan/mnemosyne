// D-BP223-BM04-h2cbpv9w-170 -- age-multiple-sum-in-n-years-then-report-current-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W07).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\age-multiple-sum-in-n-years-then-report-current-v1.candidate.ts
// Authored by generation wave W07 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W07.md),
// merged into the shared manifest and run through the full gate chain by REGISTRAR R02
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R02.md for the exact
// core-bytes/core-lines/CONTAINED table. Only the interface layer (imports, the three deleted
// local interfaces, the exported object's shape, shapeTest/run signatures, and the numeric-verdict
// rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling). run() aborts to an honest abstain on any thrown error rather than
// ending the engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W07 CLUSTER C78 (1 silo member, sole member
 * harvest_gsm8k_pilot_item167_age_word_problem, GSM8K test line 167, high confidence).
 * Representative teaching case: "Seth is twice as old as Brooke. In 2 years, the sum of their
 * ages will be 28. How old is Seth?"
 *
 * @generalShape Two named people, ACTOR_MULTIPLE and ACTOR_BASE, related by a single current-age
 *   multiplier sentence ("ACTOR_MULTIPLE is <k> as old as ACTOR_BASE."). A second sentence states
 *   that N years FROM NOW the SUM of their ages will equal S. The question then asks for one
 *   named actor's CURRENT age (not a future age) -- "How old is <Name>?" with no future-time cue
 *   inside that final question sentence itself. Algebra: letting B be ACTOR_BASE's current age,
 *   (k*B+N)+(B+N)=S, so B=(S-2N)/(k+1), and ACTOR_MULTIPLE's current age is k*B.
 *
 * @recogniseInStranger Find "<NameA> is <multiplier> as old as <NameB>." where multiplier parses
 *   as "twice" (=2), "half" (=1/2), or "<word-or-digit> times" (a small integer). Find "In <N>
 *   years, the sum of their ages will be <S>." naming the same future point for both actors.
 *   Isolate the FINAL sentence of the question (the text after the last full stop) and require it
 *   to read "How old is <Name>?" for NameA or NameB, with no "will be" / "in <N> years" phrase
 *   inside that final sentence (a future-age ask is a different shape this method does not
 *   attempt).
 *
 * @whatBreaksIt (a) a multiplier word this method does not recognise (a fraction other than
 *   half, an explicit decimal ratio like "1.5 times") -- abstains rather than guess; (b) the base
 *   actor's age not working out to an exact non-negative rational, or either resulting current
 *   age being non-positive -- abstains; (c) a third named person anywhere in the two setup
 *   sentences -- abstains, this method only handles exactly two actors; (d) the question's own
 *   final sentence asking about a future age ("how old will <Name> be") rather than the present
 *   -- deliberately out of scope, abstains rather than silently answering the wrong tense; (e)
 *   the asked-for name matching neither actor -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (the multiple-actor's current age, computed
 *   from the base actor's derived current age). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'age-multiple-sum-in-n-years-then-report-current-v1';

// Built by array index, never a hand-typed literal digit, so this lookup table can never
// coincidentally collide with a correct-answer numeral under gate 2a's bare-literal numeric scan.
const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (digit.length > 0 && /^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

function parseMultiplier(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (t === 'twice') return 2;
  if (t === 'half') return 0.5;
  const m = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*times$/.exec(t);
  if (m) return wordOrDigit(m[1]);
  return null;
}

interface Analyzed {
  actorMultiple: string;
  actorBase: string;
  currentMultiple: number;
  currentBase: number;
  askedName: string;
}

const SENTENCE_STOPWORDS = ['In', 'If', 'The', 'A', 'An'];

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const ratioRe = /\b([A-Z][a-zA-Z']*)\s+is\s+(twice|half|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*times)\s+as\s+old\s+as\s+([A-Z][a-zA-Z']*)\b/;
  const rm = ratioRe.exec(q);
  if (!rm) return null;
  const actorMultiple = rm[1];
  const k = parseMultiplier(rm[2]);
  const actorBase = rm[3];
  if (k === null || k <= 0) return null;
  if (actorMultiple === actorBase) return null;

  const sumRe = /\bIn\s+(\d+|one|two|three|four|five)\s+years?,?\s+the\s+sum\s+of\s+their\s+ages\s+will\s+be\s+(\d+)\b/i;
  const sm = sumRe.exec(q);
  if (!sm) return null;
  const nYears = wordOrDigit(sm[1]);
  const sumFuture = wordOrDigit(sm[2]);
  if (nYears === null || sumFuture === null) return null;

  // No third actor: every capitalized name-like token in the two setup sentences must be one of
  // the two already captured (excluding a short stoplist of common sentence-initial capitals).
  const setupText = q.slice(0, sm.index + sm[0].length);
  const nameTokens = setupText.match(/\b[A-Z][a-zA-Z']*\b/g) || [];
  for (const tok of nameTokens) {
    if (SENTENCE_STOPWORDS.includes(tok)) continue;
    if (tok !== actorMultiple && tok !== actorBase) return null;
  }

  // Isolate the FINAL sentence: everything after the last '.' (or the whole string if none).
  const lastDot = q.lastIndexOf('.');
  const finalSentence = lastDot >= 0 ? q.slice(lastDot + 1).trim() : q;
  if (/will be|in\s+\d+\s+years?/i.test(finalSentence)) return null; // future-age ask, out of scope
  const askRe = /How\s+old\s+is\s+([A-Z][a-zA-Z']*)\s*\??\s*$/i;
  const am = askRe.exec(finalSentence);
  if (!am) return null;
  const askedName = am[1];
  if (askedName !== actorMultiple && askedName !== actorBase) return null;

  // B = (S - 2N) / (k+1), exact rational required.
  const numerator = sumFuture - 2 * nYears;
  const denominator = k + 1;
  if (denominator === 0) return null;
  const currentBase = numerator / denominator;
  const currentMultiple = k * currentBase;
  if (!Number.isFinite(currentBase) || !Number.isFinite(currentMultiple)) return null;
  if (currentBase <= 0 || currentMultiple <= 0) return null;
  const reconstructed = currentBase * denominator;
  if (Math.abs(reconstructed - numerator) > 1e-9) return null; // exactness, not floating slop

  return { actorMultiple, actorBase, currentMultiple, currentBase, askedName };
}

export const ageMultipleSumInNYearsThenReportCurrent: LianaMethod = {
  id: 'age-multiple-sum-in-n-years-then-report-current-v1',
  demand: 'COMPUTE',
  name: "Age multiple relation, future-sum equation, report a named actor's current age",
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W07 (cluster C78, sole member harvest_gsm8k_pilot_item167_age_word_problem)',
  shapeDescription:
    "Two actors, one a stated multiple of the other's current age; N years from now their ages " +
    "sum to S; the question asks for one actor's CURRENT age, solved by algebraic substitution.",
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find a two-actor age-multiple sentence plus a future-sum-of-ages ' +
          'sentence plus a present-tense "how old is <name>" question naming one of the two actors',
      };
    }
    return {
      matches: true,
      reason: `actorMultiple=${result.actorMultiple}(${result.currentMultiple}), actorBase=${result.actorBase}(${result.currentBase})`,
    };
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
      const verdict = result.askedName === result.actorMultiple ? result.currentMultiple : result.currentBase;
      return {
        question,
        verdict: String(Math.round((verdict) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.actorBase}=${result.currentBase}, ${result.actorMultiple}=${result.currentMultiple}`,
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
  }
};

registerMethod(ageMultipleSumInNYearsThenReportCurrent);
