/**
 * key_verifier.ts -- Keys and Engines: verify soccerball-hash + Thorax Ed25519 signature
 * BP087 Wave 4 · Keys and Engines canon
 */

import { createHash, verify as cryptoVerify, createPublicKey } from 'node:crypto';
import type { SignedKey } from './key_signer';

export interface VerifyResult {
  ok: boolean;
  socceriHash: string;
  signatureValid: boolean;
  hashMatchesPayload: boolean;
  error?: string;
}

export function verifySocceriKey(
  payloadBytes: Buffer,
  signedKey: SignedKey,
): VerifyResult {
  try {
    // Step 1: recompute hash from payload bytes
    const computedHash = createHash('sha512').update(payloadBytes).digest('hex');
    const hashMatchesPayload = computedHash === signedKey.socceriHash;

    // Step 2: verify Ed25519 signature over the claimed hash
    const pubKey = createPublicKey({
      key: Buffer.from(signedKey.publicKeyHex, 'hex'),
      format: 'der',
      type: 'spki',
    });
    const signatureValid = cryptoVerify(
      null,
      Buffer.from(signedKey.socceriHash, 'utf8'),
      pubKey,
      Buffer.from(signedKey.signature, 'hex'),
    );

    return {
      ok: hashMatchesPayload && signatureValid,
      socceriHash: computedHash,
      signatureValid,
      hashMatchesPayload,
    };
  } catch (err) {
    return {
      ok: false,
      socceriHash: '',
      signatureValid: false,
      hashMatchesPayload: false,
      error: String(err),
    };
  }
}
