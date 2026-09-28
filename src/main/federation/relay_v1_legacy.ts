/**
 * relay_v1_legacy.ts -- D-BP223-X043-007-RELAY-X25519. The OLD "v1" Thorax relay encryption,
 * moved here VERBATIM from mic_dispatcher.ts (encryptForRelay / decryptFromRelay) so that it can
 * be fenced behind the transition switches in relay_crypto_settings.ts without a circular import.
 *
 * NOT SECRET. The key is sha256((sharedSecret ?? peerId) + ":thorax-relay-v1") and no caller ever
 * passed a shared secret, so the key is a function of the recipient's PUBLIC peer id. Anyone who
 * can read peer_presence (anon-readable) and relay_routes (anon-readable) could decrypt every v1
 * frame. It is kept only so a receiver can, during a transition window the user turns on,
 * still read a frame from a machine that has not upgraded. Nothing sends v1 by default.
 *
 * Wire shape: JSON {"iv": base64(12 bytes), "ct": base64(ciphertext||tag)}. No "v" field; that
 * absence is how a receiver tells v1 from v2.
 */

import { createHash } from 'crypto';

export async function encryptForRelayV1Legacy(
  plaintext: string,
  targetPeerId: string,
  _sharedSecret?: string,
): Promise<string> {
  const keyMaterial = _sharedSecret ?? targetPeerId;
  const rawKey = createHash('sha256').update(`${keyMaterial}:thorax-relay-v1`).digest();

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt'],
  );

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plaintext),
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
  return JSON.stringify({ iv: ivB64, ct: ctB64 });
}

export async function decryptFromRelayV1Legacy(
  payloadEncrypted: string,
  selfPeerId: string,
  _sharedSecret?: string,
): Promise<string> {
  const keyMaterial = _sharedSecret ?? selfPeerId;
  const rawKey = createHash('sha256').update(`${keyMaterial}:thorax-relay-v1`).digest();

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt'],
  );

  const parsed = JSON.parse(payloadEncrypted) as { iv?: string; ct?: string };
  if (typeof parsed.iv !== 'string' || typeof parsed.ct !== 'string') {
    throw new Error('decryptFromRelay: payload_encrypted missing iv/ct');
  }
  const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(parsed.ct), (c) => c.charCodeAt(0));

  const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ct);
  return new TextDecoder().decode(pt);
}

/** True for the v1 wire shape: an object with string iv and ct and no "v" field. */
export function isRelayV1Frame(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Record<string, unknown>;
  return p.v === undefined && typeof p.iv === 'string' && typeof p.ct === 'string';
}
