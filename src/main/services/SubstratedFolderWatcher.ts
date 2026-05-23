/**
 * SubstratedFolderWatcher — Mnemosyne™ v0.1.10 scaffold
 *
 * Watches user-designated Substrated folders for file changes.
 * Auto-mints Eblet™ records on file write events.
 *
 * Canon: canon_continuous_metric_discipline_every_bishop_reads_bp051
 * Composes with: KitchenTableStore (v0.1.8) · P2PDiscovery (v0.1.8) · CathedralFederation (v0.1.9+)
 *
 * TODO v0.1.10:
 * - Wire into main process IPC registration
 * - Connect to CaithedralInspector™ renderer for live Eblet™ feed
 * - Add debounce (300ms) to prevent double-fire on rapid saves
 * - Implement sha256 dual-write on every Eblet™ record
 * - Add Library-of-Congress discipline: source_deleted flag on file removal
 * - Integration test: create file → verify Eblet™ appears in CaithedralInspector™
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubstratedFolder {
  id: string;
  absolutePath: string;
  addedAt: string;
  active: boolean;
}

export interface EbletMintRecord {
  id: string;
  sourceFilePath: string;
  sourceSha256: string;
  contentExcerpt: string; // first 500 chars
  mintedAt: string;
  event: 'created' | 'changed' | 'deleted';
  source_deleted: boolean; // Library-of-Congress: preserve Eblet even when source is gone
}

export interface WatcherStats {
  foldersWatched: number;
  ebletsMinted: number;
  lastEventAt: string | null;
  errors: string[];
}

// ─── IPC Channel Constants ────────────────────────────────────────────────────

export const IPC_WATCHER = {
  ADD_FOLDER:    'watcher:add-folder',    // renderer → main: { folderPath: string }
  REMOVE_FOLDER: 'watcher:remove-folder', // renderer → main: { folderId: string }
  LIST_FOLDERS:  'watcher:list-folders',  // renderer → main (no args) → SubstratedFolder[]
  GET_STATS:     'watcher:get-stats',     // renderer → main (no args) → WatcherStats
  EBLET_MINTED:  'watcher:eblet-minted',  // main → renderer: EbletMintRecord (push event)
  FOLDER_ERROR:  'watcher:folder-error',  // main → renderer: { folderId, error }
} as const;

// ─── SubstratedFolderWatcher ──────────────────────────────────────────────────

export class SubstratedFolderWatcher {
  private folders: Map<string, SubstratedFolder> = new Map();
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private ebletLog: EbletMintRecord[] = [];
  private stats: WatcherStats = {
    foldersWatched: 0,
    ebletsMinted: 0,
    lastEventAt: null,
    errors: [],
  };
  private mainWindow: BrowserWindow | null = null;
  private persistPath: string;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    const userDataPath = app.getPath('userData');
    this.persistPath = path.join(userDataPath, 'substrated_folders.json');
    this.loadPersistedFolders();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  addFolder(folderPath: string): SubstratedFolder | { error: string } {
    const resolved = path.resolve(folderPath);
    if (!fs.existsSync(resolved)) {
      return { error: `Path does not exist: ${resolved}` };
    }
    if (!fs.statSync(resolved).isDirectory()) {
      return { error: `Not a directory: ${resolved}` };
    }
    for (const [, folder] of this.folders) {
      if (folder.absolutePath === resolved) {
        return { error: `Already substrated: ${resolved}` };
      }
    }

    const id = crypto.randomUUID();
    const folder: SubstratedFolder = {
      id,
      absolutePath: resolved,
      addedAt: new Date().toISOString(),
      active: true,
    };
    this.folders.set(id, folder);
    this.startWatcher(id, folder);
    this.persistFolders();
    this.stats.foldersWatched = this.folders.size;
    return folder;
  }

  removeFolder(folderId: string): boolean {
    const folder = this.folders.get(folderId);
    if (!folder) return false;
    this.stopWatcher(folderId);
    this.folders.delete(folderId);
    this.persistFolders();
    this.stats.foldersWatched = this.folders.size;
    return true;
  }

  listFolders(): SubstratedFolder[] {
    return Array.from(this.folders.values());
  }

  getStats(): WatcherStats {
    return { ...this.stats };
  }

  stopAll(): void {
    for (const id of this.watchers.keys()) {
      this.stopWatcher(id);
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private startWatcher(id: string, folder: SubstratedFolder): void {
    try {
      const watcher = fs.watch(
        folder.absolutePath,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) return;
          const fullPath = path.join(folder.absolutePath, filename);

          // Debounce 300ms — TODO v0.1.10: make configurable
          const key = fullPath;
          if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key)!);
          }
          this.debounceTimers.set(key, setTimeout(() => {
            this.debounceTimers.delete(key);
            this.handleFileEvent(eventType as 'rename' | 'change', fullPath);
          }, 300));
        }
      );
      this.watchers.set(id, watcher);
    } catch (err: unknown) {
      const msg = `Failed to watch ${folder.absolutePath}: ${err instanceof Error ? err.message : String(err)}`;
      this.stats.errors.push(msg);
      this.mainWindow?.webContents.send(IPC_WATCHER.FOLDER_ERROR, { folderId: id, error: msg });
    }
  }

  private stopWatcher(id: string): void {
    const watcher = this.watchers.get(id);
    if (watcher) {
      watcher.close();
      this.watchers.delete(id);
    }
  }

  private handleFileEvent(eventType: 'rename' | 'change', filePath: string): void {
    const exists = fs.existsSync(filePath);
    const isDeleted = !exists;

    let sha256 = '';
    let excerpt = '';
    let event: EbletMintRecord['event'] = 'changed';

    if (isDeleted) {
      event = 'deleted';
    } else {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) return;

        // TODO v0.1.10: stream large files; don't load into memory
        const content = fs.readFileSync(filePath);
        sha256 = crypto.createHash('sha256').update(content).digest('hex');
        const text = content.toString('utf8', 0, Math.min(content.length, 2000));
        excerpt = text.replace(/\0/g, '').slice(0, 500);
        event = eventType === 'rename' ? 'created' : 'changed';
      } catch {
        return; // file locked or inaccessible — skip
      }
    }

    const eblet: EbletMintRecord = {
      id: crypto.randomUUID(),
      sourceFilePath: filePath,
      sourceSha256: sha256,
      contentExcerpt: excerpt,
      mintedAt: new Date().toISOString(),
      event,
      source_deleted: isDeleted,
    };

    this.ebletLog.push(eblet);
    this.stats.ebletsMinted++;
    this.stats.lastEventAt = eblet.mintedAt;

    this.mainWindow?.webContents.send(IPC_WATCHER.EBLET_MINTED, eblet);

    // TODO v0.1.10: persist Eblet to KitchenTableStore / Cathedral substrate
    // TODO v0.1.10: sha256 dual-write to Asteroid-ProofVault compatible path
  }

  private loadPersistedFolders(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf8')) as SubstratedFolder[];
        for (const folder of data) {
          if (fs.existsSync(folder.absolutePath)) {
            this.folders.set(folder.id, folder);
            this.startWatcher(folder.id, folder);
          }
        }
        this.stats.foldersWatched = this.folders.size;
      }
    } catch {
      // corrupt persist — start fresh
    }
  }

  private persistFolders(): void {
    try {
      fs.writeFileSync(this.persistPath, JSON.stringify(Array.from(this.folders.values()), null, 2), 'utf8');
    } catch { /* non-fatal */ }
  }
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

/**
 * registerWatcherIpc — call from main process index.ts during setup
 *
 * TODO v0.1.10: wire into src/main/index.ts registerKitchenTableIpc pattern
 */
export function registerWatcherIpc(watcher: SubstratedFolderWatcher): void {
  ipcMain.handle(IPC_WATCHER.ADD_FOLDER, (_event, folderPath: string) => {
    return watcher.addFolder(folderPath);
  });

  ipcMain.handle(IPC_WATCHER.REMOVE_FOLDER, (_event, folderId: string) => {
    return watcher.removeFolder(folderId);
  });

  ipcMain.handle(IPC_WATCHER.LIST_FOLDERS, () => {
    return watcher.listFolders();
  });

  ipcMain.handle(IPC_WATCHER.GET_STATS, () => {
    return watcher.getStats();
  });
}
