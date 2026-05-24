// B83c — Drekaskip Wave Status Panel
// Live readout of current Drekaskip saga + wave instance count
// B61A commit 42ecdcd — Wave Generator LANDED, 12/12 G-gates PASS
// BP041 Layer 4: Adaptive Concurrency Carrier hot-tune controls added

import { useState, useEffect, useCallback } from 'react';
import { sagaSubscription } from './saga_subscription';
import type { SagaState, WaveInstance } from './saga_subscription';
import { DEFAULT_SAGA_STATE } from './saga_subscription';

interface CapInfo {
  cap: number;
  probed_at: string | null;
  override: number | null;
  is_stale: boolean;
}

function formatMinutesAgo(isoTs: string | null): string {
  if (!isoTs) return 'never';
  const diffMs  = Date.now() - new Date(isoTs).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function DrekaskipStatusPanel() {
  const [state, setState] = useState<SagaState>(DEFAULT_SAGA_STATE);
  const [selected, setSelected] = useState<WaveInstance | null>(null);

  // Layer 4: concurrency cap hot-tune state
  const [capInfo,     setCapInfo]     = useState<CapInfo | null>(null);
  const [probing,     setProbing]     = useState(false);
  const [overrideVal, setOverrideVal] = useState<number>(16);
  const [overrideOn,  setOverrideOn]  = useState(false);

  useEffect(() => {
    const unsub = sagaSubscription.subscribe(setState);
    return unsub;
  }, []);

  // Poll cap info on mount + every 30s
  const fetchCapInfo = useCallback(async () => {
    try {
      const info = await window.amplify.concurrencyGetCap?.();
      if (info) {
        setCapInfo(info);
        if (info.override !== null) {
          setOverrideVal(info.override);
          setOverrideOn(true);
        }
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchCapInfo();
    const timer = setInterval(fetchCapInfo, 30_000);
    return () => clearInterval(timer);
  }, [fetchCapInfo]);

  const handleReprobe = useCallback(async () => {
    setProbing(true);
    try {
      const result = await window.amplify.concurrencyProbeNow?.();
      if (result) {
        setCapInfo((prev) => prev ? { ...prev, cap: result.cap, probed_at: result.probed_at, is_stale: false } : null);
      }
    } catch { /* non-fatal */ }
    setProbing(false);
  }, []);

  const handleOverrideToggle = useCallback(async (enabled: boolean) => {
    setOverrideOn(enabled);
    const n = enabled ? overrideVal : null;
    try {
      await window.amplify.concurrencySetOverride?.(n);
      setCapInfo((prev) => prev ? { ...prev, override: n, cap: n ?? (prev.cap) } : null);
    } catch { /* non-fatal */ }
  }, [overrideVal]);

  const handleOverrideChange = useCallback(async (n: number) => {
    setOverrideVal(n);
    if (overrideOn) {
      try {
        await window.amplify.concurrencySetOverride?.(n);
        setCapInfo((prev) => prev ? { ...prev, override: n, cap: n } : null);
      } catch { /* non-fatal */ }
    }
  }, [overrideOn]);

  const complete = state.wave_instances.filter((w) => w.status === 'complete').length;
  const inflight = state.wave_instances.filter((w) => w.status === 'in_flight').length;
  const errored = state.wave_instances.filter((w) => w.status === 'error').length;
  const recent = state.wave_instances.slice(0, 5);

  function statusColor(status: WaveInstance['status']): string {
    return status === 'complete' ? '#22c55e' : status === 'in_flight' ? '#f6ad55' : '#ef4444';
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.logo}>🌊</span>
        <span style={styles.title}>Drekaskip</span>
        {state.loading && <span style={styles.loading}>polling…</span>}
      </div>

      <div style={styles.sagaRow}>
        <span style={styles.sagaLabel}>Saga:</span>
        <span style={styles.sagaName}>{state.active_saga ?? '—'}</span>
      </div>

      <div style={styles.counters}>
        <div style={styles.counter}>
          <span style={styles.counterNum}>{state.wave_count}</span>
          <span style={styles.counterLabel}>total waves</span>
        </div>
        <div style={styles.counter}>
          <span style={{ ...styles.counterNum, color: '#f6ad55' }}>{inflight}</span>
          <span style={styles.counterLabel}>in-flight</span>
        </div>
        <div style={styles.counter}>
          <span style={{ ...styles.counterNum, color: '#22c55e' }}>{complete}</span>
          <span style={styles.counterLabel}>complete</span>
        </div>
        {errored > 0 && (
          <div style={styles.counter}>
            <span style={{ ...styles.counterNum, color: '#ef4444' }}>{errored}</span>
            <span style={styles.counterLabel}>errors</span>
          </div>
        )}
      </div>

      {/* Mini timeline — last 5 waves */}
      {recent.length > 0 && (
        <div style={styles.timeline}>
          {recent.map((w) => (
            <button
              key={w.id}
              style={styles.waveEntry}
              onClick={() => setSelected(selected?.id === w.id ? null : w)}
              title={`Wave ${w.id.slice(0, 8)}… — ${w.status}`}
            >
              <span style={{ ...styles.waveDot, background: statusColor(w.status) }} />
              <span style={styles.waveId}>{w.id.slice(0, 8)}…</span>
              <span style={styles.waveStatus}>{w.status}</span>
            </button>
          ))}
        </div>
      )}

      {/* Drill-down drawer */}
      {selected && (
        <div style={styles.drawer}>
          <div style={styles.drawerHeader}>
            Wave {selected.id}
            <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
          </div>
          <div style={styles.drawerRow}><b>Saga:</b> {selected.saga}</div>
          <div style={styles.drawerRow}><b>Status:</b> {selected.status}</div>
          <div style={styles.drawerRow}><b>Started:</b> {new Date(selected.started_at).toLocaleTimeString()}</div>
          {selected.completed_at && (
            <div style={styles.drawerRow}><b>Completed:</b> {new Date(selected.completed_at).toLocaleTimeString()}</div>
          )}
        </div>
      )}

      {state.error && (
        <div style={styles.error}>⚠ {state.error.slice(0, 80)}</div>
      )}

      {/* ── Layer 4: Concurrency Cap hot-tune (BP041 Adaptive Concurrency Carrier) ── */}
      <div style={styles.capSection}>
        <div style={styles.capRow}>
          <span style={styles.capLabel}>⚡ Concurrency cap:</span>
          <span style={{
            ...styles.capValue,
            color: capInfo?.override !== null ? '#f6ad55' : '#68d391',
          }}>
            {capInfo ? capInfo.cap : '…'}
            {capInfo?.override !== null && <span style={styles.capOverrideTag}> (override)</span>}
          </span>
          <span style={{ ...styles.capStale, color: capInfo?.is_stale ? '#ef4444' : '#4a5568' }}>
            · {formatMinutesAgo(capInfo?.probed_at ?? null)}
          </span>
        </div>

        <div style={styles.capControls}>
          <button
            style={{ ...styles.reprobe, opacity: probing ? 0.5 : 1 }}
            onClick={handleReprobe}
            disabled={probing}
            title="Fire fresh concurrency probe — updates cap live"
          >
            {probing ? '⏳ Probing…' : '🔬 Re-probe now'}
          </button>
        </div>

        {/* Manual override slider — "observe + apply in one screen" */}
        <div style={styles.overrideRow}>
          <label style={styles.overrideLabel}>
            <input
              type="checkbox"
              checked={overrideOn}
              onChange={(e) => handleOverrideToggle(e.target.checked)}
              style={{ marginRight: '0.3rem' }}
            />
            Force cap:
          </label>
          <input
            type="range"
            min={1}
            max={64}
            value={overrideVal}
            disabled={!overrideOn}
            onChange={(e) => handleOverrideChange(Number(e.target.value))}
            style={{ flex: 1, opacity: overrideOn ? 1 : 0.35 }}
          />
          <span style={styles.overrideNum}>{overrideVal}</span>
        </div>
      </div>

      <div style={styles.footer}>
        B61A · 12/12 G-gates · {state.last_queried ? `polled ${new Date(state.last_queried).toLocaleTimeString()}` : 'awaiting first poll'}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#0d1117',
    color: '#e2e8f0',
    borderRadius: '8px',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    border: '1px solid #2d3748',
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  header: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  logo: { fontSize: '1rem' },
  title: { fontWeight: 700, fontSize: '0.85rem', color: '#63b3ed' },
  loading: { marginLeft: 'auto', fontSize: '0.65rem', color: '#718096' },
  sagaRow: { display: 'flex', gap: '0.4rem', alignItems: 'baseline' },
  sagaLabel: { fontSize: '0.7rem', color: '#718096' },
  sagaName: { fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600 },
  counters: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  counter: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  counterNum: { fontSize: '1.2rem', fontWeight: 700, lineHeight: 1 },
  counterLabel: { fontSize: '0.6rem', color: '#718096' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, overflow: 'auto' },
  waveEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.25rem 0.4rem',
    background: '#1a1a2e',
    border: '1px solid #2d3748',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#e2e8f0',
    textAlign: 'left',
  },
  waveDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  waveId: { fontSize: '0.7rem', fontFamily: 'monospace', flex: 1 },
  waveStatus: { fontSize: '0.65rem', color: '#718096' },
  drawer: {
    background: '#1a1a2e',
    border: '1px solid #4a5568',
    borderRadius: '6px',
    padding: '0.5rem',
    fontSize: '0.75rem',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 700,
    marginBottom: '0.3rem',
    wordBreak: 'break-all',
  },
  drawerRow: { marginBottom: '0.2rem' },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#718096',
    cursor: 'pointer',
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  error: { color: '#ef4444', fontSize: '0.7rem' },
  footer: { fontSize: '0.6rem', color: '#4a5568', marginTop: 'auto' },

  // ── Layer 4: Concurrency Cap section ─────────────────────────────────────
  capSection: {
    borderTop: '1px solid #2d3748',
    paddingTop: '0.4rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  capRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.3rem',
  },
  capLabel: { fontSize: '0.65rem', color: '#718096' },
  capValue: { fontSize: '0.78rem', fontWeight: 700 },
  capOverrideTag: { fontSize: '0.6rem', color: '#f6ad55', fontStyle: 'italic' },
  capStale: { fontSize: '0.6rem' },
  capControls: { display: 'flex' },
  reprobe: {
    background: '#1a1a2e',
    border: '1px solid #2d3748',
    borderRadius: '4px',
    color: '#63b3ed',
    fontSize: '0.65rem',
    padding: '0.2rem 0.45rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  overrideRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  overrideLabel: {
    fontSize: '0.65rem',
    color: '#718096',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
  },
  overrideNum: {
    fontSize: '0.65rem',
    color: '#f6ad55',
    fontWeight: 700,
    minWidth: '1.6rem',
    textAlign: 'right' as const,
  },
};
