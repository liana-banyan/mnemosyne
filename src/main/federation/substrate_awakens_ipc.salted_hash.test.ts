// substrate_awakens_ipc.salted_hash.test.ts -- D-BP223-BM0-X030-098, hole 3 (same class as X030-073 P1).
// The Substrate Awakens handshake sent sha256(email) UNSALTED to the relay (email_hash, and peer_id was its first 16 hex).
// It now sends X030-073's per-install salted hash (salt never sent) and obeys the one presence switch, including on every
// heartbeat tick. electron ipcMain is captured, LAN/hardware helpers are stubbed, fetch is stubbed, the salt is in scratch.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_EMAIL = 'someone@example.org';
let scratch: string;
let handlers: Record<string, (...a: any[]) => any>;
let bodies: string[];
let sharing = true;

async function load(saltPath: string) {
  const m = await import('./substrate_awakens_ipc');
  // D-BP223-X043-010-RB: the handshake now carries the presence owner proof (header); electron is mocked without
  // safeStorage, so the post-resetModules relay_rpc instance gets a test secret.
  (await import('./relay_rpc')).setOwnerSecretProviderForTests(() => 'd'.repeat(64));
  const cleanup = m.registerSubstrateAwakensIPC({ isPresenceSharingOn: () => sharing, saltPath });
  return { m, cleanup };
}

beforeEach(() => {
  vi.resetModules();
  scratch = mkdtempSync(join(tmpdir(), 'x030098-sa-'));
  handlers = {};
  bodies = [];
  sharing = true;
  vi.doMock('electron', () => ({ ipcMain: { handle: (ch: string, fn: any) => { handlers[ch] = fn; }, removeHandler: (ch: string) => { delete handlers[ch]; } } }));
  vi.doMock('../mobile_pwa', () => ({ getLocalIPs: () => ['192.0.2.10'] }));
  vi.doMock('../hardware/ram_detector', () => ({ detectHardwareTier: () => ({ ramGb: 16, recommendedModel: 'x' }) }));
  // The module writes its joined-state file under homedir()/.lb_substrate; redirect fs writes of that one file to scratch.
  vi.doMock('os', async () => { const real = await vi.importActual<typeof import('os')>('os'); return { ...real, homedir: () => scratch }; });
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => { bodies.push(init.body); return new Response('{}', { status: 200 }); }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.doUnmock('electron'); vi.doUnmock('../mobile_pwa'); vi.doUnmock('../hardware/ram_detector'); vi.doUnmock('os');
  rmSync(scratch, { recursive: true, force: true });
});

describe('Substrate Awakens handshake (X030-098 hole 3)', () => {
  test('switch OFF: nothing is sent to the relay and the reason is returned', async () => {
    sharing = false;
    const { cleanup } = await load(join(scratch, 'salt', 'beacon_salt.json'));
    const r = await handlers['substrate-awakens:handshake']({}, { token: 't', email: TEST_EMAIL, displayName: 'D' });
    expect(r).toMatchObject({ success: false, presenceSharingOff: true });
    expect(bodies.length).toBe(0);
    cleanup();
  });

  test('switch ON: salted hash, never the unsalted hash, never the salt, never the email', async () => {
    const saltPath = join(scratch, 'salt', 'beacon_salt.json');
    const { cleanup } = await load(saltPath);
    const r = await handlers['substrate-awakens:handshake']({}, { token: 't', email: TEST_EMAIL, displayName: 'D' });
    expect(r.success, JSON.stringify(r)).toBe(true);
    expect(bodies.length).toBe(1);
    const body = JSON.parse(bodies[0]);
    const unsaltedFull = createHash('sha256').update(TEST_EMAIL).digest('hex');
    const unsaltedNorm = createHash('sha256').update(TEST_EMAIL.trim().toLowerCase()).digest('hex');
    const salt = JSON.parse(readFileSync(saltPath, 'utf8')).salt as string;
    expect(body.email_hash).toMatch(/^[0-9a-f]{32}$/);
    for (const bad of [unsaltedFull, unsaltedNorm, unsaltedFull.slice(0, 32), unsaltedFull.slice(0, 16), salt, TEST_EMAIL]) {
      expect(bodies[0]).not.toContain(bad);
    }
    expect(body.peer_id).toBe(body.email_hash.slice(0, 16) + '-sa');
    expect(r.peerId).toBe(body.peer_id);
    cleanup();
  });

  test('two installs (two salts) publish two unlinkable hashes for the same email', async () => {
    const { m } = await load(join(scratch, 'a', 'beacon_salt.json'));
    const a = m.buildSubstrateAwakensIdentity(TEST_EMAIL, join(scratch, 'a', 'beacon_salt.json'));
    const b = m.buildSubstrateAwakensIdentity(TEST_EMAIL, join(scratch, 'b', 'beacon_salt.json'));
    expect(a.emailHash).not.toBe(b.emailHash);
    expect(m.buildSubstrateAwakensIdentity(TEST_EMAIL, join(scratch, 'a', 'beacon_salt.json'))).toEqual(a); // stable per install
  });

  test('corrupt salt file: no email_hash field at all, random peer id, salt file not overwritten', async () => {
    const saltPath = join(scratch, 'bad', 'beacon_salt.json');
    mkdirSync(join(scratch, 'bad'), { recursive: true });
    writeFileSync(saltPath, '{"salt":"nope"}');
    const { cleanup } = await load(saltPath);
    const r = await handlers['substrate-awakens:handshake']({}, { token: 't', email: TEST_EMAIL, displayName: 'D' });
    expect(r.success, JSON.stringify(r)).toBe(true);
    const body = JSON.parse(bodies[0]);
    expect(body).not.toHaveProperty('email_hash');
    expect(body.peer_id).toMatch(/^[0-9a-f]{16}-sa$/);
    expect(readFileSync(saltPath, 'utf8')).toBe('{"salt":"nope"}');
    cleanup();
  });

  test('heartbeat obeys the switch on every tick: turned off, nothing more is sent', async () => {
    vi.useFakeTimers();
    const { cleanup } = await load(join(scratch, 'hb', 'beacon_salt.json'));
    await handlers['substrate-awakens:handshake']({}, { token: 't', email: TEST_EMAIL, displayName: 'D' });
    expect(bodies.length).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(bodies.length).toBe(2);
    sharing = false;
    await vi.advanceTimersByTimeAsync(180_000);
    expect(bodies.length).toBe(2);
    cleanup();
  });

  test('the unsalted sha256 of the email is gone from the source', () => {
    const src = readFileSync(join(__dirname, 'substrate_awakens_ipc.ts'), 'utf8');
    expect(src).not.toMatch(/sha256hex\(email\)/);
    expect(src).not.toMatch(/createHash\('sha256'\)/);
  });
});
