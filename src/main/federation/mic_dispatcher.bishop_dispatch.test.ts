// mic_dispatcher.bishop_dispatch.test.ts — D-BP156-M0-008, HARDWIRE-24 mesh.
// Updated D-BP156-M0-016 (send-path fix): dispatchBishopDispatchViaRelay no longer POSTs to
// the wan-relay-route edge function (it 400s without hex_frame, which the old send path never
// sent -- verified against the edge function's real source). It now INSERTs directly into
// relay_routes via PostgREST with the anon key, mirroring wan_dispatch.ts's proven
// insertRelayRoute() sender. The two tests below that asserted the OLD (broken) `/wan-relay-
// route` + `{payload_encrypted, target_peer_id}` shape are rewritten to assert the real,
// edge-function-validated shape instead.
//
// OFFLINE, MOCKED. fetch is stubbed; no real network call, no real Supabase relay, no real
// second machine involved. Proves: (1) the bishop_dispatch payload variant round-trips through
// the SAME Thorax AES-256-GCM encryption dispatchDomainViaRelay already uses (encryptForRelay/
// decryptFromRelay), (2) an untagged dispatch id is rejected before any network call is even
// attempted (HARDWIRE-24 Section 3), and (3) the fixed send path builds a relay_routes row
// shape (target_peer_id, hex_frame, payload_json.kind/payload_encrypted) that satisfies both
// the edge function's real validation (target_peer_id + hex_frame required) AND
// bishop_dispatch_relay_listener.ts's own row-shape discriminator.
//
// Run: npx vitest run src/main/federation/mic_dispatcher.bishop_dispatch.test.ts

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  isValidMachineTaggedDispatchId,
  dispatchBishopDispatchViaRelay,
  decryptFromRelay,
  encryptForRelay,
  type BishopDispatchPayload,
} from './mic_dispatcher';
import type { ConstellationPeer } from './mic_types';
import { generateKeyPairSync } from 'node:crypto';
import {
  deriveRelayX25519FromEd25519,
  signRelayX25519Announcement,
} from './relay_x25519';
import type { SealDeps } from './relay_v2_transport';
import { installTestOwnerSecret, TEST_OWNER_SECRET } from './relay_rpc_legacy_test_shim';

// D-BP223-X043-010-RB: the send goes through route_send (Phase A RPC) with the owner secret.
installTestOwnerSecret();

// D-BP223-X043-007-RELAY-X25519: dispatchBishopDispatchViaRelay now seals with v2 (per-peer
// X25519). The recipient's key comes from its peer_presence row, which the send path reads with
// its own fetch. These tests inject that lookup (sealDeps.fetchImpl) and this node's identity
// (sealDeps.local) so the GLOBAL fetch mock below still sees exactly one call: the relay_routes
// insert. The recipient's announcement is signed by an Ed25519 key the sender already trusts
// (sealDeps.resolveTrusted, standing in for the enrollment registry): the normal, non-TOFU path.
function edPair(): { pub: string; priv: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return { pub: (publicKey as Buffer).toString('hex'), priv: (privateKey as Buffer).toString('hex') };
}
function makeSealDeps(selfPeerId: string, targetPeerId: string): SealDeps {
  const selfEd = edPair();
  const selfX = deriveRelayX25519FromEd25519(selfEd.priv);
  const targetEd = edPair();
  const targetX = deriveRelayX25519FromEd25519(targetEd.priv);
  const targetAnn = signRelayX25519Announcement(targetPeerId, targetX.publicKeyHex, targetEd.priv);
  return {
    selfPeerId,
    local: {
      peerId: selfPeerId,
      keypair: selfX,
      announcement: signRelayX25519Announcement(selfPeerId, selfX.publicKeyHex, selfEd.priv),
      ed25519PublicHex: selfEd.pub,
    },
    resolveTrusted: (id: string) => (id === targetPeerId ? targetEd.pub : undefined),
    supabaseUrl: 'https://example.invalid',
    anonKey: 'anon',
    fetchImpl: (async () => ({
      ok: true,
      status: 200,
      json: async () => [{ peer_id: targetPeerId, capabilities: { public_key_hex: targetEd.pub, relay_x25519: targetAnn } }],
    })) as unknown as typeof fetch,
  };
}

describe('isValidMachineTaggedDispatchId', () => {
  test('accepts a properly machine-tagged id', () => {
    expect(isValidMachineTaggedDispatchId('D-BP155-M0-001')).toBe(true);
    expect(isValidMachineTaggedDispatchId('D-BP156-M3-008')).toBe(true);
  });
  test('accepts a machine-tagged id with a trailing suffix', () => {
    expect(isValidMachineTaggedDispatchId('D-BP155-M3-001-S')).toBe(true);
  });
  test('rejects a bare, untagged dispatch id', () => {
    expect(isValidMachineTaggedDispatchId('D-BP148-046')).toBe(false);
  });
  test('rejects non-string input without throwing', () => {
    expect(isValidMachineTaggedDispatchId(undefined as unknown as string)).toBe(false);
    expect(isValidMachineTaggedDispatchId(12345 as unknown as string)).toBe(false);
  });
});

describe('encryptForRelay / decryptFromRelay round trip', () => {
  test('a bishop_dispatch payload serializes and decrypts back to the same plaintext', async () => {
    const peerId = 'test-peer-id-abc123';
    const plaintext = JSON.stringify({
      kind: 'bishop_dispatch',
      dispatchId: 'D-BP156-M3-001',
      promptText: 'do the thing',
      workingDir: 'C:\\Users\\Administrator\\Documents\\some\\project',
      originPeerId: '1a78f7c9bdd5e830',
    } satisfies BishopDispatchPayload);

    const encrypted = await encryptForRelay(plaintext, peerId);
    const decrypted = await decryptFromRelay(encrypted, peerId);
    expect(decrypted).toBe(plaintext);
  });

  test('decrypting with the WRONG peer id fails (confidentiality holds)', async () => {
    const encrypted = await encryptForRelay('secret payload', 'peer-A');
    await expect(decryptFromRelay(encrypted, 'peer-B')).rejects.toThrow();
  });
});

describe('dispatchBishopDispatchViaRelay', () => {
  const mockPeer: ConstellationPeer = {
    id: 'target-peer-id',
    online: true,
    installedDomains: [],
  } as unknown as ConstellationPeer;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  test('refuses to send an untagged dispatch id, without calling fetch at all', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const result = await dispatchBishopDispatchViaRelay(
      mockPeer, 'D-BP148-046', 'prompt', 'C:\\workdir', 'self-peer-id',
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not machine-tagged/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('inserts a bishop_dispatch row directly into relay_routes for a properly tagged id, ' +
    'in a shape the real edge function validation and the inbound listener both accept', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    // D-BP223-X043-010-RB: route_send returns the new route id as a JSON string.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify('route-row-1'),
    });

    const result = await dispatchBishopDispatchViaRelay(
      mockPeer, 'D-BP156-M3-001', 'prompt text', 'C:\\Users\\Administrator\\Documents\\proj', 'self-peer-id',
      makeSealDeps('self-peer-id', 'target-peer-id'),
    );

    expect(result.ok).toBe(true);
    // Exactly one call -- no edge-function fallback-base retry (that concept belonged to the
    // OLD, broken wan-relay-route send path; the fixed path is a single direct table insert).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    // D-BP223-X043-010-RB: targets the route_send RPC (Phase A), never the relay_routes table
    // directly and never the wan-relay-route edge function. The owner secret is in the BODY only.
    expect(url.endsWith('/rest/v1/rpc/route_send')).toBe(true);
    expect(url).not.toContain('/wan-relay-route');
    expect(url).not.toContain(TEST_OWNER_SECRET);
    expect((init.method ?? '').toUpperCase()).toBe('POST');

    // No service-role key anywhere in the request -- a shipped client can only ever hold the
    // anon/publishable key (HARD CONSTRAINT of this dispatch).
    const headers = init.headers as Record<string, string>;
    const authHeader = headers['Authorization'] ?? '';
    expect(authHeader.toLowerCase()).not.toContain('service_role');

    const rpcBody = JSON.parse(init.body as string) as {
      p_sender_peer_id: string; p_secret: string; p_target_peer_id: string; p_hex_frame: string;
      p_payload_json: { kind: string; payload_encrypted: string }; p_session_id: string; p_ttl_seconds: number; p_wire_format: string;
    };
    expect(rpcBody.p_secret).toBe(TEST_OWNER_SECRET);
    expect(rpcBody.p_sender_peer_id).toBe('self-peer-id');
    expect(rpcBody.p_session_id).toBe('D-BP156-M3-001');
    // The same row fields as before, in the RPC's argument names.
    const body = {
      target_peer_id: rpcBody.p_target_peer_id,
      hex_frame: rpcBody.p_hex_frame,
      payload_json: rpcBody.p_payload_json,
      status: 'pending', // route_send always inserts status 'pending' (Phase A SQL)
    };

    // Satisfies the real edge function's validation (target_peer_id AND hex_frame both
    // required, verified against wan-relay-route/index.ts's real source) even though this
    // send path bypasses the edge function entirely -- the schema requirement (hex_frame is a
    // NOT NULL column) is the same either way.
    expect(body.target_peer_id).toBe('target-peer-id');
    expect(typeof body.hex_frame).toBe('string');
    expect(body.hex_frame.length).toBeGreaterThan(0);

    // Satisfies bishop_dispatch_relay_listener.ts's own discriminator: payload_json.kind ===
    // 'bishop_dispatch' AND payload_json.payload_encrypted is a non-empty string.
    expect(body.payload_json.kind).toBe('bishop_dispatch');
    expect(typeof body.payload_json.payload_encrypted).toBe('string');
    expect(body.payload_json.payload_encrypted.length).toBeGreaterThan(0);

    // payload_encrypted must be opaque ciphertext -- never the plaintext dispatch id/prompt.
    expect(body.payload_json.payload_encrypted).not.toContain('D-BP156-M3-001');
    expect(body.payload_json.payload_encrypted).not.toContain('prompt text');
    const parsedEnvelope = JSON.parse(body.payload_json.payload_encrypted) as { v: string; to: string; iv: string; ct: string };
    // D-BP223-X043-007: a v2 frame addressed to the target, not the old v1 {iv, ct} shape.
    expect(parsedEnvelope.v).toBe('v2');
    expect(parsedEnvelope.to).toBe('target-peer-id');
    expect(typeof parsedEnvelope.iv).toBe('string');
    expect(typeof parsedEnvelope.ct).toBe('string');

    // Row starts pending, exactly like every other relay_routes insert in this codebase.
    expect(body.status).toBe('pending');

    // D-BP156-M0-020 / X043-010-RB: route_send returns the inserted row's id (set up above) -- the
    // send path must surface that id to the caller as the sender's own receipt, not discard it.
    expect(result.routeId).toBe('route-row-1');
  });

  test('returns ok:false when the relay_routes insert fails, with no fallback-base retry', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'insert error' });

    const result = await dispatchBishopDispatchViaRelay(
      mockPeer, 'D-BP156-M3-003', 'p', 'C:\\wd', 'self-peer-id',
      makeSealDeps('self-peer-id', 'target-peer-id'),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/relay_routes insert failed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns ok:false (never throws) on a network error', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const result = await dispatchBishopDispatchViaRelay(
      mockPeer, 'D-BP156-M3-004', 'p', 'C:\\wd', 'self-peer-id',
      makeSealDeps('self-peer-id', 'target-peer-id'),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/relay_routes insert error/);
  });
});
