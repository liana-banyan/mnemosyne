import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// compass/AuthorizationsPanel.tsx -- D-BP148-038/BISHOP: one Authorizations panel.
//
// Founder instruction (BP148): "about the Automatic Updates Consent - but that should all be
// on the same panel, for Authorizations." Before this Yoke, permission-shaped settings were
// scattered and some were entirely invisible:
//   - Automatic Updates: had its own UI (DiagnosticModeTab.tsx's AutomaticUpdatesConsentPanel),
//     but not grouped with anything else permission-shaped.
//   - Mesh trust / peer signature verification (mesh_trust_settings.ts): GENUINELY ENFORCES --
//     Ed25519 verification on peer_server.ts's /api/plow-domain and
//     constellation_discovery.ts's LAN discovery, both fail closed on an unsigned peer -- but
//     that file's own header admits outright "No renderer UI is wired to these yet." Zero
//     visibility, zero control, for the single highest-value security setting in the app.
//   - Paid escalation (ai_dispatch_ipc.ts's isPaidEscalationEnabled): requires an explicit
//     opt-in flag AND a configured Anthropic key before a paid call is ever reached -- no UI
//     showed whether either half was true.
//   - Nexus per-arm authority assignment: has its own UI (NexusAuthoritySettings.tsx, mounted
//     in SettingsTab.tsx) but no summary anywhere outside Settings.
//
// This panel surfaces all four in one place: what each permits in plain language, its current
// state, and -- ONLY where the control has been verified to actually take effect end-to-end --
// a way to change it. Per this Yoke's explicit design mandate, a control that cannot safely be
// flipped from the UI says so and says why instead of rendering a dead toggle.
//
// Also hosts "Active Tasks" -- prompted by the Founder catching a benchmark run in progress
// with no on-screen indication of who or what started it ("What is running Mnemosynec right
// now, doing a 6 out of 140 test? IT wasn't me."). That run was the Sourced-Knowledge
// Benchmark (OneClickMeshTestPanel.tsx / one_click_mmlu_pro.ts), which already has a real,
// live-wired stop path (mesh-test:stop -> requestOneClickCancel(), cooperative cancellation at
// the next question boundary) but no visible "is anything running" indicator outside whichever
// tab happened to start it, and NO attribution field anywhere in the run state -- 'start'/
// 'progress' broadcasts carry only total/doneCount, never a caller identity. This panel surfaces
// what IS available (live/idle, question X/Y, a real Stop button) and says plainly that WHO or
// WHAT started a run is not tracked anywhere in the app today -- see the note in that section
// for exactly what plumbing would be needed to close that gap. Placed here rather than under
// Proof/Power because the Founder's complaint was about visibility into what the app is doing
// without on-screen authorization, which is this panel's whole subject.
//
// Ownership: src/renderer/** only, per this Yoke's ticket. Reuses (never forks) the existing
// AutomaticUpdatesConsentPanel component and the existing loadNexusAuthoritySettings() reader.
// The two new preload.ts bridge methods this panel needs (getMeshTrustSettings /
// setMeshTrustAllowUnauthenticatedLanDiscovery) wrap the two IPC handlers
// mesh_trust_settings.ts's registerMeshTrustSettingsIpc() already registers at boot -- no
// change to what that setting means or defaults to, only a way to see and flip it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AutomaticUpdatesConsentPanel } from '../DiagnosticModeTab';
import { loadNexusAuthoritySettings } from '../../settings/nexus_authority_settings_store';
import { NEXUS_ARM_NAMES } from '../../../shared/plow/browser_authority_types';
const ARM_LABELS = {
    computable: 'Compute',
    lookup_fact: 'Lookup (fact-finding)',
    reasoning: 'Reasoning',
};
// ─── shared row shell ────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
    return (_jsxs("div", { style: {
            background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 10,
            padding: 16, marginBottom: 14,
        }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 10 }, children: title }), children] }));
}
function StatusPill({ text, tone }) {
    const colors = {
        safe: { bg: 'rgba(110,231,183,0.1)', border: 'rgba(110,231,183,0.4)', fg: '#6ee7b7' },
        warn: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.4)', fg: '#fbbf24' },
        off: { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.3)', fg: '#64748b' },
        unknown: { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.3)', fg: '#94a3b8' },
    };
    const c = colors[tone];
    return (_jsx("span", { style: {
            display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            background: c.bg, border: `1px solid ${c.border}`, color: c.fg,
        }, children: text }));
}
function DeadControlNote({ text }) {
    return (_jsx("div", { style: {
            marginTop: 8, fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.5,
        }, children: text }));
}
// ─── 2. Mesh trust / peer verification ───────────────────────────────────────
// The highest-value item on this panel: a security control that already enforces
// (peer_server.ts, constellation_discovery.ts both fail closed today) but had zero UI.
function MeshTrustSection() {
    const [loaded, setLoaded] = useState(false);
    const [available, setAvailable] = useState(true);
    const [allowUnsigned, setAllowUnsigned] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const refresh = useCallback(async () => {
        try {
            const amplify = window.amplify;
            if (!amplify?.getMeshTrustSettings) {
                setAvailable(false);
                setLoaded(true);
                return;
            }
            const s = await amplify.getMeshTrustSettings();
            if (s)
                setAllowUnsigned(s.allowUnauthenticatedLanDiscovery === true);
            setAvailable(true);
        }
        catch {
            setAvailable(false);
        }
        finally {
            setLoaded(true);
        }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    const persist = useCallback(async (allow) => {
        setBusy(true);
        try {
            const res = await window.amplify?.setMeshTrustAllowUnauthenticatedLanDiscovery?.(allow);
            if (res)
                setAllowUnsigned(res.allowUnauthenticatedLanDiscovery === true);
            else
                setAllowUnsigned(allow);
        }
        catch { /* non-fatal -- local state already reflects intent */ }
        finally {
            setBusy(false);
        }
    }, []);
    const handleToggleClick = useCallback(() => {
        if (allowUnsigned) {
            // Returning to the secure default needs no confirmation.
            void persist(false);
        }
        else {
            setConfirming(true);
        }
    }, [allowUnsigned, persist]);
    const confirmEnable = useCallback(() => {
        setConfirming(false);
        void persist(true);
    }, [persist]);
    if (!loaded)
        return _jsx(SectionCard, { title: "\uD83D\uDD12 Mesh Trust \u00B7 Peer Verification", children: _jsx("span", { style: { fontSize: 11, color: '#64748b' }, children: "Loading\u2026" }) });
    return (_jsxs(SectionCard, { title: "\uD83D\uDD12 Mesh Trust \u00B7 Peer Verification", children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }, children: "MnemosyneC checks a cryptographic signature (Ed25519) on every peer-discovery and peer-dispatch message it receives on your local network. A message whose signature is present but fails verification is ALWAYS refused, no matter what this setting says. This setting controls only what happens when a message has NO signature at all: refuse it (secure default), or accept it the old way (for a peer running software too old to sign, or a network you personally judge trusted)." }), !available ? (_jsxs(_Fragment, { children: [_jsx(StatusPill, { text: "STATUS UNKNOWN", tone: "unknown" }), _jsx(DeadControlNote, { text: "This app build cannot reach the mesh-trust setting (no response from the main process). Not shown as a control because a value this app cannot confirm would be a guess, not a fact." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: 10 }, children: ["Unsigned peers:", ' ', allowUnsigned
                                ? _jsx(StatusPill, { text: "ACCEPTED (legacy, less safe)", tone: "warn" })
                                : _jsx(StatusPill, { text: "REFUSED (secure default)", tone: "safe" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#cbd5e1' }, children: "Allow unsigned peers on this network" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }, children: allowUnsigned
                                            ? 'On -- any device on your LAN can announce itself or send a dispatch request without proving identity.'
                                            : 'Off -- an unsigned announce or dispatch request is dropped before MnemosyneC acts on it.' })] }), _jsx("button", { onClick: handleToggleClick, disabled: busy, style: {
                                    padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                                    border: allowUnsigned ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(110,231,183,0.4)',
                                    background: allowUnsigned ? 'rgba(251,191,36,0.1)' : 'rgba(110,231,183,0.1)',
                                    color: allowUnsigned ? '#fbbf24' : '#6ee7b7',
                                    opacity: busy ? 0.6 : 1,
                                }, children: allowUnsigned ? 'ACCEPTED' : 'REFUSED' })] }), confirming && (_jsxs("div", { style: {
                            marginTop: 10, padding: '8px 10px', borderRadius: 6,
                            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                        }, children: [_jsx("div", { style: { fontSize: 10, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }, children: "This opens a trust boundary: any device on your local network will be able to announce itself to MnemosyneC and request a dispatch without proving who it is. Turn this on only if you trust every device on this network. Allow unsigned peers?" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: confirmEnable, style: {
                                            background: '#f59e0b', color: '#0a0f1a', border: 'none', borderRadius: 6,
                                            padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                        }, children: "I understand the risk -- allow" }), _jsx("button", { onClick: () => setConfirming(false), style: {
                                            background: 'none', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6,
                                            padding: '5px 10px', fontSize: 11, cursor: 'pointer',
                                        }, children: "Cancel" })] })] }))] }))] }));
}
function PaidEscalationSection() {
    const [loaded, setLoaded] = useState(false);
    const [available, setAvailable] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const refresh = useCallback(async () => {
        try {
            const amplify = window.amplify;
            const aiDispatch = amplify?.aiDispatch;
            if (!aiDispatch?.getSettings || !aiDispatch?.getAnthropicKeyStatus) {
                setAvailable(false);
                setLoaded(true);
                return;
            }
            const [settingsRes, keyRes] = await Promise.all([
                aiDispatch.getSettings(),
                aiDispatch.getAnthropicKeyStatus(),
            ]);
            setEnabled(Boolean(settingsRes?.settings?.paid_escalation_enabled));
            setHasKey(Boolean(keyRes?.hasKey));
            setAvailable(true);
        }
        catch {
            setAvailable(false);
        }
        finally {
            setLoaded(true);
        }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    const persist = useCallback(async (next) => {
        setBusy(true);
        try {
            await window.amplify?.aiDispatch?.saveSettings?.({ paid_escalation_enabled: next });
            setEnabled(next);
        }
        catch { /* non-fatal */ }
        finally {
            setBusy(false);
        }
    }, []);
    const handleToggleClick = useCallback(() => {
        if (enabled) {
            void persist(false);
        }
        else if (hasKey) {
            setConfirming(true);
        }
    }, [enabled, hasKey, persist]);
    const confirmEnable = useCallback(() => {
        setConfirming(false);
        void persist(true);
    }, [persist]);
    if (!loaded)
        return _jsx(SectionCard, { title: "\uD83D\uDCB3 Paid Cloud Escalation", children: _jsx("span", { style: { fontSize: 11, color: '#64748b' }, children: "Loading\u2026" }) });
    return (_jsxs(SectionCard, { title: "\uD83D\uDCB3 Paid Cloud Escalation", children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }, children: "When MnemosyneC's free local models cannot honestly answer a question, this permits the app to send that one question to a paid cloud AI service (Anthropic) at a small per-query cost. Reaching a paid call requires BOTH this switch on AND an Anthropic API key configured -- either one missing keeps every answer free (local only)." }), !available ? (_jsxs(_Fragment, { children: [_jsx(StatusPill, { text: "STATUS UNKNOWN", tone: "unknown" }), _jsx(DeadControlNote, { text: "This app build cannot reach the paid-escalation setting (no response from the main process)." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }, children: [_jsxs("div", { children: ["Escalation switch:", ' ', enabled ? _jsx(StatusPill, { text: "ON", tone: "warn" }) : _jsx(StatusPill, { text: "OFF", tone: "off" })] }), _jsxs("div", { children: ["API key configured:", ' ', hasKey ? _jsx(StatusPill, { text: "YES", tone: "safe" }) : _jsx(StatusPill, { text: "NO KEY", tone: "off" })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#cbd5e1' }, children: "Allow paid cloud calls when local models abstain" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }, children: enabled
                                            ? 'On -- an honest local abstain can escalate to a paid Anthropic call.'
                                            : hasKey
                                                ? 'Off -- MnemosyneC only ever answers from free local models.'
                                                : 'Off -- also blocked: no Anthropic API key is configured yet.' })] }), _jsx("button", { onClick: handleToggleClick, disabled: busy || (!enabled && !hasKey), style: {
                                    padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                    cursor: (busy || (!enabled && !hasKey)) ? 'default' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                                    border: enabled ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(100,116,139,0.3)',
                                    background: enabled ? 'rgba(251,191,36,0.1)' : 'rgba(100,116,139,0.06)',
                                    color: enabled ? '#fbbf24' : '#64748b',
                                    opacity: (busy || (!enabled && !hasKey)) ? 0.5 : 1,
                                }, children: enabled ? 'ON' : 'OFF' })] }), !hasKey && !enabled && (_jsx(DeadControlNote, { text: "Greyed out on purpose, not broken: this switch cannot safely turn on without a configured Anthropic API key (never shown here, not even a fragment). Add one from the Ask tab's model picker (Brain Swap -> Anthropic), then this control unlocks." })), confirming && (_jsxs("div", { style: {
                            marginTop: 10, padding: '8px 10px', borderRadius: 6,
                            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                        }, children: [_jsx("div", { style: { fontSize: 10, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }, children: "This can spend money: a question your local models honestly can't answer will be sent to Anthropic's paid API instead. Turn this on?" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: confirmEnable, style: {
                                            background: '#f59e0b', color: '#0a0f1a', border: 'none', borderRadius: 6,
                                            padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                        }, children: "I agree -- enable" }), _jsx("button", { onClick: () => setConfirming(false), style: {
                                            background: 'none', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6,
                                            padding: '5px 10px', fontSize: 11, cursor: 'pointer',
                                        }, children: "Cancel" })] })] }))] }))] }));
}
// ─── 4. Nexus authorities ─────────────────────────────────────────────────────
// Summary + a link to the real control surface (NexusAuthoritySettings.tsx, mounted in
// SettingsTab.tsx) -- deliberately not duplicated here.
function NexusAuthoritiesSection({ onOpenSettings }) {
    const snapshot = loadNexusAuthoritySettings();
    const nonDefaultCount = NEXUS_ARM_NAMES.filter((arm) => snapshot.perArmAuthority[arm] !== 'local_free').length;
    return (_jsxs(SectionCard, { title: "\uD83E\uDDED Nexus Authorities", children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }, children: "Controls which source answers each kind of question -- MnemosyneC's own free local pipeline (default, every arm), or a source you've explicitly assigned (your own logged-in Google/Perplexity/Claude browser session, or a paid API). Every arm defaults to the free local pipeline; nothing here ever defaults to a paid source." }), _jsxs("div", { style: { marginBottom: 10 }, children: ["Research-arm (browser authority) mode:", ' ', snapshot.researchArmMode
                        ? _jsx(StatusPill, { text: "ON", tone: "warn" })
                        : _jsx(StatusPill, { text: "OFF", tone: "off" })] }), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 10 }, children: [NEXUS_ARM_NAMES.map((arm) => (_jsxs("div", { style: { marginBottom: 2 }, children: [ARM_LABELS[arm], ": ", _jsx("strong", { style: { color: '#cbd5e1' }, children: snapshot.perArmAuthority[arm] })] }, arm))), nonDefaultCount === 0 && (_jsx("div", { style: { marginTop: 4, color: '#64748b' }, children: "All three arms use the free local pipeline (default)." }))] }), onOpenSettings ? (_jsx("button", { onClick: onOpenSettings, style: {
                    background: 'none', color: '#6ee7b7', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 6,
                    padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                }, children: "Manage in Settings -> Nexus Authority" })) : (_jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: "Managed in Settings -> Nexus Authority." }))] }));
}
function ActiveTasksSection() {
    const [active, setActive] = useState(null);
    const [progress, setProgress] = useState(null);
    const [stopping, setStopping] = useState(false);
    const pollRef = useRef(null);
    const pollActive = useCallback(async () => {
        try {
            const res = await window.amplify?.meshTestIsActive?.();
            if (res)
                setActive(Boolean(res.active));
        }
        catch { /* non-fatal -- leave last known state */ }
    }, []);
    useEffect(() => {
        void pollActive();
        pollRef.current = setInterval(() => void pollActive(), 4000);
        return () => { if (pollRef.current)
            clearInterval(pollRef.current); };
    }, [pollActive]);
    useEffect(() => {
        const off = window.amplify?.onMeshTestProgress?.((payload) => {
            if (payload?.type === 'start') {
                setActive(true);
                setProgress({ doneCount: 0, total: payload.total ?? 0 });
            }
            else if (typeof payload?.doneCount === 'number') {
                setActive(true);
                setProgress({ doneCount: payload.doneCount, total: payload.total ?? 0 });
            }
            else if (payload?.type === 'complete' || payload?.type === 'cancelled') {
                setActive(false);
                setProgress(null);
            }
        });
        return () => { if (typeof off === 'function')
            off(); };
    }, []);
    const handleStop = useCallback(async () => {
        setStopping(true);
        try {
            await window.amplify?.meshTestStop?.();
            await pollActive();
        }
        finally {
            setStopping(false);
        }
    }, [pollActive]);
    return (_jsxs(SectionCard, { title: "\u23F1 Active Tasks", children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }, children: "Shows whether a Sourced-Knowledge Benchmark run is currently executing in this app -- wherever it was started from (the Proof tab, the Diagnostic terminal, or an automated dispatch) -- and lets you stop it." }), active === null && _jsx("span", { style: { fontSize: 11, color: '#64748b' }, children: "Checking\u2026" }), active === false && (_jsx(StatusPill, { text: "NO ACTIVE RUN", tone: "off" })), active === true && (_jsxs(_Fragment, { children: [_jsx("div", { style: { marginBottom: 8 }, children: _jsx(StatusPill, { text: "RUN IN PROGRESS", tone: "warn" }) }), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 4 }, children: ["Progress: question ", progress?.doneCount ?? '?', "/", progress?.total || '?'] }), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 10 }, children: ["Started by: ", _jsx("strong", { style: { color: '#cbd5e1' }, children: "not tracked" }), " -- MnemosyneC does not currently record who or what starts a benchmark run (see the note below)."] }), _jsx("button", { onClick: () => void handleStop(), disabled: stopping, style: {
                            background: 'none', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 6,
                            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'system-ui, sans-serif', opacity: stopping ? 0.6 : 1,
                        }, children: stopping ? 'Stopping…' : '■ Stop this run' })] })), _jsx(DeadControlNote, { text: "Attribution gap, reported honestly: no run this app starts today carries a 'who/what started it' field anywhere in its state, so this panel cannot show one. Closing that needs a caller-identity parameter threaded through every dispatch path (the Proof tab's own button, the Diagnostic terminal's `run` command, and any automated trigger) plus a place to persist it -- real plumbing, not a renderer-only fix, and out of this ticket's scope." })] }));
}
export function AuthorizationsPanel({ onSubViewChange }) {
    return (_jsxs("div", { style: {
            height: '100%', overflowY: 'auto', padding: '16px 20px',
            background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsx("div", { style: { marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }, children: "\uD83D\uDD10 Authorizations" }), _jsx("div", { style: { marginBottom: 16, fontSize: 11, color: '#64748b', lineHeight: 1.6, maxWidth: 640 }, children: "Every standing permission MnemosyneC holds or can grant itself, in one place: what it permits in plain language, its current state, and a control to change it wherever that control can be proven to actually take effect. Anything that costs money or opens a trust boundary is off by default and needs a deliberate confirmation here to turn on." }), _jsx("div", { style: {
                    background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 10,
                    padding: 16, marginBottom: 14,
                }, children: _jsx(AutomaticUpdatesConsentPanel, {}) }), _jsx(MeshTrustSection, {}), _jsx(PaidEscalationSection, {}), _jsx(NexusAuthoritiesSection, { onOpenSettings: onSubViewChange ? () => onSubViewChange('settings') : undefined }), _jsx(ActiveTasksSection, {})] }));
}
export default AuthorizationsPanel;
