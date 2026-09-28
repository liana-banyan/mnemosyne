// enroll_by_code.test.ts -- D-BP223-X043-007 (c). OFFLINE: no network, no Electron, no real keys,
// no real registry. The founder-code-verify edge function is replaced by a local fake that checks a
// fixed code and signs receipts with a throwaway "attest" key, exactly in the edge function's format.
//
// Run: npx vitest run src/main/thorax/enroll_by_code.test.ts

import { describe, test, expect } from 'vitest';
import { generateKeyPairSync, createPrivateKey, sign as edSign, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { derivePeerIdFromPublicKey } from './enroll_peer_order';
import { lookupEnrolledPeerPublicKey } from './peer_enrollment_registry';
import {
  ENROLL_CODE_PREFIX,
  buildEnrollmentCode,
  parseAndVerifyEnrollmentCode,
  makeEnrollOrder,
  canonicalReceiptString,
  verifyFounderReceipt,
  type FounderCodeReceipt,
} from './enroll_by_code';
import { createEnrollByCodeService, type EnrollByCodeDeps } from './enroll_by_code_ipc';
import {
  deriveRelayX25519FromEd25519,
  signRelayX25519Announcement,
  verifyRelayX25519Announcement,
} from '../federation/relay_x25519';

function edPair(): { pub: string; priv: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return { pub: (publicKey as Buffer).toString('hex'), priv: (privateKey as Buffer).toString('hex') };
}
function signHex(privPkcs8Hex: string, msg: string): string {
  return edSign(null, Buffer.from(msg, 'utf8'), createPrivateKey({ key: Buffer.from(privPkcs8Hex, 'hex'), format: 'der', type: 'pkcs8' })).toString('hex');
}

const ATTEST = edPair();
const GOOD_CODE = '314159';

/** Local stand-in for founder-code-verify: same receipt format, same canonical string, one burn per code. */
function fakeFounderVerify(attestPriv = ATTEST.priv) {
  const burned = new Set<string>();
  const calls: Array<Record<string, string>> = [];
  const fn: EnrollByCodeDeps['requestFounderReceipt'] = async (body) => {
    calls.push(body);
    const base = { order_hash: body.order_hash, code_window: 1234, custody: 'seed-off-machine', verified_at: new Date().toISOString() };
    if (body.code !== GOOD_CODE) return { ...base, passed: false, code_commitment: '', rejection_reason: 'no window within +/-1 matched' };
    if (burned.has(body.code)) return { ...base, passed: false, code_commitment: '', rejection_reason: 'that code was already used' };
    burned.add(body.code);
    const r: FounderCodeReceipt = { ...base, passed: true, code_commitment: createHash('sha256').update(`${body.code}|1234`).digest('hex') };
    r.attestation = signHex(attestPriv, canonicalReceiptString(r));
    return r;
  };
  return { fn, calls };
}

interface Machine { peerId: string; label: string; id: { pub: string; priv: string }; thorax: { pub: string; priv: string }; registry: string }

function machine(label: string): Machine {
  const id = edPair();
  const thorax = edPair();
  const dir = mkdtempSync(join(tmpdir(), 'enroll-by-code-'));
  return { peerId: derivePeerIdFromPublicKey(id.pub), label, id, thorax, registry: join(dir, 'peer_enrollment_registry.json') };
}

function service(m: Machine, verify: EnrollByCodeDeps['requestFounderReceipt'], attestPub = ATTEST.pub) {
  return createEnrollByCodeService({
    selfPeerId: () => m.peerId,
    label: () => m.label,
    identityPublicSpkiHex: () => m.id.pub,
    signWithIdentity: (msg) => signHex(m.id.priv, msg),
    thoraxPublicSpkiHex: () => m.thorax.pub,
    signWithThorax: (msg) => signHex(m.thorax.priv, msg),
    registryPath: () => m.registry,
    attestPublicKeySpkiHex: () => attestPub,
    requestFounderReceipt: verify,
  });
}

function codeFor(m: Machine, nowUnixSeconds?: number): string {
  return buildEnrollmentCode({
    peerId: m.peerId, label: m.label, identitySpkiHex: m.id.pub, thoraxSpkiHex: m.thorax.pub,
    signWithIdentity: (msg) => signHex(m.id.priv, msg), signWithThorax: (msg) => signHex(m.thorax.priv, msg),
    nowUnixSeconds,
  });
}

/** Decode, edit and re-encode a code's JSON payload (to simulate tampering). */
function tamper(code: string, edit: (o: Record<string, unknown>) => void): string {
  const body = code.slice(ENROLL_CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  const o = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as Record<string, unknown>;
  edit(o);
  return ENROLL_CODE_PREFIX + Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('enroll by code: the full two-machine flow', () => {
  test('A shows a code, B pastes it with the authenticator code, then the reverse; each registry holds the other\'s THORAX key', async () => {
    const A = machine('LIANABANYAN');
    const B = machine('LAPTOP');
    const verify = fakeFounderVerify();

    const aCode = service(A, verify.fn).getMyCode();
    expect(aCode.ok).toBe(true);
    if (!aCode.ok) return;
    expect(aCode.code.startsWith(ENROLL_CODE_PREFIX)).toBe(true);
    // About 485 characters with a hostname label: long for typing, fine for copy and paste.
    expect(aCode.code.length).toBeLessThan(520);
    expect(aCode.code).not.toContain(A.id.priv);
    expect(aCode.code).not.toContain(A.thorax.priv);

    const pv = service(B, verify.fn).preview(aCode.code);
    expect(pv.ok && pv.peerId).toBe(A.peerId);
    expect(pv.ok && pv.label).toBe('LIANABANYAN');

    const onB = await service(B, verify.fn).submit({ code: aCode.code, authCode: GOOD_CODE });
    expect(onB).toEqual({ ok: true, peerId: A.peerId, label: 'LIANABANYAN' });
    expect(lookupEnrolledPeerPublicKey(B.registry, A.peerId)).toBe(A.thorax.pub);
    expect(lookupEnrolledPeerPublicKey(B.registry, A.peerId)).not.toBe(A.id.pub);

    // The code went to the authenticator check bound to an order naming B as issuer and A as subject.
    expect(verify.calls[0]).toMatchObject({ issuer: B.peerId, subject: A.peerId, scope: 'enroll-peer', code: GOOD_CODE });

    // Reverse direction, a new authenticator code (one code, one enrollment).
    const verify2 = fakeFounderVerify();
    const bCode = service(B, verify2.fn).getMyCode();
    if (!bCode.ok) throw new Error(bCode.error);
    const onA = await service(A, verify2.fn).submit({ code: bCode.code, authCode: GOOD_CODE });
    expect(onA.ok).toBe(true);
    expect(lookupEnrolledPeerPublicKey(A.registry, B.peerId)).toBe(B.thorax.pub);

    expect(service(B, verify.fn).list().peers.map((p) => [p.peerId, p.label])).toEqual([[A.peerId, 'LIANABANYAN']]);
  });

  test('after enrollment the relay fix trusts the other machine\'s signed X25519 key (and would not with the identity key)', async () => {
    const A = machine('A');
    const B = machine('B');
    const verify = fakeFounderVerify();
    const aCode = service(A, verify.fn).getMyCode();
    if (!aCode.ok) throw new Error(aCode.error);
    expect((await service(B, verify.fn).submit({ code: aCode.code, authCode: GOOD_CODE })).ok).toBe(true);

    // What A publishes in presence (relay_v2_transport.buildPresenceRelayX25519Field): signed by A's Thorax key.
    const aRelay = deriveRelayX25519FromEd25519(A.thorax.priv);
    const ann = signRelayX25519Announcement(A.peerId, aRelay.publicKeyHex, A.thorax.priv);
    const trusted = lookupEnrolledPeerPublicKey(B.registry, A.peerId)!;
    expect(verifyRelayX25519Announcement(ann, A.peerId, trusted).ok).toBe(true);
    // The old records enrolled the identity key; that key cannot verify the relay announcement.
    expect(verifyRelayX25519Announcement(ann, A.peerId, A.id.pub).ok).toBe(false);
  });

  test('the registry write keeps a Rule 66 sibling when a registry already exists', async () => {
    const A = machine('A'); const B = machine('B'); const C = machine('C');
    const v1 = fakeFounderVerify(); const v2 = fakeFounderVerify();
    const aCode = service(A, v1.fn).getMyCode(); const cCode = service(C, v2.fn).getMyCode();
    if (!aCode.ok || !cCode.ok) throw new Error('code');
    expect((await service(B, v1.fn).submit({ code: aCode.code, authCode: GOOD_CODE })).ok).toBe(true);
    expect((await service(B, v2.fn).submit({ code: cCode.code, authCode: GOOD_CODE })).ok).toBe(true);
    expect(readdirSync(dirname(B.registry)).some((f) => /peer_enrollment_registry\.superseded\.\d{8}T\d{6}Z\.json$/.test(f))).toBe(true);
    expect(Object.keys(JSON.parse(readFileSync(B.registry, 'utf8'))).sort()).toEqual([A.peerId, C.peerId].sort());
  });
});

describe('enroll by code: refusals (nothing is written)', () => {
  test('wrong authenticator code: refused by the check, registry untouched', async () => {
    const A = machine('A'); const B = machine('B'); const v = fakeFounderVerify();
    const aCode = service(A, v.fn).getMyCode(); if (!aCode.ok) throw new Error(aCode.error);
    const r = await service(B, v.fn).submit({ code: aCode.code, authCode: '000000' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/authenticator code refused/);
    expect(existsSync(B.registry)).toBe(false);
  });

  test('an authenticator code that is not 6 digits never reaches the check', async () => {
    const A = machine('A'); const B = machine('B'); const v = fakeFounderVerify();
    const aCode = service(A, v.fn).getMyCode(); if (!aCode.ok) throw new Error(aCode.error);
    expect((await service(B, v.fn).submit({ code: aCode.code, authCode: '12345' })).ok).toBe(false);
    expect(v.calls).toHaveLength(0);
  });

  test('tampered enrollment codes are refused before any network call', async () => {
    const A = machine('A'); const B = machine('B'); const EVIL = machine('EVIL'); const v = fakeFounderVerify();
    const aCode = service(A, v.fn).getMyCode(); if (!aCode.ok) throw new Error(aCode.error);
    const evilThoraxRaw = Buffer.from(EVIL.thorax.pub.slice(24), 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const cases = [
      tamper(aCode.code, (o) => { o.l = 'RENAMED'; }),
      tamper(aCode.code, (o) => { o.t = evilThoraxRaw; }),
      tamper(aCode.code, (o) => { o.p = 'ffffffffffffffff'; }),
      aCode.code.slice(0, -10),
      'hello',
    ];
    for (const c of cases) {
      const r = await service(B, v.fn).submit({ code: c, authCode: GOOD_CODE });
      expect(r.ok).toBe(false);
    }
    expect(v.calls).toHaveLength(0);
    expect(existsSync(B.registry)).toBe(false);
  });

  test('a swapped Thorax key is refused even when the identity signature is genuine (Thorax possession is checked too)', () => {
    const A = machine('A'); const EVIL = machine('EVIL');
    const forged = buildEnrollmentCode({
      peerId: A.peerId, label: 'A', identitySpkiHex: A.id.pub, thoraxSpkiHex: EVIL.thorax.pub,
      signWithIdentity: (m) => signHex(A.id.priv, m), signWithThorax: (m) => signHex(A.thorax.priv, m),
    });
    expect(parseAndVerifyEnrollmentCode(forged).ok).toBe(false);
  });

  test('an expired code and this machine\'s own code are refused', async () => {
    const A = machine('A'); const B = machine('B'); const v = fakeFounderVerify();
    const old = codeFor(A, Math.floor(Date.now() / 1000) - 25 * 3600);
    expect((await service(B, v.fn).submit({ code: old, authCode: GOOD_CODE })).ok).toBe(false);
    const own = service(B, v.fn).getMyCode(); if (!own.ok) throw new Error(own.error);
    const r = await service(B, v.fn).submit({ code: own.code, authCode: GOOD_CODE });
    expect(!r.ok && r.error).toMatch(/own code/);
    expect(v.calls).toHaveLength(0);
  });

  test('a receipt signed by a key other than lb-attest is refused', async () => {
    const A = machine('A'); const B = machine('B'); const ROGUE = edPair();
    const v = fakeFounderVerify(ROGUE.priv);
    const aCode = service(A, v.fn).getMyCode(); if (!aCode.ok) throw new Error(aCode.error);
    const r = await service(B, v.fn).submit({ code: aCode.code, authCode: GOOD_CODE });
    expect(!r.ok && r.error).toMatch(/does not verify under lb-attest/);
    expect(existsSync(B.registry)).toBe(false);
  });

  test('a genuine receipt for a DIFFERENT order cannot be reused', () => {
    const A = machine('A'); const B = machine('B');
    const parsed = parseAndVerifyEnrollmentCode(codeFor(A)); if (!parsed.ok) throw new Error(parsed.reason);
    const order1 = makeEnrollOrder(B.peerId, parsed.code);
    const order2 = makeEnrollOrder(B.peerId, parsed.code);
    const r: FounderCodeReceipt = { passed: true, order_hash: order1.order_hash, code_window: 1, code_commitment: 'a'.repeat(64), custody: 'seed-off-machine', verified_at: new Date().toISOString() };
    r.attestation = signHex(ATTEST.priv, canonicalReceiptString(r));
    expect(verifyFounderReceipt(r, order1, ATTEST.pub).ok).toBe(true);
    expect(verifyFounderReceipt(r, order2, ATTEST.pub).ok).toBe(false);
  });

  test('a stale receipt and a tampered receipt are refused', () => {
    const A = machine('A'); const B = machine('B');
    const parsed = parseAndVerifyEnrollmentCode(codeFor(A)); if (!parsed.ok) throw new Error(parsed.reason);
    const order = makeEnrollOrder(B.peerId, parsed.code);
    const r: FounderCodeReceipt = { passed: true, order_hash: order.order_hash, code_window: 1, code_commitment: 'a'.repeat(64), custody: 'seed-off-machine', verified_at: new Date(Date.now() - 3600_000).toISOString() };
    r.attestation = signHex(ATTEST.priv, canonicalReceiptString(r));
    expect(verifyFounderReceipt(r, order, ATTEST.pub).ok).toBe(false);
    const fresh: FounderCodeReceipt = { ...r, verified_at: new Date().toISOString() };
    fresh.attestation = signHex(ATTEST.priv, canonicalReceiptString(fresh));
    expect(verifyFounderReceipt(fresh, order, ATTEST.pub).ok).toBe(true);
    expect(verifyFounderReceipt({ ...fresh, code_window: 2 }, order, ATTEST.pub).ok).toBe(false);
    expect(verifyFounderReceipt({ ...fresh, custody: 'seed-on-this-machine' }, order, ATTEST.pub).ok).toBe(false);
  });

  test('the authenticator check being unreachable is a clean refusal', async () => {
    const A = machine('A'); const B = machine('B');
    const aCode = service(A, fakeFounderVerify().fn).getMyCode(); if (!aCode.ok) throw new Error(aCode.error);
    const r = await service(B, async () => { throw new Error('ECONNREFUSED'); }).submit({ code: aCode.code, authCode: GOOD_CODE });
    expect(!r.ok && r.error).toMatch(/could not reach the authenticator check/);
    expect(existsSync(B.registry)).toBe(false);
  });

  test('a machine whose identity key does not derive its peer id cannot make a code', () => {
    const A = machine('A');
    const bad = createEnrollByCodeService({
      selfPeerId: () => '0000000000000000', label: () => 'A', identityPublicSpkiHex: () => A.id.pub,
      signWithIdentity: (m) => signHex(A.id.priv, m), thoraxPublicSpkiHex: () => A.thorax.pub,
      signWithThorax: (m) => signHex(A.thorax.priv, m), registryPath: () => A.registry,
      attestPublicKeySpkiHex: () => ATTEST.pub, requestFounderReceipt: async () => ({}),
    });
    expect(bad.getMyCode().ok).toBe(false);
  });
});
