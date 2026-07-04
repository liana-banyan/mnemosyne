/**
 * ipLedger.ts -- Stamp-Certified IP Ledger primitive
 * BP089 Marathon Session 2 -- §16 ARCHITECTURAL HARD CANON BP087
 *
 * Implements Ed25519 stamping for cooperative IP provenance.
 * Local-first: stamps are created locally and replicated to Supabase ip_ledger table.
 *
 * Crypto: node:crypto native Ed25519 (Node 20+ -- no @noble/ed25519 in package.json).
 * DB pattern: Supabase REST API via fetch (matches wrasse_quartermaster.ts pattern).
 *
 * BLOOD: private keys NEVER logged, NEVER echoed, NEVER stored plaintext.
 */

import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { randomUUID } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IPLedgerEntry {
  id: string;
  ring_bearer_id: string;
  entry_type: string;
  payload_hash: string;
  payload_json: Record<string, unknown>;
  ed25519_sig: string | null;
  stamp_seq: number;
  stamped_at: string;
  merkle_node: string | null;
  replicated_at: string | null;
}

export interface StampResult {
  entry: IPLedgerEntry;
  persisted: boolean;
  error?: string;
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

export function hashPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// ─── Ed25519 Signing ──────────────────────────────────────────────────────────

/**
 * Sign a payload hash with an Ed25519 private key.
 * privateKeyPem: PEM-encoded PKCS#8 private key from generateKeyPairSync.
 * Returns hex-encoded signature.
 * BLOOD: never log or echo privateKeyPem.
 */
export function signPayloadHash(payloadHash: string, privateKeyPem: string): string {
  const sig = sign(null, Buffer.from(payloadHash, 'hex'), privateKeyPem);
  return sig.toString('hex');
}

// ─── Core: stampEntry ─────────────────────────────────────────────────────────

/**
 * Create a stamp entry record (local, not yet persisted).
 * ringBearerId: the peer/member creating this stamp.
 * entryType: semantic type (e.g. 'keypair_generated', 'innovation_claim', 'contribution').
 * payloadJson: arbitrary structured data being stamped.
 * privateKeyPem: optional -- if provided, signs the payload hash.
 * stampSeq: caller must provide a monotonically-increasing sequence number.
 */
export function stampEntry(params: {
  ringBearerId: string;
  entryType: string;
  payloadJson: Record<string, unknown>;
  privateKeyPem?: string;
  stampSeq: number;
}): IPLedgerEntry {
  const { ringBearerId, entryType, payloadJson, privateKeyPem, stampSeq } = params;

  const payloadHash = hashPayload(payloadJson);
  const ed25519_sig = privateKeyPem
    ? signPayloadHash(payloadHash, privateKeyPem)
    : null;

  return {
    id: randomUUID(),
    ring_bearer_id: ringBearerId,
    entry_type: entryType,
    payload_hash: payloadHash,
    payload_json: payloadJson,
    ed25519_sig,
    stamp_seq: stampSeq,
    stamped_at: new Date().toISOString(),
    merkle_node: null,
    replicated_at: null,
  };
}

// ─── Core: persistStamp ──────────────────────────────────────────────────────

/**
 * Persist a stamp entry to the Supabase ip_ledger table via REST API.
 * Uses fetch pattern consistent with wrasse_quartermaster.ts.
 *
 * TODO: If ip_ledger table schema conflict (old vs new §16 schema) is not yet resolved
 * by Bishop, this will fail with a column mismatch. Bishop must apply I12 migration
 * and rename ip_ledger_legacy first.
 */
export async function persistStamp(
  entry: IPLedgerEntry,
  config: { supabaseUrl: string; anonKey: string }
): Promise<StampResult> {
  const { supabaseUrl, anonKey } = config;

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/ip_ledger`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(entry),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        entry,
        persisted: false,
        error: `HTTP ${res.status}: ${body}`,
      };
    }

    return { entry, persisted: true };
  } catch (err) {
    return {
      entry,
      persisted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Convenience: stampAndPersist ────────────────────────────────────────────

export async function stampAndPersist(
  params: {
    ringBearerId: string;
    entryType: string;
    payloadJson: Record<string, unknown>;
    privateKeyPem?: string;
    stampSeq: number;
  },
  config: { supabaseUrl: string; anonKey: string }
): Promise<StampResult> {
  const entry = stampEntry(params);
  return persistStamp(entry, config);
}

// ─── Key generation helper (used by peerKeyGen.ts) ──────────────────────────

/**
 * Generate a fresh Ed25519 key pair.
 * Returns publicKeyHex (DER SubjectPublicKeyInfo) and privateKeyPem (PKCS#8).
 * BLOOD: caller must encrypt privateKeyPem before any storage.
 */
export function generateEd25519KeyPair(): {
  publicKeyHex: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    publicKeyHex: (publicKey as Buffer).toString('hex'),
    privateKeyPem: privateKey as string,
  };
}
