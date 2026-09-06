import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// DiagnosticModeTab.tsx — BP132 Yoke #22 Help tab addition
//
// The BP099-K16 remote-hand Diagnostic Mode poller (src/main/diagnostic_mode/index.ts)
// existed only as a headless backend module with zero renderer UI — this is that UI.
// It shows local poller status and lets the user grant/revoke a TTL'd local permission
// window (the poller executes nothing until this is active; commands are limited to a
// hardcoded 6-key READ_ONLY allowlist: ollama_tags, peer_presence_self, bonfire_lit_self,
// log_tail, env_loader_status, relay_answer_poller_state).
import { useCallback, useEffect, useState } from 'react';
export function DiagnosticModeTab() {
    const [status, setStatus] = useState(null);
    const [ttl, setTtl] = useState(10);
    const [busy, setBusy] = useState(false);
    const refresh = useCallback(async () => {
        try {
            const s = await window.amplify?.diagnosticModeGetStatus?.();
            if (s)
                setStatus(s);
        }
        catch { /* non-fatal */ }
    }, []);
    useEffect(() => {
        void refresh();
        const iv = setInterval(() => void refresh(), 5000);
        return () => clearInterval(iv);
    }, [refresh]);
    const grant = useCallback(async () => {
        setBusy(true);
        try {
            await window.amplify?.diagnosticModeActivatePermission?.(ttl);
            await refresh();
        }
        finally {
            setBusy(false);
        }
    }, [ttl, refresh]);
    const revoke = useCallback(async () => {
        setBusy(true);
        try {
            await window.amplify?.diagnosticModeRevokePermission?.();
            await refresh();
        }
        finally {
            setBusy(false);
        }
    }, [refresh]);
    return (_jsxs("div", { style: {
            background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 10,
            padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }, children: "\uD83E\uDE7A Diagnostic Mode (remote-hand)" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }, children: "Lets a trusted remote operator (e.g. Bishop/Founder support) run a small, hardcoded set of READ_ONLY checks on this machine to help diagnose issues \u2014 never write/admin commands. Nothing runs unless you grant a time-limited window below." }), _jsxs("div", { style: { display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', marginBottom: 12, flexWrap: 'wrap' }, children: [_jsxs("div", { children: ["Poller: ", _jsx("strong", { style: { color: status?.pollerStarted ? '#4ade80' : '#f87171' }, children: status?.pollerStarted ? 'running' : 'not started' })] }), _jsxs("div", { children: ["Local permission: ", _jsx("strong", { style: { color: status?.permissionActive ? '#fbbf24' : '#475569' }, children: status?.permissionActive ? 'ACTIVE (commands can run)' : 'inactive' })] }), status?.lastPollAt && (_jsxs("div", { children: ["Last poll: ", new Date(status.lastPollAt).toLocaleTimeString()] })), status?.lastError && (_jsxs("div", { style: { color: '#f87171' }, children: ["Last error: ", status.lastError] }))] }), !status?.permissionActive ? (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 11, color: '#94a3b8' }, children: "Grant for" }), _jsx("input", { type: "number", min: 1, max: 60, value: ttl, onChange: (e) => setTtl(Math.max(1, Math.min(60, Number(e.target.value)))), style: {
                            width: 50, background: '#111827', border: '1px solid #1e2d45', borderRadius: 4,
                            color: '#e2e8f0', fontSize: 11, padding: '3px 6px', outline: 'none',
                        } }), _jsx("span", { style: { fontSize: 11, color: '#94a3b8' }, children: "minutes" }), _jsx("button", { onClick: () => void grant(), disabled: busy, style: {
                            background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
                            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'system-ui, sans-serif', opacity: busy ? 0.6 : 1,
                        }, children: "Grant remote diagnostic access" })] })) : (_jsx("button", { onClick: () => void revoke(), disabled: busy, style: {
                    background: 'none', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 6,
                    padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif', opacity: busy ? 0.6 : 1,
                }, children: "Revoke access now" })), _jsx("div", { style: { marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e2a38' }, children: _jsx(AutomaticUpdatesConsentPanel, {}) })] }));
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
const AU_DEFAULT = {
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
export function AutomaticUpdatesConsentPanel() {
    const [cfg, setCfg] = useState(AU_DEFAULT);
    const [loaded, setLoaded] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [liveState, setLiveState] = useState(null);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const remote = await window.amplify?.getAutoUpdateConfig?.();
                if (mounted && remote)
                    setCfg({ ...AU_DEFAULT, ...remote });
            }
            catch { /* dev mode / not available — keep OFF default */ }
            if (mounted)
                setLoaded(true);
        })();
        return () => { mounted = false; };
    }, []);
    useEffect(() => {
        window.amplify?.getAppVersion?.()
            .then((v) => v?.version && setAppVersion(v.version))
            .catch(() => { });
    }, []);
    useEffect(() => {
        const amplify = window.amplify;
        if (!amplify)
            return;
        amplify.getUpdateState?.().then(setLiveState).catch(() => { });
        const cleanup = amplify.onUpdateStateChanged?.((s) => setLiveState(s));
        return cleanup ?? undefined;
    }, []);
    const persist = useCallback(async (updates) => {
        const next = { ...cfg, ...updates };
        setCfg(next);
        setBusy(true);
        try {
            await window.amplify?.setAutoUpdateConfig?.(updates);
        }
        catch { /* dev mode noop */ }
        finally {
            setBusy(false);
        }
    }, [cfg]);
    const handleToggleClick = useCallback(() => {
        if (cfg.autoUpdates) {
            void persist({ autoUpdates: false });
        }
        else {
            setConfirming(true);
        }
    }, [cfg.autoUpdates, persist]);
    const confirmEnable = useCallback(() => {
        setConfirming(false);
        void persist({ autoUpdates: true });
    }, [persist]);
    if (!loaded)
        return _jsx(_Fragment, {});
    const statusLine = () => {
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
    return (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }, children: "\uD83D\uDD04 Automatic Updates" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }, children: "Allow MnemosyneC to install updates automatically. Off by default \u2014 nothing downloads or installs without your say-so." }), _jsxs("div", { style: { display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', marginBottom: 10, flexWrap: 'wrap' }, children: [_jsxs("div", { children: ["Current version: ", _jsx("strong", { style: { color: '#e2e8f0' }, children: appVersion || '—' })] }), _jsxs("div", { children: ["Status: ", _jsx("strong", { style: { color: status.color }, children: status.text })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#cbd5e1' }, children: "Allow MnemosyneC to install updates automatically" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }, children: cfg.autoUpdates
                                    ? 'Enabled — checks every 6 hours, downloads a hash-verified installer in the background. Install timing is set in Settings → Automatic Updates.'
                                    : 'Disabled — MnemosyneC only checks/downloads updates when you click Check for Updates.' })] }), _jsx("button", { onClick: handleToggleClick, disabled: busy, style: {
                            padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                            border: cfg.autoUpdates ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
                            background: cfg.autoUpdates ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
                            color: cfg.autoUpdates ? '#6ee7b7' : '#64748b',
                            opacity: busy ? 0.6 : 1,
                        }, children: cfg.autoUpdates ? 'ON' : 'OFF' })] }), confirming && (_jsxs("div", { style: {
                    marginTop: 10, padding: '8px 10px', borderRadius: 6,
                    background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.3)',
                }, children: [_jsx("div", { style: { fontSize: 10, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }, children: "MnemosyneC will check for updates every 6 hours and download a SHA-256-verified installer from the mesh or the site automatically. You still control when it installs (Settings \u2192 Automatic Updates). Turn this on?" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: confirmEnable, style: {
                                    background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
                                    padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }, children: "I agree \u2014 enable" }), _jsx("button", { onClick: () => setConfirming(false), style: {
                                    background: 'none', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6,
                                    padding: '5px 10px', fontSize: 11, cursor: 'pointer',
                                }, children: "Cancel" })] })] }))] }));
}
export default DiagnosticModeTab;
