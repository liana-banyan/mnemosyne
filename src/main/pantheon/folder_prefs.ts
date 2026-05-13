// Folder Prefs — per-folder dual-checkbox sovereignty state
// BP041 Canon: "Two checkboxes. Easy."
//   ☑ Pixie-lated for ME  (private substrate)
//   ☐ Shared with Federation  (member opt-in)
// Persisted at ~/.lb_substrate/pantheon/folder_prefs.json

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { FOLDER_PREFS_PATH } from './types';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface SubfolderOverride {
  folder_path: string;
  pixelated: boolean;
  federation_shared: boolean;
}

export interface FolderPref {
  folder_path: string;
  /** ☑ Pixie-lated for ME — mines into member's private substrate */
  pixelated: boolean;
  /** ☑ Shared with Federation — member opt-in cooperative sharing */
  federation_shared: boolean;
  /** Override tree per sub-folder (cascade from parent unless explicitly set) */
  subfolder_overrides: SubfolderOverride[];
  added_at: string;
  last_mined_at?: string;
  tablet_counts?: { iron: number; stone: number };
}

export interface AllFolderPrefs {
  member_id: string;
  updated_at: string;
  folders: FolderPref[];
}

// ─── Load / save ──────────────────────────────────────────────────────────────

function loadAll(): Record<string, AllFolderPrefs> {
  if (!existsSync(FOLDER_PREFS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(FOLDER_PREFS_PATH, 'utf-8')) as Record<string, AllFolderPrefs>;
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, AllFolderPrefs>): void {
  const dir = dirname(FOLDER_PREFS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(FOLDER_PREFS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getFolderPrefs(memberId: string): AllFolderPrefs {
  const all = loadAll();
  return all[memberId] ?? { member_id: memberId, updated_at: new Date().toISOString(), folders: [] };
}

export function setFolderPref(
  memberId: string,
  folderPath: string,
  pixelated: boolean,
  federationShared: boolean,
  subfolderOverrides?: SubfolderOverride[],
): FolderPref {
  const all = loadAll();
  const memberPrefs = all[memberId] ?? {
    member_id: memberId,
    updated_at: new Date().toISOString(),
    folders: [],
  };

  const existing = memberPrefs.folders.findIndex((f) => f.folder_path === folderPath);
  const now = new Date().toISOString();

  const pref: FolderPref = {
    folder_path: folderPath,
    pixelated,
    federation_shared: federationShared && pixelated, // can't share what wasn't mined
    subfolder_overrides: subfolderOverrides ?? [],
    added_at: existing >= 0 ? memberPrefs.folders[existing].added_at : now,
    last_mined_at: existing >= 0 ? memberPrefs.folders[existing].last_mined_at : undefined,
    tablet_counts: existing >= 0 ? memberPrefs.folders[existing].tablet_counts : undefined,
  };

  if (existing >= 0) {
    memberPrefs.folders[existing] = pref;
  } else {
    memberPrefs.folders.push(pref);
  }
  memberPrefs.updated_at = now;
  all[memberId] = memberPrefs;
  saveAll(all);
  return pref;
}

export function removeFolderPref(memberId: string, folderPath: string): void {
  const all = loadAll();
  if (!all[memberId]) return;
  all[memberId].folders = all[memberId].folders.filter((f) => f.folder_path !== folderPath);
  all[memberId].updated_at = new Date().toISOString();
  saveAll(all);
}

export function updateTabletCounts(
  memberId: string,
  folderPath: string,
  counts: { iron: number; stone: number },
): void {
  const all = loadAll();
  if (!all[memberId]) return;
  const idx = all[memberId].folders.findIndex((f) => f.folder_path === folderPath);
  if (idx < 0) return;
  all[memberId].folders[idx].last_mined_at = new Date().toISOString();
  all[memberId].folders[idx].tablet_counts = counts;
  saveAll(all);
}

/** Effective sharing scope for a specific subfolder path, cascading from parent. */
export function resolveSubfolderScope(
  prefs: AllFolderPrefs,
  folderPath: string,
  subPath: string,
): { pixelated: boolean; federation_shared: boolean } {
  const parent = prefs.folders.find((f) => subPath.startsWith(f.folder_path));
  if (!parent) return { pixelated: false, federation_shared: false };

  // Check for explicit subfolder override
  const override = parent.subfolder_overrides.find((o) => subPath === o.folder_path);
  if (override) {
    return {
      pixelated: override.pixelated,
      federation_shared: override.federation_shared && override.pixelated,
    };
  }

  // Cascade from parent
  return { pixelated: parent.pixelated, federation_shared: parent.federation_shared };
}
