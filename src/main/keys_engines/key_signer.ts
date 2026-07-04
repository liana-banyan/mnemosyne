/**
 * key_signer.ts -- Keys and Engines: soccerball-hash + Thorax Ed25519 signature
 * BP087 Wave 4 · Keys and Engines canon
 *
 * Produces a SignedKey: { socceriHash, signature, publicKeyHex, version, timestamp }
 * Written by the build pipeline (Cephas edge function) at deploy time.
 * Consumed by key_verifier.ts at install time on each Frame.
 */

import { createHash, sign, createPrivateKey } from 'node:crypto';

export interface SignedKey {
  socceriHash: string;      // SHA-512 of payload bytes, hex-encoded (soccerball coordinate)
  signature: string;        // Ed25519 signature over socceriHash, 128 hex chars
  publicKeyHex: string;     // SPKI DER hex of Thorax public key (for offline verify)
  version: string;          // update version string matching latest.yml
  timestamp: string;        // ISO-8601 UTC
}

/**
 * Compute socceri-hash: SHA-512 of payload bytes, returned as lowercase hex.
 * Named "socceri" per Socceri naming convention (BP085 Soccerball DAG coordinate scheme).
 */
export function socceriHash(payloadBytes: Buffer): string {
  return createHash('sha512').update(payloadBytes).digest('hex');
}

/**
 * Sign a socceriHash string with the Thorax Ed25519 private key.
 * private_key_hex: DER-encoded private key as lowercase hex (PKCS8 format),
 * produced by ed25519_keypair.ts getOrCreateKeypair().
 */
export function signSocceriHash(hash: string, private_key_hex: string): string {
  const privKey = createPrivateKey({
    key: Buffer.from(private_key_hex, 'hex'),
    format: 'der',
    type: 'pkcs8',
  });
  const sigBuffer = sign(null, Buffer.from(hash, 'utf8'), privKey);
  return sigBuffer.toString('hex'); // 128 hex chars (64 bytes)
}

/**
 * Build a complete SignedKey from payload bytes + Thorax private key.
 * Called by the Cephas edge function at deploy time.
 */
export function buildSignedKey(
  payloadBytes: Buffer,
  private_key_hex: string,
  public_key_hex: string,
  version: string,
): SignedKey {
  const hash = socceriHash(payloadBytes);
  const signature = signSocceriHash(hash, private_key_hex);
  return {
    socceriHash: hash,
    signature,
    publicKeyHex: public_key_hex,
    version,
    timestamp: new Date().toISOString(),
  };
}
