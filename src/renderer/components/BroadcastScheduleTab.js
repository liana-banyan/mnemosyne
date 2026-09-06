import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// BroadcastScheduleTab — MnemosyneC™ Tab 16 · BP067 Phase 2C
// Cooperative content/announcement scheduler
// Week view of scheduled broadcasts · Add broadcast form · Pending vs Sent · local storage
import { useState } from 'react';
import { useDeckCue } from '../hooks/useDeckCue';
import { DeckCuePullup } from './DeckCuePullup';
// ─── Local storage ────────────────────────────────────────────────────────────
const LS_KEY = 'mnemo_broadcasts';
function load() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function save(broadcasts) {
    localStorage.setItem(LS_KEY, JSON.stringify(broadcasts));
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
const CHANNEL_LABELS = {
    email: '📧 Email',
    push: '🔔 Push',
    'in-app': '💬 In-App',
};
const CHANNEL_COLORS = {
    email: '#38bdf8',
    push: '#f59e0b',
    'in-app': '#6ee7b7',
};
function getWeekDays() {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function fmt(d) { return d.toISOString().split('T')[0]; }
// ─── Component ────────────────────────────────────────────────────────────────
export function BroadcastScheduleTab() {
    const { cards, showCard, dismissCard, isPullupOpen, closePullup } = useDeckCue();
    const [broadcasts, setBroadcasts] = useState(load);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('all');
    // Form state
    const [fTitle, setFTitle] = useState('');
    const [fScheduledAt, setFScheduledAt] = useState(() => {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        return d.toISOString().slice(0, 16);
    });
    const [fChannel, setFChannel] = useState('in-app');
    const [fBody, setFBody] = useState('');
    const weekDays = getWeekDays();
    const todayStr = fmt(new Date());
    function addBroadcast() {
        if (!fTitle.trim() || !fBody.trim())
            return;
        const entry = {
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            title: fTitle.trim(),
            scheduledAt: fScheduledAt,
            channel: fChannel,
            body: fBody.trim(),
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        const next = [entry, ...broadcasts];
        setBroadcasts(next);
        save(next);
        setFTitle('');
        setFBody('');
        setShowForm(false);
        showCard('broadcast');
    }
    function markSent(id) {
        const next = broadcasts.map(b => b.id === id ? { ...b, status: 'sent' } : b);
        setBroadcasts(next);
        save(next);
    }
    function remove(id) {
        const next = broadcasts.filter(b => b.id !== id);
        setBroadcasts(next);
        save(next);
    }
    // Group by day for week view
    function broadcastsForDay(date) {
        const ds = fmt(date);
        return broadcasts.filter(b => b.scheduledAt.startsWith(ds));
    }
    const filtered = broadcasts.filter(b => filter === 'all' || b.status === filter);
    const pending = broadcasts.filter(b => b.status === 'pending').length;
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: { padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }, children: _jsxs("div", { style: { maxWidth: 700, margin: '0 auto' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }, children: "\uD83D\uDCE1 Broadcast Schedule" }), _jsx("div", { style: { fontSize: 11, color: '#475569' }, children: "Cooperative content and announcement scheduler" })] }), _jsx("button", { onClick: () => setShowForm(s => !s), style: { padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(110,231,183,0.35)', background: 'rgba(110,231,183,0.1)', color: '#6ee7b7' }, children: showForm ? 'Cancel' : '+ Add Broadcast' })] }), showForm && (_jsxs("div", { style: { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(110,231,183,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }, children: "New Broadcast" }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("label", { style: { fontSize: 9, color: '#64748b', display: 'block', marginBottom: 3 }, children: "Title *" }), _jsx("input", { style: inputStyle, value: fTitle, onChange: e => setFTitle(e.target.value), placeholder: "Broadcast title or announcement subject" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }, children: [_jsxs("div", { children: [_jsx("label", { style: { fontSize: 9, color: '#64748b', display: 'block', marginBottom: 3 }, children: "Date & Time" }), _jsx("input", { type: "datetime-local", style: inputStyle, value: fScheduledAt, onChange: e => setFScheduledAt(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: 9, color: '#64748b', display: 'block', marginBottom: 3 }, children: "Channel" }), _jsx("select", { style: inputStyle, value: fChannel, onChange: e => setFChannel(e.target.value), children: Object.keys(CHANNEL_LABELS).map(ch => (_jsx("option", { value: ch, children: CHANNEL_LABELS[ch] }, ch))) })] })] }), _jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("label", { style: { fontSize: 9, color: '#64748b', display: 'block', marginBottom: 3 }, children: "Message body *" }), _jsx("textarea", { style: { ...inputStyle, height: 80, resize: 'vertical', fontFamily: 'system-ui,-apple-system,sans-serif' }, value: fBody, onChange: e => setFBody(e.target.value), placeholder: "Write your cooperative announcement here\u2026" })] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: addBroadcast, disabled: !fTitle.trim() || !fBody.trim(), style: { flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: fTitle.trim() && fBody.trim() ? 'pointer' : 'not-allowed', border: '1px solid rgba(110,231,183,0.35)', background: 'rgba(110,231,183,0.1)', color: '#6ee7b7', opacity: fTitle.trim() && fBody.trim() ? 1 : 0.5 }, children: "Schedule Broadcast" }), _jsx("button", { onClick: () => setShowForm(false), style: { padding: '8px 16px', borderRadius: 7, fontSize: 12, cursor: 'pointer', border: '1px solid rgba(100,116,139,0.2)', background: 'transparent', color: '#64748b' }, children: "Cancel" })] })] })), _jsxs("div", { style: { background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }, children: "This Week" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }, children: weekDays.map((day, i) => {
                                        const isToday = fmt(day) === todayStr;
                                        const dayBroadcasts = broadcastsForDay(day);
                                        return (_jsxs("div", { style: { background: isToday ? 'rgba(110,231,183,0.04)' : 'rgba(15,23,42,0.4)', border: isToday ? '1px solid rgba(110,231,183,0.2)' : '1px solid rgba(100,116,139,0.08)', borderRadius: 6, padding: '5px 6px', minHeight: 80 }, children: [_jsxs("div", { style: { fontSize: 9, fontWeight: isToday ? 700 : 500, color: isToday ? '#6ee7b7' : '#64748b', marginBottom: 4, textAlign: 'center' }, children: [DAY_NAMES_SHORT[i], _jsx("br", {}), day.getDate()] }), dayBroadcasts.length === 0 && _jsx("div", { style: { fontSize: 8, color: 'rgba(100,116,139,0.25)', textAlign: 'center' }, children: "\u2014" }), dayBroadcasts.map(b => (_jsx("div", { style: {
                                                        fontSize: 8, borderRadius: 3, padding: '2px 4px', marginBottom: 2,
                                                        background: `${CHANNEL_COLORS[b.channel]}18`, border: `1px solid ${CHANNEL_COLORS[b.channel]}40`,
                                                        color: b.status === 'sent' ? '#475569' : CHANNEL_COLORS[b.channel],
                                                        textDecoration: b.status === 'sent' ? 'line-through' : 'none',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }, title: b.title, children: b.title }, b.id)))] }, i));
                                    }) })] }), _jsx("div", { style: { display: 'flex', gap: 6, marginBottom: 12 }, children: ['all', 'pending', 'sent'].map(f => (_jsx("button", { onClick: () => setFilter(f), style: {
                                    padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: filter === f ? 700 : 500, cursor: 'pointer',
                                    border: filter === f ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(100,116,139,0.2)',
                                    background: filter === f ? 'rgba(110,231,183,0.08)' : 'transparent',
                                    color: filter === f ? '#6ee7b7' : '#64748b',
                                }, children: f === 'all' ? `All (${broadcasts.length})` : f === 'pending' ? `Pending (${pending})` : `Sent (${broadcasts.length - pending})` }, f))) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: filtered.length === 0 ? (_jsx("div", { style: { fontSize: 11, color: '#334155', textAlign: 'center', padding: '24px 0' }, children: filter === 'all' ? 'No broadcasts yet. Schedule your first cooperative announcement.' : `No ${filter} broadcasts.` })) : (filtered.map(b => (_jsx(BroadcastCard, { broadcast: b, onMarkSent: () => markSent(b.id), onRemove: () => remove(b.id) }, b.id)))) })] }) }), _jsx(DeckCuePullup, { cards: cards, isOpen: isPullupOpen, onDismiss: dismissCard, onClose: closePullup })] }));
}
// ─── Broadcast Card ───────────────────────────────────────────────────────────
function BroadcastCard({ broadcast: b, onMarkSent, onRemove }) {
    const [expanded, setExpanded] = useState(false);
    const color = CHANNEL_COLORS[b.channel];
    const isPending = b.status === 'pending';
    return (_jsx("div", { style: {
            background: 'rgba(15,23,42,0.5)', border: `1px solid ${isPending ? 'rgba(100,116,139,0.15)' : 'rgba(100,116,139,0.08)'}`,
            borderRadius: 8, padding: '10px 14px', opacity: isPending ? 1 : 0.7,
        }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 10 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 11, fontWeight: 700, color: isPending ? '#e2e8f0' : '#64748b', textDecoration: isPending ? 'none' : 'line-through' }, children: b.title }), _jsx("span", { style: { fontSize: 9, padding: '1px 7px', borderRadius: 10, background: `${color}18`, border: `1px solid ${color}40`, color }, children: CHANNEL_LABELS[b.channel] }), b.status === 'sent' && _jsx("span", { style: { fontSize: 9, padding: '1px 7px', borderRadius: 10, background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.25)', color: '#6ee7b7' }, children: "\u2713 Sent" })] }), _jsxs("div", { style: { fontSize: 10, color: '#475569', marginBottom: 4 }, children: ["\uD83D\uDD50 ", new Date(b.scheduledAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })] }), expanded && (_jsx("div", { style: { fontSize: 11, color: '#94a3b8', lineHeight: 1.7, marginTop: 6, background: 'rgba(15,23,42,0.4)', borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-wrap' }, children: b.body }))] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }, children: [_jsx("button", { onClick: () => setExpanded(e => !e), style: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11 }, title: expanded ? 'Collapse' : 'Expand', children: expanded ? '▲' : '▼' }), isPending && (_jsx("button", { onClick: onMarkSent, style: { background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.25)', borderRadius: 5, color: '#6ee7b7', fontSize: 9, fontWeight: 600, cursor: 'pointer', padding: '3px 7px', whiteSpace: 'nowrap' }, children: "Mark Sent" })), _jsx("button", { onClick: onRemove, style: { background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 12 }, title: "Remove", children: "\u2715" })] })] }) }));
}
// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle = {
    width: '100%',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 5,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '6px 9px',
    outline: 'none',
    boxSizing: 'border-box',
};
