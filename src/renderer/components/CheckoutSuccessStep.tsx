// CheckoutSuccessStep.tsx -- BP078 Scope 5
// Proof closer + join bridge component (Pawn Section 3 + Section 7 drop-in props).
// Truth-Always gate: live metric copy renders ONLY if metrics.live === true AND
// banyanMetric + p50LatencyMs + sourcesCount are all present. Otherwise fallback copy.
// Pawn hard wiring rule #2: this is NOT a generic payment confirmation.

import React, { useEffect } from 'react';

// ─── Types (Pawn Section 7 drop-in) ──────────────────────────────────────────

export type GauntletMode = 'included' | 'own_data' | 'manual';

export interface CheckoutSuccessStepProps {
  runId: string;
  mode: GauntletMode;
  metrics: {
    live: boolean;
    banyanMetric?: number;
    p50LatencyMs?: number;
    sourcesCount?: number;
    stageCount?: number;
  };
  onJoin: () => void;
  onKeepUsing: () => void;
  analytics?: {
    track: (event: string, payload?: Record<string, unknown>) => void;
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0d1117',
  zIndex: 9600,
  padding: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const card: React.CSSProperties = {
  background: '#111827',
  border: '1px solid rgba(110,231,183,0.2)',
  borderRadius: 12,
  padding: '36px 32px 28px',
  maxWidth: 480,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
};

const brandLine: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#6ee7b7',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  marginBottom: 20,
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 20,
  fontWeight: 800,
  color: '#e2e8f0',
  lineHeight: 1.25,
};

const bodyStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 14,
  color: '#94a3b8',
  lineHeight: 1.7,
};

const bridgeStyle: React.CSSProperties = {
  margin: '0 0 20px',
  fontSize: 13,
  color: '#64748b',
  lineHeight: 1.6,
};

const interstitialLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#475569',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  margin: '0 0 14px',
};

const primaryBtn: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '13px 20px',
  background: 'rgba(110,231,183,0.13)',
  border: '1px solid rgba(110,231,183,0.4)',
  borderRadius: 8,
  color: '#6ee7b7',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center' as const,
  marginBottom: 10,
  fontFamily: 'inherit',
};

const microcopyStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#334155',
  textAlign: 'center' as const,
  lineHeight: 1.5,
  margin: '0 0 12px',
};

const ghostBtn: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'center' as const,
  background: 'none',
  border: 'none',
  color: '#475569',
  fontSize: 12,
  cursor: 'pointer',
  padding: '5px 0',
  fontFamily: 'inherit',
};

const metricRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 20,
};

const metricCell: React.CSSProperties = {
  flex: 1,
  background: 'rgba(6,78,59,0.12)',
  border: '1px solid rgba(110,231,183,0.2)',
  borderRadius: 8,
  padding: '12px 12px 10px',
  textAlign: 'center' as const,
};

const metricValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#6ee7b7',
  lineHeight: 1.2,
};

const metricLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#64748b',
  marginTop: 3,
  lineHeight: 1.4,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckoutSuccessStep({
  runId,
  mode,
  metrics,
  onJoin,
  onKeepUsing,
  analytics,
}: CheckoutSuccessStepProps): React.ReactElement {
  const liveGate =
    metrics.live === true &&
    metrics.banyanMetric !== undefined &&
    metrics.p50LatencyMs !== undefined &&
    metrics.sourcesCount !== undefined;

  useEffect(() => {
    analytics?.track('gauntlet_live_results_viewed', {
      source: 'gauntlet_results',
      run_id: runId,
      metrics_live: metrics.live,
      banyan_metric: metrics.banyanMetric,
      p50_latency_ms: metrics.p50LatencyMs,
      sources_count: metrics.sourcesCount,
      stage_count: metrics.stageCount,
      mode,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={brandLine}>MnemosyneC</div>

        {liveGate ? (
          <>
            <h2 style={headingStyle}>{"Here's what this run just proved"}</h2>
            <p style={bodyStyle}>
              {`This run measured a Banyan Metric of ${metrics.banyanMetric!.toFixed(1)}, median response time of ${metrics.p50LatencyMs} ms, and ${metrics.sourcesCount} live sources in play.`}
            </p>
            <div style={metricRow}>
              <div style={metricCell}>
                <div style={metricValue}>{metrics.banyanMetric!.toFixed(1)}</div>
                <div style={metricLabel}>Banyan Metric</div>
              </div>
              <div style={metricCell}>
                <div style={metricValue}>{metrics.p50LatencyMs}ms</div>
                <div style={metricLabel}>p50 latency</div>
              </div>
              <div style={metricCell}>
                <div style={metricValue}>{metrics.sourcesCount}</div>
                <div style={metricLabel}>live sources</div>
              </div>
            </div>
            <p style={bridgeStyle}>
              If you want this to extend beyond your own machine into shared mesh capacity, member tools, and cooperative pathways, join Liana Banyan for $5/year.
            </p>
          </>
        ) : (
          <>
            <h2 style={headingStyle}>Your private run is working</h2>
            <p style={bodyStyle}>
              {"You've confirmed the local path. Next, connect this install to the member layer that extends it into shared tools and Federation."}
            </p>
            <p style={bridgeStyle}>
              Join Liana Banyan for $5/year to open Helm, Federation, and your first cooperative path.
            </p>
          </>
        )}

        <p style={interstitialLabel}>
          Next step -- Keep this private and local, or turn it into shared capacity.
        </p>

        <button type="button" style={primaryBtn} onClick={onJoin}>
          Join for $5/year
        </button>

        <p style={microcopyStyle}>
          $5/year. Cancel anytime. Opens Federation, Helm member tools, and your first cooperative path.
        </p>

        <button type="button" style={ghostBtn} onClick={onKeepUsing}>
          Keep using MnemosyneC
        </button>
      </div>
    </div>
  );
}
