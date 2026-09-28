// presence_share_settings.test.ts -- D-BP223-BM0-X030-073 P1: "Share presence with my other machines".
import { describe, test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePresenceShare, setSharePresenceChoice, countSameOwnerPeers, SHARE_PRESENCE_LABEL } from './presence_share_settings';

const OWNER = 'ab'.repeat(16);

function fixture() {
  const d = mkdtempSync(join(tmpdir(), 'x030073-presence-'));
  return { d, settingsPath: join(d, 'config', 'presence_share_settings.json'), registryPath: join(d, 'peer_enrollment_registry.json') };
}

describe('presence share switch (X030-073 P1)', () => {
  test('default OFF when nothing of mine is enrolled, or signed out, or the registry is unreadable', () => {
    const f = fixture();
    try {
      expect(resolvePresenceShare({ ...f, selfOwnerId: OWNER })).toMatchObject({ enabled: false, source: 'default_not_same_owner_mesh', label: SHARE_PRESENCE_LABEL });
      writeFileSync(f.registryPath, JSON.stringify({ p1: { public_key_hex: 'aa', owner_id: 'cd'.repeat(16) } }));
      expect(resolvePresenceShare({ ...f, selfOwnerId: OWNER }).enabled).toBe(false);
      writeFileSync(f.registryPath, JSON.stringify({ p1: { public_key_hex: 'aa', owner_id: OWNER } }));
      expect(resolvePresenceShare({ ...f, selfOwnerId: null }).enabled).toBe(false);
      writeFileSync(f.registryPath, '{not json');
      expect(resolvePresenceShare({ ...f, selfOwnerId: OWNER }).enabled).toBe(false);
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });

  test('default ON for a same-owner mesh (an enrolled peer carries my owner id)', () => {
    const f = fixture();
    try {
      writeFileSync(f.registryPath, JSON.stringify({ p1: { public_key_hex: 'aa', owner_id: OWNER.toUpperCase() }, p2: { owner_id: OWNER } }));
      expect(countSameOwnerPeers(f.registryPath, OWNER)).toBe(1);
      expect(resolvePresenceShare({ ...f, selfOwnerId: OWNER })).toMatchObject({ enabled: true, source: 'default_same_owner_mesh', sameOwnerPeers: 1 });
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });

  test('the user choice wins both ways and is versioned (Rule 66 sibling) when changed', () => {
    const f = fixture();
    try {
      writeFileSync(f.registryPath, JSON.stringify({ p1: { public_key_hex: 'aa', owner_id: OWNER } }));
      setSharePresenceChoice(false, f.settingsPath);
      expect(resolvePresenceShare({ ...f, selfOwnerId: OWNER })).toMatchObject({ enabled: false, source: 'user' });
      setSharePresenceChoice(true, f.settingsPath);
      expect(resolvePresenceShare({ ...f, selfOwnerId: null })).toMatchObject({ enabled: true, source: 'user' });
      expect(readdirSync(join(f.d, 'config')).some((n) => n.includes('.superseded.'))).toBe(true);
    } finally { rmSync(f.d, { recursive: true, force: true }); }
  });
});
