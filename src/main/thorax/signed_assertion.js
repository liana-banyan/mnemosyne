/**
 * signed_assertion.js -- D-BP165-M0-027. Plain-Node CommonJS port of signed_assertion.ts.
 *
 * LAW 4 CHECK PERFORMED before writing this file: signed_assertion.ts and signed_assertion.test.ts
 * were both read in full this dispatch. signed_assertion.ts is the source of truth and is NOT
 * duplicated logic here -- it is an ES-module TypeScript file (`export function ...`) that cannot
 * be `require()`d by a plain `node conduit_server.js` process with no ts-node/build step in its run
 * path (conduit_server.js's own header states "no external dependencies, no build step"). This file
 * is a byte-faithful TRANSPILE of signed_assertion.ts, following the exact precedent already set by
 * sign_verify.js sitting next to sign_verify.ts in this same directory (that pair was inspected
 * before this port was made, and is byte-identical logic, TS types dropped). No new cryptographic
 * behavior, no new design -- same primitive, same file, second runtime.
 *
 * Reuses sign_verify.js (the sibling plain-JS port already present in this directory) exactly as
 * signed_assertion.ts reuses sign_verify.ts -- signFrame()/verifyFrame() UNCHANGED.
 *
 * Canon ref: D-BP158-010/BISHOP/seg-signed-order-member-stamp, BP158. Ported for D-BP165-M0-027.
 */
'use strict';

const { randomBytes } = require('node:crypto');
const { signFrame, verifyFrame, SIG_HEX_LEN } = require('./sign_verify.js');

/**
 * Deterministic canonical string bound by the signature. Same reasoning and same field-order
 * discipline as canonicalManifestEntryString()/canonicalRotationString() in
 * auto_update_scheduler.ts: a fixed separator and field order so signer and verifier always
 * hash identical bytes, and every field the signature must protect is bound in -- none of
 * issuer, subject, scope, issuedAt, expiresAt, or nonce can be altered post-signature without
 * invalidating it.
 */
function canonicalAssertionString(a) {
  return `${a.issuer}:${a.subject}:${a.scope}:${a.issuedAt}:${a.expiresAt}:${a.nonce}`;
}

/**
 * Issue a signed assertion. This is the ONE issuance path for both faces of the primitive:
 * a Founder Signed Order (issuer='lb-root-2026-01' or a delegated ops key, subject='M3',
 * scope='approve-major-version-update') and a Member Stamp (issuer=the member's own stamp
 * keyId, subject=the member's user_id, scope='membership-active'). Reuses signFrame() exactly
 * as-is -- no new crypto call anywhere in this function.
 *
 * params: { issuer, subject, scope, ttlSeconds, issuerPrivateKeyHex, nonce?, issuedAtMs? }
 */
function issueAssertion(params) {
  if (!params.scope) throw new Error('issueAssertion: scope is mandatory (an order without a scope is a blank check)');
  if (!params.ttlSeconds || params.ttlSeconds <= 0) {
    throw new Error('issueAssertion: ttlSeconds is mandatory and must be > 0 (an order without an expiry is a permanent one)');
  }
  const issuedAtMs = params.issuedAtMs ?? Date.now();
  const unsigned = {
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
 *
 * opts: { requiredScope?, nowMs?, clockSkewToleranceSeconds? }
 */
function verifyAssertion(a, issuerPublicKeyHex, opts) {
  opts = opts || {};
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

module.exports = { canonicalAssertionString, issueAssertion, verifyAssertion };
