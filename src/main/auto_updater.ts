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
import { runQuorumCheck } from './keys_engines/quorum_check';
import { getCircleMembership } from './keys_engines/circle_membership';
import { verifySocceriKey } from './keys_engines/key_verifier';

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
  private stateListeners: Array<(state: UpdateState) => void> = [];

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

  downloadNow(): void {
    if (this.state.status === 'available') {
      const version = this.state.version ?? '';
      this._runTrustGate(version, '').then((trusted) => {
        if (!trusted) return;
        autoUpdater.downloadUpdate().catch((err: Error) => {
          this._setState({ status: 'error', errorMessage: err.message });
        });
      }).catch(() => {});
    }
  }

  /** 1D-FIX: opt-out toggle — persisted by renderer in localStorage, propagated via IPC */
  setAutoInstallOnQuit(enabled: boolean): void {
    autoUpdater.autoInstallOnAppQuit = enabled;
    console.log(`[AutoUpdater] autoInstallOnAppQuit = ${enabled}`);
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  /** Subscribe to update state changes from the main process (e.g. to update tray tooltip). */
  onStateChanged(listener: (state: UpdateState) => void): void {
    this.stateListeners.push(listener);
  }

  destroy(): void {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    if (this.periodicTimer) clearInterval(this.periodicTimer);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _configureUpdater(): void {
    // Canonical release-channel feed URL: https://mnemosynec.ai/download/
    // This is set at build time via the `publish` block in package.json (provider: generic).
    // There is NO runtime setFeedURL call -- electron-updater reads the baked-in URL from
    // the app-update.yml embedded in the asar. Do NOT add a setFeedURL override here;
    // doing so would require keeping two URLs in sync. If the release URL ever changes,
    // update package.json `build.publish.url` (single source of truth) and rebuild.
    //
    // M22 §A.8 / canon_hugo_tower_version_data_source_is_version_trust_json_bp090:
    // version_trust.json at https://mnemosynec.org/download/version_trust.json is the
    // human-readable version-of-record. The electron-updater generic provider reads
    // latest.yml from the same base URL. Both must be updated in lockstep on release.
    // Current feedURL verified: https://mnemosynec.ai/download/ (package.json publish.url).
    //
    // BP067 Phase 1D — SAFE TIER: notify + one-click apply, NOT silent auto-install.
    // DO NOT change autoDownload to true on an unsigned binary (malware vector risk:
    // compromised feed/DNS → unsigned exe executes with no OS warning).
    //
    // Safe-silent prerequisites (unlock only when ALL three land):
    //   1. electron-updater wired with sha512 verify [DONE — this file]
    //   2. Windows code-signed installer [PENDING — requires EV cert]
    //   3. Signed update manifest (latest.yml signed with private key) [PENDING]
    autoUpdater.autoDownload = false;      // user confirms download via "Download" button
    autoUpdater.autoInstallOnAppQuit = true;  // install on next quit once downloaded
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
      // BP067 Phase 1D — safe tier: notify but do NOT auto-download
      this._showSystemNotification(
        'MnemosyneC Update Available',
        `v${info.version} is ready — open MnemosyneC to download`,
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
        'MnemosyneC ready to update',
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
    // 'get-update-state' handle lives in registerIPCHandlers (index.ts) -- canonical site.
    // DO NOT add a second ipcMain.handle here; electron-updater would throw on duplicate.

    ipcMain.on('check-for-updates', () => {
      this.checkNow().catch(() => {});
    });

    ipcMain.on('install-update', () => {
      this.installNow();
    });

    // BP067 Phase 1D — user-triggered download (safe tier: notify+one-click)
    ipcMain.on('download-update', () => {
      this.downloadNow();
    });

    // 1D-FIX: renderer persists opt-out preference, propagates here
    ipcMain.on('set-auto-install-on-quit', (_event, enabled: boolean) => {
      this.setAutoInstallOnQuit(enabled);
    });
  }

  private _setState(update: Partial<UpdateState>): void {
    this.state = { ...this.state, ...update };
    this._broadcast('update-state-changed', this.state);
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
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

  private async _runTrustGate(version: string, payloadHash: string): Promise<boolean> {
    try {
      const circle = await getCircleMembership();
      if (circle.peers.length < 2) {
        console.warn('[AutoUpdater] Trust gate: fewer than 2 Circle peers available, bypassing quorum (AMBER)');
        return true;
      }
      const peerAddresses = circle.peers.map((p) => p.address);

      const ledgerUrl = `${process.env.SUPABASE_URL}/rest/v1/frontier_reputation_log?update_version=eq.${encodeURIComponent(version)}&select=claimed_hash&order=timestamp.desc&limit=1`;
      let ledgerHash = '';
      try {
        const ledgerRes = await fetch(ledgerUrl, {
          headers: { apikey: process.env.SUPABASE_ANON_KEY ?? '' },
        });
        const rows = await ledgerRes.json() as Array<{ claimed_hash: string }>;
        ledgerHash = rows[0]?.claimed_hash ?? payloadHash;
      } catch {
        ledgerHash = payloadHash;
      }

      const quorum = await runQuorumCheck(version, ledgerHash, peerAddresses);

      if (!quorum.passed) {
        const frameId = process.env.LB_FRAME_ID ?? 'unknown';
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/frontier_reputation_log`,
          {
            method: 'POST',
            headers: {
              apikey: process.env.SUPABASE_ANON_KEY ?? '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              source_frame_id: quorum.peerResponses[0]?.peerId ?? 'unknown',
              claimed_hash: payloadHash,
              ledger_hash: ledgerHash,
              mismatch_delta: quorum.mismatchDelta ? JSON.parse(quorum.mismatchDelta) : null,
              requesting_frame_id: frameId,
              update_version: version,
              severity: 'quorum_fail',
              resolved: false,
            }),
          },
        ).catch((e: Error) => console.error('[AutoUpdater] Ledger emit failed:', e.message));

        this._setState({
          status: 'error',
          errorMessage: 'Update blocked · trust verification failed · check Reputation Log',
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error('[AutoUpdater] Trust gate error:', err);
      return true;
    }
  }
}
