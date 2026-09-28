// federation_client.default_off.test.ts -- D-BP223-BM0-X031-024: no lianabanyan.com request (health, record push, record
// pull) unless the user turned on syncWithLianaBanyan. fetch is stubbed; start() is not called (it opens a LAN port).
// D-BP223-BM0-X031-027 adds: no LAN listener on :11481 and no LAN probe unless lanShareListener / lanPeerProbe is on.
// Those tests call start() with _startAnnounceServer / _scanLocalPeers / _probePeer spied, so no port opens.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('caithedral-core/tools/dag_soccerball', () => ({ dag_soccerball_lookup: () => null }));

let dir = '';
const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ records: [] }) }));
const RECORD = { id: 'r1', text: 'local note', source: 'external_write', keywords: [], ts: '2026-09-17T00:00:00Z' };
const fakeIndex = { writeRecord: () => {}, records: [] } as unknown as import('./substrate_router').SubstrateLocalIndex;

function settingsFile(body: unknown): string {
  const p = join(dir, 'config', 'network_feature_settings.json');
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(p, JSON.stringify(body));
  return p;
}

async function makeClient(settingsPath: string) {
  process.env.APPDATA = dir; // FEDERATION_DATA_DIR resolves under the temp dir, never the real profile
  vi.resetModules();
  const { FederationClient } = await import('./federation_client');
  return new FederationClient(fakeIndex, { settingsPath });
}

describe('federation lianabanyan.com sync default off (X031-024)', () => {
  const realAppData = process.env.APPDATA;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'x031024-fed-'));
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.APPDATA = realAppData;
  });

  test('no settings file: connectivity check, queue and sync cycle make no request', async () => {
    const c = await makeClient(join(dir, 'absent.json'));
    expect(await c.checkAndUpdateConnectivity()).toBe(false);
    c.queueWrite(RECORD);
    expect(c.getStatus().pendingWriteCount).toBe(0);
    await (c as unknown as { _syncCycle: () => Promise<void> })._syncCycle();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // X031-027: start() is called with the LAN listener and LAN scan spied, so no port is opened and no address is probed.
  async function startWithSpies(settingsPath: string) {
    const c = await makeClient(settingsPath);
    const proto = Object.getPrototypeOf(c) as Record<string, unknown>;
    const listen = vi.spyOn(proto as never, '_startAnnounceServer' as never).mockResolvedValue(undefined as never);
    const scan = vi.spyOn(proto as never, '_scanLocalPeers' as never).mockResolvedValue(undefined as never);
    const connect = vi.spyOn(proto as never, '_probePeer' as never).mockResolvedValue(null as never);
    await c.start();
    await c.stop();
    return { c, listen, scan, connect };
  }

  test('X031-027 no settings file: start() opens no LAN listener, runs no LAN probe, and syncWithPeer makes no connection', async () => {
    const { c, listen, scan, connect } = await startWithSpies(join(dir, 'absent.json'));
    expect(listen).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(await c.syncWithPeer({ address: '192.0.2.1', port: 11481, lastSeen: new Date().toISOString() })).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('X031-027 lanShareListener on alone: the listener starts, the probe does not', async () => {
    const { listen, scan } = await startWithSpies(settingsFile({ lanShareListener: true }));
    expect(listen).toHaveBeenCalledTimes(1);
    expect(scan).not.toHaveBeenCalled();
  });

  test('X031-027 lanPeerProbe on alone: the probe runs, the listener does not start', async () => {
    const { listen, scan } = await startWithSpies(settingsFile({ lanPeerProbe: true }));
    expect(listen).not.toHaveBeenCalled();
    expect(scan).toHaveBeenCalledTimes(1);
  });

  test('user turned it on: health check, push of the queued record and pull all reach lianabanyan.com', async () => {
    const c = await makeClient(settingsFile({ syncWithLianaBanyan: true }));
    c.queueWrite(RECORD);
    expect(c.getStatus().pendingWriteCount).toBe(1);
    await (c as unknown as { _syncCycle: () => Promise<void> })._syncCycle();
    const urls = fetchSpy.mock.calls.map((a) => (a as unknown as [string])[0]);
    expect(urls).toEqual([
      'https://lianabanyan.com/api/health',
      'https://lianabanyan.com/api/substrate/write',
      'https://lianabanyan.com/api/substrate/sync',
    ]);
  });
});
