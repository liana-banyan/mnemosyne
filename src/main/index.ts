// AMPLIFY Computer — Electron Main Process
// B37 Phase 1-3 — BP025 / Bushel 37
// Phase 3 additions: connectivity polling, auto-mode transitions, substrate/federation IPC
// BP038 addition: env_loader MUST be the first import so its side-effects populate
// process.env (ANTHROPIC_API_KEY, etc.) before any consumer module reads them at load.
// Implements Blood Rule R16 (R-NO-API-KEY-EXPOSURE) — values never logged.

import './env_loader';
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
} from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { OllamaManager } from './ollama_manager';
import { SubstrateAPIServer, API_PORT } from './substrate_api';
import { FederationClient } from './federation_client';
import { getMoneyPennyURL, getLocalIPs } from './mobile_pwa';
import { AutoUpdateManager, type UpdateState } from './auto_updater';
import { PeerDiscovery, getStablePeerId } from './federation/peer-discovery';
import { RelayClient } from './federation/relay-client';
import { AuthManager, registerCustomScheme } from './auth_manager';
import {
  runHearthBuild,
  runHearthInstall,
  getHearthLibrary,
  getHearthHealthz,
  runSpecExtractSmoke,
} from './hearth_app_builder/orchestrator';
import { uninstallApp } from './hearth_app_builder/install_runner';
// B83 — Hearth Conjunction Window
import { conjunctionRouter } from './hearth/conjunction/conjunction_router';
import { buildSubstrateContext } from './hearth/embedded_browser/substrate_context_builder';
import { querySagaState, recordWaveDispatch, recordWaveComplete } from './hearth/drekaskip_status/drekaskip_bridge';
import { pollWatchdogStatus, getSubjectHistory } from './hearth/active_substrate/watchdog_bridge';
import { toggleMonitor, getMetrics, getAllMonitorStates } from './hearth/active_substrate/scribe_monitor';
// BP037 — On-Deck Master-of-Ceremonies
import { listOnDeck } from './on_deck/on_deck_bridge';
// Adaptive Concurrency Carrier (Layer 2+4)
import { getCapInfo, probeConcurrencyCap, setCapOverride } from './concurrency_probe';
// SAGA 4 BP041 — In Conjunction Agent Panel
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

// BP052 v0.1.8 — Kitchen Table™ IPC store
import { registerKitchenTableIpc } from './kitchen_table/kitchen_table_store';

// BP060 Application 002 Step 1 — Caithedral Tools IPC
import { registerCaithedralToolsIPC, setMeshPointerAdvanceHook, dag_soccerball_emit_reexport } from './caithedral_tools_ipc';
import { setDagEmitMeshHook, setFetchSidFromPeerHook } from './substrate_api';

// MESH-6 — shared protocol payload types
import {
  FedMsg,
  SidFetchRequestPayload,
  SidFetchResponsePayload,
  PointerAdvancePayload,
} from '../shared/federation-protocol';

// MESH-6 — dag soccerball lookup (canonical exports-map path; tsconfig paths resolves types)
import {
  dag_soccerball_lookup as _dagLookup,
  type DagNode,
} from 'caithedral-core/tools/dag_soccerball';

// BP060 Application 002 Steps 3+4 — Bridge IPC (UI-7 live Yoke wire)
import { registerBridgeIPC } from './bridge_ipc';

// BP060 Application 002 Steps 3+4 — AI Dispatch IPC (UI-8 backend)
import { registerAiDispatchIPC } from './ai_dispatch_ipc';

// SAGA-γ v0.1.10 — SubstratedFolderWatcher™
import { SubstratedFolderWatcher, registerWatcherIpc } from './services/SubstratedFolderWatcher';

// SAGA 10 BP045 W1 — mnemosyne:// + mnemo:// deep-link handler
import { registerDeepLinkProtocol, handleStartupDeepLink } from './deep-link-handler';
import type { DeepLinkPayload } from './deep-link-handler';

// BP065 Part A — LB Account authentication + device linking
import {
  startLBAuthFlow,
  completeLBAuth,
  getLBSession,
  revokeDevice as lbRevokeDevice,
} from './lb_auth';

// ─── Constants ──────────────────────────────────────────────────────────────

// MNEMOSYNE_PROD_LAUNCH=1 forces loadFile of built renderer even from source tree
// (used for smoke-launch + two-instance tests without full packaging)
const IS_DEV = process.env.MNEMOSYNE_PROD_LAUNCH !== '1' &&
  (process.env.NODE_ENV === 'development' || !app.isPackaged);
// Use explicit 127.0.0.1 (IPv4) — avoids Windows ::1 vs 127.0.0.1 split-brain
// where Vite binds to ::1 but Chromium connects to 127.0.0.1.
const VITE_DEV_URL = 'http://127.0.0.1:5173';
const RENDERER_URL = IS_DEV
  ? VITE_DEV_URL
  : `file://${join(__dirname, '../renderer/index.html')}`;

// ─── CSP ─────────────────────────────────────────────────────────────────────
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

// ─── SAGA 4: Tier persistence + agent IPC handlers ───────────────────────────

const SUBSTRATE_ROOT_MAIN = process.env.LB_SUBSTRATE_ROOT ?? join(homedir(), '.lb_substrate');
const TIERS_FILE = join(SUBSTRATE_ROOT_MAIN, 'in_conjunction_tiers.json');

// BP048 v0.1.7 — wife-install first-run + LOCAL-HANDSHAKE prefs (~/.mnemosyne/)
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

// ─── State ──────────────────────────────────────────────────────────────────

let overlayWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let folderWatcher: SubstratedFolderWatcher | null = null;
let hearthConjunctionWindow: BrowserWindow | null = null;
let moneyPennyWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let ollamaManager: OllamaManager | null = null;
let substrateServer: SubstrateAPIServer | null = null;
let federationClient: FederationClient | null = null;
let autoUpdater: AutoUpdateManager | null = null;
let authManager: AuthManager | null = null;
let peerDiscovery: PeerDiscovery | null = null;
let relayClient: RelayClient | null = null;
let connectivityTimer: ReturnType<typeof setInterval> | null = null;

// ─── MESH-6: in-flight relay fetch listeners ──────────────────────────────────
const meshFetchListeners = new Map<string, (payload: SidFetchResponsePayload) => void>();
let watchdogOverlayInterval: NodeJS.Timeout | null = null;
let rendererResponsive = true;
let displayMetricsListenerAttached = false;

// ─── MESH-6 helpers ───────────────────────────────────────────────────────────

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
              resolve({ ok: false, hash_verified: false, error: 'SID hash mismatch — rejected' });
              return;
            }
            socket.destroy();
            resolve({ ok: true, node: payload.node as DagNode, hash_verified: true });
          }
        } catch { /* malformed — continue */ }
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
        resolve({ ok: false, hash_verified: false, error: 'SID hash mismatch — rejected' });
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
      console.log(`[MESH-6] pointer_advance received: ${payload.old_dag_id} → ${payload.new_dag_id} from ${payload.emitter_peer_id}`);
      _autoFetchOnPointerAdvance(payload).catch((e) =>
        console.warn('[MESH-6] auto-fetch on pointer_advance failed:', e),
      );
    }
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

// ─── Monitor-safe bounds (multi-display; prevents off-screen window trap) ─────

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

function clampMoneyPennyBounds(bounds?: Partial<Electron.Rectangle>): Electron.Rectangle {
  const workArea = screen.getDisplayMatching({
    x: bounds?.x ?? screen.getPrimaryDisplay().workArea.x,
    y: bounds?.y ?? screen.getPrimaryDisplay().workArea.y,
    width: bounds?.width ?? 1,
    height: bounds?.height ?? 1,
  }).workArea;
  const maxWidth = Math.floor(workArea.width * 0.9);
  const maxHeight = Math.floor(workArea.height * 0.9);
  const defaultWidth = Math.max(MONEY_PENNY_MIN_WIDTH, Math.min(maxWidth, Math.floor(workArea.width * 0.3)));
  const defaultHeight = Math.max(MONEY_PENNY_MIN_HEIGHT, Math.min(maxHeight, Math.floor(workArea.height * 0.6)));
  const width = Math.max(MONEY_PENNY_MIN_WIDTH, Math.min(maxWidth, Math.floor(bounds?.width ?? defaultWidth)));
  const height = Math.max(MONEY_PENNY_MIN_HEIGHT, Math.min(maxHeight, Math.floor(bounds?.height ?? defaultHeight)));
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - width, Math.floor(bounds?.x ?? workArea.x + (workArea.width - width) / 2)));
  const y = Math.max(workArea.y, Math.min(workArea.y + workArea.height - height, Math.floor(bounds?.y ?? workArea.y + (workArea.height - height) / 2)));
  return getSafeBounds({ x, y, width, height });
}

function loadMoneyPennyBounds(): Electron.Rectangle {
  if (!existsSync(MONEY_PENNY_BOUNDS_FILE)) return clampMoneyPennyBounds();
  try {
    const parsed = JSON.parse(require('fs').readFileSync(MONEY_PENNY_BOUNDS_FILE, 'utf-8')) as Partial<Electron.Rectangle>;
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
        console.warn('[watchdog] renderer unresponsive — force reload');
        win.webContents.reload();
      }
    }, 5000);
  }, 8000);
}

// ─── LB overlay pointer policy (Electron) ────────────────────────────────────
// Preload exposes setClickthrough(true) ⇒ ignore mouse ⇒ transparent hits forward to OS.

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

// ─── Frame Mode ──────────────────────────────────────────────────────────────

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

// ─── Connectivity Polling ─────────────────────────────────────────────────────

async function runConnectivityPoll(): Promise<void> {
  const aiAvailable = (await ollamaManager?.isReachable()) ?? false;
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
      console.log(`[Mode] Auto-transition: ${currentMode} → ${detected} (ai=${aiAvailable} online=${online} peers=${peerCount})`);
      setMode(detected);
    }
  }
}

// ─── Overlay Window ──────────────────────────────────────────────────────────

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
    },
  });

  // Inject CSP on every response — strips unsafe-eval, eliminates Electron security warning.
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
    // renderer_guard: probe after 8s grace — log empty-root failures to health log.
    const win = overlayWindow;
    if (win) {
      probeRendererHealth(win, RENDERER_URL, 8000).then((result) => {
        if (!result.ok) {
          tray?.setToolTip(`Mnemosyne — ⚠ renderer boot failed (root empty)`);
        }
      }).catch(() => { /* probe errors never crash the app */ });
    }
  });
  overlayWindow.loadURL(RENDERER_URL);

  // BP041 — DevTools auto-open opt-out per Founder direct (non-technical members
  // running `npm run dev` should not see DevTools by default). Set MNEMOSYNE_DEVTOOLS=1
  // in env to re-enable, OR press Ctrl+Shift+I at any time to open manually,
  // OR press Ctrl+Shift+D for the developer menu (commit 1b0fdc7 §6).
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

  startOverlayWatchdog(overlayWindow);
}

// ─── System Tray ─────────────────────────────────────────────────────────────

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
  tray.setToolTip(`Mnemosyne v${app.getVersion()}`);
  // Single left-click opens Dashboard (right-click still shows context menu)
  tray.on('click', () => openDashboard());
  rebuildTrayMenu();
}

// KniPr026: refresh tray tooltip to reflect the current auto-update state.
function updateTrayTooltip(updateStatus?: UpdateState['status']): void {
  if (!tray || tray.isDestroyed()) return;
  const version = app.getVersion();
  if (updateStatus === 'downloaded') {
    tray.setToolTip(`Mnemosyne v${version} — Update ready to install`);
  } else if (updateStatus === 'available' || updateStatus === 'downloading') {
    tray.setToolTip(`Mnemosyne v${version} — Update available`);
  } else {
    tray.setToolTip(`Mnemosyne v${version}`);
  }
}

function rebuildTrayMenu(mode: FrameMode = currentMode): void {
  if (!tray) return;

  const modeLabel: Record<FrameMode, string> = {
    ai_burst: '🔥 AI Burst',
    normal: '🌿 Normal',
    fallback: '🌑 Fallback',
  };

  const forcedMode = substrateServer?.getForcedMode();
  const forcedLabel = forcedMode ? ` (forced)` : '';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Mnemosyne — ${modeLabel[mode]}${forcedLabel}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '🔥 AI Burst Mode',
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
      label: '🌿 Normal Mode',
      type: 'radio',
      checked: mode === 'normal',
      click: () => setMode('normal'),
    },
    {
      label: '🌑 Fallback Mode',
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
      label: 'Mnemosyne Dashboard',
      click: () => openDashboard(),
    },
    {
      label: 'Ↄ Open the Bridge',
      click: () => openHearthConjunctionWindow(),
    },
    {
      label: 'Settings',
      click: () => openDashboard(),
    },
    { type: 'separator' },
    {
      label: 'Check for Updates…',
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
      label: 'Quit Mnemosyne',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ─── Dashboard Window ─────────────────────────────────────────────────────────

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
    title: 'MoneyPenny — Mnemosyne CAI Amplifier',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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

function openDashboard(opts?: { focus?: boolean }): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    if (opts?.focus !== false) dashboardWindow.focus();
    return;
  }

  // SAGA 07 BP046B — expanded for 6-tab MnemosyneTabView
  dashboardWindow = new BrowserWindow({
    width: 680,
    height: 780,
    minWidth: 560,
    minHeight: 600,
    title: `Mnemosyne v${app.getVersion()}`,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const dashW = 680;
  const dashH = 780;
  const primary = screen.getPrimaryDisplay().workArea;
  const dashBounds = getSafeBounds({
    x: primary.x + Math.floor((primary.width - dashW) / 2),
    y: primary.y + Math.floor((primary.height - dashH) / 2),
    width: dashW,
    height: dashH,
  });
  dashboardWindow.setBounds(dashBounds);

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow?.show();
    if (opts?.focus !== false) dashboardWindow?.focus();
  });

  // Bug #2 v0.1.10: keep versioned title after any reload/navigation
  dashboardWindow.webContents.on('did-finish-load', () => {
    dashboardWindow?.setTitle(`Mnemosyne v${app.getVersion()}`);
  });

  dashboardWindow.loadURL(
    IS_DEV
      ? 'http://127.0.0.1:5173/#/dashboard'
      : `file://${join(__dirname, '../renderer/index.html')}#/dashboard`,
  );

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  if (autoUpdater) autoUpdater.registerWindow(dashboardWindow);
  if (authManager) authManager.registerWindow(dashboardWindow);
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
      title: 'Mnemosyne on your network',
      message: `Found another Mnemosyne on your network: ${hostname}`,
      detail: 'Would you like to connect to it? (LOCAL-HANDSHAKE · same house LAN)',
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

// ─── Hearth Conjunction Window (B83) ─────────────────────────────────────────

function openHearthConjunctionWindow(): void {
  if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
    hearthConjunctionWindow.focus();
    return;
  }

  const HEARTH_W = 1600;
  const HEARTH_H = 1000;
  const primary = screen.getPrimaryDisplay().workArea;
  const bounds = getSafeBounds({
    x: primary.x + Math.floor((primary.width - HEARTH_W) / 2),
    y: primary.y + Math.floor((primary.height - HEARTH_H) / 2),
    width: HEARTH_W,
    height: HEARTH_H,
  });

  // Webview preload path — compiled from src/main/hearth/embedded_browser/webview_preload.ts
  const webviewPreloadPath = join(__dirname, 'hearth', 'embedded_browser', 'webview_preload.js');

  hearthConjunctionWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: 'Mnemosyne — Memory, powered by CAI',
    minWidth: 1280,
    minHeight: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // B83b: enable <webview> for EmbeddedChrome
    },
  });

  hearthConjunctionWindow.once('ready-to-show', () => {
    hearthConjunctionWindow?.show();
  });

  hearthConjunctionWindow.loadURL(
    IS_DEV
      ? 'http://localhost:5173/#/hearth-conjunction'
      : `file://${join(__dirname, '../renderer/index.html')}#/hearth-conjunction`,
  );

  hearthConjunctionWindow.on('closed', () => {
    hearthConjunctionWindow = null;
  });

  // Store webview preload path for IPC response
  ;(hearthConjunctionWindow as unknown as { _webviewPreloadPath: string })._webviewPreloadPath = webviewPreloadPath;

  if (autoUpdater) autoUpdater.registerWindow(hearthConjunctionWindow);
  if (authManager) authManager.registerWindow(hearthConjunctionWindow);
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function registerIPCHandlers(): void {
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

  // ── Mode ──────────────────────────────────────────────────────────────────
  ipcMain.handle('get-frame-mode', () => ({
    mode: currentMode,
    forced_mode: substrateServer?.getForcedMode() ?? null,
  }));

  ipcMain.on('set-frame-mode', (_event, { mode }: { mode: FrameMode }) => {
    setMode(mode);
  });

  // Force or clear mode override (persists through auto-detect cycles)
  ipcMain.handle('force-frame-mode', (_event, { mode }: { mode: FrameMode | null }) => {
    substrateServer?.setForcedMode(mode);
    if (mode !== null) setMode(mode);
    else runConnectivityPoll();
    rebuildTrayMenu();
    return { ok: true, forced_mode: substrateServer?.getForcedMode() ?? null };
  });

  // ── Overlay ───────────────────────────────────────────────────────────────
  ipcMain.on('set-clickthrough', (_event, { enabled }: { enabled: boolean }) => {
    applyLBFrameClickthrough(enabled);
  });

  // ── Ollama ────────────────────────────────────────────────────────────────
  ipcMain.handle('get-ollama-status', async () => {
    return ollamaManager?.getStatus() ?? { running: false, model: null, source: 'none' };
  });

  ipcMain.handle('pull-default-model', async () => {
    if (!ollamaManager) return { success: false, error: 'Ollama manager not initialized' };
    const reachable = await ollamaManager.isReachable();
    if (!reachable) return { success: false, error: 'Ollama not running' };
    const hasModel = await ollamaManager.hasModel();
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

  ipcMain.handle('list-ollama-models', async () => {
    return ollamaManager?.listModels() ?? [];
  });

  // KniPr012 — check if Ollama binary is installed (distinct from daemon running)
  ipcMain.handle('check-ollama', async () => {
    const { execSync } = require('child_process');
    try {
      const out = execSync('ollama --version', { timeout: 3000 }).toString();
      return { installed: true, version: out.trim() };
    } catch {
      return { installed: false };
    }
  });

  ipcMain.handle('check-disk-space', async () => {
    const ok = (await ollamaManager?.checkDiskSpace(6)) ?? true;
    return { ok, requiredGB: 6 };
  });

  // ── Substrate ─────────────────────────────────────────────────────────────

  // Route a query through the three-mode substrate router
  // Degraded mode (trial expired): allow substrate read, but block Ollama/cloud escalation
  ipcMain.handle(
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
  ipcMain.handle(
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

  // ── Federation ────────────────────────────────────────────────────────────
  ipcMain.handle('get-federation-status', () => {
    return federationClient?.getStatus() ?? {
      online: false,
      peerCount: 0,
      lastSyncTs: null,
      lastSyncRecordsExchanged: 0,
      pendingWriteCount: 0,
      peers: [],
    };
  });

  ipcMain.handle('set-member-token', (_event, { token }: { token: string | null }) => {
    federationClient?.setMemberToken(token);
    return { ok: true };
  });

  // ── AMPLIFY Telemetry ─────────────────────────────────────────────────────
  ipcMain.handle('get-amplify-snapshot', async () => {
    return substrateServer?.getAMPLIFYSnapshot() ?? {
      total_queries: 0,
      substrate_hits: 0,
      local_ollama_served: 0,
      cloud_escalations: 0,
      total_cloud_cost_avoided_usd: 0,
    };
  });

  // Full historical summary (today / week / month / daily breakdown / all-time)
  ipcMain.handle('get-amplify-summary', () => {
    return substrateServer?.getTelemetryStore().getSummary() ?? null;
  });

  // ── Auto-Update ───────────────────────────────────────────────────────────
  ipcMain.handle('get-update-state', () => autoUpdater?.getState() ?? { status: 'idle' });
  ipcMain.on('check-for-updates', () => autoUpdater?.checkNow());
  ipcMain.on('install-update', () => autoUpdater?.installNow());

  ipcMain.on('watchdog-pong', () => {
    rendererResponsive = true;
  });

  // ── App Version (MV-VERSION-DISPLAY BP044) ────────────────────────────────
  ipcMain.handle('get-app-version', () => {
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

  // ── MoneyPenny Mobile ─────────────────────────────────────────────────────
  ipcMain.handle('get-moneypenny-url', () => ({
    url: getMoneyPennyURL(API_PORT),
    ips: getLocalIPs(),
    port: API_PORT,
  }));

  // ── Dashboard ─────────────────────────────────────────────────────────────
  ipcMain.on('open-dashboard', () => openDashboard());

  // ── Hearth App Builder (B69) ──────────────────────────────────────────────

  // Route hearth_app_build_request from Substrate-DM (intent class: hearth_app_build_request)
  ipcMain.handle(
    'hearth-build',
    async (_event, { request, memberId }: { request: string; memberId?: string }) => {
      const wins = [overlayWindow, dashboardWindow];
      return runHearthBuild({ request, memberId: memberId ?? 'member', windows: wins });
    },
  );

  ipcMain.handle(
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

  ipcMain.handle('hearth-library-query', (_event, { memberId }: { memberId?: string } = {}) => {
    return getHearthLibrary(memberId);
  });

  ipcMain.handle('hearth-uninstall', async (_event, { uuid }: { uuid: string }) => {
    return uninstallApp(uuid);
  });

  ipcMain.handle('hearth-healthz', async () => {
    return getHearthHealthz();
  });

  ipcMain.handle('hearth-spec-extract-smoke', async () => {
    return runSpecExtractSmoke();
  });

  // ── Hearth Conjunction Window (B83) ─────────────────────────────────────────

  ipcMain.on('open-hearth-conjunction', () => openHearthConjunctionWindow());

  // BP041 SAGA 3 — Watch View toggle
  // hideToWatchView: hides the conjunction window while keeping the overlay + substrate alive.
  // The FrameModeIndicator overlay remains visible (it's a separate transparent window).
  // Member restores by clicking the OverlayTag or pressing Ctrl+Shift+M (global shortcut below).
  ipcMain.handle('hide-to-watch-view', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      hearthConjunctionWindow.hide();
    }
    return { ok: true };
  });

  ipcMain.handle('show-hearth-conjunction', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      hearthConjunctionWindow.show();
      hearthConjunctionWindow.focus();
    } else {
      openHearthConjunctionWindow();
    }
    return { ok: true };
  });

  ipcMain.handle('conjunction-get-state', () => conjunctionRouter.getState());

  ipcMain.handle('conjunction-get-availability', () => conjunctionRouter.getAvailability());

  ipcMain.handle(
    'conjunction-select',
    (_event, { mode }: { mode: import('./hearth/conjunction/types').ConjunctionMode }) =>
      conjunctionRouter.selectMode(mode),
  );

  ipcMain.handle(
    'conjunction-set-override',
    (_event, { mode }: { mode: import('./hearth/conjunction/types').ConjunctionMode }) => {
      const state = conjunctionRouter.getState();
      void state; // state is available; update override via internal path
      conjunctionRouter.selectMode(mode); // temporary — proper override wired below
      return { ok: true };
    },
  );

  ipcMain.handle(
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

  ipcMain.handle('conjunction-get-substrate-context', async () => {
    return buildSubstrateContext();
  });

  // ── Drekaskip bridge (B83c) ───────────────────────────────────────────────

  ipcMain.handle('drekaskip-query', async () => {
    return querySagaState();
  });

  // ── Watchdog bridge (B83d) ────────────────────────────────────────────────

  ipcMain.handle('watchdog-status', async () => {
    return pollWatchdogStatus();
  });

  ipcMain.handle(
    'watchdog-history',
    async (_event, { subject, window_hours }: { subject: string; window_hours?: number }) => {
      return getSubjectHistory(subject, window_hours);
    },
  );

  // ── Scribe Monitor — BP041 SAGA 2 ────────────────────────────────────────

  ipcMain.handle(
    'scribe-toggle-monitor',
    (_event, { scribeId, on }: { scribeId: string; on: boolean }) => {
      return toggleMonitor(scribeId, on);
    },
  );

  ipcMain.handle(
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

  // ── In Conjunction Agent Panel — SAGA 4 BP041 ────────────────────────────

  ipcMain.handle(
    'agent-probe',
    async (_event, { agentId, force, modelId }: { agentId: string; force?: boolean; modelId?: string }) => {
      return agentProbeHandler(agentId, { force, modelId });
    },
  );

  ipcMain.handle(
    'agent-set-api-key',
    (_event, { agentId, keyValue }: { agentId: string; keyValue: string }) => {
      // R16: key value must never be logged — handler passes directly to setApiKey
      return agentSetApiKeyHandler(agentId, keyValue);
    },
  );

  ipcMain.handle('agent-get-api-key-status', () => {
    return agentGetApiKeyStatusHandler();
  });

  ipcMain.handle('agent-get-tier-choices', () => {
    return agentGetTierChoicesHandler();
  });

  ipcMain.handle(
    'agent-set-tier-choice',
    (_event, { agentId, tierId }: { agentId: string; tierId: string }) => {
      return agentSetTierChoiceHandler(agentId, tierId);
    },
  );

  ipcMain.handle('agent-get-plugins', () => {
    return agentGetPluginsHandler();
  });

  ipcMain.handle('agent-get-plugin-registry', () => {
    return agentGetPluginRegistryHandler();
  });

  // Webview preload path — renderer needs this to wire the <webview> preload attribute
  ipcMain.on('get-webview-preload-path', (event) => {
    event.returnValue = join(__dirname, 'hearth', 'embedded_browser', 'webview_preload.js');
  });

  // ── Adaptive Concurrency Carrier — Layer 4 (hot-tune panel) ─────────────

  ipcMain.handle('concurrency-get-cap', () => {
    return getCapInfo();
  });

  ipcMain.handle('concurrency-probe-now', async () => {
    const entry = await probeConcurrencyCap();
    return { cap: entry.cap, probed_at: entry.probed_at, tier: entry.account_tier_hint };
  });

  ipcMain.handle('concurrency-set-override', (_event, { n }: { n: number | null }) => {
    setCapOverride(n);
    return { ok: true, effective_cap: n };
  });

  // ── On-Deck Master-of-Ceremonies (BP037) ──────────────────────────────────

  ipcMain.handle('on-deck-list', () => {
    return listOnDeck();
  });

  // ── Pantheon — Pixie Dust Mining (BP041 SAGA 1) ───────────────────────────

  ipcMain.handle('pantheon-pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for Pixie Dust Mining',
      properties: ['openDirectory'],
      buttonLabel: 'Begin Mining',
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('pantheon-get-prefs', (_event, { memberId }: { memberId: string }) => {
    const { getFolderPrefs } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    return getFolderPrefs(memberId);
  });

  ipcMain.handle('pantheon-set-pref', (_event, args: {
    memberId: string;
    folderPath: string;
    pixelated: boolean;
    federationShared: boolean;
    subfolderOverrides?: import('./pantheon/folder_prefs').SubfolderOverride[];
  }) => {
    const { setFolderPref } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    return setFolderPref(args.memberId, args.folderPath, args.pixelated, args.federationShared, args.subfolderOverrides);
  });

  ipcMain.handle('pantheon-remove-pref', (_event, { memberId, folderPath }: { memberId: string; folderPath: string }) => {
    const { removeFolderPref } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    removeFolderPref(memberId, folderPath);
    return { ok: true };
  });

  ipcMain.handle('pantheon-dispatch', async (_event, {
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

  ipcMain.handle('pantheon-list-tablets', (_event, { memberId, grade, persona }: {
    memberId: string;
    grade?: 'iron' | 'stone';
    persona?: string;
  }) => {
    const { listTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return listTablets(memberId, { grade, persona: persona as import('./pantheon/types').PersonaId | undefined });
  });

  ipcMain.handle('pantheon-count-tablets', (_event, { memberId }: { memberId: string }) => {
    const { countTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return countTablets(memberId);
  });

  ipcMain.handle('pantheon-wipe', (_event, { memberId }: { memberId: string }) => {
    const { wipeTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return wipeTablets(memberId);
  });

  ipcMain.handle('pantheon-active-sessions', () => {
    const { getActiveSessions } = require('./pantheon/orchestrator') as typeof import('./pantheon/orchestrator');
    return getActiveSessions();
  });

  // ── Phoebe™ Idea Storage IPC (C.17 · BP055) ─────────────────────────────
  const _phoebeIdeas: Array<{ id: string; title: string; content: string; timestamp: string }> = [];
  ipcMain.handle('save-idea', async (_event, idea: { title: string; content: string; timestamp: string }) => {
    const id = `idea_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _phoebeIdeas.push({ id, ...idea });
    return { ok: true, id };
  });
  ipcMain.handle('get-ideas', async () => {
    return { ok: true, ideas: [..._phoebeIdeas].reverse() };
  });

  // ── Pearl-decode IPC (Tier G · v0.1.16 · BP057 W5c) ─────────────────────
  ipcMain.handle('decode-pearl', async (_event, pearlId: string) => {
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
        content: `# ${pearl.canonical_ref}\n\n**Pearl ID:** ${pearl.pearl_id}\n**Class:** ${pearl.class}\n**Cathedral:** ${pearl.cathedral}\n**Wave:** ${pearl.wave}\n\n*Eblet source not found on local substrate — canonical_ref: ${pearl.canonical_ref}*`,
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // ── Caithedral Tools IPC (BP060 Application 002 Step 1) ─────────────────
  registerCaithedralToolsIPC();

  // ── Bridge IPC (BP060 Application 002 Steps 3+4 · UI-7 live Yoke wire) ──
  registerBridgeIPC();

  // ── AI Dispatch IPC (BP060 Application 002 Steps 3+4 · UI-8 backend) ────
  registerAiDispatchIPC();

  // ── Kitchen Table™ + Atlas™ + P2P (BP052 v0.1.8) ────────────────────────
  registerKitchenTableIpc(ipcMain);

  // ── LB Account + Frontier Node IPC (BP065 Part A/B · SEG-C2a/B2b) ─────────

  ipcMain.handle('lb:start-auth', async (_event, { email }: { email: string }) => {
    return startLBAuthFlow(email);
  });

  ipcMain.handle('lb:get-session', async () => {
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

  ipcMain.handle('lb:link-device', async (_event, { access_token, refresh_token, email }: { access_token: string; refresh_token: string; email: string }) => {
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

  ipcMain.handle('lb:revoke-device', async () => {
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
        // Heartbeat errors are non-fatal — logged silently
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

  ipcMain.handle('lb:register-frontier-node', async () => {
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
        body: JSON.stringify({ peer_id: peerId, app_version: app.getVersion(), node_label: `Mnemosyne ${app.getVersion()}` }),
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

  ipcMain.handle('lb:withdraw-frontier-node', async () => {
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

  ipcMain.handle('lb:get-frontier-status', async () => {
    return {
      registered: _frontierNodeId !== null,
      frontier_node_id: _frontierNodeId ?? undefined,
    };
  });

  // Opt-In Strike Tracker IPC stubs (renderer primarily uses localStorage; IPC for cross-window sync)
  const _optInStore = { strikes: 0, lastShown: null as number | null, decision: 'pending' as string };

  ipcMain.handle('lb:opt-in-get-state', () => ({ ..._optInStore }));

  ipcMain.handle('lb:opt-in-record-strike', () => {
    _optInStore.strikes = Math.min(_optInStore.strikes + 1, 3);
    _optInStore.lastShown = Date.now();
    return { ok: true };
  });

  ipcMain.handle('lb:opt-in-set-decision', (_event, { decision }: { decision: string }) => {
    _optInStore.decision = decision;
    return { ok: true };
  });

  // ── SubstratedFolderWatcher™ (SAGA-γ v0.1.10) ────────────────────────────
  if (folderWatcher) registerWatcherIpc(folderWatcher);

  ipcMain.handle('watcher:open-folder-dialog', async () => {
    return dialog.showOpenDialog({ properties: ['openDirectory'] });
  });

  // ── Trail Eblet Reader (KniPr035) ─────────────────────────────────────────
  ipcMain.handle('trail-eblet:list', async () => {
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

  ipcMain.handle('trail-eblet:read', async (_event, { filePath }: { filePath: string }) => {
    const fs = require('fs') as typeof import('fs');
    if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found' };
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { ok: true, content };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle('trail-eblet:list-screenshots', async (_event, { ebletPath }: { ebletPath: string }) => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const screenshotsDir = path.join(path.dirname(ebletPath), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) return { files: [], dir: screenshotsDir };
    const files = fs.readdirSync(screenshotsDir)
      .filter((f: string) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
    return { files, dir: screenshotsDir };
  });

  ipcMain.handle('trail-eblet:read-screenshot', async (_event, { filePath }: { filePath: string }) => {
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

  // ── MV-CN Peer Mesh (SAGA 3 BP045 W1) ─────────────────────────────────────
  ipcMain.handle('get-mesh-state', () => ({
    peers: peerDiscovery?.getAllPeers() ?? [],
    relayConnected: relayClient?.isConnected() ?? false,
    ownPeerId: peerDiscovery ? (() => { const { getStablePeerId: gsp } = require('./federation/peer-discovery'); return gsp(); })() : '',
  }));

  // ── MESH-6: SID-targeted peer fetch ────────────────────────────────────────
  ipcMain.handle(
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

  // ── MESH-6: Federation invite/accept/leave ──────────────────────────────────
  ipcMain.handle('federation:generate-invite', (): { token: string; expiresAt: string } => {
    const { randomBytes } = require('crypto') as typeof import('crypto');
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const raw = `${getStablePeerId()}:${nonce}:${expiresAt}`;
    const token = `mnemo-invite-${Buffer.from(raw).toString('base64url')}`;
    return { token, expiresAt };
  });

  ipcMain.handle(
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

  ipcMain.handle('federation:leave-peer', (_ev, peerId: string): { ok: boolean } => {
    if (peerDiscovery) {
      peerDiscovery.removeWANPeer(peerId);
      peerDiscovery.removeLANPeer(peerId);
    }
    return { ok: true };
  });

  // ── Chronos Research Consent (KniPr038) ──────────────────────────────────

  ipcMain.handle('write-chronos-consent', async (_event, consentPayload: object) => {
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

  ipcMain.handle('revoke-chronos-consent', async (_event, _payload?: object) => {
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
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(async () => {
  // BP038 Frame-boilerplate — pre-bind port guard (singleton reuse pattern).
  // If another AMPLIFY is already on API_PORT, exit cleanly instead of EADDRINUSE crash.
  const probe = await probeSubstrateApiPort(API_PORT);
  if (probe.occupied) {
    if (probe.holder === 'another_amplify') {
      console.warn(`[LB Frame] another AMPLIFY is already running on :${API_PORT} — this duplicate instance will exit cleanly (singleton reuse). Close the existing instance first if you intended to restart.`);
    } else {
      console.error(`[LB Frame] :${API_PORT} is held by an unknown service. AMPLIFY cannot bind. Free the port or set SUBSTRATE_API_PORT to an alternate.`);
    }
    app.quit();
    return;
  }

  // Initialize substrate API server (Phase 3: full implementation)
  substrateServer = new SubstrateAPIServer();
  await substrateServer.start();

  // Initialize federation client (uses the substrate index from the API server)
  federationClient = new FederationClient(substrateServer.getIndex());
  substrateServer.setFederationClient(federationClient);
  await federationClient.start();

  // Initialize Ollama manager
  ollamaManager = new OllamaManager();
  await ollamaManager.init();

  // SAGA 4 — In Conjunction Agent Panel: load persisted keys + plugins at startup
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

  // MV-CN: Peer discovery + WAN relay (SAGA 3 BP045 W1)
  const peerId = getStablePeerId();
  peerDiscovery = new PeerDiscovery(peerId);
  relayClient = new RelayClient(peerId, peerDiscovery);
  peerDiscovery.startLAN().catch((e) => console.warn('[PeerDiscovery] LAN start error:', e));
  relayClient.start();

  // MESH-6: Wire relay inbound hook for sid_fetch_*, pointer_advance
  relayClient.setInboundHook(_handleInboundMeshMsg);

  // MESH-6: Wire pointer-advance hook from caithedral tools IPC
  setMeshPointerAdvanceHook(_emitPointerAdvanceToPeers);

  // MESH-6 Option-B: Wire HTTP /dag/emit endpoint to the same pointer_advance broadcast
  setDagEmitMeshHook(_emitPointerAdvanceToPeers);

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

  // §6 BP041 — Hide Electron menu bar by default (non-technical member protection).
  // Ctrl+Shift+D toggles developer menu on/off at runtime.
  Menu.setApplicationMenu(null);

  // SAGA-γ v0.1.10 — SubstratedFolderWatcher™ singleton (must be after app.ready for getPath)
  folderWatcher = new SubstratedFolderWatcher();

  // Create tray only — overlay is opt-in (tray → Show Overlay, or Burst Mode).
  // SAGA-1 BP055: Dashboard is the default boot surface; overlay never auto-creates.
  createTray();
  registerIPCHandlers();

  // SAGA 10 BP045 W1 — Register mnemosyne:// + mnemo:// deep-link protocols (BP065)
  registerDeepLinkProtocol(
    () => dashboardWindow ?? hearthConjunctionWindow ?? overlayWindow ?? null,
    (payload: DeepLinkPayload) => {
      if (payload.type === 'accept-invite') {
        console.log('[deep-link] accept-invite received for slug:', payload.slug);
        const win = hearthConjunctionWindow ?? overlayWindow;
        win?.webContents.send('federation:accept-invite', {
          slug: payload.slug,
          token: payload.token,
        });
      } else if (payload.type === 'lb-auth-callback') {
        // BP065 Part A — Complete the LB Account magic-link auth flow
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
      }
    },
  );
  // Handle cold-start deep-link (Windows: URL passed via argv)
  handleStartupDeepLink(process.argv, () => hearthConjunctionWindow ?? overlayWindow ?? null);

  // SAGA-1 BP055: Dashboard is now the default boot surface on every launch.
  // Overlay only appears via tray right-click → Show Overlay / Burst Mode (opt-in).
  // MNEMOSYNE_NO_AUTO_OPEN=1 skips auto-open (CI / headless environments).
  if (process.env.MNEMOSYNE_NO_AUTO_OPEN !== '1') {
    openDashboard({ focus: true });
    if (firstRun) {
      // Mark first-run complete after Dashboard is ready (wife-install BLOCKER preserved).
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.once('ready-to-show', () => markFirstRunComplete());
      } else {
        setTimeout(() => markFirstRunComplete(), 2000);
      }
    }
  }

  const okQuit = globalShortcut.register('CommandOrControl+Shift+Alt+Q', () => {
    app.quit();
  });
  const okHide = globalShortcut.register('CommandOrControl+Shift+Alt+H', () => {
    overlayWindow?.hide();
    dashboardWindow?.hide();
  });

  // BP041 SAGA 3 — Ctrl+Shift+M: toggle between Configure View and Watch View.
  // Watch View = conjunction window hidden; overlay border + OverlayTag visible.
  // Configure View = conjunction window shown + focused.
  const okWatchToggle = globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!hearthConjunctionWindow || hearthConjunctionWindow.isDestroyed()) {
      openHearthConjunctionWindow();
      return;
    }
    if (hearthConjunctionWindow.isVisible()) {
      hearthConjunctionWindow.hide();  // → Watch View
    } else {
      hearthConjunctionWindow.show();  // → Configure View
      hearthConjunctionWindow.focus();
    }
  });
  if (!okWatchToggle) {
    console.warn('[index] Ctrl+Shift+M shortcut registration failed (already registered by another app)');
  }

  // §6 — Dev menu toggle: Ctrl+Shift+D shows/hides the Electron application menu
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
          { label: 'Quit Mnemosyne', click: () => app.quit() },
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
    console.warn('[Frame] Ctrl+Shift+D dev-menu toggle unavailable — another app may own the accelerator');
  }

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

  // Start periodic connectivity polling → auto mode transitions
  connectivityTimer = setInterval(runConnectivityPoll, CONNECTIVITY_POLL_MS);

  app.on('activate', () => {
    // SAGA-1 BP055: macOS dock click → open Dashboard (not overlay).
    openDashboard({ focus: true });
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms for AMPLIFY
});

app.on('before-quit', async () => {
  stopOverlayWatchdog();
  if (connectivityTimer) clearInterval(connectivityTimer);
  folderWatcher?.stopAll();
  autoUpdater?.destroy();
  await ollamaManager?.shutdown();
  await federationClient?.stop();
  await substrateServer?.stop();
});
