/**
 * manifest_updater.ts -- Folder-Manifest soccerball-hash update on publish
 * BP087 Wave 5 -- Alexandrian Library Catacombs
 *
 * Canon ref: SEG-CL-eta -- SHA-256 soccerball hash over sorted eblet UUIDs
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getFolderPath } from './folder_bootstrap';
import type { FolderManifest } from './folder_bootstrap';

const LB_SUBSTRATE_ROOT = join(homedir(), '.lb_substrate');

interface EbletFileRecord {
  uuid: string;
  published_at: string;
}

interface IpLedgerRow {
  slug: string;
  soccerball_hash: string;
  eblet_count: number;
  recorded_at: string;
}

/**
 * Update the manifest for a category slug after a new eblet is published.
 * 1. Reads all *.eblet.json files in the category folder
 * 2. Sorts by published_at ASC (deterministic)
 * 3. Computes SHA-256 over concatenated eblet UUIDs
 * 4. Updates manifest.json
 * 5. Appends row to ~/.lb_substrate/ip_ledger.jsonl
 * Returns the new soccerball_hash.
 */
export async function updateManifest(categorySlug: string, newEbletUuid: string): Promise<string> {
  const folderPath = getFolderPath(categorySlug);
  const manifestPath = join(folderPath, 'manifest.json');

  // Read all *.eblet.json files in the folder
  let entries: EbletFileRecord[] = [];
  try {
    const files = await readdir(folderPath);
    const ebletFiles = files.filter((f) => f.endsWith('.eblet.json'));

    const parsed = await Promise.all(
      ebletFiles.map(async (f) => {
        try {
          const raw = await readFile(join(folderPath, f), 'utf-8');
          const obj = JSON.parse(raw) as Partial<EbletFileRecord>;
          return { uuid: obj.uuid ?? f.replace('.eblet.json', ''), published_at: obj.published_at ?? new Date(0).toISOString() };
        } catch {
          return null;
        }
      })
    );
    entries = parsed.filter((e): e is EbletFileRecord => e !== null);
  } catch {
    // Folder may be newly created -- treat as empty, include only the new uuid
    entries = [{ uuid: newEbletUuid, published_at: new Date().toISOString() }];
  }

  // Sort ASC by published_at for deterministic hash
  entries.sort((a, b) => a.published_at.localeCompare(b.published_at));

  // Ensure new eblet appears (may not have been written yet)
  if (!entries.find((e) => e.uuid === newEbletUuid)) {
    entries.push({ uuid: newEbletUuid, published_at: new Date().toISOString() });
  }

  // Compute SHA-256 over concatenated UUIDs
  const hashInput = entries.map((e) => e.uuid).join('');
  const soccerball_hash = createHash('sha256').update(hashInput).digest('hex');
  const eblet_count = entries.length;
  const last_updated = new Date().toISOString();

  // Read existing manifest (may not exist)
  let manifest: FolderManifest;
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw) as FolderManifest;
  } catch {
    manifest = { slug: categorySlug, version: 1, soccerball_hash: null, eblet_count: 0, last_updated: null };
  }

  // Update and write manifest
  manifest.soccerball_hash = soccerball_hash;
  manifest.eblet_count = eblet_count;
  manifest.last_updated = last_updated;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // Append row to global ip_ledger.jsonl
  const row: IpLedgerRow = { slug: categorySlug, soccerball_hash, eblet_count, recorded_at: last_updated };
  const ipLedgerPath = join(LB_SUBSTRATE_ROOT, 'ip_ledger.jsonl');
  await appendFile(ipLedgerPath, JSON.stringify(row) + '\n', 'utf-8');

  console.log(`[Catacombs] Manifest updated -- slug=${categorySlug} hash=${soccerball_hash.slice(0, 8)}...`);
  return soccerball_hash;
}
