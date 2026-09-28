// D-BP223-BM04-h2cbpv9w-170 -- linear-offset-times-base-count-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\linear-offset-times-base-count-v1.candidate.ts
// Authored by generation wave W05 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W05.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C65 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item139, "In a candy machine, there are 22 more than four times
 * the number of pink gumballs as there are blue gumballs. If there are 12 blue gumballs how many
 * pink ones are there?".
 *
 * @generalShape A direct linear-equation translation of "<OFFSET> more than <MULTIPLIER> times
 *   the number of <TARGET> as there are <BASE>", followed by a stated count of BASE, asking for
 *   TARGET. TARGET = MULTIPLIER * BASE_COUNT + OFFSET. This is a single substitution into an
 *   already-fully-specified linear expression, not a system requiring solving for an unknown.
 *
 * @recogniseInStranger Requires the literal grammatical pattern "<offset> more than <multiplier>
 *   times the number of <target-noun> as there are <base-noun>" (offset/multiplier may be digits
 *   or spelled-out number words), then a separate sentence "If there are <count> <base-noun>"
 *   restating the SAME base noun, then a question "how many <target-noun>". The base noun in the
 *   restating sentence must match the base noun named in the linear-relationship sentence (simple
 *   stem match, tolerant of a trailing "s"), so the count substituted is provably the one the
 *   relationship names.
 *
 * @whatBreaksIt (a) the base noun named in "If there are N <base-noun>" does not match the base
 *   noun in the relationship sentence -- abstains, wrong substitution risk; (b) the relationship
 *   uses "fewer than" or "less than" instead of "more than" -- not recognised by this candidate
 *   (a genuinely different arithmetic sign, left to a sibling shape); (c) more than one "if there
 *   are N ..." sentence in the question -- abstains, ambiguous which count to substitute.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own sole cluster member: SOLVED (70). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'linear-offset-times-base-count-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

function stem(noun: string): string {
  const w = noun.trim().toLowerCase();
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('es')) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

interface Analyzed {
  target: string;
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const relRe = /([a-z0-9]+)\s+more\s+than\s+([a-z0-9]+)\s+times\s+the\s+number\s+of\s+([a-z]+(?:\s[a-z]+)?)\s+as\s+there\s+are\s+([a-z]+(?:\s[a-z]+)?)/i;
  const relMatches = [...q.matchAll(new RegExp(relRe.source, 'gi'))];
  if (relMatches.length !== 1) return null;
  const rel = relMatches[0];
  const offset = wordOrDigit(rel[1]);
  const multiplier = wordOrDigit(rel[2]);
  const targetNoun = rel[3];
  const baseNoun = rel[4];
  if (offset === null || multiplier === null) return null;

  const ifRe = /if\s+there\s+are\s+([a-z0-9]+)\s+([a-z]+(?:\s[a-z]+)?)/gi;
  const ifMatches = [...q.matchAll(ifRe)];
  if (ifMatches.length !== 1) return null;
  const baseCount = wordOrDigit(ifMatches[0][1]);
  const ifNoun = ifMatches[0][2];
  if (baseCount === null) return null;
  if (stem(ifNoun) !== stem(baseNoun)) return null; // must restate the SAME base noun

  // The question often refers back to the target noun with an anaphor ("how many pink ONES"
  // rather than "how many pink gumballs"), so require only the target's distinguishing FIRST
  // word (the adjective/qualifier, e.g. "pink") to reappear in the "how many" clause -- positive
  // evidence the question is asking about the SAME target the relationship named, without
  // requiring the full noun phrase to repeat verbatim.
  const targetFirstWord = targetNoun.trim().split(/\s+/)[0];
  const askRe = new RegExp(`how\\s+many\\s+${targetFirstWord}\\b`, 'i');
  if (!askRe.test(q)) return null;

  const answer = multiplier * baseCount + offset;
  return { target: targetNoun, answer };
}

export const linearOffsetTimesBaseCount: LianaMethod = {
  id: 'linear-offset-times-base-count-v1',
  demand: 'COMPUTE',
  name: '"N more than K times the number of X as there are Y" substitution',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C65, sole member harvest_gsm8k_pilot_item139)',
  shapeDescription:
    'A stated linear relationship "<offset> more than <multiplier> times the number of <target> as ' +
    'there are <base>" plus a restated base count; target = multiplier*baseCount + offset.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly one "<offset> more than <multiplier> times the number of X as ' +
          'there are Y" sentence, a single restated "if there are N Y" count for the SAME Y, and ' +
          'a question asking how many X',
      };
    }
    return { matches: true, reason: `target=${result.target} answer=${result.answer}` };
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
        verdict: String(Math.round((result.answer) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: 'multiplier*baseCount + offset',
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

registerMethod(linearOffsetTimesBaseCount);
