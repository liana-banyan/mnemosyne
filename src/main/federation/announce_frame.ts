/**
 * announce_frame.ts — KN-BP144-16 Phase 1: signed peer-announcement framing.
 *
 * Adapts an arbitrary JSON-serialisable announcement/dispatch payload into the EXISTING
 * hex-mcode wire format (encodeFrame/decodeFrame, ../wire/hex-encode.ts) and signs/verifies it
 * with the EXISTING Thorax Ed25519 primitives (signFrame/verifyFrame, ../thorax/sign_verify.ts).
 *
 * This is not a new wire format and not a new identity mechanism. KN-BP144-16 Phase 0 (0.4)
 * found this exact adaptation already precedented in src/main/plow/mesh_plow_dispatcher.ts
 * (RETIRED, BP135 Yoke #34 -- its schema assumptions were wrong against production Supabase and
 * it required a service-role key no client install can safely hold; that file itself is not
 * revived, only the pattern it demonstrated: encodeFrame() -> signFrame() to produce a signed
 * frame, and the inverse on receipt). Frame type reused: 'broadcast' -- Phase 0 (0.4) found this
 * the best existing semantic fit for an unsolicited, no-specific-recipient peer announcement;
 * it is reused as-is for the LAN HTTP dispatch-authentication case too rather than inventing a
 * second frame type for a single ticket.
 *
 * The badge (the ledger, the soccerball address) is untouched. This module only adds a
 * verification step around the pre-existing Thorax Ed25519 keypair (ed25519_keypair.ts) --
 * no new address scheme, no new credential type.
 */

import { encodeFrame, decodeFrame } from '../wire/hex-encode';
import { signFrame, verifyFrame, SIG_HEX_LEN } from '../thorax/sign_verify';
import { getOrCreateKeypair } from '../thorax/ed25519_keypair';

export interface SignedAnnounceResult {
  signedHex: string;
  publicKeyHex: string;
}

/**
 * Sign an announcement/dispatch payload with THIS machine's Thorax Ed25519 keypair.
 * The signer's own public_key_hex is embedded into the payload automatically (spread after the
 * caller's fields, so it always wins) -- the receiver needs it to look up or corroborate trust
 * before calling verifyAnnounceFrame(). Returns null if the keypair is unavailable (fails soft,
 * matching the existing convention in peer_server.ts's publishPresence() -- never throws).
 */
export function signAnnouncePayload(
  dispatchIdSeed: string,
  payload: Record<string, unknown>,
): SignedAnnounceResult | null {
  try {
    const { public_key_hex, private_key_hex } = getOrCreateKeypair();
    const payloadWithKey = { ...payload, public_key_hex };
    const rawHexFrame = encodeFrame(dispatchIdSeed, 'broadcast', payloadWithKey);
    const signedHex = signFrame(rawHexFrame, private_key_hex);
    return { signedHex, publicKeyHex: public_key_hex };
  } catch (err) {
    console.warn('[AnnounceFrame] signAnnouncePayload failed -- announce will fall back to unsigned (non-fatal):', err);
    return null;
  }
}

export interface PeekedAnnounce {
  payload: Record<string, unknown>;
  claimedPublicKeyHex: string | undefined;
}

/**
 * Strip the signature suffix and decode the frame body WITHOUT verifying it yet -- lets the
 * receiver learn the claimed identity (peer_id, public_key_hex) before it decides which public
 * key to verify against (a previously-learned key for a known peer_id, or the self-declared key
 * embedded in this same frame, i.e. trust-on-first-use). This mirrors exactly how the retired
 * mesh_plow_dispatcher.ts always computed `frameHex` in verifyFrame() before checking `valid` --
 * see sign_verify.ts's own implementation. Returns null on anything malformed; never throws.
 */
export function peekAnnouncePayload(signedHex: string): PeekedAnnounce | null {
  try {
    if (typeof signedHex !== 'string' || signedHex.length <= SIG_HEX_LEN) return null;
    const rawHexFrame = signedHex.slice(0, -SIG_HEX_LEN);
    const decoded = decodeFrame(rawHexFrame);
    const claimedPublicKeyHex =
      typeof decoded.payload.public_key_hex === 'string' ? decoded.payload.public_key_hex : undefined;
    return { payload: decoded.payload, claimedPublicKeyHex };
  } catch {
    return null;
  }
}

export interface VerifiedAnnounce {
  valid: boolean;
  payload: Record<string, unknown> | null;
  reason: string;
}

/**
 * Verify a signed announcement frame against a SPECIFIC public key. The caller decides which
 * key that is (a previously-learned key for a known peer_id is stronger evidence than a
 * self-declared key inside the same frame being verified -- callers should prefer the former
 * when available). Never throws. A signature that fails to verify is ALWAYS refused here --
 * this function has no notion of an override or opt-out; that policy decision belongs to the
 * caller (see mesh_trust_settings.ts), and only ever governs the ABSENCE of a signature, never
 * a signature that is present and invalid.
 */
export function verifyAnnounceFrame(signedHex: string, publicKeyHex: string): VerifiedAnnounce {
  if (typeof signedHex !== 'string' || signedHex.length <= SIG_HEX_LEN) {
    return { valid: false, payload: null, reason: 'frame too short to carry a signature' };
  }
  if (typeof publicKeyHex !== 'string' || publicKeyHex.length === 0) {
    return { valid: false, payload: null, reason: 'no public key supplied to verify against' };
  }
  const result = verifyFrame(signedHex, publicKeyHex);
  if (!result.valid) {
    return { valid: false, payload: null, reason: 'signature verification failed (bad signature, tampered frame, or wrong key)' };
  }
  try {
    const decoded = decodeFrame(result.frameHex);
    if (!decoded.crcValid) {
      return { valid: false, payload: null, reason: 'signature valid but frame checksum invalid (corrupt frame)' };
    }
    return { valid: true, payload: decoded.payload, reason: 'signature verified' };
  } catch (err) {
    return {
      valid: false,
      payload: null,
      reason: `signature valid but frame body failed to decode: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
