/**
 * mesh_auto_spawn_consent.ts -- D-BP157-033/BISHOP/seg-worker-permission-consent.
 *
 * THE CAUSE THIS CLOSES (confirmed, not inferred, before this file was written): a live
 * M0-to-M0 dispatch measured a worker spawned, exiting code 0, with its entire captured log a
 * single newline byte (issue NO_COMPLETION_SENTINEL). bishop_dispatch_handler.ts's launchWorker()
 * builds its argv with `--permission-mode getSpawnPermissionMode()`, which defaults to the
 * literal string "default" (DEFAULT_PERMISSION_MODE). `claude --help` (run this session, no
 * agent spawned) confirms the installed CLI's `--permission-mode` accepts exactly:
 * "acceptEdits", "bypassPermissions", "default", "plan". Under "default" mode, a non-interactive,
 * detached (`stdio` captured to a log file, no human attached) worker has no one to approve a
 * tool call, so it can write nothing and run nothing -- consistent with the measured 1-byte log.
 *
 * FD-BP157-04 (Founder, verbatim): "I still want to have auto-spawn to work across the mesh,
 * assuming consent toggled on, for that instance of MnemosyneC."
 * FD-BP157-05 (Founder, verbatim): "we have consent gates built - add to them, and implement if
 * not wired, as usual."
 * FD-BP156-04: "the LAN is a carrier and NEVER a trust boundary. Proximity must never imply
 * consent."
 *
 * This module is the NEW consent gate FD-BP157-05 asks for, built by mirroring
 * mesh_trust_settings.ts's own shape exactly: same persistence directory convention (a JSON file
 * under %APPDATA%\MnemosyneC\config\), same fail-closed-on-any-error default, same in-memory
 * cache + test-reset function, same "<domain>:get-settings" / "<domain>:set-<field>" IPC
 * channel-naming convention. It is a SEPARATE file, and a SEPARATE persisted flag, from BOTH:
 *   - AutoUpdateConfig.autoUpdates (auto_update_scheduler.ts, DiagnosticModeTab.tsx's
 *     AutomaticUpdatesConsentPanel) -- permitting a version bump is a materially different
 *     decision from permitting tool execution driven by another machine, per this dispatch's own
 *     instruction.
 *   - LB_MESH_AUTO_SPAWN_ENABLED (bishop_dispatch_handler.ts's isAutoSpawnEnabled(), the existing
 *     operator-set kill switch that gates whether a worker is spawned AT ALL) -- this file's
 *     toggle does NOT gate whether a worker is spawned; it gates only which permission mode a
 *     worker that is ALREADY going to be spawned (kill switch on) runs under. See
 *     resolveEffectivePermissionMode() in bishop_dispatch_handler.ts, the sole reader of
 *     isMeshAutoSpawnConsentGranted() below, for the exact two-gate truth table.
 *
 * OFF by default. A fresh install, a corrupt settings file, or any main-process error reading it
 * all resolve to false (fails CLOSED), never true.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ipcMain } from 'electron';

export interface MeshAutoSpawnConsentSettings {
  /** Default false. False (default, safe): a mesh-auto-spawned worker on this machine -- if the
   *  separate LB_MESH_AUTO_SPAWN_ENABLED kill switch is also on -- still launches, but under the
   *  existing restrictive permission mode (bishop_dispatch_handler.ts's own
   *  getSpawnPermissionMode(), default "default"). A non-interactive worker under that mode has
   *  no human present to approve a tool call, so it cannot write files or run commands -- this is
   *  today's behavior, unchanged, and it is the exact measured D-BP157-033 "exits 0, writes
   *  nothing" shape. True (opt-in, explicit): the worker instead launches under an elevated
   *  permission mode (bishop_dispatch_handler.ts's getElevatedSpawnPermissionMode(), default
   *  "bypassPermissions" -- one of the four modes `claude --help` lists) that lets it actually
   *  perform the work a dispatch asks for, unattended. */
  consentGranted: boolean;
}

const DEFAULT_SETTINGS: MeshAutoSpawnConsentSettings = {
  consentGranted: false,
};

function settingsFilePath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'mesh_auto_spawn_consent.json');
}

let _cached: MeshAutoSpawnConsentSettings | null = null;

/** Reads the persisted setting, defaulting to OFF (false) on first run OR on any read/parse
 *  error -- fails CLOSED, never fails open on a missing or corrupt settings file. Mirrors
 *  mesh_trust_settings.ts's getMeshTrustSettings() exactly, same rationale. */
export function getMeshAutoSpawnConsentSettings(): MeshAutoSpawnConsentSettings {
  if (_cached) return _cached;
  try {
    const f = settingsFilePath();
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8')) as Partial<MeshAutoSpawnConsentSettings>;
      _cached = { consentGranted: parsed.consentGranted === true };
      return _cached;
    }
  } catch {
    // Corrupt or unreadable settings file -- fall through to the closed default below.
  }
  _cached = { ...DEFAULT_SETTINGS };
  return _cached;
}

/** The one function bishop_dispatch_handler.ts's resolveEffectivePermissionMode() calls -- kept
 *  as its own named export (rather than inlining getMeshAutoSpawnConsentSettings().consentGranted
 *  at every call site) so a future second reader has one obvious place to import from, matching
 *  isUnauthenticatedLanDiscoveryAllowed()'s own role for mesh_trust_settings.ts. */
export function isMeshAutoSpawnConsentGranted(): boolean {
  return getMeshAutoSpawnConsentSettings().consentGranted === true;
}

/** Flips the setting and persists it. Returns the new settings object. A write failure (disk
 *  full, permissions) logs and leaves the in-memory cache updated for this process's lifetime
 *  only -- mirrors mesh_trust_settings.ts's own setUnauthenticatedLanDiscoveryAllowed(). */
export function setMeshAutoSpawnConsentGranted(granted: boolean): MeshAutoSpawnConsentSettings {
  const next: MeshAutoSpawnConsentSettings = { consentGranted: granted === true };
  try {
    const f = settingsFilePath();
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('[MeshAutoSpawnConsent] failed to persist setting (in-memory only for this session):', err);
  }
  _cached = next;
  return next;
}

/** Test-only: clears the in-memory cache so the next read re-hits disk. Exported for the same
 *  reason mesh_trust_settings.ts exports _resetMeshTrustSettingsCacheForTests(): repeated test
 *  runs within one process would otherwise see stale state after a settings-file swap. */
export function _resetMeshAutoSpawnConsentCacheForTests(): void {
  _cached = null;
}

/**
 * Registers the two IPC handlers that make this consent flippable from a renderer. Call once at
 * app boot, alongside registerMeshTrustSettingsIpc() -- mirrors that function's own registration
 * pattern exactly, same channel-naming convention ("mesh-auto-spawn-consent:get-settings" /
 * "mesh-auto-spawn-consent:set-consent-granted"). Unlike mesh_trust_settings.ts at the time it was
 * written, this dispatch ALSO wires the renderer side (DiagnosticModeTab.tsx's
 * MeshAutoSpawnConsentPanel, preload.ts, amplify.d.ts) in the same pass -- the Founder's own
 * instruction was "add to them, and implement if not wired."
 */
export function registerMeshAutoSpawnConsentIpc(): void {
  ipcMain.handle('mesh-auto-spawn-consent:get-settings', () => getMeshAutoSpawnConsentSettings());
  ipcMain.handle('mesh-auto-spawn-consent:set-consent-granted', (_evt, granted: boolean) =>
    setMeshAutoSpawnConsentGranted(granted),
  );
  console.log('[MeshAutoSpawnConsent] IPC handlers registered (D-BP157-033)');
}
