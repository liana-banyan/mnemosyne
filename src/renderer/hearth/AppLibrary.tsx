// AMPLIFY Computer — Hearth App Builder — App Library
// B69b — Lists member's installed Hearth apps.
// Actions: Run / Uninstall / View Spec / Re-Generate (re-run codegen with edited spec).

import { useState, useEffect } from 'react';
import type { HearthApp } from '../../main/hearth_app_builder/types';

interface AppLibraryProps {
  onReGenerate?: (app: HearthApp) => void;
}

export function AppLibrary({ onReGenerate }: AppLibraryProps) {
  const [apps, setApps] = useState<HearthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState<HearthApp | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

  async function loadLibrary() {
    setLoading(true);
    try {
      const result = await window.amplify.hearthLibraryQuery?.();
      setApps(result ?? []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  async function handleRun(app: HearthApp) {
    if (launching) return;
    setLaunching(app.uuid);
    try {
      await window.amplify.hearthInstall?.({
        uuid: app.uuid,
        appName: app.appName,
        description: app.description,
        appDir: app.appDir,
        installerPath: app.installerPath ?? '',
        spec: app.spec,
      });
    } finally {
      setLaunching(null);
    }
  }

  async function handleUninstall(app: HearthApp) {
    if (!confirm(`Remove "${app.appName}" from your Hearth Library?\n\nYour data will remain at: ${app.appDir}`)) return;
    setUninstalling(app.uuid);
    try {
      await window.amplify.hearthUninstall?.(app.uuid);
      await loadLibrary();
    } finally {
      setUninstalling(null);
    }
  }

  if (loading) {
    return <div style={styles.empty}><div style={styles.spinner}>Loading your apps…</div></div>;
  }

  if (apps.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📦</div>
        <div style={styles.emptyTitle}>No apps built yet</div>
        <div style={styles.emptySubtext}>Chat with Hearth to build your first app!</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>Your App Library</h2>
        <button style={styles.refreshBtn} onClick={loadLibrary}>Refresh</button>
      </div>

      <div style={styles.grid}>
        {apps.map((app) => (
          <div key={app.uuid} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.appIcon}>🔥</div>
              <div style={styles.appInfo}>
                <div style={styles.appName}>{app.appName}</div>
                <div style={styles.appMeta}>
                  {new Date(app.installedAt).toLocaleDateString()} · {app.os}
                  {' · '}
                  <span style={app.buildStatus === 'installed' ? styles.statusInstalled : styles.statusBuilt}>
                    {app.buildStatus === 'installed' ? 'Installed' : 'Built'}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.appDesc}>{app.description}</div>

            <div style={styles.entityList}>
              {app.spec.entities.map((e) => (
                <span key={e.name} style={styles.entityTag}>{e.name}</span>
              ))}
            </div>

            <div style={styles.actions}>
              <button
                style={{ ...styles.actionBtn, ...styles.runBtn }}
                onClick={() => handleRun(app)}
                disabled={launching === app.uuid || !app.installerPath}
                title={!app.installerPath ? 'No installer — build again to generate installer' : 'Launch this app'}
              >
                {launching === app.uuid ? 'Launching…' : '▶ Run'}
              </button>

              <button
                style={{ ...styles.actionBtn, ...styles.specBtn }}
                onClick={() => setSelectedSpec(app)}
              >
                📋 Spec
              </button>

              <button
                style={{ ...styles.actionBtn, ...styles.regenBtn }}
                onClick={() => onReGenerate?.(app)}
                title="Re-generate this app with a new description"
              >
                ↺ Re-Gen
              </button>

              <button
                style={{ ...styles.actionBtn, ...styles.uninstallBtn }}
                onClick={() => handleUninstall(app)}
                disabled={uninstalling === app.uuid}
              >
                {uninstalling === app.uuid ? 'Removing…' : '✕ Remove'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Spec modal */}
      {selectedSpec && (
        <div style={styles.modalOverlay} onClick={() => setSelectedSpec(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{selectedSpec.appName} — App Spec</h3>
              <button style={styles.modalClose} onClick={() => setSelectedSpec(null)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <pre style={styles.specPre}>{JSON.stringify(selectedSpec.spec, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  headerTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#2c3e50',
    margin: 0,
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    padding: '0.25rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: '#495057',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '10px',
    padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  appIcon: {
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  appInfo: {
    flex: 1,
    minWidth: 0,
  },
  appName: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#212529',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  appMeta: {
    fontSize: '0.75rem',
    color: '#6c757d',
    marginTop: '0.1rem',
  },
  statusInstalled: {
    color: '#28a745',
    fontWeight: 600,
  },
  statusBuilt: {
    color: '#e67e22',
    fontWeight: 600,
  },
  appDesc: {
    fontSize: '0.85rem',
    color: '#495057',
    marginBottom: '0.75rem',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  entityList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    marginBottom: '0.75rem',
  },
  entityTag: {
    background: '#e9ecef',
    color: '#495057',
    fontSize: '0.72rem',
    padding: '0.1rem 0.4rem',
    borderRadius: '3px',
    fontFamily: 'monospace',
  },
  actions: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  actionBtn: {
    border: 'none',
    borderRadius: '5px',
    padding: '0.3rem 0.6rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  runBtn: {
    background: '#28a745',
    color: 'white',
  },
  specBtn: {
    background: '#6c757d',
    color: 'white',
  },
  regenBtn: {
    background: '#e67e22',
    color: 'white',
  },
  uninstallBtn: {
    background: '#f8d7da',
    color: '#721c24',
  },
  empty: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#6c757d',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '0.75rem',
  },
  emptyTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#495057',
    marginBottom: '0.25rem',
  },
  emptySubtext: {
    fontSize: '0.85rem',
    color: '#adb5bd',
  },
  spinner: {
    color: '#6c757d',
    fontSize: '0.95rem',
    fontStyle: 'italic',
    fontFamily: 'inherit',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    background: 'white',
    borderRadius: '10px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #dee2e6',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#2c3e50',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: '1rem',
    cursor: 'pointer',
    color: '#6c757d',
    padding: '0.25rem 0.5rem',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.25rem',
  },
  specPre: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    color: '#212529',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};
