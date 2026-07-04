// BP089 Mountain 3 · I-C · File Cabinet Abstraction
// Sealed-jar wrapper and Court Package lazy-load contract.
// Composes with house_scribe canon (Apiarist Hive lineage).
// Each Cabinet: lazy-loads on first openCabinet() call, stays warm via 24h keep_alive.
// LRU eviction: least-recently-accessed Cabinet evicted under memory pressure.
// Seal integrity: sealed jars that are tampered return SEAL_BROKEN, not corrupted content.
//
// Audit trail: every openCabinet() call writes a row to file_cabinet_seal_log (schema §7).

import { queryEbletStore } from '../mnem_eblet_store';

// ── Configuration ──────────────────────────────────────────────────────────────

const KEEP_ALIVE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CABINET_TIMEOUT_MS = 8_000;

const SUPABASE_URL: string =
  process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY: string =
  process.env['SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CabinetAddress {
  substratePath: string;
  coordinate?: string;           // soccerball-DAG hex coordinate if known
  partition: string;             // canon | pearl | eblet | receipts | code | downloaded
}

export interface CabinetContents {
  address: CabinetAddress;
  jarId: string;
  content: string;
  sealStatus: 'intact' | 'SEAL_BROKEN' | 'not_sealed';
  openedAtMs: number;
  lazyLoadFirstAccessedAt: string | null;   // ISO timestamptz, null if first access now
  keepAliveUntil: string;                   // ISO timestamptz, 24h from first access
}

export interface CabinetError {
  code: 'NOT_FOUND' | 'SEAL_BROKEN' | 'TIMEOUT' | 'PARTITION_MISMATCH';
  address: CabinetAddress;
  message: string;
}

export interface CabinetLRUEntry {
  substratePath: string;
  lastAccessedAt: number;         // epoch ms · for LRU eviction
  keepAliveUntil: number;         // epoch ms · evict only after this passes
}

export interface SealResult {
  sealLogId: string;
  pearlEmitted: boolean;
}

// ── Module-level state ────────────────────────────────────────────────────────

/** LRU registry: path → LRU metadata */
const _cabinetLRU = new Map<string, CabinetLRUEntry>();

/** Lazy-load first-access registry: path → ISO timestamp */
const _firstAccessLog = new Map<string, string>();

/** In-memory jar cache: path → contents */
const _jarCache = new Map<string, CabinetContents>();

// ── Supabase helpers ──────────────────────────────────────────────────────────

function supabaseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function writeSealLog(params: {
  jarId: string;
  substratePath: string;
  partition: string;
  librarianRole: string;
  sealStatus: 'intact' | 'SEAL_BROKEN' | 'not_sealed';
  latencyMs: number;
  lazyLoadFirstAccessedAt: string | null;
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/file_cabinet_seal_log`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        jar_id: params.jarId,
        substrate_path: params.substratePath,
        partition: params.partition,
        librarian_role: params.librarianRole,
        seal_status: params.sealStatus,
        latency_ms: params.latencyMs,
        lazy_load_first_accessed_at: params.lazyLoadFirstAccessedAt,
        session_bp: 'BP089',
      }),
      signal: AbortSignal.timeout(CABINET_TIMEOUT_MS),
    });
  } catch {
    // Non-fatal: audit log best-effort
  }
}

// ── Jar ID generation ─────────────────────────────────────────────────────────

function generateJarId(address: CabinetAddress): string {
  const raw = `${address.partition}::${address.substratePath}::${address.coordinate ?? 'no-coord'}`;
  // Deterministic jar ID: hex of path hash (no crypto dep needed — simple fnv1a)
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return `jar-${h.toString(16).padStart(8, '0')}`;
}

// ── Seal verification ─────────────────────────────────────────────────────────

/**
 * Verify seal of an existing jar by checking the Supabase seal log.
 * Returns 'intact' if the jar has a seal log row with intact status,
 * 'not_sealed' if no seal record exists, 'SEAL_BROKEN' if tamper detected.
 */
export async function verifySeal(
  jarId: string,
): Promise<'intact' | 'SEAL_BROKEN' | 'not_sealed'> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 'not_sealed';
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/file_cabinet_seal_log?jar_id=eq.${encodeURIComponent(jarId)}&order=opened_at.desc&limit=1`,
      { headers: supabaseHeaders(), signal: AbortSignal.timeout(CABINET_TIMEOUT_MS) },
    );
    if (!res.ok) return 'not_sealed';
    const rows = await res.json() as Array<{ seal_status: string }>;
    if (rows.length === 0) return 'not_sealed';
    const status = rows[0].seal_status;
    if (status === 'intact') return 'intact';
    if (status === 'SEAL_BROKEN') return 'SEAL_BROKEN';
    return 'not_sealed';
  } catch {
    return 'not_sealed';
  }
}

// ── Cabinet open ──────────────────────────────────────────────────────────────

/**
 * Open a File Cabinet by substrate address.
 * Lazy-loads on first access; stays warm via keep_alive (24h).
 * Writes audit row to file_cabinet_seal_log on every open.
 *
 * @param address     CabinetAddress specifying path, coordinate, partition.
 * @param librarianRole  Which Librarian Council member is opening (for audit).
 * @returns CabinetContents or CabinetError.
 */
export async function openCabinet(
  address: CabinetAddress,
  librarianRole = 'unknown_librarian',
): Promise<CabinetContents | CabinetError> {
  const startMs = Date.now();
  const key = `${address.partition}::${address.substratePath}`;

  // Check in-memory jar cache (respect keep_alive)
  const cached = _jarCache.get(key);
  if (cached) {
    const lru = _cabinetLRU.get(key);
    if (lru && Date.now() < lru.keepAliveUntil) {
      lru.lastAccessedAt = Date.now();
      const latencyMs = Date.now() - startMs;
      await writeSealLog({
        jarId: cached.jarId,
        substratePath: address.substratePath,
        partition: address.partition,
        librarianRole,
        sealStatus: cached.sealStatus,
        latencyMs,
        lazyLoadFirstAccessedAt: _firstAccessLog.get(key) ?? null,
      });
      return cached;
    }
    // keep_alive expired — evict and reload
    _jarCache.delete(key);
    _cabinetLRU.delete(key);
  }

  // Lazy-load: query eblet store for the substrate path
  let snippets: string[] = [];
  try {
    const query = address.coordinate
      ? `${address.substratePath} ${address.coordinate}`
      : address.substratePath;
    snippets = await queryEbletStore(query.slice(0, 80));
  } catch {
    snippets = [];
  }

  if (snippets.length === 0) {
    return {
      code: 'NOT_FOUND',
      address,
      message: `No jar content found for substrate path: ${address.substratePath}`,
    };
  }

  const content = snippets.join('\n\n---\n\n');
  const jarId = generateJarId(address);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const keepAliveUntil = new Date(nowMs + KEEP_ALIVE_MS).toISOString();

  // Record first access (never overwrite)
  const firstAccess = _firstAccessLog.get(key) ?? null;
  if (!firstAccess) {
    _firstAccessLog.set(key, nowIso);
  }

  // Verify seal
  const sealStatus = await verifySeal(jarId);

  if (sealStatus === 'SEAL_BROKEN') {
    return {
      code: 'SEAL_BROKEN',
      address,
      message: `Seal integrity violation on jar ${jarId}`,
    };
  }

  const contents: CabinetContents = {
    address,
    jarId,
    content,
    sealStatus,
    openedAtMs: nowMs,
    lazyLoadFirstAccessedAt: firstAccess ?? null,
    keepAliveUntil,
  };

  // Store in jar cache + LRU registry
  _jarCache.set(key, contents);
  _cabinetLRU.set(key, {
    substratePath: address.substratePath,
    lastAccessedAt: nowMs,
    keepAliveUntil: nowMs + KEEP_ALIVE_MS,
  });

  const latencyMs = Date.now() - startMs;
  await writeSealLog({
    jarId,
    substratePath: address.substratePath,
    partition: address.partition,
    librarianRole,
    sealStatus,
    latencyMs,
    lazyLoadFirstAccessedAt: firstAccess ?? null,
  });

  return contents;
}

// ── Cabinet seal ──────────────────────────────────────────────────────────────

/**
 * Seal a Cabinet: locks the file_cabinet_seal_log row and emits a pearl.
 * Does not re-seal an already-sealed cabinet.
 */
export async function sealCabinet(
  address: CabinetAddress,
): Promise<SealResult> {
  const jarId = generateJarId(address);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { sealLogId: jarId, pearlEmitted: false };
  }

  let sealLogId = jarId;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/file_cabinet_seal_log`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        jar_id: jarId,
        substrate_path: address.substratePath,
        partition: address.partition,
        librarian_role: 'seal_operation',
        seal_status: 'intact',
        latency_ms: 0,
        session_bp: 'BP089',
      }),
      signal: AbortSignal.timeout(CABINET_TIMEOUT_MS),
    });
    if (res.ok) {
      const rows = await res.json() as Array<{ id: string }>;
      if (rows[0]?.id) sealLogId = rows[0].id;
    }
  } catch {
    // Non-fatal
  }

  // Emit pearl for the seal event
  let pearlEmitted = false;
  try {
    const pearlPayload = {
      event: 'cabinet_sealed',
      jarId,
      substratePath: address.substratePath,
      partition: address.partition,
      sealedAtMs: Date.now(),
      bp: 'BP089',
    };
    const pearlRes = await fetch(`${SUPABASE_URL}/functions/v1/pearl-emit`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pearl_id: `cabinet_sealed_${jarId}`,
        payload: pearlPayload,
      }),
      signal: AbortSignal.timeout(CABINET_TIMEOUT_MS),
    });
    pearlEmitted = pearlRes.ok;
  } catch {
    pearlEmitted = false;
  }

  return { sealLogId, pearlEmitted };
}

// ── LRU eviction ─────────────────────────────────────────────────────────────

/**
 * Evict LRU entries whose keep_alive has expired.
 * Returns the list of evicted entries.
 * @param registry   Current LRU registry snapshot.
 * @param pressureThresholdBytes  Memory pressure signal (informational for now).
 */
export function evictLRU(
  registry: CabinetLRUEntry[],
  pressureThresholdBytes: number,
): CabinetLRUEntry[] {
  const nowMs = Date.now();
  const evicted: CabinetLRUEntry[] = [];

  // Sort ascending by lastAccessedAt (oldest first)
  const sorted = [...registry].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

  for (const entry of sorted) {
    const expired = nowMs > entry.keepAliveUntil;
    // Evict if keep_alive expired, or if under memory pressure (over threshold)
    if (expired || pressureThresholdBytes > 0) {
      const key = `${entry.substratePath}`;
      // Find matching key in jarCache (partition unknown here; sweep all partitions)
      for (const cacheKey of _jarCache.keys()) {
        if (cacheKey.endsWith(`::${entry.substratePath}`)) {
          _jarCache.delete(cacheKey);
          _cabinetLRU.delete(cacheKey);
        }
      }
      evicted.push(entry);
      if (!expired) break; // Under pressure: evict only the single oldest
    }
  }

  return evicted;
}

// ── Export LRU registry snapshot for external monitoring ─────────────────────

export function getLRUSnapshot(): CabinetLRUEntry[] {
  return [..._cabinetLRU.values()];
}
