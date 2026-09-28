// network_feature_settings.test.ts -- D-BP223-BM0-X031-024: the three network features are OFF until the user turns them on.
import { describe, test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isNetworkFeatureOn, resolveNetworkFeatures, setNetworkFeature, NETWORK_FEATURE_KEYS } from './network_feature_settings';

function fixture() {
  const d = mkdtempSync(join(tmpdir(), 'x031024-netfeat-'));
  return { d, settingsPath: join(d, 'config', 'network_feature_settings.json') };
}

describe('network feature switches (X031-024)', () => {
  test('all three are OFF with no settings file', () => {
    const f = fixture();
    try {
      for (const k of NETWORK_FEATURE_KEYS) expect(isNetworkFeatureOn(k, f.settingsPath)).toBe(false);
      expect(resolveNetworkFeatures(f.settingsPath).every((s) => s.enabled === false && s.source === 'default_off')).toBe(true);
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });

  test('unreadable file, non-boolean values ("true", 1) and missing keys all stay OFF', () => {
    const f = fixture();
    try {
      mkdirSync(join(f.d, 'config'), { recursive: true });
      writeFileSync(f.settingsPath, '{not json');
      for (const k of NETWORK_FEATURE_KEYS) expect(isNetworkFeatureOn(k, f.settingsPath)).toBe(false);
      writeFileSync(f.settingsPath, JSON.stringify({ answerOtherMembersQuestions: 'true', sendStatusReport: 1 }));
      for (const k of NETWORK_FEATURE_KEYS) expect(isNetworkFeatureOn(k, f.settingsPath)).toBe(false);
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });

  test('X031-027: the five LAN / fleet / dispatch / diagnostic switches exist, are OFF by default, and each turns on alone', () => {
    const f = fixture();
    const added = ['lanShareListener', 'lanPeerProbe', 'fleetBroadcastListener', 'bishopDispatchListener', 'diagnosticCheckin'] as const;
    try {
      for (const k of added) {
        expect(NETWORK_FEATURE_KEYS).toContain(k);
        expect(isNetworkFeatureOn(k, f.settingsPath)).toBe(false);
      }
      expect(NETWORK_FEATURE_KEYS).toHaveLength(8);
      for (const k of added) {
        setNetworkFeature(k, true, f.settingsPath);
        expect(isNetworkFeatureOn(k, f.settingsPath)).toBe(true);
        for (const other of NETWORK_FEATURE_KEYS.filter((o) => o !== k)) expect(isNetworkFeatureOn(other, f.settingsPath)).toBe(false);
        setNetworkFeature(k, false, f.settingsPath);
      }
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });

  test('X031-027: the mesh-machine file (all eight true) turns every switch on', () => {
    const f = fixture();
    try {
      mkdirSync(join(f.d, 'config'), { recursive: true });
      writeFileSync(f.settingsPath, JSON.stringify(Object.fromEntries(NETWORK_FEATURE_KEYS.map((k) => [k, true]))));
      expect(resolveNetworkFeatures(f.settingsPath).every((s) => s.enabled && s.source === 'user')).toBe(true);
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });

  test('an explicit user true turns exactly that feature on; the others stay off; a change keeps a Rule 66 sibling', () => {
    const f = fixture();
    try {
      setNetworkFeature('sendStatusReport', true, f.settingsPath);
      expect(isNetworkFeatureOn('sendStatusReport', f.settingsPath)).toBe(true);
      expect(isNetworkFeatureOn('answerOtherMembersQuestions', f.settingsPath)).toBe(false);
      expect(isNetworkFeatureOn('syncWithLianaBanyan', f.settingsPath)).toBe(false);
      setNetworkFeature('answerOtherMembersQuestions', true, f.settingsPath);
      expect(isNetworkFeatureOn('sendStatusReport', f.settingsPath)).toBe(true);
      expect(isNetworkFeatureOn('answerOtherMembersQuestions', f.settingsPath)).toBe(true);
      setNetworkFeature('sendStatusReport', false, f.settingsPath);
      expect(resolveNetworkFeatures(f.settingsPath).find((s) => s.key === 'sendStatusReport')).toMatchObject({ enabled: false, source: 'user' });
      expect(readdirSync(join(f.d, 'config')).some((n) => n.includes('.superseded.'))).toBe(true);
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });
});
