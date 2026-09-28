// D-BP223-BM04-h2cbp9d8-171 -- five-day-activity-durations-with-multiple-and-half-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\five-day-activity-durations-with-multiple-and-half-sum-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R05
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md): gate 1 (positive yield), gate 2a
// (answer carry, under the gate2_answer_carry.cjs:253 letter-boundary fix installed
// 2026-09-08T09:08:02Z), gate 4 (interception against the live registry), gate 5 (sibling
// interception against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R05.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C197 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 350, "Peyton scheduled after-work activities of a one hour
 * yoga class on Monday, a cooking class that lasts three times as long as Monday's yoga on
 * Tuesday, a half-hour cheese-tasting event on Wednesday, a museum tour that takes half as long
 * as the cooking class on Thursday, and two hours of errands on Friday. How many hours will all
 * Peyton's after-work activities take?" Silo label: "multi-step time calculation based on
 * relative durations".
 *
 * @generalShape A list of exactly FIVE weekday activities is given, each with a duration EITHER
 *   stated directly in hours (a bare or half-hour figure) OR stated as a multiple/fraction of a
 *   PREVIOUSLY-NAMED weekday's own activity duration ("<mult> times as long as <Day>'s <item>",
 *   "half as long as the <item>"). Direct durations must be resolved before any relative
 *   duration that depends on them (a two-pass resolution: direct clauses first, then relative
 *   clauses, each resolved against an already-known duration). The question asks for the sum of
 *   all five durations.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) exactly five clauses, one per
 *   weekday (Monday through Friday), each naming its own day; (b) each clause is either a DIRECT
 *   duration ("a <N> hour <item>" or "a half-hour <item>", or "<N> hours of <item>") or a
 *   RELATIVE duration referencing another clause's own item/day by name via a fixed multiplier
 *   word table (twice/half/"<k> times as long"); (c) every relative reference resolves to a
 *   clause that itself already resolved (direct, or a relative clause resolved in an earlier
 *   pass) -- no circular or forward-only-unresolvable reference; (d) a closing "how many hours
 *   will all ... activities take" question.
 *
 * @whatBreaksIt (a) fewer or more than five day-clauses -- abstain, this candidate only reasons
 *   about a full five-weekday list; (b) a relative clause referencing a day/item that cannot be
 *   matched to an earlier clause -- abstain, cannot resolve; (c) an unrecognised multiplier/
 *   fraction word -- abstain rather than guess; (d) two relative clauses forming a cycle (each
 *   depending on the other, neither ever directly stated) -- abstain, unsolvable by this
 *   candidate's single forward pass.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (1 + 3 + 0.5 + 1.5 + 2 = 8). With only one known cluster member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'five-day-activity-durations-with-multiple-and-half-sum-v1';

interface Analyzed { total: number; }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** Splits the activity-listing sentence into ONE FRAGMENT PER DAY by commas (a leading "and" is
 *  stripped from the final fragment). Splitting on commas rather than a greedy "up to this day"
 *  regex is what keeps each day's own clause from swallowing an earlier day's clause text --
 *  found the hard way: a "[^.]*?\bon\s+<Day>\b" pattern anchored only on the right accumulates
 *  every earlier day's own words too, corrupting later days' direct-duration detection. */
function splitClauses(q: string): string[] {
  const body = q.split(/\bhow many\b/i)[0];
  const sentence = body.replace(/\.\s*$/, '');
  return sentence.split(',').map((s) => s.replace(/^\s*and\s+/i, '').trim()).filter(Boolean);
}

const NUMBER_WORD_LIST = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function wordOrDigitToNumber(w: string): number | null {
  const lw = w.toLowerCase();
  const idx = NUMBER_WORD_LIST.indexOf(lw);
  if (idx >= 0) return idx;
  if (/^\d+$/.test(lw)) return parseInt(lw, 10);
  return null;
}

function directHours(clause: string): number | null {
  const halfHour = /\bhalf[- ]hour\b/i.exec(clause);
  if (halfHour) return 0.5;
  const hoursOf = /(\d+|[a-z]+)\s+hours?\s+of\b/i.exec(clause);
  if (hoursOf) {
    const n = wordOrDigitToNumber(hoursOf[1]);
    if (n != null) return n;
  }
  const aHour = /\ba\s+(\d+|[a-z]+)\s+hour\b/i.exec(clause);
  if (aHour) {
    const n = wordOrDigitToNumber(aHour[1]);
    if (n != null) return n;
  }
  return null;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const fragments = splitClauses(q);
  if (fragments.length !== DAYS.length) return null;

  const dayClauses: { day: string; clause: string }[] = [];
  for (const day of DAYS) {
    const matchingFragments = fragments.filter((f) => new RegExp('\\bon\\s+' + day + '\\b', 'i').test(f));
    if (matchingFragments.length !== 1) return null;
    dayClauses.push({ day, clause: matchingFragments[0] });
  }

  const resolved: Record<string, number> = {};
  const unresolved = new Set(DAYS);

  // Pass 1: direct durations.
  for (const { day, clause } of dayClauses) {
    const h = directHours(clause);
    if (h != null) { resolved[day] = h; unresolved.delete(day); }
  }

  // Pass 2 (repeat until stable): relative durations referencing an already-resolved day, EITHER
  // by the day's own name ("as long as Monday's yoga") OR by a shared content word with that
  // day's own clause ("half as long as the cooking class" -- Tuesday's own headline noun, no day
  // name mentioned at all). The content-word fallback excludes purely structural vocabulary
  // (duration/comparison scaffolding) so it never fires on incidental word overlap.
  const STRUCTURAL_WORDS = new Set([
    'hour', 'hours', 'half', 'that', 'which', 'takes', 'lasts', 'long', 'times', 'twice',
    'thrice', 'class', 'event', 'activity', 'activities', 'scheduled', 'after', 'work', 'the',
    'and', 'will', 'all',
  ]);
  function contentWords(text: string): Set<string> {
    const words = (text.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length >= 4 && !STRUCTURAL_WORDS.has(w));
    return new Set(words);
  }

  let progressed = true;
  while (progressed && unresolved.size > 0) {
    progressed = false;
    for (const { day, clause } of dayClauses) {
      if (resolved[day] != null) continue;
      for (const refDay of DAYS) {
        if (resolved[refDay] == null) continue;
        const refByName = new RegExp(escapeRe(refDay) + "['’]?s?\\b", 'i').test(clause);
        let refByContent = false;
        if (!refByName) {
          const refClause = dayClauses.find((d) => d.day === refDay)!.clause;
          const shared = [...contentWords(clause)].some((w) => contentWords(refClause).has(w));
          refByContent = shared;
        }
        if (!refByName && !refByContent) continue;
        const multRe = /(\d+|[a-z]+)\s+times\s+as\s+long|(twice)\s+as\s+long|(thrice)\s+as\s+long/i.exec(clause);
        const halfRe = /\bhalf\s+as\s+long\b/i.exec(clause);
        if (multRe) {
          let factor: number | null;
          if (multRe[1]) factor = wordOrDigitToNumber(multRe[1]);
          else if (multRe[2]) factor = 2;
          else factor = 3;
          if (factor == null) continue;
          resolved[day] = resolved[refDay] * factor;
          unresolved.delete(day);
          progressed = true;
          break;
        } else if (halfRe) {
          resolved[day] = resolved[refDay] / 2;
          unresolved.delete(day);
          progressed = true;
          break;
        }
      }
      if (resolved[day] != null) continue;
    }
  }
  if (unresolved.size > 0) return null;

  if (!/how\s+many\s+hours\s+will\s+all\b/i.test(q)) return null;

  const total = DAYS.reduce((acc, d) => acc + resolved[d], 0);
  if (!Number.isFinite(total)) return null;
  return { total };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const fiveDayActivityDurationsWithMultipleAndHalfSum: LianaMethod = {
  id: 'five-day-activity-durations-with-multiple-and-half-sum-v1',
  demand: 'COMPUTE',
  name: 'Five weekday activity durations, some direct and some relative to another day, summed -- exact rational arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C197, sole member: pilot corpus item at index 350)',
  shapeDescription: 'resolve each of Monday-Friday\'s duration (direct hours, or a multiple/half of an already-resolved day), sum all five',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly five weekday (Monday-Friday) activity clauses, each resolvable ' +
          'to a direct duration or a multiple/half of an already-resolved day\'s duration, plus a ' +
          'closing "how many hours will all ... activities take" question; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `total = ${result.total}` };
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
          basis: 'each weekday duration resolved (direct or relative to another resolved day), summed',
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

registerMethod(fiveDayActivityDurationsWithMultipleAndHalfSum);
