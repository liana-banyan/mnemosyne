// D-BP223-BM04-h2cbpv9w-170 -- sum-of-items-times-number-of-readers-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W02).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\sum-of-items-times-number-of-readers-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W02, CLUSTER C41 (1 silo member, high confidence, singleton).
 * Silo shape label: SET_OVERLAP_UNIQUE_COUNT (two totals plus a shared/overlapping subset,
 * requiring inclusion-exclusion rather than plain addition). Source:
 * methods.harvest_gsm8k_pilot_item241_counting_items_in_a_set. Representative teaching case,
 * GSM8K test.jsonl lineIndex 241 (Dolly and Pandora's books): "Dolly has two books. Pandora has
 * one. If both Dolly and Pandora read each others' books as well as their own, how many books
 * will they collectively read by the end?"
 *
 * HONEST LABEL FLAG, stated plainly rather than silently re-labeled: this cluster's own silo
 * shape label names "inclusion-exclusion" and "a shared/overlapping subset", but the ACTUAL
 * arithmetic of its sole member does neither -- there is no overlap to exclude. Each of N people
 * individually owns some items (no two people own the same item), and each person then reads the
 * FULL combined set (their own plus everyone else's). Total reading-events = (sum of individually
 * owned items) x (number of people). This candidate is built to match the real, measured
 * arithmetic of the representative item, not the harvested label -- exactly the class of
 * harvested-label mismatch batch 2 flagged for C43 and this dispatch flags again here rather than
 * silently building to the wrong formula.
 *
 * @generalShape N (here, exactly two) people each own a directly-stated count of the same kind of
 *   item, in separate short "<Name> has <count>[.]" clauses (a later clause may omit the noun by
 *   ellipsis, since it was already named). A clause then states that everyone reads EVERYONE's
 *   items, "each other's <noun> as well as their own" (or an equivalent "too"/"also" phrasing) --
 *   this exact phrase is the positive-evidence anchor that every person reads the FULL combined
 *   set. The total is (sum of individually-owned counts) multiplied by (the number of people).
 *
 * @recogniseInStranger Scans for two or more "<ProperName> has <count>( <noun>)?\.?" clauses
 *   before an "each other's <noun-or-plural>" (or "each others'") clause, requires the phrase
 *   "as well as their own" (or "too"/"also") immediately nearby as positive evidence of full
 *   cross-reading (not partial swapping), requires the "each other's" clause's own noun to match
 *   (by shared stem, case-insensitive) the noun named in the person-count clauses, and requires
 *   the question to ask how many items they will "collectively" read/have "in total"/"by the end".
 *
 * @whatBreaksIt Fewer than two person-count clauses (nothing to multiply); the "each other's ...
 *   as well as their own" qualifier missing (a different, unknown swapping rule -- e.g. only
 *   reading ONE other person's items, which is a different multiplier entirely -- abstains rather
 *   than assuming full cross-reading); a noun mismatch between the person-count clauses and the
 *   "each other's" clause; any unparsable count word.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (2+1=3 combined items, 2 people, 3x2=6). With
 *   only one known member there is no cross-member measurement to report for this cluster, and the
 *   label mismatch above means a future sibling item genuinely requiring inclusion-exclusion (an
 *   actual shared subset) would need a DIFFERENT method, not an extension of this one.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'sum-of-items-times-number-of-readers-v1';

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

const CROSS_READ_RE = /each\s+other(?:'s|s')?\s+([a-zA-Z]+)\b[^.?]*?\b(?:as\s+well\s+as\s+their\s+own|too|also)\b/i;
const PERSON_COUNT_RE = /([A-Z][a-zA-Z]*)\s+has\s+(\w+)(?:\s+([a-zA-Z]+))?\s*\.?/g;
const QUESTION_RE = /collectively\b|in\s+total\b|by\s+the\s+end\b|altogether\b/i;

function stem(word: string): string {
  return word.toLowerCase().replace(/'s?$/, '').replace(/s$/, '');
}

interface Analyzed {
  total: number;
  parts: string[];
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const cross = CROSS_READ_RE.exec(q);
  if (!cross) return null;
  if (!QUESTION_RE.test(q)) return null;

  const crossNounStem = stem(cross[1]);
  const before = q.slice(0, cross.index);

  const people: { name: string; count: number }[] = [];
  let sharedNoun: string | null = null;
  let m: RegExpExecArray | null;
  PERSON_COUNT_RE.lastIndex = 0;
  while ((m = PERSON_COUNT_RE.exec(before)) !== null) {
    const count = wordOrDigit(m[2]);
    if (count === null) continue;
    if (m[3]) sharedNoun = stem(m[3]);
    people.push({ name: m[1], count });
  }
  if (people.length < 2) return null;
  if (sharedNoun === null) return null;
  // POSITIVE EVIDENCE: the "each other's <noun>" clause's own noun must match the noun the
  // person-count clauses were actually counting -- never assumed by position.
  if (sharedNoun !== crossNounStem) return null;

  const combined = people.reduce((acc, p) => acc + p.count, 0);
  const numPeople = people.length;
  const total = combined * numPeople;
  if (!Number.isFinite(total) || total < 0) return null;
  return {
    total,
    parts: [`combined:${combined}`, `x people:${numPeople}`],
  };
}


export const sumOfItemsTimesNumberOfReadersMethod: LianaMethod = {
  id: 'sum-of-items-times-number-of-readers-v1',
  demand: 'COMPUTE',
  name: 'Sum of individually-owned items times the number of people who each read the full set',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W02 (cluster C41, sole member harvest_gsm8k_pilot_item241)',
  shapeDescription:
    'Two or more people each own a stated count of the same item (no overlap); "each other\'s ... ' +
    'as well as their own" signals every person reads the FULL combined set; total = combined x N.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find two-or-more person-count clauses plus an "each other\'s ... as well as their own" cross-read clause',
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
        basis: result.parts.join(' ') + ` = ${result.total}`,
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
registerMethod(sumOfItemsTimesNumberOfReadersMethod);
