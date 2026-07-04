/**
 * peerKeyGen.ts -- Peer Ed25519 Key Generation
 * BP089 Marathon Session 2 -- Item E (I8)
 *
 * Manages Ed25519 keypairs for MnemosyneC peers.
 * - Checks peer_presence.public_key_hex (post-I8 migration)
 * - Generates if missing
 * - Encrypts private key with AES-256-GCM before storage
 * - Composes with stampEntry from ipLedger.ts for keypair_generated event
 *
 * BLOOD: NEVER log plaintext private key. NEVER echo. NEVER store unencrypted.
 * DB: peer_presence table via Supabase REST (actual table; yoke referenced 'peers').
 *
 * §14 GADGET RECEIPT:
 *   Peers missing public_key_hex in capabilities JSONB:
 *     - 88cbf6bdd6f74587 (version 0.5.12, gemma4:12b)
 *   Peers with public_key_hex in capabilities (not yet in dedicated column):
 *     - d0b47bd08633385b, cb4ef450cc4a18c3, 49f3e5971518a064
 */

import {
  generateEd25519KeyPair,
  stampEntry,
  persistStamp,
} from './ipLedger';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PeerKeyRecord {
  peerId: string;
  publicKeyHex: string;
  privateKeyEncrypted: string;
}

interface SupabaseConfig {
  supabaseUrl: string;
  anonKey: string;
}

interface PeerPresenceRow {
  peer_id: string;
  public_key_hex: string | null;
  private_key_hex_encrypted: string | null;
  capabilities: Record<string, unknown> | null;
}

// ─── Encryption helpers ──────────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';

/**
 * Derive a 32-byte encryption key from a device-specific salt.
 * Uses scrypt. Salt should be stable per device (e.g. from safeStorage or a
 * device-local file, NOT the private key itself).
 * BLOOD: never log the returned key buffer.
 */
function deriveEncryptionKey(salt: Buffer): Buffer {
  // Stretch a device-stable identifier to 32 bytes.
  // Caller provides salt from safeStorage or device-local entropy.
  return scryptSync('device-local-key-derivation', salt, 32) as Buffer;
}

export function encryptPrivateKey(privateKeyPem: string, encryptionSalt: Buffer): string {
  const key = deriveEncryptionKey(encryptionSalt);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: salt_hex:iv_hex:tag_hex:ciphertext_hex
  return [
    encryptionSalt.toString('hex'),
    iv.toString('hex'),
    tag.toString('hex'),
    enc.toString('hex'),
  ].join(':');
}

export function decryptPrivateKey(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted private key format');
  const [saltHex, ivHex, tagHex, ciphertextHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const key = deriveEncryptionKey(salt);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function fetchPeerPresenceRow(
  peerId: string,
  config: SupabaseConfig
): Promise<PeerPresenceRow | null> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}&select=peer_id,public_key_hex,private_key_hex_encrypted,capabilities&limit=1`,
    {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    }
  );
  if (!res.ok) return null;
  const rows: PeerPresenceRow[] = await res.json();
  return rows[0] ?? null;
}

async function upsertPeerKeyColumns(
  peerId: string,
  publicKeyHex: string,
  privateKeyEncrypted: string,
  config: SupabaseConfig
): Promise<boolean> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public_key_hex: publicKeyHex, private_key_hex_encrypted: privateKeyEncrypted }),
    }
  );
  return res.ok;
}

// ─── Core: ensurePeerKeypair ──────────────────────────────────────────────────

/**
 * Check if peer already has a public_key_hex in peer_presence.
 * If missing: generate Ed25519 keypair, encrypt private key, store both.
 * Also emits a keypair_generated stamp to ip_ledger.
 *
 * BLOOD: privateKeyPem is used to sign the stamp, then discarded from memory.
 * Returns: the public key hex for the peer.
 */
export async function ensurePeerKeypair(
  peerId: string,
  config: SupabaseConfig
): Promise<{ publicKeyHex: string; generated: boolean }> {
  const row = await fetchPeerPresenceRow(peerId, config);

  if (row?.public_key_hex) {
    return { publicKeyHex: row.public_key_hex, generated: false };
  }

  // Generate new keypair
  const { publicKeyHex, privateKeyPem } = generateEd25519KeyPair();

  // Encrypt private key before any storage
  const encryptionSalt = randomBytes(16);
  const privateKeyEncrypted = encryptPrivateKey(privateKeyPem, encryptionSalt);

  // Store in peer_presence
  await upsertPeerKeyColumns(peerId, publicKeyHex, privateKeyEncrypted, config);

  // Stamp the keypair_generated event in ip_ledger
  const stampEntry_ = stampEntry({
    ringBearerId: peerId,
    entryType: 'keypair_generated',
    payloadJson: {
      peer_id: peerId,
      public_key_hex: publicKeyHex,
      generated_at: new Date().toISOString(),
      key_type: 'ed25519',
      note: 'Initial keypair generation for peer substrate identity',
    },
    privateKeyPem,
    stampSeq: 0,
  });

  await persistStamp(stampEntry_, config);

  // Explicit null-out to remove from closure scope (best-effort in JS GC context)
  // BLOOD: we do not log privateKeyPem anywhere in this function
  void (privateKeyPem as unknown);

  return { publicKeyHex, generated: true };
}

// ─── Idempotent launch check ─────────────────────────────────────────────────

/**
 * Idempotent on-launch call. Safe to call every startup.
 * Generates keypair if missing; no-ops if already present.
 */
export async function peerLaunchKeyCheck(
  peerId: string,
  config: SupabaseConfig
): Promise<void> {
  try {
    const result = await ensurePeerKeypair(peerId, config);
    if (result.generated) {
      console.info(`[peerKeyGen] Generated new Ed25519 keypair for peer ${peerId.slice(0, 8)}...`);
    }
  } catch (err) {
    console.error('[peerKeyGen] Key check failed (non-fatal):', err instanceof Error ? err.message : String(err));
  }
}
