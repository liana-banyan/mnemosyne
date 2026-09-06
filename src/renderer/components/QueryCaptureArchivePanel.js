import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// QueryCaptureArchivePanel.tsx -- D-BP151-037/BISHOP/seg-query-capture-archive
//
// ATTRIBUTED: Founder, BP151, verbatim: "can I keep the queries made as entries on an Eblet?
// like we do already in Mnemosynec - that works, but allow me not just to clear, but to
// archive, or delete, so I have ultimate control as a user."
//
// Self-contained settings section, same mounting convention as NexusAuthoritySettings.tsx
// (own state, own IPC calls via window.amplify.queryCapture.*, no parent-managed state).
//
// THE CONSENT SURFACE. Founder's own words on the original Chrome ticket: "if I agree to it."
// This panel IS that surface for the two capture paths this ticket wires (Ask tab, askGoogle):
// a plain-language on/off switch, defaulting to OFF (query_capture_settings.ts fails closed),
// reachable here at any time -- not a one-time first-run modal.
//
// NO CONSOLE OUTPUT ABOUT THE SWITCH. Per query_capture_settings.ts's header (electron-log
// mirrors renderer console.* to a persistent file via `log.initialize({ preload: true })`,
// src/main/index.ts:47-50), this component never logs the enabled state or a toggle event.
import { useState, useEffect, useCallback } from 'react';
const SOURCE_LABEL = {
    ask_tab: 'Ask tab',
    ask_google: 'MnemosyneC → Google',
};
function formatWhen(iso) {
    try {
        return new Date(iso).toLocaleString();
    }
    catch {
        return iso;
    }
}
export function QueryCaptureArchivePanel() {
    const [enabled, setEnabled] = useState(null); // null = not yet loaded
    const [entries, setEntries] = useState([]);
    const [filter, setFilter] = useState('active');
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const refresh = useCallback(async () => {
        if (!window.amplify?.queryCapture)
            return;
        setLoading(true);
        setError(null);
        try {
            const enabledRes = await window.amplify.queryCapture.getEnabled();
            if (enabledRes.ok)
                setEnabled(enabledRes.enabled === true);
            const res = filter === 'search'
                ? await window.amplify.queryCapture.find(searchText)
                : await window.amplify.queryCapture.list(filter);
            if (res.ok && res.entries) {
                setEntries(res.entries);
            }
            else if (!res.ok) {
                setError(res.error ?? 'Failed to load query captures.');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setLoading(false);
        }
    }, [filter, searchText]);
    useEffect(() => {
        if (expanded)
            void refresh();
        // Deliberately no dependency on `enabled` -- toggling is a separate explicit action below,
        // not something this effect should re-trigger on its own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded, filter]);
    const handleToggle = useCallback(async () => {
        if (!window.amplify?.queryCapture || enabled === null)
            return;
        const next = !enabled;
        const res = await window.amplify.queryCapture.setEnabled(next);
        if (res.ok)
            setEnabled(res.enabled === true);
        else
            setError(res.error ?? 'Failed to update the switch.');
    }, [enabled]);
    const handleSetStatus = useCallback(async (id, status) => {
        if (!window.amplify?.queryCapture)
            return;
        const res = await window.amplify.queryCapture.setStatus(id, status);
        if (res.ok)
            void refresh();
        else
            setError(res.error ?? 'Failed to update this entry.');
    }, [refresh]);
    const handleDelete = useCallback(async (id, question) => {
        if (!window.amplify?.queryCapture)
            return;
        const preview = question.length > 60 ? `${question.slice(0, 60)}…` : question;
        const ok = window.confirm(`Delete this query permanently?\n\n"${preview}"\n\nThis cannot be undone -- Clear or Archive keep the record; Delete does not.`);
        if (!ok)
            return;
        const res = await window.amplify.queryCapture.remove(id);
        if (res.ok)
            void refresh();
        else
            setError(res.error ?? 'Failed to delete this entry.');
    }, [refresh]);
    return (_jsxs("section", { style: {
            background: '#0d1117',
            border: '1px solid #1e2a38',
            borderRadius: 10,
            padding: '16px 18px',
            marginBottom: 16,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }, onClick: () => setExpanded((v) => !v), children: [_jsxs("div", { children: [_jsx("h3", { style: { margin: 0, fontSize: 14, fontWeight: 700, color: '#f0fdf4' }, children: "Query Capture Archive" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginTop: 2 }, children: "Keep the queries you compose so you never have to retype one. Clear, archive, or delete -- your choice." })] }), _jsx("span", { style: { color: '#64748b', fontSize: 12 }, children: expanded ? '▲' : '▼' })] }), expanded && (_jsxs("div", { style: { marginTop: 14 }, children: [_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: '#111827', border: '1px solid #1e2a38', borderRadius: 8,
                            padding: '10px 12px', marginBottom: 14,
                        }, children: [_jsxs("div", { style: { maxWidth: 420 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0' }, children: "Remember my queries" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginTop: 2 }, children: "When ON, MnemosyneC keeps a copy of what you type into Ask, and what it asks Google on your behalf, so you can find it again later. When OFF (the default), nothing is captured. Turn this on or off at any time." })] }), _jsx("button", { type: "button", onClick: handleToggle, disabled: enabled === null, "aria-pressed": enabled === true, style: {
                                    background: enabled ? '#059669' : '#1e2a38',
                                    border: 'none',
                                    borderRadius: 999,
                                    width: 44,
                                    height: 24,
                                    position: 'relative',
                                    cursor: enabled === null ? 'default' : 'pointer',
                                    flexShrink: 0,
                                    outline: 'none',
                                }, title: enabled ? 'Substrate Processing: ON -- click to turn off' : 'Substrate Processing: OFF -- click to turn on', children: _jsx("span", { style: {
                                        position: 'absolute',
                                        top: 3,
                                        left: enabled ? 23 : 3,
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        background: '#fff',
                                        transition: 'left 0.15s',
                                    } }) })] }), error && (_jsx("div", { style: { fontSize: 11, color: '#fca5a5', marginBottom: 10 }, children: error })), _jsxs("div", { style: { display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }, children: [['active', 'cleared', 'archived'].map((f) => (_jsx("button", { type: "button", onClick: () => setFilter(f), style: {
                                    background: filter === f ? '#1e2a38' : 'none',
                                    border: '1px solid #334155',
                                    borderRadius: 5,
                                    color: filter === f ? '#e2e8f0' : '#94a3b8',
                                    fontSize: 11,
                                    padding: '3px 10px',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                }, children: f }, f))), _jsx("input", { type: "text", placeholder: "Search your queries\u2026", value: searchText, onChange: (e) => setSearchText(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') {
                                    setFilter('search');
                                    void refresh();
                                } }, style: {
                                    background: '#111827', border: '1px solid #334155', borderRadius: 5,
                                    color: '#e2e8f0', fontSize: 11, padding: '4px 8px', flex: 1, minWidth: 140, outline: 'none',
                                } }), _jsx("button", { type: "button", onClick: () => { setFilter('search'); void refresh(); }, style: { background: 'none', border: '1px solid #334155', borderRadius: 5, color: '#94a3b8', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }, children: "Search" })] }), loading && _jsx("div", { style: { fontSize: 11, color: '#64748b' }, children: "Loading\u2026" }), !loading && entries.length === 0 && (_jsx("div", { style: { fontSize: 11, color: '#64748b', fontStyle: 'italic' }, children: enabled ? 'No queries here yet.' : 'Nothing captured -- "Remember my queries" is off.' })), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }, children: entries.map((e) => (_jsxs("div", { style: {
                                background: '#111827', border: '1px solid #1e2a38', borderRadius: 7,
                                padding: '8px 10px', fontSize: 12,
                            }, children: [_jsx("div", { style: { color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 4 }, children: e.question }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsxs("span", { style: { fontSize: 10, color: '#64748b' }, children: [SOURCE_LABEL[e.source], e.authority ? ` · ${e.authority}` : '', " \u00B7 ", formatWhen(e.capturedAt)] }), _jsx("span", { style: { flex: 1 } }), e.status !== 'active' && (_jsx("button", { type: "button", onClick: () => handleSetStatus(e.id, 'active'), style: pillBtn, children: "Restore" })), e.status !== 'cleared' && (_jsx("button", { type: "button", onClick: () => handleSetStatus(e.id, 'cleared'), style: pillBtn, children: "Clear" })), e.status !== 'archived' && (_jsx("button", { type: "button", onClick: () => handleSetStatus(e.id, 'archived'), style: pillBtn, children: "Archive" })), _jsx("button", { type: "button", onClick: () => handleDelete(e.id, e.question), style: { ...pillBtn, borderColor: '#7f1d1d', color: '#fca5a5' }, children: "Delete" })] })] }, e.id))) })] }))] }));
}
const pillBtn = {
    background: 'none',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#94a3b8',
    fontSize: 10,
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
};
