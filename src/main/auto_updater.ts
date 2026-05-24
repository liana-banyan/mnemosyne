// AMPLIFY Computer — Auto-Update Manager
// B37 Phase 6 — electron-updater integration
//
// Flow:
//   App start → 30s delay → checkForUpdates()
//   update-available  → notify renderer (show banner)
//   download-progress → send progress to renderer
//   update-downloaded → notify renderer (show "Restart to update")
//   User confirms     → quitAndInstall()
//
// Update server: https://mnemosynec.ai/download/ (generic provider · latest.yml)
// Fallback: manual check via tray menu

import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { ipcMain, BrowserWindow, Notification, app } from 'electron';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
  version?: string;
  releaseNotes?: string;
  downloadProgress?: number;   // 0-100
  errorMessage?: string;
}

// ─── Auto-Update Manager ──────────────────────────────────────────────────────

export class AutoUpdateManager {
  private state: UpdateState = { status: 'idle' };
  private windows: Set<BrowserWindow> = new Set();
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  // 4-hour periodic check interval
  private static readonly PERIODIC_CHECK_MS = 4 * 60 * 60 * 1000;
  // Initial check delay after launch (avoid slowing startup)
  private static readonly INITIAL_DELAY_MS = 30_000;

  init(): void {
    // In dev mode, electron-updater would fail looking for a published version.
    // Disable auto-update in dev — allow manual checks only.
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      console.log('[AutoUpdater] Dev mode — auto-update disabled');
      return;
    }

    this._configureUpdater();
    this._attachEvents();
    this._scheduleInitialCheck();
    this._registerIPCHandlers();
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));

    // Push current state to newly registered window
    this._broadcast('update-state-changed', this.state);
  }

  async checkNow(): Promise<void> {
    if (!app.isPackaged) {
      console.log('[AutoUpdater] Skipping check — not packaged');
      return;
    }
    // Zombie re-download guard: if a complete update is already on disk, skip re-download.
    // electron-updater would otherwise re-fire the download flow on every checkForUpdates call.
    if (this.state.status === 'downloaded') {
      console.log('[AutoUpdater] Update already downloaded — skipping re-check; re-broadcasting ready state');
      this._broadcast('update-state-changed', this.state);
      return;
    }
    if (this.state.status === 'downloading') {
      console.log('[AutoUpdater] Download already in progress — skipping duplicate check');
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      this._setState({ status: 'error', errorMessage: String(err) });
    }
  }

  installNow(): void {
    if (this.state.status === 'downloaded') {
      autoUpdater.quitAndInstall(true, true);
    }
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    if (this.periodicTimer) clearInterval(this.periodicTimer);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _configureUpdater(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    // Suppress electron-updater's own logger spam
    autoUpdater.logger = {
      info: (msg: unknown) => console.log('[AutoUpdater]', msg),
      warn: (msg: unknown) => console.warn('[AutoUpdater]', msg),
      error: (msg: unknown) => console.error('[AutoUpdater]', msg),
      debug: () => {},
    };
  }

  private _attachEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this._setState({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this._setState({
        status: 'available',
        version: info.version,
        releaseNotes: this._extractReleaseNotes(info.releaseNotes),
      });
      this._showSystemNotification(
        'Mnemosyne Update',
        `v${info.version} is available — downloading now…`,
      );
    });

    autoUpdater.on('update-not-available', () => {
      this._setState({ status: 'not-available' });
      // Reset to idle after a moment so the UI doesn't show "up to date" permanently
      setTimeout(() => this._setState({ status: 'idle' }), 5000);
    });

    autoUpdater.on('download-progress', (progress) => {
      this._setState({
        status: 'downloading',
        downloadProgress: Math.round(progress.percent),
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this._setState({
        status: 'downloaded',
        version: info.version,
        releaseNotes: this._extractReleaseNotes(info.releaseNotes),
        downloadProgress: 100,
      });
      this._showSystemNotification(
        'Mnemosyne ready to update',
        `v${info.version} downloaded — restart to apply`,
      );
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('[AutoUpdater] Error:', err.message);
      this._setState({ status: 'error', errorMessage: err.message });
      // Don't stay in error state permanently
      setTimeout(() => this._setState({ status: 'idle' }), 15000);
    });
  }

  private _scheduleInitialCheck(): void {
    this.checkTimer = setTimeout(async () => {
      await this.checkNow();
      // Start periodic checks
      this.periodicTimer = setInterval(
        () => this.checkNow(),
        AutoUpdateManager.PERIODIC_CHECK_MS,
      );
    }, AutoUpdateManager.INITIAL_DELAY_MS);
  }

  private _registerIPCHandlers(): void {
    ipcMain.handle('get-update-state', () => this.getState());

    ipcMain.on('check-for-updates', () => {
      this.checkNow().catch(() => {});
    });

    ipcMain.on('install-update', () => {
      this.installNow();
    });
  }

  private _setState(update: Partial<UpdateState>): void {
    this.state = { ...this.state, ...update };
    this._broadcast('update-state-changed', this.state);
  }

  private _broadcast(channel: string, payload: unknown): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }

  private _showSystemNotification(title: string, body: string): void {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show();
    }
  }

  private _extractReleaseNotes(
    notes: unknown,
  ): string | undefined {
    if (!notes) return undefined;
    if (typeof notes === 'string') return notes.slice(0, 500);
    if (Array.isArray(notes)) {
      return (notes as Array<{ version?: string; note?: string | null }>)
        .map((n) => `v${n.version ?? '?'}: ${n.note ?? ''}`)
        .join('\n')
        .slice(0, 500);
    }
    return undefined;
  }
}
