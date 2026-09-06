import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Banyan Metric™ Ledger Viewer — MnemosyneC™ v0.1.8 · SEG-FT-6 · BP052 NOVACULA
// Session ledger · composite scores · trend · color-coded health
import { useState, useEffect, useCallback } from 'react';
const MOCK_LEDGER = [
    { session: 'K487', timestamp: '2026-05-22T14:00:00Z', substrate_score: 91.2, semantic_score: 93.4, pattern_score: 89.7, composite_score: 91.4, delta_vs_prior: +1.3 },
    { session: 'K486', timestamp: '2026-05-21T18:30:00Z', substrate_score: 89.5, semantic_score: 91.8, pattern_score: 88.2, composite_score: 90.1, delta_vs_prior: +0.8 },
    { session: 'K485', timestamp: '2026-05-21T10:15:00Z', substrate_score: 88.7, semantic_score: 90.4, pattern_score: 87.6, composite_score: 89.3, delta_vs_prior: +1.4 },
    { session: 'K484', timestamp: '2026-05-20T16:45:00Z', substrate_score: 87.2, semantic_score: 89.0, pattern_score: 86.4, composite_score: 87.9, delta_vs_prior: -0.4 },
    { session: 'K483', timestamp: '2026-05-20T09:00:00Z', substrate_score: 88.1, semantic_score: 89.6, pattern_score: 87.0, composite_score: 88.3, delta_vs_prior: +2.1 },
    { session: 'K482', timestamp: '2026-05-19T17:30:00Z', substrate_score: 85.7, semantic_score: 87.4, pattern_score: 85.1, composite_score: 86.2, delta_vs_prior: +0.6 },
    { session: 'K481', timestamp: '2026-05-19T11:00:00Z', substrate_score: 84.9, semantic_score: 86.8, pattern_score: 84.5, composite_score: 85.6, delta_vs_prior: +1.2 },
    { session: 'K480', timestamp: '2026-05-18T14:00:00Z', substrate_score: 83.7, semantic_score: 85.2, pattern_score: 83.1, composite_score: 84.4, delta_vs_prior: null },
];
function scoreClass(score) {
    if (score >= 90)
        return { color: '#22c55e', label: 'EXCELLENT' };
    if (score >= 70)
        return { color: '#f59e0b', label: 'GOOD' };
    return { color: '#f87171', label: 'NEEDS WORK' };
}
function deltaSymbol(delta) {
    if (delta === null)
        return '—';
    if (delta > 0)
        return `↑ +${delta.toFixed(1)}`;
    if (delta < 0)
        return `↓ ${delta.toFixed(1)}`;
    return `→ 0.0`;
}
function deltaColor(delta) {
    if (delta === null)
        return '#475569';
    if (delta > 0)
        return '#22c55e';
    if (delta < 0)
        return '#f87171';
    return '#64748b';
}
export function BanyanMetricLedger() {
    const [rows, setRows] = useState([]);
    const [hasLiveData, setHasLiveData] = useState(false);
    const load = useCallback(async () => {
        try {
            const result = await window.amplify?.caiCore?.getBanyanMetricLedger?.();
            if (result && result.length > 0) {
                setRows(result);
                setHasLiveData(true);
            }
            else {
                setRows(MOCK_LEDGER);
            }
        }
        catch {
            setRows(MOCK_LEDGER);
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const latest = rows[0] ?? null;
    const latestClass = latest ? scoreClass(latest.composite_score) : null;
    const trend = rows.length >= 2
        ? (rows[0].composite_score > rows[1].composite_score ? '↑' : rows[0].composite_score < rows[1].composite_score ? '↓' : '→')
        : '→';
    return (_jsxs("div", { style: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0' }, children: "Banyan Metric\u2122 Ledger" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 1 }, children: hasLiveData ? `● Live · ${rows.length} sessions` : `○ Mock data · ${rows.length} sessions` })] }), latest && latestClass && (_jsxs("div", { style: {
                    background: `${latestClass.color}0a`,
                    border: `1px solid ${latestClass.color}25`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 9, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Current Composite" }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [_jsx("span", { style: { fontSize: 32, fontWeight: 800, color: latestClass.color, lineHeight: 1 }, children: latest.composite_score.toFixed(1) }), _jsx("span", { style: { fontSize: 14, color: latestClass.color }, children: trend })] }), _jsx("div", { style: { fontSize: 8, color: latestClass.color, marginTop: 2, fontWeight: 700 }, children: latestClass.label })] }), _jsxs("div", { style: { textAlign: 'right' }, children: [_jsxs("div", { style: { fontSize: 9, color: '#64748b', marginBottom: 6 }, children: ["Sessions tracked: ", rows.length] }), _jsxs("div", { style: { fontSize: 9, color: '#64748b' }, children: [_jsxs("div", { children: ["Substrate: ", _jsx("span", { style: { color: '#e2e8f0' }, children: latest.substrate_score.toFixed(1) })] }), _jsxs("div", { children: ["Semantic: ", _jsx("span", { style: { color: '#e2e8f0' }, children: latest.semantic_score.toFixed(1) })] }), _jsxs("div", { children: ["Pattern: ", _jsx("span", { style: { color: '#e2e8f0' }, children: latest.pattern_score.toFixed(1) })] })] })] })] })), rows.length > 1 && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }, children: "Composite Trend" }), _jsx("div", { style: { display: 'flex', gap: 2, alignItems: 'flex-end', height: 32 }, children: [...rows].reverse().map((row, i) => {
                            const cls = scoreClass(row.composite_score);
                            const pct = Math.max(10, (row.composite_score - 70) / 30 * 100);
                            return (_jsx("div", { title: `${row.session}: ${row.composite_score.toFixed(1)}`, style: { flex: 1, height: `${pct}%`, background: cls.color, borderRadius: '2px 2px 0 0', opacity: 0.7 + (i / rows.length) * 0.3, minWidth: 8 } }, i));
                        }) })] })), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }, children: "Session Ledger" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr 60px', gap: '0 6px', marginBottom: 4, padding: '0 6px' }, children: ['Session', 'Substrate', 'Semantic', 'Pattern', 'Composite', 'Δ Prior'].map((h) => (_jsx("div", { style: { fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }, children: h }, h))) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: rows.map((row, i) => {
                            const cls = scoreClass(row.composite_score);
                            return (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr 60px', gap: '0 6px', background: i === 0 ? `${cls.color}06` : 'rgba(15,23,42,0.4)', border: `1px solid ${i === 0 ? cls.color + '20' : 'rgba(100,116,139,0.08)'}`, borderRadius: 5, padding: '5px 6px', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 10, fontWeight: 600, color: '#e2e8f0' }, children: row.session }), _jsx("span", { style: { fontSize: 9, color: '#94a3b8' }, children: row.substrate_score.toFixed(1) }), _jsx("span", { style: { fontSize: 9, color: '#94a3b8' }, children: row.semantic_score.toFixed(1) }), _jsx("span", { style: { fontSize: 9, color: '#94a3b8' }, children: row.pattern_score.toFixed(1) }), _jsx("span", { style: { fontSize: 9, fontWeight: 700, color: cls.color }, children: row.composite_score.toFixed(1) }), _jsx("span", { style: { fontSize: 9, fontWeight: 600, color: deltaColor(row.delta_vs_prior) }, children: deltaSymbol(row.delta_vs_prior) })] }, i));
                        }) })] })] }));
}
