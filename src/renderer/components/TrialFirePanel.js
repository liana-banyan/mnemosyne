import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// TrialFirePanel.tsx — BP087 Wave 3 SEG-C3
// Trial 02 Mesh Validation UI: 70Q paired Pass A + Pass B
// Uses window.amplify.thunderclap (added to preload by SEG-C2 or equivalent)
import { useState, useEffect, useRef, useCallback } from 'react';
// Cast to any since thunderclap is added to preload by a separate SEG
function getThunderclap() {
    return window.amplify.thunderclap;
}
// ─── Component ────────────────────────────────────────────────────────────────
export function TrialFirePanel() {
    const [status, setStatus] = useState('idle');
    const [logLines, setLogLines] = useState([]);
    const [accuracy, setAccuracy] = useState('');
    const [receiptPath, setReceiptPath] = useState('');
    const [flagshipTier, setFlagshipTier] = useState('gemma');
    const [gatesGreen, setGatesGreen] = useState(false);
    const [errorSummary, setErrorSummary] = useState('');
    const logRef = useRef(null);
    // Auto-scroll log panel on new lines
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logLines]);
    // Wire up thunderclap push events on mount
    useEffect(() => {
        const tc = getThunderclap();
        if (!tc)
            return;
        tc.onLog((line) => {
            setLogLines(prev => [...prev, line.trimEnd()]);
        });
        tc.onComplete((data) => {
            setAccuracy(data.accuracy);
            setReceiptPath(data.receiptPath ?? '');
            setStatus('complete');
        });
        tc.onGatesFailed((output) => {
            setErrorSummary(`Gates check failed:\n${output}`);
            setStatus('failed');
        });
        return () => {
            getThunderclap()?.removeAllListeners();
        };
    }, []);
    const appendLog = (line) => {
        setLogLines(prev => [...prev, line]);
    };
    const handleCheckGates = useCallback(async () => {
        const tc = getThunderclap();
        if (!tc) {
            appendLog('[ERROR] thunderclap bridge not available. Preload not wired yet.');
            setGatesGreen(false);
            return;
        }
        setStatus('checking-gates');
        setLogLines([]);
        setGatesGreen(false);
        try {
            const result = await tc.checkGates();
            if (result.allGreen) {
                setGatesGreen(true);
                appendLog('[GATES] All gates GREEN. Ready to fire.');
                setStatus('idle');
            }
            else {
                setGatesGreen(false);
                setErrorSummary(result.output);
                appendLog('[GATES] One or more gates RED. Resolve before firing.');
                setStatus('failed');
            }
        }
        catch (e) {
            setGatesGreen(false);
            setErrorSummary(String(e));
            setStatus('failed');
        }
    }, []);
    const handleFireTrial = useCallback(async () => {
        const tc = getThunderclap();
        if (!tc) {
            appendLog('[ERROR] thunderclap bridge not available.');
            return;
        }
        if (!gatesGreen)
            return;
        setStatus('firing');
        setLogLines([]);
        setAccuracy('');
        setReceiptPath('');
        setErrorSummary('');
        try {
            await tc.fireTrial02({ flagshipTier });
            // Completion is pushed via onComplete event; status set there
        }
        catch (e) {
            setErrorSummary(String(e));
            setStatus('failed');
        }
    }, [flagshipTier, gatesGreen]);
    // ─── Status badge ──────────────────────────────────────────────────────────
    const statusBadge = {
        'idle': { label: 'IDLE', color: '#94a3b8', bg: 'rgba(100,116,139,0.1)' },
        'checking-gates': { label: 'CHECKING GATES', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        'firing': { label: 'FIRING', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
        'complete': { label: 'COMPLETE', color: '#6ee7b7', bg: 'rgba(110,231,183,0.1)' },
        'failed': { label: 'FAILED', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
    };
    const badge = statusBadge[status];
    return (_jsx("div", { style: { padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }, children: _jsxs("div", { style: { maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 15, fontWeight: 700, color: '#e2e8f0' }, children: "Trial 02 Mesh Validation" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.5 }, children: "70Q paired Pass A + Pass B" })] }), _jsx("span", { style: {
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                                color: badge.color, background: badge.bg,
                                border: `1px solid ${badge.color}55`,
                                borderRadius: 5, padding: '3px 10px',
                            }, children: badge.label })] }), _jsxs("div", { style: {
                        background: 'rgba(15,23,42,0.6)',
                        border: '1px solid rgba(100,116,139,0.2)',
                        borderRadius: 10, padding: '14px 16px',
                    }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Flagship Tier" }), _jsx("div", { style: { display: 'flex', gap: 8 }, children: ['gemma', 'claude'].map(tier => (_jsxs("label", { style: {
                                    display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                                    padding: '7px 14px', borderRadius: 7,
                                    border: flagshipTier === tier
                                        ? `1px solid ${tier === 'claude' ? 'rgba(139,92,246,0.5)' : 'rgba(110,231,183,0.4)'}`
                                        : '1px solid rgba(100,116,139,0.2)',
                                    background: flagshipTier === tier
                                        ? (tier === 'claude' ? 'rgba(139,92,246,0.08)' : 'rgba(110,231,183,0.08)')
                                        : 'transparent',
                                }, children: [_jsx("input", { type: "radio", name: "flagship-tier", value: tier, checked: flagshipTier === tier, onChange: () => setFlagshipTier(tier), style: { accentColor: tier === 'claude' ? '#a78bfa' : '#6ee7b7' } }), _jsx("span", { style: {
                                            fontSize: 12, fontWeight: 600,
                                            color: flagshipTier === tier
                                                ? (tier === 'claude' ? '#a78bfa' : '#6ee7b7')
                                                : '#64748b',
                                        }, children: tier === 'claude' ? 'Claude (Flagship)' : 'Gemma (Local)' })] }, tier))) })] }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { type: "button", onClick: handleCheckGates, disabled: status === 'checking-gates' || status === 'firing', style: {
                                flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
                                cursor: (status === 'checking-gates' || status === 'firing') ? 'not-allowed' : 'pointer',
                                border: '1px solid rgba(245,158,11,0.4)',
                                background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                                opacity: (status === 'checking-gates' || status === 'firing') ? 0.5 : 1,
                            }, children: status === 'checking-gates' ? 'Checking...' : 'Check Gates' }), _jsx("button", { type: "button", onClick: handleFireTrial, disabled: !gatesGreen || status === 'firing' || status === 'checking-gates', title: !gatesGreen ? 'Run Check Gates first' : undefined, style: {
                                flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
                                cursor: (!gatesGreen || status === 'firing' || status === 'checking-gates') ? 'not-allowed' : 'pointer',
                                border: `1px solid ${gatesGreen ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.2)'}`,
                                background: gatesGreen ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.05)',
                                color: gatesGreen ? '#6ee7b7' : '#475569',
                                opacity: (!gatesGreen || status === 'firing') ? 0.55 : 1,
                            }, children: status === 'firing' ? 'Firing...' : 'Fire Trial 02' })] }), logLines.length > 0 && (_jsxs("div", { style: {
                        background: 'rgba(8,15,30,0.8)',
                        border: '1px solid rgba(100,116,139,0.15)',
                        borderRadius: 8, overflow: 'hidden',
                    }, children: [_jsx("div", { style: {
                                padding: '7px 12px', fontSize: 9, fontWeight: 700, color: '#475569',
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                borderBottom: '1px solid rgba(100,116,139,0.1)',
                            }, children: "Live Log" }), _jsx("pre", { ref: logRef, style: {
                                margin: 0, padding: '10px 14px',
                                fontFamily: 'monospace', fontSize: 10.5, lineHeight: 1.55,
                                color: '#94a3b8', overflowY: 'auto', maxHeight: 400,
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            }, children: _jsx("code", { children: logLines.join('\n') }) })] })), status === 'complete' && (_jsxs("div", { style: {
                        background: 'rgba(6,78,59,0.18)',
                        border: '1px solid rgba(110,231,183,0.35)',
                        borderRadius: 10, padding: '14px 18px',
                    }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginBottom: 8 }, children: "Trial 02 Complete" }), receiptPath && (_jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 5 }, children: [_jsx("span", { style: { color: '#64748b' }, children: "Receipt: " }), receiptPath] })), _jsxs("div", { style: { fontSize: 12, color: '#e2e8f0', marginBottom: 6 }, children: [_jsx("span", { style: { color: '#64748b' }, children: "Accuracy: " }), _jsx("span", { style: { fontWeight: 700, color: '#6ee7b7' }, children: accuracy })] }), _jsx("div", { style: { fontSize: 10, color: '#475569', fontStyle: 'italic', lineHeight: 1.5 }, children: "Receipt minted. Canon eblet queued for Bishop close-out." })] })), status === 'failed' && errorSummary && (_jsxs("div", { style: {
                        background: 'rgba(127,29,29,0.15)',
                        border: '1px solid rgba(248,113,113,0.3)',
                        borderRadius: 10, padding: '14px 18px',
                    }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 8 }, children: "Trial Failed" }), _jsx("pre", { style: {
                                margin: 0, fontFamily: 'monospace', fontSize: 10.5, color: '#fca5a5',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5,
                            }, children: errorSummary })] }))] }) }));
}
