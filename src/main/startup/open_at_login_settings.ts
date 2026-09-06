// open_at_login_settings.ts -- D-BP163-M0-050/BISHOP/SEG-CX
//
// Founder's order (BP163 close, verbatim, relayed via the dispatch): "And can we build that
// start on startup into Mnemosynec so it always does that." This module is the mechanism:
// Electron's own per-user, no-administrator-required app.setLoginItemSettings(), NEVER the
// Scheduled-Task approach that had to be registered by hand in an elevated window at BP163
// close (see legacy_autostart_task_detector.ts's header for why that path does not ship to
// any member other than this M0 machine, and for the double-launch hazard it creates if this
// module ever enabled Electron's login item on top of it without checking first).
//
// STORE: follows the SAME convention resident/resident_settings.ts documents and uses --
// app.getPath('userData') + one small JSON file per concern, same directory family as
// brain_registry.ts and mesh_trust_settings.ts. There is no single monolithic settings file in
// this app; "one JSON file per concern" IS the existing convention, so
// open_at_login_settings.json is using it, not inventing a second store.
//
// DEFAULT: OFF. Decided and justified per the dispatch's explicit instruction to choose and
// justify rather than duck the question:
//   1. Doctrine precedent -- resident_settings.ts (KN-BP147-M2, Founder-quoted PROV_24) already
//      settled this exact shape of question ("persist across sessions... for me") with "the
//      user holds this switch, it is not a promise the agent makes." Auto-launching the whole
//      application at every Windows logon is a bigger behavior change than the WATCH poll that
//      doctrine was written for, so the same fail-closed default applies at least as strongly.
//   2. The hazard is LIVE, not hypothetical, on the one machine this ships to first: M0
//      currently has Bishop_MnemosyneC_Autostart_M0 registered and Ready. This module refuses
//      to enable Electron's login item at all while that task is detected present (see
//      applyPreferenceToOS() below), but a stored ON default would still leave the preference
//      armed and waiting -- the instant the legacy task is later removed (by the Founder,
//      via the command legacy_autostart_task_detector.ts exports), a default-ON preference
//      would silently start autostarting the app with no explicit member action in between.
//      OFF means removing the legacy task changes nothing on its own; the member still has to
//      elect the toggle once.
//   3. Symmetry with the dispatch's own framing: "Defaulting ON without asking is a
//      machine-behavior change made on the member's behalf." A fresh install of MnemosyneC
//      should not silently add itself to a stranger's Windows startup list before they have
//      seen the Settings panel once.
// Trivially reversible either way: one JSON boolean, one Settings-panel toggle, one
// app.setLoginItemSettings() call to unwind it.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { detectLegacyAutostartTask, LegacyAutostartTaskStatus } from './legacy_autostart_task_detector';

export interface OpenAtLoginSettings {
  /** The member's elected preference. Applied to the OS via app.setLoginItemSettings() --
   *  see applyPreferenceToOS(). Default false; see this file's header for the full
   *  justification. */
  openAtLogin: boolean;
}

const DEFAULT_SETTINGS: OpenAtLoginSettings = {
  openAtLogin: false,
};

const STORE_FILENAME = 'open_at_login_settings.json';

function settingsFilePath(): string {
  return join(app.getPath('userData'), STORE_FILENAME);
}

let _cached: OpenAtLoginSettings | null = null;

/** Reads the persisted preference, defaulting to OFF on first run or on any read/parse error.
 *  Fails CLOSED, never open -- same doctrine as resident_settings.ts and mesh_trust_settings.ts. */
export function getOpenAtLoginPreference(): OpenAtLoginSettings {
  if (_cached) return _cached;
  try {
    const f = settingsFilePath();
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8')) as Partial<OpenAtLoginSettings>;
      _cached = { openAtLogin: parsed.openAtLogin === true };
      return _cached;
    }
  } catch {
    // Corrupt or unreadable settings file -- fall through to the narrowest default below.
  }
  _cached = { ...DEFAULT_SETTINGS };
  return _cached;
}

function persist(next: OpenAtLoginSettings): OpenAtLoginSettings {
  try {
    const f = settingsFilePath();
    mkdirSync(join(app.getPath('userData')), { recursive: true });
    writeFileSync(f, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('[OpenAtLoginSettings] failed to persist preference (in-memory only for this session):', err);
  }
  _cached = next;
  return next;
}

/** Live OS-verified state, straight from Electron -- the single source of truth for "is the app
 *  actually registered to launch at login right now." On Windows this reads
 *  HKCU\Software\Microsoft\Windows\CurrentVersion\Run under the hood (Electron's own
 *  implementation); this function never touches the registry directly. */
export function getOSLoginItemState(): { openAtLogin: boolean; executableWillLaunchAtLogin: boolean } {
  const s = app.getLoginItemSettings();
  return { openAtLogin: s.openAtLogin, executableWillLaunchAtLogin: s.executableWillLaunchAtLogin };
}

export interface ApplyResult {
  ok: boolean;
  reason?: 'legacy-task-present' | 'legacy-task-query-inconclusive';
  preference: OpenAtLoginSettings;
  osState: { openAtLogin: boolean; executableWillLaunchAtLogin: boolean };
  legacyTask: LegacyAutostartTaskStatus;
}

/** THE RECONCILE STEP the dispatch requires: "detect the existing Scheduled Task and
 *  reconcile, not sit alongside it." MnemosyneC's main process never calls
 *  app.requestSingleInstanceLock() anywhere (verified this session -- see
 *  legacy_autostart_task_detector.ts's header), so Electron itself provides zero protection
 *  against the double-launch race the Founder named if both the legacy Scheduled Task and this
 *  module's own login item were ever registered at once. Rather than let that race exist even
 *  transiently, this function REFUSES to call app.setLoginItemSettings(true) at all -- for
 *  either an explicit toggle-on or the startup self-heal pass -- while the legacy task is
 *  detected present, OR while the detection query itself was inconclusive (fail closed: an
 *  unproven "not present" is treated the same as "present" for this one decision, because
 *  wrongly refusing to enable a redundant login item costs nothing but wrongly creating the
 *  double-launch race costs a real bug). Turning the preference OFF is never blocked -- there
 *  is no hazard in disabling a login item, only in enabling a second one alongside an existing
 *  one. */
export async function applyPreferenceToOS(desired: boolean): Promise<ApplyResult> {
  const legacyTask = await detectLegacyAutostartTask();
  const blocked = desired === true && (legacyTask.present || !!legacyTask.queryError);
  if (blocked) {
    return {
      ok: false,
      reason: legacyTask.present ? 'legacy-task-present' : 'legacy-task-query-inconclusive',
      preference: getOpenAtLoginPreference(),
      osState: getOSLoginItemState(),
      legacyTask,
    };
  }
  app.setLoginItemSettings({ openAtLogin: desired });
  const preference = persist({ openAtLogin: desired });
  return { ok: true, preference, osState: getOSLoginItemState(), legacyTask };
}

/** Called once at app startup (INIT-CALL APPEND ZONE in index.ts), same pattern as
 *  startResidentWatcher(). Self-heals the OS registry entry to match the stored preference --
 *  covers the case where a packaged reinstall or update reset Electron's login-item state
 *  without touching this module's JSON file. Idempotent: if the OS state already matches, this
 *  is a single cheap getLoginItemSettings() read plus (when the preference is ON and the
 *  legacy task check clears) one setLoginItemSettings() call that is a no-op change on the OS
 *  side. Never throws -- a failure here must not block app startup. */
export async function reconcileOpenAtLoginAtStartup(): Promise<void> {
  try {
    const pref = getOpenAtLoginPreference();
    const result = await applyPreferenceToOS(pref.openAtLogin);
    if (!result.ok) {
      console.warn(
        `[OpenAtLoginSettings] startup reconcile: preference is ${pref.openAtLogin}, but OS apply was skipped ` +
        `(reason: ${result.reason}). Legacy task present=${result.legacyTask.present}` +
        (result.legacyTask.queryError ? `, queryError=${result.legacyTask.queryError}` : ''),
      );
    }
  } catch (err) {
    console.error('[OpenAtLoginSettings] startup reconcile failed (non-fatal, app continues):', err);
  }
}

/** Test-only: clears the in-memory cache so the next read re-hits disk. Mirrors
 *  resident_settings.ts's own _resetResidentWatchSettingsCacheForTests. */
export function _resetOpenAtLoginSettingsCacheForTests(): void {
  _cached = null;
}
