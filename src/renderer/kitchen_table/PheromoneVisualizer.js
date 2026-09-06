import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Pheromone Visualizer — MnemosyneC™ v0.1.8 · SEG-FT-6 · BP052 NOVACULA
// Trail heat map · access frequency · auto-refresh every 10s
//
// KN-BP143-3 D4: this file used to fall back to a 20-entry MOCK_TRAILS array (fabricated
// subjects, access counts, timestamps, and scores) whenever caiCore.getPheromoneTrails() was
// unavailable or empty, rendering a fully-populated heat map + trail registry that looked like
// real telemetry. Cut, not wired: no engine call anywhere in this codebase currently returns
// per-trail pheromone data, so there is nothing real to fill the grid with. When there is no live
// data, the grid renders its existing honest empty state below instead.
import { useState, useEffect, useCallback } from 'react';
function heatColor(score) {
    const r = Math.round(255 * score);
    const g = Math.round(80 * (1 - score));
    const b = Math.round(200 * (1 - score * 0.8));
    return `rgb(${r},${g},${b})`;
}
function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000)
        return 'just now';
    if (diff < 3600000)
        return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000)
        return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}
export function PheromoneVisualizer() {
    const [trails, setTrails] = useState([]);
    const [hasLiveData, setHasLiveData] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const load = useCallback(async () => {
        try {
            const result = await window.amplify?.caiCore?.getPheromoneTrails?.();
            if (result && result.length > 0) {
                setTrails(result);
                setHasLiveData(true);
            }
            else {
                setTrails([]);
                setHasLiveData(false);
            }
        }
        catch {
            setTrails([]);
            setHasLiveData(false);
        }
        setLastRefresh(new Date());
    }, []);
    useEffect(() => {
        void load();
        const id = setInterval(() => { void load(); }, 10000);
        return () => clearInterval(id);
    }, [load]);
    const sorted = [...trails].sort((a, b) => b.score - a.score);
    const gridItems = sorted.slice(0, 100);
    const maxScore = Math.max(...trails.map((t) => t.score), 0.01);
    return (_jsxs("div", { style: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0' }, children: "Pheromone Visualizer" }), _jsxs("div", { style: { fontSize: 9, color: '#475569', marginTop: 1 }, children: [hasLiveData ? '● Live trails' : '○ No trail data yet', " \u00B7 auto-refresh 10s \u00B7 last: ", lastRefresh.toLocaleTimeString()] })] }), _jsx("button", { onClick: () => void load(), style: { padding: '3px 8px', fontSize: 9, cursor: 'pointer', border: '1px solid rgba(100,116,139,0.2)', background: 'transparent', color: '#64748b', borderRadius: 5 }, children: "\u21BB Refresh" })] }), hasLiveData ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }, children: "Trail Heat Map" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }, children: [gridItems.map((trail, i) => (_jsx("div", { title: `${trail.subject}\nAccess: ${trail.accessCount}\nScore: ${(trail.score * 100).toFixed(0)}%`, style: {
                                            height: 20,
                                            borderRadius: 3,
                                            background: heatColor(trail.score / maxScore),
                                            opacity: 0.7 + (trail.score / maxScore) * 0.3,
                                            cursor: 'default',
                                            transition: 'opacity 0.2s',
                                        } }, i))), Array.from({ length: Math.max(0, 100 - gridItems.length) }).map((_, i) => (_jsx("div", { style: { height: 20, borderRadius: 3, background: 'rgba(100,116,139,0.06)' } }, `empty-${i}`)))] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 }, children: [_jsx("span", { style: { fontSize: 8, color: '#334155' }, children: "cool (low access)" }), _jsx("span", { style: { fontSize: 8, color: '#334155' }, children: "hot (high access)" })] })] }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }, children: ["Trail Registry (", trails.length, ")"] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 3 }, children: sorted.slice(0, 12).map((trail, i) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(100,116,139,0.08)', borderRadius: 5 }, children: [_jsx("div", { style: { width: 6, height: 6, borderRadius: '50%', background: heatColor(trail.score / maxScore), flexShrink: 0 } }), _jsx("div", { style: { flex: 1, fontSize: 9, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: trail.subject }), _jsxs("div", { style: { flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsxs("span", { style: { fontSize: 9, color: '#475569' }, children: [trail.accessCount, "\u00D7"] }), _jsx("span", { style: { fontSize: 8, color: '#334155' }, children: relTime(trail.lastAccessed) }), _jsxs("span", { style: { fontSize: 8, fontWeight: 700, color: trail.score >= 0.8 ? '#22c55e' : trail.score >= 0.5 ? '#f59e0b' : '#64748b' }, children: [(trail.score * 100).toFixed(0), "%"] })] })] }, i))) })] })] })) : (_jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6, padding: '20px 0', textAlign: 'center' }, children: "Not yet tracked -- no engine call anywhere in this codebase returns per-trail pheromone data today. Honestly empty, not a fabricated heat map (KN-BP143-3 D4)." }))] }));
}
