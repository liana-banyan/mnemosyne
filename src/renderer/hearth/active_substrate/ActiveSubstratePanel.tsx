// BP041 SAGA 2 — Active Substrate Panel (flip-card refactor)
// Front face: 9-subject Watchdog health grid
// Back face: ScribeDetailView — name · role · LB-STACK · activity · output · MONITOR toggle
// Slide-replace animation (translateX) between front/back
// Multi-scribe combined F/C/A dashboard when N scribes monitored

import { useState, useEffect, useCallback } from 'react';
import { HealthGrid } from './health_grid';
import { ScribeDetailView } from './ScribeDetailView';
import type { ScribeMetricSummary } from './ScribeDetailView';

export type SubjectStatus = 'green' | 'yellow' | 'red' | 'gray';

export interface SubjectHealth {
  name: string;
  short_name: string;
  status: SubjectStatus;
  last_heartbeat: string | null;
  last_error: string | null;
  stack_ref: string;
  description: string;
}

export interface WatchdogStatusPayload {
  subjects: SubjectHealth[];
  watchdog_status: SubjectStatus;
  polled_at: string;
}

export function ActiveSubstratePanel() {
  const [status, setStatus] = useState<WatchdogStatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Flip-card state
  const [flippedScribe, setFlippedScribe] = useState<SubjectHealth | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [history, setHistory] = useState<Array<{ ts: string; level: string; message: string }>>([]);

  // Monitor state
  const [monitorStates, setMonitorStates] = useState<Record<string, boolean>>({});
  const [metricsCache, setMetricsCache] = useState<Record<string, ScribeMetricSummary>>({});

  const poll = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof window.amplify?.watchdogStatus !== 'function') {
        // Bridge not exposed (preload mismatch or pre-v0.1.6 build)
        setError('Watchdog unavailable in this build · update Mnemosyne to v0.1.6+ for live status');
        return;
      }
      const result = await window.amplify.watchdogStatus();
      if (result) setStatus(result as WatchdogStatusPayload);
      setError(null);
    } catch (err) {
      const msg = String(err);
      // Build-artifact drift: main process is missing the ipcMain.handle('watchdog-status', ...)
      // registration even though preload exposes the method. Surface a graceful message instead
      // of the raw Electron rejection. Tracked in BP048.
      if (msg.includes('No handler registered') || msg.includes('watchdog-status')) {
        console.warn('[ActiveSubstratePanel] watchdog-status IPC handler missing — build drift suspected', err);
        setError('Watchdog unavailable in this build · update Mnemosyne to v0.1.6+ for live status');
      } else {
        console.error('[ActiveSubstratePanel] watchdog poll failed', err);
        setError(msg.slice(0, 120));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 5s poll
  useEffect(() => {
    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [poll]);

  // 1s poll when hovering (front face only)
  useEffect(() => {
    if (!hovered || flippedScribe) return;
    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, [hovered, flippedScribe, poll]);

  // Load history when scribe flipped to back face
  useEffect(() => {
    if (!flippedScribe) { setHistory([]); return; }
    window.amplify.watchdogHistory?.(flippedScribe.short_name, 1)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [flippedScribe]);

  // Load monitor states on mount
  useEffect(() => {
    window.amplify.scribeGetMetrics?.([])
      .then((empty) => {
        if (Array.isArray(empty)) {
          const states: Record<string, boolean> = {};
          (empty as ScribeMetricSummary[]).forEach((m) => {
            states[m.scribe_id] = m.monitor_enabled;
          });
          setMonitorStates(states);
        }
      })
      .catch(() => { /* not available yet */ });
  }, []);

  // Refresh metrics for flipped scribe + all monitored
  const refreshMetrics = useCallback(async (scribeIds: string[]) => {
    if (scribeIds.length === 0) return;
    try {
      const results = await window.amplify.scribeGetMetrics?.(scribeIds);
      if (!results) return;
      const next: Record<string, ScribeMetricSummary> = { ...metricsCache };
      (results as ScribeMetricSummary[]).forEach((m) => {
        next[m.scribe_id] = m;
      });
      setMetricsCache(next);
    } catch { /* not available */ }
  }, [metricsCache]);

  // When flipping to a scribe, load its metrics + all monitored metrics
  useEffect(() => {
    if (!flippedScribe) return;
    const monitoredIds = Object.entries(monitorStates)
      .filter(([, on]) => on)
      .map(([id]) => id);
    const idsToFetch = Array.from(new Set([flippedScribe.short_name, ...monitoredIds]));
    refreshMetrics(idsToFetch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flippedScribe, monitorStates]);

  const handleSubjectClick = (s: SubjectHealth) => {
    if (isAnimating) return;
    if (flippedScribe?.short_name === s.short_name) {
      // Flip back
      handleBack();
      return;
    }
    setIsAnimating(true);
    setFlippedScribe(s);
    setTimeout(() => setIsAnimating(false), 420);
  };

  const handleBack = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setFlippedScribe(null);
    setTimeout(() => setIsAnimating(false), 420);
  };

  const handleToggleMonitor = async (scribeId: string, on: boolean) => {
    try {
      await window.amplify.scribeToggleMonitor?.(scribeId, on);
      setMonitorStates((prev) => ({ ...prev, [scribeId]: on }));
      // Refresh metrics immediately after toggle
      const monitoredIds = Object.entries({ ...monitorStates, [scribeId]: on })
        .filter(([, enabled]) => enabled)
        .map(([id]) => id);
      const idsToFetch = Array.from(new Set([scribeId, ...monitoredIds]));
      await refreshMetrics(idsToFetch);
    } catch { /* IPC not wired yet */ }
  };

  const watchdogColor = status?.watchdog_status === 'green' ? '#22c55e'
    : status?.watchdog_status === 'yellow' ? '#f6ad55'
    : status?.watchdog_status === 'red' ? '#ef4444' : '#4a5568';

  const isFlipped = flippedScribe !== null;

  const monitoredMetrics = Object.entries(monitorStates)
    .filter(([, on]) => on)
    .map(([id]) => metricsCache[id])
    .filter(Boolean) as ScribeMetricSummary[];

  return (
    <div style={styles.panel}>
      {/* Static header — always visible */}
      <div style={styles.header}>
        <span style={styles.icon}>🔬</span>
        <span style={styles.title}>Active Substrate</span>
        {isFlipped && flippedScribe && (
          <span style={styles.flipLabel}>{flippedScribe.name}</span>
        )}
        <span style={{ ...styles.watchdogBadge, color: watchdogColor }} title={`Watchdog: ${status?.watchdog_status ?? 'unknown'}`}>
          Watchdog {status?.watchdog_status ?? '…'}
        </span>
        {loading && !isFlipped && <span style={styles.polling}>polling</span>}
      </div>

      {/* Flip-card content area: horizontal slide between front and back */}
      <div style={styles.flipViewport}>
        <div
          style={{
            ...styles.flipTrack,
            transform: isFlipped ? 'translateX(-50%)' : 'translateX(0)',
          }}
        >
          {/* Front face — HealthGrid */}
          <div style={styles.flipPane}>
            {status ? (
              <>
                <HealthGrid
                  subjects={status.subjects}
                  onSubjectClick={handleSubjectClick}
                  hoveredSubject={hovered}
                  onHoverChange={setHovered}
                />

                {status.polled_at && (
                  <div style={styles.footer}>
                    {status.subjects.filter((s) => s.status === 'green').length}/9 green
                    {' · '}polled {new Date(status.polled_at).toLocaleTimeString()}
                    {monitoredMetrics.length > 0 && (
                      <span style={styles.monitorBadge}>
                        {' · '}⬤ {monitoredMetrics.length} monitored
                      </span>
                    )}
                  </div>
                )}

                <div style={styles.legend}>
                  <span style={styles.legendGreen}>● green</span>=healthy
                  <span style={styles.legendYellow}> ◐ yellow</span>=degraded
                  <span style={styles.legendRed}> ✕ red</span>=error
                  <span style={styles.legendGray}> ○ gray</span>=not registered
                  <span style={styles.legendHint}> · click card to inspect</span>
                </div>
              </>
            ) : (
              <div style={styles.placeholder}>
                {loading ? 'Polling Watchdog…' : error ? `⚠ ${error.slice(0, 80)}` : 'No data yet'}
              </div>
            )}
          </div>

          {/* Back face — ScribeDetailView */}
          <div style={styles.flipPane}>
            {flippedScribe && (
              <ScribeDetailView
                subject={flippedScribe}
                history={history}
                monitorEnabled={monitorStates[flippedScribe.short_name] ?? false}
                metrics={metricsCache[flippedScribe.short_name] ?? null}
                allMonitoredMetrics={monitoredMetrics}
                onToggleMonitor={(on) => handleToggleMonitor(flippedScribe.short_name, on)}
                onBack={handleBack}
              />
            )}
          </div>
        </div>
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
    gap: '0.5rem',
    border: '1px solid #2d3748',
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flexShrink: 0,
  },
  icon: { fontSize: '1rem' },
  title: { fontWeight: 700, fontSize: '0.85rem', color: '#68d391' },
  flipLabel: {
    fontSize: '0.72rem',
    color: '#63b3ed',
    background: '#1a2035',
    borderRadius: '3px',
    padding: '0.1rem 0.4rem',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  watchdogBadge: { marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600 },
  polling: { fontSize: '0.65rem', color: '#4a5568' },

  // Flip viewport clips overflow (shows only one pane at a time)
  flipViewport: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },

  // Track is 200% wide; each pane is 50% = 100% of viewport
  flipTrack: {
    display: 'flex',
    width: '200%',
    height: '100%',
    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Each pane is 50% of track = 100% of viewport
  flipPane: {
    width: '50%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    overflow: 'hidden',
  },

  placeholder: { color: '#4a5568', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' },
  footer: { fontSize: '0.6rem', color: '#4a5568', flexShrink: 0 },
  monitorBadge: { color: '#68d391' },
  legend: { fontSize: '0.6rem', color: '#4a5568', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', flexShrink: 0 },
  legendGreen: { color: '#22c55e' },
  legendYellow: { color: '#f6ad55' },
  legendRed: { color: '#ef4444' },
  legendGray: { color: '#4a5568' },
  legendHint: { color: '#2d3748', fontStyle: 'italic' },
};
