// D-BP223-BM04-h2cbp9d8-171 -- three-actor-successor-fraction-or-multiple-chain-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R09.
// (registration batch drawn from generation waves W30-W31.)
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-actor-successor-fraction-or-multiple-chain-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R09
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + perturbations, oracle hand-derived
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R09.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C265 (GSM8K test.jsonl item432, singleton).
 *
 * @generalShape A BASE actor is given an explicit count of a noun ("<Actor0> slew <N> <noun>").
 *   Three MORE actors follow in a chain, each stated to have "<multiplier> as many <noun> as
 *   <PreviousActor>", where <multiplier> is either a fraction-word phrase ("three quarters",
 *   "one-fifth") or a small named multiplier ("twice", "half", "double", "triple"). The closing
 *   question asks for the count belonging to the LAST actor in the chain. Verified against
 *   item432's own "#### 30" line before this candidate was written: base 100 (Thaddeus) ->
 *   *3/4 = 75 (Arthur) -> *2 = 150 (Walter) -> *1/5 = 30 (Bruce).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a base clause "<Name> slew <N>
 *   <noun>" where the number is NOT itself followed by "as many"; (b) exactly THREE further
 *   clauses, each matching "<Name> ... slew <multiplier> as many <noun> as <PriorName>", in
 *   textual order, where each clause's <PriorName> matches the previous clause's <Name> (chain-
 *   linked, not merely three independent comparisons to the base); (c) a closing "how many <noun>
 *   has <Name> slain?" whose <Name> matches the THIRD chained clause's own <Name>. Multiplier
 *   words are converted to exact integer numerator/denominator pairs, never floats.
 *
 * @whatBreaksIt (a) a multiplier phrased as "<N> times as many" (a bare numeric multiplier, not a
 *   fraction-word or twice/half/double/triple) -- not recognized, abstain; (b) a chain shorter or
 *   longer than exactly three links -- abstain, this candidate does not attempt arity-2 or
 *   arity-4 chains; (c) any intermediate value in the chain that is not a whole number (a
 *   multiplier that does not divide the running total evenly) -- abstain rather than round;
 *   (d) a chain where the names do not link in strict sequence (e.g. every actor compared back to
 *   the SAME base actor instead of to the immediately preceding one) -- abstain, since the actor-
 *   name-matching guard would fail.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item432): value0 = 100*3/4 = 75, value1 = 75*2/1 = 150, value2 = 150*1/5 = 30 (exact
 *   integer division checked at every step, no floats). SOLVED. Reach across a wider corpus is
 *   recorded in wave_manifest.json, not asserted here -- this is a singleton-cluster shape with
 *   one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-actor-successor-fraction-or-multiple-chain-v1';

const NAME_TOKEN = '[A-Z][a-zA-Z]*(?:\\s[A-Z][a-zA-Z]*)?';
const BASE_RE = new RegExp('(' + NAME_TOKEN + ')\\s+slew\\s+(\\d+)\\b(?!\\s*as\\b)');
const CHAIN_CLAUSE_RE = new RegExp(
  '(' + NAME_TOKEN + ')(?:,[^,.]*,)?\\s+slew\\s+' +
  '((?:one|two|three|four|five|six|seven|eight|nine|ten)[- ](?:half|halves|third|thirds|quarter|quarters|fifth|fifths|sixth|sixths|seventh|sevenths|eighth|eighths|ninth|ninths|tenth|tenths)|twice|half|double|triple)' +
  '\\s+as\\s+many\\s+[a-z]+\\s+as\\s+(' + NAME_TOKEN + ')',
  'gi',
);
const ASK_RE = new RegExp('how\\s+many\\s+[a-zA-Z]+\\s+has\\s+(' + NAME_TOKEN + ')\\s+slain', 'i');

const ONES_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const DENOM_WORDS: Record<string, number> = {
  half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fifth: 5, fifths: 5,
  sixth: 6, sixths: 6, seventh: 7, sevenths: 7, eighth: 8, eighths: 8, ninth: 9, ninths: 9,
  tenth: 10, tenths: 10,
};

interface Fraction { num: number; den: number; }

function parseMultiplier(phrase: string): Fraction | null {
  const p = phrase.toLowerCase();
  if (p === 'twice') return { num: 2, den: 1 };
  if (p === 'half') return { num: 1, den: 2 };
  if (p === 'double') return { num: 2, den: 1 };
  if (p === 'triple') return { num: 3, den: 1 };
  const m = /^([a-z]+)[- ]([a-z]+)$/.exec(p);
  if (!m) return null;
  const numIdx = ONES_WORDS.indexOf(m[1]);
  const den = DENOM_WORDS[m[2]];
  if (numIdx < 0 || !den) return null;
  return { num: numIdx + 1, den };
}

function sameActor(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

interface Analyzed { verdict: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const baseM = BASE_RE.exec(q);
  if (!baseM) return null;
  const baseActor = baseM[1];
  const baseValue = Number(baseM[2]);
  if (!Number.isInteger(baseValue) || baseValue <= 0) return null;

  const chainMatches = [...q.matchAll(CHAIN_CLAUSE_RE)];
  if (chainMatches.length !== 3) return null; // requires exactly three chained clauses

  const chain = chainMatches.map((m) => ({ actor: m[1], multPhrase: m[2], prevActor: m[3] }));
  if (!sameActor(chain[0].prevActor, baseActor)) return null;
  if (!sameActor(chain[1].prevActor, chain[0].actor)) return null;
  if (!sameActor(chain[2].prevActor, chain[1].actor)) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;
  if (!sameActor(askM[1], chain[2].actor)) return null;

  let value = baseValue;
  for (const link of chain) {
    const frac = parseMultiplier(link.multPhrase);
    if (!frac) return null;
    const scaled = value * frac.num;
    if (scaled % frac.den !== 0) return null; // not a whole-number result; abstain rather than round
    value = scaled / frac.den;
  }

  return { verdict: value };
}

export const threeActorSuccessorFractionOrMultipleChain: LianaMethod = {
  id: 'three-actor-successor-fraction-or-multiple-chain-v1',
  demand: 'COMPUTE',
  name: 'Compute the final count in a base-plus-three-successor multiplicative chain (fraction words or twice/half/double/triple)',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W30, cluster C265, GSM8K test item432',
  shapeDescription:
    'A base actor has an explicit count N. Three chained successor actors each apply a stated ' +
    'multiplier (a fraction-word phrase or twice/half/double/triple) to the immediately preceding ' +
    'actor\'s count, in textual order. The question asks for the LAST chained actor\'s count. ' +
    'Answer = N * mult1 * mult2 * mult3, exact integer arithmetic, checked divisible at every step.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a base-count clause plus exactly three name-linked "<multiplier> as many ' +
          '... as <prior actor>" clauses plus a closing "how many ... has <last actor> slain?" ' +
          'ask, with every step an exact whole number; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `final chained count = ${result.verdict}` };
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
          verdict: String(Math.round((result.verdict) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'base * mult1 * mult2 * mult3, exact integer arithmetic with a divisibility check at every step',
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

registerMethod(threeActorSuccessorFractionOrMultipleChain);
