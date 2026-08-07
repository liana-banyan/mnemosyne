// nexus_authority_settings_store.ts -- BP137 Yoke v2b Stage C ("Chrome-MCP Nexus Authority"),
// item 2's persistence layer.
//
// WHY THIS FILE EXISTS / WHY THIS MECHANISM: per this Yoke's investigation step 1 (search
// across src/main/** and src/renderer/** for electron-store / userData / settings-IPC /
// localStorage-via-preload patterns), this repo does NOT have a single unified settings store.
// Instead it has several coexisting mechanisms depending on what's being persisted:
//   - Secrets (e.g. src/main/user_anthropic_key.ts): Electron `safeStorage`-encrypted files
//     under app.getPath('userData'), main-process only -- overkill and wrong tool for a
//     non-secret UI preference like "which authority answers the lookup arm".
//   - Structured member-scoped data (e.g. src/main/pantheon/folder_prefs.ts): hand-rolled JSON
//     read/write against a fixed path under the main process, again main-process only.
//   - Plain renderer-local UI preferences (e.g. SettingsTab.tsx's own theme/uiMode toggles,
//     MnemosyneTabView.tsx's LS_DEVELOPER_MODE / LS_ACTIVE_TAB / LS_FOR_TECHIES flags,
//     LeanShell.tsx's advanced-mode sync comment, OneClickMeshTestPanel.tsx's LS_LAST_RESULT):
//     plain `localStorage.getItem`/`setItem` with a module-scoped `LS_<NAME>` key constant and
//     JSON.stringify/parse for structured values. This is by far the most common pattern in
//     src/renderer -- confirmed by direct grep, dozens of call sites across at least 8 files.
//
// The Nexus per-arm authority picker is exactly this third category: a renderer-local UI
// preference, not a secret, not member-scoped structured data that needs main-process
// mediation. Per this Yoke's own instructions ("if you found an existing settings-persistence
// mechanism... use it, following its existing conventions"), this file follows the
// already-established localStorage + LS_<NAME> convention exactly, rather than inventing a new
// main-process JSON-file primitive that would also require new IPC plumbing through
// src/main/preload.ts (a file this Yoke was told to avoid touching -- see
// src/main/plow/browser_authority_adapter.ts's header for the full accounting of why that
// file is out of reach this pass).
//
// LIMITATION, REPORTED HONESTLY: because this store lives entirely in the renderer's
// localStorage, main-process code (e.g. a future Stage-4 plow_mc_answerer.ts lookup_fact
// branch) cannot read it directly -- crossing that boundary needs the same
// preload.ts-mediated IPC channel this Yoke's browser-authority adapter already documents as
// deferred. Persisting the picker's choice so it survives an app restart (this Yoke's actual
// acceptance requirement) works today with zero further wiring; making a MAIN-PROCESS caller
// aware of the user's choice is the still-open gap, tracked in the same place as the other
// deferred cross-process legs.

import {
  DEFAULT_NEXUS_PER_ARM_AUTHORITY,
  NEXUS_ARM_NAMES,
  type NexusArmName,
  type NexusAuthorityName,
  type NexusPerArmAuthority,
} from '../../shared/plow/browser_authority_types';

const LS_NEXUS_AUTHORITY_MODE = 'mnemo_nexus_research_arm_mode';
const LS_NEXUS_AUTHORITY_BROWSER = 'mnemo_nexus_research_arm_browser_authority';
const LS_NEXUS_PER_ARM = 'mnemo_nexus_per_arm_authority';

/** Everything the Settings UI needs to read/write in one shape. Mirrors the plain-boolean,
 *  AND-gated convention documented in browser_authority_types.ts's
 *  BrowserAuthorityAdapterConfig -- these two flags ARE that config's researchArmMode /
 *  researchArmBrowserAuthority fields, just persisted renderer-side. */
export interface NexusAuthoritySettingsSnapshot {
  researchArmMode: boolean;
  researchArmBrowserAuthority: boolean;
  perArmAuthority: NexusPerArmAuthority;
}

function safeParsePerArmAuthority(raw: string | null): NexusPerArmAuthority {
  if (!raw) return { ...DEFAULT_NEXUS_PER_ARM_AUTHORITY };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<NexusArmName, NexusAuthorityName>>;
    const result: NexusPerArmAuthority = { ...DEFAULT_NEXUS_PER_ARM_AUTHORITY };
    for (const arm of NEXUS_ARM_NAMES) {
      const value = parsed[arm];
      if (value === 'local_free' || value === 'user_google' || value === 'user_perplexity' || value === 'paid_api') {
        result[arm] = value;
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_NEXUS_PER_ARM_AUTHORITY };
  }
}

// KN-BP144-3 Phase 1: distinguishes "never persisted anything" from "explicitly persisted
// false" -- loadNexusAuthoritySettings()'s `=== 'true'` check collapses both to `false`, which
// is the right default for READING but the wrong signal for a caller (OneClickMeshTestPanel.tsx)
// that needs to know whether it should seed a first-run default into this store or defer to
// whatever is already there. Exported so no caller needs to know/duplicate the raw
// LS_NEXUS_AUTHORITY_MODE key string.
export function hasNexusAuthorityModeEverBeenSet(): boolean {
  try { return localStorage.getItem(LS_NEXUS_AUTHORITY_MODE) !== null; } catch { return false; }
}

/** Reads the full Nexus authority settings snapshot. Every field falls back to its
 *  Bishop-prompt-mandated safe default (both flags false, every arm 'local_free') when
 *  localStorage is empty, unavailable, or holds unparseable data -- never throws. */
export function loadNexusAuthoritySettings(): NexusAuthoritySettingsSnapshot {
  try {
    return {
      researchArmMode: localStorage.getItem(LS_NEXUS_AUTHORITY_MODE) === 'true',
      researchArmBrowserAuthority: localStorage.getItem(LS_NEXUS_AUTHORITY_BROWSER) === 'true',
      perArmAuthority: safeParsePerArmAuthority(localStorage.getItem(LS_NEXUS_PER_ARM)),
    };
  } catch {
    return {
      researchArmMode: false,
      researchArmBrowserAuthority: false,
      perArmAuthority: { ...DEFAULT_NEXUS_PER_ARM_AUTHORITY },
    };
  }
}

// BP137 0.9.12 Stage F1 -- ADDITIVE. Mirrors both flags into the main process (a small JSON file
// under userData; see nexus_authority_persistent_session.ts's header for why) every time either
// toggle changes here, so the persistent-session module's flag gate is never blind to a
// same-session change. Fire-and-forget: `window.amplify?.setNexusAuthorityBrowserFlags` is
// optional-chained, so this is a guaranteed no-op (never throws, never blocks the localStorage
// write above) on any build that predates Stage F1's preload.ts addition. This function has no
// effect on this file's pre-existing localStorage read/write behavior -- it only ever ADDS a
// side effect, never changes what loadNexusAuthoritySettings() reads back.
function pushFlagsToMainProcessMirror(researchArmMode: boolean, researchArmBrowserAuthority: boolean): void {
  try {
    const amplify = (window as unknown as {
      amplify?: { setNexusAuthorityBrowserFlags?: (mode: boolean, browserAuthority: boolean) => Promise<unknown> };
    }).amplify;
    amplify?.setNexusAuthorityBrowserFlags?.(researchArmMode, researchArmBrowserAuthority)?.catch?.(() => { /* non-fatal */ });
  } catch { /* non-fatal -- localStorage remains the renderer's own source of truth regardless */ }
}

// KN-BP144-3 Phase 1 ("the two-gate trap must become visible or become one gate", Founder
// preference from BP143 per this ticket's WHY section): researchArmBrowserAuthority used to be
// a SEPARATE sub-flag a user had to independently opt into, from the SAME Settings surface, one
// row below the master switch -- easy to miss, and its own comment above (BP137 Stage F1)
// confirms nexus_authority_persistent_session.ts's ensureNexusAuthoritySession() ANDs it with
// researchArmMode as its own, second, silent gate. plow_mc_answerer.ts's scored-path call site
// (callCanonicalPlowMcAnswererForMeshTest) already collapses these two into one by deriving
// `researchArmBrowserAuthority: researchArmMode` for every benchmark run -- this store now
// makes that the RULE everywhere, not a scored-path-only special case: the two flags always
// move together, so no caller of this store (LeanAskTab.tsx's Ask-tab gate,
// NexusAuthoritySignInPanel.tsx's flagsEnabled, nexus_authority_persistent_session.ts's file
// mirror) can ever observe them disagreeing. saveResearchArmBrowserAuthority() below is kept
// (not deleted -- Rule 66) for any future caller that genuinely needs independent control, but
// no UI in this repo calls it anymore as of this pass (see NexusAuthoritySettings.tsx's now-
// read-only "User's Browser Session" row).
function readBooleanFlag(key: string): boolean {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}

export function saveResearchArmMode(enabled: boolean): void {
  try { localStorage.setItem(LS_NEXUS_AUTHORITY_MODE, String(enabled)); } catch { /* non-fatal */ }
  try { localStorage.setItem(LS_NEXUS_AUTHORITY_BROWSER, String(enabled)); } catch { /* non-fatal */ }
  pushFlagsToMainProcessMirror(enabled, enabled);
  window.dispatchEvent(new Event('nexus-authority-settings-changed'));
}

/** Kept for Rule 66 / API stability -- see the one-gate collapse note above saveResearchArmMode()
 *  for why nothing in this repo's UI calls this anymore. A future caller that sets this
 *  independently will have its value silently re-synced to match researchArmMode the next time
 *  saveResearchArmMode() runs (which is every master-switch toggle) -- documented, not hidden. */
export function saveResearchArmBrowserAuthority(enabled: boolean): void {
  try { localStorage.setItem(LS_NEXUS_AUTHORITY_BROWSER, String(enabled)); } catch { /* non-fatal */ }
  pushFlagsToMainProcessMirror(readBooleanFlag(LS_NEXUS_AUTHORITY_MODE), enabled);
  window.dispatchEvent(new Event('nexus-authority-settings-changed'));
}

// BP148 nexus-authority-enable fix: this write previously never dispatched
// 'nexus-authority-settings-changed' -- the ONE event NexusAuthoritySignInPanel.tsx's own
// useEffect (see that file's `refresh()`) listens for to recompute `armsRoutedTo` (its
// derived "how many arms currently route to this authority" fact for Google/Perplexity's
// enabled/disabled label). saveResearchArmMode()/saveResearchArmBrowserAuthority() above
// both dispatch this event; this function -- the ACTUAL write path the per-arm picker
// (NexusAuthoritySettings.tsx's handleArmAuthorityChange -> setArmAuthority below) goes
// through on every click -- silently did not. Net effect, reported live by the Founder: a
// user assigns Google to the Lookup arm, localStorage genuinely updates (confirmed by
// direct read), but the sign-in panel's "Signed in, not enabled" notice never re-renders
// until something else (e.g. toggling the master switch, or a full remount) happens to
// fire the event or the component happens to reload. Adding the dispatch here makes this
// write behave exactly like every other setter in this file: the read side is notified the
// instant the write happens, with no other observable change to this function's return
// value or its callers' behavior.
export function savePerArmAuthority(perArm: NexusPerArmAuthority): void {
  try { localStorage.setItem(LS_NEXUS_PER_ARM, JSON.stringify(perArm)); } catch { /* non-fatal */ }
  window.dispatchEvent(new Event('nexus-authority-settings-changed'));
}

/** Convenience setter for a single arm, reading-modifying-writing the persisted whole. */
export function setArmAuthority(arm: NexusArmName, authority: NexusAuthorityName): NexusPerArmAuthority {
  const current = safeParsePerArmAuthority(
    (() => { try { return localStorage.getItem(LS_NEXUS_PER_ARM); } catch { return null; } })(),
  );
  const next: NexusPerArmAuthority = { ...current, [arm]: authority };
  savePerArmAuthority(next);
  return next;
}
