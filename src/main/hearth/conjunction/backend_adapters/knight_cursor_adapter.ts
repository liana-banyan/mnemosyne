// B83e — Knight Cursor Backend Adapter
// Routes via Yoke file bridge (KNIGHT_BISHOP_MESSAGES.md) — best-effort async
//
// R-MECHANISM-VERIFY note: Knight is human-operated (paste cycle in Cursor).
// This adapter is BEST-EFFORT for live conjunction. Responses may arrive after
// Founder context-switches. Receipts persist regardless of timing.
// Timeout: 90s default. UI tooltip: "Knight responses may arrive after
// Founder context-switches; receipts persist regardless."

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import type { AdapterReceipt } from '../types';

const YOKE_PATH = process.env.YOKE_PATH ?? resolve(
  process.env.HOMEDRIVE && process.env.HOMEPATH
    ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`
    : process.env.HOME || '.',
  'Documents',
  'LianaBanyanPlatform',
  'KNIGHT_BISHOP_MESSAGES.md',
);

// Pixel inbox — where Knight writes replies (B82 bidirectional channel)
const INBOX_PATH = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'pixel_inbox.jsonl',
);

const KNIGHT_CONJUNCTION_SENTINEL = '[CAI][CONJUNCTION-REPLY]';

export async function knightCursorAvailable(): Promise<{ ok: boolean; degraded_reason?: string }> {
  // Knight is available if the Yoke file exists (Founder has the workspace open)
  if (existsSync(YOKE_PATH)) return { ok: true };
  return {
    ok: false,
    degraded_reason: 'Yoke file not found — ensure LianaBanyanPlatform workspace is open',
  };
}

export async function knightCursorDispatch(
  prompt: string,
  opts: { timeout_ms: number; dispatch_id: string },
): Promise<AdapterReceipt> {
  const start = Date.now();

  // Write the conjunction request to the Yoke file
  const yokeEntry = `\n\n---\n[CAI][CONJUNCTION-REQUEST][${opts.dispatch_id}]\n${prompt}\n---\n`;
  try {
    mkdirSync(dirname(YOKE_PATH), { recursive: true });
    appendFileSync(YOKE_PATH, yokeEntry, 'utf8');
  } catch (err) {
    return {
      name: 'knight_cursor',
      result: null,
      error: `Failed to write Yoke request: ${String(err)}`,
      latency_ms: Date.now() - start,
    };
  }

  // Poll pixel_inbox for a reply with matching dispatch_id
  const deadline = Date.now() + opts.timeout_ms;
  const POLL_MS = 5_000;

  while (Date.now() < deadline) {
    const reply = _scanInboxForReply(opts.dispatch_id);
    if (reply !== null) {
      return {
        name: 'knight_cursor',
        result: reply,
        error: null,
        latency_ms: Date.now() - start,
        cost_usd: 0,
      };
    }
    await _sleep(POLL_MS);
  }

  // Timeout — receipt is written as best-effort; reply may arrive later
  return {
    name: 'knight_cursor',
    result: null,
    error: `Knight timeout after ${opts.timeout_ms}ms — dispatch_id ${opts.dispatch_id} pending. Knight may reply asynchronously; check Yoke channel.`,
    latency_ms: Date.now() - start,
  };
}

function _scanInboxForReply(dispatch_id: string): string | null {
  if (!existsSync(INBOX_PATH)) return null;
  try {
    const raw = readFileSync(INBOX_PATH, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines.slice(-100)) { // scan last 100 entries
      try {
        const entry = JSON.parse(line) as { dispatch_id?: string; content?: string; type?: string };
        if (
          entry.dispatch_id === dispatch_id &&
          entry.type === 'conjunction_reply' &&
          entry.content
        ) {
          return entry.content;
        }
      } catch {
        // Also check for sentinel in raw content
        if (line.includes(KNIGHT_CONJUNCTION_SENTINEL) && line.includes(dispatch_id)) {
          return line.replace(KNIGHT_CONJUNCTION_SENTINEL, '').trim();
        }
      }
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

function _sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
