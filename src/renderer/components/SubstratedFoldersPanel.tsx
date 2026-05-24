/**
 * SubstratedFoldersPanel™ — Mnemosyne™ v0.1.10
 * Renders in Developer Tab → Substrate panel.
 * Live IPC: watcher:list-folders, watcher:add-folder, watcher:eblet-minted
 */
import React, { useState, useEffect } from 'react';

interface SubstratedFolder {
  id: string;
  absolutePath: string;
  addedAt: string;
  active: boolean;
}

interface EbletMintRecord {
  id: string;
  sourceFilePath: string;
  mintedAt: string;
  event: 'created' | 'changed' | 'deleted';
}

interface WatcherStats {
  foldersWatched: number;
  ebletsMinted: number;
  lastEventAt: string | null;
  errors: string[];
}

export function SubstratedFoldersPanel() {
  const [folders, setFolders] = useState<SubstratedFolder[]>([]);
  const [recentEblets, setRecentEblets] = useState<EbletMintRecord[]>([]);
  const [stats, setStats] = useState<WatcherStats>({ foldersWatched: 0, ebletsMinted: 0, lastEventAt: null, errors: [] });

  useEffect(() => {
    const w = window.amplify?.watcher;
    if (!w) return;

    w.listFolders?.().then((f) => setFolders(f as SubstratedFolder[])).catch(console.error);
    w.getStats?.().then((s) => setStats(s as WatcherStats)).catch(console.error);

    w.onEbletMinted?.((eblet) => {
      const e = eblet as EbletMintRecord;
      setRecentEblets((prev) => [...prev.slice(-49), e]);
      setStats((prev) => ({ ...prev, ebletsMinted: prev.ebletsMinted + 1, lastEventAt: e.mintedAt }));
    });
  }, []);

  const handleAddFolder = async () => {
    const w = window.amplify?.watcher;
    if (!w) return;

    const result = await w.openFolderDialog?.();
    if (!result || result.canceled || !result.filePaths?.[0]) return;

    const added = await w.addFolder?.(result.filePaths[0]);
    if (!added) return;

    if ((added as { error?: string }).error) {
      alert((added as { error: string }).error);
      return;
    }
    setFolders((prev) => [...prev, added as SubstratedFolder]);
    setStats((prev) => ({ ...prev, foldersWatched: prev.foldersWatched + 1 }));
  };

  const handleRemoveFolder = async (folderId: string) => {
    const ok = await window.amplify?.watcher?.removeFolder?.(folderId);
    if (ok) {
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setStats((prev) => ({ ...prev, foldersWatched: Math.max(0, prev.foldersWatched - 1) }));
    }
  };

  return (
    <div style={{ padding: 16, color: '#e2e8f0', fontFamily: 'monospace' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>
        Substrated Folders™
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>v0.1.10</span>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 12, color: '#94a3b8' }}>
        <span>📁 Folders: <strong style={{ color: '#60a5fa' }}>{stats.foldersWatched}</strong></span>
        <span>📄 Eblets™ minted: <strong style={{ color: '#34d399' }}>{stats.ebletsMinted}</strong></span>
        <span>🕒 Last event: <strong>{stats.lastEventAt ? new Date(stats.lastEventAt).toLocaleTimeString() : '—'}</strong></span>
      </div>

      {/* Folder list */}
      <div style={{ marginBottom: 12 }}>
        {folders.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
            No Substrated folders yet. Add a folder to begin mining Eblet™ records.
          </div>
        ) : (
          folders.map(f => (
            <div key={f.id} style={{ background: '#1e293b', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                <span style={{ color: '#34d399' }}>✓</span> {f.absolutePath}
                <span style={{ color: '#475569', marginLeft: 8 }}>{new Date(f.addedAt).toLocaleDateString()}</span>
              </span>
              <button
                onClick={() => handleRemoveFolder(f.id)}
                style={{ background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 4, padding: '2px 7px', fontSize: 10, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <button
        onClick={handleAddFolder}
        style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 12 }}
      >
        + Add Folder
      </button>

      {/* Recent Eblets™ feed */}
      {recentEblets.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Recent Eblet™ Mints</div>
          {recentEblets.slice(-10).reverse().map(e => (
            <div key={e.id} style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
              <span style={{ color: e.event === 'deleted' ? '#f87171' : '#34d399' }}>
                {e.event === 'created' ? '✚' : e.event === 'changed' ? '✎' : '✕'}
              </span>{' '}
              {e.sourceFilePath.split('\\').pop()} — {new Date(e.mintedAt).toLocaleTimeString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
