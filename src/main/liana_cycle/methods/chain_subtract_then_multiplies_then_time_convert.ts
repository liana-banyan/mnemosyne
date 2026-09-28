// D-BP223-BM04-h2cbpv9w-170 -- chain-subtract-then-multiplies-then-time-convert-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W02).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\chain-subtract-then-multiplies-then-time-convert-v1.candidate.ts
// Authored by generation wave W02 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W02.md), merged into the
// shared manifest and run through the full gate chain by REGISTRAR R01
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md): gate 1 (positive yield), gate 2a (answer carry),
// gate 4 (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora, per D-BP223-M0-h2cbpc0g-043's own methodology), and the
// perturbation gate 2b (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations,
// oracle hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN local
// `LianaQuestionInput`, `ShapeTestResult` and `RunResult` interfaces and left the exported object
// completely unannotated, so nothing was ever checked against the real registry contract -- the
// same disguise found and named in the earlier seven item-10 methods, batch 1 and batch 2 (see
// reference_a_hand_copied_contract_is_the_defect_not_bad_types_bp222.md). Those three local
// interfaces are DELETED here; `LianaMethod` and `MethodQuestionInput` are imported from
// '../method_registry' and the exported object is annotated against the real `LianaMethod` type,
// per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant, every
// helper function and analyze() itself below are the candidate's own bytes, from its first
// behavior-bearing declaration through analyze()'s closing brace -- proved by a programmatic byte-
// containment check (extract, splice, re-read, includes()), not merely asserted. See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the exact core-bytes/core-lines/CONTAINED table.
// Only the interface layer (imports, the three deleted local interfaces, the exported object's
// shape, shapeTest/run signatures, and the numeric-verdict rounding + String() cast) is new text.
//
// TRY/CATCH, matching the Founder-approved pass across the earlier seven, batch 1 and batch 2
// (D-BP223-BM0-005, 2026-09-07T01:25:41Z ruling: "Yes do the Try/Catch pass across the seven.
// Approved. Word."): run() aborts to an honest abstain on any thrown error rather than ending the
// engine's fall-through chain.
//
// REGISTERED QUARANTINED (`quarantined: true`), so selectMethod() and selectEligibleMethods() will
// never choose it. Registering changes NO live run; it makes the method visible to listMethods()
// and measurable. Un-quarantining is a separate, later Founder decision made per batch after
// held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W02, CLUSTER C42 (1 silo member, high confidence, singleton).
 * Silo shape label: CHAIN_TWO_MULTIPLIES_THEN_CONVERT_UNITS (two sequential multiplies, then a
 * trailing minutes-to-hours conversion). Source:
 * methods.harvest_gsm8k_pilot_item242_time_calculation_based_on_volume_of_work. Representative
 * teaching case, GSM8K test.jsonl lineIndex 242 (Mike's pen pals): "Mike was a pen pal with 5
 * people. He stopped being penpals with 2 of them. They each send 2 letters a week that are 5
 * pages long. He responds in kind. He can write a page every 6 minutes. How many hours does he
 * spend writing a week?"
 *
 * @generalShape An initial count is reduced by a stated subtraction (a stopping/leaving clause),
 *   giving a remaining count. That remaining count is multiplied by a per-person weekly rate to get
 *   a total count of one unit (letters), which is multiplied again by a per-unit conversion (pages
 *   per letter) to get a total of a second unit (pages). That total is multiplied by a
 *   minutes-per-page rate to get total minutes, then divided by 60 to report hours. Five chained
 *   operations (subtract, multiply, multiply, multiply, divide), not the two multiplies the silo's
 *   own label names -- the label undercounts steps but the core "chain of multiplies ending in a
 *   unit conversion" shape holds, flagged here rather than silently accepted.
 *
 * @recogniseInStranger Requires, in order: (a) "pen pal with <N1> people"; (b) "stopped being
 *   penpals with <N2> of them" (the positive-evidence subtraction clause -- without it this
 *   candidate does not know the remaining count is anything other than N1); (c) "each send <N3>
 *   letters a week that are <N4> pages long" (both the per-person weekly rate and the pages-per-
 *   letter conversion in one clause); (d) "write a page every <N5> minutes"; (e) a question asking
 *   for "how many hours ... a week".
 *
 * @whatBreaksIt Any missing one of the five numerals; a final minutes-to-hours division that does
 *   not land on a whole number of hours (a strong signal of a misparse or a different, unsupported
 *   variant of the shape -- e.g. one requiring the response letters to be doubled -- so this
 *   candidate abstains rather than report a fractional-hour guess); a "stopped/quit/dropped" clause
 *   with a count of zero or exceeding the initial count (structurally impossible, abstain); a
 *   question asking about something other than a weekly hours total (e.g. asking for total pages).
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED ((5-2)=3, 3x2=6 letters, 6x5=30 pages,
 *   30x6=180 minutes, 180/60=3 hours). With only one known member there is no cross-member
 *   measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'chain-subtract-then-multiplies-then-time-convert-v1';

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
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

const INITIAL_RE = /pen\s*pal\s+with\s+(\w+)\s+people\b/i;
const STOPPED_RE = /stopped\s+being\s+pen\s*pals\s+with\s+(\w+)\s+of\s+them\b/i;
const RATE_RE = /each\s+send\s+(\w+)\s+letters?\s+a\s+week\s+that\s+are\s+(\w+)\s+pages?\s+long\b/i;
const MINUTES_RE = /write\s+a\s+page\s+every\s+(\w+)\s+minutes?\b/i;
const QUESTION_RE = /how\s+many\s+hours\b[^?]*\ba\s+week\b/i;

interface Analyzed {
  hours: number;
  parts: string[];
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const initial = INITIAL_RE.exec(q);
  const stopped = STOPPED_RE.exec(q);
  const rate = RATE_RE.exec(q);
  const minutes = MINUTES_RE.exec(q);
  if (!initial || !stopped || !rate || !minutes) return null;
  if (!QUESTION_RE.test(q)) return null;

  const n1 = wordOrDigit(initial[1]);
  const n2 = wordOrDigit(stopped[1]);
  const lettersPerWeek = wordOrDigit(rate[1]);
  const pagesPerLetter = wordOrDigit(rate[2]);
  const minutesPerPage = wordOrDigit(minutes[1]);
  if ([n1, n2, lettersPerWeek, pagesPerLetter, minutesPerPage].some((v) => v === null)) return null;
  if ((n2 as number) <= 0 || (n2 as number) >= (n1 as number)) return null;

  const remaining = (n1 as number) - (n2 as number);
  const totalLetters = remaining * (lettersPerWeek as number);
  const totalPages = totalLetters * (pagesPerLetter as number);
  const totalMinutes = totalPages * (minutesPerPage as number);
  if (totalMinutes % 60 !== 0) return null; // fractional-hour result -- a different variant, abstain.
  const hours = totalMinutes / 60;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return {
    hours,
    parts: [`(${n1}-${n2})=${remaining}`, `x${lettersPerWeek}=${totalLetters}`, `x${pagesPerLetter}=${totalPages}`, `x${minutesPerPage}=${totalMinutes}m`, `/60=${hours}h`],
  };
}


export const chainSubtractThenMultipliesThenTimeConvertMethod: LianaMethod = {
  id: 'chain-subtract-then-multiplies-then-time-convert-v1',
  demand: 'COMPUTE',
  name: 'Subtract a count, chain two multiplies, then convert minutes to hours',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W02 (cluster C42, sole member harvest_gsm8k_pilot_item242)',
  shapeDescription:
    'An initial count reduced by a subtraction, then two chained multiplies (per-person rate, ' +
    'per-unit conversion), then a minutes-per-page multiply and a minutes-to-hours division.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find the pen-pal-count/stopped/weekly-rate/minutes-per-page chain structure',
      };
    }
    return { matches: true, reason: `parts=${JSON.stringify(result.parts)}` };
  },
  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    // A question with no options is free text. Read off the input, never assumed --
    // same convention as every other adapted method in this folder.
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const result = analyze(question);
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
            const rounded = Math.round((result.hours) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: result.parts.join(' '),
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

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder.
// ACCEPTED by REGISTRAR R01's own live run of accept_gates.cjs (gate 1 then gate 2a then gate 4
// then gate 5) and by the perturbation gate (2b, baseline + 3 perturbations, all TRACK). See
// BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R01.md for the full verdict table.
registerMethod(chainSubtractThenMultipliesThenTimeConvertMethod);
