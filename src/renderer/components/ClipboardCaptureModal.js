import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ClipboardCaptureModal.tsx — SEG-5 v0.1.59 BP081
// Clipboard Q+A capture → MnemosyneC substrate dispatch.
// Triggered by: tray menu "Send last copied as Q+A → MnemosyneC"
//               or Ctrl+Shift+M when dashboard window is focused.
import { useCallback, useEffect, useRef, useState } from 'react';
function parseClipboard(text) {
    // Try explicit Q: / A: or Question: / Answer: markers
    const qaRe = /(?:^|\n)\s*(?:Q(?:uestion)?)[:\.\s]+([^\n]+(?:\n(?!A(?:nswer)?[:\.\s]).+)*)\s*\n\s*(?:A(?:nswer)?)[:\.\s]+([\s\S]+)$/im;
    const qaMatch = text.match(qaRe);
    if (qaMatch) {
        return { question: qaMatch[1].trim(), answer: qaMatch[2].trim() };
    }
    // Try ChatGPT-style turns: two blocks separated by one or more blank lines
    const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    if (blocks.length >= 2) {
        return { question: blocks[0], answer: blocks.slice(1).join('\n\n') };
    }
    // Single block — put everything in question, leave answer empty for user
    return { question: text.trim(), answer: '' };
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.74)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
    },
    modal: {
        width: 520,
        maxWidth: '92vw',
        maxHeight: '82vh',
        overflowY: 'auto',
        background: '#0f1726',
        border: '1px solid rgba(110,231,183,0.25)',
        borderRadius: 12,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#e2e8f0',
    },
    title: {
        fontSize: 16,
        fontWeight: 700,
        color: '#6ee7b7',
        margin: 0,
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        margin: '4px 0 0',
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: '#94a3b8',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 4,
        display: 'block',
    },
    textarea: {
        width: '100%',
        minHeight: 72,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 8,
        color: '#e2e8f0',
        fontSize: 13,
        fontFamily: 'inherit',
        resize: 'vertical',
        boxSizing: 'border-box',
        lineHeight: 1.5,
        outline: 'none',
    },
    toggleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        color: '#94a3b8',
        cursor: 'pointer',
        userSelect: 'none',
    },
    checkbox: {
        accentColor: '#6ee7b7',
        width: 15,
        height: 15,
        cursor: 'pointer',
        flexShrink: 0,
    },
    btnRow: {
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    primaryBtn: (disabled) => ({
        padding: '10px 20px',
        background: disabled ? 'rgba(110,231,183,0.04)' : 'rgba(110,231,183,0.14)',
        border: disabled ? '1px solid rgba(110,231,183,0.15)' : '1px solid rgba(110,231,183,0.4)',
        borderRadius: 8,
        color: disabled ? '#475569' : '#6ee7b7',
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
    }),
    cancelBtn: {
        padding: '10px 16px',
        background: 'transparent',
        border: '1px solid rgba(100,116,139,0.28)',
        borderRadius: 8,
        color: '#64748b',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    successBox: {
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid rgba(110,231,183,0.3)',
        background: 'rgba(110,231,183,0.06)',
        color: '#6ee7b7',
        fontSize: 13,
        lineHeight: 1.5,
    },
    errorBox: {
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid rgba(239,68,68,0.3)',
        background: 'rgba(239,68,68,0.05)',
        color: '#f87171',
        fontSize: 13,
        lineHeight: 1.5,
    },
    spinner: {
        display: 'inline-block',
        fontSize: 12,
        color: '#6ee7b7',
        animation: 'mnemo-pulse 1.4s ease-in-out infinite',
    },
};
// BP134 Yoke #32 Phase D: same 14-domain + 'other' list TestItOutTab.tsx already uses for the
// Plow the Field domain picker -- replaces the previous silent hardcoded 'other' with a real
// user choice. R-MECHANISM-VERIFY note: runAndonReplowLoop() looks the pasted question up
// verbatim in that domain's SEALED bank (per_domain_q_banks.ts); clipboard-pasted text is
// virtually never a byte-for-byte bank entry regardless of which domain is selected here, so
// the concordance path will usually still quarantine with "Question not found in domain bank"
// (an honest, already-correct error message, not a bug this Yoke introduces or silently
// papers over) -- this control lets the user's choice at least be recorded/deliberate instead
// of always being the wrong-by-default 'other', and matters once/if a future Yoke extends
// concordance to grade non-bank questions.
const DOMAIN_OPTIONS = [
    'math', 'physics', 'chemistry', 'biology', 'computer_science', 'engineering',
    'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'health', 'other',
];
// ─── Component ────────────────────────────────────────────────────────────────
export function ClipboardCaptureModal() {
    const [visible, setVisible] = useState(false);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [domain, setDomain] = useState('other');
    const [markVerified, setMarkVerified] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const unsubRef = useRef(null);
    const openModal = useCallback(async () => {
        setResult(null);
        setSubmitting(false);
        setMarkVerified(false);
        setDomain('other');
        // Read clipboard via IPC
        let text = '';
        try {
            const raw = await window.amplify?.readClipboard?.();
            text = typeof raw === 'string' ? raw.trim() : '';
        }
        catch { /* noop */ }
        if (!text) {
            setQuestion('');
            setAnswer('');
            setResult({ status: 'error', message: 'No text in clipboard. Copy a Q+A pair first.' });
            setVisible(true);
            return;
        }
        const parsed = parseClipboard(text);
        setQuestion(parsed.question);
        setAnswer(parsed.answer);
        setVisible(true);
    }, []);
    // Register IPC event listener for clipboard:capture-qa
    useEffect(() => {
        const unsub = window.amplify?.onClipboardCaptureQA?.(() => {
            void openModal();
        });
        unsubRef.current = unsub ?? null;
        return () => { unsubRef.current?.(); };
    }, [openModal]);
    const handleClose = useCallback(() => {
        setVisible(false);
        setResult(null);
        setSubmitting(false);
    }, []);
    const handleSubmit = useCallback(async () => {
        if (!question.trim() || !answer.trim() || submitting)
            return;
        setSubmitting(true);
        setResult(null);
        try {
            if (markVerified) {
                // Mark-verified path: skip concordance, write directly to substrate
                const res = await window.amplify?.substrateWrite?.(`Q: ${question.trim()}\nA: ${answer.trim()}`, 'clipboard-capture', ['clipboard']);
                if (res?.ok) {
                    setResult({ status: 'success', eblets: 1 });
                }
                else {
                    setResult({ status: 'error', message: 'Substrate write failed. Please retry.' });
                }
            }
            else {
                // Concordance path: run through Andon plow (grades answer via local model).
                // BP134 Yoke #32 Phase D: domain now comes from the picker below, not a hardcode.
                const res = await window.amplify?.runAndonReplowLoop?.(question.trim(), domain);
                if (!res) {
                    setResult({ status: 'error', message: 'Plow IPC unavailable — check that MnemosyneC is fully started.' });
                }
                else if (res.verdict === 'verified') {
                    setResult({ status: 'success', eblets: res.ebletWritten ? 1 : 0 });
                }
                else if (res.verdict === 'rejected') {
                    setResult({
                        status: 'error',
                        message: 'Concordance rejected this answer. Try editing the Q or A, or enable "Mark as verified" to bypass concordance.',
                    });
                }
                else {
                    setResult({
                        status: 'error',
                        message: res.error ?? 'Plow quarantined this entry. Check that Ollama is running.',
                    });
                }
            }
        }
        catch (err) {
            setResult({ status: 'error', message: String(err) });
        }
        finally {
            setSubmitting(false);
        }
    }, [question, answer, domain, markVerified, submitting]);
    if (!visible)
        return null;
    const isEmptyClipboard = result?.status === 'error' &&
        result.message.startsWith('No text in clipboard');
    return (_jsx("div", { style: S.backdrop, onClick: (e) => { if (e.target === e.currentTarget)
            handleClose(); }, children: _jsxs("div", { style: S.modal, children: [_jsxs("div", { children: [_jsx("h3", { style: S.title, children: "Send to MnemosyneC \uD83C\uDF3E" }), _jsx("p", { style: S.subtitle, children: "Review the Q+A pair before sending to your substrate." })] }), result?.status === 'success' ? (_jsxs(_Fragment, { children: [_jsx("div", { style: S.successBox, children: result.eblets > 0
                                ? `Eblet written ✓ · Substrate +${result.eblets}`
                                : 'Processed ✓ · Eblet already in substrate or was not verifiable by concordance.' }), _jsx("div", { style: S.btnRow, children: _jsx("button", { type: "button", style: S.primaryBtn(false), onClick: handleClose, children: "Done" }) })] })) : isEmptyClipboard ? (
                /* Empty clipboard state */
                _jsxs(_Fragment, { children: [_jsx("div", { style: S.errorBox, children: result?.message }), _jsx("div", { style: S.btnRow, children: _jsx("button", { type: "button", style: S.cancelBtn, onClick: handleClose, children: "Close" }) })] })) : (
                /* Edit + submit state */
                _jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("span", { style: S.fieldLabel, children: "Question" }), _jsx("textarea", { style: S.textarea, value: question, onChange: (e) => setQuestion(e.target.value), placeholder: "Paste or type a question here\u2026", rows: 3, disabled: submitting })] }), _jsxs("div", { children: [_jsx("span", { style: S.fieldLabel, children: "Answer" }), _jsx("textarea", { style: S.textarea, value: answer, onChange: (e) => setAnswer(e.target.value), placeholder: "Paste or type the answer here\u2026", rows: 3, disabled: submitting })] }), _jsxs("div", { children: [_jsx("span", { style: S.fieldLabel, children: "Domain" }), _jsx("select", { style: S.textarea, value: domain, onChange: (e) => setDomain(e.target.value), disabled: submitting || markVerified, children: DOMAIN_OPTIONS.map((d) => (_jsx("option", { value: d, children: d }, d))) })] }), _jsxs("label", { style: S.toggleRow, children: [_jsx("input", { type: "checkbox", style: S.checkbox, checked: markVerified, onChange: (e) => setMarkVerified(e.target.checked), disabled: submitting }), _jsx("span", { children: "Mark as verified \u2014 skip concordance and write directly" })] }), result?.status === 'error' && (_jsx("div", { style: S.errorBox, children: result.message })), _jsxs("div", { style: S.btnRow, children: [_jsx("button", { type: "button", style: S.primaryBtn(submitting || !question.trim() || !answer.trim()), disabled: submitting || !question.trim() || !answer.trim(), onClick: () => { void handleSubmit(); }, children: submitting ? (_jsxs(_Fragment, { children: [_jsx("span", { style: S.spinner, children: "\u25CC" }), ' ', "Sending\u2026"] })) : ('Send to MnemosyneC 🌾') }), _jsx("button", { type: "button", style: S.cancelBtn, onClick: handleClose, disabled: submitting, children: "Cancel" })] })] }))] }) }));
}
