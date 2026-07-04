// UpdateModal — BP083 v0.3.2 · auto-update Install button P0
// Surfaces when electron-updater reports update-available / downloading / downloaded.
// Every click produces visible feedback (BP078 every-click-visible-feedback canon).
// Stacks vertically on narrow viewports (NEVER SCROLL SIDEWAYS).

import React, { useState, useEffect, useCallback } from 'react';
import type { UpdateState } from '../amplify.d';

export function UpdateModal() {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  useEffect(() => {
    if (!window.amplify) return;
    window.amplify.getUpdateState?.().then(setUpdateState).catch(() => {});
    const cleanup = window.amplify.onUpdateStateChanged?.((state) => {
      setUpdateState(state);
      if (state.status === 'available') setDeferred(false);
      if (state.status === 'downloaded') setDeferred(false);
    });
    return cleanup ?? undefined;
  }, []);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  }, []);

  const handleInstallNow = useCallback(() => {
    window.amplify?.downloadUpdate?.();
    showToast('Download started · progress shown below.');
  }, [showToast]);

  const handleLater = useCallback(() => {
    setDeferred(true);
    showToast('Update deferred · click Check for Updates anytime in Settings.');
  }, [showToast]);

  const handleRestart = useCallback(() => {
    showToast('Restarting to apply update…');
    window.amplify?.installUpdate?.();
  }, [showToast]);

  if (!updateState) return null;

  const showModal =
    !deferred &&
    (updateState.status === 'available' ||
      updateState.status === 'downloading' ||
      updateState.status === 'downloaded');

  if (!showModal && !actionToast) return null;

  const pct = updateState.downloadProgress ?? 0;

  return (
    <>
      {showModal && (
        <div
          role="alertdialog"
          aria-label={`MnemosyneC update v${updateState.version ?? ''}`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99997,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: 'rgba(15,17,26,0.98)',
              border: '1px solid rgba(110,231,183,0.35)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
            }}
          >
            {updateState.status === 'available' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>
                  v{updateState.version} available
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                  A new MnemosyneC release is ready. Install now to download and apply on restart.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleInstallNow}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(245,158,11,0.15)',
                      border: '1px solid rgba(245,158,11,0.45)',
                      borderRadius: 8,
                      color: '#fbbf24',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Install Now
                  </button>
                  <button
                    type="button"
                    onClick={handleLater}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      color: '#64748b',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Later
                  </button>
                </div>
              </>
            )}

            {updateState.status === 'downloading' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#6ee7b7' }}>
                  Downloading v{updateState.version ?? ''}…
                </div>
                <div
                  style={{
                    height: 8,
                    background: 'rgba(100,116,139,0.2)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #6ee7b7, #22c55e)',
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600 }}>
                  {pct}% complete · do not close the app
                </div>
              </>
            )}

            {updateState.status === 'downloaded' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
                  Update Ready · Restart to Install
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                  v{updateState.version} downloaded. Restart now to apply, or dismiss to install on next quit.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleRestart}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(34,197,94,0.15)',
                      border: '1px solid rgba(34,197,94,0.45)',
                      borderRadius: 8,
                      color: '#22c55e',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Restart to Install
                  </button>
                  <button
                    type="button"
                    onClick={handleLater}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      color: '#64748b',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Later (install on quit)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {actionToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            background: 'rgba(15,23,42,0.97)',
            border: '1px solid rgba(110,231,183,0.35)',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 11,
            color: '#6ee7b7',
            maxWidth: '90vw',
            textAlign: 'center',
          }}
        >
          {actionToast}
        </div>
      )}
    </>
  );
}

export default UpdateModal;
