// substrate_reader.ts -- Mountain 1 · I-A · Persistent Substrate Reader
// KNIGHT MARATHON 4 · BP089 · BLACK MAMBA
//
// Dr. M reads her own substrate on every dispatch tick.
// Returns SubstrateContextBundle consumed by reasoning brain or Minor Council.
//
// Queries (per tick):
//   ip_ledger       · last 50 peer presence records · sorted by last_seen DESC
//   pearl_share     · last 20 pearls · sorted by emitted_at DESC
//   Eblet index     · high-pheromone eblets · top 10 by salience score
//   Pheromone table · active signals · threshold > 0.5 salience
//
// Error handling: degraded bundle on any query failure · never throws · never blocks dispatch.
// §3 Truth-Always: substrate queries run against Supabase REST (local instance in v0.5.x).
// Remote peer substrate is ROADMAP.

import { createHash } from 'node:crypto';

// ─── Database config (Supabase REST pattern · matches existing codebase) ────────

export interface DatabaseConfig {
  supabaseUrl: string;
  anonKey: string;
}

// ─── Record types ────────────────────────────────────────────────────────────────

export interface PeerRecord {
  id: string;
  peer_id: string;
  address?: string;
  port?: number;
  version?: string;
  last_seen: string;
  thorax_status?: string;
  public_key_hex?: string;
}

export interface PearlRecord {
  id: string;
  pearl_type: string;
  emitted_at: string;
  content?: Record<string, unknown>;
  emitter_peer_id?: string;
}

export interface EbletIndexEntry {
  id: string;
  path: string;
  category: string;
  salience_score: number;
  snippet: string;
  updated_at: string;
}

export interface PheromoneSignal {
  id: string;
  domain: string;
  salience: number;
  source_peer_id?: string;
  recorded_at: string;
  signal_type?: string;
}

// ─── Canonical bundle ─────────────────────────────────────────────────────────────

export interface SubstrateContextBundle {
  timestamp: string;
  peer_count: number;
  recent_peers: PeerRecord[];
  recent_pearls: PearlRecord[];
  hot_eblets: EbletIndexEntry[];
  active_pheromones: PheromoneSignal[];
  context_size_bytes: number;
  query_latency_ms: number;
  // MOUNTAIN_1b_ADDITION: optional primed domain context string injected by PLOW LOOP.
  // Set by runPlowLoop before passing bundle to minorCouncil. Consumed by brain adapters.
  // Empty string or absent = no domain priming (Day 1 empty bundles, non-council paths).
  primed_advantage_context?: string;
}

// ─── Interface ────────────────────────────────────────────────────────────────────

export interface SubstrateReader {
  read(): Promise<SubstrateContextBundle>;
  readSince(timestamp: string): Promise<SubstrateContextBundle>;
  // MOUNTAIN_1b_ADDITION: exposes db config for domain-specific substrate pulls
  db?: DatabaseConfig;
}

// ─── Internal: Supabase REST fetch helpers ────────────────────────────────────────

async function supabaseGet<T>(
  config: DatabaseConfig,
  table: string,
  params: Record<string, string>
): Promise<{ rows: T[]; error?: string }> {
  const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      return { rows: [], error: `HTTP ${res.status}: ${body}` };
    }
    const data = await res.json() as T[];
    return { rows: Array.isArray(data) ? data : [] };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Pheromone query (peer_domain_affinity · salience proxy) ─────────────────────

async function queryPheromones(
  config: DatabaseConfig
): Promise<{ signals: PheromoneSignal[]; error?: string }> {
  const { rows, error } = await supabaseGet<Record<string, unknown>>(
    config,
    'peer_domain_affinity',
    {
      select: 'peer_id,domain,correctness_rate,last_updated,sample_count',
      'correctness_rate': 'gte.0.5',
      order: 'correctness_rate.desc',
      limit: '20',
    }
  );
  const signals: PheromoneSignal[] = rows.map((r) => ({
    id: createHash('sha256').update(`${r.peer_id}:${r.domain}`).digest('hex').slice(0, 16),
    domain: String(r.domain ?? ''),
    salience: typeof r.correctness_rate === 'number' ? r.correctness_rate : 0,
    source_peer_id: String(r.peer_id ?? ''),
    recorded_at: String(r.last_updated ?? new Date().toISOString()),
    signal_type: 'domain_affinity',
  }));
  return { signals, error };
}

// ─── Eblet index query (file-system + pheromone salience proxy) ─────────────────

async function queryHotEblets(
  config: DatabaseConfig
): Promise<{ entries: EbletIndexEntry[]; error?: string }> {
  // Query eblet_index if it exists in Supabase; fallback to empty (file-based eblets are
  // handled by mnem_eblet_store.ts separately · this reader uses the DB projection).
  const { rows, error } = await supabaseGet<Record<string, unknown>>(
    config,
    'eblet_index',
    {
      select: 'id,path,category,salience_score,snippet,updated_at',
      order: 'salience_score.desc',
      limit: '10',
    }
  );
  const entries: EbletIndexEntry[] = rows.map((r) => ({
    id: String(r.id ?? ''),
    path: String(r.path ?? ''),
    category: String(r.category ?? 'canon'),
    salience_score: typeof r.salience_score === 'number' ? r.salience_score : 0,
    snippet: String(r.snippet ?? ''),
    updated_at: String(r.updated_at ?? new Date().toISOString()),
  }));
  return { entries, error };
}

// ─── Core bundle builder ──────────────────────────────────────────────────────────

async function buildBundle(
  config: DatabaseConfig,
  since?: string
): Promise<SubstrateContextBundle> {
  const t0 = Date.now();
  const timestamp = new Date().toISOString();

  // ─── Run all 4 queries in parallel ─────────────────────────────────────────────

  const peerParams: Record<string, string> = {
    select: 'id,peer_id,address,port,version,last_seen,thorax_status,public_key_hex',
    order: 'last_seen.desc',
    limit: '50',
  };
  if (since) peerParams['last_seen'] = `gte.${since}`;

  const pearlParams: Record<string, string> = {
    select: 'id,pearl_type,emitted_at,content,emitter_peer_id',
    order: 'emitted_at.desc',
    limit: '20',
  };
  if (since) pearlParams['emitted_at'] = `gte.${since}`;

  const [peersResult, pearlsResult, pheromoneResult, ebletResult] = await Promise.allSettled([
    supabaseGet<PeerRecord>(config, 'ip_ledger', peerParams),
    supabaseGet<PearlRecord>(config, 'pearl_share', pearlParams),
    queryPheromones(config),
    queryHotEblets(config),
  ]);

  // ─── Extract results (degraded on failure) ──────────────────────────────────────

  const recentPeers: PeerRecord[] = peersResult.status === 'fulfilled'
    ? peersResult.value.rows
    : [];

  const recentPearls: PearlRecord[] = pearlsResult.status === 'fulfilled'
    ? pearlsResult.value.rows
    : [];

  const activePheromones: PheromoneSignal[] = pheromoneResult.status === 'fulfilled'
    ? pheromoneResult.value.signals
    : [];

  const hotEblets: EbletIndexEntry[] = ebletResult.status === 'fulfilled'
    ? ebletResult.value.entries
    : [];

  // ─── Measure bundle size ────────────────────────────────────────────────────────

  const bundlePayload = {
    timestamp,
    peer_count: recentPeers.length,
    recent_peers: recentPeers,
    recent_pearls: recentPearls,
    hot_eblets: hotEblets,
    active_pheromones: activePheromones,
  };
  const contextSizeBytes = Buffer.byteLength(JSON.stringify(bundlePayload), 'utf8');

  return {
    ...bundlePayload,
    context_size_bytes: contextSizeBytes,
    query_latency_ms: Date.now() - t0,
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────────

export function createSubstrateReader(db: DatabaseConfig): SubstrateReader {
  return {
    // MOUNTAIN_1b_ADDITION: db exposed for plowDomainAdvantage domain-specific pulls
    db,
    async read(): Promise<SubstrateContextBundle> {
      return buildBundle(db);
    },
    async readSince(timestamp: string): Promise<SubstrateContextBundle> {
      return buildBundle(db, timestamp);
    },
  };
}

// ─── MOUNTAIN_1b_ADDITION: re-exports from plow/ sub-module ──────────────────────
// Consumers import from substrate_reader.ts; plow/ is an internal sub-module.

export { DomainTag } from './plow/domain_classifier';
export type { ClassifierModel, ClassifyResult } from './plow/domain_classifier';
export { classifyQueryDomain, loadClassifier } from './plow/domain_classifier';

export type { PheromoneHit, UnfairAdvantageBundle } from './plow/unfair_advantage';
export { plowDomainAdvantage, bundleToSystemContext } from './plow/unfair_advantage';

export type { PlowLoopOptions, PlowLoopResult } from './plow/plow_loop';
export { runPlowLoop } from './plow/plow_loop';
