// opt_in_strike_tracker.ts — 3-strikes contextual opt-in state tracker
// canon: canon_frontier_lb_account_opt_in_contextual_3_strikes_prompt_not_buried_tab_bp065
// BP065 · Founder direct: "ask 3 times — once a day for 3 days, once a week for 3 weeks, or not at all"
//
// Storage: localStorage (renderer-side, no IPC round-trip needed for reads/writes)
// Key: mnemo_opt_in_strike_state

const LS_KEY = 'mnemo_opt_in_strike_state';

// Cooldown periods per cadence choice
const COOLDOWN_3_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const COOLDOWN_3_WEEKS_MS = 3 * 7 * 24 * 60 * 60 * 1000;

export type OptInDecision = 'pending' | 'never' | 'linked';
export type OptInCadence = '3days' | '3weeks';

export interface OptInStrikeState {
  strikes: number;
  lastShown: number | null;   // epoch ms
  decision: OptInDecision;
  cadence: OptInCadence;      // user's chosen cadence (set on first remind choice)
}

function defaultState(): OptInStrikeState {
  return { strikes: 0, lastShown: null, decision: 'pending', cadence: '3days' };
}

export function getStrikeState(): OptInStrikeState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<OptInStrikeState>;
    return {
      strikes: typeof parsed.strikes === 'number' ? parsed.strikes : 0,
      lastShown: typeof parsed.lastShown === 'number' ? parsed.lastShown : null,
      decision: (parsed.decision === 'never' || parsed.decision === 'linked') ? parsed.decision : 'pending',
      cadence: parsed.cadence === '3weeks' ? '3weeks' : '3days',
    };
  } catch {
    return defaultState();
  }
}

function saveState(state: OptInStrikeState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Record a strike (shown to the user) with the chosen cadence.
 * The FIRST ask counts as Strike 1 — call this when the prompt is shown.
 */
export function recordStrike(cadence?: OptInCadence): void {
  const state = getStrikeState();
  state.strikes = Math.min(state.strikes + 1, 3);
  state.lastShown = Date.now();
  if (cadence) state.cadence = cadence;
  saveState(state);
}

/**
 * Set the user's final decision (linked / never / back to pending to reset).
 */
export function setDecision(decision: OptInDecision): void {
  const state = getStrikeState();
  state.decision = decision;
  saveState(state);
}

/**
 * Set the cadence without recording a strike.
 */
export function setCadence(cadence: OptInCadence): void {
  const state = getStrikeState();
  state.cadence = cadence;
  saveState(state);
}

/**
 * Returns true if the opt-in prompt should be shown right now.
 * Conditions:
 *   1. decision = 'pending'
 *   2. strikes < 3
 *   3. lastShown = null (never shown) OR cooldown period has elapsed per chosen cadence
 */
export function shouldShowPrompt(): boolean {
  const state = getStrikeState();
  if (state.decision !== 'pending') return false;
  if (state.strikes >= 3) return false;
  if (state.lastShown === null) return true;
  const cooldown = state.cadence === '3weeks' ? COOLDOWN_3_WEEKS_MS : COOLDOWN_3_DAYS_MS;
  return Date.now() - state.lastShown >= cooldown;
}
