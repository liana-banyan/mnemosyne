// BP099-K16 -- Peer-side Diagnostic Mode poller
// Hardcoded 6-command READ_ONLY allowlist. Polls claim-diagnostic-output every 10s (active)
// or 60s (denied/expired). Executes commands locally, posts output back.
// Trust chain: brand_stamp_sig verified client-side + local TTL timer dual-layer.
//
// §4 BLOOD: BRAND_STAMP_PUBLIC_KEY read from process.env only, never embedded.
// Authored: 2026-06-28 -- Knight BP099-K16
// Migrated to mnemosyne repo: 2026-06-28 -- SEG-MM Novaculi BP099

import { createHash, createPublicKey, verify as ed25519Verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { getStablePeerId } from '../federation/peer-discovery';
import { SIG_HEX_LEN } from '../thorax/sign_verify';
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import { isNetworkFeatureOn } from '../startup/network_feature_settings';

// ─── Module-level state (consumed by startup_diagnostic + relay_answer_poller_state command) ──

export let pollerStarted = false;
export let pollerLastPollAt: string | null = null;
export let pollerLastError: string | null = null;

// ─── Local TTL enforcement ─────────────────────────────────────────────────────

let localPermissionTimer: NodeJS.Timeout | null = null;
let localPermissionActive = false;

export function activateLocalPermission(ttlMinutes: number): void {
  localPermissionActive = true;
  if (localPermissionTimer) clearTimeout(localPermissionTimer);
  localPermissionTimer = setTimeout(() => {
    localPermissionActive = false;
    console.log('[diagnostic_mode] Diagnostic permission TTL expired locally -- halting command execution');
  }, ttlMinutes * 60 * 1000);
}

export function revokeLocalPermission(): void {
  localPermissionActive = false;
  if (localPermissionTimer) {
    clearTimeout(localPermissionTimer);
    localPermissionTimer = null;
  }
}

export function isPermissionActive(): boolean {
  return localPermissionActive;
}

// ─── Tier-based pattern allowlists ────────────────────────────────────────────

const READ_ONLY_PATTERNS = [
  /^ollama (list|show|ps|run [^|;&]*)$/,
  /^(dir|ls) [a-zA-Z]:[\\/].+$/,
  /^Get-(Process|Item|ChildItem|Content) .+$/,
  /^(type|cat) .+$/,
  /^psql .+ -c "SELECT .+"$/,
  /^curl (-s|--silent)? https?:\/\/.+$/,
  /^Get-NetIPAddress.*$/,
  /^ipconfig.*$/,
  /^node --version$/,
  /^npm list.*$/,
];

const WRITE_PATTERNS = [
  /^setx \w+ .+$/,
  /^Copy-Item .+ -Destination .+$/,
  /^Set-Content .+$/,
  /^npm install .+$/,
];

const ADMIN_PATTERNS = [
  /^Remove-Item .+$/,
  /^Stop-Process .+$/,
  /^npm uninstall .+$/,
];

function matchesTierPattern(commandText: string, tier: string): boolean {
  const patterns =
    tier === 'READ_ONLY' ? READ_ONLY_PATTERNS :
    tier === 'WRITE' ? [...READ_ONLY_PATTERNS, ...WRITE_PATTERNS] :
    tier === 'ADMIN' ? [...READ_ONLY_PATTERNS, ...WRITE_PATTERNS, ...ADMIN_PATTERNS] :
    [];
  return patterns.some((p) => p.test(commandText.trim()));
}

// ─── Hardcoded READ_ONLY key-based allowlist (legacy 6-command mode) ──────────

const DIAGNOSTIC_ALLOWLIST: Record<string, () => Promise<string>> = {
  ollama_tags: async () => {
    try {
      const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
      return JSON.stringify(await res.json(), null, 2);
    } catch (err: unknown) {
      return `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  },

  peer_presence_self: async () => {
    try {
      const supabaseUrl = getSupabaseUrl();
      const anonKey = getAnonKey();
      if (!supabaseUrl || !anonKey) return JSON.stringify({ error: 'Supabase not configured' });
      const peerId = getStablePeerId();
      const url = `${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}&limit=1`;
      const res = await fetch(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return JSON.stringify(await res.json(), null, 2);
    } catch (err: unknown) {
      return `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  },

  bonfire_lit_self: async () => {
    try {
      const supabaseUrl = getSupabaseUrl();
      const anonKey = getAnonKey();
      if (!supabaseUrl || !anonKey) return JSON.stringify({ error: 'Supabase not configured' });
      const peerId = getStablePeerId();
      const url = `${supabaseUrl}/rest/v1/bonfire_lit_state?peer_id=eq.${encodeURIComponent(peerId)}&order=created_at.desc&limit=10`;
      const res = await fetch(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return JSON.stringify(await res.json(), null, 2);
    } catch (err: unknown) {
      return `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  },

  log_tail: async () => {
    try {
      const logsPath = app.getPath('logs');
      const logFile = join(logsPath, 'main.log');
      const content = readFileSync(logFile, 'utf8');
      const lines = content.split('\n');
      const tail = lines.slice(-100).join('\n');
      const truncated = tail.length > 65536 ? tail.slice(-65536) : tail;
      return truncated;
    } catch (err: unknown) {
      return `ERROR reading log: ${err instanceof Error ? err.message : String(err)}`;
    }
  },

  env_loader_status: async () => {
    try {
      const { getEnvLoaderStatus } = await import('../env_loader');
      return JSON.stringify(getEnvLoaderStatus(), null, 2);
    } catch (err: unknown) {
      return JSON.stringify({ error: `env_loader status unavailable: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  relay_answer_poller_state: async () => {
    return JSON.stringify({
      running: pollerStarted,
      last_poll_at: pollerLastPollAt,
      last_error: pollerLastError,
    }, null, 2);
  },
};

// ─── Brand stamp verification (BP132 Yoke #23 Task 4: real, fail-closed) ──────
//
// PRIOR BEHAVIOR (Truth-Always violation): this function ALWAYS returned true --
// stubbed PASS when the key was unset, AND stubbed PASS even when it WAS set (the
// ed25519 verify itself was never implemented, just a TODO comment). That meant the
// brand-stamp layer of the remote-diagnostic trust chain was decorative: any row
// insertable into the command queue that claim-diagnostic-output serves would run,
// gated only by the local per-user TTL permission grant (still real and still
// enforced -- see localPermissionActive / isPermissionActive() above -- but that is
// "did a local human opt in to a diagnostic window", not "did this specific command
// actually come from Bishop/Founder").
//
// FIX: real Ed25519 verification using Node's built-in crypto (no extra dependency),
// matching this codebase's existing DER/hex convention (see thorax/sign_verify.ts's
// signFrame/verifyFrame, MAMBA-beta3 BP087) -- SPKI-DER public key as lowercase hex,
// 128-hex-char (64-byte) raw Ed25519 signature, verified over the exact JSON payload
// string built at the call site. §4 BLOOD is preserved: the key is read from
// process.env.BRAND_STAMP_PUBLIC_KEY only, never embedded in source.
//
// Fails CLOSED (returns false, command rejected) in every failure mode: key unset,
// signature missing/malformed, wrong length, or the verify call itself throwing.
// A security gate must never silently PASS -- if this returns false, pollOnce()
// above already skips execution of that command and logs it.
function verifyBrandStampSig(sig: unknown, payload: string): boolean {
  const pubKeyHex = process.env.BRAND_STAMP_PUBLIC_KEY;
  if (!pubKeyHex) {
    console.error(
      '[diagnostic_mode] BRAND_STAMP_PUBLIC_KEY not configured -- HARD-FAILING all remote ' +
      'diagnostic commands. This is intentional (Truth-Always): a security gate must never ' +
      'silently pass when its key material is absent. Set BRAND_STAMP_PUBLIC_KEY to enable ' +
      'remote diagnostic command verification.',
    );
    return false;
  }
  if (typeof sig !== 'string' || sig.length !== SIG_HEX_LEN) {
    console.error(
      `[diagnostic_mode] brand_stamp_sig missing or malformed (expected ${SIG_HEX_LEN} hex ` +
      `chars, a 64-byte Ed25519 signature) -- rejecting command`,
    );
    return false;
  }
  try {
    const pubKey = createPublicKey({
      key: Buffer.from(pubKeyHex, 'hex'),
      format: 'der',
      type: 'spki',
    });
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const sigBuffer = Buffer.from(sig, 'hex');
    return ed25519Verify(null, payloadBuffer, pubKey, sigBuffer);
  } catch (e) {
    console.error('[diagnostic_mode] ed25519 verify threw -- rejecting command (fail closed):', e);
    return false;
  }
}

// ─── Command execution (key-based mode) ──────────────────────────────────────

async function executeKeyCommand(commandKey: string): Promise<string> {
  const fn = DIAGNOSTIC_ALLOWLIST[commandKey];
  if (!fn) return `REJECTED: command_key '${commandKey}' not in allowlist`;
  try {
    return await fn();
  } catch (err: unknown) {
    return `ERROR executing ${commandKey}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Command execution (text-based / tier mode) ───────────────────────────────

async function executeTextCommand(commandText: string, tier: string): Promise<string> {
  if (!matchesTierPattern(commandText, tier)) {
    return `REJECTED: command '${commandText}' does not match ${tier} tier allowlist`;
  }
  const { exec } = await import('node:child_process');
  return new Promise((resolve) => {
    exec(commandText, { timeout: 30_000, maxBuffer: 65536 }, (err, stdout, stderr) => {
      const out = [stdout, stderr].filter(Boolean).join('\n').slice(0, 65536);
      if (err && !out) {
        resolve(`ERROR: ${err.message}`);
      } else {
        resolve(out || '(no output)');
      }
    });
  });
}

// ─── Audit chain helper ───────────────────────────────────────────────────────

function buildAuditHash(cmdId: string, output: string, prevSig?: string): string {
  const payload = `${cmdId}:${output}:${prevSig ?? ''}`;
  return createHash('sha256').update(payload).digest('hex');
}

// ─── Main poller ──────────────────────────────────────────────────────────────

let pollerTimer: NodeJS.Timeout | null = null;
let lastAuditSig: string | undefined = undefined;

async function pollOnce(peerId: string): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!supabaseUrl || !anonKey) {
    pollerLastError = 'Supabase not configured';
    return;
  }

  const edgeFnUrl = `${supabaseUrl}/functions/v1/claim-diagnostic-output`;

  let commands: Array<{
    id: string;
    command_key?: string;
    command_text?: string;
    tier?: string;
    command_payload?: unknown;
    brand_stamp_sig?: unknown;
  }>;

  try {
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ peer_id: peerId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      pollerLastError = `claim-diagnostic-output returned ${res.status}`;
      return;
    }
    commands = await res.json() as typeof commands;
  } catch (err: unknown) {
    pollerLastError = err instanceof Error ? err.message : String(err);
    return;
  }

  pollerLastPollAt = new Date().toISOString();
  pollerLastError = null;

  for (const cmd of commands) {
    // Re-verify brand stamp client-side
    if (!verifyBrandStampSig(cmd.brand_stamp_sig, JSON.stringify({ id: cmd.id, target_peer_id: peerId, command_key: cmd.command_key ?? cmd.command_text }))) {
      console.warn(`[diagnostic_mode] Brand stamp verification failed for cmd ${cmd.id} -- skipping`);
      continue;
    }

    // Execute command
    let output: string;
    const tier = cmd.tier ?? 'READ_ONLY';

    if (cmd.command_text) {
      output = await executeTextCommand(cmd.command_text, tier);
    } else if (cmd.command_key) {
      output = await executeKeyCommand(cmd.command_key);
    } else {
      output = 'REJECTED: no command_key or command_text provided';
    }

    // Build audit chain signature
    const auditHash = buildAuditHash(cmd.id, output, lastAuditSig);
    lastAuditSig = auditHash;

    // Post output back
    try {
      await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          peer_id: peerId,
          id: cmd.id,
          output_blob: output,
          output_text: output,
          audit_chain_sig: auditHash,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      console.log(`[diagnostic_mode] posted output for cmd=${cmd.id.slice(0, 8)}`);
    } catch (err: unknown) {
      console.error(`[diagnostic_mode] failed to post output for cmd=${cmd.id}:`, err);
    }
  }

  // Check for permission revocation
  try {
    const checkUrl = `${supabaseUrl}/rest/v1/diagnostic_permissions?peer_id=eq.${encodeURIComponent(peerId)}&status=eq.active&order=created_at.desc&limit=1`;
    const checkRes = await fetch(checkUrl, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (checkRes.ok) {
      const rows = await checkRes.json() as Array<{ status: string; expires_at: string }>;
      const active = rows.find((r) => r.status === 'active' && new Date(r.expires_at) > new Date());
      if (!active && localPermissionActive) {
        revokeLocalPermission();
        console.log('[diagnostic_mode] Permission revoked or expired remotely -- local permission cleared');
      }
    }
  } catch { /* non-fatal revocation check */ }
}

function scheduleNextPoll(peerId: string): void {
  const intervalMs = localPermissionActive ? 10_000 : 60_000;
  pollerTimer = setTimeout(async () => {
    if (localPermissionActive) {
      await pollOnce(peerId).catch((e: Error) => {
        pollerLastError = e.message;
        console.error('[diagnostic_mode] pollOnce error:', e);
      });
    }
    scheduleNextPoll(peerId);
  }, intervalMs);
}

export function startDiagnosticPoller(opts: { settingsPath?: string } = {}): void {
  if (pollerStarted) return;
  // D-BP223-BM0-X031-027 (Founder, 2026-09-17: "Turn those OFF by default first"): the 60 s check-in timer is not armed
  // unless the user turned on diagnosticCheckin. Takes effect at next app start.
  if (!isNetworkFeatureOn('diagnosticCheckin', opts.settingsPath)) {
    console.log('[X031-027] diagnostic mode poller NOT started: diagnosticCheckin is off (default)');
    return;
  }
  pollerStarted = true;
  const peerId = getStablePeerId();
  console.log(`[diagnostic_mode] Diagnostic poller started for peer ${peerId.slice(0, 8)}`);
  scheduleNextPoll(peerId);
}

export function stopDiagnosticPoller(): void {
  if (pollerTimer) {
    clearTimeout(pollerTimer);
    pollerTimer = null;
  }
  pollerStarted = false;
}
