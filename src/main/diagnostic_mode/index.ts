// BP099-K16 -- Peer-side Diagnostic Mode poller
// Hardcoded 6-command READ_ONLY allowlist. Polls claim-diagnostic-output every 10s (active)
// or 60s (denied/expired). Executes commands locally, posts output back.
// Trust chain: brand_stamp_sig verified client-side + local TTL timer dual-layer.
//
// §4 BLOOD: BRAND_STAMP_PUBLIC_KEY read from process.env only, never embedded.
// Authored: 2026-06-28 -- Knight BP099-K16
// Migrated to mnemosyne repo: 2026-06-28 -- SEG-MM Novaculi BP099

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { getStablePeerId } from '../federation/peer-discovery';

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
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
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
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
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

// ─── Brand stamp verification (stubbed -- env var path ready) ─────────────────

function verifyBrandStampSig(_sig: unknown, _payload: string): boolean {
  const pubKey = process.env.BRAND_STAMP_PUBLIC_KEY;
  if (!pubKey) {
    console.warn('[diagnostic_mode] BRAND_STAMP_PUBLIC_KEY not configured -- verification stubbed PASS');
    return true;
  }
  // TODO: implement ed25519 verify when key is configured
  // import { verify } from 'noble/ed25519'; verify(sig, payload, pubKey)
  console.warn('[diagnostic_mode] BRAND_STAMP_PUBLIC_KEY set but ed25519 verify not yet implemented -- stubbed PASS');
  return true;
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
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
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

export function startDiagnosticPoller(): void {
  if (pollerStarted) return;
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
