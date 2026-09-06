import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// BatteryDispatchTab — MnemosyneC™ Tab 15 · BP067 Phase 2B
// Cooperative time/energy dispatch system
// Shows battery charge (available cooperative contribution hours this week)
// Reserve vs Spend · dispatch log · local storage · no backend required
import { useState } from 'react';
import { useDeckCue } from '../hooks/useDeckCue';
import { DeckCuePullup } from './DeckCuePullup';
// ─── Local Storage helpers ────────────────────────────────────────────────────
const LS_KEY = 'mnemo_battery_dispatch';
const LS_CAPACITY = 'mnemo_battery_capacity';
const DEFAULT_CAPACITY = 20; // hours/week
function loadEntries() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function saveEntries(entries) {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
}
function loadCapacity() {
    try {
        const raw = localStorage.getItem(LS_CAPACITY);
        return raw ? Number(raw) : DEFAULT_CAPACITY;
    }
    catch {
        return DEFAULT_CAPACITY;
    }
}
// Keep only this week's entries
function thisWeekEntries(entries) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    return entries.filter(e => new Date(e.timestamp) >= monday);
}
// ─── Component ────────────────────────────────────────────────────────────────
export function BatteryDispatchTab() {
    const { cards, showCard, dismissCard, isPullupOpen, closePullup } = useDeckCue();
    const [entries, setEntries] = useState(loadEntries);
    const [capacity, setCapacity] = useState(loadCapacity);
    const [task, setTask] = useState('');
    const [hours, setHours] = useState(1);
    const [note, setNote] = useState('');
    const [type, setType] = useState('spend');
    const [editCapacity, setEditCapacity] = useState(false);
    const [capacityInput, setCapacityInput] = useState(String(loadCapacity()));
    const weekEntries = thisWeekEntries(entries);
    const spent = weekEntries.filter(e => e.type === 'spend').reduce((s, e) => s + e.hours, 0);
    const reserved = weekEntries.filter(e => e.type === 'reserve').reduce((s, e) => s + e.hours, 0);
    const available = Math.max(0, capacity - spent - reserved);
    const chargePercent = Math.round((available / capacity) * 100);
    function dispatch() {
        if (!task.trim() || hours <= 0)
            return;
        const entry = {
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            task: task.trim(),
            hours,
            type,
            note: note.trim(),
            timestamp: new Date().toISOString(),
        };
        const next = [entry, ...entries];
        setEntries(next);
        saveEntries(next);
        setTask('');
        setHours(1);
        setNote('');
        showCard('dispatch');
    }
    function removeEntry(id) {
        const next = entries.filter(e => e.id !== id);
        setEntries(next);
        saveEntries(next);
    }
    function saveCapacity() {
        const v = Math.max(1, Math.min(168, Number(capacityInput) || DEFAULT_CAPACITY));
        setCapacity(v);
        localStorage.setItem(LS_CAPACITY, String(v));
        setEditCapacity(false);
    }
    // Battery charge color
    const chargeColor = chargePercent > 60 ? '#6ee7b7' : chargePercent > 30 ? '#f59e0b' : '#f87171';
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: { padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }, children: _jsxs("div", { style: { maxWidth: 600, margin: '0 auto' }, children: [_jsxs("div", { style: { marginBottom: 20 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }, children: "\u26A1 Battery Dispatch" }), _jsx("div", { style: { fontSize: 11, color: '#475569', lineHeight: 1.6 }, children: "Your cooperative contribution battery for the week. Reserve hours for yourself, spend them for cooperative tasks." })] }), _jsxs("div", { style: { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Charge Level" }), _jsxs("div", { style: { fontSize: 28, fontWeight: 800, color: chargeColor, marginTop: 2 }, children: [chargePercent, "%"] }), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: [available, "h available of ", capacity, "h weekly"] })] }), _jsxs("div", { style: { position: 'relative', width: 60, height: 28 }, children: [_jsx("div", { style: { position: 'absolute', inset: 0, border: `2px solid ${chargeColor}`, borderRadius: 4 } }), _jsx("div", { style: { position: 'absolute', left: 2, top: 2, bottom: 2, width: `${Math.max(4, chargePercent) * 0.54}%`, background: chargeColor, borderRadius: 2, transition: 'width 0.4s ease' } }), _jsx("div", { style: { position: 'absolute', top: '25%', right: -7, width: 5, height: '50%', background: chargeColor, borderRadius: '0 2px 2px 0' } })] })] }), _jsx("div", { style: { height: 8, background: 'rgba(100,116,139,0.15)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }, children: _jsx("div", { style: { height: '100%', width: `${chargePercent}%`, background: `linear-gradient(90deg, ${chargeColor}, ${chargeColor}aa)`, borderRadius: 4, transition: 'width 0.4s ease' } }) }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }, children: [
                                        { label: 'Reserved', value: `${reserved}h`, color: '#38bdf8' },
                                        { label: 'Spent', value: `${spent}h`, color: '#f87171' },
                                        { label: 'Available', value: `${available}h`, color: chargeColor },
                                    ].map(stat => (_jsxs("div", { style: { textAlign: 'center', background: 'rgba(15,23,42,0.4)', borderRadius: 6, padding: '6px 8px' }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: stat.color }, children: stat.value }), _jsx("div", { style: { fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }, children: stat.label })] }, stat.label))) }), _jsx("div", { style: { marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }, children: editCapacity ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 10, color: '#64748b' }, children: "Weekly capacity:" }), _jsx("input", { type: "number", min: 1, max: 168, style: { width: 60, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 4, color: '#e2e8f0', fontSize: 10, padding: '2px 6px', outline: 'none' }, value: capacityInput, onChange: e => setCapacityInput(e.target.value) }), _jsx("span", { style: { fontSize: 10, color: '#64748b' }, children: "hours" }), _jsx("button", { onClick: saveCapacity, style: { background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 4, color: '#6ee7b7', fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: '2px 8px' }, children: "Save" }), _jsx("button", { onClick: () => setEditCapacity(false), style: { background: 'none', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer' }, children: "Cancel" })] })) : (_jsxs("button", { onClick: () => setEditCapacity(true), style: { background: 'none', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }, children: ["Edit weekly capacity (", capacity, "h)"] })) })] }), _jsxs("div", { style: { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }, children: "New Dispatch" }), _jsx("div", { style: { display: 'flex', gap: 6, marginBottom: 12 }, children: ['reserve', 'spend'].map(t => (_jsx("button", { onClick: () => setType(t), style: {
                                            flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                            border: type === t ? `1px solid ${t === 'reserve' ? 'rgba(56,189,248,0.4)' : 'rgba(248,113,113,0.4)'}` : '1px solid rgba(100,116,139,0.2)',
                                            background: type === t ? (t === 'reserve' ? 'rgba(56,189,248,0.1)' : 'rgba(248,113,113,0.1)') : 'transparent',
                                            color: type === t ? (t === 'reserve' ? '#38bdf8' : '#f87171') : '#64748b',
                                        }, children: t === 'reserve' ? '🔒 Reserve' : '⚡ Spend' }, t))) }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("label", { style: { fontSize: 9, color: '#64748b', display: 'block', marginBottom: 3 }, children: "Task *" }), _jsx("input", { style: { width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '6px 9px', outline: 'none', boxSizing: 'border-box' }, value: task, onChange: e => setTask(e.target.value), placeholder: type === 'reserve' ? 'What are you reserving time for?' : 'What cooperative task are you contributing to?', onKeyDown: e => { if (e.key === 'Enter')
                                                dispatch(); } })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 8 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("label", { style: { fontSize: 9, color: '#64748b', display: 'block', marginBottom: 3 }, children: "Hours" }), _jsx("input", { type: "number", min: 0.5, max: 24, step: 0.5, style: { width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '6px 9px', outline: 'none', boxSizing: 'border-box' }, value: hours, onChange: e => setHours(Number(e.target.value)) })] }), _jsxs("div", { style: { flex: 2 }, children: [_jsx("label", { style: { fontSize: 9, color: '#64748b', display: 'block', marginBottom: 3 }, children: "Note (optional)" }), _jsx("input", { style: { width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '6px 9px', outline: 'none', boxSizing: 'border-box' }, value: note, onChange: e => setNote(e.target.value), placeholder: "Optional note" })] })] }), _jsx("button", { onClick: dispatch, disabled: !task.trim() || hours <= 0, style: {
                                        width: '100%', padding: '8px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: task.trim() ? 'pointer' : 'not-allowed',
                                        border: '1px solid rgba(110,231,183,0.35)', background: 'rgba(110,231,183,0.1)', color: '#6ee7b7',
                                        opacity: task.trim() ? 1 : 0.5,
                                    }, children: "Dispatch \u2192" })] }), _jsxs("div", { style: { background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 10, padding: '12px 16px' }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }, children: "This Week" }), weekEntries.length === 0 ? (_jsx("div", { style: { fontSize: 11, color: '#334155', textAlign: 'center', padding: '16px 0' }, children: "No dispatches this week yet." })) : (weekEntries.map(entry => (_jsxs("div", { style: {
                                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0',
                                        borderBottom: '1px solid rgba(100,116,139,0.08)',
                                    }, children: [_jsx("span", { style: { fontSize: 14, flexShrink: 0 }, children: entry.type === 'reserve' ? '🔒' : '⚡' }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0' }, children: entry.task }), entry.note && _jsx("div", { style: { fontSize: 10, color: '#64748b', marginTop: 1 }, children: entry.note }), _jsxs("div", { style: { fontSize: 9, color: '#334155', marginTop: 2 }, children: [entry.hours, "h \u00B7 ", entry.type, " \u00B7 ", new Date(entry.timestamp).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })] })] }), _jsxs("span", { style: { fontSize: 12, fontWeight: 700, color: entry.type === 'reserve' ? '#38bdf8' : '#f87171', flexShrink: 0 }, children: [entry.type === 'reserve' ? '' : '−', entry.hours, "h"] }), _jsx("button", { onClick: () => removeEntry(entry.id), style: { background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 14, flexShrink: 0, padding: '0 2px' }, title: "Remove", children: "\u2715" })] }, entry.id))))] }), _jsx("div", { style: { marginTop: 12, fontSize: 10, color: '#334155', textAlign: 'center', lineHeight: 1.6 }, children: "\"Help each other help ourselves.\" \u2014 The Cooperative" })] }) }), _jsx(DeckCuePullup, { cards: cards, isOpen: isPullupOpen, onDismiss: dismissCard, onClose: closePullup })] }));
}
