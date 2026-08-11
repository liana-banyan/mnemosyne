// script.ts -- D-BP152-041/BISHOP/seg-script-format-and-runner
//
// THE SCRIPT FORMAT. Ratified rulings:
//   LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP152.md FD-BP152-20, FD-BP152-09, FD-BP152-10,
//   FD-BP152-07.
//
// Founder, BP152, FD-BP152-20, verbatim: "Do you recall what i said about being able to pick and
// choose named/numbered methods and place them in whatever order I want, in order for them to
// execute? It's like that old MIT programming game for kids called Scratch... I want to use it to
// stack methods in whatever order I want - I don't need the lego shapes, I just want them
// NameNumbered (so that we can have iterations galore) as methods so that I can mix and match as I
// please."
//
// Founder, BP152, FD-BP152-09, verbatim: "Survey needs to just be a method step, that I can apply
// or not, as part of a script that is applied... Then I have a toolbox, and I can use what tool I
// think will work, experimenting in the lab, until I find a sequence I like that gets a result I
// want, even if THAT sequence then gets saved as 'Step One' in a new bigger sequence." His own
// four-line model, quoted in full because every one of the four is load-bearing here: "Everything
// is a STEP... A SCRIPT is an ordered sequence of steps... A SAVED SEQUENCE IS ITSELF A STEP...
// There are no modes and no flags."
//
// A SCRIPT IS AN ORDERED LIST OF Name:Number REFERENCES. Execution order IS array order --
// reordering `steps` is the entire "stack methods in whatever order I want" feature; nothing else
// in this file decides execution order. A Script carries its OWN MethodIdentity, because per
// FD-BP152-09 a saved sequence is itself a step and must be referenceable from inside a bigger
// script exactly the way a primitive method is. That recursion is implemented here (ResolvedRef's
// 'script' branch, and validateScript's own recursive cycle walk) -- it is not left aspirational.
//
// UNWIRED. Nothing in this file is imported by liana_terminal_engine.ts or any live run path, and
// nothing here touches comparative_cascade.ts / definitional_cascade.ts / classify_cascade.ts /
// survey_stage.ts. This ticket builds the capability only; wiring it into a real run is a separate
// ruling -- FD-BP152-20's text orders the format ("NameNumbered... mix and match"), not wiring.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE SHARED CONTRACT.
//
// D-BP152-040 (a concurrent dispatch, same library/ directory) owns method_identity.ts and
// method_registry.ts -- `MethodIdentity {name, number, id}` where `id === \`${name}:${number}\``,
// plus register / lookup-by-id / list / latest-for-name. This file does not create or edit either
// of those two files, per this ticket's boundary, and does not duplicate their registry logic
// anywhere below: resolving an id to a method or to a nested Script is entirely the CALLER's
// responsibility, injected as a ScriptResolver (below). script.ts never looks anything up in a
// registry itself -- it only walks whatever ScriptResolver it is handed.
//
// method_identity.ts landed on this branch partway through this ticket's own build (verified: it
// was absent from library/ at the start of this session, present by the time this file was
// finished). MethodIdentity and makeMethodIdentity() are therefore imported directly from it
// below rather than shimmed locally -- confirmed byte-for-byte compatible with the fixed contract
// this ticket was briefed against (`{name: string, number: number, id: string}`,
// `id === \`${name}:${number}\``). No local redeclaration remains in this file.
//
// ATTRIBUTION PER STEP. "Each entry carries its attribution (whose rule it is, or TARE)" reuses
// StepAttribution (step_declaration.ts, D-BP152-018) rather than inventing a second attribution
// shape -- the same discipline laboratory_store.ts already follows for its own saved records.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP152-046/BISHOP/seg-stored-results-and-both-apply, STAGE 1/2 AND STAGE 2/2 -- ADDED HERE.
//
// FD-BP152-21, Founder verbatim: "build the stored results... on your point about step 4, I want
// both - I want to be able to ask Google, and I also want the Cascade to apply, as a check on each
// other, so just make both results stored." ScriptStepRef gains two new OPTIONAL fields --
// `queryText` (stage 1, commit 38416c66: this step's editable query template, which may reference
// an earlier step's stored result via stored_results.ts's placeholder syntax) and `bothApply`
// (stage 2, this commit: marks a step where the source's and the Cascade's own application both
// run and both are stored). Both are additive: every field that already existed keeps its exact
// prior meaning, and a ScriptStepRef built before this ticket (no queryText, no bothApply) parses
// and runs exactly as it did before. See stored_results.ts and script_runner.ts for the
// substitution/dual-apply mechanics.

import { readFileSync } from 'node:fs';
import type { StepAttribution } from './step_declaration';
export type { MethodIdentity } from './method_identity';
export { makeMethodIdentity } from './method_identity';
import type { MethodIdentity } from './method_identity';

/** One reference inside a Script's ordered step list. */
export interface ScriptStepRef {
  /** The NameNumbered id this step refers to -- either a primitive method's MethodIdentity.id or
   *  another Script's own identity.id. Format `${name}:${number}`, per the shared contract. */
  id: string;
  /** Per HARDWIRE-23 Law 4/5: whose rule authorizes this step being in this script, or TARE if
   *  nobody has ordered it yet. Reused from step_declaration.ts, not reinvented. */
  attribution: StepAttribution;
  /** Optional human note on why this step sits in this position. Documentation only -- never
   *  read by the runner, never a decision input. */
  note?: string;
  /** D-BP152-046 STAGE 1/2, FD-BP152-21: this step's literal, editable query text template. May
   *  contain zero or more `[insert stored result from <ref>.]` placeholders referencing an EARLIER
   *  step's stored result (stored_results.ts owns the exact syntax and substitution rule --
   *  literal text replacement only, HARDWIRE-22, nothing here interprets it). Only meaningful on a
   *  step that resolves to a primitive METHOD -- validateScript() below rejects it on a step that
   *  resolves to a nested Script, since a saved sequence has no single query text of its own.
   *  Optional: a step with no queryText runs exactly as it did before this ticket. */
  queryText?: string;
  /** D-BP152-046 STAGE 2/2, FD-BP152-21: true only for a step that asks its source to APPLY the
   *  running criteria (eliminate / classify / select) -- see script_runner.ts's own header for
   *  what running such a step does (both the source's and the Cascade's own application run, and
   *  both are stored). Only meaningful on a step that resolves to a primitive METHOD, same
   *  restriction as queryText above. Optional, defaults to false/absent -- a step that omits this
   *  runs exactly as it did before this ticket. */
  bothApply?: boolean;
}

/** A SCRIPT IS AN ORDERED LIST OF Name:Number REFERENCES. Human-readable, hand-editable on disk,
 *  in the same spirit as resources/liana_survey_queries.json -- plain JSON, no binary encoding,
 *  no generated ids a human could not type themselves. */
export interface Script {
  /** The script's OWN identity. Because a saved sequence is itself a step (FD-BP152-09), a
   *  Script's `identity.id` can appear as a ScriptStepRef.id inside another Script's `steps` --
   *  that recursion is what makes a toolbox out of a pipeline, per his own words. */
  identity: MethodIdentity;
  /** What this sequence is for, in his words or the operator's. */
  description: string;
  /** ORDERED. Execution order IS array order -- reordering this array is the entire "mix and
   *  match" feature FD-BP152-20 orders. Nothing in script_runner.ts reorders it. */
  steps: ScriptStepRef[];
  /** Who authored this sequence -- "Founder" or an operator Stamp (per MEMORY.md's own
   *  attribution-unit convention). */
  savedBy: string;
  /** ISO 8601 UTC, when this version was written. */
  savedAt: string;
}

/** What resolving one step's id can mean: a primitive (leaf) method, another saved Script
 *  (nested step, the recursion), or nothing registered under that id at all. */
export type ResolvedRef =
  | { kind: 'method'; identity: MethodIdentity }
  | { kind: 'script'; script: Script }
  | { kind: 'unresolved' };

/** Supplied by the CALLER -- never implemented in this file. Looks an id up against whatever
 *  catalog of registered methods and saved scripts currently exists. script.ts owns no registry
 *  of its own: per this ticket's boundary, registry logic lives in method_registry.ts
 *  (D-BP152-040, concurrent) and is never duplicated here. A test or a future wiring ticket
 *  supplies its own ScriptResolver (e.g. backed by method_registry.ts's lookup-by-id once it
 *  lands, or an in-memory map for a unit test). */
export type ScriptResolver = (id: string) => ResolvedRef;

export type ScriptValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validate on load: every referenced id must resolve, and a script that references itself,
 * directly or through another script, must be REJECTED with the cycle named. Walks `steps`
 * depth-first, tracking the chain of Script ids currently being expanded ("ancestors"). A
 * primitive method reference never recurses -- only a 'script' resolution does, and only a
 * 'script' resolution can cycle. This is the load-time check that prevents the run-time
 * infinite loop FD-BP152-20's own text warns is "the worst possible failure here".
 */
export function validateScript(script: Script, resolve: ScriptResolver): ScriptValidationResult {
  return walkForCycles(script, [script.identity.id], resolve);
}

function walkForCycles(
  script: Script,
  ancestors: string[],
  resolve: ScriptResolver,
): ScriptValidationResult {
  for (let i = 0; i < script.steps.length; i++) {
    const stepRef = script.steps[i];
    const resolved = resolve(stepRef.id);
    if (resolved.kind === 'unresolved') {
      return {
        ok: false,
        error:
          `script "${script.identity.id}" step ${i + 1} ("${stepRef.id}") does not resolve to `
          + 'any registered method or saved script',
      };
    }
    if (resolved.kind === 'script') {
      // D-BP152-046: a nested Script (a saved sequence used as a step, FD-BP152-09) has no single
      // query text and no single "source vs Cascade" application of its own -- both fields below
      // are meaningful only on a leaf method step. Rejected here, at validate time, rather than
      // silently ignored at run time.
      if (stepRef.queryText !== undefined) {
        return {
          ok: false,
          error: `script "${script.identity.id}" step ${i + 1} ("${stepRef.id}") carries "queryText" `
            + 'but resolves to a nested script, not a primitive method -- a saved sequence has no '
            + 'single query text of its own',
        };
      }
      if (stepRef.bothApply) {
        return {
          ok: false,
          error: `script "${script.identity.id}" step ${i + 1} ("${stepRef.id}") carries `
            + '"bothApply" but resolves to a nested script, not a primitive method -- a saved '
            + 'sequence has no single source/Cascade application of its own',
        };
      }
      const nestedId = resolved.script.identity.id;
      if (ancestors.includes(nestedId)) {
        const cycle = [...ancestors, nestedId].join(' -> ');
        return { ok: false, error: `cycle detected: ${cycle}` };
      }
      const nestedResult = walkForCycles(resolved.script, [...ancestors, nestedId], resolve);
      if (!nestedResult.ok) return nestedResult;
    }
    // 'method' resolutions are leaves -- nothing further to walk.
  }
  return { ok: true };
}

export type ScriptParseResult = { ok: true; script: Script } | { ok: false; error: string };

/** Structural check that `raw` (already JSON.parse()'d) has the shape of a Script, with no
 *  reliance on TypeScript's own erased-at-runtime types. Returns the narrowed value on success so
 *  callers never need an `as Script` cast. */
export function parseScript(raw: unknown, resolve: ScriptResolver): ScriptParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'script file does not contain a JSON object' };
  }
  const obj = raw as Record<string, unknown>;

  const identity = obj.identity as Record<string, unknown> | undefined;
  if (
    !identity
    || typeof identity.name !== 'string'
    || typeof identity.number !== 'number'
    || typeof identity.id !== 'string'
  ) {
    return { ok: false, error: 'script "identity" must have {name: string, number: number, id: string}' };
  }
  if (identity.id !== `${identity.name}:${identity.number}`) {
    return {
      ok: false,
      error: `script identity.id "${identity.id}" does not match identity.name:identity.number `
        + `("${identity.name}:${identity.number}")`,
    };
  }

  if (!Array.isArray(obj.steps)) {
    return { ok: false, error: 'script "steps" must be an array' };
  }
  const steps: ScriptStepRef[] = [];
  for (let i = 0; i < obj.steps.length; i++) {
    const raw_i = obj.steps[i] as Record<string, unknown>;
    if (!raw_i || typeof raw_i.id !== 'string') {
      return { ok: false, error: `script step ${i + 1} is missing a string "id"` };
    }
    if (!raw_i.attribution || typeof raw_i.attribution !== 'object') {
      return { ok: false, error: `script step ${i + 1} ("${raw_i.id}") is missing "attribution"` };
    }
    const attribution = raw_i.attribution as StepAttribution;
    if (
      attribution.kind !== 'ATTRIBUTED'
      && attribution.kind !== 'TARE'
      && attribution.kind !== 'NO_DECISION_RULE'
    ) {
      return {
        ok: false,
        error: `script step ${i + 1} ("${raw_i.id}") has an unrecognized attribution.kind `
          + `("${String((attribution as { kind?: unknown }).kind)}")`,
      };
    }
    if (raw_i.queryText !== undefined && typeof raw_i.queryText !== 'string') {
      return { ok: false, error: `script step ${i + 1} ("${raw_i.id}") has a non-string "queryText"` };
    }
    if (raw_i.bothApply !== undefined && typeof raw_i.bothApply !== 'boolean') {
      return { ok: false, error: `script step ${i + 1} ("${raw_i.id}") has a non-boolean "bothApply"` };
    }
    steps.push({
      id: raw_i.id,
      attribution,
      note: typeof raw_i.note === 'string' ? raw_i.note : undefined,
      queryText: typeof raw_i.queryText === 'string' ? raw_i.queryText : undefined,
      bothApply: typeof raw_i.bothApply === 'boolean' ? raw_i.bothApply : undefined,
    });
  }

  if (typeof obj.description !== 'string') {
    return { ok: false, error: 'script "description" must be a string' };
  }
  if (typeof obj.savedBy !== 'string') {
    return { ok: false, error: 'script "savedBy" must be a string' };
  }
  if (typeof obj.savedAt !== 'string') {
    return { ok: false, error: 'script "savedAt" must be a string' };
  }

  const script: Script = {
    identity: { name: identity.name, number: identity.number, id: identity.id },
    description: obj.description,
    steps,
    savedBy: obj.savedBy,
    savedAt: obj.savedAt,
  };

  const validation = validateScript(script, resolve);
  if (!validation.ok) return { ok: false, error: validation.error };
  return { ok: true, script };
}

/**
 * Reads a script file from disk and parses + validates it (per parseScript()/validateScript()
 * above). Plain fs read, no caching, no watching -- matching this ticket's narrow scope. Never
 * throws: an unreadable file or malformed JSON is reported as `{ok: false, error}`, the same
 * never-throw convention laboratory_store.ts already uses for its own disk I/O.
 */
export function loadScriptFromFile(path: string, resolve: ScriptResolver): ScriptParseResult {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    return { ok: false, error: `could not read script file "${path}": ${err instanceof Error ? err.message : String(err)}` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `script file "${path}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  return parseScript(raw, resolve);
}
