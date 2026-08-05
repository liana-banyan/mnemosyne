/**
 * mesh_trust_settings.ts — KN-BP144-16 Phase 1: LAN discovery opt-out.
 *
 * Founder-raised: unauthenticated LAN discovery/dispatch is exploitable and must default to
 * OFF now that signed announce/dispatch verification exists (this ticket). This is a flippable
 * SETTING, not a removal of the LAN discovery feature -- a user on a network they judge trusted
 * (or a peer running a pre-KN-BP144-16 build that cannot produce a signed announce yet) can turn
 * unauthenticated LAN discovery back on.
 *
 * This setting governs exactly one thing: whether the ABSENCE of a verifiable signature is
 * tolerated. It never governs a signature that IS present and fails verification -- a refused
 * signature stays refused regardless of this setting (see announce_frame.ts's own doc comment).
 *
 * Persisted at %APPDATA%\MnemosyneC\config\mesh_trust_settings.json, mirroring the existing
 * peer_label.txt directory convention (identity/peerIdentityCollector.ts).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ipcMain } from 'electron';

export interface MeshTrustSettings {
  /** Default false. False (default, secure): an unsigned/unverifiable LAN announce or dispatch
   *  request is REFUSED. True (legacy, opt-in): pre-KN-BP144-16 behavior -- unsigned announces
   *  and dispatch requests are accepted exactly as they always were. */
  allowUnauthenticatedLanDiscovery: boolean;
}

const DEFAULT_SETTINGS: MeshTrustSettings = {
  allowUnauthenticatedLanDiscovery: false,
};

function settingsFilePath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'mesh_trust_settings.json');
}

let _cached: MeshTrustSettings | null = null;

/** Reads the persisted setting, defaulting to secure (false) on first run OR on any read/parse
 *  error -- fails CLOSED, never fails open on a missing or corrupt settings file. */
export function getMeshTrustSettings(): MeshTrustSettings {
  if (_cached) return _cached;
  try {
    const f = settingsFilePath();
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8')) as Partial<MeshTrustSettings>;
      _cached = { allowUnauthenticatedLanDiscovery: parsed.allowUnauthenticatedLanDiscovery === true };
      return _cached;
    }
  } catch {
    // Corrupt or unreadable settings file -- fall through to the secure default below.
  }
  _cached = { ...DEFAULT_SETTINGS };
  return _cached;
}

export function isUnauthenticatedLanDiscoveryAllowed(): boolean {
  return getMeshTrustSettings().allowUnauthenticatedLanDiscovery === true;
}

/** Flips the setting and persists it. Returns the new settings object. */
export function setUnauthenticatedLanDiscoveryAllowed(allow: boolean): MeshTrustSettings {
  const next: MeshTrustSettings = { allowUnauthenticatedLanDiscovery: allow === true };
  try {
    const f = settingsFilePath();
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('[MeshTrustSettings] failed to persist setting (in-memory only for this session):', err);
  }
  _cached = next;
  return next;
}

/** Test-only: clears the in-memory cache so the next read re-hits disk. Exported because the
 *  module-level cache would otherwise make repeated test runs within one process see stale
 *  state after a settings-file swap. */
export function _resetMeshTrustSettingsCacheForTests(): void {
  _cached = null;
}

/**
 * KN-BP144-16 Phase 1: registers the two IPC handlers that make this setting flippable from a
 * renderer. No renderer UI is wired to these yet (out of this ticket's touched-file
 * constraints — see KN-BP144-16_REPORT.md) but the mechanism is live and callable today via
 * any ipcRenderer.invoke caller once preload.ts exposes the channel names. Call once at app
 * boot, mirroring the register*Ipc() pattern used by mic_ipc.ts / diagnosis_ipc.ts.
 */
export function registerMeshTrustSettingsIpc(): void {
  ipcMain.handle('mesh-trust:get-settings', () => getMeshTrustSettings());
  ipcMain.handle('mesh-trust:set-allow-unauthenticated-lan-discovery', (_evt, allow: boolean) =>
    setUnauthenticatedLanDiscoveryAllowed(allow),
  );
  console.log('[MeshTrustSettings] IPC handlers registered (KN-BP144-16)');
}
