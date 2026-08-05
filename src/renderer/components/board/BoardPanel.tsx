// BoardPanel.tsx -- KN-BP144-10 T1/T2/T4/T5: Grand Central board panel.
//
// Renders the SAME rows and alarms board.mjs computes (ported in src/main/board/
// board_state_reader.ts, read via IPC through board_subscription.ts) -- this component itself
// never touches the filesystem or spawns git (T3). The only write path is the single "mark
// dispatched" button (T4), which reads and writes the same HARDWIRE\board_state.json board.mjs
// itself writes -- no second state store.
//
// T5: nothing fabricated. Every cell either shows a real value from the last snapshot or the
// literal string "unknown" -- no placeholder rows, no simulated timings, no Math.random().

import { useState, useEffect, useCallback, useMemo } from 'react';
import { boardSubscription, DEFAULT_BOARD_STATE, alarmCount } from './board_subscription';
import type { BoardState, BoardRow, BoardAlarm } from './board_subscription';

function statusColor(status: BoardRow['status']): string {
  switch (status) {
    case 'REPORTED': return '#22c55e';
    case 'PHASE0-REPORTED': return '#38bdf8';
    case 'COMMITTED': return '#63b3ed';
    case 'WORKING': return '#f6ad55';
    case 'DISPATCHED': return '#a78bfa';
    case 'REPORT-NO-COMMIT': return '#ef4444';
    case 'written': return '#718096';
    default: return '#718096';
  }
}

function alarmColor(kind: BoardAlarm['kind']): string {
  switch (kind) {
    case 'COLLISION': return '#ef4444';
    case 'COLLISION-RISK': return '#f6ad55';
    case 'DOUBLE-BOOKED': return '#ef4444';
    case 'STALLED': return '#f6ad55';
    case 'ORPHANED': return '#ef4444';
    case 'IDLE': return '#63b3ed';
    case 'UNOWNED': return '#f6ad55';
    default: return '#718096';
  }
}

function relTime(iso: string | null): string {
  if (!iso) return 'unknown';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function BoardPanel() {
  const [state, setState] = useState<BoardState>(DEFAULT_BOARD_STATE);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = boardSubscription.subscribe(setState);
    return unsub;
  }, []);

  const rows = state.snapshot?.rows ?? null;
  const alarms = state.snapshot?.alarms ?? null;
  const count = alarmCount(state);

  const undispatched = useMemo(
    () => (rows ?? []).filter((r) => r.status === 'written').map((r) => r.id),
    [rows],
  );

  useEffect(() => {
    if (!selectedTicket && undispatched.length) setSelectedTicket(undispatched[0]);
  }, [undispatched, selectedTicket]);

  const handleMarkDispatched = useCallback(async () => {
    if (!selectedTicket) return;
    setDispatching(true);
    setDispatchMsg(null);
    try {
      const result = await window.amplify.boardMarkDispatched?.(selectedTicket);
      if (result?.ok) {
        setDispatchMsg(`Recorded dispatch: ${selectedTicket} at ${result.dispatchedAt ?? 'unknown'}`);
        await boardSubscription.refreshNow();
      } else {
        setDispatchMsg(`Failed: ${result?.error ?? 'unknown error'}`);
      }
    } catch (err) {
      setDispatchMsg(`Failed: ${String(err)}`);
    }
    setDispatching(false);
  }, [selectedTicket]);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.title}>Grand Central — The Board</span>
        <span style={styles.subtitle}>
          {state.loading && !state.snapshot ? 'loading…' : state.snapshot ? `computed ${relTime(state.snapshot.computedAt)}` : 'unknown'}
        </span>
        {count !== null && count > 0 && (
          <span style={styles.badge}>{count} alarm{count === 1 ? '' : 's'}</span>
        )}
      </div>

      {state.error && <div style={styles.errorBanner}>⚠ polling error: {state.error.slice(0, 160)}</div>}
      {state.snapshot?.gitError && (
        <div style={styles.errorBanner}>⚠ git shell-out failed this cycle (showing last-known-good rows below): {state.snapshot.gitError.slice(0, 200)}</div>
      )}

      {/* ── T1: ticket rows, same six states board.mjs computes ───────────── */}
      <div style={styles.tableWrap}>
        {rows === null ? (
          <div style={styles.unknown}>unknown — no snapshot received yet</div>
        ) : rows.length === 0 ? (
          <div style={styles.unknown}>no tickets found in dropzone</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Ticket</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Worker</th>
                <th style={styles.th}>Target</th>
                <th style={styles.th}>Mode</th>
                <th style={styles.th}>Last commit</th>
                <th style={styles.th}>At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.id}</td>
                  <td style={{ ...styles.td, color: statusColor(r.status), fontWeight: 700 }}>{r.status}</td>
                  <td style={styles.td}>{r.worker ?? ''}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '0.68rem' }}>
                    {r.target ?? 'unknown'}
                    {r.secondaryCount > 0 && <span style={{ color: '#718096' }}> +{r.secondaryCount}</span>}
                  </td>
                  <td style={styles.td}>{r.mode ?? 'unknown'}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>{r.lastSha || 'unknown'}</td>
                  <td style={styles.td}>{r.lastWhen || (r.dispatchedAt ? `dispatched ${relTime(r.dispatchedAt)}` : 'unknown')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── T2: the five alarms board.mjs actually computes ──────────────── */}
      <div style={styles.alarmsSection}>
        <div style={styles.alarmsHeader}>Alarms</div>
        {alarms === null ? (
          <div style={styles.unknown}>unknown — no snapshot received yet</div>
        ) : alarms.length === 0 ? (
          <div style={styles.noAlarms}>none</div>
        ) : (
          alarms.map((a, i) => (
            <div key={`${a.kind}-${i}`} style={styles.alarmRow}>
              <span style={{ ...styles.alarmKind, color: alarmColor(a.kind) }}>{a.kind}</span>
              <span style={styles.alarmMsg}>{a.message}</span>
            </div>
          ))
        )}
      </div>

      {state.snapshot && (
        <div style={styles.footerRow}>
          repo dirty: {state.snapshot.dirtyFiles.length} file(s) under src ·{' '}
          newest receipt: {state.snapshot.newestReceipt ? `${state.snapshot.newestReceipt.name} (${state.snapshot.newestReceipt.minsAgo}m ago)` : 'unknown'}
        </div>
      )}

      {/* ── T4: one button, mark dispatched. Reads/writes board_state.json only. ─ */}
      <div style={styles.dispatchSection}>
        <select
          style={styles.select}
          value={selectedTicket}
          onChange={(e) => setSelectedTicket(e.target.value)}
          disabled={!undispatched.length}
        >
          {undispatched.length === 0 && <option value="">no undispatched tickets</option>}
          {undispatched.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <button
          style={{ ...styles.dispatchBtn, opacity: dispatching || !selectedTicket ? 0.5 : 1 }}
          onClick={handleMarkDispatched}
          disabled={dispatching || !selectedTicket}
        >
          {dispatching ? 'Recording…' : 'Mark dispatched'}
        </button>
        {dispatchMsg && <span style={styles.dispatchMsg}>{dispatchMsg}</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto',
    background: '#0a0f1a', color: '#e2e8f0', padding: '0.9rem', gap: '0.6rem',
    fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box',
  },
  header: { display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' },
  title: { fontWeight: 700, fontSize: '0.95rem', color: '#f0fdf4' },
  subtitle: { fontSize: '0.7rem', color: '#718096' },
  badge: {
    background: '#7f1d1d', color: '#fca5a5', borderRadius: 10, padding: '2px 8px',
    fontSize: '0.68rem', fontWeight: 700,
  },
  errorBanner: {
    background: '#2d1b1b', border: '1px solid #7f1d1d', color: '#fca5a5',
    borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.72rem',
  },
  tableWrap: { border: '1px solid #1e2a38', borderRadius: 6, overflow: 'auto', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' },
  th: {
    textAlign: 'left', padding: '0.35rem 0.5rem', borderBottom: '1px solid #1e2a38',
    color: '#718096', fontWeight: 600, background: '#0d1117', position: 'sticky', top: 0,
  },
  td: { padding: '0.3rem 0.5rem', borderBottom: '1px solid #131c26' },
  unknown: { color: '#718096', fontSize: '0.75rem', padding: '0.5rem', fontStyle: 'italic' },
  alarmsSection: { border: '1px solid #1e2a38', borderRadius: 6, padding: '0.5rem 0.6rem' },
  alarmsHeader: { fontSize: '0.72rem', fontWeight: 700, color: '#718096', marginBottom: '0.3rem' },
  noAlarms: { color: '#22c55e', fontSize: '0.75rem' },
  alarmRow: { display: 'flex', gap: '0.5rem', fontSize: '0.72rem', padding: '0.15rem 0', alignItems: 'baseline' },
  alarmKind: { fontWeight: 700, minWidth: '80px', flexShrink: 0 },
  alarmMsg: { color: '#cbd5e0' },
  footerRow: { fontSize: '0.65rem', color: '#4a5568' },
  dispatchSection: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto',
    borderTop: '1px solid #1e2a38', paddingTop: '0.5rem', flexWrap: 'wrap',
  },
  select: {
    background: '#0d1117', color: '#e2e8f0', border: '1px solid #2d3748',
    borderRadius: 4, fontSize: '0.72rem', padding: '0.25rem 0.4rem',
  },
  dispatchBtn: {
    background: '#1a1a2e', border: '1px solid #2d3748', borderRadius: 4,
    color: '#63b3ed', fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.7rem', cursor: 'pointer',
  },
  dispatchMsg: { fontSize: '0.68rem', color: '#718096' },
};

export default BoardPanel;
