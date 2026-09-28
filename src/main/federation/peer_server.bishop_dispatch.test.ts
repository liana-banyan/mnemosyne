// peer_server.bishop_dispatch.test.ts — D-BP156-M0-008, HARDWIRE-24 mesh.
//
// OFFLINE. Proves handleInboundBishopDispatchEnvelope() (peer_server.ts): a malformed payload
// never crashes it (always returns a result object, never throws), and the signed-envelope
// verification path correctly sets verifiedOriginPeerId only when a real Ed25519 signature
// checks out.
//
// getOrCreateKeypair() (thorax/ed25519_keypair.ts) calls electron's app.getPath('userData'),
// which is undefined outside a real Electron main process (verified directly in this session:
// `electron.app` is `undefined` under vitest) -- signAnnouncePayload() fails soft to null in
// that case per its own doc comment, which is itself a real code path worth covering (an
// unsigned envelope must never verify). The keypair module is mocked ONLY in the "properly
// signed" tests below, so those specifically exercise a real, valid Ed25519 signature/verify
// round trip instead of only the fails-soft branch.
//
// Run: npx vitest run src/main/federation/peer_server.bishop_dispatch.test.ts

import { describe, test, expect, vi, beforeEach } from 'vitest';

// D-BP223-X043-007-RELAY-X25519: the tests in this file build their frames with encryptForRelay,
// which is now the deprecated alias of the v1 LEGACY cipher (key derived from the public peer id).
// peer_server.ts refuses v1 unless the user turns on relayV1AcceptInbound, so these tests turn
// that one switch on through a module mock: they exercise the parsing, signature and hook logic
// AFTER decryption, which is identical for v1 and v2. The v2 path, and "v1 refused when the
// switch is off", are covered in relay_x25519.test.ts.
function acceptV1ForThisTest(): void {
  vi.doMock('./relay_crypto_settings', () => ({
    isRelayCryptoSettingOn: (key: string) => key === 'relayV1AcceptInbound',
  }));
}

describe('handleInboundBishopDispatchEnvelope — malformed input never crashes', () => {
  beforeEach(() => {
    vi.resetModules();
    acceptV1ForThisTest();
  });

  test('garbage (non-JSON) payload_encrypted is refused, not thrown', async () => {
    const peerServer = await import('./peer_server');
    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });
    const result = await peerServer.handleInboundBishopDispatchEnvelope('not even json');
    expect(result.ok).toBe(false);
    expect(result.spawned).toBe(false);
  });

  test('valid JSON envelope but wrong shape (no iv/ct) is refused, not thrown', async () => {
    const peerServer = await import('./peer_server');
    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });
    const result = await peerServer.handleInboundBishopDispatchEnvelope(JSON.stringify({ foo: 'bar' }));
    expect(result.ok).toBe(false);
  });

  test('validly-encrypted but non-bishop_dispatch payload is refused, not thrown', async () => {
    const peerServer = await import('./peer_server');
    const { encryptForRelay } = await import('./mic_dispatcher');
    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });
    peerServer.registerPeerServerHooks({ onBishopDispatch: async () => ({ ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'stub' }) });
    const encrypted = await encryptForRelay(JSON.stringify({ domain: 'chemistry', questions: [] }), 'self-peer-id');
    const result = await peerServer.handleInboundBishopDispatchEnvelope(encrypted);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not a bishop_dispatch/);
  });

  test('bishop_dispatch payload with an untagged dispatch id is refused, not thrown', async () => {
    const peerServer = await import('./peer_server');
    const { encryptForRelay } = await import('./mic_dispatcher');
    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });
    peerServer.registerPeerServerHooks({ onBishopDispatch: async () => ({ ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'stub' }) });
    const encrypted = await encryptForRelay(JSON.stringify({
      kind: 'bishop_dispatch', dispatchId: 'D-BP148-046', promptText: 'p', workingDir: 'C:\\wd', originPeerId: 'x',
    }), 'self-peer-id');
    const result = await peerServer.handleInboundBishopDispatchEnvelope(encrypted);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing\/malformed required fields/);
  });

  test('returns a clear refusal (not a throw) when no onBishopDispatch hook is registered', async () => {
    const peerServer = await import('./peer_server');
    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });
    // Deliberately NOT registering a hook in this one test -- this is the path under test.
    const result = await peerServer.handleInboundBishopDispatchEnvelope('anything');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not registered/);
  });

  test('decrypting with a peer id that never registered presence is refused, not thrown', async () => {
    const peerServer = await import('./peer_server');
    peerServer.registerPeerServerHooks({ onBishopDispatch: async () => ({ ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'stub' }) });
    // _peerId was never set in this fresh module instance (vi.resetModules() above) -- this is
    // the path under test.
    const result = await peerServer.handleInboundBishopDispatchEnvelope('anything');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no registered peer id/);
  });
});

describe('handleInboundBishopDispatchEnvelope — signed envelope verification', () => {
  beforeEach(() => {
    vi.resetModules();
    acceptV1ForThisTest();
  });

  test('an UNSIGNED envelope (signAnnouncePayload failed soft) is passed to the hook with verifiedOriginPeerId=null', async () => {
    const peerServer = await import('./peer_server');
    const { encryptForRelay } = await import('./mic_dispatcher');
    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });

    const receivedCalls: Array<{ payload: unknown; origin: string | null }> = [];
    peerServer.registerPeerServerHooks({
      onBishopDispatch: async (payload, origin) => {
        receivedCalls.push({ payload, origin });
        return { ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'test-stub' };
      },
    });

    const plaintext = JSON.stringify({
      kind: 'bishop_dispatch', dispatchId: 'D-BP156-M0-001', promptText: 'p', workingDir: 'C:\\wd',
      originPeerId: '1a78f7c9bdd5e830',
    });
    const encrypted = await encryptForRelay(plaintext, 'self-peer-id');
    const result = await peerServer.handleInboundBishopDispatchEnvelope(encrypted);

    expect(result.ok).toBe(true);
    expect(receivedCalls).toHaveLength(1);
    expect(receivedCalls[0]?.origin).toBeNull();
  });

  test('a REAL, VALID Ed25519 signature verifies and sets verifiedOriginPeerId to the claimed origin (TOFU)', async () => {
    // Mock the userData-backed keypair store so signAnnouncePayload succeeds for real instead
    // of failing soft -- see this file's header note. Deterministic fake keypair, generated
    // once via node:crypto so signFrame/verifyFrame (thorax/sign_verify.ts) operate on a real
    // Ed25519 key pair, not a fabricated one.
    const { generateKeyPairSync } = await import('node:crypto');
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });
    const fakeKeypair = {
      public_key_hex: (publicKey as Buffer).toString('hex'),
      private_key_hex: (privateKey as Buffer).toString('hex'),
    };
    vi.doMock('../thorax/ed25519_keypair', () => ({ getOrCreateKeypair: () => fakeKeypair }));

    const peerServer = await import('./peer_server');
    const { encryptForRelay } = await import('./mic_dispatcher');
    const { signAnnouncePayload } = await import('./announce_frame');

    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });

    const receivedCalls: Array<{ payload: unknown; origin: string | null }> = [];
    peerServer.registerPeerServerHooks({
      onBishopDispatch: async (payload, origin) => {
        receivedCalls.push({ payload, origin });
        return { ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'test-stub' };
      },
    });

    const payload = {
      kind: 'bishop_dispatch', dispatchId: 'D-BP156-M0-001', promptText: 'p', workingDir: 'C:\\wd',
      originPeerId: '1a78f7c9bdd5e830',
    };
    const signed = signAnnouncePayload(payload.dispatchId, payload);
    expect(signed).not.toBeNull(); // proves the mock actually made signing succeed

    const encrypted = await encryptForRelay(signed!.signedHex, 'self-peer-id');
    const result = await peerServer.handleInboundBishopDispatchEnvelope(encrypted);

    expect(result.ok).toBe(true);
    expect(receivedCalls).toHaveLength(1);
    expect(receivedCalls[0]?.origin).toBe('1a78f7c9bdd5e830');

    vi.doUnmock('../thorax/ed25519_keypair');
  });

  test('a TAMPERED signed envelope (bad signature) is refused, not thrown, and never verified', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });
    const fakeKeypair = {
      public_key_hex: (publicKey as Buffer).toString('hex'),
      private_key_hex: (privateKey as Buffer).toString('hex'),
    };
    vi.doMock('../thorax/ed25519_keypair', () => ({ getOrCreateKeypair: () => fakeKeypair }));

    const peerServer = await import('./peer_server');
    const { encryptForRelay } = await import('./mic_dispatcher');
    const { signAnnouncePayload } = await import('./announce_frame');

    peerServer.registerPresenceConfig({
      peerId: 'self-peer-id', emailHash: null, wanSoccerballId: 'x', relaySessionId: 'x', supabaseUrl: 'x',
    });
    const receivedCalls: Array<{ origin: string | null }> = [];
    peerServer.registerPeerServerHooks({
      onBishopDispatch: async (_payload, origin) => {
        receivedCalls.push({ origin });
        return { ok: true, lifecycle: 'refused', issues: [], spawned: false, reason: 'test-stub' };
      },
    });

    const payload = {
      kind: 'bishop_dispatch', dispatchId: 'D-BP156-M0-001', promptText: 'p', workingDir: 'C:\\wd',
      originPeerId: '1a78f7c9bdd5e830',
    };
    const signed = signAnnouncePayload(payload.dispatchId, payload);
    // Tamper with the signed hex (flip a character in the middle) before encrypting.
    const tampered = signed!.signedHex.slice(0, 10) + (signed!.signedHex[10] === 'a' ? 'b' : 'a') + signed!.signedHex.slice(11);
    const encrypted = await encryptForRelay(tampered, 'self-peer-id');
    const result = await peerServer.handleInboundBishopDispatchEnvelope(encrypted);

    // Either the tamper broke frame decoding entirely (refused before reaching the hook) or it
    // reached the hook with verifiedOriginPeerId null (never true) -- both are acceptable
    // "never falsely verified" outcomes; a crash or a true verification would not be.
    if (receivedCalls.length > 0) {
      expect(receivedCalls[0]?.origin).toBeNull();
    } else {
      expect(result.ok).toBe(false);
    }

    vi.doUnmock('../thorax/ed25519_keypair');
  });
});
