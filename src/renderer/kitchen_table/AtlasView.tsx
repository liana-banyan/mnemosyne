// Atlas™ Scheduling Module — Mnemosyne™ v0.1.8 · SEG-FT-8 · BP052 NOVACULA
// Month-view calendar · events · multi-person availability · AI-assist · P2P sync · photos

import React, { useState, useEffect, useCallback } from 'react';
import type { AtlasEvent, AtlasParticipant, RecurrenceRule, PhotoRef } from '../../shared/kitchen_table_types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PARTICIPANT_COLORS = ['#6ee7b7', '#38bdf8', '#f59e0b', '#f87171', '#a78bfa', '#34d399', '#fb7185'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function eventColor(event: AtlasEvent): string {
  const colors = ['#6ee7b7', '#38bdf8', '#f59e0b', '#a78bfa', '#f87171'];
  let hash = 0;
  for (const c of event.id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px', flexShrink: 0 },
  monthTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },
  navBtn: { background: 'none', border: '1px solid rgba(100,116,139,0.2)', color: '#94a3b8', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 },
  newBtn: { padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7' },
  calendarArea: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', padding: '0 14px 14px' },
  dayHeaders: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 },
  dayHeader: { fontSize: 9, color: '#475569', textAlign: 'center' as const, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '2px 0' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flex: 1, overflowY: 'auto' as const },
  dayCell: (isToday: boolean, isCurrentMonth: boolean): React.CSSProperties => ({
    minHeight: 70,
    background: isToday ? 'rgba(110,231,183,0.06)' : 'rgba(15,23,42,0.4)',
    border: isToday ? '1px solid rgba(110,231,183,0.3)' : '1px solid rgba(100,116,139,0.1)',
    borderRadius: 6,
    padding: '4px 5px',
    overflow: 'hidden',
    opacity: isCurrentMonth ? 1 : 0.4,
  }),
  dayNum: (isToday: boolean): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: isToday ? 700 : 400,
    color: isToday ? '#6ee7b7' : '#64748b',
    marginBottom: 2,
  }),
  eventChip: (color: string): React.CSSProperties => ({
    fontSize: 8,
    borderRadius: 3,
    padding: '1px 4px',
    background: `${color}20`,
    border: `1px solid ${color}40`,
    color,
    marginBottom: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
  }),
  sidebar: { width: 280, borderLeft: '1px solid rgba(100,116,139,0.15)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  sidebarHeader: { padding: '10px 12px 6px', borderBottom: '1px solid rgba(100,116,139,0.1)', fontSize: 11, fontWeight: 600, color: '#94a3b8' },
  sidebarBody: { flex: 1, overflowY: 'auto' as const, padding: '8px 12px' },
  formField: { marginBottom: 8 },
  formLabel: { fontSize: 9, color: '#64748b', marginBottom: 2, display: 'block' },
  formInput: { width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#e2e8f0', fontSize: 10, padding: '4px 7px', outline: 'none', boxSizing: 'border-box' as const },
  formCheck: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#94a3b8', marginBottom: 6 },
  btn: (v: 'primary' | 'secondary'): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
    border: v === 'primary' ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(100,116,139,0.2)',
    background: v === 'primary' ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
    color: v === 'primary' ? '#6ee7b7' : '#94a3b8',
  }),
  participantBar: (color: string, pct: number): React.CSSProperties => ({
    height: 10, width: `${pct}%`, background: color, borderRadius: 3, display: 'inline-block',
  }),
  syncDot: { width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block', marginLeft: 4, boxShadow: '0 0 4px #38bdf8' },
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface AtlasViewProps {
  prefilledTitle?: string | null;
  onPrefilledConsumed?: () => void;
}

export function AtlasView({ prefilledTitle, onPrefilledConsumed }: AtlasViewProps = {}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<AtlasEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AtlasEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newEventForm, setNewEventForm] = useState(emptyForm());
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await (window.amplify as any)?.kitchenTable?.listAtlasEvents?.() as AtlasEvent[];
      setEvents(data ?? []);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // When a recipe is scheduled from the Kitchen Table, open the create form pre-filled
  useEffect(() => {
    if (prefilledTitle) {
      setNewEventForm((prev) => ({ ...prev, title: prefilledTitle }));
      setCreating(true);
      setSelectedEvent(null);
      onPrefilledConsumed?.();
    }
  }, [prefilledTitle, onPrefilledConsumed]);

  function prevMonth() { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInPrev = getDaysInMonth(year, month === 0 ? 11 : month - 1);

  const cells: Array<{ date: Date; currentMonth: boolean }> = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), currentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), currentMonth: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), currentMonth: false });
    }
  }

  function eventsForDay(date: Date): AtlasEvent[] {
    const ds = formatDate(date);
    return events.filter((e) => {
      const start = e.startTime.split('T')[0];
      const end = e.endTime.split('T')[0];
      return ds >= start && ds <= end;
    });
  }

  async function handleSaveEvent() {
    if (!newEventForm.title.trim()) return;
    try {
      const data: Omit<AtlasEvent, 'id' | 'createdAt'> = {
        title: newEventForm.title,
        description: newEventForm.description,
        startTime: newEventForm.startTime || new Date().toISOString(),
        endTime: newEventForm.endTime || new Date(Date.now() + 3_600_000).toISOString(),
        allDay: newEventForm.allDay,
        participants: newEventForm.participants,
        location: newEventForm.location || null,
        recurrence: null,
        photos: newEventForm.photos,
        aiSuggested: newEventForm.aiSuggested,
        p2pSynced: false,
      };
      const created = await (window.amplify as any)?.kitchenTable?.createAtlasEvent?.(data) as AtlasEvent;
      setEvents((prev) => [...prev, created]);
      setCreating(false);
      setSelectedEvent(created);
      setNewEventForm(emptyForm());
    } catch (e) { console.error('[AtlasView] create failed', e); }
  }

  async function handleDeleteEvent(id: string) {
    try {
      await (window.amplify as any)?.kitchenTable?.deleteAtlasEvent?.(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setSelectedEvent(null);
    } catch (e) { console.error('[AtlasView] delete failed', e); }
  }

  async function handleAiAssist() {
    if (!newEventForm.title.trim()) return;
    setAiLoading(true);
    try {
      const participants = newEventForm.participants.map((p) => p.displayName).join(', ');
      const prompt = `Suggest a good meeting time for "${newEventForm.title}" with participants: ${participants || 'unspecified'}. Return as JSON: { suggestedTime: "ISO datetime" }`;
      const result = await (window.amplify as any)?.ai?.({ prompt }) as { text?: string } | null;
      if (result?.text) {
        const match = result.text.match(/\{[\s\S]*?\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { suggestedTime?: string };
          if (parsed.suggestedTime) {
            const dt = new Date(parsed.suggestedTime);
            const endDt = new Date(dt.getTime() + 3_600_000);
            setNewEventForm((f) => ({ ...f, startTime: dt.toISOString(), endTime: endDt.toISOString(), aiSuggested: true }));
          }
        }
      }
    } catch { /* AI unavailable */ }
    finally { setAiLoading(false); }
  }

  async function handleAddPhoto() {
    try {
      const path = await (window.amplify as any)?.kitchenTable?.openPhotoDialog?.() as string | null;
      if (path) {
        const photo: PhotoRef = { id: generateId(), localPath: path, caption: null, takenAt: new Date().toISOString() };
        setNewEventForm((f) => ({ ...f, photos: [...f.photos, photo] }));
      }
    } catch { /* unavailable */ }
  }

  function addParticipant(name: string) {
    if (!name.trim()) return;
    const color = PARTICIPANT_COLORS[newEventForm.participants.length % PARTICIPANT_COLORS.length];
    const participant: AtlasParticipant = { id: generateId(), displayName: name.trim(), status: 'invited', color };
    setNewEventForm((f) => ({ ...f, participants: [...f.participants, participant] }));
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: 12 }}>Loading Atlas™…</div>;
  }

  return (
    <div style={S.root}>
      {/* Top nav */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={S.navBtn} onClick={prevMonth}>‹</button>
          <span style={S.monthTitle}>{MONTH_NAMES[month]} {year}</span>
          <button style={S.navBtn} onClick={nextMonth}>›</button>
        </div>
        <button style={S.newBtn} onClick={() => { setCreating(true); setSelectedEvent(null); }}>+ New Event</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Calendar grid */}
        <div style={S.calendarArea}>
          <div style={S.dayHeaders}>
            {DAY_NAMES.map((d) => <div key={d} style={S.dayHeader}>{d}</div>)}
          </div>
          <div style={S.calGrid}>
            {cells.map((cell, idx) => {
              const isToday = formatDate(cell.date) === formatDate(today);
              const dayEvents = eventsForDay(cell.date);
              return (
                <div key={idx} style={S.dayCell(isToday, cell.currentMonth)}>
                  <div style={S.dayNum(isToday)}>{cell.date.getDate()}</div>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      style={S.eventChip(eventColor(ev))}
                      onClick={() => { setSelectedEvent(ev); setCreating(false); }}
                      title={ev.title}
                    >
                      {ev.p2pSynced && <span style={S.syncDot} title="P2P synced" />}
                      {ev.aiSuggested && '℃ '}
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 7, color: '#475569' }}>+{dayEvents.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — event detail or creation form */}
        {(selectedEvent || creating) && (
          <div style={S.sidebar}>
            {creating ? (
              <CreateEventForm
                form={newEventForm}
                setForm={setNewEventForm}
                aiLoading={aiLoading}
                onAiAssist={handleAiAssist}
                onAddPhoto={handleAddPhoto}
                onAddParticipant={addParticipant}
                onSave={handleSaveEvent}
                onCancel={() => setCreating(false)}
              />
            ) : selectedEvent && (
              <EventDetail
                event={selectedEvent}
                onDelete={() => handleDeleteEvent(selectedEvent.id)}
                onClose={() => setSelectedEvent(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface EventFormState {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  participants: AtlasParticipant[];
  location: string;
  photos: PhotoRef[];
  aiSuggested: boolean;
}

function emptyForm(): EventFormState {
  const now = new Date();
  const later = new Date(now.getTime() + 3_600_000);
  return {
    title: '', description: '',
    startTime: now.toISOString().slice(0, 16),
    endTime: later.toISOString().slice(0, 16),
    allDay: false, participants: [], location: '', photos: [], aiSuggested: false,
  };
}

// ─── Create Event Form ────────────────────────────────────────────────────────

function CreateEventForm({
  form, setForm, aiLoading, onAiAssist, onAddPhoto, onAddParticipant, onSave, onCancel,
}: {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  aiLoading: boolean;
  onAiAssist: () => void;
  onAddPhoto: () => void;
  onAddParticipant: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [newParticipant, setNewParticipant] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={S.sidebarHeader}>
        📅 New Event
        {form.aiSuggested && <span style={{ fontSize: 9, color: '#6ee7b7', marginLeft: 6 }}>℃ AI-suggested time</span>}
      </div>
      <div style={{ ...S.sidebarBody, overflowY: 'auto' }}>
        <div style={S.formField}>
          <label style={S.formLabel}>Title *</label>
          <input style={S.formInput} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Event title" />
        </div>
        <div style={S.formField}>
          <label style={S.formLabel}>Description</label>
          <input style={S.formInput} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
        </div>
        <div style={S.formCheck}>
          <input type="checkbox" id="allday" checked={form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))} />
          <label htmlFor="allday">All-day</label>
        </div>
        {!form.allDay && (
          <>
            <div style={S.formField}>
              <label style={S.formLabel}>Start</label>
              <input type="datetime-local" style={S.formInput} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div style={S.formField}>
              <label style={S.formLabel}>End</label>
              <input type="datetime-local" style={S.formInput} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </>
        )}
        <div style={S.formField}>
          <label style={S.formLabel}>Location</label>
          <input style={S.formInput} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Optional location" />
        </div>

        {/* Participants */}
        <div style={{ ...S.formField, marginTop: 4 }}>
          <label style={S.formLabel}>Participants</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              style={{ ...S.formInput, flex: 1 }}
              value={newParticipant}
              onChange={(e) => setNewParticipant(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onAddParticipant(newParticipant); setNewParticipant(''); } }}
              placeholder="Name + Enter"
            />
            <button style={S.btn('secondary')} onClick={() => { onAddParticipant(newParticipant); setNewParticipant(''); }}>Add</button>
          </div>
          {form.participants.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{p.displayName}</span>
            </div>
          ))}
        </div>

        {/* Availability bar (simplified) */}
        {form.participants.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={S.formLabel}>Availability (mock)</div>
            {form.participants.map((p, i) => (
              <div key={p.id} style={{ marginBottom: 3 }}>
                <div style={{ fontSize: 9, color: p.color, marginBottom: 1 }}>{p.displayName}</div>
                <div style={{ height: 10, background: 'rgba(100,116,139,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ ...S.participantBar(p.color, 60 + (i * 13) % 30), height: '100%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button style={{ ...S.btn('primary'), opacity: aiLoading ? 0.6 : 1 }} onClick={onAiAssist} disabled={aiLoading || !form.title.trim()}>
            {aiLoading ? '℃ Thinking…' : '℃ AI Time'}
          </button>
          <button style={S.btn('secondary')} onClick={onAddPhoto}>📷 Photo</button>
        </div>

        {form.photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {form.photos.map((p) => (
              <img key={p.id} src={`file://${p.localPath}`} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderTop: '1px solid rgba(100,116,139,0.1)' }}>
        <button style={S.btn('secondary')} onClick={onCancel}>Cancel</button>
        <button style={{ ...S.btn('primary'), opacity: form.title.trim() ? 1 : 0.5 }} onClick={onSave} disabled={!form.title.trim()}>Save Event</button>
      </div>
    </div>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

function EventDetail({ event, onDelete, onClose }: { event: AtlasEvent; onDelete: () => void; onClose: () => void }) {
  const color = eventColor(event);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ ...S.sidebarHeader, borderLeft: `3px solid ${color}`, paddingLeft: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}>
            {event.aiSuggested && <span style={{ color: '#6ee7b7', marginRight: 4, fontSize: 10 }}>℃</span>}
            {event.title}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        {event.p2pSynced && <div style={{ fontSize: 9, color: '#38bdf8', marginTop: 2 }}>⟳ P2P synced</div>}
      </div>
      <div style={{ ...S.sidebarBody, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
          📅 {new Date(event.startTime).toLocaleString()} → {new Date(event.endTime).toLocaleString()}
        </div>
        {event.location && <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>📍 {event.location}</div>}
        {event.description && <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }}>{event.description}</div>}

        {event.participants.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Participants</div>
            {event.participants.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: '#e2e8f0' }}>{p.displayName}</span>
                <span style={{ fontSize: 8, color: '#475569', marginLeft: 'auto' }}>{p.status}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Availability</div>
              {event.participants.map((p, i) => (
                <div key={p.id} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: p.color, marginBottom: 1 }}>{p.displayName}</div>
                  <div style={{ height: 8, background: 'rgba(100,116,139,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ ...S.participantBar(p.color, 50 + (i * 17) % 40), height: '100%' }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {event.photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {event.photos.map((p) => (
              <img key={p.id} src={`file://${p.localPath}`} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 5 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(100,116,139,0.1)' }}>
        <button
          onClick={onDelete}
          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)', color: '#f87171' }}
        >
          Delete Event
        </button>
      </div>
    </div>
  );
}
