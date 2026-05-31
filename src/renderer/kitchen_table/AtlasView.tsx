// Atlas™ Scheduling Module — Mnemosyne™ v0.1.24 · BP067 Phase 2A
// Month-view + Week-view · Plate-spinner · Recurrence · Conflict-detection · iCal · Delegation · Shopping List

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AtlasEvent, AtlasParticipant, RecurrenceRule, PhotoRef, MealSlot } from '../../shared/kitchen_table_types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MEAL_SLOTS: MealSlot[] = ['breakfast','lunch','dinner'];
const MEAL_LABELS: Record<MealSlot,string> = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner' };
const PARTICIPANT_COLORS = ['#6ee7b7','#38bdf8','#f59e0b','#f87171','#a78bfa','#34d399','#fb7185'];

function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function fmt(d: Date): string { return d.toISOString().split('T')[0]; }

function getWeekStart(y: number, m: number, d: number): Date {
  const dt = new Date(y, m, d);
  const day = dt.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  return new Date(y, m, d + diff);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function eventColor(ev: AtlasEvent): string {
  const colors = ['#6ee7b7','#38bdf8','#f59e0b','#a78bfa','#f87171'];
  let h = 0;
  for (const c of ev.id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
}

/** Guess meal slot from event start time */
function guessMealSlot(startTime: string): MealSlot | null {
  const h = new Date(startTime).getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  return 'dinner';
}

/** Current meal slot based on wall-clock time */
function currentMealSlot(): MealSlot {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 17) return 'lunch';
  return 'dinner';
}

// ─── iCal generator ───────────────────────────────────────────────────────────

function toICSDate(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z');
}

function generateICS(events: AtlasEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Liana Banyan//Mnemosyne Atlas//EN',
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
    if (ev.description) lines.push(`DESCRIPTION:${ev.description.replace(/\n/g, '\\n').replace(/,/g, '\\,')}`);
    if (ev.location) lines.push(`LOCATION:${ev.location.replace(/,/g, '\\,')}`);
    if (ev.delegate) lines.push(`ORGANIZER;CN=${ev.delegate}:MAILTO:delegate@local`);
    if (ev.recurrence) {
      const r = ev.recurrence;
      const freq = r.frequency.toUpperCase();
      const parts: string[] = [`FREQ=${freq}`, `INTERVAL=${r.interval}`];
      if (r.endDate) parts.push(`UNTIL=${r.endDate.replace(/-/g, '')}`);
      lines.push(`RRULE:${parts.join(';')}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadICS(content: string, filename: string) {
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
  root: { display:'flex', flexDirection:'column' as const, height:'100%', overflow:'hidden', fontFamily:'system-ui,-apple-system,sans-serif' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px 4px', flexShrink:0, gap:8 },
  monthTitle: { fontSize:13, fontWeight:700, color:'#e2e8f0' },
  navBtn: { background:'none', border:'1px solid rgba(100,116,139,0.2)', color:'#94a3b8', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12 },
  newBtn: { padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(110,231,183,0.3)', background:'rgba(110,231,183,0.08)', color:'#6ee7b7' },
  viewBtn: (active:boolean): React.CSSProperties => ({
    padding:'3px 10px', borderRadius:6, fontSize:10, fontWeight:active?700:500, cursor:'pointer',
    border: active?'1px solid rgba(110,231,183,0.4)':'1px solid rgba(100,116,139,0.2)',
    background: active?'rgba(110,231,183,0.1)':'transparent',
    color: active?'#6ee7b7':'#64748b',
  }),
  // Plate-spinner
  plateSpin: { padding:'6px 14px', borderBottom:'1px solid rgba(100,116,139,0.1)', flexShrink:0 },
  plateTitle: { fontSize:9, fontWeight:700, color:'#6ee7b7', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:4 },
  plateChip: (color:string): React.CSSProperties => ({
    display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600,
    background:`${color}18`, border:`1px solid ${color}40`, borderRadius:20,
    padding:'2px 10px', color, marginRight:6, animation:'mnemo-pulse 2s ease-in-out infinite',
  }),
  // Month grid
  calendarArea: { flex:1, display:'flex', flexDirection:'column' as const, overflow:'hidden', padding:'0 14px 14px' },
  dayHeaders: { display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, marginBottom:4 },
  dayHeader: { fontSize:9, color:'#475569', textAlign:'center' as const, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.04em', padding:'2px 0' },
  calGrid: { display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, flex:1, overflowY:'auto' as const },
  dayCell: (isToday:boolean, isCurMonth:boolean): React.CSSProperties => ({
    minHeight:60, background:isToday?'rgba(110,231,183,0.06)':'rgba(15,23,42,0.4)',
    border:isToday?'1px solid rgba(110,231,183,0.3)':'1px solid rgba(100,116,139,0.1)',
    borderRadius:6, padding:'3px 4px', overflow:'hidden', opacity:isCurMonth?1:0.4, cursor:'pointer',
  }),
  dayNum: (isToday:boolean): React.CSSProperties => ({ fontSize:9, fontWeight:isToday?700:400, color:isToday?'#6ee7b7':'#64748b', marginBottom:2 }),
  eventChip: (color:string): React.CSSProperties => ({
    fontSize:8, borderRadius:3, padding:'1px 4px', background:`${color}20`,
    border:`1px solid ${color}40`, color, marginBottom:1,
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, cursor:'pointer',
  }),
  // Week grid
  weekGrid: { flex:1, display:'grid', gridTemplateRows:'auto 1fr 1fr 1fr', overflowY:'auto' as const, gap:2, padding:'0 14px 14px' },
  weekDayHeader: { display:'grid', gridTemplateColumns:'80px repeat(7, 1fr)', gap:2, marginBottom:2 },
  weekDayCell: (isToday:boolean): React.CSSProperties => ({
    fontSize:9, fontWeight:isToday?700:500, color:isToday?'#6ee7b7':'#64748b',
    textAlign:'center' as const, padding:'2px 0',
  }),
  weekSlotLabel: { width:80, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:8, fontSize:9, fontWeight:600, color:'#64748b', flexShrink:0 },
  weekRow: { display:'grid', gridTemplateColumns:'80px repeat(7, 1fr)', gap:2, minHeight:70 },
  weekCell: (isToday:boolean, hasEvent:boolean): React.CSSProperties => ({
    background:isToday?'rgba(110,231,183,0.04)':hasEvent?'rgba(15,23,42,0.5)':'rgba(15,23,42,0.3)',
    border:isToday?'1px solid rgba(110,231,183,0.2)':'1px solid rgba(100,116,139,0.08)',
    borderRadius:4, padding:'3px 4px', cursor:'pointer', minHeight:70,
  }),
  // Sidebar
  sidebar: { width:290, borderLeft:'1px solid rgba(100,116,139,0.15)', display:'flex', flexDirection:'column' as const, overflow:'hidden' },
  sidebarHeader: { padding:'8px 12px 6px', borderBottom:'1px solid rgba(100,116,139,0.1)', fontSize:11, fontWeight:600, color:'#94a3b8' },
  sidebarBody: { flex:1, overflowY:'auto' as const, padding:'8px 12px' },
  formField: { marginBottom:7 },
  formLabel: { fontSize:9, color:'#64748b', marginBottom:2, display:'block' },
  formInput: { width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(100,116,139,0.2)', borderRadius:5, color:'#e2e8f0', fontSize:10, padding:'4px 7px', outline:'none', boxSizing:'border-box' as const },
  formCheck: { display:'flex', alignItems:'center', gap:6, fontSize:10, color:'#94a3b8', marginBottom:6 },
  formSelect: { width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(100,116,139,0.2)', borderRadius:5, color:'#e2e8f0', fontSize:10, padding:'4px 7px', outline:'none', boxSizing:'border-box' as const },
  btn: (v:'primary'|'secondary'): React.CSSProperties => ({
    padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer',
    border:v==='primary'?'1px solid rgba(110,231,183,0.35)':'1px solid rgba(100,116,139,0.2)',
    background:v==='primary'?'rgba(110,231,183,0.1)':'rgba(100,116,139,0.06)',
    color:v==='primary'?'#6ee7b7':'#94a3b8',
  }),
  conflictBanner: { background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:6, padding:'6px 10px', marginBottom:8, fontSize:10, color:'#f87171' },
  delegateBadge: { display:'inline-flex', alignItems:'center', gap:3, fontSize:9, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:10, padding:'1px 7px', color:'#60a5fa' },
  shopList: { padding:'8px 12px', height:'100%', display:'flex', flexDirection:'column' as const },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface AtlasViewProps {
  prefilledTitle?: string | null;
  onPrefilledConsumed?: () => void;
}

type ViewMode = 'month' | 'week';
type SidePanel = 'none' | 'create' | 'detail' | 'shopping';

// ─── Form state ───────────────────────────────────────────────────────────────

interface EventFormState {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  mealSlot: MealSlot | '';
  participants: AtlasParticipant[];
  location: string;
  photos: PhotoRef[];
  aiSuggested: boolean;
  recurrence: RecurrenceRule | null;
  delegate: string;
  ingredients: string;
}

function emptyForm(prefill?: { date?: string; mealSlot?: MealSlot }): EventFormState {
  const now = prefill?.date ? new Date(prefill.date + 'T12:00:00') : new Date();
  const later = new Date(now.getTime() + 3_600_000);
  return {
    title:'', description:'',
    startTime: now.toISOString().slice(0,16),
    endTime: later.toISOString().slice(0,16),
    allDay:false,
    mealSlot: prefill?.mealSlot ?? '',
    participants:[], location:'', photos:[], aiSuggested:false,
    recurrence:null, delegate:'', ingredients:'',
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AtlasView({ prefilledTitle, onPrefilledConsumed }: AtlasViewProps = {}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<AtlasEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AtlasEvent | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>('none');
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [conflict, setConflict] = useState<AtlasEvent | null>(null);
  const [shopChecked, setShopChecked] = useState<Record<string,boolean>>({});

  const load = useCallback(async () => {
    try {
      const data = await (window.amplify as any)?.kitchenTable?.listAtlasEvents?.() as AtlasEvent[];
      setEvents(data ?? []);
    } catch { setEvents([]); }
    finally { setLoading(false); }
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
      if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1);
    } else {
      const ws = weekStart();
      const prev = addDays(ws, -7);
      setYear(prev.getFullYear()); setMonth(prev.getMonth());
    }
  }
  function nextPeriod() {
    if (viewMode === 'month') {
      if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1);
    } else {
      const ws = weekStart();
      const next = addDays(ws, 7);
      setYear(next.getFullYear()); setMonth(next.getMonth());
    }
  }

  function weekStart(): Date {
    return getWeekStart(year, month, today.getMonth()===month && today.getFullYear()===year ? today.getDate() : 1);
  }

  // Detect conflict: same day + same mealSlot OR overlapping times
  function findConflict(f: EventFormState): AtlasEvent | null {
    const startMs = new Date(f.startTime).getTime();
    const endMs = new Date(f.endTime).getTime();
    const startDay = f.startTime.slice(0,10);
    for (const ev of events) {
      const evStart = new Date(ev.startTime).getTime();
      const evEnd = new Date(ev.endTime).getTime();
      const evDay = ev.startTime.slice(0,10);
      // Meal slot conflict
      if (f.mealSlot && ev.mealSlot === f.mealSlot && evDay === startDay) return ev;
      // Time overlap conflict
      if (startMs < evEnd && endMs > evStart && evDay === startDay) return ev;
    }
    return null;
  }

  async function handleSave(force = false) {
    if (!form.title.trim()) return;
    if (!force) {
      const c = findConflict(form);
      if (c) { setConflict(c); return; }
    }
    setConflict(null);
    try {
      const data: Omit<AtlasEvent,'id'|'createdAt'> = {
        title: form.title,
        description: form.description,
        startTime: form.startTime || new Date().toISOString(),
        endTime: form.endTime || new Date(Date.now()+3_600_000).toISOString(),
        allDay: form.allDay,
        participants: form.participants,
        location: form.location || null,
        recurrence: form.recurrence,
        photos: form.photos,
        aiSuggested: form.aiSuggested,
        p2pSynced: false,
        delegate: form.delegate || null,
        mealSlot: (form.mealSlot as MealSlot) || null,
        ingredients: form.ingredients ? form.ingredients.split(',').map(s=>s.trim()).filter(Boolean) : [],
      };
      const created = await (window.amplify as any)?.kitchenTable?.createAtlasEvent?.(data) as AtlasEvent;
      setEvents(prev => [...prev, created]);
      setSidePanel('detail');
      setSelectedEvent(created);
      setForm(emptyForm());
    } catch (e) { console.error('[AtlasView] create failed', e); }
  }

  async function handleDelete(id: string) {
    try {
      await (window.amplify as any)?.kitchenTable?.deleteAtlasEvent?.(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      setSidePanel('none');
      setSelectedEvent(null);
    } catch (e) { console.error('[AtlasView] delete failed', e); }
  }

  function openCreate(prefill?: { date?: string; mealSlot?: MealSlot }) {
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
  const todaySlotEvents = events.filter(ev =>
    ev.startTime.startsWith(todayStr) &&
    (ev.mealSlot === activeSlot || (!ev.mealSlot && guessMealSlot(ev.startTime) === activeSlot))
  );

  // Shopping list: aggregate ingredients from this week
  const weekIngredients = thisWeekEvents.flatMap(ev => ev.ingredients ?? []).filter(Boolean);
  const uniqueIngredients = [...new Set(weekIngredients)];

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#475569', fontSize:12 }}>Loading Atlas™…</div>;

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button style={S.navBtn} onClick={prevPeriod}>‹</button>
          <span style={S.monthTitle}>
            {viewMode === 'month' ? `${MONTH_NAMES[month]} ${year}` : `Week of ${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()}, ${ws.getFullYear()}`}
          </span>
          <button style={S.navBtn} onClick={nextPeriod}>›</button>
        </div>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <button style={S.viewBtn(viewMode==='month')} onClick={() => setViewMode('month')}>Month</button>
          <button style={S.viewBtn(viewMode==='week')} onClick={() => setViewMode('week')}>Week</button>
          <button style={S.newBtn} onClick={() => openCreate()}>+ New</button>
          <button
            style={{ ...S.newBtn, border:'1px solid rgba(56,189,248,0.3)', background:'rgba(56,189,248,0.08)', color:'#38bdf8' }}
            onClick={handleExportICS}
            title="Export this calendar to .ics file"
          >📆 iCal</button>
          <button
            style={{ ...S.newBtn, border:'1px solid rgba(167,139,250,0.3)', background:'rgba(167,139,250,0.08)', color:'#a78bfa' }}
            onClick={() => setSidePanel(sidePanel==='shopping'?'none':'shopping')}
            title="Shopping list from this week's meals"
          >🛒 Shop</button>
        </div>
      </div>

      {/* Plate-spinner */}
      {todaySlotEvents.length > 0 && (
        <div style={S.plateSpin}>
          <div style={S.plateTitle}>🍽️ On the plate now — {MEAL_LABELS[activeSlot]}</div>
          {todaySlotEvents.map(ev => (
            <span key={ev.id} style={S.plateChip(eventColor(ev))} onClick={() => { setSelectedEvent(ev); setSidePanel('detail'); }}>
              {ev.delegate ? `→ ${ev.delegate}: ` : ''}{ev.title}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Main content */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {viewMode === 'month' ? (
            <MonthGrid year={year} month={month} today={today} events={events}
              onDayClick={(date) => openCreate({ date })}
              onEventClick={(ev) => { setSelectedEvent(ev); setSidePanel('detail'); }}
            />
          ) : (
            <WeekGrid ws={ws} today={today} events={events}
              onCellClick={(date, slot) => openCreate({ date, mealSlot: slot })}
              onEventClick={(ev) => { setSelectedEvent(ev); setSidePanel('detail'); }}
            />
          )}
        </div>

        {/* Side panel */}
        {sidePanel !== 'none' && (
          <div style={S.sidebar}>
            {sidePanel === 'shopping' && (
              <ShoppingList ingredients={uniqueIngredients} checked={shopChecked} onCheck={setShopChecked} onClose={() => setSidePanel('none')} />
            )}
            {sidePanel === 'create' && (
              <CreateForm
                form={form} setForm={setForm} conflict={conflict}
                onSave={() => handleSave(false)}
                onForceSave={() => handleSave(true)}
                onCancel={() => { setSidePanel('none'); setConflict(null); }}
              />
            )}
            {sidePanel === 'detail' && selectedEvent && (
              <EventDetail event={selectedEvent} onDelete={() => handleDelete(selectedEvent.id)} onClose={() => setSidePanel('none')} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({ year, month, today, events, onDayClick, onEventClick }: {
  year: number; month: number; today: Date; events: AtlasEvent[];
  onDayClick: (date: string) => void;
  onEventClick: (ev: AtlasEvent) => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInPrev = getDaysInMonth(year, month===0?11:month-1);
  const cells: Array<{ date: Date; currentMonth: boolean }> = [];
  for (let i = firstDay-1; i >= 0; i--) cells.push({ date: new Date(year, month-1, daysInPrev-i), currentMonth:false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), currentMonth:true });
  const rem = 7 - (cells.length % 7);
  if (rem < 7) for (let d = 1; d <= rem; d++) cells.push({ date: new Date(year, month+1, d), currentMonth:false });

  function eventsForDay(date: Date): AtlasEvent[] {
    const ds = fmt(date);
    return events.filter(e => e.startTime.startsWith(ds) || (e.startTime.slice(0,10) <= ds && e.endTime.slice(0,10) >= ds));
  }

  return (
    <div style={S.calendarArea}>
      <div style={S.dayHeaders}>
        {DAY_NAMES.map(d => <div key={d} style={S.dayHeader}>{d}</div>)}
      </div>
      <div style={S.calGrid}>
        {cells.map((cell, idx) => {
          const isToday = fmt(cell.date) === fmt(today);
          const dayEvs = eventsForDay(cell.date);
          return (
            <div key={idx} style={S.dayCell(isToday, cell.currentMonth)} onClick={() => cell.currentMonth && onDayClick(fmt(cell.date))}>
              <div style={S.dayNum(isToday)}>{cell.date.getDate()}</div>
              {dayEvs.slice(0,3).map(ev => (
                <div key={ev.id} style={S.eventChip(eventColor(ev))} onClick={e => { e.stopPropagation(); onEventClick(ev); }} title={ev.title}>
                  {ev.mealSlot ? `${ev.mealSlot[0].toUpperCase()} ` : ''}{ev.delegate ? `→${ev.delegate.split(' ')[0]} ` : ''}{ev.title}
                </div>
              ))}
              {dayEvs.length > 3 && <div style={{ fontSize:7, color:'#475569' }}>+{dayEvs.length-3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week Grid ────────────────────────────────────────────────────────────────

function WeekGrid({ ws, today, events, onCellClick, onEventClick }: {
  ws: Date; today: Date; events: AtlasEvent[];
  onCellClick: (date: string, slot: MealSlot) => void;
  onEventClick: (ev: AtlasEvent) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  function eventsForSlot(date: Date, slot: MealSlot): AtlasEvent[] {
    const ds = fmt(date);
    return events.filter(ev =>
      ev.startTime.startsWith(ds) &&
      (ev.mealSlot === slot || (!ev.mealSlot && guessMealSlot(ev.startTime) === slot))
    );
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'0 14px 14px' }}>
      {/* Day headers */}
      <div style={{ display:'grid', gridTemplateColumns:'80px repeat(7, 1fr)', gap:2, marginBottom:4 }}>
        <div />
        {days.map((d, i) => {
          const isToday = fmt(d) === fmt(today);
          return (
            <div key={i} style={{ textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#475569', textTransform:'uppercase', letterSpacing:'0.04em' }}>{DAY_NAMES[(d.getDay())]}</div>
              <div style={{ fontSize:14, fontWeight:isToday?700:400, color:isToday?'#6ee7b7':'#e2e8f0', marginTop:1 }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      {/* Meal rows */}
      {MEAL_SLOTS.map(slot => (
        <div key={slot} style={{ display:'grid', gridTemplateColumns:'80px repeat(7, 1fr)', gap:2, marginBottom:4 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:8, fontSize:9, fontWeight:600, color:'#64748b' }}>
            {MEAL_LABELS[slot]}
          </div>
          {days.map((d, i) => {
            const isToday = fmt(d) === fmt(today);
            const slotEvs = eventsForSlot(d, slot);
            return (
              <div key={i}
                style={{ background:isToday?'rgba(110,231,183,0.04)':'rgba(15,23,42,0.4)', border:isToday?'1px solid rgba(110,231,183,0.2)':'1px solid rgba(100,116,139,0.08)', borderRadius:4, padding:'4px 5px', minHeight:64, cursor:'pointer' }}
                onClick={() => onCellClick(fmt(d), slot)}
              >
                {slotEvs.length === 0 && <div style={{ fontSize:8, color:'rgba(100,116,139,0.3)', textAlign:'center', marginTop:8 }}>+</div>}
                {slotEvs.map(ev => (
                  <div key={ev.id}
                    style={{ fontSize:9, borderRadius:4, padding:'2px 5px', background:`${eventColor(ev)}20`, border:`1px solid ${eventColor(ev)}40`, color:eventColor(ev), marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }}
                    onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                    title={ev.title}
                  >
                    {ev.delegate ? <span style={{ fontSize:7, opacity:0.7 }}>→{ev.delegate.split(' ')[0]} </span> : null}{ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateForm({ form, setForm, conflict, onSave, onForceSave, onCancel }: {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  conflict: AtlasEvent | null;
  onSave: () => void;
  onForceSave: () => void;
  onCancel: () => void;
}) {
  const [newParticipant, setNewParticipant] = useState('');
  const [showRecurrence, setShowRecurrence] = useState(false);

  function addParticipant(name: string) {
    if (!name.trim()) return;
    const color = PARTICIPANT_COLORS[form.participants.length % PARTICIPANT_COLORS.length];
    const p: AtlasParticipant = { id: genId(), displayName: name.trim(), status: 'invited', color };
    setForm(f => ({ ...f, participants: [...f.participants, p] }));
  }

  function setRecurrence(r: RecurrenceRule | null) {
    setForm(f => ({ ...f, recurrence: r }));
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={S.sidebarHeader}>📅 New Event</div>
      <div style={{ ...S.sidebarBody, overflowY:'auto' }}>
        {conflict && (
          <div style={S.conflictBanner}>
            ⚠️ Conflict: <strong>{conflict.title}</strong> already scheduled for this slot.{' '}
            <button style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', fontSize:10, textDecoration:'underline', padding:0 }} onClick={onForceSave}>Add anyway</button>
          </div>
        )}

        <div style={S.formField}>
          <label style={S.formLabel}>Title *</label>
          <input style={S.formInput} value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} placeholder="Event title" />
        </div>
        <div style={S.formField}>
          <label style={S.formLabel}>Meal slot</label>
          <select style={S.formSelect} value={form.mealSlot} onChange={e => setForm(f => ({ ...f, mealSlot: e.target.value as MealSlot | '' }))}>
            <option value="">General event</option>
            {MEAL_SLOTS.map(s => <option key={s} value={s}>{MEAL_LABELS[s]}</option>)}
          </select>
        </div>
        <div style={S.formCheck}>
          <input type="checkbox" id="allday" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay:e.target.checked }))} />
          <label htmlFor="allday">All-day</label>
        </div>
        {!form.allDay && (
          <>
            <div style={S.formField}>
              <label style={S.formLabel}>Start</label>
              <input type="datetime-local" style={S.formInput} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime:e.target.value }))} />
            </div>
            <div style={S.formField}>
              <label style={S.formLabel}>End</label>
              <input type="datetime-local" style={S.formInput} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime:e.target.value }))} />
            </div>
          </>
        )}
        <div style={S.formField}>
          <label style={S.formLabel}>Delegate to →</label>
          <input style={S.formInput} value={form.delegate} onChange={e => setForm(f => ({ ...f, delegate:e.target.value }))} placeholder="Name or email" />
        </div>
        <div style={S.formField}>
          <label style={S.formLabel}>Location</label>
          <input style={S.formInput} value={form.location} onChange={e => setForm(f => ({ ...f, location:e.target.value }))} placeholder="Optional" />
        </div>
        <div style={S.formField}>
          <label style={S.formLabel}>Description</label>
          <input style={S.formInput} value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} placeholder="Optional" />
        </div>
        <div style={S.formField}>
          <label style={S.formLabel}>Ingredients (comma-separated, for shopping list)</label>
          <input style={S.formInput} value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients:e.target.value }))} placeholder="eggs, flour, butter…" />
        </div>

        {/* Participants */}
        <div style={{ ...S.formField, marginTop:4 }}>
          <label style={S.formLabel}>Participants</label>
          <div style={{ display:'flex', gap:4 }}>
            <input style={{ ...S.formInput, flex:1 }} value={newParticipant} onChange={e => setNewParticipant(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') { addParticipant(newParticipant); setNewParticipant(''); } }} placeholder="Name + Enter" />
            <button style={S.btn('secondary')} onClick={() => { addParticipant(newParticipant); setNewParticipant(''); }}>Add</button>
          </div>
          {form.participants.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'2px 0' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:p.color, display:'inline-block' }} />
              <span style={{ fontSize:10, color:'#94a3b8' }}>{p.displayName}</span>
            </div>
          ))}
        </div>

        {/* Recurrence */}
        <div style={S.formField}>
          <button style={{ background:'none', border:'none', color:'#6ee7b7', fontSize:10, cursor:'pointer', padding:0 }} onClick={() => setShowRecurrence(r => !r)}>
            {showRecurrence ? '▾' : '▸'} Repeat?{form.recurrence ? ` (${form.recurrence.frequency})` : ''}
          </button>
          {showRecurrence && (
            <RecurrenceEditor rule={form.recurrence} onChange={setRecurrence} />
          )}
        </div>
      </div>
      <div style={{ display:'flex', gap:6, padding:'8px 12px', borderTop:'1px solid rgba(100,116,139,0.1)' }}>
        <button style={S.btn('secondary')} onClick={onCancel}>Cancel</button>
        <button style={{ ...S.btn('primary'), opacity:form.title.trim()?1:0.5 }} onClick={onSave} disabled={!form.title.trim()}>Save</button>
      </div>
    </div>
  );
}

// ─── Recurrence Editor ────────────────────────────────────────────────────────

function RecurrenceEditor({ rule, onChange }: { rule: RecurrenceRule | null; onChange: (r: RecurrenceRule | null) => void }) {
  const [freq, setFreq] = useState<RecurrenceRule['frequency']>(rule?.frequency ?? 'weekly');
  const [interval, setInterval] = useState(rule?.interval ?? 1);
  const [endDate, setEndDate] = useState(rule?.endDate ?? '');

  function apply() { onChange({ frequency:freq, interval, endDate:endDate||null, daysOfWeek:[] }); }
  function clear() { onChange(null); }

  return (
    <div style={{ background:'rgba(15,23,42,0.4)', border:'1px solid rgba(100,116,139,0.15)', borderRadius:6, padding:'8px 10px', marginTop:4 }}>
      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
        <select style={{ ...S.formSelect, flex:1 }} value={freq} onChange={e => setFreq(e.target.value as RecurrenceRule['frequency'])}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#94a3b8' }}>
          Every
          <input type="number" min={1} max={99} style={{ ...S.formInput, width:44 }} value={interval} onChange={e => setInterval(Number(e.target.value))} />
        </div>
      </div>
      <div style={S.formField}>
        <label style={S.formLabel}>End date (optional)</label>
        <input type="date" style={S.formInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button style={S.btn('primary')} onClick={apply}>Apply</button>
        <button style={S.btn('secondary')} onClick={clear}>Clear</button>
      </div>
    </div>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

function EventDetail({ event, onDelete, onClose }: { event: AtlasEvent; onDelete: () => void; onClose: () => void }) {
  const color = eventColor(event);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ ...S.sidebarHeader, borderLeft:`3px solid ${color}`, paddingLeft:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:12, color:'#e2e8f0', fontWeight:700 }}>{event.title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14 }}>✕</button>
        </div>
        {event.mealSlot && <div style={{ fontSize:9, color:'#6ee7b7', marginTop:2 }}>{MEAL_LABELS[event.mealSlot]}</div>}
      </div>
      <div style={{ ...S.sidebarBody, overflowY:'auto' }}>
        <div style={{ fontSize:10, color:'#64748b', marginBottom:6 }}>
          📅 {new Date(event.startTime).toLocaleString()} → {new Date(event.endTime).toLocaleString()}
        </div>
        {event.delegate && (
          <div style={{ marginBottom:6 }}>
            <span style={S.delegateBadge}>→ Delegated to: {event.delegate}</span>
          </div>
        )}
        {event.location && <div style={{ fontSize:10, color:'#94a3b8', marginBottom:6 }}>📍 {event.location}</div>}
        {event.description && <div style={{ fontSize:11, color:'#94a3b8', lineHeight:1.6, marginBottom:8 }}>{event.description}</div>}
        {event.recurrence && (
          <div style={{ fontSize:9, color:'#a78bfa', marginBottom:6 }}>
            🔁 Repeats {event.recurrence.frequency}, every {event.recurrence.interval}
            {event.recurrence.endDate ? ` until ${event.recurrence.endDate}` : ''}
          </div>
        )}
        {(event.ingredients ?? []).length > 0 && (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#64748b', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Ingredients</div>
            {(event.ingredients ?? []).map((ing, i) => (
              <div key={i} style={{ fontSize:10, color:'#94a3b8', padding:'1px 0' }}>• {ing}</div>
            ))}
          </div>
        )}
        {event.participants.length > 0 && (
          <>
            <div style={{ fontSize:9, fontWeight:700, color:'#64748b', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Participants</div>
            {event.participants.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 0' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:p.color, display:'inline-block' }} />
                <span style={{ fontSize:10, color:'#e2e8f0' }}>{p.displayName}</span>
                <span style={{ fontSize:8, color:'#475569', marginLeft:'auto' }}>{p.status}</span>
              </div>
            ))}
          </>
        )}
        {event.p2pSynced && <div style={{ fontSize:9, color:'#38bdf8', marginTop:6 }}>⟳ P2P synced</div>}
      </div>
      <div style={{ padding:'8px 12px', borderTop:'1px solid rgba(100,116,139,0.1)' }}>
        <button onClick={onDelete} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.06)', color:'#f87171' }}>Delete</button>
      </div>
    </div>
  );
}

// ─── Shopping List ────────────────────────────────────────────────────────────

function ShoppingList({ ingredients, checked, onCheck, onClose }: {
  ingredients: string[];
  checked: Record<string,boolean>;
  onCheck: (c: Record<string,boolean>) => void;
  onClose: () => void;
}) {
  function toggle(item: string) {
    onCheck({ ...checked, [item]: !checked[item] });
  }

  function copyAll() {
    const lines = ingredients.filter(i => !checked[i]).map(i => `• ${i}`).join('\n');
    navigator.clipboard.writeText(lines).catch(() => {});
  }

  return (
    <div style={S.shopList}>
      <div style={{ ...S.sidebarHeader, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>🛒 Shopping List</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px 12px' }}>
        {ingredients.length === 0 ? (
          <div style={{ fontSize:11, color:'#475569', textAlign:'center', marginTop:20 }}>
            No ingredients this week.<br />
            <span style={{ fontSize:10 }}>Add ingredients when creating meal events.</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize:9, color:'#64748b', marginBottom:8 }}>This week's ingredients from scheduled meals:</div>
            {ingredients.map(item => (
              <label key={item} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', cursor:'pointer' }}>
                <input type="checkbox" checked={!!checked[item]} onChange={() => toggle(item)} style={{ accentColor:'#6ee7b7', cursor:'pointer' }} />
                <span style={{ fontSize:11, color: checked[item]?'#475569':'#e2e8f0', textDecoration:checked[item]?'line-through':'none' }}>{item}</span>
              </label>
            ))}
          </>
        )}
      </div>
      {ingredients.length > 0 && (
        <div style={{ padding:'8px 12px', borderTop:'1px solid rgba(100,116,139,0.1)' }}>
          <button style={{ ...S.btn('secondary'), width:'100%' }} onClick={copyAll}>📋 Copy unchecked to clipboard</button>
        </div>
      )}
    </div>
  );
}
