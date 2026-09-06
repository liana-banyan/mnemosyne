import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BP067 canonical static evidence -- pearl_88a8c069
export const CANONICAL_STATIC = {
    isStatic: true,
    accuracy: 1.0,
    hashVerified: 20,
    totalQuestions: 20,
    p50LatencyMs: 16.6,
};
const cell = {
    flex: 1,
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 10,
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
};
const cellHighlight = {
    ...cell,
    border: '1px solid rgba(110,231,183,0.35)',
    background: 'rgba(6,78,59,0.2)',
};
const label = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 4,
};
const valueStyle = {
    fontSize: 26,
    fontWeight: 700,
    color: '#f1f5f9',
    lineHeight: 1.2,
};
const subValue = {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
};
const badge = {
    display: 'inline-block',
    background: 'rgba(110,231,183,0.15)',
    color: '#6ee7b7',
    border: '1px solid rgba(110,231,183,0.3)',
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
};
export function NetworkValueReveal({ data }) {
    const accuracyPct = Math.round(data.accuracy * 100);
    const latencyDisplay = data.p50LatencyMs < 1 ? '<1' : data.p50LatencyMs.toFixed(1);
    return (_jsxs("div", { style: { width: '100%' }, children: [data.isStatic && (_jsxs("div", { style: {
                    fontSize: 11,
                    color: '#64748b',
                    marginBottom: 12,
                    padding: '6px 10px',
                    background: 'rgba(100,116,139,0.08)',
                    borderRadius: 6,
                    border: '1px solid rgba(100,116,139,0.15)',
                }, children: ["Previously-recorded results from our verified benchmark run", ' ', _jsx("span", { style: { color: '#4b5563' }, children: "(pearl_88a8c069)" })] })), _jsxs("div", { style: { display: 'flex', gap: 12 }, children: [_jsxs("div", { style: cell, children: [_jsx("div", { style: label, children: "Caithedral Alone" }), _jsxs("div", { children: [_jsx("div", { style: { ...valueStyle, color: '#94a3b8' }, children: "~60%" }), _jsx("div", { style: subValue, children: "local substrate only" })] }), _jsxs("div", { children: [_jsx("div", { style: { ...valueStyle, fontSize: 18, color: '#94a3b8' }, children: "N/A" }), _jsx("div", { style: subValue, children: "no peer verification" })] }), _jsxs("div", { children: [_jsx("div", { style: { ...valueStyle, fontSize: 18, color: '#94a3b8' }, children: "varies" }), _jsx("div", { style: subValue, children: "latency p50" })] })] }), _jsxs("div", { style: cellHighlight, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: label, children: "Yoked AI" }), _jsx("span", { style: badge, children: "MESH" })] }), _jsxs("div", { children: [_jsxs("div", { style: valueStyle, children: [accuracyPct, "%"] }), _jsxs("div", { style: subValue, children: ["accuracy (", data.totalQuestions, " questions)"] })] }), _jsxs("div", { children: [_jsxs("div", { style: { ...valueStyle, color: '#6ee7b7' }, children: [data.hashVerified, "/", data.totalQuestions] }), _jsx("div", { style: subValue, children: "hash-verified peer answers" })] }), _jsxs("div", { children: [_jsxs("div", { style: { ...valueStyle, color: '#6ee7b7' }, children: [latencyDisplay, "ms"] }), _jsxs("div", { style: subValue, children: ["fetch latency p50", data.p95LatencyMs !== undefined && ` (p95: ${data.p95LatencyMs.toFixed(1)}ms)`] })] })] })] })] }));
}
