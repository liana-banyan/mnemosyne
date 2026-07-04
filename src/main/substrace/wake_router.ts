// BP087 MAMBA-Row3: wake_router.ts
// Client-side substrace wake dispatch + manifest fetch handler.
// Dispatches re-weave wake requests to the substrace-wake Edge Function and handles
// incoming substrace_wake messages by fetching each manifest item from the local substrate.
//
// Relay emit hook: wire setRelayEmitHook(fn) from index.ts so this module can emit
// substrace_wake_complete back through the relay without importing relayClient directly.

import { queryEbletStore } from '../mnem_eblet_store';
import { SubstrateLocalIndex } from '../substrate_router';

// ── Configuration ──────────────────────────────────────────────────────────────

const RELAY_BASE_PRIMARY =
  (typeof process !== 'undefined' && process.env?.SUBSTRATE_AWAKENS_RELAY)
    ? process.env.SUBSTRATE_AWAKENS_RELAY
    : 'https://relay.lianabanyan.com/functions/v1';

const RELAY_BASE_FALLBACK = 'https://ruuxzilgmuwddcofqecc.supabase.co/functions/v1';

// PRE-FLIGHT-1 (BP087): dual-fallback -- picks up NEXT_PUBLIC_* keys used by the rest of the codebase
const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.LB_SUPABASE_URL ??
  'https://ruuxzilgmuwddcofqecc.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.LB_SUPABASE_ANON_KEY ??
  '';

const WAKE_TIMEOUT_MS = 12_000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ManifestItem {
  type: 'pearl_id' | 'eblet_slug' | 'substrate_address';
  ref: string;
}

export interface ResolvedItem {
  type: 'pearl_id' | 'eblet_slug' | 'substrate_address';
  ref: string;
  content: string | null; // null if not found
}

// ── Relay emit hook ────────────────────────────────────────────────────────────

// Set by index.ts via setRelayEmitHook to wire substrace_wake_complete emission.
// Accepts the message to send and the target peer id (the origin of the wake).
type RelayEmitFn = (msg: unknown, toPeerId: string) => void;
let _relayEmitHook: RelayEmitFn | null = null;

export function setRelayEmitHook(fn: RelayEmitFn): void {
  _relayEmitHook = fn;
}

// ── Substrate index (module-level singleton) ───────────────────────────────────

let _substrateIndex: SubstrateLocalIndex | null = null;

async function getSubstrateIndex(): Promise<SubstrateLocalIndex> {
  if (_substrateIndex === null) {
    _substrateIndex = new SubstrateLocalIndex();
    await _substrateIndex.load();
  }
  return _substrateIndex;
}

// ── Supabase REST helpers ──────────────────────────────────────────────────────

function supabaseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function supabasePatch(
  table: string,
  matchCol: string,
  matchVal: string,
  update: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${matchCol}=eq.${encodeURIComponent(matchVal)}`,
      {
        method: 'PATCH',
        headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
      },
    );
  } catch (err) {
    console.warn(`[wake_router] supabasePatch ${table} failed:`, err);
  }
}

// ── Relay POST helper (primary + fallback) ──────────────────────────────────────

async function relayPost(path: string, body: unknown): Promise<Response | null> {
  const tryFetch = async (base: string): Promise<Response | null> => {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
      });
      if (res.status >= 500) return null;
      return res;
    } catch {
      return null;
    }
  };

  const primary = await tryFetch(RELAY_BASE_PRIMARY);
  if (primary !== null) return primary;
  return tryFetch(RELAY_BASE_FALLBACK);
}

// ── Manifest item resolution helpers ──────────────────────────────────────────

async function resolvePearlId(ref: string): Promise<string | null> {
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/pearl_share?id=eq.${encodeURIComponent(ref)}&select=id,content&limit=1`;
    const res = await fetch(url, {
      headers: supabaseHeaders(),
      signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[wake_router] pearl_share fetch HTTP ${res.status} for ref=${ref}`);
      return null;
    }
    const rows = (await res.json()) as Array<{ id: string; content: string }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn(`[wake_router] pearl_id ref=${ref}: not found in pearl_share (null)`);
      return null;
    }
    return rows[0].content ?? null;
  } catch (err) {
    console.warn(`[wake_router] pearl_id ref=${ref} fetch error:`, err);
    return null;
  }
}

async function resolveEbletSlug(ref: string): Promise<string | null> {
  try {
    const results = await queryEbletStore(ref);
    if (results.length === 0) {
      console.warn(`[wake_router] eblet_slug ref=${ref}: no results from queryEbletStore (null)`);
      return null;
    }
    return results[0];
  } catch (err) {
    console.warn(`[wake_router] eblet_slug ref=${ref} query error:`, err);
    return null;
  }
}

async function resolveSubstrateAddress(ref: string): Promise<string | null> {
  try {
    const index = await getSubstrateIndex();
    const hits = index.query(ref, 1);
    if (hits.length === 0) {
      console.warn(`[wake_router] substrate_address ref=${ref}: no hits in local index (null)`);
      return null;
    }
    const { record, score } = hits[0];
    return `[score:${score.toFixed(2)}] ${record.text}`;
  } catch (err) {
    console.warn(`[wake_router] substrate_address ref=${ref} query error:`, err);
    return null;
  }
}

async function resolveManifestItem(item: ManifestItem): Promise<ResolvedItem> {
  let content: string | null = null;

  if (item.type === 'pearl_id') {
    content = await resolvePearlId(item.ref);
  } else if (item.type === 'eblet_slug') {
    content = await resolveEbletSlug(item.ref);
  } else if (item.type === 'substrate_address') {
    content = await resolveSubstrateAddress(item.ref);
  } else {
    // Unknown type: log and return null
    console.warn(`[wake_router] unknown manifest item type="${(item as ManifestItem).type}" ref=${item.ref} (null)`);
  }

  return { type: item.type, ref: item.ref, content };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Dispatches a substrace wake to a target peer with a re-weave manifest.
 * POSTs to the substrace-wake Edge Function, which inserts a substrace_wake_routes row
 * and forwards the wake to the target peer via relay_routes.
 */
export async function dispatchSubstraceWake(opts: {
  target_peer_id: string;
  manifest: ManifestItem[];
}): Promise<{ wake_id: string }> {
  const origin_peer_id: string =
    // Import getStablePeerId lazily to avoid circular deps at module load time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require('../federation/peer-discovery') as { getStablePeerId: () => string }).getStablePeerId();

  const res = await relayPost('/substrace-wake', {
    target_peer_id: opts.target_peer_id,
    origin_peer_id,
    manifest: opts.manifest,
  });

  if (!res) {
    throw new Error('[wake_router] dispatchSubstraceWake: relay POST failed (primary + fallback both unreachable)');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`[wake_router] dispatchSubstraceWake: relay returned ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { wake_id: string };
  if (!json.wake_id) {
    throw new Error('[wake_router] dispatchSubstraceWake: response missing wake_id');
  }

  console.log(`[wake_router] wake dispatched wake_id=${json.wake_id} target=${opts.target_peer_id} items=${opts.manifest.length}`);
  return { wake_id: json.wake_id };
}

/**
 * Handles receiving a substrace wake message.
 * Fetches all manifest items in order, logs null entries explicitly,
 * emits substrace_wake_complete via relay, and updates substrace_wake_routes ack.
 */
export async function handleSubstraceWakeReceive(
  manifest: ManifestItem[],
  wake_id?: string,
  origin_peer_id?: string,
): Promise<{ resolved_items: ResolvedItem[] }> {
  console.log(`[wake_router] handleSubstraceWakeReceive wake_id=${wake_id ?? 'unknown'} items=${manifest.length}`);

  // Resolve all manifest items in order (sequential to maintain order guarantee)
  const resolved_items: ResolvedItem[] = [];
  for (const item of manifest) {
    const resolved = await resolveManifestItem(item);
    if (resolved.content === null) {
      // Explicit null log per DRIFT SURFACE PROTOCOL
      console.warn(`[wake_router] NULL resolved: type=${item.type} ref=${item.ref} wake_id=${wake_id ?? 'unknown'}`);
    }
    resolved_items.push(resolved);
  }

  // Emit substrace_wake_complete back to origin peer via relay hook
  if (_relayEmitHook && origin_peer_id) {
    const completeMsg = {
      type: 'substrace_wake_complete',
      payload: {
        wake_id: wake_id ?? '',
        resolved_items,
        resolved_count: resolved_items.filter((r) => r.content !== null).length,
        null_count: resolved_items.filter((r) => r.content === null).length,
      },
      ts: new Date().toISOString(),
    };
    _relayEmitHook(completeMsg, origin_peer_id);
    console.log(`[wake_router] substrace_wake_complete emitted wake_id=${wake_id ?? 'unknown'} resolved=${completeMsg.payload.resolved_count}/${resolved_items.length}`);
  } else {
    console.warn(`[wake_router] relay emit hook not set or origin_peer_id missing; substrace_wake_complete NOT sent`);
  }

  // Update substrace_wake_routes row: ack_received_at + ack_status='complete'
  if (wake_id) {
    await supabasePatch('substrace_wake_routes', 'wake_id', wake_id, {
      ack_received_at: new Date().toISOString(),
      ack_status: 'complete',
      resolved_items: resolved_items as unknown,
    });
  }

  return { resolved_items };
}

/**
 * Gadget-callable test function for acceptance gate testing.
 * Dispatches a hardcoded 5-item manifest to the given target peer.
 * Uses real pearl_ids from pearl_share if any exist; falls back to test stubs.
 */
export async function testSubstraceWake(target_peer_id: string): Promise<{ wake_id: string }> {
  // Attempt to fetch 3 real pearl_ids from pearl_share
  let pearlRefs: string[] = ['test-pearl-001', 'test-pearl-002', 'test-pearl-003'];

  try {
    const url = `${SUPABASE_URL}/rest/v1/pearl_share?select=id&limit=3`;
    const res = await fetch(url, {
      headers: supabaseHeaders(),
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ id: string }>;
      if (Array.isArray(rows) && rows.length > 0) {
        pearlRefs = rows.map((r) => r.id);
        // Pad with stubs if fewer than 3 real rows
        while (pearlRefs.length < 3) {
          pearlRefs.push(`test-pearl-stub-${pearlRefs.length}`);
        }
      }
    }
  } catch {
    // Fall back to test stubs -- no real pearl_share rows available
  }

  const manifest: ManifestItem[] = [
    { type: 'pearl_id', ref: pearlRefs[0] },
    { type: 'pearl_id', ref: pearlRefs[1] },
    { type: 'pearl_id', ref: pearlRefs[2] },
    { type: 'eblet_slug', ref: 'substrace_theorem' },
    { type: 'eblet_slug', ref: 'mesh_routing' },
  ];

  console.log(`[wake_router] testSubstraceWake target=${target_peer_id} manifest=${JSON.stringify(manifest)}`);
  return dispatchSubstraceWake({ target_peer_id, manifest });
}
