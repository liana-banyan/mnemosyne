// user_precedence/yield_decision.ts -- D-BP223-BM0-X029-018-USER-HAS-PRECEDENCE
//
// FOUNDER k/0ee57a97 (2026-09-16 21:16Z), verbatim: "You need to include that as a TOGGLE or a
// DEFAULT that is also pointed out - in FAQ under "What will this do to my machine?" and "Can I
// still use my computer"? Because three people I've spoken to asked that question. And they need
// to know, it still works, but YOU as the USER have precedence."
//
// THIS FILE IS THE PURE DECISION. No Electron, no child_process, no fetch: every input is handed
// in, so every yield decision is unit-testable with simulated inputs (yield_decision.test.ts).
// The probes that gather the inputs live in probes.ts; the cached monitor that callers use lives
// in index.ts.
//
// LAW 4, PIECES THIS EXTENDS RATHER THAN DUPLICATES:
//   - Idle gate: homework/homework_runner.ts Gate 2 (Electron powerMonitor.getSystemIdleTime(),
//     fail SAFE when it cannot be read). Same source, same fail-safe direction, here generalized
//     from one background worker to all of them.
//   - VRAM gate: HARDWIRE/tools/vram_headroom.mjs checkVramHeadroom (1.1x margin, resident model
//     needs zero new VRAM, per D-BP221-BM0-017) and hardware/ram_detector.ts requiredVramGb (the
//     app's own measured/estimated per-model need, already conservative).
//
// WHAT "YIELD" MEANS (the dispatch's definition, enforced by callers, not here):
//   pause / queue NEW model work; keep light file serving; never open or focus a window; never
//   touch the user's browser; resume automatically when idle.

/** Windows SHQueryUserNotificationState, mapped. 'unknown' = could not read (non-Windows, probe
 *  failed, or deliberately not probed because an earlier gate already decided). */
export type ForegroundState =
  | 'fullscreen'        // QUNS_BUSY (2): a full-screen app is running
  | 'd3d_fullscreen'    // QUNS_RUNNING_D3D_FULL_SCREEN (3): a full-screen game / video renderer
  | 'presentation'      // QUNS_PRESENTATION_MODE (4): presentation mode on
  | 'immersive_app'     // QUNS_APP (7): a full-screen Store app (e.g. a streaming app)
  | 'away'              // QUNS_NOT_PRESENT (1): locked, screensaver, or switched user
  | 'normal'            // QUNS_ACCEPTS_NOTIFICATIONS (5) / QUNS_QUIET_TIME (6)
  | 'unknown';

export interface VramReading {
  /** Free VRAM in MiB right now, or null when no probe could answer. */
  freeMiB: number | null;
  /** Where the number came from, carried into the reason so it is never silent. */
  source: string | null;
}

export interface YieldInputs {
  /** Seconds since last keyboard/mouse input (Electron powerMonitor.getSystemIdleTime()).
   *  null = could not be read. */
  idleSeconds: number | null;
  foreground: ForegroundState;
  /** The model the pending work would run, or null for work that needs no model. */
  model: string | null;
  /** MiB the model needs, or null when unknown. */
  modelNeedMiB: number | null;
  /** True when the model is already loaded (needs zero new VRAM). */
  modelResident: boolean;
  vram: VramReading | null;
}

export interface YieldSettings {
  /** "You come first". undefined = ON (the default). Only an explicit false turns it off. */
  youComeFirst?: boolean;
  /** Input within this many seconds counts as "the user is active". Default 120. */
  activeWithinSeconds?: number;
}

export type YieldReason =
  | 'user_active'
  | 'idle_unreadable'
  | 'fullscreen_foreground'
  | 'vram_insufficient'
  | 'vram_unreadable';

export interface YieldDecision {
  /** true = do not START new model work now; queue it and re-check later. */
  yield: boolean;
  /** Every reason that applied (empty when not yielding). */
  reasons: YieldReason[];
  /** true = the person is using the computer right now. Any result produced in this state is
   *  labeled "desktop in use", whether or not the setting is on. */
  desktopInUse: boolean;
  /** The effective setting after defaulting. */
  youComeFirst: boolean;
  /** One plain-language line for logs and the status surface. */
  explanation: string;
}

export const DEFAULT_ACTIVE_WITHIN_SECONDS = 120;
/** Same margin as vram_headroom.mjs DEFAULT_MARGIN. */
export const VRAM_MARGIN = 1.1;
/** The label every caller attaches to a result or timing taken while the desktop was in use. */
export const DESKTOP_IN_USE_LABEL = 'desktop in use';

const FULLSCREEN_STATES: ReadonlySet<ForegroundState> = new Set<ForegroundState>([
  'fullscreen', 'd3d_fullscreen', 'presentation', 'immersive_app',
]);

export function isYouComeFirstOn(settings: YieldSettings | undefined | null): boolean {
  return settings?.youComeFirst !== false;
}

export function isDesktopInUse(inputs: Pick<YieldInputs, 'idleSeconds' | 'foreground'>, activeWithinSeconds = DEFAULT_ACTIVE_WITHIN_SECONDS): boolean {
  // Locked / screensaver / switched user: nobody is at this desktop, whatever the idle counter says.
  if (inputs.foreground === 'away') return false;
  if (inputs.idleSeconds === null) return true; // cannot tell -> assume someone is there (label errs toward honesty)
  if (inputs.idleSeconds < activeWithinSeconds) return true;
  // No recent input but a full-screen video / game / presentation is up: someone is watching.
  return FULLSCREEN_STATES.has(inputs.foreground);
}

/**
 * THE DECISION. Order matters only for the explanation text; every applicable reason is listed.
 *
 * VRAM UNREADABLE PAUSES (fail-closed) when "You come first" is ON. Founder ruling k/4b696911
 * (2026-09-16 21:46Z, answering X029-018 flag 1): "1. pause". Addendum: the first version
 * (sibling yield_decision.superseded.20260916T214643Z.ts) did NOT yield on unreadable VRAM; that is
 * reversed here. Applies only to model work that would need NEW VRAM (a model is named, it is not
 * already loaded, and its need is known); a loaded model and model-free work are unaffected. Same
 * direction as the dispatch-side firearm rule in vram_headroom.mjs (unknown = do not dispatch).
 * With the setting OFF nothing pauses, VRAM included.
 */
export function decideYield(inputs: YieldInputs, settings?: YieldSettings | null): YieldDecision {
  const youComeFirst = isYouComeFirstOn(settings);
  const activeWithin = settings?.activeWithinSeconds && settings.activeWithinSeconds > 0
    ? settings.activeWithinSeconds
    : DEFAULT_ACTIVE_WITHIN_SECONDS;
  const desktopInUse = isDesktopInUse(inputs, activeWithin);

  if (!youComeFirst) {
    return {
      yield: false,
      reasons: [],
      desktopInUse,
      youComeFirst,
      explanation: desktopInUse
        ? `"You come first" is OFF: running at full speed while the ${DESKTOP_IN_USE_LABEL}; results are labeled.`
        : '"You come first" is OFF: running at full speed.',
    };
  }

  const reasons: YieldReason[] = [];
  if (inputs.foreground !== 'away') {
    if (inputs.idleSeconds === null) reasons.push('idle_unreadable');
    else if (inputs.idleSeconds < activeWithin) reasons.push('user_active');
  }
  if (FULLSCREEN_STATES.has(inputs.foreground)) reasons.push('fullscreen_foreground');

  if (inputs.model && !inputs.modelResident && inputs.modelNeedMiB !== null) {
    if (!inputs.vram || inputs.vram.freeMiB === null) {
      reasons.push('vram_unreadable');
    } else {
      const needed = Math.ceil(inputs.modelNeedMiB * VRAM_MARGIN);
      if (inputs.vram.freeMiB < needed) reasons.push('vram_insufficient');
    }
  }

  if (reasons.length === 0) {
    return { yield: false, reasons, desktopInUse, youComeFirst, explanation: 'Computer is idle: background work may run.' };
  }
  const parts: string[] = [];
  if (reasons.includes('user_active')) parts.push(`you used the keyboard or mouse in the last ${activeWithin} s`);
  if (reasons.includes('idle_unreadable')) parts.push('activity could not be read, so we assume you are there');
  if (reasons.includes('fullscreen_foreground')) parts.push(`a full-screen app is in front (${inputs.foreground})`);
  if (reasons.includes('vram_insufficient')) {
    parts.push(`graphics memory is short for ${inputs.model} (free ${inputs.vram?.freeMiB} MiB, needs ${Math.ceil((inputs.modelNeedMiB ?? 0) * VRAM_MARGIN)} MiB, source ${inputs.vram?.source ?? 'unknown'})`);
  }
  if (reasons.includes('vram_unreadable')) {
    parts.push(`free graphics memory could not be read, so ${inputs.model} is not loaded (needs ${Math.ceil((inputs.modelNeedMiB ?? 0) * VRAM_MARGIN)} MiB)`);
  }
  return {
    yield: true,
    reasons,
    desktopInUse,
    youComeFirst,
    explanation: `You come first: background model work is paused because ${parts.join('; ')}. It resumes on its own when the computer is idle.`,
  };
}

/** A timing or result string carrying the label when it was taken while the desktop was in use. */
export function labelTiming(text: string, desktopInUse: boolean): string {
  return desktopInUse ? `${text} (${DESKTOP_IN_USE_LABEL})` : text;
}

/** Maps the raw SHQueryUserNotificationState integer. Anything unrecognized is 'unknown'. */
export function mapNotificationState(n: number | null | undefined): ForegroundState {
  switch (n) {
    case 1: return 'away';
    case 2: return 'fullscreen';
    case 3: return 'd3d_fullscreen';
    case 4: return 'presentation';
    case 5: return 'normal';
    case 6: return 'normal';
    case 7: return 'immersive_app';
    default: return 'unknown';
  }
}
