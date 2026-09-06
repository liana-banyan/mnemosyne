// legacy_autostart_task_detector.ts -- D-BP163-M0-050/BISHOP/SEG-CX
//
// WHY THIS FILE EXISTS: on the night of BP163 close, a Windows Scheduled Task named
// "Bishop_MnemosyneC_Autostart_M0" was registered BY HAND in an ELEVATED PowerShell window
// (this estate's agent sessions run non-elevated -- Medium integrity, Administrators
// for-deny-only -- and could not register it themselves). That task triggers AtLogOn and
// launches the packaged 0.9.27 exe directly. It is a stopgap for the M0 machine only and does
// not ship to any other member.
//
// THE HAZARD (Founder's own words, D-BP163-M0-050 dispatch): "If the app ALSO sets itself to
// open at login, BOTH fire and two instances race for the Electron single-instance lock."
// Verified this session (BP163): MnemosyneC's own src/main/index.ts NEVER calls
// app.requestSingleInstanceLock() anywhere -- grep across src/ turns up only the unrelated
// 'second-instance' event LISTENER in deep-link-handler.ts, which only ever fires in a
// process that itself successfully acquired the lock. Since this app never requests the lock,
// Electron provides NO protection at all against a double launch: two full independent
// processes would run side by side, each opening its own windows and starting its own
// startup work (relay polling, IPC servers, local ports). (Contrast: the SEPARATE
// caithedral-core/ package, a different Electron app entirely, DOES call
// requestSingleInstanceLock() in its own src/main/index.ts -- that call has no effect on this
// app; the two are different processes with different entry points.)
//
// REMOVING the Scheduled Task requires elevation this process does not have (verified:
// Get-ScheduledTask reads succeed non-elevated; Unregister-ScheduledTask was not attempted,
// per the dispatch's explicit prohibition on touching the task). DETECTING it does not require
// elevation -- `schtasks /Query` against a task in the current user's own logon-trigger context
// succeeds non-elevated, same as the Get-ScheduledTask read already proven this session.
//
// This module is read-only: it never creates, modifies, or deletes the Scheduled Task. It only
// answers "is it there right now" so open_at_login_settings.ts can refuse to also enable
// Electron's own login item on top of it, and so the Settings UI can show the Founder (or any
// member who later hits this same M0-only stopgap) the exact elevated command to remove it.

import { execFile } from 'node:child_process';

/** The exact task name registered by hand at BP163 close. Never invented, never guessed --
 *  copied verbatim from the dispatch and from this session's own Get-ScheduledTask read. */
export const LEGACY_AUTOSTART_TASK_NAME = 'Bishop_MnemosyneC_Autostart_M0';

/** Ready-to-paste command for a human running an ELEVATED PowerShell window. This module never
 *  runs this command itself -- Unregister-ScheduledTask requires elevation this process does
 *  not have, and the dispatch that created this file explicitly prohibits attempting removal.
 *  Surfaced verbatim so the Settings UI can show it and a member can copy it. */
export const LEGACY_AUTOSTART_TASK_REMOVAL_COMMAND =
  `Unregister-ScheduledTask -TaskName "${LEGACY_AUTOSTART_TASK_NAME}" -Confirm:$false`;

export interface LegacyAutostartTaskStatus {
  present: boolean;
  taskName: string;
  /** Raw State column from schtasks /Query when present (e.g. "Ready", "Running", "Disabled").
   *  Undefined when the task was not found or the query itself failed for another reason. */
  state?: string;
  /** Set when the query itself failed for a reason OTHER than "task not found" -- e.g. schtasks
   *  is unavailable on this platform, or a permissions error unrelated to the expected
   *  not-found case. present is reported false in this case too (fail to the safer assumption:
   *  do not enable our own login item if we cannot positively rule the legacy task out) but the
   *  error is preserved so callers can log it distinctly from an honest "not present".
   *  D-BP163-M0-050: FAIL-CLOSED FOR the toggle -- an inconclusive query is treated the SAME as
   *  "present" by open_at_login_settings.ts's applyPreferenceToOS() gate, on the theory that
   *  wrongly refusing to enable a redundant login item is far cheaper than wrongly creating the
   *  double-launch race the Founder named -- see that file's own comment at the call site. */
  queryError?: string;
}

/** Queries Windows Task Scheduler, non-elevated, for LEGACY_AUTOSTART_TASK_NAME.
 *  `schtasks /Query` against a task running in the querying user's own logon-trigger context
 *  does not require elevation -- verified this session via the non-elevated equivalent
 *  Get-ScheduledTask read, which returned the task's full detail (State: Ready) with no
 *  elevation prompt or access-denied error. Non-Windows platforms report present:false
 *  immediately (this hazard is Windows-Scheduled-Task-specific; there is no equivalent legacy
 *  artifact on macOS/Linux for this app). */
export function detectLegacyAutostartTask(): Promise<LegacyAutostartTaskStatus> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ present: false, taskName: LEGACY_AUTOSTART_TASK_NAME });
      return;
    }
    execFile(
      'schtasks',
      ['/Query', '/TN', LEGACY_AUTOSTART_TASK_NAME, '/FO', 'LIST'],
      { windowsHide: true, timeout: 10_000 },
      (err, stdout) => {
        if (err) {
          // schtasks exits non-zero (and prints "ERROR: The system cannot find the file
          // specified.") when the named task does not exist -- this is the expected,
          // overwhelmingly common case (no legacy task registered at all) and is reported as a
          // clean present:false, not a queryError.
          const msg = String(err.message || '');
          const notFound =
            /cannot find the file specified/i.test(msg) ||
            /ERROR: The system cannot find/i.test(stdout || '') ||
            (err as NodeJS.ErrnoException).code === 'ENOENT' && false; // ENOENT here would mean schtasks.exe itself is missing, handled below
          if (notFound) {
            resolve({ present: false, taskName: LEGACY_AUTOSTART_TASK_NAME });
            return;
          }
          resolve({
            present: false,
            taskName: LEGACY_AUTOSTART_TASK_NAME,
            queryError: msg || 'schtasks query failed',
          });
          return;
        }
        const stateMatch = /^Status:\s*(.+)$/im.exec(stdout || '');
        resolve({
          present: true,
          taskName: LEGACY_AUTOSTART_TASK_NAME,
          state: stateMatch ? stateMatch[1].trim() : undefined,
        });
      },
    );
  });
}
