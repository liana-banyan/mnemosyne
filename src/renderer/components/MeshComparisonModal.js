import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MeshComparisonModal.tsx — BP082 v0.3.1 3-Condition Mesh Comparison modal
 *
 * Triggered from 🔬 Run Mesh Comparison Test in Plow the Field.
 * Shows live A/B/C accuracy per domain during the run.
 * Receipt auto-written to Asteroid-ProofVault on completion.
 *
 * Caithedral spelling per BP081 blood statute.
 * Model mandate: Sonnet 4.6 per BP081 BLOOD STATUTE.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
// SEG-3.5 BP083: free-form number input replaces the fixed select dropdown.
// Max per domain is ~379 (smallest bank = history/384 minus 5 shot examples).
// Old select options are preserved as quick-pick buttons below the input.
const N_QUICK_PICKS = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '30', value: 30 },
    { label: '100', value: 100 },
    { label: 'All', value: 0 },
];
// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        background: '#0f172a',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 14,
        padding: '28px 32px',
        width: 560,
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
    },
    header: { fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 },
    sub: { fontSize: 12, color: '#64748b', marginBottom: 18 },
    label: { fontSize: 12, color: '#94a3b8', marginBottom: 8, display: 'block' },
    select: {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 8,
        color: '#e2e8f0',
        padding: '8px 12px',
        fontSize: 13,
        marginBottom: 16,
        outline: 'none',
    },
    conditionTable: {
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 18,
    },
    condRow: {
        display: 'flex',
        gap: 10,
        padding: '6px 0',
        borderBottom: '1px solid rgba(100,116,139,0.08)',
        alignItems: 'flex-start',
    },
    condLabel: (letter) => ({
        fontSize: 13,
        fontWeight: 800,
        color: letter === 'A' ? '#94a3b8' : letter === 'B' ? '#a5b4fc' : '#6ee7b7',
        minWidth: 22,
        paddingTop: 1,
    }),
    condText: { fontSize: 11, color: '#94a3b8', lineHeight: 1.5 },
    btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
    cancelBtn: {
        background: 'rgba(100,116,139,0.12)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 8,
        color: '#94a3b8',
        padding: '9px 18px',
        fontSize: 13,
        cursor: 'pointer',
    },
    primaryBtn: {
        background: 'rgba(16,185,129,0.88)',
        border: 'none',
        borderRadius: 8,
        color: '#fff',
        padding: '9px 20px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
    },
    domainRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 10px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.02)',
        marginBottom: 4,
        gap: 8,
    },
    liftBadge: (pp) => ({
        fontSize: 11,
        padding: '2px 7px',
        borderRadius: 10,
        background: pp > 0 ? 'rgba(110,231,183,0.12)' : pp < -1 ? 'rgba(248,113,113,0.1)' : 'rgba(100,116,139,0.1)',
        color: pp > 0 ? '#6ee7b7' : pp < -1 ? '#f87171' : '#94a3b8',
        fontWeight: 700,
    }),
    receiptBox: {
        background: 'rgba(110,231,183,0.06)',
        border: '1px solid rgba(110,231,183,0.2)',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 14,
        fontSize: 11,
        color: '#6ee7b7',
    },
};
function pct(v) { return (v * 100).toFixed(1) + '%'; }
function pp(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + 'pp'; }
function formatMs(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0)
        return `${h}h ${m}m ${s}s`;
    if (m > 0)
        return `${m}m ${s}s`;
    return `${s}s`;
}
function estimateTime(n) {
    if (n === 0)
        return '10–20 hours (all questions × 3 conditions)';
    // Each question runs A+B+C in parallel. B and C each spawn 3 parallel voter calls.
    // Wall-clock ~90s/question with parallel voters. C may retry up to 5×.
    const secsPerQ = 90;
    const total = n * 14 * secsPerQ;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h === 0)
        return `~${m} minutes`;
    if (m === 0)
        return `~${h} hour${h > 1 ? 's' : ''}`;
    return `~${h}h ${m}m`;
}
// ─── Component ────────────────────────────────────────────────────────────────
export function MeshComparisonModal({ onClose }) {
    const [nPerDomain, setNPerDomain] = useState(30);
    // SEG-3.5 BP083: always-current ref prevents stale closure in handleStart
    const nPerDomainRef = useRef(nPerDomain);
    nPerDomainRef.current = nPerDomain;
    const [state, setState] = useState({ id: 'idle' });
    const [receiptPath, setReceiptPath] = useState(null);
    const runningRef = useRef(false);
    useEffect(() => {
        const unsub = window.amplify?.onMeshComparisonProgress?.((event) => {
            const ev = event;
            if (ev.type === 'domain-start') {
                setState((prev) => ({
                    id: 'running',
                    domainIndex: ev.domainIndex,
                    totalDomains: ev.totalDomains,
                    currentDomain: ev.domain,
                    currentQ: 0,
                    currentN: ev.n,
                    aAccuracy: 0,
                    bAccuracy: 0,
                    cAccuracy: 0,
                    doneResults: prev.id === 'running' ? prev.doneResults : [],
                }));
            }
            else if (ev.type === 'question-done') {
                setState((prev) => {
                    if (prev.id !== 'running')
                        return prev;
                    return {
                        ...prev,
                        currentQ: ev.questionIndex + 1,
                        currentN: ev.n,
                        aAccuracy: ev.aAccuracy,
                        bAccuracy: ev.bAccuracy,
                        cAccuracy: ev.cAccuracy,
                    };
                });
            }
            else if (ev.type === 'domain-done') {
                setState((prev) => {
                    if (prev.id !== 'running')
                        return prev;
                    return {
                        ...prev,
                        doneResults: [...prev.doneResults, ev.result],
                    };
                });
            }
            else if (ev.type === 'smoke-test') {
                setState((prev) => {
                    if (prev.id !== 'running')
                        return prev;
                    const msg = ev.message ?? 'running…';
                    const aScore = ev.aScore;
                    const bScore = ev.bScore;
                    const cScore = ev.cScore;
                    const smokeLabel = (aScore !== undefined && bScore !== undefined && cScore !== undefined)
                        ? `Smoke: A=${aScore}/3 B=${bScore}/3 C=${cScore}/3 — ${msg}`
                        : `Smoke test: ${msg}`;
                    return { ...prev, currentDomain: smokeLabel };
                });
            }
            else if (ev.type === 'complete') {
                runningRef.current = false;
                setState({ id: 'complete', result: ev.result });
                if (typeof ev.receiptPath === 'string')
                    setReceiptPath(ev.receiptPath);
            }
            else if (ev.type === 'error') {
                runningRef.current = false;
                setState({ id: 'error', message: ev.message ?? 'Unknown error' });
            }
        });
        return () => { unsub?.(); };
    }, []);
    const handleStart = useCallback(async () => {
        if (runningRef.current)
            return;
        runningRef.current = true;
        // SEG-3.5 BP083: read via ref to avoid any stale closure race
        const n = nPerDomainRef.current;
        setState({
            id: 'running',
            domainIndex: 0,
            totalDomains: 14,
            currentDomain: 'loading…',
            currentQ: 0,
            currentN: n,
            aAccuracy: 0,
            bAccuracy: 0,
            cAccuracy: 0,
            doneResults: [],
        });
        try {
            await window.amplify?.runMeshComparison?.({
                nPerDomain: n,
                randomSeed: 42,
                model: 'gemma4:12b',
                ollamaBaseUrl: 'http://127.0.0.1:11434',
            });
        }
        catch (err) {
            runningRef.current = false;
            setState({ id: 'error', message: err.message });
        }
        // SEG-3.5 BP083: nPerDomain removed from deps — read via nPerDomainRef.current
    }, []);
    const handleCancel = useCallback(async () => {
        await window.amplify?.cancelMeshComparison?.();
        runningRef.current = false;
        onClose();
    }, [onClose]);
    // ── Idle: config screen ────────────────────────────────────────────────────
    if (state.id === 'idle') {
        return (_jsx("div", { style: S.overlay, onClick: onClose, children: _jsxs("div", { style: S.modal, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { style: S.header, children: "\uD83D\uDD2C Mesh Comparison Test" }), _jsx("div", { style: S.sub, children: "Tests three conditions on the same questions to measure the cooperative architecture's actual lift." }), _jsxs("div", { style: S.conditionTable, children: [_jsxs("div", { style: { ...S.condRow, borderBottom: '1px solid rgba(100,116,139,0.15)', paddingBottom: 8, marginBottom: 4 }, children: [_jsx("div", { style: { ...S.condLabel('A'), minWidth: 120, color: '#64748b', fontSize: 10, fontWeight: 700 }, children: "CONDITION" }), _jsx("div", { style: { fontSize: 10, fontWeight: 700, color: '#64748b' }, children: "DESCRIPTION" })] }), _jsxs("div", { style: S.condRow, children: [_jsx("div", { style: S.condLabel('A'), children: "A" }), _jsxs("div", { style: S.condText, children: [_jsx("strong", { style: { color: '#e2e8f0' }, children: "Cold" }), " \u2014 single-shot, no concordance, no substrate. Bottom floor: raw Gemma 4 12B alone."] })] }), _jsxs("div", { style: S.condRow, children: [_jsx("div", { style: S.condLabel('B'), children: "B" }), _jsxs("div", { style: S.condText, children: [_jsx("strong", { style: { color: '#e2e8f0' }, children: "Seeded single-pass" }), " \u2014 3-voter Shadow E-Giant concordance, single-pass. The apples-to-apples mode (v0.2.3 Beat-Google behavior). Shows concordance value."] })] }), _jsxs("div", { style: { ...S.condRow, borderBottom: 'none' }, children: [_jsx("div", { style: S.condLabel('C'), children: "C" }), _jsxs("div", { style: S.condText, children: [_jsx("strong", { style: { color: '#6ee7b7' }, children: "Seeded + Loop" }), " \u2014 3-voter concordance + Andon Cord retry until concordance, MAX=5 attempts. What the cooperative architecture actually delivers. Substrate grows."] })] })] }), _jsxs("div", { style: { background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }, children: [_jsx("strong", { style: { color: '#6ee7b7' }, children: "Publishable lift: C \u2212 A" }), " \u2014 cooperative-architecture lift", _jsx("br", {}), "B \u2212 A shows concordance value alone \u00B7 C \u2212 B shows loop value alone"] }), _jsx("label", { style: S.label, children: "Questions per domain (14 domains locked)" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }, children: [_jsx("input", { type: "number", min: 1, max: 379, value: nPerDomain === 0 ? '' : nPerDomain, placeholder: "e.g. 30", onChange: (e) => {
                                    const v = e.target.value === '' ? 0 : Math.max(1, Math.min(379, Number(e.target.value)));
                                    setNPerDomain(v);
                                }, style: {
                                    background: '#111827',
                                    border: '1px solid #1e2a38',
                                    borderRadius: 6,
                                    color: '#e2e8f0',
                                    fontSize: 13,
                                    padding: '6px 10px',
                                    width: 90,
                                    outline: 'none',
                                } }), _jsxs("span", { style: { fontSize: 11, color: '#475569' }, children: ["\u00D7 14 domains = ", nPerDomain === 0 ? 'all' : nPerDomain * 14, " total q"] })] }), _jsx("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }, children: N_QUICK_PICKS.map((o) => (_jsx("button", { type: "button", onClick: () => setNPerDomain(o.value), style: {
                                background: nPerDomain === o.value ? 'rgba(110,231,183,0.18)' : 'none',
                                border: `1px solid ${nPerDomain === o.value ? '#10b981' : '#334155'}`,
                                borderRadius: 5,
                                color: nPerDomain === o.value ? '#6ee7b7' : '#94a3b8',
                                fontSize: 11,
                                padding: '3px 10px',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'system-ui, sans-serif',
                            }, children: o.label }, o.value))) }), _jsxs("div", { style: { fontSize: 11, color: '#475569', marginBottom: 18, lineHeight: 1.5 }, children: ["Estimated wall-clock: ", estimateTime(nPerDomain), _jsx("br", {}), "Receipt auto-written to Asteroid-ProofVault/ on completion."] }), _jsxs("div", { style: S.btnRow, children: [_jsx("button", { style: S.cancelBtn, onClick: onClose, children: "Cancel" }), _jsx("button", { style: S.primaryBtn, onClick: () => { void handleStart(); }, children: "Confirm Run \uD83D\uDD2C" })] })] }) }));
    }
    // ── Running ────────────────────────────────────────────────────────────────
    if (state.id === 'running') {
        const overallPct = state.totalDomains > 0
            ? Math.round(((state.domainIndex + state.currentQ / Math.max(state.currentN, 1)) / state.totalDomains) * 100)
            : 0;
        return (_jsx("div", { style: S.overlay, children: _jsxs("div", { style: S.modal, children: [_jsx("div", { style: S.header, children: "\uD83D\uDD04 Mesh Comparison Running\u2026" }), _jsx("div", { style: S.sub, children: "Running A/B/C in parallel per question. Do not close." }), _jsxs("div", { style: { marginBottom: 14 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }, children: [_jsx("span", { children: "Overall progress" }), _jsxs("span", { children: [overallPct, "%"] })] }), _jsx("div", { style: { background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6 }, children: _jsx("div", { style: { width: `${overallPct}%`, background: '#6366f1', borderRadius: 4, height: 6, transition: 'width 0.3s' } }) })] }), _jsxs("div", { style: { fontSize: 12, color: '#94a3b8', marginBottom: 12 }, children: ["Domain ", state.domainIndex + 1, "/", state.totalDomains, ": ", _jsx("strong", { style: { color: '#e2e8f0' }, children: state.currentDomain }), ' ', "\u2014 Q ", state.currentQ, "/", state.currentN] }), state.currentQ > 0 && (_jsx("div", { style: { marginBottom: 14, background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '10px 14px' }, children: ['A', 'B', 'C'].map((letter) => {
                            const acc = letter === 'A' ? state.aAccuracy : letter === 'B' ? state.bAccuracy : state.cAccuracy;
                            const color = letter === 'A' ? '#94a3b8' : letter === 'B' ? '#a5b4fc' : '#6ee7b7';
                            return (_jsxs("div", { style: { marginBottom: 6 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }, children: [_jsxs("span", { style: { color }, children: [letter, " (", letter === 'A' ? 'Cold' : letter === 'B' ? 'Seeded' : 'Seeded+Loop', ")"] }), _jsx("span", { style: { color }, children: pct(acc) })] }), _jsx("div", { style: { background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 4 }, children: _jsx("div", { style: { width: `${acc * 100}%`, background: color, borderRadius: 3, height: 4, transition: 'width 0.3s' } }) })] }, letter));
                        }) })), state.doneResults.length > 0 && (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: { fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Completed domains" }), state.doneResults.map((d) => (_jsxs("div", { style: S.domainRow, children: [_jsx("span", { style: { fontSize: 11, color: '#94a3b8', flex: 1 }, children: d.domain.replace(/_/g, ' ') }), _jsx("span", { style: { fontSize: 10, color: '#94a3b8' }, children: pct(d.a_accuracy) }), _jsx("span", { style: { fontSize: 10, color: '#a5b4fc' }, children: pct(d.b_accuracy) }), _jsx("span", { style: { fontSize: 10, color: '#6ee7b7' }, children: pct(d.c_accuracy) }), _jsx("span", { style: S.liftBadge(d.c_minus_a_pp), children: pp(d.c_minus_a_pp) })] }, d.domain)))] })), _jsx("div", { style: S.btnRow, children: _jsx("button", { style: S.cancelBtn, onClick: () => { void handleCancel(); }, children: "Cancel" }) })] }) }));
    }
    // ── Complete ───────────────────────────────────────────────────────────────
    if (state.id === 'complete') {
        const { result } = state;
        return (_jsx("div", { style: S.overlay, onClick: onClose, children: _jsxs("div", { style: S.modal, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { style: S.header, children: "\uD83D\uDD2C Mesh Comparison Complete" }), _jsxs("div", { style: { background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }, children: [_jsxs("div", { style: { fontSize: 13, color: '#94a3b8', marginBottom: 6 }, children: ["Cold (A):", ' ', _jsx("strong", { style: { color: '#e2e8f0' }, children: pct(result.a_aggregate) }), ' ', "\u00B7 Seeded (B):", ' ', _jsx("strong", { style: { color: '#a5b4fc' }, children: pct(result.b_aggregate) }), ' ', "\u00B7 Loop (C):", ' ', _jsx("strong", { style: { color: '#6ee7b7' }, children: pct(result.c_aggregate) })] }), _jsxs("div", { style: { fontSize: 18, fontWeight: 800, color: result.c_minus_a_pp >= 0 ? '#6ee7b7' : '#f87171' }, children: ["Cooperative lift (C \u2212 A): ", pp(result.c_minus_a_pp)] }), _jsxs("div", { style: { fontSize: 11, color: '#64748b', marginTop: 6 }, children: ["B \u2212 A (concordance): ", pp(result.b_minus_a_pp), " \u00B7 C \u2212 B (loop): ", pp(result.c_minus_b_pp)] }), _jsxs("div", { style: { fontSize: 11, color: '#475569', marginTop: 4 }, children: [result.substrateGrowth, " new eblets \u00B7 ", formatMs(result.elapsedMs)] })] }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Per-domain \u00B7 A / B / C / C\u2212A lift" }), _jsx("div", { style: { marginBottom: 14 }, children: result.domainResults.map((d) => (_jsxs("div", { style: S.domainRow, children: [_jsx("span", { style: { fontSize: 10, color: '#94a3b8', flex: 1 }, children: d.domain.replace(/_/g, ' ') }), _jsx("span", { style: { fontSize: 10, color: '#64748b' }, children: pct(d.a_accuracy) }), _jsx("span", { style: { fontSize: 10, color: '#a5b4fc' }, children: pct(d.b_accuracy) }), _jsx("span", { style: { fontSize: 10, color: '#6ee7b7' }, children: pct(d.c_accuracy) }), _jsx("span", { style: S.liftBadge(d.c_minus_a_pp), children: pp(d.c_minus_a_pp) })] }, d.domain))) }), receiptPath && (_jsxs("div", { style: S.receiptBox, children: ["\u2713 Receipt saved: ", _jsx("span", { style: { fontSize: 10, opacity: 0.8 }, children: receiptPath })] })), _jsx("div", { style: S.btnRow, children: _jsx("button", { style: S.cancelBtn, onClick: onClose, children: "Close" }) })] }) }));
    }
    // ── Error ──────────────────────────────────────────────────────────────────
    if (state.id === 'error') {
        // Split message into headline and diagnostic lines (BP078 every-click-feedback canon)
        const [headline, ...diagLines] = state.message.split('\n');
        const hasDiag = diagLines.length > 0;
        return (_jsx("div", { style: S.overlay, onClick: onClose, children: _jsxs("div", { style: S.modal, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { style: S.header, children: "\u274C Mesh Comparison Error" }), _jsx("div", { style: { fontSize: 13, color: '#f87171', margin: '12px 0 8px', lineHeight: 1.5 }, children: headline }), hasDiag && (_jsx("div", { style: {
                            background: 'rgba(248,113,113,0.06)',
                            border: '1px solid rgba(248,113,113,0.2)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginBottom: 16,
                            fontSize: 11,
                            color: '#fca5a5',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                        }, children: diagLines.join('\n') })), _jsx("div", { style: S.btnRow, children: _jsx("button", { style: S.cancelBtn, onClick: onClose, children: "Close" }) })] }) }));
    }
    return null;
}
