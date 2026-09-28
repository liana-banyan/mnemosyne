// diagnostic_poller.default_off.test.ts -- D-BP223-BM0-X031-027: the diagnostic-mode check-in timer is not armed unless the
// user turned on diagnosticCheckin. fetch is stubbed and timers are faked; nothing leaves the machine.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('electron', () => ({ app: { getVersion: () => '0.0.0-test', getPath: () => tmpdir() } }));
vi.mock('../federation/peer-discovery', () => ({ getStablePeerId: () => 'p'.repeat(16) }));
vi.mock('../shared/anon_key', () => ({ getAnonKey: () => 'not-a-real-key', getSupabaseUrl: () => 'https://example.invalid' }));

import * as diag from './index';

let dir = '';
const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }));

function settingsFile(body: unknown): string {
  const p = join(dir, 'config', 'network_feature_settings.json');
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(p, JSON.stringify(body));
  return p;
}

describe('diagnostic mode check-in default off (X031-027)', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'x031027-diagmode-'));
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.useFakeTimers();
  });
  afterEach(() => {
    diag.stopDiagnosticPoller();
    diag.revokeLocalPermission();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('no settings file: the poller is not started, and even a local permission window sends nothing', async () => {
    diag.startDiagnosticPoller({ settingsPath: join(dir, 'absent.json') });
    expect(diag.pollerStarted).toBe(false);
    diag.activateLocalPermission(5);
    await vi.advanceTimersByTimeAsync(130_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('other switches on but diagnosticCheckin not set: not started', () => {
    diag.startDiagnosticPoller({ settingsPath: settingsFile({ fleetBroadcastListener: true, bishopDispatchListener: true }) });
    expect(diag.pollerStarted).toBe(false);
  });

  test('user turned it on: the poller starts; idle without permission, polls claim-diagnostic-output once permission is granted', async () => {
    diag.startDiagnosticPoller({ settingsPath: settingsFile({ diagnosticCheckin: true }) });
    expect(diag.pollerStarted).toBe(true);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(fetchSpy).not.toHaveBeenCalled();
    diag.activateLocalPermission(5);
    await vi.advanceTimersByTimeAsync(61_000);
    const urls = fetchSpy.mock.calls.map((a) => String((a as unknown as [string])[0]));
    expect(urls).toContain('https://example.invalid/functions/v1/claim-diagnostic-output');
  });
});
