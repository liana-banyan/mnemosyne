// mic_dispatcher.bishop_dispatch.test.ts — D-BP156-M0-008, HARDWIRE-24 mesh.
//
// OFFLINE, MOCKED. fetch is stubbed; no real network call, no real Supabase relay, no real
// second machine involved. Proves: (1) the bishop_dispatch payload variant round-trips through
// the SAME Thorax AES-256-GCM encryption dispatchDomainViaRelay already uses (encryptForRelay/
// decryptFromRelay), and (2) an untagged dispatch id is rejected before any network call is
// even attempted (HARDWIRE-24 Section 3).
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

  test('posts a Thorax-encrypted payload to wan-relay-route for a properly tagged id', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await dispatchBishopDispatchViaRelay(
      mockPeer, 'D-BP156-M3-001', 'prompt text', 'C:\\Users\\Administrator\\Documents\\proj', 'self-peer-id',
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/wan-relay-route');
    const body = JSON.parse(init.body as string) as { payload_encrypted: string; target_peer_id: string };
    expect(body.target_peer_id).toBe('target-peer-id');
    // payload_encrypted must be opaque ciphertext -- never the plaintext dispatch id/prompt.
    expect(body.payload_encrypted).not.toContain('D-BP156-M3-001');
    expect(body.payload_encrypted).not.toContain('prompt text');
    const parsedEnvelope = JSON.parse(body.payload_encrypted) as { iv: string; ct: string };
    expect(typeof parsedEnvelope.iv).toBe('string');
    expect(typeof parsedEnvelope.ct).toBe('string');
  });

  test('falls back to the second relay base when the first is unreachable', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await dispatchBishopDispatchViaRelay(
      mockPeer, 'D-BP156-M3-002', 'p', 'C:\\wd', 'self-peer-id',
    );
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('returns ok:false when both relay bases fail', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await dispatchBishopDispatchViaRelay(
      mockPeer, 'D-BP156-M3-003', 'p', 'C:\\wd', 'self-peer-id',
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/WAN relay route failed/);
  });
});
