// B83d — Subject Drilldown Drawer
// Shows last 50 events for a hovered/clicked substrate-discipline subject

import type { SubjectHealth } from './ActiveSubstratePanel';

interface SubjectDrilldownProps {
  subject: SubjectHealth | null;
  history: Array<{ ts: string; level: string; message: string }>;
  onClose: () => void;
}

function levelColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'error': return '#ef4444';
    case 'warn': case 'warning': return '#f6ad55';
    case 'info': return '#63b3ed';
    default: return '#718096';
  }
}

export function SubjectDrilldown({ subject, history, onClose }: SubjectDrilldownProps) {
  if (!subject) return null;

  return (
    <div style={styles.drawer}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span style={styles.name}>{subject.name}</span>
          <span style={styles.ref}>{subject.stack_ref}</span>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.description}>{subject.description}</div>

      <div style={styles.statusRow}>
        <span style={styles.statusLabel}>Status:</span>
        <span style={{
          color: subject.status === 'green' ? '#22c55e'
            : subject.status === 'yellow' ? '#f6ad55'
            : subject.status === 'red' ? '#ef4444' : '#4a5568',
          fontWeight: 700,
        }}>
          {subject.status.toUpperCase()}
        </span>
        {subject.last_heartbeat && (
          <span style={styles.heartbeat}>Last beat: {new Date(subject.last_heartbeat).toLocaleString()}</span>
        )}
      </div>

      {subject.last_error && (
        <div style={styles.error}>{subject.last_error}</div>
      )}

      <div style={styles.historyHeader}>Event History ({history.length})</div>

      <div style={styles.historyList}>
        {history.length === 0 ? (
          <div style={styles.noHistory}>No events in window (Watchdog server not yet wired — G11 pending)</div>
        ) : (
          history.slice(0, 50).map((ev, i) => (
            <div key={i} style={styles.event}>
              <span style={{ color: levelColor(ev.level), fontWeight: 600, minWidth: 40 }}>
                {ev.level.toUpperCase().slice(0, 4)}
              </span>
              <span style={styles.eventTs}>{new Date(ev.ts).toLocaleTimeString()}</span>
              <span style={styles.eventMsg}>{ev.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  drawer: {
    background: '#1a1a2e',
    border: '1px solid #4a5568',
    borderRadius: '8px',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    overflow: 'hidden',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  name: { fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0' },
  ref: { fontSize: '0.65rem', color: '#4a5568', fontFamily: 'monospace' },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#718096',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '0 0.25rem',
  },
  description: { fontSize: '0.72rem', color: '#a0aec0', lineHeight: 1.4 },
  statusRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' },
  statusLabel: { color: '#718096' },
  heartbeat: { marginLeft: 'auto', fontSize: '0.65rem', color: '#718096' },
  error: { background: '#2d0000', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.3rem 0.4rem', fontSize: '0.7rem', color: '#ef4444' },
  historyHeader: { fontWeight: 600, fontSize: '0.72rem', color: '#63b3ed', marginTop: '0.25rem' },
  historyList: { overflowY: 'auto', maxHeight: 200, display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  noHistory: { fontSize: '0.7rem', color: '#4a5568', fontStyle: 'italic' },
  event: { display: 'flex', gap: '0.4rem', fontSize: '0.68rem', lineHeight: 1.3 },
  eventTs: { color: '#718096', flexShrink: 0, minWidth: 60 },
  eventMsg: { color: '#a0aec0', flex: 1, wordBreak: 'break-word' },
};
