// model_roster.ts -- D-BP223-M0-h2cbpo68-MODEL_ROSTER / SEG-M0 / BP223-MODEL_ROSTER
//
// Founder ruling 2026-09-08T02:32:58Z, verbatim: "Claude does pricing per model, and includes
// whatever iteration it is, so Haiku4.7 was replaced with 4.8 etc". The point behind that
// sentence: vendor model ids ROTATE by iteration, so a model id baked into TypeScript source as
// a literal string constant, and a price-table rate row keyed to that same literal, drift out of
// sync with the vendor's own catalog silently -- exactly the defect
// D-BP223-M0-h2cbpo68-032/SEG-M0/BP223-SAVINGS_INSTRUMENT found: ai_dispatch_ipc.ts's
// CHEAP_CLOUD_BRAIN dispatched 'claude-haiku-4-7', a string that does not appear anywhere on the
// vendor's live pricing page.
//
// This file is the ONE place a model id literal is allowed to exist in this codebase's real
// dispatch path (config/model_roster.json is the actual source of truth; this module is only the
// loader). Every other file that used to declare its own 'claude-opus-4-7' / 'claude-sonnet-4-6' /
// 'claude-haiku-4-7' constant now calls getRosterModelId(role) instead -- see
// config/model_roster.json's own 'sites_migrated' array for the full list.
//
// Mirrors substrate_price_table.ts's existing load pattern deliberately (same sync fs.readFileSync
// + resolve(__dirname, '..', '..', 'config', ...) shape) so this codebase has ONE way to load a
// Founder-controlled JSON config from the main process, not two.
//
// FAIL-LOUD BY DESIGN, not fail-soft: an unreadable or incomplete roster throws at the call site
// rather than silently falling back to a guessed/stale literal. This is deliberate, not an
// oversight -- per this estate's own "the Firearm Rule: unknown means do not touch" discipline, a
// broken roster must stop a paid cloud dispatch from happening with the WRONG model id, not quietly
// guess one. A missing config file is a loud, obvious, fix-it-now failure; a silently wrong model id
// reaching a real Anthropic API call (and then an un-priced or mis-priced savings receipt) is not.

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface ModelRosterEntry {
  model_id: string;
  source_url: string;
  fetched_utc: string;
  /** The model_id this entry replaced, or null if this role has never rotated. */
  replaces: string | null;
  note?: string;
}

interface ModelRosterFile {
  schema_version: number;
  roster_version: string;
  roles: Record<string, ModelRosterEntry>;
  sites_migrated?: string[];
  sites_deliberately_not_migrated?: string[];
}

const DEFAULT_ROSTER_PATH = resolve(__dirname, '..', '..', 'config', 'model_roster.json');

function loadRoster(rosterPath: string): ModelRosterFile | null {
  if (!existsSync(rosterPath)) return null;
  try {
    const raw = readFileSync(rosterPath, 'utf-8');
    return JSON.parse(raw) as ModelRosterFile;
  } catch {
    return null;
  }
}

/**
 * Resolve a role (e.g. 'brain.opus', 'brain.sonnet', 'brain.haiku') to the vendor model_id
 * currently on file for it. Throws (never returns a guessed/hardcoded fallback) when the roster
 * file is missing/unparsable or the role is not declared -- see the header comment for why this
 * is fail-loud rather than fail-soft.
 */
export function getRosterModelId(role: string, rosterPath: string = DEFAULT_ROSTER_PATH): string {
  const roster = loadRoster(rosterPath);
  if (!roster) {
    throw new Error(
      `[model_roster] roster file unreadable or unparsable at ${rosterPath} -- cannot resolve role "${role}". Refusing to guess a model id.`,
    );
  }
  const entry = roster.roles[role];
  if (!entry || !entry.model_id) {
    throw new Error(
      `[model_roster] role "${role}" not found (or has no model_id) in roster at ${rosterPath}. Known roles: ${Object.keys(roster.roles).join(', ')}`,
    );
  }
  return entry.model_id;
}

/** Full entry (model_id + provenance) for a role, for callers that want to surface source_url /
 *  fetched_utc / replaces (e.g. a drift-check tool or a diagnostics panel), not just the bare id. */
export function getRosterEntry(role: string, rosterPath: string = DEFAULT_ROSTER_PATH): ModelRosterEntry {
  const roster = loadRoster(rosterPath);
  if (!roster) {
    throw new Error(`[model_roster] roster file unreadable or unparsable at ${rosterPath} -- cannot resolve role "${role}".`);
  }
  const entry = roster.roles[role];
  if (!entry) {
    throw new Error(`[model_roster] role "${role}" not found in roster at ${rosterPath}. Known roles: ${Object.keys(roster.roles).join(', ')}`);
  }
  return entry;
}

/** Every role -> model_id currently on file. Used by the drift checker
 *  (HARDWIRE/tools/controls/model_roster_drift_check.mjs) to compare against the price table and
 *  the vendor page without duplicating getRosterModelId's per-role throw behavior. Returns an
 *  empty object (never throws) when the roster is unreadable -- the drift checker's own job is to
 *  report that as a finding, not to crash. */
export function listRosterModelIds(rosterPath: string = DEFAULT_ROSTER_PATH): Record<string, string> {
  const roster = loadRoster(rosterPath);
  if (!roster) return {};
  const out: Record<string, string> = {};
  for (const [role, entry] of Object.entries(roster.roles)) {
    out[role] = entry.model_id;
  }
  return out;
}

export { DEFAULT_ROSTER_PATH };
