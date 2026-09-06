// composer_store.ts -- D-BP167-M0-049/BISHOP/seg-composer-persistence
//
// THE COMPOSER CAN NOW ACCUMULATE. Prior dispatch D-BP167-M0-033 (read-and-report) established
// that `composerStack` (LianaCycleTab.tsx) is an operator-authored, freely-reorderable ordered
// list of NameNumbered ids that is held only in React `useState` and vanishes the moment the tab
// unmounts or the app restarts -- confirmed again directly by this dispatch (no localStorage call
// touches `composerStack`, no IPC call persists it; see this ticket's own RETURN for the exact
// grep). The Founder's own remark that drove this dispatch (BP167): "if you see how compose
// works, you would understand that we seriously need to make more methods" -- and BP149's own
// ratified canon is that the Liana Cycle is a registry of named methods that grows by
// ACCUMULATION. A stack that evaporates on every unmount cannot accumulate. This file is the fix:
// a plain, human-readable, Rule-66-versioned on-disk record of one saved stack, load-bearing
// enough that a fresh session can reload the exact ordered list a prior session composed.
//
// NOT A DUPLICATE OF composer_claims_store.ts / composer_step_evidence.ts (checked, per L4/the
// BUILD-VERB gate, before writing this file). Those two persist a DIFFERENT fact: a derived
// per-step CLAIM (mechanism, corroboration span, keyed by acquisitionId+stepId) about one already-
// executed run of one step. This file persists a different fact entirely: the operator-authored
// RECIPE (the ordered list of NameNumbered ids itself, before or after any run) so it can be
// reloaded and re-edited in a later session. Neither existing file has a save/list/reload surface
// for `composerStack`; grepped for `composerStack`/`saveComposerStack`/`listComposerStack` in both
// files and in `composer_step_classification.ts` and found none.
//
// THE EXISTING STORAGE PATTERN IS REUSED, NOT FORKED. `laboratory_store.ts` (D-BP152-022) already
// solves this exact shape of problem for a different Composer artifact (one saved query, instead
// of one saved stack): plain JSON, one file per named record, in a folder under the operator's own
// Documents tree (outside app.asar, so a packaged build can write to it and an app update cannot
// silently overwrite it), with Rule 66 supersede-not-overwrite versioning. This module is the same
// pattern, same three justifications (readable without the app, writable from a packaged build,
// survives an update), applied to a stack instead of a query. No new database, no new format, no
// second registry -- see this ticket's RETURN doc, section 2, for the comparison against
// `method_registry.ts` (rejected as the save target: that file is the LIVE, code-loaded registry
// of already-registered LianaMethod cascades; writing an unreviewed operator stack into it would be
// exactly the "saving promotes" conflation this ticket's own instruction (item 4) forbids).
//
// SAVING DOES NOT PROMOTE. A saved stack is never a Method, is never added to
// `method_registry.ts`, and nothing in this file changes what `runLianaCycleQuestion()` computes
// or what `selectEligibleMethods()` returns. `promoted` below is always `false` and this module
// never sets it to `true` -- promotion into the live registry is a separate, deliberate,
// human-written act (registering a new `LianaMethod` in `method_registry.ts` by hand), exactly as
// Laboratory-to-Method promotion already works (FD-BP152-10's ladder: a success test, then the
// Founder's own decision, is what moves something out of Tier 1 -- never an automatic save).
//
// BP150 ORDERED-ELEMENTS STRUCTURE IS PRESERVED, NOT FLATTENED. `steps` below is the exact
// `composerStack: string[]` array the operator built in the UI, in run order, unchanged -- a
// method is "an ORDERED LIST of named reusable ELEMENTS, not a monolithic function" (BP150), and
// this record's whole shape is built around keeping that list intact end to end: what is saved is
// what is loaded, byte-for-byte, id-for-id, in the same order.
//
// PROVENANCE IS RECORDED BECAUSE IT IS WHAT MAKES THIS TEACHABLE, NOT JUST RUNNABLE. Founder,
// on the Composer's whole purpose: "I guide, I train, I give the Human Nuance, and you record."
// `savedBy`/`savedAt`/`provenance.runInput` below are exactly that record -- who composed it, when,
// and which question it was authored against -- carried alongside the steps themselves rather than
// left implicit, mirroring `LaboratoryStepRecord.provenance` (laboratory_store.ts) field for field.
//
// RULE 66: VERSION, NEVER OVERWRITE. Saving a name that already has a file renames the prior file
// to a ".superseded.<UTC-ts>.json" sibling FIRST (never deleted, never truncated), exactly the same
// mechanism laboratory_store.ts already implements -- reused here verbatim, not reinvented.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/** One saved Composer stack, as written to and read from disk. Human-readable, hand-editable
 *  JSON -- same convention as `LaboratoryStepRecord` (laboratory_store.ts). One file per named
 *  stack (plus any ".superseded.<ts>.json" siblings Rule 66 leaves behind). */
export interface ComposerStackRecord {
  /** His name for the stack, verbatim as typed. */
  name: string;
  /** The ordered NameNumbered ids, exactly as composerStack held them in the renderer -- the
   *  BP150 ordered-elements structure, preserved verbatim, never flattened or deduplicated
   *  (duplicates are allowed on purpose in the live Composer, "iterations galore" per
   *  script_bridge.ts's own header, and that is preserved here too). */
  steps: string[];
  /** Rule 66 plain-integer version, as a string ("1", "2", ...), same convention
   *  laboratory_store.ts already uses. */
  version: string;
  /** Who composed it. Defaults to "Founder" (every Composer session today is his), overridable
   *  for a future multi-operator session without a schema change. */
  savedBy: string;
  /** ISO 8601 UTC, the moment this version was written. */
  savedAt: string;
  /** Which question this stack was authored/last run against -- the raw text typed into the same
   *  question box the plain Run button and "Run this stack" both read (input.trim() at save
   *  time), matching LaboratoryStepRecord.provenance.runInput's shape exactly. */
  provenance: { runInput: string };
  /** ALWAYS false. This module never sets it true. A saved stack becoming a registered
   *  LianaMethod in method_registry.ts is a separate, deliberate, hand-written act -- see this
   *  file's header. Present (rather than omitted) so a human reading the JSON directly sees the
   *  line drawn, not just infers it from absence. */
  promoted: false;
}

function resolveComposerDir(): string {
  return process.env.LB_COMPOSER_DIR
    || 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\LIANA_COMPOSER_STACKS';
}

/** Same slug shape laboratory_store.ts's own slugify() uses -- reused, not reinvented. Never
 *  empty: falls back to "untitled" exactly as that function does. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return slug || 'untitled';
}

/** Matches laboratory_store.ts's own utcStamp() exactly -- the estate's standing Rule 66
 *  ".superseded.<UTC-ts>" format. */
function utcStamp(nowIso: string): string {
  return nowIso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

export interface SaveComposerStackInput {
  name: string;
  /** The composed ids, in run order. An empty array is refused below -- there is nothing to
   *  accumulate from an empty stack, and an empty-name-empty-stack save would be indistinguishable
   *  from a slip of the Save button. */
  steps: string[];
  provenance: { runInput: string };
  savedBy?: string;
  /** Injectable for tests; defaults to the real clock. */
  now?: () => string;
}

export type SaveComposerStackResult =
  | { ok: true; path: string; version: string; supersededPath: string | null }
  | { ok: false; error: string };

/**
 * Saves one Composer stack. RULE 66: if `name` already has a saved file, the PRIOR file is
 * renamed to a ".superseded.<UTC-ts>.json" sibling (untouched, never deleted) before the new
 * version is written. Never throws -- every failure mode (directory cannot be created/written, the
 * rename fails, the write fails, an empty name or empty stack) returns `{ok:false, error}` naming
 * the reason, mirroring saveLaboratoryStep()'s own contract exactly.
 */
export function saveComposerStack(input: SaveComposerStackInput): SaveComposerStackResult {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Composer save refused: no name given for this stack.' };
  const steps = Array.isArray(input.steps) ? input.steps.filter((s) => typeof s === 'string' && s.trim()) : [];
  if (steps.length === 0) {
    return { ok: false, error: 'Composer save refused: the stack is empty -- nothing to save yet.' };
  }
  const nowIso = (input.now ?? (() => new Date().toISOString()))();
  const dir = resolveComposerDir();
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    return {
      ok: false,
      error: `Composer directory "${dir}" could not be created or is not writable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const slug = slugify(name);
  const filePath = join(dir, `COMPOSER_STACK_${slug}.json`);

  let version = 1;
  let supersededPath: string | null = null;
  if (existsSync(filePath)) {
    let priorVersion = 0;
    try {
      const prior = JSON.parse(readFileSync(filePath, 'utf8')) as ComposerStackRecord;
      const parsed = Number.parseInt(prior?.version ?? '', 10);
      if (Number.isFinite(parsed) && parsed > 0) priorVersion = parsed;
    } catch {
      priorVersion = 0; // an unparseable prior file still gets versioned forward, from 0
    }
    version = priorVersion + 1;
    supersededPath = join(dir, `COMPOSER_STACK_${slug}.superseded.${utcStamp(nowIso)}.json`);
    try {
      renameSync(filePath, supersededPath);
    } catch (err) {
      return {
        ok: false,
        error: `Composer save refused: could not version the prior file at "${filePath}" (Rule 66 forbids overwriting it): ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const record: ComposerStackRecord = {
    name,
    steps,
    version: String(version),
    savedBy: input.savedBy ?? 'Founder',
    savedAt: nowIso,
    provenance: input.provenance,
    promoted: false,
  };

  try {
    writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  } catch (err) {
    return {
      ok: false,
      error: `Composer save refused: could not write "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return { ok: true, path: filePath, version: String(version), supersededPath };
}

/**
 * Every current (non-superseded) saved stack, newest first. An unreadable/missing directory
 * returns `[]` -- reported to the operator as "none found", never as proof none exist (per house
 * rule: a tool's empty result is not evidence of absence). A corrupt individual file is skipped
 * rather than crashing the whole list, mirroring listLaboratorySteps()'s own contract exactly.
 */
export function listComposerStacks(): ComposerStackRecord[] {
  const dir = resolveComposerDir();
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: ComposerStackRecord[] = [];
  for (const fileName of entries) {
    if (!fileName.startsWith('COMPOSER_STACK_') || !fileName.endsWith('.json')) continue;
    if (fileName.includes('.superseded.')) continue; // current versions only
    try {
      const record = JSON.parse(readFileSync(join(dir, fileName), 'utf8')) as ComposerStackRecord;
      out.push(record);
    } catch {
      continue; // a corrupt file is skipped, never crashes the whole list
    }
  }
  out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  return out;
}

/** Exposed for tests and for a human verifying where saved Composer stacks actually resolved to
 *  on a given machine/session -- never used inside this file to decide anything beyond the
 *  resolution itself. */
export function composerStackDirForDisplay(): string {
  return resolveComposerDir();
}
