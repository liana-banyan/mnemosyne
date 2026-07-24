/**
 * stamp_certify.ts — I12 IP Ledger Stamp-Certify primitive
 * BP092 · canon_stamp_certified_ip_ledger_ring_bearer_frontier_mesh_replicating_backbone_bp087
 *
 * Signs a payload hash with the Ring Bearer Ed25519 private key and writes
 * a row to ip_ledger_entries (Postgres via Supabase service-role client).
 *
 * Federal Body Cam doctrine: rows are NEVER updated or deleted.
 * Postgres-only: gen_random_uuid() · TIMESTAMPTZ · BYTEA — no SQLite.
 *
 * Field names confirmed from ed25519_keypair.ts:
 *   keypair.public_key_hex — DER spki Ed25519 public key as hex
 *   keypair.private_key_hex — DER pkcs8 Ed25519 private key as hex
 */

import { createHash, createPrivateKey, sign } from 'node:crypto';
import ws from 'ws';
import { getOrCreateKeypair } from '../thorax/ed25519_keypair';
import { getRingBearerIdentity } from './ring_bearer_keygen';

export type ContributionType =
  | 'battery_dispatch_submission'
  | 'config_set_model_pull'
  | 'member_business_listing_created'
  | 'manual_registration'
  // BP132 Yoke #22 Addendum A: QR-ledger-per-connection. Founder decision = BOTH
  // (keep the static genesis vCard QR AND mint a fresh per-connection ledger QR).
  // Truth-Always note: the addendum asked to mirror a `stampCertifyEmpress()`
  // pattern, but no such function exists anywhere in src/ (confirmed by search) —
  // the actual empress `ip_ledger` row was written by a server-side hook
  // ("empress-ip-ledger-hook" in its payload_json), not by mnemosyne client code.
  // The real, callable, reusable pattern is THIS file's stampCertify(), which
  // writes to ip_ledger_entries (a different table from `ip_ledger`). Mirrored
  // that instead — see stampCertifyConnection() below.
  | 'member_connection';

export interface StampCertifyParams {
  contribution_type: ContributionType;
  /** Raw payload string to hash. Must be deterministic for the same event. */
  payload: string;
  /** Optional URL pointing to the artifact */
  payload_url?: string;
}

export interface StampCertifyResult {
  entry_id: string;
  ring_bearer_peer_id: string;
  payload_hash_hex: string;
  stamped_at: string;
  ok: boolean;
  error?: string;
}

function getSupabaseClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('[stamp_certify] Supabase env vars not set');
  return createClient(url, key, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
}

/**
 * Signs the payload hash with the Ring Bearer private key and writes to ip_ledger_entries.
 * Returns the stamped entry_id and Ring Bearer peer_id for the receipt.
 *
 * Private key is stored as DER pkcs8 hex — createPrivateKey with format:'der', type:'pkcs8'.
 * Ed25519 sign: sign(null, data, key) — no digest algorithm needed for Ed25519.
 */
export async function stampCertify(params: StampCertifyParams): Promise<StampCertifyResult> {
  const keypair = getOrCreateKeypair();
  const identity = getRingBearerIdentity();

  const privateKeyHex = keypair.private_key_hex;

  const payloadHash = createHash('sha256').update(params.payload, 'utf8').digest();
  const payloadHashHex = payloadHash.toString('hex');

  const privateKeyObj = createPrivateKey({
    key: Buffer.from(privateKeyHex, 'hex'),
    format: 'der',
    type: 'pkcs8',
  });
  const signature = sign(null, payloadHash, privateKeyObj);
  const signatureHex = signature.toString('hex');

  const supabase = getSupabaseClient();
  const stamped_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('ip_ledger_entries')
    .insert({
      ring_bearer_peer_id: identity.peer_id,
      contribution_type:   params.contribution_type,
      payload_hash:        `\\x${payloadHashHex}`,
      payload_url:         params.payload_url ?? null,
      stamped_at,
      signature_ed25519:   `\\x${signatureHex}`,
      mesh_replicated:     false,
    })
    .select('entry_id')
    .single();

  if (error) {
    console.error('[stamp_certify] insert failed:', error.message);
    return {
      entry_id:            '',
      ring_bearer_peer_id: identity.peer_id,
      payload_hash_hex:    payloadHashHex,
      stamped_at,
      ok:                  false,
      error:               error.message,
    };
  }

  const entryId = (data as { entry_id: string } | null)?.entry_id ?? '';
  console.log(`[stamp_certify] stamped entry_id=${entryId} type=${params.contribution_type}`);

  return {
    entry_id:            entryId,
    ring_bearer_peer_id: identity.peer_id,
    payload_hash_hex:    payloadHashHex,
    stamped_at,
    ok:                  true,
  };
}

// ─── BP132 Yoke #22 Addendum A — QR-ledger-per-connection ────────────────────

export interface StampCertifyConnectionParams {
  /** The other party's peer id (mesh) or member id (Supabase auth), whichever is known. */
  peer_id: string;
  /** Optional self-identified display name captured at connect time (no PII beyond what the peer already shared). */
  peer_display_name?: string;
  /** How the connection was established, for audit trail readability. */
  connection_method: 'invite_token' | 'federation_connect_peer' | 'lan_discovery' | 'wan_relay';
}

/**
 * Stamps a new ip_ledger_entries row for a member-to-member connection event.
 * This is the function the Social tab's Peer/Federation Connect card and
 * CueDeckCardRenderer call after a successful connect, so a fresh per-connection
 * QR can be generated client-side from the resulting entry_id (Founder decision:
 * BOTH the static genesis vCard QR AND a fresh per-connection ledger QR).
 *
 * Deliberately does NOT touch `connection_handshakes` — that table's real schema
 * (package_id/trunk_id NOT NULL, current_step values like 'ledger_comparison' /
 * 'source_validation' / 'governance_check') is package-install validation lineage,
 * not a member-social-connection log. Forcing this write there would be inventing
 * semantics the schema does not support. Flagged for Bishop in the Yoke return.
 */
export async function stampCertifyConnection(
  params: StampCertifyConnectionParams,
): Promise<StampCertifyResult> {
  return stampCertify({
    contribution_type: 'member_connection',
    payload: JSON.stringify({
      event: 'member_connection',
      peer_id: params.peer_id,
      peer_display_name: params.peer_display_name ?? null,
      connection_method: params.connection_method,
      timestamp: Date.now(),
    }),
  });
}
