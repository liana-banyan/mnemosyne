/**
 * relay_origin.ts -- D-BP158-M0-010. Makes the SENDER of a relay row verifiable, so a peer can
 * INITIATE contact rather than only reply.
 *
 * WHAT WAS MEASURED FIRST, and it changes the whole design
 *   `relay_routes` had no origin field of any kind. That much was known. What was NOT known
 *   until the database was queried directly is that every RLS policy on both relay tables is
 *   literally `true`:
 *       relay_routes        INSERT check true   SELECT using true   UPDATE using true
 *       relay_route_replies INSERT check true   SELECT using true
 *   RLS is ENABLED and permits everything to the `public` role. Any holder of the anon key can
 *   insert any row, read every row, and update any row, across 6,688 existing routes.
 *
 *   Therefore adding a plain `origin_peer_id` column would have been WORSE than adding nothing:
 *   it would manufacture the appearance of attribution on a table where anyone can write any
 *   value. HARDWIRE-26 exactly: an unverified origin is a claim, not a fact, and a claim that
 *   LOOKS like a fact is how a system starts trusting forgeries.
 *
 * THE CHAIN OF TRUST, three links, each verifiable by the receiver alone
 *   1. ROOT      lb-root-2026-01, compiled into every install's LB_PUBLIC_KEYS.
 *   2. ENROLLMENT  a Founder-signed assertion, scope 'peer-enrollment', binding a peer_id to a
 *                  public key. Verified against the ROOT via signed_order.ts. This is where the
 *                  receiver learns what M3's key actually is, from an authority it already
 *                  trusts, rather than from M3 itself.
 *   3. ORIGIN    each relay row signed by the enrolled PEER key.
 *
 *   Note what link 2 avoids: trust-on-first-use. Without an enrollment step a receiver would
 *   have to accept whatever key a stranger presents the first time, which is not trust, it is
 *   optimism. The Signed Order primitive built earlier this session is exactly the instrument
 *   for issuing that enrollment, which is why no new mechanism is invented here.
 *
 * WHAT THE SIGNATURE BINDS, and why each field is in it
 *   originPeerId | targetPeerId | sessionId | sha256(hexFrame) | nonce
 *     originPeerId   who is claiming to send it
 *     targetPeerId   binds the recipient, so a captured signature cannot be RETARGETED at a
 *                    different peer
 *     sessionId      binds the dispatch it belongs to
 *     sha256(frame)  binds the PAYLOAD, so a valid signature cannot be reattached to different
 *                    content. Omitting this is the classic mistake: it yields a signature that
 *                    proves a sender existed and says nothing about what they sent.
 *     nonce          makes two otherwise identical rows distinct, and lets a receiver that
 *                    remembers nonces detect replay
 */

import { createHash, randomBytes } from 'node:crypto';
import { signFrame, verifyFrame, SIG_HEX_LEN } from './sign_verify';

/**
 * signFrame() returns signature||frame and verifyFrame() consumes that concatenation. Like
 * signed_assertion.ts, this module stores ONLY the signature and rebuilds the canonical string
 * on the verifying side, so a row never carries its own canonical form redundantly (and cannot
 * disagree with itself about what was signed).
 */
function signatureOnly(canonical: string, privateKeyHex: string): string {
  return signFrame(canonical, privateKeyHex).slice(0, SIG_HEX_LEN);
}

function checkSignature(canonical: string, signatureHex: string, publicKeyHex: string): boolean {
  if (signatureHex.length !== SIG_HEX_LEN) return false;
  return verifyFrame(signatureHex + canonical, publicKeyHex).valid;
}

export interface RelayOriginFields {
  origin_peer_id: string;
  origin_key_id: string;
  origin_signature: string;
  origin_nonce: string;
}

export interface OriginCheckResult {
  /** The signature verified against the resolved key. */
  valid: boolean;
  /** True ONLY when a key was resolved AND the signature verified. Gate on this. */
  attributed: boolean;
  reason: string;
}

/** Fixed field order and separator, mirroring canonicalManifestEntryString's reasoning: signer
 *  and verifier must build byte-identical strings or every signature fails for the wrong
 *  reason. */
export function canonicalOriginString(
  originPeerId: string,
  targetPeerId: string,
  sessionId: string,
  hexFrame: string,
  nonce: string,
): string {
  const frameHash = createHash('sha256').update(hexFrame, 'utf8').digest('hex');
  return [originPeerId, targetPeerId, sessionId, frameHash, nonce].join('|');
}

/** Sign an outbound route. Called by the INITIATING peer with its own private key. */
export function signRelayOrigin(params: {
  originPeerId: string;
  targetPeerId: string;
  sessionId: string;
  hexFrame: string;
  originKeyId: string;
  privateKeyHex: string;
}): RelayOriginFields {
  const nonce = randomBytes(16).toString('hex');
  const canonical = canonicalOriginString(
    params.originPeerId, params.targetPeerId, params.sessionId, params.hexFrame, nonce,
  );
  return {
    origin_peer_id: params.originPeerId,
    origin_key_id: params.originKeyId,
    origin_signature: signatureOnly(canonical, params.privateKeyHex),
    origin_nonce: nonce,
  };
}

/**
 * Verify an inbound route's claimed origin.
 *
 * FAILS CLOSED and says which step failed. An unsigned row is reported as UNATTRIBUTED, never
 * as invalid: the 6,688 rows already in that table are all unsigned, and calling them forgeries
 * would be its own kind of lie. Unattributed and forged are different facts.
 */
export function verifyRelayOrigin(
  row: {
    origin_peer_id?: string | null;
    origin_key_id?: string | null;
    origin_signature?: string | null;
    origin_nonce?: string | null;
    target_peer_id: string;
    session_id?: string | null;
    hex_frame: string;
  },
  resolvePeerKey: (keyId: string) => string | null,
  seenNonces?: Set<string>,
): OriginCheckResult {
  if (!row.origin_peer_id || !row.origin_signature || !row.origin_key_id || !row.origin_nonce) {
    return {
      valid: false,
      attributed: false,
      reason: 'row carries no signed origin. UNATTRIBUTED, not forged: it may predate signing, ' +
              'or come from a writer that does not sign. Do not act on its claimed sender.',
    };
  }

  if (seenNonces && seenNonces.has(row.origin_nonce)) {
    return {
      valid: false,
      attributed: false,
      reason: `nonce ${row.origin_nonce} already seen. Treating as REPLAY and refusing.`,
    };
  }

  const pub = resolvePeerKey(row.origin_key_id);
  if (!pub) {
    return {
      valid: false,
      attributed: false,
      reason: `origin_key_id "${row.origin_key_id}" is not enrolled with this installation. A ` +
              `peer must be enrolled by a Founder-signed assertion before its messages count. ` +
              `Refusing rather than trusting on first use.`,
    };
  }

  const canonical = canonicalOriginString(
    row.origin_peer_id, row.target_peer_id, row.session_id ?? '', row.hex_frame, row.origin_nonce,
  );
  const ok = checkSignature(canonical, row.origin_signature, pub);
  if (!ok) {
    return {
      valid: false,
      attributed: false,
      reason: 'origin signature did not verify against the enrolled key. The row was altered ' +
              'after signing, signed by a different key, or forged.',
    };
  }

  if (seenNonces) seenNonces.add(row.origin_nonce);
  return { valid: true, attributed: true, reason: `origin verified as ${row.origin_peer_id}` };
}
