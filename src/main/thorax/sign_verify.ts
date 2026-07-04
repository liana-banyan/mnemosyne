/**
 * sign_verify.ts -- MAMBA-beta3: Ed25519 Thorax PKI
 *
 * Sign and verify hex-mcode dispatch frames using Ed25519.
 *
 * Wire protocol:
 *   Signed frame = <original frameHex> + <128 hex chars (64 bytes, full Ed25519 signature)>
 *
 * Note: Ed25519 raw signatures are 64 bytes (128 hex chars). A full 64-byte signature
 * is required for standard crypto.verify -- truncation to 16 bytes is not supported by
 * Node.js crypto.verify. Both sign and verify use the full 64-byte signature.
 * The suffix is 128 hex chars (64 bytes), not 32 hex chars.
 *
 * Keys are DER-encoded hex strings (SPKI for public, PKCS8 for private) as produced
 * by getOrCreateKeypair() in ed25519_keypair.ts.
 *
 * Canon ref: MAMBA-beta3 BP087
 */

import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

/** Length of the hex-encoded signature suffix appended to every signed frame. */
export const SIG_HEX_LEN = 128; // 64 bytes * 2 hex chars per byte

/**
 * Sign a hex-mcode frame with the given Ed25519 private key.
 * Appends a 64-byte (128 hex char) Ed25519 signature suffix to the frame.
 *
 * @param frameHex       Raw hex frame produced by encodeFrame() from wire/hex-encode.ts
 * @param private_key_hex DER-encoded private key as lowercase hex (PKCS8 format)
 * @returns              Full signed frame: frameHex + 128-char signature hex suffix
 */
export function signFrame(frameHex: string, private_key_hex: string): string {
  const privKey = createPrivateKey({
    key: Buffer.from(private_key_hex, 'hex'),
    format: 'der',
    type: 'pkcs8',
  });

  const frameBuffer = Buffer.from(frameHex, 'utf8');
  const sigBuffer = sign(null, frameBuffer, privKey);

  return frameHex + sigBuffer.toString('hex');
}

/**
 * Verify a signed hex-mcode frame against the sender's Ed25519 public key.
 * Strips the last SIG_HEX_LEN chars (64-byte signature), runs crypto.verify.
 *
 * @param signedFrameHex  Full signed frame (frameHex + 128-char sig hex suffix)
 * @param public_key_hex  Sender's DER-encoded public key as lowercase hex (SPKI format)
 * @returns               { valid: true/false, frameHex: original unsigned frame }
 */
export function verifyFrame(
  signedFrameHex: string,
  public_key_hex: string,
): { valid: boolean; frameHex: string } {
  if (signedFrameHex.length <= SIG_HEX_LEN) {
    return { valid: false, frameHex: '' };
  }

  const frameHex = signedFrameHex.slice(0, -SIG_HEX_LEN);
  const sigHex = signedFrameHex.slice(-SIG_HEX_LEN);

  try {
    const pubKey = createPublicKey({
      key: Buffer.from(public_key_hex, 'hex'),
      format: 'der',
      type: 'spki',
    });

    const frameBuffer = Buffer.from(frameHex, 'utf8');
    const sigBuffer = Buffer.from(sigHex, 'hex');

    const valid = verify(null, frameBuffer, pubKey, sigBuffer);
    return { valid, frameHex };
  } catch {
    return { valid: false, frameHex };
  }
}
