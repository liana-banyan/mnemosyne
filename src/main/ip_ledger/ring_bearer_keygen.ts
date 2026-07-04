/**
 * ring_bearer_keygen.ts — I12 IP Ledger Ring Bearer keypair
 * BP092 · canon_stamp_certified_ip_ledger_ring_bearer_frontier_mesh_replicating_backbone_bp087
 *
 * REUSES thorax Ed25519 library — does NOT re-implement Ed25519.
 * getOrCreateKeypair() from src/main/thorax/ed25519_keypair.ts is the canonical
 * keypair store. This module provides the Ring Bearer interface — same keypair,
 * IP-Ledger-specific accessors.
 *
 * Federal Body Cam doctrine: Ring Bearer keypair is NEVER rotated after first write.
 * Field names confirmed from ed25519_keypair.ts: public_key_hex, private_key_hex (DER hex).
 */

import { getOrCreateKeypair } from '../thorax/ed25519_keypair';
import { createHash } from 'node:crypto';

export interface RingBearerIdentity {
  peer_id: string;        // hex(SHA256(public_key_hex))[0..32] — stable short ID
  public_key_hex: string; // full DER-encoded Ed25519 spki pubkey as hex
}

/**
 * Returns the Ring Bearer identity for this peer.
 * peer_id is derived deterministically from the Thorax Ed25519 public key.
 * Stable across restarts (keypair is persisted by thorax/ed25519_keypair.ts).
 */
export function getRingBearerIdentity(): RingBearerIdentity {
  const keypair = getOrCreateKeypair();
  const publicKeyHex = keypair.public_key_hex;

  const peer_id = createHash('sha256')
    .update(publicKeyHex)
    .digest('hex')
    .slice(0, 32); // 32 hex chars = 16 bytes

  return {
    peer_id,
    public_key_hex: publicKeyHex,
  };
}
