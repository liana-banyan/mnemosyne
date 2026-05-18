// AMPLIFY Dashboard — B37 Phase 4 + Phase 7
// Full telemetry: real-time session + historical (today/week/month) + daily bar chart + share card
// Phase 3 retained: mode switcher, force-mode settings, federation panel
// Phase 7: Auth state, member badge, trial info, sign-out

import React, { useEffect, useState, useCallback } from 'react';
import type { FrameMode } from './FrameModeIndicator';
import { ShareCard } from './ShareCard';
import { NotCentsGlyph } from './NotCentsGlyph';
import type { AuthState } from '../amplify.d';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeriodStats {
  period: string;
  label: string;
  total_queries: number;
  substrate_hits: number;
  local_ollama_served: number;
  cloud_escalations: number;
  peer_synced: number;
  misses: number;
  substrate_hit_ratio: number;
  local_ratio: number;
  cloud_ratio: number;
  cloud_cost_avoided_usd: number;
  tokens_saved_est: number;
  avg_latency_ms: number;
  avg_local_latency_ms: number;
  cloud_baseline_latency_ms: number;
  latency_improvement_pct: number;
  days_active: number;
}

interface DailyBreakdown {
  date: string;
  total_queries: number;
  substrate_hits: number;
  local_ollama_served: number;
  cloud_escalations: number;
  cloud_cost_avoided_usd: number;
  tokens_saved_est: number;
  avg_latency_ms: number;
}

interface TelemetrySummary {
  session: PeriodStats;
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  daily_breakdown: DailyBreakdown[];
  all_time_cost_avoided_usd: number;
  all_time_tokens_saved: number;
  all_time_queries: number;
}

interface FederationStatus {
  online: boolean;
  peerCount: number;
  lastSyncTs: string | null;
  lastSyncRecordsExchanged: number;
  pendingWriteCount: number;
}

interface FrameModePayload {
  mode: FrameMode;
  forced_mode: FrameMode | null;
}

interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
  version?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  errorMessage?: string;
}

interface AMPLIFYDashboardProps {
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
  onClose: () => void;
  /** Phase 7: live auth/trial state */
  authState?: AuthState | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODES: { id: FrameMode; icon: string; label: string; desc: string }[] = [
  { id: 'ai_burst', icon: '🔥', label: 'AI Burst', desc: 'Substrate + Ollama + cloud' },
  { id: 'normal', icon: '🌿', label: 'Normal', desc: 'Substrate-only, no AI cost' },
  { id: 'fallback', icon: '🌑', label: 'Fallback', desc: 'Peer-to-peer, zero cloud' },
];

const FORCE_OPTIONS: { id: FrameMode | 'auto'; label: string }[] = [
  { id: 'auto', label: 'Auto-Detect' },
  { id: 'ai_burst', label: '🔥 AI Burst' },
  { id: 'normal', label: '🌿 Normal' },
  { id: 'fallback', label: '🌑 Fallback' },
];

const emptyPeriod = (label = ''): PeriodStats => ({
  period: '',
  label,
  total_queries: 0,
  substrate_hits: 0,
  local_ollama_served: 0,
  cloud_escalations: 0,
  peer_synced: 0,
  misses: 0,
  substrate_hit_ratio: 0,
  local_ratio: 0,
  cloud_ratio: 0,
  cloud_cost_avoided_usd: 0,
  tokens_saved_est: 0,
  avg_latency_ms: 0,
  avg_local_latency_ms: 0,
  cloud_baseline_latency_ms: 1200,
  latency_improvement_pct: 0,
  days_active: 0,
});

const emptySummary: TelemetrySummary = {
  session: emptyPeriod('This Session'),
  today: emptyPeriod('Today'),
  week: emptyPeriod('This Week'),
  month: emptyPeriod('This Month'),
  daily_breakdown: [],
  all_time_cost_avoided_usd: 0,
  all_time_tokens_saved: 0,
  all_time_queries: 0,
};

function fmt$(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function syncLabel(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

// ─── Daily Bar Chart ──────────────────────────────────────────────────────────

const DailyChart: React.FC<{ data: DailyBreakdown[] }> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11, padding: '20px 0' }}>
        No historical data yet — start routing queries to see daily trends
      </div>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.cloud_cost_avoided_usd), 0.0001);
  const shown = data.slice(0, 14).reverse();

  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
        DAILY CLOUD COST AVOIDED (last {shown.length} days)
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 60,
          padding: '0 0 4px',
        }}
      >
        {shown.map((d) => {
          const heightPct = d.cloud_cost_avoided_usd / maxCost;
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={d.date}
              title={`${d.date}: ${fmt$(d.cloud_cost_avoided_usd)} saved (${d.total_queries} queries)`}
              style={{
                flex: 1,
                height: `${Math.max(heightPct * 100, 4)}%`,
                background: isToday
                  ? 'linear-gradient(to top, #16a34a, #22c55e)'
                  : 'linear-gradient(to top, #1d4ed8, #3b82f6)',
                borderRadius: '2px 2px 0 0',
                opacity: d.total_queries === 0 ? 0.15 : 0.85,
                cursor: 'default',
                transition: 'opacity 0.2s',
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 3,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 3,
        }}
      >
        {shown.map((d) => {
          const day = new Date(d.date + 'T12:00:00').getDate();
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={d.date}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 8,
                color: isToday ? '#22c55e' : 'rgba(255,255,255,0.2)',
                fontWeight: isToday ? 700 : 400,
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Stat row ─────────────────────────────────────────────────────────────────

const StatRow: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({
  label,
  value,
  sub,
  color,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '5px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}
  >
    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color: color ?? 'rgba(255,255,255,0.85)' }}>
      {value}
      {sub && (
        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.55, marginLeft: 4 }}>
          {sub}
        </span>
      )}
    </span>
  </div>
);

// ─── Period selector ──────────────────────────────────────────────────────────

type HistoryPeriod = 'session' | 'today' | 'week' | 'month';

const PERIOD_TABS: { id: HistoryPeriod; label: string }[] = [
  { id: 'session', label: 'Session' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

// ─── Dashboard tabs ───────────────────────────────────────────────────────────

type Tab = 'stats' | 'history' | 'settings' | 'federation';

// ─── Main Component ───────────────────────────────────────────────────────────

export const AMPLIFYDashboard: React.FC<AMPLIFYDashboardProps> = ({
  currentMode,
  onModeChange,
  onClose,
  authState,
}) => {
  const [summary, setSummary] = useState<TelemetrySummary>(emptySummary);
  const [federation, setFederation] = useState<FederationStatus>({
    online: false, peerCount: 0, lastSyncTs: null, lastSyncRecordsExchanged: 0, pendingWriteCount: 0,
  });
  const [forcedMode, setForcedMode] = useState<FrameMode | null>(null);
  const [tab, setTab] = useState<Tab>('stats');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('session');
  const [showShareCard, setShowShareCard] = useState(false);
  const [forceApplied, setForceApplied] = useState(false);
  const [moneyPennyUrl, setMoneyPennyUrl] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  const [appVersion, setAppVersion] = useState<{ version: string; buildHash: string } | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [sum, fed, modeInfo, mpUrl] = await Promise.all([
      window.amplify.getAMPLIFYSummary(),
      window.amplify.getFederationStatus(),
      window.amplify.getFrameMode(),
      window.amplify.getMoneyPennyUrl(),
    ]);
    setSummary((sum as TelemetrySummary) ?? emptySummary);
    setFederation(fed as FederationStatus);
    setForcedMode((modeInfo as FrameModePayload).forced_mode);
    setMoneyPennyUrl(mpUrl.url);
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 5000);
    return () => clearInterval(iv);
  }, [loadData]);

  // Auto-update listener
  useEffect(() => {
    window.amplify.getUpdateState().then(setUpdateState);
    const cleanup = window.amplify.onUpdateStateChanged(setUpdateState);
    return cleanup;
  }, []);

  // Version display (MV-VERSION-DISPLAY BP044)
  useEffect(() => {
    window.amplify.getAppVersion?.().then((v) => {
      if (v) setAppVersion(v);
    });
  }, []);

  // ── Period to stats ───────────────────────────────────────────────────────
  const periodStats: PeriodStats = summary[historyPeriod];

  // ── Force mode ────────────────────────────────────────────────────────────
  const handleForceMode = async (value: FrameMode | 'auto') => {
    const mode = value === 'auto' ? null : value;
    const result = await window.amplify.forceFrameMode(mode);
    setForcedMode(result.forced_mode);
    if (mode !== null) onModeChange(mode);
    setForceApplied(true);
    setTimeout(() => setForceApplied(false), 1500);
  };

  // ── Share card data ───────────────────────────────────────────────────────
  const shareStats = summary.month;
  const localServedPct = (shareStats.substrate_hit_ratio + shareStats.local_ratio) * 100;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {showShareCard && (
        <ShareCard
          costAvoided={shareStats.cloud_cost_avoided_usd}
          totalQueries={shareStats.total_queries}
          substratePct={localServedPct}
          tokensSaved={shareStats.tokens_saved_est}
          latencyImprovementPct={shareStats.latency_improvement_pct}
          period={shareStats.label}
          onClose={() => setShowShareCard(false)}
        />
      )}

      <div className="dashboard" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="dashboard__panel">

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div className="dashboard__title">Mnemosyne</div>
              <div className="dashboard__subtitle">
                Mnemosyne CAI Amplifier — {MODES.find((m) => m.id === currentMode)?.label ?? 'Normal'} Mode
                {forcedMode && (
                  <span style={{ color: '#f59e0b', marginLeft: 6, fontSize: 10 }}>(forced)</span>
                )}
              </div>
            </div>

            {/* Phase 7: Member badge / auth state chip */}
            {authState && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 4,
                  marginTop: 2,
                }}
              >
                {/* BP043 SEG-G — NotCents Đ balance chip */}
                <div
                  title="Your NotCents Đ balance (cooperative substitution-only)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(110,231,183,0.08)',
                    border: '1px solid rgba(110,231,183,0.22)',
                    borderRadius: 20,
                    padding: '2px 9px',
                    fontSize: 11,
                    color: '#6ee7b7',
                  }}
                >
                  <NotCentsGlyph size="0.95em" alt="NotCents balance" />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      const bal = (authState as any)?.member?.notcents_balance;
                      return typeof bal === 'number' ? bal.toLocaleString() : '—';
                    })()}
                  </span>
                </div>
                {authState.status === 'member' && authState.member ? (
                  <div
                    title={`Signed in as ${authState.member.email}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: 20,
                      padding: '3px 10px',
                      fontSize: 11,
                      color: '#f59e0b',
                    }}
                  >
                    {authState.member.badge_tier === 'stamped' && (
                      <span style={{ fontSize: 8 }}>✦</span>
                    )}
                    {authState.member.display_name}
                  </div>
                ) : authState.status === 'trial_active' ? (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.35)',
                      borderRadius: 20,
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '2px 8px',
                    }}
                  >
                    Trial · {authState.trial_days_remaining ?? 0}d left
                  </div>
                ) : authState.status === 'trial_expired' ? (
                  <div
                    style={{
                      fontSize: 10,
                      color: '#fca5a5',
                      borderRadius: 20,
                      border: '1px solid rgba(239,68,68,0.25)',
                      padding: '2px 8px',
                    }}
                  >
                    ⚠ Trial expired
                  </div>
                ) : null}

                {/* Sign-out link for members */}
                {authState.status === 'member' && (
                  <button
                    onClick={() => window.amplify.authSignOut()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.2)',
                      fontSize: 10,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Sign out
                  </button>
                )}

                {/* Sign-in CTA for trial users */}
                {(authState.status === 'trial_active' || authState.status === 'trial_expired') && (
                  <button
                    onClick={() => window.amplify.authSignIn()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f59e0b',
                      fontSize: 10,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Sign in →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Update banner */}
          {(updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'downloaded') && (
            <div
              style={{
                margin: '8px 0',
                padding: '8px 12px',
                borderRadius: 8,
                background: updateState.status === 'downloaded'
                  ? 'rgba(34,197,94,0.12)'
                  : 'rgba(59,130,246,0.12)',
                border: `1px solid ${updateState.status === 'downloaded' ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: updateState.status === 'downloaded' ? '#22c55e' : '#60a5fa' }}>
                  {updateState.status === 'downloaded'
                    ? `✓ v${updateState.version} ready to install`
                    : updateState.status === 'downloading'
                    ? `⬇ Downloading v${updateState.version}… ${updateState.downloadProgress ?? 0}%`
                    : appVersion
                    ? `↑ v${appVersion.version} → v${updateState.version} available · `
                    : `↑ v${updateState.version} available`}
                  {updateState.status === 'available' && (
                    <a
                      href="https://cephas.lianabanyan.com/changelog/"
                      onClick={(e) => {
                        e.preventDefault();
                        const ext = (window as any).amplify?.openExternal;
                        if (typeof ext === 'function') ext('https://cephas.lianabanyan.com/changelog/');
                      }}
                      style={{ color: '#93c5fd', fontSize: 11, cursor: 'pointer' }}
                    >
                      changelog
                    </a>
                  )}
                </div>
                {updateState.status === 'downloading' && (
                  <div style={{ marginTop: 4, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${updateState.downloadProgress ?? 0}%`,
                        background: '#3b82f6',
                        borderRadius: 2,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                )}
              </div>
              {updateState.status === 'downloaded' && (
                <button
                  onClick={() => window.amplify.installUpdate()}
                  style={{
                    padding: '5px 12px',
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: 6,
                    color: '#000',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Restart
                </button>
              )}
            </div>
          )}

          {/* Mode switcher */}
          <div className="mode-switcher">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mode-btn ${currentMode === m.id ? `mode-btn--active-${m.id}` : ''}`}
                onClick={() => onModeChange(m.id)}
                title={m.desc}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Tab nav */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {(['stats', 'history', 'settings', 'federation'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  background: tab === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                  border: tab === t ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                {t === 'stats' ? '📊' : t === 'history' ? '📅' : t === 'settings' ? '⚙️' : '🌐'}
                {' '}{t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Stats tab (real-time session) ───────────────────────────── */}
          {tab === 'stats' && (
            <>
              <StatRow
                label="Cloud cost avoided"
                value={fmt$(summary.session.cloud_cost_avoided_usd)}
                color="#22c55e"
              />
              <StatRow
                label="Total queries"
                value={summary.session.total_queries.toLocaleString()}
              />
              <StatRow
                label="Substrate hits"
                value={summary.session.substrate_hits.toLocaleString()}
                sub={pct(summary.session.substrate_hit_ratio)}
                color="#22c55e"
              />
              <StatRow
                label="Local Ollama"
                value={summary.session.local_ollama_served.toLocaleString()}
                sub={pct(summary.session.local_ratio)}
                color="#f59e0b"
              />
              <StatRow
                label="Cloud escalations"
                value={summary.session.cloud_escalations.toLocaleString()}
                sub={pct(summary.session.cloud_ratio)}
              />
              <StatRow
                label="Tokens saved"
                value={fmtTokens(summary.session.tokens_saved_est)}
              />
              {summary.session.avg_local_latency_ms > 0 && (
                <StatRow
                  label="Latency improvement"
                  value={summary.session.latency_improvement_pct > 0
                    ? `${summary.session.latency_improvement_pct}% faster`
                    : '—'}
                  sub={summary.session.avg_local_latency_ms > 0
                    ? `${summary.session.avg_local_latency_ms}ms vs ${summary.session.cloud_baseline_latency_ms}ms cloud`
                    : undefined}
                  color="#38bdf8"
                />
              )}

              {/* All-time row */}
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                  ALL TIME
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    {summary.all_time_queries.toLocaleString()} queries
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>
                    {fmt$(summary.all_time_cost_avoided_usd)} saved
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    {fmtTokens(summary.all_time_tokens_saved)} tokens
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── History tab ─────────────────────────────────────────────── */}
          {tab === 'history' && (
            <>
              {/* Period selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {PERIOD_TABS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setHistoryPeriod(p.id)}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      background: historyPeriod === p.id ? 'rgba(34,197,94,0.15)' : 'transparent',
                      border: historyPeriod === p.id
                        ? '1px solid rgba(34,197,94,0.4)'
                        : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      color: historyPeriod === p.id ? '#22c55e' : 'rgba(255,255,255,0.5)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Period stats */}
              <StatRow
                label="Cloud cost avoided"
                value={fmt$(periodStats.cloud_cost_avoided_usd)}
                color="#22c55e"
              />
              <StatRow
                label="Queries"
                value={periodStats.total_queries.toLocaleString()}
              />
              <StatRow
                label="Locally served"
                value={pct(periodStats.substrate_hit_ratio + periodStats.local_ratio)}
                sub={`${periodStats.substrate_hits} substrate · ${periodStats.local_ollama_served} Ollama`}
                color="#22c55e"
              />
              <StatRow
                label="Cloud escalations"
                value={periodStats.cloud_escalations.toLocaleString()}
                sub={pct(periodStats.cloud_ratio)}
              />
              <StatRow
                label="Tokens saved"
                value={fmtTokens(periodStats.tokens_saved_est)}
              />
              {periodStats.latency_improvement_pct > 0 && (
                <StatRow
                  label="Latency improvement"
                  value={`${periodStats.latency_improvement_pct}% faster`}
                  sub={`${periodStats.avg_local_latency_ms}ms local vs ${periodStats.cloud_baseline_latency_ms}ms cloud`}
                  color="#38bdf8"
                />
              )}
              {periodStats.days_active > 1 && (
                <StatRow
                  label="Days active"
                  value={`${periodStats.days_active}`}
                />
              )}

              {/* Daily bar chart */}
              <div style={{ marginTop: 14 }}>
                <DailyChart data={summary.daily_breakdown} />
              </div>

              {/* Share button (monthly only) */}
              {(historyPeriod === 'month' || historyPeriod === 'week') && (
                <button
                  onClick={() => setShowShareCard(true)}
                  style={{
                    width: '100%',
                    marginTop: 12,
                    padding: '8px 0',
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 8,
                    color: 'rgba(245,158,11,0.9)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ✨ Share savings summary (opt-in)
                </button>
              )}
            </>
          )}

          {/* ── Settings tab ─────────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div style={{ padding: '4px 0' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                MODE OVERRIDE
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
                Lock AMPLIFY into a specific mode, bypassing auto-detection.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FORCE_OPTIONS.map((opt) => {
                  const isActive = opt.id === 'auto' ? forcedMode === null : forcedMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleForceMode(opt.id)}
                      style={{
                        padding: '8px 12px',
                        background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                        border: isActive
                          ? '1px solid rgba(255,255,255,0.3)'
                          : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: 13,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{opt.label}</span>
                      {isActive && (
                        <span style={{ fontSize: 10, color: '#16a34a' }}>
                          {forceApplied ? '✓ Applied' : '● Active'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                Auto-Detect switches mode based on Ollama availability, network connectivity,
                and peer count. Privacy-conscious users should lock to Fallback.
              </div>

              {/* Update control */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  SOFTWARE UPDATE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    {updateState.status === 'idle'
                      ? `Mnemosyne ${appVersion ? `v${appVersion.version}` : ''}`
                      : updateState.status === 'checking' ? 'Checking…'
                      : updateState.status === 'not-available'
                      ? `✓ v${appVersion?.version ?? '?'} — up to date`
                      : updateState.status === 'available' ? `v${updateState.version} available`
                      : updateState.status === 'downloading' ? `Downloading ${updateState.downloadProgress ?? 0}%`
                      : updateState.status === 'downloaded' ? `v${updateState.version} ready`
                      : updateState.status === 'error' ? `Error: ${updateState.errorMessage?.slice(0, 40)}`
                      : '—'}
                  </span>
                  <button
                    onClick={() => updateState.status === 'downloaded'
                      ? window.amplify.installUpdate()
                      : window.amplify.checkForUpdates()}
                    style={{
                      padding: '5px 12px',
                      background: updateState.status === 'downloaded'
                        ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${updateState.status === 'downloaded'
                        ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 6,
                      color: updateState.status === 'downloaded' ? '#22c55e' : 'rgba(255,255,255,0.6)',
                      fontSize: 11,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {updateState.status === 'downloaded' ? 'Restart & Install'
                      : updateState.status === 'checking' ? 'Checking…'
                      : 'Check Now'}
                  </button>
                </div>
              </div>

              {/* MoneyPenny Mobile URL */}
              {moneyPennyUrl && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '10px 12px',
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: 'rgba(245,158,11,0.6)', marginBottom: 5 }}>
                    📱 MONEYPENNY MOBILE
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: 'rgba(245,158,11,0.85)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {moneyPennyUrl}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>
                    Open on your phone while on the same WiFi network
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Federation tab ────────────────────────────────────────────── */}
          {tab === 'federation' && (
            <div style={{ padding: '4px 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: federation.online ? '#16a34a' : '#6b7280',
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                  Cooperative Substrate:{' '}
                  <strong>{federation.online ? 'Online' : 'Offline'}</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Local Peers', value: federation.peerCount },
                  { label: 'Last Sync', value: syncLabel(federation.lastSyncTs) },
                  { label: 'Records Synced', value: federation.lastSyncRecordsExchanged },
                  { label: 'Pending Writes', value: federation.pendingWriteCount },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                      {item.label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {currentMode === 'fallback' && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(107,114,128,0.15)',
                    borderRadius: 8,
                    border: '1px solid rgba(107,114,128,0.3)',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.5,
                  }}
                >
                  🌑 Fallback active — peer-to-peer substrate exchange only.
                  {federation.peerCount === 0
                    ? ' Scanning local network for peers...'
                    : ` Syncing with ${federation.peerCount} local peer${federation.peerCount !== 1 ? 's' : ''}.`}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                The cooperative substrate syncs high-signal records with{' '}
                <strong style={{ color: 'rgba(255,255,255,0.5)' }}>lianabanyan.com</strong>.
                Join the cooperative for $5/year to contribute and benefit from the full network.
              </div>
            </div>
          )}

          {/* Footer — version display (MV-VERSION-DISPLAY BP044) */}
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              marginTop: 12,
              marginBottom: 4,
              letterSpacing: 0.5,
            }}
          >
            Mnemosyne · powered by CAI · AGPL Free Forever · No Ads · No Strings
          </div>
          {appVersion && (
            <div
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.18)',
                textAlign: 'center',
                marginBottom: 4,
                letterSpacing: 0.4,
                fontFamily: 'monospace',
              }}
            >
              v{appVersion.version}+{appVersion.buildHash} · LB Alpha-phase ·{' '}
              <a
                href="https://cephas.lianabanyan.com/changelog/"
                onClick={(e) => {
                  e.preventDefault();
                  const ext = (window as any).amplify?.openExternal;
                  if (typeof ext === 'function') ext('https://cephas.lianabanyan.com/changelog/');
                }}
                style={{ color: 'rgba(246,173,85,0.45)', textDecoration: 'none', cursor: 'pointer' }}
              >
                changelog
              </a>
            </div>
          )}
          <div
            style={{
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            <a
              href="https://lianabanyan.com/bonfire"
              onClick={(e) => {
                e.preventDefault();
                const ext = (window as any).amplify?.openExternal;
                if (typeof ext === 'function') {
                  ext('https://lianabanyan.com/bonfire');
                }
              }}
              style={{
                display: 'inline-block',
                fontSize: 10,
                color: 'rgba(245,158,11,0.55)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 20,
                padding: '2px 10px',
                letterSpacing: 0.4,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              title="Initiative #17 — The Bonfire · cooperative open-source AI research"
            >
              🔥 Bonfire · Initiative #17 · cooperative open-source AI
            </a>
          </div>

          <button className="close-btn" onClick={onClose}>
            Close Dashboard
          </button>
        </div>
      </div>
    </>
  );
};

export default AMPLIFYDashboard;
