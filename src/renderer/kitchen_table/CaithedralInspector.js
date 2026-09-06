import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Caithedral™ Retrieval Inspector — MnemosyneC™ v0.1.8 · SEG-FT-5 · BP052 NOVACULA
// Displays retrieval log · test query · source scribe filter · score histogram
import { useState, useEffect, useCallback } from 'react';
const MOCK_ENTRIES = [
    { timestamp: new Date(Date.now() - 300000).toISOString(), query: 'Kitchen Table meal planning', sourceScribe: 'KnightQueue', score: 0.94, resultSnippet: 'Family meal coordination via cooperative Kitchen Table™ module…' },
    { timestamp: new Date(Date.now() - 900000).toISOString(), query: 'Atlas™ scheduling conflict resolution', sourceScribe: 'KnightArchitecture', score: 0.88, resultSnippet: 'Multi-participant scheduling with availability juggling visualization…' },
    { timestamp: new Date(Date.now() - 1800000).toISOString(), query: 'Banyan Metric™ composite score', sourceScribe: 'KnightBRIDLEMemory', score: 0.91, resultSnippet: 'BP052 NOVACULA v0.1.8 wave target composite score 89.4…' },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), query: 'P2P discovery peer expiry', sourceScribe: 'KnightQueue', score: 0.76, resultSnippet: 'UDP multicast beacon expiry at 90s, peer map cleanup on 15s interval…' },
    { timestamp: new Date(Date.now() - 7200000).toISOString(), query: 'Recipe™ AI-assist fallback', sourceScribe: 'KnightHandoffs', score: 0.82, resultSnippet: 'Graceful fallback when window.amplify.ai unavailable — silent no-op…' },
];
const ALL_SCRIBES = ['All', 'KnightQueue', 'KnightArchitecture', 'KnightBRIDLEMemory', 'KnightHandoffs'];
function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000)
        return 'just now';
    if (diff < 3600000)
        return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
}
function scoreColor(score) {
    if (score >= 0.9)
        return '#22c55e';
    if (score >= 0.75)
        return '#f59e0b';
    return '#f87171';
}
export function CaithedralInspector() {
    const [entries, setEntries] = useState([]);
    const [scribeFilter, setScribeFilter] = useState('All');
    const [testQuery, setTestQuery] = useState('');
    const [querying, setQuerying] = useState(false);
    const [hasLiveData, setHasLiveData] = useState(false);
    const load = useCallback(async () => {
        try {
            const result = await window.amplify?.caiCore?.getRetrievalLog?.();
            if (result && result.length > 0) {
                setEntries(result);
                setHasLiveData(true);
            }
            else {
                setEntries(MOCK_ENTRIES);
            }
        }
        catch {
            setEntries(MOCK_ENTRIES);
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    async function handleTestQuery() {
        if (!testQuery.trim())
            return;
        setQuerying(true);
        try {
            const result = await window.amplify?.caiCore?.query?.({ query: testQuery });
            const entry = {
                timestamp: new Date().toISOString(),
                query: testQuery,
                sourceScribe: result?.scribe ?? 'live',
                score: result?.score ?? 0,
                resultSnippet: result?.snippet ?? '(no result)',
            };
            setEntries((prev) => [entry, ...prev]);
            setHasLiveData(true);
        }
        catch {
            // KN-BP143-3 D4: this used to fabricate a fake confidence score (Math.random() * 0.4 +
            // 0.6) so the histogram/list bar always looked like a plausible real result even when
            // cai-core genuinely returned nothing. score: 0 is the honest value -- no result, no score
            // -- and the snippet text already labels this row as mock/disconnected.
            const entry = {
                timestamp: new Date().toISOString(),
                query: testQuery,
                sourceScribe: 'mock',
                score: 0,
                resultSnippet: `Mock result for: "${testQuery}" — cai-core not connected`,
            };
            setEntries((prev) => [entry, ...prev]);
        }
        finally {
            setQuerying(false);
            setTestQuery('');
        }
    }
    const filtered = scribeFilter === 'All' ? entries : entries.filter((e) => e.sourceScribe === scribeFilter);
    const maxScore = Math.max(...entries.map((e) => e.score), 0.01);
    return (_jsxs("div", { style: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0' }, children: "Caithedral\u2122 Retrieval Inspector" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 1 }, children: hasLiveData ? '● Live data' : '○ Mock data — cai-core not connected' })] }), _jsx("select", { value: scribeFilter, onChange: (e) => setScribeFilter(e.target.value), style: { background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#94a3b8', fontSize: 10, padding: '3px 7px', cursor: 'pointer' }, children: ALL_SCRIBES.map((s) => _jsx("option", { value: s, children: s }, s)) })] }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("input", { style: { flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '5px 8px', outline: 'none' }, value: testQuery, onChange: (e) => setTestQuery(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                            void handleTestQuery(); }, placeholder: "Run a test query against Caithedral\u2122\u2026" }), _jsx("button", { onClick: () => void handleTestQuery(), disabled: querying || !testQuery.trim(), style: { padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: querying ? 'wait' : 'pointer', border: '1px solid rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7', opacity: querying ? 0.6 : 1 }, children: querying ? '…' : 'Run' })] }), entries.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }, children: "Score Histogram" }), _jsx("div", { style: { display: 'flex', gap: 3, alignItems: 'flex-end', height: 40 }, children: entries.slice(0, 12).map((e, i) => (_jsx("div", { title: `${e.query.slice(0, 30)} — ${(e.score * 100).toFixed(0)}%`, style: {
                                flex: 1,
                                height: `${(e.score / maxScore) * 100}%`,
                                background: scoreColor(e.score),
                                borderRadius: '2px 2px 0 0',
                                opacity: 0.85,
                                minWidth: 8,
                            } }, i))) })] })), filtered.length === 0 ? (_jsx("div", { style: { textAlign: 'center', color: '#475569', fontSize: 11, padding: '20px 0' }, children: "No retrieval events yet \u2014 run the Gauntlet or ask a question to populate" })) : (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }, children: ["Retrieval Log (", filtered.length, ")"] }), filtered.map((entry, i) => (_jsxs("div", { style: { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 6, padding: '7px 10px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 3 }, children: [_jsx("span", { style: { fontSize: 10, fontWeight: 600, color: '#e2e8f0', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: entry.query }), _jsxs("span", { style: { fontSize: 9, fontWeight: 700, color: scoreColor(entry.score), flexShrink: 0 }, children: [(entry.score * 100).toFixed(0), "%"] })] }), _jsx("div", { style: { fontSize: 9, color: '#64748b', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: entry.resultSnippet }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs("span", { style: { fontSize: 8, color: '#334155' }, children: ["\uD83D\uDCDA ", entry.sourceScribe] }), _jsxs("span", { style: { fontSize: 8, color: '#334155' }, children: ["\uD83D\uDD50 ", relTime(entry.timestamp)] })] })] }, i)))] }))] }));
}
