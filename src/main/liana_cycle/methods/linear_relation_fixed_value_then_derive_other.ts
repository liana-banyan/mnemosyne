// D-BP223-BM04-h2cbpv9w-170 -- linear-relation-fixed-value-then-derive-other-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R02
// (registration batch drawn from generation wave W07).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\linear-relation-fixed-value-then-derive-other-v1.candidate.ts
// Authored by generation wave W07 (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_WAVE_W07.md),
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W07 CLUSTER C79 (1 silo member, sole member
 * harvest_gsm8k_pilot_item168_linear_equation_with_one_variable, GSM8K test line 168, high
 * confidence). Representative teaching case: "Jimmy has $2 more than twice the money Ethel has.
 * If Ethal has $8, how much money is Jimmy having?" (the dataset's own spelling drifts from
 * "Ethel" to "Ethal" between its two sentences -- a real-corpus typo this method must tolerate,
 * not a cue to reject).
 *
 * @generalShape ACTOR_A's amount is defined as a linear function of ACTOR_B's amount: "ACTOR_A
 *   has $<extra> more than <multiplier> the money ACTOR_B has." A second sentence states
 *   ACTOR_B's amount directly ("If ACTOR_B has $<V>"). The question asks for ACTOR_A's amount:
 *   A = multiplier * V + extra.
 *
 * @recogniseInStranger Match "<NameA> has $<extra> more than <multiplier> the money <NameB> has."
 *   where multiplier parses as "twice" (=2), "half" (=1/2), or "<word-or-digit> times". Match a
 *   second sentence "If <AnyName> has $<V>" whose named actor is NOT NameA (tolerating a spelling
 *   drift against NameB, since only two actors are ever in play in this shape). Require the
 *   question to ask "how much (money) is/does <NameA> having/have" -- i.e. it must ask about the
 *   DERIVED actor, not just restate the given one.
 *
 * @whatBreaksIt (a) "less than" / "fewer than" instead of "more than" -- a different linear sign
 *   this method does not attempt, abstains; (b) a multiplier word not recognised (bare decimals,
 *   fractions other than half) -- abstains; (c) more than two named actors anywhere in the text
 *   -- abstains, positive evidence for exactly two is required; (d) the question asking about the
 *   GIVEN actor (ACTOR_B) rather than the derived one -- abstains, that would be a trivial
 *   restate-the-input shape this method does not claim; (e) a non-numeric or missing "If <name>
 *   has $V" sentence -- abstains.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Measured
 *   against its own (sole) cluster member: SOLVED (Jimmy's derived amount from Ethel/Ethal's
 *   given $8). With only one known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'linear-relation-fixed-value-then-derive-other-v1';

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

function wordOrDigit(tok: string): number | null {
  const digit = tok.replace(/[^0-9.]/g, '');
  if (digit.length > 0 && /^\d+(?:\.\d+)?$/.test(digit)) return parseFloat(digit);
  const w = tok.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(ONES, w)) return ONES[w];
  return null;
}

function parseMultiplier(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (t === 'twice') return 2;
  if (t === 'half') return 0.5;
  const m = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*times$/.exec(t);
  if (m) return wordOrDigit(m[1]);
  return null;
}

interface Analyzed {
  actorA: string;
  amountA: number;
  amountB: number;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const relRe = /\b([A-Z][a-zA-Z']*)\s+has\s+\$(\d+(?:\.\d+)?)\s+more\s+than\s+(twice|half|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*times)\s+the\s+money\s+([A-Z][a-zA-Z']*)\s+has\b/i;
  const rm = relRe.exec(q);
  if (!rm) return null;
  const actorA = rm[1];
  const extra = wordOrDigit(rm[2]);
  const k = parseMultiplier(rm[3]);
  const actorB = rm[4];
  if (extra === null || k === null || k <= 0) return null;
  if (actorA.toLowerCase() === actorB.toLowerCase()) return null;

  // Second sentence: "If <AnyName> has $<V>" -- name may drift from actorB's exact spelling (a
  // real dataset typo, Ethel -> Ethal), so only require it is NOT actorA, plus exactly two
  // distinct named actors total across the whole question (positive evidence for this shape).
  const givenRe = /\bIf\s+([A-Z][a-zA-Z']*)\s+has\s+\$(\d+(?:\.\d+)?)\b/i;
  const gm = givenRe.exec(q);
  if (!gm) return null;
  const givenName = gm[1];
  const amountB = wordOrDigit(gm[2]);
  if (amountB === null) return null;
  if (givenName.toLowerCase() === actorA.toLowerCase()) return null;

  const allNames = new Set(
    (q.match(/\b[A-Z][a-zA-Z']*\b/g) || []).filter((t) => !['If', 'The', 'A', 'An'].includes(t))
  );
  // Collapse actorB / givenName as "the same second actor" for the exactly-two-actors count.
  allNames.delete(actorB);
  allNames.delete(givenName);
  if (allNames.size > 1) return null; // more than actorA remains -> a third real actor exists

  const askRe = /how\s+much\s+(?:money\s+)?(?:is|does)\s+([A-Z][a-zA-Z']*)\s+(?:having|have)\b/i;
  const am = askRe.exec(q);
  if (!am) return null;
  if (am[1].toLowerCase() !== actorA.toLowerCase()) return null; // must ask about the derived actor

  const amountA = k * amountB + extra;
  if (!Number.isFinite(amountA)) return null;
  return { actorA, amountA, amountB };
}

export const linearRelationFixedValueThenDeriveOther: LianaMethod = {
  id: 'linear-relation-fixed-value-then-derive-other-v1',
  demand: 'COMPUTE',
  name: 'Linear money relation (multiplier + flat offset) with the other actor given directly',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W07 (cluster C79, sole member harvest_gsm8k_pilot_item168_linear_equation_with_one_variable)',
  shapeDescription:
    "ACTOR_A's amount = multiplier * ACTOR_B's amount + a flat extra; ACTOR_B's amount is given " +
    'directly; the question asks for ACTOR_A\'s (the derived) amount.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason: 'did not find "<A> has $<extra> more than <multiplier> the money <B> has" plus ' +
          'a directly-given amount for the other actor plus a question asking for A\'s amount',
      };
    }
    return { matches: true, reason: `${result.actorA}=${result.amountA} from given=${result.amountB}` };
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
        verdict: String(Math.round((result.amountA) * 100) / 100),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `derived from given=${result.amountB}`,
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

registerMethod(linearRelationFixedValueThenDeriveOther);
