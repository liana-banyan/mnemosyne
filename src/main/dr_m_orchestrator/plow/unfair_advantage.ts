// unfair_advantage.ts -- Mountain 1b · I-B · Domain Unfair Advantage Bundler
// KNIGHT MARATHON 7 · MOUNTAIN 1b · BP089
//
// Given a domain tag, pulls all cooperative substrate relevant to that domain.
// Returns an UnfairAdvantageBundle. Cached per domain (LRU · 24h TTL).
//
// Substrate pull strategy per source:
//   1. hot_eblets from SubstrateContextBundle filtered by domain metadata tag
//   2. pearl_share WHERE pearl_type LIKE '%' + domain + '%' · last 10
//   3. pheromone_query WHERE topic_tag = domain AND salience > 0.5
//   4. referenceJars: static mapping · domain -> PROV_22/23/24 section refs
//   5. house_scribe_query_jars WHERE domain_tag = domain (if table present)
//
// §3 Truth-Always: On Day 1, most academic domain bundles are empty.
//   is_empty=true is returned gracefully. The PLOW LOOP proceeds.
//   Cooperative-internal domains have rich bundles from Day 1.
// MOUNTAIN_1b_ADDITION

import type { SubstrateReader, SubstrateContextBundle, DatabaseConfig } from '../substrate_reader';
import type { DomainTag } from './domain_classifier';

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface PheromoneHit {
  signal_id: string;
  topic_tag: string;
  salience: number;
  excerpt: string;  // first 200 chars of signal content
}

export interface UnfairAdvantageBundle {
  domain: DomainTag;
  canonEblets: string[];        // eblet names tagged with this domain
  provReferences: string[];     // PROV_22/23/24 references relevant to domain
  qaPearls: string[];           // prior resolved canonical Q&A pairs
  referenceJars: string[];      // house_scribe sealed cabinet identifiers
  pheromoneTrails: PheromoneHit[];
  bundle_size_bytes: number;
  pulled_at: string;            // ISO-8601
  is_empty: boolean;            // true on Day 1 for most academic domains
}

// ─── Static domain → PROV reference mapping ──────────────────────────────────────
// PROV_22 CG35 = substrate wire format · CG36 = brain-swap
// Canonical refs grow as cooperative substrate accumulates.

const DOMAIN_PROV_REFS: Partial<Record<string, string[]>> = {
  substrate_technical: ['PROV_22_CG35_substrate_wire_format', 'PROV_22_CG36_brain_swap'],
  canon_internal:      ['PROV_22_CG35_substrate_wire_format'],
  cooperative_strategy: ['PROV_22_CG36_brain_swap'],
};

// ─── Internal: LRU domain bundle cache (24h TTL · max 20 domains) ────────────────

interface CacheEntry {
  bundle: UnfairAdvantageBundle;
  expires_at: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24h
const CACHE_MAX_SIZE = 20;

const _bundleCache = new Map<string, CacheEntry>();

function cacheGet(domain: string): UnfairAdvantageBundle | null {
  const entry = _bundleCache.get(domain);
  if (!entry) return null;
  if (Date.now() > entry.expires_at) {
    _bundleCache.delete(domain);
    return null;
  }
  return entry.bundle;
}

function cacheSet(domain: string, bundle: UnfairAdvantageBundle): void {
  // LRU eviction when at max capacity
  if (_bundleCache.size >= CACHE_MAX_SIZE && !_bundleCache.has(domain)) {
    const oldestKey = _bundleCache.keys().next().value;
    if (oldestKey) _bundleCache.delete(oldestKey);
  }
  _bundleCache.set(domain, { bundle, expires_at: Date.now() + CACHE_TTL_MS });
}

// ─── Internal: Supabase REST fetch for domain-specific queries ────────────────────

async function supabaseGet<T>(
  db: DatabaseConfig,
  table: string,
  params: Record<string, string>
): Promise<T[]> {
  const url = new URL(`${db.supabaseUrl}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey: db.anonKey,
        Authorization: `Bearer ${db.anonKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json() as T[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Internal: pull eblets from SubstrateContextBundle by domain ──────────────────

function filterEbletsForDomain(
  bundle: SubstrateContextBundle,
  domain: string
): string[] {
  return bundle.hot_eblets
    .filter((e) =>
      e.category.toLowerCase().includes(domain) ||
      e.snippet.toLowerCase().includes(domain) ||
      e.path.toLowerCase().includes(domain)
    )
    .map((e) => `${e.category}:${e.path.split('/').pop() ?? e.path}`)
    .slice(0, 5);
}

// ─── Internal: pull pheromone trails from SubstrateContextBundle by domain ────────

function filterPheromonesForDomain(
  bundle: SubstrateContextBundle,
  domain: string
): PheromoneHit[] {
  return bundle.active_pheromones
    .filter((p) => p.domain.toLowerCase().includes(domain) && p.salience > 0.5)
    .map((p) => ({
      signal_id: p.id,
      topic_tag: p.domain,
      salience: p.salience,
      excerpt: `domain:${p.domain} salience:${p.salience.toFixed(2)} type:${p.signal_type ?? 'unknown'}`,
    }))
    .slice(0, 5);
}

// ─── Internal: pull QA pearls from DB filtered by domain ─────────────────────────

async function pullQaPearls(db: DatabaseConfig, domain: string): Promise<string[]> {
  const rows = await supabaseGet<Record<string, unknown>>(
    db,
    'pearl_share',
    {
      select: 'id,pearl_type,content',
      'pearl_type': `ilike.*${domain}*`,
      order: 'emitted_at.desc',
      limit: '10',
    }
  );

  return rows
    .filter((r) => r.content != null)
    .map((r) => {
      const content = r.content as Record<string, unknown>;
      const answer = content['answer'] ?? content['result'] ?? content['content'];
      if (!answer) return null;
      return String(answer).slice(0, 200);
    })
    .filter((r): r is string => r !== null)
    .slice(0, 5);
}

// ─── Internal: pull reference jars from house_scribe table ───────────────────────

async function pullReferenceJars(db: DatabaseConfig, domain: string): Promise<string[]> {
  const rows = await supabaseGet<Record<string, unknown>>(
    db,
    'house_scribe_query_jars',
    {
      select: 'jar_id,domain_tag,label',
      domain_tag: `eq.${domain}`,
      limit: '5',
    }
  );
  return rows.map((r) => String(r.jar_id ?? r.label ?? '')).filter(Boolean);
}

// ─── plowDomainAdvantage (primary entry point) ───────────────────────────────────

export async function plowDomainAdvantage(
  domain: DomainTag,
  reader: SubstrateReader,
  bypassCache = false
): Promise<UnfairAdvantageBundle> {
  const domainStr = String(domain);

  // Cache hit (skip on iteration 2+ per plow loop spec)
  if (!bypassCache) {
    const cached = cacheGet(domainStr);
    if (cached) return cached;
  }

  const pulledAt = new Date().toISOString();

  // Read substrate bundle (flat read — domain filtering applied locally)
  const baseBundle = await reader.read().catch((): SubstrateContextBundle => ({
    timestamp: pulledAt,
    peer_count: 0,
    recent_peers: [],
    recent_pearls: [],
    hot_eblets: [],
    active_pheromones: [],
    context_size_bytes: 0,
    query_latency_ms: 0,
  }));

  // Filter eblets and pheromones by domain
  const canonEblets = filterEbletsForDomain(baseBundle, domainStr);
  const pheromoneTrails = filterPheromonesForDomain(baseBundle, domainStr);

  // Static PROV references
  const provReferences = DOMAIN_PROV_REFS[domainStr] ?? [];

  // DB-backed pulls (if reader exposes db config)
  const db = (reader as SubstrateReader & { db?: DatabaseConfig }).db;
  const [qaPearls, referenceJars] = db
    ? await Promise.all([
        pullQaPearls(db, domainStr).catch(() => [] as string[]),
        pullReferenceJars(db, domainStr).catch(() => [] as string[]),
      ])
    : [[], []];

  const isEmpty =
    canonEblets.length === 0 &&
    qaPearls.length === 0 &&
    pheromoneTrails.length === 0 &&
    referenceJars.length === 0;

  const bundle: UnfairAdvantageBundle = {
    domain,
    canonEblets,
    provReferences,
    qaPearls,
    referenceJars,
    pheromoneTrails,
    bundle_size_bytes: 0,
    pulled_at: pulledAt,
    is_empty: isEmpty,
  };

  // Measure actual bundle size
  bundle.bundle_size_bytes = Buffer.byteLength(JSON.stringify(bundle), 'utf8');

  if (!bypassCache) {
    cacheSet(domainStr, bundle);
  }

  return bundle;
}

// ─── bundleToSystemContext (exported for brain_swap.ts II-C) ─────────────────────

export function bundleToSystemContext(bundle: UnfairAdvantageBundle): string {
  if (bundle.is_empty) return '';

  const lines: string[] = [];
  lines.push(`## Cooperative Substrate Context · Domain: ${bundle.domain}`);

  if (bundle.canonEblets.length > 0) {
    lines.push('### Canon Eblets (authoritative cooperative knowledge)');
    bundle.canonEblets.forEach((e) => lines.push(`- ${e}`));
  }

  if (bundle.qaPearls.length > 0) {
    lines.push('### Prior Resolved Q&A Pearls');
    bundle.qaPearls.forEach((p) => lines.push(`- ${p}`));
  }

  if (bundle.pheromoneTrails.length > 0) {
    lines.push('### Active Pheromone Signals');
    bundle.pheromoneTrails.forEach((h) =>
      lines.push(`- [salience: ${h.salience.toFixed(2)}] ${h.excerpt}`)
    );
  }

  if (bundle.provReferences.length > 0) {
    lines.push('### Patent References');
    bundle.provReferences.forEach((r) => lines.push(`- ${r}`));
  }

  return lines.join('\n');
}
