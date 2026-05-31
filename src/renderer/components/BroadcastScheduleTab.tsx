// BroadcastScheduleTab — Mnemosyne™ Tab 16 · BP067 Phase 2C
// Cooperative content/announcement scheduler
// Week view of scheduled broadcasts · Add broadcast form · Pending vs Sent · local storage

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type BroadcastChannel = 'email' | 'push' | 'in-app';
type BroadcastStatus = 'pending' | 'sent';

interface Broadcast {
  id: string;
  title: string;
  scheduledAt: string;
  channel: BroadcastChannel;
  body: string;
  status: BroadcastStatus;
  createdAt: string;
}

// ─── Local storage ────────────────────────────────────────────────────────────

const LS_KEY = 'mnemo_broadcasts';

function load(): Broadcast[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Broadcast[]) : [];
  } catch { return []; }
}

function save(broadcasts: Broadcast[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(broadcasts));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<BroadcastChannel, string> = {
  email: '📧 Email',
  push: '🔔 Push',
  'in-app': '💬 In-App',
};

const CHANNEL_COLORS: Record<BroadcastChannel, string> = {
  email: '#38bdf8',
  push: '#f59e0b',
  'in-app': '#6ee7b7',
};

function getWeekDays(): Date[] {
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

const DAY_NAMES_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function fmt(d: Date): string { return d.toISOString().split('T')[0]; }

// ─── Component ────────────────────────────────────────────────────────────────

export function BroadcastScheduleTab() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('all');

  // Form state
  const [fTitle, setFTitle] = useState('');
  const [fScheduledAt, setFScheduledAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [fChannel, setFChannel] = useState<BroadcastChannel>('in-app');
  const [fBody, setFBody] = useState('');

  const weekDays = getWeekDays();
  const todayStr = fmt(new Date());

  function addBroadcast() {
    if (!fTitle.trim() || !fBody.trim()) return;
    const entry: Broadcast = {
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
  }

  function markSent(id: string) {
    const next = broadcasts.map(b => b.id === id ? { ...b, status: 'sent' as BroadcastStatus } : b);
    setBroadcasts(next);
    save(next);
  }

  function remove(id: string) {
    const next = broadcasts.filter(b => b.id !== id);
    setBroadcasts(next);
    save(next);
  }

  // Group by day for week view
  function broadcastsForDay(date: Date): Broadcast[] {
    const ds = fmt(date);
    return broadcasts.filter(b => b.scheduledAt.startsWith(ds));
  }

  const filtered = broadcasts.filter(b => filter === 'all' || b.status === filter);
  const pending = broadcasts.filter(b => b.status === 'pending').length;

  return (
    <div style={{ padding:'16px 20px', overflowY:'auto', height:'100%', boxSizing:'border-box' }}>
      <div style={{ maxWidth:700, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#e2e8f0', marginBottom:2 }}>📡 Broadcast Schedule</div>
            <div style={{ fontSize:11, color:'#475569' }}>Cooperative content and announcement scheduler</div>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            style={{ padding:'7px 16px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid rgba(110,231,183,0.35)', background:'rgba(110,231,183,0.1)', color:'#6ee7b7' }}
          >
            {showForm ? 'Cancel' : '+ Add Broadcast'}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(110,231,183,0.15)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:12 }}>New Broadcast</div>
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:9, color:'#64748b', display:'block', marginBottom:3 }}>Title *</label>
              <input
                style={inputStyle} value={fTitle} onChange={e => setFTitle(e.target.value)}
                placeholder="Broadcast title or announcement subject"
              />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div>
                <label style={{ fontSize:9, color:'#64748b', display:'block', marginBottom:3 }}>Date & Time</label>
                <input type="datetime-local" style={inputStyle} value={fScheduledAt} onChange={e => setFScheduledAt(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:9, color:'#64748b', display:'block', marginBottom:3 }}>Channel</label>
                <select style={inputStyle} value={fChannel} onChange={e => setFChannel(e.target.value as BroadcastChannel)}>
                  {(Object.keys(CHANNEL_LABELS) as BroadcastChannel[]).map(ch => (
                    <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:9, color:'#64748b', display:'block', marginBottom:3 }}>Message body *</label>
              <textarea
                style={{ ...inputStyle, height:80, resize:'vertical' as const, fontFamily:'system-ui,-apple-system,sans-serif' }}
                value={fBody} onChange={e => setFBody(e.target.value)}
                placeholder="Write your cooperative announcement here…"
              />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={addBroadcast}
                disabled={!fTitle.trim() || !fBody.trim()}
                style={{ flex:1, padding:'8px 0', borderRadius:7, fontSize:12, fontWeight:700, cursor:fTitle.trim()&&fBody.trim()?'pointer':'not-allowed', border:'1px solid rgba(110,231,183,0.35)', background:'rgba(110,231,183,0.1)', color:'#6ee7b7', opacity:fTitle.trim()&&fBody.trim()?1:0.5 }}
              >
                Schedule Broadcast
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding:'8px 16px', borderRadius:7, fontSize:12, cursor:'pointer', border:'1px solid rgba(100,116,139,0.2)', background:'transparent', color:'#64748b' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Week view */}
        <div style={{ background:'rgba(15,23,42,0.4)', border:'1px solid rgba(100,116,139,0.1)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', marginBottom:10 }}>This Week</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
            {weekDays.map((day, i) => {
              const isToday = fmt(day) === todayStr;
              const dayBroadcasts = broadcastsForDay(day);
              return (
                <div key={i} style={{ background:isToday?'rgba(110,231,183,0.04)':'rgba(15,23,42,0.4)', border:isToday?'1px solid rgba(110,231,183,0.2)':'1px solid rgba(100,116,139,0.08)', borderRadius:6, padding:'5px 6px', minHeight:80 }}>
                  <div style={{ fontSize:9, fontWeight:isToday?700:500, color:isToday?'#6ee7b7':'#64748b', marginBottom:4, textAlign:'center' }}>
                    {DAY_NAMES_SHORT[i]}<br />{day.getDate()}
                  </div>
                  {dayBroadcasts.length === 0 && <div style={{ fontSize:8, color:'rgba(100,116,139,0.25)', textAlign:'center' }}>—</div>}
                  {dayBroadcasts.map(b => (
                    <div key={b.id} style={{
                      fontSize:8, borderRadius:3, padding:'2px 4px', marginBottom:2,
                      background:`${CHANNEL_COLORS[b.channel]}18`, border:`1px solid ${CHANNEL_COLORS[b.channel]}40`,
                      color:b.status==='sent'?'#475569':CHANNEL_COLORS[b.channel],
                      textDecoration:b.status==='sent'?'line-through':'none',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }} title={b.title}>
                      {b.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          {(['all','pending','sent'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'4px 12px', borderRadius:6, fontSize:10, fontWeight:filter===f?700:500, cursor:'pointer',
              border:filter===f?'1px solid rgba(110,231,183,0.35)':'1px solid rgba(100,116,139,0.2)',
              background:filter===f?'rgba(110,231,183,0.08)':'transparent',
              color:filter===f?'#6ee7b7':'#64748b',
            }}>
              {f === 'all' ? `All (${broadcasts.length})` : f === 'pending' ? `Pending (${pending})` : `Sent (${broadcasts.length - pending})`}
            </button>
          ))}
        </div>

        {/* Broadcast list */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize:11, color:'#334155', textAlign:'center', padding:'24px 0' }}>
              {filter === 'all' ? 'No broadcasts yet. Schedule your first cooperative announcement.' : `No ${filter} broadcasts.`}
            </div>
          ) : (
            filtered.map(b => (
              <BroadcastCard key={b.id} broadcast={b} onMarkSent={() => markSent(b.id)} onRemove={() => remove(b.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Broadcast Card ───────────────────────────────────────────────────────────

function BroadcastCard({ broadcast: b, onMarkSent, onRemove }: {
  broadcast: Broadcast;
  onMarkSent: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = CHANNEL_COLORS[b.channel];
  const isPending = b.status === 'pending';

  return (
    <div style={{
      background:'rgba(15,23,42,0.5)', border:`1px solid ${isPending?'rgba(100,116,139,0.15)':'rgba(100,116,139,0.08)'}`,
      borderRadius:8, padding:'10px 14px', opacity:isPending?1:0.7,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:isPending?'#e2e8f0':'#64748b', textDecoration:isPending?'none':'line-through' }}>{b.title}</span>
            <span style={{ fontSize:9, padding:'1px 7px', borderRadius:10, background:`${color}18`, border:`1px solid ${color}40`, color }}>{CHANNEL_LABELS[b.channel]}</span>
            {b.status === 'sent' && <span style={{ fontSize:9, padding:'1px 7px', borderRadius:10, background:'rgba(110,231,183,0.1)', border:'1px solid rgba(110,231,183,0.25)', color:'#6ee7b7' }}>✓ Sent</span>}
          </div>
          <div style={{ fontSize:10, color:'#475569', marginBottom:4 }}>
            🕐 {new Date(b.scheduledAt).toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
          </div>
          {expanded && (
            <div style={{ fontSize:11, color:'#94a3b8', lineHeight:1.7, marginTop:6, background:'rgba(15,23,42,0.4)', borderRadius:6, padding:'8px 10px', whiteSpace:'pre-wrap' }}>
              {b.body}
            </div>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
          <button onClick={() => setExpanded(e => !e)} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:11 }} title={expanded?'Collapse':'Expand'}>
            {expanded ? '▲' : '▼'}
          </button>
          {isPending && (
            <button onClick={onMarkSent} style={{ background:'rgba(110,231,183,0.08)', border:'1px solid rgba(110,231,183,0.25)', borderRadius:5, color:'#6ee7b7', fontSize:9, fontWeight:600, cursor:'pointer', padding:'3px 7px', whiteSpace:'nowrap' }}>
              Mark Sent
            </button>
          )}
          <button onClick={onRemove} style={{ background:'none', border:'none', color:'#334155', cursor:'pointer', fontSize:12 }} title="Remove">✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
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
