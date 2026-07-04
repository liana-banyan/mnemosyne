// Battery Dispatch — Local history store
// Append-only JSONL in userData/battery_dispatch_history.jsonl
// BP082 · Sonnet 4.6

import { app } from 'electron';
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { DispatchHistoryEntry, DispatchReceipt } from './types';

function historyPath(): string {
  const dir = join(app.getPath('userData'), 'dispatch');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'battery_dispatch_history.jsonl');
}

export function appendDispatchHistory(entry: DispatchHistoryEntry): void {
  try {
    appendFileSync(historyPath(), JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    console.error('[BatteryDispatch] Failed to append history:', e);
  }
}

export function loadDispatchHistory(): DispatchHistoryEntry[] {
  const p = historyPath();
  if (!existsSync(p)) return [];
  try {
    return readFileSync(p, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DispatchHistoryEntry)
      .reverse(); // most recent first
  } catch {
    return [];
  }
}

export function appendReceiptEblet(receipt: DispatchReceipt): void {
  try {
    const dir = join(app.getPath('userData'), 'dispatch');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const p = join(dir, 'dispatch_receipts.jsonl');
    appendFileSync(p, JSON.stringify(receipt) + '\n', 'utf8');
  } catch (e) {
    console.error('[BatteryDispatch] Failed to append receipt eblet:', e);
  }
}
