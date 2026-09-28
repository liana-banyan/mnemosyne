// D-BP223-BM04-h2cbpv9w-170 -- chained-additive-offset-three-terms-sum-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R01 (registration
// batch drawn from generation wave W02).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\chained-additive-offset-three-terms-sum-v1.candidate.ts
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W02, CLUSTER C44 (1 silo member, high confidence, singleton).
 * Silo shape label: CHAINED_ADDITIVE_OFFSET_THEN_SUM_THREE_TERMS (each term = previous + a stated
 * difference, chained across 3 terms, then summed). Source:
 * methods.harvest_gsm8k_pilot_item264_multi_step_addition. Representative teaching case, GSM8K
 * test.jsonl lineIndex 264 (Carmen/Samantha/Daisy): "Carmen has $100, Samantha has $25 more than
 * Carmen, and Daisy has $50 more than Samantha. How much do all three girls have combined?"
 *
 * @generalShape A first named person's amount is given directly. A second person's amount is
 *   stated as a delta "more/less than" the FIRST person. A third person's amount is stated as a
 *   delta "more/less than" the SECOND person -- never the first -- so the chain is genuinely
 *   sequential (A -> B -> C), not two independent offsets from the same base. The answer is the
 *   sum of all three derived amounts.
 *
 * @recogniseInStranger Requires exactly three "<Name> has $<amount>[ more|less than <PrevName>]"
 *   clauses joined in one sentence. The first clause carries no "more/less than" qualifier (the
 *   base). Each subsequent clause's "than <Name>" must reference the name introduced by the
 *   IMMEDIATELY PRECEDING clause -- this is the positive-evidence chain check: a clause whose
 *   reference points back to the base instead of its immediate predecessor is a DIFFERENT shape
 *   (two parallel offsets from one base) that this candidate does not attempt. The question must
 *   ask for the combined/total/altogether amount of all three.
 *
 * @whatBreaksIt Any count of people other than exactly three; a "more/less than" reference that
 *   skips the immediate predecessor (parallel-offset shape, not this chained one); a currency or
 *   unit mismatch is not checked for since all three clauses share one `$` marker by construction
 *   of the regex; a question asking for fewer than all three people's total, or asking for a
 *   pairwise difference instead of a sum -- abstains rather than guessing which subset is wanted.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (100 base, +25=125, +50=175, sum=400). With only
 *   one known member there is no cross-member measurement to report for this cluster.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';


const METHOD_ID = 'chained-additive-offset-three-terms-sum-v1';

const BASE_RE = /([A-Z][a-zA-Z]*)\s+has\s*\$(\d+(?:\.\d+)?)\b(?!\s*(?:more|less)\s+than)/;
const DELTA_RE = /([A-Z][a-zA-Z]*)\s+has\s*\$(\d+(?:\.\d+)?)\s+(more|less)\s+than\s+([A-Z][a-zA-Z]*)\b/g;
const QUESTION_RE = /combined\b|\bin\s+total\b|altogether\b|\btotal\b/i;

interface Analyzed {
  total: number;
  parts: string[];
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (!QUESTION_RE.test(q)) return null;

  const base = BASE_RE.exec(q);
  if (!base) return null;
  const amounts: Record<string, number> = {};
  const chainOrder: string[] = [base[1]];
  amounts[base[1]] = parseFloat(base[2]);

  const deltas: { name: string; amount: number; dir: string; ref: string }[] = [];
  let m: RegExpExecArray | null;
  DELTA_RE.lastIndex = 0;
  while ((m = DELTA_RE.exec(q)) !== null) {
    deltas.push({ name: m[1], amount: parseFloat(m[2]), dir: m[3].toLowerCase(), ref: m[4] });
  }
  // Exactly two delta clauses required (three people total: base + two chained deltas).
  if (deltas.length !== 2) return null;

  for (const d of deltas) {
    // POSITIVE-EVIDENCE CHAIN CHECK: this clause's reference must be the name introduced by the
    // IMMEDIATELY PRECEDING clause, never an earlier one -- proof of a genuine chain, not two
    // independent offsets from the same base.
    const prevName = chainOrder[chainOrder.length - 1];
    if (d.ref !== prevName) return null;
    if (Object.prototype.hasOwnProperty.call(amounts, d.name)) return null; // no repeated name
    amounts[d.name] = d.dir === 'more' ? amounts[prevName] + d.amount : amounts[prevName] - d.amount;
    if (amounts[d.name] < 0) return null;
    chainOrder.push(d.name);
  }

  if (chainOrder.length !== 3) return null;
  const total = chainOrder.reduce((acc, n) => acc + amounts[n], 0);
  if (!Number.isFinite(total) || total < 0) return null;
  return {
    total,
    parts: chainOrder.map((n) => `${n}=${amounts[n]}`),
  };
}


export const chainedAdditiveOffsetThreeTermsSumMethod: LianaMethod = {
  id: 'chained-additive-offset-three-terms-sum-v1',
  demand: 'COMPUTE',
  name: 'Chain three additive-offset terms (each anchored to its immediate predecessor), then sum',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W02 (cluster C44, sole member harvest_gsm8k_pilot_item264)',
  shapeDescription:
    'A base amount, then two "more/less than <predecessor>" chained offset clauses (each ' +
    'referencing the immediately preceding term, never the base), summed across all three.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find a base amount plus two chained "more/less than <immediate predecessor>" clauses',
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
        basis: result.parts.join(', ') + ` sum=${result.total}`,
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
registerMethod(chainedAdditiveOffsetThreeTermsSumMethod);
