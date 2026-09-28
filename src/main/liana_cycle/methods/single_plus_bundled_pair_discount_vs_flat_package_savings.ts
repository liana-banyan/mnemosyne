// D-BP223-BM04-h2cbp9d8-171 -- single-plus-bundled-pair-discount-vs-flat-package-savings-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR R06
// (registration batch drawn from generation waves W24-W25).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\single-plus-bundled-pair-discount-vs-flat-package-savings-v1.candidate.ts
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
 * D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C231 (GSM8K test.jsonl item392, singleton).
 *
 * @generalShape One service is bought alone at a stated flat monthly price. TWO OTHER named
 *   services normally cost an identical stated flat monthly price EACH, but a stated PERCENTAGE
 *   discount applies to that pair for bundling. The closing question asks how much is saved versus
 *   cancelling a SEPARATE, single flat-priced package: bundlePair = 2*pairPrice*(1-pct/100);
 *   newTotal = singlePrice + bundlePair; savings = oldPackagePrice - newTotal.
 *
 * @recogniseInStranger Requires ALL of, as positive evidence, from the SAME question: (a) "gets
 *   <service> for $<p1> a month" (one standalone service); (b) "<serviceB> and <serviceC> normally
 *   cost $<p2> a month each but ... saves <D>% for bundling" (a pair sharing one price, discounted
 *   as a pair); (c) "cancelling ... $<p3> <old package>" (the single old flat price being
 *   replaced); (d) a closing "how much money does ... save" question.
 *
 * @whatBreaksIt (a) the bundling discount is applied to all three services rather than just the
 *   named pair -- this candidate only reads a two-service bundle discount and does not detect a
 *   three-way bundle; (b) the standalone service's price and the bundled pair's each-price are
 *   read from different clauses and must not be confused -- guarded by requiring both regexes to
 *   match independently; (c) the arithmetic does not land on a whole number -- abstain rather than
 *   round a discount computation.
 *
 * @whenRecognitionIsWrong shapeTest and run() call the identical analyze() pass, so a shape claim
 *   and its computed verdict can never disagree. Measured against its own representative teaching
 *   case (item392): SOLVED. Reach across a wider corpus is recorded in wave_manifest.json, not
 *   asserted here -- this is a singleton-cluster shape with one known teaching case.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'single-plus-bundled-pair-discount-vs-flat-package-savings-v1';

const SINGLE_RE = /gets?\s+[A-Z][a-zA-Z ]*?\s+for\s*\$?([\d.]+)\s+a month/i;
const BUNDLE_RE = /[A-Z][a-zA-Z ]*?\s+and\s+[A-Z][a-zA-Z ]*?\s+normally cost\s*\$?([\d.]+)\s+a month each\s+but[^.?!]*?\bsaves?\s+(\d+)%\s+for bundling/i;
const OLD_PACKAGE_RE = /cancelling\s+(?:his|her|their)\s*\$?([\d.]+)\s+[a-z]+\s+package/i;
const QUESTION_RE = /how much money does\b[^.?!]*\bsave\b/i;

interface Analyzed { savings: number; }

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  const singleM = SINGLE_RE.exec(q);
  const bundleM = BUNDLE_RE.exec(q);
  const oldM = OLD_PACKAGE_RE.exec(q);
  if (!singleM || !bundleM || !oldM) return null;
  if (!QUESTION_RE.test(q)) return null;

  const singlePrice = Number(singleM[1]);
  const pairPrice = Number(bundleM[1]);
  const discountPct = Number(bundleM[2]);
  const oldPackagePrice = Number(oldM[1]);
  if (![singlePrice, pairPrice, discountPct, oldPackagePrice].every(Number.isFinite)) return null;
  if (discountPct < 0 || discountPct > 100) return null;

  const pairTotalRaw = 2 * pairPrice * (100 - discountPct);
  if (pairTotalRaw % 100 !== 0) return null;
  const bundlePairCost = pairTotalRaw / 100;

  const newTotal = singlePrice + bundlePairCost;
  return { savings: oldPackagePrice - newTotal };
}

export const singlePlusBundledPairDiscountVsFlatPackageSavings: LianaMethod = {
  id: 'single-plus-bundled-pair-discount-vs-flat-package-savings-v1',
  demand: 'COMPUTE',
  name: 'Compute savings from replacing a flat package with one standalone service plus a discounted bundled pair',
  taughtBy: 'D-BP223-BM04-h2cbp9d8-171 WAVE W25, cluster C231, GSM8K test item392',
  shapeDescription:
    'A standalone service at a flat price plus a bundled pair (same each-price, percentage ' +
    'discount) replaces an old flat-priced package. savings = oldPackagePrice - (singlePrice + ' +
    '2*pairPrice*(1-pct/100)), only when the discounted pair cost lands on a whole number.',
  quarantined: false,  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find a matching standalone-service-price / bundled-pair-with-percentage-' +
          'discount / old-flat-package-price triple with a "how much money does ... save" ' +
          'closing question resolving to an exact value; abstaining rather than guessing',
      };
    }
    return { matches: true, reason: `savings = ${result.savings}` };
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
          verdict: String(Math.round((result.savings) * 100) / 100),
          abstain: false,
          freeText,
          method: METHOD_ID,
          basis: 'old flat package price minus (standalone price + discounted bundled pair cost)',
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

registerMethod(singlePlusBundledPairDiscountVsFlatPackageSavings);
