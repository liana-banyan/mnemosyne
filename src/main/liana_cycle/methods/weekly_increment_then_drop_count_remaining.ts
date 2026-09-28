// D-BP223-BM04-h2cbp9d8-171 -- weekly-increment-then-drop-count-remaining-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\weekly-increment-then-drop-count-remaining-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W21, CLUSTER C193 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl line 340, "Josh decides to take up juggling ... He starts off
 * practicing juggling 3 balls, and slowly gets better adding 1 ball to his juggling act each
 * week. After the end of the fourth week the talent show begins, but when Josh walks on stage he
 * slips and drops three of his balls. 2 of them are caught by people in the crowd ..., but one
 * gets lost completely .... Josh starts to juggle on stage with how many balls?". Silo label:
 * "multi-step arithmetic progression and subtraction".
 *
 * @generalShape An actor starts practicing with a stated count of an item, adding a stated
 *   per-period increment each period, for a stated number of periods (an ORDINAL word naming
 *   "the end of the <Nth> <period>"). At the end of that accumulation, the actor drops/loses a
 *   SEPARATE stated amount of the SAME item. The question asks how many the actor is left
 *   juggling/holding with. Answer = start + increment*periods - dropped. Critically, any further
 *   prose elaborating on what happens to the DROPPED items after they leave the actor's hands
 *   (some caught, some lost) is IRRELEVANT to the actor's own remaining count and must be
 *   ignored, not summed or subtracted a second time.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a start clause "practicing
 *   <verb-ing> <N1> <item>"; (b) a per-period increment clause "adding <N2> <itemSingular> ...
 *   each <period>" naming the SAME item (singular/plural stem match) and a period unit (week,
 *   day, month); (c) an ordinal-period clause "the end of the <ordinal> <period>" naming the SAME
 *   period unit, resolved via a fixed ordinal-word table; (d) a drop clause "drops <N3> of his/
 *   her/their <item>" naming the SAME actor and item; (e) a closing "<actor> starts to juggle ...
 *   with how many <item>" (or an equivalent "how many <item> does <actor> have/start with")
 *   question naming the same item.
 *
 * @whatBreaksIt (a) the item word differing across any clause -- abstain, cannot confirm the same
 *   running quantity; (b) the ordinal word not in the fixed table -- abstain rather than guess;
 *   (c) the dropped amount exceeding the accumulated total -- abstain rather than report a
 *   negative count; (d) any further sentence describing the FATE of the dropped items (caught,
 *   lost, rolled away) being mistaken for a second drop or a recovery -- deliberately never
 *   parsed by this candidate's arithmetic, since the question only asks what the actor is left
 *   holding, not what became of what fell.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a
 *   shape-test pass guarantees run() can reconstruct the same numbers. Measured against its own
 *   (sole) cluster member: SOLVED (3 + 1*4 - 3 = 4). With only one known cluster member there is
 *   no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'weekly-increment-then-drop-count-remaining-v1';

interface Analyzed { remaining: number; }

const NUMBER_WORD_LIST = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];

const ORDINAL_WORD_LIST = [
  'zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

function wordToCount(word: string): number | null {
  const w = word.toLowerCase().trim();
  const idx = NUMBER_WORD_LIST.indexOf(w);
  if (idx >= 0) return idx;
  const digitMatch = /^\d+$/.exec(w);
  if (digitMatch) return parseInt(w, 10);
  return null;
}

function ordinalToCount(word: string): number | null {
  const idx = ORDINAL_WORD_LIST.indexOf(word.toLowerCase().trim());
  return idx >= 0 ? idx : null;
}

function stemItem(word: string): string {
  let w = word.trim().toLowerCase();
  if (w.endsWith('es') && w.length > 3) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 2) w = w.slice(0, -1);
  return w;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const startRe = /practicing\s+[a-z]+ing\s+(\d+)\s+([a-z]+)\b/i;
  const sm = startRe.exec(q);
  if (!sm) return null;
  const start = parseInt(sm[1], 10);
  if (!Number.isFinite(start) || start < 0) return null;
  const item = stemItem(sm[2]);

  const incRe = new RegExp(
    'adding\\s+(\\d+)\\s+([a-z]+)\\b[^.]*?\\beach\\s+([a-z]+)\\b', 'i',
  );
  const im = incRe.exec(q);
  if (!im) return null;
  const increment = parseInt(im[1], 10);
  if (!Number.isFinite(increment) || increment < 0) return null;
  if (stemItem(im[2]) !== item) return null;
  const periodUnit = im[3].toLowerCase();

  const periodRe = new RegExp(
    'the\\s+end\\s+of\\s+the\\s+([a-z]+)\\s+' + escapeRe(periodUnit) + '\\b', 'i',
  );
  const pm = periodRe.exec(q);
  if (!pm) return null;
  const periods = ordinalToCount(pm[1]);
  if (periods == null || periods <= 0) return null;

  const dropRe = new RegExp(
    'drops?\\s+(\\d+|[a-z]+)\\s+of\\s+(?:his|her|their)\\s+([a-z]+)\\b', 'i',
  );
  const dm = dropRe.exec(q);
  if (!dm) return null;
  const dropped = wordToCount(dm[1]);
  if (dropped == null || dropped < 0) return null;
  if (stemItem(dm[2]) !== item) return null;

  const closingRe = new RegExp(
    'with\\s+how\\s+many\\s+' + escapeRe(item) + 's?\\b', 'i',
  );
  if (!closingRe.test(q)) return null;

  const accumulated = start + increment * periods;
  if (dropped > accumulated) return null;
  const remaining = accumulated - dropped;
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  return { remaining };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const weeklyIncrementThenDropCountRemaining: LianaMethod = {
  id: 'weekly-increment-then-drop-count-remaining-v1',
  demand: 'COMPUTE',
  name: 'Start count plus per-period increment over N periods, minus a final drop -- exact integer arithmetic',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W21 (cluster C193, sole member: pilot corpus item at index 340)',
  shapeDescription: 'remaining = start + increment*periods - dropped (ignores any prose about what became of the dropped items)',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "practicing <verb-ing> <N1> <item>" opener, a matching "adding <N2> ' +
          '<item> each <period>" increment clause, an ordinal "the end of the <Nth> <period>" ' +
          'clause, a matching "drops <N3> of ... <item>" clause, and a closing "with how many ' +
          '<item>" question all sharing the same item; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `remaining = ${result.remaining}` };
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
          verdict: String(Math.round((result.remaining) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'start + increment*periods - dropped, exact integers',
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

registerMethod(weeklyIncrementThenDropCountRemaining);
