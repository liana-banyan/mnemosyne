// AMPLIFY Computer — Local Substrate API Server
// B37 Phase 3-4 — Full implementation with TelemetryStore
// B61 Phase 0 — Pawn (Perplexity) + Rook (Gemini) Yoke dispatch/status endpoint stubs
// B61 Phase A — Wave Generator daemon endpoints (wave orchestration)
// B61 Phase B — Template-based dispatch (template_name + params instead of segs[])
// B61 Phase C — Trigger Engine init; NL dispatch endpoint; trigger status endpoint
//
// HTTP endpoints on 127.0.0.1:11480:
//   GET  /health                    — liveness
//   GET  /mode                      — current + forced mode
//   POST /mode/force                — force or clear override mode
//   POST /substrate/query           — three-mode routed query
//   POST /substrate/write           — write record to local index + federation queue
//   GET  /amplify/snapshot          — session telemetry snapshot
//   GET  /amplify/summary           — full historical summary (today/week/month/all-time)
//   GET  /federation/status         — peer count, last sync, online status
//   GET  /yoke/stream               — SSE inbox fan-out (MoneyPenny Phase B)
//   POST /yoke/pawn/dispatch        — B61 Phase 0: Pawn wave dispatch (Perplexity sonar-reasoning-pro)
//   GET  /yoke/pawn/status/:id      — B61 Phase 0: Pawn dispatch status
//   POST /yoke/rook/dispatch        — B61 Phase 0: Rook wave dispatch (Gemini)
//   GET  /yoke/rook/status/:id      — B61 Phase 0: Rook dispatch status
//   POST /yoke/wave/dispatch        — B61 Phase A/B: Wave Generator dispatch (segs[] or template_name)
//   GET  /yoke/wave/status/:id      — B61 Phase A: Wave status query
//   POST /yoke/wave/abort/:id       — B61 Phase A: Abort in-flight wave
//   POST /yoke/wave/nl              — B61 Phase C Class A: NL-text → WaveRequest compile + dispatch
//   GET  /yoke/wave/triggers        — B61 Phase C: Trigger Engine status + config summary

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { mkdirSync, existsSync, appendFileSync, readFileSync, writeFileSync, watch } from 'fs';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID, createHash } from 'crypto';
import { SubstrateLocalIndex, SubstrateRouter, type FrameMode } from './substrate_router';
import { TelemetryStore, type RoutingSource } from './telemetry_store';
import { getMobileHTML, getManifestJSON, getServiceWorker, getIconSVG } from './mobile_pwa';
import type { FederationClient } from './federation_client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getSpriteRegistry,
  computeLockSignature,
  type SpriteDispatch,
  type ClusterName,
} from './sprite_registry';
import {
  initWaveGenerator,
  dispatchWave as waveDispatch,
  getWave,
  abortWave,
  getWaveSummary,
  type WaveRequest,
} from './wave_generator';
import { probeConcurrencyCap } from './concurrency_probe';
import {
  initTriggerEngine,
  emitSubstrateEvent,
  parseNlWaveRequest,
  getTriggerSummary,
} from './wave_trigger_engine';

// ─── Constants ────────────────────────────────────────────────────────────────

export const API_PORT = 11480;

const LOG_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'logs',
);

// Yoke path — Bushel 41 Pixel-to-Bishop async bridge target
// Override via YOKE_PATH env var; default targets Founder's local LianaBanyanPlatform repo
const YOKE_PATH = process.env.YOKE_PATH ?? resolve(
  process.env.HOMEDRIVE && process.env.HOMEPATH
    ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`
    : process.env.HOME || '.',
  'Documents',
  'LianaBanyanPlatform',
  'KNIGHT_BISHOP_MESSAGES.md',
);

// Pixel inbox path — Bushel 42 Bishop-to-Pixel direction (MoneyPenny Mail bidirectional)
// Append-only JSONL; PWA polls /yoke/inbox to render Bishop replies in thread
const INBOX_PATH = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'pixel_inbox.jsonl',
);

// Family roster path — Bushel 44 Family Member discovery
// Append-only JSONL of family member records; active state managed by `active` field
const FAMILY_ROSTER_PATH = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'family_roster.jsonl',
);

// Family attachments dir — Bushel 46 Loteria-class rich content
// Image/audio attachments stored under {ATTACHMENTS_DIR}/{attachment_id}.{ext}
// Family Table scope only — never federated to lianabanyan.com
const ATTACHMENTS_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'family_attachments',
);
const ATTACHMENTS_INDEX = resolve(ATTACHMENTS_DIR, 'index.jsonl');

// B61 Phase 0 — Yoke dispatch substrate paths
// Per canon LB-STACK-0164 §5 L2; full wave_* dirs created by Phase A daemon.
// Phase 0 uses yoke_dispatch/{pawn,rook}/ as the pre-daemon staging area.
const LB_SUBSTRATE_ROOT_API =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');
const YOKE_DISPATCH_PAWN_DIR = resolve(LB_SUBSTRATE_ROOT_API, 'yoke_dispatch', 'pawn');
const YOKE_DISPATCH_ROOK_DIR = resolve(LB_SUBSTRATE_ROOT_API, 'yoke_dispatch', 'rook');

function ensureYokeDispatchDirs(): void {
  for (const d of [YOKE_DISPATCH_PAWN_DIR, YOKE_DISPATCH_ROOK_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

/** SHA-256 content hash of a JSON payload (Slipstream §6 receipt integrity). */
function contentHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}

// ─── Substrate API Server ─────────────────────────────────────────────────────

export class SubstrateAPIServer {
  private server: ReturnType<typeof createServer> | null = null;
  private index: SubstrateLocalIndex;
  private router: SubstrateRouter;
  private federation: FederationClient | null = null;
  private telemetry: TelemetryStore;
  private degradedMode = false;
  private yokeSseClients = new Set<ServerResponse>();
  private inboxWatchInstalled = false;

  constructor() {
    this.index = new SubstrateLocalIndex();
    this.router = new SubstrateRouter(this.index);
    this.telemetry = new TelemetryStore();
  }

  setFederationClient(client: FederationClient): void {
    this.federation = client;
  }

  getTelemetryStore(): TelemetryStore {
    return this.telemetry;
  }

  getIndex(): SubstrateLocalIndex {
    return this.index;
  }

  setMode(mode: FrameMode): void {
    this.router.setMode(mode);
  }

  setForcedMode(mode: FrameMode | null): void {
    this.router.setForcedMode(mode);
  }

  getForcedMode(): FrameMode | null {
    return this.router.getForcedMode();
  }

  getEffectiveMode(): FrameMode {
    return this.router.getEffectiveMode();
  }

  setDegradedMode(degraded: boolean): void {
    this.degradedMode = degraded;
  }

  async start(): Promise<void> {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    await this.index.load();

    // B61 Phase A — crash-restart resilience: restore in-flight wave state
    initWaveGenerator();

    // Adaptive Concurrency Carrier: 1-hour periodic re-probe (Layer 2)
    const CONCURRENCY_REPROBE_MS = 60 * 60 * 1_000;
    setInterval(
      () => probeConcurrencyCap().catch((e) => console.warn('[substrate-api] hourly cap re-probe error:', e)),
      CONCURRENCY_REPROBE_MS,
    ).unref(); // don't block app exit

    // B61 Phase C — start trigger engine (Class B/C/D)
    initTriggerEngine();

    this.server = createServer((req, res) => this._handleRequest(req, res));
    return new Promise((resolve, reject) => {
      // Bind to 0.0.0.0 so MoneyPenny mobile can reach it over WiFi
      this.server!.listen(API_PORT, '0.0.0.0', () => {
        console.log(
          `[SubstrateAPI] Listening on http://0.0.0.0:${API_PORT} — ` +
          `${this.index.size} records indexed`,
        );
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  /** Pixel inbox JSON (same payload as GET /yoke/inbox). */
  private _readPixelInboxPayload(): { replies: unknown[]; as_of: string } {
    let entries: unknown[] = [];
    if (existsSync(INBOX_PATH)) {
      const raw = readFileSync(INBOX_PATH, 'utf8');
      entries = raw
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          try {
            return JSON.parse(l) as unknown;
          } catch {
            return null;
          }
        })
        .filter((e) => e !== null);
    }
    entries.reverse();
    if (entries.length > 50) entries = entries.slice(0, 50);
    return {
      replies: entries,
      as_of: new Date().toISOString(),
    };
  }

  private _broadcastYokeInboxSse(): void {
    if (this.yokeSseClients.size === 0) return;
    const payload = JSON.stringify(this._readPixelInboxPayload());
    const chunk = `event: inbox\ndata: ${payload}\n\n`;
    for (const client of [...this.yokeSseClients]) {
      try {
        if (!client.writableEnded) client.write(chunk);
      } catch {
        this.yokeSseClients.delete(client);
      }
    }
  }

  private _ensurePixelInboxFanout(): void {
    if (this.inboxWatchInstalled) return;
    this.inboxWatchInstalled = true;
    try {
      mkdirSync(dirname(INBOX_PATH), { recursive: true });
      if (!existsSync(INBOX_PATH)) {
        appendFileSync(INBOX_PATH, '', 'utf8');
      }
    } catch {
      /* non-fatal */
    }
    try {
      let debounceTimer: ReturnType<typeof setTimeout>;
      watch(INBOX_PATH, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this._broadcastYokeInboxSse(), 100);
      });
    } catch (err) {
      console.warn('[SubstrateAPI] pixel inbox watch failed:', String(err));
    }
  }

  private _handleYokeSse(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    const resFlush = res as unknown as { flushHeaders?: () => void };
    resFlush.flushHeaders?.();

    res.write(': connected\n\n');

    this._ensurePixelInboxFanout();
    this.yokeSseClients.add(res);

    try {
      const snapshot = JSON.stringify(this._readPixelInboxPayload());
      res.write(`event: inbox\ndata: ${snapshot}\n\n`);
    } catch {
      /* ignore initial snapshot failures */
    }

    const pingIv = setInterval(() => {
      try {
        if (!res.writableEnded) res.write(': ping\n\n');
      } catch {
        clearInterval(pingIv);
      }
    }, 28_000);

    req.on('close', () => {
      clearInterval(pingIv);
      this.yokeSseClients.delete(res);
    });
    req.socket.setTimeout?.(0);
  }

  private _handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url?.split('?')[0];

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET' && url === '/yoke/stream') {
      this._handleYokeSse(req, res);
      return;
    }

    res.setHeader('Content-Type', 'application/json');

    // ── GET /health ───────────────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/health') {
      res.end(JSON.stringify({
        ok: true,
        version: '0.4.0',
        port: API_PORT,
        index_size: this.index.size,
        mode: this.router.getEffectiveMode(),
        forced_mode: this.router.getForcedMode(),
      }));
      return;
    }

    // ── GET / → redirect to /mobile ──────────────────────────────────────────
    if (req.method === 'GET' && (url === '/' || url === '')) {
      res.writeHead(302, { Location: '/mobile' });
      res.end();
      return;
    }

    // ── GET /mobile — MoneyPenny PWA shell ───────────────────────────────────
    if (req.method === 'GET' && url === '/mobile') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(getMobileHTML());
      return;
    }

    // ── GET /manifest.json ────────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/manifest.json') {
      res.setHeader('Content-Type', 'application/manifest+json');
      res.setHeader('Cache-Control', 'max-age=3600');
      res.end(getManifestJSON());
      return;
    }

    // ── GET /sw.js — service worker ───────────────────────────────────────────
    if (req.method === 'GET' && url === '/sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(getServiceWorker());
      return;
    }

    // ── GET /icon.svg ─────────────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/icon.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'max-age=86400');
      res.end(getIconSVG());
      return;
    }

    // ── GET /mode ─────────────────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/mode') {
      res.end(JSON.stringify({
        mode: this.router.getEffectiveMode(),
        forced_mode: this.router.getForcedMode(),
      }));
      return;
    }

    // ── POST /mode/force ──────────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/mode/force') {
      this._readBody(req, (body) => {
        try {
          const { mode } = JSON.parse(body) as { mode: FrameMode | null };
          this.router.setForcedMode(mode);
          res.end(JSON.stringify({ ok: true, forced_mode: this.router.getForcedMode() }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // ── GET /amplify/snapshot — session stats ─────────────────────────────────
    if (req.method === 'GET' && url === '/amplify/snapshot') {
      res.end(JSON.stringify(this.getAMPLIFYSnapshot()));
      return;
    }

    // ── GET /amplify/summary — full historical summary ────────────────────────
    if (req.method === 'GET' && url === '/amplify/summary') {
      res.end(JSON.stringify(this.telemetry.getSummary()));
      return;
    }

    // ── GET /federation/status ────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/federation/status') {
      const status = this.federation?.getStatus() ?? {
        online: false,
        peerCount: 0,
        lastSyncTs: null,
        lastSyncRecordsExchanged: 0,
        pendingWriteCount: 0,
        peers: [],
      };
      res.end(JSON.stringify(status));
      return;
    }

    // ── POST /substrate/query ─────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/substrate/query') {
      this._readBody(req, async (body) => {
        try {
          const { query, model, degraded } = JSON.parse(body) as {
            query: string;
            model?: string;
            degraded?: boolean;
          };
          if (!query || typeof query !== 'string') {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'query field required' }));
            return;
          }

          const isDegraded = this.degradedMode || degraded === true;
          const result = await this.router.query(
            query,
            isDegraded ? undefined : model,
            { degraded: isDegraded },
          );

          // Fallback: try peer sync on miss
          if (
            result.routing === 'peer_sync' &&
            this.federation &&
            this.federation.getStatus().peerCount > 0
          ) {
            const peers = this.federation.getStatus().peers;
            if (peers.length > 0) {
              const exchanged = await this.federation.syncWithPeer(peers[0]);
              if (exchanged > 0) {
                const retryResult = await this.router.query(
                  query,
                  isDegraded ? undefined : model,
                  { degraded: isDegraded },
                );
                if (retryResult.hit) {
                  this._recordTelemetry(
                    retryResult.routing as RoutingSource,
                    retryResult.latency_ms,
                    retryResult.cloud_cost_avoided_usd,
                  );
                  res.end(JSON.stringify({ ...retryResult, peer_sync_exchanged: exchanged }));
                  return;
                }
              }
            }
          }

          this._recordTelemetry(
            result.routing as RoutingSource,
            result.latency_ms,
            result.cloud_cost_avoided_usd,
          );
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // ── POST /substrate/write ─────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/substrate/write') {
      this._readBody(req, (body) => {
        try {
          const { id, text, source, keywords, degraded } = JSON.parse(body) as {
            id?: string;
            text: string;
            source?: string;
            keywords?: string[];
            degraded?: boolean;
          };
          if (this.degradedMode || degraded === true) {
            res.statusCode = 403;
            res.end(JSON.stringify({ ok: false, reason: 'degraded_mode' }));
            return;
          }
          if (!text || typeof text !== 'string') {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'text field required' }));
            return;
          }
          const record = {
            id: id ?? this._hashQuery(text),
            text,
            source: source ?? 'external_write',
            keywords: keywords ?? [],
            ts: new Date().toISOString(),
          };
          this.index.writeRecord(record);
          this.federation?.queueWrite(record);
          res.end(JSON.stringify({ ok: true, id: record.id }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // ── POST /yoke/reply — Bushel 42 Bishop-to-Pixel reply (MoneyPenny Mail bidirectional) ─
    if (req.method === 'POST' && url === '/yoke/reply') {
      this._readBody(req, (body) => {
        try {
          const { in_reply_to, text, author } = JSON.parse(body) as {
            in_reply_to: string;
            text: string;
            author?: string;
          };
          if (!in_reply_to || typeof in_reply_to !== 'string') {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'in_reply_to field required' }));
            return;
          }
          if (!text || typeof text !== 'string' || text.trim().length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'text field required' }));
            return;
          }

          const msgId = randomUUID();
          const ts = new Date().toISOString();
          const authorVal = author ?? 'Bishop';

          // Yoke append (canonical format)
          const yokeEntry = [
            '',
            '',
            `## [BISHOP → PIXEL] Reply to ${in_reply_to}`,
            `**msg_id:** ${msgId}`,
            `**timestamp:** ${ts}`,
            `**in_reply_to:** ${in_reply_to}`,
            `**author:** ${authorVal}`,
            '',
            '---',
            '',
            text.trim(),
            '',
            '---',
            '',
          ].join('\n');

          // Inbox append (JSONL for fast PWA polling)
          const inboxEntry = JSON.stringify({
            msg_id: msgId,
            in_reply_to,
            ts,
            text: text.trim(),
            author: authorVal,
            read: false,
          }) + '\n';

          try {
            appendFileSync(YOKE_PATH, yokeEntry, 'utf8');
            appendFileSync(INBOX_PATH, inboxEntry, 'utf8');
            this._broadcastYokeInboxSse();
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: 'Append failed',
              detail: String(err),
            }));
            return;
          }

          res.end(JSON.stringify({
            success: true,
            msg_id: msgId,
            ts,
            in_reply_to,
            author: authorVal,
          }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // ── GET /yoke/inbox — Bushel 42 PWA polling endpoint ─────────────────────
    if (req.method === 'GET' && url === '/yoke/inbox') {
      try {
        res.end(JSON.stringify(this._readPixelInboxPayload()));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Inbox read failed', detail: String(err) }));
      }
      return;
    }

    // ── POST /yoke/note — Bushel 41 Pixel-to-Bishop async bridge ─────────────
    // Founder leaves Bishop a note from MoneyPenny PWA; appended to Yoke channel
    // (KNIGHT_BISHOP_MESSAGES.md) which Bishop reads at next session-open.
    // Composes with B37 Phase 7 auth state (member/trial accept; degraded reject).
    if (req.method === 'POST' && url === '/yoke/note') {
      this._readBody(req, (body) => {
        try {
          const { note, urgency, tags, scope, recipient_id, recipient_name, attachment_ids } = JSON.parse(body) as {
            note: string;
            urgency?: 'low' | 'normal' | 'high';
            tags?: string[];
            scope?: 'helm' | 'family-table' | 'just-recipient' | 'public';
            recipient_id?: string;
            recipient_name?: string;
            attachment_ids?: string[];
          };
          if (!note || typeof note !== 'string' || note.trim().length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'note field required' }));
            return;
          }
          if (note.length > 8000) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'note too long (max 8000 chars)' }));
            return;
          }

          const msgId = randomUUID();
          const ts = new Date().toISOString();
          const urgencyVal = urgency ?? 'normal';
          const tagsVal = (tags ?? []).join(', ');
          const scopeVal = scope ?? 'just-recipient';
          const recipientLabel = recipient_name
            ? `${recipient_name}${recipient_id ? ` (${recipient_id.slice(0,8)})` : ''}`
            : recipient_id
              ? recipient_id.slice(0,8)
              : 'Bishop';

          // Determine Yoke header based on routing
          const yokeHeader = recipient_id
            ? `## [PIXEL → ${recipientLabel.toUpperCase()}] Founder Note via MoneyPenny (scope: ${scopeVal})`
            : '## [PIXEL → BISHOP] Founder Note via MoneyPenny';

          // Canonical Yoke message format
          const yokeEntry = [
            '',
            '',
            yokeHeader,
            `**msg_id:** ${msgId}`,
            `**timestamp:** ${ts}`,
            `**urgency:** ${urgencyVal}`,
            `**tags:** ${tagsVal || '(none)'}`,
            `**scope:** ${scopeVal}`,
            `**recipient_id:** ${recipient_id || '(bishop default)'}`,
            `**recipient_name:** ${recipient_name || 'Bishop'}`,
            '**author:** Founder (via MoneyPenny PWA)',
            '',
            '---',
            '',
            note.trim(),
            '',
            '---',
            '',
          ].join('\n');

          try {
            appendFileSync(YOKE_PATH, yokeEntry, 'utf8');
            // Bushel 45: Family Table scope notes also go to family_inbox.jsonl for recipient polling
            if (scopeVal === 'family-table' && recipient_id) {
              const familyInboxPath = resolve(
                process.env.APPDATA || process.env.HOME || '.',
                'AMPLIFY Computer',
                'family_inbox.jsonl',
              );
              const familyEntry = JSON.stringify({
                msg_id: msgId,
                ts,
                from: 'Founder',
                recipient_id,
                recipient_name: recipient_name || null,
                scope: scopeVal,
                urgency: urgencyVal,
                tags: tags || [],
                text: note.trim(),
                attachment_ids: attachment_ids || [],
                read: false,
              }) + '\n';
              appendFileSync(familyInboxPath, familyEntry, 'utf8');
            }
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: 'Yoke append failed',
              detail: String(err),
              yoke_path: YOKE_PATH,
            }));
            return;
          }

          res.end(JSON.stringify({
            success: true,
            msg_id: msgId,
            ts,
            urgency: urgencyVal,
            scope: scopeVal,
            recipient_id: recipient_id || null,
            recipient_name: recipient_name || null,
            yoke_path: YOKE_PATH,
          }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // ── POST /yoke/pawn — Bushel 58 Perplexity direct (MoneyPenny Pawn avatar) ──
    if (req.method === 'POST' && url === '/yoke/pawn') {
      this._readBody(req, async (body) => {
        try {
          const parsed = JSON.parse(body) as {
            text: string;
            context_msgs?: Array<{ role: string; content: string }>;
          };
          const { text, context_msgs } = parsed;
          if (!text?.trim()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'text required' }));
            return;
          }

          const apiKey = process.env.PERPLEXITY_API_KEY;
          if (!apiKey) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: 'PERPLEXITY_API_KEY not set' }));
            return;
          }

          const messages = [...(context_msgs ?? []), { role: 'user', content: text }];

          try {
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar-reasoning-pro',
                messages,
                stream: false,
              }),
            });

            if (!response.ok) {
              const err = await response.text();
              res.statusCode = 502;
              res.end(JSON.stringify({ error: `Perplexity error: ${err}` }));
              return;
            }

            const data = (await response.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const reply = data.choices?.[0]?.message?.content ?? '(no response)';
            res.end(JSON.stringify({ success: true, reply, recipient: 'pawn' }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // ── POST /yoke/rook — Bushel 58 Gemini direct (MoneyPenny Rook avatar) ───────
    if (req.method === 'POST' && url === '/yoke/rook') {
      this._readBody(req, async (body) => {
        try {
          const parsed = JSON.parse(body) as {
            text: string;
            context_msgs?: Array<{ role: string; parts: Array<{ text?: string }> }>;
          };
          const { text, context_msgs } = parsed;
          if (!text?.trim()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'text required' }));
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVEAI_API_KEY;
          if (!apiKey) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set' }));
            return;
          }

          const history: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];
          for (const m of context_msgs ?? []) {
            const rl = String(m.role || 'user').toLowerCase();
            const role: 'user' | 'model' = rl === 'model' || rl === 'assistant' ? 'model' : 'user';
            const joined = Array.isArray(m.parts)
              ? m.parts.map((p) => String(p?.text ?? '')).join('\n').trim()
              : '';
            if (!joined) continue;
            history.push({ role, parts: [{ text: joined }] });
          }

          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            // Default: gemini-2.0-flash — cheap, fast, works for all API tiers.
            // Override: set GEMINI_MODEL=gemini-2.5-pro in env for flagship.
            const modelId = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
            const model = genAI.getGenerativeModel({ model: modelId });
            let reply: string;
            if (history.length > 0) {
              const chat = model.startChat({ history });
              const result = await chat.sendMessage(text);
              reply = result.response.text();
            } else {
              const result = await model.generateContent(text);
              reply = result.response.text();
            }
            res.end(JSON.stringify({ success: true, reply, recipient: 'rook' }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // ── Bushel 47 #1: Read-receipts — POST /yoke/inbox/read marks Bishop reply as read ─
    if (req.method === 'POST' && url === '/yoke/inbox/read') {
      this._readBody(req, (body) => {
        try {
          const { msg_id } = JSON.parse(body) as { msg_id: string };
          if (!msg_id) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'msg_id required' }));
            return;
          }
          // Append a read-event entry; consumer (PWA) treats latest event per msg_id as canonical
          const readEntry = JSON.stringify({
            msg_id,
            event: 'read',
            ts: new Date().toISOString(),
          }) + '\n';
          appendFileSync(INBOX_PATH, readEntry, 'utf8');
          res.end(JSON.stringify({ success: true, msg_id, read_ts: new Date().toISOString() }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // ── Bushel 46: Family attachments (Loteria-class rich content — Family Table scope only) ─
    // POST /family/attachment — body {filename, content_type, base64_data}
    if (req.method === 'POST' && url === '/family/attachment') {
      this._readBody(req, (body) => {
        try {
          const { filename, content_type, base64_data } = JSON.parse(body) as {
            filename: string;
            content_type: string;
            base64_data: string;
          };
          if (!filename || !content_type || !base64_data) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'filename, content_type, base64_data all required' }));
            return;
          }
          // Limit attachment size to 20 MB base64 (~14 MB binary)
          if (base64_data.length > 20 * 1024 * 1024) {
            res.statusCode = 413;
            res.end(JSON.stringify({ error: 'attachment too large (max 14 MB binary)' }));
            return;
          }
          if (!existsSync(ATTACHMENTS_DIR)) mkdirSync(ATTACHMENTS_DIR, { recursive: true });
          const attachmentId = randomUUID();
          // Derive extension from content_type or filename
          const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1].toLowerCase() : (content_type.split('/')[1] || 'bin');
          const diskPath = resolve(ATTACHMENTS_DIR, `${attachmentId}.${ext}`);
          // Write binary data
          const buf = Buffer.from(base64_data, 'base64');
          require('fs').writeFileSync(diskPath, buf);
          const ts = new Date().toISOString();
          const indexEntry = JSON.stringify({
            attachment_id: attachmentId,
            filename,
            content_type,
            size_bytes: buf.length,
            disk_path: diskPath,
            ts,
          }) + '\n';
          appendFileSync(ATTACHMENTS_INDEX, indexEntry, 'utf8');
          res.end(JSON.stringify({
            success: true,
            attachment_id: attachmentId,
            url: `/family/attachment/${attachmentId}`,
            size_bytes: buf.length,
            content_type,
          }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid attachment', detail: String(err) }));
        }
      });
      return;
    }

    // GET /family/attachment/{attachment_id} — serves binary
    if (req.method === 'GET' && url?.startsWith('/family/attachment/')) {
      try {
        const attachmentId = url.replace('/family/attachment/', '').trim();
        if (!attachmentId || attachmentId.includes('/') || attachmentId.includes('..')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid attachment_id' }));
          return;
        }
        // Look up in index for content_type + disk_path
        let entry: any = null;
        if (existsSync(ATTACHMENTS_INDEX)) {
          const raw = require('fs').readFileSync(ATTACHMENTS_INDEX, 'utf8') as string;
          for (const line of raw.split('\n')) {
            if (!line.trim()) continue;
            try {
              const e = JSON.parse(line);
              if (e.attachment_id === attachmentId) { entry = e; break; }
            } catch { continue; }
          }
        }
        if (!entry || !existsSync(entry.disk_path)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Attachment not found' }));
          return;
        }
        const buf = require('fs').readFileSync(entry.disk_path);
        res.setHeader('Content-Type', entry.content_type);
        res.setHeader('Content-Length', String(buf.length));
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.removeHeader('Content-Type'); // override default JSON
        res.writeHead(200, { 'Content-Type': entry.content_type });
        res.end(buf);
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Attachment serve failed', detail: String(err) }));
      }
      return;
    }

    // ── Bushel 45: Family Table inbox polling (per-recipient) ────────────────
    // GET /family/inbox?member_id=X — returns notes scoped to that family member
    if (req.method === 'GET' && url === '/family/inbox') {
      try {
        const queryStr = req.url?.split('?')[1] || '';
        const params = new URLSearchParams(queryStr);
        const memberId = params.get('member_id');
        const familyInboxPath = resolve(
          process.env.APPDATA || process.env.HOME || '.',
          'AMPLIFY Computer',
          'family_inbox.jsonl',
        );
        let entries: any[] = [];
        if (existsSync(familyInboxPath)) {
          const raw = require('fs').readFileSync(familyInboxPath, 'utf8') as string;
          entries = raw.split('\n')
            .filter((l) => l.trim().length > 0)
            .map((l) => { try { return JSON.parse(l); } catch { return null; } })
            .filter((e) => e !== null);
        }
        // Filter by recipient member_id if provided
        if (memberId) {
          entries = entries.filter((e) => e.recipient_id === memberId);
        }
        entries.reverse(); // most-recent-first
        if (entries.length > 50) entries = entries.slice(0, 50);
        res.end(JSON.stringify({
          messages: entries,
          member_id: memberId,
          as_of: new Date().toISOString(),
        }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Family inbox read failed', detail: String(err) }));
      }
      return;
    }

    // ── Bushel 44: Family Member roster (Family Table foundation) ────────────
    // Family members are paired AMPLIFY peers on local network.
    // Roster appended to family_roster.jsonl; active flag toggles inclusion.

    // POST /family/add — body {name, ip?, port?, role?}
    if (req.method === 'POST' && url === '/family/add') {
      this._readBody(req, (body) => {
        try {
          const { name, ip, port, role } = JSON.parse(body) as {
            name: string;
            ip?: string;
            port?: number;
            role?: string;
          };
          if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'name field required' }));
            return;
          }
          const memberId = randomUUID();
          const ts = new Date().toISOString();
          const entry = {
            event: 'add',
            member_id: memberId,
            name: name.trim(),
            ip: ip || null,
            port: port || 11480,
            role: role || 'family_member',
            added_ts: ts,
            active: true,
          };
          appendFileSync(FAMILY_ROSTER_PATH, JSON.stringify(entry) + '\n', 'utf8');
          res.end(JSON.stringify({ success: true, ...entry }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // POST /family/remove — body {member_id}
    if (req.method === 'POST' && url === '/family/remove') {
      this._readBody(req, (body) => {
        try {
          const { member_id } = JSON.parse(body) as { member_id: string };
          if (!member_id) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'member_id required' }));
            return;
          }
          const entry = {
            event: 'remove',
            member_id,
            removed_ts: new Date().toISOString(),
          };
          appendFileSync(FAMILY_ROSTER_PATH, JSON.stringify(entry) + '\n', 'utf8');
          res.end(JSON.stringify({ success: true, member_id }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // GET /family/roster — returns active family members + online status from federation peers
    if (req.method === 'GET' && url === '/family/roster') {
      try {
        const members = new Map<string, any>();
        if (existsSync(FAMILY_ROSTER_PATH)) {
          const raw = require('fs').readFileSync(FAMILY_ROSTER_PATH, 'utf8') as string;
          for (const line of raw.split('\n')) {
            if (!line.trim()) continue;
            let entry: any;
            try { entry = JSON.parse(line); } catch { continue; }
            if (entry.event === 'add') {
              members.set(entry.member_id, { ...entry, active: true });
            } else if (entry.event === 'remove' && members.has(entry.member_id)) {
              const m = members.get(entry.member_id);
              m.active = false;
              members.set(entry.member_id, m);
            }
          }
        }
        // Cross-reference with federation peer registry for online/offline
        const fedPeers = this.federation?.getStatus().peers ?? [];
        const peerIPs = new Set(fedPeers.map((p) => p.address));
        const roster = Array.from(members.values())
          .filter((m) => m.active)
          .map((m) => ({
            member_id: m.member_id,
            name: m.name,
            ip: m.ip,
            port: m.port,
            role: m.role,
            added_ts: m.added_ts,
            online: m.ip ? peerIPs.has(m.ip) : false,
          }));
        res.end(JSON.stringify({ roster, as_of: new Date().toISOString() }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Roster read failed', detail: String(err) }));
      }
      return;
    }

    // ── Bushel 60 Phase B: Shadow E-Sprite courier endpoints (BP030) ─────────
    // POST /yoke/sprite/dispatch — body {session, package_path, source_cluster,
    //   destination_cluster, destination_path_pattern, candidate_dropzones,
    //   redundancy_count?, lock_signature?, metadata?}
    // Spawns N parallel Sprite couriers. First-success-wins with file-flag recall.
    // Returns final delivery receipt (waits for completion).
    if (req.method === 'POST' && url === '/yoke/sprite/dispatch') {
      this._readBody(req, async (body) => {
        try {
          const parsed = JSON.parse(body) as {
            session?: string;
            package_path: string;
            source_cluster: ClusterName;
            destination_cluster: ClusterName;
            destination_path_pattern: string;
            candidate_dropzones: string[];
            redundancy_count?: number;
            lock_signature?: string;
            metadata?: Record<string, unknown>;
          };
          if (!parsed.package_path || !parsed.source_cluster ||
              !parsed.destination_cluster || !parsed.destination_path_pattern ||
              !Array.isArray(parsed.candidate_dropzones)) {
            res.statusCode = 400;
            res.end(JSON.stringify({
              error: 'package_path, source_cluster, destination_cluster, ' +
                'destination_path_pattern, candidate_dropzones[] all required',
            }));
            return;
          }
          const registry = getSpriteRegistry();
          const lockSig = parsed.lock_signature ??
            computeLockSignature(parsed.destination_cluster, parsed.package_path);
          const dispatch: SpriteDispatch = {
            dispatch_id: randomUUID(),
            session: parsed.session ?? 'BP030',
            package_path: parsed.package_path,
            source_cluster: parsed.source_cluster,
            destination_cluster: parsed.destination_cluster,
            lock_signature: lockSig,
            destination_path_pattern: parsed.destination_path_pattern,
            redundancy_count: Math.max(1, (parsed.redundancy_count ?? 3) | 0),
            spawn_timestamp: new Date().toISOString(),
            candidate_dropzones: parsed.candidate_dropzones,
            metadata: parsed.metadata,
          };
          const receipt = await registry.dispatchSprites(dispatch);
          res.end(JSON.stringify({ success: true, receipt }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON or dispatch error', detail: String(err) }));
        }
      });
      return;
    }

    // POST /yoke/sprite/recall — body {dispatch_id, reason?}
    // External admin abort of an in-flight dispatch.
    if (req.method === 'POST' && url === '/yoke/sprite/recall') {
      this._readBody(req, (body) => {
        try {
          const { dispatch_id, reason } = JSON.parse(body) as {
            dispatch_id: string;
            reason?: string;
          };
          if (!dispatch_id) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'dispatch_id required' }));
            return;
          }
          const ok = getSpriteRegistry().recall(dispatch_id, reason ?? 'external_recall');
          res.end(JSON.stringify({ success: ok, dispatch_id }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
        }
      });
      return;
    }

    // GET /yoke/sprite/status — snapshot of currently in-flight dispatches.
    if (req.method === 'GET' && url === '/yoke/sprite/status') {
      try {
        const snap = getSpriteRegistry().getActiveSnapshot();
        res.end(JSON.stringify({ active: snap, as_of: new Date().toISOString() }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Status read failed', detail: String(err) }));
      }
      return;
    }

    // ── GET /hearth/health ────────────────────────────────────────────────────
    // MCP tool: mcp__hearth__healthz — G14 ship-class endpoint
    if (req.method === 'GET' && url === '/hearth/health') {
      import('./hearth_app_builder/orchestrator').then(({ getHearthHealthz }) => {
        getHearthHealthz().then((healthz) => {
          res.end(JSON.stringify(healthz));
        }).catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        });
      }).catch((err) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }

    // ── GET /hearth/library ───────────────────────────────────────────────────
    // MCP tool: mcp__hearth__library_query — G14 ship-class endpoint
    if (req.method === 'GET' && url?.startsWith('/hearth/library')) {
      import('./hearth_app_builder/orchestrator').then(({ getHearthLibrary }) => {
        const apps = getHearthLibrary();
        res.end(JSON.stringify({ apps }));
      }).catch((err) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }

    // ── POST /hearth/spec-smoke ───────────────────────────────────────────────
    // MCP tool: mcp__hearth__spec_extract_smoke — G14 ship-class endpoint
    if (req.method === 'POST' && url === '/hearth/spec-smoke') {
      import('./hearth_app_builder/orchestrator').then(({ runSpecExtractSmoke }) => {
        runSpecExtractSmoke().then((result) => {
          res.end(JSON.stringify(result));
        }).catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        });
      }).catch((err) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }

    // ── B61 Phase 0 — POST /yoke/pawn/dispatch ────────────────────────────────
    // Pawn-class wave dispatch: accepts prompt → Perplexity sonar-reasoning-pro →
    // persists receipt to ~/.lb_substrate/yoke_dispatch/pawn/{dispatch_id}.receipt.json
    // G0 gate: single-dispatch round-trip verified (receipt file confirms).
    if (req.method === 'POST' && url === '/yoke/pawn/dispatch') {
      this._readBody(req, async (body) => {
        ensureYokeDispatchDirs();
        let parsed: {
          prompt: string;
          dispatch_id?: string;
          session?: string;
          context_msgs?: Array<{ role: string; content: string }>;
          budget_guardrail_usd?: number;
        };
        try {
          parsed = JSON.parse(body) as typeof parsed;
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
          return;
        }
        const { prompt, context_msgs, session } = parsed;
        if (!prompt?.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'prompt required' }));
          return;
        }
        const dispatchId = parsed.dispatch_id ?? randomUUID();
        const spawnTs = new Date().toISOString();
        const requestPayload = { dispatch_id: dispatchId, session: session ?? 'B61', prompt, spawn_timestamp: spawnTs, recipient: 'pawn' };
        writeFileSync(
          resolve(YOKE_DISPATCH_PAWN_DIR, `${dispatchId}.request.json`),
          JSON.stringify({ ...requestPayload, status: 'PENDING' }, null, 2),
        );

        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) {
          const errReceipt = { ...requestPayload, status: 'ERROR', error: 'PERPLEXITY_API_KEY not set', completed_timestamp: new Date().toISOString() };
          writeFileSync(resolve(YOKE_DISPATCH_PAWN_DIR, `${dispatchId}.receipt.json`), JSON.stringify(errReceipt, null, 2));
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'PERPLEXITY_API_KEY not set', dispatch_id: dispatchId }));
          return;
        }

        const messages = [...(context_msgs ?? []), { role: 'user', content: prompt }];
        try {
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'sonar-reasoning-pro', messages, stream: false }),
          });
          const completedTs = new Date().toISOString();
          if (!response.ok) {
            const errBody = await response.text();
            const errReceipt = { ...requestPayload, status: 'ERROR', error: errBody, completed_timestamp: completedTs };
            writeFileSync(resolve(YOKE_DISPATCH_PAWN_DIR, `${dispatchId}.receipt.json`), JSON.stringify(errReceipt, null, 2));
            res.statusCode = 502;
            res.end(JSON.stringify({ error: `Perplexity error: ${errBody}`, dispatch_id: dispatchId }));
            return;
          }
          const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const reply = data.choices?.[0]?.message?.content ?? '(no response)';
          const receipt = { ...requestPayload, status: 'COMPLETE', reply, completed_timestamp: completedTs, receipt_hash: contentHash({ dispatchId, reply, completedTs }) };
          writeFileSync(resolve(YOKE_DISPATCH_PAWN_DIR, `${dispatchId}.receipt.json`), JSON.stringify(receipt, null, 2));
          res.end(JSON.stringify({ success: true, dispatch_id: dispatchId, reply, receipt_hash: receipt.receipt_hash, recipient: 'pawn' }));
        } catch (e) {
          const completedTs = new Date().toISOString();
          const errReceipt = { ...requestPayload, status: 'ERROR', error: String(e), completed_timestamp: completedTs };
          writeFileSync(resolve(YOKE_DISPATCH_PAWN_DIR, `${dispatchId}.receipt.json`), JSON.stringify(errReceipt, null, 2));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e), dispatch_id: dispatchId }));
        }
      });
      return;
    }

    // ── B61 Phase 0 — GET /yoke/pawn/status/:dispatch_id ─────────────────────
    if (req.method === 'GET' && url?.startsWith('/yoke/pawn/status/')) {
      ensureYokeDispatchDirs();
      const dispatchId = url!.slice('/yoke/pawn/status/'.length);
      if (!dispatchId) { res.statusCode = 400; res.end(JSON.stringify({ error: 'dispatch_id required' })); return; }
      const receiptPath = resolve(YOKE_DISPATCH_PAWN_DIR, `${dispatchId}.receipt.json`);
      const requestPath = resolve(YOKE_DISPATCH_PAWN_DIR, `${dispatchId}.request.json`);
      if (existsSync(receiptPath)) {
        try {
          const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
          res.end(JSON.stringify(receipt));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'receipt parse error', dispatch_id: dispatchId }));
        }
      } else if (existsSync(requestPath)) {
        res.end(JSON.stringify({ dispatch_id: dispatchId, status: 'PENDING', recipient: 'pawn' }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'dispatch not found', dispatch_id: dispatchId }));
      }
      return;
    }

    // ── B61 Phase 0 — POST /yoke/rook/dispatch ────────────────────────────────
    // Rook-class wave dispatch: accepts prompt → Gemini → persists receipt.
    if (req.method === 'POST' && url === '/yoke/rook/dispatch') {
      this._readBody(req, async (body) => {
        ensureYokeDispatchDirs();
        let parsed: {
          prompt: string;
          dispatch_id?: string;
          session?: string;
          context_msgs?: Array<{ role: string; parts: Array<{ text?: string }> }>;
          budget_guardrail_usd?: number;
          model_override?: string;
        };
        try {
          parsed = JSON.parse(body) as typeof parsed;
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
          return;
        }
        const { prompt, context_msgs, session } = parsed;
        if (!prompt?.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'prompt required' }));
          return;
        }
        const dispatchId = parsed.dispatch_id ?? randomUUID();
        const spawnTs = new Date().toISOString();
        const requestPayload = { dispatch_id: dispatchId, session: session ?? 'B61', prompt, spawn_timestamp: spawnTs, recipient: 'rook' };
        writeFileSync(
          resolve(YOKE_DISPATCH_ROOK_DIR, `${dispatchId}.request.json`),
          JSON.stringify({ ...requestPayload, status: 'PENDING' }, null, 2),
        );

        const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVEAI_API_KEY;
        if (!apiKey) {
          const errReceipt = { ...requestPayload, status: 'ERROR', error: 'GEMINI_API_KEY not set', completed_timestamp: new Date().toISOString() };
          writeFileSync(resolve(YOKE_DISPATCH_ROOK_DIR, `${dispatchId}.receipt.json`), JSON.stringify(errReceipt, null, 2));
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set', dispatch_id: dispatchId }));
          return;
        }

        const history: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];
        for (const m of context_msgs ?? []) {
          const rl = String(m.role || 'user').toLowerCase();
          const role: 'user' | 'model' = rl === 'model' || rl === 'assistant' ? 'model' : 'user';
          const joined = Array.isArray(m.parts) ? m.parts.map((p) => String(p?.text ?? '')).join('\n').trim() : '';
          if (!joined) continue;
          history.push({ role, parts: [{ text: joined }] });
        }

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const modelId = parsed.model_override ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
          const model = genAI.getGenerativeModel({ model: modelId });
          let reply: string;
          if (history.length > 0) {
            const chat = model.startChat({ history });
            const result = await chat.sendMessage(prompt);
            reply = result.response.text();
          } else {
            const result = await model.generateContent(prompt);
            reply = result.response.text();
          }
          const completedTs = new Date().toISOString();
          const receipt = { ...requestPayload, model: modelId, status: 'COMPLETE', reply, completed_timestamp: completedTs, receipt_hash: contentHash({ dispatchId, reply, completedTs }) };
          writeFileSync(resolve(YOKE_DISPATCH_ROOK_DIR, `${dispatchId}.receipt.json`), JSON.stringify(receipt, null, 2));
          res.end(JSON.stringify({ success: true, dispatch_id: dispatchId, reply, receipt_hash: receipt.receipt_hash, recipient: 'rook', model: modelId }));
        } catch (e) {
          const completedTs = new Date().toISOString();
          const errReceipt = { ...requestPayload, status: 'ERROR', error: String(e), completed_timestamp: completedTs };
          writeFileSync(resolve(YOKE_DISPATCH_ROOK_DIR, `${dispatchId}.receipt.json`), JSON.stringify(errReceipt, null, 2));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e), dispatch_id: dispatchId }));
        }
      });
      return;
    }

    // ── B61 Phase 0 — GET /yoke/rook/status/:dispatch_id ─────────────────────
    if (req.method === 'GET' && url?.startsWith('/yoke/rook/status/')) {
      ensureYokeDispatchDirs();
      const dispatchId = url!.slice('/yoke/rook/status/'.length);
      if (!dispatchId) { res.statusCode = 400; res.end(JSON.stringify({ error: 'dispatch_id required' })); return; }
      const receiptPath = resolve(YOKE_DISPATCH_ROOK_DIR, `${dispatchId}.receipt.json`);
      const requestPath = resolve(YOKE_DISPATCH_ROOK_DIR, `${dispatchId}.request.json`);
      if (existsSync(receiptPath)) {
        try {
          const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
          res.end(JSON.stringify(receipt));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'receipt parse error', dispatch_id: dispatchId }));
        }
      } else if (existsSync(requestPath)) {
        res.end(JSON.stringify({ dispatch_id: dispatchId, status: 'PENDING', recipient: 'rook' }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'dispatch not found', dispatch_id: dispatchId }));
      }
      return;
    }

    // ── B61 Phase A/B — POST /yoke/wave/dispatch ──────────────────────────────
    // Phase A: anchor + segs[] (inline SEG array)
    // Phase B: anchor + template_name + params (template expansion; segs[] not required)
    if (req.method === 'POST' && url === '/yoke/wave/dispatch') {
      this._readBody(req, async (body) => {
        let parsed: WaveRequest;
        try {
          parsed = JSON.parse(body) as WaveRequest;
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON', detail: String(err) }));
          return;
        }
        if (!parsed.anchor?.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'anchor required' }));
          return;
        }
        // Accept either inline segs[] (Phase A) or template_name (Phase B/C)
        const hasSegs     = Array.isArray(parsed.segs) && parsed.segs.length > 0;
        const hasTemplate = typeof parsed.template_name === 'string' && parsed.template_name.length > 0;
        if (!hasSegs && !hasTemplate) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'segs[] or template_name required' }));
          return;
        }
        try {
          const wave = await waveDispatch(parsed);
          res.statusCode = 202;
          res.end(JSON.stringify({
            wave_id:   wave.wave_id,
            anchor:    wave.anchor,
            status:    wave.status,
            seg_count: wave.segs.length,
            created_at: wave.created_at,
          }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // ── B61 Phase A — GET /yoke/wave/status/:wave_id ──────────────────────────
    if (req.method === 'GET' && url?.startsWith('/yoke/wave/status/')) {
      const waveId = url!.slice('/yoke/wave/status/'.length);
      if (!waveId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'wave_id required' }));
        return;
      }
      const wave = getWave(waveId);
      if (!wave) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'wave not found', wave_id: waveId }));
        return;
      }
      res.end(JSON.stringify({
        wave_id:       wave.wave_id,
        anchor:        wave.anchor,
        status:        wave.status,
        seg_count:     wave.segs.length,
        segs:          wave.segs.map(s => ({
          seg_id: s.seg_id,
          recipient: s.recipient,
          status: s.status,
          done_at: s.done_at,
        })),
        created_at:    wave.created_at,
        started_at:    wave.started_at,
        completed_at:  wave.completed_at,
        synthesis_receipt_path: wave.synthesis_receipt_path,
        hmac:          wave.hmac,
        error:         wave.error,
        wave_summary:  getWaveSummary(),
      }));
      return;
    }

    // ── B61 Phase C — POST /yoke/wave/nl ─────────────────────────────────────
    // Class A: accept casual natural-language text → parse → dispatch wave.
    // Body: { "text": "fire a 4-way cohort on cooperative-AI governance" }
    // Returns 202 with wave receipt if parsed; 400 with parse_error if no pattern matched.
    if (req.method === 'POST' && url === '/yoke/wave/nl') {
      this._readBody(req, async (body) => {
        let nlText: string | undefined;
        try {
          const parsed = JSON.parse(body) as { text?: string };
          nlText = parsed.text;
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON; expected { "text": "..." }' }));
          return;
        }
        if (!nlText?.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: '"text" field required' }));
          return;
        }
        const waveReq = parseNlWaveRequest(nlText);
        if (!waveReq) {
          res.statusCode = 400;
          res.end(JSON.stringify({
            error:       'parse_error',
            detail:      'No wave template pattern matched the input text.',
            hint:        'Try: "fire a 4-way cohort on [topic]" | "cross-vendor verification on [topic]" | "drill-down on [topic]"',
            input:       nlText,
          }));
          return;
        }
        try {
          const wave = await waveDispatch(waveReq);
          res.statusCode = 202;
          res.end(JSON.stringify({
            wave_id:       wave.wave_id,
            anchor:        wave.anchor,
            template_name: waveReq.template_name,
            params:        waveReq.params,
            status:        wave.status,
            seg_count:     wave.segs.length,
            created_at:    wave.created_at,
            class_a:       true,
          }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // ── B61 Phase C — GET /yoke/wave/triggers ────────────────────────────────
    // Trigger Engine status: Class B subscriptions, Class C schedules, dedup registry.
    if (req.method === 'GET' && url === '/yoke/wave/triggers') {
      const summary = getTriggerSummary();
      res.end(JSON.stringify({
        ...summary,
        wave_summary:  getWaveSummary(),
        as_of:         new Date().toISOString(),
      }));
      return;
    }

    // ── B61 Phase C — POST /yoke/wave/substrate_event ────────────────────────
    // Manually emit a substrate-state event for Class B testing.
    // Body: { "event_type": "canon_eblet_landed", "payload": { ... } }
    if (req.method === 'POST' && url === '/yoke/wave/substrate_event') {
      this._readBody(req, (body) => {
        let parsed: { event_type?: string; payload?: Record<string, unknown> };
        try {
          parsed = JSON.parse(body) as typeof parsed;
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }
        if (!parsed.event_type?.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'event_type required' }));
          return;
        }
        emitSubstrateEvent(parsed.event_type, parsed.payload ?? {});
        res.end(JSON.stringify({ emitted: true, event_type: parsed.event_type, class_b: true }));
      });
      return;
    }

    // ── B61 Phase A — POST /yoke/wave/abort/:wave_id ──────────────────────────
    if (req.method === 'POST' && url?.startsWith('/yoke/wave/abort/')) {
      const waveId = url!.slice('/yoke/wave/abort/'.length);
      if (!waveId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'wave_id required' }));
        return;
      }
      const aborted = abortWave(waveId);
      if (!aborted) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: 'wave not found or already terminal', wave_id: waveId }));
        return;
      }
      res.end(JSON.stringify({ wave_id: waveId, status: 'aborted', message: 'wave abort requested' }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  // ─── Telemetry ────────────────────────────────────────────────────────────

  private _recordTelemetry(
    routing: RoutingSource,
    latency_ms: number,
    cloud_cost_avoided_usd: number,
  ): void {
    this.telemetry.record({
      routing,
      latency_ms,
      cloud_cost_avoided_usd,
      tokens_saved_est: Math.round(cloud_cost_avoided_usd / 0.000003),
    });
  }

  getAMPLIFYSnapshot(): object {
    const s = this.telemetry.getSessionStats();
    return {
      total_queries: s.total_queries,
      substrate_hits: s.substrate_hits,
      local_ollama_served: s.local_ollama_served,
      cloud_escalations: s.cloud_escalations,
      peer_synced: s.peer_synced,
      substrate_hit_ratio: s.substrate_hit_ratio,
      local_ratio: s.local_ratio,
      cloud_ratio: s.cloud_ratio,
      total_cloud_cost_avoided_usd: s.cloud_cost_avoided_usd,
      total_tokens_saved_est: s.tokens_saved_est,
      avg_latency_ms: s.avg_latency_ms,
      avg_local_latency_ms: s.avg_local_latency_ms,
      latency_improvement_pct: s.latency_improvement_pct,
      index_size: this.index.size,
      as_of: new Date().toISOString(),
    };
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private _readBody(req: IncomingMessage, cb: (body: string) => void): void {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => cb(body));
  }

  private _hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      hash = ((hash << 5) - hash + query.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36).padStart(8, '0');
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
