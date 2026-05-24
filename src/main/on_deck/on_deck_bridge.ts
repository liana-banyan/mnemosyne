// BP037 — On-Deck Phase 2: Main-process bridge
// Reads on_deck substrate directory; exposes items to renderer via IPC
// IPC channel: 'on-deck-list'  → returns OnDeckBridgePayload

import { readdirSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { parseOnDeckFile } from './on_deck_parser';
import type { OnDeckItem } from './on_deck_types';

const CATEGORIES = ['sequential', 'anytime', 'conditional'] as const;
const FIRED_DIR = 'fired';

export interface OnDeckBridgePayload {
  sequential: OnDeckItem[];
  anytime: OnDeckItem[];
  conditional: OnDeckItem[];
  fired_recent: OnDeckItem[]; // most recent 20 from fired/
  base_dir: string;
  scanned_at: string;
}

function resolveBaseDir(): string {
  return resolve(homedir(), '.lb_substrate', 'on_deck');
}

function scanCategory(baseDir: string, category: string): OnDeckItem[] {
  const dir = join(baseDir, category);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.eblet.md'))
    .map((f) => join(dir, f))
    .sort(); // alphabetical = creation-order by naming convention

  const items: OnDeckItem[] = [];
  for (const fp of files) {
    const result = parseOnDeckFile(fp);
    if (result.ok) items.push(result.item);
  }
  return items;
}

function scanFired(baseDir: string, limit = 20): OnDeckItem[] {
  const dir = join(baseDir, FIRED_DIR);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.eblet.md'))
    .map((f) => {
      const fp = join(dir, f);
      return { fp, mtime: statSync(fp).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime) // newest first
    .slice(0, limit)
    .map((e) => e.fp);

  const items: OnDeckItem[] = [];
  for (const fp of files) {
    const result = parseOnDeckFile(fp);
    if (result.ok) items.push(result.item);
  }
  return items;
}

export function listOnDeck(): OnDeckBridgePayload {
  const baseDir = resolveBaseDir();
  return {
    sequential: scanCategory(baseDir, 'sequential'),
    anytime: scanCategory(baseDir, 'anytime'),
    conditional: scanCategory(baseDir, 'conditional'),
    fired_recent: scanFired(baseDir),
    base_dir: baseDir,
    scanned_at: new Date().toISOString(),
  };
}
