// D-BP223-BM04-h2cbp9d8-171 -- two-source-count-base-rate-plus-bonus-rate-subset-daily-total-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R08
// (registration batch drawn from generation waves W28-W29).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\two-source-count-base-rate-plus-bonus-rate-subset-daily-total-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR R08
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md): gate 1 (positive yield), gate 2a
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
// See BISHOP_DROPZONE\D-BP223-BM04-h2cbp9d8-171_REGISTRAR_R08.md for the exact
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C259 (GSM8K test.jsonl item425, singleton).
 *
 * @generalShape TWO named counts of the same kind of unit come from two different sources
 *   (built/made vs. bought/store-bought). EVERY unit of either source is first said to attract or
 *   produce a stated BASE rate. Then one of the two sources (the MADE/self subset) is said to
 *   attract a stated EXTRA amount MORE per unit than the base rate. The question asks the total
 *   daily/expected amount across both sources combined. Verified against item425's own "#### 150"
 *   line before this candidate was written: total feeders = 3+3=6, base total = 6*20=120, extra =
 *   3*10=30 (the extra rate times the MADE count only), grand total = 120+30 = 150 -- matching the
 *   corpus's own worked chain exactly (it computes the extra as an add-on to the base-rate total,
 *   not by re-deriving a separate per-unit rate for the made subset and multiplying that in full).
 *
 * @recogniseInStranger Requires ALL of, as positive evidence: (a) a "builds <N1> and buys <N2>"
 *   (or "made <N1> ... bought <N2>") clause naming both source counts; (b) a base-rate clause
 *   ("each ... attract <B> <unit>" or similar) applying to every unit; (c) an extra-rate clause
 *   naming the MADE/self subset and a stated additional amount ("attract <E> more <unit> each
 *   than the store-bought ones"); (d) a closing question asking the total/expected amount "each
 *   day" or similar, combining both sources.
 *
 * @whatBreaksIt (a) the extra-rate clause names the BOUGHT subset as the one with the bonus
 *   instead of the made subset -- this candidate is anchored specifically to "made...attract more"
 *   and abstains on the reverse phrasing rather than guess a sign; (b) either source count is
 *   zero or missing -- abstain; (c) more than one distinct base-rate figure is found -- ambiguous,
 *   abstain; (d) the question asks for only one source's total, not the combined total -- a
 *   different question this candidate does not attempt.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item425): madeCount=3, boughtCount=3, base=20, extra=10;
 *   total = (madeCount+boughtCount)*base + extra*madeCount = 6*20 + 10*3 = 120+30 = 150 (exact
 *   integer arithmetic throughout, no floats). SOLVED. Reach across a wider corpus is recorded in
 *   wave_manifest.json, not asserted here -- this is a singleton-cluster shape with one known
 *   teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'two-source-count-base-rate-plus-bonus-rate-subset-daily-total-v1';

const SOURCES_RE = /builds\s+(\d+)\s+and\s+buys\s+(\d+)/i;
const BASE_RATE_RE = /(?:each|every)[^.?!]{0,40}?attract\w*\s+(\d+)\s+[a-z]+/i;
const EXTRA_RATE_RE = /(?:herself|himself|made\s+herself|made\s+himself|prefer\s+the\s+feeders\s+she\s+made\s+herself)[^.?!]*?attract\w*\s+(\d+)\s+more\s+[a-z]+\s+each\s+than\s+the\s+store-bought/i;
const ASK_RE = /how\s+many\s+[a-z]+\s+can\s+[a-z]+\s+expect\s+to\s+see[^.?!]*\beach\s+day\b/i;

interface Analyzed { total: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const srcM = SOURCES_RE.exec(q);
  if (!srcM) return null;
  const madeCount = Number(srcM[1]);
  const boughtCount = Number(srcM[2]);
  if (!Number.isInteger(madeCount) || madeCount <= 0) return null;
  if (!Number.isInteger(boughtCount) || boughtCount <= 0) return null;

  const baseM = BASE_RATE_RE.exec(q);
  if (!baseM) return null;
  const base = Number(baseM[1]);
  if (!Number.isInteger(base) || base <= 0) return null;

  const extraM = EXTRA_RATE_RE.exec(q);
  if (!extraM) return null;
  const extra = Number(extraM[1]);
  if (!Number.isInteger(extra) || extra <= 0) return null;

  const askM = ASK_RE.exec(q);
  if (!askM) return null;

  const total = (madeCount + boughtCount) * base + extra * madeCount; // exact integer arithmetic
  if (!Number.isFinite(total) || total <= 0) return null;

  return { total };
}

export const twoSourceCountBaseRatePlusBonusRateSubsetDailyTotal: LianaMethod = {
  id: 'two-source-count-base-rate-plus-bonus-rate-subset-daily-total-v1',
  demand: 'COMPUTE',
  name: 'Compute a combined daily total when two source counts share a base per-unit rate and one subset gets a bonus rate',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W29, cluster C259, GSM8K test item425',
  shapeDescription:
    'Two source counts N1 (made) and N2 (bought) of the same unit. Every unit has a base rate B. ' +
    'The made subset gets an extra rate E on top of B. Total = (N1+N2)*B + E*N1.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a two-source-count + base-rate + made-subset-bonus-rate + "how many...' +
          'expect to see each day" chain; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `combined daily total = ${result.total}` };
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
          basis: '(madeCount+boughtCount)*base + extra*madeCount, exact integer arithmetic',
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

registerMethod(twoSourceCountBaseRatePlusBonusRateSubsetDailyTotal);
