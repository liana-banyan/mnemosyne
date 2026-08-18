/**
 * plow_checkpoint.ts — v0.4.2 BP083 SEG-1 + SEG-5
 *
 * Periodic checkpoint persistence for the Canonical Plow worker.
 * Writes to %APPDATA%\MnemosyneC\Substrate\.plow_checkpoint.json every N questions.
 * On app launch: detects interrupted Plow and surfaces "Resume?" modal.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

export interface PlowCheckpoint {
  sessionId: string;
  startedAt: number;
  lastUpdatedAt: number;
  config: {
    domains: string[];
    questionsPerDomain: number;
    model: string;
  };
  completedQuestions: Record<string, number>;   // domain → completed question count
  totalEbletsWritten: number;
  totalQuestionsCompleted: number;
  totalQuestionsTarget: number;
  status: 'running' | 'interrupted';
}

function checkpointPath(): string {
  return join(app.getPath('appData'), 'MnemosyneC', 'Substrate', '.plow_checkpoint.json');
}

function ensureSubstrateDir(): void {
  const dir = join(app.getPath('appData'), 'MnemosyneC', 'Substrate');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function writeCheckpoint(checkpoint: PlowCheckpoint): void {
  try {
    ensureSubstrateDir();
    writeFileSync(checkpointPath(), JSON.stringify(checkpoint, null, 2), 'utf8');
  } catch (err) {
    console.error('[PlowCheckpoint] Failed to write checkpoint:', err);
  }
}

export function readCheckpoint(): PlowCheckpoint | null {
  try {
    const p = checkpointPath();
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, 'utf8')) as PlowCheckpoint;
    return raw;
  } catch {
    return null;
  }
}

export function clearCheckpoint(): void {
  try {
    const p = checkpointPath();
    if (existsSync(p)) {
      unlinkSync(p);
      console.log('[PlowCheckpoint] Checkpoint cleared');
    }
  } catch (err) {
    console.error('[PlowCheckpoint] Failed to clear checkpoint:', err);
  }
}

export function markCheckpointInterrupted(): void {
  const existing = readCheckpoint();
  if (existing) {
    writeCheckpoint({ ...existing, status: 'interrupted', lastUpdatedAt: Date.now() });
  }
}
