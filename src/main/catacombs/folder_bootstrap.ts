/**
 * folder_bootstrap.ts -- 16-Folder Substrate Default bootstrap
 * BP087 Wave 5 -- Alexandrian Library Catacombs
 *
 * Creates all 16 Catacombs directories under ~/.lb_substrate/ at first launch.
 * Idempotent: sentinel file catacombs.bootstrapped prevents re-run.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ---- Types ------------------------------------------------------------------

export interface FolderManifest {
  slug: string;
  version: number;
  soccerball_hash: string | null;
  eblet_count: number;
  last_updated: string | null;
}

export interface BootstrapResult {
  created: string[];
  skipped: boolean;
  sentinel_written: boolean;
}

export interface EbletEntry {
  uuid: string;
  title?: string;
  published_at: string;
  corroboration_score?: number;
  soccerball_hash?: string;
}

// ---- Constants --------------------------------------------------------------

export const FOLDER_MANIFEST: readonly string[] = [
  '01_biology',
  '02_business',
  '03_chemistry',
  '04_computer_science',
  '05_economics',
  '06_engineering',
  '07_health',
  '08_history',
  '09_law',
  '10_math',
  '11_other',
  '12_philosophy',
  '13_physics',
  '14_psychology',
  '15_USER',
  '16_LIANA_BANYAN',
];

const LB_SUBSTRATE_ROOT = join(homedir(), '.lb_substrate');
const SENTINEL_PATH = join(LB_SUBSTRATE_ROOT, 'catacombs.bootstrapped');

// ---- Helpers ----------------------------------------------------------------

function substrateRoot(): string {
  return LB_SUBSTRATE_ROOT;
}

function defaultManifest(slug: string): FolderManifest {
  return {
    slug,
    version: 1,
    soccerball_hash: null,
    eblet_count: 0,
    last_updated: null,
  };
}

// ---- Public API -------------------------------------------------------------

/**
 * Returns the absolute path for a given folder slug under ~/.lb_substrate/.
 */
export function getFolderPath(slug: string): string {
  return join(substrateRoot(), slug);
}

/**
 * Bootstraps all 16 Catacombs directories under ~/.lb_substrate/.
 * Idempotent -- sentinel file prevents re-run.
 */
export async function bootstrapCatacombs(): Promise<BootstrapResult> {
  if (existsSync(SENTINEL_PATH)) {
    return { created: [], skipped: true, sentinel_written: false };
  }

  mkdirSync(substrateRoot(), { recursive: true });

  const created: string[] = [];

  for (const slug of FOLDER_MANIFEST) {
    const folderPath = getFolderPath(slug);
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
      created.push(slug);
    }

    // Write manifest.json if absent
    const manifestPath = join(folderPath, 'manifest.json');
    if (!existsSync(manifestPath)) {
      writeFileSync(manifestPath, JSON.stringify(defaultManifest(slug), null, 2), 'utf-8');
    }

    // Touch ledger.jsonl if absent
    const ledgerPath = join(folderPath, 'ledger.jsonl');
    if (!existsSync(ledgerPath)) {
      writeFileSync(ledgerPath, '', 'utf-8');
    }
  }

  // Write global ip_ledger.jsonl if absent
  const ipLedgerPath = join(substrateRoot(), 'ip_ledger.jsonl');
  if (!existsSync(ipLedgerPath)) {
    writeFileSync(ipLedgerPath, '', 'utf-8');
  }

  // Write sentinel
  writeFileSync(SENTINEL_PATH, new Date().toISOString(), 'utf-8');
  console.log(`[Catacombs] Bootstrap complete -- ${created.length} folders created`);

  return { created, skipped: false, sentinel_written: true };
}

/**
 * Reads the manifest.json for a given slug.
 * Returns default manifest if file missing (graceful degrade).
 */
export async function getManifest(slug: string): Promise<FolderManifest> {
  const manifestPath = join(getFolderPath(slug), 'manifest.json');
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as FolderManifest;
  } catch {
    return defaultManifest(slug);
  }
}

/**
 * Reads ledger.jsonl lines for a given slug.
 * Returns empty array if file missing or parse errors.
 */
export async function listEblets(slug: string): Promise<EbletEntry[]> {
  const ledgerPath = join(getFolderPath(slug), 'ledger.jsonl');
  try {
    const raw = await readFile(ledgerPath, 'utf-8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as EbletEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is EbletEntry => e !== null);
  } catch {
    return [];
  }
}
