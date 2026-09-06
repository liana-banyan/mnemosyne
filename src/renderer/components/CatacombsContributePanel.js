import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CatacombsContributePanel -- Member contribution form for Catacombs
 * BP087 Wave 5
 *
 * 2-of-3 corroboration pipeline: Star Chamber + Triple Scrambler + Keys & Engines
 */
import { useState } from 'react';
// ---- Constants --------------------------------------------------------------
const MMLU_SLUGS = [
    '01_biology',
    '02_business',
    '03_chemistry',
    '04_computer_science',
    '05_economics',
    '06_engineering',
    '07_health',
    '08_history',
    '09_law',
    '10_math',
    '11_other',
    '12_philosophy',
    '13_physics',
    '14_psychology',
];
const SLUG_LABELS = {
    '01_biology': 'Biology',
    '02_business': 'Business',
    '03_chemistry': 'Chemistry',
    '04_computer_science': 'Computer Science',
    '05_economics': 'Economics',
    '06_engineering': 'Engineering',
    '07_health': 'Health',
    '08_history': 'History',
    '09_law': 'Law',
    '10_math': 'Math',
    '11_other': 'Other',
    '12_philosophy': 'Philosophy',
    '13_physics': 'Physics',
    '14_psychology': 'Psychology',
};
// ---- Styles -----------------------------------------------------------------
const S = {
    panel: {
        background: '#0d1526',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 10,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxWidth: 560,
        width: '100%',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 14,
        fontWeight: 700,
        color: '#6ee7b7',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#475569',
        cursor: 'pointer',
        fontSize: 16,
        padding: '2px 6px',
    },
    label: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 4,
        display: 'block',
    },
    select: {
        width: '100%',
        background: '#111827',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 12,
        padding: '6px 10px',
        outline: 'none',
    },
    textarea: {
        width: '100%',
        background: '#111827',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 11,
        padding: '8px 10px',
        resize: 'vertical',
        fontFamily: 'monospace',
        minHeight: 120,
        outline: 'none',
        boxSizing: 'border-box',
    },
    input: {
        width: '100%',
        background: '#111827',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 12,
        padding: '6px 10px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    submitBtn: (disabled) => ({
        background: disabled ? 'rgba(110,231,183,0.05)' : 'rgba(110,231,183,0.12)',
        border: '1px solid rgba(110,231,183,0.3)',
        borderRadius: 6,
        color: disabled ? '#475569' : '#6ee7b7',
        fontSize: 12,
        fontWeight: 700,
        padding: '8px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        alignSelf: 'flex-start',
    }),
    pipelineRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
    },
    chip: (status) => {
        const colorMap = {
            pending: 'rgba(100,116,139,0.3)',
            running: 'rgba(250,204,21,0.25)',
            green: 'rgba(34,197,94,0.25)',
            red: 'rgba(239,68,68,0.25)',
        };
        const textMap = {
            pending: '#64748b',
            running: '#fbbf24',
            green: '#4ade80',
            red: '#f87171',
        };
        return {
            background: colorMap[status],
            color: textMap[status],
            borderRadius: 12,
            padding: '2px 10px',
            fontSize: 10,
            fontWeight: 700,
        };
    },
    successBox: {
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 11,
        color: '#4ade80',
        lineHeight: 1.5,
    },
    errorBox: {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 11,
        color: '#f87171',
        lineHeight: 1.5,
    },
};
// ---- Chip label helpers -----------------------------------------------------
function chipLabel(status) {
    if (status === 'pending')
        return 'pending';
    if (status === 'running')
        return 'checking...';
    return status.toUpperCase();
}
// ---- Component --------------------------------------------------------------
export function CatacombsContributePanel({ defaultSlug, onSuccess, onClose }) {
    const [slug, setSlug] = useState(defaultSlug ?? MMLU_SLUGS[0]);
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [pipeline, setPipeline] = useState({
        star_chamber: 'pending',
        scrambler: 'pending',
        keys_engines: 'pending',
    });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    async function handleSubmit() {
        if (!content.trim() || submitting)
            return;
        setSubmitting(true);
        setResult(null);
        setError(null);
        setPipeline({ star_chamber: 'running', scrambler: 'running', keys_engines: 'running' });
        try {
            // Invoke IPC handler
            const res = await window.electronAPI?.catacombsContribute?.(slug, content, 'anonymous')
                ?? await window.ipcRenderer?.invoke?.('catacombs:contribute', slug, content, 'anonymous');
            if (!res) {
                throw new Error('IPC unavailable');
            }
            const typed = res;
            setPipeline({
                star_chamber: typed.corroboration.star_chamber === 'GREEN' ? 'green' : 'red',
                scrambler: typed.corroboration.scrambler === 'GREEN' ? 'green' : 'red',
                keys_engines: typed.corroboration.keys_engines === 'GREEN' ? 'green' : 'red',
            });
            setResult(typed);
            if (typed.verdict === 'GREEN' && onSuccess) {
                onSuccess(typed);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setPipeline({ star_chamber: 'red', scrambler: 'red', keys_engines: 'red' });
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs("div", { style: S.panel, children: [_jsxs("div", { style: S.header, children: [_jsx("span", { style: S.title, children: "Submit Eblet for Corroboration" }), onClose && (_jsx("button", { style: S.closeBtn, onClick: onClose, "aria-label": "Close", children: "x" }))] }), _jsxs("div", { children: [_jsx("label", { style: S.label, children: "Category" }), _jsx("select", { style: S.select, value: slug, onChange: (e) => setSlug(e.target.value), disabled: submitting, children: MMLU_SLUGS.map((s) => (_jsx("option", { value: s, children: SLUG_LABELS[s] ?? s }, s))) })] }), _jsxs("div", { children: [_jsx("label", { style: S.label, children: "Title (optional)" }), _jsx("input", { style: S.input, type: "text", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Short descriptive title...", disabled: submitting })] }), _jsxs("div", { children: [_jsx("label", { style: S.label, children: "Eblet JSON Content" }), _jsx("textarea", { style: S.textarea, value: content, onChange: (e) => setContent(e.target.value), placeholder: "Paste your Eblet JSON content here...", disabled: submitting, rows: 6 })] }), _jsx("button", { style: S.submitBtn(!content.trim() || submitting), onClick: handleSubmit, disabled: !content.trim() || submitting, children: submitting ? 'Submitting...' : 'Submit for Corroboration' }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx("div", { style: { fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }, children: "PIPELINE STATUS" }), [
                        { key: 'star_chamber', label: 'Star Chamber' },
                        { key: 'scrambler', label: 'Triple Scrambler' },
                        { key: 'keys_engines', label: 'Keys and Engines' },
                    ].map(({ key, label }) => (_jsxs("div", { style: S.pipelineRow, children: [_jsx("span", { style: { color: '#64748b', minWidth: 140, fontSize: 11 }, children: label }), _jsx("span", { style: S.chip(pipeline[key]), children: chipLabel(pipeline[key]) })] }, key)))] }), result && result.verdict === 'GREEN' && (_jsxs("div", { style: S.successBox, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 4 }, children: "Corroboration passed -- Eblet published!" }), _jsxs("div", { children: ["Category: ", _jsx("strong", { children: SLUG_LABELS[slug] ?? slug })] }), result.soccerball_hash && (_jsxs("div", { children: ["Soccerball hash: ", _jsxs("code", { children: [result.soccerball_hash.slice(0, 16), "..."] })] })), _jsxs("div", { style: { marginTop: 4, color: '#22c55e' }, children: [result.corroboration.green_count, "/3 verdicts GREEN"] })] })), result && result.verdict === 'RED' && (_jsxs("div", { style: S.errorBox, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 4 }, children: "Corroboration failed." }), _jsxs("div", { children: ["Eblet remains staged in 15_USER. ", result.corroboration.green_count, "/3 verdicts GREEN."] }), result.error && _jsxs("div", { style: { marginTop: 4 }, children: ["Error: ", result.error] })] })), error && (_jsxs("div", { style: S.errorBox, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 4 }, children: "Submission error" }), _jsx("div", { children: error })] }))] }));
}
