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
} from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { OllamaManager } from './ollama_manager';
import { SubstrateAPIServer, API_PORT } from './substrate_api';
import { FederationClient } from './federation_client';
import { getMoneyPennyURL, getLocalIPs } from './mobile_pwa';
import { AutoUpdateManager } from './auto_updater';
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
// BP037 — On-Deck Master-of-Ceremonies
import { listOnDeck } from './on_deck/on_deck_bridge';
// Adaptive Concurrency Carrier (Layer 2+4)
import { getCapInfo, probeConcurrencyCap, setCapOverride } from './concurrency_probe';

// Register custom OAuth scheme before app ready (Electron requirement)
registerCustomScheme();

// ─── Constants ──────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;
// Use explicit 127.0.0.1 (IPv4) — avoids Windows ::1 vs 127.0.0.1 split-brain
// where Vite binds to ::1 but Chromium connects to 127.0.0.1.
const VITE_DEV_URL = 'http://127.0.0.1:5173';
const RENDERER_URL = IS_DEV
  ? VITE_DEV_URL
  : `file://${join(__dirname, '../renderer/index.html')}`;

// ─── CSP ─────────────────────────────────────────────────────────────────────
// Strict prod / minimal dev relaxation (HMR style + module loading only).
// NO unsafe-eval in either environment.
const CSP_DEV =
  "default-src 'self' http://127.0.0.1:5173; " +
  "script-src 'self' 'unsafe-inline' http://127.0.0.1:5173; " +
  "style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173 " +
  "http://127.0.0.1:11480 http://127.0.0.1:11481; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:";

const CSP_PROD =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self' http://127.0.0.1:11480 http://127.0.0.1:11481; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:";

const ACTIVE_CSP = IS_DEV ? CSP_DEV : CSP_PROD;

// Connectivity polling interval (30s)
const CONNECTIVITY_POLL_MS = 30_000;

// ─── State ──────────────────────────────────────────────────────────────────

let overlayWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let hearthConjunctionWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let ollamaManager: OllamaManager | null = null;
let substrateServer: SubstrateAPIServer | null = null;
let federationClient: FederationClient | null = null;
let autoUpdater: AutoUpdateManager | null = null;
let authManager: AuthManager | null = null;
let connectivityTimer: ReturnType<typeof setInterval> | null = null;
let watchdogOverlayInterval: NodeJS.Timeout | null = null;
let rendererResponsive = true;
let displayMetricsListenerAttached = false;

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
          tray?.setToolTip(`AMPLIFY Computer — ⚠ renderer boot failed (root empty)`);
        }
      }).catch(() => { /* probe errors never crash the app */ });
    }
  });
  overlayWindow.loadURL(RENDERER_URL);

  if (IS_DEV) {
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
  const icon = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  // §1 BP041 — NotCents Đ is the product identity; NO-FIAT-CONVERSION carried in tooltip
  tray.setToolTip('CAI (Đ) — AMPLIFY Computer · Hearth active');
  rebuildTrayMenu();
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
      label: `AMPLIFY Computer — ${modeLabel[mode]}${forcedLabel}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '🔥 AI Burst Mode',
      type: 'radio',
      checked: mode === 'ai_burst',
      click: () => setMode('ai_burst'),
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
      label: 'AMPLIFY Dashboard',
      click: () => openDashboard(),
    },
    {
      label: '🔥 Hearth Conjunction Window',
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
      click: () => shell.openExternal(getMoneyPennyURL(API_PORT)),
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
      label: 'Quit AMPLIFY',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ─── Dashboard Window ─────────────────────────────────────────────────────────

function openDashboard(): void {
  if (dashboardWindow) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 520,
    height: 680,
    title: 'AMPLIFY Dashboard',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const dashW = 520;
  const dashH = 680;
  const primary = screen.getPrimaryDisplay().workArea;
  const dashBounds = getSafeBounds({
    x: primary.x + Math.floor((primary.width - dashW) / 2),
    y: primary.y + Math.floor((primary.height - dashH) / 2),
    width: dashW,
    height: dashH,
  });
  dashboardWindow.setBounds(dashBounds);
  dashboardWindow.show();

  dashboardWindow.loadURL(
    IS_DEV
      ? 'http://localhost:5173/#/dashboard'
      : `file://${join(__dirname, '../renderer/index.html')}#/dashboard`,
  );

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  if (autoUpdater) autoUpdater.registerWindow(dashboardWindow);
  if (authManager) authManager.registerWindow(dashboardWindow);
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
    title: 'Hearth Conjunction Window — Heavy Booster Test',
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
        const res = await fetch(`http://127.0.0.1:11480/substrate/query`, {
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
        const res = await fetch(`http://127.0.0.1:11480/substrate/write`, {
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

  // Initialize auto-updater
  autoUpdater = new AutoUpdateManager();
  autoUpdater.init();

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

  // Create overlay + tray
  createOverlayWindow();
  createTray();
  registerIPCHandlers();

  const okQuit = globalShortcut.register('CommandOrControl+Shift+Alt+Q', () => {
    app.quit();
  });
  const okHide = globalShortcut.register('CommandOrControl+Shift+Alt+H', () => {
    overlayWindow?.hide();
    dashboardWindow?.hide();
  });

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
          { label: 'Quit AMPLIFY', click: () => app.quit() },
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
    if (!overlayWindow) createOverlayWindow();
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms for AMPLIFY
});

app.on('before-quit', async () => {
  stopOverlayWatchdog();
  if (connectivityTimer) clearInterval(connectivityTimer);
  autoUpdater?.destroy();
  await ollamaManager?.shutdown();
  await federationClient?.stop();
  await substrateServer?.stop();
});
