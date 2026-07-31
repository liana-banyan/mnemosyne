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

import { createHash, createPrivateKey, sign, randomUUID } from 'node:crypto';
import ws from 'ws';
import { getOrCreateKeypair } from '../thorax/ed25519_keypair';
import { getRingBearerIdentity } from './ring_bearer_keygen';
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';

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
  | 'member_connection'
  // WIRE-THE-LOOP fix (collective-learning replication): a plow_mc_answerer.ts /
  // plow_mc_decompose.ts solved answer (sourced fact + reasoning + sourceUrl + authority),
  // stamped so mesh_diff_loop.ts's existing 15-minute Merkle-diff sweep actually has rows to
  // find and replicate to peers -- see plow_mc_answerer.ts's writeAndReplicateSolvedAnswer().
  | 'plow_mc_answer_solved';

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
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || getAnonKey();
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

  // BP139 FIX: entry_id is generated client-side and we do NOT read the row back
  // (no .select().single() = return=minimal). ip_ledger_entries has an anon INSERT policy but NO
  // anon SELECT policy, so reading the inserted row back (PostgREST's default return=representation)
  // failed RLS with "new row violates row-level security policy" and silently dropped EVERY
  // replication write (the collective-learning share-back never persisted). A client-generated
  // entry_id lets the receipt still carry a real id without needing a read-back / anon SELECT.
  const entry_id = randomUUID();
  const { error } = await supabase
    .from('ip_ledger_entries')
    .insert({
      entry_id,
      ring_bearer_peer_id: identity.peer_id,
      contribution_type:   params.contribution_type,
      payload_hash:        `\\x${payloadHashHex}`,
      payload_url:         params.payload_url ?? null,
      stamped_at,
      signature_ed25519:   `\\x${signatureHex}`,
      mesh_replicated:     false,
    });

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

  const entryId = entry_id;
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
