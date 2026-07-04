// MnemosyneC — Automatic Update Scheduler
// M21 — Express permission, 6-hour polling, SHA-256 verify, audit JSONL
//
// Canon ref: canon_mic_stamped_user_approval_circle_of_influence_reciprocal_trust_bp086
//   - No silent install. Ever.
//   - Toggle ON = express perpetual consent for LB-signed v0.5.x → v0.5.y patch stream
//   - Major version jumps (v0.5.x → v1.0.x) re-prompt regardless of toggle state

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { app, ipcMain, BrowserWindow, Notification } from 'electron';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutoUpdateConfig {
  autoUpdates: boolean;                                                     // Toggle 1 — default false
  installTiming: 'launch' | 'quit' | 'scheduled' | 'approve';             // Toggle 2 — default 'quit'
  scheduledTime: string;                                                    // HH:MM 24hr — default '03:00'
  majorVersionRequiresApproval: boolean;                                    // Toggle 3 — default true
}

const DEFAULT_AUTO_UPDATE_CONFIG: AutoUpdateConfig = {
  autoUpdates: false,
  installTiming: 'quit',
  scheduledTime: '03:00',
  majorVersionRequiresApproval: true,
};

// ─── Paths ────────────────────────────────────────────────────────────────────

function getUserDataDir(): string {
  try {
    return app.getPath('userData');
  } catch {
    return path.join(os.homedir(), '.mnemosynec');
  }
}

function getAutoUpdateConfigPath(): string {
  return path.join(getUserDataDir(), 'auto-update-config.json');
}

const UPDATES_DIR = path.join(os.homedir(), '.mnemosynec', 'updates');
const UPDATE_HISTORY_PATH = path.join(os.homedir(), '.mnemosynec', 'update-history.jsonl');

// ─── Config persistence ───────────────────────────────────────────────────────

export function getAutoUpdateConfig(): AutoUpdateConfig {
  try {
    const configPath = getAutoUpdateConfigPath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return { ...DEFAULT_AUTO_UPDATE_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('[auto-update] Failed to read config:', e);
  }
  return { ...DEFAULT_AUTO_UPDATE_CONFIG };
}

export function setAutoUpdateConfig(cfg: Partial<AutoUpdateConfig>): AutoUpdateConfig {
  const current = getAutoUpdateConfig();
  const updated = { ...current, ...cfg };
  try {
    const configPath = getAutoUpdateConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
  } catch (e) {
    console.error('[auto-update] Failed to write config:', e);
  }
  return updated;
}

// ─── Update history (JSONL) ───────────────────────────────────────────────────

export function appendUpdateHistory(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  try {
    const dir = path.dirname(UPDATE_HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(UPDATE_HISTORY_PATH, line + '\n');
  } catch (e) {
    console.error('[auto-update] Failed to write history:', e);
  }
}

export function getUpdateHistory(): Record<string, unknown>[] {
  try {
    if (!fs.existsSync(UPDATE_HISTORY_PATH)) return [];
    const lines = fs.readFileSync(UPDATE_HISTORY_PATH, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.slice(-100).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

// ─── Semver helpers ───────────────────────────────────────────────────────────

function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

function isMajorJump(current: string, latest: string): boolean {
  const [curMajor] = current.split('.').map(Number);
  const [latMajor] = latest.split('.').map(Number);
  return latMajor > curMajor;
}

// ─── Window registry for renderer notifications ───────────────────────────────

const registeredWindows: Set<BrowserWindow> = new Set();

export function registerWindowForAutoUpdate(win: BrowserWindow): void {
  registeredWindows.add(win);
  win.on('closed', () => registeredWindows.delete(win));
}

function broadcastToRenderer(channel: string, payload: unknown): void {
  for (const win of registeredWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function showSystemNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
}

function notifyPatchReady(version: string): void {
  showSystemNotification('MnemosyneC update ready', `v${version} is downloaded and ready to install.`);
  broadcastToRenderer('auto-update-patch-ready', { version });
}

function notifyMajorAvailable(version: string): void {
  showSystemNotification(
    'MnemosyneC major update available',
    `v${version} requires your approval — open MnemosyneC to review and install.`,
  );
  broadcastToRenderer('auto-update-major-available', { version });
}

function notifyApproveRequired(readyPath: string): void {
  const version = path.basename(readyPath)
    .replace('MnemosyneC-Setup-', '')
    .replace('.exe.ready', '');
  showSystemNotification(
    'MnemosyneC update ready for approval',
    `v${version} downloaded — open MnemosyneC to approve installation.`,
  );
  broadcastToRenderer('auto-update-approve-required', { version, readyPath });
}

function notifySecurityEvent(msg: string): void {
  showSystemNotification('MnemosyneC — Update security event', msg);
  broadcastToRenderer('auto-update-security-event', { message: msg });
  console.error('[auto-update] SECURITY EVENT:', msg);
}

// ─── LB public key ───────────────────────────────────────────────────────────
// Placeholder — compose with release-sign.yml workflow at build time.
// When the EV cert + signing workflow lands, replace null with the bundled
// Ed25519 public key (PEM string). SHA-256 is the enforced gate for v1.
const LB_PUBLIC_KEY: string | null = null;

// ─── Download + SHA-256 + Ed25519 verify ─────────────────────────────────────

interface VersionEntry {
  version: string;
  url: string;
  sha256: string;
  signature?: string;
}

async function downloadAndVerify(entry: VersionEntry): Promise<void> {
  if (!fs.existsSync(UPDATES_DIR)) {
    fs.mkdirSync(UPDATES_DIR, { recursive: true });
  }

  const stagedPath = path.join(UPDATES_DIR, `MnemosyneC-Setup-${entry.version}.exe.staged`);
  const readyPath  = path.join(UPDATES_DIR, `MnemosyneC-Setup-${entry.version}.exe.ready`);

  // Don't re-download if already staged and verified
  if (fs.existsSync(readyPath)) {
    console.log('[auto-update] Already staged:', readyPath);
    notifyPatchReady(entry.version);
    return;
  }

  appendUpdateHistory({ event: 'download_started', version: entry.version, url: entry.url });

  try {
    const resp = await fetch(entry.url);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

    const buffer = Buffer.from(await resp.arrayBuffer());

    // SHA-256 verification — hard gate
    const actualSha = crypto.createHash('sha256').update(buffer).digest('hex');
    if (actualSha !== entry.sha256) {
      // Write then immediately delete the tampered file
      try { fs.writeFileSync(stagedPath, buffer); fs.unlinkSync(stagedPath); } catch { /* noop */ }
      throw new Error(`SHA-256 mismatch: expected ${entry.sha256}, got ${actualSha}`);
    }

    // Write to staged path
    fs.writeFileSync(stagedPath, buffer);

    // Ed25519 signature verification (when LB_PUBLIC_KEY is bundled)
    if (entry.signature && LB_PUBLIC_KEY) {
      try {
        const verify = crypto.createVerify('ed25519');
        verify.update(buffer);
        const valid = verify.verify(LB_PUBLIC_KEY, Buffer.from(entry.signature, 'hex'));
        if (!valid) {
          fs.unlinkSync(stagedPath);
          throw new Error('Ed25519 signature verification failed — update rejected');
        }
      } catch (sigErr) {
        if (fs.existsSync(stagedPath)) try { fs.unlinkSync(stagedPath); } catch { /* noop */ }
        throw new Error(`Signature verification error: ${sigErr}`);
      }
    }

    // Promote staged → ready
    fs.renameSync(stagedPath, readyPath);

    appendUpdateHistory({
      event: 'download_complete',
      version: entry.version,
      sha256: actualSha,
      signature_valid: entry.signature ? (LB_PUBLIC_KEY ? true : 'sha256_only') : 'n/a',
    });
    notifyPatchReady(entry.version);
  } catch (e) {
    if (fs.existsSync(stagedPath)) try { fs.unlinkSync(stagedPath); } catch { /* noop */ }
    appendUpdateHistory({ event: 'download_error', version: entry.version, error: String(e) });
    notifySecurityEvent(`Update download/verification failed: ${e}`);
    throw e;
  }
}

// ─── Check and maybe download ─────────────────────────────────────────────────

async function checkAndMaybeDownload(): Promise<void> {
  const cfg = getAutoUpdateConfig();
  if (!cfg.autoUpdates) return;

  const currentVer = app.getVersion();

  try {
    const resp = await fetch('https://mnemosynec.org/version_trust.json', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) throw new Error(`version_trust fetch failed: ${resp.status}`);

    const trust = await resp.json() as {
      versions?: Array<{
        tier?: string;
        version?: string;
        url?: string;
        sha256?: string;
        signature?: string;
      }>;
    };

    const latestEntry = trust.versions?.find((v) => v.tier === 'latest');
    if (!latestEntry?.version) throw new Error('No latest entry in version_trust.json');

    const latestVer = latestEntry.version;

    appendUpdateHistory({
      event: 'check',
      result: semverGt(latestVer, currentVer) ? 'new_available' : 'already_current',
      version: currentVer,
      latest: latestVer,
    });

    if (!semverGt(latestVer, currentVer)) return; // already current

    // Major version jump gate
    if (cfg.majorVersionRequiresApproval && isMajorJump(currentVer, latestVer)) {
      notifyMajorAvailable(latestVer);
      return; // notification only, no auto-download
    }

    // Proceed with background download
    if (latestEntry.url && latestEntry.sha256) {
      await downloadAndVerify({
        version: latestVer,
        url: latestEntry.url,
        sha256: latestEntry.sha256,
        signature: latestEntry.signature,
      });
    } else {
      console.warn('[auto-update] version_trust entry missing url or sha256 — skipping download');
    }
  } catch (e) {
    console.error('[auto-update] Check failed:', e);
    appendUpdateHistory({ event: 'check_error', error: String(e), version: currentVer });
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoUpdateLoop(): void {
  if (autoUpdateTimer) return; // already running
  // 30s startup delay to avoid slamming the network on launch
  setTimeout(() => checkAndMaybeDownload().catch(() => {}), 30_000);
  autoUpdateTimer = setInterval(
    () => checkAndMaybeDownload().catch(() => {}),
    AUTO_UPDATE_CHECK_INTERVAL_MS,
  );
  console.log('[auto-update] Loop started — 6hr interval');
}

export function stopAutoUpdateLoop(): void {
  if (autoUpdateTimer) {
    clearInterval(autoUpdateTimer);
    autoUpdateTimer = null;
    console.log('[auto-update] Loop stopped');
  }
}

// ─── Scheduled install helper ─────────────────────────────────────────────────

function scheduleInstallAt(scheduledTime: string, readyPath: string): void {
  const [hourStr, minStr] = scheduledTime.split(':');
  const hour = parseInt(hourStr, 10);
  const min  = parseInt(minStr, 10);
  const now  = new Date();
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0);
  if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1); // tomorrow if past
  const delay = scheduled.getTime() - now.getTime();
  console.log(`[auto-update] Install scheduled at ${scheduledTime} (${Math.round(delay / 60000)} min from now)`);
  setTimeout(() => triggerInstall(readyPath), delay);
}

function triggerInstall(readyPath: string): void {
  const exePath = readyPath.replace('.ready', '');
  try {
    fs.renameSync(readyPath, exePath);
    appendUpdateHistory({ event: 'install_scheduled', trigger: 'auto', path: exePath });
    // Spawn installer silently and quit
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { spawn } = require('child_process') as typeof import('child_process');
    spawn(exePath, ['/SILENT'], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  } catch (e) {
    console.error('[auto-update] triggerInstall failed:', e);
    appendUpdateHistory({ event: 'install_error', error: String(e) });
  }
}

// ─── Pending install check (on launch) ───────────────────────────────────────

export async function checkAndTriggerPendingInstall(): Promise<void> {
  const cfg = getAutoUpdateConfig();
  if (!cfg.autoUpdates) return;
  if (!fs.existsSync(UPDATES_DIR)) return;

  let readyFiles: string[];
  try {
    readyFiles = fs.readdirSync(UPDATES_DIR).filter((f) => f.endsWith('.ready'));
  } catch {
    return;
  }
  if (readyFiles.length === 0) return;

  const readyPath = path.join(UPDATES_DIR, readyFiles[readyFiles.length - 1]); // latest

  switch (cfg.installTiming) {
    case 'launch':
      triggerInstall(readyPath);
      break;
    case 'quit':
      app.on('before-quit', () => triggerInstall(readyPath));
      break;
    case 'scheduled':
      scheduleInstallAt(cfg.scheduledTime, readyPath);
      break;
    case 'approve':
      notifyApproveRequired(readyPath);
      break;
  }
}

// ─── Config migration (Block 6) ───────────────────────────────────────────────
// The old installOnQuit toggle lived in renderer localStorage only.
// Migration to the new config key happens on the renderer side in AutomaticUpdatesSection
// (useEffect reads 'mnemo_auto_install_on_quit' and calls set-auto-update-config).
// No main-process migration is needed since the old setting was never persisted here.
export function migrateAutoInstallConfig(): void {
  console.log('[auto-update] Config migration check complete (renderer-side migration handles legacy key)');
}

// ─── IPC registration ─────────────────────────────────────────────────────────

export function registerAutoUpdateIPC(): void {
  try { ipcMain.handle('get-auto-update-config', () => getAutoUpdateConfig()); }
  catch (e) { console.error('[auto-update] Duplicate IPC registration: get-auto-update-config', e); }

  try {
    ipcMain.handle('set-auto-update-config', (_event, cfg: Partial<AutoUpdateConfig>) => {
      const updated = setAutoUpdateConfig(cfg);
      if (updated.autoUpdates) {
        startAutoUpdateLoop();
      } else {
        stopAutoUpdateLoop();
      }
      return updated;
    });
  } catch (e) { console.error('[auto-update] Duplicate IPC registration: set-auto-update-config', e); }

  try {
    ipcMain.handle('get-update-history', () => getUpdateHistory());
  } catch (e) { console.error('[auto-update] Duplicate IPC registration: get-update-history', e); }

  // Renderer-triggered install approval (Toggle 2 = 'approve')
  ipcMain.on('auto-update-approve-install', (_event, readyPath: string) => {
    triggerInstall(readyPath);
  });
}
