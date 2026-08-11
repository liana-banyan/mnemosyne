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

import type { MethodIdentity, ResolvedRef, Script, ScriptResolver } from './script';

/** Executes exactly one PRIMITIVE (leaf) step: takes the prior state, returns the next state.
 *  Supplied by the caller -- script_runner.ts never calls a real method itself (comparative
 *  cascade, survey, etc. are all out of this ticket's scope). May return a Promise so a future
 *  wiring of an async method (one that issues a Google query, for instance) needs no change to
 *  this file's own contract. */
export type MethodExecutor<S> = (identity: MethodIdentity, state: S) => S | Promise<S>;

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
}

export type RunResult<S> =
  | { ok: true; finalState: S; steps: StepRunRecord[] }
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
    };

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
  clock: Clock = REAL_CLOCK,
): Promise<RunResult<S>> {
  const outcome = await runSteps(script, [script.identity.id], 0, initialState, resolve, execute, clock);
  if (outcome.status === 'ok') {
    return { ok: true, finalState: outcome.state, steps: outcome.records };
  }
  return {
    ok: false,
    failedId: outcome.failedId,
    error: outcome.error,
    steps: outcome.records,
    stateAtFailure: outcome.state,
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
      const before = current;
      const t0 = clock();
      try {
        const after = await execute(resolved.identity, current);
        const durationMs = clock() - t0;
        records.push({
          id: resolved.identity.id,
          kind: 'method',
          depth,
          status: 'ok',
          whatChanged: describeStateChange(before, after),
          durationMs,
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
