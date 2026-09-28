// car_capsule_access_gate.test.ts -- D-BP223-BM0-X015-007-CARWIRE
// (redispatched, unwedged, as D-BP223-BM04-X015S3-R007 by BM04)
//
// Proves BOUNTY_POSTER_CAR_CAPSULE_ACCESS_ROSTER_BP210.md CONDITION 3 (TESTED) for the
// catacombs:fetch-package gate: a positive case (a validly badged request is allowed) AND a
// negative case (an unbadged or otherwise-bad request is refused), both actually run, with
// `console.log` of the real badge object / real refusal reason on every case so the printed
// output (captured to a timestamped artifact alongside this run) shows more than an exit code --
// exactly what BP164's own documented failure (97 minutes, exit 0, zero real answers) says not
// to settle for.
//
// This suite mints REAL orders through the REAL, unmodified issueGatedOrder()/verifyGatedOrder()
// in gated_order.ts (unlike enroll_peer_order.test.ts's "mintCorrectedGatedOrder" workaround --
// that file's documented signature-slice defect is CONFIRMED FIXED on this disk as of this
// dispatch: `git diff -- src/main/thorax/gated_order.ts` shows both slices already corrected to
// `.slice(-SIG_HEX_LEN)`/`canonicalGatedOrder(order) + order.signature`. This suite mints through
// the real, current code specifically so a regression of that fix would show up here as a broken
// positive case, not get silently worked around a second time).
//
// Every keypair and TOTP seed here is freshly generated with generateKeyPairSync()/randomBytes(),
// matching enroll_peer_order.test.ts's and mesh_eblet_gate.test.ts's own ephemeral-fixture
// convention. NEVER the real Founder TOTP seed, NEVER <userData>\thorax_ed25519.json.
//
// Run: npx vitest run src/main/thorax/car_capsule_access_gate.test.ts

import { describe, test, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  issueGatedOrder,
  InMemoryBurnStoreNotDurable,
  commitToCode,
  type GatedOrder,
} from './gated_order';
import { windowFor } from './founder_totp';
import { checkCapsuleAccessBadge, CAR_CAPSULE_ACCESS_SCOPE } from './car_capsule_access_gate';

// D-BP223-X044-003-ONE-SEED (2026-09-28): issueGatedOrder() no longer accepts a raw code or a
// seed -- it takes an ALREADY-VERIFIED codeCommitment/codeWindow, exactly as a real caller would
// get from a founder-code-verify receipt. These tests mint that pair directly with
// commitToCode()/windowFor() (the same primitives gated_order.ts itself uses) rather than
// simulating the TOTP arithmetic, since that arithmetic no longer lives in this module at all.

function ephemeralKeypair(): { publicKeyHex: string; privateKeyHex: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKeyHex: (publicKey as Buffer).toString('hex'),
    privateKeyHex: (privateKey as Buffer).toString('hex'),
  };
}

describe('checkCapsuleAccessBadge -- C.A.R. gate in front of catacombs:fetch-package', () => {
  const root = ephemeralKeypair();
  const now = Math.floor(Date.parse('2026-09-13T05:00:00Z') / 1000);
  const codeWindow = windowFor(now);
  // Stands in for "an already-verified commitment from a founder-code-verify receipt" -- this
  // module never sees, generates, or checks a real code any more, so any 64-hex commitment
  // proves the same thing about THIS module's own logic.
  const codeCommitment = commitToCode('123456', codeWindow);

  test('POSITIVE: a validly minted, correctly-scoped, gated badge is ALLOWED', () => {
    const badge: GatedOrder = issueGatedOrder({
      issuer: 'root',
      subject: 'catacombs-package-fetch',
      scope: CAR_CAPSULE_ACCESS_SCOPE,
      ttlSeconds: 300,
      nonce: 'nonce-positive-001',
      privateKeyHex: root.privateKeyHex,
      codeCommitment,
      codeWindow,
      custody: 'seed-off-machine',
      nowUnixSeconds: now,
      burnStore: new InMemoryBurnStoreNotDurable(),
    });

    console.log('[POSITIVE CASE] minted badge object:', JSON.stringify(badge, null, 2));

    const result = checkCapsuleAccessBadge(badge, root.publicKeyHex, now);
    console.log('[POSITIVE CASE] checkCapsuleAccessBadge() result:', JSON.stringify(result, null, 2));

    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/authorized, gated by a code/);
  });

  test('NEGATIVE A: no badge at all is REFUSED', () => {
    const result = checkCapsuleAccessBadge(undefined, root.publicKeyHex, now);
    console.log('[NEGATIVE A: no badge] result:', JSON.stringify(result, null, 2));
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/no C\.A\.R\. badge supplied/);
  });

  test('NEGATIVE B: a badge with the wrong scope (ungated "dispatch-work") is REFUSED', () => {
    const badge: GatedOrder = issueGatedOrder({
      issuer: 'root',
      subject: 'catacombs-package-fetch',
      scope: 'dispatch-work',
      ttlSeconds: 300,
      nonce: 'nonce-negative-b-001',
      privateKeyHex: root.privateKeyHex,
      nowUnixSeconds: now,
      custody: 'seed-off-machine',
      // dispatch-work is not gate-required: no codeCommitment/burnStore needed to mint it, which
      // is exactly the case this test proves gets refused for THIS gate.
    });

    console.log('[NEGATIVE B: wrong scope] badge object:', JSON.stringify(badge, null, 2));
    const result = checkCapsuleAccessBadge(badge, root.publicKeyHex, now);
    console.log('[NEGATIVE B: wrong scope] result:', JSON.stringify(result, null, 2));

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/badge scope is "dispatch-work"/);
  });

  test('NEGATIVE C: a tampered badge (subject altered after signing) is REFUSED', () => {
    const badge: GatedOrder = issueGatedOrder({
      issuer: 'root',
      subject: 'catacombs-package-fetch',
      scope: CAR_CAPSULE_ACCESS_SCOPE,
      ttlSeconds: 300,
      nonce: 'nonce-negative-c-001',
      privateKeyHex: root.privateKeyHex,
      codeCommitment,
      codeWindow,
      custody: 'seed-off-machine',
      nowUnixSeconds: now,
      burnStore: new InMemoryBurnStoreNotDurable(),
    });
    const tampered: GatedOrder = { ...badge, subject: 'a-different-package-entirely' };

    console.log('[NEGATIVE C: tampered] original badge:', JSON.stringify(badge, null, 2));
    console.log('[NEGATIVE C: tampered] tampered badge:', JSON.stringify(tampered, null, 2));
    const result = checkCapsuleAccessBadge(tampered, root.publicKeyHex, now);
    console.log('[NEGATIVE C: tampered] result:', JSON.stringify(result, null, 2));

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/signature did not verify/);
  });

  test('NEGATIVE D: an EXPIRED badge is REFUSED', () => {
    const badge: GatedOrder = issueGatedOrder({
      issuer: 'root',
      subject: 'catacombs-package-fetch',
      scope: CAR_CAPSULE_ACCESS_SCOPE,
      ttlSeconds: 60,
      nonce: 'nonce-negative-d-001',
      privateKeyHex: root.privateKeyHex,
      codeCommitment,
      codeWindow,
      custody: 'seed-off-machine',
      nowUnixSeconds: now,
      burnStore: new InMemoryBurnStoreNotDurable(),
    });
    const wellAfterExpiry = now + 3600;

    console.log('[NEGATIVE D: expired] badge object:', JSON.stringify(badge, null, 2));
    const result = checkCapsuleAccessBadge(badge, root.publicKeyHex, wellAfterExpiry);
    console.log('[NEGATIVE D: expired] result at now+3600s:', JSON.stringify(result, null, 2));

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/expired at/);
  });

  test('NEGATIVE E: a badge signed by a DIFFERENT key than the one verified against is REFUSED', () => {
    const impostor = ephemeralKeypair();
    const badge: GatedOrder = issueGatedOrder({
      issuer: 'root',
      subject: 'catacombs-package-fetch',
      scope: CAR_CAPSULE_ACCESS_SCOPE,
      ttlSeconds: 300,
      nonce: 'nonce-negative-e-001',
      privateKeyHex: impostor.privateKeyHex, // signed by an impostor key, not root's
      codeCommitment,
      codeWindow,
      custody: 'seed-off-machine',
      nowUnixSeconds: now,
      burnStore: new InMemoryBurnStoreNotDurable(),
    });

    console.log('[NEGATIVE E: wrong key] badge object:', JSON.stringify(badge, null, 2));
    // Verified against root.publicKeyHex, NOT impostor's -- this is the real-world shape of the
    // check: index.ts always verifies against getOrCreateKeypair()'s OWN public key.
    const result = checkCapsuleAccessBadge(badge, root.publicKeyHex, now);
    console.log('[NEGATIVE E: wrong key] result:', JSON.stringify(result, null, 2));

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/signature did not verify/);
  });
});
