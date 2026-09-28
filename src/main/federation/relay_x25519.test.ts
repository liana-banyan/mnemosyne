// relay_x25519.test.ts -- D-BP223-X043-007-RELAY-X25519.
//
// OFFLINE. No network, no database, no real key files. Proves the v2 Thorax relay encryption:
//   1. two nodes derive the same key;
//   2. a third party holding ONLY public data (peer ids, published keys, announcements, the frame)
//      cannot decrypt, where the old v1 rule let it;
//   3. tampered ciphertext or header, a wrong recipient, a replayed message id and a stale frame
//      are refused;
//   4. a swapped public key without a valid signature is refused (presence row and inbound frame);
//   5. v1 is refused when the transition switch is off, and only read when it is on; the sender
//      never falls back to v1 unless relayV1SendFallback is on.
//
// Run: npx vitest run src/main/federation/relay_x25519.test.ts

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  deriveRelayX25519FromEd25519,
  deriveRelaySharedKey,
  generateRelayX25519Keypair,
  signRelayX25519Announcement,
  verifyRelayX25519Announcement,
  sealRelayV2,
  openRelayV2,
  MemoryReplayGuard,
  RelayCryptoError,
  type RelayX25519Keypair,
  type RelayX25519Announcement,
} from './relay_x25519';
import { encryptForRelayV1Legacy, decryptFromRelayV1Legacy } from './relay_v1_legacy';
import {
  openRelayPayload,
  resolveRecipientRelayKey,
  sealRelayPayloadForPeer,
  type LocalRelayIdentity,
} from './relay_v2_transport';

interface Node {
  peerId: string;
  edPub: string;
  edPriv: string;
  x: RelayX25519Keypair;
  ann: RelayX25519Announcement;
  local: LocalRelayIdentity;
}

function makeNode(peerId: string): Node {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  const edPub = (publicKey as Buffer).toString('hex');
  const edPriv = (privateKey as Buffer).toString('hex');
  const x = deriveRelayX25519FromEd25519(edPriv);
  const ann = signRelayX25519Announcement(peerId, x.publicKeyHex, edPriv);
  return { peerId, edPub, edPriv, x, ann, local: { peerId, keypair: x, announcement: ann, ed25519PublicHex: edPub } };
}

function seal(from: Node, to: Node, plaintext: string, extra: { nowMs?: number; messageId?: string } = {}): string {
  return sealRelayV2({
    plaintext,
    selfPeerId: from.peerId,
    selfKeypair: from.x,
    selfAnnouncement: from.ann,
    selfEd25519PublicHex: from.edPub,
    recipientPeerId: to.peerId,
    recipientX25519PubHex: to.x.publicKeyHex,
    ...extra,
  });
}

function open(frame: string, me: Node, opts: { trusted?: Record<string, string>; guard?: MemoryReplayGuard; nowMs?: number; selfPeerId?: string; keypair?: RelayX25519Keypair } = {}) {
  return openRelayV2({
    frameJson: frame,
    selfPeerId: opts.selfPeerId ?? me.peerId,
    selfKeypair: opts.keypair ?? me.x,
    resolveTrustedSenderEd25519: (id) => opts.trusted?.[id],
    replayGuard: opts.guard ?? new MemoryReplayGuard(),
    nowMs: opts.nowMs,
  });
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof RelayCryptoError ? err.code : `NON_RELAY_ERROR:${String(err)}`;
  }
  return 'NO_ERROR';
}

async function codeOfAsync(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return err instanceof RelayCryptoError ? err.code : `NON_RELAY_ERROR:${String(err)}`;
  }
  return 'NO_ERROR';
}

/** A fake peer_presence REST endpoint returning one row. */
function presenceFetch(row: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => (row ? [row] : []) })) as unknown as typeof fetch;
}

function settingsFile(obj: Record<string, unknown> | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'relay-x25519-test-'));
  const p = join(dir, 'relay_crypto_settings.json');
  if (obj) writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}

const A = makeNode('aaaa000000000001');
const B = makeNode('bbbb000000000002');

// ─── 1. Same key on both sides ────────────────────────────────────────────────────────────────

describe('v2 key agreement', () => {
  test('two nodes derive the same key', () => {
    const salt = Buffer.alloc(32, 7);
    const kAB = deriveRelaySharedKey(A.x.privateKey, B.x.publicKeyHex, A.peerId, B.peerId, salt);
    const kBA = deriveRelaySharedKey(B.x.privateKey, A.x.publicKeyHex, B.peerId, A.peerId, salt);
    expect(kAB.length).toBe(32);
    expect(kAB.equals(kBA)).toBe(true);
  });

  test('the X25519 key derived from an Ed25519 key is deterministic, and different nodes differ', () => {
    expect(deriveRelayX25519FromEd25519(A.edPriv).publicKeyHex).toBe(A.x.publicKeyHex);
    expect(A.x.publicKeyHex).not.toBe(B.x.publicKeyHex);
    expect(A.x.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
  });

  test('a sealed message opens on the recipient and round-trips exactly', () => {
    const msg = JSON.stringify({ kind: 'bishop_dispatch', dispatchId: 'D-BP223-M0-001', promptText: 'hello' });
    const frame = seal(A, B, msg);
    const r = open(frame, B, { trusted: { [A.peerId]: A.edPub } });
    expect(r.plaintext).toBe(msg);
    expect(r.from).toBe(A.peerId);
    expect(r.senderKeySource).toBe('trusted');
  });

  test('a sender with no enrolled key opens as self_declared (trust on first use is reported, not hidden)', () => {
    const r = open(seal(A, B, 'x'), B);
    expect(r.senderKeySource).toBe('self_declared');
  });

  test('the frame carries no plaintext and no private key material', () => {
    const frame = seal(A, B, 'TOP-SECRET-PROMPT');
    expect(frame).not.toContain('TOP-SECRET-PROMPT');
    expect(frame).not.toContain(A.edPriv);
    const parsed = JSON.parse(frame) as Record<string, unknown>;
    expect(parsed.v).toBe('v2');
    expect(Object.keys(parsed).sort()).toEqual(['alg', 'ct', 'from', 'iv', 'mid', 'salt', 'spk', 'spk_ed', 'tag', 'to', 'ts', 'v']);
  });
});

// ─── 2. Third party with only public data ─────────────────────────────────────────────────────

describe('a third party with only public data cannot decrypt', () => {
  test('knowing both peer ids, both published keys and the whole frame is not enough', () => {
    const C = makeNode('cccc000000000003');
    const frame = seal(A, B, 'secret dispatch');
    // C claims to be B (right peer id) but has only its own private key.
    expect(codeOf(() => open(frame, C, { selfPeerId: B.peerId }))).toBe('DECRYPT_FAILED');
    // A fresh random key does no better.
    expect(codeOf(() => open(frame, C, { selfPeerId: B.peerId, keypair: generateRelayX25519Keypair() }))).toBe('DECRYPT_FAILED');
  });

  test('the old v1 public-id key rule does not open a v2 frame', async () => {
    const frame = seal(A, B, 'secret dispatch');
    await expect(decryptFromRelayV1Legacy(frame, B.peerId)).rejects.toThrow();
  });

  test('CONTRAST: a v1 frame IS readable by anyone who knows the public peer id (the defect)', async () => {
    const v1 = await encryptForRelayV1Legacy('secret dispatch', B.peerId);
    // A stranger re-derives the key from the public id alone, with no private key at all.
    const key = createHash('sha256').update(`${B.peerId}:thorax-relay-v1`).digest();
    const { iv, ct } = JSON.parse(v1) as { iv: string; ct: string };
    const k = await globalThis.crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
    const pt = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') }, k, Buffer.from(ct, 'base64'),
    );
    expect(new TextDecoder().decode(pt)).toBe('secret dispatch');
  });
});

// ─── 3. Tamper, wrong recipient, replay ───────────────────────────────────────────────────────

describe('tampering, wrong recipient and replay are refused', () => {
  test('tampered ciphertext is refused', () => {
    const f = JSON.parse(seal(A, B, 'hello world payload')) as Record<string, string>;
    const ct = Buffer.from(f.ct, 'base64');
    ct[0] ^= 0x01;
    f.ct = ct.toString('base64');
    expect(codeOf(() => open(JSON.stringify(f), B))).toBe('DECRYPT_FAILED');
  });

  test('a tampered auth tag is refused', () => {
    const f = JSON.parse(seal(A, B, 'hello')) as Record<string, string>;
    const tag = Buffer.from(f.tag, 'base64');
    tag[3] ^= 0x80;
    f.tag = tag.toString('base64');
    expect(codeOf(() => open(JSON.stringify(f), B))).toBe('DECRYPT_FAILED');
  });

  test('a tampered header field bound in the associated data (message id) is refused', () => {
    const f = JSON.parse(seal(A, B, 'hello')) as Record<string, string>;
    f.mid = 'ffffffffffffffffffffffffffffffff';
    expect(codeOf(() => open(JSON.stringify(f), B))).toBe('DECRYPT_FAILED');
  });

  test('a frame for another recipient is refused by that other node', () => {
    const C = makeNode('cccc000000000003');
    expect(codeOf(() => open(seal(A, B, 'for B only'), C))).toBe('WRONG_RECIPIENT');
  });

  test('re-addressing a frame to yourself (editing "to") still fails authentication', () => {
    const C = makeNode('cccc000000000003');
    const f = JSON.parse(seal(A, B, 'for B only')) as Record<string, unknown>;
    f.to = C.peerId;
    expect(codeOf(() => open(JSON.stringify(f), C))).toBe('DECRYPT_FAILED');
  });

  test('a replayed message id is refused the second time', () => {
    const guard = new MemoryReplayGuard();
    const frame = seal(A, B, 'once');
    expect(open(frame, B, { guard }).plaintext).toBe('once');
    expect(codeOf(() => open(frame, B, { guard }))).toBe('REPLAY');
  });

  test('a garbage frame cannot burn a message id (replay memory is written only after authentication)', () => {
    const guard = new MemoryReplayGuard();
    const good = seal(A, B, 'real', { messageId: 'abcdabcdabcdabcdabcdabcdabcdabcd' });
    const bad = JSON.parse(good) as Record<string, string>;
    bad.ct = Buffer.from('garbage').toString('base64');
    expect(codeOf(() => open(JSON.stringify(bad), B, { guard }))).toBe('DECRYPT_FAILED');
    expect(open(good, B, { guard }).plaintext).toBe('real');
  });

  test('a stale frame (older than the window) and a far-future frame are refused', () => {
    const now = Date.now();
    expect(codeOf(() => open(seal(A, B, 'old', { nowMs: now - 11 * 60 * 1000 }), B, { nowMs: now }))).toBe('STALE');
    expect(codeOf(() => open(seal(A, B, 'future', { nowMs: now + 5 * 60 * 1000 }), B, { nowMs: now }))).toBe('FUTURE');
  });
});

// ─── 4. Swapped public keys ───────────────────────────────────────────────────────────────────

describe('a swapped public key without a valid signature is refused', () => {
  const EVIL = makeNode('eeee000000000009');

  test('announcement verification: right key passes, swapped x25519 key, wrong peer id and wrong signer fail', () => {
    expect(verifyRelayX25519Announcement(B.ann, B.peerId, B.edPub).ok).toBe(true);
    const swapped = { ...B.ann, x25519_pub: EVIL.x.publicKeyHex };
    expect(verifyRelayX25519Announcement(swapped, B.peerId, B.edPub).ok).toBe(false);
    expect(verifyRelayX25519Announcement(B.ann, 'some-other-peer', B.edPub).ok).toBe(false);
    expect(verifyRelayX25519Announcement(B.ann, B.peerId, EVIL.edPub).ok).toBe(false);
  });

  test('presence row with the x25519 key swapped but the old signature: sender refuses', async () => {
    const row = { peer_id: B.peerId, capabilities: { public_key_hex: B.edPub, relay_x25519: { ...B.ann, x25519_pub: EVIL.x.publicKeyHex } } };
    const r = await resolveRecipientRelayKey(B.peerId, {
      fetchImpl: presenceFetch(row), supabaseUrl: 'https://x.invalid', anonKey: 'a',
      resolveTrusted: (id) => (id === B.peerId ? B.edPub : undefined),
    });
    expect(r.ok).toBe(false);
  });

  test('presence row fully rewritten by an attacker (own Ed25519 AND own X25519, validly self-signed): refused for an enrolled recipient', async () => {
    const forgedAnn = signRelayX25519Announcement(B.peerId, EVIL.x.publicKeyHex, EVIL.edPriv);
    const row = { peer_id: B.peerId, capabilities: { public_key_hex: EVIL.edPub, relay_x25519: forgedAnn } };
    const r = await resolveRecipientRelayKey(B.peerId, {
      fetchImpl: presenceFetch(row), supabaseUrl: 'https://x.invalid', anonKey: 'a',
      resolveTrusted: (id) => (id === B.peerId ? B.edPub : undefined),
    });
    expect(r.ok).toBe(false);
  });

  test('the same forged row for a NOT enrolled recipient is refused while relayAllowPresenceTofu is off (the default)', async () => {
    const forgedAnn = signRelayX25519Announcement(B.peerId, EVIL.x.publicKeyHex, EVIL.edPriv);
    const row = { peer_id: B.peerId, capabilities: { public_key_hex: EVIL.edPub, relay_x25519: forgedAnn } };
    const r = await resolveRecipientRelayKey(B.peerId, {
      fetchImpl: presenceFetch(row), supabaseUrl: 'https://x.invalid', anonKey: 'a',
      resolveTrusted: () => undefined, settingsPath: settingsFile(null),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/relayAllowPresenceTofu is off/);
  });

  test('an honest, correctly signed row for an enrolled recipient resolves as trusted', async () => {
    const row = { peer_id: B.peerId, capabilities: { public_key_hex: B.edPub, relay_x25519: B.ann } };
    const r = await resolveRecipientRelayKey(B.peerId, {
      fetchImpl: presenceFetch(row), supabaseUrl: 'https://x.invalid', anonKey: 'a',
      resolveTrusted: (id) => (id === B.peerId ? B.edPub : undefined),
    });
    expect(r).toEqual({ ok: true, x25519PubHex: B.x.publicKeyHex, trust: 'trusted' });
  });

  test('inbound frame whose sender x25519 key was swapped (signature no longer matches): refused', () => {
    const f = JSON.parse(seal(A, B, 'hi')) as { spk: RelayX25519Announcement };
    f.spk = { ...f.spk, x25519_pub: EVIL.x.publicKeyHex };
    expect(codeOf(() => open(JSON.stringify(f), B))).toBe('BAD_SENDER_KEY');
  });

  test('inbound frame from an impostor claiming an enrolled sender id: refused against the enrolled key', () => {
    const impostor: Node = { ...EVIL, peerId: A.peerId };
    impostor.ann = signRelayX25519Announcement(A.peerId, EVIL.x.publicKeyHex, EVIL.edPriv);
    const frame = seal(impostor, B, 'pretend to be A');
    expect(codeOf(() => open(frame, B, { trusted: { [A.peerId]: A.edPub } }))).toBe('BAD_SENDER_KEY');
  });
});

// ─── 5. Transition switches: v1 refused by default ────────────────────────────────────────────

describe('v1 transition window', () => {
  test('v1 is refused when relayV1AcceptInbound is off (no settings file = off)', async () => {
    const v1 = await encryptForRelayV1Legacy('old frame', B.peerId);
    const code = await codeOfAsync(openRelayPayload(v1, {
      selfPeerId: B.peerId, resolveTrustedSenderEd25519: () => undefined, local: B.local,
      settingsPath: settingsFile(null),
    }));
    expect(code).toBe('V1_REFUSED');
  });

  test('v1 is refused when the switch is explicitly false, and when the file holds a non-boolean', async () => {
    const v1 = await encryptForRelayV1Legacy('old frame', B.peerId);
    for (const obj of [{ relayV1AcceptInbound: false }, { relayV1AcceptInbound: 'true' }]) {
      const code = await codeOfAsync(openRelayPayload(v1, {
        selfPeerId: B.peerId, resolveTrustedSenderEd25519: () => undefined, local: B.local,
        settingsPath: settingsFile(obj),
      }));
      expect(code).toBe('V1_REFUSED');
    }
  });

  test('v1 is read only when the user turned relayV1AcceptInbound on', async () => {
    const v1 = await encryptForRelayV1Legacy('old frame', B.peerId);
    const r = await openRelayPayload(v1, {
      selfPeerId: B.peerId, resolveTrustedSenderEd25519: () => undefined, local: B.local,
      settingsPath: settingsFile({ relayV1AcceptInbound: true }),
    });
    expect(r).toEqual({ wire: 'v1', plaintext: 'old frame' });
  });

  test('openRelayPayload opens v2 regardless of the v1 switch', async () => {
    const r = await openRelayPayload(seal(A, B, 'new frame'), {
      selfPeerId: B.peerId, resolveTrustedSenderEd25519: () => undefined, local: B.local,
      settingsPath: settingsFile(null), replayGuard: new MemoryReplayGuard(),
    });
    expect(r.wire).toBe('v2');
    expect(r.plaintext).toBe('new frame');
  });

  test('sender REFUSES (never silently sends v1) to a peer with no published v2 key while relayV1SendFallback is off', async () => {
    const r = await sealRelayPayloadForPeer('p', B.peerId, {
      fetchImpl: presenceFetch({ peer_id: B.peerId, capabilities: { public_key_hex: B.edPub } }),
      supabaseUrl: 'https://x.invalid', anonKey: 'a', selfPeerId: A.peerId, local: A.local,
      resolveTrusted: () => B.edPub, settingsPath: settingsFile(null),
    });
    expect(r.ok).toBe(false);
  });

  test('sender uses v1 for a no-v2-key peer ONLY when relayV1SendFallback is on', async () => {
    const r = await sealRelayPayloadForPeer('p', B.peerId, {
      fetchImpl: presenceFetch({ peer_id: B.peerId, capabilities: { public_key_hex: B.edPub } }),
      supabaseUrl: 'https://x.invalid', anonKey: 'a', selfPeerId: A.peerId, local: A.local,
      resolveTrusted: () => B.edPub, settingsPath: settingsFile({ relayV1SendFallback: true }),
    });
    expect(r.ok && r.wire).toBe('v1');
  });

  test('sender seals v2 end to end, and the recipient opens it', async () => {
    const r = await sealRelayPayloadForPeer('end to end', B.peerId, {
      fetchImpl: presenceFetch({ peer_id: B.peerId, capabilities: { public_key_hex: B.edPub, relay_x25519: B.ann } }),
      supabaseUrl: 'https://x.invalid', anonKey: 'a', selfPeerId: A.peerId, local: A.local,
      resolveTrusted: (id) => (id === B.peerId ? B.edPub : undefined), settingsPath: settingsFile(null),
    });
    expect(r.ok && r.wire).toBe('v2');
    if (!r.ok) return;
    expect(open(r.payloadEncrypted, B, { trusted: { [A.peerId]: A.edPub } }).plaintext).toBe('end to end');
  });
});

// ─── peer_server.ts receive path ─────────────────────────────────────────────────────────────

describe('handleInboundBishopDispatchEnvelope with v2 (peer_server.ts)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('refuses a v1 frame when the switch is off, with issue code V1_REFUSED', async () => {
    vi.doMock('./relay_crypto_settings', () => ({ isRelayCryptoSettingOn: () => false }));
    const peerServer = await import('./peer_server');
    peerServer.registerPresenceConfig({ peerId: B.peerId, emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x' });
    peerServer.registerPeerServerHooks({ onBishopDispatch: async () => ({ ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'stub' }) });
    const v1 = await encryptForRelayV1Legacy(JSON.stringify({
      kind: 'bishop_dispatch', dispatchId: 'D-BP223-M0-001', promptText: 'p', workingDir: 'C:\\wd', originPeerId: A.peerId,
    }), B.peerId);
    const result = await peerServer.handleInboundBishopDispatchEnvelope(v1);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe('V1_REFUSED');
    vi.doUnmock('./relay_crypto_settings');
  });

  test('accepts a signed v2 frame, verifies the inner Ed25519 signature, refuses a sender mismatch and a replay', async () => {
    // The receiving node's Thorax key store, mocked to B's keys (the X25519 key is derived from it).
    vi.doMock('../thorax/ed25519_keypair', () => ({
      getOrCreateKeypair: () => ({ public_key_hex: B.edPub, private_key_hex: B.edPriv }),
    }));
    const peerServer = await import('./peer_server');
    const { signFrame } = await import('../thorax/sign_verify');
    const { encodeFrame } = await import('../wire/hex-encode');
    peerServer.registerPresenceConfig({ peerId: B.peerId, emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x' });
    const calls: Array<string | null> = [];
    peerServer.registerPeerServerHooks({
      onBishopDispatch: async (_p, origin) => { calls.push(origin); return { ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'stub' }; },
    });

    // A signs the inner payload with ITS Ed25519 key (as signAnnouncePayload would on A's machine).
    const signedInner = (origin: string) => signFrame(encodeFrame('D-BP223-M0-001', 'broadcast', {
      kind: 'bishop_dispatch', dispatchId: 'D-BP223-M0-001', promptText: 'p', workingDir: 'C:\\wd',
      originPeerId: origin, public_key_hex: A.edPub,
    }), A.edPriv);

    const ok = await peerServer.handleInboundBishopDispatchEnvelope(seal(A, B, signedInner(A.peerId)));
    expect(ok.ok).toBe(true);
    expect(calls).toEqual([A.peerId]);

    // Same sender, but the signed payload claims a different origin than the v2 "from": refused.
    const mismatch = await peerServer.handleInboundBishopDispatchEnvelope(seal(A, B, signedInner('ffff000000000000')));
    expect(mismatch.ok).toBe(false);
    expect(mismatch.issues?.[0]?.code).toBe('SENDER_MISMATCH');

    // Replaying an accepted frame's exact bytes is refused before the hook.
    const frame = seal(A, B, signedInner(A.peerId));
    expect((await peerServer.handleInboundBishopDispatchEnvelope(frame)).ok).toBe(true);
    const replay = await peerServer.handleInboundBishopDispatchEnvelope(frame);
    expect(replay.ok).toBe(false);
    expect(replay.issues?.[0]?.code).toBe('REPLAY_REFUSED');
    expect(calls).toEqual([A.peerId, A.peerId]);
    vi.doUnmock('../thorax/ed25519_keypair');
  });
});
