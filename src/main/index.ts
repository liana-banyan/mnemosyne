// AMPLIFY Computer ? Electron Main Process
// B37 Phase 1-3 ? BP025 / Bushel 37
// Phase 3 additions: connectivity polling, auto-mode transitions, substrate/federation IPC
// BP038 addition: env_loader MUST be the first import so its side-effects populate
// process.env (ANTHROPIC_API_KEY, etc.) before any consumer module reads them at load.
// Implements Blood Rule R16 (R-NO-API-KEY-EXPOSURE) ? values never logged.

import './env_loader';
import log from 'electron-log/main';
log.initialize({ preload: true });
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB rotation
// Pipe ALL main-process console.* through electron-log
Object.assign(console, log.functions);
import ws from 'ws';
import { probeSubstrateApiPort } from './port_guard';
import { probeRendererHealth } from './renderer_guard';

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  shell,
  globalShortcut,
  dialog,
  Notification,
  clipboard,
} from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, watch as fsWatch, readdirSync, cpSync } from 'fs';
import { spawn } from 'child_process';
import { tmpdir, homedir } from 'os';
import { ollamaManager } from './ollama_manager';
import { SubstrateAPIServer, API_PORT } from './substrate_api';
import { FederationClient } from './federation_client';
import { getMoneyPennyURL, getLocalIPs } from './mobile_pwa';
import { AutoUpdateManager, type UpdateState } from './auto_updater';
// M21: Automatic update scheduler (Block 2-6)
import {
  registerAutoUpdateIPC,
  startAutoUpdateLoop,
  checkAndTriggerPendingInstall,
  migrateAutoInstallConfig,
  registerWindowForAutoUpdate,
  getAutoUpdateConfig,
} from './auto_update_scheduler';
import { PeerDiscovery, getStablePeerId, initializeLocalPeerKeypair } from './federation/peer-discovery';
import { RelayClient } from './federation/relay-client';
import { performCommunityConnectHandshake } from './federation/community-connect';
import { registerSubstrateAwakensIPC } from './federation/substrate_awakens_ipc';
import { AuthManager, registerCustomScheme } from './auth_manager';
import {
  runHearthBuild,
  runHearthInstall,
  getHearthLibrary,
  getHearthHealthz,
  runSpecExtractSmoke,
} from './hearth_app_builder/orchestrator';
import { uninstallApp } from './hearth_app_builder/install_runner';
// B83 ? Hearth Conjunction Window
import { conjunctionRouter } from './hearth/conjunction/conjunction_router';
import { buildSubstrateContext } from './hearth/embedded_browser/substrate_context_builder';
import { querySagaState, recordWaveDispatch, recordWaveComplete } from './hearth/drekaskip_status/drekaskip_bridge';
import { pollWatchdogStatus, getSubjectHistory } from './hearth/active_substrate/watchdog_bridge';
import { toggleMonitor, getMetrics, getAllMonitorStates } from './hearth/active_substrate/scribe_monitor';
// BP037 ? On-Deck Master-of-Ceremonies
import { listOnDeck } from './on_deck/on_deck_bridge';
// Adaptive Concurrency Carrier (Layer 2+4)
import { getCapInfo, probeConcurrencyCap, setCapOverride } from './concurrency_probe';
// SAGA 4 BP041 ? In Conjunction Agent Panel
import {
  probeAgent,
  setApiKey,
  getApiKeyStatus,
  loadPersistedApiKeys,
} from './agent_probe';
import {
  loadPlugins,
  getLoadedPlugins,
  getPluginRegistry,
  watchPluginDir,
  ensurePluginDir,
} from './agent_plugins';

// Register custom OAuth scheme before app ready (Electron requirement)
registerCustomScheme();

// BP052 v0.1.8 ? Kitchen Table? IPC store
import { registerKitchenTableIpc } from './kitchen_table/kitchen_table_store';

// BP060 Application 002 Step 1 ? Caithedral Tools IPC
import { registerCaithedralToolsIPC, setMeshPointerAdvanceHook, dag_soccerball_emit_reexport } from './caithedral_tools_ipc';
import { setDagEmitMeshHook, setFetchSidFromPeerHook } from './substrate_api';

// MESH-6 ? shared protocol payload types
import {
  FedMsg,
  SidFetchRequestPayload,
  SidFetchResponsePayload,
  PointerAdvancePayload,
} from '../shared/federation-protocol';

// MESH-6 ? dag soccerball lookup (canonical exports-map path; tsconfig paths resolves types)
import {
  dag_soccerball_lookup as _dagLookup,
  type DagNode,
} from 'caithedral-core/tools/dag_soccerball';

// BP060 Application 002 Steps 3+4 ? Bridge IPC (UI-7 live Yoke wire)
import { registerBridgeIPC } from './bridge_ipc';
// Battery Dispatch v0.3.0 — BP082 publish fan-out engine
import { registerDispatchIPC } from './dispatch/dispatch_ipc';

// BP060 Application 002 Steps 3+4 ? AI Dispatch IPC (UI-8 backend)
import { registerAiDispatchIPC } from './ai_dispatch_ipc';

// BP087 Wave 3 SEG-C1 + SEG-E1 - Thunderclap trial fire + Gemma multi-seg dispatch
import { registerThunderclapFireIPC } from './thunderclap_fire_ipc';
import { registerGemmaMultiSegIPC } from './gemma_multi_seg_ipc';

// BP083 SEG-1/2/4/5 — 6-folder substrate scaffold + MEMORY.md amnesia cure + TestData seeds
import { ensureMnemosyneCFolders, generateMemoryMd, populateTestDataSeeds, registerMemoryScaffoldIPC, installStarterChocolate } from './memory_scaffold';

// BP081 K-2 — MnemosyneC local MCP server
import { startMcpServer, stopMcpServer, getMcpServerStatus } from './mcp_server';

// SAGA-? v0.1.10 ? SubstratedFolderWatcher?
import { SubstratedFolderWatcher, registerWatcherIpc } from './services/SubstratedFolderWatcher';

// BP067 Correction 2 ? Folder?DAG bridge
import { setDagBridgeMeshHook, getDagEmitCount } from './dag_bridge';

// v0.4.0 BP083 — MIC Dispatcher + The Diagnosis + Peer Server
import { registerMicIpc } from './federation/mic_ipc';
import { registerDiagnosisIpc } from './diagnosis/diagnosis_ipc';
import { runCatacombMigrationCheck } from './diagnosis/catacomb_migrator';
import { startPeerServer, stopPeerServer, getCurrentTier, registerPresenceConfig } from './federation/peer_server';

// BP132 Yoke #21 A1 — mesh revival: relay-answer poller + startup self-diagnostic.
// Both were fully built but never wired into boot (confirmed: zero call sites in src/).
import { startRelayAnswerPoller } from './relay_answer';
import { submitStartupDiagnostic } from './relay_answer/startup_diagnostic';

// SAGA 10 BP045 W1 ? mnemosyne:// + mnemo:// deep-link handler
import { registerDeepLinkProtocol, handleStartupDeepLink } from './deep-link-handler';
import type { DeepLinkPayload } from './deep-link-handler';

// BP087 MAMBA-Row3: Substrace theorem mesh routing re-weave dispatch
import { handleSubstraceWakeReceive, setRelayEmitHook } from './substrace/wake_router';

// BP072 ? Paired-Frame Mutual-Aid Layer
import { PairedFrameManager } from './federation/paired-frame-manager';

// SEG-WAN-2: WAN soccerball relay wiring
import {
  setWanSoccerballHook,
  setWanStatusEmitter,
  createWanSoccerballResolver,
} from './federation/wan_escalation';

// BP065 Part A ? LB Account authentication + device linking
import {
  startLBAuthFlow,
  completeLBAuth,
  getLBSession,
  revokeDevice as lbRevokeDevice,
} from './lb_auth';

// BP080 Genesis Mint — IP Ledger read/write (main-process only; Federal Body Cam doctrine)
import { loadAllEntries, registerClaim } from './ip_ledger/ip_ledger_store';

// --- Constants --------------------------------------------------------------

// MNEMOSYNE_PROD_LAUNCH=1 forces loadFile of built renderer even from source tree
// (used for smoke-launch + two-instance tests without full packaging)
const IS_DEV = process.env.MNEMOSYNE_PROD_LAUNCH !== '1' &&
  (process.env.NODE_ENV === 'development' || !app.isPackaged);
// Use explicit 127.0.0.1 (IPv4) ? avoids Windows ::1 vs 127.0.0.1 split-brain
// where Vite binds to ::1 but Chromium connects to 127.0.0.1.
const VITE_DEV_URL = 'http://127.0.0.1:5173';
const RENDERER_URL = IS_DEV
  ? VITE_DEV_URL
  : `file://${join(__dirname, '../renderer/index.html')}`;

// --- CSP ---------------------------------------------------------------------
// Strict prod / minimal dev relaxation (HMR style + module loading only).
// NO unsafe-eval in either environment.
const _SUBSTRATE_PORT = Number(process.env.SUBSTRATE_PORT ?? 11480);
const _ANNOUNCE_PORT = Number(process.env.PEER_ANNOUNCE_PORT ?? 11481);
const CSP_DEV =
  "default-src 'self' http://127.0.0.1:5173; " +
  "script-src 'self' 'unsafe-inline' http://127.0.0.1:5173; " +
  "style-src 'self' 'unsafe-inline'; " +
  `connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173 ` +
  `http://127.0.0.1:${_SUBSTRATE_PORT} http://127.0.0.1:${_ANNOUNCE_PORT}; ` +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:";

const CSP_PROD =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  `connect-src 'self' http://127.0.0.1:${_SUBSTRATE_PORT} http://127.0.0.1:${_ANNOUNCE_PORT}; ` +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:";

const ACTIVE_CSP = IS_DEV ? CSP_DEV : CSP_PROD;

// Connectivity polling interval (30s)
const CONNECTIVITY_POLL_MS = 30_000;

// --- SEG-V0148: diagnostic capture vars (set after ollamaManager.init()) -----

let _capturedOllamaBranch: string = 'UNKNOWN';
let _capturedOllamaPath: string | null = null;
let _capturedActiveModel: string = 'unknown';
let _capturedTargetModel: string = 'unknown';

/**
 * SEG-V0148-P1-RENAME-USERDATA: first-launch migration when package name changed
 * from "amplify-computer" → "mnemosynec". Copies (does not move) the old userData
 * directory to the new path so existing user settings/model state are preserved.
 */
function migrateUserDataIfNeeded(): void {
  if (process.platform !== 'win32') return;
  const appData = process.env.APPDATA;
  if (!appData) return;
  const oldPath = join(appData, 'amplify-computer');
  const newPath = app.getPath('userData');
  if (!existsSync(oldPath) || existsSync(newPath)) return;

  const migrationStart = Date.now();
  console.log(`[userData migration] Starting: ${oldPath} → ${newPath}`);
  try {
    cpSync(oldPath, newPath, { recursive: true });
    const elapsed = Date.now() - migrationStart;
    let fileCount = 0;
    try {
      const countFiles = (dir: string): number => {
        let n = 0;
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
        }
        return n;
      };
      fileCount = countFiles(newPath);
    } catch { /* non-fatal */ }
    console.log(
      `[userData migration] userData migration: copied ${oldPath} → ${newPath} (${fileCount} files, ${elapsed}ms)`,
    );
  } catch (e) {
    console.error('[userData migration] Migration failed:', String(e));
  }
}

// --- SAGA 4: Tier persistence + agent IPC handlers ---------------------------

const SUBSTRATE_ROOT_MAIN = process.env.LB_SUBSTRATE_ROOT ?? join(homedir(), '.lb_substrate');
const TIERS_FILE = join(SUBSTRATE_ROOT_MAIN, 'in_conjunction_tiers.json');

// BP048 v0.1.7 ? wife-install first-run + LOCAL-HANDSHAKE prefs (~/.mnemosyne/)
const MNEMOSYNE_HOME = join(homedir(), '.mnemosyne');
const FIRST_RUN_FLAG = join(MNEMOSYNE_HOME, 'first_run.flag');
const LAN_HANDSHAKE_PREFS = join(MNEMOSYNE_HOME, 'lan_handshake.json');

interface LanHandshakePrefs {
  neverAsk?: boolean;
  connectedPeers?: string[];
}

function isFirstRun(): boolean {
  return !existsSync(FIRST_RUN_FLAG);
}

function markFirstRunComplete(): void {
  const fs = require('fs') as typeof import('fs');
  fs.mkdirSync(MNEMOSYNE_HOME, { recursive: true });
  fs.writeFileSync(FIRST_RUN_FLAG, new Date().toISOString(), 'utf-8');
}

function loadLanHandshakePrefs(): LanHandshakePrefs {
  if (!existsSync(LAN_HANDSHAKE_PREFS)) return {};
  try {
    return JSON.parse(require('fs').readFileSync(LAN_HANDSHAKE_PREFS, 'utf-8')) as LanHandshakePrefs;
  } catch {
    return {};
  }
}

function saveLanHandshakePrefs(prefs: LanHandshakePrefs): void {
  const fs = require('fs') as typeof import('fs');
  fs.mkdirSync(MNEMOSYNE_HOME, { recursive: true });
  fs.writeFileSync(LAN_HANDSHAKE_PREFS, JSON.stringify(prefs, null, 2), 'utf-8');
}

let lanHandshakeEligible = false;
let lanHandshakePromptInFlight = false;

function loadTierChoices(): Record<string, string> {
  if (!existsSync(TIERS_FILE)) return {};
  try {
    return JSON.parse(require('fs').readFileSync(TIERS_FILE, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveTierChoices(choices: Record<string, string>): void {
  require('fs').mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
  require('fs').writeFileSync(TIERS_FILE, JSON.stringify(choices, null, 2), 'utf-8');
}

async function agentProbeHandler(
  agentId: string,
  opts: { force?: boolean; modelId?: string } = {},
): Promise<{ agentId: string; status: string; reason?: string; probed_at?: string }> {
  return probeAgent(agentId, opts);
}

function agentSetApiKeyHandler(agentId: string, keyValue: string): { ok: boolean; error?: string } {
  // R16: keyValue is processed immediately and never stored in a variable that could be logged
  return setApiKey(agentId, keyValue);
}

function agentGetApiKeyStatusHandler(): Record<string, boolean> {
  return getApiKeyStatus();
}

function agentGetTierChoicesHandler(): Record<string, string> {
  return loadTierChoices();
}

function agentSetTierChoiceHandler(agentId: string, tierId: string): { ok: boolean } {
  try {
    const choices = loadTierChoices();
    choices[agentId] = tierId;
    saveTierChoices(choices);
    return { ok: true };
  } catch (err) {
    return { ok: false };
  }
}

function agentGetPluginsHandler() {
  return getLoadedPlugins();
}

function agentGetPluginRegistryHandler() {
  return getPluginRegistry();
}

// --- State ------------------------------------------------------------------

let overlayWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let folderWatcher: SubstratedFolderWatcher | null = null;
let hearthConjunctionWindow: BrowserWindow | null = null;
let moneyPennyWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let substrateServer: SubstrateAPIServer | null = null;
let federationClient: FederationClient | null = null;
let autoUpdater: AutoUpdateManager | null = null;
let authManager: AuthManager | null = null;
let peerDiscovery: PeerDiscovery | null = null;
let relayClient: RelayClient | null = null;
/** BP104 D4 — last boot zombie flush count for renderer toast */
let _bootZombieCount = 0;
let _zombieFlushInterval: ReturnType<typeof setInterval> | null = null;
let connectivityTimer: ReturnType<typeof setInterval> | null = null;
let pairedFrameManager: PairedFrameManager | null = null;

// --- MESH-6: in-flight relay fetch listeners ----------------------------------
const meshFetchListeners = new Map<string, (payload: SidFetchResponsePayload) => void>();
let watchdogOverlayInterval: NodeJS.Timeout | null = null;
let rendererResponsive = true;
let displayMetricsListenerAttached = false;

// --- MESH-6 helpers -----------------------------------------------------------

function _recomputeDagId(
  node: { pearls: string[]; bindings: Record<string, string>; faces: Record<string, string> },
): string {
  const { createHash } = require('crypto') as typeof import('crypto');
  function sortedJson(obj: Record<string, string>): string {
    const sorted: Record<string, string> = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
    return JSON.stringify(sorted);
  }
  const payload = JSON.stringify([
    [...node.pearls].sort(),
    sortedJson(node.bindings),
    sortedJson(node.faces),
  ]);
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

function _broadcastMeshStateChanged(): void {
  // Push mesh-state-changed to all renderer windows
  const allWindows = (require('electron') as typeof import('electron')).BrowserWindow.getAllWindows();
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('mesh-state-changed', {
        peers: peerDiscovery?.getAllPeers() ?? [],
        relayConnected: relayClient?.isConnected() ?? false,
      });
    }
  }
}

async function _fetchSidViaTCP(
  peer: import('../shared/federation-protocol').MnemosynePeer,
  dag_id: string,
  reqMsg: FedMsg,
): Promise<{ ok: boolean; node?: DagNode; hash_verified: boolean; error?: string }> {
  return new Promise((resolve) => {
    const { createConnection } = require('net') as typeof import('net');
    const timeout = 5000;
    let buffer = '';
    const socket = createConnection({ host: peer.address, port: peer.port, timeout }, () => {
      socket.write(JSON.stringify(reqMsg) + '\n');
    });
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const resp = JSON.parse(line) as FedMsg;
          if (resp.type === 'sid_fetch_response') {
            const payload = resp.payload as SidFetchResponsePayload;
            if (!payload.found || !payload.node) {
              socket.destroy();
              resolve({ ok: true, hash_verified: false, error: 'not found on peer' });
              return;
            }
            const recomputed = _recomputeDagId(payload.node);
            const hash_verified = recomputed === dag_id;
            if (!hash_verified) {
              console.error(`[MESH-6] SID hash mismatch: expected=${dag_id} got=${recomputed}`);
              socket.destroy();
              resolve({ ok: false, hash_verified: false, error: 'SID hash mismatch ? rejected' });
              return;
            }
            socket.destroy();
            resolve({ ok: true, node: payload.node as DagNode, hash_verified: true });
          }
        } catch { /* malformed ? continue */ }
      }
    });
    socket.on('error', (err: Error) => resolve({ ok: false, hash_verified: false, error: err.message }));
    socket.on('close', () => resolve({ ok: false, hash_verified: false, error: 'connection closed' }));
    setTimeout(() => { socket.destroy(); resolve({ ok: false, hash_verified: false, error: 'timeout' }); }, timeout);
  });
}

async function _fetchSidViaRelay(
  toPeerId: string,
  dag_id: string,
  reqMsg: FedMsg,
): Promise<{ ok: boolean; node?: DagNode; hash_verified: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!relayClient) {
      resolve({ ok: false, hash_verified: false, error: 'relay not connected' });
      return;
    }
    const timer = setTimeout(() => {
      meshFetchListeners.delete(dag_id);
      resolve({ ok: false, hash_verified: false, error: 'relay fetch timeout' });
    }, 8000);

    meshFetchListeners.set(dag_id, (payload: SidFetchResponsePayload) => {
      clearTimeout(timer);
      meshFetchListeners.delete(dag_id);
      if (!payload.found || !payload.node) {
        resolve({ ok: true, hash_verified: false, error: 'not found on peer' });
        return;
      }
      const recomputed = _recomputeDagId(payload.node);
      const hash_verified = recomputed === dag_id;
      if (!hash_verified) {
        console.error(`[MESH-6] relay SID hash mismatch: expected=${dag_id} got=${recomputed}`);
        resolve({ ok: false, hash_verified: false, error: 'SID hash mismatch ? rejected' });
        return;
      }
      resolve({ ok: true, node: payload.node as DagNode, hash_verified: true });
    });

    relayClient.sendToPeer(toPeerId, reqMsg);
  });
}

function _handleInboundMeshMsg(msg: FedMsg): void {
  if (msg.type === 'sid_fetch_request') {
    const payload = msg.payload as SidFetchRequestPayload;
    const node = _dagLookup(payload.dag_id);
    const response: FedMsg = {
      type: 'sid_fetch_response',
      peerId: getStablePeerId(),
      payload: {
        dag_id: payload.dag_id,
        found: !!node,
        node: node ?? undefined,
        holder_peer_id: getStablePeerId(),
      } satisfies SidFetchResponsePayload,
      ts: new Date().toISOString(),
    };
    if (relayClient?.isConnected()) {
      relayClient.sendToPeer(msg.peerId, response);
    }
  }

  if (msg.type === 'sid_fetch_response') {
    const payload = msg.payload as SidFetchResponsePayload;
    const listener = meshFetchListeners.get(payload.dag_id);
    if (listener) listener(payload);
  }

  if (msg.type === 'pointer_advance') {
    const payload = msg.payload as PointerAdvancePayload;
    if (payload.new_dag_id) {
      console.log(`[MESH-6] pointer_advance received: ${payload.old_dag_id} ? ${payload.new_dag_id} from ${payload.emitter_peer_id}`);
      _autoFetchOnPointerAdvance(payload).catch((e) =>
        console.warn('[MESH-6] auto-fetch on pointer_advance failed:', e),
      );
    }
  }

  // BP072: forward pair_* and assist_* to PairedFrameManager
  if (msg.type.startsWith('pair_') || msg.type.startsWith('assist_')) {
    pairedFrameManager?.handleInbound(msg);
  }

  // BP087 MAMBA-Row3: substrace wake receive + complete handler
  if (msg.type === 'substrace_wake') {
    const payload = msg.payload as {
      wake_id?: string;
      origin_peer_id?: string;
      manifest?: Array<{ type: 'pearl_id' | 'eblet_slug' | 'substrate_address'; ref: string }>;
    };
    if (Array.isArray(payload.manifest)) {
      handleSubstraceWakeReceive(payload.manifest, payload.wake_id, payload.origin_peer_id)
        .then(({ resolved_items }) => {
          console.log(
            `[MAMBA-Row3] substrace_wake handled wake_id=${payload.wake_id ?? 'unknown'} items=${resolved_items.length}`,
          );
        })
        .catch((err) => console.warn('[MAMBA-Row3] handleSubstraceWakeReceive error:', err));
    }
  }

  if (msg.type === 'substrace_wake_complete') {
    const payload = msg.payload as {
      wake_id?: string;
      resolved_items?: unknown[];
    };
    // MAMBA-Row3: substrace_wake_complete received wake_id={wake_id} items={N}
    console.log(
      `[MAMBA-Row3] substrace_wake_complete received wake_id=${payload.wake_id ?? 'unknown'} items=${Array.isArray(payload.resolved_items) ? payload.resolved_items.length : 0}`,
    );
  }
}

async function _autoFetchOnPointerAdvance(payload: PointerAdvancePayload): Promise<void> {
  const peer = peerDiscovery?.getAllPeers().find((p) => p.peerId === payload.emitter_peer_id);
  if (!peer) return;
  const reqMsg: FedMsg = {
    type: 'sid_fetch_request',
    peerId: getStablePeerId(),
    payload: {
      dag_id: payload.new_dag_id,
      requester_peer_id: getStablePeerId(),
    } satisfies SidFetchRequestPayload,
    ts: new Date().toISOString(),
  };
  const result = peer.transport === 'lan'
    ? await _fetchSidViaTCP(peer, payload.new_dag_id, reqMsg)
    : await _fetchSidViaRelay(payload.emitter_peer_id, payload.new_dag_id, reqMsg);

  if (result.ok && result.hash_verified && result.node) {
    const n = result.node;
    dag_soccerball_emit_reexport(n.pearls, n.bindings, n.faces);
    console.log(`[MESH-6] pointer_advance auto-replicated dag_id=${payload.new_dag_id} hash_verified=true`);
    _broadcastMeshStateChanged();
  } else {
    console.warn(`[MESH-6] pointer_advance auto-fetch failed: ok=${result.ok} hash_verified=${result.hash_verified} error=${result.error}`);
  }
}

function _emitPointerAdvanceToPeers(newDagId: string): void {
  if (!peerDiscovery) return;
  const peers = peerDiscovery.getAllPeers();
  if (peers.length === 0) return;

  const msg: FedMsg = {
    type: 'pointer_advance',
    peerId: getStablePeerId(),
    payload: {
      old_dag_id: null,
      new_dag_id: newDagId,
      pointer_label: 'local-dag-root',
      emitter_peer_id: getStablePeerId(),
      advanced_at: new Date().toISOString(),
    } satisfies PointerAdvancePayload,
    ts: new Date().toISOString(),
  };

  if (relayClient?.isConnected()) {
    for (const peer of peers.filter((p) => p.transport === 'wan-relay')) {
      relayClient.sendToPeer(peer.peerId, msg);
    }
  }
  for (const peer of peers.filter((p) => p.transport === 'lan')) {
    const { createConnection } = require('net') as typeof import('net');
    const socket = createConnection({ host: peer.address, port: peer.port, timeout: 2000 }, () => {
      socket.write(JSON.stringify(msg) + '\n');
      socket.end();
    });
    socket.on('error', () => {});
  }
}

// --- Monitor-safe bounds (multi-display; prevents off-screen window trap) -----

function getSafeBounds(bounds: Electron.Rectangle): Electron.Rectangle {
  const displays = screen.getAllDisplays();
  const onScreen = displays.some((d) => {
    const b = d.bounds;
    return (
      bounds.x < b.x + b.width &&
      bounds.x + bounds.width > b.x &&
      bounds.y < b.y + b.height &&
      bounds.y + bounds.height > b.y
    );
  });
  if (onScreen) return bounds;
  const primary = screen.getPrimaryDisplay();
  const w = primary.bounds;
  return {
    x: w.x + Math.floor((w.width - bounds.width) / 2),
    y: w.y + Math.floor((w.height - bounds.height) / 2),
    width: bounds.width,
    height: bounds.height,
  };
}

const MONEY_PENNY_BOUNDS_FILE = join(SUBSTRATE_ROOT_MAIN, 'moneypenny_window_bounds.json');
const MONEY_PENNY_MIN_WIDTH = 320;
const MONEY_PENNY_MIN_HEIGHT = 480;

// SEG-V0146-CRIT-3: Dashboard + Hearth Conjunction window bounds persistence
const DASHBOARD_BOUNDS_FILE = join(SUBSTRATE_ROOT_MAIN, 'dashboard_window_bounds.json');
const DASHBOARD_MIN_WIDTH = 560;
const DASHBOARD_MIN_HEIGHT = 600;
const HEARTH_BOUNDS_FILE = join(SUBSTRATE_ROOT_MAIN, 'hearth_window_bounds.json');
const HEARTH_MIN_WIDTH = 1280;
const HEARTH_MIN_HEIGHT = 800;

function clampMoneyPennyBounds(bounds?: Partial<Electron.Rectangle>): Electron.Rectangle {
  const workArea = screen.getDisplayMatching({
    x: bounds?.x ?? screen.getPrimaryDisplay().workArea.x,
    y: bounds?.y ?? screen.getPrimaryDisplay().workArea.y,
    width: bounds?.width ?? 1,
    height: bounds?.height ?? 1,
  }).workArea;
  // SEG-V0147-FIX-3: use 90% max width/height, 75% defaults to match computeScreenSafeBounds()
  const maxWidth = Math.floor(workArea.width * 0.9);
  const maxHeight = Math.floor(workArea.height * 0.9);
  const defaultWidth = Math.max(MONEY_PENNY_MIN_WIDTH, Math.min(maxWidth, Math.floor(workArea.width * 0.3)));
  const defaultHeight = Math.max(MONEY_PENNY_MIN_HEIGHT, Math.min(maxHeight, Math.floor(workArea.height * 0.75)));
  const width = Math.max(MONEY_PENNY_MIN_WIDTH, Math.min(maxWidth, Math.floor(bounds?.width ?? defaultWidth)));
  const height = Math.max(MONEY_PENNY_MIN_HEIGHT, Math.min(maxHeight, Math.floor(bounds?.height ?? defaultHeight)));
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - width, Math.floor(bounds?.x ?? workArea.x + (workArea.width - width) / 2)));
  // SEG-V0147-FIX-3: y must be >= 12.5% from top — never allow title bar into dead zone
  const minY = workArea.y + Math.floor(workArea.height * 0.125);
  const y = Math.max(minY, Math.min(workArea.y + workArea.height - height, Math.floor(bounds?.y ?? minY)));
  return getSafeBounds({ x, y, width, height });
}

function loadMoneyPennyBounds(): Electron.Rectangle {
  if (!existsSync(MONEY_PENNY_BOUNDS_FILE)) return clampMoneyPennyBounds();
  try {
    const parsed = JSON.parse(require('fs').readFileSync(MONEY_PENNY_BOUNDS_FILE, 'utf-8')) as Partial<Electron.Rectangle>;
    // SEG-V0147-FIX-3: stale-bounds guard — discard if y is in dead zone
    if (isStaleBounds(parsed)) return clampMoneyPennyBounds();
    return clampMoneyPennyBounds(parsed);
  } catch {
    return clampMoneyPennyBounds();
  }
}

function saveMoneyPennyBounds(bounds: Electron.Rectangle): void {
  try {
    require('fs').mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
    require('fs').writeFileSync(MONEY_PENNY_BOUNDS_FILE, JSON.stringify(clampMoneyPennyBounds(bounds), null, 2), 'utf-8');
  } catch {
    // Non-fatal: window sizing should never block MoneyPenny.
  }
}

/**
 * SEG-V0147-FIX-3: Canonical screen-safe bounds for all BrowserWindows.
 * 75% height / 90% width / 12.5% top offset — ensures title bar is always visible
 * including on monitors with hardware dead zones at the top edge.
 */
function computeScreenSafeBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    height: Math.floor(workArea.height * 0.75),
    width:  Math.floor(workArea.width  * 0.90),
    y:      workArea.y + Math.floor(workArea.height * 0.125),
    x:      workArea.x + Math.floor(workArea.width  * 0.05),
  };
}

/** SEG-V0147-FIX-3: Stale-bounds guard threshold — 10% from top of workArea. */
function isStaleBounds(bounds: Partial<Electron.Rectangle>): boolean {
  if (bounds.y === undefined) return false;
  const { workArea } = screen.getPrimaryDisplay();
  return bounds.y < workArea.y + Math.floor(workArea.height * 0.10);
}

// SEG-V0147-FIX-3: Dashboard bounds helpers (screen-aware sizing + persistence)
function computeDashboardDefaults(): Electron.Rectangle {
  const safe = computeScreenSafeBounds();
  return {
    width:  Math.max(DASHBOARD_MIN_WIDTH, safe.width),
    height: Math.max(DASHBOARD_MIN_HEIGHT, safe.height),
    x:      safe.x,
    y:      safe.y,
  };
}

function clampDashboardBounds(saved: Partial<Electron.Rectangle>): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  const safe = computeScreenSafeBounds();
  const defaults = computeDashboardDefaults();
  const w = Math.max(DASHBOARD_MIN_WIDTH, Math.min(workArea.width - 40, saved.width ?? defaults.width));
  const h = Math.max(DASHBOARD_MIN_HEIGHT, Math.min(workArea.height - 40, saved.height ?? defaults.height));
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - w, saved.x ?? defaults.x));
  // SEG-V0147-FIX-3: y must be >= 12.5% from top — never allow title bar into dead zone
  const minY = workArea.y + Math.floor(workArea.height * 0.125);
  const y = Math.max(minY, Math.min(workArea.y + workArea.height - h, saved.y ?? safe.y));
  return getSafeBounds({ x, y, width: w, height: h });
}

function loadDashboardBounds(): Electron.Rectangle {
  if (!existsSync(DASHBOARD_BOUNDS_FILE)) return computeDashboardDefaults();
  try {
    const parsed = JSON.parse(readFileSync(DASHBOARD_BOUNDS_FILE, 'utf-8')) as Partial<Electron.Rectangle>;
    // SEG-V0147-FIX-3: stale-bounds guard — discard saved position if y is in dead zone
    if (isStaleBounds(parsed)) return computeDashboardDefaults();
    return clampDashboardBounds(parsed);
  } catch {
    return computeDashboardDefaults();
  }
}

function saveDashboardBounds(bounds: Electron.Rectangle): void {
  try {
    mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
    writeFileSync(DASHBOARD_BOUNDS_FILE, JSON.stringify(bounds, null, 2), 'utf-8');
  } catch {}
}

// SEG-V0147-FIX-3: Hearth Conjunction bounds helpers
function computeHearthDefaults(): Electron.Rectangle {
  const safe = computeScreenSafeBounds();
  const { workArea } = screen.getPrimaryDisplay();
  const defaultW = Math.min(Math.max(HEARTH_MIN_WIDTH, safe.width), workArea.width - 40);
  const defaultH = Math.min(Math.max(HEARTH_MIN_HEIGHT, safe.height), workArea.height - 40);
  return {
    width:  defaultW,
    height: defaultH,
    x:      safe.x,
    y:      safe.y,
  };
}

function clampHearthBounds(saved: Partial<Electron.Rectangle>): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  const safe = computeScreenSafeBounds();
  const defaults = computeHearthDefaults();
  const w = Math.max(HEARTH_MIN_WIDTH, Math.min(workArea.width - 40, saved.width ?? defaults.width));
  const h = Math.max(HEARTH_MIN_HEIGHT, Math.min(workArea.height - 40, saved.height ?? defaults.height));
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - w, saved.x ?? defaults.x));
  // SEG-V0147-FIX-3: y must be >= 12.5% from top — never allow title bar into dead zone
  const minY = workArea.y + Math.floor(workArea.height * 0.125);
  const y = Math.max(minY, Math.min(workArea.y + workArea.height - h, saved.y ?? safe.y));
  return getSafeBounds({ x, y, width: w, height: h });
}

function loadHearthBounds(): Electron.Rectangle {
  if (!existsSync(HEARTH_BOUNDS_FILE)) return computeHearthDefaults();
  try {
    const parsed = JSON.parse(readFileSync(HEARTH_BOUNDS_FILE, 'utf-8')) as Partial<Electron.Rectangle>;
    // SEG-V0147-FIX-3: stale-bounds guard — discard if y is in dead zone
    if (isStaleBounds(parsed)) return computeHearthDefaults();
    return clampHearthBounds(parsed);
  } catch {
    return computeHearthDefaults();
  }
}

function saveHearthBounds(bounds: Electron.Rectangle): void {
  try {
    mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
    writeFileSync(HEARTH_BOUNDS_FILE, JSON.stringify(bounds, null, 2), 'utf-8');
  } catch {}
}

function stopOverlayWatchdog(): void {
  if (watchdogOverlayInterval) {
    clearInterval(watchdogOverlayInterval);
    watchdogOverlayInterval = null;
  }
}

function startOverlayWatchdog(win: BrowserWindow): void {
  stopOverlayWatchdog();
  rendererResponsive = true;
  watchdogOverlayInterval = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    rendererResponsive = false;
    win.webContents.send('watchdog-ping');
    setTimeout(() => {
      if (!rendererResponsive && !win.isDestroyed()) {
        console.warn('[watchdog] renderer unresponsive ? force reload');
        win.webContents.reload();
      }
    }, 5000);
  }, 8000);
}

// --- LB overlay pointer policy (Electron) ------------------------------------
// Preload exposes setClickthrough(true) ? ignore mouse ? transparent hits forward to OS.

function applyLBFrameClickthrough(enabled: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (enabled) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
  }
  if (IS_DEV) {
    console.log(`[LB Frame] passthrough-ignore-mouse=${enabled}`);
  }
}

// --- Frame Mode --------------------------------------------------------------

type FrameMode = 'ai_burst' | 'normal' | 'fallback';
let currentMode: FrameMode = 'normal';

function setMode(mode: FrameMode, broadcast = true): void {
  currentMode = mode;
  substrateServer?.setMode(mode);
  rebuildTrayMenu(mode);
  if (broadcast) {
    overlayWindow?.webContents.send('frame-mode-changed', { mode });
    dashboardWindow?.webContents.send('frame-mode-changed', { mode });
  }
}

function detectMode(context: {
  aiAvailable: boolean;
  substrateIndexAvailable: boolean;
  peerNodesAvailable: number;
  userBudgetRemaining?: number;
  forcedMode?: FrameMode | null;
}): FrameMode {
  // Forced mode always wins unless cleared
  if (context.forcedMode != null) return context.forcedMode;

  if (!context.aiAvailable || context.userBudgetRemaining === 0) {
    if (context.substrateIndexAvailable || context.peerNodesAvailable > 0) {
      return context.peerNodesAvailable > 0 ? 'fallback' : 'normal';
    }
    return 'fallback';
  }
  return 'ai_burst';
}

// --- Connectivity Polling -----------------------------------------------------

async function runConnectivityPoll(): Promise<void> {
  const aiAvailable = await ollamaManager.isReachable();
  const online = (await federationClient?.checkAndUpdateConnectivity()) ?? false;
  const peerCount = federationClient?.getStatus().peerCount ?? 0;

  const forcedMode = substrateServer?.getForcedMode() ?? null;

  // Only auto-transition if no forced mode is set
  if (forcedMode === null) {
    const detected = detectMode({
      aiAvailable,
      substrateIndexAvailable: true,
      peerNodesAvailable: peerCount,
      forcedMode: null,
    });

    if (detected !== currentMode) {
      console.log(`[Mode] Auto-transition: ${currentMode} ? ${detected} (ai=${aiAvailable} online=${online} peers=${peerCount})`);
      setMode(detected);
    }
  }
}

// --- Overlay Window ----------------------------------------------------------

function createOverlayWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const overlayBounds = getSafeBounds({ x: 0, y: 0, width, height });

  overlayWindow = new BrowserWindow({
    width: overlayBounds.width,
    height: overlayBounds.height,
    x: overlayBounds.x,
    y: overlayBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  // Inject CSP on every response ? strips unsafe-eval, eliminates Electron security warning.
  overlayWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [ACTIVE_CSP],
      },
    });
  });

  // Guarantee passthrough AFTER the compositor attaches (BP029 / LB-STACK-0157).
  overlayWindow.once('ready-to-show', () => {
    applyLBFrameClickthrough(true);
    overlayWindow?.showInactive();
  });
  overlayWindow.webContents.once('did-finish-load', () => {
    applyLBFrameClickthrough(true);
    // SEG-FIX-3 BP078: Runtime preload smoke test. Catches future sandbox-preload
    // regressions immediately at window creation, not when Founder clicks a button.
    overlayWindow?.webContents.executeJavaScript('typeof window.amplify').then((t) => {
      if (t === 'undefined') {
        console.error('[preload-smoke] FAIL overlayWindow: window.amplify is undefined ? preload bridge did not load');
      } else {
        console.log('[preload-smoke] OK overlayWindow: window.amplify is', t);
      }
    }).catch((e) => {
      console.error('[preload-smoke] overlayWindow probe threw:', e?.message ?? e);
    });
    // renderer_guard: probe after 8s grace ? log empty-root failures to health log.
    const win = overlayWindow;
    if (win) {
      probeRendererHealth(win, RENDERER_URL, 8000).then((result) => {
        if (!result.ok) {
          tray?.setToolTip(`MnemosyneC ? ? renderer boot failed (root empty)`);
        }
      }).catch(() => { /* probe errors never crash the app */ });
    }
  });
  overlayWindow.loadURL(RENDERER_URL);

  // BP041 ? DevTools auto-open opt-out per Founder direct (non-technical members
  // running `npm run dev` should not see DevTools by default). Set MNEMOSYNE_DEVTOOLS=1
  // in env to re-enable, OR press Ctrl+Shift+I at any time to open manually,
  // OR press Ctrl+Shift+D for the developer menu (commit 1b0fdc7 ?6).
  if (IS_DEV && process.env.MNEMOSYNE_DEVTOOLS === '1') {
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
  }

  if (!displayMetricsListenerAttached) {
    displayMetricsListenerAttached = true;
    screen.on('display-metrics-changed', () => {
      if (!overlayWindow) return;
      const { width: w, height: h } = screen.getPrimaryDisplay().workAreaSize;
      const next = getSafeBounds({ x: 0, y: 0, width: w, height: h });
      overlayWindow.setBounds(next);
    });
  }

  overlayWindow.on('closed', () => {
    stopOverlayWatchdog();
    overlayWindow = null;
  });

  // Register with auto-updater and auth manager so events can be broadcast
  if (autoUpdater) autoUpdater.registerWindow(overlayWindow);
  if (authManager) authManager.registerWindow(overlayWindow);
  registerWindowForAutoUpdate(overlayWindow); // M21: scheduler notifications

  startOverlayWatchdog(overlayWindow);
}

// --- System Tray -------------------------------------------------------------

function createTray(): void {
  const iconPath = join(__dirname, '../../assets/tray-icon.png');
  let icon = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  // KniPr026: versioned initial tooltip; updated by updateTrayTooltip() on update events.
  tray.setToolTip(`MnemosyneC v${app.getVersion()}`);
  // Single left-click opens Dashboard (right-click still shows context menu)
  tray.on('click', () => openDashboard());
  rebuildTrayMenu();
}

// KniPr026: refresh tray tooltip to reflect the current auto-update state.
// SEG-V0148-P0-GLANCE: also appends mesh progress suffix when a run is active.
function updateTrayTooltip(updateStatus?: UpdateState['status']): void {
  if (!tray || tray.isDestroyed()) return;
  const version = app.getVersion();
  const meshSuffix = substrateServer?.getMeshProgressSuffix() ?? null;
  const mesh = meshSuffix ? ` · ${meshSuffix}` : '';
  if (updateStatus === 'downloaded') {
    tray.setToolTip(`MnemosyneC v${version} · Update ready to install${mesh}`);
  } else if (updateStatus === 'available' || updateStatus === 'downloading') {
    tray.setToolTip(`MnemosyneC v${version} · Update available${mesh}`);
  } else {
    tray.setToolTip(`MnemosyneC v${version}${mesh}`);
  }
}

function rebuildTrayMenu(mode: FrameMode = currentMode): void {
  if (!tray) return;

  const modeLabel: Record<FrameMode, string> = {
    ai_burst: '?? AI Burst',
    normal: '?? Normal',
    fallback: '?? Fallback',
  };

  const forcedMode = substrateServer?.getForcedMode();
  const forcedLabel = forcedMode ? ` (forced)` : '';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `MnemosyneC ? ${modeLabel[mode]}${forcedLabel}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '?? AI Burst Mode',
      type: 'radio',
      checked: mode === 'ai_burst',
      click: () => {
        // SAGA-1 BP055: Burst Mode is the opt-in path that also surfaces the overlay.
        setMode('ai_burst');
        if (!overlayWindow) createOverlayWindow();
        overlayWindow?.showInactive();
      },
    },
    {
      label: '?? Normal Mode',
      type: 'radio',
      checked: mode === 'normal',
      click: () => setMode('normal'),
    },
    {
      label: '?? Fallback Mode',
      type: 'radio',
      checked: mode === 'fallback',
      click: () => setMode('fallback'),
    },
    { type: 'separator' },
    {
      label: forcedMode ? 'Clear Mode Override' : 'Auto-Detect Mode',
      click: () => {
        substrateServer?.setForcedMode(null);
        runConnectivityPoll();
      },
    },
    { type: 'separator' },
    {
      label: 'MnemosyneC Dashboard',
      click: () => openDashboard(),
    },
    {
      label: '? Open the Bridge',
      click: () => openHearthConjunctionWindow(),
    },
    {
      label: 'Settings',
      click: () => openDashboard(),
    },
    { type: 'separator' },
    {
      label: 'Check for Updates?',
      click: () => autoUpdater?.checkNow(),
    },
    {
      label: `MoneyPenny Mobile: ${getMoneyPennyURL(API_PORT)}`,
      click: () => openMoneyPennyWindow(),
    },
    {
      label: 'Open lianabanyan.com',
      click: () => shell.openExternal('https://lianabanyan.com'),
    },
    { type: 'separator' },
    {
      label: 'Hide Overlay',
      click: () => overlayWindow?.hide(),
    },
    {
      label: 'Show Overlay',
      click: () => {
        if (!overlayWindow) createOverlayWindow();
        overlayWindow?.showInactive();
      },
    },
    { type: 'separator' },
    {
      label: 'Send last copied as Q+A → MnemosyneC',
      click: () => {
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          dashboardWindow.webContents.send('clipboard:capture-qa');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit MnemosyneC',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// --- Dashboard Window ---------------------------------------------------------

function openMoneyPennyWindow(): void {
  if (moneyPennyWindow && !moneyPennyWindow.isDestroyed()) {
    moneyPennyWindow.focus();
    return;
  }

  const bounds = loadMoneyPennyBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;

  moneyPennyWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: MONEY_PENNY_MIN_WIDTH,
    minHeight: MONEY_PENNY_MIN_HEIGHT,
    maxWidth: Math.floor(workArea.width * 0.9),
    maxHeight: Math.floor(workArea.height * 0.9),
    title: 'MoneyPenny ? MnemosyneC CAI Amplifier',
    icon: join(__dirname, '../../assets/app-icon.ico'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  moneyPennyWindow.once('ready-to-show', () => {
    moneyPennyWindow?.show();
  });

  moneyPennyWindow.on('resize', () => {
    if (moneyPennyWindow && !moneyPennyWindow.isDestroyed()) {
      saveMoneyPennyBounds(moneyPennyWindow.getBounds());
    }
  });
  moneyPennyWindow.on('move', () => {
    if (moneyPennyWindow && !moneyPennyWindow.isDestroyed()) {
      saveMoneyPennyBounds(moneyPennyWindow.getBounds());
    }
  });
  moneyPennyWindow.on('closed', () => {
    moneyPennyWindow = null;
  });

  moneyPennyWindow.loadURL(getMoneyPennyURL(API_PORT));
}

// A-4 BP081 v0.1.59.1: Onboarding gate auto-flip (Ollama healthy + Gemma present)
async function checkAndAutoFlipOnboarding(win: BrowserWindow): Promise<void> {
  try {
    const ollamaResponse = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (!ollamaResponse?.ok) return;

    const tagsData = (await ollamaResponse.json().catch(() => null)) as { models?: Array<{ name?: string }> } | null;
    const models: string[] = (tagsData?.models ?? []).map((m) => m.name ?? '');
    const hasGemma = models.some((name) => name.toLowerCase().includes('gemma'));
    if (!hasGemma) return;

    if (!win.isDestroyed()) {
      win.webContents.send('onboarding:auto-flip-check', { ollamaHealthy: true, gemmaPresent: true });
    }
  } catch {
    // Non-fatal — ignore
  }
}

function openDashboard(opts?: { focus?: boolean }): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    if (opts?.focus !== false) dashboardWindow.focus();
    return;
  }

  // SAGA 07 BP046B ? expanded for 6-tab MnemosyneTabView
  // SEG-V0146-CRIT-3: screen-aware sizing + persistence (fixes title bar off-screen on small monitors)
  const dashBounds = loadDashboardBounds();
  dashboardWindow = new BrowserWindow({
    width: dashBounds.width,
    height: dashBounds.height,
    x: dashBounds.x,
    y: dashBounds.y,
    minWidth: DASHBOARD_MIN_WIDTH,
    minHeight: DASHBOARD_MIN_HEIGHT,
    title: `MnemosyneC v${app.getVersion()}`,
    icon: join(__dirname, '../../assets/app-icon.ico'),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow?.show();
    if (opts?.focus !== false) dashboardWindow?.focus();
  });

  dashboardWindow.on('resize', () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      saveDashboardBounds(dashboardWindow.getBounds());
    }
  });
  dashboardWindow.on('move', () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      saveDashboardBounds(dashboardWindow.getBounds());
    }
  });

  // Bug #2 v0.1.10: keep versioned title after any reload/navigation
  dashboardWindow.webContents.on('did-finish-load', () => {
    dashboardWindow?.setTitle(`MnemosyneC v${app.getVersion()}`);
    // SEG-FIX-3 BP078: Runtime preload smoke test.
    dashboardWindow?.webContents.executeJavaScript('typeof window.amplify').then((t) => {
      if (t === 'undefined') {
        console.error('[preload-smoke] FAIL dashboardWindow: window.amplify is undefined ? preload bridge did not load');
      } else {
        console.log('[preload-smoke] OK dashboardWindow: window.amplify is', t);
      }
    }).catch((e) => {
      console.error('[preload-smoke] dashboardWindow probe threw:', e?.message ?? e);
    });

    // A-3 BP081 v0.1.59.1: Send app version to renderer for stale-message pruning on upgrade
    dashboardWindow?.webContents.send('app:version-check', { version: app.getVersion() });

    // A-4 BP081 v0.1.59.1: Check Ollama health + Gemma presence for onboarding auto-flip
    void checkAndAutoFlipOnboarding(dashboardWindow!);
  });

  dashboardWindow.loadURL(
    IS_DEV
      ? 'http://127.0.0.1:5173/#/dashboard'
      : `file://${join(__dirname, '../renderer/index.html')}#/dashboard`,
  );

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  // SEG-Q-3 BP078: right-click on Windows title bar shows "Toggle Developer Tools"
  dashboardWindow.on('system-context-menu', (event, _point) => {
    event.preventDefault();
    const menu = Menu.buildFromTemplate([
      { label: 'Toggle Developer Tools', click: () => dashboardWindow?.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Reload', click: () => dashboardWindow?.webContents.reload() },
      { type: 'separator' },
      { label: 'Minimize', click: () => dashboardWindow?.minimize() },
      { label: 'Maximize / Restore', click: () => dashboardWindow?.isMaximized() ? dashboardWindow?.unmaximize() : dashboardWindow?.maximize() },
      { label: 'Close', click: () => dashboardWindow?.close() },
    ]);
    menu.popup({ window: dashboardWindow ?? undefined });
  });

  if (autoUpdater) autoUpdater.registerWindow(dashboardWindow);
  if (authManager) authManager.registerWindow(dashboardWindow);
  registerWindowForAutoUpdate(dashboardWindow); // M21
  if (folderWatcher && dashboardWindow) folderWatcher.setMainWindow(dashboardWindow);
}

function setupLanHandshakeDiscovery(): void {
  if (!peerDiscovery) return;
  const ownId = getStablePeerId();

  peerDiscovery.on('peer-discovered', (peer) => {
    if (peer.transport !== 'lan' || peer.peerId === ownId) return;
    if (!lanHandshakeEligible || lanHandshakePromptInFlight) return;

    const prefs = loadLanHandshakePrefs();
    if (prefs.neverAsk) return;
    if (prefs.connectedPeers?.includes(peer.peerId)) return;

    lanHandshakePromptInFlight = true;
    const hostname = peer.displayName || peer.address || peer.peerId.slice(0, 12);

    void dialog.showMessageBox({
      type: 'question',
      title: 'MnemosyneC on your network',
      message: `Found another MnemosyneC on your network: ${hostname}`,
      detail: 'Would you like to connect to it? (LOCAL-HANDSHAKE ? same house LAN)',
      buttons: ['Yes, connect', 'Not Now', 'Never Ask Again'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        openDashboard({ focus: true });
        dashboardWindow?.webContents.send('federation:lan-peer-offer', peer);
        saveLanHandshakePrefs({
          ...prefs,
          connectedPeers: [...(prefs.connectedPeers ?? []), peer.peerId],
        });
      } else if (result.response === 2) {
        saveLanHandshakePrefs({ ...prefs, neverAsk: true });
      }
    }).finally(() => {
      lanHandshakePromptInFlight = false;
    });
  });
}

// --- Hearth Conjunction Window (B83) -----------------------------------------

function openHearthConjunctionWindow(): void {
  if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
    hearthConjunctionWindow.focus();
    return;
  }

  // SEG-V0146-CRIT-3: screen-aware sizing + persistence for Hearth Conjunction window
  const bounds = loadHearthBounds();

  // Webview preload path ? compiled from src/main/hearth/embedded_browser/webview_preload.ts
  const webviewPreloadPath = join(__dirname, 'hearth', 'embedded_browser', 'webview_preload.js');

  hearthConjunctionWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: 'MnemosyneC ? Memory, powered by CAI',
    icon: join(__dirname, '../../assets/app-icon.ico'),
    minWidth: HEARTH_MIN_WIDTH,
    minHeight: HEARTH_MIN_HEIGHT,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // B83b: enable <webview> for EmbeddedChrome
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  hearthConjunctionWindow.once('ready-to-show', () => {
    hearthConjunctionWindow?.show();
  });

  hearthConjunctionWindow.on('resize', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      saveHearthBounds(hearthConjunctionWindow.getBounds());
    }
  });
  hearthConjunctionWindow.on('move', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      saveHearthBounds(hearthConjunctionWindow.getBounds());
    }
  });

  // SEG-FIX-3 BP078: Runtime preload smoke test for hearthConjunctionWindow.
  hearthConjunctionWindow.webContents.once('did-finish-load', () => {
    hearthConjunctionWindow?.webContents.executeJavaScript('typeof window.amplify').then((t) => {
      if (t === 'undefined') {
        console.error('[preload-smoke] FAIL hearthConjunctionWindow: window.amplify is undefined ? preload bridge did not load');
      } else {
        console.log('[preload-smoke] OK hearthConjunctionWindow: window.amplify is', t);
      }
    }).catch((e) => {
      console.error('[preload-smoke] hearthConjunctionWindow probe threw:', e?.message ?? e);
    });
  });

  hearthConjunctionWindow.loadURL(
    IS_DEV
      ? 'http://localhost:5173/#/hearth-conjunction'
      : `file://${join(__dirname, '../renderer/index.html')}#/hearth-conjunction`,
  );

  hearthConjunctionWindow.on('closed', () => {
    hearthConjunctionWindow = null;
  });

  // SEG-Q-3 BP078: right-click on Windows title bar shows "Toggle Developer Tools"
  hearthConjunctionWindow.on('system-context-menu', (event, _point) => {
    event.preventDefault();
    const menu = Menu.buildFromTemplate([
      { label: 'Toggle Developer Tools', click: () => hearthConjunctionWindow?.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Reload', click: () => hearthConjunctionWindow?.webContents.reload() },
      { type: 'separator' },
      { label: 'Minimize', click: () => hearthConjunctionWindow?.minimize() },
      { label: 'Close', click: () => hearthConjunctionWindow?.close() },
    ]);
    menu.popup({ window: hearthConjunctionWindow ?? undefined });
  });

  // Store webview preload path for IPC response
  ;(hearthConjunctionWindow as unknown as { _webviewPreloadPath: string })._webviewPreloadPath = webviewPreloadPath;

  if (autoUpdater) autoUpdater.registerWindow(hearthConjunctionWindow);
  if (authManager) authManager.registerWindow(hearthConjunctionWindow);
  registerWindowForAutoUpdate(hearthConjunctionWindow); // M21
}

// --- IPC Handlers ------------------------------------------------------------

let skuPullRunning = false;

// --- SEG-Q-4 BP078: Auto-prepare FULL upgrade in background ------------------

let autoPrepareRunning = false;
let autoPrepareIdleTimer: NodeJS.Timeout | null = null;
const AUTO_PREPARE_MODEL = 'gemma4:12b';
const AUTO_PREPARE_IDLE_MS = 30 * 60 * 1000; // 30 min

function getAutoPrepareEnabled(): boolean {
  try {
    const cfgPath = join(app.getPath('userData'), 'auto_prepare_full.json');
    if (!existsSync(cfgPath)) return false;
    const data = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    return data.enabled === true;
  } catch { return false; }
}

function setAutoPrepareEnabled(enabled: boolean): void {
  try {
    const cfgPath = join(app.getPath('userData'), 'auto_prepare_full.json');
    writeFileSync(cfgPath, JSON.stringify({ enabled }), 'utf-8');
  } catch { /* non-fatal */ }
}

function isGemma4Ready(): boolean {
  try {
    const manifestPath = join(homedir(), '.ollama', 'models', 'manifests',
      'registry.ollama.ai', 'library', 'gemma4', '12b');
    const fallbackPath = join(homedir(), '.ollama', 'models', 'manifests',
      'registry.ollama.ai', 'gemma4', '12b');
    return existsSync(manifestPath) || existsSync(fallbackPath);
  } catch { return false; }
}

function runAutoPrepareIfNeeded(): void {
  if (!getAutoPrepareEnabled()) return;
  if (autoPrepareRunning) return;
  if (isGemma4Ready()) return;

  autoPrepareRunning = true;

  ollamaManager.pullModel(AUTO_PREPARE_MODEL).then(() => {
    autoPrepareRunning = false;
    const notif = new Notification({
      title: 'MnemosyneC ? Gemma 4 12B is ready',
      body: 'Full AI model downloaded. Click to activate.',
      silent: false,
    });
    notif.on('click', () => {
      try {
        writeFileSync(
          join(app.getPath('userData'), 'sku_tier.json'),
          JSON.stringify({ tier: 'full', model: AUTO_PREPARE_MODEL }),
          'utf-8',
        );
      } catch { /* non-fatal */ }
      openDashboard({ focus: true });
      dashboardWindow?.webContents.send('auto-prepare:model-activated');
    });
    notif.show();
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send('auto-prepare:model-ready');
    });
  }).catch(() => {
    autoPrepareRunning = false;
  });
}

function scheduleAutoPrepareIdle(): void {
  if (autoPrepareIdleTimer) clearTimeout(autoPrepareIdleTimer);
  autoPrepareIdleTimer = setTimeout(() => {
    runAutoPrepareIfNeeded();
    scheduleAutoPrepareIdle();
  }, AUTO_PREPARE_IDLE_MS);
}

// BP085 — handleMembershipReturn (called from mnemosynec:// deep-link).
// NEVER logs token value (BP085 BLOOD).
async function handleMembershipReturn(memberId: string, token: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const notifyRenderer = (payload: { ok: boolean; member_id?: string; error?: string }) => {
    const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
    for (const win of wins) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('membership:activation-result', payload);
      }
    }
  };

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[membership-return] Supabase not configured — cannot validate token');
    notifyRenderer({ ok: false, error: 'Supabase not configured — verify at lianabanyan.com' });
    return;
  }

  try {
    const resp = await globalThis.fetch(
      `${supabaseUrl}/functions/v1/membership-callback-mnemosynec`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ member_id: memberId, token }),
      },
    );

    const json = await resp.json() as { valid?: boolean; error?: string };

    if (resp.ok && json.valid === true) {
      const { writeFileSync } = await import('fs');
      const { join: pathJoin } = await import('path');
      const statusFile = pathJoin(app.getPath('userData'), 'member_status.json');
      writeFileSync(
        statusFile,
        JSON.stringify({ is_member: true, member_id: memberId, activated_at: new Date().toISOString() }),
        'utf8',
      );
      console.log('[membership-return] Membership activated for member_id:', memberId);
      notifyRenderer({ ok: true, member_id: memberId });
    } else {
      console.warn('[membership-return] Token validation failed:', json.error ?? 'unknown');
      notifyRenderer({ ok: false, error: json.error ?? 'Token validation failed' });
    }
  } catch (err) {
    console.error('[membership-return] Exception:', err);
    notifyRenderer({ ok: false, error: String(err) });
  }
}

function registerIPCHandlers(): void {
  // Guard against duplicate handle registrations -- ipcMain.handle throws on dups.
  // safeHandle wraps every call so accidental future duplicates fail loudly (console.error)
  // rather than crashing the app silently.
  const safeHandle = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
    try {
      ipcMain.handle(channel, handler);
    } catch (e) {
      console.error(`[IPC] Duplicate registration attempt for ${channel}:`, e);
    }
  };

  // SAGA 07+13 BP046B utility + first-install bonus

  ipcMain.on('open-external', (_event: Electron.IpcMainEvent, { url }: { url: string }) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  ipcMain.on('hide-overlay', () => { overlayWindow?.hide(); });

  ipcMain.on('show-overlay', () => {
    if (!overlayWindow) createOverlayWindow();
    overlayWindow?.setOpacity(1.0);
    overlayWindow?.showInactive();
  });

  // SEG-Q-3 BP078: DevTools toggle via renderer button (fallback when Ctrl+Shift+D conflicts)
  ipcMain.on('devtools:toggle', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  // SEG-V0144-UI-1: Apply zoom factor to all active BrowserWindows
  ipcMain.on('set-zoom-factor', (_event, factor: number) => {
    if (typeof factor !== 'number' || factor < 0.5 || factor > 3.0) return;
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.setZoomFactor(factor);
    });
  });

  // SEG-Q-4 BP078: Auto-prepare FULL upgrade IPC
  safeHandle('auto-prepare:get', () => ({
    enabled: getAutoPrepareEnabled(),
    modelReady: isGemma4Ready(),
    pulling: autoPrepareRunning,
  }));

  // v0.4.0 BP083 SEG-5: request-app-quit IPC (renderer restart prompt)
  ipcMain.on('request-app-quit', () => {
    app.quit();
  });

  // BP081 K-2 — MCP server status + auth token IPC
  safeHandle('mcp:get-status', async () => getMcpServerStatus());
  safeHandle('mcp:get-auth-token', async () => {
    const tokenPath = join(app.getPath('userData'), 'mcp_auth_token.txt');
    return existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8').trim() : null;
  });

  ipcMain.on('auto-prepare:set', (_event, enabled: boolean) => {
    setAutoPrepareEnabled(enabled);
    if (enabled) {
      runAutoPrepareIfNeeded();
      scheduleAutoPrepareIdle();
    } else {
      if (autoPrepareIdleTimer) { clearTimeout(autoPrepareIdleTimer); autoPrepareIdleTimer = null; }
      autoPrepareRunning = false;
    }
  });

  // SEG-Q-13 BP078: Run Diagnostic -- writes probe results to userData log file
  safeHandle('diagnostic:run', async () => {
    const results: string[] = [];
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const logPath = join(app.getPath('userData'), `diagnostic-${ts}.log`);

    results.push(`=== MnemosyneC Diagnostic ===`);
    results.push(`Timestamp: ${new Date().toISOString()}`);
    results.push(`App version: ${app.getVersion()}`);
    results.push(`Platform: ${process.platform} ${process.arch}`);
    results.push(`Electron: ${process.versions.electron}`);
    results.push(`Node: ${process.versions.node}`);
    results.push(`userData: ${app.getPath('userData')}`);
    results.push(``);

    // Ollama status + SEG-V0148-P2 enrichment
    try {
      const ollamaStatus = ollamaManager ? ollamaManager.getStatus() : { running: false, model: null };
      results.push(`Ollama running: ${ollamaStatus.running}`);
      results.push(`Ollama model: ${ollamaStatus.model ?? 'none'}`);
      results.push(`ollamaPath=${_capturedOllamaPath ?? 'null'}`);
      results.push(`branch=${_capturedOllamaBranch}`);
    } catch (e) {
      results.push(`Ollama status error: ${(e as Error).message}`);
    }
    results.push(``);

    // SEG-V0148-P0-SKU-MODEL: active vs target model
    results.push(`activeModel=${_capturedActiveModel} targetModel=${_capturedTargetModel}`);
    if (_capturedActiveModel !== _capturedTargetModel) {
      results.push(`  *** MISMATCH — full-tier model not served — mesh test NOT comparable to published benchmarks ***`);
    }
    results.push(``);

    // SKU tier
    try {
      const skuPath = join(app.getPath('userData'), 'sku_tier.json');
      if (existsSync(skuPath)) {
        const sku = JSON.parse(readFileSync(skuPath, 'utf-8'));
        results.push(`SKU tier: ${JSON.stringify(sku)}`);
      } else {
        results.push(`SKU tier: not yet set (fresh install)`);
      }
    } catch (e) {
      results.push(`SKU tier error: ${(e as Error).message}`);
    }

    // Gemma4:12b manifest check
    try {
      const manifestPath = join(homedir(), '.ollama', 'models', 'manifests', 'registry.ollama.ai', 'library', 'gemma4', '12b');
      results.push(`gemma4:12b manifest exists: ${existsSync(manifestPath)}`);
    } catch (e) {
      results.push(`gemma4:12b check error: ${(e as Error).message}`);
    }
    results.push(``);

    // Windows: available disk space
    try {
      const diskOk = await ollamaManager.checkDiskSpace(6);
      results.push(`Disk space ok (need 6GB): ${diskOk}`);
    } catch (e) {
      results.push(`Disk space check error: ${(e as Error).message}`);
    }

    // SEG-V0148-P1-SUBSTRATE-PATHS: fix probes to use process.resourcesPath on packaged installs
    try {
      const subPath = app.isPackaged
        ? join(process.resourcesPath, 'r10v3_substrate.txt')
        : join(app.getPath('userData'), '..', '..', 'resources', 'r10v3_substrate.txt');
      const subPath2 = app.isPackaged
        ? join(process.resourcesPath, 'r10v3_substrate.txt')
        : join(__dirname, '..', '..', 'resources', 'r10v3_substrate.txt');
      results.push(`substrate (resources): ${existsSync(subPath)}`);
      results.push(`substrate (dist-relative): ${existsSync(subPath2)}`);
    } catch (e) {
      results.push(`substrate check error: ${(e as Error).message}`);
    }
    results.push(``);

    // Auto-prepare state
    try {
      const apPath = join(app.getPath('userData'), 'auto_prepare_full.json');
      if (existsSync(apPath)) {
        const ap = JSON.parse(readFileSync(apPath, 'utf-8'));
        results.push(`Auto-prepare enabled: ${ap.enabled}`);
      } else {
        results.push(`Auto-prepare: not configured (OFF)`);
      }
    } catch (e) {
      results.push(`Auto-prepare check error: ${(e as Error).message}`);
    }

    // Open windows
    results.push(``);
    results.push(`Open windows: ${BrowserWindow.getAllWindows().length}`);
    BrowserWindow.getAllWindows().forEach((w, i) => {
      results.push(`  [${i}] title="${w.getTitle()}" destroyed=${w.isDestroyed()}`);
    });

    results.push(``);
    results.push(`=== END DIAGNOSTIC ===`);

    const content = results.join('\n');
    writeFileSync(logPath, content, 'utf-8');

    console.log(`[diagnostic] log written to ${logPath}`);
    return { ok: true, logPath, content };
  });

  // SEG-R-13: Open the folder that contains a diagnostic log file
  safeHandle('diagnostic:open-folder', async (_event, folderPath: string) => {
    try {
      await shell.showItemInFolder(folderPath);
    } catch (e) {
      console.error('[diagnostic] open-folder failed:', e);
    }
  });

  // -- BP065 Onboarding Prefs (v0.1.23) -------------------------------------
  // Applies setup screen preferences: desktop shortcut, startup item, optional API key.
  // All fields are best-effort; failures are non-fatal (onboarding is optional).
  safeHandle('onboarding:apply-prefs', async (_event, prefs: {
    displayName?: string;
    addDesktopShortcut?: boolean;
    addStartupItem?: boolean;
    apiKey?: string;
  }) => {
    const results: Record<string, boolean> = {};

    // Desktop shortcut (Windows only)
    if (prefs.addDesktopShortcut && process.platform === 'win32') {
      try {
        const { shell: electronShell } = require('electron');
        const path = require('path');
        const desktopPath = app.getPath('desktop');
        const exePath = process.execPath;
        electronShell.writeShortcutLink(
          path.join(desktopPath, 'MnemosyneC.lnk'),
          'create',
          { target: exePath, name: 'MnemosyneC', description: 'MnemosyneC ? private AI memory' },
        );
        results.desktopShortcut = true;
      } catch (err) {
        console.warn('[onboarding] desktop shortcut creation failed (non-fatal):', err);
        results.desktopShortcut = false;
      }
    }

    // Startup item (cross-platform)
    try {
      app.setLoginItemSettings({ openAtLogin: prefs.addStartupItem ?? false });
      results.startupItem = true;
    } catch (err) {
      console.warn('[onboarding] setLoginItemSettings failed (non-fatal):', err);
      results.startupItem = false;
    }

    // API key (store via existing agent key infrastructure, non-fatal if unavailable)
    if (prefs.apiKey && prefs.apiKey.trim()) {
      try {
        const envLoader = require('./env_loader');
        if (typeof envLoader?.setRuntimeKey === 'function') {
          envLoader.setRuntimeKey('ANTHROPIC_API_KEY', prefs.apiKey.trim());
        }
        results.apiKey = true;
      } catch {
        results.apiKey = false;
      }
    }

    console.log('[onboarding] prefs applied:', JSON.stringify({ ...results, displayName: !!prefs.displayName }));
    return { ok: true, results };
  });

  // SAGA 13 BP046B: 5-Marks first-install bonus (one-per-machine flag)
  ipcMain.on('credit-first-install-marks', () => {
    const { join } = require('path');
    const { existsSync, writeFileSync } = require('fs');
    const flagPath = join(app.getPath('userData'), 'first_install_marks_credited.flag');
    if (!existsSync(flagPath)) {
      writeFileSync(flagPath, new Date().toISOString(), 'utf-8');
      console.log('[SAGA13] First-install 5 marks credited');
    }
  });

  // -- v0.2.0 BP082 OAuth (Discord + Reddit) ----------------------------------
  //
  // Secrets discipline: client IDs from env (DISCORD_OAUTH_CLIENT_ID /
  // REDDIT_OAUTH_CLIENT_ID). Client secrets ONLY in 22May2026.env — never
  // in source, never in renderer context, never in logs.
  // OAuth tokens stored via safeStorage.encryptString() → userData/oauth_tokens.json.enc
  // Protocol redirect: mnemo://oauth/<platform>/callback (registered in package.json).

  const OAUTH_CONFIGS: Record<string, { authUrl: string; tokenUrl: string; scope: string }> = {
    discord: {
      authUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      scope: 'identify email guilds guilds.members.read messages.read',
    },
    reddit: {
      authUrl: 'https://www.reddit.com/api/v1/authorize',
      tokenUrl: 'https://www.reddit.com/api/v1/access_token',
      scope: 'identity read submit vote subscribe mysubreddits',
    },
  };

  safeHandle('oauth:start-flow', async (_event, { platform }: { platform: 'discord' | 'reddit' }) => {
    const { shell, safeStorage } = require('electron');
    const { join } = require('path');
    const { readFileSync, writeFileSync, existsSync } = require('fs');
    const crypto = require('crypto');

    const clientIdKey = platform === 'discord' ? 'DISCORD_OAUTH_CLIENT_ID' : 'REDDIT_OAUTH_CLIENT_ID';
    const clientId = process.env[clientIdKey];
    if (!clientId) {
      console.log(`[OAuth] ${platform} client ID not set — needs app registration`);
      return { success: false, needsRegistration: true };
    }

    const cfg = OAUTH_CONFIGS[platform];
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `mnemo://oauth/${platform}/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: cfg.scope,
      state,
      ...(platform === 'discord' ? {} : { duration: 'permanent' }),
    });

    const authUrl = `${cfg.authUrl}?${params.toString()}`;

    return new Promise<{ success: boolean; username?: string; scopes?: string[]; error?: string; needsRegistration?: boolean }>((resolve) => {
      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        app.removeListener('open-url', handler);
        resolve({ success: false, error: 'OAuth timeout — user did not complete authorization.' });
      }, 5 * 60 * 1000);

      const handler = (_e: Electron.Event, url: string) => {
        if (!url.startsWith(`mnemo://oauth/${platform}/callback`)) return;
        clearTimeout(timeout);
        app.removeListener('open-url', handler);

        const u = new URL(url);
        const code = u.searchParams.get('code');
        const returnedState = u.searchParams.get('state');
        const error = u.searchParams.get('error');

        if (error || !code) {
          resolve({ success: false, error: error ?? 'No code returned from OAuth provider.' });
          return;
        }
        if (returnedState !== state) {
          resolve({ success: false, error: 'OAuth state mismatch — possible CSRF. Please try again.' });
          return;
        }

        // Exchange code for token in main process
        const clientSecretKey = platform === 'discord' ? 'DISCORD_OAUTH_CLIENT_SECRET' : 'REDDIT_OAUTH_CLIENT_SECRET';
        const clientSecret = process.env[clientSecretKey];
        if (!clientSecret) {
          resolve({ success: false, error: `${platform} client secret not set. Add ${clientSecretKey} to env.` });
          return;
        }

        const tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId!,
          client_secret: clientSecret,
        });

        fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(platform === 'reddit' ? {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            } : {}),
          },
          body: tokenBody.toString(),
        })
          .then((r) => r.json())
          .then(async (tokenData: Record<string, unknown>) => {
            if (tokenData.error) {
              resolve({ success: false, error: String(tokenData.error_description ?? tokenData.error) });
              return;
            }

            // Store token encrypted via safeStorage
            const tokenPath = join(app.getPath('userData'), `oauth_${platform}.enc`);
            if (safeStorage.isEncryptionAvailable()) {
              const encrypted = safeStorage.encryptString(JSON.stringify(tokenData));
              writeFileSync(tokenPath, encrypted);
            } else {
              // Fallback: write with mild obfuscation + warn (safeStorage unavailable on headless)
              console.warn(`[OAuth] safeStorage unavailable — ${platform} token stored with reduced security`);
              writeFileSync(tokenPath, Buffer.from(JSON.stringify(tokenData)).toString('base64'));
            }

            // Fetch username from platform API
            let username = 'user';
            try {
              const accessToken = String(tokenData.access_token);
              if (platform === 'discord') {
                const meRes = await fetch('https://discord.com/api/users/@me', {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                const me = await meRes.json() as { username?: string };
                username = me.username ?? 'user';
              } else {
                const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
                  headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'MnemosyneC/0.2.0' },
                });
                const me = await meRes.json() as { name?: string };
                username = me.name ?? 'user';
              }
            } catch { /* non-fatal — username fallback */ }

            // Store metadata (non-secret) in plain JSON for quick reads
            const metaPath = join(app.getPath('userData'), `oauth_${platform}_meta.json`);
            writeFileSync(metaPath, JSON.stringify({ connected: true, username, scopes: cfg.scope.split(' '), connectedAt: new Date().toISOString() }));

            resolve({ success: true, username, scopes: cfg.scope.split(' ') });
          })
          .catch((err: Error) => {
            resolve({ success: false, error: `Token exchange failed: ${err.message}` });
          });
      };

      app.on('open-url', handler);
      shell.openExternal(authUrl).catch(() => {
        clearTimeout(timeout);
        app.removeListener('open-url', handler);
        resolve({ success: false, error: 'Could not open browser for OAuth.' });
      });
    });
  });

  safeHandle('oauth:revoke-token', (_event, { platform }: { platform: string }) => {
    const { join } = require('path');
    const { existsSync, unlinkSync } = require('fs');
    const tokenPath = join(app.getPath('userData'), `oauth_${platform}.enc`);
    const metaPath = join(app.getPath('userData'), `oauth_${platform}_meta.json`);
    try {
      if (existsSync(tokenPath)) unlinkSync(tokenPath);
      if (existsSync(metaPath)) unlinkSync(metaPath);
      console.log(`[OAuth] ${platform} token revoked`);
    } catch { /* non-fatal */ }
    return { ok: true };
  });

  safeHandle('oauth:get-connection-info', (_event, { platform }: { platform: string }) => {
    const { join } = require('path');
    const { existsSync, readFileSync } = require('fs');
    const metaPath = join(app.getPath('userData'), `oauth_${platform}_meta.json`);
    if (!existsSync(metaPath)) return { connected: false };
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as { connected: boolean; username?: string };
      return { connected: meta.connected, username: meta.username };
    } catch {
      return { connected: false };
    }
  });

  safeHandle('oauth:accrue-connect-marks', (_event, { platform, amount }: { platform: string; amount: number }) => {
    const { join } = require('path');
    const { existsSync, readFileSync, writeFileSync } = require('fs');
    const flagPath = join(app.getPath('userData'), `oauth_${platform}_marks_credited.flag`);
    if (existsSync(flagPath)) {
      // Already credited — idempotent
      const ledger = join(app.getPath('userData'), 'marks_ledger.json');
      try {
        const existing = JSON.parse(readFileSync(ledger, 'utf-8')) as { total: number };
        return { ok: true, total: existing.total };
      } catch {
        return { ok: true };
      }
    }
    writeFileSync(flagPath, new Date().toISOString(), 'utf-8');
    const ledgerPath = join(app.getPath('userData'), 'marks_ledger.json');
    let total = amount;
    try {
      const existing = JSON.parse(readFileSync(ledgerPath, 'utf-8')) as { total: number };
      total = (existing.total || 0) + amount;
    } catch { /* first entry */ }
    writeFileSync(ledgerPath, JSON.stringify({ total, updated: new Date().toISOString() }), 'utf-8');
    console.log(`[Marks] +${amount} for ${platform} connect. Total: ${total}`);
    return { ok: true, total };
  });

  // -- Mode ------------------------------------------------------------------
  safeHandle('get-frame-mode', () => ({
    mode: currentMode,
    forced_mode: substrateServer?.getForcedMode() ?? null,
  }));

  ipcMain.on('set-frame-mode', (_event, { mode }: { mode: FrameMode }) => {
    setMode(mode);
  });

  // Force or clear mode override (persists through auto-detect cycles)
  safeHandle('force-frame-mode', (_event, { mode }: { mode: FrameMode | null }) => {
    substrateServer?.setForcedMode(mode);
    if (mode !== null) setMode(mode);
    else runConnectivityPoll();
    rebuildTrayMenu();
    return { ok: true, forced_mode: substrateServer?.getForcedMode() ?? null };
  });

  // -- Overlay ---------------------------------------------------------------
  ipcMain.on('set-clickthrough', (_event, { enabled }: { enabled: boolean }) => {
    applyLBFrameClickthrough(enabled);
  });

  // -- Ollama ----------------------------------------------------------------
  safeHandle('get-ollama-status', async () => {
    return ollamaManager.getStatus();
  });

  safeHandle('pull-default-model', async () => {
    const reachable = await ollamaManager.isReachable();
    if (!reachable) return { success: false, error: 'Ollama not running' };
    const hasModel = await ollamaManager.hasFloorModel();
    if (hasModel) return { success: true, alreadyInstalled: true };
    try {
      await ollamaManager.pullModel(undefined, (progress) => {
        overlayWindow?.webContents.send('ollama-pull-progress', progress);
        dashboardWindow?.webContents.send('ollama-pull-progress', progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // SEG-U-6: pull a user-named model with streaming progress
  safeHandle('pull-named-model', async (_event, { modelName }: { modelName: string }) => {
    const reachable = await ollamaManager.isReachable();
    if (!reachable) return { success: false, error: 'Ollama not running' };
    const hasModel = await ollamaManager.hasModel(modelName);
    if (hasModel) return { success: true, alreadyInstalled: true };
    try {
      await ollamaManager.pullModel(modelName, (progress) => {
        overlayWindow?.webContents.send('ollama-pull-progress', progress);
        dashboardWindow?.webContents.send('ollama-pull-progress', progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // SEG-2 v0.1.56 — first-launch auto-pull with streaming progress + cancellation
  // AbortController is module-level closure so cancel can reach the in-flight request.
  let _floorPullAbort: AbortController | null = null;

  safeHandle('first-launch-model-check', async (_event, { modelName }: { modelName: string }) => {
    try {
      const model = modelName || 'gemma4:12b';
      const models = await ollamaManager.listModels();
      const exists = models.some(
        (m) => m === model || m.startsWith(model.split(':')[0]),
      );
      return { exists, modelName: model };
    } catch {
      return { exists: false, modelName: modelName || 'gemma4:12b' };
    }
  });

  safeHandle('first-launch-model-start', async (event, { modelName }: { modelName: string }) => {
    const model = modelName || 'gemma4:12b';

    // Abort any in-flight pull before starting a fresh one.
    _floorPullAbort?.abort();
    _floorPullAbort = new AbortController();
    const { signal } = _floorPullAbort;

    try {
      const reachable = await ollamaManager.isReachable();
      if (!reachable) {
        event.sender.send('first-launch-model-error', 'Local AI engine not running. Open the Home tab first.');
        return { ok: false, error: 'not reachable' };
      }

      const models = await ollamaManager.listModels();
      const exists = models.some(
        (m) => m === model || m.startsWith(model.split(':')[0]),
      );
      if (exists) {
        event.sender.send('first-launch-model-complete');
        return { ok: true, alreadyInstalled: true };
      }

      const res = await fetch('http://127.0.0.1:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: true }),
        signal,
      });

      if (!res.ok || !res.body) {
        const msg = `Pull request failed: ${res.statusText}`;
        event.sender.send('first-launch-model-error', msg);
        return { ok: false, error: msg };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        if (signal.aborted) {
          reader.cancel().catch(() => {});
          event.sender.send('first-launch-model-error', 'Download cancelled.');
          return { ok: false, cancelled: true };
        }
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const ev = JSON.parse(line) as {
              status: string;
              completed?: number;
              total?: number;
            };
            if (ev.status === 'success') {
              event.sender.send('first-launch-model-complete');
              return { ok: true };
            }
            const percent =
              ev.total && ev.completed != null
                ? Math.round((ev.completed / ev.total) * 100)
                : 0;
            event.sender.send('first-launch-model-progress', {
              percent,
              downloaded: ev.completed ?? 0,
              total: ev.total ?? 0,
              status: ev.status,
            });
          } catch { /* skip malformed lines */ }
        }
      }

      event.sender.send('first-launch-model-complete');
      return { ok: true };
    } catch (err) {
      if (signal.aborted) {
        event.sender.send('first-launch-model-error', 'Download cancelled.');
        return { ok: false, cancelled: true };
      }
      const msg = err instanceof Error ? err.message : String(err);
      event.sender.send('first-launch-model-error', msg);
      return { ok: false, error: msg };
    }
  });

  safeHandle('first-launch-model-cancel', () => {
    _floorPullAbort?.abort();
    _floorPullAbort = null;
    return { ok: true };
  });

  // SEG-V-1: live pre-flight check -- routes through OllamaManager as single source of truth.
  // Shared utility reused by ModelSetupProgress (SEG-V-1) and Layer2ProveIt model selector (SEG-V-4).
  safeHandle('check-ollama-and-model', async (_event, { modelName }: { modelName: string }) => {
    try {
      const status = ollamaManager.getStatus();
      const reachable = status.running || (await ollamaManager.isReachable());
      if (!reachable) {
        return {
          reachable: false,
          hasModel: false,
          models: [] as string[],
          error: 'Local AI engine not running. Open the Home tab to set up MnemosyneC.',
        };
      }
      const models = await ollamaManager.listModels();
      const hasModel = models.some(
        (m) => m === modelName || m.startsWith(modelName.split(':')[0])
      );
      return { reachable: true, hasModel, models };
    } catch (err) {
      return {
        reachable: false,
        hasModel: false,
        models: [] as string[],
        error: String(err),
      };
    }
  });

  // BP067 v0.1.24 ? transparent install + bundled Gemma floor
  safeHandle('setup-private-ai', async () => {
    const sendProgress = (p: import('./ollama_manager').EngineSetupProgress) => {
      overlayWindow?.webContents.send('engine-setup-progress', p);
      dashboardWindow?.webContents.send('engine-setup-progress', p);
    };
    return ollamaManager.ensureFloorModel(
      sendProgress,
      (pull) => {
        overlayWindow?.webContents.send('ollama-pull-progress', pull);
        dashboardWindow?.webContents.send('ollama-pull-progress', pull);
      },
    );
  });

  safeHandle('mark-bp067-first-run-complete', () => {
    markFirstRunComplete();
    return { ok: true };
  });

  // SEG-V0149-P0: lean-install-start — guided full-tier AI installation
  // Uses ollamaManager exclusively — zero new spawn() calls.
  safeHandle('lean-install-start', async (event) => {
    const emitStatus = (step: string, message: string) => {
      event.sender.send('lean-install-status', { step, message });
    };
    const emitProgress = (bytesDownloaded: number, totalBytes: number, speedLabel: string, eta_s: number) => {
      const percentComplete = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
      event.sender.send('lean-install-progress', { bytesDownloaded, totalBytes, percentComplete, speedLabel, eta_s });
    };
    const emitError = (message: string, retryable: boolean) => {
      event.sender.send('lean-install-error', { message, retryable });
    };

    try {
      // Step 1: Check if Ollama daemon is already running
      const status = ollamaManager.getStatus();
      if (status.running) {
        emitStatus('ollama_ready', 'Found your local AI engine. Setting up...');
      } else {
        // Step 2: Attempt to start Ollama (handles pre-installed → bundled → NONE internally)
        emitStatus('starting_engine', 'Starting your AI engine...');
        await ollamaManager.init();
        const statusAfterInit = ollamaManager.getStatus();
        if (!statusAfterInit.running) {
          // Neither pre-installed nor bundled found — send user to download page
          shell.openExternal('https://ollama.com/download/windows');
          emitStatus('waiting_ollama', 'Install Ollama, then click Resume.');
          return { ok: false, waitingForInstall: true };
        }
        emitStatus('ollama_ready', 'Found your local AI engine. Setting up...');
      }

      // Step 3: Check if full-tier model is already available
      const MODEL = 'gemma4:12b';
      const hasModel = await ollamaManager.hasModel(MODEL);
      if (hasModel) {
        emitStatus('model_ready', 'Full AI model already on your machine.');
      } else {
        emitStatus('pulling_model', `Downloading full AI model (${MODEL})...`);

        let lastBytes = 0;
        let lastTs = Date.now();

        await ollamaManager.pullModel(MODEL, (progress) => {
          const bytesDownloaded = progress.bytesDownloaded ?? progress.completed ?? 0;
          const totalBytes = progress.totalBytes ?? progress.total ?? 0;
          const now = Date.now();
          const elapsedSec = (now - lastTs) / 1000;
          const bytesDelta = bytesDownloaded - lastBytes;

          if (elapsedSec >= 1 && bytesDelta > 0) {
            const bytesPerSec = bytesDelta / elapsedSec;
            const remaining = totalBytes > bytesDownloaded ? totalBytes - bytesDownloaded : 0;
            const eta_s = bytesPerSec > 0 ? Math.round(remaining / bytesPerSec) : 0;
            const speedLabel = bytesPerSec >= 1_000_000
              ? `${(bytesPerSec / 1_000_000).toFixed(1)} MB/s`
              : `${(bytesPerSec / 1_000).toFixed(0)} KB/s`;
            lastBytes = bytesDownloaded;
            lastTs = now;
            emitProgress(bytesDownloaded, totalBytes, speedLabel, eta_s);
          }
        });
      }

      // Step 4: Write SKU tier file and signal completion
      writeFileSync(
        join(app.getPath('userData'), 'sku_tier.json'),
        JSON.stringify({ tier: 'full', model: 'gemma4:12b' }),
      );
      emitStatus('done', 'Your AI is ready.');
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitError(message, true);
      return { ok: false, error: message };
    }
  });

  safeHandle('ask-floor-model', async (_event, { prompt }: { prompt: string }) => {
    return ollamaManager.askFloorModel(prompt);
  });

  safeHandle('list-ollama-models', async () => {
    return ollamaManager.listModels();
  });

  // KniPr012 ? check if Ollama binary is installed (distinct from daemon running)
  safeHandle('check-ollama', async () => {
    const { execSync } = require('child_process');
    try {
      const out = execSync('ollama --version', { timeout: 3000 }).toString();
      return { installed: true, version: out.trim() };
    } catch {
      return { installed: false };
    }
  });

  safeHandle('check-disk-space', async () => {
    const ok = await ollamaManager.checkDiskSpace(6);
    return { ok, requiredGB: 6 };
  });

  // -- Substrate -------------------------------------------------------------

  // Route a query through the three-mode substrate router
  // Degraded mode (trial expired): allow substrate read, but block Ollama/cloud escalation
  safeHandle(
    'substrate-query',
    async (_event, { query, model }: { query: string; model?: string }) => {
      if (!substrateServer) return { hit: false, routing: 'miss', latency_ms: 0 };
      const degraded = authManager?.isDegraded() ?? false;
      try {
        const res = await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/substrate/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // In degraded mode, skip Ollama by omitting model and forcing Normal mode
          body: JSON.stringify({ query, model: degraded ? undefined : model, degraded }),
        });
        return await res.json();
      } catch {
        return { hit: false, routing: 'miss', latency_ms: 0 };
      }
    },
  );

  // Write a record to the local substrate index + queue federation sync
  // Blocked entirely in degraded mode
  safeHandle(
    'substrate-write',
    async (_event, { text, source, keywords }: { text: string; source?: string; keywords?: string[] }) => {
      if (authManager?.isDegraded()) {
        return { ok: false, reason: 'degraded_mode' };
      }
      try {
        const res = await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/substrate/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, source, keywords }),
        });
        return await res.json();
      } catch {
        return { ok: false };
      }
    },
  );

  // -- Federation ------------------------------------------------------------
  safeHandle('get-federation-status', () => {
    return federationClient?.getStatus() ?? {
      online: false,
      peerCount: 0,
      lastSyncTs: null,
      lastSyncRecordsExchanged: 0,
      pendingWriteCount: 0,
      peers: [],
    };
  });

  safeHandle('set-member-token', (_event, { token }: { token: string | null }) => {
    federationClient?.setMemberToken(token);
    return { ok: true };
  });

  // -- AMPLIFY Telemetry -----------------------------------------------------
  safeHandle('get-amplify-snapshot', async () => {
    return substrateServer?.getAMPLIFYSnapshot() ?? {
      total_queries: 0,
      substrate_hits: 0,
      local_ollama_served: 0,
      cloud_escalations: 0,
      total_cloud_cost_avoided_usd: 0,
    };
  });

  // Full historical summary (today / week / month / daily breakdown / all-time)
  safeHandle('get-amplify-summary', () => {
    return substrateServer?.getTelemetryStore().getSummary() ?? null;
  });

  // -- Auto-Update -----------------------------------------------------------
  safeHandle('get-update-state', () => autoUpdater?.getState() ?? { status: 'idle' });
  ipcMain.on('check-for-updates', () => autoUpdater?.checkNow());
  ipcMain.on('install-update', () => autoUpdater?.installNow());

  // M21: Automatic update scheduler IPC (Block 2-6)
  registerAutoUpdateIPC();

  ipcMain.on('watchdog-pong', () => {
    rendererResponsive = true;
  });

  // -- App Version (MV-VERSION-DISPLAY BP044) --------------------------------
  safeHandle('get-app-version', () => {
    const version = app.getVersion();
    let buildHash = process.env.BUILD_HASH ?? '';
    if (!buildHash) {
      try {
        const { execSync } = require('child_process');
        buildHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch {
        buildHash = 'dev';
      }
    }
    return { version, buildHash };
  });

  // -- MoneyPenny Mobile -----------------------------------------------------
  safeHandle('get-moneypenny-url', () => ({
    url: getMoneyPennyURL(API_PORT),
    ips: getLocalIPs(),
    port: API_PORT,
  }));

  // -- Dashboard -------------------------------------------------------------
  ipcMain.on('open-dashboard', () => openDashboard());

  // -- Hearth App Builder (B69) ----------------------------------------------

  // Route hearth_app_build_request from Substrate-DM (intent class: hearth_app_build_request)
  safeHandle(
    'hearth-build',
    async (_event, { request, memberId }: { request: string; memberId?: string }) => {
      const wins = [overlayWindow, dashboardWindow];
      return runHearthBuild({ request, memberId: memberId ?? 'member', windows: wins });
    },
  );

  safeHandle(
    'hearth-install',
    async (
      _event,
      opts: {
        uuid: string;
        appName: string;
        description: string;
        appDir: string;
        installerPath: string;
        spec: unknown;
      },
    ) => {
      return runHearthInstall(opts as Parameters<typeof runHearthInstall>[0]);
    },
  );

  safeHandle('hearth-library-query', (_event, { memberId }: { memberId?: string } = {}) => {
    return getHearthLibrary(memberId);
  });

  safeHandle('hearth-uninstall', async (_event, { uuid }: { uuid: string }) => {
    return uninstallApp(uuid);
  });

  safeHandle('hearth-healthz', async () => {
    return getHearthHealthz();
  });

  safeHandle('hearth-spec-extract-smoke', async () => {
    return runSpecExtractSmoke();
  });

  // -- Hearth Conjunction Window (B83) -----------------------------------------

  ipcMain.on('open-hearth-conjunction', () => openHearthConjunctionWindow());

  // BP041 SAGA 3 ? Watch View toggle
  // hideToWatchView: hides the conjunction window while keeping the overlay + substrate alive.
  // The FrameModeIndicator overlay remains visible (it's a separate transparent window).
  // Member restores by clicking the OverlayTag or pressing Ctrl+Shift+M (global shortcut below).
  safeHandle('hide-to-watch-view', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      hearthConjunctionWindow.hide();
    }
    return { ok: true };
  });

  safeHandle('show-hearth-conjunction', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      hearthConjunctionWindow.show();
      hearthConjunctionWindow.focus();
    } else {
      openHearthConjunctionWindow();
    }
    return { ok: true };
  });

  safeHandle('conjunction-get-state', () => conjunctionRouter.getState());

  safeHandle('conjunction-get-availability', () => conjunctionRouter.getAvailability());

  safeHandle(
    'conjunction-select',
    (_event, { mode }: { mode: import('./hearth/conjunction/types').ConjunctionMode }) =>
      conjunctionRouter.selectMode(mode),
  );

  safeHandle(
    'conjunction-set-override',
    (_event, { mode }: { mode: import('./hearth/conjunction/types').ConjunctionMode }) => {
      const state = conjunctionRouter.getState();
      void state; // state is available; update override via internal path
      conjunctionRouter.selectMode(mode); // temporary ? proper override wired below
      return { ok: true };
    },
  );

  safeHandle(
    'conjunction-dispatch',
    async (
      _event,
      { prompt, mode_override }: {
        prompt: string;
        mode_override?: import('./hearth/conjunction/types').ConjunctionMode;
      },
    ) => {
      const dispatchId = (await import('crypto')).randomUUID();
      recordWaveDispatch(dispatchId, 'hearth_conjunction');
      try {
        const result = await conjunctionRouter.dispatch(prompt, mode_override);
        recordWaveComplete(dispatchId);
        // Broadcast Drekaskip state update to conjunction window
        hearthConjunctionWindow?.webContents.send('drekaskip-state-updated');
        return result;
      } catch (err) {
        recordWaveComplete(dispatchId, String(err));
        throw err;
      }
    },
  );

  safeHandle('conjunction-get-substrate-context', async () => {
    return buildSubstrateContext();
  });

  // -- Drekaskip bridge (B83c) -----------------------------------------------

  safeHandle('drekaskip-query', async () => {
    return querySagaState();
  });

  // -- Watchdog bridge (B83d) ------------------------------------------------

  safeHandle('watchdog-status', async () => {
    return pollWatchdogStatus();
  });

  safeHandle(
    'watchdog-history',
    async (_event, { subject, window_hours }: { subject: string; window_hours?: number }) => {
      return getSubjectHistory(subject, window_hours);
    },
  );

  // -- Scribe Monitor ? BP041 SAGA 2 ----------------------------------------

  safeHandle(
    'scribe-toggle-monitor',
    (_event, { scribeId, on }: { scribeId: string; on: boolean }) => {
      return toggleMonitor(scribeId, on);
    },
  );

  safeHandle(
    'scribe-get-metrics',
    (_event, { scribeIds }: { scribeIds: string[] }) => {
      if (!scribeIds || scribeIds.length === 0) {
        // Return current enabled states as minimal summaries for initial hydration
        const states = getAllMonitorStates();
        return Object.entries(states).map(([scribe_id, monitor_enabled]) => ({
          scribe_id,
          monitor_enabled,
          monitored_since: null,
          event_count: 0,
          total_speed_delta_ms: 0,
          total_accuracy_delta: 0,
          total_cost_delta_tokens: 0,
          avg_speed_delta_ms: 0,
          avg_accuracy_delta: 0,
          avg_cost_delta_tokens: 0,
          last_updated: null,
        }));
      }
      return getMetrics(scribeIds);
    },
  );

  // -- In Conjunction Agent Panel ? SAGA 4 BP041 ----------------------------

  safeHandle(
    'agent-probe',
    async (_event, { agentId, force, modelId }: { agentId: string; force?: boolean; modelId?: string }) => {
      return agentProbeHandler(agentId, { force, modelId });
    },
  );

  safeHandle(
    'agent-set-api-key',
    (_event, { agentId, keyValue }: { agentId: string; keyValue: string }) => {
      // R16: key value must never be logged ? handler passes directly to setApiKey
      return agentSetApiKeyHandler(agentId, keyValue);
    },
  );

  safeHandle('agent-get-api-key-status', () => {
    return agentGetApiKeyStatusHandler();
  });

  safeHandle('agent-get-tier-choices', () => {
    return agentGetTierChoicesHandler();
  });

  safeHandle(
    'agent-set-tier-choice',
    (_event, { agentId, tierId }: { agentId: string; tierId: string }) => {
      return agentSetTierChoiceHandler(agentId, tierId);
    },
  );

  safeHandle('agent-get-plugins', () => {
    return agentGetPluginsHandler();
  });

  safeHandle('agent-get-plugin-registry', () => {
    return agentGetPluginRegistryHandler();
  });

  // Webview preload path ? renderer needs this to wire the <webview> preload attribute
  ipcMain.on('get-webview-preload-path', (event) => {
    event.returnValue = join(__dirname, 'hearth', 'embedded_browser', 'webview_preload.js');
  });

  // -- Adaptive Concurrency Carrier ? Layer 4 (hot-tune panel) -------------

  safeHandle('concurrency-get-cap', () => {
    return getCapInfo();
  });

  safeHandle('concurrency-probe-now', async () => {
    const entry = await probeConcurrencyCap();
    return { cap: entry.cap, probed_at: entry.probed_at, tier: entry.account_tier_hint };
  });

  safeHandle('concurrency-set-override', (_event, { n }: { n: number | null }) => {
    setCapOverride(n);
    return { ok: true, effective_cap: n };
  });

  // -- On-Deck Master-of-Ceremonies (BP037) ----------------------------------

  safeHandle('on-deck-list', () => {
    return listOnDeck();
  });

  // -- Pantheon ? Pixie Dust Mining (BP041 SAGA 1) ---------------------------

  safeHandle('pantheon-pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for Pixie Dust Mining',
      properties: ['openDirectory'],
      buttonLabel: 'Begin Mining',
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  safeHandle('pantheon-get-prefs', (_event, { memberId }: { memberId: string }) => {
    const { getFolderPrefs } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    return getFolderPrefs(memberId);
  });

  safeHandle('pantheon-set-pref', (_event, args: {
    memberId: string;
    folderPath: string;
    pixelated: boolean;
    federationShared: boolean;
    subfolderOverrides?: import('./pantheon/folder_prefs').SubfolderOverride[];
  }) => {
    const { setFolderPref } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    return setFolderPref(args.memberId, args.folderPath, args.pixelated, args.federationShared, args.subfolderOverrides);
  });

  safeHandle('pantheon-remove-pref', (_event, { memberId, folderPath }: { memberId: string; folderPath: string }) => {
    const { removeFolderPref } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    removeFolderPref(memberId, folderPath);
    return { ok: true };
  });

  safeHandle('pantheon-dispatch', async (_event, {
    memberId,
    folderPath,
    sharingScope,
  }: {
    memberId: string;
    folderPath: string;
    sharingScope: 'private' | 'federation';
  }) => {
    const { dispatchPantheon } = require('./pantheon/orchestrator') as typeof import('./pantheon/orchestrator');
    return dispatchPantheon(
      { member_id: memberId, folder_path: folderPath, sharing_scope: sharingScope, personas: ['shadow_sprite', 'forager', 'miner', 'pixies', 'shadow_spider', 'fates'], session: 'BP041' },
      (evt) => {
        hearthConjunctionWindow?.webContents.send('pantheon-progress', evt);
      },
    );
  });

  safeHandle('pantheon-list-tablets', (_event, { memberId, grade, persona }: {
    memberId: string;
    grade?: 'iron' | 'stone';
    persona?: string;
  }) => {
    const { listTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return listTablets(memberId, { grade, persona: persona as import('./pantheon/types').PersonaId | undefined });
  });

  safeHandle('pantheon-count-tablets', (_event, { memberId }: { memberId: string }) => {
    const { countTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return countTablets(memberId);
  });

  safeHandle('pantheon-wipe', (_event, { memberId }: { memberId: string }) => {
    const { wipeTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return wipeTablets(memberId);
  });

  safeHandle('pantheon-active-sessions', () => {
    const { getActiveSessions } = require('./pantheon/orchestrator') as typeof import('./pantheon/orchestrator');
    return getActiveSessions();
  });

  // -- Phoebe? Idea Storage IPC (C.17 ? BP055) -----------------------------
  const _phoebeIdeas: Array<{ id: string; title: string; content: string; timestamp: string }> = [];
  safeHandle('save-idea', async (_event, idea: { title: string; content: string; timestamp: string }) => {
    const id = `idea_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _phoebeIdeas.push({ id, ...idea });
    return { ok: true, id };
  });
  safeHandle('get-ideas', async () => {
    return { ok: true, ideas: [..._phoebeIdeas].reverse() };
  });

  // -- Pearl-decode IPC (Tier G ? v0.1.16 ? BP057 W5c) ---------------------
  safeHandle('decode-pearl', async (_event, pearlId: string) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const registryPath = path.join(
        'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\Asteroid-ProofVault\\pearl_registry',
        'PEARL_REGISTRY_INDEX.json'
      );
      if (!fs.existsSync(registryPath)) {
        return { ok: false, error: 'Pearl registry not found on substrate' };
      }
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      const pearl = (registry.pearls as Array<Record<string, string>>).find(
        (p) => p.pearl_id === pearlId || p.canonical_ref === pearlId
      );
      if (!pearl) {
        return { ok: false, error: `Pearl not found: ${pearlId}` };
      }
      const canonDir = 'C:\\Users\\Administrator\\.claude\\state\\eblets\\CANON';
      const candidates = [
        path.join(canonDir, `${pearl.canonical_ref}.eblet.md`),
        path.join(canonDir, `canon_${pearl.canonical_ref}.eblet.md`),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, 'utf-8');
          return { ok: true, pearl, content };
        }
      }
      return {
        ok: true,
        pearl,
        content: `# ${pearl.canonical_ref}\n\n**Pearl ID:** ${pearl.pearl_id}\n**Class:** ${pearl.class}\n**Caithedral:** ${pearl.cathedral}\n**Wave:** ${pearl.wave}\n\n*Eblet source not found on local substrate ? canonical_ref: ${pearl.canonical_ref}*`,
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // -- Caithedral Tools IPC (BP060 Application 002 Step 1) -----------------
  registerCaithedralToolsIPC();

  // -- BP084 SEG-3: Substrate Awakens join-live-mesh flow -------------------
  registerSubstrateAwakensIPC();

  // -- Bridge IPC (BP060 Application 002 Steps 3+4 ? UI-7 live Yoke wire) --
  registerBridgeIPC();

  // -- Battery Dispatch v0.3.0 publish fan-out (BP082) ----------------------
  registerDispatchIPC();

  // -- AI Dispatch IPC (BP060 Application 002 Steps 3+4 ? UI-8 backend) ----
  registerAiDispatchIPC();

  // -- BP087 Wave 5: Alexandrian Catacombs IPC ----------------------------------
  void (async () => {
    const {
      bootstrapCatacombs,
      getManifest,
      listEblets,
    } = await import('./catacombs/folder_bootstrap');
    const { fetchCategoryPackage, prefetchAll } = await import('./catacombs/eblet_package_fetcher');
    const { contributeToCategory } = await import('./catacombs/contribute_to_category');
    const { checkAccess } = await import('./catacombs/license_gate');

    // Bootstrap on registration (idempotent -- sentinel prevents re-run)
    bootstrapCatacombs().catch((err) => console.warn('[Catacombs] Bootstrap non-fatal:', err));

    safeHandle('catacombs:bootstrap', async () => bootstrapCatacombs());
    safeHandle('catacombs:fetch-package', async (_e: unknown, slug: string) => fetchCategoryPackage(slug));
    safeHandle('catacombs:prefetch-all', async () => prefetchAll());
    safeHandle('catacombs:get-manifest', async (_e: unknown, slug: string) => getManifest(slug));
    safeHandle('catacombs:list-eblets', async (_e: unknown, slug: string) => listEblets(slug));
    safeHandle('catacombs:contribute', async (_e: unknown, slug: string, content: string, memberId: string) =>
      contributeToCategory(slug, content, memberId)
    );
    safeHandle('catacombs:check-access', async (_e: unknown, memberId: string, operation: string) =>
      checkAccess(memberId, operation as 'read' | 'contribute')
    );
    safeHandle('catacombs:search', async (_e: unknown, params: { slug: string; query: string }) =>
      listEblets(params.slug)
    );
  })();

  // -- BP094 v0.8.0: CSIA-Hybrid Inference Pipeline IPC --------------------
  void (async () => {
    const { runCSIAHybridPipeline } = await import('./csia_hybrid/inference_pipeline');
    safeHandle('csia:query', async (_e: unknown, question: string) => {
      try {
        return await runCSIAHybridPipeline(question);
      } catch (err) {
        console.error('[CSIA] IPC handler error:', err);
        return { verdict: 'REFUSAL', refusal_reason: String(err), provenance: [], system_prompt_used: '', model_used: 'unknown', star_chamber: 'SKIP', scrambler: 'SKIP', keys_engines: 'SKIP', green_count: 0, run_id: 'error', elapsed_ms: 0, evidence_count: 0 };
      }
    });
  })();

  // -- BP087 Wave 3 SEG-C1: Thunderclap trial fire IPC ----------------------
  registerThunderclapFireIPC();

  // -- BP087 Wave 3 SEG-E1: Gemma multi-seg dispatch IPC --------------------
  registerGemmaMultiSegIPC();

  // -- BP083 SEG-5: MEMORY.md IPC handlers (My Self-Context panel) ----------
  registerMemoryScaffoldIPC();

  // -- v0.4.0 BP083: MIC Dispatcher + The Diagnosis IPC handlers ------------
  registerMicIpc();
  registerDiagnosisIpc();

  // -- app:request-quit (renderer-invokable graceful quit) --------------------
  ipcMain.handle('app:request-quit', () => { app.quit(); });

  // -- Kitchen Table? + Atlas? + P2P (BP052 v0.1.8) ------------------------
  registerKitchenTableIpc(ipcMain);

  // -- LB Account + Frontier Node IPC (BP065 Part A/B ? SEG-C2a/B2b) ---------

  safeHandle('lb:start-auth', async (_event, { email }: { email: string }) => {
    return startLBAuthFlow(email);
  });

  safeHandle('lb:get-session', async () => {
    const session = getLBSession();
    if (!session) return { linked: false };
    return {
      linked: true,
      user_id: session.user_id,
      email: session.email,
      peer_id: session.peer_id,
      linked_at: session.linked_at,
      crewman_number: session.crewman_number,
    };
  });

  safeHandle('lb:link-device', async (_event, { access_token, refresh_token, email }: { access_token: string; refresh_token: string; email: string }) => {
    const result = await completeLBAuth(access_token, refresh_token, email);
    if (result.ok && result.session) {
      // Broadcast lb:auth-complete to all windows
      const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
      for (const win of wins) {
        if (win && !win.isDestroyed()) {
          win.webContents.send('lb:auth-complete', {
            user_id: result.session.user_id,
            email: result.session.email,
            peer_id: result.session.peer_id,
            crewman_number: result.session.crewman_number,
          });
        }
      }
    }
    return { ok: result.ok, error: result.error };
  });

  safeHandle('lb:revoke-device', async () => {
    return lbRevokeDevice();
  });

  // Frontier node: heartbeat timer state
  let frontierHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const FRONTIER_HEARTBEAT_MS = 5 * 60 * 1000; // 5 minutes

  function startFrontierHeartbeat(accessToken: string, peerId: string): void {
    stopFrontierHeartbeat();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !anonKey) return;
    const hbUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/frontier-node-heartbeat`;
    frontierHeartbeatTimer = setInterval(async () => {
      try {
        await fetch(hbUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: anonKey },
          body: JSON.stringify({ peer_id: peerId }),
        });
      } catch {
        // Heartbeat errors are non-fatal ? logged silently
      }
    }, FRONTIER_HEARTBEAT_MS);
  }

  function stopFrontierHeartbeat(): void {
    if (frontierHeartbeatTimer !== null) {
      clearInterval(frontierHeartbeatTimer);
      frontierHeartbeatTimer = null;
    }
  }

  // Frontier node status stored in-memory (supplement with safeStorage if needed in future)
  let _frontierNodeId: string | null = null;

  safeHandle('lb:register-frontier-node', async () => {
    const session = getLBSession();
    if (!session) return { ok: false, error: 'LB Account not linked. Link first.' };
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Platform config not available.' };
    try {
      const { getStablePeerId } = await import('./federation/peer-discovery');
      const peerId = await getStablePeerId();
      const regUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/frontier-node-register`;
      const resp = await fetch(regUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
        body: JSON.stringify({ peer_id: peerId, app_version: app.getVersion(), node_label: `MnemosyneC ${app.getVersion()}` }),
      });
      const data = await resp.json() as { registered?: boolean; frontier_node_id?: string; error?: string };
      if (!resp.ok) return { ok: false, error: data.error ?? `Register failed (${resp.status})` };
      _frontierNodeId = data.frontier_node_id ?? null;
      startFrontierHeartbeat(session.access_token, peerId);
      return { ok: true, frontier_node_id: data.frontier_node_id };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  safeHandle('lb:withdraw-frontier-node', async () => {
    stopFrontierHeartbeat();
    const session = getLBSession();
    if (!session) { _frontierNodeId = null; return { ok: true }; }
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !anonKey) { _frontierNodeId = null; return { ok: true }; }
    try {
      const { getStablePeerId } = await import('./federation/peer-discovery');
      const peerId = await getStablePeerId();
      const withdrawUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/frontier-node-register`;
      await fetch(withdrawUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
        body: JSON.stringify({ peer_id: peerId }),
      });
    } catch {
      // Non-fatal
    }
    _frontierNodeId = null;
    return { ok: true };
  });

  safeHandle('lb:get-frontier-status', async () => {
    return {
      registered: _frontierNodeId !== null,
      frontier_node_id: _frontierNodeId ?? undefined,
    };
  });

  // -- Frontier Borrow (WAVE-24) ----------------------------------------------
  // "Your computer is busy -- borrow a trusted node."
  // Opt-in only. Returns a borrow ticket with cost disclosure.
  const _borrowOptIn = { enabled: false, trustList: [] as string[] };

  safeHandle('lb:get-borrow-status', () => ({
    borrow_opt_in: _borrowOptIn.enabled,
    trust_list: _borrowOptIn.trustList,
  }));

  safeHandle('lb:set-borrow-opt-in', (_event, { enabled }: { enabled: boolean }) => {
    _borrowOptIn.enabled = enabled;
    return { ok: true };
  });

  safeHandle('lb:request-frontier-borrow', async () => {
    if (!_borrowOptIn.enabled) {
      return { ok: false, error: 'Borrow opt-in not enabled. Toggle it on first.' };
    }
    // Session check -- must be linked
    const session = getLBSession();
    if (!session) {
      return { ok: false, error: 'Link your LB account first to access Frontier nodes.' };
    }
    // Cost disclosure: always $0 transport, ~$0.01 compute
    return {
      ok: true,
      cost_transport_usd: 0,
      cost_compute_usd_approx: 0.01,
      node_count: _borrowOptIn.trustList.length,
      disclosure: 'Borrow is opt-in only. Cost: $0 transport, ~$0.01 compute per inference on a trusted Frontier node.',
    };
  });

  // Opt-In Strike Tracker IPC stubs (renderer primarily uses localStorage; IPC for cross-window sync)
  const _optInStore = { strikes: 0, lastShown: null as number | null, decision: 'pending' as string };

  safeHandle('lb:opt-in-get-state', () => ({ ..._optInStore }));

  safeHandle('lb:opt-in-record-strike', () => {
    _optInStore.strikes = Math.min(_optInStore.strikes + 1, 3);
    _optInStore.lastShown = Date.now();
    return { ok: true };
  });

  safeHandle('lb:opt-in-set-decision', (_event, { decision }: { decision: string }) => {
    _optInStore.decision = decision;
    return { ok: true };
  });

  // -- SubstratedFolderWatcher? (SAGA-? v0.1.10) ----------------------------
  if (folderWatcher) registerWatcherIpc(folderWatcher);

  safeHandle('watcher:open-folder-dialog', async () => {
    return dialog.showOpenDialog({ properties: ['openDirectory'] });
  });

  // -- DAG Bridge status (BP067 Correction 2) --------------------------------
  safeHandle('dag:emit-status', () => {
    return { emitted: getDagEmitCount() };
  });

  // -- Trail Eblet Reader (KniPr035) -----------------------------------------
  safeHandle('trail-eblet:list', async () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const os = require('os') as typeof import('os');
    const trailsDir = path.join(os.homedir(), '.claude', 'state', 'eblets', 'TRAILS');
    if (!fs.existsSync(trailsDir)) return { files: [], dir: trailsDir };
    const files = fs.readdirSync(trailsDir)
      .filter((f: string) => f.endsWith('.eblet.md'))
      .sort((a: string, b: string) => a.localeCompare(b));
    return { files, dir: trailsDir };
  });

  safeHandle('trail-eblet:read', async (_event, { filePath }: { filePath: string }) => {
    const fs = require('fs') as typeof import('fs');
    if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found' };
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { ok: true, content };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  safeHandle('trail-eblet:list-screenshots', async (_event, { ebletPath }: { ebletPath: string }) => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const screenshotsDir = path.join(path.dirname(ebletPath), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) return { files: [], dir: screenshotsDir };
    const files = fs.readdirSync(screenshotsDir)
      .filter((f: string) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
    return { files, dir: screenshotsDir };
  });

  safeHandle('trail-eblet:read-screenshot', async (_event, { filePath }: { filePath: string }) => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    if (!fs.existsSync(filePath)) return { ok: false };
    try {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : 'image/gif';
      return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // -- MV-CN Peer Mesh (SAGA 3 BP045 W1) -------------------------------------
  safeHandle('get-mesh-state', () => ({
    peers: peerDiscovery?.getAllPeers() ?? [],
    relayConnected: relayClient?.isConnected() ?? false,
    ownPeerId: peerDiscovery ? (() => { const { getStablePeerId: gsp } = require('./federation/peer-discovery'); return gsp(); })() : '',
  }));

  safeHandle('get-own-peer-id', () => getStablePeerId());

  safeHandle('get-boot-zombie-count', () => ({ count: _bootZombieCount }));

  safeHandle('call-test-my-box', async (_ev, peerIdArg?: string) => {
    const peerId = peerIdArg || getStablePeerId();
    const supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://ruuxzilgmuwddcofqecc.supabase.co'
    ).replace(/\/$/, '');
    const anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      '';
    if (!anonKey) {
      return { ok: false, error: 'Supabase key not configured' };
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/test-my-box`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ peer_id: peerId }),
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // BP086 F4b: relay tier returned by wan-relay-publish
  safeHandle('get-relay-tier', () => ({ tier: getCurrentTier() }));

  // BP104 D5a: machine label read/write (%APPDATA%\\MnemosyneC\\config\\peer_label.txt)
  safeHandle('get-machine-label', async () => {
    const { getMachineLabel } = await import('./identity/peerIdentityCollector');
    return getMachineLabel(getStablePeerId());
  });
  safeHandle('set-machine-label', async (_event, label: string) => {
    const { setMachineLabel } = await import('./identity/peerIdentityCollector');
    return setMachineLabel(label);
  });

  // -- BP072 ? Paired-Frame Mutual-Aid IPC ----------------------------------

  safeHandle('paired-frame:get-status', () => {
    return pairedFrameManager?.getStatus() ?? {
      paired: false,
      pairedPeerId: null,
      pairedAt: null,
      assistModeActive: false,
      assistModeEnabled: false,
      missedHeartbeats: 0,
      lastPartnerContactAt: null,
    };
  });

  safeHandle('paired-frame:request-pairing', (_ev, { peerId, displayName }: { peerId: string; displayName?: string }) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.requestPairing(peerId, displayName);
    return { ok: true };
  });

  safeHandle('paired-frame:accept-pairing', (_ev, { peerId, displayName }: { peerId: string; displayName?: string }) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.acceptPairing(peerId, displayName);
    return { ok: true };
  });

  safeHandle('paired-frame:reject-pairing', (_ev, { peerId, reason }: { peerId: string; reason?: string }) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.rejectPairing(peerId, reason);
    return { ok: true };
  });

  safeHandle('paired-frame:unpair', (_ev, { reason }: { reason?: string } = {}) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.unpair(reason);
    return { ok: true };
  });

  // -- MESH-6: SID-targeted peer fetch ----------------------------------------
  safeHandle(
    'federation:fetch-sid',
    async (
      _ev,
      dag_id: string,
      peerId: string,
    ): Promise<{ ok: boolean; node?: DagNode; hash_verified: boolean; error?: string }> => {
      const peer = peerDiscovery?.getAllPeers().find((p) => p.peerId === peerId);
      if (!peer) {
        return { ok: false, hash_verified: false, error: `peer ${peerId} not in mesh` };
      }
      const reqMsg: FedMsg = {
        type: 'sid_fetch_request',
        peerId: getStablePeerId(),
        payload: {
          dag_id,
          requester_peer_id: getStablePeerId(),
        } satisfies SidFetchRequestPayload,
        ts: new Date().toISOString(),
      };
      if (peer.transport === 'lan') {
        return await _fetchSidViaTCP(peer, dag_id, reqMsg);
      } else {
        return await _fetchSidViaRelay(peerId, dag_id, reqMsg);
      }
    },
  );

  // -- MESH-6: Federation invite/accept/leave ----------------------------------
  // §2 Truth-Always (SEG-V0153A): SUPABASE_URL + SUPABASE_ANON_KEY are available
  // in the main process via process.env (pattern confirmed at lines ~2411–2413).
  // No dedicated Supabase client — all Supabase calls use fetch() directly.
  // sender_peer_id is getStablePeerId() (local machine ID), NOT a Supabase user_id.
  safeHandle(
    'federation:generate-invite',
    async (): Promise<
      | { ok: true; token: string; expiresAt: string }
      | { ok: false; error: 'cooldown'; wait_seconds: number }
    > => {
      const peerId = getStablePeerId();
      const supabaseUrl =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const anonKey =
        process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      // Cooldown gate — skip silently if Supabase not configured
      if (supabaseUrl && anonKey) {
        try {
          const cooldownResp = await globalThis.fetch(
            `${supabaseUrl.replace(/\/$/, '')}/rest/v1/member_rejection_summary` +
              `?sender_peer_id=eq.${encodeURIComponent(peerId)}&select=total_rejections,last_rejection_at`,
            {
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey,
                'Accept': 'application/json',
              },
            },
          );
          if (cooldownResp.ok) {
            const rows: Array<{
              total_rejections: number | null;
              last_rejection_at: string | null;
            }> = await cooldownResp.json();
            const row = rows[0];
            if (row?.last_rejection_at) {
              const totalRejections = row.total_rejections ?? 0;
              const lastRejectionMs = new Date(row.last_rejection_at).getTime();
              // Option 2 (Founder-ratified): -1 effective strike per 30 clean days
              const daysSinceLast = (Date.now() - lastRejectionMs) / 86_400_000;
              const effectiveRejections = Math.max(
                0,
                totalRejections - Math.floor(daysSinceLast / 30),
              );
              if (effectiveRejections > 0) {
                const cooldownUntilMs =
                  lastRejectionMs + effectiveRejections * 5 * 60 * 1000;
                const waitMs = cooldownUntilMs - Date.now();
                if (waitMs > 0) {
                  return {
                    ok: false,
                    error: 'cooldown',
                    wait_seconds: Math.ceil(waitMs / 1000),
                  };
                }
              }
            }
          }
        } catch {
          // Network error — fail open (proceed with token mint)
        }
      }

      const { randomBytes } = require('crypto') as typeof import('crypto');
      const nonce = randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
      const raw = `${peerId}:${nonce}:${expiresAt}`;
      const token = `mnemo-invite-${Buffer.from(raw).toString('base64url')}`;
      return { ok: true, token, expiresAt };
    },
  );

  safeHandle(
    'federation:reject-invite',
    async (
      _ev,
      { invite_token, source }: { invite_token: string; source: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      const supabaseUrl =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const anonKey =
        process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!supabaseUrl || !anonKey) {
        return { ok: false, error: 'no_supabase_config' };
      }
      try {
        const resp = await globalThis.fetch(
          `${supabaseUrl.replace(/\/$/, '')}/functions/v1/wan-relay-reject`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ invite_token, source }),
          },
        );
        return { ok: resp.ok };
      } catch {
        return { ok: false, error: 'network_error' };
      }
    },
  );

  safeHandle(
    'federation:accept-invite',
    async (_ev, token: string): Promise<{ success: boolean; peerName?: string; error?: string }> => {
      try {
        if (!token || !token.startsWith('mnemo-invite-')) {
          return { success: false, error: 'invalid token format' };
        }
        const raw = Buffer.from(token.replace('mnemo-invite-', ''), 'base64url').toString();
        const [peerId, , expiresAtStr] = raw.split(':');
        if (!peerId || !expiresAtStr) {
          return { success: false, error: 'malformed token' };
        }
        if (Date.now() > new Date(expiresAtStr).getTime()) {
          return { success: false, error: 'token expired' };
        }
        if (peerDiscovery) {
          peerDiscovery.registerWANPeer({
            peerId,
            address: 'relay',
            port: 0,
            transport: 'wan-relay',
            phase: 'identified',
            lastSeen: new Date().toISOString(),
          });
        }
        if (relayClient?.isConnected()) {
          relayClient.sendToPeer(peerId, {
            type: 'identify',
            peerId: getStablePeerId(),
            payload: {
              peerId: getStablePeerId(),
              version: app.getVersion(),
              pubkeyFingerprint: getStablePeerId(),
            },
            ts: new Date().toISOString(),
          });
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  );

  safeHandle('federation:leave-peer', (_ev, peerId: string): { ok: boolean } => {
    if (peerDiscovery) {
      peerDiscovery.removeWANPeer(peerId);
      peerDiscovery.removeLANPeer(peerId);
    }
    return { ok: true };
  });

  // SEG-5 v0.1.56 — federation:connect-peer
  // Accepts { peerId, relayUrl? } and attempts peer connection via the existing relay-client.
  // Falls back gracefully when relay is not yet connected.
  safeHandle(
    'federation:connect-peer',
    async (
      _ev,
      { peerId, relayUrl }: { peerId: string; relayUrl?: string },
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!peerId) return { success: false, error: 'peerId is required' };
        if (peerDiscovery) {
          peerDiscovery.registerWANPeer({
            peerId,
            address: relayUrl ?? 'relay',
            port: 0,
            transport: 'wan-relay',
            phase: 'identified',
            lastSeen: new Date().toISOString(),
          });
        }
        if (relayClient?.isConnected()) {
          relayClient.sendToPeer(peerId, {
            type: 'identify',
            peerId: getStablePeerId(),
            payload: {
              peerId: getStablePeerId(),
              version: app.getVersion(),
              pubkeyFingerprint: getStablePeerId(),
            },
            ts: new Date().toISOString(),
          });
          return { success: true };
        }
        return { success: false, error: 'relay_not_connected' };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  );

  // SEG-5 v0.1.56 — send-silent-email stub
  // Infrastructure-only. Real email credentials are not wired here.
  // Prevents UI crashes while the feature is pending activation.
  safeHandle(
    'send-silent-email',
    (_ev, _args: unknown): { success: boolean; reason: string } => {
      console.log('[silent-email] not yet configured — call received, no-op');
      return { success: false, reason: 'not_configured' };
    },
  );

  // SEG-3 v0.1.55 — COMMUNITY-CONNECT first-launch seed peer handshake
  safeHandle(
    'community-connect-handshake',
    async (): Promise<{ success: boolean; peerName?: string; error?: string }> => {
      try {
        return await performCommunityConnectHandshake({
          ownPeerId: getStablePeerId(),
          appVersion: app.getVersion(),
          registerWANPeer: (peer) => {
            peerDiscovery?.registerWANPeer(peer);
          },
          sendIdentify: (toPeerId) => {
            if (relayClient?.isConnected()) {
              relayClient.sendToPeer(toPeerId, {
                type: 'identify',
                peerId: getStablePeerId(),
                payload: {
                  peerId: getStablePeerId(),
                  version: app.getVersion(),
                  pubkeyFingerprint: getStablePeerId(),
                },
                ts: new Date().toISOString(),
              });
            }
          },
        });
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  );

  // -- Chronos Research Consent (KniPr038) ----------------------------------

  safeHandle('write-chronos-consent', async (_event, consentPayload: object) => {
    const fsp = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    const crypto = require('crypto') as typeof import('crypto');
    const consentDir = fsp.join(app.getPath('home'), '.amplify', 'consent');
    fs.mkdirSync(consentDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chronos_consent_${timestamp}.eblet.json`;
    const filePath = fsp.join(consentDir, filename);
    const body = JSON.stringify({
      type: 'chronos_consent_eblet',
      version: '1.0.0',
      action: 'grant',
      timestamp: new Date().toISOString(),
      consent: consentPayload,
      kAnonymityMin: 10,
      revocationAvailable: true,
      researchConsentVersion: '1.0.0',
      canonRef: 'canon_chronos_research_aggregation_opt_in_member_mark_dividend_bp054',
    });
    const signed_hash = crypto.createHash('sha256').update(body).digest('hex');
    fs.writeFileSync(filePath, JSON.stringify({ ...JSON.parse(body), signed_hash }, null, 2));
    return { ok: true, ebletPath: filePath };
  });

  safeHandle('revoke-chronos-consent', async (_event, _payload?: object) => {
    const fsp = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    const crypto = require('crypto') as typeof import('crypto');
    const consentDir = fsp.join(app.getPath('home'), '.amplify', 'consent');
    fs.mkdirSync(consentDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chronos_revocation_${timestamp}.eblet.json`;
    const filePath = fsp.join(consentDir, filename);
    const body = JSON.stringify({
      type: 'chronos_consent_eblet',
      version: '1.0.0',
      action: 'revoke',
      timestamp: new Date().toISOString(),
      canonRef: 'canon_chronos_research_aggregation_opt_in_member_mark_dividend_bp054',
    });
    const signed_hash = crypto.createHash('sha256').update(body).digest('hex');
    fs.writeFileSync(filePath, JSON.stringify({ ...JSON.parse(body), signed_hash }, null, 2));
    return { ok: true, ebletPath: filePath };
  });

  // BP067 Phase 1A ? $5 membership checkout IPC
  // Calls Supabase edge function create-membership-checkout ? returns Stripe Checkout URL
  // Renderer then calls shell.openExternal with the returned URL (never exposed here)
  safeHandle('membership:create-checkout', async (_event, autoRenew: boolean) => {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[membership] Supabase URL/key not configured ? falling back to web join page');
      return { ok: false, error: 'not_configured', fallbackUrl: 'https://lianabanyan.com/join' };
    }

    try {
      const resp = await globalThis.fetch(`${supabaseUrl}/functions/v1/create-membership-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ autoRenew }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[membership] create-checkout failed:', resp.status, errText.slice(0, 200));
        return { ok: false, error: `checkout_error_${resp.status}` };
      }

      const json = await resp.json() as { url?: string; error?: string };
      if (!json.url) {
        return { ok: false, error: json.error ?? 'no_url_returned' };
      }

      shell.openExternal(json.url).catch(() => {});
      return { ok: true };
    } catch (err) {
      console.error('[membership] create-checkout exception:', err);
      return { ok: false, error: String(err) };
    }
  });

  // -- membership.verifyStatus (BP078 Scope 2) ----------------------------------
  safeHandle('membership-verify-status', async () => {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { ok: false, membership_active: false, error: 'not_configured' };
    }

    try {
      const resp = await globalThis.fetch(`${supabaseUrl}/functions/v1/verify-membership-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[membership] verify-status failed:', resp.status, errText.slice(0, 200));
        return { ok: false, membership_active: false, error: `verify_error_${resp.status}` };
      }

      const json = await resp.json() as { is_member?: boolean; error?: string };
      return { ok: true, membership_active: json.is_member === true };
    } catch (err) {
      console.error('[membership] verify-status exception:', err);
      return { ok: false, membership_active: false, error: String(err) };
    }
  });

  // -- runMeshTest (BP078 Scope 1; extended SEG-T-4 for COLD-vs-HOT multi-node) -------
  safeHandle('run-mesh-test', async (_event, payload?: {
    testId?: string;
    timeoutMs?: number;
    dataset?: 'standard' | 'diamond';
    nodes?: string[];
  }) => {
    // SEG-T-4 branch: if nodes param present, run COLD-vs-HOT MMLU-Pro mesh test
    if (payload && Array.isArray((payload as { nodes?: string[] }).nodes)) {
      const { dataset = 'standard', nodes } = payload as { dataset?: 'standard' | 'diamond'; nodes: string[] };

      // Determine local node identifier (M1 = localhost/127.0.0.1)
      const localNode = 'M1';
      const shardDir = join(homedir(), '.mnemosynec', 'test-data', 'mmlu-pro', 'shards');
      const shardPath = join(shardDir, `shard_${localNode}.json`);
      const resultsDir = join(homedir(), '.mnemosynec', 'test-data', 'mmlu-pro', 'results');

      if (!existsSync(shardPath)) {
        return {
          success: false,
          error: 'SHARD_NOT_FOUND',
          detail: `Run scripts/mesh_shard.py first. Expected: ${shardPath}`,
        };
      }

      let shard: { node: string; ip: string; questions: Array<Record<string, unknown>> };
      try {
        shard = JSON.parse(readFileSync(shardPath, 'utf8')) as typeof shard;
      } catch (e) {
        return { success: false, error: 'SHARD_PARSE_ERROR', detail: String(e) };
      }

      const questions = shard.questions ?? [];
      const total = questions.length;
      const results: Array<{
        question_id: string;
        gold_answer: string;
        cold_response: string;
        hot_response: string;
        cold_correct: boolean;
        hot_correct: boolean;
        latency_cold_ms: number;
        latency_hot_ms: number;
      }> = [];

      const ollamaBase = 'http://localhost:11434';
      const model = dataset === 'diamond' ? 'gemma4:12b' : 'gemma4:12b';

      /** Build prompt string from a question record. */
      function buildPrompt(q: Record<string, unknown>): string {
        const text = String(q.question ?? '');
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        if (options.length === 0) return text;
        const lines = options.map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`).join('\n');
        return `${text}\n\nOptions:\n${lines}\n\nAnswer with the letter only.`;
      }

      /** Check if response matches gold answer letter. */
      function isCorrect(response: string, gold: string): boolean {
        if (!gold || !response) return false;
        const g = gold.trim().toUpperCase();
        const r = response.trim().toUpperCase();
        if (r.startsWith(g)) return true;
        if (r.includes(`ANSWER: ${g}`) || r.includes(`(${g})`)) return true;
        return false;
      }

      /** POST to Ollama /api/generate. Returns [responseText, latencyMs]. */
      async function ollamaGenerate(prompt: string): Promise<[string, number]> {
        const t0 = Date.now();
        try {
          const resp = await fetch(`${ollamaBase}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, stream: false }),
          });
          const data = await resp.json() as { response?: string };
          return [data.response ?? '', Date.now() - t0];
        } catch (e) {
          return [`ERROR:${String(e)}`, Date.now() - t0];
        }
      }

      /** Query local substrate for HOT context. Returns context string or empty. */
      async function substrateQuery(query: string): Promise<string> {
        try {
          const resp = await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/substrate/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          });
          const data = await resp.json() as { hit?: boolean; answer?: string; text?: string };
          if (data.hit) return data.answer ?? data.text ?? '';
          return '';
        } catch {
          // TODO: substrate unreachable -- HOT context falls back to empty string
          return '';
        }
      }

      /** Emit progress heartbeat via /dag/emit. Non-fatal. */
      async function emitProgress(done: number): Promise<void> {
        try {
          await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/dag/emit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pearls: [`mesh_test:${localNode}:progress:${done}/${total}`],
              bindings: { event_type: 'mesh_test_progress', node: localNode, dataset },
            }),
          });
        } catch { /* non-fatal */ }
      }

      let lastEmitTime = Date.now();

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const questionId = String(q.question_id ?? idx);
        const gold = String(q.answer ?? '').trim().toUpperCase();
        const promptBase = buildPrompt(q);

        // COLD: no substrate context
        const [coldResp, latencyCold] = await ollamaGenerate(promptBase);
        const coldCorrect = isCorrect(coldResp, gold);

        // HOT: prepend substrate context if available
        const ctx = await substrateQuery(promptBase);
        const hotPrompt = ctx ? `Context from substrate:\n${ctx}\n\n${promptBase}` : promptBase;
        const [hotResp, latencyHot] = await ollamaGenerate(hotPrompt);
        const hotCorrect = isCorrect(hotResp, gold);

        results.push({
          question_id: questionId,
          gold_answer: gold,
          cold_response: coldResp,
          hot_response: hotResp,
          cold_correct: coldCorrect,
          hot_correct: hotCorrect,
          latency_cold_ms: latencyCold,
          latency_hot_ms: latencyHot,
        });

        const done = idx + 1;
        const now = Date.now();
        if (done % 100 === 0 || (now - lastEmitTime) >= 60_000) {
          await emitProgress(done);
          lastEmitTime = now;
        }
      }

      // Write results JSON
      try { mkdirSync(resultsDir, { recursive: true }); } catch { /* ignore */ }
      const resultsPath = join(resultsDir, `shard_${localNode}_results.json`);
      const coldCount = results.filter((r) => r.cold_correct).length;
      const hotCount = results.filter((r) => r.hot_correct).length;
      const summary = {
        node: localNode,
        dataset,
        nodes,
        total_questions: total,
        cold_correct: coldCount,
        hot_correct: hotCount,
        cold_accuracy: total > 0 ? coldCount / total : 0,
        hot_accuracy: total > 0 ? hotCount / total : 0,
        delta_accuracy: total > 0 ? (hotCount - coldCount) / total : 0,
      };
      writeFileSync(resultsPath, JSON.stringify({ summary, results }, null, 2), 'utf8');

      // Final progress emit
      await emitProgress(total);

      return { success: true, summary, results_path: resultsPath };
    }

    // -- Legacy single-machine path (BP078 Scope 1 original) ------------------
    const timeoutMs = payload?.timeoutMs ?? 45000;

    // MISSING_API_KEY guard -- read from env (env_loader populates on startup)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'MISSING_API_KEY', static_fallback: true };
    }

    // Resolve script path relative to project root (sandbox mode: dev/internal only)
    const scriptPath = join(__dirname, '..', '..', 'librarian-mcp', 'r10_cross_vendor', 'run_mesh_test.py');
    if (!existsSync(scriptPath)) {
      console.warn('[run-mesh-test] script not found at', scriptPath);
      return { success: false, error: 'PYTHON_ERROR', static_fallback: true };
    }

    // Unique temp output dir per invocation
    const outDir = join(tmpdir(), `mnemo_mesh_test_${Date.now()}`);
    try { mkdirSync(outDir, { recursive: true }); } catch { /* ignore */ }

    return new Promise((resolve) => {
      let settled = false;
      let timedOut = false;
      const stdout: string[] = [];
      const stderr: string[] = [];

      const proc = spawn('python', [scriptPath, '--condition', 'alone', '--bank', 'A', '--step', '1', '--out', outDir], {
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
        cwd: join(__dirname, '..', '..', 'librarian-mcp', 'r10_cross_vendor'),
      });

      const timer = setTimeout(() => {
        if (!settled) {
          timedOut = true;
          settled = true;
          try { proc.kill('SIGKILL'); } catch { /* ignore */ }
          resolve({ success: false, error: 'TIMEOUT', static_fallback: true });
        }
      }, timeoutMs);

      proc.stdout.on('data', (d: Buffer) => stdout.push(d.toString()));
      proc.stderr.on('data', (d: Buffer) => stderr.push(d.toString()));

      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (err.code === 'ENOENT') {
            resolve({ success: false, error: 'MISSING_PYTHON_RUNTIME', static_fallback: true });
          } else {
            console.error('[run-mesh-test] spawn error:', err);
            resolve({ success: false, error: 'PYTHON_ERROR', static_fallback: true });
          }
        }
      });

      proc.on('close', (code: number | null) => {
        if (settled || timedOut) return;
        settled = true;
        clearTimeout(timer);

        const combinedOut = stdout.join('');
        if (combinedOut.includes('no peer found') || combinedOut.includes('NO_PEER')) {
          resolve({ success: false, error: 'NO_PEER', static_fallback: true });
          return;
        }

        if (code !== 0) {
          console.error('[run-mesh-test] python exited with code', code, stderr.join('').slice(0, 400));
          resolve({ success: false, error: 'PYTHON_ERROR', static_fallback: true });
          return;
        }

        // Parse summary.json written by the script
        const summaryPath = join(outDir, 'summary.json');
        try {
          const raw = readFileSync(summaryPath, 'utf8');
          const summary = JSON.parse(raw) as {
            accuracy_pct?: number;
            fetch_latency_p50_ms?: number;
            fetch_latency_p95_ms?: number;
            total_questions?: number;
            mesh_fetch_count?: number;
            hash_verify_pass_rate?: number;
          };
          const hashVerifiedCount = Math.round(
            (summary.hash_verify_pass_rate ?? 0) * (summary.mesh_fetch_count ?? 0),
          );
          resolve({
            success: true,
            grading: {
              accuracy: (summary.accuracy_pct ?? 0) / 100,
              hash_verified: hashVerifiedCount,
              p50_latency_ms: summary.fetch_latency_p50_ms ?? 0,
              p95_latency_ms: summary.fetch_latency_p95_ms ?? undefined,
              total_questions: summary.total_questions ?? 0,
            },
          });
        } catch (parseErr) {
          console.error('[run-mesh-test] failed to parse summary.json:', parseErr);
          resolve({ success: false, error: 'PYTHON_ERROR', static_fallback: true });
        }
      });
    });
  });

  // --- SEG-2 v0.1.57: Test It Out IPC handlers ---------------------------------

  /**
   * run-test-it-out — runs 5 random R11 questions through the local Ollama model.
   * Emits 'test-it-out-progress' per question; emits 'test-it-out-complete' when done.
   * Correct answers (HOT: all hot_required_elements present) are written to the
   * verified eblet store (substrate-warming). Wrong answers are never written (Andon canon).
   */
  safeHandle('run-test-it-out', async (event) => {
    const TOTAL = 5;

    // BP083 SEG-4: same bundled extraResources MMLU-Pro path as substrate seed + mesh
    const { loadDomainBank, getDomainList } = await import('./plow/per_domain_q_banks');

    type BankQuestion = {
      id: string;
      question: string;
      canonical_answer: string;
      hot_required_elements: string[];
    };

    let allQuestions: BankQuestion[] = [];
    for (const domain of getDomainList()) {
      try {
        const bank = loadDomainBank(domain);
        for (const q of bank) {
          allQuestions.push({
            id: `${domain}:${q.source_id}`,
            question: q.question,
            canonical_answer: q.correct_answer,
            hot_required_elements: [q.correct_answer],
          });
        }
      } catch {
        /* domain bank missing — skip */
      }
    }

    if (allQuestions.length === 0) {
      return { success: false, error: 'NO_QUESTION_BANK' };
    }

    // Pick 5 random unique questions (Fisher-Yates partial shuffle)
    const pool = [...allQuestions];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = pool.slice(0, TOTAL);

    // Determine model: prefer getSelectedModel(), fall back to floor model
    const model = ollamaManager.getSelectedModel() ?? 'gemma4:12b';

    const isCorrect = (response: string, elements: string[]): boolean => {
      if (!response || elements.length === 0) return false;
      const r = response.toLowerCase();
      return elements.every((el) => r.includes(el.toLowerCase()));
    };

    const results: Array<{
      questionIndex: number;
      question: string;
      modelAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }> = [];

    let score = 0;

    for (let idx = 0; idx < selected.length; idx++) {
      const q = selected[idx];
      const prompt = `Answer the following question concisely and accurately:\n\n${q.question}`;

      let modelAnswer = '';
      try {
        const resp = await fetch('http://127.0.0.1:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false, options: { num_predict: 256, temperature: 0.1 } }),
          signal: AbortSignal.timeout(60_000),
        });
        if (resp.ok) {
          const data = await resp.json() as { response?: string };
          modelAnswer = data.response?.trim() ?? '';
        } else {
          modelAnswer = `ERROR:${resp.status}`;
        }
      } catch (err) {
        modelAnswer = `ERROR:${String(err).slice(0, 80)}`;
      }

      const correct = isCorrect(modelAnswer, q.hot_required_elements);
      if (correct) score++;

      const result = {
        questionIndex: idx,
        question: q.question,
        modelAnswer,
        correctAnswer: q.canonical_answer,
        isCorrect: correct,
      };
      results.push(result);

      // Emit per-question progress to the requesting window
      if (!event.sender.isDestroyed()) {
        event.sender.send('test-it-out-progress', { ...result, total: TOTAL });
      }

      // Andon canon: ONLY write correct answers to substrate
      if (correct) {
        try {
          const { writeVerifiedEblet } = await import('./mnem_eblet_store');
          const { createHash } = await import('crypto');
          const sha256 = createHash('sha256').update(q.question + q.canonical_answer).digest('hex');
          await writeVerifiedEblet({
            question: q.question,
            answer: q.canonical_answer,
            provenance: 'test-it-out',
            verified: true,
            sha256,
            timestamp: Date.now(),
          });
        } catch (e) {
          console.warn('[test-it-out] eblet write failed (non-fatal):', e);
        }
      }
    }

    // Append run to history file
    const historyDir = join(app.getPath('userData'), 'substrate');
    const historyPath = join(historyDir, 'test_it_out_history.jsonl');
    try {
      if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true });
      const historyLine = JSON.stringify({
        ts: Date.now(),
        score,
        total: TOTAL,
        model,
        results: results.map((r) => ({ q: r.question.slice(0, 80), correct: r.isCorrect })),
      });
      appendFileSync(historyPath, historyLine + '\n', 'utf-8');
    } catch (e) {
      console.warn('[test-it-out] history write failed (non-fatal):', e);
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('test-it-out-complete', { score, total: TOTAL, results });
    }

    return { success: true, score, total: TOTAL };
  });

  /** get-test-it-out-history — returns last 20 run records from history JSONL. */
  safeHandle('get-test-it-out-history', async () => {
    const historyPath = join(app.getPath('userData'), 'substrate', 'test_it_out_history.jsonl');
    if (!existsSync(historyPath)) return { runs: [] };
    try {
      const lines = readFileSync(historyPath, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .slice(-20);
      const runs = lines.map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
      return { runs };
    } catch {
      return { runs: [] };
    }
  });

  // --- SEG-A2 BP081: Substrate stats dashboard IPC ------------------------------

  safeHandle('get-substrate-stats', async () => {
    const { queryStats } = await import('./mnem_eblet_store');
    return queryStats();
  });

  // --- BP081 K-1: Membership IPC handlers (stub tier) --------------------------

  safeHandle('membership:start-checkout', async (_event: unknown, args: { userJwt?: string } = {}) => {
    const { createMembershipCheckoutSession } = await import('./membership/checkout_session');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const result = await createMembershipCheckoutSession(supabaseUrl, args.userJwt ?? '');
    if (result.checkoutUrl) {
      shell.openExternal(result.checkoutUrl).catch(() => {});
    }
    return result;
  });

  safeHandle('membership:get-status', async () => {
    // Stub — reads from persisted session in v0.1.61
    return { tier: 'standard', status: 'never_joined', annualFeeUsd: 5 };
  });

  safeHandle('membership:cancel', async () => {
    // Stub
    return { success: false, reason: 'not_implemented_until_v0.1.61' };
  });

  // --- BP085 — membership:open-checkout (direct join URL with peer_id) ----------
  safeHandle('membership:open-checkout', async () => {
    try {
      const peerId = getStablePeerId();
      if (!peerId) throw new Error('peer_id not found in local store');
      const url = new URL('https://lianabanyan.com/join');
      url.searchParams.set('source', 'mnemosynec-app');
      url.searchParams.set('user_id', peerId);
      await shell.openExternal(url.toString());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // --- BP085 — membership:check-local-status (reads userData/member_status.json) --
  safeHandle('membership:check-local-status', async () => {
    try {
      const { readFileSync } = await import('fs');
      const { join: pathJoin } = await import('path');
      const statusFile = pathJoin(app.getPath('userData'), 'member_status.json');
      const raw = readFileSync(statusFile, 'utf8');
      const data = JSON.parse(raw) as { is_member?: boolean; member_id?: string; activated_at?: string };
      return { ok: true, is_member: data.is_member === true, member_id: data.member_id };
    } catch {
      return { ok: true, is_member: false, member_id: null };
    }
  });

  // --- SKU IPC handlers (BP078 Scope 6.5) --------------------------------------

  safeHandle('sku-check-model', async (_event, modelName: string) => {
    try {
      const modelsDir = join(homedir(), '.ollama', 'models', 'manifests',
        'registry.ollama.ai', 'library');
      const [name, tag = 'latest'] = modelName.split(':');
      const manifestPath = join(modelsDir, name, tag);
      const fallbackPath = join(homedir(), '.ollama', 'models', 'manifests',
        'registry.ollama.ai', name, tag);
      const exists = existsSync(manifestPath) || existsSync(fallbackPath);
      return { exists, modelName };
    } catch {
      return { exists: false, modelName };
    }
  });

  safeHandle('sku-upgrade-to', async (event, tier: string) => {
    const modelMap: Record<string, string> = {
      full: 'gemma4:12b',
      lite: 'gemma4:12b',
      core: 'gemma4:12b',
    };
    const modelName = modelMap[tier];
    if (!modelName) return { ok: false, error: 'Unknown tier' };

    skuPullRunning = false;

    skuPullRunning = true;

    ollamaManager.pullModel(modelName, (progress) => {
      event.sender.send('sku-pull-progress', {
        downloaded: progress.bytesDownloaded ?? progress.completed ?? 0,
        total: progress.totalBytes ?? progress.total ?? 0,
        status: progress.status,
      });
    }).then(() => {
      skuPullRunning = false;
      try {
        const cfgPath = join(app.getPath('userData'), 'sku_tier.json');
          writeFileSync(cfgPath, JSON.stringify({ tier, model: modelName }), 'utf-8');
        } catch (err) {
          console.warn('[SKU] Failed to write sku_tier.json:', err);
        }
      event.sender.send('sku-pull-complete');
    }).catch((err: Error) => {
      skuPullRunning = false;
      event.sender.send('sku-pull-error', err.message);
    });

    return { ok: true };
  });

  safeHandle('sku-cancel-upgrade', async () => {
    skuPullRunning = false;
    return { ok: true };
  });

  safeHandle('sku-current-tier', async () => {
    try {
      const cfgPath = join(app.getPath('userData'), 'sku_tier.json');
      if (existsSync(cfgPath)) {
        const raw = readFileSync(cfgPath, 'utf-8');
        const parsed = JSON.parse(raw) as { tier?: string };
        if (parsed.tier) return { tier: parsed.tier };
      }
    } catch { /* fallback to nano */ }
    return { tier: 'nano' };
  });

  // SEG-V0149-P1: first-install gate — check sku_tier.json presence without leaking tier value
  safeHandle('onboarding-check', async () => {
    const skuPath = join(app.getPath('userData'), 'sku_tier.json');
    return { skuExists: existsSync(skuPath) };
  });

  // SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: skip-path — user already has Ollama + model,
  // or IPC fallback timed out. Writes sku_tier.json to unblock first-install gate.
  safeHandle('write-sku-tier-skip', async () => {
    try {
      writeFileSync(
        join(app.getPath('userData'), 'sku_tier.json'),
        JSON.stringify({ tier: 'full', model: 'gemma4:12b', source: 'user_skip' }),
      );
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[write-sku-tier-skip] Failed:', message);
      return { ok: false, error: message };
    }
  });

  // SEG-V0151-P0-AUTOMATIC-BACKGROUND: lean-bg-start — silent background setup
  // Fires from LeanShell on first lean-mode launch. Reuses lean-install-start logic
  // but emits 'lean-bg-status' events for LeanShell thin status bar.
  safeHandle('lean-bg-start', async (event) => {
    const emit = (type: string, msg: string, pct?: number) => {
      event.sender.send('lean-bg-status', { type, msg, ...(pct != null ? { pct } : {}) });
    };

    try {
      // Step 1: Check Ollama reachability
      const reachable = await ollamaManager.isReachable();
      if (!reachable) {
        emit('setup-status', 'Starting your AI engine…');
        await ollamaManager.init();
        if (!(await ollamaManager.isReachable())) {
          shell.openExternal('https://ollama.com/download/windows');
          emit('setup-status', 'Visit ollama.com to install Ollama, then relaunch MnemosyneC.');
          return { ok: false };
        }
      }

      // Step 2: Check and pull gemma4:12b
      const MODEL = 'gemma4:12b';
      const hasModel = await ollamaManager.hasModel(MODEL);
      if (hasModel) {
        emit('setup-status', 'ready');
        return { ok: true };
      }

      emit('setup-status', 'Downloading your AI model…');
      let lastBytes = 0, lastTs = Date.now();
      await ollamaManager.pullModel(MODEL, (progress) => {
        const bytes = progress.bytesDownloaded ?? progress.completed ?? 0;
        const total = progress.totalBytes ?? progress.total ?? 0;
        const now = Date.now();
        const elapsedSec = (now - lastTs) / 1000;
        if (elapsedSec >= 1 && bytes > lastBytes) {
          const pct = total > 0 ? Math.round((bytes / total) * 100) : 0;
          emit('setup-progress', `Downloading your AI model… ${pct}%`, pct);
          lastBytes = bytes; lastTs = now;
        }
      });
      emit('setup-status', 'ready');
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[lean-bg-start] Error:', msg);
      emit('setup-status', '');
      return { ok: false, error: msg };
    }
  });

  // -- Black Crow Feather earn (BP078) ---------------------------------------
  // Durably records a black_crow feather in the Supabase crow_feathers table.
  // Uses service role key to bypass RLS. Idempotent: one black_crow feather
  // per user with badge_class = 'full_sku_upgrade'.
  safeHandle('feather:earn-black', async (
    _event,
    payload: { userId: string; reason: string; metadata?: Record<string, unknown> },
  ) => {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[feather:earn-black] Supabase credentials not present, skipping durable feather record.');
      return { ok: false, error: 'no-credentials' };
    }
    const { userId, reason, metadata = {} } = payload;
    const restBase = `${supabaseUrl}/rest/v1/crow_feathers`;
    const authHeaders: Record<string, string> = {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
    try {
      // Idempotency check: look for an existing black_crow feather for this user.
      const checkUrl = `${restBase}?user_id=eq.${encodeURIComponent(userId)}&category=eq.black_crow&metadata->>badge_class=eq.full_sku_upgrade&select=id&limit=1`;
      const checkResp = await fetch(checkUrl, { method: 'GET', headers: authHeaders });
      if (checkResp.ok) {
        const existing = await checkResp.json() as Array<{ id: string }>;
        if (existing.length > 0) {
          return { ok: true, alreadyIssued: true, featherId: existing[0].id };
        }
      }
      // Insert new record.
      const insertResp = await fetch(restBase, {
        method: 'POST',
        headers: { ...authHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          category: 'black_crow',
          record_value: 1,
          metadata: {
            honor_badge: true,
            badge_class: 'full_sku_upgrade',
            reason,
            ...metadata,
          },
        }),
      });
      if (!insertResp.ok) {
        const errText = await insertResp.text();
        console.error('[feather:earn-black] Insert failed:', insertResp.status, errText);
        return { ok: false, error: `insert-failed-${insertResp.status}` };
      }
      const inserted = await insertResp.json() as Array<{ id: string }>;
      const featherId = inserted[0]?.id ?? '';
      return { ok: true, featherId };
    } catch (err) {
      console.error('[feather:earn-black] Unexpected error:', err);
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP080 Genesis Mint — IP Ledger IPC handlers ───────────────────────────

  safeHandle('ip-ledger:get-genesis', () => {
    try {
      const entries = loadAllEntries();
      return entries.find(e => e.claim === 'genesis:user:000001') ?? null;
    } catch {
      return null;
    }
  });

  safeHandle('ip-ledger:founder-vcard-qr', async () => {
    try {
      const entries = loadAllEntries();
      const genesis = entries.find(e => e.claim === 'genesis:user:000001');
      if (!genesis) return null;
      const parsed = JSON.parse(genesis.claim_body ?? '{}') as Record<string, unknown>;
      const displayName = typeof parsed.display_name === 'string' ? parsed.display_name : 'FounderDenken';
      const provisionalFilings = typeof parsed.provisional_filings === 'number' ? parsed.provisional_filings : 21;
      const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${displayName}`,
        'ORG:MnemosyneC Cooperative',
        'URL:https://mnemosynec.ai/member/000001',
        `NOTE:User 000001 · Ledger entry: genesis:user:000001 · ${provisionalFilings} provisional filings · MnemosyneC cooperative founder`,
        'END:VCARD',
      ].join('\n');
      const QRCode = await import('qrcode').catch(() => null);
      if (!QRCode) return { error: 'qrcode_package_missing' };
      const dataUrl = await (QRCode.default as typeof import('qrcode')).toDataURL(vcard, { width: 300, margin: 2 });
      return { dataUrl, vcard };
    } catch (e) {
      return { error: String(e) };
    }
  });

  safeHandle('ip-ledger:execute-genesis-mint', async () => {
    await mintGenesisIfAbsent();
    const entries = loadAllEntries();
    return entries.find(x => x.claim === 'genesis:user:000001') ?? null;
  });

  // ── BP080 Full 22-Entry Genesis Mint (Founder-ratified 2026-06-11) ────────
  safeHandle('ip-ledger:genesis-mint-full', async () => {
    // IDEMPOTENCY CHECK — Federal Body Cam — never double-write
    const existing = loadAllEntries().find(e => e.claim === 'genesis:user:000001');
    if (existing) {
      return {
        success: false,
        error: 'Genesis entry already exists — no duplicate write. ledger_id: ' + existing.ledger_id,
        genesis_ledger_id: existing.ledger_id,
        filing_ledger_ids: [],
        all_22_entries: [existing],
      };
    }

    const stablePeerId = getStablePeerId();
    const supabaseUserId = 'member_000001';

    // STEP 1: Mint genesis user entry FIRST
    const genesisEntry = registerClaim({
      registered_by: 'member_000001',
      claim: 'genesis:user:000001',
      claim_body: JSON.stringify({
        display_name: 'FounderDenken',
        email: 'Founder@LianaBanyan.com',
        role: 'founder',
        cooperative: 'MnemosyneC',
        founding_date: '2026-06-11',
        supabase_user_id: supabaseUserId,
        stable_peer_id: stablePeerId,
        provisional_filings_count: 21,
        filing_dockets: ['LB-PROV-001','LB-PROV-002','LB-PROV-003','LB-PROV-004','LB-PROV-005','LB-PROV-006','LB-PROV-007','LB-PROV-008','LB-PROV-009','LB-PROV-010','LB-PROV-011','LB-PROV-012','LB-PROV-013','LB-PROV-014','LB-PROV-015','LB-PROV-016','LB-PROV-017','LB-PROV-018','LB-PROV-019','LB-PROV-020','LB-PROV-021'],
        ratify_quote: 'MINT IT — display_name: FounderDenken — 2026-06-11',
        ratify_session: 'BP080',
        member_id_note: 'supabase_user_id is the immutable anchor; display_name and email are mutable proxies — supersede-chain tracks changes per Federal Body Cam doctrine',
      }),
      evidence: [
        'Asteroid-ProofVault/03_PATENT_BAGS/PROV_21_FILING_CHECKLIST_BP067.md',
        'MEMORY.md — BP070 CLOSE-STAMP canonical filing count 21',
        'Founder explicit ratify 2026-06-11 BP080 — MINT IT display_name FounderDenken',
      ],
      category: 'provisional',
    });

    // STEP 2: Mint 21 per-filing entries with actual USPTO app numbers
    const PROV_FILINGS: Array<{ docket: string; app_number: string; filing_date: string; title: string; conf?: string; filing_fee?: string; entity_status?: string }> = [
      { docket: 'LB-PROV-001', app_number: '63/925,672', filing_date: '2025-11-26', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-002', app_number: '63/927,674', filing_date: '2025-11-30', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-003', app_number: '63/938,216', filing_date: '2025-12-10', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-004', app_number: '63/967,200', filing_date: '2026-01-23', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-005', app_number: '63/969,601', filing_date: '2026-01-28', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-006', app_number: '63/989,913', filing_date: '2026-02-24', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-007', app_number: '64/006,010', filing_date: '2026-03-15', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-008', app_number: '64/009,803', filing_date: '2026-03-18', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-009', app_number: '64/017,140', filing_date: '2026-03-25', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-010', app_number: '64/017,457', filing_date: 'see-patent-receipt', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-011', app_number: '64/025,635', filing_date: 'see-patent-receipt', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-012', app_number: '64/031,531', filing_date: 'see-patent-receipt', title: '93 innovations #2131–#2224 — Context/Beacon/Distribution/Temporal/Trust/UX clusters (B077–B087)' },
      { docket: 'LB-PROV-013', app_number: '64/036,646', filing_date: '2026-04-12', title: 'Romulator / ROM+Emulator+HAL9000 genesis strain of Mnemosyne' },
      { docket: 'LB-PROV-014', app_number: '64/052,602', filing_date: '2026-04-29', title: 'Cooperative-Platform AI Memory Infrastructure with Discipline-Enforcement Federation' },
      { docket: 'LB-PROV-015', app_number: '64/052,618', filing_date: '2026-04-29', title: 'Cooperative-Platform AI Memory Infrastructure — Agent-Spawn Boundary Pre-Injection, Lossless Vendor-Layer Tablet Capture, Corpus-Alias Registry-Keyword-Extension, Substrate Discipline Primitives' },
      { docket: 'LB-PROV-016', app_number: '64/060,080', filing_date: '2026-05-07', title: 'Method and System for Cooperative-AI-Substrate Platform with Multi-Organism Federation and Substrate-Routed Memory Expansion' },
      { docket: 'LB-PROV-017', app_number: '64/060,093', filing_date: '2026-05-07', title: 'Save-the-World 12-Paper Series + HexIsle Wave 4 + Cooperative Manufacturing Sovereignty + Substrate-IS-the-Primitive' },
      { docket: 'LB-PROV-018', app_number: '64/062,332', filing_date: '2026-05-11', title: 'BP036 substrate canon — PGP/Edition/Aviator + SEG-Cascade + Aircraft Carrier + Excalibur + TCP/IP 4-Tuple substrate-layer' },
      { docket: 'LB-PROV-019', app_number: '64/062,334', filing_date: '2026-05-11', title: 'HexIsle 2D Isometric World Operational Interface + Substrate kernel extensions + Sonnet S7/S8/S1 clusters' },
      { docket: 'LB-PROV-020', app_number: '64/073,890', filing_date: '2026-05-25', title: 'Substrace Theorem + Pheromone Trail + Wrasse-Quartermaster + MENUS + Hard Candy Stitchpunk + Pearl Registry + Cephas + SEG-Cascade + Employ-the-World backbone' },
      { docket: 'LB-PROV-021', app_number: '64/079,336', filing_date: '2026-06-01', title: 'Cooperative AI Substrate Systems: Roll Architecture Peer-Mesh Ratification, Pearl-Class Transmission, Wrasse-Quartermaster Context Pre-Injection, Anti-Hype Empirical Honesty Framework, Caithedral Cathedral Architecture, MENUS-Helm Cooperative Inventory Layer, Hard Candy Stitchpunk Configuration Sharing, Mnemosyne P2P Cold-Storage Capsule Protocol, Employ the World Cooperative-Economy Backbone, Computation-Knowledge Separation via Speckle/Hex-Soccerball/Peanut-Roll/Mass-Crystal Substrate Primitives, AI Tuner Role-Class, and Human-Substrate Anecdote-Corpus Method for Multi-Agent Cooperative Platform Orchestration', conf: '6635', filing_fee: '$65', entity_status: 'micro_entity' },
    ];

    const filingEntries: ReturnType<typeof registerClaim>[] = [];
    for (const f of PROV_FILINGS) {
      const body: Record<string, string> = {
        docket: f.docket,
        app_number: f.app_number,
        filing_date: f.filing_date,
        title: f.title,
        filed_by: 'Jonathan Ray Jones',
        address: '9627 Krier Ct, Converse TX 78109',
        cooperative: 'MnemosyneC',
        genesis_ledger_id_ref: genesisEntry.ledger_id,
      };
      if (f.conf) body['conf'] = f.conf;
      if (f.filing_fee) body['filing_fee'] = f.filing_fee;
      if (f.entity_status) body['entity_status'] = f.entity_status;
      const entry = registerClaim({
        registered_by: 'member_000001',
        claim: `patent:provisional:${f.docket}`,
        claim_body: JSON.stringify(body),
        evidence: [
          'Asteroid-ProofVault/03_PATENT_BAGS/ — folder-verified app number',
          'Founder explicit ratify 2026-06-11 BP080',
        ],
        category: 'provisional',
      });
      filingEntries.push(entry);
    }

    // STEP 3: Generate vCard QR PNG
    let vcardQrPath: string | null = null;
    let vcardQrError: string | null = null;
    try {
      vcardQrPath = await generateFounderVcardQr(genesisEntry.ledger_id);
    } catch (e) {
      vcardQrError = String(e);
    }

    return {
      success: true,
      genesis_ledger_id: genesisEntry.ledger_id,
      filing_ledger_ids: filingEntries.map(e => e.ledger_id),
      all_22_entries: [genesisEntry, ...filingEntries],
      vcard_qr_path: vcardQrPath,
      vcard_qr_error: vcardQrError,
    };
  });

  // ── BP089 I-C: ip-ledger:get-entries + peer-key handlers ──────────────────
  // Adds §16 Supabase ip_ledger read + peer keypair IPC surface.
  // Bishop applies I12 migration before these handlers have live data.

  safeHandle('ip-ledger:get-entries', async (_event, ringBearerId: string) => {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase config not available', entries: [] };
    try {
      const qs = ringBearerId ? `ring_bearer_id=eq.${encodeURIComponent(ringBearerId)}&` : '';
      const res = await fetch(
        `${supabaseUrl}/rest/v1/ip_ledger?${qs}order=stamp_seq.asc&limit=200`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      );
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, entries: [] };
      const entries = await res.json();
      return { ok: true, entries };
    } catch (err) {
      return { ok: false, error: (err as Error).message, entries: [] };
    }
  });

  safeHandle('peer-key:read', async () => {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const peerId = getStablePeerId();
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase config not available' };
    try {
      const { ensurePeerKeypair } = await import('../substrate/peerKeyGen');
      const result = await ensurePeerKeypair(peerId, { supabaseUrl, anonKey });
      return { ok: true, publicKeyHex: result.publicKeyHex, generated: result.generated, peerId };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  safeHandle('peer-key:regenerate', async () => {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const peerId = getStablePeerId();
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase config not available' };
    try {
      // Clear existing key so ensurePeerKeypair re-generates
      await fetch(
        `${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`,
        {
          method: 'PATCH',
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ public_key_hex: null, private_key_hex_encrypted: null }),
        },
      );
      const { ensurePeerKeypair } = await import('../substrate/peerKeyGen');
      const result = await ensurePeerKeypair(peerId, { supabaseUrl, anonKey });
      return { ok: true, publicKeyHex: result.publicKeyHex, generated: true, peerId };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP092 I12 — Marketplace plugin registration with IP Ledger stamp ─────────

  safeHandle('marketplace:register-plugin', async (_event, req: import('./marketplace/marketplace_registry').PluginRegistrationRequest) => {
    try {
      const { registerPlugin } = await import('./marketplace/marketplace_registry');
      const { stampCertify } = await import('./ip_ledger/stamp_certify');
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      const manifest = registerPlugin(req, 'pending_stamp');
      // Stamp-Certify hook: member_business_listing_created (fire-and-forget)
      stampCertify({
        contribution_type: 'member_business_listing_created',
        payload: JSON.stringify({ event: 'member_business_listing_created', entity_id: manifest.plugin_id, member_id: identity.peer_id, timestamp: Date.now() }),
      }).catch((e: Error) => console.error('[ip_ledger hook] member_business_listing_created:', e));
      return { ok: true, manifest };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP092 I12: Ring Bearer identity + Postgres ip_ledger_entries IPC ────────

  safeHandle('ip-ledger:get-identity', async () => {
    try {
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      return { ok: true, peer_id: identity.peer_id, public_key_hex: identity.public_key_hex };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  safeHandle('ip-ledger:get-pg-entries', async () => {
    try {
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!supabaseUrl || !supabaseKey) return { ok: false, error: 'Supabase config not available', entries: [] };
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
      const { data, error } = await sb
        .from('ip_ledger_entries')
        .select('entry_id, contribution_type, stamped_at, mesh_replicated, payload_url')
        .eq('ring_bearer_peer_id', identity.peer_id)
        .order('stamped_at', { ascending: false })
        .limit(50);
      if (error) return { ok: false, error: error.message, entries: [] };
      return { ok: true, entries: data ?? [] };
    } catch (err) {
      return { ok: false, error: (err as Error).message, entries: [] };
    }
  });

  safeHandle('ip-ledger:get-entry-proof', async (_event, entryId: string) => {
    try {
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!supabaseUrl || !supabaseKey) return { ok: false, error: 'Supabase config not available' };
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
      const { data, error } = await sb
        .from('ip_ledger_entries')
        .select('*')
        .eq('entry_id', entryId)
        .single();
      if (error) return { ok: false, error: error.message };
      const row = data as Record<string, unknown> | null;
      const payloadHashHex = typeof row?.payload_hash === 'string'
        ? row.payload_hash.replace(/^\\x/, '')
        : '';
      const signatureHex = typeof row?.signature_ed25519 === 'string'
        ? row.signature_ed25519.replace(/^\\x/, '')
        : '';
      const proof = {
        entry_id: row?.entry_id,
        ring_bearer_peer_id: row?.ring_bearer_peer_id,
        ring_bearer_public_key_hex: identity.public_key_hex,
        contribution_type: row?.contribution_type,
        payload_hash_hex: payloadHashHex,
        signature_ed25519_hex: signatureHex,
        stamped_at: row?.stamped_at,
        verify_with: `node -e "const c=require('node:crypto');const h=Buffer.from('${payloadHashHex}','hex');const k=c.createPublicKey({key:Buffer.from('${identity.public_key_hex}','hex'),format:'der',type:'spki'});const s=Buffer.from('${signatureHex}','hex');console.log(c.verify(null,h,k,s))"`,
      };
      return { ok: true, proof };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── SEG-4 v0.1.59 — Plow the Field IPC handlers ───────────────────────────

  safeHandle('plow:load-domain-bank', async (_, domain: string) => {
    const { loadDomainBank } = await import('./plow/per_domain_q_banks');
    return loadDomainBank(domain as import('./plow/per_domain_q_banks').Domain);
  });

  safeHandle('plow:run-andon-replow', async (_, { question, domain }: { question: string; domain: string }) => {
    const { runAndonReplowLoop } = await import('./plow/andon_replow');
    return runAndonReplowLoop(question, domain);
  });

  // ── BP082 v0.2.2 — Founder Substrate Seed (Hypothesis D) ──────────────────
  // Reads all MMLU-Pro questions from bundled resources and writes Founder-attested
  // seed eblets to verified_eblets.jsonl. Bypasses concordance per Founder-attestation
  // doctrine (BP080 Tower-of-Peace canon). Emits progress events on the main window.

  safeHandle('plow:seed-from-bank', async (event) => {
    const { loadDomainBank, getDomainList } = await import('./plow/per_domain_q_banks');
    const { writeVerifiedEblet } = await import('./mnem_eblet_store');
    const { createHash } = await import('crypto');

    const domains = getDomainList();
    let total = 0;
    let written = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Count total questions first
    const allBanks: Array<{ domain: string; questions: import('./plow/per_domain_q_banks').Question[] }> = [];
    for (const domain of domains) {
      try {
        const q = loadDomainBank(domain);
        allBanks.push({ domain, questions: q });
        total += q.length;
      } catch (err) {
        errors.push(`${domain}: ${(err as Error).message}`);
      }
    }

    console.log(`[PlowSeed] Starting Founder seed — total=${total} domains=${allBanks.length}`);
    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:seed-progress', data);
      }
    };

    // Write in batches, emitting progress
    for (const { domain, questions } of allBanks) {
      for (const q of questions) {
        try {
          const sha256 = createHash('sha256')
            .update(q.question + q.correct_answer)
            .digest('hex');
          await writeVerifiedEblet({
            question: q.question,
            answer: q.correct_answer,
            provenance: `founder_seed:mmlu_pro:${domain}:bp082`,
            verified: true,
            sha256,
            timestamp: Date.now(),
          });
          written++;
        } catch (err) {
          skipped++;
          console.warn(`[PlowSeed] skip error for domain=${domain}:`, err);
        }

        // Emit progress every 50 entries
        if ((written + skipped) % 50 === 0) {
          broadcastProgress({
            written,
            skipped,
            total,
            pct: Math.round(((written + skipped) / total) * 100),
          });
        }
      }
    }

    console.log(`[PlowSeed] Complete — written=${written} skipped=${skipped} errors=${errors.length}`);
    broadcastProgress({ written, skipped, total, pct: 100, done: true });

    return { ok: true, written, skipped, total, errors };
  });

  // ── BP083 SEG-5 — Reset + Reseed Context-Class eblets ────────────────────
  //
  // Clears the existing verified_eblets.jsonl (which contains Q+A pairs that
  // poison the mesh test with direct answer-key lookup) and re-seeds with
  // CONTEXT-CLASS eblets: one eblet per question containing the question text as
  // the knowledge-surface key and the domain+category as the routing label.
  // The answer text is NOT written — the substrate holds topical context for RAG,
  // not answer keys.
  //
  // After this reset, Founder should re-run Plow the Field to grow the substrate
  // organically (Andon-discipline verified answers write context, not Q+A).

  safeHandle('plow:reset-and-reseed-context', async (event) => {
    const { loadDomainBank, getDomainList } = await import('./plow/per_domain_q_banks');
    const { mkdirSync: mkDir, writeFileSync: writeF, existsSync: existF } = await import('fs');
    const { resolve: resolveP } = await import('path');
    const { createHash: ch } = await import('crypto');
    const { app: appRef } = await import('electron');

    const ebletDir = resolveP(appRef.getPath('userData'), 'substrate');
    const ebletFile = resolveP(ebletDir, 'verified_eblets.jsonl');
    const backupFile = resolveP(ebletDir, `verified_eblets.backup_${Date.now()}.jsonl`);

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:reset-reseed-progress', data);
      }
    };

    // Step 1: backup existing file
    if (existF(ebletFile)) {
      try {
        const { copyFileSync } = await import('fs');
        copyFileSync(ebletFile, backupFile);
        console.log(`[ResetReseed] Backed up to ${backupFile}`);
      } catch (e) {
        console.warn('[ResetReseed] Backup failed (non-fatal):', e);
      }
    }

    // Step 2: clear the file (start fresh)
    if (!existF(ebletDir)) mkDir(ebletDir, { recursive: true });
    writeF(ebletFile, '', 'utf-8');
    console.log('[ResetReseed] Cleared verified_eblets.jsonl');

    // Step 3: re-seed with context-class eblets
    // Format: { question: "<domain> | <question excerpt>", answer: "<domain category>",
    //           provenance: "context_seed:mmlu_pro:<domain>:bp083", verified: true, ... }
    // The question field is a TOPICAL LABEL (not the full Q+A pair).
    // This gives the substrate domain-knowledge routing without answer-key cheating.
    const { appendFileSync } = await import('fs');
    const domains = getDomainList();
    let total = 0;
    let written = 0;

    const allBanks: Array<{ domain: string; questions: import('./plow/per_domain_q_banks').Question[] }> = [];
    for (const domain of domains) {
      try {
        const q = loadDomainBank(domain);
        allBanks.push({ domain, questions: q });
        total += q.length;
      } catch { /* skip missing bank */ }
    }

    broadcastProgress({ written: 0, total, pct: 0 });

    for (const { domain, questions } of allBanks) {
      for (const q of questions) {
        // Store: domain-keyed topical label (first 100 chars of question), NOT the answer
        const excerpt = q.question.slice(0, 100);
        const topicalKey = `${domain.replace(/_/g, ' ')} | ${excerpt}`;
        const domainCategory = domain.replace(/_/g, ' ');
        const sha256 = ch('sha256').update(topicalKey + domainCategory).digest('hex');
        const entry = JSON.stringify({
          question: topicalKey,
          answer: domainCategory,
          provenance: `context_seed:mmlu_pro:${domain}:bp083`,
          verified: true,
          sha256,
          timestamp: Date.now(),
        });
        appendFileSync(ebletFile, entry + '\n', 'utf-8');
        written++;

        if (written % 100 === 0) {
          broadcastProgress({
            written, total,
            pct: Math.round((written / total) * 100),
          });
        }
      }
    }

    broadcastProgress({ written, total, pct: 100, done: true });
    console.log(`[ResetReseed] Complete — written=${written} context-class eblets (answer-key-free)`);
    return { ok: true, written, total, backupPath: backupFile };
  });

  // ── BP082 v0.2.3 — Beat-Google Benchmark IPC ──────────────────────────────

  safeHandle('plow:get-google-baselines', async () => {
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const basePath = app.isPackaged
      ? join(process.resourcesPath, 'google_baselines.json')
      : join(__dirname, '../../../resources/google_baselines.json');
    if (existsSync(basePath)) {
      try {
        return JSON.parse(readFileSync(basePath, 'utf-8')) as unknown;
      } catch {
        // fallthrough to inline fallback
      }
    }
    return { model: 'gemma4-12b-unified', aggregate: 0.772, per_domain_available_12b: false };
  });

  // Cancel token for the active benchmark run
  let _benchmarkCancelRequested = false;

  safeHandle('plow:cancel-benchmark', () => {
    _benchmarkCancelRequested = true;
    console.log('[BenchmarkRunner] Cancel requested via IPC');
    return { ok: true };
  });

  safeHandle('plow:run-benchmark', async (
    _event,
    config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string },
  ) => {
    _benchmarkCancelRequested = false;
    const { runBeatGoogleBenchmark, generateReceiptMarkdown } = await import('./plow/benchmark_runner');
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:benchmark-progress', data);
      }
    };

    const writeReceipt = (receiptMarkdown: string, timestamp: number): string | null => {
      try {
        const receiptsDir = join(app.getPath('userData'), 'benchmark_receipts');
        if (!existsSync(receiptsDir)) mkdirSync(receiptsDir, { recursive: true });
        const dateStr = new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `BP082_BEAT_GOOGLE_BENCHMARK_${dateStr}_${timestamp}.md`;
        const fullPath = join(receiptsDir, filename);
        writeFileSync(fullPath, receiptMarkdown, 'utf-8');
        console.log('[BenchmarkRunner] Receipt written:', fullPath);
        // Auto-copy to Asteroid-ProofVault (workspace vault)
        const vaultDir = join(app.getAppPath(), '../../../Asteroid-ProofVault');
        if (existsSync(vaultDir)) {
          try {
            writeFileSync(join(vaultDir, `BP082_BEAT_GOOGLE_BENCHMARK_RECEIPT_${dateStr}.md`), receiptMarkdown, 'utf-8');
            console.log('[BenchmarkRunner] Vault copy written');
          } catch (vErr) {
            console.warn('[BenchmarkRunner] Vault copy failed:', vErr);
          }
        }
        return fullPath;
      } catch (rErr) {
        console.error('[BenchmarkRunner] Receipt write failed:', rErr);
        return null;
      }
    };

    try {
      const result = await runBeatGoogleBenchmark(config, (progressEvent) => {
        broadcastProgress(progressEvent);
      });
      // Auto-generate and write receipt
      const receiptMarkdown = generateReceiptMarkdown(result);
      const receiptPath = writeReceipt(receiptMarkdown, result.startedAt);
      // Broadcast final complete event with receipt path
      broadcastProgress({ type: 'complete', result, receiptPath });
      return { ok: true, result, receiptPath };
    } catch (err) {
      console.error('[BenchmarkRunner] Fatal error:', err);
      broadcastProgress({ type: 'error', message: (err as Error).message });
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── plow:write-receipt (BP082 v0.2.3 benchmark receipt writer) ───────────
  safeHandle('plow:write-receipt', async (
    _event,
    args: { receiptMarkdown: string; timestamp: number },
  ) => {
    try {
      const { writeFileSync, mkdirSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const receiptsDir = join(app.getPath('userData'), 'benchmark_receipts');
      if (!existsSync(receiptsDir)) mkdirSync(receiptsDir, { recursive: true });
      const dateStr = new Date(args.timestamp).toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `BP082_BENCHMARK_RECEIPT_${dateStr}_${args.timestamp}.md`;
      const fullPath = join(receiptsDir, filename);
      writeFileSync(fullPath, args.receiptMarkdown, 'utf-8');
      return { ok: true, path: fullPath };
    } catch (e) {
      return { ok: false, path: undefined };
    }
  });

  // ── plow:mesh-comparison — BP082 v0.3.1 3-condition runner ──────────────
  let _meshCancelToken = { cancelled: false };

  safeHandle('plow:mesh-grader-smoke-test', async (
    _event,
    config: { model: string; ollamaBaseUrl: string },
  ) => {
    const { runMeshGraderSmokeTest } = await import('./plow/mesh_comparison_runner');
    return runMeshGraderSmokeTest(config);
  });

  safeHandle('plow:cancel-mesh-comparison', () => {
    _meshCancelToken.cancelled = true;
    console.log('[MeshComparison] Cancel requested via IPC');
    return { ok: true };
  });

  safeHandle('plow:run-mesh-comparison', async (
    _event,
    config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string },
  ) => {
    _meshCancelToken = { cancelled: false };
    const { runMeshComparison, generateMeshComparisonReceipt, runMeshGraderSmokeTest } = await import('./plow/mesh_comparison_runner');
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:mesh-comparison-progress', data);
      }
    };

    const writeMeshReceipt = (receiptMarkdown: string, timestamp: number): string | null => {
      try {
        const receiptsDir = join(app.getPath('userData'), 'benchmark_receipts');
        if (!existsSync(receiptsDir)) mkdirSync(receiptsDir, { recursive: true });
        const dateStr = new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `BP082_MESH_COMPARISON_RECEIPT_${dateStr}_${timestamp}.md`;
        const fullPath = join(receiptsDir, filename);
        writeFileSync(fullPath, receiptMarkdown, 'utf-8');
        console.log('[MeshComparison] Receipt written:', fullPath);
        const vaultDir = join(app.getAppPath(), '../../../Asteroid-ProofVault');
        if (existsSync(vaultDir)) {
          try {
            writeFileSync(join(vaultDir, `BP082_MESH_COMPARISON_RECEIPT_${dateStr}.md`), receiptMarkdown, 'utf-8');
            console.log('[MeshComparison] Vault copy written');
          } catch (vErr) {
            console.warn('[MeshComparison] Vault copy failed:', vErr);
          }
        }
        return fullPath;
      } catch (rErr) {
        console.error('[MeshComparison] Receipt write failed:', rErr);
        return null;
      }
    };

    try {
      const smoke = await runMeshGraderSmokeTest({
        model: config.model,
        ollamaBaseUrl: config.ollamaBaseUrl,
      });
      broadcastProgress({ type: 'smoke-test', ...smoke });
      if (!smoke.ok) {
        broadcastProgress({ type: 'error', message: smoke.message });
        return { ok: false, error: smoke.message, smoke };
      }

      const result = await runMeshComparison(config, (progressEvent) => {
        broadcastProgress(progressEvent);
      }, _meshCancelToken);
      const receiptMarkdown = generateMeshComparisonReceipt(result);
      const receiptPath = writeMeshReceipt(receiptMarkdown, result.startedAt);
      broadcastProgress({ type: 'complete', result, receiptPath });
      return { ok: true, result, receiptPath };
    } catch (err) {
      console.error('[MeshComparison] Fatal error:', err);
      broadcastProgress({ type: 'error', message: (err as Error).message });
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP083 v0.4.2 — Canonical Plow Pipeline IPC (Worker Service) ──────────
  // v0.4.2 SEG-1: Plow worker is now a true main-process singleton decoupled
  // from renderer state. NEVER dies on UI changes (Lean Mode toggle, tab switch,
  // window minimize). Only dies on explicit Cancel OR app exit.
  // SEG-5: Checkpoint written every N questions; Resume modal on next launch.

  safeHandle('plow:cancel-canonical-plow', () => {
    const { cancelPlowWorker } = require('./plow/plow_worker_service') as typeof import('./plow/plow_worker_service');
    cancelPlowWorker();
    console.log('[CanonicalPlow] Cancel requested via IPC');
    return { ok: true };
  });

  // Fire-and-forget start — returns immediately, progress broadcast to all windows
  safeHandle('plow:run-canonical-plow', async (
    _event,
    config: {
      domains: string[];
      questionsPerDomain: number;
      model?: string;
      ollamaBaseUrl?: string;
      specialistKeys?: {
        wolframApiKey?: string;
        stackExchangeKey?: string;
        pubmedApiKey?: string;
      };
    },
  ) => {
    const { startPlowWorker, getPlowWorkerState } = await import('./plow/plow_worker_service');
    const { getActiveModel } = await import('./ollama_model/model_picker');

    const state = getPlowWorkerState();
    if (state.status === 'running') {
      return { ok: false, error: 'Plow already running — cancel first' };
    }

    const model = config.model ?? getActiveModel();
    console.log(`[CanonicalPlow] Starting via worker service model=${model}`);

    startPlowWorker({
      domains: config.domains,
      questionsPerDomain: config.questionsPerDomain,
      ollamaBaseUrl: config.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
      model,
      specialistKeys: config.specialistKeys ?? {},
    });

    // Return immediately — progress comes via plow:canonical-plow-progress broadcasts
    return { ok: true, async: true };
  });

  // Renderer can reconnect after unmount/remount — get current worker state
  safeHandle('plow:get-worker-state', async () => {
    const { getPlowWorkerState } = await import('./plow/plow_worker_service');
    return getPlowWorkerState();
  });

  // Check for interrupted plow checkpoint (for Resume modal)
  safeHandle('plow:check-checkpoint', async () => {
    const { readCheckpoint } = await import('./plow/plow_checkpoint');
    const cp = readCheckpoint();
    if (!cp || cp.status !== 'interrupted') return { hasCheckpoint: false };
    return {
      hasCheckpoint: true,
      sessionId: cp.sessionId,
      startedAt: cp.startedAt,
      lastUpdatedAt: cp.lastUpdatedAt,
      totalQuestionsCompleted: cp.totalQuestionsCompleted,
      totalQuestionsTarget: cp.totalQuestionsTarget,
      config: cp.config,
      completedQuestions: cp.completedQuestions,
    };
  });

  // Resume plow from checkpoint
  safeHandle('plow:resume-from-checkpoint', async () => {
    const { readCheckpoint, clearCheckpoint } = await import('./plow/plow_checkpoint');
    const { startPlowWorker, getPlowWorkerState } = await import('./plow/plow_worker_service');

    const state = getPlowWorkerState();
    if (state.status === 'running') return { ok: false, error: 'Plow already running' };

    const cp = readCheckpoint();
    if (!cp || cp.status !== 'interrupted') return { ok: false, error: 'No interrupted checkpoint found' };

    // Clear interrupted status so we can resume
    clearCheckpoint();

    startPlowWorker(
      {
        domains: cp.config.domains,
        questionsPerDomain: cp.config.questionsPerDomain,
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        model: cp.config.model,
      },
      { completedQuestions: cp.completedQuestions, sessionId: cp.sessionId },
    );

    return { ok: true };
  });

  // Discard checkpoint (user chose not to resume)
  safeHandle('plow:discard-checkpoint', async () => {
    const { clearCheckpoint } = await import('./plow/plow_checkpoint');
    clearCheckpoint();
    return { ok: true };
  });

  // Hardware tier detection — for Settings UI + onboarding
  safeHandle('hardware:get-tier', async () => {
    const { detectHardwareTier, getAllTiers, resolveEffectiveModel, getCachedEffectiveModel } = await import('./hardware/ram_detector');
    const { getActiveModel } = await import('./ollama_model/model_picker');
    const tier = detectHardwareTier();
    const allTiers = getAllTiers();
    const activeModel = getActiveModel();
    // M18b: Return cached effective model result (honors right-size.json override)
    const effectiveModelResult = getCachedEffectiveModel() ?? await resolveEffectiveModel();
    return { tier, allTiers, activeModel, effectiveModelResult };
  });

  safeHandle('hardware:set-model', async (_event, { model, tier }: { model: string; tier: string }) => {
    const { setActiveModel } = await import('./ollama_model/model_picker');
    setActiveModel(model, tier as import('./hardware/ram_detector').HardwareTier);
    return { ok: true };
  });

  safeHandle('hardware:reset-model', async () => {
    const { resetToDetectedModel } = await import('./ollama_model/model_picker');
    const model = resetToDetectedModel();
    return { ok: true, model };
  });

  // ── v0.4.2 BP083 SEG-3.5 — Lifecycle / Onboarding IPC ───────────────────
  // Handles server-side lifecycle operations; client-side localStorage is managed by renderer.

  // Reset onboarding (clears lifecycle flags from persisted config — full profile is in AppData)
  safeHandle('lifecycle:get-profile-path', async () => {
    return {
      appData: app.getPath('appData'),
      mnemosyneCPath: join(app.getPath('appData'), 'MnemosyneC'),
    };
  });

  // ── v0.5.1 BP085 — Help Tab peer pipeline IPC ────────────────────────────

  // Lazily-created Supabase admin client for help IPC handlers.
  // Using service-role key from main process — bypasses RLS, Electron main is trust boundary.
  let _helpSupabase: import('@supabase/supabase-js').SupabaseClient | null = null;
  let _helpPollingStarted = false;

  function getHelpSupabase(): import('@supabase/supabase-js').SupabaseClient | null {
    if (_helpSupabase) return _helpSupabase;
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    // Prefer service-role key (bypasses RLS for storage ops); fall back to anon key
    // so Realtime subscriptions work in the packaged Electron app where service-role
    // key is intentionally absent.
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';
    if (!url || !key) {
      console.warn('[help] SUPABASE_URL or Supabase key not set · help pipeline unavailable');
      return null;
    }
    try {
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      _helpSupabase = createClient(url, key, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
      return _helpSupabase;
    } catch (err) {
      console.error('[help] Failed to create Supabase client:', (err as Error).message);
      return null;
    }
  }

  async function ensureHelpScreenshotsBucket(): Promise<void> {
    const sb = getHelpSupabase();
    if (!sb) return;
    try {
      const { error } = await sb.storage.createBucket('help_screenshots', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      });
      if (error && !error.message?.toLowerCase().includes('already exists')) {
        console.error('[help] Failed to create help_screenshots bucket:', error.message);
      }
    } catch (err) {
      console.error('[help] ensureHelpScreenshotsBucket error:', (err as Error).message);
    }
  }

  // Ensure bucket exists at startup (non-blocking, non-fatal)
  ensureHelpScreenshotsBucket().catch(() => {});

  safeHandle('help:get-peer-id', async () => {
    try {
      const peerId = await getStablePeerId();
      return { peerId };
    } catch (err) {
      console.error('[help] get-peer-id error:', (err as Error).message);
      return { peerId: 'unknown' };
    }
  });

  safeHandle('help:send-message', async (_event, args: {
    text: string;
    imageUrl: string | null;
    fromPeer: string;
    toPeer: string | null;
  }) => {
    try {
      const sb = getHelpSupabase();
      if (!sb) return { success: false, error: 'Platform database not configured' };

      const { data, error } = await sb
        .from('help_messages')
        .insert({
          from_peer: args.fromPeer,
          to_peer: args.toPeer ?? null,
          content_text: args.text ?? '',
          content_image_url: args.imageUrl ?? null,
        })
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, id: (data as { id: string }).id };
    } catch (err) {
      console.error('[help] send-message error:', (err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  });

  safeHandle('help:load-messages', async (_event, args: { limit: number }) => {
    try {
      const sb = getHelpSupabase();
      if (!sb) return { error: 'Platform database not configured' };

      const limit = Math.min(args?.limit ?? 50, 200);
      const { data, error } = await sb
        .from('help_messages')
        .select('id, from_peer, to_peer, content_text, content_image_url, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { error: error.message };
      return data ?? [];
    } catch (err) {
      console.error('[help] load-messages error:', (err as Error).message);
      return { error: (err as Error).message };
    }
  });

  safeHandle('help:upload-screenshot', async (_event, args: { base64Data: string; mimeType: string }) => {
    try {
      const sb = getHelpSupabase();
      if (!sb) return { error: 'Platform database not configured' };

      await ensureHelpScreenshotsBucket();

      const peerId = await getStablePeerId();
      const ext = args.mimeType.split('/')[1] ?? 'png';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `${peerId}/${filename}`;

      // Decode base64 to Buffer for upload
      const buffer = Buffer.from(args.base64Data, 'base64');

      const { error: uploadError } = await sb.storage
        .from('help_screenshots')
        .upload(path, buffer, { contentType: args.mimeType, upsert: false });

      if (uploadError) return { error: uploadError.message };

      // Generate signed URL (bucket is private)
      const { data: signedData, error: signedError } = await sb.storage
        .from('help_screenshots')
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

      if (signedError || !signedData?.signedUrl) {
        return { error: signedError?.message ?? 'Failed to generate signed URL' };
      }

      return { url: signedData.signedUrl };
    } catch (err) {
      console.error('[help] upload-screenshot error:', (err as Error).message);
      return { error: (err as Error).message };
    }
  });

  safeHandle('help:start-realtime-sub', async (_event) => {
    // BP086 I9: replaced Supabase Realtime WebSocket subscription with REST polling.
    // Realtime silently fails in Electron main process (Node.js has no global WebSocket).
    // Polling every 5s is the proven pattern (same as relay_routes + fleet_broadcast).
    if (_helpPollingStarted) return { ok: true };
    _helpPollingStarted = true;

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[help-poll] SUPABASE_URL or key not set — help message polling disabled');
      return { ok: true };
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    };

    let lastChecked = new Date().toISOString();

    async function pollHelpMessages(): Promise<void> {
      try {
        const url =
          `${supabaseUrl}/rest/v1/help_messages` +
          `?created_at=gt.${encodeURIComponent(lastChecked)}` +
          `&select=id,from_peer,to_peer,content_text,content_image_url,created_at` +
          `&order=created_at.asc`;

        const res = await fetch(url, { headers });
        if (!res.ok) return;

        const msgs: Array<{
          id: string;
          from_peer: string;
          to_peer: string | null;
          content_text: string;
          content_image_url: string | null;
          created_at: string;
        }> = await res.json();

        if (msgs.length > 0) {
          lastChecked = msgs[msgs.length - 1].created_at;
          for (const msg of msgs) {
            for (const w of BrowserWindow.getAllWindows()) {
              if (!w.isDestroyed()) {
                w.webContents.send('help:new-message', msg);
              }
            }
          }
        }
      } catch {
        // Silent — don't crash main process on poll error
      }
    }

    setInterval(pollHelpMessages, 5000);
    console.log('[help-poll] polling started for help_messages (5s interval)');
    return { ok: true };
  });

  // ── BP083 v0.3.8 — GPQA Diamond Benchmark IPC ────────────────────────────

  let _diamondCancelToken = { cancelled: false };

  safeHandle('diamond:cancel', () => {
    _diamondCancelToken.cancelled = true;
    return { ok: true };
  });

  safeHandle('diamond:run', async (
    _event,
    config: { mode: 'bare' | 'cooperative'; count: number },
  ) => {
    _diamondCancelToken = { cancelled: false };

    const { runBareDiamond, runCooperativeDiamond } = await import('./plow/diamond_runner');

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('diamond:progress', data);
      }
    };

    try {
      const runner = config.mode === 'bare' ? runBareDiamond : runCooperativeDiamond;
      const summary = await runner(
        config.count ?? 50,
        (event) => broadcastProgress(event),
        _diamondCancelToken,
      );

      broadcastProgress({ type: 'complete', summary });
      return { ok: true, summary };
    } catch (err) {
      console.error('[Diamond] Fatal error:', err);
      broadcastProgress({ type: 'error', message: (err as Error).message });
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── SEG-5 v0.1.59 — Clipboard read IPC ────────────────────────────────────

  safeHandle('clipboard:read', async () => {
    return clipboard.readText();
  });

  // M22 §5 — Mesh dispatcher IPC handlers
  safeHandle('mesh:dispatch-task', async (_event: Electron.IpcMainInvokeEvent, task: import('./mesh-dispatcher').CooperativeTask) => {
    try {
      const { routeTask, dispatchToAssignedPeers, accrueMarks } = require('./mesh-dispatcher') as typeof import('./mesh-dispatcher');
      const assignments = await routeTask(task);
      if (assignments.length === 0) {
        return { status: 'no_eligible_peers', task_id: task.task_id, assignments: [] };
      }
      const results = await dispatchToAssignedPeers(assignments, task);
      for (const r of results) {
        await accrueMarks(r, task.source);
      }
      // BP092 I12 — Stamp-Certify hook: battery_dispatch_submission (fire-and-forget)
      void Promise.all([
        import('./ip_ledger/stamp_certify'),
        import('./ip_ledger/ring_bearer_keygen'),
      ]).then(([{ stampCertify }, { getRingBearerIdentity }]) => {
        const identity = getRingBearerIdentity();
        return stampCertify({
          contribution_type: 'battery_dispatch_submission',
          payload: JSON.stringify({ event: 'battery_dispatch_submission', dispatch_id: task.task_id, member_id: identity.peer_id, timestamp: Date.now() }),
        });
      }).catch((e: Error) => console.error('[ip_ledger hook] battery_dispatch_submission:', e));
      return { status: 'ok', task_id: task.task_id, results };
    } catch (err) {
      console.error('[mesh:dispatch-task] error:', (err as Error).message);
      return { status: 'error', error: (err as Error).message };
    }
  });

  safeHandle('mesh:get-activity-summary', async () => {
    try {
      const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!supabaseUrl || !supabaseKey) return { status: 'error', error: 'Supabase not configured' };

      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

      // Get active peers
      const { data: peers } = await sb.from('peer_presence').select('peer_id, wan_soccerball_id, machine_label, capabilities, last_seen_at, role').eq('status', 'active');

      // Get per-peer marks totals
      const { data: marksData } = await sb.from('peer_marks_log').select('peer_id, marks_earned, completed_at').order('completed_at', { ascending: false }).limit(1000);

      // Aggregate marks per peer
      const marksByPeer: Record<string, number> = {};
      const lastTaskByPeer: Record<string, string> = {};
      for (const row of (marksData ?? [])) {
        marksByPeer[row.peer_id] = (marksByPeer[row.peer_id] ?? 0) + row.marks_earned;
        if (!lastTaskByPeer[row.peer_id]) lastTaskByPeer[row.peer_id] = row.completed_at;
      }

      const peerSummary = (peers ?? []).map((p: Record<string, unknown>) => ({
        peer_id: p.peer_id,
        wan_soccerball_id: p.wan_soccerball_id,
        machine_label: p.machine_label ?? p.wan_soccerball_id,
        ram_tier: (p.capabilities as Record<string, unknown>)?.ramTier ?? 'unknown',
        model: (p.capabilities as Record<string, unknown>)?.ollamaModel ?? 'unknown',
        last_seen_at: p.last_seen_at,
        role: p.role ?? 'worker',
        marks_total: marksByPeer[p.peer_id as string] ?? 0,
        last_task_at: lastTaskByPeer[p.peer_id as string] ?? null,
      }));

      const totalMarks = Object.values(marksByPeer).reduce((a, b) => a + b, 0);

      return { status: 'ok', peers: peerSummary, total_marks: totalMarks };
    } catch (err) {
      return { status: 'error', error: (err as Error).message };
    }
  });
}

// --- Mesh Results Watcher (SEG-U-7 BP078) ------------------------------------
// Parses a mesh results JSON and returns typed metrics, or null on failure.
function parseMeshResultsFile(filePath: string): {
  hot_accuracy_pct: number;
  cold_accuracy_pct: number;
  delta_pp: number;
  fast_cheap_good: string;
  svgPath?: string;
} | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    const hot = typeof data.hot_accuracy_pct === 'number' ? data.hot_accuracy_pct
      : typeof data.hot_accuracy === 'number' ? data.hot_accuracy * 100
      : null;
    const cold = typeof data.cold_accuracy_pct === 'number' ? data.cold_accuracy_pct
      : typeof data.cold_accuracy === 'number' ? data.cold_accuracy * 100
      : null;

    if (hot === null || cold === null) return null;

    const delta = typeof data.delta_pp === 'number' ? data.delta_pp : hot - cold;
    const fcg = typeof data.fast_cheap_good === 'string' ? data.fast_cheap_good
      : typeof data.fast_cheap_good === 'number' ? String(data.fast_cheap_good)
      : '';

    return { hot_accuracy_pct: hot, cold_accuracy_pct: cold, delta_pp: delta, fast_cheap_good: fcg };
  } catch {
    return null;
  }
}

// Scan a directory for files matching a glob-like prefix/suffix pattern.
function findMatchingFile(dir: string, prefix: string, suffix: string): string | null {
  try {
    const files = readdirSync(dir);
    const match = files.find((f) => f.startsWith(prefix) && f.endsWith(suffix));
    return match ? join(dir, match) : null;
  } catch {
    return null;
  }
}

// Emit mesh-test-complete to all live windows that have a webContents.
function emitMeshComplete(metrics: {
  hot_accuracy_pct: number;
  cold_accuracy_pct: number;
  delta_pp: number;
  fast_cheap_good: string;
  svgPath?: string;
}): void {
  [overlayWindow, dashboardWindow].forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('mesh-test-complete', metrics);
    }
  });
}

// ─── BP080 Genesis Mint ───────────────────────────────────────────────────────
// STAGED — NOT called from app startup. Triggered only via ip-ledger:execute-genesis-mint
// IPC after Founder confirms the payload in GENESIS_MINT_DRAFT_PAYLOAD_BP080.md.
// Federal Body Cam doctrine: once written, the entry cannot be deleted — only superseded.

/** Generate vCard QR PNG for the Founder at resources/founder-vcard.png. */
async function generateFounderVcardQr(genesisLedgerId: string): Promise<string> {
  const QRCode = await import('qrcode');
  const qr = (QRCode.default ?? QRCode) as typeof import('qrcode');
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:FounderDenken',
    'ORG:MnemosyneC Cooperative',
    'EMAIL:Founder@LianaBanyan.com',
    'URL:https://mnemosynec.ai',
    `NOTE:User 000001 · MnemosyneC Cooperative Founder · 21 provisional filings · genesis:user:000001 · genesis_ledger_id: ${genesisLedgerId}`,
    'END:VCARD',
  ].join('\n');
  const outputPath = join(__dirname, '..', '..', 'resources', 'founder-vcard.png');
  await qr.toFile(outputPath, vcard, { width: 300, margin: 2 });
  return outputPath;
}

async function mintGenesisIfAbsent(): Promise<void> {
  try {
    const entries = loadAllEntries();
    if (entries.some(e => e.claim === 'genesis:user:000001')) return;
    registerClaim({
      registered_by: 'member_000001',
      claim: 'genesis:user:000001',
      claim_body: JSON.stringify({
        display_name: 'FounderDenken',
        cooperative_role: 'founder',
        provisional_filings: 21,
        filing_refs: [
          'LB-PROV-001 through LB-PROV-021',
          'USPTO App #64/079,336 (most recent, 2026-06-01)',
        ],
        cooperative_name: 'MnemosyneC',
        genesis_timestamp: new Date().toISOString(),
      }),
      evidence: [
        'Asteroid-ProofVault/BP070_CLOSE_STAMP.md',
        'USPTO App #64/079,336 filed 2026-06-01',
      ],
      category: 'provisional',
    });
    console.log('[Genesis] User 000001 minted in IP Ledger');
  } catch (e) {
    console.error('[Genesis] Mint failed:', e);
  }
}

// BP104 D4 — expire stale relay_routes for this peer at boot + every 60 min
async function bootZombieFlush(peerId: string, supabaseUrl: string, anonKey: string): Promise<number> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/expire_stale_routes_for_peer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ p_peer_id: peerId }),
    });
    if (!res.ok) {
      console.warn('[boot] zombie flush RPC non-200:', res.status);
      return 0;
    }
    const data = await res.json() as Array<{ expired_count?: number }> | { expired_count?: number };
    const count = Array.isArray(data) ? (data[0]?.expired_count ?? 0) : (data?.expired_count ?? 0);
    if (count > 0) {
      console.log(`[boot] flushed ${count} zombie routes`);
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('boot-zombie-flush', { count });
        }
      }
    }
    return count;
  } catch (e) {
    console.warn('[boot] zombie flush non-fatal:', e instanceof Error ? e.message : String(e));
    return 0;
  }
}

function scheduleZombieFlush(peerId: string): void {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  if (!supabaseUrl || !anonKey) return;

  if (_zombieFlushInterval) clearInterval(_zombieFlushInterval);
  _zombieFlushInterval = setInterval(() => {
    bootZombieFlush(peerId, supabaseUrl, anonKey).catch(() => { /* non-fatal */ });
  }, 60 * 60 * 1000);
}

// D6c — relay poll counter; incremented on each pollOnce() tick for watchdog monitoring
let _relayPollCount = 0;
let _relayPollInterval: NodeJS.Timeout | null = null;

// BP086 I5c: relay_routes poll loop — answers questions dispatched by orchestrator
// Polls every 5s; handles cross-WAN peers without IP-to-IP routing
function startRelayRoutePoll(peerId: string): NodeJS.Timeout {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[relay-poll] SUPABASE_URL or SUPABASE_ANON_KEY not set — relay poll disabled');
    return setInterval(() => {}, 999999);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  async function pollOnce() {
    _relayPollCount++;
    // K-D6-6-10: sync _relayPollCount to peer_presence every ~30s (every 6 polls × 5s cadence)
    // The heartbeat_worker sends relay_poller_poll_count:null which never updates the field;
    // this PATCH from the main thread is the only path that writes the actual count to Supabase.
    if (_relayPollCount % 6 === 1) {
      fetch(`${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ relay_poller_poll_count: _relayPollCount }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => { /* non-fatal */ });
    }
    try {
      const url = `${supabaseUrl}/rest/v1/relay_routes?target_peer_id=eq.${encodeURIComponent(peerId)}&status=eq.pending&select=id,hex_frame,payload_json,session_id`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const routes: Array<{ id: string; hex_frame: string; payload_json: Record<string, unknown> | null; session_id: string | null }> = await res.json();

      for (const route of routes) {
        // Mark processing
        await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'processing' }),
        });

        const startMs = Date.now();
        try {
          const payload = (route.payload_json as Record<string, unknown>) ?? {};
          const prompt: string = (payload.prompt as string) || route.hex_frame;
          const plowMaxIter: number = typeof payload.plow_max_iterations === 'number'
            ? (payload.plow_max_iterations as number) : 0;

          // BP105 K-D6-6-15: BEDROCK MODE RESTORED — the M14 Block 2 R1 hard-reject below
          // was PERMANENTLY REMOVED. It blocked plow_max_iterations=0/absent as an error,
          // which broke the Founder-direct Truthstone doctrine (Coffee BP104 §5):
          //   Layer 1-6 = substrate BEDROCK (single-shot inference, no Plow)
          //   Layer 7   = Truthstone GATE (test if bedrock answer is correct)
          //   Layer 8+  = 12-Blade Plow, ESCALATION-ONLY for questions that failed bedrock
          // plow_max_iterations=0 (or absent) is a LEGITIMATE bedrock-mode request, not an
          // error condition — it now falls through naturally to the pre-existing baseline
          // single-shot path (`else` branch below, "Baseline path: single-shot") which
          // already implements exactly this behavior. No new code path was needed.
          // Empirical anchor: BP105 T2 batch-1 (2026-07-04) — v0.5.17+ peers were rejecting
          // every bedrock-mode relay_route with error_reason: 'plow_none_rejected'.
          // Canon: canon_no_manual_unstick_no_pluto_screwdriver_ship_the_real_fix_from_source_to_hugo_bp105

          // BP090 TRIPLE-MAMBA: allotted_timeout_ms for approaching_timeout signal emission
          const allottedTimeoutMs: number = typeof payload.allotted_timeout_ms === 'number'
            ? (payload.allotted_timeout_ms as number) : 0;
          const isStarChamber: boolean = payload.is_star_chamber === true;
          const isTiebreaker: boolean = payload.is_tiebreaker === true;
          const tiebreakerModel: string = typeof payload.tiebreaker_model === 'string'
            ? (payload.tiebreaker_model as string) : 'qwen2.5:7b';

          let answer: string | null = null;
          let plowIterations = 0;
          let councilVariance = 0;
          let approachingTimeoutSignalSent = false;
          // BP093 Phase 3: Minor Council receipt per iteration
          const councilVotesPerIteration: Array<{ iter: number; valid: number; invalid: number; refine: number }> = [];

          if (plowMaxIter > 0) {
            // BP090 Plow Loop 12 + Minor Council Star Chamber
            // Fires 3 local judges per iteration; plurality-votes for answer letter;
            // iterates until confidence >= 0.75 (variance <= 0.25) or maxIterations reached.
            // BP106 v0.8.29 (Founder-empirical 2026-07-05): all-gemma council.
            // The pre-v0.8.29 array included llama3.1:8b + mistral:7b which are NOT
            // installed on the peer fleet (only gemma4:12b is · empirical: ollama list
            // on M0/M2/M3 shows single gemma4:12b entry). Those 2 calls per iteration
            // hit 404 model-not-found and were silently excluded from letterVotes,
            // making the "3-model council" empirically a 1-model council that wasted
            // 2/3 of the network round-trips. Council diversity now comes from
            // per-member temperature spread (see memberTemperature below) — 3 samples
            // of the same model at 3 different temperatures gives real plurality-vote
            // diversity without needing 3 distinct model files.
            const COUNCIL_MODELS = ['gemma4:12b', 'gemma4:12b', 'gemma4:12b'];
            const CONF_THRESHOLD = 0.75;
            const APPROACH_THRESHOLD = 0.80; // 80% of allotted timeout triggers signal

            for (let iter = 1; iter <= plowMaxIter; iter++) {
              plowIterations = iter;

              // BP090: approaching_timeout signal — emit once when >80% allotted time elapsed AND variance > 15%
              if (
                !approachingTimeoutSignalSent &&
                allottedTimeoutMs > 0 &&
                (Date.now() - startMs) > (allottedTimeoutMs * APPROACH_THRESHOLD) &&
                councilVariance > 0.15 &&
                answer !== null
              ) {
                approachingTimeoutSignalSent = true;
                // Build partial council votes from current best answer
                const partialVotes = [{ peer_id: peerId, answer: (() => {
                  const lm = answer?.match(/^\s*([A-J])\b/i)
                    || answer?.match(/Answer[:\s]+([A-J])\b/i)
                    || answer?.match(/\b([A-J])\s*\)/i);
                  return lm ? lm[1].toUpperCase() : null;
                })(), confidence: 1 - councilVariance }];
                // Write approaching_timeout signal to relay_route_replies (I8 MIC open-relay)
                fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
                  method: 'POST',
                  headers: { ...headers, 'Prefer': 'return=minimal' },
                  body: JSON.stringify({
                    route_id: route.id,
                    peer_id: peerId,
                    answer_json: {
                      reply_type: 'approaching_timeout',
                      question_id: payload.question_id ?? route.id,
                      partial_council_votes: partialVotes,
                      best_guess_answer: partialVotes[0]?.answer ?? null,
                      plow_loop_iteration: iter,
                      elapsed_ms: Date.now() - startMs,
                      allotted_timeout_ms: allottedTimeoutMs,
                      council_variance: councilVariance,
                    },
                    processing_ms: Date.now() - startMs,
                  }),
                }).catch(() => { /* non-fatal — signal is best-effort */ });
                console.log(`[relay-poll] approaching_timeout signal sent: route=${route.id.slice(0, 8)} iter=${iter} variance=${councilVariance.toFixed(3)} elapsed=${Date.now()-startMs}ms`);
              }

              // BP106 v0.8.29 (Founder-empirical 2026-07-05): per-council-member temperature
              // spread. Since all 3 council members are now the same gemma4:12b (v0.8.29
              // fix above), diversity across the 3 samples comes from temperature spacing
              // per index (0.15 spacing) plus a per-iteration bump (0.04 spacing).
              //   iter=1 · [temp 0.60, 0.75, 0.90] → 3 clearly-distinct samples
              //   iter=4 · [temp 0.72, 0.87, 1.00-clamped] → hot-spread final iter
              // Empirical rationale: 3 identical gemma4:12b calls at same temp DO produce
              // slightly-different outputs (ollama re-samples each call) but spread is
              // narrow. Explicit temperature spread widens the plurality-vote signal.
              const memberResults = await Promise.allSettled(
                COUNCIL_MODELS.map(async (m, idx) => {
                  const memberTemperature = Math.min(0.6 + (iter - 1) * 0.04 + idx * 0.15, 1.0);
                  const r = await fetch('http://localhost:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      model: m,
                      prompt,
                      stream: false,
                      keep_alive: '24h',
                      options: { temperature: memberTemperature },
                    }),
                    // D6a: 8-min hard ceiling per ollama call — prevents relay-poll worker hang on frozen model
                    signal: AbortSignal.timeout(480_000),
                  });
                  if (!r.ok) return { model: m, text: null as string | null };
                  const d = await r.json() as { response?: string };
                  return { model: m, text: d?.response ?? null };
                })
              );

              // Extract MMLU-Pro answer letter (A-J) from each member response
              const letterVotes: Array<{ letter: string; text: string }> = [];
              for (const res of memberResults) {
                if (res.status !== 'fulfilled' || !res.value?.text) continue;
                const t = res.value.text;
                // BP106 K-D6-6-16: added lax bare-A-J fallback so models that produce
                // prose without a canonical "Answer: X" prefix still contribute a vote.
                let lm = t.match(/^\s*([A-J])\s*$/i)
                  || t.match(/^\s*([A-J])\b/i)
                  || t.match(/Answer[:\s]+([A-J])\b/i)
                  || t.match(/\b([A-J])\s*\)/i)
                  || t.match(/\b([A-J])\./i)
                  || t.match(/^\s*([A-J])/im);
                if (!lm) {
                  // Last-resort: last bare A-J letter anywhere in text (often the model's final answer)
                  const allBare = t.match(/\b([A-J])\b/gi);
                  if (allBare && allBare.length > 0) {
                    const lastLetter = allBare[allBare.length - 1]!.toUpperCase();
                    lm = [lastLetter, lastLetter] as unknown as RegExpMatchArray;
                  }
                }
                if (lm) letterVotes.push({ letter: lm[1]!.toUpperCase(), text: t });
              }

              // BP106 K-D6-6-16 (Founder-empirical BP106 chunk-01 · 2026-07-05):
              // OLD behavior: `if (letterVotes.length === 0) break;` bailed the whole
              // loop at iter=1 whenever all 3 models produced prose without a letter —
              // making plow_max_iterations decorative and defaulting to ABSTAIN. NEW:
              // record a no-vote iteration receipt, keep councilVariance pinned to 1.0
              // (no convergence), and CONTINUE to the next iteration so we get another
              // shot at a valid letter under different temperature.
              if (letterVotes.length === 0) {
                councilVariance = 1.0;
                councilVotesPerIteration.push({ iter, valid: 0, invalid: COUNCIL_MODELS.length, refine: 0 });
                continue;
              }

              // Plurality vote across judges
              const counts: Record<string, number> = {};
              for (const v of letterVotes) counts[v.letter] = (counts[v.letter] ?? 0) + 1;
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              const topLetter = sorted[0]![0];
              const topCount = sorted[0]![1];
              // BP106 K-D6-6-16 (Founder-empirical BP106 chunk-01 · 2026-07-05):
              // OLD: `councilVariance = 1.0 - (topCount / letterVotes.length);`
              // computed against the SUBSET that parsed, not the full council. When
              // 1-of-3 parses a letter with 2-of-3 failing: 1/1 = 1.0 → variance 0.0 →
              // FALSE convergence at iter=1 with only 33% of the council responding.
              // Correct: use full council size as denominator. 1-of-3 → variance 0.667
              // → above threshold → keep iterating. Real convergence still allowed
              // when 3-of-3 agree (variance 0.0) or 2-of-3 agree (variance 0.333).
              councilVariance = 1.0 - (topCount / COUNCIL_MODELS.length);

              // Use the full response text of a judge that voted for the plurality letter
              answer = letterVotes.find((v) => v.letter === topLetter)?.text ?? letterVotes[0]!.text;

              // BP093 Phase 3: record per-iteration Minor Council vote receipt
              // Maps letter-vote plurality to VALID/INVALID/NEEDS_REFINEMENT semantics:
              //   valid  = judges that voted for the plurality (consensus) letter
              //   refine = judges that voted for a different letter (disagreement)
              //   invalid = council models that gave no parseable letter response
              const validVotes = topCount;
              const refineVotes = letterVotes.length - topCount;
              const invalidVotes = COUNCIL_MODELS.length - letterVotes.length;
              councilVotesPerIteration.push({ iter, valid: validVotes, invalid: invalidVotes, refine: refineVotes });

              // Early stop when confidence (1 - variance) >= threshold
              // NOTE: variance now computed against full council (not the parsed subset)
              // so this only fires on genuine majority-convergence, not 1-of-3-artifact.
              if (councilVariance <= (1.0 - CONF_THRESHOLD)) break;
            }
            if (isStarChamber) {
              console.log(`[relay-poll] star-chamber-council: route=${route.id.slice(0, 8)} iter=${plowIterations}/${plowMaxIter} variance=${councilVariance.toFixed(3)}`);
            } else {
              console.log(`[relay-poll] plow-council: route=${route.id.slice(0, 8)} iter=${plowIterations}/${plowMaxIter} variance=${councilVariance.toFixed(3)}`);
            }

          } else {
            // Baseline path: single-shot (pre-BP090 behaviour); tiebreaker model override per M14 Block 3
            const model = isTiebreaker ? tiebreakerModel : 'gemma4:12b';
            const ollamaRes = await fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model, prompt, stream: false, keep_alive: '24h' }),
              // D6a: 8-min hard ceiling per ollama call — prevents relay-poll worker hang on frozen model
              signal: AbortSignal.timeout(480_000),
            });
            const ollamaData = ollamaRes.ok ? await ollamaRes.json() as { response?: string } : null;
            answer = ollamaData?.response ?? null;
          }

          // BP094 Session 9 BLOCK D: guard against negative processingMs (clock skew / async drift)
          const rawProcessingMs = Date.now() - startMs;
          const processingMs = rawProcessingMs >= 0 ? rawProcessingMs : 0;
          if (rawProcessingMs < 0) {
            console.warn(`[WARN] negative delay corrected to 0 (raw=${rawProcessingMs}ms) in relay-poll processingMs -- clock skew detected`);
          }

          // M14 Block 2: structured ABSTAIN when answer is null
          let abstainReason: string | null = null;
          if (answer === null) {
            if (plowMaxIter > 0 && plowIterations >= plowMaxIter) {
              abstainReason = 'max_iterations_reached';
            } else if (plowMaxIter > 0) {
              abstainReason = 'council_did_not_converge';
            } else {
              abstainReason = 'model_empty_response';
            }
          }

          await fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              route_id: route.id,
              peer_id: peerId,
              answer_json: abstainReason !== null ? {
                answer: 'ABSTAIN',
                abstain_reason: abstainReason,
                correct: false,
                escalation_eligible: true,
                plow_loop_iterations: plowIterations,
                legacy_null: null,
              } : {
                answer,
                plow_loop_iterations: plowIterations,
                iterations_run: plowIterations,
                council_variance: councilVariance,
                council_votes_per_iteration: councilVotesPerIteration,
                approaching_timeout_signal_sent: approachingTimeoutSignalSent,
                is_star_chamber: isStarChamber,
              },
              processing_ms: processingMs,
            }),
          });

          await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'answered' }),
          });

          console.log(`[relay-poll] answered route ${route.id.slice(0, 8)} in ${processingMs}ms`);
        } catch (err) {
          // D6a: detect AbortSignal timeout from ollama call — log + write structured error row
          const isOllamaTimeout = err instanceof Error &&
            (err.name === 'TimeoutError' || err.name === 'AbortError') &&
            (err.message?.includes('11434') || String(err).includes('11434') || true);
          if (isOllamaTimeout && err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
            console.warn(`[WORKER] ollama call aborted after 8min · marking route error · route=${route.id.slice(0, 8)}`);
            try {
              await fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                  route_id: route.id,
                  peer_id: peerId,
                  answer_json: { status: 'error', error_message: 'ollama_timeout_8min', error_detail: 'AbortSignal.timeout(480000) fired — ollama did not respond within 8 minutes' },
                  processing_ms: Date.now() - startMs,
                }),
              });
            } catch { /* best-effort */ }
          } else {
            console.warn(`[relay-poll] error on route ${route.id.slice(0, 8)}:`, err);
          }
          await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'error' }),
          });
        }
      }
    } catch {
      // Silent — don't crash main process on poll error
    }
  }

  console.log(`[relay-poll] started for peer=${peerId.slice(0, 8)}`);
  const interval = setInterval(pollOnce, 5000);
  _relayPollInterval = interval;
  return interval;
}

// D6c — self-heal watchdog: monitors relay_poller_poll_count delta; respawns poll loop when frozen
function startRelayPollWatchdog(peerId: string): void {
  const { app: electronApp } = require('electron') as typeof import('electron');
  const { join: pathJoin } = require('path') as typeof import('path');
  const { mkdirSync: fsMkdirSync, appendFileSync: fsAppendFileSync } = require('fs') as typeof import('fs');

  let lastPollCount = _relayPollCount;
  const watchdogLogDir = pathJoin(electronApp.getPath('appData'), 'MnemosyneC', 'logs');
  try { fsMkdirSync(watchdogLogDir, { recursive: true }); } catch { /* ignore */ }
  const watchdogLogPath = pathJoin(watchdogLogDir, 'watchdog.log');

  function watchdogLog(msg: string): void {
    const line = `${new Date().toISOString()} [watchdog] ${msg}\n`;
    console.log(`[watchdog] ${msg}`);
    try { fsAppendFileSync(watchdogLogPath, line, 'utf8'); } catch { /* non-fatal */ }
  }

  watchdogLog(`watchdog started · peer=${peerId.slice(0, 8)} · log=${watchdogLogPath}`);

  setInterval(() => {
    const currentCount = _relayPollCount;
    const delta = currentCount - lastPollCount;
    lastPollCount = currentCount;

    watchdogLog(`poll_count_check · delta=${delta} · total=${currentCount}`);

    // If fewer than 3 polls happened in 60s (5s cadence → ~12/min expected), worker is frozen
    if (delta < 3) {
      watchdogLog(`FROZEN DETECTED: delta=${delta} < 3 · killing relay-poll interval and respawning`);
      if (_relayPollInterval) {
        clearInterval(_relayPollInterval);
        _relayPollInterval = null;
      }
      // Respawn — peer_id preserved via D3 keypair (already on disk)
      const newInterval = startRelayRoutePoll(peerId);
      _relayPollInterval = newInterval;
      watchdogLog(`respawned relay-poll · new interval registered · peer=${peerId.slice(0, 8)}`);
    }
  }, 60_000);
}

// BP086 I7c: MIC fleet broadcast listener — subscribes to fleet_broadcast Realtime channel
// Handles 6 broadcast_types; writes acks via REST. Real implementations (PATH X).

async function postAck(
  broadcastId: string,
  peerId: string,
  appVersion: string,
  ackType: string,
  resultJson: Record<string, unknown>,
): Promise<void> {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  if (!supabaseUrl || !supabaseKey) return;

  await fetch(`${supabaseUrl}/rest/v1/fleet_broadcast_ack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      'on_conflict': 'broadcast_id,peer_id',
    },
    body: JSON.stringify({
      broadcast_id: broadcastId,
      peer_id: peerId,
      app_version: appVersion,
      ack_type: ackType,
      result_json: resultJson,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[mic-broadcast] ack POST failed HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  }).catch((e) => {
    console.warn(`[mic-broadcast] ack POST threw: ${String(e).slice(0, 200)}`);
  });
}

function startMicBroadcastListener(peerId: string, appVersion: string): void {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[mic-broadcast] SUPABASE_URL or SUPABASE_ANON_KEY not set — listener disabled');
    return;
  }

  // Use Supabase Realtime JS-compatible WebSocket polling via REST long-poll fallback.
  // We poll fleet_broadcast for active rows and dispatch on new ones not yet acked.
  // Full WebSocket Realtime would require the @supabase/supabase-js in main process;
  // for now we use a 10s poll which is reliable across all network conditions.

  const processedIds = new Set<string>();

  async function dispatchBroadcast(payload: {
    id: string;
    broadcast_type: string;
    payload_json: Record<string, unknown>;
    target_version: string | null;
    target_tier: string;
    target_peer_ids: string[] | null;
  }): Promise<void> {
    const broadcastId = payload.id;

    // Skip if this peer is not targeted
    if (
      payload.target_peer_ids &&
      payload.target_peer_ids.length > 0 &&
      !payload.target_peer_ids.includes(peerId)
    ) return;

    console.log(`[mic-broadcast] dispatching type=${payload.broadcast_type} id=${broadcastId.slice(0, 8)}`);

    switch (payload.broadcast_type) {
      case 'noop_test': {
        await postAck(broadcastId, peerId, appVersion, 'completed', {
          ok: true,
          message: 'noop received',
          peer_id: peerId,
          app_version: appVersion,
          platform: process.platform,
        });
        console.log(`[mic-broadcast] noop_test acked`);
        break;
      }

      case 'health_snapshot': {
        try {
          const psRes = await fetch('http://localhost:11434/api/ps', {
            signal: AbortSignal.timeout(5000),
          });
          const psData = psRes.ok ? await psRes.json() : null;
          const loadedModels: Array<{ name: string; size_vram: number; expires_at: string }> =
            psData?.models ?? [];

          const tagsRes = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(5000),
          });
          const tagsData = tagsRes.ok ? await tagsRes.json() : null;
          const availableModels: string[] = (tagsData?.models ?? []).map(
            (m: { name: string }) => m.name,
          );

          await postAck(broadcastId, peerId, appVersion, 'completed', {
            app_version: appVersion,
            peer_id: peerId,
            platform: process.platform,
            ollama_reachable: psRes.ok,
            loaded_models: loadedModels.map(m => ({
              name: m.name,
              size_vram_mb: Math.round((m.size_vram ?? 0) / 1024 / 1024),
              expires_at: m.expires_at,
            })),
            available_models: availableModels,
          });
        } catch (err) {
          await postAck(broadcastId, peerId, appVersion, 'error', {
            error: String(err),
            ollama_reachable: false,
          });
        }
        break;
      }

      case 'fleet_warmup': {
        const warmModel =
          (payload.payload_json?.model as string) || 'gemma4:12b';
        const warmupPrompt =
          (payload.payload_json?.prompt as string) ||
          'Answer with only the letter A. What is 1+1? A) 2 B) 3\nAnswer:';

        await postAck(broadcastId, peerId, appVersion, 'processing', {
          model: warmModel,
          status: 'warming',
        });

        const warmStart = Date.now();
        try {
          const res = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: warmModel,
              prompt: warmupPrompt,
              stream: false,
              keep_alive: '24h',
            }),
            signal: AbortSignal.timeout(120000),
          });
          const warmMs = Date.now() - warmStart;
          const data = res.ok ? await res.json() : null;

          await postAck(broadcastId, peerId, appVersion, 'completed', {
            model: warmModel,
            status: 'hot',
            load_latency_ms: warmMs,
            keep_alive: '24h',
            test_answer: (data?.response as string)?.trim()?.slice(0, 5) ?? null,
          });
          console.log(`[mic-broadcast] warmed ${warmModel} in ${warmMs}ms`);
        } catch (err) {
          await postAck(broadcastId, peerId, appVersion, 'error', {
            model: warmModel,
            error: String(err),
          });
        }
        break;
      }

      case 'config_set': {
        const key = payload.payload_json?.key as string;
        const value = payload.payload_json?.value as string;

        if (key === 'ollama.model_pull' && value) {
          await postAck(broadcastId, peerId, appVersion, 'processing', {
            model: value,
            status: 'pulling',
          });

          const pullStart = Date.now();
          try {
            const { execFile } = await import('child_process');
            const { promisify } = await import('util');
            const execFileAsync = promisify(execFile);

            await execFileAsync('ollama', ['pull', value], { timeout: 1800000 });
            const pullMs = Date.now() - pullStart;

            await postAck(broadcastId, peerId, appVersion, 'completed', {
              model: value,
              status: 'ready',
              pull_ms: pullMs,
              pull_seconds: Math.round(pullMs / 1000),
            });
            console.log(`[mic-broadcast] pulled ${value} in ${Math.round(pullMs / 1000)}s`);
            // BP092 I12 — Stamp-Certify hook: config_set model pull (fire-and-forget)
            void Promise.all([
              import('./ip_ledger/stamp_certify'),
              import('./ip_ledger/ring_bearer_keygen'),
            ]).then(([{ stampCertify }, { getRingBearerIdentity }]) => {
              const identity = getRingBearerIdentity();
              return stampCertify({
                contribution_type: 'config_set_model_pull',
                payload: JSON.stringify({ event: 'config_set_model_pull', model_id: value, peer_id: identity.peer_id, timestamp: Date.now() }),
              });
            }).catch((e: Error) => console.error('[ip_ledger hook] config_set_model_pull:', e));
          } catch (err) {
            await postAck(broadcastId, peerId, appVersion, 'error', {
              model: value,
              error: String(err),
            });
          }
        } else {
          await postAck(broadcastId, peerId, appVersion, 'completed', {
            key,
            value,
            applied: true,
          });
        }
        break;
      }

      case 'auto_update': {
        const version = payload.payload_json?.version as string || payload.target_version;
        const restartMode = (payload.payload_json?.restart_mode as string) || 'prompt';
        console.log(`[mic-broadcast] auto_update broadcast received: v${version} restart_mode=${restartMode}`);
        await postAck(broadcastId, peerId, appVersion, 'received', {
          target_version: version,
          restart_mode: restartMode,
          message: 'auto_update received — triggering autoUpdater.checkForUpdates()',
        });
        // Trigger the electron autoUpdater to check for the new version
        try {
          const { autoUpdater } = await import('electron-updater');
          autoUpdater.checkForUpdates().catch(e =>
            console.warn('[mic-broadcast] autoUpdater.checkForUpdates error:', e),
          );
        } catch (e) {
          console.warn('[mic-broadcast] autoUpdater import error:', e);
        }
        break;
      }

      case 'benchmark_run': {
        const benchmarkId = payload.payload_json?.benchmark_id as string;
        const coordinationToken = payload.payload_json?.coordination_token as string;
        console.log(`[mic-broadcast] benchmark_run dispatch received: benchmark_id=${benchmarkId}`);
        await postAck(broadcastId, peerId, appVersion, 'received', {
          benchmark_id: benchmarkId,
          coordination_token: coordinationToken,
          message: 'benchmark_run received — participation via wan-relay-route',
        });
        break;
      }

      default:
        console.warn(`[mic-broadcast] unknown broadcast_type: ${payload.broadcast_type}`);
        break;
    }
  }

  async function pollBroadcasts(): Promise<void> {
    try {
      // BP087 I10: 600s lookback = 2× default TTL (was 60s — missed broadcasts issued before relaunch)
      const since = new Date(Date.now() - 600000).toISOString();
      const url =
        `${supabaseUrl}/rest/v1/fleet_broadcast` +
        `?status=eq.active&created_at=gte.${encodeURIComponent(since)}` +
        `&select=id,broadcast_type,payload_json,target_version,target_tier,target_peer_ids`;

      const res = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`[mic-broadcast] poll HTTP ${res.status}: ${body.slice(0, 200)}`);
        return;
      }

      const broadcasts: Array<{
        id: string;
        broadcast_type: string;
        payload_json: Record<string, unknown>;
        target_version: string | null;
        target_tier: string;
        target_peer_ids: string[] | null;
      }> = await res.json();

      for (const bc of broadcasts) {
        if (processedIds.has(bc.id)) continue;
        processedIds.add(bc.id);
        dispatchBroadcast(bc).catch(e =>
          console.warn(`[mic-broadcast] dispatch error for ${bc.id.slice(0, 8)}:`, e),
        );
      }

      // Trim processedIds set to prevent unbounded growth
      if (processedIds.size > 500) {
        const arr = Array.from(processedIds);
        arr.slice(0, 250).forEach(id => processedIds.delete(id));
      }
    } catch (e) {
      console.warn(`[mic-broadcast] poll failed: ${String(e).slice(0, 200)}`);
    }
  }

  setInterval(pollBroadcasts, 10000);
  // Poll immediately on startup to catch any recent broadcasts
  setTimeout(pollBroadcasts, 2000);

  console.log(`[mic-broadcast] listener started peer=${peerId.slice(0, 8)} version=${appVersion}`);
}

function setupMeshResultsWatcher(): void {
  const bishopDropDir = join(__dirname, '..', '..', 'BISHOP_DROPZONE', '00_FOUNDER_REVIEW');
  const localResultsDir = join(homedir(), '.mnemosynec', 'test-data', 'mmlu-pro', 'results');

  // Check-and-emit helper; also looks for a companion SVG.
  function checkAndEmit(dir: string, prefix: string, suffix: string): void {
    const filePath = findMatchingFile(dir, prefix, suffix);
    if (!filePath || !existsSync(filePath)) return;

    const metrics = parseMeshResultsFile(filePath);
    if (!metrics) return;

    const svgMatch = findMatchingFile(dir, 'MESH_TEST_BIG_NUMBERS_', '.svg');
    if (svgMatch) metrics.svgPath = svgMatch;

    emitMeshComplete(metrics);
  }

  function checkAndEmitShard(dir: string): void {
    const filePath = join(dir, 'shard_M1_results.json');
    if (!existsSync(filePath)) return;

    const metrics = parseMeshResultsFile(filePath);
    if (!metrics) return;

    emitMeshComplete(metrics);
  }

  // Startup scan -- fire immediately if files already present.
  checkAndEmit(bishopDropDir, 'MESH_TEST_RESULTS_v0135_', '.json');
  checkAndEmitShard(localResultsDir);

  // Watch BISHOP_DROPZONE dir for new results files (fs.watch; chokidar would be more robust).
  if (existsSync(bishopDropDir)) {
    try {
      fsWatch(bishopDropDir, { persistent: false }, (_eventType, filename) => {
        if (!filename) return;
        if (filename.startsWith('MESH_TEST_RESULTS_v0135_') && filename.endsWith('.json')) {
          checkAndEmit(bishopDropDir, 'MESH_TEST_RESULTS_v0135_', '.json');
        }
      });
    } catch (e) {
      console.warn('[mesh-watcher] Could not watch', bishopDropDir, e);
    }
  }

  // Watch local results dir for shard_M1_results.json.
  if (existsSync(localResultsDir)) {
    try {
      fsWatch(localResultsDir, { persistent: false }, (_eventType, filename) => {
        if (filename === 'shard_M1_results.json') {
          checkAndEmitShard(localResultsDir);
        }
      });
    } catch (e) {
      console.warn('[mesh-watcher] Could not watch', localResultsDir, e);
    }
  }
}

// --- App Lifecycle ------------------------------------------------------------

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(async () => {
  // BP094 v0.8.0 - DevTools enablement + verbose logging for beta build
  process.env.ELECTRON_ENABLE_LOGGING = '1';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

  // BP038 Frame-boilerplate ? pre-bind port guard (singleton reuse pattern).
  // If another AMPLIFY is already on API_PORT, exit cleanly instead of EADDRINUSE crash.
  const probe = await probeSubstrateApiPort(API_PORT);
  if (probe.occupied) {
    if (probe.holder === 'another_amplify') {
      console.warn(`[LB Frame] another AMPLIFY is already running on :${API_PORT} ? this duplicate instance will exit cleanly (singleton reuse). Close the existing instance first if you intended to restart.`);
    } else {
      console.error(`[LB Frame] :${API_PORT} is held by an unknown service. AMPLIFY cannot bind. Free the port or set SUBSTRATE_API_PORT to an alternate.`);
    }
    app.quit();
    return;
  }

  // SEG-V0148-P1-RENAME-USERDATA: migrate amplify-computer → mnemosynec on first launch after rename
  migrateUserDataIfNeeded();

  // v0.4.1 BP083: Catacomb migration check (Preserved-Forever 1-year pheromone-fade)
  runCatacombMigrationCheck().catch((err) =>
    console.error('[Main] CatacombMigrationCheck error (non-fatal):', err),
  );

  // BP083 SEG-1/2/4: ensure 6-folder substrate scaffold + MEMORY.md + TestData seeds
  try {
    const mnemoBaseDir = ensureMnemosyneCFolders();
    generateMemoryMd(mnemoBaseDir, app.getVersion());
    populateTestDataSeeds(mnemoBaseDir);
    console.log(`[BP083] MnemosyneC substrate scaffold ready at ${mnemoBaseDir}`);
  } catch (err) {
    console.error('[BP083] Scaffold failed (non-fatal):', err);
  }

  // SEG-1 v0.3.7: pre-seed substrate with Starter Chocolate Pack (idempotent)
  installStarterChocolate((msg) => console.log(msg)).then(({ installed, skipped, error }) => {
    if (error) {
      console.warn('[StarterChocolate] Non-fatal install error:', error);
    } else if (!skipped) {
      console.log(`[StarterChocolate] First-launch seeding complete: ${installed} eblets written`);
    }
  }).catch((e) => console.warn('[StarterChocolate] Unexpected error (non-fatal):', e));

  // A-2 BP081 v0.1.59.1: Startup eblet store integrity check (non-fatal)
  try {
    const { runStartupIntegrityCheck } = await import('./mnem_eblet_store');
    await runStartupIntegrityCheck();
  } catch (e) {
    console.error('[Startup] Eblet integrity check failed (non-fatal):', e);
  }

  // BP132 Yoke #21 E10: warm the eblet + canonical index on boot (fire-and-forget,
  // non-blocking) instead of only ever lazily rebuilding on the first Ask. See
  // mnem_eblet_store.ts warmEbletIndex() for the full rationale.
  import('./mnem_eblet_store')
    .then(({ warmEbletIndex }) => warmEbletIndex())
    .catch((e) => console.error('[Startup] Eblet index warm-up failed (non-fatal):', e));

  // Initialize substrate API server (Phase 3: full implementation)
  substrateServer = new SubstrateAPIServer();
  await substrateServer.start();

  // SEG-V0148-P0-GLANCE: wire mesh progress update to tray tooltip refresh
  substrateServer.setMeshProgressUpdateHook(() => updateTrayTooltip());

  // Initialize federation client (uses the substrate index from the API server)
  federationClient = new FederationClient(substrateServer.getIndex());
  substrateServer.setFederationClient(federationClient);
  await federationClient.start();

  // Initialize Ollama manager singleton (SEG-1 v0.1.55)
  // SEG-V0147-FIX-1 / SEG-V0148-P2: wire IPC heartbeat callback BEFORE init() so renderer
  // never goes silent >3s, and so _capturedOllamaBranch is updated for the diagnostic log.
  ollamaManager.setStatusUpdateCallback((update) => {
    _capturedOllamaBranch = update.branch;
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send('ollama-status-update', update);
    });
  });
  await ollamaManager.init();

  // SEG-V0148-P2: capture resolved path + branch after init() completes
  _capturedOllamaPath = ollamaManager.getResolvedBinaryPath();
  _capturedOllamaBranch = ollamaManager.getResolvedBranch();

  // SEG-V0148-P0-SKU-MODEL: promote to full-tier model if sku_tier.json says 'full'
  {
    const skuPromo = await ollamaManager.resolveActiveModel();
    _capturedActiveModel = skuPromo.activeModel;
    _capturedTargetModel = skuPromo.targetModel;
    if (skuPromo.mismatch) {
      console.warn(
        `[SKU] Full tier active but targetModel=${skuPromo.targetModel} not in ollama list — ` +
        `mesh test results will NOT be comparable to published benchmarks.`,
      );
    }
  }

  // M18b: Resolve effective model (honors right-size.json override) once at startup
  {
    const { resolveEffectiveModel, setCachedEffectiveModel } = await import('./hardware/ram_detector');
    try {
      const effectiveResult = await resolveEffectiveModel();
      setCachedEffectiveModel(effectiveResult);
      if (effectiveResult.overrideActive) {
        console.log(`[M18b] Override active: ${effectiveResult.model} (auto was ${effectiveResult.autoDetectedModel})`);
      }
      if (effectiveResult.warning) {
        console.warn(`[M18b] ${effectiveResult.warning}`);
      }
    } catch (e) {
      console.error('[M18b] resolveEffectiveModel failed (non-fatal):', e);
    }
  }

  // SAGA 4 ? In Conjunction Agent Panel: load persisted keys + plugins at startup
  loadPersistedApiKeys();
  ensurePluginDir();
  const { errors: pluginErrors } = loadPlugins();
  if (pluginErrors.length > 0) {
    console.warn('[SAGA4 plugins] Load errors:', pluginErrors);
  }
  watchPluginDir((_updatedAgents) => {
    // Notify conjunction window when plugins change (future: push IPC event)
    console.log('[SAGA4 plugins] Plugin roster updated');
  });

  // Initialize auto-updater
  autoUpdater = new AutoUpdateManager();
  autoUpdater.init();
  // KniPr026: reflect update state in tray tooltip (available / downloading / ready)
  autoUpdater.onStateChanged((state) => updateTrayTooltip(state.status));

  // M21: Automatic update scheduler startup (Block 2, 4, 6)
  migrateAutoInstallConfig();
  checkAndTriggerPendingInstall().catch((e) =>
    console.error('[auto-update] checkAndTriggerPendingInstall error:', e),
  );
  if (getAutoUpdateConfig().autoUpdates) {
    startAutoUpdateLoop();
  }

  // MV-CN: Peer discovery + WAN relay (SAGA 3 BP045 W1)
  // BP104 D3: load Ed25519 keypair-derived peer_id before mesh init
  await initializeLocalPeerKeypair();
  const peerId = getStablePeerId();
  peerDiscovery = new PeerDiscovery(peerId);
  relayClient = new RelayClient(peerId, peerDiscovery);
  peerDiscovery.startLAN().catch((e) => console.warn('[PeerDiscovery] LAN start error:', e));
  relayClient.start();

  // MESH-6: Wire relay inbound hook for sid_fetch_*, pointer_advance
  relayClient.setInboundHook(_handleInboundMeshMsg);

  // BP087 MAMBA-Row3: wire relay emit hook for substrace_wake_complete outbound
  setRelayEmitHook((msg, toPeerId) => {
    relayClient?.sendToPeer(toPeerId, msg as import('../shared/federation-protocol').FedMsg);
  });

  // BP072: Initialize Paired-Frame Mutual-Aid layer
  pairedFrameManager = new PairedFrameManager(peerId, peerDiscovery, relayClient);
  pairedFrameManager.start();
  // Wire TCP inbound hook so pair_*/assist_* messages arriving on port 11481 are handled
  federationClient?.setInboundHook((msg) => pairedFrameManager?.handleInbound(msg as FedMsg));
  // Log assist-mode state changes
  pairedFrameManager.on('assist-mode-entered', (partnerId) => {
    console.log(`[BP072] ASSIST_MODE ENTERED for partner=${partnerId} ? healthy frame now serving`);
    _broadcastMeshStateChanged();
  });
  pairedFrameManager.on('assist-mode-exited', (partnerId) => {
    console.log(`[BP072] ASSIST_MODE EXITED ? partner=${partnerId ?? 'none'} back online`);
    _broadcastMeshStateChanged();
  });

  // MESH-6: Wire pointer-advance hook from caithedral tools IPC
  setMeshPointerAdvanceHook(_emitPointerAdvanceToPeers);

  // BP067 Correction 2: Wire folder?DAG bridge mesh hook
  setDagBridgeMeshHook(_emitPointerAdvanceToPeers);

  // MESH-6 Option-B: Wire HTTP /dag/emit endpoint to the same pointer_advance broadcast
  setDagEmitMeshHook(_emitPointerAdvanceToPeers);

  // SEG-WAN-2: Wire WAN soccerball hook + status emitter
  setWanSoccerballHook(createWanSoccerballResolver(async (_peerId: string) => {
    // TODO: wire to wan-lookup-by-email when session has LB auth
    return null;
  }));
  setWanStatusEmitter((status: string) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('wan-status-update', { status, ts: new Date().toISOString() });
      }
    }
  });

  // MESH-6 Option-B: Wire HTTP /dag/fetch_from_peer to _fetchSidViaTCP
  setFetchSidFromPeerHook(async (address, port, dag_id) => {
    const peer = {
      peerId: 'http-test-peer',
      displayName: 'HTTP test peer',
      address,
      port,
      transport: 'lan' as const,
      phase: 'identified' as const,
      lastSeen: new Date().toISOString(),
    };
    const reqMsg: FedMsg = {
      type: 'sid_fetch_request',
      peerId: getStablePeerId(),
      payload: { dag_id, requester_peer_id: getStablePeerId() } satisfies SidFetchRequestPayload,
      ts: new Date().toISOString(),
    };
    return _fetchSidViaTCP(peer, dag_id, reqMsg);
  });

  // MESH-6: Inject mDNS peer source into FederationClient
  federationClient?.setPeerDiscoverySource(() =>
    (peerDiscovery?.getAllPeers() ?? [])
      .filter((p) => p.transport === 'lan')
      .map((p) => ({ address: p.address, port: p.port })),
  );

  const firstRun = isFirstRun();
  if (firstRun) {
    lanHandshakeEligible = true;
    setTimeout(() => { lanHandshakeEligible = false; }, 90_000);
    setupLanHandshakeDiscovery();
  }

  // Initialize auth manager (Phase 7)
  authManager = new AuthManager();
  authManager.init();
  authManager.onStateChanged((state) => {
    substrateServer?.setDegradedMode(state.degraded);
    if (state.degraded && substrateServer?.getEffectiveMode() === 'ai_burst') {
      setMode('fallback');
    }
  });

  // ?6 BP041 ? Hide Electron menu bar by default (non-technical member protection).
  // Ctrl+Shift+D toggles developer menu on/off at runtime.
  Menu.setApplicationMenu(null);

  // SAGA-? v0.1.10 ? SubstratedFolderWatcher? singleton (must be after app.ready for getPath)
  folderWatcher = new SubstratedFolderWatcher();

  // Create tray only ? overlay is opt-in (tray ? Show Overlay, or Burst Mode).
  // SAGA-1 BP055: Dashboard is the default boot surface; overlay never auto-creates.
  createTray();
  registerIPCHandlers();

  // SAGA 10 BP045 W1 ? Register mnemosyne:// + mnemo:// deep-link protocols (BP065)
  registerDeepLinkProtocol(
    () => dashboardWindow ?? hearthConjunctionWindow ?? overlayWindow ?? null,
    (payload: DeepLinkPayload) => {
      if (payload.type === 'accept-invite') {
        console.log('[deep-link] accept-invite received for slug:', payload.slug, 'token prefix:', payload.token.slice(0, 12));
        // SEG-V0153A: open dashboard (default boot surface) and route to Accept tab
        openDashboard({ focus: true });
        const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
        for (const win of wins) {
          if (win && !win.isDestroyed()) {
            win.webContents.send('federation:deep-link-accept', {
              slug: payload.slug,
              token: payload.token,
            });
          }
        }
      } else if (payload.type === 'focus-tab') {
        // BP067 Phase 3B ? mnemo://focus/<tab_id> ? navigate to tab
        console.log('[deep-link] focus-tab received:', payload.tabId);
        openDashboard({ focus: true });
        const win = dashboardWindow;
        if (win && !win.isDestroyed()) {
          win.webContents.send('navigate:focus-tab', { tabId: payload.tabId });
        }
      } else if (payload.type === 'lb-auth-callback') {
        // BP065 Part A ? Complete the LB Account magic-link auth flow
        console.log('[deep-link] lb-auth-callback received');
        void (async () => {
          const result = await completeLBAuth(
            payload.access_token,
            payload.refresh_token,
            payload.email,
          );
          // Broadcast auth-complete to all windows so LBAccountTab updates
          const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
          for (const win of wins) {
            if (win && !win.isDestroyed() && result.ok && result.session) {
              win.webContents.send('lb:auth-complete', {
                user_id: result.session.user_id,
                email: result.session.email,
                peer_id: result.session.peer_id,
                crewman_number: result.session.crewman_number,
              });
            }
          }
        })();
      } else if (payload.type === 'membership-activated') {
        // BP085 — mnemosynec://membership-active?member_id=...&token=...
        // NEVER log token value (BP085 BLOOD)
        console.log('[deep-link] membership-activated received for member_id:', payload.memberId);
        void (async () => {
          await handleMembershipReturn(payload.memberId, payload.token);
        })();
      }
    },
  );
  // Handle cold-start deep-link (Windows: URL passed via argv)
  handleStartupDeepLink(process.argv, () => hearthConjunctionWindow ?? overlayWindow ?? null);

  // SAGA-1 BP055: Dashboard is now the default boot surface on every launch.
  // Overlay only appears via tray right-click ? Show Overlay / Burst Mode (opt-in).
  // MNEMOSYNE_NO_AUTO_OPEN=1 skips auto-open (CI / headless environments).
  if (process.env.MNEMOSYNE_NO_AUTO_OPEN !== '1') {
    openDashboard({ focus: true });
    // BP067: first_run.flag is set only after launch-walk completes (mark-bp067-first-run-complete IPC).
  }

  // BP092 I12 — Start IP Ledger Mesh Diff Loop (battery-aware · LAN-as-WAN · 15min)
  // Close keeps mesh alive; loop stops only on Quit (canon_close_keeps_mesh_alive).
  import('./ip_ledger/mesh_diff_loop').then(({ startMeshDiffLoop }) => {
    startMeshDiffLoop();
  }).catch((e: Error) => console.error('[mesh_diff_loop] start failed:', e));

  const okQuit = globalShortcut.register('CommandOrControl+Shift+Alt+Q', () => {
    app.quit();
  });
  const okHide = globalShortcut.register('CommandOrControl+Shift+Alt+H', () => {
    overlayWindow?.hide();
    dashboardWindow?.hide();
  });

  // BP041 SAGA 3 + SEG-5 v0.1.59: Ctrl+Shift+M.
  // When dashboard is open: trigger clipboard Q+A capture (SEG-5).
  // Otherwise: toggle HearthConjunctionWindow between Watch View and Configure View (BP041).
  const okWatchToggle = globalShortcut.register('CommandOrControl+Shift+M', () => {
    // SEG-5 v0.1.59: clipboard capture → dashboard (highest priority when dashboard is open)
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('clipboard:capture-qa');
      return;
    }
    // BP041 SAGA 3 fallback: HearthConjunctionWindow toggle when dashboard is not open
    if (!hearthConjunctionWindow || hearthConjunctionWindow.isDestroyed()) {
      openHearthConjunctionWindow();
      return;
    }
    if (hearthConjunctionWindow.isVisible()) {
      hearthConjunctionWindow.hide();  // ? Watch View
    } else {
      hearthConjunctionWindow.show();  // ? Configure View
      hearthConjunctionWindow.focus();
    }
  });
  if (!okWatchToggle) {
    console.warn('[index] Ctrl+Shift+M shortcut registration failed (already registered by another app)');
  }

  // ?6 ? Dev menu toggle: Ctrl+Shift+D shows/hides the Electron application menu
  let devMenuVisible = false;
  const okDevMenu = globalShortcut.register('CommandOrControl+Shift+D', () => {
    devMenuVisible = !devMenuVisible;
    if (devMenuVisible) {
      const devMenu = Menu.buildFromTemplate([
        { label: 'Developer', submenu: [
          { label: 'Reload', role: 'reload' },
          { label: 'Force Reload', role: 'forceReload' },
          { label: 'Toggle DevTools', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: 'Quit MnemosyneC', click: () => app.quit() },
        ]},
      ]);
      Menu.setApplicationMenu(devMenu);
    } else {
      Menu.setApplicationMenu(null);
    }
    if (IS_DEV) {
      console.log(`[Frame] Dev menu ${devMenuVisible ? 'shown' : 'hidden'} via Ctrl+Shift+D`);
    }
  });

  if (!okQuit || !okHide) {
    console.warn(
      `[Frame] Global escape shortcuts unavailable (quitRegistered=${okQuit} hideRegistered=${okHide}); another app may own the accelerator`,
    );
  }
  if (!okDevMenu) {
    console.warn('[Frame] Ctrl+Shift+D dev-menu toggle unavailable ? another app may own the accelerator');
  }

  // BP094 -- F12 as DevTools toggle alias (Founder-direct, pairs with Ctrl+Shift+D)
  const okF12 = globalShortcut.register('F12', () => {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused) {
      if (focused.webContents.isDevToolsOpened()) {
        focused.webContents.closeDevTools();
      } else {
        focused.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
  if (!okF12) console.warn('[Frame] F12 dev-tools toggle unavailable - another app may own the accelerator');

  // Register auth IPC handlers (after windows are created)
  authManager.registerIPCHandlers();

  // Initial mode detection
  const aiAvailable = await ollamaManager.isReachable();
  const fedStatus = federationClient.getStatus();
  const forcedMode = substrateServer.getForcedMode();
  const mode = detectMode({
    aiAvailable,
    substrateIndexAvailable: true,
    peerNodesAvailable: fedStatus.peerCount,
    forcedMode,
  });
  setMode(mode, false);

  // Start periodic connectivity polling ? auto mode transitions
  connectivityTimer = setInterval(runConnectivityPoll, CONNECTIVITY_POLL_MS);

  // SEG-Q-4 BP078: auto-prepare FULL upgrade on launch (if enabled)
  runAutoPrepareIfNeeded();
  scheduleAutoPrepareIdle();

  // BP081 K-2 — start local MCP substrate bridge server (failure is non-fatal)
  try {
    await startMcpServer();
  } catch (e) {
    console.error('[Frame] MCP server failed to start (non-fatal):', e);
  }

  // SEG-U-7 BP078: mesh-test-complete file watcher
  // Watches two locations for mesh results JSON; sends IPC to renderer on detection.
  // Uses fs.watch (chokidar would be more robust but is not in this project's dependencies).
  setupMeshResultsWatcher();

  // BP086 I3a: Wire presence config so publishPresence() passes its null-guard
  // BP104 D5: wan_soccerball_id derived from Ed25519 publicKeyHex (D3 keypair)
  // BP132 Yoke #21 A2: MOVED to run BEFORE startPeerServer() (was after). startPeerServer()'s
  // .listen() callback fires publishPresence() immediately on the 'listening' event, and that
  // first call was silently no-op'ing because _peerId/_supabaseUrl (module-local state in
  // peer_server.ts, set only by registerPresenceConfig) were still unset at that point.
  {
    const { randomUUID, createHash } = require('crypto') as typeof import('crypto');
    const _presencePeerId = getStablePeerId();
    const _presenceSupabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    let _wanSoccerballId: string;
    try {
      const { ensureLocalPeerKeypair } = require('./identity/localPeerKeypair') as typeof import('./identity/localPeerKeypair');
      const kp = ensureLocalPeerKeypair();
      _wanSoccerballId = createHash('sha256').update(kp.publicKeyHex).digest('hex').slice(0, 32);
    } catch {
      _wanSoccerballId = (_presencePeerId + _presencePeerId).slice(0, 32);
    }
    const { getLBSession } = require('./lb_auth') as typeof import('./lb_auth');
    const _session = getLBSession();
    const _emailHash = _session?.email
      ? createHash('sha256').update(_session.email.trim().toLowerCase()).digest('hex').slice(0, 32)
      : null;
    registerPresenceConfig({
      peerId: _presencePeerId,
      emailHash: _emailHash ?? null,
      wanSoccerballId: _wanSoccerballId,
      relaySessionId: randomUUID().replace(/-/g, ''),
      supabaseUrl: _presenceSupabaseUrl,
    });
    console.log('[presence] registered tier=base default, peer=' + _presencePeerId.slice(0, 8));
  }

  // v0.4.0 BP083 SEG-1: Start peer HTTP server on port 7474 (SCAFFOLD transport)
  try {
    await startPeerServer();
    console.log('[BP083] Peer server started on port 7474 (SCAFFOLD v0.4.0)');
  } catch (e) {
    console.warn('[BP083] Peer server start failed (non-fatal):', e);
  }

  // BP086 I5c: start relay poll (answers cross-WAN questions from orchestrator)
  {
    const _relayPeerId = getStablePeerId();
    const _supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      ''
    ).replace(/\/$/, '');
    const _anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';
    if (_supabaseUrl && _anonKey) {
      _bootZombieCount = await bootZombieFlush(_relayPeerId, _supabaseUrl, _anonKey);
      scheduleZombieFlush(_relayPeerId);
    }
    startRelayRoutePoll(_relayPeerId);
    // D6c — self-heal watchdog starts 60s after poll loop; monitors poll_count delta
    startRelayPollWatchdog(_relayPeerId);

    // BP132 Yoke #21 A1: startRelayAnswerPoller() was fully built (PID-lock singleton,
    // exponential backoff, crash-loop guard, liveness watchdog) but never called anywhere
    // in src/ — confirmed by repo-wide search. This is the WAN answer-side of the mesh:
    // without it, this peer never answers cross-WAN questions routed to it via Supabase.
    if (_supabaseUrl && _anonKey) {
      startRelayAnswerPoller({
        peerId: _relayPeerId,
        supabaseUrl: _supabaseUrl,
        anonKey: _anonKey,
      });
      console.log('[BP132 A1] relay-answer poller start requested peer=' + _relayPeerId.slice(0, 8));
    } else {
      console.error('[BP132 A1] relay-answer poller NOT started — Supabase URL/anon key unresolved');
    }

    // BP132 Yoke #21 A1: submitStartupDiagnostic() writes the peer_startup_state row
    // (relay_answer_poller_started, beacons_lit state, ollama reachability, etc.) but was
    // also never called anywhere in src/ — confirmed by repo-wide search. Delay 15s so the
    // relay-answer worker has time to fork + send its 'started' IPC message first, so the
    // very first row already reflects relay_answer_poller_started=true instead of a false
    // reported at t=0. Re-submitted every 10 min so Bishop's DB view stays current, not
    // just a single boot-time snapshot (Truth-Always: state must not go stale silently).
    setTimeout(() => {
      submitStartupDiagnostic().catch((e) => console.error('[BP132 A1] startup diagnostic submit failed:', e));
    }, 15_000);
    setInterval(() => {
      submitStartupDiagnostic().catch((e) => console.error('[BP132 A1] startup diagnostic resubmit failed:', e));
    }, 10 * 60_000);
  }

  // BP086 I7c: MIC broadcast listener (auto_update / config_set / fleet_warmup /
  // health_snapshot / benchmark_run / noop_test)
  {
    startMicBroadcastListener(getStablePeerId(), app.getVersion());
  }

  // v0.4.0 BP083 SEG-5 (carried forward v0.4.2): Post-install restart prompt (version-bump detection)
  {
    const lastVersionPath = join(app.getPath('appData'), 'MnemosyneC', '.last_version');
    const currentVersion = app.getVersion();
    const lastVersion = existsSync(lastVersionPath) ? readFileSync(lastVersionPath, 'utf8').trim() : null;
    if (lastVersion && lastVersion !== currentVersion) {
      writeFileSync(lastVersionPath, currentVersion, 'utf8');
      // Send once window finishes loading
      const sendRestartPrompt = () => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('show-restart-prompt', {
              version: currentVersion,
              message: `MnemosyneC v${currentVersion} installed. Please close and reopen once for full UI initialization. Federation features require a clean renderer state.`,
            });
          }
        }
      };
      // Defer to ensure windows are ready
      setTimeout(sendRestartPrompt, 3000);
    } else if (!lastVersion) {
      writeFileSync(lastVersionPath, currentVersion, 'utf8');
    }
  }

  // v0.4.2 BP083 SEG-5: Surface Plow Resume modal if an interrupted checkpoint exists
  {
    setTimeout(async () => {
      try {
        const { readCheckpoint } = await import('./plow/plow_checkpoint');
        const cp = readCheckpoint();
        if (cp && cp.status === 'interrupted') {
          const completedPct = cp.totalQuestionsTarget > 0
            ? Math.round((cp.totalQuestionsCompleted / cp.totalQuestionsTarget) * 100)
            : 0;
          const lastUpdated = new Date(cp.lastUpdatedAt).toLocaleString();
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('plow:resume-prompt', {
                sessionId: cp.sessionId,
                startedAt: cp.startedAt,
                lastUpdatedAt: cp.lastUpdatedAt,
                totalQuestionsCompleted: cp.totalQuestionsCompleted,
                totalQuestionsTarget: cp.totalQuestionsTarget,
                completedPct,
                lastUpdated,
                config: cp.config,
                completedQuestions: cp.completedQuestions,
              });
            }
          }
          console.log(`[Main] Plow resume prompt sent: ${cp.totalQuestionsCompleted}/${cp.totalQuestionsTarget} Q completed (${completedPct}%) last=${lastUpdated}`);
        }
      } catch (err) {
        console.warn('[Main] Plow resume check error (non-fatal):', err);
      }
    }, 4000);
  }

  app.on('activate', () => {
    // SAGA-1 BP055: macOS dock click ? open Dashboard (not overlay).
    openDashboard({ focus: true });
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms for AMPLIFY
});

app.on('before-quit', async () => {
  // v0.4.2: Mark running Plow as interrupted before exit so Resume is offered next launch
  try {
    const { onAppQuit } = await import('./plow/plow_worker_service');
    onAppQuit();
  } catch { /* non-fatal */ }
  // BP092 I12 — Stop IP Ledger Mesh Diff Loop on Quit (not on Close per close-keeps-alive canon)
  try {
    const { stopMeshDiffLoop } = await import('./ip_ledger/mesh_diff_loop');
    stopMeshDiffLoop();
  } catch { /* non-fatal */ }
  stopOverlayWatchdog();
  if (connectivityTimer) clearInterval(connectivityTimer);
  pairedFrameManager?.stop();
  folderWatcher?.stopAll();
  autoUpdater?.destroy();
  await ollamaManager.shutdown();
  await federationClient?.stop();
  await substrateServer?.stop();
  await stopMcpServer();
  await stopPeerServer();
});
