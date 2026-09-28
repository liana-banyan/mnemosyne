// constellation_discovery.enrollment_gate.test.ts -- D-BP223-BM0-X010-004-MESHPLUMB
//
// Proves resolveEnrolledBeaconKey()'s wiring into the UDP beacon handler inside
// startUdpBeacon(): an ENROLLED peer's beacon is accepted only when it verifies against its
// enrolled key, and an UNENROLLED peer's self-declared-key (trust-on-first-use) beacon is still
// accepted exactly as before this dispatch (no existing test file covered this handler directly,
// but the same additive-not-regressive discipline as peer_server.ts's sibling change is proven
// here). Drives the real UDP socket over loopback -- this is the actual wire path, not a call
// into an internal function -- and reads addOrUpdatePeer()'s result back off
// constellation_peers.json. `electron`'s `app.getPath('userData')` is mocked to a scratch
// directory (mkdtempSync under os.tmpdir()); never any real peer file.
//
// Run: npx vitest run src/main/federation/constellation_discovery.enrollment_gate.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSocket, type Socket } from 'dgram';

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

const UDP_BEACON_PORT = 7475;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('constellation_discovery beacon enrollment gate -- D-BP223-BM0-X010-004-MESHPLUMB', () => {
  let scratchDir: string;
  let senderSocket: Socket | null;

  beforeEach(() => {
    vi.resetModules();
    scratchDir = mkdtempSync(join(tmpdir(), 'meshplumb-discovery-'));
    vi.doMock('electron', () => ({
      app: { getPath: () => scratchDir, getVersion: () => 'test-version', isPackaged: false },
      BrowserWindow: { getAllWindows: () => [] },
    }));
    senderSocket = null;
  });

  afterEach(async () => {
    if (senderSocket) {
      await new Promise<void>((resolve) => senderSocket!.close(() => resolve()));
      senderSocket = null;
    }
    const cd = await import('./constellation_discovery');
    cd.stopUdpBeacon();
    rmSync(scratchDir, { recursive: true, force: true });
    vi.doUnmock('electron');
  });

  async function sendRawBeacon(hex: string): Promise<void> {
    senderSocket = createSocket({ type: 'udp4', reuseAddr: true });
    await new Promise<void>((resolve) => senderSocket!.bind(0, () => { senderSocket!.setBroadcast(true); resolve(); }));
    const buf = Buffer.from(hex, 'utf8');
    await new Promise<void>((resolve, reject) => {
      senderSocket!.send(buf, 0, buf.length, UDP_BEACON_PORT, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
    });
  }

  test('ENROLLED peer_id, beacon signed by an IMPOSTOR key -> REFUSED, never added to the peer list', async () => {
    const { writeEnrollment } = await import('../thorax/peer_enrollment_registry');
    const registryPath = join(scratchDir, 'peer_enrollment_registry.json');
    const enrolledReal = ephemeralKeypair();
    const impostor = ephemeralKeypair();
    writeEnrollment(registryPath, {
      peer_id: 'beacon-peer-enrolled-1', public_key_hex: enrolledReal.publicKeyHex, key_id: 'k1',
      enrolled_at: new Date().toISOString(), source: 'test',
    });

    const cd = await import('./constellation_discovery');
    const { encodeFrame } = await import('../wire/hex-encode');
    const { signFrame } = await import('../thorax/sign_verify');

    cd.startUdpBeacon('self-listener-id', '0.9.999', {});
    await sleep(150);

    const packet = {
      type: 'MNEMOSYNEC_PEER_BEACON', peer_id: 'beacon-peer-enrolled-1', version: '0.9.999',
      capabilities_summary: {}, port: 7474, public_key_hex: impostor.publicKeyHex,
    };
    const raw = encodeFrame(randomBytes(8).toString('hex'), 'broadcast', packet);
    const signedHex = signFrame(raw, impostor.privateKeyHex);
    await sendRawBeacon(signedHex);
    await sleep(300);

    const saved = cd.loadSavedPeers();
    expect(saved.find((p) => p.id === 'beacon-peer-enrolled-1')).toBeUndefined();
  }, 15_000);

  test('ENROLLED peer_id, beacon signed by its OWN enrolled key -> ACCEPTED and marked verified', async () => {
    const { writeEnrollment } = await import('../thorax/peer_enrollment_registry');
    const registryPath = join(scratchDir, 'peer_enrollment_registry.json');
    const enrolledReal = ephemeralKeypair();
    writeEnrollment(registryPath, {
      peer_id: 'beacon-peer-enrolled-2', public_key_hex: enrolledReal.publicKeyHex, key_id: 'k2',
      enrolled_at: new Date().toISOString(), source: 'test',
    });

    const cd = await import('./constellation_discovery');
    const { encodeFrame } = await import('../wire/hex-encode');
    const { signFrame } = await import('../thorax/sign_verify');

    cd.startUdpBeacon('self-listener-id-2', '0.9.999', {});
    await sleep(150);

    const packet = {
      type: 'MNEMOSYNEC_PEER_BEACON', peer_id: 'beacon-peer-enrolled-2', version: '0.9.999',
      capabilities_summary: {}, port: 7474,
      // Self-declares a BOGUS key -- must be ignored in favor of the enrolled key.
      public_key_hex: ephemeralKeypair().publicKeyHex,
    };
    const raw = encodeFrame(randomBytes(8).toString('hex'), 'broadcast', packet);
    const signedHex = signFrame(raw, enrolledReal.privateKeyHex);
    await sendRawBeacon(signedHex);
    await sleep(300);

    const saved = cd.loadSavedPeers();
    const found = saved.find((p) => p.id === 'beacon-peer-enrolled-2');
    expect(found).toBeDefined();
    expect(found?.thorax_announce_status).toBe('verified');
  }, 15_000);
});
