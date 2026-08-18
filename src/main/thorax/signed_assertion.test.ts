// signed_assertion.test.ts -- D-BP158-010 proof: issue-then-verify round trip, and a
// deliberately tampered assertion that MUST fail verification. Uses a freshly generated
// EPHEMERAL test Ed25519 keypair (generateKeyPairSync, same call getOrCreateKeypair() and
// auto_update_scheduler.trust_root.test.ts already use for test fixtures) -- never the real
// lb-root-2026-01 keypair at C:\Users\Administrator\.lb-root-keys\, which this file never
// opens, reads, or references by content, only by path in comments.

import { describe, test, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { issueAssertion, verifyAssertion, canonicalAssertionString } from './signed_assertion';

const testKeypair = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
const publicKeyHex = (testKeypair.publicKey as Buffer).toString('hex');
const privateKeyHex = (testKeypair.privateKey as Buffer).toString('hex');

const otherKeypair = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
const otherPublicKeyHex = (otherKeypair.publicKey as Buffer).toString('hex');

describe('D-BP158-010 -- Founder Order / Member Stamp round trip', () => {
  test('Face (a): a Founder order issued for M3, verified with only the public key', () => {
    const order = issueAssertion({
      issuer: 'lb-root-2026-01',
      subject: 'M3',
      scope: 'approve-major-version-update:v0.9.26',
      ttlSeconds: 3600,
      issuerPrivateKeyHex: privateKeyHex,
    });
    const result = verifyAssertion(order, publicKeyHex, {
      requiredScope: 'approve-major-version-update:v0.9.26',
    });
    expect(result).toEqual({ valid: true, reason: 'signature, scope, and expiry all verified' });
  });

  test('Face (b): a member stamp, verified offline with only the public key', () => {
    const stamp = issueAssertion({
      issuer: 'stamp:ST-2608-A7B3',
      subject: 'user_9f2e...',
      scope: 'membership-active',
      ttlSeconds: 60 * 60 * 24 * 30,
      issuerPrivateKeyHex: privateKeyHex,
    });
    const result = verifyAssertion(stamp, publicKeyHex, { requiredScope: 'membership-active' });
    expect(result.valid).toBe(true);
  });

  test('TAMPER: scope widened after signing MUST fail verification', () => {
    const order = issueAssertion({
      issuer: 'lb-root-2026-01',
      subject: 'M3',
      scope: 'approve-major-version-update:v0.9.26',
      ttlSeconds: 3600,
      issuerPrivateKeyHex: privateKeyHex,
    });
    const tampered = { ...order, scope: 'full-shell-access' };
    const result = verifyAssertion(tampered, publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/signature verification failed/);
  });

  test('TAMPER: subject swapped after signing MUST fail verification', () => {
    const order = issueAssertion({
      issuer: 'lb-root-2026-01',
      subject: 'M3',
      scope: 'approve-major-version-update:v0.9.26',
      ttlSeconds: 3600,
      issuerPrivateKeyHex: privateKeyHex,
    });
    const tampered = { ...order, subject: 'M0' };
    expect(verifyAssertion(tampered, publicKeyHex).valid).toBe(false);
  });

  test('TAMPER: expiry extended after signing MUST fail verification', () => {
    const order = issueAssertion({
      issuer: 'lb-root-2026-01',
      subject: 'M3',
      scope: 'approve-major-version-update:v0.9.26',
      ttlSeconds: 1,
      issuerPrivateKeyHex: privateKeyHex,
    });
    const farFuture = new Date(Date.now() + 1e12).toISOString();
    const tampered = { ...order, expiresAt: farFuture };
    expect(verifyAssertion(tampered, publicKeyHex).valid).toBe(false);
  });

  test('wrong public key (different issuer keypair) MUST fail verification', () => {
    const order = issueAssertion({
      issuer: 'lb-root-2026-01',
      subject: 'M3',
      scope: 'approve-major-version-update:v0.9.26',
      ttlSeconds: 3600,
      issuerPrivateKeyHex: privateKeyHex,
    });
    expect(verifyAssertion(order, otherPublicKeyHex).valid).toBe(false);
  });

  test('expired assertion (no clock-skew tolerance) is refused even with a perfectly valid signature', () => {
    const order = issueAssertion({
      issuer: 'lb-root-2026-01',
      subject: 'M3',
      scope: 'approve-major-version-update:v0.9.26',
      ttlSeconds: 60,
      issuerPrivateKeyHex: privateKeyHex,
      issuedAtMs: Date.now() - 1000 * 3600, // issued an hour ago, 60s TTL -> long expired
    });
    const result = verifyAssertion(order, publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/);
  });

  test('missing scope is refused before signature is even checked (blank-check refusal)', () => {
    const order = issueAssertion({
      issuer: 'lb-root-2026-01',
      subject: 'M3',
      scope: 'x',
      ttlSeconds: 3600,
      issuerPrivateKeyHex: privateKeyHex,
    });
    const blank = { ...order, scope: '' };
    expect(verifyAssertion(blank, publicKeyHex)).toEqual({
      valid: false,
      reason: 'no scope -- refused (an order without a scope is a blank check)',
    });
  });

  test('issueAssertion refuses to issue without a scope or ttl (fails at authoring time, not just verify time)', () => {
    expect(() => issueAssertion({
      issuer: 'lb-root-2026-01', subject: 'M3', scope: '', ttlSeconds: 3600, issuerPrivateKeyHex: privateKeyHex,
    })).toThrow(/scope is mandatory/);
    expect(() => issueAssertion({
      issuer: 'lb-root-2026-01', subject: 'M3', scope: 'x', ttlSeconds: 0, issuerPrivateKeyHex: privateKeyHex,
    })).toThrow(/ttlSeconds is mandatory/);
  });

  test('canonicalAssertionString is deterministic and field-order-bound (same reasoning as canonicalManifestEntryString)', () => {
    const a = { issuer: 'i', subject: 's', scope: 'sc', issuedAt: 't1', expiresAt: 't2', nonce: 'n' };
    expect(canonicalAssertionString(a)).toBe('i:s:sc:t1:t2:n');
  });
});
