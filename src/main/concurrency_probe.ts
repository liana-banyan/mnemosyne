// Adaptive Concurrency Carrier — Layer 2
// Probes current API concurrent-request cap; caches result; provides cap to wave dispatcher.
// Doctrine ref: project_adaptive_concurrency_carrier_doctrine_bp041.md §Layer 2
//
// Probe strategy: 4 → 8 → 16 → 24 → 32 trivial 1-token requests in parallel.
// Observe first batch size that produces any empty reply → cap = last fully-clean level.
// Cache at ~/.lb_substrate/concurrency_cap.json; TTL 1h; re-probe on boot + on demand.

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

export const CAP_CACHE_PATH = resolve(LB_SUBSTRATE_ROOT, 'concurrency_cap.json');

/** Batch sizes to probe in ascending order. */
const PROBE_CANDIDATES = [4, 8, 16, 24, 32] as const;

const PROBE_TTL_MS      = 60 * 60 * 1000; // 1 hour
const PROBE_TIMEOUT_MS  = 18_000;
const DEFAULT_CAP       = 16;
const TRIVIAL_PROMPT    = 'Reply with only: ready';

export interface CapProbeHistoryEntry {
  timestamp: string;
  test_concurrency: number;
  substantive_count: number;
  empty_count: number;
}

export interface ConcurrencyCapCache {
  cap: number;
  probed_at: string;
  next_reprobe_at: string;
  probe_history: CapProbeHistoryEntry[];
  provider: string;
  account_tier_hint: string;
}

export interface CapInfo {
  cap: number;
  probed_at: string | null;
  override: number | null;
  is_stale: boolean;
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _capCache: ConcurrencyCapCache | null = null;
let _manualOverride: number | null = null;
let _probeInProgress = false;

// ─── Cache I/O ────────────────────────────────────────────────────────────────

function loadCapCache(): ConcurrencyCapCache | null {
  if (_capCache) return _capCache;
  try {
    if (existsSync(CAP_CACHE_PATH)) {
      _capCache = JSON.parse(readFileSync(CAP_CACHE_PATH, 'utf8')) as ConcurrencyCapCache;
      return _capCache;
    }
  } catch {
    /* corrupt cache — will re-probe */
  }
  return null;
}

function saveCapCache(entry: ConcurrencyCapCache): void {
  try {
    if (!existsSync(LB_SUBSTRATE_ROOT)) mkdirSync(LB_SUBSTRATE_ROOT, { recursive: true });
    writeFileSync(CAP_CACHE_PATH, JSON.stringify(entry, null, 2), 'utf8');
    _capCache = entry;
  } catch (err) {
    console.warn('[concurrency-probe] failed to write cap cache:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the effective concurrency cap for the wave dispatcher.
 * Priority: manual override > cached probe result > default (16).
 */
export function getCachedCap(): number {
  if (_manualOverride !== null) return _manualOverride;
  return loadCapCache()?.cap ?? DEFAULT_CAP;
}

/** Full cap metadata for the Drekaskip panel. */
export function getCapInfo(): CapInfo {
  const cache = loadCapCache();
  const now   = Date.now();
  return {
    cap:       getCachedCap(),
    probed_at: cache?.probed_at ?? null,
    override:  _manualOverride,
    is_stale:  !cache || new Date(cache.next_reprobe_at).getTime() < now,
  };
}

/** Set manual override cap. Pass null to clear (reverts to probe cache). */
export function setCapOverride(n: number | null): void {
  _manualOverride = n !== null ? Math.max(1, Math.min(64, n)) : null;
}

// ─── Probe logic ──────────────────────────────────────────────────────────────

/** Fire `n` trivial 1-token requests in parallel; count how many return substantive content. */
async function probeAtN(n: number, apiKey: string): Promise<{ substantive: number; empty: number }> {
  const tasks = Array.from({ length: n }, () =>
    fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 8,
        messages:   [{ role: 'user', content: TRIVIAL_PROMPT }],
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    .then(async (res): Promise<boolean> => {
      if (!res.ok) return false;
      const data = await res.json() as { content?: Array<{ text?: string }> };
      const text = data.content?.[0]?.text ?? '';
      return text.trim().length > 1; // any non-empty = substantive for probe
    })
    .catch((): boolean => false),
  );

  const results = await Promise.all(tasks);
  const substantive = results.filter(Boolean).length;
  return { substantive, empty: n - substantive };
}

/**
 * Run the full concurrency probe sequence.
 * Returns the updated ConcurrencyCapCache record.
 * Non-blocking: callers should use setImmediate or await in background.
 */
export async function probeConcurrencyCap(): Promise<ConcurrencyCapCache> {
  if (_probeInProgress) {
    // Re-probe already in flight — return current cache
    return loadCapCache() ?? buildDefaultEntry();
  }
  _probeInProgress = true;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[concurrency-probe] ANTHROPIC_API_KEY not set — defaulting cap to', DEFAULT_CAP);
    _probeInProgress = false;
    const entry = buildDefaultEntry('no-key');
    saveCapCache(entry);
    return entry;
  }

  console.log('[concurrency-probe] probing concurrency cap...');
  const history: CapProbeHistoryEntry[] = [];
  let bestCap = 4; // conservative floor

  try {
    for (const n of PROBE_CANDIDATES) {
      const { substantive, empty } = await probeAtN(n, apiKey);
      history.push({ timestamp: new Date().toISOString(), test_concurrency: n, substantive_count: substantive, empty_count: empty });
      console.log(`[concurrency-probe] N=${n}: ${substantive}/${n} substantive (${empty} empty)`);

      if (empty > 0) {
        // First failure found — cap is the last clean level
        break;
      }
      bestCap = n; // fully clean at N — can handle at least this many
    }
  } catch (err) {
    console.warn('[concurrency-probe] probe error:', err);
  }

  const now = new Date();
  const entry: ConcurrencyCapCache = {
    cap:             bestCap,
    probed_at:       now.toISOString(),
    next_reprobe_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
    probe_history:   [...history, ...(loadCapCache()?.probe_history ?? [])].slice(0, 20),
    provider:        'api.anthropic.com',
    account_tier_hint:
      bestCap >= 32 ? 'high'
      : bestCap >= 16 ? 'standard'
      : 'restricted',
  };

  saveCapCache(entry);
  console.log(`[concurrency-probe] complete — effective cap: ${bestCap}`);
  _probeInProgress = false;
  return entry;
}

/**
 * Probe only if the cached result is stale (expired or absent).
 * Safe to call at boot without blocking startup.
 */
export async function probeIfStale(): Promise<void> {
  const cache = loadCapCache();
  if (cache && new Date(cache.next_reprobe_at).getTime() > Date.now()) return;
  await probeConcurrencyCap();
}

function buildDefaultEntry(reason = 'default'): ConcurrencyCapCache {
  const now = new Date();
  return {
    cap:              DEFAULT_CAP,
    probed_at:        now.toISOString(),
    next_reprobe_at:  new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
    probe_history:    [],
    provider:         'api.anthropic.com',
    account_tier_hint: reason,
  };
}
