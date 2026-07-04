// SubstrateStatsTab.tsx — BP081 Wave A SEG-A1
// Substrate stats dashboard: total eblets, verified count, last write, top domains,
// recent writes, SVG growth trend chart, quarantine warning.
// Auto-refreshes every 30s; manual Refresh button with loading feedback.

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SubstrateStats {
  totalEblets: number;
  verifiedCount: number;
  lastWriteTimestamp: number | null;
  topDomains: Array<{ domain: string; count: number; lastWrite: number }>;
  recentWrites: Array<{ questionExcerpt: string; provenanceSource: string; timestamp: number }>;
  growthTrend: Array<{ date: string; count: number }>;
  quarantinedCount: number;
  error?: string;
}

// ─── Relative time helper ────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function fmtDate(iso: string): string {
  // iso = YYYY-MM-DD
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Inline SVG growth chart ─────────────────────────────────────────────────

function GrowthChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const W = 420;
  const H = 80;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 20;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const points = data.map((d, i) => {
    const x = PAD_L + (i / (data.length - 1 || 1)) * chartW;
    const y = PAD_T + chartH - (d.count / maxCount) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${(PAD_T + chartH).toFixed(1)} L${PAD_L},${(PAD_T + chartH).toFixed(1)} Z`;

  // X-axis labels: show every ~7th point
  const labelStep = Math.max(1, Math.floor(data.length / 5));
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);

  // Y-axis tick
  const yMid = PAD_T + chartH / 2;
  const midVal = Math.round(maxCount / 2);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: 'visible', display: 'block', maxWidth: '100%' }}
      aria-label="Growth trend chart"
    >
      {/* Grid lines */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke="rgba(100,116,139,0.2)" strokeWidth="1" />
      <line x1={PAD_L} y1={PAD_T + chartH} x2={PAD_L + chartW} y2={PAD_T + chartH} stroke="rgba(100,116,139,0.2)" strokeWidth="1" />
      <line x1={PAD_L} y1={yMid} x2={PAD_L + chartW} y2={yMid} stroke="rgba(100,116,139,0.1)" strokeWidth="1" strokeDasharray="3,3" />

      {/* Y-axis labels */}
      <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fontSize="8" fill="#475569">{maxCount}</text>
      <text x={PAD_L - 4} y={yMid + 4} textAnchor="end" fontSize="8" fill="#475569">{midVal}</text>
      <text x={PAD_L - 4} y={PAD_T + chartH} textAnchor="end" fontSize="8" fill="#475569">0</text>

      {/* Area fill */}
      <path d={areaD} fill="rgba(110,231,183,0.08)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeLinejoin="round" />

      {/* X-axis date labels */}
      {xLabels.map((p) => (
        <text key={p.date} x={p.x} y={H - 4} textAnchor="middle" fontSize="7" fill="#475569">
          {fmtDate(p.date)}
        </text>
      ))}

      {/* Data points */}
      {points.filter((p) => p.count > 0).map((p) => (
        <circle key={p.date} cx={p.x} cy={p.y} r="2.5" fill="#6ee7b7" opacity="0.8">
          <title>{p.date}: {p.count}</title>
        </circle>
      ))}
    </svg>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.6)',
        border: `1px solid ${accent ?? 'rgba(100,116,139,0.2)'}`,
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 110,
        flex: '1 1 110px',
      }}
    >
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? '#e2e8f0', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubstrateStatsTab() {
  const [stats, setStats] = useState<SubstrateStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.amplify?.getSubstrateStats?.();
      if (result) {
        setStats(result);
        setLastRefreshed(Date.now());
      }
    } catch (e) {
      console.error('[SubstrateStatsTab] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 30s auto-refresh when tab is visible
  useEffect(() => {
    void fetchStats();

    intervalRef.current = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void fetchStats();
      }
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStats]);

  const verifiedPct =
    stats && stats.totalEblets > 0
      ? Math.round((stats.verifiedCount / stats.totalEblets) * 100)
      : 0;

  const isEmpty = stats !== null && stats.totalEblets === 0;

  return (
    <div
      style={{
        padding: '16px 20px',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxSizing: 'border-box',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>📊 Substrate Stats</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            {lastRefreshed ? `Refreshed ${relativeTime(lastRefreshed)}` : 'Loading…'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchStats()}
          disabled={loading}
          style={{
            padding: '5px 12px',
            background: loading ? 'rgba(100,116,139,0.08)' : 'rgba(110,231,183,0.1)',
            border: `1px solid ${loading ? 'rgba(100,116,139,0.2)' : 'rgba(110,231,183,0.3)'}`,
            borderRadius: 6,
            color: loading ? '#475569' : '#6ee7b7',
            fontSize: 11,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
          aria-label={loading ? 'Refreshing stats…' : 'Refresh substrate stats'}
          title="Refresh substrate stats"
        >
          <span style={{ display: 'inline-block', animation: loading ? 'mnemo-spin 0.8s linear infinite' : 'none' }}>
            🔄
          </span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Loading skeleton */}
      {stats === null && loading && (
        <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '32px 0' }}>
          Loading substrate stats…
        </div>
      )}

      {/* Error banner */}
      {stats?.error && (
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 11,
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span>{stats.error}</span>
          <button
            type="button"
            onClick={() => console.log('[SubstrateStatsTab] diagnostics:', stats)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#fbbf24',
              fontSize: 10,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            View diagnostics
          </button>
        </div>
      )}

      {/* Quarantine warning */}
      {stats && stats.quarantinedCount > 0 && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 11,
            color: '#f87171',
          }}
        >
          🚨 {stats.quarantinedCount} quarantined eblet{stats.quarantinedCount !== 1 ? 's' : ''} — review in Console tab
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '48px 0',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 36 }}>🌱</span>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Your substrate is empty</div>
          <div style={{ fontSize: 11, color: '#64748b', maxWidth: 260, lineHeight: 1.6 }}>
            Use <strong style={{ color: '#6ee7b7' }}>Ask</strong> or{' '}
            <strong style={{ color: '#6ee7b7' }}>Test It Out</strong> to grow it.
          </div>
        </div>
      )}

      {/* Stats when loaded */}
      {stats && stats.totalEblets > 0 && (
        <>
          {/* Stats cards row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatCard
              label="Total Eblets"
              value={stats.totalEblets.toLocaleString()}
              accent="rgba(110,231,183,0.35)"
            />
            <StatCard
              label="Verified Correct"
              value={stats.verifiedCount.toLocaleString()}
              sub={`${verifiedPct}% of total`}
              accent="rgba(74,222,128,0.3)"
            />
            <StatCard
              label="Last Write"
              value={stats.lastWriteTimestamp ? relativeTime(stats.lastWriteTimestamp) : '—'}
              accent="rgba(148,163,184,0.2)"
            />
          </div>

          {/* Growth trend */}
          {stats.growthTrend.length > 0 && stats.growthTrend.some((d) => d.count > 0) && (
            <div
              style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(100,116,139,0.15)',
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                Growth (last 30 days)
              </div>
              <GrowthChart data={stats.growthTrend} />
            </div>
          )}

          {/* Top domains */}
          {stats.topDomains.length > 0 && (
            <div
              style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(100,116,139,0.15)',
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                Top Sources
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {(['Source', 'Count', 'Last write'] as const).map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          color: '#475569',
                          fontWeight: 600,
                          paddingBottom: 6,
                          borderBottom: '1px solid rgba(100,116,139,0.15)',
                          paddingRight: 12,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.topDomains.map((d, i) => (
                    <tr key={d.domain}>
                      <td
                        style={{
                          padding: '5px 12px 5px 0',
                          color: '#e2e8f0',
                          borderBottom: i < stats.topDomains.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                        }}
                      >
                        {d.domain}
                      </td>
                      <td
                        style={{
                          padding: '5px 12px 5px 0',
                          color: '#6ee7b7',
                          fontWeight: 600,
                          borderBottom: i < stats.topDomains.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                        }}
                      >
                        {d.count}
                      </td>
                      <td
                        style={{
                          padding: '5px 0',
                          color: '#64748b',
                          borderBottom: i < stats.topDomains.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                        }}
                      >
                        {relativeTime(d.lastWrite)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent writes */}
          {stats.recentWrites.length > 0 && (
            <div
              style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(100,116,139,0.15)',
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                Recent Writes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stats.recentWrites.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      paddingBottom: 6,
                      borderBottom: i < stats.recentWrites.length - 1 ? '1px solid rgba(100,116,139,0.08)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#cbd5e1',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={w.questionExcerpt}
                      >
                        {w.questionExcerpt}
                      </div>
                      <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                        {w.provenanceSource}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: '#475569', flexShrink: 0, paddingTop: 2 }}>
                      {relativeTime(w.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
