// BP099-K16 -- Automatic Startup Self-Diagnostic
// Collects peer boot state and submits to peer_startup_state table via edge function.
// Best-effort: never throws, never blocks app startup.
//
// §4 BLOOD: anon_key_hash is sha256 of key -- raw key never logged or stored.
// Authored: 2026-06-28 -- Knight BP099-K16
// Migrated to mnemosyne repo: 2026-06-28 -- SEG-MM Novaculi BP099
// Note: import path adjusted -- mnemosyne uses beacons_lit (not bonfire_lit)

import { app } from 'electron';
import * as os from 'node:os';
import { getEnvLoaderStatus } from '../env_loader';
import { getStablePeerId } from '../federation/peer-discovery';
import { OllamaManager } from '../ollama_manager';

// Singleton OllamaManager for diagnostics -- best-effort, never throws
const _diagOllama = new OllamaManager();

// Re-exported state from diagnostic_mode -- populated by startDiagnosticPoller()
// Imported lazily to avoid circular dependency
async function getPollerState(): Promise<{ started: boolean; lastError: string | null }> {
  try {
    const mod = await import('../diagnostic_mode/index');
    return { started: mod.pollerStarted, lastError: mod.pollerLastError };
  } catch {
    return { started: false, lastError: 'diagnostic_mode module unavailable' };
  }
}

// Beacons Lit state (mnemosyne uses beacons_lit, not bonfire_lit)
async function getBeaconsLitState(): Promise<{ active: boolean; handshakeOk: boolean }> {
  try {
    const mod = await import('../beacons_lit/index');
    const state = (mod as any).getState?.() as { active?: boolean; handshakeOk?: boolean } | undefined;
    if (state) return { active: state.active ?? false, handshakeOk: state.handshakeOk ?? false };
    return { active: false, handshakeOk: false };
  } catch {
    return { active: false, handshakeOk: false };
  }
}

// Self LAN addresses
function getSelfLanAddresses(): string[] {
  try {
    const ifaces = os.networkInterfaces();
    const addrs: string[] = [];
    for (const iface of Object.values(ifaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (!addr.internal && addr.family === 'IPv4') {
          addrs.push(addr.address);
        }
      }
    }
    return addrs;
  } catch {
    return [];
  }
}

export async function submitStartupDiagnostic(): Promise<void> {
  try {
    const envStatus = getEnvLoaderStatus();
    const supabaseUrl = envStatus.supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !anonKey) {
      console.warn('[startup_diagnostic] Supabase not configured -- skipping diagnostic submission');
      return;
    }

    const [pollerState, beaconsState, ollamaModels] = await Promise.all([
      getPollerState(),
      getBeaconsLitState(),
      _diagOllama.listModels().catch(() => [] as string[]),
    ]);

    const peerId = getStablePeerId();

    const state = {
      peer_id: peerId,
      cai_version: app.getVersion(),
      npm_version: process.versions.node,
      supabase_url_source: envStatus.supabaseUrlSource,
      supabase_url: supabaseUrl,
      anon_key_source: envStatus.anonKeySource,
      anon_key_hash: envStatus.anonKeyHash,
      relay_answer_poller_started: pollerState.started,
      relay_answer_poller_error: pollerState.lastError ?? null,
      beacons_lit_active: beaconsState.active,
      beacons_lit_handshake_ok: beaconsState.handshakeOk,
      ollama_running: await _diagOllama.isReachable().catch(() => false),
      ollama_models: ollamaModels,
      env_paths_checked: envStatus.pathsChecked,
      lan_addresses: getSelfLanAddresses(),
      hostname: os.hostname(),
      platform: process.platform,
      raw_capabilities: {
        electron_version: process.versions.electron ?? null,
        chrome_version: process.versions.chrome ?? null,
        arch: process.arch,
      },
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/submit-peer-startup-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(state),
      signal: AbortSignal.timeout(15_000),
    });

    const json = await res.json() as { ok?: boolean; id?: number; error?: string };
    if (json.ok) {
      console.log(`[startup_diagnostic] submitted state id=${json.id} peer=${peerId.slice(0, 8)} version=${state.cai_version}`);
    } else {
      console.error(`[startup_diagnostic] FAILED: ${JSON.stringify(json)}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[startup_diagnostic] FAILED: ${msg}`);
  }
  // Best-effort -- never throws, never blocks app startup
}
