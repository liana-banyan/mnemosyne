// DiagnosticModeTab.tsx — BP132 Yoke #22 Help tab addition
//
// The BP099-K16 remote-hand Diagnostic Mode poller (src/main/diagnostic_mode/index.ts)
// existed only as a headless backend module with zero renderer UI — this is that UI.
// It shows local poller status and lets the user grant/revoke a TTL'd local permission
// window (the poller executes nothing until this is active; commands are limited to a
// hardcoded 6-key READ_ONLY allowlist: ollama_tags, peer_presence_self, bonfire_lit_self,
// log_tail, env_loader_status, relay_answer_poller_state).

import React, { useCallback, useEffect, useState } from 'react';
import type { UpdateState, AutoUpdateConfig } from '../amplify.d';

interface DiagnosticStatus {
  pollerStarted: boolean;
  lastPollAt: string | null;
  lastError: string | null;
  permissionActive: boolean;
}

export function DiagnosticModeTab(): React.ReactElement {
  const [status, setStatus] = useState<DiagnosticStatus | null>(null);
  const [ttl, setTtl] = useState(10);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await (window as any).amplify?.diagnosticModeGetStatus?.();
      if (s) setStatus(s);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  const grant = useCallback(async () => {
    setBusy(true);
    try {
      await (window as any).amplify?.diagnosticModeActivatePermission?.(ttl);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [ttl, refresh]);

  const revoke = useCallback(async () => {
    setBusy(true);
    try {
      await (window as any).amplify?.diagnosticModeRevokePermission?.();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <div style={{
      background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 10,
      padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }}>
        🩺 Diagnostic Mode (remote-hand)
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        Lets a trusted remote operator (e.g. Bishop/Founder support) run a small,
        hardcoded set of READ_ONLY checks on this machine to help diagnose issues —
        never write/admin commands. Nothing runs unless you grant a time-limited window below.
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', marginBottom: 12, flexWrap: 'wrap' as const }}>
        <div>
          Poller: <strong style={{ color: status?.pollerStarted ? '#4ade80' : '#f87171' }}>
            {status?.pollerStarted ? 'running' : 'not started'}
          </strong>
        </div>
        <div>
          Local permission: <strong style={{ color: status?.permissionActive ? '#fbbf24' : '#475569' }}>
            {status?.permissionActive ? 'ACTIVE (commands can run)' : 'inactive'}
          </strong>
        </div>
        {status?.lastPollAt && (
          <div>Last poll: {new Date(status.lastPollAt).toLocaleTimeString()}</div>
        )}
        {status?.lastError && (
          <div style={{ color: '#f87171' }}>Last error: {status.lastError}</div>
        )}
      </div>

      {!status?.permissionActive ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Grant for</span>
          <input
            type="number" min={1} max={60} value={ttl}
            onChange={(e) => setTtl(Math.max(1, Math.min(60, Number(e.target.value))))}
            style={{
              width: 50, background: '#111827', border: '1px solid #1e2d45', borderRadius: 4,
              color: '#e2e8f0', fontSize: 11, padding: '3px 6px', outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>minutes</span>
          <button
            onClick={() => void grant()}
            disabled={busy}
            style={{
              background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
              padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif', opacity: busy ? 0.6 : 1,
            }}
          >
            Grant remote diagnostic access
          </button>
        </div>
      ) : (
        <button
          onClick={() => void revoke()}
          disabled={busy}
          style={{
            background: 'none', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 6,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif', opacity: busy ? 0.6 : 1,
          }}
        >
          Revoke access now
        </button>
      )}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e2a38' }}>
        <AutomaticUpdatesConsentPanel />
      </div>
    </div>
  );
}

// ─── BP134 Yoke #29 Part 1: consent-gated automatic updates ──────────────────
//
// This panel is a thin, Diagnostic-tab-local view over state that ALREADY lives in
// main (auto_update_scheduler.ts's AutoUpdateConfig, persisted at
// <userData>/auto-update-config.json — default { autoUpdates: false }) and is ALREADY
// surfaced in full in Settings ("Automatic Updates" section, SettingsTab.tsx). It reads
// and writes the exact same IPC (getAutoUpdateConfig / setAutoUpdateConfig / getAppVersion
// / getUpdateState / onUpdateStateChanged) so the toggle here and the toggle in Settings
// are always in sync — there is only one persisted consent flag, not two. Surfaced here
// per the Founder's BP134 directive ("Put in MnemosyneC Diagnostic tab that we give
// permission for updates to install automatically; then my son can agree").
//
// OFF by default (explicit opt-in). When ON: MnemosyneC checks the canonical site
// manifest every 6 hours and auto-downloads a SHA-256-verified installer in the
// background (electron-updater's autoDownload stays false/manual — this is the M21
// fetch+verify path, not autoUpdater.downloadUpdate()); install timing (launch / on
// quit / scheduled / approve-each-time) is controlled from Settings. When OFF: nothing
// downloads or installs without an explicit click, same as before this Yoke.

const AU_DEFAULT: AutoUpdateConfig = {
  autoUpdates: false,
  installTiming: 'quit',
  scheduledTime: '03:00',
  majorVersionRequiresApproval: true,
};

// D-BP148-038: exported (was module-private) so the new Authorizations panel
// (compass/AuthorizationsPanel.tsx) can mount this SAME component instead of forking a
// second copy -- there is still only one persisted consent flag and now still only one
// implementation of the control that reads/writes it. This tab's own usage above
// (<AutomaticUpdatesConsentPanel /> inside DiagnosticModeTab) is untouched.
export function AutomaticUpdatesConsentPanel(): React.ReactElement {
  const [cfg, setCfg] = useState<AutoUpdateConfig>(AU_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [liveState, setLiveState] = useState<UpdateState | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const remote = await (window as any).amplify?.getAutoUpdateConfig?.();
        if (mounted && remote) setCfg({ ...AU_DEFAULT, ...remote });
      } catch { /* dev mode / not available — keep OFF default */ }
      if (mounted) setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    (window as any).amplify?.getAppVersion?.()
      .then((v: { version: string }) => v?.version && setAppVersion(v.version))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const amplify = (window as any).amplify;
    if (!amplify) return;
    amplify.getUpdateState?.().then(setLiveState).catch(() => {});
    const cleanup = amplify.onUpdateStateChanged?.((s: UpdateState) => setLiveState(s));
    return cleanup ?? undefined;
  }, []);

  const persist = useCallback(async (updates: Partial<AutoUpdateConfig>) => {
    const next = { ...cfg, ...updates };
    setCfg(next);
    setBusy(true);
    try {
      await (window as any).amplify?.setAutoUpdateConfig?.(updates);
    } catch { /* dev mode noop */ }
    finally { setBusy(false); }
  }, [cfg]);

  const handleToggleClick = useCallback(() => {
    if (cfg.autoUpdates) {
      void persist({ autoUpdates: false });
    } else {
      setConfirming(true);
    }
  }, [cfg.autoUpdates, persist]);

  const confirmEnable = useCallback(() => {
    setConfirming(false);
    void persist({ autoUpdates: true });
  }, [persist]);

  if (!loaded) return <></>;

  const statusLine = (): { text: string; color: string } => {
    switch (liveState?.status) {
      case 'checking': return { text: 'Checking for updates…', color: '#94a3b8' };
      case 'available': return { text: `Update available · v${liveState.version ?? '?'}`, color: '#fbbf24' };
      case 'downloading': return { text: `Downloading v${liveState.version ?? '?'} · ${liveState.downloadProgress ?? 0}%`, color: '#6ee7b7' };
      case 'downloaded': return { text: `v${liveState.version ?? '?'} ready · restart to install`, color: '#22c55e' };
      case 'error': return { text: liveState.errorMessage ?? 'Update check failed', color: '#f87171' };
      default: return { text: 'Up to date', color: '#475569' };
    }
  };
  const status = statusLine();

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }}>
        🔄 Automatic Updates
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
        Allow MnemosyneC to install updates automatically. Off by default — nothing
        downloads or installs without your say-so.
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', marginBottom: 10, flexWrap: 'wrap' as const }}>
        <div>Current version: <strong style={{ color: '#e2e8f0' }}>{appVersion || '—'}</strong></div>
        <div>Status: <strong style={{ color: status.color }}>{status.text}</strong></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>
            Allow MnemosyneC to install updates automatically
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
            {cfg.autoUpdates
              ? 'Enabled — checks every 6 hours, downloads a hash-verified installer in the background. Install timing is set in Settings → Automatic Updates.'
              : 'Disabled — MnemosyneC only checks/downloads updates when you click Check for Updates.'}
          </div>
        </div>
        <button
          onClick={handleToggleClick}
          disabled={busy}
          style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
            border: cfg.autoUpdates ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
            background: cfg.autoUpdates ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
            color: cfg.autoUpdates ? '#6ee7b7' : '#64748b',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {cfg.autoUpdates ? 'ON' : 'OFF'}
        </button>
      </div>

      {confirming && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6,
          background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.3)',
        }}>
          <div style={{ fontSize: 10, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }}>
            MnemosyneC will check for updates every 6 hours and download a SHA-256-verified
            installer from the mesh or the site automatically. You still control when it
            installs (Settings → Automatic Updates). Turn this on?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={confirmEnable}
              style={{
                background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              I agree — enable
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                background: 'none', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiagnosticModeTab;
