// bishop_dispatch_relay_listener.default_off.test.ts -- D-BP223-BM0-X031-027: the bishop_dispatch relay listener (relay_routes
// poll + peer_presence heartbeat PATCH) does not start unless the user turned on bishopDispatchListener. fetch is stubbed;
// nothing leaves the machine.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('./peer-discovery', () => ({ getStablePeerId: () => 'p'.repeat(16) }));
vi.mock('../shared/anon_key', () => ({ getAnonKey: () => 'not-a-real-key', getSupabaseUrl: () => 'https://example.invalid' }));

import { startBishopDispatchRelayListenerWithDefaults } from './bishop_dispatch_relay_listener';
import { installTestOwnerSecret } from './relay_rpc_legacy_test_shim';

installTestOwnerSecret();

let dir = '';
const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]' }));

function settingsFile(body: unknown): string {
  const p = join(dir, 'config', 'network_feature_settings.json');
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(p, JSON.stringify(body));
  return p;
}

describe('bishop_dispatch relay listener default off (X031-027)', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'x031027-bdl-'));
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  test('no settings file: no poll, no heartbeat', async () => {
    const h = startBishopDispatchRelayListenerWithDefaults({ settingsPath: join(dir, 'absent.json') });
    await new Promise((r) => setTimeout(r, 20));
    h.stop();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('other switches on but bishopDispatchListener not set: no request', async () => {
    const h = startBishopDispatchRelayListenerWithDefaults({
      settingsPath: settingsFile({ answerOtherMembersQuestions: true, fleetBroadcastListener: true, diagnosticCheckin: true }),
    });
    await new Promise((r) => setTimeout(r, 20));
    h.stop();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('user turned it on: the first tick reaches relay_routes / peer_presence', async () => {
    const h = startBishopDispatchRelayListenerWithDefaults({ settingsPath: settingsFile({ bishopDispatchListener: true }) });
    await new Promise((r) => setTimeout(r, 50));
    h.stop();
    const urls = fetchSpy.mock.calls.map((a) => String((a as unknown as [string])[0]));
    expect(urls.length).toBeGreaterThan(0);
    // D-BP223-X043-010-RB: the poll now reaches relay_routes through the Phase A RPC.
    expect(urls.some((u) => u === 'https://example.invalid/rest/v1/rpc/routes_fetch_mine')).toBe(true);
  });
});
