// TwoBarrelMeter.tsx -- BP140-K5 MOVE 3: "Two Barrels" replacing the old "The Meter" panel on
// the Proof tab (ProveItWorksTab.tsx).
//
// BOUNDARY CHECK RESULT (K5 dispatch, done before any of this was built): read
// src/main/answer_cache_meter.ts's getAnswerCacheMeterSummary() return type
// (AnswerCacheMeterSummary). It exposes AGGREGATE totals only --
// { total_queries, served_verbatim_count, rag_count, local_generate_count, flagship_count,
//   cloud_cost_avoided_usd, avg_latency_ms, avg_served_verbatim_latency_ms } -- there is no
// per-AI/per-authority breakdown anywhere in that file, and a repo-wide search for
// tokens_remaining/tokenBudget/quota_remaining/rateLimit-style fields (the data Barrel 1 would
// need) returned zero hits anywhere in src/. Per the K5 dispatch's explicit instruction: STOP
// the full per-AI barrel build, scaffold the barrel UI against the aggregate data only, and
// report the gap to Bishop (see the K5 response for the full writeup) -- per-AI attribution is
// a data-model call, not this file's to invent.
//
// What this file actually renders, honestly:
//  - Barrel 2 (tokens SAVED) uses REAL data: cloud_cost_avoided_usd from
//    getAnswerCacheMeterSummary(), rendered as a single "All authorities (aggregate)" sand
//    stratum -- because that is the only granularity the engine currently tracks. No per-AI
//    split is fabricated.
//  - Barrel 1 (tokens REMAINING) has literally zero data source anywhere in the engine right
//    now -- not aggregate, not per-AI. Its component, TokensRemainingBarrel, already renders an
//    explicit, honest "not yet tracked" empty state if it were mounted (same Truth-Always
//    convention this app already uses for "No queries recorded yet") -- but per KN-BP143-3 D3
//    (Founder amendment), an honestly-labeled empty box is STILL an empty box in front of the
//    Founder every day, so TwoBarrelMeter below no longer mounts it at all. The function, its
//    props, the color legend, spigot, and layout are all kept exactly as built (Founder's
//    explicit instruction: do not delete Barrel 1 or its structure) so the Coupon Clipper's
//    price-aware routing/savings work can flip SHOW_TOKENS_REMAINING_BARREL below and pass real
//    `layers` the moment that data exists -- no rebuild of this component. See
//    SPEC_THE_COUPON_CLIPPER_PRICE_AWARE_ROUTING_AND_SAVINGS_METER_BP143.md for that work.
//
// Colorblind rule (Founder spec): every color segment carries a text label -- never a
// color-only encoding. Enforced below by always rendering the label text next to every swatch.
//
// Theme note: this codebase has no light/dark ThemeContext anywhere (checked before writing
// this file) -- every existing panel (ProveItWorksTab.tsx, OneClickMeshTestPanel.tsx, etc.)
// hardcodes the same dark palette via inline styles. "Theme-aware" here means this component
// reuses that SAME existing dark palette/token set (the #6ee7b7 / #94a3b8 / #facc15 / #38bdf8
// accent colors already used throughout the Proof tab) rather than inventing a clashing scheme
// -- there is no actual light/dark switch to be "aware" of yet. Flagged to Bishop alongside the
// per-AI gap.
//
// KN-BP145-M1 ADDITION: Barrel 1 now HAS a real data source design -- see
// src/main/hearth/usage_barrel_scraper.ts. That module scrapes Anthropic's own claude.ai
// Settings > Usage panel for the rolling 5-hour and weekly rate-limit windows (percent consumed
// plus reset countdown; the vendor never publishes an allocation/token count, and none is
// invented here) and computes a real consumption-rate-vs-reset-time operational answer. This is
// a DIFFERENT metric from TokensRemainingBarrel above (which is reserved, untouched, for the
// Coupon Clipper's future per-AI tokens-remaining-as-an-amount work per KN-BP143-3 D3 -- do not
// conflate the two). VendorUsageBarrel below renders the new metric as its own, separately
// labeled block. WIRING BOUNDARY (report this honestly, do not fabricate a live wire): this
// component only renders whatever `vendorUsage` prop it is given. The actual IPC round trip --
// preload.ts contextBridge export, an index.ts ipcMain handler calling
// scrapeVendorUsagePanel()/computeUsageBarrelOperationalSnapshot(), and a ProveItWorksTab.tsx
// call site passing the result down as this prop -- touches three files outside this ticket's
// owned scope and is NOT built here (see the KN-BP145-M1 report). SHOW_VENDOR_USAGE_BARREL below
// stays `false` until that wiring lands, mirroring the exact SHOW_TOKENS_REMAINING_BARREL
// precedent: an honestly-labeled "unknown" box is still a box the Founder would see every day
// with no live data behind it yet.

import React, { useState } from 'react';

export interface MeterSummaryForBarrels {
  total_queries: number;
  served_verbatim_count: number;
  cloud_cost_avoided_usd: number;
}

/** Shared 5-authority color/label palette -- mirrors AUTHORITY_LABELS in ProveItWorksTab.tsx.
 *  Not used for any REAL per-AI split today (no per-AI data exists) -- kept here as the single
 *  place a future per-AI Barrel 1/Barrel 2 wiring would pull colors from, so that work never
 *  starts from a blank palette decision. */
export const AUTHORITY_BARREL_COLORS: Record<string, string> = {
  user_google: '#38bdf8',
  user_perplexity: '#a78bfa',
  user_claude: '#facc15',
  user_chatgpt: '#4ade80',
  user_gemini: '#f472b6',
};

export const AUTHORITY_BARREL_LABELS: Record<string, string> = {
  user_google: 'Google',
  user_perplexity: 'Perplexity',
  user_claude: 'Claude',
  user_chatgpt: 'ChatGPT',
  user_gemini: 'Gemini',
};

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
 *   ... climbs by 10x as value keeps growing (5<=v<50 -> 1000, and so on)
 *  Each barrel calls this independently on its OWN total, per spec ("each barrel auto-scales
 *  independently") -- there is no shared/global scale between Barrel 1 and Barrel 2. */
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

/** Barrel 1 (top) -- tokens REMAINING per AI. Vertical-fill liquid metaphor + a spigot that
 *  would "pour" as tokens are used, per the spec's flow metaphor. Renders an explicit, honest
 *  empty state: `layers` is always `[]` today because no engine anywhere in this codebase
 *  tracks a per-AI (or even aggregate) "tokens remaining" number -- see this file's header.
 *  Structured to accept real `layers` the moment that data exists, with zero layout changes. */
export function TokensRemainingBarrel({
  layers, resolution,
}: { layers: BarrelLayer[]; resolution: number }): React.ReactElement {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const total = layers.reduce((s, l) => (hidden.has(l.key) ? s : s + l.value), 0);
  const { denominator } = computeAutoScale(total);
  const hasData = layers.length > 0;

  // Stack visible layers bottom-up as vertical liquid bands (never mixing: each keeps its own
  // color band, like Barrel 2's sand strata, just filled bottom-to-top instead of poured once).
  let cursor = 0;
  const bands = layers
    .filter((l) => !hidden.has(l.key))
    .map((l) => {
      const frac = total > 0 ? l.value / total : 0;
      const fillFrac = denominator > 0 ? Math.min(1, total / denominator) : 0;
      const bandHeight = BARREL_H * fillFrac * frac;
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
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>🛢️ Tokens Remaining</div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          Scale: <b style={{ color: '#94a3b8' }}>out of {denominator}</b>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <svg width={BARREL_W} height={BARREL_H + 24} viewBox={`0 0 ${BARREL_W} ${BARREL_H + 24}`}>
          <clipPath id="barrel1-clip">
            <path d={barrelShellPath(BARREL_W, BARREL_H)} />
          </clipPath>
          <path
            d={barrelShellPath(BARREL_W, BARREL_H)}
            fill="rgba(148,163,184,0.05)"
            stroke="rgba(148,163,184,0.35)"
            strokeWidth={2}
          />
          {hasData && (
            <g clipPath="url(#barrel1-clip)">
              {bands.map((b) => (
                <rect key={b.key} x={0} y={b.y} width={BARREL_W} height={Math.max(0, b.bandHeight)} fill={b.color} opacity={0.85} />
              ))}
            </g>
          )}
          {/* horizontal barrel bands -- decorative chrome only */}
          {[0.33, 0.66].map((f) => (
            <line key={f} x1={0} y1={BARREL_H * f} x2={BARREL_W} y2={BARREL_H * f} stroke="rgba(148,163,184,0.15)" strokeWidth={2} />
          ))}
          {/* spigot */}
          <rect x={BARREL_W / 2 - 4} y={BARREL_H} width={8} height={14} fill="rgba(148,163,184,0.5)" />
          <circle cx={BARREL_W / 2} cy={BARREL_H + 18} r={5} fill="rgba(148,163,184,0.5)" />
          {!hasData && (
            <text x={BARREL_W / 2} y={BARREL_H / 2} textAnchor="middle" fontSize={10} fill="#475569" fontFamily="system-ui, sans-serif">
              no data
            </text>
          )}
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {hasData ? (
            <>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                {formatAutoScale(total, resolution)} remaining
              </div>
              {layers.map((l) => (
                <LegendRow
                  key={l.key}
                  color={l.color}
                  label={l.label}
                  valueText={l.value.toFixed(resolution)}
                  dimmed={hidden.has(l.key)}
                  onToggle={() => setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(l.key)) next.delete(l.key); else next.add(l.key);
                    return next;
                  })}
                />
              ))}
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }}>
              Not yet tracked -- no per-AI (or aggregate) token-remaining counter exists in the
              answer engine today. Honestly empty, not a fabricated number. Flagged to Bishop
              as a data-model gap (BP140-K5 MOVE 3 report).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KN-BP145-M1: vendor usage-ceiling barrel (a different metric from TokensRemainingBarrel) ──

/** Renderer-local mirror of usage_barrel_scraper.ts's VendorUsageWindowReading -- same
 *  duplication convention MeterSummaryForBarrels already uses above for
 *  AnswerCacheMeterSummary (the renderer process cannot import a main-process module directly;
 *  it only ever sees whatever shape crosses the IPC boundary). */
export interface VendorUsageWindowView {
  label: string;
  percentConsumed: number;
  resetText: string;
}

/** Renderer-local mirror of usage_barrel_scraper.ts's UsageBarrelOperationalSnapshot, trimmed to
 *  what this component actually renders. `status` distinguishes "never checked yet"
 *  (`'unknown'`) from "checked and it failed" (`'error'`) from "checked and it worked"
 *  (`'ok'`) -- all three render an honest state, never a fabricated percent. */
export interface VendorUsageBarrelData {
  status: 'unknown' | 'ok' | 'error';
  fiveHour: VendorUsageWindowView | null;
  weeklyAllModels: VendorUsageWindowView | null;
  weeklyModelSpecific: VendorUsageWindowView | null;
  usageCredits: { usedUsd: number; limitUsd: number } | null;
  operationalAnswer: string | null;
  lastCheckedAt: string | null;
  /** Present only when status === 'error' -- the scraper's own failureReason tag, shown verbatim
   *  rather than swallowed, so a stalled scrape is visible as a labeled failure, not silence. */
  failureReason: string | null;
}

/** One percent-fill gauge row -- deliberately NOT the vertical-liquid-fill metaphor
 *  TokensRemainingBarrel uses above, because this data is fundamentally different: a BOUNDED
 *  0-100 percent-of-an-unpublished-allocation with its own reset clock, not an unbounded amount
 *  stacked from multiple layers. A horizontal percent bar is the honest fit for "percent
 *  consumed of something you cannot see the total of." */
function UsageGaugeRow({
  reading, color,
}: { reading: VendorUsageWindowView; color: string }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, reading.percentConsumed));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
        <span>{reading.label}</span>
        <span style={{ color: '#cbd5e1' }}>{pct}% consumed</span>
      </div>
      <div style={{ height: 8, background: 'rgba(148,163,184,0.12)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
        {reading.resetText || 'reset time unknown'}
      </div>
    </div>
  );
}

/** Barrel 1 (top), KN-BP145-M1 realization -- vendor usage ceiling (Anthropic claude.ai plan
 *  limits: rolling 5-hour window + weekly window, each percent-consumed + reset countdown). No
 *  denominator/token count is ever rendered because the vendor never publishes one -- see
 *  usage_barrel_scraper.ts's header. Renders an explicit "not yet checked" or "check failed"
 *  state rather than a fabricated 0%. */
export function VendorUsageBarrel({ data }: { data: VendorUsageBarrelData | null }): React.ReactElement {
  const hasData = !!data && data.status === 'ok' && (data.fiveHour !== null || data.weeklyAllModels !== null);

  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
      padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>🚦 Vendor Usage Ceiling</div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          {data?.lastCheckedAt ? `checked ${new Date(data.lastCheckedAt).toLocaleTimeString()}` : 'never checked'}
        </div>
      </div>
      {hasData ? (
        <>
          {data?.fiveHour && <UsageGaugeRow reading={data.fiveHour} color="#38bdf8" />}
          {data?.weeklyAllModels && <UsageGaugeRow reading={data.weeklyAllModels} color="#facc15" />}
          {data?.weeklyModelSpecific && <UsageGaugeRow reading={data.weeklyModelSpecific} color="#f472b6" />}
          {data?.usageCredits && (
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
              Usage credits: ${data.usageCredits.usedUsd.toFixed(2)} of ${data.usageCredits.limitUsd.toFixed(2)}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.5, borderTop: '1px solid #1e2d45', paddingTop: 6 }}>
            {data?.operationalAnswer || 'No operational answer computed.'}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }}>
          {data?.status === 'error'
            ? `Not yet tracked -- last check failed (${data.failureReason ?? 'unlabeled failure'}). Honestly reported, not a fabricated percent.`
            : 'Not yet checked -- the vendor usage scrape has not run yet in this session.'}
        </div>
      )}
    </div>
  );
}

/** Barrel 2 (below) -- tokens SAVED, color-LAYERED sand strata (never mixing colors), fed by
 *  getAnswerCacheMeterSummary() -> cloud_cost_avoided_usd. Per the boundary check, that field is
 *  aggregate-only, so this renders exactly ONE real stratum ("All authorities (aggregate)")
 *  rather than fabricating a per-AI split the engine cannot back up. */
export function TokensSavedBarrel({
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
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>🏜️ Tokens Saved (cumulative)</div>
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

export interface TwoBarrelMeterProps {
  meter: MeterSummaryForBarrels | null;
  loading: boolean;
  onRefresh: () => void;
  /** KN-BP145-M1: optional so ProveItWorksTab.tsx (not owned by this ticket) keeps compiling
   *  unchanged with zero edits until a future ticket wires the real IPC call and passes this
   *  down. Undefined/null both render the same honest "not yet checked" state as an explicit
   *  `{ status: 'unknown', ... }` object would. */
  vendorUsage?: VendorUsageBarrelData | null;
}

// KN-BP143-3 D3 (Founder amendment): Barrel 1 has no data source anywhere in the engine, so its
// render is suppressed here -- but per the Founder's explicit instruction, TokensRemainingBarrel
// itself, its props, and this call site are NOT deleted, only gated off, so the Coupon Clipper's
// price-aware routing/savings work can flip this to `true` (with real `layers`, not `[]`) and get
// a working barrel with zero rebuild. See
// SPEC_THE_COUPON_CLIPPER_PRICE_AWARE_ROUTING_AND_SAVINGS_METER_BP143.md.
const SHOW_TOKENS_REMAINING_BARREL = false;

// KN-BP145-M1: same D3 precedent, same reasoning, different barrel. VendorUsageBarrel's design
// and scrape module (usage_barrel_scraper.ts) are real and callable today, but the IPC round trip
// that would give this component a real `vendorUsage` prop is not built by this ticket (see the
// header note above and the KN-BP145-M1 report) -- so this stays `false` until a future ticket
// wires preload.ts + index.ts + ProveItWorksTab.tsx and flips it, rather than showing the Founder
// a permanently-"not yet checked" box every day.
const SHOW_VENDOR_USAGE_BARREL = false;

/** Composite "Two Barrels" panel -- replaces the old single "The Meter" block. Barrel 1 sits on
 *  top of Barrel 2 with a small funnel glyph between them illustrating the spec's flow metaphor
 *  (a query's pour from Barrel 1 is either SPENT, or caught by the Substrate funnel into Barrel
 *  2 as a SAVING). The funnel is static chrome today since Barrel 1 has no live flow to animate
 *  (see the per-file header) -- it will start reflecting a real flow the moment Barrel 1 gets a
 *  data source. Both Barrel 1 and the funnel are gated by SHOW_TOKENS_REMAINING_BARREL above:
 *  the funnel visually depends on a filled Barrel 1 pouring into it, so it is suppressed
 *  alongside it rather than left dangling above Barrel 2 with nothing to catch. */
export function TwoBarrelMeter({ meter, loading, onRefresh, vendorUsage }: TwoBarrelMeterProps): React.ReactElement {
  const [resolution, setResolution] = useState(3);

  return (
    <div style={{
      marginTop: 16, padding: 12, backgroundColor: 'rgba(148, 163, 184, 0.06)',
      border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Two Barrels</div>
          <div style={{ fontSize: 10, color: '#606060', marginTop: 2 }}>
            Replaces "The Meter" -- real counters only, per-AI attribution pending an engine
            data-model decision (see gap notes below each barrel).
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

      {SHOW_VENDOR_USAGE_BARREL && (
        <VendorUsageBarrel data={vendorUsage ?? null} />
      )}

      {SHOW_TOKENS_REMAINING_BARREL && (
        <>
          <TokensRemainingBarrel layers={[]} resolution={resolution} />

          <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0 4px' }}>
            <span style={{ fontSize: 16, color: '#475569' }} title="Substrate funnel -- catches a query that would have been SPENT and routes it into Barrel 2 as a SAVING instead">
              🔻 substrate funnel
            </span>
          </div>
        </>
      )}

      <TokensSavedBarrel meter={meter} resolution={resolution} />
    </div>
  );
}
