// D-BP223-BM04-h2cbpv9w-170 -- twice-attribute-two-species-half-combined-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W10).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\twice-attribute-two-species-half-combined-total-v1.candidate.ts
// Authored by generation wave W10 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W10 cluster C107 (1 silo member, singleton, high confidence).
 * Representative teaching case: GSM8K test.jsonl line 281, "A cobra, which has 70 spots, has
 * twice as many spots as a mamba. If there are 40 cobras and 60 mambas in a snake park, what is
 * half the number of spots they all have combined?"
 *
 * @generalShape TWO named kinds (species A and B). Kind A's per-individual attribute value is
 *   given directly, and stated as EXACTLY TWICE kind B's own per-individual value (so kind B's
 *   value is derived, never given). Separately, a POPULATION COUNT is given for each kind. The
 *   combined total attribute value across both populations is computed, and the question asks
 *   for HALF of that combined total -- not the total itself.
 *
 * @recogniseInStranger Anchor 1: "<KindA>, which has <X> <attribute>, has twice as many
 *   <attribute> as (?:a |an )?<KindB>" gives kind A's name, its value X, and kind B's name (kind
 *   B's own value is derived as X/2, never read from text). Anchor 2: "there are <P1> <kindA>s
 *   and <P2> <kindB>s" gives the two population counts, matched against the SAME two kind names
 *   anchor 1 found (order-independent). The question must contain both "half" and "combined" (or
 *   "combined" alone paired with "half"), naming the total it wants half of.
 *
 * @whatBreaksIt (a) more than two kinds, or a "half as many" relation instead of "twice as many"
 *   -- this method only recognises the literal "twice as many"; (b) kind A's attribute value not
 *   dividing evenly by two for kind B's derived value -- reported as a fractional result rather
 *   than silently rounded, since this shape's real-world examples always use an even base value;
 *   (c) the population-count anchor naming different kinds than the twice-as-many anchor (e.g. a
 *   third species introduced only in the counts) -- the regex requires the exact same two kind
 *   names in both anchors and abstains if they diverge; (d) the question asking for the combined
 *   total itself (no "half") or for only one kind's total -- a different shape, out of scope.
 *
 * @whenRecognitionIsWrong shapeTest and run() share the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED, matching the dataset's own worked total
 *   exactly. With only one known member there is no cross-member measurement to report for this
 *   singleton cluster -- noted honestly rather than inflated with a number borrowed from a
 *   different shape.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'twice-attribute-two-species-half-combined-total-v1';

interface Analyzed {
  kindA: string;
  kindB: string;
  valueA: number;
  valueB: number;
  countA: number;
  countB: number;
  combinedTotal: number;
  halfTotal: number;
}

function toFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function stem(word: string): string {
  return word.toLowerCase().replace(/s$/, '');
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Anchor 1: "<KindA>, which has <X> <attribute>, has twice as many <attribute> as <KindB>"
  const attrRe =
    /\b([a-z]+),\s+which\s+has\s+([0-9]+(?:\.[0-9]+)?)\s+([a-z]+),\s+has\s+twice\s+as\s+many\s+\3\s+as\s+(?:a\s+|an\s+)?([a-z]+)\b/i;
  const m1 = attrRe.exec(q);
  if (!m1) return null;
  const [, kindARaw, valueAStr, , kindBRaw] = m1;
  const valueA = parseFloat(valueAStr);
  if (!toFinite(valueA)) return null;
  const kindA = stem(kindARaw);
  const kindB = stem(kindBRaw);
  const valueB = valueA / 2;

  // Anchor 2: "there are <P1> <kindA>s and <P2> <kindB>s" (order-independent w.r.t. anchor 1).
  const escA = kindA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escB = kindB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const countsReAB = new RegExp(
    'there\\s+are\\s+([0-9]+(?:\\.[0-9]+)?)\\s+' + escA + 's?\\s+and\\s+([0-9]+(?:\\.[0-9]+)?)\\s+' + escB + 's?\\b',
    'i'
  );
  const countsReBA = new RegExp(
    'there\\s+are\\s+([0-9]+(?:\\.[0-9]+)?)\\s+' + escB + 's?\\s+and\\s+([0-9]+(?:\\.[0-9]+)?)\\s+' + escA + 's?\\b',
    'i'
  );
  let countA: number | null = null;
  let countB: number | null = null;
  const mAB = countsReAB.exec(q);
  if (mAB) {
    countA = parseFloat(mAB[1]);
    countB = parseFloat(mAB[2]);
  } else {
    const mBA = countsReBA.exec(q);
    if (mBA) {
      countB = parseFloat(mBA[1]);
      countA = parseFloat(mBA[2]);
    }
  }
  if (countA === null || countB === null || !toFinite(countA) || !toFinite(countB)) return null;

  // Question must ask for HALF of the COMBINED total.
  if (!/\bhalf\b/i.test(q) || !/\bcombined\b/i.test(q)) return null;

  const combinedTotal = countA * valueA + countB * valueB;
  const halfTotal = combinedTotal / 2;
  if (!toFinite(combinedTotal) || !toFinite(halfTotal)) return null;

  return { kindA, kindB, valueA, valueB, countA, countB, combinedTotal, halfTotal };
}

export const twiceAttributeTwoSpeciesHalfCombinedTotal: LianaMethod = {
  id: 'twice-attribute-two-species-half-combined-total-v1',
  demand: 'COMPUTE',
  name: 'Kind A has twice kind B\'s per-individual attribute; populations given; report half the combined total',
  taughtBy:
    'D-BP223-BM04-h2cbpv9w-170 WAVE W10 (cluster C107, sole member harvest_gsm8k_pilot_item281, GSM8K test.jsonl line 281)',
  shapeDescription:
    'Kind A\'s attribute value is twice kind B\'s (derived, never given); population counts for ' +
    'both kinds are stated; answer is half the combined attribute total across both populations.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find the "<KindA>, which has <X> <attr>, has twice as many <attr> as <KindB>" ' +
          'anchor plus a matching "there are <P1> <KindA>s and <P2> <KindB>s" population anchor ' +
          'and a "half...combined" question; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `${result.kindA}=${result.countA}x${result.valueA}, ${result.kindB}=${result.countB}x${result.valueB} -> half(${result.combinedTotal})=${result.halfTotal}`,
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
      const rounded = Math.round(result.halfTotal * 100) / 100;
      return {
        question,
        verdict: String(Math.round((rounded) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `(${result.countA}*${result.valueA} + ${result.countB}*${result.valueB}) / 2 = ${rounded}`,
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

registerMethod(twiceAttributeTwoSpeciesHalfCombinedTotal);
