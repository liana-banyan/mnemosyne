// resident_settings.ts -- KN-BP147-M2: persistence for the resident yoke watcher's
// "watch is armed" switch. OD-04, ON_DECK_BP146.md lines 65-69; PROV_24 harvest (Founder,
// BP147): "I want ... as User, [to] have the Mic persistence within my realm of control, to
// dictate that it DOES persist across sessions, using MnemosyneC ... which will be always for
// me, as long as the resources used are free."
//
// STORE: this module follows the SAME persistence convention every other MnemosyneC settings
// module already uses -- app.getPath('userData') + one small JSON file per concern (see
// brain_registry.ts:88-91 STORE_FILENAME='brain_registry.json'; mesh_trust_settings.ts:33-35
// %APPDATA%\MnemosyneC\config\mesh_trust_settings.json, same directory family via
// process.env.APPDATA). This is "the existing user-settings store" the ticket asks for --
// there is no single monolithic settings file in this app to append a key into; the
// convention IS "one JSON file per concern, same userData directory." Extending that
// convention with resident_watch_settings.json is using the existing store, not inventing a
// new one.
//
// FAIL-CLOSED DEFAULT, matching mesh_trust_settings.ts's own doctrine (its line 39-40): a
// missing or corrupt settings file defaults to the NARROWEST envelope, never the widest.
// Refusal duty (ticket line 78): "default to the narrowest envelope when [a parameter] is
// unknown." WATCH is free and healthy to run, but it is "a switch the USER holds, not a
// promise the agent makes" (ticket line 90) -- so the default on first run is UNARMED until
// the user (or an operator acting on the user's explicit instruction) elects it.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export type SupervisorPresence = 'awake' | 'walking_alongside' | 'asleep' | 'unknown';

export interface ResidentWatchSettings {
  /** Default false. The WATCH act class (free, read-only yoke polling) only starts its
   *  interval when this is true. Persists across app restarts once set -- this is the
   *  "always for me" the Founder asked for, but it is elected, never assumed. */
  watchArmed: boolean;
  /** Graded input, never a boolean (ticket line 78: "model it as a graded input"). Read by
   *  autopilot_grant.ts to decide whether an ACT request may even be considered. Defaults to
   *  'unknown', which autopilot_grant.ts treats as the narrowest envelope. */
  supervisorPresence: SupervisorPresence;
  /** Poll interval in ms for the WATCH loop. Not user-exposed yet; kept in the settings file
   *  so a future control surface can read/write it without a schema migration. */
  pollIntervalMs: number;
}

const DEFAULT_SETTINGS: ResidentWatchSettings = {
  watchArmed: false,
  supervisorPresence: 'unknown',
  pollIntervalMs: 30_000, // matches HARDWIRE-00 Section 6.3's Mic poll cadence
};

const STORE_FILENAME = 'resident_watch_settings.json';

function settingsFilePath(): string {
  return join(app.getPath('userData'), STORE_FILENAME);
}

let _cached: ResidentWatchSettings | null = null;

/** Reads the persisted setting, defaulting to the narrowest envelope (watchArmed: false,
 *  supervisorPresence: 'unknown') on first run OR on any read/parse error. Fails CLOSED,
 *  never open, on a missing or corrupt settings file -- same doctrine as
 *  mesh_trust_settings.ts:39-41. */
export function getResidentWatchSettings(): ResidentWatchSettings {
  if (_cached) return _cached;
  try {
    const f = settingsFilePath();
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8')) as Partial<ResidentWatchSettings>;
      _cached = {
        watchArmed: parsed.watchArmed === true,
        supervisorPresence:
          parsed.supervisorPresence === 'awake' ||
          parsed.supervisorPresence === 'walking_alongside' ||
          parsed.supervisorPresence === 'asleep'
            ? parsed.supervisorPresence
            : 'unknown',
        pollIntervalMs:
          typeof parsed.pollIntervalMs === 'number' && parsed.pollIntervalMs >= 5_000
            ? parsed.pollIntervalMs
            : DEFAULT_SETTINGS.pollIntervalMs,
      };
      return _cached;
    }
  } catch {
    // Corrupt or unreadable settings file -- fall through to the narrowest default below.
  }
  _cached = { ...DEFAULT_SETTINGS };
  return _cached;
}

function persist(next: ResidentWatchSettings): ResidentWatchSettings {
  try {
    const f = settingsFilePath();
    mkdirSync(join(app.getPath('userData')), { recursive: true });
    writeFileSync(f, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('[ResidentWatchSettings] failed to persist setting (in-memory only for this session):', err);
  }
  _cached = next;
  return next;
}

/** Elects (or revokes) the persistent WATCH switch. THE USER HOLDS THIS SWITCH -- this
 *  function is the mechanism, not the authority; whoever calls it is asserting the user has
 *  elected the change. Returns the new settings object, already written to disk. */
export function setWatchArmed(armed: boolean): ResidentWatchSettings {
  const current = getResidentWatchSettings();
  return persist({ ...current, watchArmed: armed === true });
}

export function isWatchArmed(): boolean {
  return getResidentWatchSettings().watchArmed === true;
}

/** Records the supervisor-presence input. Graded, not boolean (ticket line 78). Callers name
 *  where the observation came from in their own logs -- this function only stores the value. */
export function setSupervisorPresence(presence: SupervisorPresence): ResidentWatchSettings {
  const current = getResidentWatchSettings();
  return persist({ ...current, supervisorPresence: presence });
}

export function getSupervisorPresence(): SupervisorPresence {
  return getResidentWatchSettings().supervisorPresence;
}

/** Test-only: clears the in-memory cache so the next read re-hits disk. Mirrors
 *  mesh_trust_settings.ts's _resetMeshTrustSettingsCacheForTests. */
export function _resetResidentWatchSettingsCacheForTests(): void {
  _cached = null;
}
