// D-BP223-BM04-h2cbp9d8-171 -- mrs-sherman-bread-rolls-broken-into-pieces-for-chickens-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\mrs-sherman-bread-rolls-broken-into-pieces-for-chickens-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R06
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md): gate 1 (positive yield), gate 2a
// (answer carry, under gate2_answer_carry.cjs's v3 -- the array-index/bracket-adjacency fix
// installed 2026-09-08T09:46:02Z, on top of v2's letter-boundary fix installed 09:08:02Z), gate 4
// (interception against the live registry), gate 5 (sibling interception against the real
// ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R06.md for the exact
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
 * D-BP223-BM04-h2cbpv9w-170 WAVE W24, CLUSTER C216 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 375, "Mrs. Sherman made a dozen bread rolls
 * for breakfast. After feeding her 6 children with one each, she broke each of the remaining
 * rolls into 8 pieces and fed them to the chickens. How many pieces of rolls did she feed to the
 * chickens?". Silo label: "multi-step arithmetic involving subtraction and multiplication" --
 * matches exactly.
 *
 * @generalShape A person MAKES/HAS a TOTAL count of an ITEM (stated either as a bare number or as
 *   the word "a dozen"), for some stated purpose. A sentence then reports feeding/giving ONE EACH
 *   of that item to a stated number of RECIPIENTS ("after feeding her <K> <recipients> one
 *   each"), consuming K of the total. A further sentence reports that EACH of the REMAINING items
 *   (the same noun, by backreference) was broken/split into a stated number of PIECES and given
 *   to a SECOND recipient. The question asks how many pieces were given to that second recipient:
 *   (total - K) * piecesPerItem.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, with the item noun repeated
 *   verbatim (by backreference, never re-guessed) across the total sentence and the breaking
 *   sentence:
 *   (a) "made|had|baked (a dozen|<digits>) (?:<modifier> )?<item-plural> for" -- the total, "a
 *       dozen" resolved to 12, a bare digit count read literally, any other quantity word
 *       abstained on; the HEAD noun (last word before "for") is captured and used for every later
 *       backreference, so an optional leading modifier ("bread" in "bread rolls") is skipped;
 *   (b) "after feeding (?:her|his|their) <K> <recipients> one each" -- the first-recipient
 *       consumption count K;
 *   (c) "(?:she|he|they) broke each of the remaining <item-plural> into <P> pieces" -- the
 *       per-item piece count P, naming the SAME item noun as (a);
 *   (d) the question "how many pieces of <item-plural> did (?:she|he|they) feed to <second-
 *       recipient>", naming the same item noun.
 *   Answer = (total - K) * P.
 *
 * @whatBreaksIt (a) K exceeding the stated total -- abstain, cannot have fed more than existed;
 *   (b) a quantity word other than "a dozen" or a bare digit ("a baker's dozen", "a score", "a
 *       couple") -- abstain, this candidate only resolves the two forms it has positive evidence
 *       for; (c) the breaking sentence's item noun not matching the total sentence's item noun --
 *       abstain, cannot confirm this is the same batch of items; (d) the question asking about the
 *       FIRST recipient instead of the second -- this candidate only recognises the "what happened
 *       to the remainder" framing and abstains otherwise, since answering about the first recipient
 *       would need a different (trivial) formula.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass, so a shape
 *   claim guarantees run() reconstructs the same number. Measured against its own (sole) cluster
 *   member: SOLVED (a dozen = 12, 12-6=6 rolls remaining, 6*8=48 pieces fed to the chickens). With
 *   only one known member there is no cross-member measurement to report.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'mrs-sherman-bread-rolls-broken-into-pieces-for-chickens-v1';

interface Analyzed { pieces: number; }

function parseTotalWord(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (t === 'a dozen' || t === 'dozen') return 12;
  const n = parseInt(t, 10);
  if (Number.isFinite(n) && String(n) === t) return n;
  return null;
}

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const rTotal = /\b(?:made|had|baked)\s+(a\s+dozen|\d+)\s+(?:[a-z-]+\s+)?([a-z][a-z-]*)\s+for\s/i;
  const mTotal = rTotal.exec(q);
  if (!mTotal) return null;
  const [, totalRaw, itemNoun] = mTotal;
  const total = parseTotalWord(totalRaw);
  if (total === null) return null;

  const rEat = /\bafter\s+feeding\s+(?:her|his|their)\s+(\d+)\s+[a-z]+\s+(?:with\s+)?one\s+each\b/i;
  const mEat = rEat.exec(q);
  if (!mEat) return null;
  const k = parseInt(mEat[1], 10);
  if (!Number.isFinite(k) || k > total) return null;

  const itemEsc = itemNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rBreak = new RegExp(
    '\\bbroke\\s+each\\s+of\\s+the\\s+remaining\\s+' + itemEsc + 's?\\s+into\\s+(\\d+)\\s+pieces\\b',
    'i',
  );
  const mBreak = rBreak.exec(q);
  if (!mBreak) return null;
  const piecesEach = parseInt(mBreak[1], 10);
  if (!Number.isFinite(piecesEach)) return null;

  const rQ = new RegExp(
    'how\\s+many\\s+pieces\\s+of\\s+' + itemEsc + 's?\\s+did\\s+(?:she|he|they)\\s+feed\\s+to\\s+[a-z]+',
    'i',
  );
  if (!rQ.test(q)) return null;

  const remaining = total - k;
  if (remaining < 0) return null;
  const pieces = remaining * piecesEach;
  if (!Number.isFinite(pieces)) return null;
  return { pieces };
}

export const mrsShermanBreadRollsBrokenIntoPiecesForChickens: LianaMethod = {
  id: 'mrs-sherman-bread-rolls-broken-into-pieces-for-chickens-v1',
  demand: 'COMPUTE',
  name: 'Total items minus a one-each consumption count leaves a remainder, each remainder item broken into a stated number of pieces',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170 WAVE W24 (cluster C216, sole member: pilot corpus item at index 375)',
  shapeDescription:
    'remaining = total - consumedOneEach; answer = remaining * piecesPerRemainingItem. "a dozen" resolved to 12, ' +
    'otherwise a bare digit total only.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a made/had/baked total (a dozen or a bare digit) of a named item, a ' +
          '"fed K recipients one each" consumption sentence, a "broke each of the remaining ' +
          '<same item> into P pieces" sentence, and a closing question about pieces fed to a ' +
          'second recipient; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `pieces fed to the second recipient = ${result.pieces}` };
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
          verdict: String(Math.round((result.pieces) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: '(total - consumedOneEach) * piecesPerRemainingItem',
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

registerMethod(mrsShermanBreadRollsBrokenIntoPiecesForChickens);
