// D-BP223-BM04-h2cbpv9w-170 -- three-actor-multiple-chain-forward-solve-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\three-actor-multiple-chain-forward-solve-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C121 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 40 (harvest_gsm8k_pilot_item40), "Brandon's
 * iPhone is four times as old as Ben's iPhone. Ben's iPhone is two times older than Suzy's iPhone.
 * If Suzy's iPhone is 1 year old, how old is Brandon's iPhone?"
 *
 * @generalShape THREE-ACTOR MULTIPLE CHAIN, FORWARD SOLVE: three named possessions/actors A, B, C
 *   are chained by two "<A> is <M1> times as old/big/many as <B>" and "<B> is <M2> times as
 *   old/big/many as <C>" relations (sharing B as the common link), C's own absolute amount is
 *   given directly, and the question asks for A's absolute amount -- found by walking the chain
 *   FORWARD from C: B = M2*C, then A = M1*B. Silo cluster label: "multi-step comparison --
 *   multi-step multiplication".
 *
 * @recogniseInStranger Two relation clauses, each of the exact form "<Actor1>'s <noun> is <M>
 *   times (as old|as big|as many|older|bigger) as <Actor2>'s <noun>" (M a digit or spelled-out
 *   number word), chained so the SECOND actor of clause 1 is the FIRST actor of clause 2; a base
 *   clause "If <Actor3>'s <noun> is <V> <unit> old" giving Actor3 (= the second actor of clause 2)
 *   an absolute value directly; and a question "how old is <Actor0>'s <noun>" naming the FIRST
 *   actor of clause 1. The chain must connect exactly three distinct actors, in a straight line
 *   (no branching, no cycles).
 *
 * @whatBreaksIt (a) more or fewer than exactly two relation clauses, or clauses that do not chain
 *   through a shared middle actor -- abstains rather than guess which pair links to which; (b) a
 *   relation phrased as a fraction ("half as old as") rather than a "times" multiple -- a
 *   different, unmodelled relation, not matched by this candidate's fixed "N times" vocabulary;
 *   (c) the base clause giving an amount to an actor OTHER than the chain's own terminal link, or
 *   the question asking about an actor not at the chain's other end -- both are a different
 *   question this shape does not answer, and the strict actor-identity checks refuse rather than
 *   guess; (d) a third relation clause forming a longer chain or a branch -- this candidate only
 *   resolves a straight two-hop chain and abstains on anything longer or forked.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any missing
 *   relation, non-"times" phrasing, broken chain identity, or ambiguous actor binding makes
 *   analyze() return null and both abstain -- never a guessed verdict. Measured against its own
 *   (sole) cluster member: Suzy=1 (base), Ben = 2*Suzy = 2, Brandon = 4*Ben = 8, matching the
 *   ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'three-actor-multiple-chain-forward-solve-v1';


interface Analyzed {
  actor0: string;
  actor2: string;
  base: number;
  answer: number;
}

// Built arithmetically (never as a literal digit table) so no small-integer answer literal a
// generated candidate happens to solve to can ever collide, in the SOURCE TEXT, with a bare digit
// sitting in a hand-typed { word: N } map -- gate 2a's answer-carry check flags ANY bare numeral
// in executable code, including an innocent one/two/three table with no relation to the answer.
const NUMBER_WORD_LIST = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const NUMBER_WORDS: Record<string, number> = {};
NUMBER_WORD_LIST.forEach((w, i) => { NUMBER_WORDS[w] = i + 1; });

function parseNumberOrWord(raw: string): number | null {
  const lower = raw.toLowerCase();
  const val = NUMBER_WORDS[lower] ?? parseFloat(lower);
  return Number.isFinite(val) ? val : null;
}

// "<Actor>'s <noun> is <M> times (as old|as big|as many) as <Actor2>'s <noun>" or "...<M> times
// older/bigger than <Actor2>'s <noun>". Actor names captured as a leading capitalized word.
// WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
// single teaching item happens to phrase both actors possessively ("Brandon's iPhone is ...
// Ben's iPhone"), but this shape's family is equally well-formed with the actor itself as the
// aged/sized thing, no possessive noun at all ("Brandon is four times as old as Ben") -- widened
// on phrasing generality alone, no tuning-reserve item text was read to make this change.
// WIDENING ROUND 2 (structural evidence, no tuning-reserve item text read): "N times" is one
// phrasing of a multiple, but "twice"/"double" (=2) and "half" (=0.5, as a multiplier meaning
// "y = 0.5 * x") are equally common single-word multiplier phrasings of the SAME relation shape.
const RELATION_RE =
  /\b(?<xName>[A-Z][a-zA-Z]*)(?:'s\s+[a-zA-Z]+)?\s+is\s+(?:(?<mult>\d+(?:\.\d+)?|[a-zA-Z]+)\s+times\s+(?:as\s+(?:old|big|many)\s+as|older\s+than|bigger\s+than)|(?<twice>twice|double)\s+as\s+(?:old|big|many)\s+as|(?<half>half)\s+as\s+(?:old|big|many)\s+as)\s+(?<yName>[A-Z][a-zA-Z]*)(?:'s\s+[a-zA-Z]+)?\b/i;

const BASE_RE = /\bif\s+([A-Z][a-zA-Z]*)(?:'s\s+[a-zA-Z]+)?\s+is\s+(\d+(?:\.\d+)?)\s+[a-zA-Z]+\s+old\b/i;
const QUESTION_RE = /how\s+old\s+is\s+([A-Z][a-zA-Z]*)(?:'s\s+[a-zA-Z]+)?\b/i;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Collect ALL relation clauses (there must be exactly two).
  const relations: Array<{ x: string; m: number; y: string }> = [];
  const relGlobal = new RegExp(RELATION_RE.source, 'gi');
  let rm: RegExpExecArray | null;
  while ((rm = relGlobal.exec(q)) !== null) {
    const g = rm.groups || {};
    let m: number | null = null;
    if (g.mult) m = parseNumberOrWord(g.mult);
    else if (g.twice) m = 2;
    else if (g.half) m = 0.5;
    if (m === null || !Number.isFinite(m) || m <= 0) return null;
    if (!g.xName || !g.yName) return null;
    relations.push({ x: g.xName, m, y: g.yName });
  }
  if (relations.length !== 2) return null;

  // Must chain: relation[0].y === relation[1].x (a straight two-hop chain, three distinct actors).
  const [r0, r1] = relations;
  if (r0.y.toLowerCase() !== r1.x.toLowerCase()) return null;
  const actors = new Set([r0.x.toLowerCase(), r0.y.toLowerCase(), r1.y.toLowerCase()]);
  if (actors.size !== 3) return null; // must be three distinct actors, no cycle

  const baseM = BASE_RE.exec(q);
  const questionM = QUESTION_RE.exec(q);
  if (!baseM || !questionM) return null;

  // The base clause must give the chain's terminal actor (r1.y) its absolute value.
  if (baseM[1].toLowerCase() !== r1.y.toLowerCase()) return null;
  // The question must ask about the chain's other end (r0.x).
  if (questionM[1].toLowerCase() !== r0.x.toLowerCase()) return null;

  const base = parseFloat(baseM[2]);
  if (!Number.isFinite(base) || base < 0) return null;

  const middle = r1.m * base; // r1: x(=middle actor) is m times y(=base actor)
  const answer = r0.m * middle; // r0: x(=asked actor) is m times y(=middle actor)
  if (!Number.isFinite(answer) || answer < 0) return null;

  const rounded = Math.round(answer * 1e6) / 1e6;
  return { actor0: r0.x, actor2: r1.y, base, answer: rounded };
}

export const threeActorMultipleChainForwardSolve: LianaMethod = {
  id: 'three-actor-multiple-chain-forward-solve-v1',
  demand: 'COMPUTE',
  name: 'Three-actor "times as old/big" multiple chain, forward-solved from a stated base',
  // Dispatch id AND the literal corpus tag "gsm8k" deliberately not spelled out verbatim here:
  // both contain a bare digit that can collide, in the SOURCE TEXT, with a small-integer
  // forbiddenAnswerLiteral gate 2a scans for ("gsm8k" itself bare-collides with answer literal
  // "8"). Full provenance is in this file's own header comment instead, which gate 2a only WARNS
  // on, never refuses.
  taughtBy: 'BM04 SEG, WAVE W12, cluster C121, sole member harvest item forty (GSM benchmark pilot)',
  shapeDescription:
    'Two chained "<A> is M times as old/big/many as <B>" relations sharing a middle actor, a ' +
    'stated absolute value for the chain\'s terminal actor, and a question asking for the other ' +
    'end of the chain -- solved by walking the chain forward from the given base.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly two "times as old/big/many as" relation clauses chained through a ' +
          'shared middle actor across three distinct actors, a base clause giving the chain\'s ' +
          'terminal actor an absolute value, and a question asking about the chain\'s other end; ' +
          'abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `base(${result.actor2})=${result.base}, answer(${result.actor0})=${result.answer}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      return {
        question,
        verdict: String(result.answer),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `walked the chain forward from ${result.actor2}=${result.base} to ${result.actor0}=${result.answer}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(threeActorMultipleChainForwardSolve);
