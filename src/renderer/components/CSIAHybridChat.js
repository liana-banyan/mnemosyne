import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
// CSIAHybridChat.tsx -- CSIA-Hybrid Inference UI
// MnemosyneC v0.8.0 · BP094
//
// Cooperative-Substrate Inference Architecture chat surface.
// Calls window.amplify.csia.query (Electron IPC -> src/main/csia_hybrid/inference_pipeline.ts).
// Displays ANSWER/REFUSAL verdict with provenance chain and triple-verification badges.
// Renderer-native version: inline styles only (no Tailwind).
import { useState } from 'react';
// ---- Styles -----------------------------------------------------------------
const S = {
    root: {
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '28px 24px',
        boxSizing: 'border-box',
    },
    inner: {
        maxWidth: 720,
        margin: '0 auto',
    },
    header: {
        marginBottom: 28,
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
    },
    badge: {
        width: 32,
        height: 32,
        borderRadius: 6,
        background: 'rgba(245,158,11,0.15)',
        border: '1px solid rgba(245,158,11,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: 700,
    },
    h1: {
        fontSize: 18,
        fontWeight: 700,
        color: '#f4f4f5',
        margin: 0,
    },
    versionPill: {
        fontSize: 11,
        fontFamily: 'monospace',
        background: 'rgba(120,53,15,0.35)',
        color: '#fcd34d',
        border: '1px solid rgba(120,53,15,0.6)',
        padding: '2px 7px',
        borderRadius: 4,
    },
    subtitle: {
        fontSize: 12,
        color: '#71717a',
        margin: 0,
    },
    textarea: {
        width: '100%',
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: 13,
        color: '#f4f4f5',
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        minHeight: 80,
    },
    submitBtn: (disabled) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 18px',
        background: disabled ? '#3f3f46' : '#d97706',
        color: disabled ? '#71717a' : '#09090b',
        border: 'none',
        borderRadius: 7,
        fontWeight: 700,
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s',
        fontFamily: 'inherit',
    }),
    errorBox: {
        marginBottom: 12,
        padding: '12px 14px',
        background: 'rgba(127,29,29,0.2)',
        border: '1px solid #7f1d1d',
        borderRadius: 8,
        fontSize: 13,
        color: '#fca5a5',
    },
    verdictRow: (isAnswer) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${isAnswer ? '#065f46' : '#7f1d1d'}`,
        background: isAnswer ? 'rgba(6,78,59,0.2)' : 'rgba(127,29,29,0.2)',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 8,
    }),
    verdictLabel: (isAnswer) => ({
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'monospace',
        color: isAnswer ? '#34d399' : '#f87171',
    }),
    badgesRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    answerBox: {
        padding: '14px 16px',
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 13,
        color: '#e4e4e7',
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
    },
    refusalBox: {
        padding: '14px 16px',
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 8,
        marginBottom: 12,
    },
    refusalLabel: {
        fontSize: 10,
        color: '#71717a',
        fontFamily: 'monospace',
        marginBottom: 4,
    },
    refusalText: {
        fontSize: 13,
        color: '#a1a1aa',
    },
    metaRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 16px',
        fontSize: 11,
        color: '#52525b',
        fontFamily: 'monospace',
        marginBottom: 12,
    },
    provenanceWrap: {
        border: '1px solid #3f3f46',
        borderRadius: 8,
        overflow: 'hidden',
    },
    provenanceToggle: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'rgba(39,39,42,0.6)',
        border: 'none',
        cursor: 'pointer',
        color: '#a1a1aa',
        fontSize: 11,
        fontFamily: 'monospace',
        textAlign: 'left',
    },
    provRow: {
        padding: '10px 14px',
        borderTop: '1px solid #27272a',
        background: 'rgba(9,9,11,0.5)',
    },
    provMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    provIndex: {
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#fbbf24',
    },
    provSlug: {
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#71717a',
        background: '#27272a',
        padding: '1px 6px',
        borderRadius: 3,
    },
    provHash: {
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#059669',
    },
    provContent: {
        fontSize: 12,
        color: '#d4d4d8',
        lineHeight: 1.55,
        marginBottom: 4,
    },
    provContributor: {
        fontSize: 11,
        color: '#52525b',
    },
};
// ---- Verdict pill -----------------------------------------------------------
function VerdictPill({ label, verdict }) {
    const colors = {
        GREEN: { bg: 'rgba(6,78,59,0.35)', text: '#34d399', border: '#065f46' },
        RED: { bg: 'rgba(127,29,29,0.35)', text: '#f87171', border: '#7f1d1d' },
        SKIP: { bg: 'rgba(39,39,42,0.35)', text: '#71717a', border: '#3f3f46' },
    };
    const c = colors[verdict];
    return (_jsxs("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 7px',
            borderRadius: 4,
            border: `1px solid ${c.border}`,
            background: c.bg,
            color: c.text,
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: 600,
        }, children: [verdict === 'GREEN' ? '\u2713' : verdict === 'RED' ? '\u2715' : '\u2013', " ", label, ": ", verdict] }));
}
// ---- Provenance accordion ---------------------------------------------------
function ProvenancePanel({ provenance, systemPrompt }) {
    const [open, setOpen] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    if (provenance.length === 0)
        return null;
    return (_jsxs("div", { style: S.provenanceWrap, children: [_jsxs("button", { style: S.provenanceToggle, onClick: () => setOpen(v => !v), children: [_jsxs("span", { children: ["PROVENANCE CHAIN (", provenance.length, " evidence rows)"] }), _jsx("span", { style: { fontSize: 14 }, children: open ? '\u25b2' : '\u25bc' })] }), open && (_jsxs(_Fragment, { children: [provenance.map((link, i) => (_jsxs("div", { style: S.provRow, children: [_jsxs("div", { style: S.provMeta, children: [_jsxs("span", { style: S.provIndex, children: ["#", i + 1] }), _jsx("span", { style: S.provSlug, children: link.category_slug }), link.soccerball_hash && (_jsxs("span", { style: S.provHash, title: link.soccerball_hash, children: ['\u26bd', " ", link.soccerball_hash.slice(0, 8), "\u2026"] }))] }), _jsx("p", { style: S.provContent, children: link.content_preview }), _jsxs("p", { style: S.provContributor, children: ["Contributor: ", _jsxs("span", { style: { fontFamily: 'monospace' }, children: [link.contributor_member_id.slice(0, 12), "\u2026"] })] })] }, link.evidence_id))), _jsxs("div", { style: { padding: '8px 14px', borderTop: '1px solid #27272a', background: 'rgba(39,39,42,0.25)' }, children: [_jsxs("button", { onClick: () => setShowPrompt(v => !v), style: { background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', fontSize: 11, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }, children: [showPrompt ? '\u25b2' : '\u25bc', " System prompt used"] }), showPrompt && (_jsx("pre", { style: { marginTop: 6, fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', background: '#09090b', padding: '8px 10px', borderRadius: 6, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }, children: systemPrompt }))] })] }))] }));
}
// ---- Main component ---------------------------------------------------------
export function CSIAHybridChat() {
    const [question, setQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const isElectron = typeof window !== 'undefined' && !!window.amplify;
    async function handleSubmit(e) {
        e.preventDefault();
        const q = question.trim();
        if (!q || loading)
            return;
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            if (!isElectron) {
                throw new Error('CSIA-Hybrid requires the MnemosyneC desktop app (Electron). Running in browser mode -- IPC unavailable.');
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const amplify = window.amplify;
            if (!amplify?.csia?.query) {
                throw new Error('csia.query IPC not available -- app may need a restart after update.');
            }
            const res = await amplify.csia.query(q);
            setResult(res);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setLoading(false);
        }
    }
    const canSubmit = question.trim().length > 0 && !loading;
    return (_jsx("div", { style: S.root, children: _jsxs("div", { style: S.inner, children: [_jsxs("div", { style: S.header, children: [_jsxs("div", { style: S.titleRow, children: [_jsx("div", { style: S.badge, children: "M" }), _jsx("h1", { style: S.h1, children: "MnemosyneC CSIA-Hybrid" }), _jsx("span", { style: S.versionPill, children: "v0.8.0" })] }), _jsx("p", { style: S.subtitle, children: "Cooperative-substrate grounded inference. Answers verified by Star Chamber \u00B7 Scrambler \u00B7 Keys Engines." })] }), _jsx("form", { onSubmit: handleSubmit, style: { marginBottom: 20 }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("textarea", { value: question, onChange: e => setQuestion(e.target.value), placeholder: "Ask anything -- answers are grounded in triple-GREEN verified cooperative knowledge...", rows: 3, style: S.textarea, onKeyDown: e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: 11, color: '#52525b', fontFamily: 'monospace' }, children: "Enter to submit \u00B7 Shift+Enter for newline" }), _jsx("button", { type: "submit", disabled: !canSubmit, style: S.submitBtn(!canSubmit), children: loading ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 14 }, children: "\u21BB" }), "Processing..."] })) : (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 13 }, children: "\u2192" }), "Query Substrate"] })) })] })] }) }), error && (_jsx("div", { style: S.errorBox, children: error })), result && (_jsxs("div", { children: [_jsxs("div", { style: S.verdictRow(result.verdict === 'ANSWER'), children: [_jsx("span", { style: S.verdictLabel(result.verdict === 'ANSWER'), children: result.verdict }), _jsxs("div", { style: S.badgesRow, children: [_jsx(VerdictPill, { label: "StarChamber", verdict: result.star_chamber }), _jsx(VerdictPill, { label: "Scrambler", verdict: result.scrambler }), _jsx(VerdictPill, { label: "KeysEngines", verdict: result.keys_engines })] })] }), result.verdict === 'ANSWER' && result.answer && (_jsx("div", { style: S.answerBox, children: result.answer })), result.verdict === 'REFUSAL' && (_jsxs("div", { style: S.refusalBox, children: [_jsx("p", { style: S.refusalLabel, children: "REFUSAL REASON" }), _jsx("p", { style: S.refusalText, children: result.refusal_reason }), _jsx("div", { style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid #27272a' }, children: _jsx("p", { style: { fontSize: 11, color: '#52525b' }, children: "Help improve answers by contributing verified knowledge to the cooperative substrate." }) })] })), _jsxs("div", { style: S.metaRow, children: [_jsxs("span", { children: ["model: ", result.model_used] }), _jsxs("span", { children: ["evidence: ", result.evidence_count, " rows"] }), _jsxs("span", { children: ["GREEN: ", result.green_count, "/3"] }), _jsxs("span", { children: ["elapsed: ", result.elapsed_ms, "ms"] }), _jsxs("span", { children: ["run: ", result.run_id.slice(0, 8), "\u2026"] })] }), _jsx(ProvenancePanel, { provenance: result.provenance, systemPrompt: result.system_prompt_used })] }))] }) }));
}
export default CSIAHybridChat;
