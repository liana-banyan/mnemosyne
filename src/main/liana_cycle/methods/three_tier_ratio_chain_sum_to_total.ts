// D-BP223-BM04-h2cbpv9w-170 -- three-tier-ratio-chain-sum-to-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W05).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-tier-ratio-chain-sum-to-total-v1.candidate.ts
// Authored by generation wave W05 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W05.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W05 CLUSTER C66 (1 silo member, singleton). Representative
 * teaching case: GSM8K test.jsonl item141, "There are 700 bees in a hive. There are twice as many
 * worker bees as baby bees, and there are twice as many babies as queens. How many worker bees
 * are there?".
 *
 * @generalShape A total population is given directly. Three ranked sub-categories of that
 *   population are chained by two "<multiplier> as many A as B" relations (A expressed as a
 *   multiple of B), so that all three categories are expressible as a multiple of the SAME base
 *   (unranked) category. The total equals the sum of the three categories. The base category is
 *   solved by dividing the total by the sum of coefficients, then the specifically-asked category
 *   is reported.
 *
 * @recogniseInStranger Finds exactly two "<multiplier> as many <A> as <B>" relations (multiplier
 *   as a digit, "twice"(=2), "thrice"(=3), or "<word> times") and a "there are <N> <unit>" total
 *   sentence. Categories are matched across relations and against the question's own noun by a
 *   simple STEM (lowercase, strip a trailing "s"/"es", and "ies"->"y") of each noun phrase's FIRST
 *   word, so "worker bees"/"workers", "baby bees"/"babies", and "queens"/"queen bees" are treated
 *   as the same category across their different surface forms. The two relations must chain (one
 *   relation's B is the other relation's A) so exactly three distinct category stems exist, one of
 *   them the free (base) variable.
 *
 * @whatBreaksIt (a) the two relations do not chain into exactly three distinct category stems --
 *   abstains, this is not the linear 3-tier shape; (b) the total does not evenly divide by the sum
 *   of the three coefficients -- abstains rather than report a non-integer population; (c) the
 *   question does not name (by stem) one of the three known categories -- abstains, does not know
 *   which value to report; (d) a stranger relation phrased "one and a half times" (a fraction, not
 *   an integer multiplier) is not parsed by this candidate's word list -- flagged rather than
 *   hidden.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own sole cluster member: SOLVED (400). With only one known member there is no
 *   cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-tier-ratio-chain-sum-to-total-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const SPECIAL_MULTIPLIERS: Record<string, number> = { twice: 2, thrice: 2 + 1 };

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (/^\d+(?:\.\d+)?$/.test(digit)) return Number(digit);
  const w = tok.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

function stem(nounPhrase: string): string {
  const first = nounPhrase.trim().toLowerCase().split(/\s+/)[0] || '';
  if (first.endsWith('ies')) return first.slice(0, -3) + 'y';
  if (first.endsWith('es')) return first.slice(0, -2);
  if (first.endsWith('s')) return first.slice(0, -1);
  return first;
}

interface Relation {
  multiplier: number;
  aStem: string;
  aPhrase: string;
  bStem: string;
}

function parseRelations(q: string): Relation[] {
  const rels: Relation[] = [];
  // "twice as many A as B" / "thrice as many A as B"
  const specialRe = /(twice|thrice)\s+as\s+many\s+([a-z]+(?:\s[a-z]+)?)\s+as\s+([a-z]+(?:\s[a-z]+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = specialRe.exec(q)) !== null) {
    const mult = SPECIAL_MULTIPLIERS[m[1].toLowerCase()];
    rels.push({ multiplier: mult, aStem: stem(m[2]), aPhrase: m[2], bStem: stem(m[3]) });
  }
  // "<number/word> times as many A as B"
  const numRe = /([a-z0-9]+)\s+times\s+as\s+many\s+([a-z]+(?:\s[a-z]+)?)\s+as\s+([a-z]+(?:\s[a-z]+)?)/gi;
  while ((m = numRe.exec(q)) !== null) {
    const mult = wordOrDigit(m[1]);
    if (mult === null) continue;
    rels.push({ multiplier: mult, aStem: stem(m[2]), aPhrase: m[2], bStem: stem(m[3]) });
  }
  return rels;
}

interface Analyzed {
  askedStem: string;
  answer: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const totalMatch = /there\s+are\s+([a-z0-9]+)\s+[a-z]+\s+in\s+(?:the|a)\s+[a-z]+/i.exec(q);
  if (!totalMatch) return null;
  const total = wordOrDigit(totalMatch[1]);
  if (total === null || total <= 0) return null;

  const rels = parseRelations(q);
  if (rels.length !== 2) return null;
  const [r1, r2] = rels;
  // Chain: one relation's B must equal the other's A (by stem), giving exactly 3 distinct stems.
  let top: Relation, mid: Relation;
  if (r1.bStem === r2.aStem) { top = r1; mid = r2; }
  else if (r2.bStem === r1.aStem) { top = r2; mid = r1; }
  else return null;
  const topStem = top.aStem;      // e.g. worker  (coefficient = top.multiplier * mid.multiplier)
  const midStem = mid.aStem;      // e.g. baby    (coefficient = mid.multiplier)
  const baseStem = mid.bStem;     // e.g. queen   (coefficient = 1, free variable)
  if (topStem === midStem || midStem === baseStem || topStem === baseStem) return null;

  const topCoeff = top.multiplier * mid.multiplier;
  const midCoeff = mid.multiplier;
  const baseCoeff = 1;
  const coeffSum = topCoeff + midCoeff + baseCoeff;
  if (coeffSum <= 0 || total % coeffSum !== 0) return null; // must divide evenly -- integer population
  const baseValue = total / coeffSum;

  const coeffByStem: Record<string, number> = {
    [topStem]: topCoeff,
    [midStem]: midCoeff,
    [baseStem]: baseCoeff,
  };

  const askMatch = /how\s+many\s+([a-z]+(?:\s[a-z]+)?)\s+are\s+there/i.exec(q);
  if (!askMatch) return null;
  const askedStem = stem(askMatch[1]);
  if (!Object.prototype.hasOwnProperty.call(coeffByStem, askedStem)) return null;

  const answer = coeffByStem[askedStem] * baseValue;
  return { askedStem, answer };
}

export const threeTierRatioChainSumToTotal: LianaMethod = {
  id: 'three-tier-ratio-chain-sum-to-total-v1',
  demand: 'COMPUTE',
  name: 'Three ranked categories chained by two multiplier relations, summing to a known total',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W05 (cluster C66, sole member harvest_gsm8k_pilot_item141)',
  shapeDescription:
    'Two "<multiplier> as many A as B" relations chain three categories to one free base variable; ' +
    'the given total equals the sum of all three; solve the base then report the asked category.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a "there are N <unit> in the <place>" total, exactly two chaining ' +
          '"<multiplier> as many A as B" relations spanning exactly three category stems, and a ' +
          '"how many <category> are there" question naming one of them',
      };
    }
    return { matches: true, reason: `askedStem=${result.askedStem} answer=${result.answer}` };
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
        basis: 'total / coeffSum, then coeff[asked] * base',
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

registerMethod(threeTierRatioChainSumToTotal);
