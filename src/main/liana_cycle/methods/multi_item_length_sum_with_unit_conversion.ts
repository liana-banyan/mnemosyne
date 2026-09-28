// D-BP223-BM04-h2cbpv9w-170 -- multi-item-length-sum-with-unit-conversion-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\multi-item-length-sum-with-unit-conversion-v1.candidate.ts
// Authored by generation wave W06 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W06.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C72 (1 member, sole member
 * harvest_gsm8k_pilot_item155_unit_conversion_and_addition). Representative teaching case:
 * GSM8K test.jsonl line 155 (Bill's rolls, croissants and baguettes laid end to end).
 *
 * @generalShape A first sentence lists N item TYPES with their QUANTITIES ("Q1 typeA, Q2 typeB,
 *   and Q3 typeC"). A second sentence gives each type's PER-UNIT LENGTH ("each typeA is L1
 *   inches/feet long"). The items are combined end to end; the target is the TOTAL length in
 *   feet, so every per-unit length must be converted to feet before multiplying by its quantity
 *   and summing.
 *
 * @recogniseInStranger Cut the text at the interrogative. Take the FIRST sentence as the quantity
 *   list: split on commas/"and", extract (number, trailing noun) per piece after stripping a
 *   trailing cadence phrase ("every day"/"per day"/"each day"). Take the SECOND sentence as the
 *   length list: match every "each <noun> is <value> (inches|feet|foot) long" occurrence,
 *   accepting both digit and small number-word values. Match quantity nouns to length nouns by
 *   singularised last word. Fire only when the two lists have the same count (>=2) and every
 *   quantity noun found a length match, and the text contains "end to end" (the cue that these
 *   lengths combine additively along one line, not independently).
 *
 * @whatBreaksIt (a) a length list that does not cover every quantity noun (a stranger phrasing
 *   this method has not been shown); (b) a length unit other than inches/feet/foot; (c) no
 *   "end to end" cue -- without it, a bare list of item quantities and per-unit lengths could mean
 *   something other than "lay them all in a line", and this candidate abstains rather than guess.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (mismatched noun counts, an unmapped noun, no "end to end" cue, a non-finite total)
 *   makes the method ABSTAIN: verdict null, abstain true. Gate 1 (own generating question, GSM8K
 *   line 155): SOLVED, verdict 280, matching the corpus's own "#### 280".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'multi-item-length-sum-with-unit-conversion-v1';

const NUM_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];
const WORD_TO_NUM: Record<string, number> = {};
NUM_WORDS.forEach((w, i) => { WORD_TO_NUM[w] = i; });

function parseNum(tok: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(tok)) return parseFloat(tok);
  const v = WORD_TO_NUM[tok.toLowerCase()];
  return v === undefined ? null : v;
}

function singular(w: string): string {
  return w.replace(/s$/, '');
}

const TRAILING_CADENCE = /\s+(every|per|each)\s+\w+\s*$/i;
const LEN_RE = /each\s+([a-z]+)\s+is\s+([a-z0-9]+)\s+(inches?|feet|foot)\s+long/gi;

interface QtyItem { noun: string; qty: number }
interface LenItem { noun: string; value: number; unit: string }

interface Analyzed {
  totalFeet: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (!/end to end/i.test(q)) return null;

  const interrogative = /how (long|many|much)/i;
  const im = interrogative.exec(q);
  const body = im ? q.slice(0, im.index) : q;
  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 2) return null;

  const qtySentence = sentences[0].replace(/\.$/, '');
  const pieces = qtySentence.split(/,\s*(?:and\s+)?|\s+and\s+/i);
  const qtys: QtyItem[] = [];
  for (let p of pieces) {
    p = p.trim().replace(TRAILING_CADENCE, '');
    const m = /(\d+)\s+([a-z]+(?:\s+[a-z]+)?)\s*$/i.exec(p);
    if (m) {
      const lastWord = m[2].trim().split(/\s+/).pop() as string;
      qtys.push({ noun: lastWord, qty: parseInt(m[1], 10) });
    }
  }
  if (qtys.length < 2) return null;

  const lenSentence = sentences[1];
  const lens: LenItem[] = [];
  let m2: RegExpExecArray | null;
  LEN_RE.lastIndex = 0;
  while ((m2 = LEN_RE.exec(lenSentence))) {
    const value = parseNum(m2[2]);
    if (value === null) return null;
    lens.push({ noun: m2[1], value, unit: m2[3] });
  }
  if (lens.length !== qtys.length) return null;

  let totalFeet = 0;
  for (const item of qtys) {
    const key = singular(item.noun);
    const match = lens.find((l) => singular(l.noun) === key);
    if (!match) return null; // an unmapped noun -- a stranger shape, abstain
    const feet = /inch/i.test(match.unit) ? match.value / 12 : match.value;
    totalFeet += item.qty * feet;
  }
  if (!Number.isFinite(totalFeet)) return null;

  return { totalFeet };
}

export const multiItemLengthSumWithUnitConversion: LianaMethod = {
  id: 'multi-item-length-sum-with-unit-conversion-v1',
  demand: 'COMPUTE',
  name: 'Multiple item types, per-unit lengths converted to feet, laid end to end and summed',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (cluster C72, representative harvest_gsm8k_pilot_item155)',
  shapeDescription:
    'A quantity list and a matching per-unit-length list (inches or feet) for the same item ' +
    'types, combined "end to end": convert every length to feet, multiply by its own quantity, ' +
    'sum across all types.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching quantity list and per-unit-length list (same item count, ' +
          'every noun mapped) plus the "end to end" combination cue; abstaining rather than ' +
          'guessing',
      };
    }
    return { matches: true, reason: `totalFeet=${result.totalFeet}` };
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
            verdict: String(Math.round((result.totalFeet) * 100) / 100),
            abstain: false,
            freeText,
            method: METHOD_ID,
            basis: `sum of (quantity * length-in-feet) across all item types = ${result.totalFeet}`,
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

registerMethod(multiItemLengthSumWithUnitConversion);
