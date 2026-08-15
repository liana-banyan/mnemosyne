// borromean_test.ts -- D-BP154-072/BISHOP-SEG/S52/seg-wiregate
//
// P12 -- THE BORROMEAN TEST (`BISHOP_DROPZONE\PRINCIPLES_ADDENDUM_BP154_FOUR.md`).
//
// Founder, BP154: "Three findings, no two of which are linked, all three jointly binding. Remove
// any one and the conclusion falls apart." The mechanical operation, verbatim from the spec: "For
// each finding in turn, remove it and re-derive. If the conclusion survives the removal, you did
// not have convergence -- you had ONE finding with decorations."
//
// A NOTE ON THE DISPATCH'S OWN STATED ORDER. D-BP154-072 named an order ("finish the meaning
// matrix (D-BP154-068), then SemioticSquare:1 (D-BP154-069), then this"). Neither "the meaning
// matrix" nor "SemioticSquare:1" appears anywhere in this campaign's own specs
// (PRINCIPLES_LIBRARY_BP154.md, PRINCIPLES_ADDENDUM_BP154_FOUR.md, or any BP154 dropzone file
// grepped this dispatch) -- the only hits for "meaning matrix"/"hex connector" anywhere on disk are
// tagged BP021/BP148, a materially different, earlier subsystem, not this repo's Composer. Built
// P12 directly instead, on two independent grounds that both hold regardless of that mismatch: (1)
// the spec file itself, PRINCIPLES_ADDENDUM_BP154_FOUR.md's own STATUS section: "P12 (Borromean)
// should be built first -- it is the only one that closes a gap the estate has already been
// measured to have"; (2) the Founder's own words this turn, "P12 or make it". Flagged, not
// silently acted on -- reported in this dispatch's own return, not just this comment.
//
// FIRST, THE AUDIT THIS DISPATCH DEMANDED BEFORE WRITING CODE: does THE CONVERGENCE
// (classify_cascade.ts, D-BP152-037, SEG_RETURN_BP152_037_CONVERGENCE.md) already perform a
// removal test? Read directly (D-BP154-071's own audit had not landed) -- NO. THE CONVERGENCE
// groups harvested criteria by exact normalized text and COUNTS independent sources per group
// (`ConvergenceRecord.independentSourceCount >= 2` => "convergent") -- a counting test, never a
// removal-and-re-derive test. It answers "how many independent things said X", never "does the
// verdict still hold if I take X away". These are complementary, not duplicates -- P12 fills the
// gap SEG_RETURN_BP152_037_CONVERGENCE.md's own text names explicitly: "THE CONVERGENCE...
// determine one option (or, honestly, not)... [but] none of it is auto-promoted to eliminate or
// reweight". Also structurally disqualified from reuse regardless: THE CONVERGENCE lives entirely
// inside classify_cascade.ts, FORBIDDEN as a dependency for this entire Composer track. Built
// native, same discipline as no_consensus_step.ts (D-BP154-065) -- read the existing mechanism for
// diagnosis, port nothing, build the Composer's own.
//
// THE ACTUAL DERIVATION, NOT A SIMULATION (the dispatch's own GUARD). This file calls
// runTerminatorStep() -- the SAME, REAL, unmodified function that produced the original verdict --
// a second time per removal, with one step's own entry filtered OUT of `priorResults`. Not a
// hand-rolled re-implementation of the elimination rules: findRaw() (terminator_step.ts) reads
// `priorResults.find(r => r.id === id)?.raw ?? null`, so an entry's absence is EXACTLY what a step
// that never ran looks like to every downstream gate (comparabilityGate/boundaryGate/subregionGate,
// sufficiency, contradiction detection) -- nothing is short-circuited or approximated.
//
// THE FINDING UNIT: one Composer STEP, not one eliminated letter. TerminatorEliminationEntry's own
// `sourceStep` (terminator_step.ts) already names which step's stated fact produced each
// elimination -- the receipt CAN say which findings a verdict rested on (the dispatch's own GUARD:
// "if the receipt cannot say which findings a verdict rested on, that is the defect to report
// first" -- checked, not true here, so the removal test can proceed and mean something). A whole
// STEP is the right independence unit, not a single letter within it, because FD-BP153-01's own
// "one query, not one per option" already makes one step's own elimination set ONE derivation act
// (one query, one answer) -- exactly BP143-144's own independence-is-the-derivation-path canon,
// applied here to natively match how this estate's steps are actually built.
//
// classify_cascade.ts and plow_mc_answerer.ts remain FORBIDDEN and were not imported anywhere in
// this file (classify_cascade.ts's own SEG_RETURN was read only as an external artifact, above).

import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { ComposerStepOutcome } from './script_bridge';
import { runTerminatorStep } from './terminator_step';
import type { TerminatorEliminationEntry } from './terminator_step';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';

export type BorromeanClassification = 'CONVERGENT' | 'SINGLE-SOURCED' | 'INSUFFICIENT';

/** The Borromean spec's own minimum -- "Three findings... all three jointly binding." Fewer than
 *  this and there is nothing to remove-and-re-derive in the sense the principle names. */
const MINIMUM_FINDINGS = 3;

export interface BorromeanRemoval {
  findingId: TerminatorEliminationEntry['sourceStep'];
  /** True when the SAME unique verdict letter still results after this ONE finding is withheld --
   *  i.e. this finding was NOT actually load-bearing; something else alone already forced it. */
  verdictSurvived: boolean;
  survivorsAfterRemoval: string[];
  contradictionAfterRemoval: boolean;
}

export interface BorromeanTestResult {
  ok: boolean;
  verdictLetter: string | null;
  /** Every distinct step whose own stated fact contributed at least one elimination to the
   *  baseline (full-evidence) run -- the candidate set this test removes from, one at a time. */
  loadBearingFindings: TerminatorEliminationEntry['sourceStep'][];
  removals: BorromeanRemoval[];
  classification: BorromeanClassification | null;
  reason: string;
  error?: string;
}

/** Builds the modified priorResults array with exactly one step's own entry withheld -- filtering,
 *  never mutating an entry or its raw contents, so a step that DID run is either fully present or
 *  fully absent, never partially edited. */
function withheldPriorResults(priorResults: ComposerStepOutcome[], stepId: string): ComposerStepOutcome[] {
  return priorResults.filter((r) => r.id !== stepId);
}

/**
 * THE BORROMEAN TEST (P12). Runs the REAL runTerminatorStep() once for the baseline (full
 * evidence, as already assembled in `priorResults`), then once more per load-bearing finding with
 * that finding's own entry withheld from `priorResults` -- never a copy of the elimination rules,
 * never a shortcut. Pure orchestration over an already-completed Terminator run's own inputs; no
 * new query is issued, no authority is consulted (`ctx` is threaded through only because
 * runTerminatorStep()'s own signature requires it -- that parameter is unused inside it, `_ctx`).
 */
export async function runBorromeanTest(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
  priorResults: ComposerStepOutcome[],
): Promise<BorromeanTestResult> {
  const empty = (overrides: Partial<BorromeanTestResult> & { error: string }): BorromeanTestResult => ({
    ok: false, verdictLetter: null, loadBearingFindings: [], removals: [], classification: null,
    reason: overrides.error,
    ...overrides,
  });

  const { result: baseline } = await runTerminatorStep(input, ctx, priorResults);
  if (!baseline.ok) {
    return empty({ error: `baseline Terminator run itself failed -- ${baseline.error ?? 'no error given'} -- nothing to test` });
  }
  if (!baseline.verdict) {
    return empty({ error: 'the baseline run has no unique verdict to test (abstain) -- THE BORROMEAN TEST applies only to a verdict that was actually reached' });
  }
  const verdictLetter = baseline.verdict;

  // THE GUARD: can the receipt even say which findings the verdict rested on? It can, mechanically
  // -- TerminatorEliminationEntry.sourceStep already names the step, always, for every entry.
  const loadBearingFindings = [...new Set(baseline.eliminated.map((e) => e.sourceStep))];

  if (loadBearingFindings.length < MINIMUM_FINDINGS) {
    return {
      ok: true, verdictLetter, loadBearingFindings, removals: [], classification: 'INSUFFICIENT',
      reason: `INSUFFICIENT -- only ${loadBearingFindings.length} distinct step(s) contributed an `
        + `elimination to this verdict (need >=${MINIMUM_FINDINGS} to run the Borromean removal `
        + `test at all): [${loadBearingFindings.join(', ')}]. This is not the same as the verdict `
        + 'being wrong -- it may still be correct -- only that fewer than three independent '
        + 'findings exist to test whether it is convergent.',
    };
  }

  const removals: BorromeanRemoval[] = [];
  for (const findingId of loadBearingFindings) {
    const withheldResults = withheldPriorResults(priorResults, findingId);
    // eslint-disable-next-line no-await-in-loop -- each removal must observe the REAL function's
    // own result before the next is attempted; nothing here is parallelizable evidence-gathering
    // (no query is issued), so there is no latency cost to running these in sequence.
    const { result: removalResult } = await runTerminatorStep(input, ctx, withheldResults);
    const verdictSurvived = removalResult.ok
      && removalResult.contradiction === null
      && removalResult.survivors.length === 1
      && removalResult.survivors[0] === verdictLetter;
    removals.push({
      findingId,
      verdictSurvived,
      survivorsAfterRemoval: removalResult.ok ? removalResult.survivors : [],
      contradictionAfterRemoval: removalResult.ok && removalResult.contradiction !== null,
    });
  }

  const survivingRemovals = removals.filter((r) => r.verdictSurvived);
  const classification: BorromeanClassification = survivingRemovals.length === 0 ? 'CONVERGENT' : 'SINGLE-SOURCED';

  const removalsText = removals
    .map((r) => `${r.findingId}: ${r.verdictSurvived ? 'SURVIVED (still {' + r.survivorsAfterRemoval.join(',') + '})' : 'FAILED (now {' + r.survivorsAfterRemoval.join(',') + '}' + (r.contradictionAfterRemoval ? ', contradiction' : '') + ')'}`)
    .join('  |  ');

  const reason = classification === 'CONVERGENT'
    ? `CONVERGENT -- verdict ${verdictLetter} failed to survive EVERY one of ${loadBearingFindings.length} `
      + `removals (each load-bearing finding withheld in turn): ${removalsText}`
    : `SINGLE-SOURCED -- verdict ${verdictLetter} still survived when ${survivingRemovals.length} of `
      + `${loadBearingFindings.length} finding(s) were withheld -- ${survivingRemovals.map((r) => r.findingId).join(', ')} `
      + `${survivingRemovals.length === 1 ? 'is' : 'are'} not actually load-bearing; the verdict rests on the `
      + `remaining finding(s) alone. This is a label, not a failure -- the verdict may still be correct, it is `
      + `simply resting on one finding and must be reported as such, never dressed as corroborated: ${removalsText}`;

  return {
    ok: true, verdictLetter, loadBearingFindings, removals, classification, reason,
  };
}

function summaryLine(r: BorromeanTestResult): string {
  if (!r.ok) return `BORROMEAN TEST: NOT RUN -- ${r.error}`;
  return `BORROMEAN TEST -- verdict: ${r.verdictLetter}  ||  load-bearing findings: `
    + `[${r.loadBearingFindings.join(', ')}]  ||  CLASSIFICATION: ${r.classification}  ||  ${r.reason}`;
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const BORROMEAN_TEST_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.borromean_test.runBorromeanTest',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/borromean_test.ts',
  sourceLine: 1,
  exportName: 'runBorromeanTest',
  exportKind: 'function',
  whatItDoes:
    'P12, THE BORROMEAN TEST (PRINCIPLES_ADDENDUM_BP154_FOUR.md). Given an already-completed '
    + 'Terminator:1 verdict in this same stack, re-runs the REAL runTerminatorStep() once per '
    + 'load-bearing elimination-issuing step, each time with that ONE step\'s own entry withheld '
    + 'from priorResults -- never a copy of the elimination rules. Classifies the verdict '
    + 'CONVERGENT (fails on every removal), SINGLE-SOURCED (survives one or more removals -- a '
    + 'true label, never a failure), or INSUFFICIENT (fewer than 3 load-bearing findings to test '
    + 'at all).',
  inputs: 'MethodQuestionInput plus MethodRunContext plus priorResults (must include a prior Terminator:1 run in the same stack) to runBorromeanTest().',
  outputs: 'Promise<BorromeanTestResult> -- verdict letter, every load-bearing finding, the full per-removal record, and the classification with its reason.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no new query -- pure re-derivation over priorResults already assembled by this same stack (runTerminatorStep() is re-invoked, never a new authority call).',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote: 'Three findings, no two of which are linked, all three jointly binding. Remove any one '
      + 'and the conclusion falls apart... P12 or make it, and all the rest you stated.',
    citedAt: 'PRINCIPLES_ADDENDUM_BP154_FOUR.md P12; D-BP154-072, this dispatch',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerBorromeanTestStep() (this file), executed '
    + 'by script_bridge.ts\'s runOneStep() for id "Borromean:1".',
};

/** Registers 'Borromean:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as every other Composer step registration there. */
export function registerBorromeanTestStep(): MethodIdentity {
  return registerNameNumbered('Borromean', 1, BORROMEAN_TEST_DECLARATION);
}

export { summaryLine as borromeanSummaryLine };
