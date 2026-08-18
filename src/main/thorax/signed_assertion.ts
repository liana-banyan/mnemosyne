/**
 * signed_assertion.ts -- D-BP158-010: ONE signed-assertion primitive for both the Founder's
 * "Direct from Captain" Signed Order and a member's QR-presentable Stamp.
 *
 * NOT a new crypto primitive. Reuses signFrame()/verifyFrame() from ./sign_verify.ts
 * UNCHANGED -- the same one-shot `crypto.sign(null, buf, key)` / `crypto.verify(null, buf,
 * key, sig)` calls that dodge the MEASURED Node v24.11.0 defect (`crypto.createVerify('ed25519')`
 * constructs without error but `.verify()` throws `TypeError: Invalid digest` -- see
 * auto_update_scheduler.ts:699-707, D-BP157-035). Also reuses the canonical-string-then-sign
 * shape verifyManifestEntrySignature() / canonicalRotationString() already establish in
 * auto_update_scheduler.ts for version_trust.json manifest entries and root-rotation
 * announcements -- this module generalizes that exact pattern into a standalone primitive
 * instead of re-deriving it a third time.
 *
 * Key encoding: SPKI-DER-hex (public) / PKCS8-DER-hex (private), matching getOrCreateKeypair()
 * in ed25519_keypair.ts AND the BP157 trust root at C:\Users\Administrator\.lb-root-keys\
 * (its .pubkey.txt states "publicKeyEncoding: spki-der-hex" explicitly) -- an assertion issued
 * by the root key verifies with zero re-encoding.
 *
 * Canon ref: D-BP158-010/BISHOP/seg-signed-order-member-stamp, BP158.
 */

import { randomBytes } from 'node:crypto';
import { signFrame, verifyFrame, SIG_HEX_LEN } from './sign_verify';

/**
 * The one primitive. A verifiable assertion from a named authority, carrying a mandatory scope
 * and expiry, checkable by anyone holding the issuer's public key -- no network, no database.
 *
 *   issuer     WHO is asserting. A keyId (e.g. 'lb-root-2026-01', or a member's stamp_code)
 *              string, not a raw key -- lets the verifier look up which public key to check
 *              against without the assertion having to embed its own key (self-declared keys
 *              are weaker evidence, per the exact reasoning verifyAnnounceFrame() already
 *              documents in announce_frame.ts).
 *   subject    WHO/WHAT this assertion is ABOUT. A machine id ('M3'), an action target, or a
 *              member's user_id/stamp_code. Separate from issuer so one issuer (the root) can
 *              speak about many subjects, and one subject (a member) is legible without also
 *              being the signer.
 *   scope      EXACTLY what is authorized. Founder ruling: "an order without a scope is a
 *              blank check." One string, not a wildcard -- a verifier must compare it against
 *              the specific action being taken, never merely check "is this signature valid".
 *   issuedAt   ISO-8601 UTC. Anchors the expiry math and gives a verifier something to reason
 *              about for clock-skew (see verifyAssertion's clockSkewToleranceSeconds).
 *   expiresAt  ISO-8601 UTC. Founder ruling: "an order without an expiry is a permanent one."
 *              Mandatory; verifyAssertion refuses an assertion missing either this or scope
 *              before it ever runs the signature check.
 *   nonce      Random. Makes two assertions with identical issuer/subject/scope/window
 *              distinguishable, so a byte-for-byte replay is at least detectable if the
 *              verifier chooses to track seen nonces. Does NOT by itself stop replay within
 *              the validity window on a purely offline verifier -- see FAILURE MODES in the
 *              SEG return document; that gap is stated, not hidden.
 *   signature  signFrame(canonicalAssertionString(...), issuerPrivateKeyHex), stored as just
 *              the 128-hex-char suffix (the canonical string itself is reconstructed by the
 *              verifier from the other fields, never re-transmitted redundantly inside
 *              `signature`).
 */
export interface SignedAssertion {
  issuer: string;
  subject: string;
  scope: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  signature: string;
}

export type UnsignedAssertion = Omit<SignedAssertion, 'signature'>;

/**
 * Deterministic canonical string bound by the signature. Same reasoning and same field-order
 * discipline as canonicalManifestEntryString()/canonicalRotationString() in
 * auto_update_scheduler.ts: a fixed separator and field order so signer and verifier always
 * hash identical bytes, and every field the signature must protect is bound in -- none of
 * issuer, subject, scope, issuedAt, expiresAt, or nonce can be altered post-signature without
 * invalidating it.
 */
export function canonicalAssertionString(a: UnsignedAssertion): string {
  return `${a.issuer}:${a.subject}:${a.scope}:${a.issuedAt}:${a.expiresAt}:${a.nonce}`;
}

export interface IssueParams {
  issuer: string;
  subject: string;
  scope: string;
  ttlSeconds: number;
  issuerPrivateKeyHex: string;
  nonce?: string;
  /** Override for issuedAt; defaults to now. Tests only -- production callers omit this. */
  issuedAtMs?: number;
}

/**
 * Issue a signed assertion. This is the ONE issuance path for both faces of the primitive:
 * a Founder Signed Order (issuer='lb-root-2026-01' or a delegated ops key, subject='M3',
 * scope='approve-major-version-update') and a Member Stamp (issuer=the member's own stamp
 * keyId, subject=the member's user_id, scope='membership-active'). Reuses signFrame() exactly
 * as-is -- no new crypto call anywhere in this function.
 */
export function issueAssertion(params: IssueParams): SignedAssertion {
  if (!params.scope) throw new Error('issueAssertion: scope is mandatory (an order without a scope is a blank check)');
  if (!params.ttlSeconds || params.ttlSeconds <= 0) {
    throw new Error('issueAssertion: ttlSeconds is mandatory and must be > 0 (an order without an expiry is a permanent one)');
  }
  const issuedAtMs = params.issuedAtMs ?? Date.now();
  const unsigned: UnsignedAssertion = {
    issuer: params.issuer,
    subject: params.subject,
    scope: params.scope,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(issuedAtMs + params.ttlSeconds * 1000).toISOString(),
    nonce: params.nonce ?? randomBytes(16).toString('hex'),
  };
  const canonical = canonicalAssertionString(unsigned);
  const signedCanonical = signFrame(canonical, params.issuerPrivateKeyHex);
  const signature = signedCanonical.slice(-SIG_HEX_LEN);
  return { ...unsigned, signature };
}

export interface VerifyOptions {
  /** If set, the assertion's scope must match this exactly or verification fails. */
  requiredScope?: string;
  /** Clock override for deterministic tests; defaults to Date.now(). */
  nowMs?: number;
  /** Tolerance applied on both sides of the issuedAt/expiresAt window. Default 0 (no tolerance
   *  -- callers crossing real machine clocks should pass an explicit value; see FAILURE MODES
   *  in the SEG return document for why this is not silently defaulted to something nonzero). */
  clockSkewToleranceSeconds?: number;
}

export interface VerifyResult {
  valid: boolean;
  reason: string;
}

/**
 * Verify a signed assertion against ONLY the issuer's public key. No network call, no database
 * lookup -- this is what makes a member stamp checkable offline at a scan point, and what makes
 * a Founder order checkable at BishopM3 (or any hop) directly against the root public key
 * instead of trusting whoever relayed the order. Reuses verifyFrame() exactly as-is.
 *
 * Order of checks matters and is deliberate: scope/expiry presence is checked BEFORE the
 * signature so a malformed assertion is rejected uniformly regardless of whether it happens to
 * carry a valid signature over garbage fields; the signature is checked before the time window
 * so an attacker cannot use timing of the rejection reason to learn anything about a forged
 * signature's proximity to validity.
 */
export function verifyAssertion(
  a: SignedAssertion,
  issuerPublicKeyHex: string,
  opts: VerifyOptions = {},
): VerifyResult {
  if (!a || typeof a !== 'object') return { valid: false, reason: 'not an assertion object' };
  if (!a.scope) return { valid: false, reason: 'no scope -- refused (an order without a scope is a blank check)' };
  if (!a.expiresAt) return { valid: false, reason: 'no expiry -- refused (an order without an expiry is a permanent one)' };
  if (!a.signature || a.signature.length !== SIG_HEX_LEN) {
    return { valid: false, reason: `signature missing or wrong length (expected ${SIG_HEX_LEN} hex chars)` };
  }

  const canonical = canonicalAssertionString(a);
  const check = verifyFrame(canonical + a.signature, issuerPublicKeyHex);
  if (!check.valid || check.frameHex !== canonical) {
    return { valid: false, reason: 'signature verification failed (bad signature, tampered assertion, or wrong key)' };
  }

  const issuedAtMs = Date.parse(a.issuedAt);
  const expiresAtMs = Date.parse(a.expiresAt);
  if (Number.isNaN(issuedAtMs) || Number.isNaN(expiresAtMs)) {
    return { valid: false, reason: 'signature valid but issuedAt/expiresAt failed to parse as timestamps' };
  }

  const now = opts.nowMs ?? Date.now();
  const skewMs = (opts.clockSkewToleranceSeconds ?? 0) * 1000;

  if (now > expiresAtMs + skewMs) {
    return { valid: false, reason: `signature valid but assertion expired at ${a.expiresAt}` };
  }
  if (now < issuedAtMs - skewMs) {
    return { valid: false, reason: `signature valid but issuedAt ${a.issuedAt} is in the future beyond clock-skew tolerance` };
  }
  if (opts.requiredScope !== undefined && opts.requiredScope !== a.scope) {
    return {
      valid: false,
      reason: `signature and expiry valid but scope mismatch: assertion grants '${a.scope}', action required '${opts.requiredScope}'`,
    };
  }

  return { valid: true, reason: 'signature, scope, and expiry all verified' };
}
