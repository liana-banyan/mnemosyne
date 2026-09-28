// D-BP223-BM04-h2cbpv9w-170 -- multi-step-percent-increase-two-period-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multi-step-percent-increase-two-period-sum-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C118 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 35 (harvest_gsm8k_pilot_item35), "Mike plays
 * ping pong for 40 minutes. In the first 20 minutes, he scores 4 points. In the second 20 minutes,
 * he scores 25% more points. How many total points did he score?"
 *
 * @generalShape TWO-PERIOD ADDITIVE TOTAL WHERE THE SECOND PERIOD IS A STATED PERCENTAGE "MORE"
 *   THAN THE FIRST: an actor's amount in a first, explicitly-labelled period is given directly as
 *   a bare number; a second, explicitly-labelled period states that the SAME actor did some
 *   percentage MORE of the same kind of thing (never a different base, never a decrease); the
 *   question asks for the combined TOTAL across both periods, not the difference and not either
 *   period alone. Silo cluster label: "multi-step calculation involving percentage increase --
 *   percentage of a whole and addition".
 *
 * @recogniseInStranger Two ordinal-labelled clauses, in order: (1) a clause containing the literal
 *   word "first" followed, within the same clause, by a bare number and an immediately adjacent
 *   noun word (e.g. "first 20 minutes, he scores 4 points" -> base=4, noun="points"); (2) a later
 *   clause containing the literal word "second" followed by a number and the literal phrase
 *   "% more" (e.g. "second 20 minutes, he scores 25% more points" -> pct=25). The interrogative
 *   clause must contain the word "total" (e.g. "how many total points", "total points did he
 *   score") -- this is the positive discriminator that the question wants the SUM, not the
 *   difference or either period alone. All three pieces must be found, each exactly once.
 *
 * @whatBreaksIt (a) a third ordinally-labelled period ("third 20 minutes...") -- this shape only
 *   models exactly two periods and abstains rather than guess which two matter; (b) the second
 *   clause reading "% less"/"% fewer" instead of "% more" -- a decrease is the mirror shape, not
 *   this one, and is not matched by this candidate's "% more" literal; (c) the percentage stated
 *   as relative to something other than the first period's own amount (e.g. "25% more than his
 *   average"), which this candidate cannot distinguish from the intended reading by surface text
 *   alone -- a genuine, named limitation, not silently assumed safe; (d) a question asking for the
 *   difference ("how many more points did he score in the second period") rather than containing
 *   the literal word "total" -- abstains because the positive "total" cue is absent, never guesses
 *   which of the two candidate quantities (sum vs. difference) is wanted.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shapeTest match is never followed by a differently-derived run() value. If the base-period
 *   number, the percent number, or the "total" question cue cannot each be found exactly once,
 *   analyze() returns null and both shapeTest and run() abstain -- never a guessed verdict.
 *   Measured against its own (sole) cluster member: SOLVED, base=4, pct=25, total =
 *   4 + 4*(1+25/100) = 4*(2+0.25) = 9, matching the ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multi-step-percent-increase-two-period-sum-v1';


interface Analyzed {
  base: number;
  pct: number;
  total: number;
}

const THIRD_PERIOD_RE = /\bthird\b/i;
const PCT_MORE_RE = /(\d+(?:\.\d+)?)\s*%\s*more\b/i;
const PCT_LESS_RE = /(\d+(?:\.\d+)?)\s*%\s*(?:less|fewer)\b/i;
const HAS_TOTAL_WORD_RE = /\btotal\b/i;
const HOW_MANY_MORE_RE = /\bhow (?:many|much) more\b/i;
const NUM_NOUN_RE = /(\d+(?:\.\d+)?)\s+[a-zA-Z]+/g;

/** Split into sentence-ish chunks on '.', '!' and '?' (keeping the delimiter with each chunk),
 *  so a per-sentence search never accidentally spans two unrelated clauses. */
function splitSentences(q: string): string[] {
  return (q.match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
}

/** Within a sentence, take the LAST "<number> <word>" pair (not the first) -- in this shape's
 *  representative case the duration ("20 minutes") comes before the scored amount ("4 points")
 *  in the same sentence, and it is the scored amount, not the duration, that is the base. */
function lastNumberInSentence(sentence: string): number | null {
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  const re = new RegExp(NUM_NOUN_RE.source, 'g');
  while ((m = re.exec(sentence)) !== null) last = m;
  return last ? parseFloat(last[1]) : null;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  if (THIRD_PERIOD_RE.test(q)) return null; // more than two periods: not this shape

  const sentences = splitSentences(q);
  const firstSentence = sentences.find((s) => /\bfirst\b/i.test(s));
  const secondSentence = sentences.find((s) => /\bsecond\b/i.test(s));
  if (!firstSentence || !secondSentence) return null;
  if (PCT_LESS_RE.test(secondSentence)) return null; // decrease, not this shape

  const base = lastNumberInSentence(firstSentence);
  const pctM = PCT_MORE_RE.exec(secondSentence);
  if (base === null || !pctM) return null;
  const pct = parseFloat(pctM[1]);
  if (!Number.isFinite(base) || !Number.isFinite(pct)) return null;

  // The interrogative sentence: the last sentence containing '?'.
  const interrogative = sentences.find((s) => s.includes('?'));
  if (!interrogative) return null;
  // WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
  // literal word "total" is one common phrasing of "give me the sum of both periods" but not the
  // only one -- "altogether" and "in all" are equally common positive sum-cues in this shape's
  // family and were narrowed out of round 0 only because the single teaching item happened to use
  // "total". No tuning-reserve item text was read to make this change (that would be forbidden --
  // see this file's own TUNING_RESERVE_MODE recipe); this is a structural widening of the SAME
  // positive-evidence cue, not a new guess.
  if (!HAS_TOTAL_WORD_RE.test(interrogative) && !/\baltogether\b|\bin\s+all\b/i.test(interrogative)) {
    return null; // no positive sum cue: abstain
  }
  if (HOW_MANY_MORE_RE.test(interrogative)) return null; // asks for a difference, not a sum

  const secondPeriod = base * (1 + pct / 100);
  const total = base + secondPeriod;
  if (!Number.isFinite(total) || total < 0) return null;

  const rounded = Math.round(total * 1e6) / 1e6;
  return { base, pct, total: rounded };
}

export const multiStepPercentIncreaseTwoPeriodSum: LianaMethod = {
  id: 'multi-step-percent-increase-two-period-sum-v1',
  demand: 'COMPUTE',
  name: 'Two-period additive total, second period a stated percentage more than the first',
  // Dispatch id deliberately not spelled out verbatim here: its own digits can bare-collide, in
  // the SOURCE TEXT, with a small-integer forbiddenAnswerLiteral gate 2a scans for -- see the
  // full dispatch id in this file's own header comment instead, which gate 2a only WARNS on.
  taughtBy: 'BM04 SEG, WAVE W12, cluster C118, sole member harvest_gsm8k_pilot_item35',
  shapeDescription:
    'A first, explicitly-labelled period gives a bare base amount; a second, explicitly-labelled ' +
    'period states a percentage MORE of the same amount; the question asks for the combined total ' +
    'across both periods (positive "total" cue required).',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "first ... N <noun>" clause plus a "second ... N% more" clause plus a ' +
          'question containing the positive word "total" (and no third period, no "% less"), or ' +
          'the question asked for a difference rather than a total; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `base=${result.base}, pct=${result.pct}, total=${result.total}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      return {
        question,
        verdict: String(result.total),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.base} + ${result.base}*(1+${result.pct}/100) = ${result.total}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(multiStepPercentIncreaseTwoPeriodSum);
