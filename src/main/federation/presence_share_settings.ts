/**
 * presence_share_settings.ts -- D-BP223-BM0-X030-073-STALE-STATE-AND-PRIVACY-FIXES, P1.
 *
 * XO X030 pick on Founder k/0a8d1c96: a user switch "Share presence with my other machines". Default ON for a same-owner
 * mesh, OFF otherwise. ONE switch turns off the beacon (the 60 s presence publish AND the 30 s heartbeat worker, both of
 * which post to relay.lianabanyan.com).
 *
 * "SAME-OWNER MESH" (deterministic, no network): this machine is signed in (it has an owner id, the LB session email hash
 * X030-067 uses) AND its enrollment registry holds at least one enrolled peer whose TOTP-gated owner_id equals that owner
 * id. Anything else (signed out, nothing enrolled, only other people's machines enrolled, registry unreadable) = OFF.
 *
 * An explicit user choice always wins over the default. The file holds only that choice:
 *   %APPDATA%\MnemosyneC\config\presence_share_settings.json  { "sharePresenceWithMyMachines": true | false }
 * An unreadable settings file counts as "no choice made" and the default applies; it is never rewritten silently.
 *
 * Port 7474 is NOT governed by this switch (P2 governs it: every route signed except a minimal health ping, bind stays LAN).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadPeerEnrollmentRegistry } from '../thorax/peer_enrollment_registry';

export const SHARE_PRESENCE_LABEL = 'Share presence with my other machines';

export function presenceShareSettingsPath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'presence_share_settings.json');
}

export interface PresenceShareState {
  enabled: boolean;
  source: 'user' | 'default_same_owner_mesh' | 'default_not_same_owner_mesh';
  sameOwnerMesh: boolean;
  sameOwnerPeers: number;
  label: string;
  settingsPath: string;
}

function readUserChoice(settingsPath: string): boolean | null {
  try {
    if (!existsSync(settingsPath)) return null;
    const j = JSON.parse(readFileSync(settingsPath, 'utf8')) as { sharePresenceWithMyMachines?: unknown };
    return typeof j.sharePresenceWithMyMachines === 'boolean' ? j.sharePresenceWithMyMachines : null;
  } catch {
    return null;
  }
}

/** Count of enrolled peers bound to this owner. 0 when signed out or the registry is unreadable. */
export function countSameOwnerPeers(registryPath: string | null, selfOwnerId: string | null): number {
  const self = (selfOwnerId ?? '').trim().toLowerCase();
  if (!registryPath || !/^[0-9a-f]{16,64}$/.test(self)) return 0;
  const reg = loadPeerEnrollmentRegistry(registryPath) as Record<string, { public_key_hex?: string; owner_id?: string }>;
  return Object.values(reg).filter((r) => r && r.public_key_hex && typeof r.owner_id === 'string' && r.owner_id.trim().toLowerCase() === self).length;
}

export function resolvePresenceShare(opts: { settingsPath?: string; registryPath: string | null; selfOwnerId: string | null }): PresenceShareState {
  const settingsPath = opts.settingsPath ?? presenceShareSettingsPath();
  const sameOwnerPeers = countSameOwnerPeers(opts.registryPath, opts.selfOwnerId);
  const sameOwnerMesh = sameOwnerPeers > 0;
  const choice = readUserChoice(settingsPath);
  if (choice !== null) return { enabled: choice, source: 'user', sameOwnerMesh, sameOwnerPeers, label: SHARE_PRESENCE_LABEL, settingsPath };
  return { enabled: sameOwnerMesh, source: sameOwnerMesh ? 'default_same_owner_mesh' : 'default_not_same_owner_mesh', sameOwnerMesh, sameOwnerPeers, label: SHARE_PRESENCE_LABEL, settingsPath };
}

/** Records the user's choice. Rule 66: an existing file is copied to a .superseded.<UTC>.json sibling first. */
export function setSharePresenceChoice(enabled: boolean, settingsPath: string = presenceShareSettingsPath()): void {
  mkdirSync(dirname(settingsPath), { recursive: true });
  if (existsSync(settingsPath)) {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    copyFileSync(settingsPath, settingsPath.replace(/\.json$/, `.superseded.${ts}.json`));
  }
  writeFileSync(settingsPath, JSON.stringify({
    sharePresenceWithMyMachines: enabled,
    set_utc: new Date().toISOString(),
    label: SHARE_PRESENCE_LABEL,
    note: 'D-BP223-BM0-X030-073 P1: one switch for the relay beacon (presence publish + heartbeat worker).',
  }, null, 2), 'utf8');
}
