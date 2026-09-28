// startup_diagnostic.default_off.test.ts -- D-BP223-BM0-X031-024: the status report is not sent unless the user turned on
// sendStatusReport. fetch is stubbed; nothing leaves the machine.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('electron', () => ({ app: { getVersion: () => '0.0.0-test' } }));
vi.mock('../env_loader', () => ({
  getEnvLoaderStatus: () => ({
    supabaseUrl: 'https://example.invalid', supabaseUrlSource: 'unresolved', anonKeySource: 'unresolved',
    anonKeyHash: 'hash', pathsChecked: [],
  }),
}));
vi.mock('../federation/peer-discovery', () => ({ getStablePeerId: () => 'p'.repeat(16) }));
vi.mock('../ollama_manager', () => ({
  OllamaManager: class { listModels() { return Promise.resolve([]); } isReachable() { return Promise.resolve(false); } },
}));
vi.mock('../shared/anon_key', () => ({ getAnonKey: () => 'not-a-real-key', getSupabaseUrl: () => 'https://example.invalid' }));
vi.mock('./index', () => ({ relayPollerStarted: false, relayPollerLastHeartbeat: null, relayPollerLastError: null }));
vi.mock('../beacons_lit/index', () => ({ getState: () => ({ active: false, handshakeOk: false }) }));

import { submitStartupDiagnostic } from './startup_diagnostic';

let dir = '';
const fetchSpy = vi.fn(async () => ({ json: async () => ({ ok: true, id: 1 }) }));

function settingsFile(body: unknown): string {
  const p = join(dir, 'config', 'network_feature_settings.json');
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(p, JSON.stringify(body));
  return p;
}

describe('startup status report default off (X031-024)', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'x031024-diag-'));
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  test('no settings file: no request is made', async () => {
    await submitStartupDiagnostic({ settingsPath: join(dir, 'absent.json') });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('other features on but sendStatusReport not set: no request is made', async () => {
    await submitStartupDiagnostic({ settingsPath: settingsFile({ answerOtherMembersQuestions: true, syncWithLianaBanyan: true }) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('user turned it on: one POST to submit-peer-startup-state', async () => {
    await submitStartupDiagnostic({ settingsPath: settingsFile({ sendStatusReport: true }) });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, { method: string }];
    expect(url).toBe('https://example.invalid/functions/v1/submit-peer-startup-state');
    expect(init.method).toBe('POST');
  });
});
