import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// CaithedralCoreTab.tsx — BP061 · Tab 13 · Caithedral™ Core surface inside MnemosyneC
// Surfaces the LEAN open-source CAI™ Core SSPL reference implementation.
// All window.amplify.caithedral calls use graceful try/catch degradation.
// Color scheme: #0a0a0a bg · #7c6af7 accent · #22c55e success · #f59e0b warning
import { useState, useEffect, useCallback } from 'react';
function getCaithedral() {
    return window.amplify?.caithedral ?? null;
}
// ─── Sub-panel pill styles ─────────────────────────────────────────────────────
const SUBPANELS = [
    { id: 'overview', label: 'Overview' },
    { id: 'substrate', label: 'Substrate' },
    { id: 'folders', label: 'Folders' },
    { id: 'banyan-metric', label: 'Banyan Metric™' },
    { id: 'dag-soccerball', label: 'DAG ⚽' },
];
// ─── Shared palette ────────────────────────────────────────────────────────────
const P = {
    bg: '#0a0a0a',
    surface: '#111111',
    border: '#222222',
    accent: '#7c6af7',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    muted: '#666666',
    text: '#e0e0e0',
    subtext: '#aaaaaa',
};
// ─── Root component ────────────────────────────────────────────────────────────
export function CaithedralCoreTab() {
    const [activePanel, setActivePanel] = useState('overview');
    const cai = getCaithedral();
    const available = cai !== null;
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: P.bg,
            color: P.text,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            overflow: 'hidden',
        }, children: [_jsxs("div", { style: {
                    padding: '10px 16px 8px',
                    borderBottom: `1px solid ${P.border}`,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }, children: "Caithedral\u2122 Core" }), _jsx("div", { style: { fontSize: 10, color: P.muted, marginTop: 1 }, children: "Keystone I \u00B7 SSPL-1.0 \u00B7 Designed to Be Copied" })] }), !available && (_jsx("span", { style: {
                            fontSize: 9, fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(245,158,11,0.12)',
                            border: `1px solid rgba(245,158,11,0.3)`,
                            color: P.warning,
                        }, children: "tools pending Keystone I" })), available && (_jsx("span", { style: {
                            fontSize: 9, fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(34,197,94,0.1)',
                            border: `1px solid rgba(34,197,94,0.25)`,
                            color: P.success,
                        }, children: "ACTIVE" }))] }), _jsx("div", { style: {
                    display: 'flex',
                    gap: 4,
                    padding: '8px 16px',
                    borderBottom: `1px solid ${P.border}`,
                    flexShrink: 0,
                }, children: SUBPANELS.map((sp) => (_jsx("button", { onClick: () => setActivePanel(sp.id), style: {
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: activePanel === sp.id
                            ? `1px solid rgba(124,106,247,0.6)`
                            : `1px solid ${P.border}`,
                        background: activePanel === sp.id
                            ? 'rgba(124,106,247,0.15)'
                            : 'transparent',
                        color: activePanel === sp.id ? P.accent : P.muted,
                        fontSize: 11,
                        fontWeight: activePanel === sp.id ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }, children: sp.label }, sp.id))) }), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '16px' }, children: [activePanel === 'overview' && _jsx(OverviewPanel, { cai: cai }), activePanel === 'substrate' && _jsx(SubstratePanel, { cai: cai }), activePanel === 'folders' && _jsx(FoldersPanel, { cai: cai }), activePanel === 'banyan-metric' && _jsx(BanyanMetricPanel, { cai: cai }), activePanel === 'dag-soccerball' && _jsx(DagSoccerballPanel, { cai: cai })] }), _jsx("div", { style: {
                    padding: '6px 16px',
                    borderTop: `1px solid ${P.border}`,
                    fontSize: 9,
                    color: '#333',
                    flexShrink: 0,
                    lineHeight: 1.6,
                }, children: "CAI\u2122 Core Keystone I \u00B7 SSPL-1.0 + Patent Pledge #2260 \u00B7 \u00A9 2026 Liana Banyan Corporation \u00B7 50-year charter \u00B7 Designed to Be Copied \u00B7 mnemosynec.ai" })] }));
}
// ─── Unavailability notice ────────────────────────────────────────────────────
function UnavailableNotice() {
    return (_jsxs("div", { style: {
            padding: 16,
            background: 'rgba(245,158,11,0.06)',
            border: `1px solid rgba(245,158,11,0.2)`,
            borderRadius: 8,
            color: P.warning,
            fontSize: 12,
            lineHeight: 1.6,
        }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: 4 }, children: "Caithedral tools available in Keystone I+" }), _jsxs("div", { style: { color: P.muted, fontSize: 11 }, children: ["The ", _jsx("code", { style: { color: P.accent }, children: "window.amplify.caithedral" }), " bridge is not yet wired in this build. Update MnemosyneC to Keystone I to enable live Banyan Metric\u2122, MoneyPenny\u2122, Substrate, and Substrated Folders."] })] }));
}
// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
    return (_jsxs("div", { style: {
            background: P.surface,
            border: `1px solid ${P.border}`,
            borderRadius: 8,
            padding: '12px 14px',
        }, children: [_jsx("div", { style: { fontSize: 10, color: P.muted, marginBottom: 6 }, children: label }), _jsx("div", { style: { fontSize: 16, fontWeight: 700, color: accent ?? '#fff' }, children: value })] }));
}
// ─── Overview panel ───────────────────────────────────────────────────────────
function OverviewPanel({ cai }) {
    const [bmScore, setBmScore] = useState(null);
    const [mpView, setMpView] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!cai)
            return;
        cai.banyanMetric?.getLatest()
            .then((r) => r && setBmScore(r.score))
            .catch((e) => setError(String(e)));
        cai.moneyPenny?.getDualView()
            .then((r) => r && setMpView(r))
            .catch(() => { });
    }, [cai]);
    if (!cai)
        return _jsx(UnavailableNotice, {});
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                }, children: [_jsx(StatCard, { label: "Banyan Metric\u2122", value: bmScore ? `${bmScore.composite.toFixed(1)}/100` : '—', accent: bmScore
                            ? bmScore.composite >= 80 ? P.success : bmScore.composite >= 50 ? P.warning : P.danger
                            : '#fff' }), _jsx(StatCard, { label: "MoneyPenny\u2122 Saved", value: mpView ? `$${mpView.combined_usd.toFixed(4)}` : '—', accent: P.success }), _jsx(StatCard, { label: "Architecture", value: "Caithedral\u2122 active", accent: P.accent }), _jsx(StatCard, { label: "License", value: "SSPL-1.0" })] }), error && (_jsx("div", { style: {
                    padding: 10,
                    background: 'rgba(239,68,68,0.06)',
                    border: `1px solid rgba(239,68,68,0.2)`,
                    borderRadius: 6,
                    fontSize: 11,
                    color: P.danger,
                }, children: error })), _jsxs("div", { style: {
                    padding: 14,
                    background: P.surface,
                    borderRadius: 8,
                    fontSize: 11,
                    color: P.muted,
                    lineHeight: 1.8,
                    border: `1px solid ${P.border}`,
                }, children: [_jsx("strong", { style: { color: P.subtext }, children: "CAI\u2122 Core Keystone I" }), ' · ', "Cooperative AI Memory Architecture", ' · ', "Reference Implementation", _jsx("br", {}), "SSPL-1.0 + Cooperative Patent Pledge #2260 \u00B7 Designed to Be Copied", _jsx("br", {}), _jsx("button", { onClick: () => window.amplify?.openExternal?.('https://mnemosynec.ai'), style: {
                            background: 'none',
                            border: 'none',
                            color: P.accent,
                            cursor: 'pointer',
                            fontSize: 11,
                            padding: 0,
                            textDecoration: 'underline',
                        }, children: "mnemosynec.ai" })] })] }));
}
// ─── Substrate panel ──────────────────────────────────────────────────────────
function SubstratePanel({ cai }) {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const search = useCallback(async () => {
        if (!cai?.substrate || !query.trim())
            return;
        setLoading(true);
        setResult(null);
        try {
            const r = await cai.substrate.query(query.trim());
            if (r.hit && r.record) {
                setResult(`[${r.routing} · ${r.latency_ms}ms · HIT]\n${r.record.text}`);
            }
            else {
                setResult(`[${r.routing ?? 'miss'} · ${r.latency_ms ?? 0}ms · MISS] No substrate hit`);
            }
        }
        catch (err) {
            setResult(`Error: ${err.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [cai, query]);
    if (!cai)
        return _jsx(UnavailableNotice, {});
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("div", { style: { fontSize: 12, color: P.muted }, children: "Caithedral\u2122 CPU-only retrieval \u00B7 zero LLM inference" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => e.key === 'Enter' && void search(), placeholder: "Query the substrate\u2026", style: {
                            flex: 1,
                            background: P.surface,
                            color: P.text,
                            border: `1px solid ${P.border}`,
                            borderRadius: 6,
                            padding: '8px 10px',
                            fontSize: 12,
                            outline: 'none',
                        } }), _jsx("button", { onClick: () => void search(), disabled: loading || !query.trim() || !cai.substrate, style: {
                            padding: '8px 18px',
                            background: loading ? '#333' : P.accent,
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                        }, children: loading ? '…' : 'Query' })] }), result && (_jsx("div", { style: {
                    padding: 12,
                    background: P.surface,
                    border: `1px solid ${P.border}`,
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#ccc',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    maxHeight: 260,
                    overflow: 'auto',
                }, children: result })), !cai.substrate && (_jsx("div", { style: { fontSize: 11, color: P.warning }, children: "substrate.query not available via this bridge \u2014 check preload wiring" }))] }));
}
// ─── Folders panel ────────────────────────────────────────────────────────────
function FoldersPanel({ cai }) {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [listError, setListError] = useState(null);
    const refresh = useCallback(async () => {
        if (!cai?.substratedFolders)
            return;
        try {
            const f = await cai.substratedFolders.list();
            setFolders(f);
        }
        catch (err) {
            setListError(String(err));
        }
    }, [cai]);
    useEffect(() => { void refresh(); }, [refresh]);
    const addFolder = async () => {
        if (!cai?.substratedFolders)
            return;
        setLoading(true);
        try {
            const result = await cai.substratedFolders.add();
            setFolders(result.paths);
        }
        catch (err) {
            setListError(String(err));
        }
        finally {
            setLoading(false);
        }
    };
    const removeFolder = async (path) => {
        if (!cai?.substratedFolders)
            return;
        try {
            const result = await cai.substratedFolders.remove(path);
            setFolders(result.paths);
        }
        catch (err) {
            setListError(String(err));
        }
    };
    if (!cai)
        return _jsx(UnavailableNotice, {});
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { style: { fontSize: 12, color: P.muted, lineHeight: 1.6 }, children: ["CAI\u2122 Core reads ", _jsx("strong", { style: { color: P.subtext }, children: "only" }), " the folders you mark here. Files are never modified \u2014 Eblet\u2122 records are written to", ' ', _jsx("code", { style: { color: P.accent, fontSize: 11 }, children: "~/.cai_core/" }), "."] }), _jsx("button", { onClick: () => void addFolder(), disabled: loading || !cai.substratedFolders, style: {
                    alignSelf: 'flex-start',
                    padding: '7px 16px',
                    background: loading ? '#333' : P.success,
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    cursor: loading || !cai.substratedFolders ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                }, children: loading ? 'Selecting…' : '+ Add Substrated Folder' }), listError && (_jsx("div", { style: { fontSize: 11, color: P.danger }, children: listError })), folders.length === 0 ? (_jsx("div", { style: {
                    padding: 16,
                    background: P.surface,
                    borderRadius: 6,
                    color: '#555',
                    fontSize: 12,
                    border: `1px solid ${P.border}`,
                }, children: "No folders substrated yet. Click \"+ Add Substrated Folder\" to begin." })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: folders.map((f) => (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        background: P.surface,
                        border: '1px solid #1a2e1a',
                        borderRadius: 6,
                    }, children: [_jsx("span", { style: { color: P.success, fontSize: 13, flexShrink: 0 }, children: "\u2713" }), _jsx("span", { style: { flex: 1, fontSize: 11, color: '#ccc', wordBreak: 'break-all' }, children: f }), _jsx("span", { style: { fontSize: 9, color: '#555', flexShrink: 0 }, children: "Substrated" }), _jsx("button", { onClick: () => void removeFolder(f), style: {
                                padding: '3px 8px',
                                background: 'transparent',
                                border: `1px solid ${P.border}`,
                                borderRadius: 4,
                                color: P.muted,
                                cursor: 'pointer',
                                fontSize: 10,
                            }, children: "Remove" })] }, f))) })), !cai.substratedFolders && (_jsx("div", { style: { fontSize: 11, color: P.warning }, children: "substratedFolders bridge not available \u2014 check preload wiring" }))] }));
}
// ─── Banyan Metric™ panel ─────────────────────────────────────────────────────
function BanyanMetricPanel({ cai }) {
    const [latest, setLatest] = useState(null);
    const [rows, setRows] = useState([]);
    useEffect(() => {
        if (!cai?.banyanMetric)
            return;
        cai.banyanMetric.getLatest()
            .then((r) => r && setLatest(r))
            .catch(() => { });
        cai.banyanMetric.getTrend(10)
            .then((t) => setRows(t.slice().reverse()))
            .catch(() => { });
    }, [cai]);
    if (!cai)
        return _jsx(UnavailableNotice, {});
    const scoreColor = (v) => v >= 80 ? P.success : v >= 50 ? P.warning : P.danger;
    const dimRow = (label, val, weight) => (_jsxs("div", { style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
            borderBottom: '1px solid #1a1a1a',
        }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontSize: 11, color: '#ccc', fontWeight: 600 }, children: label }), _jsxs("span", { style: { fontSize: 9, color: '#444', marginLeft: 6 }, children: ["w=", weight] })] }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: scoreColor(val) }, children: val.toFixed(1) })] }, label));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsx("div", { style: { fontSize: 12, color: P.muted }, children: "6-dimension AI session scoring \u00B7 CW \u00B7 WC \u00B7 SC \u00B7 RR \u00B7 DR \u00B7 CM" }), latest ? (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("div", { style: { padding: 14, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8 }, children: [_jsx("div", { style: { fontSize: 10, color: P.muted, marginBottom: 6 }, children: "Composite Score" }), _jsxs("div", { style: {
                                    fontSize: 34,
                                    fontWeight: 900,
                                    color: scoreColor(latest.score.composite),
                                }, children: [latest.score.composite.toFixed(2), _jsx("span", { style: { fontSize: 14, color: '#444' }, children: "/100" })] }), _jsxs("div", { style: { fontSize: 9, color: '#444', marginTop: 4 }, children: ["Session: ", latest.session_id?.slice(0, 16), " \u00B7 ", latest.bp_session] })] }), _jsxs("div", { style: { padding: 14, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8 }, children: [dimRow('CW — Context Window', latest.score.CW, '0.20'), dimRow('WC — Work Completed', latest.score.WC, '0.20'), dimRow('SC — Substrate Contrib', latest.score.SC, '0.15'), dimRow('RR — Retrieval Rate', latest.score.RR, '0.20'), dimRow('DR — Drift Rate', latest.score.DR, '0.10'), dimRow('CM — Cost Mitigation', latest.score.CM, '0.15')] })] })) : (_jsx("div", { style: {
                    padding: 16,
                    background: P.surface,
                    borderRadius: 6,
                    color: '#555',
                    fontSize: 12,
                    border: `1px solid ${P.border}`,
                }, children: "No Banyan Metric\u2122 records yet. Records are written when a session appends a score row." })), rows.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: P.muted, marginBottom: 8 }, children: "Session History (last 10)" }), _jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 10 }, children: [_jsx("thead", { children: _jsx("tr", { style: { borderBottom: `1px solid ${P.border}` }, children: ['Session', 'BP', 'Composite', 'CW', 'WC', 'SC', 'RR', 'DR', 'CM', 'Date'].map((h) => (_jsx("th", { style: { padding: '5px 6px', textAlign: 'left', color: '#555', fontWeight: 600 }, children: h }, h))) }) }), _jsx("tbody", { children: rows.map((r, i) => (_jsxs("tr", { style: { borderBottom: '1px solid #111' }, children: [_jsx("td", { style: { padding: '4px 6px', color: P.subtext }, children: r.session_id?.slice(0, 10) }), _jsx("td", { style: { padding: '4px 6px', color: P.muted }, children: r.bp_session }), _jsx("td", { style: { padding: '4px 6px', fontWeight: 700, color: scoreColor(r.score.composite) }, children: r.score.composite.toFixed(1) }), ['CW', 'WC', 'SC', 'RR', 'DR', 'CM'].map((d) => (_jsx("td", { style: { padding: '4px 6px', color: P.muted }, children: r.score[d].toFixed(1) }, d))), _jsx("td", { style: { padding: '4px 6px', color: '#444' }, children: new Date(r.timestamp).toLocaleDateString() })] }, i))) })] }) })] })), !cai.banyanMetric && (_jsx("div", { style: { fontSize: 11, color: P.warning }, children: "banyanMetric bridge not available \u2014 check preload wiring" }))] }));
}
// ─── DAG Soccerball Panel (BP061 · Soccerball-in-Soccerball · Context Lever) ─
function DagSoccerballPanel({ cai }) {
    const [rootId, setRootId] = useState('');
    const [path, setPath] = useState('');
    const [sessionMeta, setSessionMeta] = useState('');
    const [handle, setHandle] = useState('');
    const [result, setResult] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeOp, setActiveOp] = useState('emit');
    const [emitPearls, setEmitPearls] = useState('af5be14111467931');
    const [emitFaces, setEmitFaces] = useState('');
    // MESH-6 Piece 6: fetch-from-peer state
    const [fetchPeerDagId, setFetchPeerDagId] = useState('');
    const [fetchPeerSelectedId, setFetchPeerSelectedId] = useState('');
    const [meshPeers, setMeshPeers] = useState([]);
    const [fetchPeerResult, setFetchPeerResult] = useState(null);
    const [fetchPeerLoading, setFetchPeerLoading] = useState(false);
    useEffect(() => {
        if (!cai?.dagSoccerball)
            return;
        cai.dagSoccerball.stats().then(setStats).catch(() => { });
    }, [cai]);
    // Load mesh peers for peer-selector (independent of dagSoccerball bridge)
    useEffect(() => {
        window.amplify?.getMeshState?.()
            .then((state) => { if (state?.peers)
            setMeshPeers(state.peers); })
            .catch(() => { });
    }, []);
    const refreshStats = useCallback(async () => {
        if (!cai?.dagSoccerball)
            return;
        try {
            setStats(await cai.dagSoccerball.stats());
        }
        catch { }
    }, [cai]);
    const runOp = useCallback(async () => {
        if (!cai?.dagSoccerball)
            return;
        setLoading(true);
        setResult(null);
        try {
            if (activeOp === 'emit') {
                const pearls = emitPearls.split(',').map(s => s.trim()).filter(Boolean);
                const faces = {};
                if (emitFaces.trim()) {
                    emitFaces.split(',').forEach(pair => {
                        const [k, v] = pair.trim().split(':');
                        if (k && v)
                            faces[k.trim()] = v.trim();
                    });
                }
                const r = await cai.dagSoccerball.emit(pearls, {}, faces);
                setRootId(r.dag_id);
                setResult(JSON.stringify(r, null, 2));
                await refreshStats();
            }
            else if (activeOp === 'resolve') {
                const p = path.split(',').map(s => s.trim()).filter(Boolean);
                const r = await cai.dagSoccerball.resolve(rootId, p);
                setResult(JSON.stringify(r, null, 2));
            }
            else if (activeOp === 'encode') {
                const r = await cai.dagSoccerball.handle('encode', { root_id: rootId, session_meta: sessionMeta || undefined });
                setHandle(r.handle ?? '');
                setResult(JSON.stringify(r, null, 2));
            }
            else {
                const r = await cai.dagSoccerball.handle('decode', { handle });
                setResult(JSON.stringify(r, null, 2));
            }
        }
        catch (err) {
            setResult(`Error: ${err.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [cai, activeOp, emitPearls, emitFaces, rootId, path, sessionMeta, handle, refreshStats]);
    // MESH-6 Piece 6: fetch-from-peer op (independent of dagSoccerball bridge)
    const runFetchPeer = useCallback(async () => {
        if (!fetchPeerDagId.trim() || !fetchPeerSelectedId) {
            setFetchPeerResult('Error: provide dag_id and select a peer');
            return;
        }
        setFetchPeerLoading(true);
        setFetchPeerResult(null);
        try {
            const r = await window.amplify?.federationFetchSid?.(fetchPeerDagId.trim(), fetchPeerSelectedId);
            if (r?.ok && r.hash_verified) {
                setFetchPeerResult(JSON.stringify({ hash_verified: true, node: r.node }, null, 2));
            }
            else {
                setFetchPeerResult(`Error: ok=${r?.ok} hash_verified=${r?.hash_verified} error=${r?.error}`);
            }
        }
        catch (err) {
            setFetchPeerResult(`Error: ${err.message}`);
        }
        finally {
            setFetchPeerLoading(false);
        }
    }, [fetchPeerDagId, fetchPeerSelectedId]);
    const addressingRows = [1, 2, 3, 4, 5, 6].map(d => ({ depth: d, count: Math.pow(6, d) }));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 14 }, children: [_jsxs("div", { style: {
                    padding: '10px 14px',
                    background: 'rgba(124,106,247,0.06)',
                    border: `1px solid rgba(124,106,247,0.2)`,
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#aaa',
                    lineHeight: 1.7,
                }, children: [_jsx("strong", { style: { color: P.accent }, children: "Soccerball-in-Soccerball\u2122" }), ' · ', "Recursive DAG addressing \u00B7 6 faces \u00D7 depth N = 6", _jsx("sup", { children: "N" }), " items", _jsx("br", {}), _jsx("strong", { style: { color: P.success }, children: "Context Lever\u2122:" }), ' ', "~135-byte handle re-weaves full session from substrate \u00B7 replaces 72%\u2192", '<', "30% context"] }), _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 6,
                }, children: addressingRows.map(({ depth, count }) => (_jsxs("div", { style: {
                        padding: '8px 6px',
                        background: P.surface,
                        border: `1px solid ${P.border}`,
                        borderRadius: 6,
                        textAlign: 'center',
                    }, children: [_jsxs("div", { style: { fontSize: 9, color: P.muted }, children: ["depth ", depth] }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: P.accent }, children: count.toLocaleString() }), _jsx("div", { style: { fontSize: 8, color: '#444' }, children: "items" })] }, depth))) }), stats && (_jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs("div", { style: {
                            flex: 1, padding: '8px 12px', background: P.surface,
                            border: `1px solid ${P.border}`, borderRadius: 6,
                        }, children: [_jsx("div", { style: { fontSize: 9, color: P.muted }, children: "DAG nodes in crystal" }), _jsx("div", { style: { fontSize: 16, fontWeight: 700, color: P.accent }, children: stats.total_dag_nodes })] }), _jsxs("div", { style: {
                            flex: 1, padding: '8px 12px', background: P.surface,
                            border: `1px solid ${P.border}`, borderRadius: 6,
                        }, children: [_jsx("div", { style: { fontSize: 9, color: P.muted }, children: "Substrate ~bytes" }), _jsx("div", { style: { fontSize: 16, fontWeight: 700, color: P.success }, children: stats.estimatedBytes.toLocaleString() })] })] })), !cai?.dagSoccerball ? (_jsx("div", { style: {
                    padding: 14, background: 'rgba(245,158,11,0.06)',
                    border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 8,
                    color: P.warning, fontSize: 11,
                }, children: "DAG Soccerball bridge available in Keystone I+ \u00B7 dagSoccerball bridge not wired in this build" })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: 'flex', gap: 4 }, children: ['emit', 'resolve', 'encode', 'decode'].map((op) => (_jsx("button", { onClick: () => setActiveOp(op), style: {
                                padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: activeOp === op ? 600 : 400, cursor: 'pointer',
                                border: activeOp === op ? `1px solid rgba(124,106,247,0.6)` : `1px solid ${P.border}`,
                                background: activeOp === op ? 'rgba(124,106,247,0.15)' : 'transparent',
                                color: activeOp === op ? P.accent : P.muted,
                            }, children: op }, op))) }), activeOp === 'emit' && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("input", { value: emitPearls, onChange: e => setEmitPearls(e.target.value), placeholder: "pearl IDs (comma-separated)", style: { flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' } }), _jsx("input", { value: emitFaces, onChange: e => setEmitFaces(e.target.value), placeholder: "faces: 0:dag_id_child0, 2:dag_id_child2 (optional)", style: { flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' } })] })), activeOp === 'resolve' && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("input", { value: rootId, onChange: e => setRootId(e.target.value), placeholder: "root dag_id (32 chars)", style: { flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' } }), _jsx("input", { value: path, onChange: e => setPath(e.target.value), placeholder: "face path: 0, 3, 2 (comma-separated 0\u20135)", style: { flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' } })] })), activeOp === 'encode' && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("input", { value: rootId, onChange: e => setRootId(e.target.value), placeholder: "root dag_id (32 chars)", style: { flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' } }), _jsx("input", { value: sessionMeta, onChange: e => setSessionMeta(e.target.value), placeholder: "session label (optional, max 20 chars)", style: { flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' } })] })), activeOp === 'decode' && (_jsx("input", { value: handle, onChange: e => setHandle(e.target.value), placeholder: "paste ~135-byte DAG handle here", style: { flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' } })), _jsx("button", { onClick: () => void runOp(), disabled: loading, style: {
                            alignSelf: 'flex-start', padding: '7px 18px',
                            background: loading ? '#333' : P.accent,
                            color: '#fff', border: 'none', borderRadius: 6,
                            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                        }, children: loading ? '…' : activeOp === 'emit' ? 'Emit DAG Node' : activeOp === 'resolve' ? 'Resolve Path' : activeOp === 'encode' ? 'Encode Handle' : 'Decode Handle' }), result && (_jsx("div", { style: {
                            padding: 12, background: P.surface, border: `1px solid ${P.border}`,
                            borderRadius: 6, fontSize: 10, color: '#ccc', whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace', maxHeight: 220, overflow: 'auto',
                        }, children: result }))] })), _jsxs("div", { style: {
                    padding: '8px 12px', background: P.surface, border: `1px solid ${P.border}`,
                    borderRadius: 6, fontSize: 10, color: P.muted, lineHeight: 1.7,
                }, children: [_jsx("strong", { style: { color: P.subtext }, children: "Context Lever\u2122 mechanics:" }), " A ~135-byte handle encodes root_id + depth + node_count + pearls_hash + epoch. Feed the handle into dag_soccerball_handle (decode) at session-open to instantly re-weave the full DAG from the substrate \u2014 no re-reading context. Target: 72% context \u2192 ", '<', "30%.", _jsx("br", {}), _jsx("strong", { style: { color: P.success }, children: "POCKET-6 LIVE:" }), " soccerball-over-DNS emitting via Google Cloud DNS (ns-cloud-a1..a4.googledomains.com \u00B7 Zone: soccerball-s \u00B7 pearl_82fc6d2e03a9c98c)."] }), _jsxs("div", { style: {
                    padding: '10px 14px',
                    background: 'rgba(34,197,94,0.05)',
                    border: `1px solid rgba(34,197,94,0.2)`,
                    borderRadius: 8,
                    display: 'flex', flexDirection: 'column', gap: 8,
                }, children: [_jsx("div", { style: { fontSize: 11, color: P.success, fontWeight: 600 }, children: "MESH-6 \u00B7 Resolve from Peer" }), _jsx("div", { style: { fontSize: 10, color: P.muted }, children: "Fetch a DAG node from a peer by dag_id. Hash-verified on receipt (SID = sha256(pearls,bindings,faces)[:32])." }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("input", { value: fetchPeerDagId, onChange: e => setFetchPeerDagId(e.target.value), placeholder: "remote dag_id (32 chars)", style: { background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' } }), _jsxs("select", { value: fetchPeerSelectedId, onChange: e => setFetchPeerSelectedId(e.target.value), style: { background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11 }, children: [_jsx("option", { value: "", children: "\u2014 select peer \u2014" }), meshPeers.map(p => (_jsxs("option", { value: p.peerId, children: [p.displayName ?? p.peerId.slice(0, 12), " (", p.peerId.slice(0, 8), "\u2026)"] }, p.peerId)))] })] }), meshPeers.length === 0 && (_jsx("div", { style: { fontSize: 10, color: P.muted, fontStyle: 'italic' }, children: "No peers discovered yet \u2014 open Federation tab to connect peers first." })), _jsx("button", { onClick: () => void runFetchPeer(), disabled: fetchPeerLoading, style: {
                            alignSelf: 'flex-start', padding: '6px 16px',
                            background: fetchPeerLoading ? '#333' : 'rgba(34,197,94,0.8)',
                            color: '#fff', border: 'none', borderRadius: 6,
                            cursor: fetchPeerLoading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600,
                        }, children: fetchPeerLoading ? '…fetching' : 'Fetch + Verify Hash' }), fetchPeerResult && (_jsx("div", { style: {
                            padding: 10, background: P.surface, border: `1px solid ${P.border}`,
                            borderRadius: 6, fontSize: 10, color: fetchPeerResult.startsWith('Error') ? P.danger : '#ccc',
                            whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 200, overflow: 'auto',
                        }, children: fetchPeerResult }))] })] }));
}
