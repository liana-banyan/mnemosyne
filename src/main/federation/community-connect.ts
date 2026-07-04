// SEG-3 · v0.1.55 · COMMUNITY-CONNECT first-launch handshake
// Attempts WAN relay resolve + peer registration for canonical seed peer
// User 000001 / FounderDenken / genesis_ledger_id: ipl_89a9f31427f526aa

import { createHash } from 'crypto';
import type { MnemosynePeer } from '../../shared/federation-protocol';

export const SEED_GENESIS_LEDGER_ID = 'ipl_89a9f31427f526aa';
export const SEED_PEER_NAME = 'FounderDenken';

/** Primary relay (Supabase Edge Functions custom domain). */
const RELAY_BASE_PRIMARY = 'https://relay.lianabanyan.com/functions/v1';
/** Fallback when custom domain TLS/502 — matches wan_soccerball_address.ts pattern. */
const RELAY_BASE_FALLBACK = 'https://ruuxzilgmuwddcofqecc.supabase.co/functions/v1';

const RELAY_TIMEOUT_MS = 10_000;

export interface CommunityConnectResult {
  success: boolean;
  peerName?: string;
  error?: string;
}

export interface CommunityConnectDeps {
  ownPeerId: string;
  appVersion: string;
  registerWANPeer: (peer: MnemosynePeer) => void;
  sendIdentify?: (toPeerId: string) => void;
}

interface PeanutRoll {
  p?: string[];
  b?: { peerId?: string; displayName?: string };
}

/** Deterministic 32-char resolve SID from canonical genesis ledger id. */
export function seedPeerResolveSid(): string {
  return createHash('sha256').update(SEED_GENESIS_LEDGER_ID).digest('hex').slice(0, 32);
}

async function fetchRelayResolve(base: string, sid: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
  try {
    return await fetch(`${base}/wan-relay-resolve/${encodeURIComponent(sid)}`, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isRelayUnreachableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Try primary relay URL; fall back to raw Supabase URL on 502/503/network error.
 * Returns null when both endpoints are unreachable.
 */
async function resolveSeedViaRelay(
  sid: string,
): Promise<{ reachable: true; peerId: string | null; displayName: string | null } | { reachable: false }> {
  let primaryRes: Response | null = null;

  try {
    primaryRes = await fetchRelayResolve(RELAY_BASE_PRIMARY, sid);
    if (!isRelayUnreachableStatus(primaryRes.status)) {
      return await parseResolveResponse(primaryRes);
    }
  } catch {
    // Primary failed — try fallback
  }

  try {
    const fallbackRes = await fetchRelayResolve(RELAY_BASE_FALLBACK, sid);
    if (isRelayUnreachableStatus(fallbackRes.status)) {
      return { reachable: false };
    }
    return await parseResolveResponse(fallbackRes);
  } catch {
    return { reachable: false };
  }
}

async function parseResolveResponse(
  res: Response,
): Promise<{ reachable: true; peerId: string | null; displayName: string | null }> {
  if (!res.ok) {
    // 404/400 — relay responded; seed record may not be published yet
    return { reachable: true, peerId: null, displayName: null };
  }

  try {
    const roll = (await res.json()) as PeanutRoll;
    const peerId = roll.b?.peerId ?? roll.p?.[0] ?? null;
    const displayName =
      typeof roll.b?.displayName === 'string' ? roll.b.displayName : null;
    return { reachable: true, peerId, displayName };
  } catch {
    return { reachable: true, peerId: null, displayName: null };
  }
}

/**
 * Perform community-connect handshake with canonical seed peer.
 * Never throws — always returns a typed result.
 */
export async function performCommunityConnectHandshake(
  deps: CommunityConnectDeps,
): Promise<CommunityConnectResult> {
  const sid = seedPeerResolveSid();
  const resolved = await resolveSeedViaRelay(sid);

  if (!resolved.reachable) {
    return { success: false, error: 'Relay unreachable' };
  }

  const peerId = resolved.peerId ?? `seed-${SEED_GENESIS_LEDGER_ID.slice(4, 20)}`;
  const peerName = resolved.displayName ?? SEED_PEER_NAME;

  deps.registerWANPeer({
    peerId,
    displayName: peerName,
    address: 'relay',
    port: 0,
    transport: 'wan-relay',
    phase: 'identified',
    lastSeen: new Date().toISOString(),
  });

  deps.sendIdentify?.(peerId);

  return { success: true, peerName };
}
