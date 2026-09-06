import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Atlas™ Scheduling Module — MnemosyneC™ v0.1.24 · BP067 Phase 2A
// Month-view + Week-view · Plate-spinner · Recurrence · Conflict-detection · iCal · Delegation · Shopping List
import { useState, useEffect, useCallback } from 'react';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner' };
const PARTICIPANT_COLORS = ['#6ee7b7', '#38bdf8', '#f59e0b', '#f87171', '#a78bfa', '#34d399', '#fb7185'];
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay(); }
function fmt(d) { return d.toISOString().split('T')[0]; }
function getWeekStart(y, m, d) {
    const dt = new Date(y, m, d);
    const day = dt.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    return new Date(y, m, d + diff);
}
function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function eventColor(ev) {
    const colors = ['#6ee7b7', '#38bdf8', '#f59e0b', '#a78bfa', '#f87171'];
    let h = 0;
    for (const c of ev.id)
        h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return colors[h % colors.length];
}
/** Guess meal slot from event start time */
function guessMealSlot(startTime) {
    const h = new Date(startTime).getHours();
    if (h < 11)
        return 'breakfast';
    if (h < 16)
        return 'lunch';
    return 'dinner';
}
/** Current meal slot based on wall-clock time */
function currentMealSlot() {
    const h = new Date().getHours();
    if (h < 11)
        return 'breakfast';
    if (h < 17)
        return 'lunch';
    return 'dinner';
}
// ─── iCal generator ───────────────────────────────────────────────────────────
function toICSDate(iso) {
    return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z');
}
function generateICS(events) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Liana Banyan//Mnemosyne Atlas//EN', // KEEP: iCal PRODID is a fixed technical identifier
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];
    for (const ev of events) {
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${ev.id}@mnemosyne.lianabanyan`);
        lines.push(`DTSTAMP:${toICSDate(new Date().toISOString())}`);
        lines.push(`DTSTART:${toICSDate(ev.startTime)}`);
        lines.push(`DTEND:${toICSDate(ev.endTime)}`);
        lines.push(`SUMMARY:${ev.title.replace(/,/g, '\\,')}`);
        if (ev.description)
            lines.push(`DESCRIPTION:${ev.description.replace(/\n/g, '\\n').replace(/,/g, '\\,')}`);
        if (ev.location)
            lines.push(`LOCATION:${ev.location.replace(/,/g, '\\,')}`);
        if (ev.delegate)
            lines.push(`ORGANIZER;CN=${ev.delegate}:MAILTO:delegate@local`);
        if (ev.recurrence) {
            const r = ev.recurrence;
            const freq = r.frequency.toUpperCase();
            const parts = [`FREQ=${freq}`, `INTERVAL=${r.interval}`];
            if (r.endDate)
                parts.push(`UNTIL=${r.endDate.replace(/-/g, '')}`);
            lines.push(`RRULE:${parts.join(';')}`);
        }
        lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}
function downloadICS(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'system-ui,-apple-system,sans-serif' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px', flexShrink: 0, gap: 8 },
    monthTitle: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' },
    navBtn: { background: 'none', border: '1px solid rgba(100,116,139,0.2)', color: '#94a3b8', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 },
    newBtn: { padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7' },
    viewBtn: (active) => ({
        padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: active ? 700 : 500, cursor: 'pointer',
        border: active ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.2)',
        background: active ? 'rgba(110,231,183,0.1)' : 'transparent',
        color: active ? '#6ee7b7' : '#64748b',
    }),
    // Plate-spinner
    plateSpin: { padding: '6px 14px', borderBottom: '1px solid rgba(100,116,139,0.1)', flexShrink: 0 },
    plateTitle: { fontSize: 9, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
    plateChip: (color) => ({
        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600,
        background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 20,
        padding: '2px 10px', color, marginRight: 6, animation: 'mnemo-pulse 2s ease-in-out infinite',
    }),
    // Month grid
    calendarArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 14px 14px' },
    dayHeaders: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 },
    dayHeader: { fontSize: 9, color: '#475569', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 0' },
    calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flex: 1, overflowY: 'auto' },
    dayCell: (isToday, isCurMonth) => ({
        minHeight: 60, background: isToday ? 'rgba(110,231,183,0.06)' : 'rgba(15,23,42,0.4)',
        border: isToday ? '1px solid rgba(110,231,183,0.3)' : '1px solid rgba(100,116,139,0.1)',
        borderRadius: 6, padding: '3px 4px', overflow: 'hidden', opacity: isCurMonth ? 1 : 0.4, cursor: 'pointer',
    }),
    dayNum: (isToday) => ({ fontSize: 9, fontWeight: isToday ? 700 : 400, color: isToday ? '#6ee7b7' : '#64748b', marginBottom: 2 }),
    eventChip: (color) => ({
        fontSize: 8, borderRadius: 3, padding: '1px 4px', background: `${color}20`,
        border: `1px solid ${color}40`, color, marginBottom: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
    }),
    // Week grid
    weekGrid: { flex: 1, display: 'grid', gridTemplateRows: 'auto 1fr 1fr 1fr', overflowY: 'auto', gap: 2, padding: '0 14px 14px' },
    weekDayHeader: { display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 2, marginBottom: 2 },
    weekDayCell: (isToday) => ({
        fontSize: 9, fontWeight: isToday ? 700 : 500, color: isToday ? '#6ee7b7' : '#64748b',
        textAlign: 'center', padding: '2px 0',
    }),
    weekSlotLabel: { width: 80, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontSize: 9, fontWeight: 600, color: '#64748b', flexShrink: 0 },
    weekRow: { display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 2, minHeight: 70 },
    weekCell: (isToday, hasEvent) => ({
        background: isToday ? 'rgba(110,231,183,0.04)' : hasEvent ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.3)',
        border: isToday ? '1px solid rgba(110,231,183,0.2)' : '1px solid rgba(100,116,139,0.08)',
        borderRadius: 4, padding: '3px 4px', cursor: 'pointer', minHeight: 70,
    }),
    // Sidebar
    sidebar: { width: 290, borderLeft: '1px solid rgba(100,116,139,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    sidebarHeader: { padding: '8px 12px 6px', borderBottom: '1px solid rgba(100,116,139,0.1)', fontSize: 11, fontWeight: 600, color: '#94a3b8' },
    sidebarBody: { flex: 1, overflowY: 'auto', padding: '8px 12px' },
    formField: { marginBottom: 7 },
    formLabel: { fontSize: 9, color: '#64748b', marginBottom: 2, display: 'block' },
    formInput: { width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#e2e8f0', fontSize: 10, padding: '4px 7px', outline: 'none', boxSizing: 'border-box' },
    formCheck: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#94a3b8', marginBottom: 6 },
    formSelect: { width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#e2e8f0', fontSize: 10, padding: '4px 7px', outline: 'none', boxSizing: 'border-box' },
    btn: (v) => ({
        padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
        border: v === 'primary' ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(100,116,139,0.2)',
        background: v === 'primary' ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
        color: v === 'primary' ? '#6ee7b7' : '#94a3b8',
    }),
    conflictBanner: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 10, color: '#f87171' },
    delegateBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: '1px 7px', color: '#60a5fa' },
    shopList: { padding: '8px 12px', height: '100%', display: 'flex', flexDirection: 'column' },
};
function emptyForm(prefill) {
    const now = prefill?.date ? new Date(prefill.date + 'T12:00:00') : new Date();
    const later = new Date(now.getTime() + 3600000);
    return {
        title: '', description: '',
        startTime: now.toISOString().slice(0, 16),
        endTime: later.toISOString().slice(0, 16),
        allDay: false,
        mealSlot: prefill?.mealSlot ?? '',
        participants: [], location: '', photos: [], aiSuggested: false,
        recurrence: null, delegate: '', ingredients: '',
    };
}
// ─── Main Component ───────────────────────────────────────────────────────────
export function AtlasView({ prefilledTitle, onPrefilledConsumed } = {}) {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [viewMode, setViewMode] = useState('month');
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [sidePanel, setSidePanel] = useState('none');
    const [form, setForm] = useState(emptyForm);
    const [conflict, setConflict] = useState(null);
    const [shopChecked, setShopChecked] = useState({});
    const load = useCallback(async () => {
        try {
            const data = await window.amplify?.kitchenTable?.listAtlasEvents?.();
            setEvents(data ?? []);
        }
        catch {
            setEvents([]);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        if (prefilledTitle) {
            setForm((f) => ({ ...f, title: prefilledTitle }));
            setSidePanel('create');
            setSelectedEvent(null);
            onPrefilledConsumed?.();
        }
    }, [prefilledTitle, onPrefilledConsumed]);
    function prevPeriod() {
        if (viewMode === 'month') {
            if (month === 0) {
                setMonth(11);
                setYear(y => y - 1);
            }
            else
                setMonth(m => m - 1);
        }
        else {
            const ws = weekStart();
            const prev = addDays(ws, -7);
            setYear(prev.getFullYear());
            setMonth(prev.getMonth());
        }
    }
    function nextPeriod() {
        if (viewMode === 'month') {
            if (month === 11) {
                setMonth(0);
                setYear(y => y + 1);
            }
            else
                setMonth(m => m + 1);
        }
        else {
            const ws = weekStart();
            const next = addDays(ws, 7);
            setYear(next.getFullYear());
            setMonth(next.getMonth());
        }
    }
    function weekStart() {
        return getWeekStart(year, month, today.getMonth() === month && today.getFullYear() === year ? today.getDate() : 1);
    }
    // Detect conflict: same day + same mealSlot OR overlapping times
    function findConflict(f) {
        const startMs = new Date(f.startTime).getTime();
        const endMs = new Date(f.endTime).getTime();
        const startDay = f.startTime.slice(0, 10);
        for (const ev of events) {
            const evStart = new Date(ev.startTime).getTime();
            const evEnd = new Date(ev.endTime).getTime();
            const evDay = ev.startTime.slice(0, 10);
            // Meal slot conflict
            if (f.mealSlot && ev.mealSlot === f.mealSlot && evDay === startDay)
                return ev;
            // Time overlap conflict
            if (startMs < evEnd && endMs > evStart && evDay === startDay)
                return ev;
        }
        return null;
    }
    async function handleSave(force = false) {
        if (!form.title.trim())
            return;
        if (!force) {
            const c = findConflict(form);
            if (c) {
                setConflict(c);
                return;
            }
        }
        setConflict(null);
        try {
            const data = {
                title: form.title,
                description: form.description,
                startTime: form.startTime || new Date().toISOString(),
                endTime: form.endTime || new Date(Date.now() + 3600000).toISOString(),
                allDay: form.allDay,
                participants: form.participants,
                location: form.location || null,
                recurrence: form.recurrence,
                photos: form.photos,
                aiSuggested: form.aiSuggested,
                p2pSynced: false,
                delegate: form.delegate || null,
                mealSlot: form.mealSlot || null,
                ingredients: form.ingredients ? form.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [],
            };
            const created = await window.amplify?.kitchenTable?.createAtlasEvent?.(data);
            setEvents(prev => [...prev, created]);
            setSidePanel('detail');
            setSelectedEvent(created);
            setForm(emptyForm());
        }
        catch (e) {
            console.error('[AtlasView] create failed', e);
        }
    }
    async function handleDelete(id) {
        try {
            await window.amplify?.kitchenTable?.deleteAtlasEvent?.(id);
            setEvents(prev => prev.filter(e => e.id !== id));
            setSidePanel('none');
            setSelectedEvent(null);
        }
        catch (e) {
            console.error('[AtlasView] delete failed', e);
        }
    }
    function openCreate(prefill) {
        setForm(emptyForm(prefill));
        setConflict(null);
        setSidePanel('create');
        setSelectedEvent(null);
    }
    function handleExportICS() {
        const ics = generateICS(events);
        downloadICS(ics, `atlas-${MONTH_NAMES[month]}-${year}.ics`);
    }
    // This week's events (Mon–Sun of current week)
    const ws = weekStart();
    const thisWeekEvents = events.filter(ev => {
        const d = new Date(ev.startTime);
        const dayIdx = (d.getDay() === 0) ? 6 : d.getDay() - 1;
        const monday = addDays(d, -dayIdx);
        const wsDay = fmt(ws);
        return fmt(monday) === wsDay || (d >= ws && d <= addDays(ws, 6));
    });
    // Plate-spinner: today's active slot
    const todayStr = fmt(today);
    const activeSlot = currentMealSlot();
    const todaySlotEvents = events.filter(ev => ev.startTime.startsWith(todayStr) &&
        (ev.mealSlot === activeSlot || (!ev.mealSlot && guessMealSlot(ev.startTime) === activeSlot)));
    // Shopping list: aggregate ingredients from this week
    const weekIngredients = thisWeekEvents.flatMap(ev => ev.ingredients ?? []).filter(Boolean);
    const uniqueIngredients = [...new Set(weekIngredients)];
    if (loading)
        return _jsx("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: 12 }, children: "Loading Atlas\u2122\u2026" });
    return (_jsxs("div", { style: S.root, children: [_jsxs("div", { style: S.header, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("button", { style: S.navBtn, onClick: prevPeriod, children: "\u2039" }), _jsx("span", { style: S.monthTitle, children: viewMode === 'month' ? `${MONTH_NAMES[month]} ${year}` : `Week of ${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()}, ${ws.getFullYear()}` }), _jsx("button", { style: S.navBtn, onClick: nextPeriod, children: "\u203A" })] }), _jsxs("div", { style: { display: 'flex', gap: 4, alignItems: 'center' }, children: [_jsx("button", { style: S.viewBtn(viewMode === 'month'), onClick: () => setViewMode('month'), children: "Month" }), _jsx("button", { style: S.viewBtn(viewMode === 'week'), onClick: () => setViewMode('week'), children: "Week" }), _jsx("button", { style: S.newBtn, onClick: () => openCreate(), children: "+ New" }), _jsx("button", { style: { ...S.newBtn, border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8' }, onClick: handleExportICS, title: "Export this calendar to .ics file", children: "\uD83D\uDCC6 iCal" }), _jsx("button", { style: { ...S.newBtn, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }, onClick: () => setSidePanel(sidePanel === 'shopping' ? 'none' : 'shopping'), title: "Shopping list from this week's meals", children: "\uD83D\uDED2 Shop" })] })] }), todaySlotEvents.length > 0 && (_jsxs("div", { style: S.plateSpin, children: [_jsxs("div", { style: S.plateTitle, children: ["\uD83C\uDF7D\uFE0F On the plate now \u2014 ", MEAL_LABELS[activeSlot]] }), todaySlotEvents.map(ev => (_jsxs("span", { style: S.plateChip(eventColor(ev)), onClick: () => { setSelectedEvent(ev); setSidePanel('detail'); }, children: [ev.delegate ? `→ ${ev.delegate}: ` : '', ev.title] }, ev.id)))] })), _jsxs("div", { style: { flex: 1, display: 'flex', overflow: 'hidden' }, children: [_jsx("div", { style: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }, children: viewMode === 'month' ? (_jsx(MonthGrid, { year: year, month: month, today: today, events: events, onDayClick: (date) => openCreate({ date }), onEventClick: (ev) => { setSelectedEvent(ev); setSidePanel('detail'); } })) : (_jsx(WeekGrid, { ws: ws, today: today, events: events, onCellClick: (date, slot) => openCreate({ date, mealSlot: slot }), onEventClick: (ev) => { setSelectedEvent(ev); setSidePanel('detail'); } })) }), sidePanel !== 'none' && (_jsxs("div", { style: S.sidebar, children: [sidePanel === 'shopping' && (_jsx(ShoppingList, { ingredients: uniqueIngredients, checked: shopChecked, onCheck: setShopChecked, onClose: () => setSidePanel('none') })), sidePanel === 'create' && (_jsx(CreateForm, { form: form, setForm: setForm, conflict: conflict, onSave: () => handleSave(false), onForceSave: () => handleSave(true), onCancel: () => { setSidePanel('none'); setConflict(null); } })), sidePanel === 'detail' && selectedEvent && (_jsx(EventDetail, { event: selectedEvent, onDelete: () => handleDelete(selectedEvent.id), onClose: () => setSidePanel('none') }))] }))] })] }));
}
// ─── Month Grid ───────────────────────────────────────────────────────────────
function MonthGrid({ year, month, today, events, onDayClick, onEventClick }) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInPrev = getDaysInMonth(year, month === 0 ? 11 : month - 1);
    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--)
        cells.push({ date: new Date(year, month - 1, daysInPrev - i), currentMonth: false });
    for (let d = 1; d <= daysInMonth; d++)
        cells.push({ date: new Date(year, month, d), currentMonth: true });
    const rem = 7 - (cells.length % 7);
    if (rem < 7)
        for (let d = 1; d <= rem; d++)
            cells.push({ date: new Date(year, month + 1, d), currentMonth: false });
    function eventsForDay(date) {
        const ds = fmt(date);
        return events.filter(e => e.startTime.startsWith(ds) || (e.startTime.slice(0, 10) <= ds && e.endTime.slice(0, 10) >= ds));
    }
    return (_jsxs("div", { style: S.calendarArea, children: [_jsx("div", { style: S.dayHeaders, children: DAY_NAMES.map(d => _jsx("div", { style: S.dayHeader, children: d }, d)) }), _jsx("div", { style: S.calGrid, children: cells.map((cell, idx) => {
                    const isToday = fmt(cell.date) === fmt(today);
                    const dayEvs = eventsForDay(cell.date);
                    return (_jsxs("div", { style: S.dayCell(isToday, cell.currentMonth), onClick: () => cell.currentMonth && onDayClick(fmt(cell.date)), children: [_jsx("div", { style: S.dayNum(isToday), children: cell.date.getDate() }), dayEvs.slice(0, 3).map(ev => (_jsxs("div", { style: S.eventChip(eventColor(ev)), onClick: e => { e.stopPropagation(); onEventClick(ev); }, title: ev.title, children: [ev.mealSlot ? `${ev.mealSlot[0].toUpperCase()} ` : '', ev.delegate ? `→${ev.delegate.split(' ')[0]} ` : '', ev.title] }, ev.id))), dayEvs.length > 3 && _jsxs("div", { style: { fontSize: 7, color: '#475569' }, children: ["+", dayEvs.length - 3] })] }, idx));
                }) })] }));
}
// ─── Week Grid ────────────────────────────────────────────────────────────────
function WeekGrid({ ws, today, events, onCellClick, onEventClick }) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    function eventsForSlot(date, slot) {
        const ds = fmt(date);
        return events.filter(ev => ev.startTime.startsWith(ds) &&
            (ev.mealSlot === slot || (!ev.mealSlot && guessMealSlot(ev.startTime) === slot)));
    }
    return (_jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: '0 14px 14px' }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 2, marginBottom: 4 }, children: [_jsx("div", {}), days.map((d, i) => {
                        const isToday = fmt(d) === fmt(today);
                        return (_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }, children: DAY_NAMES[(d.getDay())] }), _jsx("div", { style: { fontSize: 14, fontWeight: isToday ? 700 : 400, color: isToday ? '#6ee7b7' : '#e2e8f0', marginTop: 1 }, children: d.getDate() })] }, i));
                    })] }), MEAL_SLOTS.map(slot => (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 2, marginBottom: 4 }, children: [_jsx("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontSize: 9, fontWeight: 600, color: '#64748b' }, children: MEAL_LABELS[slot] }), days.map((d, i) => {
                        const isToday = fmt(d) === fmt(today);
                        const slotEvs = eventsForSlot(d, slot);
                        return (_jsxs("div", { style: { background: isToday ? 'rgba(110,231,183,0.04)' : 'rgba(15,23,42,0.4)', border: isToday ? '1px solid rgba(110,231,183,0.2)' : '1px solid rgba(100,116,139,0.08)', borderRadius: 4, padding: '4px 5px', minHeight: 64, cursor: 'pointer' }, onClick: () => onCellClick(fmt(d), slot), children: [slotEvs.length === 0 && _jsx("div", { style: { fontSize: 8, color: 'rgba(100,116,139,0.3)', textAlign: 'center', marginTop: 8 }, children: "+" }), slotEvs.map(ev => (_jsxs("div", { style: { fontSize: 9, borderRadius: 4, padding: '2px 5px', background: `${eventColor(ev)}20`, border: `1px solid ${eventColor(ev)}40`, color: eventColor(ev), marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }, onClick: e => { e.stopPropagation(); onEventClick(ev); }, title: ev.title, children: [ev.delegate ? _jsxs("span", { style: { fontSize: 7, opacity: 0.7 }, children: ["\u2192", ev.delegate.split(' ')[0], " "] }) : null, ev.title] }, ev.id)))] }, i));
                    })] }, slot)))] }));
}
// ─── Create Form ──────────────────────────────────────────────────────────────
function CreateForm({ form, setForm, conflict, onSave, onForceSave, onCancel }) {
    const [newParticipant, setNewParticipant] = useState('');
    const [showRecurrence, setShowRecurrence] = useState(false);
    function addParticipant(name) {
        if (!name.trim())
            return;
        const color = PARTICIPANT_COLORS[form.participants.length % PARTICIPANT_COLORS.length];
        const p = { id: genId(), displayName: name.trim(), status: 'invited', color };
        setForm(f => ({ ...f, participants: [...f.participants, p] }));
    }
    function setRecurrence(r) {
        setForm(f => ({ ...f, recurrence: r }));
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsx("div", { style: S.sidebarHeader, children: "\uD83D\uDCC5 New Event" }), _jsxs("div", { style: { ...S.sidebarBody, overflowY: 'auto' }, children: [conflict && (_jsxs("div", { style: S.conflictBanner, children: ["\u26A0\uFE0F Conflict: ", _jsx("strong", { children: conflict.title }), " already scheduled for this slot.", ' ', _jsx("button", { style: { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 10, textDecoration: 'underline', padding: 0 }, onClick: onForceSave, children: "Add anyway" })] })), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Title *" }), _jsx("input", { style: S.formInput, value: form.title, onChange: e => setForm(f => ({ ...f, title: e.target.value })), placeholder: "Event title" })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Meal slot" }), _jsxs("select", { style: S.formSelect, value: form.mealSlot, onChange: e => setForm(f => ({ ...f, mealSlot: e.target.value })), children: [_jsx("option", { value: "", children: "General event" }), MEAL_SLOTS.map(s => _jsx("option", { value: s, children: MEAL_LABELS[s] }, s))] })] }), _jsxs("div", { style: S.formCheck, children: [_jsx("input", { type: "checkbox", id: "allday", checked: form.allDay, onChange: e => setForm(f => ({ ...f, allDay: e.target.checked })) }), _jsx("label", { htmlFor: "allday", children: "All-day" })] }), !form.allDay && (_jsxs(_Fragment, { children: [_jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Start" }), _jsx("input", { type: "datetime-local", style: S.formInput, value: form.startTime, onChange: e => setForm(f => ({ ...f, startTime: e.target.value })) })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "End" }), _jsx("input", { type: "datetime-local", style: S.formInput, value: form.endTime, onChange: e => setForm(f => ({ ...f, endTime: e.target.value })) })] })] })), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Delegate to \u2192" }), _jsx("input", { style: S.formInput, value: form.delegate, onChange: e => setForm(f => ({ ...f, delegate: e.target.value })), placeholder: "Name or email" })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Location" }), _jsx("input", { style: S.formInput, value: form.location, onChange: e => setForm(f => ({ ...f, location: e.target.value })), placeholder: "Optional" })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Description" }), _jsx("input", { style: S.formInput, value: form.description, onChange: e => setForm(f => ({ ...f, description: e.target.value })), placeholder: "Optional" })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Ingredients (comma-separated, for shopping list)" }), _jsx("input", { style: S.formInput, value: form.ingredients, onChange: e => setForm(f => ({ ...f, ingredients: e.target.value })), placeholder: "eggs, flour, butter\u2026" })] }), _jsxs("div", { style: { ...S.formField, marginTop: 4 }, children: [_jsx("label", { style: S.formLabel, children: "Participants" }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("input", { style: { ...S.formInput, flex: 1 }, value: newParticipant, onChange: e => setNewParticipant(e.target.value), onKeyDown: e => { if (e.key === 'Enter') {
                                            addParticipant(newParticipant);
                                            setNewParticipant('');
                                        } }, placeholder: "Name + Enter" }), _jsx("button", { style: S.btn('secondary'), onClick: () => { addParticipant(newParticipant); setNewParticipant(''); }, children: "Add" })] }), form.participants.map(p => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }, children: [_jsx("span", { style: { width: 7, height: 7, borderRadius: '50%', background: p.color, display: 'inline-block' } }), _jsx("span", { style: { fontSize: 10, color: '#94a3b8' }, children: p.displayName })] }, p.id)))] }), _jsxs("div", { style: S.formField, children: [_jsxs("button", { style: { background: 'none', border: 'none', color: '#6ee7b7', fontSize: 10, cursor: 'pointer', padding: 0 }, onClick: () => setShowRecurrence(r => !r), children: [showRecurrence ? '▾' : '▸', " Repeat?", form.recurrence ? ` (${form.recurrence.frequency})` : ''] }), showRecurrence && (_jsx(RecurrenceEditor, { rule: form.recurrence, onChange: setRecurrence }))] })] }), _jsxs("div", { style: { display: 'flex', gap: 6, padding: '8px 12px', borderTop: '1px solid rgba(100,116,139,0.1)' }, children: [_jsx("button", { style: S.btn('secondary'), onClick: onCancel, children: "Cancel" }), _jsx("button", { style: { ...S.btn('primary'), opacity: form.title.trim() ? 1 : 0.5 }, onClick: onSave, disabled: !form.title.trim(), children: "Save" })] })] }));
}
// ─── Recurrence Editor ────────────────────────────────────────────────────────
function RecurrenceEditor({ rule, onChange }) {
    const [freq, setFreq] = useState(rule?.frequency ?? 'weekly');
    const [interval, setInterval] = useState(rule?.interval ?? 1);
    const [endDate, setEndDate] = useState(rule?.endDate ?? '');
    function apply() { onChange({ frequency: freq, interval, endDate: endDate || null, daysOfWeek: [] }); }
    function clear() { onChange(null); }
    return (_jsxs("div", { style: { background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 6, padding: '8px 10px', marginTop: 4 }, children: [_jsxs("div", { style: { display: 'flex', gap: 6, marginBottom: 6 }, children: [_jsxs("select", { style: { ...S.formSelect, flex: 1 }, value: freq, onChange: e => setFreq(e.target.value), children: [_jsx("option", { value: "daily", children: "Daily" }), _jsx("option", { value: "weekly", children: "Weekly" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "yearly", children: "Yearly" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94a3b8' }, children: ["Every", _jsx("input", { type: "number", min: 1, max: 99, style: { ...S.formInput, width: 44 }, value: interval, onChange: e => setInterval(Number(e.target.value)) })] })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "End date (optional)" }), _jsx("input", { type: "date", style: S.formInput, value: endDate, onChange: e => setEndDate(e.target.value) })] }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { style: S.btn('primary'), onClick: apply, children: "Apply" }), _jsx("button", { style: S.btn('secondary'), onClick: clear, children: "Clear" })] })] }));
}
// ─── Event Detail ─────────────────────────────────────────────────────────────
function EventDetail({ event, onDelete, onClose }) {
    const color = eventColor(event);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: { ...S.sidebarHeader, borderLeft: `3px solid ${color}`, paddingLeft: 10 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: 12, color: '#e2e8f0', fontWeight: 700 }, children: event.title }), _jsx("button", { onClick: onClose, style: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }, children: "\u2715" })] }), event.mealSlot && _jsx("div", { style: { fontSize: 9, color: '#6ee7b7', marginTop: 2 }, children: MEAL_LABELS[event.mealSlot] })] }), _jsxs("div", { style: { ...S.sidebarBody, overflowY: 'auto' }, children: [_jsxs("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6 }, children: ["\uD83D\uDCC5 ", new Date(event.startTime).toLocaleString(), " \u2192 ", new Date(event.endTime).toLocaleString()] }), event.delegate && (_jsx("div", { style: { marginBottom: 6 }, children: _jsxs("span", { style: S.delegateBadge, children: ["\u2192 Delegated to: ", event.delegate] }) })), event.location && _jsxs("div", { style: { fontSize: 10, color: '#94a3b8', marginBottom: 6 }, children: ["\uD83D\uDCCD ", event.location] }), event.description && _jsx("div", { style: { fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }, children: event.description }), event.recurrence && (_jsxs("div", { style: { fontSize: 9, color: '#a78bfa', marginBottom: 6 }, children: ["\uD83D\uDD01 Repeats ", event.recurrence.frequency, ", every ", event.recurrence.interval, event.recurrence.endDate ? ` until ${event.recurrence.endDate}` : ''] })), (event.ingredients ?? []).length > 0 && (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Ingredients" }), (event.ingredients ?? []).map((ing, i) => (_jsxs("div", { style: { fontSize: 10, color: '#94a3b8', padding: '1px 0' }, children: ["\u2022 ", ing] }, i)))] })), event.participants.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Participants" }), event.participants.map(p => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }, children: [_jsx("span", { style: { width: 7, height: 7, borderRadius: '50%', background: p.color, display: 'inline-block' } }), _jsx("span", { style: { fontSize: 10, color: '#e2e8f0' }, children: p.displayName }), _jsx("span", { style: { fontSize: 8, color: '#475569', marginLeft: 'auto' }, children: p.status })] }, p.id)))] })), event.p2pSynced && _jsx("div", { style: { fontSize: 9, color: '#38bdf8', marginTop: 6 }, children: "\u27F3 P2P synced" })] }), _jsx("div", { style: { padding: '8px 12px', borderTop: '1px solid rgba(100,116,139,0.1)' }, children: _jsx("button", { onClick: onDelete, style: { padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)', color: '#f87171' }, children: "Delete" }) })] }));
}
// ─── Shopping List ────────────────────────────────────────────────────────────
function ShoppingList({ ingredients, checked, onCheck, onClose }) {
    function toggle(item) {
        onCheck({ ...checked, [item]: !checked[item] });
    }
    function copyAll() {
        const lines = ingredients.filter(i => !checked[i]).map(i => `• ${i}`).join('\n');
        navigator.clipboard.writeText(lines).catch(() => { });
    }
    return (_jsxs("div", { style: S.shopList, children: [_jsxs("div", { style: { ...S.sidebarHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { children: "\uD83D\uDED2 Shopping List" }), _jsx("button", { onClick: onClose, style: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }, children: "\u2715" })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: '8px 12px' }, children: ingredients.length === 0 ? (_jsxs("div", { style: { fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 20 }, children: ["No ingredients this week.", _jsx("br", {}), _jsx("span", { style: { fontSize: 10 }, children: "Add ingredients when creating meal events." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 9, color: '#64748b', marginBottom: 8 }, children: "This week's ingredients from scheduled meals:" }), ingredients.map(item => (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: !!checked[item], onChange: () => toggle(item), style: { accentColor: '#6ee7b7', cursor: 'pointer' } }), _jsx("span", { style: { fontSize: 11, color: checked[item] ? '#475569' : '#e2e8f0', textDecoration: checked[item] ? 'line-through' : 'none' }, children: item })] }, item)))] })) }), ingredients.length > 0 && (_jsx("div", { style: { padding: '8px 12px', borderTop: '1px solid rgba(100,116,139,0.1)' }, children: _jsx("button", { style: { ...S.btn('secondary'), width: '100%' }, onClick: copyAll, children: "\uD83D\uDCCB Copy unchecked to clipboard" }) }))] }));
}
