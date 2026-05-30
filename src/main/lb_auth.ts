// Mnemosyne — LB Account Auth Module
// BP065 · Tier-2 Onboarding · Part A (SEG-B2a)
// Magic-link auth flow: email → Supabase OTP → mnemo:// deep-link → completeLBAuth
//
// Storage: access_token + refresh_token stored in safeStorage-encrypted JSON file.
// Falls back to in-memory session if safeStorage unavailable (never plaintext on disk).
//
// Flow:
//   1. startLBAuthFlow(email) — calls supabase.auth.signInWithOtp → sends magic-link email
//   2. User clicks link in email → browser opens
//      Supabase redirects → mnemo://auth/callback#access_token=...&refresh_token=...
//   3. Electron catches mnemo:// via app.on('second-instance') / 'open-url'
//   4. completeLBAuth(accessToken, refreshToken) — stores session + calls mnemosyne-device-link
//   5. getLBSession() — returns current session (null if not linked)
//   6. revokeDevice(peerId) — clears session from disk
//
// Dev mode: if MNEMOSYNE_LB_AUTH_DEV=1, emailRedirectTo uses localhost relay
//
// Authored: 2026-05-30T21:30:00Z · Knight BP065

import { safeStorage, app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ruuxzilgmuwddcofqecc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

const LB_EDGE_BASE = `${SUPABASE_URL}/functions/v1`;

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;

// mnemo:// protocol for production; localhost relay for dev
const MAGIC_LINK_REDIRECT = IS_DEV
  ? 'http://127.0.0.1:5173/mnemo-auth-relay'
  : 'mnemo://auth/callback';

// Session file path (encrypted blob or absent if in-memory only)
function getSessionPath(): string {
  const userData = app.getPath('userData');
  const dir = join(userData, 'lb_session');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'session.enc');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LBSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
  linked_at: string;
  peer_id: string;
}

// In-memory fallback (used if safeStorage unavailable)
let _inMemorySession: LBSession | null = null;
let _safeStorageAvailable: boolean | null = null;

function isSafeStorageAvailable(): boolean {
  if (_safeStorageAvailable !== null) return _safeStorageAvailable;
  try {
    _safeStorageAvailable = safeStorage.isEncryptionAvailable();
  } catch {
    _safeStorageAvailable = false;
  }
  return _safeStorageAvailable;
}

// ─── Session Persistence ──────────────────────────────────────────────────────

function saveSession(session: LBSession): void {
  if (!isSafeStorageAvailable()) {
    _inMemorySession = session;
    console.log('[lb_auth] safeStorage unavailable — session stored in-memory only (non-persistent)');
    return;
  }
  try {
    const plain = Buffer.from(JSON.stringify(session), 'utf-8');
    const encrypted = safeStorage.encryptString(JSON.stringify(session));
    void plain; // suppress lint
    writeFileSync(getSessionPath(), encrypted);
    console.log('[lb_auth] session saved (safeStorage encrypted)');
  } catch (err) {
    // Fallback to in-memory — NEVER write plaintext
    _inMemorySession = session;
    console.warn('[lb_auth] safeStorage write failed — falling back to in-memory:', (err as Error).message);
  }
}

function loadSession(): LBSession | null {
  if (_inMemorySession) return _inMemorySession;
  if (!isSafeStorageAvailable()) return null;
  const path = getSessionPath();
  if (!existsSync(path)) return null;
  try {
    const encrypted = readFileSync(path);
    const plain = safeStorage.decryptString(encrypted);
    return JSON.parse(plain) as LBSession;
  } catch {
    return null;
  }
}

function clearSession(): void {
  _inMemorySession = null;
  const path = getSessionPath();
  if (existsSync(path)) {
    try {
      writeFileSync(path, Buffer.alloc(0)); // zero the file
      const fs = require('fs') as typeof import('fs');
      fs.unlinkSync(path);
    } catch {
      // best-effort
    }
  }
}

// ─── Magic-Link Auth Flow ─────────────────────────────────────────────────────

/**
 * Start the LB magic-link auth flow.
 * Sends OTP email to the user. Returns { ok, error? }.
 * The deep-link handler completes the flow when mnemo://auth/callback arrives.
 */
export async function startLBAuthFlow(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!email?.trim()) {
    return { ok: false, error: 'Email is required' };
  }
  if (!SUPABASE_ANON_KEY) {
    console.warn('[lb_auth] SUPABASE_ANON_KEY not set — magic-link unavailable');
    return { ok: false, error: 'Auth service not configured (SUPABASE_ANON_KEY missing)' };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        create_user: false, // LB members already have accounts
        options: {
          emailRedirectTo: MAGIC_LINK_REDIRECT,
        },
      }),
    });

    if (res.ok) {
      console.log('[lb_auth] magic-link OTP sent to email');
      return { ok: true };
    }

    const errData = await res.json().catch(() => ({}));
    const msg = (errData as { error_description?: string; msg?: string })?.error_description
      || (errData as { msg?: string })?.msg
      || `HTTP ${res.status}`;
    return { ok: false, error: msg };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Complete the LB auth flow after receiving the magic-link deep-link callback.
 * Exchanges tokens, fetches user info, stores session, and calls mnemosyne-device-link.
 */
export async function completeLBAuth(
  accessToken: string,
  refreshToken: string,
  peerId: string,
  appVersion?: string,
): Promise<{ ok: boolean; session?: LBSession; error?: string }> {
  if (!accessToken || !refreshToken || !peerId) {
    return { ok: false, error: 'Missing tokens or peer_id' };
  }
  if (!SUPABASE_ANON_KEY) {
    return { ok: false, error: 'Auth service not configured' };
  }

  try {
    // Get user info with the access token
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userRes.ok) {
      return { ok: false, error: `Could not retrieve user (HTTP ${userRes.status})` };
    }

    const userData = await userRes.json() as { id: string; email: string };
    if (!userData?.id || !userData?.email) {
      return { ok: false, error: 'Invalid user data from Supabase' };
    }

    // Call mnemosyne-device-link edge fn to register this device
    const linkRes = await fetch(`${LB_EDGE_BASE}/mnemosyne-device-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        peer_id: peerId,
        device_label: `Mnemosyne ${process.platform}`,
        app_version: appVersion,
      }),
    });

    if (!linkRes.ok) {
      const linkErr = await linkRes.json().catch(() => ({}));
      const msg = (linkErr as { error?: string })?.error ?? `Device link HTTP ${linkRes.status}`;
      return { ok: false, error: msg };
    }

    const session: LBSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      user_id: userData.id,
      email: userData.email,
      linked_at: new Date().toISOString(),
      peer_id: peerId,
    };

    saveSession(session);
    console.log(`[lb_auth] linked — user=${userData.email} peer=${peerId}`);
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Returns the current LB session, or null if not linked.
 */
export function getLBSession(): LBSession | null {
  return loadSession();
}

/**
 * Revoke this device — clears the local session.
 * (Does not call the backend revoke endpoint in this wave — local clear only.)
 */
export function revokeDevice(): void {
  clearSession();
  console.log('[lb_auth] device revoked — session cleared');
}

/**
 * Register this device on the Frontier (Part B prerequisite: device must already be linked).
 */
export async function registerFrontierNode(opts: {
  peerId: string;
  appVersion?: string;
  transportHint?: string;
  relayPeerId?: string;
}): Promise<{ ok: boolean; frontierNodeId?: string; error?: string }> {
  const session = loadSession();
  if (!session) return { ok: false, error: 'Not linked to a LB account' };

  try {
    const res = await fetch(`${LB_EDGE_BASE}/frontier-node-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        peer_id: opts.peerId,
        node_label: `Mnemosyne ${process.platform}`,
        app_version: opts.appVersion,
        transport_hint: opts.transportHint,
        relay_peer_id: opts.relayPeerId,
      }),
    });

    const data = await res.json() as { registered?: boolean; frontier_node_id?: string; error?: string };
    if (!res.ok || !data.registered) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, frontierNodeId: data.frontier_node_id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Send a heartbeat for a registered Frontier node.
 */
export async function sendFrontierHeartbeat(peerId: string): Promise<{ ok: boolean; error?: string }> {
  const session = loadSession();
  if (!session) return { ok: false, error: 'Not linked' };

  try {
    const res = await fetch(`${LB_EDGE_BASE}/frontier-node-heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ peer_id: peerId }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { ok: false, error: (d as { error?: string })?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Withdraw this device from the Frontier mesh.
 */
export async function withdrawFrontierNode(peerId: string): Promise<{ ok: boolean; error?: string }> {
  const session = loadSession();
  if (!session) return { ok: false, error: 'Not linked' };

  // Use the service-role-less user path: update withdrawn_at via the user's own token
  // The frontier_nodes_own_update policy allows this.
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/frontier_nodes?user_id=eq.${session.user_id}&peer_id=eq.${encodeURIComponent(peerId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ withdrawn_at: new Date().toISOString() }),
      }
    );

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Read active (non-withdrawn) Frontier nodes visible to this user.
 * Returns the public cooperative mesh.
 */
export async function getFrontierNodes(): Promise<{
  ok: boolean;
  nodes?: Array<{
    id: string;
    user_id: string;
    peer_id: string;
    node_label: string | null;
    app_version: string | null;
    registered_at: string;
    last_heartbeat_at: string;
    withdrawn_at: string | null;
  }>;
  error?: string;
}> {
  const session = loadSession();
  if (!session) return { ok: false, error: 'Not linked' };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/frontier_nodes?withdrawn_at=is.null&select=id,user_id,peer_id,node_label,app_version,registered_at,last_heartbeat_at,withdrawn_at`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const nodes = await res.json();
    return { ok: true, nodes };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
