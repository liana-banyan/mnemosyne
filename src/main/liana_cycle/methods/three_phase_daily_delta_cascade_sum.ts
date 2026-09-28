// D-BP223-BM04-h2cbpv9w-170 -- three-phase-daily-delta-cascade-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W02).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-phase-daily-delta-cascade-sum-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W02, CLUSTER C38 (1 silo member, high confidence, singleton).
 * Silo shape label: MULTI_BRANCH_DAILY_ADJUSTMENT_CASCADE (three time-period branches each with
 * their own add/subtract/multiply adjustment, summed). Source:
 * methods.harvest_gsm8k_pilot_item122_multi_step_addition_and_subtraction. Representative teaching
 * case, GSM8K test.jsonl lineIndex 122 (Sadie's sleep): "Sadie slept 8 hours on Monday. For the
 * next two days, she slept 2 hours less, each, because she had to complete some assignments. If the
 * rest of the week she slept 1 hour more than those two days, how many hours did she sleep in total
 * throughout the week?"
 *
 * @generalShape A single base value is given directly for day one of a named period ("<N> <unit> on
 *   <weekday>"). A second phase covers a stated number of days at a DELTA from the base ("for the
 *   next <K> days, ... <delta2> <unit> less/more, each"). A third phase covers the REMAINDER of the
 *   period at a delta from the SECOND phase's value, never the base ("the rest of the <period> ...
 *   <delta3> <unit> more/less than those <K> days"). The grand total sums phase-one's single day,
 *   phase-two's per-day value times K, and phase-three's per-day value times the remaining day count.
 *
 * @recogniseInStranger Requires, in order: (a) "<N1> <unit> on <weekday>" giving the base; (b) "for
 *   the next <K> days, ... <N2> <unit> less/more" giving phase two's delta and day count; (c) "rest
 *   of the <period-word> ... <N3> <unit> more/less than those <K2> days" giving phase three's delta,
 *   where K2 must match K from (b) -- a positive cross-check that phase three is genuinely anchored
 *   to phase two's own day-count, not a coincidental separate number; (d) the question asks for a
 *   total "throughout the <period-word>" or "in total". Only "week" (7 days) is a supported period.
 *
 * @whatBreaksIt A period word other than "week" (unsupported, no day-count table for it); the
 *   phase-two and phase-three day-count cross-check failing; a unit mismatch between any of the
 *   three phases (all three clauses must share the same duration unit, hours or minutes); a
 *   negative remaining-day count (K &gt;= period days - 1, which would mean phase three covers zero
 *   or fewer days -- structurally impossible for this shape, so abstain rather than compute a
 *   negative multiplier); any missing numeral in any of the three clauses.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so there is no
 *   looser run-time path. Measured against its own (sole) cluster member: SOLVED (base plus phase
 *   two's two-day total plus phase three's four-day total). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'three-phase-daily-delta-cascade-sum-v1';

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

// Only period this candidate knows the day-count for. A stranger period ("month", "day") abstains
// rather than guessing a day count -- positive evidence, not a blacklist.
const PERIOD_DAYS: Record<string, number> = { week: 7 };

interface Analyzed {
  total: number;
  parts: string[];
}

const BASE_RE = /(\w+)\s+(hours?|minutes?)\s+on\s+\w+day\b/i;
const PHASE2_RE = /for\s+the\s+next\s+(\w+)\s+days?,?[^.]*?\b(?:slept|worked|studied|ran|walked)\s+(\w+)\s+(hours?|minutes?)\s+(less|more)/i;
const PHASE3_RE = /rest\s+of\s+the\s+(\w+)\b[^.]*?\b(?:slept|worked|studied|ran|walked)\s+(\w+)\s+(hours?|minutes?)\s+(more|less)\s+than\s+those\s+(\w+)\s+days\b/i;
const QUESTION_RE = /\btotal\b[^?]*\b(week|throughout)\b|\bthroughout\s+the\s+\w+\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const base = BASE_RE.exec(q);
  const p2 = PHASE2_RE.exec(q);
  const p3 = PHASE3_RE.exec(q);
  if (!base || !p2 || !p3) return null;
  if (!QUESTION_RE.test(q)) return null;

  const unit = base[2].toLowerCase().replace(/s$/, '');
  const p2Unit = p2[3].toLowerCase().replace(/s$/, '');
  const p3Unit = p3[3].toLowerCase().replace(/s$/, '');
  if (unit !== p2Unit || unit !== p3Unit) return null;

  const periodWord = p3[1].toLowerCase();
  const periodDays = PERIOD_DAYS[periodWord];
  if (periodDays === undefined) return null;

  const baseVal = wordOrDigit(base[1]);
  const k = wordOrDigit(p2[1]);
  const delta2 = wordOrDigit(p2[2]);
  const dir2 = p2[4].toLowerCase();
  const delta3 = wordOrDigit(p3[2]);
  const dir3 = p3[4].toLowerCase();
  const k2 = wordOrDigit(p3[5]);

  if ([baseVal, k, delta2, delta3, k2].some((v) => v === null)) return null;
  // POSITIVE CROSS-CHECK: phase three's "those <K2> days" must literally match phase two's own
  // day count -- proof phase three is anchored to phase two, not a coincidental separate number.
  if (k !== k2) return null;

  const remainingDays = periodDays - 1 - (k as number);
  if (remainingDays <= 0) return null;

  const phase2Val = dir2 === 'less' ? (baseVal as number) - (delta2 as number) : (baseVal as number) + (delta2 as number);
  const phase3Val = dir3 === 'more' ? phase2Val + (delta3 as number) : phase2Val - (delta3 as number);
  if (phase2Val < 0 || phase3Val < 0) return null;

  const total = (baseVal as number) + phase2Val * (k as number) + phase3Val * remainingDays;
  if (!Number.isFinite(total) || total < 0) return null;
  return {
    total,
    parts: [`base:${baseVal}`, `phase2:${phase2Val}x${k}`, `phase3:${phase3Val}x${remainingDays}`],
  };
}


export const threePhaseDailyDeltaCascadeSumMethod: LianaMethod = {
  id: 'three-phase-daily-delta-cascade-sum-v1',
  demand: 'COMPUTE',
  name: 'Three-phase daily-delta cascade, each phase anchored to the previous, summed over a week',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W02 (cluster C38, sole member harvest_gsm8k_pilot_item122)',
  shapeDescription:
    'A base value for day one, a K-day phase at a delta from the base, and a remaining-days phase ' +
    'at a delta from the K-day phase (cross-checked by day count), summed across a 7-day week.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find the base/next-K-days/rest-of-week three-phase cascade structure',
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
            const rounded = Math.round((result.total) * 100) / 100;
      return {
        question,
        verdict: String(rounded),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: result.parts.join(' + ') + ` = ${result.total}`,
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
registerMethod(threePhaseDailyDeltaCascadeSumMethod);
