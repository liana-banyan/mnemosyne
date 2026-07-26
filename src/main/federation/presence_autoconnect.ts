// presence_autoconnect.ts -- BP134 Yoke #30 Task B: zero-config WAN auto-connect.
//
// Presence is already zero-config: every peer running MnemosyneC publishes to the shared
// Supabase `peer_presence` table using the bundled publishable key (see shared/anon_key.ts)
// -- no invite-token exchange is needed to become VISIBLE. Prior to this fix, being visible
// in peer_presence did not translate into an actual mesh connection: the only code paths
// that ever called PeerDiscovery.registerWANPeer() + sent an `identify` handshake were
// federation:accept-invite and federation:connect-peer (main/index.ts), both of which
// require the user to already know the target peerId -- obtainable only by manually
// pasting/scanning an invite token (CueDeckShareTab.tsx). That manual step was the actual
// blocker the Founder hit (BP134 Yoke #30), not a missing discovery mechanism.
//
// This module closes the gap: it queries peer_presence directly (same table, same
// `state=eq.active` filter already fixed for the `status` vs `state` column bug at
// wan_dispatch.ts's discoverLiveWanPeers -- BP133 Yoke #26), and for every active,
// non-stale, not-already-known peer it runs the *same* registerWANPeer + identify
// handshake the manual-token flow already triggers. No new trust boundary is introduced:
// a peer still has to have published valid presence (bundled publishable key, same as
// every other presence consumer in this codebase) and still has to complete the existing
// identify -> identify_ack -> ratify -> ratify_ack handshake in relay-client.ts before
// reaching 'synced'. The invite-token flow remains available as a fallback for a peer that
// has NOT published presence (older build, presence temporarily unreachable, etc).

import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import type { MnemosynePeer, PeerTransport } from '../../shared/federation-protocol';

// Matches wan_dispatch.ts's PRESENCE_STALE_MS -- a peer_presence row with state='active'
// but a last_seen_at older than this is stale/gone, not a live auto-connect candidate.
const PRESENCE_STALE_MS = 5 * 60 * 1000;

interface PresenceRow {
  peer_id: string;
  machine_label: string | null;
  lan_addresses: string[] | null;
  last_seen_at: string | null;
}

/**
 * First three IPv4 octets ("a.b.c" of "a.b.c.d") -- a /24 proxy for "same local subnet".
 * BP134's empirical trigger is exactly this shape: host 192.168.86.x vs
 * NJS_3D_FACTORY's 192.168.1.85 -- different /24s, correctly WAN. Not full CIDR/prefix
 * math, but the simplest correct rule for the typical /24 home and small-office LANs this
 * app targets, and matches the granularity lan_addresses is collected at
 * (collectLanAddresses() stores bare IPv4 strings, no prefix length).
 */
function subnetPrefix(ipv4: string): string | null {
  const m = ipv4.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

/** True if any address in `a` shares a /24 with any address in `b`. Exported for TASK A's
 *  classification fix and tests to reuse the identical rule. */
export function sharesLocalSubnet(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  if (!a?.length || !b?.length) return false;
  const bPrefixes = new Set(b.map(subnetPrefix).filter((p): p is string => p !== null));
  return a.some((addr) => {
    const p = subnetPrefix(addr);
    return p !== null && bPrefixes.has(p);
  });
}

export interface PresenceAutoConnectResult {
  attempted: number;
  connected: string[]; // peer IDs newly registered this call
  error?: string;
}

export interface PresenceAutoConnectDeps {
  selfPeerId: string;
  /** This host's own non-loopback IPv4 addresses (collectLanAddresses()). */
  hostLanAddresses: string[];
  /** peerIds already known to PeerDiscovery (LAN or WAN) -- skipped, already connected/connecting. */
  knownPeerIds: Set<string>;
  registerWANPeer: (peer: MnemosynePeer) => void;
  sendIdentify: (toPeerId: string) => void;
  relayConnected: boolean;
}

/**
 * Queries peer_presence for active, non-stale, not-yet-known peers and registers +
 * identifies each one automatically. Never throws -- returns an empty result (with
 * `error` set) on any network/config failure, matching discoverLiveWanPeers()'s
 * "empty means no live peers right now, not an error" contract.
 */
export async function discoverAndConnectPresencePeers(
  deps: PresenceAutoConnectDeps,
): Promise<PresenceAutoConnectResult> {
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!url || !anonKey) {
    return { attempted: 0, connected: [], error: 'Supabase URL/anon key not configured' };
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/peer_presence?state=eq.active&select=peer_id,machine_label,lan_addresses,last_seen_at`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      return { attempted: 0, connected: [], error: `peer_presence query failed: HTTP ${res.status}` };
    }

    const rows = (await res.json()) as PresenceRow[];
    const now = Date.now();
    const connected: string[] = [];

    for (const row of rows) {
      if (!row.peer_id || row.peer_id === deps.selfPeerId) continue;
      if (deps.knownPeerIds.has(row.peer_id)) continue; // already discovered -- no-op
      if (!row.last_seen_at) continue;
      const age = now - new Date(row.last_seen_at).getTime();
      if (age < 0 || age > PRESENCE_STALE_MS) continue; // stale/gone

      const transport: PeerTransport = sharesLocalSubnet(row.lan_addresses, deps.hostLanAddresses)
        ? 'lan'
        : 'wan-relay';

      deps.registerWANPeer({
        peerId: row.peer_id,
        displayName: row.machine_label ?? undefined,
        address: transport === 'lan' ? (row.lan_addresses?.[0] ?? 'relay') : 'relay',
        port: 0,
        transport,
        phase: 'identified',
        lastSeen: row.last_seen_at,
      });

      if (deps.relayConnected) {
        deps.sendIdentify(row.peer_id);
      }
      connected.push(row.peer_id);
    }

    return { attempted: rows.length, connected };
  } catch (e) {
    return { attempted: 0, connected: [], error: e instanceof Error ? e.message : String(e) };
  }
}
