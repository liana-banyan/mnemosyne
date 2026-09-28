// substrate_awakens_ipc.ts — BP084 SEG-3
// Registers IPC handlers for Substrate Awakens "Join Live Event" flow.
// Called from src/main/index.ts::registerSubstrateAwakensIPC()

import { ipcMain } from 'electron';
import { randomBytes } from 'crypto';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getLocalIPs } from '../mobile_pwa';
import { detectHardwareTier } from '../hardware/ram_detector';
// D-BP223-BM0-X030-098 (same class as X030-073 P1, XO X030 pick on Founder k/0a8d1c96): the handshake used to send
// sha256(email) UNSALTED to the relay every 60 s (email_hash, and peer_id was its first 16 hex). It now uses the per-install
// SALTED beacon hash (salt local, never sent) and obeys the one "Share presence with my other machines" switch.
import { beaconEmailHashOrNull } from '../identity/beacon_email_hash';

const RELAY_BASE_PRIMARY = process.env.SUBSTRATE_AWAKENS_RELAY ?? 'https://relay.lianabanyan.com/functions/v1';
const RELAY_BASE_FALLBACK = 'https://ruuxzilgmuwddcofqecc.supabase.co/functions/v1';
const RELAY_TIMEOUT_MS = 12_000;

const STATE_DIR = join(homedir(), '.lb_substrate');
const STATE_FILE = join(STATE_DIR, 'substrate_awakens_state.json');

interface SubstrateAwakensState {
  joined: boolean;
  peerId: string;
  sid: string;
  displayName: string;
  email: string;
  joinedAt: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** X030-098: the relay-facing identity for a handshake. email_hash is the per-install salted hash (null when the salt is
 *  unusable, and then no email hash is sent at all, never the unsalted one); peer_id derives from that salted value, or is
 *  random when there is none. Nothing here is reversible to the email by guessing. */
export function buildSubstrateAwakensIdentity(email: string, saltPath?: string): { emailHash: string | null; peerId: string } {
  const emailHash = saltPath === undefined ? beaconEmailHashOrNull(email) : beaconEmailHashOrNull(email, saltPath);
  const peerId = (emailHash ? emailHash.slice(0, 16) : randomBytes(8).toString('hex')) + '-sa';
  return { emailHash, peerId };
}

/** X030-098: the ONE presence switch (peer_server.ts getPresenceShareState). Unreadable = OFF (fail closed). */
function defaultIsPresenceSharingOn(): boolean {
  try {
    return (require('./peer_server') as typeof import('./peer_server')).getPresenceShareState().enabled === true;
  } catch {
    return false;
  }
}

export interface SubstrateAwakensDeps {
  /** Tests only: override the presence switch read. */
  isPresenceSharingOn?: () => boolean;
  /** Tests only: override the beacon salt file path. */
  saltPath?: string;
}

export const PRESENCE_OFF_HANDSHAKE_MESSAGE =
  '"Share presence with my other machines" is off, so this machine was not announced to the relay. Turn it on to join the live event.';

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

async function relayPost(path: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

  try {
    const primary = await fetch(`${RELAY_BASE_PRIMARY}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!isRetryableStatus(primary.status)) return primary;
  } catch {
    // primary unreachable — fall through to fallback
  } finally {
    clearTimeout(timer);
  }

  // Fallback attempt
  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), RELAY_TIMEOUT_MS);
  try {
    return await fetch(`${RELAY_BASE_FALLBACK}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller2.signal,
    });
  } finally {
    clearTimeout(timer2);
  }
}

function readState(): SubstrateAwakensState | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as SubstrateAwakensState;
  } catch {
    return null;
  }
}

function writeState(state: SubstrateAwakensState): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// ── heartbeat ─────────────────────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat(peanutRoll: () => object, isPresenceSharingOn: () => boolean): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    // X030-098: the switch is read on every tick; turned off = the heartbeat stops and nothing more is sent.
    if (!isPresenceSharingOn()) { stopHeartbeat(); return; }
    try {
      await relayPost('/wan-relay-publish', peanutRoll());
    } catch {
      // Heartbeat failures are silent — next tick will retry
    }
  }, 60_000);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function registerSubstrateAwakensIPC(deps: SubstrateAwakensDeps = {}): () => void {
  const isPresenceSharingOn = deps.isPresenceSharingOn ?? defaultIsPresenceSharingOn;
  // ── substrate-awakens:register ──────────────────────────────────────────
  ipcMain.handle(
    'substrate-awakens:register',
    async (_event, { email, displayName, ramTier }: { email: string; displayName: string; ramTier: string }) => {
      try {
        const res = await relayPost('/register-SubstrateAwakens', {
          email,
          display_name: displayName,
          ram_tier: ramTier,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => `HTTP ${res.status}`);
          return { success: false, error: `Registration failed (${res.status}): ${text}` };
        }

        const json = (await res.json()) as { success?: boolean; message?: string };
        return { success: json.success ?? true, message: json.message };
      } catch (err) {
        return { success: false, error: `Network error: ${String(err)}` };
      }
    },
  );

  // ── substrate-awakens:handshake ─────────────────────────────────────────
  ipcMain.handle(
    'substrate-awakens:handshake',
    async (_event, { token, email, displayName }: { token: string; email: string; displayName: string }) => {
      try {
        if (!isPresenceSharingOn()) {
          return { success: false, presenceSharingOff: true, error: PRESENCE_OFF_HANDSHAKE_MESSAGE };
        }
        const sid = randomBytes(16).toString('hex');
        const { emailHash, peerId } = buildSubstrateAwakensIdentity(email, deps.saltPath);
        const lanAddresses = getLocalIPs();
        const hardwareTier = detectHardwareTier();
        const relaySessionId = randomUUID();

        const peanutRoll = () => ({
          v: 1,
          s: sid,
          p: [],
          b: { token, displayName },
          ts: Date.now(),
          peer_id: peerId,
          ...(emailHash ? { email_hash: emailHash } : {}),
          lan_addresses: lanAddresses,
          relay_session_id: relaySessionId,
          capabilities: {
            ram_gb: hardwareTier.ramGb,
            version: '0.5.0',
            model: hardwareTier.recommendedModel,
            display_name: displayName,
          },
        });

        const res = await relayPost('/wan-relay-publish', peanutRoll());

        if (!res.ok && !isRetryableStatus(res.status)) {
          const text = await res.text().catch(() => `HTTP ${res.status}`);
          return { success: false, error: `Handshake failed (${res.status}): ${text}` };
        }

        const state: SubstrateAwakensState = {
          joined: true,
          peerId,
          sid,
          displayName,
          email,
          joinedAt: new Date().toISOString(),
        };
        writeState(state);
        startHeartbeat(peanutRoll, isPresenceSharingOn);

        return { success: true, peerId, displayName };
      } catch (err) {
        return { success: false, error: `Handshake error: ${String(err)}` };
      }
    },
  );

  // ── substrate-awakens:get-state ─────────────────────────────────────────
  ipcMain.handle('substrate-awakens:get-state', async () => {
    const state = readState();
    if (!state || !state.joined) return { joined: false };
    return {
      joined: true,
      peerId: state.peerId,
      displayName: state.displayName,
      joinedAt: state.joinedAt,
    };
  });

  // Return cleanup function
  return () => {
    stopHeartbeat();
    ipcMain.removeHandler('substrate-awakens:register');
    ipcMain.removeHandler('substrate-awakens:handshake');
    ipcMain.removeHandler('substrate-awakens:get-state');
  };
}
