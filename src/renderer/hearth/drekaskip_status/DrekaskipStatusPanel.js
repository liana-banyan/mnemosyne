import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// B83c — Drekaskip Wave Status Panel
// Live readout of current Drekaskip saga + wave instance count
// B61A commit 42ecdcd — Wave Generator LANDED, 12/12 G-gates PASS
// BP041 Layer 4: Adaptive Concurrency Carrier hot-tune controls added
import { useState, useEffect, useCallback } from 'react';
import { sagaSubscription } from './saga_subscription';
import { DEFAULT_SAGA_STATE } from './saga_subscription';
function formatMinutesAgo(isoTs) {
    if (!isoTs)
        return 'never';
    const diffMs = Date.now() - new Date(isoTs).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)
        return 'just now';
    if (diffMin === 1)
        return '1 min ago';
    if (diffMin < 60)
        return `${diffMin} min ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
}
export function DrekaskipStatusPanel() {
    const [state, setState] = useState(DEFAULT_SAGA_STATE);
    const [selected, setSelected] = useState(null);
    // Layer 4: concurrency cap hot-tune state
    const [capInfo, setCapInfo] = useState(null);
    const [probing, setProbing] = useState(false);
    const [overrideVal, setOverrideVal] = useState(16);
    const [overrideOn, setOverrideOn] = useState(false);
    useEffect(() => {
        const unsub = sagaSubscription.subscribe(setState);
        return unsub;
    }, []);
    // Poll cap info on mount + every 30s
    const fetchCapInfo = useCallback(async () => {
        try {
            const info = await window.amplify.concurrencyGetCap?.();
            if (info) {
                setCapInfo(info);
                if (info.override !== null) {
                    setOverrideVal(info.override);
                    setOverrideOn(true);
                }
            }
        }
        catch { /* non-fatal */ }
    }, []);
    useEffect(() => {
        fetchCapInfo();
        const timer = setInterval(fetchCapInfo, 30000);
        return () => clearInterval(timer);
    }, [fetchCapInfo]);
    const handleReprobe = useCallback(async () => {
        setProbing(true);
        try {
            const result = await window.amplify.concurrencyProbeNow?.();
            if (result) {
                setCapInfo((prev) => prev ? { ...prev, cap: result.cap, probed_at: result.probed_at, is_stale: false } : null);
            }
        }
        catch { /* non-fatal */ }
        setProbing(false);
    }, []);
    const handleOverrideToggle = useCallback(async (enabled) => {
        setOverrideOn(enabled);
        const n = enabled ? overrideVal : null;
        try {
            await window.amplify.concurrencySetOverride?.(n);
            setCapInfo((prev) => prev ? { ...prev, override: n, cap: n ?? (prev.cap) } : null);
        }
        catch { /* non-fatal */ }
    }, [overrideVal]);
    const handleOverrideChange = useCallback(async (n) => {
        setOverrideVal(n);
        if (overrideOn) {
            try {
                await window.amplify.concurrencySetOverride?.(n);
                setCapInfo((prev) => prev ? { ...prev, override: n, cap: n } : null);
            }
            catch { /* non-fatal */ }
        }
    }, [overrideOn]);
    const complete = state.wave_instances.filter((w) => w.status === 'complete').length;
    const inflight = state.wave_instances.filter((w) => w.status === 'in_flight').length;
    const errored = state.wave_instances.filter((w) => w.status === 'error').length;
    const recent = state.wave_instances.slice(0, 5);
    function statusColor(status) {
        return status === 'complete' ? '#22c55e' : status === 'in_flight' ? '#f6ad55' : '#ef4444';
    }
    return (_jsxs("div", { style: styles.panel, children: [_jsxs("div", { style: styles.header, children: [_jsx("span", { style: styles.logo, children: "\uD83C\uDF0A" }), _jsx("span", { style: styles.title, children: "Drekaskip" }), state.loading && _jsx("span", { style: styles.loading, children: "polling\u2026" })] }), _jsxs("div", { style: styles.sagaRow, children: [_jsx("span", { style: styles.sagaLabel, children: "Saga:" }), _jsx("span", { style: styles.sagaName, children: state.active_saga ?? '—' })] }), _jsxs("div", { style: styles.counters, children: [_jsxs("div", { style: styles.counter, children: [_jsx("span", { style: styles.counterNum, children: state.wave_count }), _jsx("span", { style: styles.counterLabel, children: "total waves" })] }), _jsxs("div", { style: styles.counter, children: [_jsx("span", { style: { ...styles.counterNum, color: '#f6ad55' }, children: inflight }), _jsx("span", { style: styles.counterLabel, children: "in-flight" })] }), _jsxs("div", { style: styles.counter, children: [_jsx("span", { style: { ...styles.counterNum, color: '#22c55e' }, children: complete }), _jsx("span", { style: styles.counterLabel, children: "complete" })] }), errored > 0 && (_jsxs("div", { style: styles.counter, children: [_jsx("span", { style: { ...styles.counterNum, color: '#ef4444' }, children: errored }), _jsx("span", { style: styles.counterLabel, children: "errors" })] }))] }), recent.length > 0 && (_jsx("div", { style: styles.timeline, children: recent.map((w) => (_jsxs("button", { style: styles.waveEntry, onClick: () => setSelected(selected?.id === w.id ? null : w), title: `Wave ${w.id.slice(0, 8)}… — ${w.status}`, children: [_jsx("span", { style: { ...styles.waveDot, background: statusColor(w.status) } }), _jsxs("span", { style: styles.waveId, children: [w.id.slice(0, 8), "\u2026"] }), _jsx("span", { style: styles.waveStatus, children: w.status })] }, w.id))) })), selected && (_jsxs("div", { style: styles.drawer, children: [_jsxs("div", { style: styles.drawerHeader, children: ["Wave ", selected.id, _jsx("button", { style: styles.closeBtn, onClick: () => setSelected(null), children: "\u2715" })] }), _jsxs("div", { style: styles.drawerRow, children: [_jsx("b", { children: "Saga:" }), " ", selected.saga] }), _jsxs("div", { style: styles.drawerRow, children: [_jsx("b", { children: "Status:" }), " ", selected.status] }), _jsxs("div", { style: styles.drawerRow, children: [_jsx("b", { children: "Started:" }), " ", new Date(selected.started_at).toLocaleTimeString()] }), selected.completed_at && (_jsxs("div", { style: styles.drawerRow, children: [_jsx("b", { children: "Completed:" }), " ", new Date(selected.completed_at).toLocaleTimeString()] }))] })), state.error && (_jsxs("div", { style: styles.error, children: ["\u26A0 ", state.error.slice(0, 80)] })), _jsxs("div", { style: styles.capSection, children: [_jsxs("div", { style: styles.capRow, children: [_jsx("span", { style: styles.capLabel, children: "\u26A1 Concurrency cap:" }), _jsxs("span", { style: {
                                    ...styles.capValue,
                                    color: capInfo?.override !== null ? '#f6ad55' : '#68d391',
                                }, children: [capInfo ? capInfo.cap : '…', capInfo?.override !== null && _jsx("span", { style: styles.capOverrideTag, children: " (override)" })] }), _jsxs("span", { style: { ...styles.capStale, color: capInfo?.is_stale ? '#ef4444' : '#4a5568' }, children: ["\u00B7 ", formatMinutesAgo(capInfo?.probed_at ?? null)] })] }), _jsx("div", { style: styles.capControls, children: _jsx("button", { style: { ...styles.reprobe, opacity: probing ? 0.5 : 1 }, onClick: handleReprobe, disabled: probing, title: "Fire fresh concurrency probe \u2014 updates cap live", children: probing ? '⏳ Probing…' : '🔬 Re-probe now' }) }), _jsxs("div", { style: styles.overrideRow, children: [_jsxs("label", { style: styles.overrideLabel, children: [_jsx("input", { type: "checkbox", checked: overrideOn, onChange: (e) => handleOverrideToggle(e.target.checked), style: { marginRight: '0.3rem' } }), "Force cap:"] }), _jsx("input", { type: "range", min: 1, max: 64, value: overrideVal, disabled: !overrideOn, onChange: (e) => handleOverrideChange(Number(e.target.value)), style: { flex: 1, opacity: overrideOn ? 1 : 0.35 } }), _jsx("span", { style: styles.overrideNum, children: overrideVal })] })] }), _jsxs("div", { style: styles.footer, children: ["B61A \u00B7 12/12 G-gates \u00B7 ", state.last_queried ? `polled ${new Date(state.last_queried).toLocaleTimeString()}` : 'awaiting first poll'] })] }));
}
const styles = {
    panel: {
        background: '#0d1117',
        color: '#e2e8f0',
        borderRadius: '8px',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        border: '1px solid #2d3748',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
    },
    header: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
    logo: { fontSize: '1rem' },
    title: { fontWeight: 700, fontSize: '0.85rem', color: '#63b3ed' },
    loading: { marginLeft: 'auto', fontSize: '0.65rem', color: '#718096' },
    sagaRow: { display: 'flex', gap: '0.4rem', alignItems: 'baseline' },
    sagaLabel: { fontSize: '0.7rem', color: '#718096' },
    sagaName: { fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600 },
    counters: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
    counter: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    counterNum: { fontSize: '1.2rem', fontWeight: 700, lineHeight: 1 },
    counterLabel: { fontSize: '0.6rem', color: '#718096' },
    timeline: { display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, overflow: 'auto' },
    waveEntry: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.25rem 0.4rem',
        background: '#1a1a2e',
        border: '1px solid #2d3748',
        borderRadius: '4px',
        cursor: 'pointer',
        color: '#e2e8f0',
        textAlign: 'left',
    },
    waveDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
    waveId: { fontSize: '0.7rem', fontFamily: 'monospace', flex: 1 },
    waveStatus: { fontSize: '0.65rem', color: '#718096' },
    drawer: {
        background: '#1a1a2e',
        border: '1px solid #4a5568',
        borderRadius: '6px',
        padding: '0.5rem',
        fontSize: '0.75rem',
    },
    drawerHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: 700,
        marginBottom: '0.3rem',
        wordBreak: 'break-all',
    },
    drawerRow: { marginBottom: '0.2rem' },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#718096',
        cursor: 'pointer',
        fontSize: '0.8rem',
        flexShrink: 0,
    },
    error: { color: '#ef4444', fontSize: '0.7rem' },
    footer: { fontSize: '0.6rem', color: '#4a5568', marginTop: 'auto' },
    // ── Layer 4: Concurrency Cap section ─────────────────────────────────────
    capSection: {
        borderTop: '1px solid #2d3748',
        paddingTop: '0.4rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    capRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.3rem',
    },
    capLabel: { fontSize: '0.65rem', color: '#718096' },
    capValue: { fontSize: '0.78rem', fontWeight: 700 },
    capOverrideTag: { fontSize: '0.6rem', color: '#f6ad55', fontStyle: 'italic' },
    capStale: { fontSize: '0.6rem' },
    capControls: { display: 'flex' },
    reprobe: {
        background: '#1a1a2e',
        border: '1px solid #2d3748',
        borderRadius: '4px',
        color: '#63b3ed',
        fontSize: '0.65rem',
        padding: '0.2rem 0.45rem',
        cursor: 'pointer',
        fontWeight: 600,
    },
    overrideRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
    },
    overrideLabel: {
        fontSize: '0.65rem',
        color: '#718096',
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
    },
    overrideNum: {
        fontSize: '0.65rem',
        color: '#f6ad55',
        fontWeight: 700,
        minWidth: '1.6rem',
        textAlign: 'right',
    },
};
