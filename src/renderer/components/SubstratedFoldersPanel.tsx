/**
 * SubstratedFoldersPanel™ — Mnemosyne™ v0.1.10 scaffold
 * Renders in Developer Tab → Atlas™ panel or standalone Settings section.
 * TODO v0.1.10: wire to watcher IPC channels, connect to CaithedralInspector™
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

export function SubstratedFoldersPanel() {
  const [folders, setFolders] = useState<SubstratedFolder[]>([]);
  const [recentEblets, setRecentEblets] = useState<EbletMintRecord[]>([]);
  const [stats, setStats] = useState({ foldersWatched: 0, ebletsMinted: 0, lastEventAt: null as string | null });

  useEffect(() => {
    // TODO v0.1.10: wire to window.amplify.watcher.listFolders()
    // TODO v0.1.10: subscribe to watcher:eblet-minted IPC events
  }, []);

  const handleAddFolder = async () => {
    // TODO v0.1.10: call window.amplify.dialog.showOpenDialog({ properties: ['openDirectory'] })
    // then window.amplify.watcher.addFolder(path)
    alert('TODO v0.1.10: folder picker not yet wired — add via IPC');
  };

  return (
    <div style={{ padding: 16, color: '#e2e8f0', fontFamily: 'monospace' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>
        Substrated Folders™
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>v0.1.10 scaffold</span>
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
            <div key={f.id} style={{ background: '#1e293b', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: '#34d399' }}>✓</span> {f.absolutePath}
              <span style={{ color: '#475569', marginLeft: 8 }}>{new Date(f.addedAt).toLocaleDateString()}</span>
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
