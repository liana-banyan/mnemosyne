// BP041 SAGA 2 — Scribe Monitor substrate
// Persistent per-scribe metric aggregation at ~/.lb_substrate/scribe_monitor/<scribe_id>.jsonl
// Tracks Speed / Accuracy / Cost contribution deltas per scribe
// Member sovereignty: all data local-only; never leaves machine without explicit consent

import { homedir } from 'os';
import { join } from 'path';
import {
  mkdirSync,
  existsSync,
  appendFileSync,
  readFileSync,
  writeFileSync,
} from 'fs';

const SUBSTRATE_ROOT = process.env.LB_SUBSTRATE_ROOT
  ? process.env.LB_SUBSTRATE_ROOT
  : join(homedir(), '.lb_substrate');

const MONITOR_DIR = join(SUBSTRATE_ROOT, 'scribe_monitor');
const MONITOR_PREFS_PATH = join(MONITOR_DIR, 'monitor_prefs.json');

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single metric delta event appended to the scribe's JSONL log */
export interface ScribeMetricDelta {
  ts: string;
  scribe_id: string;
  /** Positive = scribe saved wall-clock time (ms); negative = added latency */
  speed_delta_ms: number;
  /** 0.0–1.0 fraction improvement to accuracy (error catches, phantom-completions prevented) */
  accuracy_delta: number;
  /** Positive = tokens saved; negative = additional tokens consumed (e.g. Coroner cross-probe) */
  cost_delta_tokens: number;
  wave_id?: string;
  session_id?: string;
  note?: string;
}

/** Aggregated summary returned to renderer via IPC */
export interface ScribeMetricSummary {
  scribe_id: string;
  monitor_enabled: boolean;
  monitored_since: string | null;
  event_count: number;
  total_speed_delta_ms: number;
  total_accuracy_delta: number;
  total_cost_delta_tokens: number;
  avg_speed_delta_ms: number;
  avg_accuracy_delta: number;
  avg_cost_delta_tokens: number;
  last_updated: string | null;
}

interface MonitorPrefs {
  enabled: Record<string, boolean>;
  enabled_since: Record<string, string>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function ensureMonitorDir(): void {
  if (!existsSync(MONITOR_DIR)) {
    mkdirSync(MONITOR_DIR, { recursive: true });
  }
}

function loadPrefs(): MonitorPrefs {
  if (!existsSync(MONITOR_PREFS_PATH)) {
    return { enabled: {}, enabled_since: {} };
  }
  try {
    return JSON.parse(readFileSync(MONITOR_PREFS_PATH, 'utf-8')) as MonitorPrefs;
  } catch {
    return { enabled: {}, enabled_since: {} };
  }
}

function savePrefs(prefs: MonitorPrefs): void {
  ensureMonitorDir();
  writeFileSync(MONITOR_PREFS_PATH, JSON.stringify(prefs, null, 2), 'utf-8');
}

function scribeLogPath(scribeId: string): string {
  return join(MONITOR_DIR, `${scribeId}.jsonl`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function toggleMonitor(
  scribeId: string,
  on: boolean,
): { ok: boolean; enabled: boolean; monitored_since: string | null } {
  ensureMonitorDir();
  const prefs = loadPrefs();
  prefs.enabled[scribeId] = on;
  if (on) {
    if (!prefs.enabled_since[scribeId]) {
      prefs.enabled_since[scribeId] = new Date().toISOString();
    }
  } else {
    delete prefs.enabled_since[scribeId];
  }
  savePrefs(prefs);
  return {
    ok: true,
    enabled: on,
    monitored_since: on ? (prefs.enabled_since[scribeId] ?? null) : null,
  };
}

export function isMonitorEnabled(scribeId: string): boolean {
  return loadPrefs().enabled[scribeId] === true;
}

/** Append a metric delta for a scribe (no-op if monitor disabled for that scribe) */
export function appendMetricDelta(delta: ScribeMetricDelta): void {
  if (!isMonitorEnabled(delta.scribe_id)) return;
  ensureMonitorDir();
  appendFileSync(
    scribeLogPath(delta.scribe_id),
    JSON.stringify(delta) + '\n',
    'utf-8',
  );
}

/** Return aggregated metrics for one or more scribes */
export function getMetrics(scribeIds: string[]): ScribeMetricSummary[] {
  const prefs = loadPrefs();
  return scribeIds.map((scribeId): ScribeMetricSummary => {
    const enabled = prefs.enabled[scribeId] === true;
    const monitoredSince = prefs.enabled_since[scribeId] ?? null;
    const logPath = scribeLogPath(scribeId);

    const empty: ScribeMetricSummary = {
      scribe_id: scribeId,
      monitor_enabled: enabled,
      monitored_since: monitoredSince,
      event_count: 0,
      total_speed_delta_ms: 0,
      total_accuracy_delta: 0,
      total_cost_delta_tokens: 0,
      avg_speed_delta_ms: 0,
      avg_accuracy_delta: 0,
      avg_cost_delta_tokens: 0,
      last_updated: null,
    };

    if (!existsSync(logPath)) return empty;

    try {
      const lines = readFileSync(logPath, 'utf-8')
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as ScribeMetricDelta);

      if (lines.length === 0) return empty;

      const totals = lines.reduce(
        (acc, l) => ({
          speed: acc.speed + (l.speed_delta_ms ?? 0),
          accuracy: acc.accuracy + (l.accuracy_delta ?? 0),
          cost: acc.cost + (l.cost_delta_tokens ?? 0),
        }),
        { speed: 0, accuracy: 0, cost: 0 },
      );

      return {
        scribe_id: scribeId,
        monitor_enabled: enabled,
        monitored_since: monitoredSince,
        event_count: lines.length,
        total_speed_delta_ms: totals.speed,
        total_accuracy_delta: totals.accuracy,
        total_cost_delta_tokens: totals.cost,
        avg_speed_delta_ms: totals.speed / lines.length,
        avg_accuracy_delta: totals.accuracy / lines.length,
        avg_cost_delta_tokens: totals.cost / lines.length,
        last_updated: lines[lines.length - 1]?.ts ?? null,
      };
    } catch {
      return empty;
    }
  });
}

/** Return current enabled state for all known scribes (for initial UI hydration) */
export function getAllMonitorStates(): Record<string, boolean> {
  return loadPrefs().enabled;
}
