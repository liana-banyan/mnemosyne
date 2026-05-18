// AMPLIFY Computer — Cooperative Member Auth Manager
// B37 Phase 7 — OAuth flow, trial tracking, member validation, degraded mode
//
// Auth states:
//   member         — active LB cooperative member, full features + badge
//   trial_active   — non-member within 30-day trial window, full features
//   trial_expired  — non-member past 30 days, degraded mode (substrate read-only)
//   unauthenticated — fresh install, trial not started (AuthGate shown)
//
// OAuth flow:
//   1. Open https://lianabanyan.com/amplify-auth in default browser
//   2. User signs in, LB platform redirects → amplify-computer://auth?token=XXX
//   3. Electron custom protocol captures token
//   4. Validate token against https://lianabanyan.com/api/amplify/validate
//   5. Persist member info to disk

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

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIAL_DAYS = 30;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const CUSTOM_SCHEME = 'amplify-computer';

const LB_AUTH_URL = 'https://lianabanyan.com/amplify-auth';
const LB_VALIDATE_URL = 'https://lianabanyan.com/api/amplify/validate';
const LB_JOIN_URL = 'https://lianabanyan.com/join?src=amplify-computer';

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
  | 'validating';

export interface MemberInfo {
  user_id: string;
  display_name: string;
  email: string;
  is_member: boolean;
  membership_expires?: string;   // ISO-8601
  badge_tier?: 'stamped' | 'ghost';
  avatar_url?: string;
}

export interface AuthState {
  status: AuthStatus;
  member?: MemberInfo;
  trial_started_ts?: number;    // Unix ms
  trial_days_remaining?: number;
  token?: string;
  token_expires?: number;       // Unix ms
  degraded: boolean;
}

interface PersistedAuth {
  token?: string;
  token_expires?: number;
  member?: MemberInfo;
  trial_started_ts?: number;
  first_launch_ts: number;
}

// ─── Auth Manager ─────────────────────────────────────────────────────────────

export class AuthManager {
  private state: AuthState = { status: 'unauthenticated', degraded: false };
  private windows: Set<BrowserWindow> = new Set();
  private persistedData: PersistedAuth | null = null;
  private tokenResolvers: Array<(token: string | null) => void> = [];
  private stateListeners: Set<(state: Omit<AuthState, 'token'>) => void> = new Set();

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  init(): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    this._loadPersisted();
    this._computeState();
    this._registerProtocol();
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

  /** Start the OAuth flow in the default browser */
  async signIn(): Promise<void> {
    this._setState({ status: 'validating' });

    // Open LB auth page in default browser
    await shell.openExternal(LB_AUTH_URL);

    // Wait for the custom protocol callback (up to 5 minutes)
    const token = await this._waitForAuthCallback(5 * 60 * 1000);

    if (!token) {
      this._computeState(); // revert to pre-sign-in state
      return;
    }

    await this._validateAndSave(token);
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

  /** Sign out — clear token, preserve trial data */
  signOut(): void {
    if (this.persistedData) {
      delete this.persistedData.token;
      delete this.persistedData.token_expires;
      delete this.persistedData.member;
      this._save();
    }
    this._computeState();
    this._broadcastState();
  }

  /** Open the $5/year join page */
  openJoinPage(): void {
    shell.openExternal(LB_JOIN_URL);
  }

  /** Refresh token validity (called on startup + every hour) */
  async refreshIfNeeded(): Promise<void> {
    if (
      this.state.status === 'member' &&
      this.persistedData?.token &&
      this.persistedData.token_expires &&
      this.persistedData.token_expires < Date.now() + 60 * 60 * 1000 // within 1h of expiry
    ) {
      // Re-validate with current token
      await this._validateAndSave(this.persistedData.token);
    }
  }

  // ─── IPC registration (called from index.ts registerIPCHandlers) ──────────

  registerIPCHandlers(): void {
    ipcMain.handle('get-auth-state', () => this.sanitizedState());
    ipcMain.on('auth-sign-in', () => { this.signIn().catch(console.error); });
    ipcMain.on('auth-sign-out', () => { this.signOut(); });
    ipcMain.on('auth-start-trial', () => { this.startTrial(); });
    ipcMain.on('auth-open-join', () => { this.openJoinPage(); });
    ipcMain.handle('auth-get-join-url', () => LB_JOIN_URL);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _registerProtocol(): void {
    // Register custom scheme BEFORE app is ready (must happen at module scope level)
    // electron-builder handles privileged scheme registration via app ready
    app.whenReady().then(() => {
      protocol.handle(CUSTOM_SCHEME, (request) => {
        const url = new URL(request.url);
        if (url.pathname === '//auth' || url.pathname === '/auth') {
          const token = url.searchParams.get('token');
          if (token) {
            this.tokenResolvers.forEach((r) => r(token));
            this.tokenResolvers = [];
          } else {
            this.tokenResolvers.forEach((r) => r(null));
            this.tokenResolvers = [];
          }
        }
        // Return empty 200 response (browser page closes itself)
        return new Response('', { status: 200 });
      });
    });
  }

  private _waitForAuthCallback(timeoutMs: number): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.tokenResolvers.indexOf(resolve);
        if (idx >= 0) this.tokenResolvers.splice(idx, 1);
        resolve(null);
      }, timeoutMs);

      this.tokenResolvers.push((token) => {
        clearTimeout(timer);
        resolve(token);
      });
    });
  }

  private async _validateAndSave(token: string): Promise<void> {
    try {
      const res = await fetch(LB_VALIDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-AMPLIFY-Version': '0.1.0',
        },
        body: JSON.stringify({ client: 'amplify-computer' }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn('[Auth] Token validation failed:', res.status);
        this._computeState();
        this._broadcastState();
        return;
      }

      const data = await res.json() as {
        user_id: string;
        display_name: string;
        email: string;
        is_member: boolean;
        membership_expires?: string;
        badge_tier?: 'stamped' | 'ghost';
        avatar_url?: string;
        token_expires_in_seconds?: number;
      };

      const member: MemberInfo = {
        user_id: data.user_id,
        display_name: data.display_name,
        email: data.email,
        is_member: data.is_member,
        membership_expires: data.membership_expires,
        badge_tier: data.badge_tier,
        avatar_url: data.avatar_url,
      };

      const tokenExpires = data.token_expires_in_seconds
        ? Date.now() + data.token_expires_in_seconds * 1000
        : Date.now() + 24 * 60 * 60 * 1000; // default 24h

      this.persistedData = {
        ...(this.persistedData ?? { first_launch_ts: Date.now() }),
        token,
        token_expires: tokenExpires,
        member,
      };
      this._save();
      this._computeState();
      this._broadcastState();

      console.log(
        `[Auth] Signed in as ${member.display_name} — ` +
        `member=${member.is_member} badge=${member.badge_tier ?? 'none'}`,
      );
    } catch (err) {
      console.error('[Auth] Validation error:', err);
      this._computeState();
      this._broadcastState();
    }
  }

  private _computeState(): void {
    const p = this.persistedData;

    if (!p) {
      // Completely fresh install — show AuthGate
      this.state = { status: 'unauthenticated', degraded: false };
      return;
    }

    // Authenticated member
    if (p.token && p.member?.is_member) {
      // Check token not expired
      if (!p.token_expires || p.token_expires > Date.now()) {
        const daysUntilMembershipExpiry = p.member.membership_expires
          ? Math.ceil(
              (new Date(p.member.membership_expires).getTime() - Date.now()) /
              (24 * 60 * 60 * 1000),
            )
          : null;

        this.state = {
          status: 'member',
          member: p.member,
          token: p.token,
          token_expires: p.token_expires,
          degraded: false,
          // Surface expiry warning if < 14 days
          ...(daysUntilMembershipExpiry !== null && daysUntilMembershipExpiry < 14
            ? { trial_days_remaining: daysUntilMembershipExpiry }
            : {}),
        };
        return;
      }
    }

    // Trial logic
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
        };
      } else {
        // Trial expired — degraded mode
        this.state = {
          status: 'trial_expired',
          trial_started_ts: p.trial_started_ts,
          trial_days_remaining: 0,
          degraded: true,
        };
      }
      return;
    }

    // Has first_launch_ts but no trial started — show AuthGate
    this.state = { status: 'unauthenticated', degraded: false };
  }

  private _setState(partial: Partial<AuthState>): void {
    this.state = { ...this.state, ...partial };
    this._broadcastState();
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
