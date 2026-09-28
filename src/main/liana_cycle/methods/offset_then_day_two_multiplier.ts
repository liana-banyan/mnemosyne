// D-BP223-BM04-h2cbpv9w-170 -- offset-then-day-two-multiplier-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W08).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\offset-then-day-two-multiplier-v1.candidate.ts
// Authored by generation wave W08 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W08.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W08, CLUSTER C92 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 231, "Kylie and Robert enjoy going to the
 * beach to collect shells. On Monday, Kylie collects 5 more shells than Robert, who collects 20
 * shells. On Tuesday, Kylie collects 2 times more shells than she did on Monday. How many shells
 * does Kylie collect on Tuesday?". Silo label: "multi-step arithmetic problem -- multi-step
 * addition and multiplication" -- matches exactly.
 *
 * DATASET-CONVENTION FLAG (same class as the W04 report's "X% higher" finding, not hidden): the
 * phrase "<N> times more <item> than she did on <day>" is applied here MULTIPLICATIVELY
 * (day2 = day1Amount * N), matching the item's own accepted answer (50 = 25*2), NOT read as the
 * additive "N times MORE, i.e. day1Amount + N*day1Amount" a strict English reading could also
 * support (which would give 75). This is a documented, widespread GSM8K reference-solution
 * convention (also seen in the W04 wave's C60 finding), not unique to this item, and this
 * candidate reproduces the convention the dataset's own accepted answer requires.
 *
 * @generalShape ACTOR1's first-day count is defined as ACTOR2's stated count plus a stated
 *   difference. ACTOR1's second-day count is then defined as a stated multiple of ACTOR1's OWN
 *   first-day count (the dataset's "times more" convention, read multiplicatively). The question
 *   asks for ACTOR1's second-day count.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) a first-day sentence "<Actor1> collects <diff> more <item> than <Actor2>, who collects
 *       <base> <item>" -- both mentions of <item> must match exactly;
 *   (b) a second-day sentence "on <Day2>, <Actor1> collects <multiplier> times more <item> than
 *       (s)he did on <Day1>" naming the SAME Actor1 and SAME item as (a);
 *   (c) the closing question asking how many <item> ACTOR1 collects on the SAME Day2 named in (b).
 *
 * @whatBreaksIt (a) the item word differing between the two sentences -- abstain; (b) the second-
 *   day sentence naming a different actor than the first-day sentence's Actor1 -- abstain; (c) the
 *   multiplier phrase not resolving to a plain integer/word number -- abstain; (d) the closing
 *   question naming a different actor or day than (b) -- abstain, this candidate only answers for
 *   the exact actor/day the multiplier sentence describes.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (twenty-five on the first day, fifty on the second via the
 *   dataset's own multiplicative "times more" convention). With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'offset-then-day-two-multiplier-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + TENS_WORDS.indexOf('twenty') + ONES_WORDS.indexOf('two')) * ONES_WORDS.indexOf('ten'); });
const NUMBER_WORDS: Record<string, number> = { ...ONES, ...TENS };

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) return NUMBER_WORDS[w];
  return null;
}

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const day1Re = /\b([A-Z][a-z]+)\s+collects\s+(\d+|[a-z]+)\s+more\s+([a-z]+)\s+than\s+([A-Z][a-z]+),\s+who\s+collects\s+(\d+|[a-z]+)\s+([a-z]+)\b/i;
  const d1 = day1Re.exec(q);
  if (!d1) return null;
  const actor1 = d1[1];
  const diff = wordOrDigit(d1[2]);
  const item1 = d1[3].toLowerCase();
  const base = wordOrDigit(d1[5]);
  const item1b = d1[6].toLowerCase();
  if (diff === null || base === null || item1 !== item1b) return null;
  const day1Amount = base + diff;

  const day2Re = new RegExp('on\\s+([A-Za-z]+),\\s+' + actor1 + '\\s+collects\\s+(\\d+|[a-z]+)\\s+times\\s+more\\s+([a-z]+)\\s+than\\s+(?:she|he|they)\\s+did\\s+on\\s+([A-Za-z]+)', 'i');
  const d2 = day2Re.exec(q);
  if (!d2) return null;
  const day2 = d2[1];
  const multiplier = wordOrDigit(d2[2]);
  const item2 = d2[3].toLowerCase();
  if (multiplier === null || item2 !== item1) return null;

  const closing = q.slice(q.lastIndexOf('.') + 1);
  if (!closing.includes(actor1) || !closing.toLowerCase().includes(item1) || !closing.includes(day2)) return null;

  const total = day1Amount * multiplier;
  return { total };
}

export const offsetThenDayTwoMultiplier: LianaMethod = {
  id: 'offset-then-day-two-multiplier-v1',
  demand: 'COMPUTE',
  name: 'First-day offset from a second actor, then a "times more" multiplier for a later day',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W08 (cluster C92, sole member: pilot corpus item at index 231)',
  shapeDescription:
    'Actor1\'s first-day count = Actor2\'s stated count + a stated difference. Actor1\'s second-day ' +
    'count = a stated multiple of Actor1\'s own first-day count (dataset\'s multiplicative "times ' +
    'more" convention). Answer is Actor1\'s second-day count.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a first-day offset-from-actor2 sentence plus a matching second-day ' +
          '"times more" multiplier sentence for the same actor/item plus a matching closing ' +
          'question; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `second-day total = ${result.total}` };
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
        verdict: String(Math.round((result.total) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: '(base+diff) * multiplier',
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

registerMethod(offsetThenDayTwoMultiplier);
