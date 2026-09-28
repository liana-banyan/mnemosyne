// D-BP223-BM04-h2cbpv9w-170 -- literal-percent-of-stated-base-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\literal-percent-of-stated-base-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W15, SHAPE 5 of 8: "percent of a total", mined by frequency over
 * the frozen TUNING RESERVE (gsm8k-train half, 3685 items; never the held-out half). Cue-word
 * membership over the reserve: 476 of 3685 items match a loose keyword probe (a literal "%" or
 * the word "percent"). This candidate is deliberately the narrowest possible cut of that huge
 * family -- a single, LITERAL "X% of NUMBER" phrase appearing verbatim in the question -- because
 * the wider percent family (percent taken of an UNSTATED derived total, sequential percent
 * chains, percent increase/decrease of a price) is exactly the shape class prior batches'
 * `percentage-markup-resale-profit-v1` and `seq-multiplier-then-percent-adjust-total-v1` already
 * cover badly (both ZERO-CLAIMS on held-out per HELDOUT_HARNESS_D3 section 3); this candidate does
 * not attempt that wider family and instead claims only the literal one-step case.
 *
 * @generalShape The question contains the literal phrase "<P>% of <N>" (or "<P> percent of
 *   <N>"), where <N> is a plain number appearing at that exact point in the text (not a pronoun,
 *   not "them", not a previously-computed value) -- a fully self-contained one-step percentage.
 *   The closing question asks "how many" or "how much" of that same computed quantity.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) the literal regex "<P>\s*(?:%|
 *   percent)\s*of\s*(?:the\s+)?<N>" where both <P> and <N> are plain digit numbers; (b) exactly
 *   ONE such literal phrase in the whole question (a second one is a multi-step chain this
 *   candidate does not attempt); (c) a closing "how many" or "how much" cue.
 *
 * @whatBreaksIt (a) the number following "of" being a pronoun or noun phrase instead of a digit
 *   ("20% of them", "10% of the students") -- abstain, this candidate reads only a literal digit
 *   at that position, never resolving a pronoun back to an earlier count; (b) two or more literal
 *   percent-of-number phrases -- abstain, ambiguous which (or whether both) the question wants;
 *   (c) the computed result not landing on an exact integer -- abstain rather than round.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (a clean literal "P% of N" template): SOLVED. Reach
 *   across the wider tuning reserve is recorded in wave_manifest.json, not asserted here.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'literal-percent-of-stated-base-v1';


// ROUND 2, on positive evidence from the tuning reserve (Rule 6). Round 1 measured 3 claims, 3
// wrong (0% reach). Three distinct real failures, each fixed by its own guard below: (i) the
// question asked for the COMPLEMENT of the percent phrase's own subject ("20% of the 800 agree
// ... how many DISAGREE") -- fixed by abstaining on any negation/complement cue in the closing
// question; (ii) the base number's own noun (e.g. "20 games") did not match the noun the closing
// question actually asks about (e.g. "how many free throws") -- a different multi-step chain
// entirely -- fixed by requiring the base noun to appear in the closing "how many/much" clause;
// (iii) other fractional categories (half, a third, 1/10th) shared the same sentence, meaning
// the single literal percent phrase was only ONE of several parts making up the real total --
// fixed by abstaining whenever another fraction word or "N/M" fraction appears anywhere.
const LITERAL_PERCENT_OF_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*(?:the\s+)?(\d+(?:,\d{3})*(?:\.\d+)?)\s+([a-z]+)\b/gi;
const CLOSING_HOW_CUE = /\bhow (?:many|much)\b/i;
const NEGATION_CUE = /\b(disagree|don't|do not|does not|doesn't|not|instead|opposite|remaining|other|rest)\b/i;
const OTHER_FRACTION_CUE = /\bhalf\b|\bthird\b|\bquarter\b|\d+\/\d+(?:th|st|nd|rd)?\b/i;

function stem(word: string): string {
  return word.toLowerCase().replace(/(es|s)$/, '');
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (!CLOSING_HOW_CUE.test(q)) return null;
  if (OTHER_FRACTION_CUE.test(q)) return null;

  const matches: { p: number; n: number; noun: string }[] = [];
  LITERAL_PERCENT_OF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LITERAL_PERCENT_OF_RE.exec(q)) !== null) {
    const p = parseFloat(m[1]);
    const n = parseFloat(m[2].replace(/,/g, ''));
    if (Number.isFinite(p) && Number.isFinite(n)) matches.push({ p, n, noun: stem(m[3]) });
  }
  if (matches.length !== 1) return null;

  const { p, n, noun } = matches[0];

  const closingMatch = /how (?:many|much)\s+([a-z]+)/i.exec(q);
  if (!closingMatch) return null;
  const closingNoun = stem(closingMatch[1]);
  if (closingNoun !== noun) return null;
  if (NEGATION_CUE.test(q)) return null;

  const numerator = p * n;
  if (numerator % 100 !== 0) return null;
  const total = numerator / 100;
  if (!Number.isInteger(total)) return null;
  return { total };
}

export const literalPercentOfStatedBase: LianaMethod = {
  id: 'literal-percent-of-stated-base-v1',
  demand: 'COMPUTE',
  name: 'Compute a single literal "P% of N" phrase where N is a plain stated number',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W15 (shape 5 of 8, mined by frequency over the tuning reserve, 476/3685 keyword members, narrowed to the literal one-step case)',
  shapeDescription:
    'The question contains exactly one literal "P% of N" (or "P percent of N") phrase with N a ' +
    'plain digit number, and a "how many/much" closing question -- answer is P*N/100, only when ' +
    'that lands on an exact integer.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one literal "P% of N" phrase with N a plain digit number, ' +
          'resolving to an exact integer, plus a how-many/how-much closing question; abstaining ' +
          'rather than guessing',
      };
    }
    return { matches: true, reason: `P% of N = ${result.total}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.total) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'computed P*N/100 from the single literal percent-of phrase' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(literalPercentOfStatedBase);
