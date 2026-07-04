/**
 * mnemosynec_message_store.ts
 * SEG-MC-4 · Wave D · BP079 · 2026-06-10
 *
 * TypeScript mirror of librarian-mcp/scripts/mnemosynec-message-store.mjs
 * for use in the Electron main process (avoids ESM .mjs interop in tsc build).
 *
 * Both files write to the same JSONL backing store:
 *   ~/.mnemosynec/messages.jsonl
 *
 * The .mjs version is used by the MCP stdio shim (SEG-MC-1) and tests.
 * This .ts version is imported by bridge_ipc.ts in the Electron main process.
 * They are intentionally kept in sync — any logic change applies to both.
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

export interface PearlMessage {
  pearl_id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  status: 'unread' | 'read';
  ts: string;
}

export interface MessageSummary {
  pearl_id: string;
  from: string;
  subject: string;
  body: string;
  ts: string;
}

export const STORE_PATH: string =
  process.env['MNEMOSYNEC_STORE_PATH'] ??
  path.join(os.homedir(), '.mnemosynec', 'messages.jsonl');

// ── Internal helpers ─────────────────────────────────────────────────────────

function ensureDir(): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
}

function readAllMessages(): PearlMessage[] {
  try {
    const content = fs.readFileSync(STORE_PATH, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as PearlMessage);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

function writeAllMessages(messages: PearlMessage[]): void {
  ensureDir();
  const lines = messages.map((m) => JSON.stringify(m)).join('\n');
  fs.writeFileSync(STORE_PATH, lines + (messages.length > 0 ? '\n' : ''), 'utf8');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a message (appends one JSONL line to the store).
 */
export function sendMessage(args: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): { pearl_id: string; ok: boolean } {
  ensureDir();
  const pearl_id = crypto.randomUUID();
  const record: PearlMessage = {
    pearl_id,
    from: args.from,
    to: args.to,
    subject: args.subject,
    body: args.body,
    status: 'unread',
    ts: new Date().toISOString(),
  };
  fs.appendFileSync(STORE_PATH, JSON.stringify(record) + '\n', 'utf8');
  return { pearl_id, ok: true };
}

/**
 * Check messages addressed to clientId that are still unread.
 */
export function checkMessages(clientId: string): MessageSummary[] {
  return readAllMessages()
    .filter((m) => m.to === clientId && m.status === 'unread')
    .map(({ pearl_id, from, subject, body, ts }) => ({ pearl_id, from, subject, body, ts }));
}

/**
 * Acknowledge a message (marks status read so it no longer appears in checkMessages).
 */
export function ackMessage(pearlId: string): { ok: boolean } {
  const messages = readAllMessages();
  let found = false;
  const updated = messages.map((m) => {
    if (m.pearl_id === pearlId && m.status === 'unread') {
      found = true;
      return { ...m, status: 'read' as const };
    }
    return m;
  });
  if (found) {
    writeAllMessages(updated);
  }
  return { ok: found };
}
