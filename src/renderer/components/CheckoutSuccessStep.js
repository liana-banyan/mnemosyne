import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// CheckoutSuccessStep.tsx -- BP078 Scope 5
// Proof closer + join bridge component (Pawn Section 3 + Section 7 drop-in props).
// Truth-Always gate: live metric copy renders ONLY if metrics.live === true AND
// banyanMetric + p50LatencyMs + sourcesCount are all present. Otherwise fallback copy.
// Pawn hard wiring rule #2: this is NOT a generic payment confirmation.
import { useEffect } from 'react';
// ─── Styles ───────────────────────────────────────────────────────────────────
const overlay = {
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
const card = {
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
const brandLine = {
    fontSize: 12,
    fontWeight: 700,
    color: '#6ee7b7',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 20,
};
const headingStyle = {
    margin: '0 0 10px',
    fontSize: 20,
    fontWeight: 800,
    color: '#e2e8f0',
    lineHeight: 1.25,
};
const bodyStyle = {
    margin: '0 0 14px',
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 1.7,
};
const bridgeStyle = {
    margin: '0 0 20px',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.6,
};
const interstitialLabel = {
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    margin: '0 0 14px',
};
const primaryBtn = {
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
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'inherit',
};
const microcopyStyle = {
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '0 0 12px',
};
const ghostBtn = {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: 12,
    cursor: 'pointer',
    padding: '5px 0',
    fontFamily: 'inherit',
};
const metricRow = {
    display: 'flex',
    gap: 10,
    marginBottom: 20,
};
const metricCell = {
    flex: 1,
    background: 'rgba(6,78,59,0.12)',
    border: '1px solid rgba(110,231,183,0.2)',
    borderRadius: 8,
    padding: '12px 12px 10px',
    textAlign: 'center',
};
const metricValue = {
    fontSize: 20,
    fontWeight: 700,
    color: '#6ee7b7',
    lineHeight: 1.2,
};
const metricLabel = {
    fontSize: 10,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 1.4,
};
// ─── Component ────────────────────────────────────────────────────────────────
export function CheckoutSuccessStep({ runId, mode, metrics, onJoin, onKeepUsing, analytics, }) {
    const liveGate = metrics.live === true &&
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
    return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), liveGate ? (_jsxs(_Fragment, { children: [_jsx("h2", { style: headingStyle, children: "Here's what this run just proved" }), _jsx("p", { style: bodyStyle, children: `This run measured a Banyan Metric of ${metrics.banyanMetric.toFixed(1)}, median response time of ${metrics.p50LatencyMs} ms, and ${metrics.sourcesCount} live sources in play.` }), _jsxs("div", { style: metricRow, children: [_jsxs("div", { style: metricCell, children: [_jsx("div", { style: metricValue, children: metrics.banyanMetric.toFixed(1) }), _jsx("div", { style: metricLabel, children: "Banyan Metric" })] }), _jsxs("div", { style: metricCell, children: [_jsxs("div", { style: metricValue, children: [metrics.p50LatencyMs, "ms"] }), _jsx("div", { style: metricLabel, children: "p50 latency" })] }), _jsxs("div", { style: metricCell, children: [_jsx("div", { style: metricValue, children: metrics.sourcesCount }), _jsx("div", { style: metricLabel, children: "live sources" })] })] }), _jsx("p", { style: bridgeStyle, children: "If you want this to extend beyond your own machine into shared mesh capacity, member tools, and cooperative pathways, join Liana Banyan for $5/year." })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { style: headingStyle, children: "Your private run is working" }), _jsx("p", { style: bodyStyle, children: "You've confirmed the local path. Next, connect this install to the member layer that extends it into shared tools and Federation." }), _jsx("p", { style: bridgeStyle, children: "Join Liana Banyan for $5/year to open Helm, Federation, and your first cooperative path." })] })), _jsx("p", { style: interstitialLabel, children: "Next step -- Keep this private and local, or turn it into shared capacity." }), _jsx("button", { type: "button", style: primaryBtn, onClick: onJoin, children: "Join for $5/year" }), _jsx("p", { style: microcopyStyle, children: "$5/year. Cancel anytime. Opens Federation, Helm member tools, and your first cooperative path." }), _jsx("button", { type: "button", style: ghostBtn, onClick: onKeepUsing, children: "Keep using MnemosyneC" })] }) }));
}
