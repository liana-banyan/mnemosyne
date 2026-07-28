// csia_meter.ts -- BP136 Yoke v2a: CSIA-mode meter.
//
// Deliberately a SEPARATE persisted JSONL log from v1's answer_cache_meter.ts (that file and
// its log are v1-owned and this Yoke must not touch them -- see ai_dispatch_ipc.ts's
// csia_mode block for the exact call sites, all additive/new). Mirrors the same
// record/summary shape convention as answer_cache_meter.ts ("reuse the pattern, don't
// reinvent"), but writes to its own file so v1's Prove It numbers are provably unaffected by
// whether csia_mode is on or off, and so csia_mode's own numbers survive independently for a
// future (v2e) Prove It receipt extension.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { app } from 'electron';

export type CsiaEventKind =
  | 'psionic_fast_path'
  | 'psionic_convergence_match'
  | 'psionic_no_convergence'
  | 'psionic_no_prediction';

export interface CsiaMeterRecord {
  ts: string; // ISO-8601
  kind: CsiaEventKind;
  confidence: number | null;
  corroboratingCount: number | null;
  latency_ms: number;
  /** Estimate only (same honesty caveat as answer_cache_meter.ts's ESTIMATED_QUERY_COST_USD --
   *  real per-vendor pricing isn't wired in; this is a labeled estimate, not a guarantee). */
  cost_avoided_usd: number;
}

export interface CsiaMeterSummary {
  total_events: number;
  fast_path_count: number;
  convergence_match_count: number;
  no_convergence_count: number;
  no_prediction_count: number;
  cost_avoided_usd: number;
  avg_fast_path_latency_ms: number;
}

function meterFile(): string {
  return resolve(app.getPath('userData'), 'substrate', 'csia_meter.jsonl');
}

/** Append one CSIA event to the persisted meter log. Non-fatal on failure, same convention as
 *  answer_cache_meter.ts's recordAnswerCacheEvent. */
export function recordCsiaEvent(entry: Omit<CsiaMeterRecord, 'ts'>): void {
  const record: CsiaMeterRecord = { ts: new Date().toISOString(), ...entry };
  try {
    const dir = resolve(app.getPath('userData'), 'substrate');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(meterFile(), JSON.stringify(record) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[CsiaMeter] Failed to persist record:', err);
  }
}

function readAllRecords(): CsiaMeterRecord[] {
  const file = meterFile();
  if (!existsSync(file)) return [];
  try {
    return readFileSync(file, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as CsiaMeterRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is CsiaMeterRecord => r !== null);
  } catch {
    return [];
  }
}

/** Aggregate the persisted CSIA meter log. Real counters only, computed fresh from disk on
 *  every call (log is small at this stage; no in-memory caching needed yet). */
export function getCsiaMeterSummary(): CsiaMeterSummary {
  const records = readAllRecords();
  const fastPath = records.filter((r) => r.kind === 'psionic_fast_path');
  const convergenceMatch = records.filter((r) => r.kind === 'psionic_convergence_match');
  const noConvergence = records.filter((r) => r.kind === 'psionic_no_convergence');
  const noPrediction = records.filter((r) => r.kind === 'psionic_no_prediction');

  const avgLatency = (rs: CsiaMeterRecord[]): number =>
    rs.length > 0 ? Math.round(rs.reduce((s, r) => s + r.latency_ms, 0) / rs.length) : 0;

  return {
    total_events: records.length,
    fast_path_count: fastPath.length,
    convergence_match_count: convergenceMatch.length,
    no_convergence_count: noConvergence.length,
    no_prediction_count: noPrediction.length,
    cost_avoided_usd: records.reduce((s, r) => s + r.cost_avoided_usd, 0),
    avg_fast_path_latency_ms: avgLatency(fastPath),
  };
}
