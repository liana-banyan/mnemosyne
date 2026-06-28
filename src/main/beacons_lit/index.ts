// Mnemosyne -- Beacons Lit (bonfire_lit module)
// BP098 M43 -- Desktop Electron port of the web-platform bonfire_lit Scribe.
//
// UX name: Beacons Lit (canonical). DB names: bonfire_lit_state,
// bonfire_lit_recovery_log (load-bearing, do not rename).
//
// On startup: calls beacons-lit-handshake edge function to write
// bonfire_lit_state handshake row and patch peer_presence.capabilities
// with beacons_lit_active: true.
//
// Heartbeat: 5-minute interval re-calls the edge function to keep
// beacons_lit_active fresh in peer_presence (TTL-safe).
//
// IPC channels: bonfire_lit:status + bonfire_lit:toggle (see ipc_channels.ts)
//
// Phantom exclusion: peer IDs starting with '49f3e597' are always excluded.
//
// Auto-start discipline (per §18 / Founder ratification):
//   enable() is called automatically on app startup after Supabase auth
//   is confirmed. No membership gate on the desktop app.

import { app } from 'electron';
import { getStablePeerId } from '../federation/peer-discovery';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ruuxzilgmuwddcofqecc.supabase.co';
const LB_EDGE_BASE = `${SUPABASE_URL}/functions/v1`;
const PHANTOM_PREFIX = '49f3e597';
const HEARTBEAT_MS = 5 * 60 * 1000; // 5 minutes -- stays under wan-relay-publish rate limit
const CAI_VERSION = '0.8.2'; // M43 CAI semantic version

// ─── Module State ─────────────────────────────────────────────────────────────

let _enabled = false;
let _initialized = false;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _lastHandshakeAt: string | null = null;
let _lastError: string | null = null;
let _anonKey: string | null = null;
let _accessToken: string | null = null;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BeaconsLitStatus {
  enabled: boolean;
  initialized: boolean;
  peer_id: string;
  cai_version: string;
  last_handshake_at: string | null;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPhantomPeer(peerId: string): boolean {
  return peerId.startsWith(PHANTOM_PREFIX);
}

function getAnonKey(): string {
  return _anonKey ?? (process.env.SUPABASE_ANON_KEY ?? '');
}

async function callHandshake(peerId: string): Promise<void> {
  const anonKey = getAnonKey();
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY not set -- beacons_lit handshake skipped');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
  };
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const appVersion = app.isReady() ? app.getVersion() : '0.1.21';

  const res = await fetch(`${LB_EDGE_BASE}/beacons-lit-handshake`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      peer_id: peerId,
      context_type: 'priming',
      sync_status: 'ok',
      app_version: appVersion,
      cai_version: CAI_VERSION,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg =
      (errData as { error?: string })?.error ??
      `beacons-lit-handshake HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = (await res.json()) as { ok: boolean; phantom?: boolean };
  if (!data.ok && !data.phantom) {
    throw new Error('beacons-lit-handshake returned ok: false');
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Initialize the Beacons Lit module. Call once at app startup after
 * env_loader has populated SUPABASE_ANON_KEY.
 *
 * @param opts.anonKey  Supabase anon key (falls back to env var if not supplied)
 * @param opts.accessToken  LB auth access token (optional; improves presence tier)
 */
export async function initializeBeaconsLit(opts?: {
  anonKey?: string;
  accessToken?: string;
}): Promise<void> {
  if (_initialized) return;

  if (opts?.anonKey) _anonKey = opts.anonKey;
  if (opts?.accessToken) _accessToken = opts.accessToken;

  _initialized = true;

  // Auto-start per §18 discipline
  await enable();
}

/**
 * Enable Beacons Lit. Runs the initial handshake immediately, then starts
 * the 5-minute heartbeat timer.
 */
export async function enable(): Promise<void> {
  if (_enabled) return;
  _enabled = true;

  const peerId = getStablePeerId();
  if (isPhantomPeer(peerId)) {
    console.log('[BeaconsLit] phantom peer -- Beacons Lit disabled silently');
    _enabled = false;
    return;
  }

  // Initial handshake
  await _runHandshake(peerId);

  // Start heartbeat
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(() => {
    _runHandshake(peerId).catch((e: Error) =>
      console.warn('[BeaconsLit] heartbeat handshake error:', e.message),
    );
  }, HEARTBEAT_MS);

  console.log(`[BeaconsLit] enabled -- peer=${peerId} cai=${CAI_VERSION}`);
}

/**
 * Disable Beacons Lit. Stops the heartbeat timer.
 * Does NOT write a disabled state to bonfire_lit_state (non-destructive).
 */
export function disable(): void {
  if (!_enabled) return;
  _enabled = false;
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  console.log('[BeaconsLit] disabled');
}

/**
 * Update the LB auth access token (called when LB auth state changes).
 */
export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

/**
 * Get current module status for IPC / tray.
 */
export function getStatus(): BeaconsLitStatus {
  return {
    enabled: _enabled,
    initialized: _initialized,
    peer_id: getStablePeerId(),
    cai_version: CAI_VERSION,
    last_handshake_at: _lastHandshakeAt,
    error: _lastError,
  };
}

/**
 * Tear down the module (call on app before-quit).
 */
export function destroyBeaconsLit(): void {
  disable();
  _initialized = false;
  _anonKey = null;
  _accessToken = null;
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _runHandshake(peerId: string): Promise<void> {
  try {
    await callHandshake(peerId);
    _lastHandshakeAt = new Date().toISOString();
    _lastError = null;
    if (process.env.NODE_ENV === 'development') {
      console.log('[BeaconsLit] handshake OK at', _lastHandshakeAt);
    }
  } catch (err) {
    _lastError = (err as Error).message;
    console.warn('[BeaconsLit] handshake failed (non-fatal):', _lastError);
  }
}
