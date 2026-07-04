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
  | 'manual_registration';

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
