import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BenchmarkModal.tsx — BP082 v0.2.3 "Beat-Google Benchmark" modal
 *
 * Triggered from the 🏁 button in Test It Out → Plow the Field.
 * Config: N per domain (10/30/50/100/all), methodology locked to 5-shot CoT.
 * Shows live domain-by-domain progress during run.
 * Generates + writes receipt on completion.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
const N_OPTIONS = [
    { label: '10 (quick ~20min)', value: 10 },
    { label: '30 (~1hr)', value: 30 },
    { label: '50 (~1.5hr)', value: 50 },
    { label: '100 (overnight ~3hr)', value: 100 },
    { label: 'All questions (5–8hr)', value: 0 },
];
const GOOGLE_BASELINE = 0.772;
function pct(v) {
    return (v * 100).toFixed(1) + '%';
}
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
        return '5–8 hours (all questions)';
    const secsPerQ = 60; // 3 parallel voters × ~20s each = ~60s wall-clock
    const total = n * 14 * secsPerQ;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h === 0)
        return `~${m} minutes`;
    if (m === 0)
        return `~${h} hour${h > 1 ? 's' : ''}`;
    return `~${h}h ${m}m`;
}
// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
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
        width: 520,
        maxWidth: '95vw',
        maxHeight: '88vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
    },
    header: {
        fontSize: 18,
        fontWeight: 700,
        color: '#f1f5f9',
        marginBottom: 6,
    },
    sub: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 20,
    },
    label: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 8,
        display: 'block',
    },
    select: {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 8,
        color: '#e2e8f0',
        padding: '8px 12px',
        fontSize: 13,
        marginBottom: 16,
    },
    infoBox: {
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 20,
    },
    infoRow: {
        fontSize: 12,
        color: '#a5b4fc',
        marginBottom: 4,
        display: 'flex',
        justifyContent: 'space-between',
    },
    btnRow: {
        display: 'flex',
        gap: 10,
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    cancelBtn: {
        background: 'rgba(100,116,139,0.12)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 8,
        color: '#94a3b8',
        padding: '9px 18px',
        fontSize: 13,
        cursor: 'pointer',
    },
    primaryBtn: (disabled) => ({
        background: disabled ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.9)',
        border: 'none',
        borderRadius: 8,
        color: disabled ? '#6ee7b7' : '#fff',
        padding: '9px 20px',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
    }),
    progressDomain: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 14,
    },
    domainRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 10px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.025)',
        marginBottom: 4,
    },
    verdictBeat: { color: '#6ee7b7', fontSize: 22, fontWeight: 800 },
    verdictTied: { color: '#fbbf24', fontSize: 22, fontWeight: 800 },
    verdictShort: { color: '#f87171', fontSize: 22, fontWeight: 800 },
    receiptBtn: {
        background: 'rgba(16,185,129,0.15)',
        border: '1px solid rgba(16,185,129,0.35)',
        borderRadius: 8,
        color: '#6ee7b7',
        padding: '8px 16px',
        fontSize: 12,
        cursor: 'pointer',
        marginTop: 12,
    },
};
export function BenchmarkModal({ onClose }) {
    const [nPerDomain, setNPerDomain] = useState(30);
    const [state, setState] = useState({ id: 'idle' });
    const [receiptPath, setReceiptPath] = useState(null);
    const runningRef = useRef(false);
    // Clean up progress listener on unmount
    useEffect(() => {
        const unsub = window.amplify?.onBenchmarkProgress?.((event) => {
            if (event.type === 'domain-start') {
                setState((prev) => ({
                    id: 'running',
                    domainIndex: event.domainIndex,
                    totalDomains: event.totalDomains,
                    currentDomain: event.domain,
                    currentDomainQ: 0,
                    currentDomainN: event.n,
                    domainAccuracy: 0,
                    doneResults: prev.id === 'running' ? prev.doneResults : [],
                }));
            }
            else if (event.type === 'question-done') {
                setState((prev) => {
                    if (prev.id !== 'running')
                        return prev;
                    return {
                        ...prev,
                        currentDomainQ: event.questionIndex + 1,
                        currentDomainN: event.n,
                        domainAccuracy: event.domainAccuracy,
                    };
                });
            }
            else if (event.type === 'domain-done') {
                setState((prev) => {
                    if (prev.id !== 'running')
                        return prev;
                    return {
                        ...prev,
                        doneResults: [...prev.doneResults, event.result],
                    };
                });
            }
            else if (event.type === 'complete') {
                runningRef.current = false;
                const result = event.result;
                setState({ id: 'complete', result });
                // receiptPath is auto-written by main process; included in the complete event
                if (typeof event.receiptPath === 'string') {
                    setReceiptPath(event.receiptPath);
                }
            }
            else if (event.type === 'error') {
                runningRef.current = false;
                setState({ id: 'error', message: event.message ?? 'Unknown error' });
            }
        });
        return () => { unsub?.(); };
    }, []);
    const handleStart = useCallback(async () => {
        if (runningRef.current)
            return;
        runningRef.current = true;
        setState({
            id: 'running',
            domainIndex: 0,
            totalDomains: 14,
            currentDomain: 'loading...',
            currentDomainQ: 0,
            currentDomainN: nPerDomain,
            domainAccuracy: 0,
            doneResults: [],
        });
        try {
            await window.amplify?.runBenchmark?.({
                nPerDomain,
                randomSeed: 42,
                model: 'gemma4:12b',
                ollamaBaseUrl: 'http://127.0.0.1:11434',
            });
        }
        catch (err) {
            runningRef.current = false;
            setState({ id: 'error', message: err.message });
        }
    }, [nPerDomain]);
    const handleCancel = useCallback(async () => {
        await window.amplify?.cancelBenchmark?.();
        runningRef.current = false;
        onClose();
    }, [onClose]);
    // ── Render: idle / configuring ─────────────────────────────────────────────
    if (state.id === 'idle') {
        return (_jsx("div", { style: S.overlay, onClick: onClose, children: _jsxs("div", { style: S.modal, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { style: S.header, children: "\uD83C\uDFC1 Apples-to-Apples Handicapped Comparison" }), _jsxs("div", { style: S.sub, children: ["Single-pass 3-voter concordance vs Google's published Gemma 4 12B MMLU-Pro baseline (77.2%). This is the methodology-handicapped mode (v0.2.3). It does NOT measure the cooperative architecture's full structural advantage. Use ", _jsx("strong", { style: { color: '#6ee7b7' }, children: "\uD83D\uDD2C Run Mesh Comparison Test" }), " for the publishable lift."] }), _jsx("label", { style: S.label, children: "Questions per domain" }), _jsx("select", { style: S.select, value: nPerDomain, onChange: (e) => setNPerDomain(Number(e.target.value)), children: N_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }), _jsxs("div", { style: S.infoBox, children: [_jsxs("div", { style: S.infoRow, children: [_jsx("span", { children: "Methodology" }), _jsx("span", { children: "5-shot CoT, letter extraction" })] }), _jsxs("div", { style: S.infoRow, children: [_jsx("span", { children: "Verification" }), _jsx("span", { children: "3-voter Shadow E-Giant concordance" })] }), _jsxs("div", { style: S.infoRow, children: [_jsx("span", { children: "Google baseline" }), _jsx("span", { children: "77.2% aggregate (Gemma 4 12B)" })] }), _jsxs("div", { style: S.infoRow, children: [_jsx("span", { children: "Domains" }), _jsxs("span", { children: ["14 \u00D7 ", nPerDomain === 0 ? 'all' : nPerDomain, " questions"] })] }), _jsxs("div", { style: S.infoRow, children: [_jsx("span", { children: "Estimated time" }), _jsx("span", { children: estimateTime(nPerDomain) })] })] }), _jsx("div", { style: { fontSize: 11, color: '#475569', marginBottom: 18, lineHeight: 1.5 }, children: "Receipt auto-written to userData/benchmark_receipts/ and Asteroid-ProofVault/ on completion." }), _jsxs("div", { style: S.btnRow, children: [_jsx("button", { style: S.cancelBtn, onClick: onClose, children: "Cancel" }), _jsx("button", { style: S.primaryBtn(false), onClick: () => { void handleStart(); }, children: "Confirm Run \uD83C\uDFC1" })] })] }) }));
    }
    // ── Render: running ────────────────────────────────────────────────────────
    if (state.id === 'running') {
        const overallPct = state.totalDomains > 0
            ? Math.round(((state.domainIndex + state.currentDomainQ / Math.max(state.currentDomainN, 1)) / state.totalDomains) * 100)
            : 0;
        return (_jsx("div", { style: S.overlay, children: _jsxs("div", { style: S.modal, children: [_jsx("div", { style: S.header, children: "\uD83D\uDD04 Benchmark Running\u2026" }), _jsx("div", { style: S.sub, children: "Do not close. You can leave this running overnight." }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }, children: [_jsx("span", { children: "Overall progress" }), _jsxs("span", { children: [overallPct, "%"] })] }), _jsx("div", { style: { background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6 }, children: _jsx("div", { style: { width: `${overallPct}%`, background: '#6366f1', borderRadius: 4, height: 6, transition: 'width 0.3s' } }) })] }), _jsxs("div", { style: S.progressDomain, children: ["Domain ", state.domainIndex + 1, "/", state.totalDomains, ": ", _jsx("strong", { style: { color: '#e2e8f0' }, children: state.currentDomain }), ' ', "\u2014 Q ", state.currentDomainQ, "/", state.currentDomainN, ' ', "\u2014 accuracy ", pct(state.domainAccuracy)] }), state.doneResults.length > 0 && (_jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("div", { style: { fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Completed domains" }), state.doneResults.map((d) => (_jsxs("div", { style: S.domainRow, children: [_jsx("span", { style: { fontSize: 12, color: '#94a3b8' }, children: d.domain }), _jsxs("span", { style: { fontSize: 12, color: d.liftPp >= 0 ? '#6ee7b7' : '#f87171' }, children: [pct(d.accuracy), " (", d.liftPp >= 0 ? '+' : '', d.liftPp.toFixed(1), "pp)"] })] }, d.domain)))] })), _jsx("div", { style: S.btnRow, children: _jsx("button", { style: S.cancelBtn, onClick: () => { void handleCancel(); }, children: "Cancel Benchmark" }) })] }) }));
    }
    // ── Render: complete ───────────────────────────────────────────────────────
    if (state.id === 'complete') {
        const { result } = state;
        const verdictStyle = result.verdict === 'BEAT' ? S.verdictBeat : result.verdict === 'TIED' ? S.verdictTied : S.verdictShort;
        const verdictEmoji = result.verdict === 'BEAT' ? '🏆' : result.verdict === 'TIED' ? '🤝' : '📉';
        return (_jsx("div", { style: S.overlay, onClick: onClose, children: _jsxs("div", { style: S.modal, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: S.header, children: ["Benchmark Complete ", verdictEmoji] }), _jsxs("div", { style: { textAlign: 'center', margin: '16px 0 20px' }, children: [_jsx("div", { style: verdictStyle, children: result.verdict }), _jsxs("div", { style: { fontSize: 13, color: '#94a3b8', marginTop: 8 }, children: ["Liana: ", _jsx("strong", { style: { color: '#e2e8f0' }, children: pct(result.aggregateLiana) }), ' ', "vs Google: ", _jsx("strong", { style: { color: '#e2e8f0' }, children: pct(result.aggregateGoogle) }), ' ', "\u2014 lift: ", _jsxs("strong", { style: { color: result.liftPp >= 0 ? '#6ee7b7' : '#f87171' }, children: [result.liftPp >= 0 ? '+' : '', result.liftPp.toFixed(2), " pp"] })] }), _jsxs("div", { style: { fontSize: 11, color: '#475569', marginTop: 4 }, children: [result.totalVerified, "/", result.totalQuestions, " verified \u00B7 ", formatMs(result.elapsedMs)] })] }), _jsx("div", { style: { fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Per-domain results" }), _jsx("div", { style: { marginBottom: 16 }, children: result.domainResults.map((d) => (_jsxs("div", { style: S.domainRow, children: [_jsx("span", { style: { fontSize: 11, color: '#94a3b8', width: 130 }, children: d.domain.replace(/_/g, ' ') }), _jsx("span", { style: { fontSize: 11, color: '#e2e8f0' }, children: pct(d.accuracy) }), _jsxs("span", { style: { fontSize: 11, color: '#64748b' }, children: ["vs ", pct(d.googleBaseline)] }), _jsxs("span", { style: { fontSize: 11, color: d.liftPp >= 0 ? '#6ee7b7' : '#f87171' }, children: [d.liftPp >= 0 ? '+' : '', d.liftPp.toFixed(1), "pp"] })] }, d.domain))) }), receiptPath && (_jsxs("div", { style: { fontSize: 11, color: '#475569', marginBottom: 8 }, children: ["\u2713 Receipt saved: ", _jsx("span", { style: { color: '#6ee7b7', fontSize: 10 }, children: receiptPath })] })), _jsx("div", { style: S.btnRow, children: _jsx("button", { style: S.cancelBtn, onClick: onClose, children: "Close" }) })] }) }));
    }
    // ── Render: error ──────────────────────────────────────────────────────────
    if (state.id === 'error') {
        return (_jsx("div", { style: S.overlay, onClick: onClose, children: _jsxs("div", { style: S.modal, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { style: S.header, children: "\u274C Benchmark Error" }), _jsx("div", { style: { fontSize: 13, color: '#f87171', margin: '12px 0 20px', lineHeight: 1.5 }, children: state.message }), _jsx("div", { style: S.btnRow, children: _jsx("button", { style: S.cancelBtn, onClick: onClose, children: "Close" }) })] }) }));
    }
    return null;
}
