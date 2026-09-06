// DiagnosticModeTab.tsx — BP132 Yoke #22 Help tab addition
//
// The BP099-K16 remote-hand Diagnostic Mode poller (src/main/diagnostic_mode/index.ts)
// existed only as a headless backend module with zero renderer UI — this is that UI.
// It shows local poller status and lets the user grant/revoke a TTL'd local permission
// window (the poller executes nothing until this is active; commands are limited to a
// hardcoded 6-key READ_ONLY allowlist: ollama_tags, peer_presence_self, bonfire_lit_self,
// log_tail, env_loader_status, relay_answer_poller_state).

import React, { useCallback, useEffect, useState } from 'react';
import type {
  UpdateState,
  AutoUpdateConfig,
  MeshAutoSpawnConsentSettings,
  MeshRemoteAdminConsentSettings,
} from '../amplify.d';

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

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e2a38' }}>
        <MeshAutoSpawnConsentPanel />
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e2a38' }}>
        <RemoteAdministrationConsentPanel />
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

// ─── D-BP157-033/BISHOP/seg-worker-permission-consent: mesh auto-spawn tool-execution consent ──
//
// A SEPARATE consent from AutomaticUpdatesConsentPanel above, per this dispatch's own
// instruction: permitting a peer machine's dispatch to drive TOOL EXECUTION on this one (write
// files, run commands, unattended) is a materially different decision from permitting a version
// bump. Mirrors AutomaticUpdatesConsentPanel's own shape exactly (same confirm-before-enable
// flow, same "turning off needs no confirmation" asymmetry, same OFF-by-default posture) over a
// SEPARATE persisted flag (mesh_auto_spawn_consent.ts, %APPDATA%\MnemosyneC\config\
// mesh_auto_spawn_consent.json -- a different file from auto-update-config.json).
//
// This toggle alone changes nothing: bishop_dispatch_handler.ts's resolveEffectivePermissionMode()
// requires BOTH this consent AND the existing, operator-set LB_MESH_AUTO_SPAWN_ENABLED kill
// switch to be true before a spawned worker ever runs under an elevated permission mode. With
// the kill switch off (the shipped default), granting this consent has no observable effect --
// the confirmation copy below says so explicitly rather than implying this toggle alone is
// dangerous when the kill switch has never been turned on.
//
// D-BP148-038: exported (matching AutomaticUpdatesConsentPanel's own export) so
// compass/AuthorizationsPanel.tsx can mount this SAME component instead of forking a second copy.

const MASC_DEFAULT: MeshAutoSpawnConsentSettings = { consentGranted: false };

export function MeshAutoSpawnConsentPanel(): React.ReactElement {
  const [cfg, setCfg] = useState<MeshAutoSpawnConsentSettings>(MASC_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const remote = await (window as any).amplify?.getMeshAutoSpawnConsentSettings?.();
      if (remote) setCfg({ ...MASC_DEFAULT, ...remote });
    } catch { /* dev mode / not available -- keep OFF default */ }
    setLoaded(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const persist = useCallback(async (granted: boolean) => {
    setBusy(true);
    try {
      const res = await (window as any).amplify?.setMeshAutoSpawnConsentGranted?.(granted);
      setCfg(res ? { ...MASC_DEFAULT, ...res } : { consentGranted: granted });
    } catch { /* dev mode noop -- local state already reflects intent */ }
    finally { setBusy(false); }
  }, []);

  const handleToggleClick = useCallback(() => {
    if (cfg.consentGranted) {
      // Returning to the safe default needs no confirmation, matching every other consent
      // control in this app (AutomaticUpdatesConsentPanel, Mesh Trust's own toggle).
      void persist(false);
    } else {
      setConfirming(true);
    }
  }, [cfg.consentGranted, persist]);

  const confirmEnable = useCallback(() => {
    setConfirming(false);
    void persist(true);
  }, [persist]);

  if (!loaded) return <></>;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }}>
        🤖 Mesh Auto-Spawn Tool Execution
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
        A mesh peer's Bishop dispatch can already wake a worker on this machine if the
        operator-set auto-spawn kill switch is on -- but today that worker runs under a
        restrictive permission mode that cannot write files or run commands without a human
        present to approve each one. This toggle, separate from Automatic Updates above and off
        by default, lets a spawned worker actually do the work a dispatch asks for, unattended.
        It requires the kill switch to ALSO be on -- by itself it changes nothing.
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>
            Allow mesh-dispatched workers to execute tools unattended on this machine
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
            {cfg.consentGranted
              ? 'Enabled -- combined with the auto-spawn kill switch, a spawned worker runs under an elevated permission mode that can write files and run commands with no one here to approve them.'
              : 'Disabled -- a spawned worker (if the kill switch is on) runs under the restrictive default permission mode and cannot use tools without approval, so it will typically exit having done nothing.'}
          </div>
        </div>
        <button
          onClick={handleToggleClick}
          disabled={busy}
          style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
            border: cfg.consentGranted ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(100,116,139,0.3)',
            background: cfg.consentGranted ? 'rgba(251,191,36,0.1)' : 'rgba(100,116,139,0.06)',
            color: cfg.consentGranted ? '#fbbf24' : '#64748b',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {cfg.consentGranted ? 'ON' : 'OFF'}
        </button>
      </div>

      {confirming && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
        }}>
          <div style={{ fontSize: 10, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }}>
            This opens a real trust boundary: once the auto-spawn kill switch is also on, a mesh
            peer's dispatch will be able to make this machine write files and run commands with
            no one here to approve each one. The LAN is a carrier, never a trust boundary --
            being on the same network is not authentication, so turn this on only if you trust
            every peer allowed to dispatch to this machine (the sender allowlist). Turn this on?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={confirmEnable}
              style={{
                background: '#f59e0b', color: '#0a0f1a', border: 'none', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              I understand the risk -- enable
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

// ─── D-BP202-M0-01-h2cbp8us-001/BISHOP/BM01: remote-administration consent ───────────────────
//
// THE THIRD CONSENT, and the largest of the three. AutomaticUpdatesConsentPanel permits a version
// bump. MeshAutoSpawnConsentPanel permits tool execution INSIDE MnemosyneC. This one permits
// another machine to administer THE WHOLE COMPUTER through a standing local admin account
// (`lbmesh`) over PowerShell Remoting, entirely outside this app.
//
// Mirrors both panels above exactly: same confirm-before-enable flow, same "turning off needs no
// confirmation" asymmetry, same OFF-by-default posture, over a SEPARATE persisted flag
// (mesh_remote_admin_consent.ts, %APPDATA%\MnemosyneC\config\mesh_remote_admin_consent.json).
//
// THE ONE PLACE THIS PANEL DELIBERATELY DIFFERS FROM ITS SIBLINGS: it tells the user, in the
// visible copy and not only in a code comment, that turning it OFF does not close a WinRM
// listener that has already been provisioned. An app cannot stop a Windows service. Claiming
// otherwise on screen would be the worst kind of security theater -- the kind a person relies on.
// See mesh_remote_admin_consent.ts's header for the full statement of what the flag enforces
// (the administering peer reads this machine's declared answer from /api/info and refuses) and
// what it does not.
//
// Exported, matching its two siblings, so compass/AuthorizationsPanel.tsx mounts this SAME
// component rather than forking a second copy.

const RAC_DEFAULT: MeshRemoteAdminConsentSettings = { consentGranted: false };

export function RemoteAdministrationConsentPanel(): React.ReactElement {
  const [cfg, setCfg] = useState<MeshRemoteAdminConsentSettings>(RAC_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const remote = await (window as any).amplify?.getMeshRemoteAdminConsentSettings?.();
      if (remote) setCfg({ ...RAC_DEFAULT, ...remote });
    } catch { /* dev mode / not available -- keep OFF default */ }
    setLoaded(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const persist = useCallback(async (granted: boolean) => {
    setBusy(true);
    try {
      const res = await (window as any).amplify?.setRemoteAdministrationConsentGranted?.(granted);
      setCfg(res ? { ...RAC_DEFAULT, ...res } : { consentGranted: granted });
    } catch { /* dev mode noop -- local state already reflects intent */ }
    finally { setBusy(false); }
  }, []);

  const handleToggleClick = useCallback(() => {
    if (cfg.consentGranted) {
      // Returning to the safe default needs no confirmation, matching every other consent
      // control in this app.
      void persist(false);
    } else {
      setConfirming(true);
    }
  }, [cfg.consentGranted, persist]);

  const confirmEnable = useCallback(() => {
    setConfirming(false);
    void persist(true);
  }, [persist]);

  if (!loaded) return <></>;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }}>
        🔧 Remote Administration Of This Computer
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
        The two consents above stay inside MnemosyneC: one lets it update itself, the other lets a
        mesh dispatch run tools within the app. This one is larger than both. It permits another
        computer on the mesh to administer this entire machine through a dedicated administrator
        account and Windows PowerShell Remoting -- installing software, reading and writing any
        file, running any command -- outside this app entirely. Off by default. Only turn it on
        for a computer you own.
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>
            Allow another machine on the mesh to administer this computer
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
            {cfg.consentGranted
              ? 'Enabled -- this computer publishes that it consents to remote administration, and a mesh peer may act on that through the dedicated admin account.'
              : 'Disabled -- this computer publishes that it does not consent, and a mesh peer must not attempt an administrative action against it.'}
          </div>
        </div>
        <button
          onClick={handleToggleClick}
          disabled={busy}
          style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
            border: cfg.consentGranted ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(100,116,139,0.3)',
            background: cfg.consentGranted ? 'rgba(248,113,113,0.1)' : 'rgba(100,116,139,0.06)',
            color: cfg.consentGranted ? '#f87171' : '#64748b',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {cfg.consentGranted ? 'ON' : 'OFF'}
        </button>
      </div>

      { /* Shown whenever the consent is ON, not only during the confirm step: the limit is a
           standing fact about this control, and a person who turned it on last week and comes
           back to turn it off deserves to see it exactly when they are relying on it. */ }
      {cfg.consentGranted && !confirming && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6,
          background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.2)',
          fontSize: 9, color: '#94a3b8', lineHeight: 1.6,
        }}>
          Switching this off withdraws consent and mesh peers will stop, but it does not by itself
          close PowerShell Remoting or remove the administrator account, because an app cannot turn
          off a Windows service. To fully close it, run <span style={{ color: '#cbd5e1' }}>Disable-PSRemoting</span> in
          an elevated PowerShell and remove the <span style={{ color: '#cbd5e1' }}>lbmesh</span> account.
        </div>
      )}

      {confirming && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6,
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
        }}>
          <div style={{ fontSize: 10, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }}>
            This grants another machine administrative control of this one. Whoever operates that
            machine will be able to install software, read and change any file here, and run any
            command as an administrator, with nobody present to approve it. Being on the same
            network is not authentication -- the LAN is a carrier, never a trust boundary -- so
            turn this on only for a computer you own and an operator you are.
            <br /><br />
            Turning it back off later withdraws consent, but does not by itself close PowerShell
            Remoting or delete the administrator account; that takes Disable-PSRemoting in an
            elevated terminal. Turn this on?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={confirmEnable}
              style={{
                background: '#ef4444', color: '#0a0f1a', border: 'none', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              I understand the risk -- enable
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
