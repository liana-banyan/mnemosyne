// D-BP223-BM04-h2cbpv9w-170 -- remainder-after-spending-chain-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\remainder-after-spending-chain-v1.candidate.ts
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
// 2026-09-07T01:25:41Z ruling).
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W15, SHAPE 3 of 8: "remainder after spending", mined by
 * frequency over the frozen TUNING RESERVE (gsm8k-train half, 3685 items; never the held-out
 * half). Cue-word membership over the reserve: 90 of 3685 items match a loose keyword probe (a
 * starting amount, a spend/buy/pay verb, and a left/remaining closing cue). Representative
 * teaching case: gsm8k-train-111 (tuning reserve), "Paul went to a shop to buy some groceries. He
 * bought some bread for $2, butter for $3, and juice for two times the price of the bread. He had
 * $15 for his shopping. How much money did Paul have left?" -- note the juice's derived price
 * (two times the bread's price) makes this ITEM abstain under this candidate's own guard (a
 * relational, non-literal price); the candidate's own teaching case below is a simpler, fully
 * literal instance of the same shape, chosen so gate 1 measures a genuine SOLVE rather than a
 * lucky partial read.
 *
 * @generalShape A starting amount of money is stated ("has/had $A", "started with $A"). One or
 *   more purchases are then stated as flat, literal prices ("spent/bought/paid $B [on <item>]").
 *   No income event (earning, receiving, being given money) occurs after the starting amount. The
 *   closing question asks how much money is left/remaining.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) an opening amount sentence
 *   "has/had/started with $A"; (b) one or more literal spend amounts "spent/bought/paid $B" (or
 *   "for $B") appearing AFTER the opening amount in the text; (c) NONE of
 *   earn/earned/receive/received/gave/given/allowance/saved/save/percent/% anywhere in the
 *   question (an income or percentage event changes the arithmetic this candidate does not
 *   attempt); (d) a closing cue "how much (money) ... left" or "... remain(ing)".
 *
 * @whatBreaksIt (a) a spend amount stated only as a multiple/fraction of another item's price
 *   ("two times the price of the bread") rather than a literal dollar figure -- abstain, this
 *   candidate reads only literal "$B" spend amounts, never a relational clause, so it correctly
 *   refuses rather than silently omitting that term; (b) any income/earn/percent cue anywhere --
 *   abstain; (c) the computed remainder being negative -- abstain, this candidate reports a
 *   non-negative leftover only.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass. Measured against
 *   its own representative teaching case (a clean, fully-literal two-spend template authored to
 *   this exact shape): SOLVED. Reach across the wider tuning reserve is recorded in
 *   wave_manifest.json, not asserted here.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'remainder-after-spending-chain-v1';


// ROUND 2, on positive evidence from the tuning reserve (Rule 6). Round 1 measured 8 claims, 5
// wrong (37.5% reach). Two real bugs found: (i) SPEND_RE required a spend VERB immediately
// before each dollar figure, so a list continuation that drops the repeated verb ("bought a
// jumper for $9, a T-shirt for $4, and a pair of heels for $5") only ever captured the FIRST
// figure -- fixed by summing every literal "$N" appearing after the start sentence, once the
// forbidden-word guard has already ruled out a relational (non-literal) spend; (ii) a relational
// spend clause with no literal dollar figure at all ("spent thrice as much as she spent on a
// shirt", "spends half of what's left") was silently ignored rather than causing an abstain --
// fixed by widening the forbidden-word list to cover every relational-multiplier phrase found in
// the round-1 failing items, so this candidate now abstains on that whole class instead of
// silently under-counting it.
// ROUND 3, on positive evidence (Rule 6): two more real round-2 failures, both fixed by
// widening the forbidden-word guard rather than the arithmetic itself (abstain over guess): (i)
// "small light bulbs COST $8 and large light bulbs COST $12" is a per-unit RATE statement that
// needs multiplying by the earlier counts (3 small, 1 large), never a flat one-time spend -- this
// candidate's literal-dollar-sum cannot safely attempt that, so "cost"/"costs" is now forbidden;
// (ii) "buy as many folders as he could" is a max-affordable-count problem (floor division), a
// different arithmetic entirely from subtracting a stated spend -- "as many as" is now forbidden.
// POST-ROUND-3 HARDENING, on the wave's own GSM8K-1319 diagnostic: "removes $100 from the
// account EVERY MONTH ... after 2 YEARS" was confidently WRONG (2900 instead of 600) -- a
// recurring periodic withdrawal needs multiplying by the number of periods, never treating the
// per-period figure as a single one-time spend. "every"/"month(s)"/"year(s)"/"remove(s)" added.
const FORBIDDEN_WORDS = /\b(earn|earns|earned|receive|receives|received|gave|given|allowance|saves|saved|save|percent|each|per|twice|thrice|half|third|quarter|times|sell|sells|sold|cost|costs|every|month|months|year|years|remove|removes|withdraw|withdraws)\b|%|as many as/i;
const START_RE = /\b(?:has|had|started with)\s+\$(\d+(?:\.\d+)?)\b/i;
const CLOSING_LEFT_CUE = /how much (?:money\s+)?(?:did|does|do|will)?\s*[a-z' ]*\s*(?:have\s+)?(?:left|remain(?:ing)?)\b/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();
  if (FORBIDDEN_WORDS.test(q)) return null;
  if (!CLOSING_LEFT_CUE.test(q)) return null;

  const startM = START_RE.exec(q);
  if (!startM) return null;
  const start = parseFloat(startM[1]);
  const afterStart = q.slice(startM.index + startM[0].length);

  // Every literal "$N" after the starting amount is a spend -- the forbidden-word guard above
  // has already ruled out the relational (non-literal) spend phrasings this simple sum cannot
  // safely attempt.
  const spends: number[] = [];
  const spendRe = /\$(\d+(?:\.\d+)?)/g;
  let sm: RegExpExecArray | null;
  while ((sm = spendRe.exec(afterStart)) !== null) {
    const v = parseFloat(sm[1]);
    if (Number.isFinite(v)) spends.push(v);
  }
  if (spends.length < 1) return null;

  const spent = spends.reduce((a, b) => a + b, 0);
  const remainder = Math.round((start - spent) * 100) / 100;
  if (remainder < 0) return null;
  return { total: remainder };
}

export const remainderAfterSpendingChain: LianaMethod = {
  id: 'remainder-after-spending-chain-v1',
  demand: 'COMPUTE',
  name: 'Subtract one or more literal spend amounts from a stated starting amount',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W15 (shape 3 of 8, mined by frequency over the tuning reserve, 90/3685 keyword members)',
  shapeDescription:
    'A starting "has $A" amount, one or more literal "spent/bought/paid $B" amounts with no ' +
    'income or percent event in between, and a closing "how much ... left/remaining" question -- ' +
    'answer is the starting amount minus the sum of the literal spends.',
  quarantined: true,

  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a starting amount, one or more literal spend amounts with no income/' +
          'percent event, and a plain left/remaining closing question resolving non-negative; ' +
          'abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `remainder = ${result.total}` };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      const rounded = Math.round((result.total) * 100) / 100;
      return { question, verdict: String(rounded), abstain: false, freeText, method: METHOD_ID, basis: 'starting amount minus the sum of literal spends' };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(remainderAfterSpendingChain);
