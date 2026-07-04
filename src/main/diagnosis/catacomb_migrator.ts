/**
 * catacomb_migrator.ts — v0.4.1 BP083
 *
 * Manages Catacomb relocation for "Preserved Forever" Diagnoses.
 *
 * - scheduleCatacombRelocation(id, delayMs) → persists migration schedule
 * - runCatacombMigrationCheck()             → called at app.ready; moves due items
 * - migrateToCatacomb(id, baseDir)          → relocates JSON to Catacomb/
 * - refundEscrow(id)                        → SCAFFOLD v0.4.1 — full impl in v0.4.2
 *
 * Per BP083 canon: pheromone-fade after 1 year → Catacomb cold archive.
 * Still findable via Librarian Corps query (Caithedral™ substrate search).
 * Bounty escrow returns to asker on unresolved relocation.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

// ─── Paths ────────────────────────────────────────────────────────────────────

function baseDir(): string {
  return join(app.getPath('appData'), 'MnemosyneC');
}

function scheduleFile(): string {
  const d = join(baseDir(), 'Vault');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return join(d, 'diagnosis_migration_schedule.json');
}

function diagnosisSubstrateDir(): string {
  return join(baseDir(), 'substrate', 'diagnosis');
}

function catacombDir(): string {
  const d = join(baseDir(), 'Catacomb');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

// ─── Schedule API ─────────────────────────────────────────────────────────────

/**
 * Persist a Catacomb relocation schedule for a Preserved-Forever Diagnosis.
 * Stored in %APPDATA%/MnemosyneC/Vault/diagnosis_migration_schedule.json.
 */
export async function scheduleCatacombRelocation(diagnosisId: string, delayMs: number): Promise<void> {
  const sf = scheduleFile();
  const schedule: Record<string, number> = existsSync(sf)
    ? (JSON.parse(readFileSync(sf, 'utf8')) as Record<string, number>)
    : {};

  schedule[diagnosisId] = Date.now() + delayMs;
  writeFileSync(sf, JSON.stringify(schedule, null, 2), 'utf8');

  console.log(
    `[CatacombMigrator] Scheduled diagnosis=${diagnosisId} for Catacomb relocation in ` +
    `${(delayMs / (1000 * 60 * 60 * 24)).toFixed(1)} days`,
  );
}

// ─── Migration check (run at app.ready) ──────────────────────────────────────

/**
 * Check migration schedule; relocate any Diagnoses that are past due.
 * Called at app.ready (wired in src/main/index.ts).
 */
export async function runCatacombMigrationCheck(): Promise<void> {
  const sf = scheduleFile();
  if (!existsSync(sf)) return;

  let schedule: Record<string, number>;
  try {
    schedule = JSON.parse(readFileSync(sf, 'utf8')) as Record<string, number>;
  } catch {
    console.warn('[CatacombMigrator] Could not parse migration schedule — skipping');
    return;
  }

  const now = Date.now();
  let changed = false;

  for (const [diagnosisId, migrateAt] of Object.entries(schedule)) {
    if (now >= migrateAt) {
      await migrateToCatacomb(diagnosisId);
      await refundEscrow(diagnosisId);
      delete schedule[diagnosisId];
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(sf, JSON.stringify(schedule, null, 2), 'utf8');
  }

  console.log(`[CatacombMigrator] Migration check complete — ${Object.keys(schedule).length} items pending`);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function migrateToCatacomb(diagnosisId: string): Promise<void> {
  const srcPath = join(diagnosisSubstrateDir(), `diagnosis_${diagnosisId}.json`);
  const destPath = join(catacombDir(), `diagnosis_${diagnosisId}.json`);

  if (!existsSync(srcPath)) {
    console.warn(`[CatacombMigrator] Source not found for diagnosis=${diagnosisId} — may have been resolved`);
    return;
  }

  try {
    renameSync(srcPath, destPath);
    console.log(`[CatacombMigrator] Relocated diagnosis=${diagnosisId} to Catacomb`);
  } catch (err) {
    console.error(`[CatacombMigrator] Failed to relocate diagnosis=${diagnosisId}:`, err);
  }
}

async function refundEscrow(diagnosisId: string): Promise<void> {
  // SCAFFOLD v0.4.1 — full Substitution Rail escrow refund wired in v0.4.2
  // Per BP083: unresolved Preserved-Forever Diagnoses refund bounty to asker.
  console.log(
    `[CatacombMigrator] SCAFFOLD v0.4.1: bounty escrow refund for diagnosis=${diagnosisId} — full impl v0.4.2`,
  );
}
