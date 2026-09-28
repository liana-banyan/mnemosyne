/**
 * relay_v2_transport.ts -- D-BP223-X043-007-RELAY-X25519. Electron-side glue for the v2 Thorax
 * relay encryption in relay_x25519.ts:
 *   - this node's relay X25519 key, derived in memory from its Thorax Ed25519 key;
 *   - the signed announcement published in peer_presence.capabilities.relay_x25519
 *     (an existing jsonb column: no schema change);
 *   - resolving and VERIFYING a recipient's key before sealing;
 *   - opening an inbound frame (v2 always; v1 only when relayV1AcceptInbound is on).
 *
 * TRUST ORDER for "which Ed25519 key vouches for a peer's X25519 key":
 *   1. enrolled   thorax peer_enrollment_registry.json (Founder-enrolled machines)
 *   2. known      a key learned from a signature-verified LAN beacon (constellation saved peers)
 *   3. presence   the Ed25519 key in the SAME peer_presence row (capabilities.public_key_hex).
 *                 Send side: refused unless relayAllowPresenceTofu is on, because peer_presence is
 *                 anon-writable and a row editor could swap both keys. Receive side: accepted and
 *                 reported as 'self_declared', because it only affects who the sender claims to
 *                 be, which the inner Ed25519 frame signature and bishop_dispatch_handler's
 *                 enrolled/allowlist checks already decide (not confidentiality).
 *   A trusted key that FAILS to verify is a hard refusal; it never falls through to a weaker tier.
 */

import { join } from 'node:path';
import { app } from 'electron';
import { getOrCreateKeypair } from '../thorax/ed25519_keypair';
import { lookupEnrolledPeerPublicKey } from '../thorax/peer_enrollment_registry';
import { lookupKnownPeerPublicKey } from './constellation_discovery';
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import { getStablePeerId } from './peer-discovery';
import {
  deriveRelayX25519FromEd25519,
  signRelayX25519Announcement,
  verifyRelayX25519Announcement,
  sealRelayV2,
  openRelayV2,
  isRelayV2Frame,
  MemoryReplayGuard,
  RelayCryptoError,
  type RelayX25519Keypair,
  type RelayX25519Announcement,
  type ReplayGuard,
  type SenderKeySource,
} from './relay_x25519';
import { encryptForRelayV1Legacy, decryptFromRelayV1Legacy, isRelayV1Frame } from './relay_v1_legacy';
import { isRelayCryptoSettingOn } from './relay_crypto_settings';

export interface LocalRelayIdentity {
  peerId: string;
  keypair: RelayX25519Keypair;
  announcement: RelayX25519Announcement;
  ed25519PublicHex: string;
}

let _cached: { edPub: string; peerId: string; identity: LocalRelayIdentity } | null = null;

/** This node's relay identity. Throws if the Thorax Ed25519 key is unavailable (for example,
 *  Windows encrypted storage is off); callers treat that as "cannot use v2 right now". */
export function getLocalRelayIdentity(peerId: string): LocalRelayIdentity {
  const { public_key_hex, private_key_hex } = getOrCreateKeypair();
  if (_cached && _cached.edPub === public_key_hex && _cached.peerId === peerId) return _cached.identity;
  const keypair = deriveRelayX25519FromEd25519(private_key_hex);
  const announcement = signRelayX25519Announcement(peerId, keypair.publicKeyHex, private_key_hex);
  const identity: LocalRelayIdentity = { peerId, keypair, announcement, ed25519PublicHex: public_key_hex };
  _cached = { edPub: public_key_hex, peerId, identity };
  return identity;
}

/** The value for peer_presence.capabilities.relay_x25519. Public key and signature only. Fails
 *  soft (undefined), matching publishPresence()'s handling of a missing public_key_hex. */
export function buildPresenceRelayX25519Field(peerId: string): RelayX25519Announcement | undefined {
  try {
    return getLocalRelayIdentity(peerId).announcement;
  } catch (err) {
    console.warn('[RelayV2] relay X25519 key unavailable, presence published without relay_x25519:', err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

/** Enrolled key first, then a beacon-learned key. Never the presence row. Never throws. */
export function resolveTrustedPeerEd25519(peerId: string): string | undefined {
  try {
    const registryPath = join(app.getPath('userData'), 'peer_enrollment_registry.json');
    const enrolled = lookupEnrolledPeerPublicKey(registryPath, peerId);
    if (enrolled) return enrolled;
  } catch { /* no userData outside Electron; fall through */ }
  try {
    return lookupKnownPeerPublicKey(peerId) ?? undefined;
  } catch {
    return undefined;
  }
}

export interface RecipientKeyDeps {
  fetchImpl?: typeof fetch;
  supabaseUrl?: string;
  anonKey?: string;
  resolveTrusted?: (peerId: string) => string | null | undefined;
  settingsPath?: string;
}

export type RecipientKeyResult =
  | { ok: true; x25519PubHex: string; trust: 'trusted' | 'presence_tofu' }
  | { ok: false; reason: string; noV2Key: boolean };

/** Reads the recipient's peer_presence row and verifies its relay_x25519 announcement. */
export async function resolveRecipientRelayKey(targetPeerId: string, deps: RecipientKeyDeps = {}): Promise<RecipientKeyResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const supabaseUrl = deps.supabaseUrl ?? getSupabaseUrl();
  const anonKey = deps.anonKey ?? getAnonKey();
  let row: { capabilities?: Record<string, unknown> | null } | undefined;
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(targetPeerId)}&select=peer_id,capabilities&limit=1`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return { ok: false, reason: `peer_presence lookup failed: HTTP ${res.status}`, noV2Key: false };
    const rows = (await res.json()) as Array<{ capabilities?: Record<string, unknown> | null }>;
    row = Array.isArray(rows) ? rows[0] : undefined;
  } catch (err) {
    return { ok: false, reason: `peer_presence lookup error: ${err instanceof Error ? err.message : String(err)}`, noV2Key: false };
  }
  if (!row) return { ok: false, reason: `no peer_presence row for ${targetPeerId}`, noV2Key: true };
  const caps = (row.capabilities && typeof row.capabilities === 'object') ? row.capabilities : {};
  const ann = caps['relay_x25519'];
  if (!ann) return { ok: false, reason: `peer ${targetPeerId} has published no relay_x25519 key (old build?)`, noV2Key: true };

  const trusted = (deps.resolveTrusted ?? resolveTrustedPeerEd25519)(targetPeerId);
  if (trusted) {
    const chk = verifyRelayX25519Announcement(ann, targetPeerId, trusted);
    if (!chk.ok) return { ok: false, reason: `recipient relay key REFUSED against its enrolled/known Ed25519 key: ${chk.reason}`, noV2Key: false };
    return { ok: true, x25519PubHex: (ann as RelayX25519Announcement).x25519_pub, trust: 'trusted' };
  }
  if (!isRelayCryptoSettingOn('relayAllowPresenceTofu', deps.settingsPath)) {
    return {
      ok: false,
      reason: `peer ${targetPeerId} is neither enrolled nor known from a verified beacon, and relayAllowPresenceTofu is off ` +
        '(a key vouched for only by its own anon-writable presence row is not trusted)',
      noV2Key: false,
    };
  }
  const rowEd = caps['public_key_hex'];
  const chk = verifyRelayX25519Announcement(ann, targetPeerId, typeof rowEd === 'string' ? rowEd : '');
  if (!chk.ok) return { ok: false, reason: `recipient relay key REFUSED: ${chk.reason}`, noV2Key: false };
  return { ok: true, x25519PubHex: (ann as RelayX25519Announcement).x25519_pub, trust: 'presence_tofu' };
}

export interface SealDeps extends RecipientKeyDeps {
  selfPeerId?: string;
  local?: LocalRelayIdentity;
}

export type SealResult =
  | { ok: true; payloadEncrypted: string; wire: 'v2' | 'v1'; keyTrust: 'trusted' | 'presence_tofu' | 'none_v1' }
  | { ok: false; error: string };

/** Seals a relay payload for one peer. v2 always when the recipient has a verifiable key; v1 only
 *  when the recipient has NO v2 key and relayV1SendFallback is on. Never throws. */
export async function sealRelayPayloadForPeer(plaintext: string, targetPeerId: string, deps: SealDeps = {}): Promise<SealResult> {
  try {
    const recipient = await resolveRecipientRelayKey(targetPeerId, deps);
    if (!recipient.ok) {
      if (recipient.noV2Key && isRelayCryptoSettingOn('relayV1SendFallback', deps.settingsPath)) {
        console.warn(`[RelayV2] SENDING v1 (not secret) to ${targetPeerId}: ${recipient.reason}; relayV1SendFallback is on`);
        return { ok: true, payloadEncrypted: await encryptForRelayV1Legacy(plaintext, targetPeerId), wire: 'v1', keyTrust: 'none_v1' };
      }
      return { ok: false, error: `relay v2 seal refused: ${recipient.reason}` };
    }
    const selfPeerId = deps.selfPeerId ?? getStablePeerId();
    const local = deps.local ?? getLocalRelayIdentity(selfPeerId);
    const payloadEncrypted = sealRelayV2({
      plaintext,
      selfPeerId,
      selfKeypair: local.keypair,
      selfAnnouncement: local.announcement,
      selfEd25519PublicHex: local.ed25519PublicHex,
      recipientPeerId: targetPeerId,
      recipientX25519PubHex: recipient.x25519PubHex,
    });
    return { ok: true, payloadEncrypted, wire: 'v2', keyTrust: recipient.trust };
  } catch (err) {
    return { ok: false, error: `relay v2 seal failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

const _replayGuard: ReplayGuard = new MemoryReplayGuard();

export interface OpenDeps {
  selfPeerId: string;
  resolveTrustedSenderEd25519: (peerId: string) => string | null | undefined;
  local?: LocalRelayIdentity;
  replayGuard?: ReplayGuard;
  settingsPath?: string;
  nowMs?: number;
}

export type OpenResult =
  | { wire: 'v2'; plaintext: string; from: string; mid: string; senderKeySource: SenderKeySource }
  | { wire: 'v1'; plaintext: string };

/** Opens an inbound relay payload. Throws RelayCryptoError (code V1_REFUSED, NOT_V2,
 *  WRONG_RECIPIENT, STALE, FUTURE, BAD_SENDER_KEY, DECRYPT_FAILED, REPLAY, MALFORMED_FRAME). */
export async function openRelayPayload(payloadEncrypted: string, deps: OpenDeps): Promise<OpenResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadEncrypted);
  } catch {
    throw new RelayCryptoError('MALFORMED_FRAME', 'payload_encrypted is not JSON');
  }
  if (isRelayV2Frame(parsed)) {
    const local = deps.local ?? getLocalRelayIdentity(deps.selfPeerId);
    const r = openRelayV2({
      frameJson: payloadEncrypted,
      selfPeerId: deps.selfPeerId,
      selfKeypair: local.keypair,
      resolveTrustedSenderEd25519: deps.resolveTrustedSenderEd25519,
      replayGuard: deps.replayGuard ?? _replayGuard,
      nowMs: deps.nowMs,
    });
    return { wire: 'v2', ...r };
  }
  if (isRelayV1Frame(parsed)) {
    if (!isRelayCryptoSettingOn('relayV1AcceptInbound', deps.settingsPath)) {
      throw new RelayCryptoError('V1_REFUSED',
        'v1 relay frame refused: v1 is not end-to-end secret and relayV1AcceptInbound is off (the default)');
    }
    return { wire: 'v1', plaintext: await decryptFromRelayV1Legacy(payloadEncrypted, deps.selfPeerId) };
  }
  throw new RelayCryptoError('MALFORMED_FRAME', 'payload_encrypted is neither a v2 frame nor a v1 frame (missing iv/ct)');
}
