import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// BatteryPublishTab — Battery Dispatch v0.3.0 · Publish Fan-Out Engine
// BP082 · 2026-06-14 · Sonnet 4.6 · Founder-ratified
//
// SEG-1: Full publish fan-out UI — content picker, fan-out plan, per-platform
//        preview modals, ratify checkmarks, dispatch button, history view.
// SEG-5: Settings panel — credential status per platform + setup links.
// SEG-6: First-use wizard — conditional on first open.
//
// BP078 BLOOD canon: NOTHING dispatches without Founder ratify checkmark.
// The dispatch button is disabled (and the IPC layer throws) if any selected
// platform is not ratified. Two-layer enforcement: UI + main process.
import { useState, useEffect, useCallback, useRef } from 'react';
// ─── Constants ────────────────────────────────────────────────────────────────
const LS_WIZARD_DONE = 'battery_dispatch_wizard_done';
const LS_ACTIVE_VIEW = 'battery_dispatch_view';
const PLATFORM_META = {
    cephas: { label: 'Cephas (cephas.lianabanyan.com)', icon: '🏛', description: 'Full-auto: writes Hugo content file, builds, deploys via Firebase.' },
    lianabanyan: { label: 'lianabanyan.com (/op-eds/…)', icon: '🌿', description: 'Full-auto: generates React page, builds, deploys via Firebase.' },
    substack: { label: 'Substack (For the Keep)', icon: '📬', description: 'API draft (if key set) or browser pre-fill. Founder publishes in Substack admin.' },
    medium: { label: 'Medium (@gijones)', icon: '📝', description: 'API draft (if token set) or browser pre-fill. Founder publishes in Medium editor.' },
    hackernews: { label: 'HackerNews (Show HN)', icon: '🔶', description: 'Semi-auto: opens HN submit with pre-filled title + URL. Founder clicks Submit.' },
    gmail_editorial: { label: 'Editorial emails (Atlantic · Wired · Fast Co · ProMarket · SSIR)', icon: '✉️', description: 'Gmail API (if configured) or browser compose opened per outlet.' },
    crown_letter: { label: 'Crown Letters (per recipient)', icon: '👑', description: 'Gmail API or browser compose to the Crown recipient.' },
};
function defaultPlatformsForClass(cls) {
    switch (cls) {
        case 'op-ed': return ['cephas', 'lianabanyan', 'substack', 'medium', 'hackernews', 'gmail_editorial'];
        case 'paper': return ['cephas', 'lianabanyan', 'substack'];
        case 'crown-letter': return ['crown_letter'];
        case 'social': return ['substack', 'hackernews'];
        default: return ['cephas', 'lianabanyan'];
    }
}
function initialPlatformRows(cls, creds) {
    const defaults = defaultPlatformsForClass(cls);
    return Object.keys(PLATFORM_META).map((p) => ({
        platform: p,
        label: PLATFORM_META[p].label,
        icon: PLATFORM_META[p].icon,
        description: PLATFORM_META[p].description,
        enabled: defaults.includes(p),
        ratified: false,
        status: 'pending',
    }));
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
    outer: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0f1a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' },
    header: { padding: '12px 16px 8px', borderBottom: '1px solid #1e2a38', flexShrink: 0 },
    headerTitle: { fontSize: 15, fontWeight: 700, color: '#f0fdf4', margin: 0 },
    headerSub: { fontSize: 11, color: '#475569', marginTop: 2 },
    tabBar: { display: 'flex', gap: 2, padding: '8px 16px 0', borderBottom: '1px solid #1e2a38', flexShrink: 0 },
    tab: (active) => ({
        fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#6ee7b7' : '#64748b',
        background: 'none', border: 'none', borderBottom: active ? '2px solid #6ee7b7' : '2px solid transparent',
        padding: '4px 12px 6px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
    }),
    scroll: { flex: 1, overflowY: 'auto', padding: '12px 14px' },
    card: { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 },
    label: { fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 },
    selectBox: { width: '100%', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '6px 9px', outline: 'none', boxSizing: 'border-box' },
    platformRow: (enabled) => ({
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0',
        borderBottom: '1px solid rgba(100,116,139,0.08)', opacity: enabled ? 1 : 0.45,
    }),
    ratifyBtn: (ratified) => ({
        flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: ratified ? '1px solid #6ee7b7' : '1px solid rgba(100,116,139,0.3)',
        background: ratified ? 'rgba(110,231,183,0.15)' : 'rgba(15,23,42,0.4)', cursor: 'pointer',
        fontSize: 11, color: ratified ? '#6ee7b7' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }),
    dispatchBtn: (canDispatch) => ({
        width: '100%', padding: '10px 0', borderRadius: 7, fontSize: 13, fontWeight: 700,
        cursor: canDispatch ? 'pointer' : 'not-allowed', border: '1px solid rgba(110,231,183,0.35)',
        background: canDispatch ? 'rgba(110,231,183,0.12)' : 'rgba(15,23,42,0.3)',
        color: canDispatch ? '#6ee7b7' : '#334155', opacity: canDispatch ? 1 : 0.5,
    }),
    statusDot: (st) => ({
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
        background: st === 'success' ? '#4ade80' : st === 'failed' ? '#f87171' : st === 'running' ? '#f59e0b' : st === 'skipped' ? '#64748b' : '#1e2a38',
    }),
    progressLog: { background: 'rgba(0,0,0,0.3)', borderRadius: 5, padding: '8px 10px', maxHeight: 140, overflowY: 'auto', fontSize: 10, fontFamily: 'monospace', color: '#6ee7b7', lineHeight: 1.6 },
    credRow: (ok) => ({
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
        borderBottom: '1px solid rgba(100,116,139,0.06)',
    }),
    credDot: (ok) => ({
        width: 8, height: 8, borderRadius: '50%', background: ok ? '#4ade80' : '#64748b', flexShrink: 0,
    }),
    wizardBox: {
        position: 'absolute', inset: 0, background: 'rgba(10,15,26,0.97)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 10,
    },
    previewModal: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 16,
    },
    previewBox: {
        background: '#0d1117', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 10,
        width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', padding: 20,
    },
};
// ─── Amplify IPC helpers ──────────────────────────────────────────────────────
const amp = () => window.amplify;
async function ipcInvoke(channel, ...args) {
    const a = amp();
    switch (channel) {
        case 'dispatch:list-content-files': return a?.dispatchListContentFiles?.() ?? Promise.resolve([]);
        case 'dispatch:default-platforms': return a?.dispatchDefaultPlatforms?.(args[0]) ?? Promise.resolve([]);
        case 'dispatch:get-file-body': return a?.dispatchGetFileBody?.(args[0]) ?? Promise.resolve({ error: 'no bridge' });
        case 'dispatch:fire': return a?.dispatchFire?.(args[0]) ?? Promise.resolve({ ok: false, error: 'no bridge', results: [] });
        case 'dispatch:history': return a?.dispatchHistory?.() ?? Promise.resolve([]);
        case 'dispatch:credential-status': return a?.dispatchCredentialStatus?.() ?? Promise.resolve({ substack: false, medium: false, gmail: false, cephas: true, lianabanyan: true, hackernews: true });
        default: throw new Error(`Unknown dispatch channel: ${channel}`);
    }
}
function onDispatchProgress(cb) {
    return amp()?.onDispatchProgress?.(cb) ?? (() => { });
}
// ─── Wizard (SEG-6) ───────────────────────────────────────────────────────────
function FirstUseWizard({ creds, onDone }) {
    const [step, setStep] = useState(0);
    const platforms = [
        { label: 'Cephas museum', icon: '🏛', credKey: 'cephas' },
        { label: 'lianabanyan.com', icon: '🌿', credKey: 'lianabanyan' },
        { label: 'Substack', icon: '📬', credKey: 'substack', envVar: 'SUBSTACK_API_KEY' },
        { label: 'Medium', icon: '📝', credKey: 'medium', envVar: 'MEDIUM_API_TOKEN' },
        { label: 'Gmail (editorial + Crown Letters)', icon: '✉️', credKey: 'gmail', envVar: 'GMAIL_OAUTH_REFRESH_TOKEN + GMAIL_OAUTH_CLIENT_ID + GMAIL_OAUTH_CLIENT_SECRET' },
        { label: 'HackerNews', icon: '🔶', credKey: 'hackernews' },
    ];
    return (_jsx("div", { style: s.wizardBox, children: _jsxs("div", { style: { maxWidth: 400, width: '100%' }, children: [_jsx("div", { style: { fontSize: 20, marginBottom: 6 }, children: "\u26A1 Welcome to Battery Dispatch" }), _jsx("div", { style: { fontSize: 12, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }, children: step === 0 ? (_jsx(_Fragment, { children: "Pick which platforms you want to publish to. You ratify each dispatch before it fires \u2014 nothing publishes without your explicit sign-off." })) : (_jsxs(_Fragment, { children: ["For platforms marked \u26AA, add the env var to ", _jsx("code", { style: { fontSize: 10, color: '#6ee7b7' }, children: "WORKING_KEYS.env" }), " in the LockBox vault and relaunch MnemosyneC. Browser-fallback works without any keys."] })) }), step === 0 && (_jsx("div", { style: { marginBottom: 20 }, children: platforms.map((p) => {
                        const ok = p.credKey ? creds[p.credKey] : true;
                        return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(100,116,139,0.1)' }, children: [_jsx("span", { children: ok ? '✅' : '⚪' }), _jsxs("span", { style: { fontSize: 12 }, children: [p.icon, " ", p.label] }), !ok && p.envVar && (_jsx("span", { style: { fontSize: 9, color: '#475569', marginLeft: 'auto' }, children: "5-min setup" }))] }, p.label));
                    }) })), step === 1 && (_jsxs("div", { style: { marginBottom: 20 }, children: [platforms.filter((p) => p.envVar && !(p.credKey && creds[p.credKey])).map((p) => (_jsxs("div", { style: s.card, children: [_jsxs("div", { style: { fontSize: 12, fontWeight: 600, color: '#f0fdf4', marginBottom: 4 }, children: [p.icon, " ", p.label] }), _jsx("div", { style: { fontSize: 10, color: '#6ee7b7', fontFamily: 'monospace' }, children: p.envVar }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 4 }, children: "Add to WORKING_KEYS.env in the LockBox vault, relaunch." })] }, p.label))), platforms.every((p) => !p.envVar || (p.credKey && creds[p.credKey])) && (_jsx("div", { style: { fontSize: 12, color: '#4ade80' }, children: "\u2705 All platforms configured! Click Finish." }))] })), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [step === 0 && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => { localStorage.setItem(LS_WIZARD_DONE, '1'); onDone(); }, style: { background: 'none', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 5, color: '#64748b', fontSize: 11, padding: '6px 14px', cursor: 'pointer' }, children: "Skip Wizard" }), _jsx("button", { onClick: () => setStep(1), style: { background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 5, color: '#6ee7b7', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', flex: 1 }, children: "Begin Setup \u2192" })] })), step === 1 && (_jsx("button", { onClick: () => { localStorage.setItem(LS_WIZARD_DONE, '1'); onDone(); }, style: { background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 5, color: '#6ee7b7', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', flex: 1 }, children: "Finish \u2014 Open Battery Dispatch" }))] })] }) }));
}
// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ platform, meta, body, onClose, onRatify, ratified, }) {
    const pm = PLATFORM_META[platform];
    const preview = body.slice(0, 800) + (body.length > 800 ? '…' : '');
    return (_jsx("div", { style: s.previewModal, onClick: onClose, children: _jsxs("div", { style: s.previewBox, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }, children: [_jsx("span", { style: { fontSize: 18 }, children: pm.icon }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#f0fdf4' }, children: pm.label }), _jsx("div", { style: { fontSize: 10, color: '#475569' }, children: pm.description })] })] }), _jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }, children: "Title" }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }, children: meta?.title ?? '—' }), meta?.subtitle && (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }, children: "Subtitle" }), _jsx("div", { style: { fontSize: 12, color: '#94a3b8', marginBottom: 12, fontStyle: 'italic' }, children: meta.subtitle })] })), _jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }, children: "Body preview" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', lineHeight: 1.6, background: 'rgba(0,0,0,0.3)', borderRadius: 5, padding: '8px 10px', maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: 14 }, children: preview || '(loading…)' }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: onClose, style: { background: 'none', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 5, color: '#64748b', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }, children: "Close" }), _jsx("button", { onClick: () => { onRatify(); onClose(); }, style: { background: ratified ? 'rgba(248,113,113,0.1)' : 'rgba(110,231,183,0.12)', border: ratified ? '1px solid rgba(248,113,113,0.35)' : '1px solid rgba(110,231,183,0.35)', borderRadius: 5, color: ratified ? '#f87171' : '#6ee7b7', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', flex: 1 }, children: ratified ? '✅ Ratified (click to un-ratify)' : '✅ Ratify this platform' })] })] }) }));
}
// ─── Settings Panel (SEG-5) ───────────────────────────────────────────────────
function SettingsPanel({ creds }) {
    const platforms = [
        { key: 'cephas', label: 'Cephas Hugo', icon: '🏛', note: 'Wired (git + firebase in workspace)' },
        { key: 'lianabanyan', label: 'lianabanyan.com React', icon: '🌿', note: 'Wired (firebase in workspace)' },
        { key: 'hackernews', label: 'HackerNews', icon: '🔶', note: 'Semi-auto browser (no setup needed)' },
        { key: 'substack', label: 'Substack', icon: '📬', envVars: ['SUBSTACK_API_KEY'] },
        { key: 'medium', label: 'Medium', icon: '📝', envVars: ['MEDIUM_API_TOKEN'] },
        { key: 'gmail', label: 'Gmail (editorial + Crown Letters)', icon: '✉️', envVars: ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REFRESH_TOKEN'] },
    ];
    return (_jsxs("div", { children: [_jsx("div", { style: { ...s.label, marginBottom: 10 }, children: "Platform Credentials" }), platforms.map((p) => {
                const ok = creds[p.key];
                return (_jsxs("div", { style: s.credRow(ok), children: [_jsx("div", { style: s.credDot(ok) }), _jsxs("span", { style: { fontSize: 12 }, children: [p.icon, " ", p.label] }), _jsx("span", { style: { marginLeft: 'auto', fontSize: 10, color: ok ? '#4ade80' : '#64748b' }, children: ok ? '✅ Ready' : p.note ? p.note : '⚪ Not configured' })] }, p.key));
            }), _jsxs("div", { style: { marginTop: 14, ...s.card }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }, children: "How to configure" }), _jsxs("div", { style: { fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }, children: ["Add the env vars to ", _jsx("code", { style: { color: '#6ee7b7' }, children: "WORKING_KEYS.env" }), " in the LockBox vault:"] }), _jsx("div", { style: { fontFamily: 'monospace', fontSize: 9, color: '#6ee7b7', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '6px 8px', marginTop: 6, lineHeight: 1.8 }, children: platforms.filter((p) => p.envVars).flatMap((p) => p.envVars).map((v) => `${v}=your_key_here`).join('\n') }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 6 }, children: "Relaunch MnemosyneC after adding keys. Browser-fallback works without any keys." })] }), _jsxs("div", { style: { marginTop: 10, ...s.card }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }, children: "Founder Decisions Pending" }), _jsxs("div", { style: { fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }, children: ["\u2022 ", _jsx("strong", { children: "Substack publication name" }), " \u2014 Bishop suggests \"For the Keep \u2014 by Jonathan G.I. Jones\"", _jsx("br", {}), "\u2022 ", _jsx("strong", { children: "Default fan-out per class" }), " \u2014 tune which platforms each content type targets", _jsx("br", {}), "\u2022 ", _jsx("strong", { children: "Standing Ratify thresholds" }), " \u2014 which classes auto-fire after file-level ratify", _jsx("br", {}), "\u2022 ", _jsx("strong", { children: "Crown Letters defaults" }), " \u2014 postal vs Gmail per recipient"] })] })] }));
}
// ─── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ history }) {
    if (history.length === 0) {
        return _jsx("div", { style: { fontSize: 11, color: '#334155', textAlign: 'center', padding: '24px 0' }, children: "No dispatches yet. Pick content + ratify platforms + fire." });
    }
    return (_jsx("div", { children: history.slice(0, 20).map((entry) => (_jsxs("div", { style: s.card, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }, children: entry.title }), _jsxs("div", { style: { fontSize: 9, color: '#475569', marginBottom: 8 }, children: [entry.contentClass, " \u00B7 ", new Date(entry.dispatchedAt).toLocaleString()] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6 }, children: entry.platforms.map((p) => (_jsxs("span", { style: {
                            fontSize: 10, padding: '2px 7px', borderRadius: 10,
                            background: p.status === 'success' ? 'rgba(74,222,128,0.1)' : p.status === 'failed' ? 'rgba(248,113,113,0.1)' : 'rgba(100,116,139,0.1)',
                            color: p.status === 'success' ? '#4ade80' : p.status === 'failed' ? '#f87171' : '#64748b',
                            border: `1px solid ${p.status === 'success' ? 'rgba(74,222,128,0.3)' : p.status === 'failed' ? 'rgba(248,113,113,0.3)' : 'rgba(100,116,139,0.2)'}`,
                        }, children: [p.status === 'success' ? '✓' : p.status === 'failed' ? '✗' : '–', " ", p.platform] }, p.platform))) })] }, entry.id))) }));
}
// ─── Main Component ────────────────────────────────────────────────────────────
export function BatteryPublishTab() {
    const [view, setView] = useState(() => localStorage.getItem(LS_ACTIVE_VIEW) ?? 'dispatch');
    const [showWizard, setShowWizard] = useState(() => localStorage.getItem(LS_WIZARD_DONE) !== '1');
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('');
    const [selectedMeta, setSelectedMeta] = useState(null);
    const [previewBody, setPreviewBody] = useState('');
    const [platforms, setPlatforms] = useState([]);
    const [dispatching, setDispatching] = useState(false);
    const [progressLog, setProgressLog] = useState([]);
    const [previewingPlatform, setPreviewingPlatform] = useState(null);
    const [history, setHistory] = useState([]);
    const [creds, setCreds] = useState({ substack: false, medium: false, gmail: false, cephas: true, lianabanyan: true, hackernews: true });
    const logRef = useRef(null);
    // Load credential status
    useEffect(() => {
        ipcInvoke('dispatch:credential-status').then(setCreds).catch(() => { });
    }, []);
    // Load content files
    useEffect(() => {
        ipcInvoke('dispatch:list-content-files').then(setFiles).catch(() => { });
    }, []);
    // Load history
    const reloadHistory = useCallback(() => {
        ipcInvoke('dispatch:history').then(setHistory).catch(() => { });
    }, []);
    useEffect(() => { reloadHistory(); }, [reloadHistory]);
    // Subscribe to dispatch progress events
    useEffect(() => {
        const unsub = onDispatchProgress((msg) => {
            setProgressLog((prev) => [...prev, msg]);
            setTimeout(() => { logRef.current?.scrollTo(0, 99999); }, 50);
        });
        return unsub;
    }, []);
    // When file selection changes
    const handleFileSelect = useCallback(async (filePath) => {
        setSelectedFile(filePath);
        const meta = files.find((f) => f.filePath === filePath) ?? null;
        setSelectedMeta(meta);
        if (meta) {
            const rows = initialPlatformRows(meta.contentClass, creds);
            setPlatforms(rows);
            // Load body for preview
            const bodyRes = await ipcInvoke('dispatch:get-file-body', filePath);
            setPreviewBody(bodyRes.v1Body ?? '');
        }
    }, [files, creds]);
    // Toggle platform enabled
    const toggleEnabled = useCallback((platform) => {
        setPlatforms((prev) => prev.map((r) => r.platform === platform ? { ...r, enabled: !r.enabled, ratified: false } : r));
    }, []);
    // Toggle ratify
    const toggleRatify = useCallback((platform) => {
        setPlatforms((prev) => prev.map((r) => r.platform === platform ? { ...r, ratified: !r.ratified } : r));
    }, []);
    // BP078 BLOOD: can dispatch only if ≥1 platform enabled AND all enabled platforms are ratified
    const enabledPlatforms = platforms.filter((r) => r.enabled);
    const ratifiedPlatforms = platforms.filter((r) => r.enabled && r.ratified);
    const canDispatch = selectedFile.length > 0 && enabledPlatforms.length > 0 && ratifiedPlatforms.length === enabledPlatforms.length && !dispatching;
    // Dispatch handler
    const handleDispatch = useCallback(async () => {
        if (!canDispatch)
            return;
        setDispatching(true);
        setProgressLog([]);
        // Reset platform statuses
        setPlatforms((prev) => prev.map((r) => r.enabled ? { ...r, status: 'running' } : r));
        try {
            const result = await ipcInvoke('dispatch:fire', {
                filePath: selectedFile,
                platforms: enabledPlatforms.map((r) => r.platform),
                ratifiedPlatforms: ratifiedPlatforms.map((r) => r.platform),
            });
            if (!result.ok) {
                setProgressLog((prev) => [...prev, `ERROR: ${result.error}`]);
                setPlatforms((prev) => prev.map((r) => ({ ...r, status: r.enabled ? 'failed' : r.status })));
            }
            else {
                setPlatforms((prev) => prev.map((r) => {
                    const res = result.results.find((x) => x.platform === r.platform);
                    if (!res)
                        return r;
                    return { ...r, status: res.status, resultUrl: res.url, fallbackUrl: res.fallbackUrl, error: res.error };
                }));
                reloadHistory();
            }
        }
        catch (e) {
            setProgressLog((prev) => [...prev, `IPC error: ${e instanceof Error ? e.message : String(e)}`]);
        }
        finally {
            setDispatching(false);
        }
    }, [canDispatch, selectedFile, enabledPlatforms, ratifiedPlatforms, reloadHistory]);
    const switchView = (v) => {
        setView(v);
        localStorage.setItem(LS_ACTIVE_VIEW, v);
    };
    return (_jsxs("div", { style: s.outer, children: [_jsx("div", { style: s.header, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 16 }, children: "\u26A1" }), _jsxs("div", { children: [_jsx("div", { style: s.headerTitle, children: "Battery Dispatch" }), _jsx("div", { style: s.headerSub, children: "Auto-fan-out for ratified content. You ratify \u2192 the cooperative dispatches." })] })] }) }), _jsx("div", { style: s.tabBar, children: ['dispatch', 'history', 'settings'].map((v) => (_jsx("button", { onClick: () => switchView(v), style: s.tab(view === v), children: v === 'dispatch' ? '+ New Dispatch' : v === 'history' ? 'History' : 'Settings' }, v))) }), _jsxs("div", { style: s.scroll, children: [view === 'dispatch' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: s.card, children: [_jsx("div", { style: s.label, children: "Content file (from BISHOP_DROPZONE/00_FOUNDER_REVIEW/)" }), _jsxs("select", { style: s.selectBox, value: selectedFile, onChange: (e) => handleFileSelect(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Select ratified content file \u2014" }), files.map((f) => (_jsxs("option", { value: f.filePath, children: ["[", f.contentClass, "] ", f.title, f.status?.toLowerCase().includes('ratif') ? ' ✓' : ''] }, f.filePath)))] }), selectedMeta && (_jsxs("div", { style: { marginTop: 8, fontSize: 10, color: '#475569' }, children: ["Class: ", _jsx("strong", { style: { color: '#6ee7b7' }, children: selectedMeta.contentClass }), selectedMeta.date && _jsxs(_Fragment, { children: [" \u00B7 Date: ", selectedMeta.date] }), selectedMeta.status && _jsxs(_Fragment, { children: [" \u00B7 Status: ", selectedMeta.status] })] }))] }), selectedMeta && (_jsxs("div", { style: s.card, children: [_jsx("div", { style: s.label, children: "Fan-out plan \u2014 check all platforms you want to fire" }), _jsxs("div", { style: { marginBottom: 6, fontSize: 10, color: '#475569' }, children: ["Tick a platform, then click ", _jsx("strong", { children: "[Preview]" }), " to review + ratify. Dispatch fires only ratified \u2705 platforms."] }), platforms.map((row) => (_jsxs("div", { style: s.platformRow(row.enabled), children: [_jsx("input", { type: "checkbox", checked: row.enabled, onChange: () => toggleEnabled(row.platform), style: { width: 14, height: 14, flexShrink: 0, marginTop: 2, accentColor: '#6ee7b7', cursor: 'pointer' } }), _jsx("div", { style: s.statusDot(row.status), title: row.status }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0' }, children: [row.icon, " ", row.label] }), _jsx("div", { style: { fontSize: 9, color: '#475569', lineHeight: 1.5 }, children: row.description }), row.resultUrl && (_jsxs("div", { style: { fontSize: 10, color: '#4ade80', marginTop: 2 }, children: ["\u2713 ", row.resultUrl] })), row.fallbackUrl && !row.resultUrl && (_jsx("div", { style: { fontSize: 10, color: '#f59e0b', marginTop: 2 }, children: "\u2197 browser opened" })), row.error && row.status === 'failed' && (_jsx("div", { style: { fontSize: 9, color: '#f87171', marginTop: 2 }, children: row.error.slice(0, 80) }))] }), row.enabled && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setPreviewingPlatform(row.platform), style: { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 4, color: '#94a3b8', fontSize: 10, padding: '3px 8px', cursor: 'pointer' }, children: "Preview" }), _jsx("button", { onClick: () => toggleRatify(row.platform), style: s.ratifyBtn(row.ratified), title: row.ratified ? 'Un-ratify' : 'Ratify this platform', children: row.ratified ? '✓' : '' })] }))] }, row.platform))), _jsx("div", { style: { marginTop: 10, fontSize: 10, color: enabledPlatforms.length > 0 && ratifiedPlatforms.length < enabledPlatforms.length ? '#f59e0b' : '#4ade80' }, children: enabledPlatforms.length === 0 ? 'Select at least one platform.' :
                                            ratifiedPlatforms.length < enabledPlatforms.length
                                                ? `⚠ ${enabledPlatforms.length - ratifiedPlatforms.length} platform(s) not yet ratified. Preview each and click Ratify.`
                                                : `✅ All ${ratifiedPlatforms.length} selected platforms ratified — ready to dispatch.` })] })), selectedMeta && (_jsx("button", { onClick: handleDispatch, disabled: !canDispatch, style: s.dispatchBtn(canDispatch), children: dispatching ? '⏳ Dispatching…' : `🔥 DISPATCH (${ratifiedPlatforms.length}/${enabledPlatforms.length} ratified)` })), progressLog.length > 0 && (_jsxs("div", { style: { ...s.card, marginTop: 8 }, children: [_jsx("div", { style: s.label, children: "Dispatch log" }), _jsx("div", { style: s.progressLog, ref: logRef, children: progressLog.map((line, i) => (_jsx("div", { children: line }, i))) })] })), history.length > 0 && !dispatching && (_jsxs("div", { style: { fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 8 }, children: ["Last dispatch: ", _jsx("strong", { style: { color: '#64748b' }, children: history[0].title }), " \u00B7 ", new Date(history[0].dispatchedAt).toLocaleString()] }))] })), view === 'history' && _jsx(HistoryPanel, { history: history }), view === 'settings' && _jsx(SettingsPanel, { creds: creds })] }), previewingPlatform && (_jsx(PreviewModal, { platform: previewingPlatform, meta: selectedMeta, body: previewBody, onClose: () => setPreviewingPlatform(null), onRatify: () => toggleRatify(previewingPlatform), ratified: platforms.find((r) => r.platform === previewingPlatform)?.ratified ?? false })), showWizard && (_jsx(FirstUseWizard, { creds: creds, onDone: () => setShowWizard(false) }))] }));
}
