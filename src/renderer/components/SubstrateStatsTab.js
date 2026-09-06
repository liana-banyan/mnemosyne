import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SubstrateStatsTab.tsx — BP081 Wave A SEG-A1
// Substrate stats dashboard: total eblets, verified count, last write, top domains,
// recent writes, SVG growth trend chart, quarantine warning.
// Auto-refreshes every 30s; manual Refresh button with loading feedback.
import { useState, useEffect, useCallback, useRef } from 'react';
// ─── Relative time helper ────────────────────────────────────────────────────
function relativeTime(ts) {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60)
        return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60)
        return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)
        return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
}
function fmtDate(iso) {
    // iso = YYYY-MM-DD
    const parts = iso.split('-');
    if (parts.length !== 3)
        return iso;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
// ─── Inline SVG growth chart ─────────────────────────────────────────────────
function GrowthChart({ data }) {
    const W = 420;
    const H = 80;
    const PAD_L = 28;
    const PAD_R = 8;
    const PAD_T = 8;
    const PAD_B = 20;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    if (data.length === 0)
        return null;
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    const points = data.map((d, i) => {
        const x = PAD_L + (i / (data.length - 1 || 1)) * chartW;
        const y = PAD_T + chartH - (d.count / maxCount) * chartH;
        return { x, y, ...d };
    });
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${(PAD_T + chartH).toFixed(1)} L${PAD_L},${(PAD_T + chartH).toFixed(1)} Z`;
    // X-axis labels: show every ~7th point
    const labelStep = Math.max(1, Math.floor(data.length / 5));
    const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);
    // Y-axis tick
    const yMid = PAD_T + chartH / 2;
    const midVal = Math.round(maxCount / 2);
    return (_jsxs("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { overflow: 'visible', display: 'block', maxWidth: '100%' }, "aria-label": "Growth trend chart", children: [_jsx("line", { x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: PAD_T + chartH, stroke: "rgba(100,116,139,0.2)", strokeWidth: "1" }), _jsx("line", { x1: PAD_L, y1: PAD_T + chartH, x2: PAD_L + chartW, y2: PAD_T + chartH, stroke: "rgba(100,116,139,0.2)", strokeWidth: "1" }), _jsx("line", { x1: PAD_L, y1: yMid, x2: PAD_L + chartW, y2: yMid, stroke: "rgba(100,116,139,0.1)", strokeWidth: "1", strokeDasharray: "3,3" }), _jsx("text", { x: PAD_L - 4, y: PAD_T + 4, textAnchor: "end", fontSize: "8", fill: "#475569", children: maxCount }), _jsx("text", { x: PAD_L - 4, y: yMid + 4, textAnchor: "end", fontSize: "8", fill: "#475569", children: midVal }), _jsx("text", { x: PAD_L - 4, y: PAD_T + chartH, textAnchor: "end", fontSize: "8", fill: "#475569", children: "0" }), _jsx("path", { d: areaD, fill: "rgba(110,231,183,0.08)" }), _jsx("path", { d: pathD, fill: "none", stroke: "#6ee7b7", strokeWidth: "1.5", strokeLinejoin: "round" }), xLabels.map((p) => (_jsx("text", { x: p.x, y: H - 4, textAnchor: "middle", fontSize: "7", fill: "#475569", children: fmtDate(p.date) }, p.date))), points.filter((p) => p.count > 0).map((p) => (_jsx("circle", { cx: p.x, cy: p.y, r: "2.5", fill: "#6ee7b7", opacity: "0.8", children: _jsxs("title", { children: [p.date, ": ", p.count] }) }, p.date)))] }));
}
// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, }) {
    return (_jsxs("div", { style: {
            background: 'rgba(15,23,42,0.6)',
            border: `1px solid ${accent ?? 'rgba(100,116,139,0.2)'}`,
            borderRadius: 8,
            padding: '12px 16px',
            minWidth: 110,
            flex: '1 1 110px',
        }, children: [_jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: label }), _jsx("div", { style: { fontSize: 22, fontWeight: 700, color: accent ?? '#e2e8f0', lineHeight: 1 }, children: value }), sub && (_jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 4 }, children: sub }))] }));
}
// ─── Main component ───────────────────────────────────────────────────────────
export function SubstrateStatsTab() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const intervalRef = useRef(null);
    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.amplify?.getSubstrateStats?.();
            if (result) {
                setStats(result);
                setLastRefreshed(Date.now());
            }
        }
        catch (e) {
            console.error('[SubstrateStatsTab] fetch failed:', e);
        }
        finally {
            setLoading(false);
        }
    }, []);
    // Initial fetch + 30s auto-refresh when tab is visible
    useEffect(() => {
        void fetchStats();
        intervalRef.current = setInterval(() => {
            if (document.visibilityState !== 'hidden') {
                void fetchStats();
            }
        }, 30000);
        return () => {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
        };
    }, [fetchStats]);
    const verifiedPct = stats && stats.totalEblets > 0
        ? Math.round((stats.verifiedCount / stats.totalEblets) * 100)
        : 0;
    const isEmpty = stats !== null && stats.totalEblets === 0;
    return (_jsxs("div", { style: {
            padding: '16px 20px',
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxSizing: 'border-box',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' }, children: "\uD83D\uDCCA Substrate Stats" }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 2 }, children: lastRefreshed ? `Refreshed ${relativeTime(lastRefreshed)}` : 'Loading…' })] }), _jsxs("button", { type: "button", onClick: () => void fetchStats(), disabled: loading, style: {
                            padding: '5px 12px',
                            background: loading ? 'rgba(100,116,139,0.08)' : 'rgba(110,231,183,0.1)',
                            border: `1px solid ${loading ? 'rgba(100,116,139,0.2)' : 'rgba(110,231,183,0.3)'}`,
                            borderRadius: 6,
                            color: loading ? '#475569' : '#6ee7b7',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                        }, "aria-label": loading ? 'Refreshing stats…' : 'Refresh substrate stats', title: "Refresh substrate stats", children: [_jsx("span", { style: { display: 'inline-block', animation: loading ? 'mnemo-spin 0.8s linear infinite' : 'none' }, children: "\uD83D\uDD04" }), loading ? 'Refreshing…' : 'Refresh'] })] }), stats === null && loading && (_jsx("div", { style: { color: '#475569', fontSize: 12, textAlign: 'center', padding: '32px 0' }, children: "Loading substrate stats\u2026" })), stats?.error && (_jsxs("div", { style: {
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11,
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }, children: [_jsx("span", { children: "\u26A0\uFE0F" }), _jsx("span", { children: stats.error }), _jsx("button", { type: "button", onClick: () => console.log('[SubstrateStatsTab] diagnostics:', stats), style: {
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            color: '#fbbf24',
                            fontSize: 10,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                        }, children: "View diagnostics" })] })), stats && stats.quarantinedCount > 0 && (_jsxs("div", { style: {
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11,
                    color: '#f87171',
                }, children: ["\uD83D\uDEA8 ", stats.quarantinedCount, " quarantined eblet", stats.quarantinedCount !== 1 ? 's' : '', " \u2014 review in Console tab"] })), isEmpty && (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '48px 0',
                    textAlign: 'center',
                }, children: [_jsx("span", { style: { fontSize: 36 }, children: "\uD83C\uDF31" }), _jsx("div", { style: { fontSize: 14, fontWeight: 600, color: '#e2e8f0' }, children: "Your substrate is empty" }), _jsxs("div", { style: { fontSize: 11, color: '#64748b', maxWidth: 260, lineHeight: 1.6 }, children: ["Use ", _jsx("strong", { style: { color: '#6ee7b7' }, children: "Ask" }), " or", ' ', _jsx("strong", { style: { color: '#6ee7b7' }, children: "Test It Out" }), " to grow it."] })] })), stats && stats.totalEblets > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx(StatCard, { label: "Total Eblets", value: stats.totalEblets.toLocaleString(), accent: "rgba(110,231,183,0.35)" }), _jsx(StatCard, { label: "Verified Correct", value: stats.verifiedCount.toLocaleString(), sub: `${verifiedPct}% of total`, accent: "rgba(74,222,128,0.3)" }), _jsx(StatCard, { label: "Last Write", value: stats.lastWriteTimestamp ? relativeTime(stats.lastWriteTimestamp) : '—', accent: "rgba(148,163,184,0.2)" })] }), stats.growthTrend.length > 0 && stats.growthTrend.some((d) => d.count > 0) && (_jsxs("div", { style: {
                            background: 'rgba(15,23,42,0.6)',
                            border: '1px solid rgba(100,116,139,0.15)',
                            borderRadius: 8,
                            padding: '12px 16px',
                        }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }, children: "Growth (last 30 days)" }), _jsx(GrowthChart, { data: stats.growthTrend })] })), stats.topDomains.length > 0 && (_jsxs("div", { style: {
                            background: 'rgba(15,23,42,0.6)',
                            border: '1px solid rgba(100,116,139,0.15)',
                            borderRadius: 8,
                            padding: '12px 16px',
                        }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }, children: "Top Sources" }), _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 11 }, children: [_jsx("thead", { children: _jsx("tr", { children: ['Source', 'Count', 'Last write'].map((h) => (_jsx("th", { style: {
                                                    textAlign: 'left',
                                                    color: '#475569',
                                                    fontWeight: 600,
                                                    paddingBottom: 6,
                                                    borderBottom: '1px solid rgba(100,116,139,0.15)',
                                                    paddingRight: 12,
                                                }, children: h }, h))) }) }), _jsx("tbody", { children: stats.topDomains.map((d, i) => (_jsxs("tr", { children: [_jsx("td", { style: {
                                                        padding: '5px 12px 5px 0',
                                                        color: '#e2e8f0',
                                                        borderBottom: i < stats.topDomains.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                                                    }, children: d.domain }), _jsx("td", { style: {
                                                        padding: '5px 12px 5px 0',
                                                        color: '#6ee7b7',
                                                        fontWeight: 600,
                                                        borderBottom: i < stats.topDomains.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                                                    }, children: d.count }), _jsx("td", { style: {
                                                        padding: '5px 0',
                                                        color: '#64748b',
                                                        borderBottom: i < stats.topDomains.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                                                    }, children: relativeTime(d.lastWrite) })] }, d.domain))) })] })] })), stats.recentWrites.length > 0 && (_jsxs("div", { style: {
                            background: 'rgba(15,23,42,0.6)',
                            border: '1px solid rgba(100,116,139,0.15)',
                            borderRadius: 8,
                            padding: '12px 16px',
                        }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }, children: "Recent Writes" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: stats.recentWrites.map((w, i) => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 10,
                                        paddingBottom: 6,
                                        borderBottom: i < stats.recentWrites.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                                    }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: {
                                                        fontSize: 11,
                                                        color: '#cbd5e1',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }, title: w.questionExcerpt, children: w.questionExcerpt }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2 }, children: w.provenanceSource })] }), _jsx("div", { style: { fontSize: 9, color: '#475569', flexShrink: 0, paddingTop: 2 }, children: relativeTime(w.timestamp) })] }, i))) })] }))] }))] }));
}
