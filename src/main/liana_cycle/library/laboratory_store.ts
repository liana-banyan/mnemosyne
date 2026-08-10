// laboratory_store.ts -- D-BP152-022/BISHOP/seg-laboratory-and-keep
//
// THE LABORATORY. Tier 1 of FD-BP152-10's three folders (LABORATORY -> CONTINGENCY OPERATORS ->
// PLAYBOOK -- use exactly these words, no synonyms, no "tier 1" in operator-facing text). Founder,
// BP152, verbatim: "...the Laboratory, we can call that CO bag, which is really a folder with all
// the step files and scripts and partial scripts etc that I as a user make in the Laboratory and
// save for another day..." This module is the on-disk store for that folder's contents, scoped
// narrowly to what D-BP152-022 actually builds: saving ONE query, typed or sent at the Step 0
// "Send to Google" pause (D-BP152-021, FD-BP152-15), as a named, versioned Laboratory step.
// Nothing here builds Contingency Operators, the Playbook, a promotion path, or a success test --
// FD-BP152-10 names those as separate, later work, and this ticket is explicitly forbidden from
// building any of them.
//
// EPHEMERAL REMAINS THE DEFAULT (FD-BP152-07). Nothing in this file is imported by the run path
// (requestStepZeroPause() in stepped_audible.ts, or liana_terminal_engine.ts) -- a typed query
// still vanishes exactly as it did at commit cb311a23 unless the operator explicitly invokes
// saveLaboratoryStep() below, via the renderer's own "Keep" control, a channel wholly separate
// from the existing approve/correct/redirect/ask_google stepped-pause actions (untouched by this
// ticket -- see liana_terminal_types.ts's own D-BP152-022 section for why).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHERE THIS LIVES, AND WHY -- justified against all three of D-BP152-022's stated criteria.
//
//   C:\Users\Administrator\Documents\LianaBanyanPlatform\LIANA_LABORATORY
//   (overridable via the LB_LABORATORY_DIR env var, the same override convention
//   query_text_loader.ts's LB_SURVEY_QUERIES_PATH already established for a different runtime
//   file -- this is what lets a test point at a throwaway directory and never touch the real one).
//
//   1. HE CAN FIND AND READ IT WITHOUT THE APP. Plain, human-readable, hand-editable JSON files in
//      a folder inside C:\Users\Administrator\Documents\LianaBanyanPlatform -- the SAME tree
//      index.ts's 'liana-teach-submit' handler already writes
//      BISHOP_DROPZONE\METHOD_TEACHING_*.md into, and the same tree he already reads directly with
//      a text editor every session. One file per named step, exactly this ticket's requirement 2.
//
//   2. A PACKAGED BUILD CAN WRITE TO IT. This path is not inside mnemosyne's install directory at
//      all -- it is not under app.asar (which is read-only at runtime) and it is not even under
//      the install directory's own extraResources 'resources/' folder. It is a plain, absolute
//      filesystem path in the OPERATOR'S OWN Documents tree, identical in shape to the
//      'liana-teach-submit' precedent this ticket named to read first (index.ts's own
//      DROPZONE_DIR = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE',
//      teaching_notes.ts:28). No asar-readonly concern applies, because this path was never
//      packaged into the app at all -- a packaged build's Node process writes to it with a plain
//      fs call, same as index.ts's teach-submit handler already does today.
//
//   3. IT SURVIVES AN APP UPDATE. This is WHY the 'liana-teach-submit' precedent was followed
//      instead of the resources/ extraResources precedent (commit 17e98679, query_text_loader.ts),
//      even though extraResources also writes outside app.asar. extraResources copies the REPO'S
//      OWN resources/liana_survey_queries.json into the installed app's resources/ folder as part
//      of EVERY build/install -- the file that ships IS the shipped default, refreshed on every
//      install. That is exactly right for Google query TEXT the Founder wants to iterate and
//      eventually commit back into the repo (D-BP152-008's own stated purpose: "fly through the
//      iterations"), but it is WRONG for operator-authored Laboratory steps: a fresh install or
//      update that repackages the app's own resources/ folder would silently overwrite or orphan
//      anything he had saved there between releases -- exactly the kind of "permanently changes
//      what is wired" FD-BP152-07 rules against, one level up (at the FILE-SURVIVAL level instead
//      of the run level). LIANA_LABORATORY sits entirely outside mnemosyne's install directory,
//      the same way BISHOP_DROPZONE already has across every mnemosyne rebuild this estate has
//      done -- an update to mnemosyne touches its own install directory only and never reaches
//      into C:\Users\Administrator\Documents\LianaBanyanPlatform.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE DECLARATION SHAPE IS REUSED, NOT FORKED. Per this ticket's own instruction ("reuse the
// existing declaration shape. Do not invent a second one."), every saved step's on-disk record
// wraps a full step_declaration.ts StepDeclaration (D-BP152-018, commit 69a405be) -- imported,
// never modified, and orphan_catalog.ts's own entries are neither read nor touched by this file.
// Two of StepDeclaration's fields do not map cleanly onto an operator-authored query
// (exportKind's closed union has no "operator-authored data" case; orphanEvidence is worded
// specifically for orphan-registration findings) -- both are populated with an honest note
// explaining the repurposing below, rather than silently left to imply something they are not.
// See LaboratoryStepRecord for the small envelope of fields StepDeclaration has no home for at
// all: the verbatim query text itself (the load-bearing copy), save metadata, and provenance.
//
// RULE 66: VERSION, NEVER OVERWRITE. Saving a name that already exists renames the prior file to
// a ".superseded.<UTC-ts>.json" sibling FIRST, then writes the new content fresh -- the prior
// content is never truncated, edited, or deleted, only renamed. "Version" here is a plain integer
// string ("1", "2", ...), assigned by this file -- NOT the "19:1"/"19:2" bench step-replacement
// notation FD-BP152-13 describes for scrubbing a RUNNING script, which this ticket is explicitly
// forbidden from building. Two unrelated mechanisms share the word "version"; this module
// implements only the Rule-66-shaped, file-level one.
//
// SAVING DOES NOT PROMOTE. This is Tier 1 only. Nothing written by this file is a Method, nothing
// is in the Playbook, and no success test ever runs against it -- FD-BP152-10's promotion ladder
// (a success test into Contingency Operators, the Founder's own decision into the Playbook) is
// out of scope and is not implemented anywhere in this module. No verdict language is used
// anywhere below -- not "pass", "good", "ready", or "promoted".

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { StepDeclaration } from './step_declaration';

/** One saved Laboratory step, as written to and read from disk. Human-readable, hand-editable
 *  JSON -- this ticket's requirement 2, literal, "like resources/liana_survey_queries.json". One
 *  file per named step (plus any ".superseded.<ts>.json" siblings Rule 66 leaves behind). */
export interface LaboratoryStepRecord {
  /** His name for it, verbatim as typed -- also mirrored into declaration.exportName below. */
  name: string;
  /** REUSES the existing step_declaration.ts shape (D-BP152-018) rather than inventing a second
   *  one -- see this file's header for the two fields that had to be repurposed, and how. */
  declaration: StepDeclaration;
  /** The query text, byte-identical to what was sent to Google (end-whitespace trimmed only --
   *  the SAME trim requestStepZeroPause() itself already applies before sending, FD-BP152-15).
   *  This is the LOAD-BEARING copy: Load reads THIS field, never
   *  declaration.queryText.description, which is documentation only, per step_declaration.ts's
   *  own comment on that field. */
  queryTextVerbatim: string;
  /** "Founder-authored" -- this ticket's requirement 2, literal. Every Laboratory step is
   *  operator-authored by construction: saveLaboratoryStep() is reachable only from the
   *  renderer's own "Keep" control (a new, additive IPC channel), never from any run path. */
  savedBy: string;
  /** ISO 8601 UTC, the moment this version was written. */
  savedAt: string;
  /** Always true -- every record this module writes came from the bench's Step 0 pause
   *  (D-BP152-021/-022), per this ticket's requirement 2 ("that it came from the bench"). */
  savedFromBench: true;
  /** Which qid/run this step was authored during -- this ticket's requirement 2, literal. The
   *  raw text the operator typed to start that run (e.g. "98", or a free-text question). */
  provenance: { runInput: string };
}

function resolveLaboratoryDir(): string {
  return process.env.LB_LABORATORY_DIR
    || 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\LIANA_LABORATORY';
}

/** Same slug shape index.ts's own 'liana-teach-submit' handler already uses for its filenames --
 *  reused, not reinvented. Never empty: falls back to "untitled" exactly as that handler does. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return slug || 'untitled';
}

/** Matches index.ts's own METHOD_TEACHING_ timestamp convention exactly (e.g.
 *  "20260810T211500Z"), which itself matches this estate's standing Rule 66
 *  ".superseded.<UTC-ts>" format -- reused, not reinvented. */
function utcStamp(nowIso: string): string {
  return nowIso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

export interface SaveLaboratoryStepInput {
  name: string;
  /** Not yet trimmed on entry -- this function applies the SAME end-only trim
   *  requestStepZeroPause() uses (FD-BP152-15: "no templating, no prefix, no suffix, no
   *  substitution, no reformatting"), so what is saved is guaranteed identical to what an
   *  ask_google round would have sent. */
  queryTextVerbatim: string;
  provenance: { runInput: string };
  savedBy?: string;
  /** Injectable for tests; defaults to the real clock. */
  now?: () => string;
}

export type SaveLaboratoryStepResult =
  | { ok: true; path: string; version: string; supersededPath: string | null }
  | { ok: false; error: string };

/**
 * Saves one Laboratory step. RULE 66: if `name` already has a saved file, the PRIOR file is
 * renamed to a ".superseded.<UTC-ts>.json" sibling (untouched, never deleted) before the new
 * version is written. Never throws -- every failure mode (directory cannot be created/written,
 * the rename fails, the write fails, an empty name or empty query) returns `{ok:false, error}`
 * naming the path and the reason, per this ticket's assertion (f): "a save into a missing/
 * unwritable directory reports the failure explicitly and never silently drops the query."
 */
export function saveLaboratoryStep(input: SaveLaboratoryStepInput): SaveLaboratoryStepResult {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Laboratory save refused: no name given for this step.' };
  // FD-BP152-15's own trim -- whitespace at the ends only, nothing else touches the query.
  const queryTextVerbatim = input.queryTextVerbatim.trim();
  if (!queryTextVerbatim) {
    return {
      ok: false,
      error: 'Laboratory save refused: no query text to save (nothing has been sent to Google yet in this pause).',
    };
  }
  const nowIso = (input.now ?? (() => new Date().toISOString()))();
  const dir = resolveLaboratoryDir();
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    return {
      ok: false,
      error: `Laboratory directory "${dir}" could not be created or is not writable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const slug = slugify(name);
  const filePath = join(dir, `LABORATORY_STEP_${slug}.json`);

  let version = 1;
  let supersededPath: string | null = null;
  if (existsSync(filePath)) {
    let priorVersion = 0;
    try {
      const prior = JSON.parse(readFileSync(filePath, 'utf8')) as LaboratoryStepRecord;
      const parsed = Number.parseInt(prior?.declaration?.version ?? '', 10);
      if (Number.isFinite(parsed) && parsed > 0) priorVersion = parsed;
    } catch {
      priorVersion = 0; // an unparseable prior file still gets versioned forward, from 0
    }
    version = priorVersion + 1;
    supersededPath = join(dir, `LABORATORY_STEP_${slug}.superseded.${utcStamp(nowIso)}.json`);
    try {
      renameSync(filePath, supersededPath);
    } catch (err) {
      return {
        ok: false,
        error: `Laboratory save refused: could not version the prior file at "${filePath}" (Rule 66 forbids overwriting it): ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const record: LaboratoryStepRecord = {
    name,
    declaration: {
      id: `laboratory.${slug}`,
      version: String(version),
      sourceFile: `LianaBanyanPlatform/LIANA_LABORATORY/LABORATORY_STEP_${slug}.json (this record itself -- operator-authored at the bench, no code source file)`,
      sourceLine: 0,
      exportName: name,
      exportKind: 'const',
      whatItDoes:
        'An operator-authored Google query, saved verbatim from the Liana Cycle bench\'s "Send to '
        + 'Google" pause action (D-BP152-021, FD-BP152-15), so it can be reloaded into the Step 0 '
        + 'text box on a later run.',
      inputs: '(none -- the query text is sent exactly as saved, with no parameters or substitution)',
      outputs:
        'Google\'s raw response text, returned to the Step 0 pause as new run state. Not itself '
        + 'persisted by this record -- only the query is saved.',
      decidesOrReports: 'REPORTS',
      queryText: {
        issuesQuery: true,
        description:
          'Documentation only, per step_declaration.ts\'s own convention for this field -- the '
          + 'load-bearing, byte-identical copy of the query is this record\'s own top-level '
          + '"queryTextVerbatim" field, not this one.',
        loadedFromQueryResource: false,
      },
      attribution: {
        kind: 'ATTRIBUTED',
        founderRuling: 'BP152',
        quote: 'It doesn\'t have to permanently change what is wired, just or that instance, unless I say keep',
        citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP152.md FD-BP152-07',
      },
      orphanEvidence:
        'N/A -- this field is inherited from StepDeclaration (D-BP152-018, built for orphan-'
        + 'registration entries) and is reused here only because D-BP152-022 was instructed to '
        + 'reuse the existing declaration shape rather than invent a second one. This record is '
        + 'NOT an orphan-registration entry and there is no "zero callers" finding to report. '
        + 'Provenance for THIS record (which qid/run it was authored during) is carried on the '
        + 'enclosing LaboratoryStepRecord\'s own "provenance" field instead, alongside this '
        + 'declaration.',
    },
    queryTextVerbatim,
    savedBy: input.savedBy ?? 'Founder',
    savedAt: nowIso,
    savedFromBench: true,
    provenance: input.provenance,
  };

  try {
    writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  } catch (err) {
    return {
      ok: false,
      error: `Laboratory save refused: could not write "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return { ok: true, path: filePath, version: String(version), supersededPath };
}

/**
 * Every current (non-superseded) saved step, newest first. An unreadable/missing directory
 * returns `[]` -- reported to the operator as "none found", never as proof none exist (same
 * convention teaching_notes.ts's listTeachingFiles() already uses -- "a tool's empty result is
 * not evidence of absence"). A corrupt individual file is skipped rather than crashing the list.
 */
export function listLaboratorySteps(): LaboratoryStepRecord[] {
  const dir = resolveLaboratoryDir();
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: LaboratoryStepRecord[] = [];
  for (const fileName of entries) {
    if (!fileName.startsWith('LABORATORY_STEP_') || !fileName.endsWith('.json')) continue;
    if (fileName.includes('.superseded.')) continue; // current versions only
    try {
      const record = JSON.parse(readFileSync(join(dir, fileName), 'utf8')) as LaboratoryStepRecord;
      out.push(record);
    } catch {
      continue; // a corrupt file is skipped, never crashes the whole list
    }
  }
  out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  return out;
}

/** Exposed for tests and for a human verifying where the Laboratory actually resolved to on a
 *  given machine/session -- never used inside this file to decide anything beyond the resolution
 *  itself. */
export function laboratoryDirForDisplay(): string {
  return resolveLaboratoryDir();
}
