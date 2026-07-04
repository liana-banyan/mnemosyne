// bridge_ipc.ts — SEG-MC-4 Wave D · migrated to pearl-based JSONL store BP079
// Original: BP060 Application 002 Steps 3+4 · UI-7 live Yoke wire
//
// Channels:
//   bridge:send-message  — peer-to-peer via JSONL store; AI via Ollama (in-mem reply)
//   bridge:check-messages — reads JSONL store for clientId (or Ollama reply queue)
//   bridge:ack-message   — NEW: marks a pearl read in the JSONL store
//
// Migration note: in-memory _inbox replaced by ~/.mnemosynec/messages.jsonl
// for all non-Ollama messages (Ollama AI replies stay in _aiReplies: in-memory
// since they are ephemeral renderer feedback, not durable Yoke pearls).

import { ipcMain } from 'electron';
import {
  sendMessage,
  checkMessages,
  ackMessage,
} from './mnemosynec_message_store';

const OLLAMA_API_BASE = 'http://127.0.0.1:11434';

// Ephemeral queue for Ollama AI replies only (not persisted; session-scoped).
interface AiReply {
  pearl_id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  ts: string;
}
const _aiReplies: AiReply[] = [];

export function registerBridgeIPC(): void {
  // ── bridge:send-message ──────────────────────────────────────────────────
  // Args (new shape):  { from, to, subject, body }
  // Args (legacy shape): { from?, to, type, content } — remapped internally
  // AI messages (type === 'ai' OR to === 'floor-model') still route to Ollama.
  ipcMain.handle(
    'bridge:send-message',
    async (
      _event,
      args: {
        to: string;
        from?: string;
        // New pearl shape
        subject?: string;
        body?: string;
        // Legacy shape (BP060)
        type?: string;
        content?: string;
      },
    ) => {
      const from = args.from ?? 'user';
      const to = args.to;
      // Normalize subject/body from either new or legacy shape
      const subject = args.subject ?? args.type ?? 'message';
      const body = args.body ?? args.content ?? '';

      // Route AI messages through Ollama (ephemeral, not stored in pearl JSONL)
      if (subject === 'ai' || to === 'floor-model') {
        try {
          const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gemma2:2b',
              prompt: body,
              stream: false,
              options: { num_predict: 512, temperature: 0.7 },
            }),
          });
          if (!res.ok) {
            return { ok: false, error: `Ollama request failed: ${res.statusText}` };
          }
          const data = (await res.json()) as { response?: string };
          const reply: AiReply = {
            pearl_id: crypto.randomUUID(),
            to: from,
            from: to,
            subject: 'ai-reply',
            body: data.response ?? '(no response)',
            ts: new Date().toISOString(),
          };
          _aiReplies.push(reply);
          // Keep bounded to avoid unbounded memory growth
          if (_aiReplies.length > 200) _aiReplies.splice(0, _aiReplies.length - 200);
          return { ok: true, pearl_id: reply.pearl_id };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      }

      // All other peer messages → durable JSONL pearl store
      return sendMessage({ from, to, subject, body });
    },
  );

  // ── bridge:check-messages ────────────────────────────────────────────────
  // New arg: clientId (string) — returns all unread pearls addressed to clientId.
  // Legacy arg: count (number) — returned a slice of the in-memory inbox.
  // Both are handled: if arg is a string it is treated as clientId;
  // if arg is a number (legacy) or { clientId, count } object, adapted accordingly.
  ipcMain.handle('bridge:check-messages', (_event, arg?: string | number | { clientId?: string; count?: number }) => {
    // Resolve clientId from any arg shape
    let clientId: string;
    let maxCount: number = 20;

    if (typeof arg === 'string') {
      clientId = arg;
    } else if (typeof arg === 'number') {
      // Legacy: caller sent count only — return messages for 'global' recipient
      clientId = 'global';
      maxCount = arg;
    } else if (arg && typeof arg === 'object') {
      clientId = arg.clientId ?? 'global';
      maxCount = arg.count ?? 20;
    } else {
      clientId = 'global';
    }

    // Pearl JSONL store results
    const pearls = checkMessages(clientId).slice(0, maxCount);

    // Also drain any Ollama AI replies addressed to this clientId
    const aiForClient = _aiReplies.filter((r) => r.to === clientId);
    aiForClient.forEach((r) => {
      const idx = _aiReplies.indexOf(r);
      if (idx !== -1) _aiReplies.splice(idx, 1);
    });

    const messages = [...pearls, ...aiForClient];
    return { ok: true, messages, total: messages.length };
  });

  // ── bridge:ack-message (NEW) ─────────────────────────────────────────────
  // Marks a pearl as read so it no longer appears in bridge:check-messages.
  ipcMain.handle('bridge:ack-message', (_event, pearlId: string) => {
    return ackMessage(pearlId);
  });
}
