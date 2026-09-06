import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MultiSegGemmaPanel.tsx — BP087 Wave 3 SEG-E2
// Multi-SEG Local Gemma: fan-out N workers, synthesize, report variance
// Uses window.amplify.gemma (added to preload by SEG-E1 or equivalent)
import { useState, useCallback } from 'react';
function getGemmaBridge() {
    return window.amplify.gemma;
}
function confidenceLabel(variance) {
    if (variance <= 0.2)
        return { label: 'HIGH', color: '#6ee7b7' };
    if (variance <= 0.7)
        return { label: 'MEDIUM', color: '#f59e0b' };
    return { label: 'LOW', color: '#f87171' };
}
// ─── Component ────────────────────────────────────────────────────────────────
export function MultiSegGemmaPanel() {
    const [question, setQuestion] = useState('');
    const [status, setStatus] = useState('idle');
    const [result, setResult] = useState(null);
    const [workerCount, setWorkerCount] = useState(3);
    const [errorMsg, setErrorMsg] = useState('');
    const handleDispatch = useCallback(async () => {
        const bridge = getGemmaBridge();
        if (!bridge) {
            setErrorMsg('Gemma bridge not available. Preload not wired yet.');
            setStatus('error');
            return;
        }
        if (!question.trim())
            return;
        setStatus('firing');
        setResult(null);
        setErrorMsg('');
        try {
            const data = await bridge.dispatch({ question: question.trim(), workerCount });
            setResult(data);
            setStatus('complete');
        }
        catch (e) {
            setErrorMsg(String(e));
            setStatus('error');
        }
    }, [question, workerCount]);
    const canDispatch = status !== 'firing' && question.trim().length > 0;
    const confidence = result ? confidenceLabel(result.variance) : null;
    return (_jsx("div", { style: { padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }, children: _jsxs("div", { style: { maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 15, fontWeight: 700, color: '#e2e8f0' }, children: "Multi-SEG Local Gemma" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.5 }, children: "Free WITH Substrate > Flagship WITHOUT Substrate" })] }), _jsxs("div", { style: {
                        background: 'rgba(15,23,42,0.6)',
                        border: '1px solid rgba(100,116,139,0.2)',
                        borderRadius: 10, padding: '14px 16px',
                        display: 'flex', flexDirection: 'column', gap: 12,
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("label", { style: {
                                        fontSize: 10, fontWeight: 700, color: '#64748b',
                                        textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                                    }, children: "Worker Count" }), _jsx("input", { type: "number", min: 1, max: 5, value: workerCount, onChange: e => setWorkerCount(Math.max(1, Math.min(5, Number(e.target.value)))), style: {
                                        width: 60, background: 'rgba(15,23,42,0.7)',
                                        border: '1px solid rgba(100,116,139,0.25)',
                                        borderRadius: 5, color: '#e2e8f0', fontSize: 12,
                                        padding: '4px 8px', outline: 'none', boxSizing: 'border-box',
                                    } }), _jsx("span", { style: { fontSize: 10, color: '#475569' }, children: "workers (1-5)" })] }), _jsxs("div", { children: [_jsx("label", { style: {
                                        display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b',
                                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                                    }, children: "Question" }), _jsx("textarea", { rows: 4, value: question, onChange: e => setQuestion(e.target.value), placeholder: "Ask anything...", style: {
                                        width: '100%', background: 'rgba(15,23,42,0.7)',
                                        border: '1px solid rgba(100,116,139,0.25)',
                                        borderRadius: 6, color: '#e2e8f0', fontSize: 12,
                                        padding: '8px 10px', outline: 'none',
                                        resize: 'vertical', boxSizing: 'border-box',
                                        lineHeight: 1.55, fontFamily: 'inherit',
                                    } })] }), _jsx("button", { type: "button", onClick: handleDispatch, disabled: !canDispatch, style: {
                                padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
                                cursor: canDispatch ? 'pointer' : 'not-allowed',
                                border: `1px solid ${canDispatch ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.2)'}`,
                                background: canDispatch ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.05)',
                                color: canDispatch ? '#6ee7b7' : '#475569',
                                opacity: canDispatch ? 1 : 0.5,
                            }, children: status === 'firing' ? `Dispatching to ${workerCount} local Gemma workers...` : 'Dispatch' })] }), status === 'complete' && result && confidence && (_jsxs("div", { style: {
                        background: 'rgba(15,23,42,0.6)',
                        border: '1px solid rgba(100,116,139,0.2)',
                        borderRadius: 10, overflow: 'hidden',
                    }, children: [_jsxs("div", { style: {
                                padding: '10px 16px', borderBottom: '1px solid rgba(100,116,139,0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                            }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#94a3b8' }, children: "Synthesized Answer" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 9, color: '#475569' }, children: "Confidence" }), _jsx("span", { style: {
                                                fontSize: 10, fontWeight: 700, color: confidence.color,
                                                background: `${confidence.color}18`,
                                                border: `1px solid ${confidence.color}44`,
                                                borderRadius: 4, padding: '2px 8px',
                                            }, children: confidence.label })] })] }), _jsx("div", { style: { padding: '14px 16px', fontSize: 12, color: '#e2e8f0', lineHeight: 1.65 }, children: result.synthesized }), _jsx("div", { style: {
                                padding: '8px 16px', borderTop: '1px solid rgba(100,116,139,0.08)',
                                display: 'flex', gap: 16, flexWrap: 'wrap',
                            }, children: [
                                { label: 'Model', value: result.model },
                                { label: 'Workers', value: String(result.workerCount) },
                                { label: 'Variance', value: result.variance.toFixed(3) },
                            ].map(m => (_jsxs("div", { children: [_jsxs("span", { style: { fontSize: 9, color: '#475569' }, children: [m.label, ": "] }), _jsx("span", { style: { fontSize: 10, color: '#94a3b8', fontWeight: 600 }, children: m.value })] }, m.label))) }), result.variance >= 1 && (_jsx("div", { style: {
                                margin: '0 16px 12px',
                                background: 'rgba(245,158,11,0.08)',
                                border: '1px solid rgba(245,158,11,0.3)',
                                borderRadius: 6, padding: '7px 12px',
                                fontSize: 10, color: '#fbbf24',
                            }, children: "High variance - consider escalating to flagship" })), _jsxs("details", { style: { margin: '0 16px 14px' }, children: [_jsxs("summary", { style: {
                                        fontSize: 10, fontWeight: 600, color: '#64748b',
                                        cursor: 'pointer', padding: '4px 0', userSelect: 'none',
                                    }, children: ["Worker responses (", result.workerResponses.length, ")"] }), _jsx("div", { style: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }, children: result.workerResponses.map((resp, i) => (_jsxs("div", { style: {
                                            background: 'rgba(15,23,42,0.5)',
                                            border: '1px solid rgba(100,116,139,0.12)',
                                            borderRadius: 6, padding: '8px 10px',
                                        }, children: [_jsxs("div", { style: { fontSize: 9, color: '#475569', marginBottom: 4 }, children: ["Worker ", i + 1] }), _jsx("div", { style: { fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }, children: resp })] }, i))) })] })] })), status === 'error' && errorMsg && (_jsxs("div", { style: {
                        background: 'rgba(127,29,29,0.15)',
                        border: '1px solid rgba(248,113,113,0.3)',
                        borderRadius: 8, padding: '12px 16px',
                    }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 6 }, children: "Dispatch Error" }), _jsx("div", { style: { fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }, children: errorMsg })] }))] }) }));
}
