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

// ─── Chain linking (D-BP219-BM0-026) ────────────────────────────────────────
//
// merkle_node was declared on IPLedgerEntry (line 28) and always written as
// literal null by stampEntry() (line 91). Nothing in this file, or anywhere
// else in mnemosyne/src (grepped, zero other hits on merkle_node/merkleNode),
// ever computed a value for it. mesh_diff_loop.ts's computeLocalMerkleRoot()
// is a different mechanism entirely -- a batch root over unreplicated
// entry_ids for cross-peer diffing, against a different table
// (ip_ledger_entries, not ip_ledger) -- it does not chain individual rows.
// Verdict for the Founder's question ("unreachable, skipped, or never
// written"): NEVER WRITTEN. There was no chaining logic to reach or skip.
//
// canonicalizeDeep() below is PORTED, not reinvented, from
// C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\MIC_CHANNEL\mic_channel_crypto.js's
// canonicalize() (D-BP159-026): recursive sorted-object-key JSON
// serialization, no whitespace, so two callers hash the identical byte
// sequence for the identical logical object regardless of property
// insertion order or nesting depth. That estate-standard convention was
// chosen over crystal_store.ts's deriveMintAddress() (which canonicalizes
// only a flat array of pre-hashed "pearl" strings, a different, narrower
// shape than a full ledger row) because a chain link here must cover a
// nested payload_json, not a flat string list. The hash function stays
// SHA-256 (createHash('sha256')), NOT the mic_channel convention's SHA-512,
// so that merkle_node uses the same algorithm as payload_hash already does
// in this same file and this same row -- one hash algorithm per ledger row,
// not two unexplained ones.
//
// GENESIS_MARKER is the literal chained into the very first entry of a
// partition so a genesis link is distinguishable from a link whose prior
// was accidentally omitted.
const GENESIS_MARKER = 'GENESIS';

function canonicalizeDeep(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalizeDeep).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalizeDeep(obj[k])).join(',') + '}';
}

/**
 * Identity of the prior row in the same chain partition, the minimum needed
 * to extend the chain. Deliberately not the full IPLedgerEntry -- callers
 * fetching a prior row for chaining should not need to round-trip its
 * payload_json.
 */
export interface PriorChainLink {
  id: string;
  merkle_node: string | null;
}

/**
 * Compute the merkle_node value for `current`, chained from `prior`.
 *
 * Partition key: ring_bearer_id. Confirmed against the live schema
 * (2026-09 read via psql) -- the only UNIQUE constraint on ip_ledger besides
 * the primary key is (ring_bearer_id, stamp_seq); the two live rows carry
 * two DIFFERENT ring_bearer_id values, i.e. they are already, structurally,
 * two separate single-entry partitions, not two links of one chain. This
 * matches the Founder's stated architecture: every node (ring_bearer_id)
 * gets its OWN ledger/chain; entry_type is the category cross-referenced
 * within that per-node chain via Eblet Tags, not a second partition key
 * layered on top of it -- stamp_seq is monotonic per ring_bearer_id across
 * all entry_types, not per (ring_bearer_id, entry_type), so chaining on
 * entry_type too would fight the schema's own uniqueness constraint.
 *
 * The link is computed from the PRIOR row's identity (its id and its own
 * merkle_node, or GENESIS_MARKER when there is no prior row in this
 * partition) plus THIS row's canonical content (id, ring_bearer_id,
 * entry_type, payload_hash, stamp_seq, stamped_at). Altering any earlier
 * row's payload changes that row's payload_hash, which changes every
 * merkle_node computed after it in the same partition -- that is the whole
 * point of a chain.
 */
export function computeMerkleLink(
  prior: PriorChainLink | null,
  current: Pick<
    IPLedgerEntry,
    'id' | 'ring_bearer_id' | 'entry_type' | 'payload_hash' | 'stamp_seq' | 'stamped_at'
  >
): string {
  const linkInput = {
    prior_id: prior ? prior.id : GENESIS_MARKER,
    prior_merkle_node: prior ? prior.merkle_node ?? GENESIS_MARKER : GENESIS_MARKER,
    id: current.id,
    ring_bearer_id: current.ring_bearer_id,
    entry_type: current.entry_type,
    payload_hash: current.payload_hash,
    stamp_seq: current.stamp_seq,
    stamped_at: current.stamped_at,
  };
  return createHash('sha256').update(canonicalizeDeep(linkInput), 'utf8').digest('hex');
}

/**
 * Fetch the immediately-prior row in this entry's chain partition
 * (ring_bearer_id), i.e. the row with the highest stamp_seq strictly less
 * than this entry's stamp_seq. Returns null when this is the first entry
 * for that ring_bearer_id (a genuine genesis case, not an error).
 */
export async function fetchPriorLedgerEntry(
  ringBearerId: string,
  stampSeq: number,
  config: { supabaseUrl: string; anonKey: string }
): Promise<PriorChainLink | null> {
  const { supabaseUrl, anonKey } = config;
  const params = new URLSearchParams({
    select: 'id,merkle_node',
    ring_bearer_id: `eq.${ringBearerId}`,
    stamp_seq: `lt.${stampSeq}`,
    order: 'stamp_seq.desc',
    limit: '1',
  });
  const res = await fetch(`${supabaseUrl}/rest/v1/ip_ledger?${params.toString()}`, {
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchPriorLedgerEntry: HTTP ${res.status}: ${body}`);
  }
  const rows = (await res.json()) as PriorChainLink[];
  return rows.length > 0 ? rows[0] : null;
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
    // Chain-link this entry to the prior row in its partition (ring_bearer_id)
    // before it is ever sent to Postgres. FIREARM RULE: if the prior-row
    // lookup itself fails (network/HTTP error, as opposed to a genuine empty
    // "no prior row" result), do NOT fall through to inserting with a blank
    // merkle_node -- that would silently reproduce the exact unlinked-chain
    // gap this function exists to close. Report the error instead.
    let prior: PriorChainLink | null;
    try {
      prior = await fetchPriorLedgerEntry(entry.ring_bearer_id, entry.stamp_seq, {
        supabaseUrl,
        anonKey,
      });
    } catch (err) {
      return {
        entry,
        persisted: false,
        error: `chain-link lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const chainedEntry: IPLedgerEntry = {
      ...entry,
      merkle_node: computeMerkleLink(prior, entry),
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/ip_ledger`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(chainedEntry),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        entry: chainedEntry,
        persisted: false,
        error: `HTTP ${res.status}: ${body}`,
      };
    }

    return { entry: chainedEntry, persisted: true };
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
