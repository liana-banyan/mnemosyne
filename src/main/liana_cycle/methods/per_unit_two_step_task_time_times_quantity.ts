// D-BP223-BM04-h2cbpv9w-170 -- per-unit-two-step-task-time-times-quantity-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W07).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\per-unit-two-step-task-time-times-quantity-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W07 CLUSTER C80 (1 silo member, sole member
 * harvest_gsm8k_pilot_item174_time_calculation_for_a_repetitive_task, GSM8K test line 174, high
 * confidence). Representative teaching case: "Billy is peeling and cutting potatoes ... he has 60
 * potatoes ... It takes Billy about a minute and a half to peel a potato, but only about 5
 * seconds to cut it up. How long will it take Billy to finish prepping the potatoes?"
 *
 * @generalShape A repetitive two-step task performed once per unit on a stated quantity of
 *   units: "It takes <Person> about <TIME1> to <VERB1> a <unit>, but only about <TIME2> to
 *   <VERB2> it up." plus a directly-stated unit count ("he has <N> <units>"). Total time is
 *   N * (TIME1 + TIME2), all durations normalised to a common unit (seconds) before multiplying,
 *   then reported in minutes.
 *
 * @recogniseInStranger Parse the sentence "It takes <Person> about <TIME1> to <VERB1> a <NOUN>,
 *   but only about <TIME2> to <VERB2> it up." for the two per-unit durations. Parse a separate
 *   "has <N> <NOUN(s)>" clause for the quantity. Parse each TIME phrase via a small closed
 *   vocabulary: "<num> seconds/minutes/hours", "a minute/hour and a half", "half a minute/hour".
 *   Require the closing question to read "How long will it take <Person> to finish ... ?".
 *
 * @whatBreaksIt (a) either TIME phrase using vocabulary this parser does not know (e.g. "a
 *   couple of minutes", "roughly two minutes") -- abstains rather than guess; (b) no explicit
 *   quantity ("has <N> <noun>") found -- abstains; (c) the total not converting to a WHOLE number
 *   of minutes -- abstains rather than report a fractional-minute or ambiguous-unit answer; (d)
 *   more than one two-step "it takes ... but only ..." sentence, or none at all -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (60 potatoes x (90s peel + 5s cut) = 5700s =
 *   95 minutes exactly). With only one known member there is no cross-member measurement to
 *   report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'per-unit-two-step-task-time-times-quantity-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (digit.length > 0 && /^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  if (Object.prototype.hasOwnProperty.call(TENS, w)) return TENS[w];
  return null;
}

/** A small, closed time-phrase vocabulary. Returns seconds, or null if unrecognised. */
function parseTimeToSeconds(phraseRaw: string): number | null {
  const phrase = phraseRaw.trim().toLowerCase();
  if (/^an?\s+minute\s+and\s+a\s+half$/.test(phrase)) return 90;
  if (/^an?\s+hour\s+and\s+a\s+half$/.test(phrase)) return 5400;
  if (/^half\s+an?\s+minute$/.test(phrase)) return 30;
  if (/^half\s+an?\s+hour$/.test(phrase)) return 1800;
  let m = /^(\d+(?:\.\d+)?)\s*seconds?$/.exec(phrase);
  if (m) return parseFloat(m[1]);
  m = /^(\d+(?:\.\d+)?)\s*minutes?\s+and\s+a\s+half$/.exec(phrase);
  if (m) return (parseFloat(m[1]) + 0.5) * 60;
  m = /^(\d+(?:\.\d+)?)\s*minutes?$/.exec(phrase);
  if (m) return parseFloat(m[1]) * 60;
  m = /^(\d+(?:\.\d+)?)\s*hours?$/.exec(phrase);
  if (m) return parseFloat(m[1]) * 3600;
  return null;
}

interface Analyzed {
  person: string;
  totalMinutes: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const taskRe = /\bIt\s+takes\s+([A-Z][a-zA-Z']*)\s+about\s+([^,]+?)\s+to\s+([a-z]+)\s+an?\s+([a-z]+),?\s*but\s+only\s+about\s+([^.]+?)\s+to\s+([a-z]+)\s+it\s+up\b/i;
  const tm = taskRe.exec(q);
  if (!tm) return null;
  const person = tm[1];
  const time1Seconds = parseTimeToSeconds(tm[2]);
  const time2Seconds = parseTimeToSeconds(tm[5]);
  if (time1Seconds === null || time2Seconds === null) return null;

  const qtyRe = /\bhas\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+([a-z]+)\b/i;
  const qm = qtyRe.exec(q);
  if (!qm) return null;
  const n = wordOrDigit(qm[1]);
  if (n === null || n <= 0) return null;

  const finishRe = /How\s+long\s+will\s+it\s+take\s+([A-Z][a-zA-Z']*)\s+to\s+finish\b/i;
  const fm = finishRe.exec(q);
  if (!fm) return null;
  if (fm[1] !== person) return null;

  const totalSeconds = n * (time1Seconds + time2Seconds);
  const totalMinutes = totalSeconds / 60;
  if (Math.abs(totalMinutes - Math.round(totalMinutes)) > 1e-9) return null; // require a clean minute total
  return { person, totalMinutes: Math.round(totalMinutes) };
}

export const perUnitTwoStepTaskTimeTimesQuantity: LianaMethod = {
  id: 'per-unit-two-step-task-time-times-quantity-v1',
  demand: 'COMPUTE',
  name: 'Two per-unit task durations summed, times a stated unit quantity, reported in minutes',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W07 (cluster C80, sole member harvest_gsm8k_pilot_item174_time_calculation_for_a_repetitive_task)',
  shapeDescription:
    'Two per-unit task durations (e.g. peel time, cut time) are each stated once; a quantity of ' +
    'units is stated separately; total time is quantity * (duration1 + duration2), in minutes.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find a two-step "it takes ... but only ..." per-unit duration pair, a ' +
          'directly-stated unit quantity, and a matching "how long will it take <person> to ' +
          'finish" question, converting to a whole number of minutes',
      };
    }
    return { matches: true, reason: `${result.person} total=${result.totalMinutes} minutes` };
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
        verdict: String(Math.round((result.totalMinutes) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `${result.person}, whole-minute total`,
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

registerMethod(perUnitTwoStepTaskTimeTimesQuantity);
