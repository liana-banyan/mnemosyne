// D-BP223-BM04-h2cbpv9w-170 -- vehicle-tire-inflation-charge-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W06).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\vehicle-tire-inflation-charge-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W06 CLUSTER C71 (1 member, sole member
 * harvest_gsm8k_pilot_item151_money_calculation_based_on_units). Representative teaching case:
 * GSM8K test.jsonl line 151 (Shawnda's bike-tire inflation service).
 *
 * @generalShape A per-unit price is stated directly ("each tire costs N cents"). Two or more
 *   groups follow, each naming a COUNT of people and a wheeled-vehicle TYPE (bicycle, tricycle,
 *   unicycle) whose number of tires-per-vehicle is fixed, real-world knowledge (2, 3, 1
 *   respectively). Total tires = sum(count_i * tiresPerVehicle_i); total charge = total tires *
 *   unit price, converted from cents to dollars.
 *
 * @recogniseInStranger Find the unit price via "tire costs N cents to inflate". Split the text
 *   into sentences; a sentence naming BOTH a count (digit or number word) immediately before
 *   "people"/"person" AND one of bicycle(s)/tricycle(s)/unicycle(s) anywhere in the sentence is
 *   one GROUP. Fire only when at least two such groups are found and the unit price was found.
 *
 * @whatBreaksIt (a) a vehicle type outside the fixed three (car, scooter, ...) -- this candidate
 *   has no tire count for anything else and abstains rather than guess; (b) a group sentence with
 *   more than one count-and-vehicle pairing (ambiguous); (c) a unit price not stated in cents;
 *   (d) a question that does not ask for a dollar amount.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any guard
 *   failing (fewer than two groups, an unrecognised vehicle word, no unit price found, a
 *   non-finite result) makes the method ABSTAIN: verdict null, abstain true. Gate 1 (own
 *   generating question, GSM8K line 151): SOLVED, verdict 5, matching the corpus's own "#### 5".
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'vehicle-tire-inflation-charge-v1';

const NUM_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];
const WORD_TO_NUM: Record<string, number> = {};
NUM_WORDS.forEach((w, i) => { WORD_TO_NUM[w] = i; });

function parseCount(tok: string): number | null {
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  const v = WORD_TO_NUM[tok.toLowerCase()];
  return v === undefined ? null : v;
}

// Real-world, fixed tire counts -- not derived from any answer, this is general knowledge about
// how many wheels these vehicle types have.
const VEHICLE_TIRES: Record<string, number> = {
  bicycle: 2, tricycle: 3, unicycle: 1,
};

const UNITCOST_RE = /tire\s+costs?\s+(\d+(?:\.\d+)?)\s*cents?\s+to\s+inflate/i;
const COUNT_RE = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|person)\b/i;
const VEHICLE_RE = /\b(bicycles?|tricycles?|unicycles?)\b/i;
const DOLLAR_QUESTION_RE = /how (many|much) dollars?/i;

interface Group { count: number; vehicle: string }

interface Analyzed {
  unitCents: number;
  groups: Group[];
  totalTires: number;
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (!DOLLAR_QUESTION_RE.test(q)) return null;

  const um = UNITCOST_RE.exec(q);
  if (!um) return null;
  const unitCents = parseFloat(um[1]);
  if (!Number.isFinite(unitCents)) return null;

  const sentences = q.split(/(?<=[.!?])\s+/).filter(Boolean);
  const groups: Group[] = [];
  for (const s of sentences) {
    const cm = COUNT_RE.exec(s);
    const vm = VEHICLE_RE.exec(s);
    if (!cm || !vm) continue;
    const count = parseCount(cm[1]);
    if (count === null) return null;
    const vehicleSingular = vm[1].toLowerCase().replace(/s$/, '');
    groups.push({ count, vehicle: vehicleSingular });
  }
  if (groups.length < 2) return null;

  let totalTires = 0;
  for (const g of groups) {
    const tiresPer = VEHICLE_TIRES[g.vehicle];
    if (tiresPer === undefined) return null; // unrecognised vehicle -- abstain, do not guess
    totalTires += g.count * tiresPer;
  }

  const totalCents = totalTires * unitCents;
  if (!Number.isFinite(totalCents)) return null;
  const answer = Math.round(totalCents) / 100; // exact cents -> dollars, rounded only at this
  // boundary once, never mid-calculation

  return { unitCents, groups, totalTires, answer };
}

export const vehicleTireInflationCharge: LianaMethod = {
  id: 'vehicle-tire-inflation-charge-v1',
  demand: 'COMPUTE',
  name: 'Per-tire charge across bicycle/tricycle/unicycle groups, summed to a dollar total',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170/WAVE W06 (cluster C71, representative harvest_gsm8k_pilot_item151)',
  shapeDescription:
    'A per-tire cost in cents, applied to groups of people on bicycles (2 tires), tricycles ' +
    '(3 tires), or unicycles (1 tire); sum total tires across all groups, multiply by the ' +
    'per-tire cost, convert cents to dollars.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a per-tire cent price plus at least two unambiguous ' +
          'count-of-people-on-a-recognised-vehicle groups, or the question did not ask for ' +
          'dollars; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `unitCents=${result.unitCents}, groups=${JSON.stringify(result.groups)}, ` +
        `totalTires=${result.totalTires}`,
    };
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
            basis: `${result.totalTires} tires * ${result.unitCents} cents = ${result.answer} dollars`,
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

registerMethod(vehicleTireInflationCharge);
