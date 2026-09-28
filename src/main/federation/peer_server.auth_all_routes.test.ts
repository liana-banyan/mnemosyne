// peer_server.auth_all_routes.test.ts -- D-BP223-BM0-X030-073-STALE-STATE-AND-PRIVACY-FIXES, P2 + P1.
//
// P2 (XO X030 pick on Founder k/0a8d1c96): every port-7474 route needs the signed frame, except a minimal unauthenticated
// health ping with no machine details. Proven over REAL HTTP against handlePeerRequest on an ephemeral 127.0.0.1 port (never
// 7474, never 0.0.0.0): signed 200, unsigned 403 on every route, even with the legacy "allow unsigned LAN" switch ON.
// P1: the beacon body carries a per-install SALTED email hash, never the salt and never the unsalted hash, and the one
// switch turns the beacon off. electron is mocked to a scratch userData; APPDATA points at scratch; fetch is stubbed.
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

function ephemeralKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } });
  return { pub: (publicKey as Buffer).toString('hex'), priv: (privateKey as Buffer).toString('hex') };
}

let scratch: string;
let savedAppData: string | undefined;
let base = '';
let server: http.Server;
let ps: typeof import('./peer_server');
const kp = ephemeralKeypair();
const TEST_EMAIL = 'someone@example.org';

async function signed(payload: Record<string, unknown>): Promise<string> {
  const { encodeFrame } = await import('../wire/hex-encode');
  const { signFrame } = await import('../thorax/sign_verify');
  return signFrame(encodeFrame('x030073-' + Math.random().toString(16).slice(2), 'broadcast', { sender_peer_id: 'x030073-test-peer', public_key_hex: kp.pub, ...payload }), kp.priv);
}

function req(method: string, path: string, body?: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const r = http.request(base + path, { method, headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => resolve({ status: res.statusCode ?? 0, text: t }));
    });
    r.on('error', reject);
    if (body != null) r.write(body);
    r.end();
  });
}

beforeAll(async () => {
  vi.resetModules();
  scratch = mkdtempSync(join(tmpdir(), 'x030073-peer-'));
  savedAppData = process.env.APPDATA;
  process.env.APPDATA = join(scratch, 'appdata');
  // The legacy switch that used to admit unsigned LAN requests: ON, to prove P2 ignores it.
  mkdirSync(join(process.env.APPDATA, 'MnemosyneC', 'config'), { recursive: true });
  writeFileSync(join(process.env.APPDATA, 'MnemosyneC', 'config', 'mesh_trust_settings.json'), JSON.stringify({ allowUnauthenticatedLanDiscovery: true }));
  vi.doMock('electron', () => ({
    app: { getPath: () => join(scratch, 'userData'), getVersion: () => 'test-version', isPackaged: false, getAppPath: () => scratch, isReady: () => false },
    BrowserWindow: { getAllWindows: () => [] },
    safeStorage: { isEncryptionAvailable: () => false, encryptString: () => { throw new Error('no'); }, decryptString: () => { throw new Error('no'); } },
    dialog: { showMessageBox: async () => ({ response: 0 }) },
  }));
  vi.doMock('../lb_auth', () => ({ getLBSession: () => ({ email: TEST_EMAIL }) }));
  vi.doMock('../identity/localPeerKeypair', () => ({ ensureLocalPeerKeypair: () => ({ publicKeyHex: kp.pub }) }));
  ps = await import('./peer_server');
  ps.registerPeerServerHooks({
    onPlowDomain: async () => ({ ebletsWritten: 0, quarantined: 0, andonEvents: 0, status: 'ok' }),
    onDiagnosisPost: async () => undefined,
    onDiagnosisAnswer: async () => undefined,
    onDiagnosisUpvote: async () => undefined,
    onDiagnosisVerify: async () => ({ exists: false, byteLength: null, sha256: null }),
  });
  server = http.createServer((q, s) => { void ps.handlePeerRequest(q, s); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  process.env.APPDATA = savedAppData;
  vi.doUnmock('electron'); vi.doUnmock('../lb_auth'); vi.doUnmock('../identity/localPeerKeypair');
  vi.unstubAllGlobals();
  rmSync(scratch, { recursive: true, force: true });
});

describe('P2: port 7474 routes (X030-073)', () => {
  test('health ping is the one unauthenticated route and returns no machine details', async () => {
    const r = await req('GET', '/api/heartbeat');
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual({ ok: true });
  });

  const POSTS: Array<[string, Record<string, unknown>]> = [
    ['/api/plow-domain', { domain: 'math', questions: ['q'] }],
    ['/api/diagnosis/post', { id: 'd1' }],
    ['/api/diagnosis/answer', { id: 'd1' }],
    ['/api/diagnosis/upvote', { id: 'd1' }],
    ['/api/diagnosis/verify', { id: 'd1' }],
    ['/api/library/search', { protocol: 'lb.hollerith_library.v1', ts: '', nonce: '', query: { tags: ['x030073'] } }],
    ['/api/library/fetch', { protocol: 'lb.hollerith_library.v1', ts: '', nonce: '', connectors: ['x030073-none'] }],
  ];

  for (const [path, payload] of POSTS) {
    test(`${path}: unsigned 403 (legacy allow-unsigned switch is ON), garbage 403, signed 200`, async () => {
      expect((await req('POST', path, JSON.stringify(payload))).status).toBe(403);
      expect((await req('POST', path, 'not json')).status).toBe(403);
      const withTs = path.startsWith('/api/library') ? { ...payload, ts: new Date().toISOString(), nonce: 'n'.repeat(24) } : payload;
      const good = await req('POST', path, JSON.stringify({ signed_frame: await signed(withTs) }));
      expect(good.status, good.text).toBe(200);
    });
  }

  test('a tampered signed frame is 403', async () => {
    const f = await signed({ id: 'd1' });
    const bad = f.slice(0, -4) + (f.endsWith('0000') ? '1111' : '0000');
    expect((await req('POST', '/api/diagnosis/post', JSON.stringify({ signed_frame: bad }))).status).toBe(403);
  });

  test('/api/info: unsigned 403, wrong route 403, stale 403, fresh signed 200', async () => {
    expect((await req('GET', '/api/info')).status).toBe(403);
    expect((await req('GET', '/api/info', undefined, { 'x-mnem-signed-frame': await signed({ route: '/api/other', issued_ms: Date.now() }) })).status).toBe(403);
    expect((await req('GET', '/api/info', undefined, { 'x-mnem-signed-frame': await signed({ route: '/api/info', issued_ms: Date.now() - 10 * 60 * 1000 }) })).status).toBe(403);
    const ok = await req('GET', '/api/info', undefined, { 'x-mnem-signed-frame': await signed({ route: '/api/info', issued_ms: Date.now() }) });
    expect(ok.status, ok.text).toBe(200);
    expect(JSON.parse(ok.text).version).toBe('test-version');
  });

  test('the server source keeps the LAN bind (mesh needs it)', () => {
    const src = readFileSync(join(__dirname, 'peer_server.ts'), 'utf8');
    expect(src).toContain("_server.listen(PEER_SERVER_PORT, '0.0.0.0'");
  });
});

describe('P1: salted beacon, one switch (X030-073)', () => {
  test('beacon body: salted email hash, never the salt, never the unsalted hash; switch off sends nothing', async () => {
    const bodies: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => { bodies.push(init.body); return new Response(JSON.stringify({ ok: true, tier: 'base' }), { status: 200 }); }));
    const unsalted = createHash('sha256').update(TEST_EMAIL).digest('hex').slice(0, 32);
    ps.registerPresenceConfig({ peerId: 'x030073-self', emailHash: unsalted, wanSoccerballId: 'a'.repeat(32), relaySessionId: 'r'.repeat(32), supabaseUrl: 'https://example.invalid' });

    // Signed in, nothing enrolled: default OFF, nothing sent.
    expect(ps.getPresenceShareState()).toMatchObject({ enabled: false, source: 'default_not_same_owner_mesh' });
    await ps.publishPresence();
    expect(bodies.length).toBe(0);

    // The user's switch ON: one publish, salted.
    ps.setPresenceSharing(true);
    await ps.publishPresence();
    expect(bodies.length).toBeGreaterThan(0);
    const body = JSON.parse(bodies[bodies.length - 1]);
    const salt = JSON.parse(readFileSync(join(process.env.APPDATA as string, 'MnemosyneC', 'config', 'beacon_salt.json'), 'utf8')).salt as string;
    expect(body.email_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(body.email_hash).not.toBe(unsalted);
    expect(bodies.join('')).not.toContain(salt);
    expect(bodies.join('')).not.toContain(unsalted);
    expect(bodies.join('')).not.toContain(TEST_EMAIL);

    // Switch OFF again: nothing more is sent.
    const n = bodies.length;
    ps.setPresenceSharing(false);
    await ps.publishPresence();
    expect(bodies.length).toBe(n);
  });

  test('same-owner mesh: default ON when an enrolled peer carries this owner id', async () => {
    const settings = join(process.env.APPDATA as string, 'MnemosyneC', 'config', 'presence_share_settings.json');
    rmSync(settings, { force: true });
    const unsalted = createHash('sha256').update(TEST_EMAIL).digest('hex').slice(0, 32);
    mkdirSync(join(scratch, 'userData'), { recursive: true });
    writeFileSync(join(scratch, 'userData', 'peer_enrollment_registry.json'), JSON.stringify({ 'other-machine': { public_key_hex: kp.pub, owner_id: unsalted } }));
    expect(ps.getPresenceShareState()).toMatchObject({ enabled: true, source: 'default_same_owner_mesh', sameOwnerPeers: 1 });
  });
});
