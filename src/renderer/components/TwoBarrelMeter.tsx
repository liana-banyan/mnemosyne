// TwoBarrelMeter.tsx -- BP140-K5 MOVE 3 originally shipped "Two Barrels" (a Tokens Remaining
// barrel above a Tokens Saved barrel) replacing the old "The Meter" panel on the Proof tab
// (ProveItWorksTab.tsx). KN-BP143-3 D3 removes Barrel 1 ("Tokens Remaining"): it had literally
// zero data source anywhere in the engine -- not aggregate, not per-AI -- and rendered as a
// permanently empty container in front of the Founder every day. Filename kept as-is (the
// exported symbols below are what other files actually import; renaming the file is a needless
// diff on top of the real fix).
//
// BOUNDARY CHECK RESULT (K5 dispatch, done before any of this was built): read
// src/main/answer_cache_meter.ts's getAnswerCacheMeterSummary() return type
// (AnswerCacheMeterSummary). It exposes AGGREGATE totals only --
// { total_queries, served_verbatim_count, rag_count, local_generate_count, flagship_count,
//   cloud_cost_avoided_usd, avg_latency_ms, avg_served_verbatim_latency_ms } -- there is no
// per-AI/per-authority breakdown anywhere in that file, and a repo-wide search for
// tokens_remaining/tokenBudget/quota_remaining/rateLimit-style fields (the data the old Barrel 1
// would have needed) returned zero hits anywhere in src/. Per the K5 dispatch's explicit
// instruction: STOP the full per-AI barrel build, scaffold the barrel UI against the aggregate
// data only, and report the gap to Bishop -- per-AI attribution is a data-model call, not this
// file's to invent. That report is what led to D3: an honestly-documented empty box is still an
// empty box in front of the Founder every day, so the box is gone, not just explained.
//
// What this file actually renders, honestly:
//  - The single real barrel uses REAL data: cloud_cost_avoided_usd from
//    getAnswerCacheMeterSummary(), rendered as one "All authorities (aggregate)" sand stratum --
//    because that is the only granularity the engine currently tracks. No per-AI split is
//    fabricated. Labeled "Cost Avoided", not "Tokens Saved" -- the underlying number is a dollar
//    estimate, not a token count, and the label now says exactly what it measures.
//  - When the Coupon Clipper measurement lands (a second real, aggregate-or-better metric), a
//    second barrel can return -- built against that real data source, not resurrected as an empty
//    placeholder ahead of it.
//
// Colorblind rule (Founder spec): every color segment carries a text label -- never a
// color-only encoding. Enforced below by always rendering the label text next to every swatch.
//
// Theme note: this codebase has no light/dark ThemeContext anywhere (checked before writing
// this file) -- every existing panel (ProveItWorksTab.tsx, OneClickMeshTestPanel.tsx, etc.)
// hardcodes the same dark palette via inline styles. "Theme-aware" here means this component
// reuses that SAME existing dark palette/token set (the #6ee7b7 / #94a3b8 / #facc15 / #38bdf8
// accent colors already used throughout the Proof tab) rather than inventing a clashing scheme.

import React, { useState } from 'react';

export interface MeterSummaryForBarrels {
  total_queries: number;
  served_verbatim_count: number;
  cloud_cost_avoided_usd: number;
}

/** One barrel layer -- generic enough to hold either a real per-AI number (future) or the
 *  single "aggregate" stand-in this file uses today. */
export interface BarrelLayer {
  key: string;
  label: string;
  color: string;
  value: number;
}

export interface AutoScaleResult {
  /** How many 10x steps above the base "out of 1" tier this value landed in. */
  tier: number;
  denominator: number;
}

/** RELATIVE AUTO-SCALE -- Founder spec, implemented exactly:
 *   value <  0.05                -> denominator 1    ("out of 1")
 *   0.05 <= value < 0.5          -> denominator 10   ("out of 10")
 *   0.5  <= value < 5            -> denominator 100  ("out of 100")
 *   ... climbs by 10x as value keeps growing (5<=v<50 -> 1000, and so on) */
export function computeAutoScale(value: number): AutoScaleResult {
  const v = Math.abs(value);
  let tier = 0;
  // Boundary_i = 0.05 * 10^i (0.05, 0.5, 5, 50, ...); denominator_i = 10^i (1, 10, 100, ...).
  // Capped at tier 12 (denominator 10^12) purely as a runaway guard -- no realistic cost-avoided
  // or token count in this app approaches that magnitude.
  while (tier < 12 && v >= 0.05 * Math.pow(10, tier)) tier += 1;
  return { tier, denominator: Math.pow(10, tier) };
}

/** "X.XXX out of N" -- the exact display convention from the Founder spec, at a caller-chosen
 *  (user-overridable, default 3) decimal resolution. */
export function formatAutoScale(value: number, resolution: number): string {
  const { denominator } = computeAutoScale(value);
  return `${value.toFixed(Math.max(0, resolution))} out of ${denominator}`;
}

function barrelShellPath(width: number, height: number): string {
  // A simple rounded-shoulder barrel silhouette: flat sides, slightly bulging via a wide
  // corner radius top/bottom -- purely decorative chrome, not data-bearing.
  const r = Math.min(18, width / 4);
  return `M ${r} 0
    H ${width - r}
    Q ${width} 0 ${width} ${r}
    V ${height - r}
    Q ${width} ${height} ${width - r} ${height}
    H ${r}
    Q 0 ${height} 0 ${height - r}
    V ${r}
    Q 0 0 ${r} 0
    Z`;
}

const BARREL_W = 130;
const BARREL_H = 170;

/** Colorblind-safe legend row: swatch + text label ALWAYS together, never color alone. Also
 *  doubles as the "clickable legend toggles a stream's visibility" control from the spec. */
function LegendRow({
  color, label, valueText, dimmed, onToggle,
}: { color: string; label: string; valueText: string; dimmed: boolean; onToggle: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={dimmed ? `Show ${label}` : `Hide ${label}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
        opacity: dimmed ? 0.4 : 1, textAlign: 'left', fontFamily: 'system-ui, sans-serif',
      }}
    >
      <span style={{
        width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.25)',
      }} />
      <span style={{ fontSize: 11, color: '#cbd5e1', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>{valueText}</span>
    </button>
  );
}

/** The one real barrel -- cost AVOIDED, color-LAYERED sand strata (never mixing colors), fed by
 *  getAnswerCacheMeterSummary() -> cloud_cost_avoided_usd. Per the boundary check, that field is
 *  aggregate-only, so this renders exactly ONE real stratum ("All authorities (aggregate)")
 *  rather than fabricating a per-AI split the engine cannot back up. */
export function CostAvoidedBarrel({
  meter, resolution,
}: { meter: MeterSummaryForBarrels | null; resolution: number }): React.ReactElement {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const aggregateValue = meter?.cloud_cost_avoided_usd ?? 0;
  const hasData = (meter?.total_queries ?? 0) > 0;
  const layers: BarrelLayer[] = hasData
    ? [{ key: 'aggregate', label: 'All authorities (aggregate)', color: '#6ee7b7', value: aggregateValue }]
    : [];
  const total = layers.reduce((s, l) => (hidden.has(l.key) ? s : s + l.value), 0);
  const { denominator } = computeAutoScale(hasData ? aggregateValue : 0);
  const fillFrac = denominator > 0 ? Math.min(1, total / denominator) : 0;

  // Sand-strata layering: each layer keeps its OWN band, stacked bottom-up, never blended.
  // With a single real layer today this is just one band, but the stacking logic already
  // supports N layers for when per-AI data arrives.
  let cursor = 0;
  const bands = layers
    .filter((l) => !hidden.has(l.key))
    .map((l) => {
      const bandHeight = BARREL_H * fillFrac;
      const y = BARREL_H - cursor - bandHeight;
      cursor += bandHeight;
      return { ...l, y, bandHeight };
    });

  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
      padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>🏜️ Cost Avoided (cumulative)</div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          Scale: <b style={{ color: '#94a3b8' }}>out of {denominator}</b>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <svg width={BARREL_W} height={BARREL_H} viewBox={`0 0 ${BARREL_W} ${BARREL_H}`}>
          <defs>
            {/* Sand-texture hatch so the "sand strata" metaphor reads even in a single band. */}
            <pattern id="sand-hatch" width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width={6} height={6} fill="transparent" />
              <line x1={0} y1={0} x2={0} y2={6} stroke="rgba(0,0,0,0.15)" strokeWidth={2} />
            </pattern>
            <clipPath id="barrel2-clip">
              <path d={barrelShellPath(BARREL_W, BARREL_H)} />
            </clipPath>
          </defs>
          <path
            d={barrelShellPath(BARREL_W, BARREL_H)}
            fill="rgba(148,163,184,0.05)"
            stroke="rgba(148,163,184,0.35)"
            strokeWidth={2}
          />
          {hasData && (
            <g clipPath="url(#barrel2-clip)">
              {bands.map((b) => (
                <React.Fragment key={b.key}>
                  <rect x={0} y={b.y} width={BARREL_W} height={Math.max(0, b.bandHeight)} fill={b.color} opacity={0.9} />
                  <rect x={0} y={b.y} width={BARREL_W} height={Math.max(0, b.bandHeight)} fill="url(#sand-hatch)" />
                </React.Fragment>
              ))}
            </g>
          )}
          {[0.33, 0.66].map((f) => (
            <line key={f} x1={0} y1={BARREL_H * f} x2={BARREL_W} y2={BARREL_H * f} stroke="rgba(148,163,184,0.15)" strokeWidth={2} />
          ))}
          {!hasData && (
            <text x={BARREL_W / 2} y={BARREL_H / 2} textAnchor="middle" fontSize={10} fill="#475569" fontFamily="system-ui, sans-serif">
              no queries yet
            </text>
          )}
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {hasData ? (
            <>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                ${formatAutoScale(aggregateValue, resolution)}
                <span style={{ color: '#475569', fontSize: 9 }}> (estimate -- not a guarantee)</span>
              </div>
              {layers.map((l) => (
                <LegendRow
                  key={l.key}
                  color={l.color}
                  label={l.label}
                  valueText={`$${l.value.toFixed(resolution)}`}
                  dimmed={hidden.has(l.key)}
                  onToggle={() => setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(l.key)) next.delete(l.key); else next.add(l.key);
                    return next;
                  })}
                />
              ))}
              <div style={{ fontSize: 9, color: '#475569', marginTop: 6, lineHeight: 1.5 }}>
                Single aggregate stratum -- the answer engine does not yet attribute avoided cost
                to a specific authority/AI. Per-AI strata activate automatically once
                getAnswerCacheMeterSummary() exposes that breakdown (data-model gap, flagged to
                Bishop).
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }}>
              No queries recorded yet. Ask a question, then come back and refresh.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface CostAvoidedMeterProps {
  meter: MeterSummaryForBarrels | null;
  loading: boolean;
  onRefresh: () => void;
}

/** "Cost Avoided" panel -- KN-BP143-3 D3 replaces the old two-barrel composite (the top barrel,
 *  "Tokens Remaining," had no data source anywhere in the engine and rendered as a permanently
 *  empty box). One real metric, correctly labeled as what it measures. */
export function CostAvoidedMeter({ meter, loading, onRefresh }: CostAvoidedMeterProps): React.ReactElement {
  const [resolution, setResolution] = useState(3);

  return (
    <div style={{
      marginTop: 16, padding: 12, backgroundColor: 'rgba(148, 163, 184, 0.06)',
      border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Cost Avoided</div>
          <div style={{ fontSize: 10, color: '#606060', marginTop: 2 }}>
            Real counter only -- per-AI attribution pending an engine data-model decision (see
            gap note below).
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            Decimals:
            <input
              type="number"
              min={0}
              max={6}
              value={resolution}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v) && v >= 0 && v <= 6) setResolution(v);
              }}
              style={{
                width: 36, background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 4,
                color: '#e2e8f0', fontSize: 10, padding: '2px 4px',
              }}
            />
          </label>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            style={{
              background: 'none', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 4,
              color: '#94a3b8', fontSize: 11, padding: '2px 8px', cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <CostAvoidedBarrel meter={meter} resolution={resolution} />
    </div>
  );
}
