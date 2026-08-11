// script_runner.ts -- D-BP152-041/BISHOP/seg-script-format-and-runner
//
// THE SCRIPT RUNNER. Executes a Script (script.ts, this ticket) in the order its `steps` array
// says -- reordering that array is the entire "stack methods in whatever order I want" feature
// (FD-BP152-20). See script.ts's own header for the full ruling citations; this file only adds
// the execution half.
//
// STEPS ARE (state) -> (state). One state object is threaded through the whole run: each step
// receives exactly the prior step's output, nothing pooled or merged from elsewhere. This module
// does not define what `state` IS -- it is generic (`S`) on purpose, because this ticket does not
// wire any real method's state shape (comparative_cascade.ts etc. are untouched, see script.ts's
// header). A future wiring ticket supplies the real state type and a real MethodExecutor.
//
// UNWIRED. Nothing here is imported by liana_terminal_engine.ts or any live run path. Building
// the capability is this ticket's job; wiring it to real methods is a separate ruling.
//
// NOTHING IS INVOKED AT IMPORT. This file defines only types and functions -- importing it runs
// no step, opens no file, makes no call.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP152-046/BISHOP/seg-stored-results-and-both-apply, STAGE 1/2 AND STAGE 2/2 -- ADDED HERE.
//
// FD-BP152-21, Founder verbatim: "build the stored results... on your point about step 4, I want
// both - I want to be able to ask Google, and I also want the Cascade to apply, as a check on each
// other, so just make both results stored." Stage 1 (commit 38416c66) built the "stored results"
// half below; this stage adds the "I want both" half on top of it, as its own commit.
//
// STAGE 1: every step that runs stores its result (stored_results.ts's ResultStore), addressable
// by its 1-based POSITION in the run's own flattened execution order and by its Name:Number id.
// The position counter is GLOBAL across the whole run -- including inside a nested script, per
// FD-BP152-09's own recursion -- because his worked stack (steps 2, 3, 4) treats the run as one
// flat numbered sequence, and "results persist for the whole run" (this ticket's own requirement
// 1) reads as one run-wide store, not one store per nested script. A step's `queryText` (script.ts,
// this ticket) may reference an earlier stored result via stored_results.ts's placeholder syntax;
// substitution happens here, immediately before that step's `execute()` call, and is recorded on
// its StepRunRecord (`querySubstitution`, `instrumentLines`) before the step's own effect is known
// -- so a reader can always see what was inserted, per requirement 5, even if the step then fails.
//
// STAGE 2: a step whose ScriptStepRef.bothApply is true runs TWO executors from the SAME prior
// state -- `options.sourceExecute` (the source being asked to apply, e.g. Google) and `execute`
// (this function's own 4th positional argument, which for a bothApply step means the Cascade's own
// application -- see RunScriptOptions.sourceExecute's own doc for why `execute` keeps this
// meaning). BOTH results are stored, neither ever overwrites the other, and `current` state always
// continues from the CASCADE's (`execute`'s) result -- BP151 is not overturned, "the Cascade still
// applies and is still essential" (FD-BP152-21). The two are compared (plain string equality on
// their extracted result text) and the comparison is recorded on the StepRunRecord as `bothApply`:
// agreement is corroboration, disagreement is a FINDING surfaced as `agree: false` -- this
// comparison never picks a winner, never weights, never abstains automatically. A bothApply step
// reached with no `sourceExecute` supplied fails loudly (an Error, caught the same way any other
// step failure is) rather than silently running only the Cascade's side.
//
// Both additions are ADDITIVE to the existing MethodExecutor/StepRunRecord/RunResult/runScript
// contracts: every new field and parameter is optional, so a caller that never sets `queryText` or
// `bothApply` on any ScriptStepRef, and never passes the new `options` argument, sees byte-
// identical behavior to this file before this ticket (proven by script_runner.test.ts's own
// pre-existing assertions (a)-(f), unmodified).

import type { MethodIdentity, ResolvedRef, Script, ScriptResolver } from './script';
import {
  formatParserInstrumentLines,
  ResultStore,
  substitutePlaceholders,
  DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH,
  type StoredStepResult,
} from './stored_results';

export type { StoredStepResult } from './stored_results';

/** Executes exactly one PRIMITIVE (leaf) step: takes the prior state, returns the next state.
 *  Supplied by the caller -- script_runner.ts never calls a real method itself (comparative
 *  cascade, survey, etc. are all out of this ticket's scope). May return a Promise so a future
 *  wiring of an async method (one that issues a Google query, for instance) needs no change to
 *  this file's own contract.
 *
 *  D-BP152-046: `resolvedQueryText` is the step's own `queryText` (script.ts) AFTER placeholder
 *  substitution -- `undefined` when the step carries no `queryText` at all, exactly the same as
 *  before this ticket. Appended as a third, optional parameter so an executor written against the
 *  original two-parameter contract (e.g. script_bridge.ts's `runComposedStack()`, a concurrent
 *  dispatch this ticket does not touch) remains valid without any change on its part -- JavaScript
 *  ignores an argument a function does not declare, and TypeScript accepts a function with fewer
 *  declared parameters wherever a function type with more is expected. */
export type MethodExecutor<S> = (identity: MethodIdentity, state: S, resolvedQueryText?: string) => S | Promise<S>;

export type StepRunStatus = 'ok' | 'failed';

/** One entry in the run transcript. A reader can see the whole run as a sequence from this array
 *  alone, without opening any log. */
export interface StepRunRecord {
  /** The NameNumbered id that ran -- a primitive method's id, or a nested script's own
   *  identity.id. */
  id: string;
  /** Distinguishes a composite (nested script) entry from a primitive one, so a reader can tell
   *  which is which at a glance -- required by this ticket's own assertion (c). */
  kind: 'method' | 'script';
  /** Nesting depth: 0 for a step in the top-level script, 1 for a step inside a script nested one
   *  level deep, and so on. */
  depth: number;
  status: StepRunStatus;
  /** Human-readable description of what changed in `state` across this step, computed generically
   *  (see describeStateChange() below) -- never a claim about correctness, only about difference. */
  whatChanged: string;
  /** Wall-clock milliseconds this step (and, for a 'script' entry, everything nested inside it)
   *  took to run. */
  durationMs: number;
  /** Present only when status === 'failed'. */
  error?: string;
  /** Present only for kind === 'script' entries -- the nested script's OWN step-by-step
   *  transcript, in its own authored order. This is what "the transcript must show the nesting"
   *  means: a composite entry carries its children inline, at depth + 1. */
  children?: StepRunRecord[];
  /** D-BP152-046 STAGE 1/2: this step's 1-based position in the run's own flattened execution
   *  order -- the SAME number `[insert stored result from N.]` addresses (stored_results.ts).
   *  Present on every 'method' entry (leaf steps are what get stored/addressed, per this file's
   *  own header); absent on a 'script' (composite) entry, which occupies no position of its own. */
  position?: number;
  /** D-BP152-046 STAGE 1/2: present only when this step's ScriptStepRef carried a `queryText`
   *  template. The literal query text before and after placeholder substitution -- "a reader must
   *  see what was inserted" (this ticket's own requirement 5). Present even when substitution
   *  FAILED (status will be 'failed' in that case): `after` then equals `before` verbatim, since no
   *  substitution actually took place -- `instrumentLines` and `error` carry the failure reason. */
  querySubstitution?: { before: string; after: string };
  /** D-BP152-046 STAGE 1/2: the same before/after, formatted as "PARSER INSTRUMENT"-labeled lines
   *  in survey_stage.ts's own established style (see stored_results.ts's
   *  formatParserInstrumentLines() for the exact convention this reuses) -- generated here so a
   *  future wiring ticket can forward them to a real MethodRunContext's ctx.emit() unchanged. */
  instrumentLines?: string[];
  /** D-BP152-046 STAGE 2/2, FD-BP152-21: present only when this step's ScriptStepRef.bothApply is
   *  true. Both the source's and the Cascade's own application of this step's criteria, run
   *  independently from the same prior state -- NEITHER ever overwrites the other, both are always
   *  present here side by side. `agree` is a plain comparison, never a decision: it does not pick a
   *  winner, weight either side, or cause an automatic abstain. A disagreement (`agree: false`) is
   *  a FINDING, surfaced here, and the run continues normally -- `current` state after this step
   *  always comes from `cascadeResult` (see this file's own header). */
  bothApply?: {
    sourceResult: string;
    cascadeResult: string;
    agree: boolean;
    note: string;
  };
}

export type RunResult<S> =
  | { ok: true; finalState: S; steps: StepRunRecord[]; storedResults: StoredStepResult[] }
  | {
      ok: false;
      /** The id of the step that actually failed -- if it failed inside a nested script, this is
        * the nested PRIMITIVE's id, not the wrapping script's id, so the report names the real
        * culprit. */
      failedId: string;
      error: string;
      /** The full transcript up to and including the failed step. Nothing after the failure ran
       *  -- per this ticket's rule, a failure stops the run rather than continuing with partial
       *  state. */
      steps: StepRunRecord[];
      /** The state as it stood immediately before the failing step ran, kept only for
       *  diagnostics. The run itself never proceeds past this point on this state. */
      stateAtFailure: S;
      /** D-BP152-046 STAGE 1/2: every step's stored result up to and including the last step that
       *  actually completed before the failure -- "results persist for the whole run" holds even
       *  on a failed run, so a reader can see exactly what was available for substitution at the
       *  point it broke. */
      storedResults: StoredStepResult[];
    };

/** D-BP152-046: optional, additive capabilities runScript() accepts. Every field is optional and
 *  every field's absence reproduces this file's exact pre-existing behavior -- see this file's own
 *  header for the full accounting. Bundled into one options object (rather than more positional
 *  parameters) so a caller opting into none of this ticket's features, like script_bridge.ts's
 *  existing four-argument call, needs no change at all. */
export interface RunScriptOptions<S> {
  /** D-BP152-046 STAGE 1/2: extracts this step's own "result" as plain text from its output state,
   *  for storage (requirement 1) and later placeholder substitution (requirement 2). Defaults to
   *  `JSON.stringify(state)` when omitted -- always produces SOME storable text, never throws,
   *  and never truncates what it extracts (requirement 6's truncation rule concerns a SUBSTITUTED
   *  query, not this extraction). */
  extractResult?: (state: S, identity: MethodIdentity) => string;
  /** D-BP152-046 STAGE 1/2: the character ceiling past which a SUBSTITUTED query is refused rather
   *  than silently truncated (requirement 6). TARE -- see stored_results.ts's own
   *  DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH doc for why this number is unattributed and reused from
   *  an existing convention rather than Founder-ordered. Defaults to that constant. */
  maxSubstitutedQueryLength?: number;
  /** D-BP152-046 STAGE 2/2, FD-BP152-21: the "source" executor (e.g. Google) for a step whose
   *  ScriptStepRef.bothApply is true. This function's own 4th positional argument, `execute`,
   *  keeps its existing meaning for every non-bothApply step and, ON a bothApply step specifically,
   *  is read as the Cascade's own application -- chosen because `execute` is already what a caller
   *  wires as the authoritative "this is what actually decides" executor (see script_bridge.ts's
   *  own `runOneStep()`, which already resolves a step id to the real Cascade methods), and BP151
   *  ("the Cascade still applies and is still essential") means the Cascade's result is what
   *  `current` state must continue from. `sourceExecute` is the SECOND, additional opinion this
   *  ticket adds -- required only for a script that actually contains a bothApply step; reaching
   *  one with no `sourceExecute` supplied fails that step loudly rather than silently running only
   *  the Cascade's side. */
  sourceExecute?: MethodExecutor<S>;
}

function defaultExtractResult<S>(state: S): string {
  return JSON.stringify(state);
}

/** Injectable clock, purely for deterministic tests -- defaults to the real one. Same pattern
 *  laboratory_store.ts's SaveLaboratoryStepInput.now already uses. */
export type Clock = () => number;

const REAL_CLOCK: Clock = () => Date.now();

/** Generic before/after description with no knowledge of what `state` means. If both sides are
 *  plain objects, lists which top-level keys were added/removed/changed (JSON-value comparison
 *  per key); otherwise falls back to a whole-value JSON comparison. This is descriptive only --
 *  it never influences execution or the run's outcome, so it carries no HARDWIRE-23 attribution
 *  concern (per that law's own "What This Law Does Not Do": no branch here changes which answer
 *  comes out). */
export function describeStateChange(before: unknown, after: unknown): string {
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    for (const key of keys) {
      const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
      const hasAfter = Object.prototype.hasOwnProperty.call(after, key);
      if (!hasBefore && hasAfter) added.push(key);
      else if (hasBefore && !hasAfter) removed.push(key);
      else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key);
    }
    if (!added.length && !removed.length && !changed.length) return 'no change';
    const parts: string[] = [];
    if (added.length) parts.push(`added ${added.sort().join(', ')}`);
    if (removed.length) parts.push(`removed ${removed.sort().join(', ')}`);
    if (changed.length) parts.push(`changed ${changed.sort().join(', ')}`);
    return parts.join('; ');
  }

  const beforeJson = JSON.stringify(before);
  const afterJson = JSON.stringify(after);
  return beforeJson === afterJson ? 'no change' : 'value changed';
}

/**
 * Runs `script` against `initialState`, in authored order. Each step receives exactly the prior
 * step's output. A nested script (a ScriptStepRef whose id resolves to 'script') runs inline,
 * its own steps threaded through the same state chain, recorded as a 'script' entry whose
 * `children` hold its own transcript one depth deeper -- that is how a composite is told apart
 * from a primitive in the output.
 *
 * A failing step (execute() throws, or its returned Promise rejects) stops the run immediately:
 * no subsequent step runs, no default is substituted, and the returned RunResult carries
 * ok: false with the real failing id and the transcript up to that point. Nothing here retries.
 *
 * Defensive runtime cycle guard: script.ts's validateScript() is the authority that REJECTS a
 * cyclic script at load time (this ticket's assertion (d)); this runner additionally refuses to
 * recurse into a Script id already on its own ancestor chain, so a Script object built by hand
 * and never validated cannot hang the process. This does not change which step runs when the
 * input is valid -- it only prevents the infinite loop FD-BP152-20 calls "the worst possible
 * failure here" when validation was bypassed.
 */
export async function runScript<S>(
  script: Script,
  initialState: S,
  resolve: ScriptResolver,
  execute: MethodExecutor<S>,
  options: RunScriptOptions<S> = {},
  clock: Clock = REAL_CLOCK,
): Promise<RunResult<S>> {
  const resultStore = new ResultStore();
  const position = { next: 1 };
  const extractResult = options.extractResult ?? defaultExtractResult;
  const maxSubstitutedQueryLength = options.maxSubstitutedQueryLength ?? DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH;
  const outcome = await runSteps(
    script,
    [script.identity.id],
    0,
    initialState,
    resolve,
    execute,
    clock,
    resultStore,
    position,
    extractResult,
    maxSubstitutedQueryLength,
    options.sourceExecute,
  );
  if (outcome.status === 'ok') {
    return { ok: true, finalState: outcome.state, steps: outcome.records, storedResults: resultStore.all() };
  }
  return {
    ok: false,
    failedId: outcome.failedId,
    error: outcome.error,
    steps: outcome.records,
    stateAtFailure: outcome.state,
    storedResults: resultStore.all(),
  };
}

type StepsOutcome<S> =
  | { status: 'ok'; state: S; records: StepRunRecord[] }
  | { status: 'failed'; state: S; failedId: string; error: string; records: StepRunRecord[] };

async function runSteps<S>(
  script: Script,
  ancestors: string[],
  depth: number,
  state: S,
  resolve: ScriptResolver,
  execute: MethodExecutor<S>,
  clock: Clock,
  resultStore: ResultStore,
  position: { next: number },
  extractResult: (state: S, identity: MethodIdentity) => string,
  maxSubstitutedQueryLength: number,
  sourceExecute: MethodExecutor<S> | undefined,
): Promise<StepsOutcome<S>> {
  const records: StepRunRecord[] = [];
  let current = state;

  for (const stepRef of script.steps) {
    const resolved: ResolvedRef = resolve(stepRef.id);

    if (resolved.kind === 'unresolved') {
      const error = `step "${stepRef.id}" does not resolve to any registered method or saved script`;
      records.push({
        id: stepRef.id,
        kind: 'method',
        depth,
        status: 'failed',
        whatChanged: 'not run',
        durationMs: 0,
        error,
      });
      return { status: 'failed', state: current, failedId: stepRef.id, error, records };
    }

    if (resolved.kind === 'method') {
      // D-BP152-046 STAGE 1/2: this step's position in the run's own flattened execution order --
      // assigned as soon as the step is KNOWN to run (id resolved), before its own outcome is
      // known, so "position N" always means "the Nth step actually attempted," matching what an
      // operator sees scroll past on the bench.
      const stepPosition = position.next;
      position.next += 1;

      let resolvedQueryText: string | undefined;
      let querySubstitution: { before: string; after: string } | undefined;
      let instrumentLines: string[] | undefined;

      if (stepRef.queryText !== undefined) {
        const sub = substitutePlaceholders(stepRef.queryText, resultStore, maxSubstitutedQueryLength);
        instrumentLines = formatParserInstrumentLines(resolved.identity.id, sub);
        querySubstitution = { before: sub.before, after: sub.ok ? sub.after : sub.before };
        if (!sub.ok) {
          // Requirement 4 (unresolved reference) and requirement 6 (oversized substitution) both
          // land here -- substitutePlaceholders() names which one in `sub.error`. Either way: stop
          // the run, name the reference/limit, never substitute empty, skip, guess, or truncate.
          records.push({
            id: resolved.identity.id,
            kind: 'method',
            depth,
            status: 'failed',
            whatChanged: 'not run -- query text placeholder substitution failed',
            durationMs: 0,
            error: sub.error,
            position: stepPosition,
            querySubstitution,
            instrumentLines,
          });
          return { status: 'failed', state: current, failedId: resolved.identity.id, error: sub.error, records };
        }
        resolvedQueryText = sub.after;
      }

      const before = current;
      const t0 = clock();
      try {
        let after: S;
        let bothApplyRecord: StepRunRecord['bothApply'] = undefined;

        if (stepRef.bothApply) {
          // D-BP152-046 STAGE 2/2, FD-BP152-21: BOTH the source and the Cascade apply, from the
          // SAME prior state ("as a check on each other" -- neither is derived from the other's
          // output). Neither ever overwrites the other; `current` continues from the Cascade's
          // result only (`execute`'s own doc, RunScriptOptions.sourceExecute).
          if (!sourceExecute) {
            throw new Error(
              `step "${resolved.identity.id}" is marked bothApply but no sourceExecute was `
              + 'supplied to runScript() -- refusing to run only the Cascade\'s side of a '
              + 'dual-apply step (FD-BP152-21)',
            );
          }
          const [sourceAfter, cascadeAfter] = await Promise.all([
            Promise.resolve(sourceExecute(resolved.identity, current, resolvedQueryText)),
            Promise.resolve(execute(resolved.identity, current, resolvedQueryText)),
          ]);
          after = cascadeAfter;
          const sourceResultText = extractResult(sourceAfter, resolved.identity);
          const cascadeResultText = extractResult(cascadeAfter, resolved.identity);
          const agree = sourceResultText.trim() === cascadeResultText.trim();
          bothApplyRecord = {
            sourceResult: sourceResultText,
            cascadeResult: cascadeResultText,
            agree,
            note: agree
              ? 'agreement -- independent corroboration; the source and the Cascade applied the '
                + 'same criteria and reached the same result'
              : 'DISAGREEMENT -- surfaced as a finding, not resolved (FD-BP152-21): no winner '
                + 'picked, no weighting, no automatic abstain',
          };
        } else {
          after = await execute(resolved.identity, current, resolvedQueryText);
        }

        const durationMs = clock() - t0;
        const resultText = extractResult(after, resolved.identity);
        resultStore.store({ position: stepPosition, id: resolved.identity.id, result: resultText });
        records.push({
          id: resolved.identity.id,
          kind: 'method',
          depth,
          status: 'ok',
          whatChanged: describeStateChange(before, after),
          durationMs,
          position: stepPosition,
          ...(querySubstitution ? { querySubstitution, instrumentLines } : {}),
          ...(bothApplyRecord ? { bothApply: bothApplyRecord } : {}),
        });
        current = after;
      } catch (err) {
        const durationMs = clock() - t0;
        const error = err instanceof Error ? err.message : String(err);
        records.push({
          id: resolved.identity.id,
          kind: 'method',
          depth,
          status: 'failed',
          whatChanged: 'not applied -- step raised an error',
          durationMs,
          error,
          position: stepPosition,
          ...(querySubstitution ? { querySubstitution, instrumentLines } : {}),
        });
        return { status: 'failed', state: current, failedId: resolved.identity.id, error, records };
      }
      continue;
    }

    // resolved.kind === 'script': nested script runs inline, one depth deeper.
    const nestedId = resolved.script.identity.id;
    if (ancestors.includes(nestedId)) {
      // Defensive runtime guard only -- see this file's header. A validated script never reaches
      // this branch, since validateScript() rejects the cycle before any run begins.
      const cycle = [...ancestors, nestedId].join(' -> ');
      const error = `cycle detected at run time (script was not validated first): ${cycle}`;
      records.push({
        id: nestedId,
        kind: 'script',
        depth,
        status: 'failed',
        whatChanged: 'not run',
        durationMs: 0,
        error,
      });
      return { status: 'failed', state: current, failedId: nestedId, error, records };
    }

    const before = current;
    const t0 = clock();
    const nestedOutcome = await runSteps(
      resolved.script,
      [...ancestors, nestedId],
      depth + 1,
      current,
      resolve,
      execute,
      clock,
      resultStore,
      position,
      extractResult,
      maxSubstitutedQueryLength,
      sourceExecute,
    );
    const durationMs = clock() - t0;

    if (nestedOutcome.status === 'failed') {
      records.push({
        id: nestedId,
        kind: 'script',
        depth,
        status: 'failed',
        whatChanged: describeStateChange(before, nestedOutcome.state),
        durationMs,
        error: `nested script "${nestedId}" failed at step "${nestedOutcome.failedId}": ${nestedOutcome.error}`,
        children: nestedOutcome.records,
      });
      return {
        status: 'failed',
        state: nestedOutcome.state,
        failedId: nestedOutcome.failedId,
        error: nestedOutcome.error,
        records,
      };
    }

    records.push({
      id: nestedId,
      kind: 'script',
      depth,
      status: 'ok',
      whatChanged: describeStateChange(before, nestedOutcome.state),
      durationMs,
      children: nestedOutcome.records,
    });
    current = nestedOutcome.state;
  }

  return { status: 'ok', state: current, records };
}
