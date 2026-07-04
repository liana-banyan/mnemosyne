/**
 * mesh_diff_loop.ts — I12 IP Ledger Mesh Diff Replication Loop
 * BP092 · 15-minute interval · Merkle-diff against Circle of Influence peers
 * Battery-aware default OFF per OQ-5 canon (pause when on battery, no AC)
 * LAN-as-WAN constraint: ALWAYS route via relay.lianabanyan.com — no LAN shortcuts
 * canon_lan_as_wan_test_mode_4_machine_mesh_bp085
 * Close keeps mesh alive, Quit exits — loop stops only on Quit
 * canon_close_keeps_mesh_alive_quit_exits_two_button_semantic_bp092
 */

import { createHash } from 'node:crypto';
import { powerMonitor } from 'electron';
import ws from 'ws';
import { getRingBearerIdentity } from './ring_bearer_keygen';

const RELAY_BASE = process.env.SUBSTRATE_AWAKENS_RELAY ?? 'https://relay.lianabanyan.com/functions/v1';
const RELAY_PEER_LIST_TIMEOUT_MS = 8_000;

/**
 * Resolve a known WAN peer ID via relay.lianabanyan.com.
 * LAN-as-WAN canon: ALL peer traffic routes via relay — no LAN shortcuts.
 * canon_lan_as_wan_test_mode_4_machine_mesh_bp085 — HARD CONSTRAINT.
 * Returns null if relay unreachable or no peers known.
 */
async function resolveFirstRelayPeer(localPeerId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_PEER_LIST_TIMEOUT_MS);
    try {
      const resp = await fetch(`${RELAY_BASE}/wan-relay-list-peers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peer_id: localPeerId }),
        signal: controller.signal,
      });
      if (resp.ok) {
        const data = (await resp.json()) as { peers?: Array<{ peer_id: string }> };
        const first = data.peers?.find((p) => p.peer_id !== localPeerId);
        return first?.peer_id ?? null;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Relay unreachable — peer_b_id remains null (will be retried on next sweep)
  }
  return null;
}

const DIFF_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let diffLoopTimer: ReturnType<typeof setInterval> | null = null;

function getSupabaseClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('[mesh_diff_loop] Supabase env vars not set');
  return createClient(url, key, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
}

/**
 * Compute SHA-256 Merkle root of unreplicated entries for this peer.
 * Root = SHA256(sorted entry_ids joined by comma).
 */
async function computeLocalMerkleRoot(peer_id: string): Promise<{ root: string; entry_ids: string[] }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ip_ledger_entries')
    .select('entry_id')
    .eq('ring_bearer_peer_id', peer_id)
    .eq('mesh_replicated', false)
    .order('entry_id');

  if (error || !data) return { root: '', entry_ids: [] };

  const entry_ids = (data as Array<{ entry_id: string }>).map((r) => r.entry_id).sort();
  if (entry_ids.length === 0) return { root: '', entry_ids: [] };

  const root = createHash('sha256')
    .update(entry_ids.join(','))
    .digest('hex');

  return { root, entry_ids };
}

/**
 * Run one diff sweep against known Circle of Influence peers.
 * Routes via relay.lianabanyan.com — no direct LAN connections.
 * LAN-as-WAN constraint: peer_endpoint must be a relay URL, never a LAN IP.
 */
async function runDiffSweep(): Promise<void> {
  // Battery-aware gate — skip if on battery (OQ-5 = Y)
  try {
    if (typeof powerMonitor.isOnBatteryPower === 'function' && powerMonitor.isOnBatteryPower()) {
      console.log('[mesh_diff_loop] On battery — skipping diff sweep (OQ-5 default)');
      return;
    }
  } catch {
    // powerMonitor not available in this context — proceed
  }

  let identity: ReturnType<typeof getRingBearerIdentity>;
  try {
    identity = getRingBearerIdentity();
  } catch (e) {
    // Electron app not ready yet (app.getPath unavailable) — skip
    console.warn('[mesh_diff_loop] getRingBearerIdentity not ready:', e);
    return;
  }

  const { root: localRoot, entry_ids: localEntryIds } = await computeLocalMerkleRoot(identity.peer_id);

  if (!localRoot) {
    console.log('[mesh_diff_loop] No unreplicated entries — sweep skipped');
    return;
  }

  // Peer discovery scaffold: integrates with Circle of Influence peer list from
  // existing mesh infrastructure (mesh-dispatcher.ts / federation/).
  // Real peer exchange requires live relay connectivity via relay.lianabanyan.com.
  // This scaffold writes the local diff row; peer_b_id populated when relay exchange lands.
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // Resolve first known relay peer (LAN-as-WAN: relay.lianabanyan.com, never LAN-shortcut)
  const peer_b = await resolveFirstRelayPeer(identity.peer_id);

  await supabase.from('ip_ledger_merkle_diff').insert({
    diff_root_hash: `\\x${localRoot}`,
    peer_a_id:      identity.peer_id,
    peer_b_id:      peer_b,
    diff_payload:   { entry_ids: localEntryIds, sweep_at: now, relay_endpoint: RELAY_BASE },
    replicated_at:  now,
  });

  console.log(`[mesh_diff_loop] Diff sweep complete — root ${localRoot.slice(0, 12)}... · ${localEntryIds.length} unreplicated entries`);
}

export function startMeshDiffLoop(): void {
  if (diffLoopTimer) return; // already running
  console.log('[mesh_diff_loop] Starting — 15min interval · battery-aware · LAN-as-WAN');
  // Run once immediately on start (after a brief delay for app.getPath readiness)
  setTimeout(() => {
    runDiffSweep().catch((e: Error) => console.error('[mesh_diff_loop] initial sweep error:', e));
  }, 5000);
  diffLoopTimer = setInterval(() => {
    runDiffSweep().catch((e: Error) => console.error('[mesh_diff_loop] sweep error:', e));
  }, DIFF_INTERVAL_MS);
}

export function stopMeshDiffLoop(): void {
  if (diffLoopTimer) {
    clearInterval(diffLoopTimer);
    diffLoopTimer = null;
    console.log('[mesh_diff_loop] Stopped');
  }
}
