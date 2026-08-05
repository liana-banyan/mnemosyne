// answer_cache_meter.ts -- BP136 Yoke (answer-cache v1)
// Persisted per-query meter for the read-through/write-back answer cache wired into
// ai_dispatch_ipc.ts's ai-dispatch:query handler. Mirrors the shape/pattern of
// telemetry_store.ts (AMPLIFY Computer product) and substrate_router.ts's cost-avoided
// estimate -- reused conventions, not reinvented, per the BP136 dispatch's "reuse, don't
// reinvent" instruction. This module owns MnemosyneC's own persisted log (separate product /
// separate userData tree from AMPLIFY Computer's telemetry_store.ts).
//
// Extends the volatile in-memory substrateCounters (mnem_eblet_store.ts) into a durable JSONL
// log so the Prove It panel can show real, restart-surviving numbers -- "nothing that isn't
// real" (BP136 dispatch, honesty constraint on the meter/panel).

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { app } from 'electron';

// BP145-M4 Slice 2 (the escalation ladder): 'cheap_cloud' is the new TIER 3 routing label.
// Additive -- every existing reader that switches on this union already has a default/else
// branch (see getAnswerCacheMeterSummary below), so this is not a breaking change to any
// existing consumer.
export type AnswerCacheRouting = 'served_verbatim' | 'rag' | 'local_generate' | 'flagship' | 'cheap_cloud';

export interface AnswerCacheMeterRecord {
  ts: string; // ISO-8601
  routing: AnswerCacheRouting;
  cost_usd: number;
  latency_ms: number;
}

export interface AnswerCacheMeterSummary {
  total_queries: number;
  served_verbatim_count: number;
  rag_count: number;
  local_generate_count: number;
  flagship_count: number;
  /** BP145-M4 Slice 2 (the escalation ladder): TIER 3 (cheap cloud, Haiku-class) hit count. */
  cheap_cloud_count: number;
  /** Estimate only (label kept honest downstream in the UI) -- cloud API cost that would have
   *  been incurred for each served_verbatim hit had it instead gone through a full model call.
   *  Same CLOUD_COST_PER_TOKEN_USD * TYPICAL_RESPONSE_TOKENS convention as substrate_router.ts. */
  cloud_cost_avoided_usd: number;
  avg_latency_ms: number;
  avg_served_verbatim_latency_ms: number;
}

// Same convention substrate_router.ts already uses (B37 Phase 3) -- reused here rather than
// re-derived, per the BP136 dispatch's explicit instruction. ~$3/1M tokens (Sonnet-class
// pricing), 800 tokens as a typical response length. This is an ESTIMATE, not a guarantee.
export const CLOUD_COST_PER_TOKEN_USD = 0.000003;
export const TYPICAL_RESPONSE_TOKENS = 800;
export const ESTIMATED_QUERY_COST_USD = CLOUD_COST_PER_TOKEN_USD * TYPICAL_RESPONSE_TOKENS;

// BP145-M4 Slice 2 (the escalation ladder, TIER 3 cheap cloud): same "reuse the estimate
// convention, label it honestly" discipline as ESTIMATED_QUERY_COST_USD above -- NOT sourced
// from a verified price table. SPEC_THE_COUPON_CLIPPER_PRICE_AWARE_ROUTING_AND_SAVINGS_METER_
// BP143.md Part One (a versioned, dated, source-verified price table) is sequenced BEFORE
// routing in that spec's own SEQUENCING section and is a separate, not-yet-built ticket. This
// is a rough placeholder ratio only, so the meter's cheap_cloud rows are not silently
// presented as zero-cost -- replace with the real Part One table the moment it exists.
export const ESTIMATED_CHEAP_CLOUD_QUERY_COST_USD = CLOUD_COST_PER_TOKEN_USD * 0.4 * TYPICAL_RESPONSE_TOKENS;

function meterFile(): string {
  return resolve(app.getPath('userData'), 'substrate', 'answer_cache_meter.jsonl');
}

/** Append one query's routing/cost/latency to the persisted meter log. Non-fatal on failure
 *  (mirrors telemetry_store.ts's "session data still accurate even if disk write fails"). */
export function recordAnswerCacheEvent(entry: Omit<AnswerCacheMeterRecord, 'ts'>): void {
  const record: AnswerCacheMeterRecord = { ts: new Date().toISOString(), ...entry };
  try {
    const dir = resolve(app.getPath('userData'), 'substrate');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(meterFile(), JSON.stringify(record) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[AnswerCacheMeter] Failed to persist record:', err);
  }
}

function readAllRecords(): AnswerCacheMeterRecord[] {
  const file = meterFile();
  if (!existsSync(file)) return [];
  try {
    return readFileSync(file, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as AnswerCacheMeterRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is AnswerCacheMeterRecord => r !== null);
  } catch {
    return [];
  }
}

/** Aggregate the persisted meter log into the summary shape the Prove It panel reads.
 *  Real counters only -- computed fresh from disk on every call (log is small; no need for
 *  in-memory caching at v1 scale). */
export function getAnswerCacheMeterSummary(): AnswerCacheMeterSummary {
  const records = readAllRecords();
  const served = records.filter((r) => r.routing === 'served_verbatim');
  const rag = records.filter((r) => r.routing === 'rag');
  const local = records.filter((r) => r.routing === 'local_generate');
  const flagship = records.filter((r) => r.routing === 'flagship');
  const cheapCloud = records.filter((r) => r.routing === 'cheap_cloud');

  const avgLatency = (rs: AnswerCacheMeterRecord[]): number =>
    rs.length > 0 ? Math.round(rs.reduce((s, r) => s + r.latency_ms, 0) / rs.length) : 0;

  return {
    total_queries: records.length,
    served_verbatim_count: served.length,
    rag_count: rag.length,
    local_generate_count: local.length,
    flagship_count: flagship.length,
    cheap_cloud_count: cheapCloud.length,
    cloud_cost_avoided_usd: served.length * ESTIMATED_QUERY_COST_USD,
    avg_latency_ms: avgLatency(records),
    avg_served_verbatim_latency_ms: avgLatency(served),
  };
}
