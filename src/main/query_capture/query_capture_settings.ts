// query_capture_settings.ts -- D-BP151-037/BISHOP/seg-query-capture-archive
//
// THE SUBSTRATE PROCESSING SWITCH. ATTRIBUTED: Founder, BP151, addition to this ticket,
// verbatim: "build in the privacy question when others use it, and to be clear, we should
// allow users to turn OFF MnemosyneC Substrate Processing - if they want to, and then toggle
// back on. Without a record that they did, to keep it actually anonymous and untracked."
//
// TWO HALVES, BOTH REQUIRED:
//   1. OFF must actually stop processing -- every capture call site in this feature
//      (query_capture_store.ts's captureQuery()) reads isQueryCaptureEnabled() FIRST and
//      writes NOTHING when it is false. Not deferred, not queued -- skipped entirely.
//   2. NO RECORD THAT THE USER TOGGLED IT. Founder, verbatim: "No log line. No timestamp.
//      No 'last changed' field. No sync of the setting anywhere off the machine." This file
//      persists ONLY the current boolean (`{ enabled: boolean }`) -- nothing else is ever
//      written to this JSON file, and this file's read/write functions below emit ZERO
//      console output on any path, including the corrupt/missing-file fallback branches that
//      resident_settings.ts (the sibling pattern this file otherwise mirrors) uses
//      console.error for. That asymmetry is deliberate, not an oversight -- see the note
//      below on WHY.
//
// WHY ZERO CONSOLE OUTPUT IS LOAD-BEARING HERE (found during this ticket, not assumed):
// src/main/index.ts:47-50,131-132 wires `electron-log` globally: `log.initialize({ preload:
// true })` + `Object.assign(console, log.functions)` means EVERY console.log/warn/error/info
// call in the main process (AND, via `preload: true`, in the renderer) is captured by
// electron-log's rotating FILE transport (`log.transports.file.level = 'info'`, 10MB
// rotation) -- a real, persistent, timestamped, on-disk record. A console.log reading
// "[QueryCapture] disabled at ..." would be exactly the surveillance record the Founder's
// order forbids, just relocated from a settings file to a log file. So this module (and
// query_capture_store.ts's capture path) never logs anything that could reveal WHEN the
// switch changed or WHAT was captured. This finding is reported in full in the SEG return
// doc's "stores checked" section, not silently designed around.
//
// STORE: same convention as resident_settings.ts (app.getPath('userData') + one small JSON
// file), FAIL-CLOSED default (missing/corrupt file -> enabled:false, the narrowest envelope,
// per mesh_trust_settings.ts's own doctrine that a sibling file in this repo already uses).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Guarded Electron resolution -- same pattern mnem_eblet_store.ts's getElectronApp() uses,
// so this module (and its test) can also run outside a real Electron process.
type ElectronAppShape = { getPath: (name: string) => string };
let _electronAppCache: ElectronAppShape | null = null;
function getElectronApp(): ElectronAppShape | null {
  if (_electronAppCache) return _electronAppCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as { app?: ElectronAppShape };
    if (electron && electron.app && typeof electron.app.getPath === 'function') {
      _electronAppCache = electron.app;
      return _electronAppCache;
    }
  } catch {
    // Not resolvable outside Electron's main process -- expected for node scripts/tests.
  }
  return null;
}

function fallbackUserDataPath(): string {
  // CORRECTED D-BP158-006/BISHOP: the real Electron branch above already calls
  // getElectronApp()?.getPath('userData') directly, which now resolves to %APPDATA%\MnemosyneC
  // (see src/main/index.ts's app.setPath('userData', ...) call at the top of that file). This
  // fallback is only reached outside Electron (e.g. this file's own test), so it must resolve
  // the SAME directory or a standalone reader disagrees with the live app.
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) return join(appData, 'MnemosyneC');
  }
  // Last-resort, test-only fallback -- never used when real Electron or %APPDATA% is present.
  return join(process.cwd(), '.query_capture_settings_fallback');
}

function settingsFilePath(): string {
  // Test-only escape hatch, same convention as HOMEWORK_TEST_CANON_VAULT_DIR --
  // never set in production, keeps tests from ever touching the real userData file.
  const testOverride = process.env.QUERY_CAPTURE_TEST_SETTINGS_DIR;
  const dir = testOverride && testOverride.trim() !== ''
    ? testOverride
    : (getElectronApp()?.getPath('userData') ?? fallbackUserDataPath());
  return join(dir, 'query_capture_substrate_processing.json');
}

/** The ENTIRE persisted shape. Deliberately one field. Do not add a timestamp, a counter, a
 *  "last changed" field, or a history array to this interface -- that is the exact thing this
 *  file exists to not do. See file header. */
interface SubstrateProcessingState {
  enabled: boolean;
}

// In-memory only -- never written to disk, never logged. Lets a single process avoid a
// redundant disk read per call without caching anything more than what setQueryCaptureEnabled
// itself already just wrote.
let _cached: boolean | null = null;

/** Reads the current switch state. Defaults to false (OFF, the narrowest/safest envelope) on
 *  first run or on any read/parse error -- NEVER logs the outcome, the path, or the reason,
 *  by design (see file header). */
export function isQueryCaptureEnabled(): boolean {
  if (_cached !== null) return _cached;
  try {
    const f = settingsFilePath();
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8')) as Partial<SubstrateProcessingState>;
      _cached = parsed.enabled === true;
      return _cached;
    }
  } catch {
    // Corrupt or unreadable -- fall through to the narrowest default. No console output:
    // see file header on why even a diagnostic log line is out of bounds for this file.
  }
  _cached = false;
  return _cached;
}

/** Sets the switch. Overwrites the ONE-FIELD file in place (never appends, never versions,
 *  never keeps a prior value) and emits no console output on any path. This is the whole
 *  mechanism -- there is deliberately no companion "when" or "how many times" anywhere in
 *  this module. */
export function setQueryCaptureEnabled(enabled: boolean): { ok: true } | { ok: false; reason: string } {
  const next: SubstrateProcessingState = { enabled: enabled === true };
  try {
    const f = settingsFilePath();
    const dir = join(f, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(f, JSON.stringify(next), 'utf8');
    _cached = next.enabled;
    return { ok: true };
  } catch (err) {
    // Deliberately no console.error -- see file header. The caller (IPC handler) gets the
    // failure synchronously via this return value and may surface it to the UI; that is not
    // a persistent record of when/whether the user toggled the switch.
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Test-only: clears the in-memory cache so the next read re-hits disk. Mirrors
 *  resident_settings.ts's _resetResidentWatchSettingsCacheForTests. */
export function _resetQueryCaptureSettingsCacheForTests(): void {
  _cached = null;
}
