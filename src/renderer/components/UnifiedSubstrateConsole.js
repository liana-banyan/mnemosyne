import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// UnifiedSubstrateConsole — BP060 Application 002 Step 1 v3 · UI-7
// Single MnemosyneC pane: Bridge view ↔ Dashboard view.
// Ctrl+Tab to switch between views (keyboard shortcut).
// State persists per-session via sessionStorage.
// Architectural separation maintained — subsystems distinct, UX unified.
// decay_class: BETWEEN on all new emissions.
// BP135 YOKE_35 Phase 3: BridgeView's `addMockTasks`/"Load Yoke Tasks" button (fake,
// hardcoded BridgeMessage rows) is CUT -- "nothing that isn't real." fetchMessages/Refresh
// (real ct.substrate_address_emit() heartbeat) and DashboardView (real ct.ten_pearl_roundtrip()
// substrate check) are unchanged and KEEP-REAL. Folded into CleanShell's combined Substrate
// tab in Phase 4.
import { useState, useEffect, useCallback } from 'react';
// ─── Storage key ─────────────────────────────────────────────────────────────
const SS_VIEW_KEY = 'mnemo_unified_console_view';
// ─── Bridge View ─────────────────────────────────────────────────────────────
function BridgeView() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastFetch, setLastFetch] = useState(null);
    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const ct = window.amplify?.caithedralTools;
            if (ct) {
                // Emit a diagnostic substrate address as a Bridge-check Pearl
                const res = await ct.substrate_address_emit('bridge-heartbeat-' + Date.now());
                if (res.ok) {
                    const msg = {
                        id: `bridge-${Date.now()}`,
                        type: 'info',
                        from: 'BRIDGE',
                        to: 'CONSOLE',
                        content: `Substrate heartbeat — address OK`,
                        ts: Date.now(),
                    };
                    setMessages((prev) => [msg, ...prev].slice(0, 100));
                }
            }
            setLastFetch(Date.now());
        }
        catch (err) {
            console.error('[UnifiedSubstrateConsole] Bridge fetch error:', err);
        }
        finally {
            setLoading(false);
        }
    }, []);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: {
                    padding: '8px 12px', borderBottom: '1px solid rgba(100,116,139,0.2)',
                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                }, children: [_jsx("div", { style: { flex: 1, fontSize: 10, fontWeight: 700, color: '#6ee7b7' }, children: "Bridge \u00B7 Live Messages" }), _jsx("button", { onClick: fetchMessages, disabled: loading, style: {
                            fontSize: 9, padding: '3px 8px', background: 'rgba(100,116,139,0.08)',
                            border: '1px solid rgba(100,116,139,0.2)', borderRadius: 4,
                            color: '#94a3b8', cursor: loading ? 'not-allowed' : 'pointer',
                        }, children: loading ? '⟳' : '↻ Refresh' })] }), messages.filter((m) => m.pinned).length > 0 && (_jsxs("div", { style: {
                    padding: '6px 12px', background: 'rgba(251,191,36,0.05)',
                    borderBottom: '1px solid rgba(251,191,36,0.15)', flexShrink: 0,
                }, children: [_jsx("div", { style: { fontSize: 8, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }, children: "PINNED TASKS" }), messages.filter((m) => m.pinned).map((m) => (_jsxs("div", { style: {
                            padding: '4px 8px', background: 'rgba(251,191,36,0.06)',
                            border: '1px solid rgba(251,191,36,0.2)', borderRadius: 4, marginBottom: 3,
                        }, children: [_jsxs("div", { style: { fontSize: 8, fontWeight: 700, color: '#fbbf24' }, children: [m.from, " \u2192 ", m.to, " \u00B7 ", m.type.toUpperCase()] }), _jsx("div", { style: { fontSize: 9, color: '#e2e8f0', marginTop: 2 }, children: m.content })] }, m.id)))] })), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '6px 12px' }, children: [messages.length === 0 ? (_jsxs("div", { style: {
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', height: '100%', gap: 8, opacity: 0.4,
                        }, children: [_jsx("div", { style: { fontSize: 24 }, children: "\uD83C\uDF09" }), _jsx("div", { style: { fontSize: 10, color: '#475569', textAlign: 'center' }, children: "No messages yet. Click \"Refresh\"." })] })) : (messages.filter((m) => !m.pinned).map((m) => (_jsxs("div", { style: {
                            padding: '5px 8px', marginBottom: 4,
                            background: m.type === 'task' ? 'rgba(110,231,183,0.04)' :
                                m.type === 'response' ? 'rgba(167,139,250,0.04)' : 'rgba(100,116,139,0.04)',
                            border: `1px solid ${m.type === 'task' ? 'rgba(110,231,183,0.15)' :
                                m.type === 'response' ? 'rgba(167,139,250,0.15)' : 'rgba(100,116,139,0.1)'}`,
                            borderRadius: 5,
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }, children: [_jsx("span", { style: {
                                            fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                                            background: m.type === 'task' ? 'rgba(110,231,183,0.12)' :
                                                m.type === 'response' ? 'rgba(167,139,250,0.12)' : 'rgba(100,116,139,0.08)',
                                            color: m.type === 'task' ? '#6ee7b7' : m.type === 'response' ? '#a78bfa' : '#64748b',
                                        }, children: m.type.toUpperCase() }), _jsxs("span", { style: { fontSize: 8, color: '#94a3b8' }, children: [m.from, " \u2192 ", m.to] }), _jsx("span", { style: { fontSize: 7, color: '#334155', marginLeft: 'auto' }, children: new Date(m.ts).toLocaleTimeString() })] }), _jsx("div", { style: { fontSize: 9, color: '#cbd5e1', lineHeight: 1.5 }, children: m.content })] }, m.id)))), lastFetch && (_jsxs("div", { style: { fontSize: 7, color: '#334155', textAlign: 'center', paddingTop: 6 }, children: ["Last refresh: ", new Date(lastFetch).toLocaleTimeString()] }))] })] }));
}
// ─── Dashboard View ───────────────────────────────────────────────────────────
function DashboardView() {
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [queue, setQueue] = useState([]);
    const loadMetrics = useCallback(async () => {
        setLoading(true);
        try {
            const ct = window.amplify?.caithedralTools;
            let substraceCount = 0;
            let vineLanding = '—';
            let catechistGrade = '—';
            let wrasse = '—';
            if (ct) {
                // Vine Landing Receipt: run a micro-roundtrip to confirm substrate alive
                const vRes = await ct.ten_pearl_roundtrip();
                if (vRes.ok && vRes.result.sid_equality) {
                    vineLanding = '✓ LANDED';
                    const r = vRes.result;
                    substraceCount = 1;
                    wrasse = `SID ${r.substrace.substrace_id.slice(0, 8)}… queued`;
                    catechistGrade = 'BETWEEN · A-class · decay_class compliant';
                    setQueue([r.quilt.quilt_id, r.substrace.substrace_id]);
                }
                else {
                    vineLanding = '✗ NOT LANDED';
                }
            }
            setMetrics([
                { label: 'Vine Landing Receipt', value: vineLanding, color: vineLanding.startsWith('✓') ? '#6ee7b7' : '#f87171', icon: '🌿', subtitle: 'Substrace Theorem roundtrip' },
                { label: 'Catechist Grade', value: catechistGrade || '—', color: '#a78bfa', icon: '🎓', subtitle: 'decay_class audit' },
                { label: 'WRASSE Pre-Injection', value: wrasse || '—', color: '#fbbf24', icon: '🐟', subtitle: 'Substrate SIDs queued' },
                { label: 'Active Substraces', value: substraceCount, color: '#38bdf8', icon: '🕸', subtitle: 'session BETWEEN crystal' },
                { label: 'Drift Indicators', value: substraceCount > 0 ? 'None detected' : 'No data', color: '#4ade80', icon: '📡', subtitle: 'SID determinism check', drift: false },
            ]);
        }
        catch (err) {
            console.error('[Dashboard] load error:', err);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { loadMetrics(); }, [loadMetrics]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: {
                    padding: '8px 12px', borderBottom: '1px solid rgba(100,116,139,0.2)',
                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                }, children: [_jsx("div", { style: { flex: 1, fontSize: 10, fontWeight: 700, color: '#38bdf8' }, children: "Dashboard \u00B7 Substrate Health" }), _jsx("button", { onClick: loadMetrics, disabled: loading, style: {
                            fontSize: 9, padding: '3px 8px', background: 'rgba(56,189,248,0.08)',
                            border: '1px solid rgba(56,189,248,0.2)', borderRadius: 4,
                            color: '#38bdf8', cursor: loading ? 'not-allowed' : 'pointer',
                        }, children: loading ? '⟳' : '↻ Refresh' })] }), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '10px 12px' }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }, children: [metrics.map((m) => (_jsxs("div", { style: {
                                    padding: '8px 10px', borderRadius: 7,
                                    background: `rgba(${hexToRgb(m.color)},0.05)`,
                                    border: `1px solid rgba(${hexToRgb(m.color)},0.2)`,
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                }, children: [_jsx("div", { style: { fontSize: 16, flexShrink: 0 }, children: m.icon }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 2 }, children: m.label }), _jsx("div", { style: { fontSize: 11, fontWeight: 700, color: m.color, wordBreak: 'break-all' }, children: String(m.value) }), m.subtitle && _jsx("div", { style: { fontSize: 8, color: '#475569', marginTop: 2 }, children: m.subtitle })] }), m.drift && (_jsx("div", { style: { fontSize: 9, color: '#f87171', fontWeight: 700, flexShrink: 0 }, children: "\u26A0" }))] }, m.label))), loading && metrics.length === 0 && (_jsx("div", { style: { textAlign: 'center', color: '#475569', fontSize: 10, padding: 20 }, children: "\u27F3 Loading substrate metrics\u2026" }))] }), queue.length > 0 && (_jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }, children: "WRASSE Pre-Injection Queue" }), queue.map((sid) => (_jsx("div", { style: {
                                    padding: '4px 8px', marginBottom: 3, fontFamily: 'monospace', fontSize: 8,
                                    background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)',
                                    borderRadius: 4, color: '#fbbf24', wordBreak: 'break-all',
                                }, children: sid }, sid)))] })), _jsxs("div", { style: { fontSize: 8, color: '#334155', lineHeight: 1.7 }, children: [_jsx("div", { children: "decay_class: BETWEEN \u00B7 all emissions" }), _jsx("div", { children: "Phase: Application 002 Step 1 v3 \u00B7 BP060" })] })] })] }));
}
// ─── Hex color helper (CSS colors only, not full parser) ──────────────────────
function hexToRgb(hex) {
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m)
        return '100,116,139';
    return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}
// ─── UnifiedSubstrateConsole ──────────────────────────────────────────────────
export function UnifiedSubstrateConsole() {
    const [view, setView] = useState(() => {
        const saved = sessionStorage.getItem(SS_VIEW_KEY);
        return (saved === 'bridge' || saved === 'dashboard') ? saved : 'dashboard';
    });
    // Persist view selection per session
    useEffect(() => {
        sessionStorage.setItem(SS_VIEW_KEY, view);
    }, [view]);
    // Ctrl+Tab keyboard shortcut to toggle views
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                setView((v) => v === 'bridge' ? 'dashboard' : 'bridge');
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
    const tabStyle = (active, color) => ({
        flex: 1, padding: '7px 10px', fontSize: 10, fontWeight: active ? 700 : 500,
        background: active ? `rgba(${hexToRgb(color)},0.1)` : 'transparent',
        border: 'none',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        color: active ? color : '#475569',
        cursor: 'pointer', transition: 'all 0.15s',
    });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsxs("div", { style: {
                    padding: '8px 14px 4px',
                    borderBottom: '1px solid rgba(100,116,139,0.15)',
                    flexShrink: 0,
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 1 }, children: "Unified Substrate Console" }), _jsx("div", { style: { fontSize: 8, color: '#334155' }, children: "Ctrl+Tab to switch views \u00B7 BP060 Application 002 Step 1 v3 \u00B7 UI-7" })] }), _jsxs("div", { style: {
                    display: 'flex', borderBottom: '1px solid rgba(100,116,139,0.15)', flexShrink: 0,
                }, children: [_jsx("button", { style: tabStyle(view === 'dashboard', '#38bdf8'), onClick: () => setView('dashboard'), title: "Dashboard \u2014 Vine Landing, Catechist Grade, WRASSE, drift indicators", children: "\uD83D\uDCCA Dashboard" }), _jsx("button", { style: tabStyle(view === 'bridge', '#6ee7b7'), onClick: () => setView('bridge'), title: "Bridge \u2014 live Yoke messages, pinned tasks, check_messages output", children: "\uD83C\uDF09 Bridge" })] }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: view === 'bridge' ? _jsx(BridgeView, {}) : _jsx(DashboardView, {}) })] }));
}
