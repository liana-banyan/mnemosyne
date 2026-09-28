// index.fleet_broadcast_default_off.test.ts -- D-BP223-BM0-X031-027: the MIC / fleet_broadcast listener does not start unless
// the user turned on fleetBroadcastListener.
//
// OFFLINE, SOURCE-LEVEL + SWITCH-LEVEL. startMicBroadcastListener lives inside index.ts, which imports 'electron' at module
// scope (see index.relay_route_race_guard.test.ts for why that file is not imported in vitest). This test proves:
//   1. the gate is the first statement of startMicBroadcastListener and returns before the Supabase lookup, the 10 s
//      setInterval and the 2 s first poll are reached;
//   2. the gate reads the same switch module (and key) the other X031-024/027 switches use;
//   3. that switch is OFF with no file and ON when the user set it true.
import { describe, test, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isNetworkFeatureOn } from './startup/network_feature_settings';

const SRC = readFileSync(join(__dirname, 'index.ts'), 'utf8');

function listenerBody(): string {
  const start = SRC.indexOf('function startMicBroadcastListener(peerId: string, appVersion: string): void {');
  expect(start, 'startMicBroadcastListener not found in index.ts').toBeGreaterThan(-1);
  const end = SRC.indexOf('\nfunction ', start + 1);
  expect(end).toBeGreaterThan(start);
  return SRC.slice(start, end);
}

describe('MIC / fleet_broadcast listener default off (X031-027)', () => {
  test('index.ts imports isNetworkFeatureOn from startup/network_feature_settings', () => {
    expect(SRC).toMatch(/import \{[^}]*\bisNetworkFeatureOn\b[^}]*\} from '\.\/startup\/network_feature_settings';/);
  });

  test('the fleetBroadcastListener gate returns before any Supabase lookup, poll interval or first poll', () => {
    const body = listenerBody();
    const gate = body.indexOf("if (!isNetworkFeatureOn('fleetBroadcastListener')) {");
    expect(gate).toBeGreaterThan(-1);
    const gateReturn = body.indexOf('return;', gate);
    expect(gateReturn).toBeGreaterThan(gate);
    for (const later of ['getSupabaseUrl()', 'setInterval(pollBroadcasts, 10000)', 'setTimeout(pollBroadcasts, 2000)']) {
      const at = body.indexOf(later);
      expect(at, `${later} not found`).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(gateReturn);
    }
    // Nothing but comments precedes the gate inside the function body.
    const beforeGate = body.slice(body.indexOf('{') + 1, gate).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
    expect(beforeGate).toEqual([]);
  });

  test('the switch the gate reads is OFF with no file and ON when the user set it true', () => {
    const d = mkdtempSync(join(tmpdir(), 'x031027-fleet-'));
    try {
      const p = join(d, 'config', 'network_feature_settings.json');
      expect(isNetworkFeatureOn('fleetBroadcastListener', p)).toBe(false);
      mkdirSync(join(d, 'config'), { recursive: true });
      writeFileSync(p, JSON.stringify({ fleetBroadcastListener: 'true' }));
      expect(isNetworkFeatureOn('fleetBroadcastListener', p)).toBe(false);
      writeFileSync(p, JSON.stringify({ fleetBroadcastListener: true }));
      expect(isNetworkFeatureOn('fleetBroadcastListener', p)).toBe(true);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
