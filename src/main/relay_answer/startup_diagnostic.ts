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
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import { isNetworkFeatureOn } from '../startup/network_feature_settings';

// Singleton OllamaManager for diagnostics -- best-effort, never throws
const _diagOllama = new OllamaManager();

// Relay-answer poller liveness state -- populated by relay_answer/index.ts tick()
// Imported lazily to avoid circular dependency
async function getPollerState(): Promise<{ started: boolean; lastHeartbeat: string | null; lastError: string | null }> {
  try {
    const mod = await import('./index');
    return {
      started: mod.relayPollerStarted,
      lastHeartbeat: mod.relayPollerLastHeartbeat,
      lastError: mod.relayPollerLastError,
    };
  } catch (e: unknown) {
    return { started: false, lastHeartbeat: null, lastError: `relay_answer module unavailable: ${(e as Error).message}` };
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

// BP132 Yoke #23 Task 6 (found live via boot test): env_loader.ts's resolveKeySource()
// returns 'vault' | 'pre-existing-env' | 'unresolved', but the submit-peer-startup-state
// edge function's schema only accepts 'env' | 'fallback' | 'vault' | 'absent' -- confirmed
// by a real 400 INVALID_URL_SOURCE response when boot-testing with no WORKING_KEYS.env
// present (the exact stranger-install scenario this yoke targets). 'unresolved' from
// env_loader always means "the shared getAnonKey()/getSupabaseUrl() bundled fallback was
// used" in this call site now, since those helpers never return an empty string.
function toEdgeFunctionKeySource(source: 'vault' | 'pre-existing-env' | 'unresolved'): 'env' | 'fallback' | 'vault' | 'absent' {
  if (source === 'vault') return 'vault';
  if (source === 'pre-existing-env') return 'env';
  return 'fallback';
}

export async function submitStartupDiagnostic(opts: { settingsPath?: string } = {}): Promise<void> {
  // D-BP223-BM0-X031-024 (Founder, 2026-09-17T11:20Z): OFF until the user turns on
  // "Send a status report to Liana Banyan" (startup/network_feature_settings.ts). Nothing is collected or sent.
  if (!isNetworkFeatureOn('sendStatusReport', opts.settingsPath)) return;
  try {
    const envStatus = getEnvLoaderStatus();
    const supabaseUrl = envStatus.supabaseUrl || getSupabaseUrl();
    const anonKey = getAnonKey();

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
      supabase_url_source: toEdgeFunctionKeySource(envStatus.supabaseUrlSource),
      supabase_url: supabaseUrl,
      anon_key_source: toEdgeFunctionKeySource(envStatus.anonKeySource),
      anon_key_hash: envStatus.anonKeyHash,
      relay_answer_poller_started: pollerState.started,
      relay_answer_poller_heartbeat: pollerState.lastHeartbeat ?? null,
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
