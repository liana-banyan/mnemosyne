import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// AreopagusQueryPane — BP060 Application 002 Step 1 · UI-5
// Member-facing search interface for the Areopagus substrate.
// Per canon_areopagus_full_reckoning_complete_substrate_eblet_bp059.
// Honest in-flight scope messaging ("Searching substrate…" not "Results: 0" immediately).
// The Hill of Ares — comprehensive substrate completeness query surface.
import { useState, useCallback, useRef } from 'react';
// ─── Component ────────────────────────────────────────────────────────────────
export function AreopagusQueryPane() {
    const [queryInput, setQueryInput] = useState('');
    const [state, setState] = useState({ status: 'idle', query: '', matches: [] });
    const abortRef = useRef(false);
    const runQuery = useCallback(async () => {
        if (!queryInput.trim())
            return;
        abortRef.current = false;
        // Phase 0: Searching message — never show "Results: 0" without searching first
        setState({
            status: 'searching',
            query: queryInput.trim(),
            matches: [],
            phase_message: 'Searching substrate…',
        });
        // Phase 1: substrate crystal search (brief delay for UX honesty)
        await new Promise((r) => setTimeout(r, 150));
        if (abortRef.current)
            return;
        setState((prev) => ({ ...prev, phase_message: 'Querying BETWEEN crystal…' }));
        await new Promise((r) => setTimeout(r, 100));
        if (abortRef.current)
            return;
        try {
            const ct = window.amplify?.caithedralTools;
            let matches = [];
            let searched_at;
            if (ct) {
                const res = await ct.areopagus_query(queryInput.trim());
                if (res.ok) {
                    matches = res.matches ?? [];
                    searched_at = res.searched_at;
                }
            }
            else {
                // Dev fallback: return empty with honest message
                matches = [];
            }
            if (abortRef.current)
                return;
            setState({
                status: 'results',
                query: queryInput.trim(),
                matches,
                searched_at,
                phase_message: undefined,
            });
        }
        catch (err) {
            if (abortRef.current)
                return;
            setState({
                status: 'error',
                query: queryInput.trim(),
                matches: [],
                error: String(err),
            });
        }
    }, [queryInput]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter')
            runQuery();
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsxs("div", { style: {
                    padding: '10px 14px 6px',
                    borderBottom: '1px solid rgba(167,139,250,0.2)',
                    flexShrink: 0,
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }, children: "Areopagus \u00B7 Substrate Query" }), _jsx("div", { style: { fontSize: 9, color: '#475569' }, children: "Hill of Ares \u00B7 comprehensive substrate completeness \u00B7 signed, sealed, delivered, always maintained" })] }), _jsxs("div", { style: { padding: '10px 14px 6px', flexShrink: 0 }, children: [_jsx("div", { style: {
                            marginBottom: 10,
                            padding: '7px 10px',
                            background: 'rgba(167,139,250,0.06)',
                            border: '1px solid rgba(167,139,250,0.2)',
                            borderRadius: 6,
                        }, children: _jsxs("div", { style: { fontSize: 8, color: '#64748b', lineHeight: 1.6 }, children: [_jsx("strong", { style: { color: '#a78bfa' }, children: "Areopagus Phase 1" }), " (in-flight) \u00B7 Searches BETWEEN crystal (current session emissions). Full backfill of historical records (S1+S2+S3 class) requires Phase 1 SEG-cluster completion.", _jsx("br", {}), _jsx("strong", { style: { color: '#94a3b8' }, children: "Current scope:" }), " session-level Soccerball crystal (caithedral-core@0.2.0 BETWEEN registry). Phase 1 completion will expand to all substrate-canonical records."] }) }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("input", { value: queryInput, onChange: (e) => setQueryInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "Search substrate\u2026 (pearl_id, SID, content reference, keyword)", style: {
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(167,139,250,0.3)',
                                    borderRadius: 5,
                                    color: '#e2e8f0',
                                    fontSize: 10,
                                    padding: '7px 10px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                } }), _jsx("button", { onClick: runQuery, disabled: !queryInput.trim() || state.status === 'searching', style: {
                                    padding: '7px 14px',
                                    background: 'rgba(167,139,250,0.12)',
                                    border: '1px solid rgba(167,139,250,0.4)',
                                    borderRadius: 5,
                                    color: '#a78bfa',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    cursor: queryInput.trim() && state.status !== 'searching' ? 'pointer' : 'not-allowed',
                                    opacity: queryInput.trim() ? 1 : 0.5,
                                    whiteSpace: 'nowrap',
                                }, children: state.status === 'searching' ? '⟳ Searching' : 'Search' })] })] }), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '0 14px 10px' }, children: [state.status === 'idle' && (_jsx("div", { style: { fontSize: 10, color: '#334155', padding: '16px 0', textAlign: 'center' }, children: "Enter a query above to search the Areopagus substrate." })), state.status === 'searching' && (_jsx("div", { style: { padding: '16px 0', textAlign: 'center' }, children: _jsxs("div", { style: {
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                background: 'rgba(167,139,250,0.08)',
                                border: '1px solid rgba(167,139,250,0.2)',
                                borderRadius: 20, padding: '6px 14px',
                            }, children: [_jsx("span", { style: { fontSize: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }, children: "\u27F3" }), _jsx("span", { style: { fontSize: 10, color: '#a78bfa' }, children: state.phase_message })] }) })), state.status === 'error' && (_jsxs("div", { style: {
                            marginTop: 10, padding: '8px 10px',
                            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 6, fontSize: 10, color: '#f87171',
                        }, children: ["Query error: ", state.error] })), state.status === 'results' && (_jsxs("div", { style: { marginTop: 8 }, children: [_jsxs("div", { style: {
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginBottom: 8,
                                }, children: [_jsxs("div", { style: { fontSize: 9, color: '#475569' }, children: [_jsx("strong", { style: { color: '#a78bfa' }, children: state.matches.length }), " match", state.matches.length !== 1 ? 'es' : '', " for", ' ', _jsx("em", { style: { color: '#94a3b8' }, children: state.query }), state.searched_at && (_jsxs("span", { style: { marginLeft: 6 }, children: ["\u00B7 ", new Date(state.searched_at).toISOString().slice(11, 19), "Z"] }))] }), _jsx("div", { style: { fontSize: 8, color: '#334155' }, children: "Session crystal scope" })] }), state.matches.length === 0 && (_jsxs("div", { style: {
                                    padding: '12px',
                                    background: 'rgba(100,116,139,0.06)',
                                    border: '1px solid rgba(100,116,139,0.15)',
                                    borderRadius: 6,
                                    fontSize: 10, color: '#475569', textAlign: 'center',
                                }, children: ["No matches in session crystal for \"", state.query, "\".", _jsx("br", {}), _jsx("span", { style: { fontSize: 8, color: '#334155', display: 'block', marginTop: 4 }, children: "Areopagus Phase 1 (historical backfill) is in-flight \u2014 once complete, this will search all substrate records." })] })), state.matches.map((m, i) => (_jsxs("div", { style: {
                                    marginBottom: 6,
                                    padding: '8px 10px',
                                    background: 'rgba(167,139,250,0.05)',
                                    border: '1px solid rgba(167,139,250,0.2)',
                                    borderRadius: 6,
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 9, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }, children: m.sid }), _jsxs("span", { style: { fontSize: 8, color: '#334155' }, children: ["score: ", m.score.toFixed(2)] })] }), _jsxs("div", { style: { fontSize: 8, color: '#64748b', fontFamily: 'monospace' }, children: ["Pearls: ", m.pearls.join(', ')] })] }, i)))] }))] })] }));
}
export default AreopagusQueryPane;
