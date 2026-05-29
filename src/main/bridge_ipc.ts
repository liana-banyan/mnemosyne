// bridge_ipc.ts — BP060 Application 002 Steps 3+4 · UI-7 Bridge live wire
// Exposes IPC channels for live Yoke (knight-bishop-bridge) message access.
// Reads/writes KNIGHT_BISHOP_MESSAGES.md — the canonical Yoke per R-USE-THE-YOKE.
// decay_class: BETWEEN on all emissions.

import { ipcMain } from 'electron';
import { readFileSync, appendFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

// ─── Yoke file path ──────────────────────────────────────────────────────────

const WORKSPACE_ROOT = 'C:/Users/Administrator/Documents/LianaBanyanPlatform';
const YOKE_PATH = resolve(WORKSPACE_ROOT, 'KNIGHT_BISHOP_MESSAGES.md');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BridgeMessage {
  id: string;
  type: 'task' | 'response' | 'info' | 'request';
  from: string;
  to: string;
  content: string;
  ts: number;
  pinned?: boolean;
  raw_section?: string;
}

export interface BridgeCheckResult {
  ok: boolean;
  messages: BridgeMessage[];
  pinned: BridgeMessage[];
  total_in_file: number;
  yoke_path: string;
  read_at: string;
  error?: string;
}

export interface BridgeSendResult {
  ok: boolean;
  message_id?: string;
  error?: string;
}

// ─── Yoke markdown parser ─────────────────────────────────────────────────────

function parseYokeMessages(content: string, count = 20): BridgeMessage[] {
  const messages: BridgeMessage[] = [];
  // Split into sections by "---" or "##" headers
  const sections = content.split(/\n(?=##\s|\n---\n)/);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    if (lines.length < 2) continue;

    const header = lines[0] || '';

    // Parse type from header keywords
    let msgType: BridgeMessage['type'] = 'info';
    if (/task/i.test(header)) msgType = 'task';
    else if (/response|LANDED|reply/i.test(header)) msgType = 'response';
    else if (/request|ASK/i.test(header)) msgType = 'request';
    else if (/NOTIFICATION|info|FYI/i.test(header)) msgType = 'info';

    // Extract from/to
    let from = 'SYSTEM';
    let to = 'BOTH';
    const directionMatch = header.match(/\(([A-Z]+)\s*(?:→|->)\s*([A-Z]+)\)/i)
      || section.match(/\*\*From:\*\*\s*([A-Z]+)/i)
      || section.match(/\*\*To:\*\*\s*([A-Z]+)/i);
    if (directionMatch) {
      from = directionMatch[1]?.toUpperCase() || 'SYSTEM';
      to = directionMatch[2]?.toUpperCase() || 'BOTH';
    } else if (/BISHOP.*KNIGHT/i.test(header)) {
      from = 'BISHOP'; to = 'KNIGHT';
    } else if (/KNIGHT.*BISHOP/i.test(header)) {
      from = 'KNIGHT'; to = 'BISHOP';
    } else if (/KNIGHT.*FOUNDER/i.test(header)) {
      from = 'KNIGHT'; to = 'FOUNDER';
    } else if (/BISHOP.*FOUNDER/i.test(header)) {
      from = 'BISHOP'; to = 'FOUNDER';
    }

    // Extract timestamp
    let ts = Date.now();
    const tsMatch = section.match(/\*\*Time:\*\*\s*(\d{4}-\d{2}-\d{2}T[\d:Z.+-]+)/i)
      || section.match(/(\d{4}-\d{2}-\d{2}T[\d:Z.+-]+)/);
    if (tsMatch) {
      try { ts = new Date(tsMatch[1]).getTime(); } catch { /* keep Date.now() */ }
    }

    // Content is everything after the header line
    const contentLines = lines.slice(1).join('\n').trim();
    if (!contentLines) continue;

    // Truncate long sections for the message list
    const contentPreview = contentLines.length > 400
      ? contentLines.slice(0, 400) + '…'
      : contentLines;

    // Detect pinned tasks (headers with "TASK" and not yet acknowledged)
    const isPinned = /\[TASK\]|\[task\]|pinned/i.test(header) && msgType === 'task';

    const id = `yoke-${ts}-${Math.random().toString(36).slice(2, 8)}`;
    messages.push({ id, type: msgType, from, to, content: contentPreview, ts, pinned: isPinned });
  }

  // Sort newest first, take count
  messages.sort((a, b) => b.ts - a.ts);
  return messages.slice(0, count);
}

// ─── IPC registration ─────────────────────────────────────────────────────────

export function registerBridgeIPC(): void {

  // bridge:check-messages — read live Yoke messages
  ipcMain.handle('bridge:check-messages', async (_ev, count = 20): Promise<BridgeCheckResult> => {
    try {
      if (!existsSync(YOKE_PATH)) {
        return {
          ok: false,
          messages: [],
          pinned: [],
          total_in_file: 0,
          yoke_path: YOKE_PATH,
          read_at: new Date().toISOString(),
          error: `Yoke file not found: ${YOKE_PATH}`,
        };
      }

      const content = readFileSync(YOKE_PATH, 'utf-8');
      const all = parseYokeMessages(content, Math.max(count, 50));
      const pinned = all.filter((m) => m.pinned);
      const messages = all.slice(0, count);

      return {
        ok: true,
        messages,
        pinned,
        total_in_file: all.length,
        yoke_path: YOKE_PATH,
        read_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        messages: [],
        pinned: [],
        total_in_file: 0,
        yoke_path: YOKE_PATH,
        read_at: new Date().toISOString(),
        error: String(err),
      };
    }
  });

  // bridge:send-message — append to Yoke
  ipcMain.handle('bridge:send-message', async (
    _ev,
    args: { to: string; type: string; content: string; from?: string }
  ): Promise<BridgeSendResult> => {
    try {
      const { to, type, content, from = 'MNEMOSYNE' } = args;
      const ts = new Date().toISOString();
      const messageId = `mnemosyne-${Date.now()}`;

      // Append in Yoke markdown format
      const entry = [
        '',
        '---',
        '',
        `## [${type.toUpperCase()}] ${from} -> ${to} (via Mnemosyne UI-7)`,
        `**Time:** ${ts}`,
        `**Message-ID:** ${messageId}`,
        '',
        content,
        '',
      ].join('\n');

      appendFileSync(YOKE_PATH, entry, 'utf-8');

      return { ok: true, message_id: messageId };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

}
