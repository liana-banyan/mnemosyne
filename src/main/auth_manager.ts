// AMPLIFY Computer — Cooperative Member Auth Manager
// B37 Phase 7 — trial tracking, degraded mode
//
// D-BP155-025/BISHOP/seg-member-recognition — CONSOLIDATED, did not add a bridge.
// Prior to this pass there were three disjoint identity systems: (1) this file's closed
// local 30-day trial timer, whose only network call was _validateAndSave() POSTing to
// https://lianabanyan.com/api/amplify/validate — an endpoint that has never existed in
// either the mnemosyne or LianaBanyanPlatform repo, so every call failed and every
// failure looked exactly like "not a member"; (2) lb_auth.ts's real, working Supabase
// magic-link session, previously consumed only for presence telemetry; (3) the actual
// membership record in Supabase's member_profiles table, which no desktop code ever
// queried. This file now reads (2) and queries (3) directly via membership_lookup.ts —
// no new server-side endpoint was built. See membership_lookup.ts's header for why a
// client-side REST call is sufficient under member_profiles' existing RLS policy.
//
// Auth states:
//   member          — verified LB cooperative member (live-checked or cached-verified)
//   trial_active    — non-member within 30-day trial window, full features
//   trial_expired   — non-member past 30 days, degraded mode (substrate read-only)
//   unauthenticated — fresh install, trial not started (AuthGate shown)
//   unknown         — LB account linked but membership could not be determined (no
//                      cached result exists and the live lookup has not yet succeeded).
//                      NEVER collapsed into trial_expired — see _computeState().
//
// Path (single, general — the same one any paying customer takes):
//   1. User links an LB Account (Tab 14, LBAccountTab.tsx) — lb_auth.ts's Supabase
//      magic-link flow. Also reachable from AuthGate's "Sign in" button, which now
//      opens that same tab instead of the retired OAuth round-trip.
//   2. refreshMembership() reads the linked session and queries member_profiles for
//      that user_id, caching the verified result with a timestamp (persisted to disk).
//   3. _computeState() derives `member` from that cache. A failed live lookup NEVER
//      overwrites a previously-verified cache entry, and NEVER silently reports
//      trial_expired in place of a lookup that simply couldn't complete.

import {
  app,
  protocol,
  shell,
  BrowserWindow,
  ipcMain,
  session,
} from 'electron';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { resolve } from 'path';
import { getLBSession, getValidLBSession } from './lb_auth';
import { lookupMembership, type MembershipRow } from './membership_lookup';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIAL_DAYS = 30;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
// Retained only so an install that still has the old custom-scheme registration from a
// prior version doesn't dangle; nothing in this file dispatches a network call through
// it anymore (see _registerProtocol()).
const CUSTOM_SCHEME = 'amplify-computer';

const LB_JOIN_URL = 'https://lianabanyan.com/join?src=amplify-computer';
// Informational only — the age past which a cached-verified membership is reported to
// the UI as `membershipSource: 'cached'` instead of `'live'`. Does NOT gate whether the
// user is treated as a member; a stale-but-verified cache still resolves to 'member'.
const MEMBERSHIP_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;

const DATA_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
);
const AUTH_FILE = resolve(DATA_DIR, 'auth.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | 'unauthenticated'
  | 'trial_active'
  | 'trial_expired'
  | 'member'
  | 'validating'
  | 'unknown';

export interface MemberInfo {
  user_id: string;
  display_name: string;
  email: string;
  is_member: boolean;
  membership_expires?: string;   // ISO-8601 (date, from membership_expires_at)
  badge_tier?: 'stamped' | 'ghost';
  avatar_url?: string;
  member_number?: number;
  tags?: string[];
}

export interface AuthState {
  status: AuthStatus;
  member?: MemberInfo;
  trial_started_ts?: number;    // Unix ms
  trial_days_remaining?: number;
  token?: string;
  token_expires?: number;       // Unix ms
  degraded: boolean;
  // D-BP155-025 — surfaces the membership-lookup honesty contract to the renderer.
  // 'live'        — the cached result came from a lookup that succeeded this session.
  // 'cached'      — a previously-verified result is being used because the live lookup
  //                 could not run or did not complete just now (offline-safe: this is
  //                 what keeps a real member from being revoked by a network blip).
  // 'unreachable' — no cached result exists at all AND the live lookup has not
  //                 succeeded yet; this is what status:'unknown' means.
  // 'unchecked'   — no LB account is linked, so no membership lookup applies.
  membershipSource?: 'live' | 'cached' | 'unreachable' | 'unchecked';
  membershipCheckedAt?: number; // Unix ms of the last SUCCESSFUL live lookup, if any
}

// Cached result of the real member_profiles lookup (membership_lookup.ts). Written only
// by a successful (ok:true) call — a failed lookup never touches this.
export interface CachedMembership {
  membership_status: MembershipRow['membership_status'];
  membership_expires_at: string | null;
  member_number: number | null;
  tags: string[];
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  checked_at: number; // Unix ms
}

interface PersistedAuth {
  // Legacy fields from the retired OAuth flow. No longer written by this file; kept
  // only so an existing user's auth.json on disk still parses without loss, and so
  // sanitizedState() doesn't need special-casing for pre-upgrade installs.
  token?: string;
  token_expires?: number;
  member?: MemberInfo;
  trial_started_ts?: number;
  first_launch_ts: number;
  // D-BP155-025 — the real membership cache.
  lb_membership?: CachedMembership;
}

function isActiveMembership(status: MembershipRow['membership_status']): boolean {
  return status === 'active' || status === 'lifetime';
}

// ─── Auth Manager ─────────────────────────────────────────────────────────────

export class AuthManager {
  private state: AuthState = { status: 'unauthenticated', degraded: false };
  private windows: Set<BrowserWindow> = new Set();
  private persistedData: PersistedAuth | null = null;
  private stateListeners: Set<(state: Omit<AuthState, 'token'>) => void> = new Set();
  private _onOpenLbAccountLink: (() => void) | null = null;
  // Guards against overlapping refreshMembership() calls (init() + a periodic timer +
  // an immediate post-link call can all fire close together).
  private _membershipRefreshInFlight: Promise<void> | null = null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  init(): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    this._loadPersisted();
    this._computeState();
    this._registerProtocol();
    // D-BP155-025 — if an LB account is already linked (from a prior session), kick off
    // a live membership check immediately rather than waiting for the caller's first
    // periodic refresh. Fire-and-forget: _computeState() already produced a safe
    // synchronous state above (cached member, 'unknown', or the trial fallback).
    void this.refreshMembership();
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
    this._broadcast('auth-state-changed', this.sanitizedState());
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  getState(): AuthState {
    this._computeState();
    return { ...this.state };
  }

  sanitizedState(): Omit<AuthState, 'token'> {
    this._computeState();
    // Never send raw token to renderer
    const { token: _t, ...safe } = this.state;
    return safe;
  }

  onStateChanged(cb: (state: Omit<AuthState, 'token'>) => void): () => void {
    this.stateListeners.add(cb);
    cb(this.sanitizedState());
    return () => this.stateListeners.delete(cb);
  }

  isDegraded(): boolean {
    return this.state.degraded;
  }

  isMember(): boolean {
    return this.state.status === 'member';
  }

  /**
   * D-BP155-025 — "Sign in with existing LB Account" no longer opens the retired OAuth
   * round-trip (it POSTed to https://lianabanyan.com/api/amplify/validate, which has
   * never existed). It now points the user at the ALREADY-WORKING lb_auth.ts magic-link
   * flow on Tab 14 (LBAccountTab.tsx) — the same flow every other entry point into LB
   * Account linking uses, so there is exactly one sign-in path, not two. Window/dashboard
   * lifecycle lives in index.ts, not here, so this just invokes whatever handler index.ts
   * registered via setOpenLbAccountLinkHandler().
   */
  signIn(): void {
    this._onOpenLbAccountLink?.();
  }

  /** index.ts calls this once at startup to wire "open Tab 14 and focus it." */
  setOpenLbAccountLinkHandler(cb: () => void): void {
    this._onOpenLbAccountLink = cb;
  }

  /** Activate free access — "Use Free Forever" canonical path.
   *  Allowed from 'unauthenticated' (first launch) or 'validating' (user cancels sign-in). */
  startTrial(): void {
    if (this.state.status !== 'unauthenticated' && this.state.status !== 'validating') return;

    const now = Date.now();
    this.persistedData = {
      ...(this.persistedData ?? { first_launch_ts: now }),
      trial_started_ts: now,
    };
    this._save();
    this._computeState();
    this._broadcastState();
  }

  /**
   * Sign out — clears the legacy token fields (dead weight from the retired flow) AND
   * the real membership cache, then revokes the underlying lb_auth session so a
   * periodic refreshMembership() can't silently re-derive 'member' a few minutes later.
   * Preserves trial_started_ts — signing out of an LB account doesn't restart the trial.
   */
  async signOut(): Promise<void> {
    if (this.persistedData) {
      delete this.persistedData.token;
      delete this.persistedData.token_expires;
      delete this.persistedData.member;
      delete this.persistedData.lb_membership;
      this._save();
    }
    try {
      const { revokeDevice } = await import('./lb_auth');
      await revokeDevice();
    } catch (err) {
      console.warn('[Auth] signOut: lb_auth revokeDevice failed (local cache still cleared):', err);
    }
    this._computeState();
    this._broadcastState();
  }

  /** Open the $5/year join page */
  openJoinPage(): void {
    shell.openExternal(LB_JOIN_URL);
  }

  /**
   * D-BP155-025 — the ONLY membership-check entry point. Reads the linked lb_auth
   * session (refreshing its access_token first if needed), queries member_profiles, and
   * caches a successful result. A failed lookup (network/unauthorized) NEVER writes to
   * the cache and NEVER clears an existing one — see membership_lookup.ts and
   * lb_auth.ts's getValidLBSession() for the corresponding guarantees on their end.
   * Called from init(), immediately after a new device link completes (index.ts), and
   * from a periodic timer (index.ts) so a membership purchased/lapsed elsewhere is
   * picked up without requiring the app to restart.
   */
  async refreshMembership(): Promise<void> {
    if (this._membershipRefreshInFlight) return this._membershipRefreshInFlight;
    const run = this._refreshMembershipImpl().finally(() => {
      this._membershipRefreshInFlight = null;
    });
    this._membershipRefreshInFlight = run;
    return run;
  }

  private async _refreshMembershipImpl(): Promise<void> {
    const linked = getLBSession();
    if (!linked) {
      // No LB account linked — nothing to check. Existing cache (if any, from a
      // previously-linked-then-revoked account) is intentionally left alone here;
      // signOut()/revokeDevice() are what clear it.
      this._computeState();
      this._broadcastState();
      return;
    }

    const validSession = await getValidLBSession();
    if (!validSession) {
      // getValidLBSession() only returns null when the refresh_token was confirmed
      // dead (session cleared) — a transient refresh failure returns the old session
      // instead, so we still attempt the lookup below in that case.
      this._computeState();
      this._broadcastState();
      return;
    }

    const result = await lookupMembership(validSession);
    if (result.ok) {
      const row = result.row;
      this.persistedData = {
        ...(this.persistedData ?? { first_launch_ts: Date.now() }),
        lb_membership: row
          ? {
              membership_status: row.membership_status,
              membership_expires_at: row.membership_expires_at,
              member_number: row.member_number,
              tags: row.tags,
              username: row.username,
              display_name: row.display_name,
              avatar_url: row.avatar_url,
              checked_at: Date.now(),
            }
          : {
              // Live-confirmed: this identity has no member_profiles row at all.
              // A CONFIRMED non-member, distinct from "couldn't check."
              membership_status: 'inactive',
              membership_expires_at: null,
              member_number: null,
              tags: [],
              username: '',
              display_name: null,
              avatar_url: null,
              checked_at: Date.now(),
            },
      };
      this._save();
    }
    // result.ok === false: deliberately no-op on persistedData — see doc comment above.

    this._computeState();
    this._broadcastState();
  }

  // ─── IPC registration (called from index.ts registerIPCHandlers) ──────────

  registerIPCHandlers(): void {
    ipcMain.handle('get-auth-state', () => this.sanitizedState());
    ipcMain.on('auth-sign-in', () => { this.signIn(); });
    ipcMain.on('auth-sign-out', () => { this.signOut().catch(console.error); });
    ipcMain.on('auth-start-trial', () => { this.startTrial(); });
    ipcMain.on('auth-open-join', () => { this.openJoinPage(); });
    ipcMain.handle('auth-get-join-url', () => LB_JOIN_URL);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _registerProtocol(): void {
    // Register custom scheme BEFORE app is ready (must happen at module scope level)
    // electron-builder handles privileged scheme registration via app ready.
    //
    // D-BP155-025 — the OAuth flow this scheme existed for is retired (see this file's
    // header). This handler is kept ONLY so a machine with a prior install's OS-level
    // amplify-computer:// protocol registration doesn't hit an unhandled-protocol error
    // if the stale registration ever fires; it does not resolve to anything anymore.
    app.whenReady().then(() => {
      protocol.handle(CUSTOM_SCHEME, () => new Response('', { status: 200 }));
    });
  }

  private _computeState(): void {
    const p = this.persistedData;

    if (!p) {
      // Completely fresh install — show AuthGate
      this.state = { status: 'unauthenticated', degraded: false };
      return;
    }

    // ─── D-BP155-025: real membership, derived from the lb_auth session + cache ────
    const lbSession = getLBSession();
    const cached = p.lb_membership;

    if (lbSession) {
      if (cached && isActiveMembership(cached.membership_status)) {
        // Verified member — live just now, or a previously-verified result being used
        // because the live check hasn't completed since. NEVER downgraded by an
        // offline/failed lookup (refreshMembership() only ever writes on success).
        const fresh = Date.now() - cached.checked_at < MEMBERSHIP_CACHE_FRESH_MS;
        const daysUntilExpiry = cached.membership_expires_at
          ? Math.ceil(
              (new Date(cached.membership_expires_at).getTime() - Date.now()) /
              (24 * 60 * 60 * 1000),
            )
          : null;
        this.state = {
          status: 'member',
          member: {
            user_id: lbSession.user_id,
            display_name: cached.display_name || cached.username || lbSession.email,
            email: lbSession.email,
            is_member: true,
            membership_expires: cached.membership_expires_at ?? undefined,
            badge_tier: 'stamped',
            avatar_url: cached.avatar_url ?? undefined,
            member_number: cached.member_number ?? undefined,
            tags: cached.tags,
          },
          degraded: false,
          membershipSource: fresh ? 'live' : 'cached',
          membershipCheckedAt: cached.checked_at,
          ...(daysUntilExpiry !== null && daysUntilExpiry < 14 && cached.membership_status !== 'lifetime'
            ? { trial_days_remaining: daysUntilExpiry }
            : {}),
        };
        return;
      }

      if (!cached) {
        // Linked, but no live lookup has EVER succeeded (fresh link, or every attempt
        // so far has failed). This must never read as trial_expired — it is a distinct,
        // named "we don't know yet" state, surfaced honestly to the renderer.
        this.state = {
          status: 'unknown',
          degraded: false,
          membershipSource: 'unreachable',
          trial_started_ts: p.trial_started_ts,
          ...(p.trial_started_ts
            ? { trial_days_remaining: this._trialDaysRemaining(p.trial_started_ts) }
            : {}),
        };
        return;
      }

      // cached exists and is NOT an active status: a live lookup DID succeed and
      // confirmed this identity is not (or no longer) a member. Falls through to the
      // ordinary trial-timer logic below — the gate still correctly says no.
    }

    // Trial logic (also the correct resolution path for: no LB account linked yet, OR
    // a linked account that a live lookup confirmed is not a member).
    // membershipSource here is purely informational: 'live'/'cached' when a real,
    // confirmed non-member lookup produced this branch, 'unchecked' when no LB account
    // is linked at all so no lookup ever applied.
    const membershipSourceForTrial: AuthState['membershipSource'] =
      lbSession && cached ? (Date.now() - cached.checked_at < MEMBERSHIP_CACHE_FRESH_MS ? 'live' : 'cached') : 'unchecked';

    if (p.trial_started_ts) {
      const elapsed = Date.now() - p.trial_started_ts;
      const remaining = Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000));

      if (elapsed < TRIAL_MS) {
        this.state = {
          status: 'trial_active',
          trial_started_ts: p.trial_started_ts,
          trial_days_remaining: Math.max(1, remaining),
          degraded: false,
          member: p.member, // may have partial info from a failed/partial sign-in
          membershipSource: membershipSourceForTrial,
        };
      } else {
        // Trial expired — degraded mode. This is a GENUINE non-member (or nobody has
        // linked an LB account at all): substrate-write and Ollama stay blocked. The
        // gate still says no here — see PROVE IT (c) in the dispatch.
        this.state = {
          status: 'trial_expired',
          trial_started_ts: p.trial_started_ts,
          trial_days_remaining: 0,
          degraded: true,
          membershipSource: membershipSourceForTrial,
        };
      }
      return;
    }

    // Has first_launch_ts but no trial started — show AuthGate
    this.state = { status: 'unauthenticated', degraded: false, membershipSource: membershipSourceForTrial };
  }

  private _trialDaysRemaining(trialStartedTs: number): number {
    const elapsed = Date.now() - trialStartedTs;
    const remaining = Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000));
    return elapsed < TRIAL_MS ? Math.max(1, remaining) : 0;
  }

  private _broadcastState(): void {
    this._broadcast('auth-state-changed', this.sanitizedState());
  }

  private _broadcast(channel: string, payload: unknown): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
    if (channel === 'auth-state-changed') {
      for (const listener of this.stateListeners) {
        listener(payload as Omit<AuthState, 'token'>);
      }
    }
  }

  private _loadPersisted(): void {
    if (existsSync(AUTH_FILE)) {
      try {
        this.persistedData = JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as PersistedAuth;
        return;
      } catch {
        // Corrupted — start fresh
      }
    }
    // First ever launch
    this.persistedData = { first_launch_ts: Date.now() };
    this._save();
  }

  private _save(): void {
    try {
      writeFileSync(AUTH_FILE, JSON.stringify(this.persistedData, null, 2), 'utf8');
    } catch (err) {
      console.warn('[Auth] Could not persist auth state:', err);
    }
  }
}

// ─── Custom scheme must be registered before app ready ───────────────────────

export function registerCustomScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CUSTOM_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        allowServiceWorkers: false,
        supportFetchAPI: false,
        corsEnabled: false,
      },
    },
  ]);
}
