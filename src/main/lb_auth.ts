// lb_auth.ts — LB Account Authentication for Mnemosyne device linking
// BP065 Part A · SEG-B2a
//
// Flow: email → Supabase magic-link → mnemo://auth/callback → safeStorage session
// Methods: startLBAuthFlow · completeLBAuth · getLBSession · revokeDevice
//
// Blood Rule R16: access/refresh tokens NEVER logged or echoed.
// Session storage: safeStorage-encrypted JSON at ~/.mnemosyne/lb_session.enc
// Fallback: in-memory only if safeStorage unavailable (NEVER plaintext on disk).

import { safeStorage, shell } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { getStablePeerId } from './federation/peer-discovery';

// ─── Constants ────────────────────────────────────────────────────────────────

const MNEMOSYNE_HOME = resolve(homedir(), '.mnemosyne');
const SESSION_ENC_FILE = resolve(MNEMOSYNE_HOME, 'lb_session.enc');

// Protocol registered in index.ts via app.setAsDefaultProtocolClient('mnemo')
const MNEMO_PROTOCOL = 'mnemo';
const AUTH_REDIRECT_URI = `${MNEMO_PROTOCOL}://auth/callback`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LBSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
  peer_id: string;
  linked_at: string;
  crewman_number?: number;
}

export type LBAuthState =
  | { status: 'unlinked' }
  | { status: 'linking'; email: string }
  | { status: 'linked'; session: LBSession }
  | { status: 'error'; message: string };

// ─── Session Storage (safeStorage + file, fallback to in-memory) ─────────────

let _memorySession: LBSession | null = null;

function ensureMnemoHome(): void {
  if (!existsSync(MNEMOSYNE_HOME)) {
    mkdirSync(MNEMOSYNE_HOME, { recursive: true });
  }
}

function persistSession(session: LBSession): void {
  // Blood Rule R16: never log token values
  try {
    ensureMnemoHome();
    const json = JSON.stringify(session);
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptString(json);
      writeFileSync(SESSION_ENC_FILE, enc);
    } else {
      // safeStorage unavailable — store in memory only, never plaintext on disk
      _memorySession = session;
      console.warn('[lb_auth] safeStorage unavailable — session stored in memory only (not persisted)');
    }
  } catch (err) {
    console.error('[lb_auth] Failed to persist session:', (err as Error).message);
    _memorySession = session;
  }
}

function loadSession(): LBSession | null {
  if (_memorySession) return _memorySession;
  try {
    if (!existsSync(SESSION_ENC_FILE)) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const enc = readFileSync(SESSION_ENC_FILE);
    const json = safeStorage.decryptString(enc);
    const parsed = JSON.parse(json) as LBSession;
    if (!parsed.access_token || !parsed.user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearSession(): void {
  _memorySession = null;
  try {
    if (existsSync(SESSION_ENC_FILE)) {
      const { unlinkSync } = require('fs') as typeof import('fs');
      unlinkSync(SESSION_ENC_FILE);
    }
  } catch {
    // Ignore delete errors
  }
}

// ─── Supabase helpers (no SDK dependency — uses fetch) ────────────────────────

function getSupabaseConfig(): { url: string; anonKey: string; deviceLinkFnUrl: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.warn('[lb_auth] SUPABASE_URL or SUPABASE_ANON_KEY not set — LB Account link unavailable');
    return null;
  }
  // Edge function URL: {SUPABASE_URL}/functions/v1/mnemosyne-device-link
  const deviceLinkFnUrl = `${url.replace(/\/$/, '')}/functions/v1/mnemosyne-device-link`;
  return { url, anonKey, deviceLinkFnUrl };
}

async function supabaseFetch(
  endpoint: string,
  opts: { method: string; headers?: Record<string, string>; body?: unknown },
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const resp = await fetch(endpoint, {
    method: opts.method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    data = {};
  }
  return { ok: resp.ok, status: resp.status, data };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a Supabase OTP magic-link to the user's email.
 * Opens the link in the system browser; user clicks, OS fires mnemo://auth/callback.
 */
export async function startLBAuthFlow(email: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getSupabaseConfig();
  if (!cfg) return { ok: false, error: 'Platform config not available. Check SUPABASE_URL and SUPABASE_ANON_KEY.' };

  try {
    const result = await supabaseFetch(`${cfg.url}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
      },
      body: {
        email,
        create_user: true,
        options: { redirect_to: AUTH_REDIRECT_URI },
      },
    });
    if (!result.ok) {
      const msg = (result.data as Record<string, unknown>)?.msg as string ?? `Supabase OTP failed (${result.status})`;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Complete the auth flow from the mnemo://auth/callback deep-link.
 * Exchanges the access_token for a device-link record and persists the session.
 * Called from the deep-link handler with the fragment parsed from the URL.
 */
export async function completeLBAuth(
  accessToken: string,
  refreshToken: string,
  email: string,
): Promise<{ ok: boolean; session?: LBSession; error?: string }> {
  const cfg = getSupabaseConfig();
  if (!cfg) return { ok: false, error: 'Platform config not available.' };

  try {
    const peerId = await getStablePeerId();
    const appVersion: string = (require('electron').app as Electron.App).getVersion();

    // Call the mnemosyne-device-link edge function (authenticated)
    const linkResult = await supabaseFetch(cfg.deviceLinkFnUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: cfg.anonKey,
      },
      body: {
        peer_id: peerId,
        device_label: `Mnemosyne ${appVersion}`,
        app_version: appVersion,
        platform: 'mnemosyne',
      },
    });

    if (!linkResult.ok) {
      const msg = (linkResult.data as Record<string, unknown>)?.error as string
        ?? `Device link failed (${linkResult.status})`;
      return { ok: false, error: msg };
    }

    const linkData = linkResult.data as { user_id: string; peer_id: string; crewman_number?: number };
    const session: LBSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      user_id: linkData.user_id,
      email,
      peer_id: peerId,
      linked_at: new Date().toISOString(),
      crewman_number: linkData.crewman_number,
    };

    persistSession(session);
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Get the current persisted LB session, or null if not linked.
 */
export function getLBSession(): LBSession | null {
  return loadSession();
}

/**
 * Revoke the device link and clear the local session.
 */
export async function revokeDevice(): Promise<{ ok: boolean; error?: string }> {
  const session = loadSession();
  if (!session) {
    clearSession();
    return { ok: true };
  }

  const cfg = getSupabaseConfig();
  if (cfg) {
    try {
      // PATCH the device link to set revoked_at = now()
      await supabaseFetch(`${cfg.deviceLinkFnUrl}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: cfg.anonKey,
        },
        body: { peer_id: session.peer_id },
      });
    } catch {
      // Ignore network errors on revoke — clear locally regardless
    }
  }

  clearSession();
  return { ok: true };
}
