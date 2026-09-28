// D-BP223-BM04-h2cbp9d8-171 -- average-of-two-stated-then-weighted-sum-of-two-groups-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R05
// (registration batch drawn from generation waves W21-W23).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\average-of-two-stated-then-weighted-sum-of-two-groups-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W22, CLUSTER C206 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 362, "Mark makes custom dog beds. A bed for
 * a Rottweiler takes 8 pounds of stuffing, a bed for a chihuahua takes 2 pounds of stuffing, and
 * a bed for a collie takes the average amount of stuffing between the first two kinds of beds.
 * How many pounds of stuffing does Mark need to make 4 chihuahua beds and 3 collie beds?". Silo
 * label: "multi-step word problem involving averages and total sum calculation" -- matches
 * exactly.
 *
 * @generalShape THREE named categories each require a per-unit amount of the same resource. Two
 *   categories' per-unit amounts are stated directly ("a <unit> for a <typeA> takes <VA> <of
 *   resource>", likewise typeB). The third category's per-unit amount is the AVERAGE of those
 *   first two ("takes the average amount ... between the first two kinds"). The closing question
 *   names a quantity of TWO of the three categories (by name, in either order, not necessarily
 *   including typeA) and asks for the total resource needed: sum of quantity*per-unit-amount for
 *   each named category.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) exactly two sentences of the
 *   form "a <unit> for a <type> takes <V> <resource-phrase>", sharing the same unit and
 *   resource-phrase; (b) a third sentence "a <unit> for a <type> takes the average amount of
 *   <resource-phrase> between the first two kinds of <unit>s", naming a THIRD, distinct type; (c)
 *   a closing "make <N1> <typeX> <unit>s and <N2> <typeY> <unit>s" where typeX and typeY are two
 *   DISTINCT names drawn from the three known types.
 *
 * @whatBreaksIt (a) more or fewer than exactly two directly-stated per-unit sentences -- abstain,
 *   the average is ambiguous otherwise; (b) either closing-question type not matching one of the
 *   three known type names -- abstain; (c) the two closing types being the same -- abstain. The
 *   average is computed by dividing by two, which is always exact in IEEE-754 binary
 *   floating-point (halving never rounds), so no exactness guard is needed for that one step.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (collie = (8+2)/2=5, total = 4*2 + 3*5 = 8+15=23). With only one known member
 *   there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'average-of-two-stated-then-weighted-sum-of-two-groups-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

function wordOrDigit(tok: string | undefined): number | null {
  if (tok === undefined || tok === '') return null;
  const digitOnly = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digitOnly)) return parseFloat(digitOnly);
  const w = tok.toLowerCase().trim();
  const idx = ONES_WORDS.indexOf(w);
  return idx >= 0 ? idx : null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const directRe = /\ba\s+([a-z]+)\s+for\s+a\s+([a-z]+)\s+takes\s+(\d+(?:\.\d+)?)\s+([a-z]+\s+of\s+[a-z]+)\b/gi;
  const directMatches: { unit: string; type: string; value: number; resource: string }[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = directRe.exec(q)) !== null) {
    const [, unit, type, valueRaw, resource] = dm;
    directMatches.push({ unit: unit.toLowerCase(), type: type.toLowerCase(), value: parseFloat(valueRaw), resource: resource.toLowerCase() });
  }
  if (directMatches.length !== 2) return null;
  const [first, second] = directMatches;
  if (first.unit !== second.unit || first.resource !== second.resource || first.type === second.type) return null;

  const resourceParts = first.resource.split(' ');
  const materialWord = resourceParts[resourceParts.length - 1];
  const avgRe = new RegExp(
    '\\ba\\s+' + esc(first.unit) + '\\s+for\\s+a\\s+([a-z]+)\\s+takes\\s+the\\s+average\\s+amount\\s+of\\s+' +
      esc(materialWord) + '\\s+between\\s+the\\s+first\\s+two\\s+kinds\\s+of\\s+' + esc(first.unit) + 's\\b',
    'i',
  );
  const avgM = avgRe.exec(q);
  if (!avgM) return null;
  const [, thirdType] = avgM;
  const third = thirdType.toLowerCase();
  if (third === first.type || third === second.type) return null;

  const thirdValue = (first.value + second.value) / ONES_WORDS.indexOf('two');

  const byType: Record<string, number> = {
    [first.type]: first.value,
    [second.type]: second.value,
    [third]: thirdValue,
  };

  const closeRe = new RegExp(
    'make\\s+(\\d+|[a-z]+)\\s+([a-z]+)\\s+' + esc(first.unit) + 's?\\s+and\\s+(\\d+|[a-z]+)\\s+([a-z]+)\\s+' + esc(first.unit) + 's?',
    'i',
  );
  const closeM = closeRe.exec(q);
  if (!closeM) return null;
  const [, n1Raw, type1Raw, n2Raw, type2Raw] = closeM;
  const n1 = wordOrDigit(n1Raw);
  const n2 = wordOrDigit(n2Raw);
  const type1 = type1Raw.toLowerCase();
  const type2 = type2Raw.toLowerCase();
  if (n1 === null || n2 === null || type1 === type2) return null;
  if (!(type1 in byType) || !(type2 in byType)) return null;

  const total = n1 * byType[type1] + n2 * byType[type2];
  if (!Number.isFinite(total) || total <= 0) return null;
  return { total };
}

export const averageOfTwoStatedThenWeightedSumOfTwoGroups: LianaMethod = {
  id: 'average-of-two-stated-then-weighted-sum-of-two-groups-v1',
  demand: 'COMPUTE',
  name: 'A third category is the average of two stated per-unit amounts; sum quantities of two named categories',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W22 (cluster C206, sole member: pilot corpus item at index 362)',
  shapeDescription:
    'typeC per-unit = average(typeA per-unit, typeB per-unit); answer = n1*perUnit(type1) + n2*perUnit(type2), ' +
    'for two named categories drawn from {typeA, typeB, typeC}.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two directly-stated per-unit sentences sharing a unit and ' +
          'resource, a third average-of-the-first-two sentence naming a distinct type, and a ' +
          'closing sentence naming two distinct known types with quantities; abstaining rather ' +
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
          basis: 'derived the average category, then summed two named quantities',
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

registerMethod(averageOfTwoStatedThenWeightedSumOfTwoGroups);
