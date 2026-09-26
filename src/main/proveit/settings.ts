// settings.ts -- D-BP223-BM04-X033S3-009 STEP 1
//
// The Prove It substrate-publish flag: proveit.substrateLive, DEFAULT FALSE. The 007 data-layer
// tables (substrate_questions etc.) CORRECTED 2026-09-24 (D-BP223-BM0-X037-013): the table IS APPLIED IN PRODUCTION. Measured live: it exists with all 18 columns and carries working RLS. The write path is still off because of the proveit.substrateLive flag and a pending Founder ruling, NOT because the table is missing. The old wording here produced a false "not built" verdict from a later reader; do not restore it. (confirmed,
// BISHOP_DROPZONE\D-BP223-BM04-X033S3-007-PROVE-IT-DATA-LAYER\DB_GROUND_TRUTH.md) -- this flag
// is the gate that keeps this feature entirely local/outbox until a Founder ruling flips it.
//
// CONFIRMED NO EXISTING FILE OWNS THIS (D-BP165-M0-026 Law 4 check, this dispatch): the settings-
// named siblings in this tree (mesh_trust_settings.ts, presence_share_settings.ts,
// query_capture_settings.ts, resident_settings.ts, network_feature_settings.ts,
// open_at_login_settings.ts) each own an unrelated feature's own flag file; none reads or writes
// anything about Prove It / substrate_questions / a substrateLive gate.
//
// SEPARATE SETTINGS FILE, SAME MECHANISM: ai_dispatch_ipc.ts's loadSettings()/saveSettings()
// (ai_dispatch_settings.json in {userData}) is "the app's existing settings mechanism" the brief
// points at. This module follows the identical read/parse/fail-soft/write shape rather than
// literally adding a field to that file, because ai_dispatch_ipc.ts is a large, heavily-loaded,
// actively-changing shared file and this feature's one boolean does not need to live inside it --
// see REPORT.md for this choice and the [RULING NEEDED] it opens (should proveit.substrateLive
// instead become a field on AiDispatchSettings once this feature is reviewed for merge). Nothing
// about the MECHANISM differs: same {userData}-relative JSON file, same load/save conventions.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { settingsPath } from './userdata_paths';

export interface ProveItSettings {
  /** Default false. When false, "Add to the Substrate" writes to the local outbox instead of
   *  substrate_questions (spec Section 6.c). */
  substrateLive: boolean;
}

// D-BP223-BM0-X034-001 (Founder 2026-09-20T20:31Z "make substrate live the default"): default TRUE from 0.9.35;
// the 007 tables (substrate_categories/questions/votes/guild rulings) are applied on production 20:36Z.
const DEFAULT_SETTINGS: ProveItSettings = { substrateLive: true };

export function loadProveItSettings(): ProveItSettings {
  const p = settingsPath();
  if (!existsSync(p)) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as Partial<ProveItSettings>;
    return { substrateLive: parsed.substrateLive !== false }; // only an explicit false turns it off
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveProveItSettings(next: Partial<ProveItSettings>): ProveItSettings {
  const current = loadProveItSettings();
  const updated: ProveItSettings = { ...current, ...next };
  writeFileSync(settingsPath(), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
