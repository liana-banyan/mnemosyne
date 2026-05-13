// BP041 SAGA 2 — Scribe Detail View (flip-card back face)
// Shown when member clicks any scribe card in ActiveSubstratePanel
// Back face: name · role · LB-STACK doctrine · activity timeline · output sample · MONITOR toggle

import { useState } from 'react';
import type { SubjectHealth } from './ActiveSubstratePanel';

export interface ScribeMetricSummary {
  scribe_id: string;
  monitor_enabled: boolean;
  monitored_since: string | null;
  event_count: number;
  total_speed_delta_ms: number;
  total_accuracy_delta: number;
  total_cost_delta_tokens: number;
  avg_speed_delta_ms: number;
  avg_accuracy_delta: number;
  avg_cost_delta_tokens: number;
  last_updated: string | null;
}

interface ScribeDetailViewProps {
  subject: SubjectHealth;
  history: Array<{ ts: string; level: string; message: string }>;
  monitorEnabled: boolean;
  metrics: ScribeMetricSummary | null;
  /** Metrics for all currently-monitored scribes (for combined dashboard) */
  allMonitoredMetrics: ScribeMetricSummary[];
  onToggleMonitor: (enabled: boolean) => void;
  onBack: () => void;
  /** Show combined dashboard tab (only meaningful when 2+ scribes monitored) */
  showCombined?: boolean;
  onToggleCombined?: () => void;
}

function levelColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'error': return '#ef4444';
    case 'warn': case 'warning': return '#f6ad55';
    case 'info': return '#63b3ed';
    default: return '#718096';
  }
}

function fmtMs(ms: number): string {
  if (Math.abs(ms) < 1000) return `${ms > 0 ? '+' : ''}${Math.round(ms)}ms`;
  return `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(1)}s`;
}

function fmtAccuracy(v: number): string {
  return `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

function fmtTokens(t: number): string {
  if (Math.abs(t) < 1000) return `${t > 0 ? '+' : ''}${Math.round(t)} tok`;
  return `${t > 0 ? '+' : ''}${(t / 1000).toFixed(1)}K tok`;
}

function MetricBar({ label, value, format }: { label: string; value: number; format: (v: number) => string }) {
  const isPositive = value >= 0;
  return (
    <div style={styles.metricRow}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color: isPositive ? '#68d391' : '#f6ad55' }}>
        {format(value)}
      </span>
    </div>
  );
}

function MetricsCard({ metrics, title }: { metrics: ScribeMetricSummary[]; title: string }) {
  const combined = metrics.reduce(
    (acc, m) => ({
      speed: acc.speed + m.total_speed_delta_ms,
      accuracy: acc.accuracy + m.total_accuracy_delta,
      cost: acc.cost + m.total_cost_delta_tokens,
      events: acc.events + m.event_count,
    }),
    { speed: 0, accuracy: 0, cost: 0, events: 0 },
  );

  return (
    <div style={styles.metricsCard}>
      <div style={styles.metricsTitle}>{title}</div>
      <div style={styles.metricsSubtitle}>{combined.events} events recorded</div>
      <MetricBar label="Speed" value={combined.speed} format={fmtMs} />
      <MetricBar label="Accuracy" value={combined.accuracy} format={fmtAccuracy} />
      <MetricBar label="Cost" value={combined.cost} format={fmtTokens} />
      <div style={styles.baselineNote}>
        vs substrate-only baseline · member-replicable · K533
      </div>
    </div>
  );
}

function CombinedDashboard({
  allMonitoredMetrics,
  onBack,
}: {
  allMonitoredMetrics: ScribeMetricSummary[];
  onBack: () => void;
}) {
  return (
    <div style={styles.combinedPanel}>
      <div style={styles.combinedHeader}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <span style={styles.combinedTitle}>
          Combined Dashboard ({allMonitoredMetrics.length} scribes)
        </span>
      </div>

      <MetricsCard metrics={allMonitoredMetrics} title="Aggregate F/C/A — All Monitored Scribes" />

      <div style={styles.combinedScribesLabel}>Individual breakdown:</div>
      {allMonitoredMetrics.map((m) => (
        <div key={m.scribe_id} style={styles.combinedScribeRow}>
          <span style={styles.combinedScribeId}>{m.scribe_id}</span>
          <span style={{ color: m.total_speed_delta_ms >= 0 ? '#68d391' : '#f6ad55', fontSize: '0.65rem' }}>
            {fmtMs(m.total_speed_delta_ms)}
          </span>
          <span style={{ color: m.total_accuracy_delta >= 0 ? '#68d391' : '#f6ad55', fontSize: '0.65rem' }}>
            {fmtAccuracy(m.total_accuracy_delta)}
          </span>
          <span style={{ color: m.total_cost_delta_tokens >= 0 ? '#68d391' : '#f6ad55', fontSize: '0.65rem' }}>
            {fmtTokens(m.total_cost_delta_tokens)}
          </span>
          <span style={styles.combinedEventCount}>{m.event_count} ev</span>
        </div>
      ))}
    </div>
  );
}

export function ScribeDetailView({
  subject,
  history,
  monitorEnabled,
  metrics,
  allMonitoredMetrics,
  onToggleMonitor,
  onBack,
}: ScribeDetailViewProps) {
  const [showCombined, setShowCombined] = useState(false);
  const hasMultipleMonitored = allMonitoredMetrics.length >= 2;

  if (showCombined) {
    return (
      <CombinedDashboard
        allMonitoredMetrics={allMonitoredMetrics}
        onBack={() => setShowCombined(false)}
      />
    );
  }

  const recentOutput = history.find((ev) => ev.message && ev.message.length > 10);
  const activitySlice = history.slice(0, 10);

  return (
    <div style={styles.panel}>
      {/* Header row */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        {hasMultipleMonitored && (
          <button
            style={styles.combinedBtn}
            onClick={() => setShowCombined(true)}
          >
            Combined ({allMonitoredMetrics.length} monitored)
          </button>
        )}
      </div>

      {/* Scribe identity */}
      <div style={styles.identity}>
        <div style={styles.scribeName}>{subject.name}</div>
        <div style={styles.stackRef}>{subject.stack_ref}</div>
        <div style={styles.description}>{subject.description}</div>
      </div>

      {/* Monitor toggle */}
      <div style={styles.monitorRow}>
        <span style={styles.monitorLabel}>Monitor contribution</span>
        <button
          style={{
            ...styles.toggleBtn,
            background: monitorEnabled ? '#276749' : '#2d3748',
            border: `1px solid ${monitorEnabled ? '#68d391' : '#4a5568'}`,
            color: monitorEnabled ? '#68d391' : '#718096',
          }}
          onClick={() => onToggleMonitor(!monitorEnabled)}
          title={monitorEnabled ? 'Stop monitoring this scribe' : 'Start monitoring Speed/Accuracy/Cost contribution'}
        >
          {monitorEnabled ? '● ON' : '○ OFF'}
        </button>
        {metrics?.monitored_since && (
          <span style={styles.monitorSince}>
            since {new Date(metrics.monitored_since).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Metrics card (when monitoring has data) */}
      {monitorEnabled && metrics && metrics.event_count > 0 && (
        <MetricsCard metrics={[metrics]} title="This Scribe's Contribution" />
      )}

      {monitorEnabled && metrics && metrics.event_count === 0 && (
        <div style={styles.monitorPending}>
          Monitoring active — deltas will accumulate as waves fire
        </div>
      )}

      {/* Output sample */}
      {recentOutput && (
        <div style={styles.outputSampleBlock}>
          <div style={styles.sectionLabel}>Recent output sample</div>
          <div style={styles.outputSampleText}>
            {recentOutput.message.slice(0, 240)}
            {recentOutput.message.length > 240 ? '…' : ''}
          </div>
          <div style={styles.outputTs}>
            {new Date(recentOutput.ts).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div style={styles.sectionLabel}>
        Activity timeline ({activitySlice.length}/{history.length})
      </div>
      <div style={styles.timeline}>
        {activitySlice.length === 0 ? (
          <div style={styles.noActivity}>
            No events — Watchdog server not yet wired (G11 pending)
          </div>
        ) : (
          activitySlice.map((ev, i) => (
            <div key={i} style={styles.timelineEvent}>
              <span style={{ color: levelColor(ev.level), minWidth: 32, fontSize: '0.62rem', fontWeight: 700 }}>
                {ev.level.slice(0, 4).toUpperCase()}
              </span>
              <span style={styles.timelineTs}>
                {new Date(ev.ts).toLocaleTimeString()}
              </span>
              <span style={styles.timelineMsg}>{ev.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    height: '100%',
    overflowY: 'auto',
    padding: '0.25rem 0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.15rem',
  },
  backBtn: {
    background: 'none',
    border: '1px solid #4a5568',
    color: '#a0aec0',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.7rem',
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  combinedBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: '1px solid #4a5568',
    color: '#63b3ed',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    paddingBottom: '0.4rem',
    borderBottom: '1px solid #2d3748',
  },
  scribeName: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#68d391',
  },
  stackRef: {
    fontSize: '0.62rem',
    color: '#4a5568',
    fontFamily: 'monospace',
  },
  description: {
    fontSize: '0.72rem',
    color: '#a0aec0',
    lineHeight: 1.4,
  },
  monitorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  monitorLabel: {
    fontSize: '0.72rem',
    color: '#a0aec0',
    flex: 1,
  },
  toggleBtn: {
    borderRadius: '4px',
    padding: '0.2rem 0.6rem',
    fontSize: '0.7rem',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.2s, border-color 0.2s, color 0.2s',
  },
  monitorSince: {
    fontSize: '0.6rem',
    color: '#4a5568',
  },
  monitorPending: {
    fontSize: '0.68rem',
    color: '#68d391',
    background: '#0d2018',
    border: '1px solid #276749',
    borderRadius: '4px',
    padding: '0.3rem 0.5rem',
    fontStyle: 'italic',
  },
  metricsCard: {
    background: '#0d1117',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  metricsTitle: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#63b3ed',
  },
  metricsSubtitle: {
    fontSize: '0.6rem',
    color: '#4a5568',
    marginBottom: '0.15rem',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: '0.68rem',
    color: '#718096',
  },
  metricValue: {
    fontSize: '0.7rem',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  baselineNote: {
    fontSize: '0.58rem',
    color: '#4a5568',
    marginTop: '0.1rem',
    fontStyle: 'italic',
  },
  outputSampleBlock: {
    background: '#1a1a2e',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    padding: '0.4rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  sectionLabel: {
    fontSize: '0.65rem',
    color: '#4a5568',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  outputSampleText: {
    fontSize: '0.68rem',
    color: '#a0aec0',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  outputTs: {
    fontSize: '0.58rem',
    color: '#4a5568',
    textAlign: 'right',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    maxHeight: 140,
    overflowY: 'auto',
  },
  timelineEvent: {
    display: 'flex',
    gap: '0.35rem',
    fontSize: '0.65rem',
    lineHeight: 1.3,
  },
  timelineTs: {
    color: '#718096',
    flexShrink: 0,
    minWidth: 56,
  },
  timelineMsg: {
    color: '#a0aec0',
    flex: 1,
    wordBreak: 'break-word',
  },
  noActivity: {
    fontSize: '0.65rem',
    color: '#4a5568',
    fontStyle: 'italic',
  },
  // Combined dashboard
  combinedPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    height: '100%',
    overflowY: 'auto',
    padding: '0.25rem 0',
  },
  combinedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  combinedTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#63b3ed',
  },
  combinedScribesLabel: {
    fontSize: '0.62rem',
    color: '#4a5568',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  combinedScribeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.2rem 0',
    borderBottom: '1px solid #1a1a2e',
  },
  combinedScribeId: {
    fontSize: '0.65rem',
    color: '#a0aec0',
    flex: 1,
    fontFamily: 'monospace',
  },
  combinedEventCount: {
    fontSize: '0.6rem',
    color: '#4a5568',
    minWidth: 30,
    textAlign: 'right',
  },
};
