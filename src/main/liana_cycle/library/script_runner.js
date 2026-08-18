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
import { formatParserInstrumentLines, ResultStore, substitutePlaceholders, DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH, } from './stored_results';
function defaultExtractResult(state) {
    return JSON.stringify(state);
}
const REAL_CLOCK = () => Date.now();
/** Generic before/after description with no knowledge of what `state` means. If both sides are
 *  plain objects, lists which top-level keys were added/removed/changed (JSON-value comparison
 *  per key); otherwise falls back to a whole-value JSON comparison. This is descriptive only --
 *  it never influences execution or the run's outcome, so it carries no HARDWIRE-23 attribution
 *  concern (per that law's own "What This Law Does Not Do": no branch here changes which answer
 *  comes out). */
export function describeStateChange(before, after) {
    const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
    if (isPlainObject(before) && isPlainObject(after)) {
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        const added = [];
        const removed = [];
        const changed = [];
        for (const key of keys) {
            const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
            const hasAfter = Object.prototype.hasOwnProperty.call(after, key);
            if (!hasBefore && hasAfter)
                added.push(key);
            else if (hasBefore && !hasAfter)
                removed.push(key);
            else if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
                changed.push(key);
        }
        if (!added.length && !removed.length && !changed.length)
            return 'no change';
        const parts = [];
        if (added.length)
            parts.push(`added ${added.sort().join(', ')}`);
        if (removed.length)
            parts.push(`removed ${removed.sort().join(', ')}`);
        if (changed.length)
            parts.push(`changed ${changed.sort().join(', ')}`);
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
export async function runScript(script, initialState, resolve, execute, options = {}, clock = REAL_CLOCK) {
    const resultStore = new ResultStore();
    const position = { next: 1 };
    const extractResult = options.extractResult ?? defaultExtractResult;
    const maxSubstitutedQueryLength = options.maxSubstitutedQueryLength ?? DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH;
    const outcome = await runSteps(script, [script.identity.id], 0, initialState, resolve, execute, clock, resultStore, position, extractResult, maxSubstitutedQueryLength, options.sourceExecute);
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
async function runSteps(script, ancestors, depth, state, resolve, execute, clock, resultStore, position, extractResult, maxSubstitutedQueryLength, sourceExecute) {
    const records = [];
    let current = state;
    for (const stepRef of script.steps) {
        const resolved = resolve(stepRef.id);
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
            let resolvedQueryText;
            let querySubstitution;
            let instrumentLines;
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
                let after;
                let bothApplyRecord = undefined;
                if (stepRef.bothApply) {
                    // D-BP152-046 STAGE 2/2, FD-BP152-21: BOTH the source and the Cascade apply, from the
                    // SAME prior state ("as a check on each other" -- neither is derived from the other's
                    // output). Neither ever overwrites the other; `current` continues from the Cascade's
                    // result only (`execute`'s own doc, RunScriptOptions.sourceExecute).
                    if (!sourceExecute) {
                        throw new Error(`step "${resolved.identity.id}" is marked bothApply but no sourceExecute was `
                            + 'supplied to runScript() -- refusing to run only the Cascade\'s side of a '
                            + 'dual-apply step (FD-BP152-21)');
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
                }
                else {
                    after = await execute(resolved.identity, current, resolvedQueryText);
                }
                const durationMs = clock() - t0;
                const resultText = extractResult(after, resolved.identity);
                // D-BP152-049 STAGE 2/4: the stored entry itself carries `bothApply` (both texts) whenever
                // this step was bothApply -- its PRESENCE is what makes stored_results.ts's
                // substitutePlaceholders() refuse a BARE placeholder referencing this step and demand the
                // explicit "(source)"/"(cascade)" form instead (Founder, BP152, verbatim: "I want it to
                // refuse and make me say which"). `result` keeps carrying the Cascade's text unchanged --
                // this is unrelated to which text `current` state continues from (still the Cascade's,
                // unchanged, see this file's own header) -- it only concerns placeholder resolution.
                resultStore.store({
                    position: stepPosition,
                    id: resolved.identity.id,
                    result: resultText,
                    ...(bothApplyRecord
                        ? { bothApply: { sourceResult: bothApplyRecord.sourceResult, cascadeResult: bothApplyRecord.cascadeResult } }
                        : {}),
                });
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
            }
            catch (err) {
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
        const nestedOutcome = await runSteps(resolved.script, [...ancestors, nestedId], depth + 1, current, resolve, execute, clock, resultStore, position, extractResult, maxSubstitutedQueryLength, sourceExecute);
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
