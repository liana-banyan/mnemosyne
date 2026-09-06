/**
 * mesh_remote_admin_consent.ts -- D-BP202-M0-01-h2cbp8us-001/BISHOP/BM01.
 *
 * LAW 4 WAS ASKED BEFORE THIS FILE WAS WRITTEN. The Korsaikoff gate named four candidates and
 * every one was opened and read. None of them does this, and each is named here so nobody has to
 * re-derive that verdict:
 *   - mesh_auto_spawn_consent.ts   gates the PERMISSION MODE of a worker MnemosyneC itself spawns.
 *   - mesh_trust_settings.ts       gates whether an UNSIGNED LAN peer is accepted at all.
 *   - provision_mesh_admin.ps1     IS the thing being gated. It carries no consent flag of its own.
 *   - MESH_CONSENT_GATE_VERDICT_BP148.md  is a read-only audit, not a mechanism.
 *
 * THE THIRD CONSENT. It is a materially different decision from BOTH of the two that already
 * exist, which is the entire reason it is a separate file and a separate persisted flag rather
 * than another boolean bolted onto one of them:
 *
 *   1. AutoUpdateConfig.autoUpdates (auto_update_scheduler.ts) permits a VERSION BUMP.
 *   2. MeshAutoSpawnConsentSettings.consentGranted (mesh_auto_spawn_consent.ts) permits TOOL
 *      EXECUTION INSIDE MnemosyneC, driven by another machine's dispatch.
 *   3. This file permits REMOTE ADMINISTRATION OF THE WHOLE COMPUTER -- a standing local
 *      administrator account (`lbmesh`) plus PowerShell Remoting on port 5985, through which
 *      another machine can install software, read and write any file, and run any command as an
 *      administrator, entirely outside MnemosyneC.
 *
 * mesh_auto_spawn_consent.ts's own header states the principle this file extends: "permitting a
 * version bump is a materially different decision from permitting tool execution driven by
 * another machine." Permitting administration of the entire operating system is a third step
 * further out again, and it is the largest of the three by a wide margin.
 *
 * GOVERNING RULINGS, cited rather than re-derived:
 *   FD-BP156-04 (Founder, verbatim): "the LAN is a carrier and NEVER a trust boundary. Proximity
 *     must never imply consent."
 *   FD-BP157-05 (Founder, verbatim): "we have consent gates built - add to them, and implement
 *     if not wired, as usual."
 *
 * ── WHAT THIS FLAG HONESTLY DOES, AND WHAT IT HONESTLY CANNOT DO ────────────────────────────
 *
 * READ THIS BEFORE TRUSTING IT, because a consent toggle that cannot enforce its own decision is
 * theater, and saying so plainly is cheaper than someone discovering it later.
 *
 * IT CANNOT close WinRM. PowerShell Remoting is a Windows service and a firewall rule. Once
 * `provision_mesh_admin.ps1` has run on a machine, port 5985 is open and the `lbmesh` account
 * exists at the OS level, where an Electron app has no authority to intervene. Setting this flag
 * to false does NOT disable remote administration that is already provisioned. Only
 * `Disable-PSRemoting` and removing the account do that, and the UI panel says exactly that to
 * the user's face rather than implying a protection it does not provide.
 *
 * WHAT IT DOES DO is give the ADMINISTERING side something real to check. This machine's declared
 * answer to "may another machine administer me" is published on peer_server's /api/info as
 * `remoteAdminConsent`. The machine that is about to reach out reads that field FIRST and refuses
 * to proceed when it is false. That is the enforcement point, and it sits on the side that
 * actually performs the action, which is the only side that can decline to perform it.
 *
 * This is deliberately the same shape as the trust model everywhere else in this codebase: the
 * declaration is authoritative, the actor is obligated to honor it, and the transport is never
 * mistaken for the authority. An attacker who ignores the field was never going to be stopped by
 * a checkbox on the victim's machine; a well-behaved peer is stopped, and every peer this estate
 * ships is a well-behaved peer.
 *
 * OFF by default. A fresh install, a corrupt settings file, or any main-process error reading it
 * all resolve to false (fails CLOSED), never true. Mirrors mesh_auto_spawn_consent.ts's shape
 * exactly: same %APPDATA%\MnemosyneC\config\ directory, same fail-closed default, same in-memory
 * cache plus test-reset, same "<domain>:get-settings" / "<domain>:set-<field>" IPC naming.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ipcMain } from 'electron';

export interface MeshRemoteAdminConsentSettings {
  /** Default false. False (default, safe): this machine PUBLISHES that it does not consent to
   *  remote administration, and a well-behaved peer reading /api/info must not attempt an
   *  administrative action against it. True (opt-in, explicit): this machine publishes that the
   *  operator has deliberately allowed another machine on the mesh to administer it through the
   *  provisioned `lbmesh` account over WinRM. Note the asymmetry documented in this file's
   *  header: turning this ON is a real grant, but turning it OFF does not by itself close a
   *  WinRM listener that has already been provisioned at the OS level. */
  consentGranted: boolean;
}

const DEFAULT_SETTINGS: MeshRemoteAdminConsentSettings = {
  consentGranted: false,
};

function settingsFilePath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'mesh_remote_admin_consent.json');
}

let _cached: MeshRemoteAdminConsentSettings | null = null;

/** Reads the persisted setting, defaulting to OFF (false) on first run OR on any read/parse
 *  error -- fails CLOSED, never fails open on a missing or corrupt settings file. Mirrors
 *  getMeshAutoSpawnConsentSettings() exactly, same rationale. */
export function getMeshRemoteAdminConsentSettings(): MeshRemoteAdminConsentSettings {
  if (_cached) return _cached;
  try {
    const f = settingsFilePath();
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8')) as Partial<MeshRemoteAdminConsentSettings>;
      _cached = { consentGranted: parsed.consentGranted === true };
      return _cached;
    }
  } catch {
    // Corrupt or unreadable settings file -- fall through to the closed default below.
  }
  _cached = { ...DEFAULT_SETTINGS };
  return _cached;
}

/** The one function every reader calls -- peer_server.ts's /api/info handler today, and any
 *  future in-app remote-administration action. Kept as its own named export (rather than
 *  inlining getMeshRemoteAdminConsentSettings().consentGranted at each call site) for the same
 *  reason isMeshAutoSpawnConsentGranted() exists: one obvious place for a second reader to
 *  import from. */
export function isRemoteAdministrationConsentGranted(): boolean {
  return getMeshRemoteAdminConsentSettings().consentGranted === true;
}

/** Flips the setting and persists it. Returns the new settings object. A write failure (disk
 *  full, permissions) logs and leaves the in-memory cache updated for this process's lifetime
 *  only -- mirrors setMeshAutoSpawnConsentGranted()'s own behavior. */
export function setRemoteAdministrationConsentGranted(granted: boolean): MeshRemoteAdminConsentSettings {
  const next: MeshRemoteAdminConsentSettings = { consentGranted: granted === true };
  try {
    const f = settingsFilePath();
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('[MeshRemoteAdminConsent] failed to persist setting (in-memory only for this session):', err);
  }
  _cached = next;
  return next;
}

/** Test-only: clears the in-memory cache so the next read re-hits disk. Exported for the same
 *  reason _resetMeshAutoSpawnConsentCacheForTests() is: repeated test runs within one process
 *  would otherwise see stale state after a settings-file swap. */
export function _resetMeshRemoteAdminConsentCacheForTests(): void {
  _cached = null;
}

/**
 * Registers the two IPC handlers that make this consent flippable from a renderer. Call once at
 * app boot, alongside registerMeshAutoSpawnConsentIpc() -- mirrors that function's registration
 * pattern exactly, same channel-naming convention ("mesh-remote-admin-consent:get-settings" /
 * "mesh-remote-admin-consent:set-consent-granted"). The renderer side is wired in the SAME pass
 * (DiagnosticModeTab.tsx's RemoteAdministrationConsentPanel, compass/AuthorizationsPanel.tsx,
 * preload.ts, amplify.d.ts), per the standing rule that when you build it, you wire it.
 */
export function registerMeshRemoteAdminConsentIpc(): void {
  ipcMain.handle('mesh-remote-admin-consent:get-settings', () => getMeshRemoteAdminConsentSettings());
  ipcMain.handle('mesh-remote-admin-consent:set-consent-granted', (_evt, granted: boolean) =>
    setRemoteAdministrationConsentGranted(granted),
  );
  console.log('[MeshRemoteAdminConsent] IPC handlers registered (D-BP202-M0-01-h2cbp8us-001)');
}
