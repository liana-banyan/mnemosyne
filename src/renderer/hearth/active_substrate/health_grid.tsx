// B83d — Health Grid — 9-subject substrate status grid
// Visual surface for Watchdog Knight daemon
// Coffee §9 "9 of 9 operational" — empirical receipt surface

import type { SubjectHealth, SubjectStatus } from './ActiveSubstratePanel';

interface HealthGridProps {
  subjects: SubjectHealth[];
  onSubjectClick: (subject: SubjectHealth) => void;
  hoveredSubject: string | null;
  onHoverChange: (short_name: string | null) => void;
}

function statusToColor(status: SubjectStatus): string {
  switch (status) {
    case 'green': return '#22c55e';
    case 'yellow': return '#f6ad55';
    case 'red': return '#ef4444';
    case 'gray': return '#4a5568';
    default: return '#4a5568';
  }
}

function statusToEmoji(status: SubjectStatus): string {
  switch (status) {
    case 'green': return '●';
    case 'yellow': return '◐';
    case 'red': return '✕';
    case 'gray': return '○';
    default: return '○';
  }
}

function statusToLabel(status: SubjectStatus): string {
  switch (status) {
    case 'green': return 'healthy';
    case 'yellow': return 'degraded';
    case 'red': return 'error';
    case 'gray': return 'not registered';
    default: return 'unknown';
  }
}

export function HealthGrid({ subjects, onSubjectClick, hoveredSubject, onHoverChange }: HealthGridProps) {
  return (
    <div style={styles.grid}>
      {subjects.map((s) => {
        const color = statusToColor(s.status);
        const isHovered = hoveredSubject === s.short_name;

        return (
          <div
            key={s.short_name}
            style={{
              ...styles.cell,
              borderColor: isHovered ? color : '#2d3748',
              background: isHovered ? `${color}18` : '#1a1a2e',
              cursor: 'pointer',
            }}
            onClick={() => onSubjectClick(s)}
            onMouseEnter={() => onHoverChange(s.short_name)}
            onMouseLeave={() => onHoverChange(null)}
            title={`${s.name} — ${statusToLabel(s.status)}\n${s.description}\n${s.stack_ref}`}
          >
            <div style={{ ...styles.statusSymbol, color }}>
              {statusToEmoji(s.status)}
            </div>
            <div style={styles.subjectName}>{s.name}</div>
            <div style={styles.stackRef}>{s.stack_ref}</div>
            {s.last_heartbeat && (
              <div style={styles.heartbeat}>
                {new Date(s.last_heartbeat).toLocaleTimeString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.4rem',
    padding: '0.4rem',
  },
  cell: {
    borderRadius: '8px',
    border: '1px solid',
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    transition: 'border-color 0.15s, background 0.15s',
    minHeight: '70px',
  },
  statusSymbol: {
    fontSize: '1rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  subjectName: {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: '#e2e8f0',
    lineHeight: 1.2,
  },
  stackRef: {
    fontSize: '0.58rem',
    color: '#4a5568',
    fontFamily: 'monospace',
  },
  heartbeat: {
    fontSize: '0.58rem',
    color: '#718096',
    marginTop: 'auto',
  },
};
