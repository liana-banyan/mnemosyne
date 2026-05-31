// BatteryDispatchTab — Mnemosyne™ Tab 15 · BP067 Phase 2B
// Cooperative time/energy dispatch system
// Shows battery charge (available cooperative contribution hours this week)
// Reserve vs Spend · dispatch log · local storage · no backend required

import React, { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DispatchEntry {
  id: string;
  task: string;
  hours: number;
  type: 'reserve' | 'spend';
  note: string;
  timestamp: string;
}

// ─── Local Storage helpers ────────────────────────────────────────────────────

const LS_KEY = 'mnemo_battery_dispatch';
const LS_CAPACITY = 'mnemo_battery_capacity';
const DEFAULT_CAPACITY = 20; // hours/week

function loadEntries(): DispatchEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as DispatchEntry[]) : [];
  } catch { return []; }
}

function saveEntries(entries: DispatchEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

function loadCapacity(): number {
  try {
    const raw = localStorage.getItem(LS_CAPACITY);
    return raw ? Number(raw) : DEFAULT_CAPACITY;
  } catch { return DEFAULT_CAPACITY; }
}

// Keep only this week's entries
function thisWeekEntries(entries: DispatchEntry[]): DispatchEntry[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0,0,0,0);
  return entries.filter(e => new Date(e.timestamp) >= monday);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BatteryDispatchTab() {
  const [entries, setEntries] = useState<DispatchEntry[]>(loadEntries);
  const [capacity, setCapacity] = useState(loadCapacity);
  const [task, setTask] = useState('');
  const [hours, setHours] = useState(1);
  const [note, setNote] = useState('');
  const [type, setType] = useState<'reserve' | 'spend'>('spend');
  const [editCapacity, setEditCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState(String(loadCapacity()));

  const weekEntries = thisWeekEntries(entries);
  const spent = weekEntries.filter(e => e.type === 'spend').reduce((s, e) => s + e.hours, 0);
  const reserved = weekEntries.filter(e => e.type === 'reserve').reduce((s, e) => s + e.hours, 0);
  const available = Math.max(0, capacity - spent - reserved);
  const chargePercent = Math.round((available / capacity) * 100);

  function dispatch() {
    if (!task.trim() || hours <= 0) return;
    const entry: DispatchEntry = {
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
  }

  function removeEntry(id: string) {
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

  return (
    <div style={{ padding:'16px 20px', overflowY:'auto', height:'100%', boxSizing:'border-box' }}>
      <div style={{ maxWidth:600, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#e2e8f0', marginBottom:4 }}>⚡ Battery Dispatch</div>
          <div style={{ fontSize:11, color:'#475569', lineHeight:1.6 }}>
            Your cooperative contribution battery for the week. Reserve hours for yourself, spend them for cooperative tasks.
          </div>
        </div>

        {/* Battery visual */}
        <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(100,116,139,0.2)', borderRadius:12, padding:'18px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Charge Level</div>
              <div style={{ fontSize:28, fontWeight:800, color:chargeColor, marginTop:2 }}>{chargePercent}%</div>
              <div style={{ fontSize:10, color:'#64748b' }}>{available}h available of {capacity}h weekly</div>
            </div>

            {/* Battery icon */}
            <div style={{ position:'relative', width:60, height:28 }}>
              <div style={{ position:'absolute', inset:0, border:`2px solid ${chargeColor}`, borderRadius:4 }} />
              <div style={{ position:'absolute', left:2, top:2, bottom:2, width:`${Math.max(4, chargePercent) * 0.54}%`, background:chargeColor, borderRadius:2, transition:'width 0.4s ease' }} />
              <div style={{ position:'absolute', top:'25%', right:-7, width:5, height:'50%', background:chargeColor, borderRadius:'0 2px 2px 0' }} />
            </div>
          </div>

          {/* Charge bar */}
          <div style={{ height:8, background:'rgba(100,116,139,0.15)', borderRadius:4, overflow:'hidden', marginBottom:10 }}>
            <div style={{ height:'100%', width:`${chargePercent}%`, background:`linear-gradient(90deg, ${chargeColor}, ${chargeColor}aa)`, borderRadius:4, transition:'width 0.4s ease' }} />
          </div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
            {[
              { label:'Reserved', value:`${reserved}h`, color:'#38bdf8' },
              { label:'Spent', value:`${spent}h`, color:'#f87171' },
              { label:'Available', value:`${available}h`, color:chargeColor },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign:'center', background:'rgba(15,23,42,0.4)', borderRadius:6, padding:'6px 8px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:stat.color }}>{stat.value}</div>
                <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Capacity edit */}
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
            {editCapacity ? (
              <>
                <span style={{ fontSize:10, color:'#64748b' }}>Weekly capacity:</span>
                <input
                  type="number" min={1} max={168}
                  style={{ width:60, background:'rgba(15,23,42,0.6)', border:'1px solid rgba(100,116,139,0.3)', borderRadius:4, color:'#e2e8f0', fontSize:10, padding:'2px 6px', outline:'none' }}
                  value={capacityInput}
                  onChange={e => setCapacityInput(e.target.value)}
                />
                <span style={{ fontSize:10, color:'#64748b' }}>hours</span>
                <button onClick={saveCapacity} style={{ background:'rgba(110,231,183,0.1)', border:'1px solid rgba(110,231,183,0.3)', borderRadius:4, color:'#6ee7b7', fontSize:10, fontWeight:600, cursor:'pointer', padding:'2px 8px' }}>Save</button>
                <button onClick={() => setEditCapacity(false)} style={{ background:'none', border:'none', color:'#475569', fontSize:10, cursor:'pointer' }}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditCapacity(true)} style={{ background:'none', border:'none', color:'#475569', fontSize:10, cursor:'pointer', textDecoration:'underline' }}>
                Edit weekly capacity ({capacity}h)
              </button>
            )}
          </div>
        </div>

        {/* Dispatch form */}
        <div style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(100,116,139,0.15)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:12 }}>New Dispatch</div>

          {/* Reserve vs Spend toggle */}
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            {(['reserve','spend'] as const).map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                flex:1, padding:'6px 0', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
                border: type===t ? `1px solid ${t==='reserve'?'rgba(56,189,248,0.4)':'rgba(248,113,113,0.4)'}` : '1px solid rgba(100,116,139,0.2)',
                background: type===t ? (t==='reserve'?'rgba(56,189,248,0.1)':'rgba(248,113,113,0.1)') : 'transparent',
                color: type===t ? (t==='reserve'?'#38bdf8':'#f87171') : '#64748b',
              }}>
                {t === 'reserve' ? '🔒 Reserve' : '⚡ Spend'}
              </button>
            ))}
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={{ fontSize:9, color:'#64748b', display:'block', marginBottom:3 }}>Task *</label>
            <input
              style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(100,116,139,0.2)', borderRadius:5, color:'#e2e8f0', fontSize:11, padding:'6px 9px', outline:'none', boxSizing:'border-box' }}
              value={task} onChange={e => setTask(e.target.value)}
              placeholder={type==='reserve' ? 'What are you reserving time for?' : 'What cooperative task are you contributing to?'}
              onKeyDown={e => { if (e.key === 'Enter') dispatch(); }}
            />
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:9, color:'#64748b', display:'block', marginBottom:3 }}>Hours</label>
              <input
                type="number" min={0.5} max={24} step={0.5}
                style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(100,116,139,0.2)', borderRadius:5, color:'#e2e8f0', fontSize:11, padding:'6px 9px', outline:'none', boxSizing:'border-box' }}
                value={hours} onChange={e => setHours(Number(e.target.value))}
              />
            </div>
            <div style={{ flex:2 }}>
              <label style={{ fontSize:9, color:'#64748b', display:'block', marginBottom:3 }}>Note (optional)</label>
              <input
                style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(100,116,139,0.2)', borderRadius:5, color:'#e2e8f0', fontSize:11, padding:'6px 9px', outline:'none', boxSizing:'border-box' }}
                value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note"
              />
            </div>
          </div>
          <button
            onClick={dispatch}
            disabled={!task.trim() || hours <= 0}
            style={{
              width:'100%', padding:'8px 0', borderRadius:7, fontSize:12, fontWeight:700, cursor: task.trim()?'pointer':'not-allowed',
              border:'1px solid rgba(110,231,183,0.35)', background:'rgba(110,231,183,0.1)', color:'#6ee7b7',
              opacity: task.trim() ? 1 : 0.5,
            }}
          >
            Dispatch →
          </button>
        </div>

        {/* History */}
        <div style={{ background:'rgba(15,23,42,0.4)', border:'1px solid rgba(100,116,139,0.1)', borderRadius:10, padding:'12px 16px' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:10 }}>This Week</div>
          {weekEntries.length === 0 ? (
            <div style={{ fontSize:11, color:'#334155', textAlign:'center', padding:'16px 0' }}>No dispatches this week yet.</div>
          ) : (
            weekEntries.map(entry => (
              <div key={entry.id} style={{
                display:'flex', alignItems:'flex-start', gap:10, padding:'7px 0',
                borderBottom:'1px solid rgba(100,116,139,0.08)',
              }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{entry.type==='reserve'?'🔒':'⚡'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#e2e8f0' }}>{entry.task}</div>
                  {entry.note && <div style={{ fontSize:10, color:'#64748b', marginTop:1 }}>{entry.note}</div>}
                  <div style={{ fontSize:9, color:'#334155', marginTop:2 }}>
                    {entry.hours}h · {entry.type} · {new Date(entry.timestamp).toLocaleDateString(undefined, { weekday:'short', hour:'2-digit', minute:'2-digit' })}
                  </div>
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:entry.type==='reserve'?'#38bdf8':'#f87171', flexShrink:0 }}>
                  {entry.type==='reserve'?'':'−'}{entry.hours}h
                </span>
                <button onClick={() => removeEntry(entry.id)} style={{ background:'none', border:'none', color:'#334155', cursor:'pointer', fontSize:14, flexShrink:0, padding:'0 2px' }} title="Remove">✕</button>
              </div>
            ))
          )}
        </div>

        {/* Philosophy note */}
        <div style={{ marginTop:12, fontSize:10, color:'#334155', textAlign:'center', lineHeight:1.6 }}>
          "Help each other help ourselves." — The Cooperative
        </div>
      </div>
    </div>
  );
}
