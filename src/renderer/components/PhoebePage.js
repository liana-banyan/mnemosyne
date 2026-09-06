import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// PhoebePage™ — Idea Storage with IPC
// SAGA-45 · BP054 close-stretch canon mint
// C.17 · BP055: IPC layer wired (save-idea + get-ideas handlers in src/main/index.ts)
// Integration note: wire as a new tab in MnemosyneTabView (TabId: 'phoebe') or
// as a new View in App.tsx (View: 'phoebe') with hash '#/phoebe'.
import { useState, useEffect, useCallback } from 'react';
export function PhoebePage() {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [ideas, setIdeas] = useState([]);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);
    const loadIdeas = useCallback(async () => {
        if (!window.amplify?.getIdeas)
            return;
        const result = await window.amplify.getIdeas();
        if (result.ok)
            setIdeas(result.ideas);
    }, []);
    useEffect(() => { loadIdeas(); }, [loadIdeas]);
    const handleSave = async () => {
        if (!title.trim() && !content.trim())
            return;
        if (!window.amplify?.saveIdea) {
            setStatus('IPC bridge not available — run in Electron');
            return;
        }
        setSaving(true);
        setStatus(null);
        try {
            const result = await window.amplify.saveIdea({
                title: title.trim(),
                content: content.trim(),
                timestamp: new Date().toISOString(),
            });
            if (result.ok) {
                setTitle('');
                setContent('');
                setStatus('Idea saved.');
                await loadIdeas();
            }
        }
        finally {
            setSaving(false);
        }
    };
    const inputStyle = {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(110,231,183,0.2)',
        borderRadius: 6,
        padding: '8px 12px',
        color: '#e2e8f0',
        fontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        outline: 'none',
        boxSizing: 'border-box',
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 320,
            padding: 24,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: '#0a0f1a',
            gap: 16,
            overflowY: 'auto',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("span", { style: { fontSize: 24, lineHeight: 1 }, children: "\uD83E\uDEB6" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }, children: "Phoebe\u2122 \u2014 Idea Storage" }), _jsx("div", { style: { fontSize: 11, color: '#6ee7b7', fontWeight: 500 }, children: "Your ideas, preserved. Forever." })] })] }), _jsx("div", { style: { height: 1, background: 'rgba(110,231,183,0.15)' } }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "Idea title (optional)", style: inputStyle }), _jsx("textarea", { value: content, onChange: e => setContent(e.target.value), placeholder: "Write your idea here...", rows: 4, style: { ...inputStyle, resize: 'vertical', lineHeight: 1.6 } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("button", { onClick: handleSave, disabled: saving || (!title.trim() && !content.trim()), style: {
                                    padding: '7px 18px',
                                    background: saving ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.7)',
                                    border: '1px solid rgba(99,102,241,0.5)',
                                    borderRadius: 6,
                                    color: '#e2e8f0',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    letterSpacing: '0.03em',
                                }, children: saving ? 'Saving…' : 'Save Idea' }), status && (_jsx("span", { style: { fontSize: 11, color: '#6ee7b7' }, children: status }))] })] }), ideas.length > 0 && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }, children: [_jsxs("div", { style: { fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }, children: ["Saved Ideas (", ideas.length, ")"] }), ideas.map(idea => (_jsxs("div", { style: {
                            padding: '10px 12px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(110,231,183,0.1)',
                            borderRadius: 6,
                        }, children: [idea.title && (_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }, children: idea.title })), _jsx("div", { style: { fontSize: 12, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }, children: idea.content }), _jsx("div", { style: { fontSize: 10, color: '#334155', marginTop: 6 }, children: new Date(idea.timestamp).toLocaleString() })] }, idea.id)))] })), ideas.length === 0 && (_jsx("div", { style: { fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 16, lineHeight: 1.8 }, children: "No ideas saved yet. Your ideas are stored locally \u2014 no cloud required." }))] }));
}
export default PhoebePage;
