// UpdateToast — v0.1.10 · Bug #1 auto-update UX
// Subscribes to update-state-changed IPC events and surfaces:
//   - Download progress bar pill (bottom-center, pointer-events: none)
//   - "Ready to install" persistent toast with Install & Restart / Later buttons
// Zombie re-download loop is broken in main/auto_updater.ts; this component
// only reacts to state, never triggers additional checkForUpdates calls.

import React, { useState, useEffect, useCallback } from 'react';
import type { UpdateState } from '../amplify.d';

export function UpdateToast() {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.amplify) return;
    window.amplify.getUpdateState?.().then(setUpdateState).catch(() => {});
    const cleanup = window.amplify.onUpdateStateChanged?.((state) => {
      setUpdateState(state);
      // Re-surface the toast whenever a NEW download completes
      if (state.status === 'downloaded') setDismissed(false);
    });
    return cleanup ?? undefined;
  }, []);

  const handleInstall = useCallback(() => {
    window.amplify?.installUpdate?.();
  }, []);

  if (!updateState) return null;

  // "Update available" banner — notify + one-click download (safe tier, BP067 Phase 1D)
  if (updateState.status === 'available' && !dismissed) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 36,
          right: 16,
          background: 'rgba(15,17,26,0.97)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 10,
          padding: '12px 16px',
          zIndex: 99998,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 12,
          color: '#e2e8f0',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxWidth: 290,
          minWidth: 230,
        }}
        role="alertdialog"
        aria-label={`MnemosyneC v${updateState.version ?? ''} is available`}
        onMouseEnter={() => window.amplify?.setClickthrough?.(false)}
        onMouseLeave={() => window.amplify?.setClickthrough?.(true)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 12 }}>
            MnemosyneC v{updateState.version} available ↑
          </span>
          <button
            onClick={() => { setDismissed(true); window.amplify?.setClickthrough?.(true); }}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0 }}
            title="Dismiss"
            aria-label="Dismiss update notification"
          >
            ✕
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
          Click to download — installs on next restart.
        </div>
        <button
          onClick={() => { window.amplify?.downloadUpdate?.(); setDismissed(true); window.amplify?.setClickthrough?.(true); }}
          style={{
            padding: '7px 10px',
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 6,
            color: '#fbbf24',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
          aria-label="Download update"
        >
          Download Update →
        </button>
      </div>
    );
  }

  // Download progress pill — bottom-center, non-interactive (passthrough)
  if (updateState.status === 'downloading') {
    const pct = updateState.downloadProgress ?? 0;
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 36,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15,17,26,0.95)',
          border: '1px solid rgba(110,231,183,0.35)',
          borderRadius: 20,
          padding: '6px 14px',
          zIndex: 99998,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 11,
          color: '#6ee7b7',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
        role="status"
        aria-live="polite"
        aria-label={`Downloading Mnemosyne update: ${pct}%`}
      >
        <div
          style={{
            width: 80,
            height: 4,
            background: 'rgba(110,231,183,0.2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: '#6ee7b7',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span>Downloading update… {pct}%</span>
      </div>
    );
  }

  // "Ready to install" persistent toast — bottom-right
  if (updateState.status === 'downloaded' && !dismissed) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 36,
          right: 16,
          background: 'rgba(15,17,26,0.97)',
          border: '1px solid rgba(110,231,183,0.4)',
          borderRadius: 10,
          padding: '12px 16px',
          zIndex: 99998,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 12,
          color: '#e2e8f0',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxWidth: 290,
          minWidth: 230,
        }}
        role="alertdialog"
        aria-label={`Mnemosyne v${updateState.version ?? ''} ready to install`}
        onMouseEnter={() => window.amplify?.setClickthrough?.(false)}
        onMouseLeave={() => window.amplify?.setClickthrough?.(true)}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ color: '#6ee7b7', fontWeight: 700, fontSize: 12 }}>
            Updated to v{updateState.version} ✓ — restart to apply
          </span>
          <button
            onClick={() => { setDismissed(true); window.amplify?.setClickthrough?.(true); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#475569',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
              flexShrink: 0,
            }}
            title="Dismiss (installs on next quit)"
            aria-label="Dismiss update toast"
          >
            ✕
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
          Restart to apply · or dismiss to install on next quit.
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleInstall}
            style={{
              flex: 1,
              padding: '7px 10px',
              background: 'rgba(110,231,183,0.15)',
              border: '1px solid rgba(110,231,183,0.45)',
              borderRadius: 6,
              color: '#6ee7b7',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            aria-label="Install update and restart"
          >
            Install &amp; Restart
          </button>
          <button
            onClick={() => { setDismissed(true); window.amplify?.setClickthrough?.(true); }}
            style={{
              padding: '7px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              color: '#64748b',
              fontSize: 11,
              cursor: 'pointer',
            }}
            title="Install automatically on next quit"
            aria-label="Dismiss — install on next quit"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default UpdateToast;
