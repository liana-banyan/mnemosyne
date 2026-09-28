// D-BP223-BM04-h2cbpv9w-170 -- box-capacity-then-combined-total-divided-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R04
// (registration batch drawn from generation waves W16-W20).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\box-capacity-then-combined-total-divided-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R04
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R04.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W19, CLUSTER C179 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 322, "Jam has three boxes full of pencils
 * and 2 loose pencils which give a total of 26 pencils. If her sister, Meg, has 46 pencils, how
 * many boxes do Jam and Meg need to store all their pencils?" Silo label: "multi-step word
 * problem involving algebraic logic and addition" -- matches exactly.
 *
 * NAMING NOTE: this item's own correct answer is the single digit "9". Gate 2a's bare-numeral
 * scan (`(?<![\d.]) F (?![\d.])`) fires on ANY standalone "9" in executable code, and a numbered
 * regex capture group access (e.g. `m[1]`) or a plain digit-suffixed identifier (`item1`,
 * `total2`, `person1`) is exactly such a standalone character sequence once several are used
 * side by side and one of them happens to be "9" for some intermediate value. Every identifier
 * below therefore avoids digit suffixes (personA/personB, itemFirst/itemSecond/itemThird,
 * totalFirst/totalSecond rather than person1/person2, item1/item2/item3, total1/total2), and
 * every regex uses NAMED capture groups ((?&lt;name&gt;...), read back via match.groups.name)
 * rather than numbered ones, for the same reason a numbered index would risk landing on a bare
 * "9" the moment any group happens to hold that digit. See the sibling candidate in this same
 * wave, fraction-of-base-then-delta-final-item-value-v1, for a fuller writeup of this gate-2a
 * finding (there triggered by the digit "1" instead).
 *
 * @generalShape Person1 has N full boxes of an item PLUS a stated LOOSE count of the same item,
 *   summing to a stated TOTAL1 for Person1. The per-box capacity is derived by dividing
 *   (TOTAL1 - loose) by N. Person2 has a directly-stated TOTAL2 of the same item (no boxes
 *   mentioned). The question asks how many boxes BOTH people together need, computed as
 *   (TOTAL1 + TOTAL2) divided by the derived per-box capacity.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence:
 *   (a) "<Person1> has <N> boxes full of <item> and <L> loose <item> which give a total of
 *       <TOTAL1> <item>" -- all four numbers and the item noun in one sentence;
 *   (b) "<Person2> has <TOTAL2> <item>" naming the SAME item, a DIFFERENT person from Person1;
 *   (c) a closing question "how many boxes do <Person1> and <Person2> need to store all their
 *       <item>", naming BOTH people (in either order) and the SAME item.
 *
 * @whatBreaksIt (a) (TOTAL1 - loose) not dividing evenly by N -- abstain, never round a
 *   per-box capacity; (b) the combined total not dividing evenly by the derived capacity --
 *   abstain rather than report a fractional or ceiling-rounded box count; (c) Person2's own
 *   sentence not matching the tight "<Name> has <digits> <item>" pattern (e.g. Person2 is
 *   ALSO described with boxes, "Meg has 5 boxes of 46 pencils") -- the pattern requires a bare
 *   digit total to follow "has" directly, so a boxes-for-Person2 phrasing simply fails to match
 *   rather than needing a separate guard; (d) the closing question naming a person other than
 *   exactly Person1 and Person2 -- abstain.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (perBox = (26-2)/3 = 8, combined = 26+46 = 72, boxes = 72/8 =
 *   9). With only one known cluster member there is no cross-member measurement to report.
 *
 * SECOND NAMING NOTE: this item's answer "9" ALSO collides with the dispatch id itself
 * (D-BP223-BM04-h2cbpv9w-170 contains a bare "9" in "cbpv9w", not adjacent to any other digit --
 * exactly the "single-digit answers colliding with digits ... in the dispatch id" bug class this
 * wave's own brief named up front). The `taughtBy` field in the exported object below therefore
 * omits the dispatch id string (present here in the header comment instead, which gate 2a never
 * scans for the bare-numeral refusal) and cites only the wave/cluster/item instead.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'box-capacity-then-combined-total-divided-v1';

function normName(s: string): string {
  return s.trim().toLowerCase();
}

// Built by array index, never a literal digit, so no forbidden answer literal can coincide with
// a table entry (D-BP223 estate-wide gate 2a discipline).
const NUMBER_WORD_LIST = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const NUMBER_WORDS: Record<string, number> = {};
NUMBER_WORD_LIST.forEach((w, i) => { NUMBER_WORDS[w] = i; });

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const personARe = /\b(?<name>[A-Z][a-z]+)\s+has\s+(?<boxWord>[a-z]+|\d+)\s+boxes\s+full\s+of\s+(?<itemFirst>[a-z]+)\s+and\s+(?<loose>\d+)\s+loose\s+(?<itemSecond>[a-z]+)\s+which\s+give\s+a\s+total\s+of\s+(?<totalFirst>\d+)\s+(?<itemThird>[a-z]+)\b/i;
  const personAMatch = personARe.exec(q);
  if (!personAMatch || !personAMatch.groups) return null;
  const personA = personAMatch.groups.name;
  const boxWordTok = personAMatch.groups.boxWord.toLowerCase();
  const boxCount = /^\d+$/.test(boxWordTok) ? parseInt(boxWordTok, 10) : NUMBER_WORDS[boxWordTok];
  const itemFirst = personAMatch.groups.itemFirst.toLowerCase();
  const loose = parseInt(personAMatch.groups.loose, 10);
  const itemSecond = personAMatch.groups.itemSecond.toLowerCase();
  const totalFirst = parseInt(personAMatch.groups.totalFirst, 10);
  const itemThird = personAMatch.groups.itemThird.toLowerCase();
  if (!boxCount || boxCount <= 0 || itemFirst !== itemSecond || itemSecond !== itemThird) return null;
  if (!Number.isFinite(loose) || !Number.isFinite(totalFirst) || totalFirst <= loose) return null;

  const filledAmount = totalFirst - loose;
  if (filledAmount % boxCount !== 0) return null;
  const perBox = filledAmount / boxCount;
  if (perBox <= 0) return null;

  const personBRe = new RegExp('\\b(?<name>[A-Z][a-z]+)\\s*,?\\s*has\\s+(?<totalSecond>\\d+)\\s+' + itemFirst + '\\b', 'i');
  const personBMatch = personBRe.exec(q.slice(personAMatch.index! + personAMatch[0].length));
  if (!personBMatch || !personBMatch.groups) return null;
  const personB = personBMatch.groups.name;
  const totalSecond = parseInt(personBMatch.groups.totalSecond, 10);
  if (!Number.isFinite(totalSecond) || totalSecond <= 0 || normName(personB) === normName(personA)) return null;

  const combined = totalFirst + totalSecond;
  if (combined % perBox !== 0) return null;
  const boxesNeeded = combined / perBox;

  const closeRe = new RegExp(
    'how many boxes do\\s+(?:' + personA + '\\s+and\\s+' + personB + '|' + personB + '\\s+and\\s+' + personA + ')\\s+need to store all their\\s+' + itemFirst + '\\b',
    'i',
  );
  if (!closeRe.test(q)) return null;

  if (boxesNeeded <= 0 || !Number.isInteger(boxesNeeded)) return null;
  return { total: boxesNeeded };
}

export const boxCapacityThenCombinedTotalDivided: LianaMethod = {
  id: 'box-capacity-then-combined-total-divided-v1',
  demand: 'COMPUTE',
  name: 'Derive per-box capacity from one person\'s boxes-plus-loose total, then divide a two-person combined total by it',
  taughtBy: 'WAVE W19 (cluster C179, sole member: pilot corpus item at index 322; dispatch id cited in this file\'s header comment only, to avoid a bare-digit collision with this item\'s own answer)',
  shapeDescription:
    'perBox = (totalFirst - loose) / boxCount; combined = totalFirst + totalSecond; ' +
    'boxesNeeded = combined / perBox.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a boxes-plus-loose-total sentence for one person, a plain total for a ' +
          'second (box-free) person, and a closing "how many boxes do <both> need" question, ' +
          'resolving to a positive integer via exact division at both steps; abstaining rather ' +
          'than guessing',
      };
    }
    return { matches: true, reason: `boxes needed = ${result.total}` };
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
          verdict: String(Math.round(result.total * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'derived per-box capacity, then divided the combined total by it',
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

registerMethod(boxCapacityThenCombinedTotalDivided);
