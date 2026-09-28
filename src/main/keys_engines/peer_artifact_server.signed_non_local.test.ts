// peer_artifact_server.signed_non_local.test.ts -- D-BP223-BM0-X030-098, hole 2 (same class as X030-073 P2).
// Port 47213 was plain HTTP with no auth. Every non-local request now needs the SAME signed frame as port 7474's GET routes
// (peer_server.ts requireSignedGet, the real verifier, not a stub). Real HTTP on an ephemeral 127.0.0.1 port (never 47213);
// the non-local path is exercised by telling the handler the socket is not loopback. Versions used here are never cached, so
// "authorized" shows as 404 (passed the gate, nothing to serve) and "refused" as 403, and no real cache file is touched.
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

const { publicKey, privateKey } = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } });
const kp = { pub: (publicKey as Buffer).toString('hex'), priv: (privateKey as Buffer).toString('hex') };

let scratch: string;
let savedAppData: string | undefined;
let remoteBase = '';
let localBase = '';
let remoteServer: http.Server;
let localServer: http.Server;
let mod: typeof import('./peer_artifact_server');
let client: typeof import('./peer_artifact_client');
const V = 'x030098-never-cached';

async function signed(payload: Record<string, unknown>): Promise<string> {
  const { encodeFrame } = await import('../wire/hex-encode');
  const { signFrame } = await import('../thorax/sign_verify');
  return signFrame(encodeFrame('x030098-' + Math.random().toString(16).slice(2), 'broadcast', { sender_peer_id: 'x030098-test-peer', public_key_hex: kp.pub, ...payload }), kp.priv);
}

function get(base: string, path: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const r = http.request(base + path, { method: 'GET', headers }, (res) => {
      let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => resolve({ status: res.statusCode ?? 0, text: t }));
    });
    r.on('error', reject);
    r.end();
  });
}

beforeAll(async () => {
  vi.resetModules();
  scratch = mkdtempSync(join(tmpdir(), 'x030098-artifact-'));
  savedAppData = process.env.APPDATA;
  process.env.APPDATA = join(scratch, 'appdata');
  vi.doMock('electron', () => ({
    app: { getPath: () => join(scratch, 'userData'), getVersion: () => 'test-version', isPackaged: false, getAppPath: () => scratch, isReady: () => false },
    BrowserWindow: { getAllWindows: () => [] },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (s: string) => Buffer.concat([Buffer.from('v10'), Buffer.from(s)]),
      decryptString: (b: Buffer) => b.subarray(3).toString(),
    },
    dialog: { showMessageBox: async () => ({ response: 0 }) },
  }));
  vi.doMock('../lb_auth', () => ({ getLBSession: () => null }));
  vi.doMock('../identity/localPeerKeypair', () => ({ ensureLocalPeerKeypair: () => ({ publicKeyHex: kp.pub }) }));
  mod = await import('./peer_artifact_server');
  client = await import('./peer_artifact_client');
  const { requireSignedGet } = await import('../federation/peer_server');
  const verifySignedGet = (h: http.IncomingHttpHeaders, route: string) => { const v = requireSignedGet(h, route); return v.ok ? { ok: true as const } : { ok: false as const, status: v.status, error: v.error }; };
  remoteServer = http.createServer(mod.createPeerArtifactRequestHandler({ isLocal: () => false, verifySignedGet }));
  localServer = http.createServer(mod.createPeerArtifactRequestHandler());
  await new Promise<void>((r) => remoteServer.listen(0, '127.0.0.1', () => r()));
  await new Promise<void>((r) => localServer.listen(0, '127.0.0.1', () => r()));
  remoteBase = `http://127.0.0.1:${(remoteServer.address() as AddressInfo).port}`;
  localBase = `http://127.0.0.1:${(localServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => remoteServer.close(() => r()));
  await new Promise<void>((r) => localServer.close(() => r()));
  process.env.APPDATA = savedAppData;
  vi.doUnmock('electron'); vi.doUnmock('../lb_auth'); vi.doUnmock('../identity/localPeerKeypair');
  rmSync(scratch, { recursive: true, force: true });
});

describe('port 47213: non-local access needs the 7474 signed frame (X030-098 hole 2)', () => {
  test('loopback detection', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '127.5.5.5']) expect(mod.isLoopbackAddress(a)).toBe(true);
    for (const a of ['192.168.1.42', '10.0.0.5', '::ffff:192.168.1.42', 'fe80::1', '', undefined]) expect(mod.isLoopbackAddress(a)).toBe(false);
  });

  for (const route of [`/hash/${V}`, `/artifact/${V}`]) {
    test(`${route}: unsigned 403, garbage 403, wrong route 403, stale 403, tampered 403, fresh signed passes the gate`, async () => {
      expect((await get(remoteBase, route)).status).toBe(403);
      expect((await get(remoteBase, route, { 'x-mnem-signed-frame': 'deadbeef' })).status).toBe(403);
      expect((await get(remoteBase, route, { 'x-mnem-signed-frame': await signed({ route: '/hash/other', issued_ms: Date.now() }) })).status).toBe(403);
      expect((await get(remoteBase, route, { 'x-mnem-signed-frame': await signed({ route, issued_ms: Date.now() - 10 * 60 * 1000 }) })).status).toBe(403);
      const f = await signed({ route, issued_ms: Date.now() });
      const bad = f.slice(0, -4) + (f.endsWith('0000') ? '1111' : '0000');
      expect((await get(remoteBase, route, { 'x-mnem-signed-frame': bad })).status).toBe(403);
      const ok = await get(remoteBase, route, { 'x-mnem-signed-frame': f });
      expect(ok.status, ok.text).toBe(404); // authorized; this version is not cached
    });
  }

  test('the DEFAULT verifier (lazy-loaded 7474 requireSignedGet) also refuses unsigned and admits signed', async () => {
    const s = http.createServer(mod.createPeerArtifactRequestHandler({ isLocal: () => false }));
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r()));
    const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    try {
      expect((await get(b, `/hash/${V}`)).status).toBe(403);
      expect((await get(b, `/hash/${V}`, { 'x-mnem-signed-frame': await signed({ route: `/hash/${V}`, issued_ms: Date.now() }) })).status).toBe(404);
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
  });

  test('non-local /health unsigned is the minimal ping only (no peer id); signed or local includes it', async () => {
    const bare = await get(remoteBase, '/health');
    expect(bare.status).toBe(200);
    expect(JSON.parse(bare.text)).toEqual({ ok: true });
    const s = await get(remoteBase, '/health', { 'x-mnem-signed-frame': await signed({ route: '/health', issued_ms: Date.now() }) });
    expect(JSON.parse(s.text)).toHaveProperty('peerId');
    expect(JSON.parse((await get(localBase, '/health')).text)).toHaveProperty('peerId');
  });

  test('loopback requests stay unsigned (same machine)', async () => {
    expect((await get(localBase, `/hash/${V}`)).status).toBe(404);
    expect((await get(localBase, `/artifact/${V}`)).status).toBe(404);
  });

  test('the client helper produces a header this server accepts (new client to new server works)', async () => {
    const route = `/hash/${encodeURIComponent(V)}`;
    const headers = client.signedArtifactGetHeaders(route);
    expect(typeof headers['x-mnem-signed-frame']).toBe('string');
    expect(headers['x-mnem-signed-frame'].length).toBeGreaterThan(64);
    expect((await get(remoteBase, route, headers)).status).toBe(404);
    // A header signed for one route is refused on another.
    expect((await get(remoteBase, `/artifact/${encodeURIComponent(V)}`, headers)).status).toBe(403);
  });

  test('client request sites all send the signed header; server keeps the LAN bind (documented mesh need)', () => {
    const c = readFileSync(join(__dirname, 'peer_artifact_client.ts'), 'utf8');
    expect((c.match(/headers: signedArtifactGetHeaders\(/g) ?? []).length).toBe(3);
    const q = readFileSync(join(__dirname, 'circle_query.ts'), 'utf8');
    expect(q).toContain('headers: signedArtifactGetHeaders(');
    const s = readFileSync(join(__dirname, 'peer_artifact_server.ts'), 'utf8');
    expect(s).toContain('server.listen(port, () =>');
  });
});
