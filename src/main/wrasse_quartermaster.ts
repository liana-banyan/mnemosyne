/**
 * wrasse_quartermaster.ts — BP087 MAMBA-β4 + MAMBA-γ
 *
 * Wrasse Quartermaster: peer pool selection for mesh dispatch.
 * Consumes peer_domain_affinity (MAMBA-γ) and peer_presence heartbeat (MAMBA-β3 Thorax)
 * to emit an ordered peer pool for each question dispatch.
 *
 * Named for the wrasse fish — a specialist that cleans parasites from larger fish.
 * The Quartermaster selects the cleanest, highest-value peer for each domain task.
 *
 * Canon refs:
 *   canon_wrasse_injector_upper_level_substrate_manager_bp085
 *   canon_domain_specific_specialist_routing_pheromone_affinity_bp087
 *   canon_substrate_primitives_mesh_wiring_8_primitives_distributed_bp087
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PeerCapability {
  peer_id: string;
  version: string;
  ollama_model: string;
  ram_gb?: number;
  gpu?: boolean;
  last_seen_at: string;
  /** Ed25519 public key hex — populated when β3 Thorax auth is active */
  public_key_hex?: string;
  /** Thorax attestation status — 'attested' | 'unattested' | 'unknown' */
  thorax_status?: 'attested' | 'unattested' | 'unknown';
}

export interface PeerAffinityRecord {
  peer_id: string;
  domain: string;
  correctness_rate: number;
  sample_count: number;
  last_updated: string;
}

export interface QuartermasterSelection {
  /** Ordered list of peers for this dispatch (highest affinity first) */
  pool: Array<{
    peer_id: string;
    affinity_score: number;
    capacity_score: number;
    composite_score: number;
    routing_reason: string;
  }>;
  routing_mode: 'domain-affinity' | 'round-robin';
  domain: string;
  selected_at: string;
}

export interface QuartermasterConfig {
  supabase_url: string;
  anon_key: string;
  routing: 'domain-affinity' | 'round-robin';
  /** Target pool size — how many peers to select. Default 5. */
  pool_size?: number;
  /** Minimum sample_count before domain-affinity is trusted. Below this, use uniform 0.5. */
  min_sample_count?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchActivePeers(
  supabaseUrl: string,
  anonKey: string,
): Promise<PeerCapability[]> {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const url =
      `${supabaseUrl}/rest/v1/peer_presence` +
      `?select=peer_id,version,last_seen_at,capabilities` +
      `&last_seen_at=gte.${since}` +
      `&order=last_seen_at.desc`;

    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      peer_id: string;
      version?: string;
      last_seen_at: string;
      capabilities?: Record<string, unknown>;
    }>;

    return (rows ?? []).map((r) => ({
      peer_id: r.peer_id,
      version: r.version ?? '0.0.0',
      ollama_model: (r.capabilities?.['ollama_model'] as string) ?? 'unknown',
      ram_gb: r.capabilities?.['ram_gb'] as number | undefined,
      gpu: r.capabilities?.['gpu'] as boolean | undefined,
      last_seen_at: r.last_seen_at,
      // β3: Thorax attestation — populated when peer submits signed heartbeat
      public_key_hex: r.capabilities?.['public_key_hex'] as string | undefined,
      thorax_status: (r.capabilities?.['thorax_status'] as PeerCapability['thorax_status']) ?? 'unknown',
    }));
  } catch {
    return [];
  }
}

async function fetchDomainAffinity(
  supabaseUrl: string,
  anonKey: string,
  peerIds: string[],
  domain: string,
): Promise<Map<string, PeerAffinityRecord>> {
  const result = new Map<string, PeerAffinityRecord>();
  if (!peerIds.length) return result;

  try {
    const ids = peerIds.map((id) => `"${id}"`).join(',');
    const url =
      `${supabaseUrl}/rest/v1/peer_domain_affinity` +
      `?select=peer_id,domain,correctness_rate,sample_count,last_updated` +
      `&peer_id=in.(${ids})` +
      `&domain=eq.${encodeURIComponent(domain)}`;

    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return result;
    const rows = (await res.json()) as PeerAffinityRecord[];
    for (const row of rows ?? []) {
      result.set(row.peer_id, row);
    }
  } catch { /* return empty map — graceful degradation to uniform affinity */ }

  return result;
}

// ─── Capacity scoring ──────────────────────────────────────────────────────────

function computeCapacityScore(peer: PeerCapability): number {
  let score = 0.5; // baseline
  if (peer.gpu) score += 0.25;
  if ((peer.ram_gb ?? 0) >= 32) score += 0.15;
  else if ((peer.ram_gb ?? 0) >= 16) score += 0.05;

  // Freshness: subtract for staleness
  const ageMs = Date.now() - new Date(peer.last_seen_at).getTime();
  const agePenalty = Math.min(0.2, ageMs / (10 * 60 * 1000) * 0.2);
  score = Math.max(0, score - agePenalty);

  // β3: Thorax attestation bonus
  if (peer.thorax_status === 'attested') score = Math.min(1, score + 0.1);

  return Math.min(1, Math.max(0, score));
}

// ─── Core selection logic ──────────────────────────────────────────────────────

/**
 * Select a pool of peers for a given domain dispatch.
 * Domain-affinity mode: ranks by composite = 0.7 * affinity + 0.3 * capacity.
 * Round-robin mode: ranks by capacity only (freshness-weighted).
 */
export async function selectPeerPool(
  domain: string,
  config: QuartermasterConfig,
): Promise<QuartermasterSelection> {
  const poolSize = config.pool_size ?? 5;
  const minSamples = config.min_sample_count ?? 3;

  const peers = await fetchActivePeers(config.supabase_url, config.anon_key);

  if (peers.length === 0) {
    return {
      pool: [],
      routing_mode: config.routing,
      domain,
      selected_at: new Date().toISOString(),
    };
  }

  let affinityMap = new Map<string, PeerAffinityRecord>();
  if (config.routing === 'domain-affinity') {
    affinityMap = await fetchDomainAffinity(
      config.supabase_url,
      config.anon_key,
      peers.map((p) => p.peer_id),
      domain,
    );
  }

  const scored = peers.map((peer) => {
    const capacityScore = computeCapacityScore(peer);
    const affinityRecord = affinityMap.get(peer.peer_id);

    let affinityScore = 0.5; // uniform prior
    let routingReason = 'round-robin (uniform prior)';

    if (config.routing === 'domain-affinity' && affinityRecord) {
      if (affinityRecord.sample_count >= minSamples) {
        affinityScore = affinityRecord.correctness_rate;
        routingReason = `domain-affinity (${(affinityScore * 100).toFixed(0)}% on ${affinityRecord.sample_count} samples)`;
      } else {
        routingReason = `domain-affinity (uniform prior — only ${affinityRecord.sample_count} samples)`;
      }
    } else if (config.routing === 'domain-affinity') {
      routingReason = 'domain-affinity (no prior — new peer)';
    } else {
      routingReason = `round-robin (capacity ${(capacityScore * 100).toFixed(0)}%)`;
    }

    const composite = config.routing === 'domain-affinity'
      ? 0.7 * affinityScore + 0.3 * capacityScore
      : capacityScore;

    return {
      peer_id: peer.peer_id,
      affinity_score: affinityScore,
      capacity_score: capacityScore,
      composite_score: composite,
      routing_reason: routingReason,
    };
  });

  // Sort descending by composite score, then take top poolSize
  scored.sort((a, b) => b.composite_score - a.composite_score);
  const pool = scored.slice(0, poolSize);

  console.log(
    `[WrasseQuartermaster] domain=${domain} routing=${config.routing} ` +
    `active_peers=${peers.length} pool=${pool.length} ` +
    `top_peer=${pool[0]?.peer_id ?? 'none'} composite=${pool[0]?.composite_score.toFixed(3) ?? 'N/A'}`
  );

  return {
    pool,
    routing_mode: config.routing,
    domain,
    selected_at: new Date().toISOString(),
  };
}

/**
 * Emit a Wrasse path manifest for a given dispatch session.
 * The manifest records how each peer was selected and what affinity score it carried.
 * Used in THUNDERCLAP receipt for domain-affinity routing transparency.
 */
export function buildPathManifest(
  session_id: string,
  domain: string,
  selection: QuartermasterSelection,
): Record<string, unknown> {
  return {
    session_id,
    domain,
    routing_mode: selection.routing_mode,
    selected_at: selection.selected_at,
    pool_size: selection.pool.length,
    peers: selection.pool.map((p) => ({
      peer_id: p.peer_id,
      affinity: p.affinity_score,
      capacity: p.capacity_score,
      composite: p.composite_score,
      reason: p.routing_reason,
    })),
    generator: 'wrasse_quartermaster.ts · BP087 MAMBA-β4/γ',
  };
}
