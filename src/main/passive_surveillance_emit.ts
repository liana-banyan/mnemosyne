/**
 * Passive-Surveillance Emit — Substrate-API Gateway side
 * BP044 W1 · Canon: Coffee BP043 §6 anchor #6
 *
 * This module is the WRITE side of the Passive-Surveillance Logger.
 * It runs inside the AMPLIFY Computer electron process (port 11480).
 *
 * The READ/QUERY side lives at:
 *   librarian-mcp/src/scribes/passive_surveillance.ts
 *
 * Both sides share the same JSONL storage paths under:
 *   ~/.lb_substrate/passive_surveillance/
 *
 * INFORMATIVE-SILENCE INVARIANT:
 *   This module NEVER emits any signal to the queryer.
 *   It never modifies req, res, headers, body, or response timing.
 *   All I/O is best-effort and non-blocking.
 *   Any exception is swallowed — surveillance failure never affects the request.
 *
 * Federal Body Cam doctrine inversion:
 *   The substrate logs the surveilors. They do not log the substrate.
 *
 * What gets logged (per BP044 W1 acceptance criteria):
 *   - Query frequency per account / IP / agent / timestamp / endpoint
 *   - Legal-basis and referer class
 *   - Failed-auth attempts (401 / 403)
 *   - Scrape-pattern rhythm classification
 *   - Cross-account fingerprint (same actor, multiple sessions)
 *
 * What does NOT get logged:
 *   - Member content or member private data
 *   - Member queries on their OWN data (cooperative-substrate-class privacy invariant)
 *   - Internal self-service endpoints (PWA, health, stream)
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import type { IncomingMessage } from 'http';

// ─── Storage paths (shared with librarian-mcp read side) ─────────────────────

const SURV_BASE       = resolve(homedir(), '.lb_substrate', 'passive_surveillance');
const RAW_QUERIES     = resolve(SURV_BASE, 'raw_queries.jsonl');
const GAP_ALERTS      = resolve(SURV_BASE, 'gap_alerts.jsonl');
const BASELINE_MODEL  = resolve(SURV_BASE, 'baseline_model.json');
const AUDIT_ACCESS    = resolve(SURV_BASE, 'audit_access.jsonl');

function ensureDir(): void {
  if (!existsSync(SURV_BASE)) mkdirSync(SURV_BASE, { recursive: true });
}

// ─── Endpoint classification ──────────────────────────────────────────────────

/** Internal/self-service paths — EXCLUDED from surveillance (member privacy invariant). */
const EXCLUDED = new Set([
  '/yoke/stream', '/mobile', '/manifest.json', '/sw.js',
  '/icon.svg', '/health', '/healthz', '/', '',
  '/yoke/pawn/dispatch', '/yoke/pawn/status',
  '/yoke/rook/dispatch', '/yoke/rook/status',
  '/yoke/wave/dispatch', '/yoke/wave/status', '/yoke/wave/abort', '/yoke/wave/nl',
  '/yoke/wave/triggers',
  '/amplify/snapshot', '/amplify/summary',
  '/federation/status',
  '/yoke/inbox',
  '/yoke/family/add', '/yoke/family/list', '/yoke/family/message',
  '/yoke/attachment/upload', '/yoke/attachment/serve',
]);

function isExcluded(path: string): boolean {
  if (EXCLUDED.has(path)) return true;
  // Exclude parameterized excluded paths
  if (path.startsWith('/yoke/pawn/status/')) return true;
  if (path.startsWith('/yoke/rook/status/')) return true;
  if (path.startsWith('/yoke/wave/status/')) return true;
  if (path.startsWith('/yoke/wave/abort/')) return true;
  if (path.startsWith('/yoke/attachment/serve/')) return true;
  return false;
}

// ─── Referer + rhythm classification ─────────────────────────────────────────

type RefererClass = 'direct' | 'browser-manual' | 'api-client' | 'scraper' | 'law-enforcement' | 'unknown';
type RhythmClass  = 'human' | 'programmatic' | 'burst' | 'unknown';

function classifyReferer(req: IncomingMessage): RefererClass {
  const ua     = (req.headers['user-agent'] ?? '') as string;
  const accept = (req.headers['accept'] ?? '') as string;
  if (req.headers['x-lb-le-token']) return 'law-enforcement';
  const uaL = ua.toLowerCase();
  if (
    uaL.includes('wget') || uaL.includes('curl') || uaL.includes('scrapy') ||
    uaL.includes('python-requests') || uaL.includes('go-http-client') ||
    uaL.includes('okhttp') || uaL.includes('java/')
  ) return 'scraper';
  if (!ua || ua === '-') return 'unknown';
  if (accept.includes('text/html')) return 'browser-manual';
  if (!accept) return 'api-client';
  return 'direct';
}

// Sliding-window IP frequency tracker (1-minute window)
const _ipTimestamps = new Map<string, number[]>();

function trackAndClassifyRhythm(ip: string): RhythmClass {
  const now = Date.now();
  const win = 60_000;
  const times = (_ipTimestamps.get(ip) ?? []).filter(t => now - t < win);
  times.push(now);
  _ipTimestamps.set(ip, times);
  const n = times.length;
  if (n > 30) return 'burst';
  if (n > 5)  return 'programmatic';
  if (n > 1)  return 'human';
  return 'unknown';
}

/** Anonymize last IPv4 octet; mask last IPv6 group. */
function anonymizeIp(raw: string): string {
  const v4 = raw.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.0`;
  if (raw.includes(':')) return raw.replace(/:[0-9a-f]+$/i, ':0000');
  return raw;
}

/** Cross-session fingerprint (same actor, different accounts). */
function sessionFingerprint(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 16);
}

// ─── Event interface ──────────────────────────────────────────────────────────

interface SurveillanceEvent {
  event_id:            string;
  ts:                  string;
  endpoint:            string;
  method:              string;
  ip:                  string;
  user_agent:          string;
  referer_class:       RefererClass;
  rhythm_class:        RhythmClass;
  account_id?:         string;
  legal_basis?:        string;
  le_token_hash?:      string;
  status_code:         number;
  is_failed_auth:      boolean;
  session_fingerprint: string;
}

// ─── Baseline model ───────────────────────────────────────────────────────────

interface EndpointBaseline {
  endpoint:      string;
  sample_count:  number;
  mean_rph:      number;
  p95_gap_hours: number;
  last_seen:     string;
  last_updated:  string;
}
interface BaselineModel {
  version:   number;
  updated:   string;
  endpoints: Record<string, EndpointBaseline>;
}

function loadBaseline(): BaselineModel {
  try {
    if (existsSync(BASELINE_MODEL)) {
      return JSON.parse(readFileSync(BASELINE_MODEL, 'utf8')) as BaselineModel;
    }
  } catch { /* ignore */ }
  return { version: 1, updated: new Date().toISOString(), endpoints: {} };
}

function updateBaseline(endpoint: string): void {
  try {
    const model = loadBaseline();
    const now   = new Date().toISOString();
    const ex    = model.endpoints[endpoint];

    if (!ex) {
      model.endpoints[endpoint] = {
        endpoint, sample_count: 1, mean_rph: 1,
        p95_gap_hours: 24, last_seen: now, last_updated: now,
      };
    } else {
      const gapH = (Date.now() - new Date(ex.last_seen).getTime()) / 3_600_000;
      const a = 0.1;
      const instantRph = gapH > 0 ? (1 / gapH) : ex.mean_rph;
      ex.mean_rph = a * instantRph + (1 - a) * ex.mean_rph;
      ex.p95_gap_hours = gapH > ex.p95_gap_hours
        ? gapH * 0.95 + ex.p95_gap_hours * 0.05
        : ex.p95_gap_hours * 0.99;
      ex.sample_count += 1;
      ex.last_seen    = now;
      ex.last_updated = now;
      model.endpoints[endpoint] = ex;
    }
    model.updated = new Date().toISOString();
    writeFileSync(BASELINE_MODEL, JSON.stringify(model, null, 2), 'utf8');
  } catch { /* baseline drift is acceptable; never throw */ }
}

// ─── Gap detection ────────────────────────────────────────────────────────────

const YOKE_PATH = process.env.YOKE_PATH ?? resolve(
  process.env.HOMEDRIVE && process.env.HOMEPATH
    ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`
    : process.env.HOME ?? '.',
  'Documents', 'LianaBanyanPlatform', 'KNIGHT_BISHOP_MESSAGES.md',
);

function dispatchGapAlert(alert: {
  alert_id: string; ts: string; endpoint: string; gap_type: string;
  actor_ip: string; actor_agent: string; baseline_rph: number;
  observed_gap_hours: number; detail: string;
}): void {
  // 1. Append to gap_alerts.jsonl
  try {
    appendFileSync(GAP_ALERTS, JSON.stringify({ ...alert, dispatched_to: ['bishop', 'watchdog'] }) + '\n', 'utf8');
  } catch { /* non-fatal */ }

  // 2. Yoke → Bishop via KNIGHT_BISHOP_MESSAGES.md
  const entry =
    `\n---\n` +
    `<!-- passive-surveillance-gap-alert ${alert.ts} -->\n` +
    `**[WATCHDOG · PASSIVE-SURVEILLANCE GAP-DETECTION · ${alert.ts}]**\n\n` +
    `- **Type:** ${alert.gap_type}\n` +
    `- **Endpoint:** \`${alert.endpoint}\`\n` +
    `- **Gap:** ${alert.observed_gap_hours.toFixed(1)}h (baseline ${alert.baseline_rph.toFixed(2)} rph)\n` +
    `- **Detail:** ${alert.detail}\n` +
    `- **Alert ID:** ${alert.alert_id}\n\n` +
    `_Informative-silence class. Do not disclose to queryers. Founder/Bishop review required before action. BP044 W1._\n`;
  try { appendFileSync(YOKE_PATH, entry, 'utf8'); } catch { /* non-fatal */ }

  // 3. Watchdog alerts path
  const watchdogPath = resolve(homedir(), '.claude', 'state', 'watchdog', 'passive_surveillance_alerts.jsonl');
  try {
    mkdirSync(resolve(watchdogPath, '..'), { recursive: true });
    appendFileSync(watchdogPath, JSON.stringify(alert) + '\n', 'utf8');
  } catch { /* non-fatal */ }
}

function uuid4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Check all baselines for extended-silence gaps. */
export function checkGaps(): void {
  try {
    const model = loadBaseline();
    const now   = Date.now();
    for (const b of Object.values(model.endpoints)) {
      if (b.sample_count < 10) continue;
      const gapH = (now - new Date(b.last_seen).getTime()) / 3_600_000;
      const threshold = b.p95_gap_hours * 1.5;
      if (gapH > threshold) {
        dispatchGapAlert({
          alert_id:            uuid4(),
          ts:                  new Date().toISOString(),
          endpoint:            b.endpoint,
          gap_type:            'extended_silence',
          actor_ip:            '[all]',
          actor_agent:         '[all]',
          baseline_rph:        b.mean_rph,
          observed_gap_hours:  gapH,
          detail: `Endpoint ${b.endpoint} silent for ${gapH.toFixed(1)}h — expected ≤${threshold.toFixed(1)}h (p95×1.5). Possible evasion or service disruption.`,
        });
      }
    }
  } catch { /* non-fatal */ }
}

// ─── Gap-detection scheduler ──────────────────────────────────────────────────

let _scheduler: ReturnType<typeof setInterval> | null = null;

/** Start gap-detection check every 15 minutes. Called once from SubstrateAPIServer.start(). */
export function startGapDetectionScheduler(): void {
  if (_scheduler) return;
  _scheduler = setInterval(() => { checkGaps(); }, 15 * 60 * 1_000);
  _scheduler.unref?.();
}

export function stopGapDetectionScheduler(): void {
  if (_scheduler) { clearInterval(_scheduler); _scheduler = null; }
}

// ─── Main: logGatewayRequest ──────────────────────────────────────────────────

/**
 * Log a gateway request event.
 * Called from `_handleRequest` via `res.on('finish', ...)`.
 *
 * INFORMATIVE SILENCE:
 *   - Never modifies req or res
 *   - Never throws (all exceptions caught)
 *   - Never writes to any response header or body
 *   - Never blocks the event loop (all I/O synchronous but best-effort)
 */
export function logGatewayRequest(
  req: IncomingMessage,
  statusCode: number,
  accountId?: string,
): void {
  try {
    const path = req.url?.split('?')[0] ?? '/';
    if (isExcluded(path)) return;
    if (req.method === 'OPTIONS') return;

    const rawIp = (
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      '0.0.0.0'
    );
    const ip  = anonymizeIp(rawIp);
    const ua  = ((req.headers['user-agent'] ?? '[none]') as string).slice(0, 200);

    const refClass   = classifyReferer(req);
    const rhythmClass = trackAndClassifyRhythm(ip);
    const legalBasis = req.headers['x-lb-legal-basis'] as string | undefined;
    const leToken    = req.headers['x-lb-le-token'] as string | undefined;
    const fingerprint = sessionFingerprint(ip, ua);

    const event: SurveillanceEvent = {
      event_id:            uuid4(),
      ts:                  new Date().toISOString(),
      endpoint:            path,
      method:              req.method ?? 'UNKNOWN',
      ip,
      user_agent:          ua,
      referer_class:       refClass,
      rhythm_class:        rhythmClass,
      account_id:          accountId,
      legal_basis:         legalBasis,
      le_token_hash:       leToken
        ? createHash('sha256').update(leToken).digest('hex').slice(0, 16)
        : undefined,
      status_code:         statusCode,
      is_failed_auth:      statusCode === 401 || statusCode === 403,
      session_fingerprint: fingerprint,
    };

    ensureDir();
    appendFileSync(RAW_QUERIES, JSON.stringify(event) + '\n', 'utf8');

    // Update baseline model for gap-detection (non-excluded endpoints only)
    updateBaseline(path);
  } catch {
    /* surveillance failure must never affect the request path */
  }
}
