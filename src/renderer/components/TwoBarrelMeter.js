import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
// labeled block.
//
// KN-BP147-M4 ADDITION ("UNBARREL THE BARRELS"): the IPC round trip is now real and live --
// preload.ts exposes window.amplify.getVendorUsageBarrelSnapshot() (wraps the new
// 'usage-barrel-get-vendor-usage' channel), index.ts's registerIPCHandlers() IPC-HANDLER append
// zone registers the handler that calls computeUsageBarrelOperationalSnapshot() (which itself
// calls scrapeVendorUsagePanel() -- see that file's header; both untouched, READ-ONLY to this
// ticket) and shapes the result into exactly the VendorUsageBarrelData shape below. THIS file
// (the sole file this ticket owns) now calls that bridge itself -- see useVendorUsageBarrelData()
// below -- rather than requiring ProveItWorksTab.tsx (not owned by this ticket) to be edited to
// pass a `vendorUsage` prop down. The `vendorUsage` prop stays in TwoBarrelMeterProps as an
// optional EXPLICIT override: passing it skips the internal self-fetch entirely, so a future
// caller that wants to own the fetch itself (e.g. to share one poll across multiple mounted
// meters) still can, with zero changes here. SHOW_VENDOR_USAGE_BARREL below is now `true` -- the
// box the Founder sees renders real data (or an honest failure/unknown state; this module never
// fabricates a percent, per usage_barrel_scraper.ts's own honesty firewall).
import React, { useCallback, useEffect, useState } from 'react';
/** Shared 5-authority color/label palette -- mirrors AUTHORITY_LABELS in ProveItWorksTab.tsx.
 *  Not used for any REAL per-AI split today (no per-AI data exists) -- kept here as the single
 *  place a future per-AI Barrel 1/Barrel 2 wiring would pull colors from, so that work never
 *  starts from a blank palette decision. */
export const AUTHORITY_BARREL_COLORS = {
    user_google: '#38bdf8',
    user_perplexity: '#a78bfa',
    user_claude: '#facc15',
    user_chatgpt: '#4ade80',
    user_gemini: '#f472b6',
};
export const AUTHORITY_BARREL_LABELS = {
    user_google: 'Google',
    user_perplexity: 'Perplexity',
    user_claude: 'Claude',
    user_chatgpt: 'ChatGPT',
    user_gemini: 'Gemini',
};
/** RELATIVE AUTO-SCALE -- Founder spec, implemented exactly:
 *   value <  0.05                -> denominator 1    ("out of 1")
 *   0.05 <= value < 0.5          -> denominator 10   ("out of 10")
 *   0.5  <= value < 5            -> denominator 100  ("out of 100")
 *   ... climbs by 10x as value keeps growing (5<=v<50 -> 1000, and so on)
 *  Each barrel calls this independently on its OWN total, per spec ("each barrel auto-scales
 *  independently") -- there is no shared/global scale between Barrel 1 and Barrel 2. */
export function computeAutoScale(value) {
    const v = Math.abs(value);
    let tier = 0;
    // Boundary_i = 0.05 * 10^i (0.05, 0.5, 5, 50, ...); denominator_i = 10^i (1, 10, 100, ...).
    // Capped at tier 12 (denominator 10^12) purely as a runaway guard -- no realistic cost-avoided
    // or token count in this app approaches that magnitude.
    while (tier < 12 && v >= 0.05 * Math.pow(10, tier))
        tier += 1;
    return { tier, denominator: Math.pow(10, tier) };
}
/** "X.XXX out of N" -- the exact display convention from the Founder spec, at a caller-chosen
 *  (user-overridable, default 3) decimal resolution. */
export function formatAutoScale(value, resolution) {
    const { denominator } = computeAutoScale(value);
    return `${value.toFixed(Math.max(0, resolution))} out of ${denominator}`;
}
function barrelShellPath(width, height) {
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
function LegendRow({ color, label, valueText, dimmed, onToggle, }) {
    return (_jsxs("button", { type: "button", onClick: onToggle, title: dimmed ? `Show ${label}` : `Hide ${label}`, style: {
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
            opacity: dimmed ? 0.4 : 1, textAlign: 'left', fontFamily: 'system-ui, sans-serif',
        }, children: [_jsx("span", { style: {
                    width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.25)',
                } }), _jsx("span", { style: { fontSize: 11, color: '#cbd5e1', flexShrink: 0 }, children: label }), _jsx("span", { style: { fontSize: 10, color: '#64748b', marginLeft: 'auto' }, children: valueText })] }));
}
/** Barrel 1 (top) -- tokens REMAINING per AI. Vertical-fill liquid metaphor + a spigot that
 *  would "pour" as tokens are used, per the spec's flow metaphor. Renders an explicit, honest
 *  empty state: `layers` is always `[]` today because no engine anywhere in this codebase
 *  tracks a per-AI (or even aggregate) "tokens remaining" number -- see this file's header.
 *  Structured to accept real `layers` the moment that data exists, with zero layout changes. */
export function TokensRemainingBarrel({ layers, resolution, }) {
    const [hidden, setHidden] = useState(new Set());
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
    return (_jsxs("div", { style: {
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
            padding: '12px 14px', marginBottom: 8,
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0' }, children: "\uD83D\uDEE2\uFE0F Tokens Remaining" }), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: ["Scale: ", _jsxs("b", { style: { color: '#94a3b8' }, children: ["out of ", denominator] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 14 }, children: [_jsxs("svg", { width: BARREL_W, height: BARREL_H + 24, viewBox: `0 0 ${BARREL_W} ${BARREL_H + 24}`, children: [_jsx("clipPath", { id: "barrel1-clip", children: _jsx("path", { d: barrelShellPath(BARREL_W, BARREL_H) }) }), _jsx("path", { d: barrelShellPath(BARREL_W, BARREL_H), fill: "rgba(148,163,184,0.05)", stroke: "rgba(148,163,184,0.35)", strokeWidth: 2 }), hasData && (_jsx("g", { clipPath: "url(#barrel1-clip)", children: bands.map((b) => (_jsx("rect", { x: 0, y: b.y, width: BARREL_W, height: Math.max(0, b.bandHeight), fill: b.color, opacity: 0.85 }, b.key))) })), [0.33, 0.66].map((f) => (_jsx("line", { x1: 0, y1: BARREL_H * f, x2: BARREL_W, y2: BARREL_H * f, stroke: "rgba(148,163,184,0.15)", strokeWidth: 2 }, f))), _jsx("rect", { x: BARREL_W / 2 - 4, y: BARREL_H, width: 8, height: 14, fill: "rgba(148,163,184,0.5)" }), _jsx("circle", { cx: BARREL_W / 2, cy: BARREL_H + 18, r: 5, fill: "rgba(148,163,184,0.5)" }), !hasData && (_jsx("text", { x: BARREL_W / 2, y: BARREL_H / 2, textAnchor: "middle", fontSize: 10, fill: "#475569", fontFamily: "system-ui, sans-serif", children: "no data" }))] }), _jsx("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }, children: hasData ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 6 }, children: [formatAutoScale(total, resolution), " remaining"] }), layers.map((l) => (_jsx(LegendRow, { color: l.color, label: l.label, valueText: l.value.toFixed(resolution), dimmed: hidden.has(l.key), onToggle: () => setHidden((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(l.key))
                                            next.delete(l.key);
                                        else
                                            next.add(l.key);
                                        return next;
                                    }) }, l.key)))] })) : (_jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }, children: "Not yet tracked -- no per-AI (or aggregate) token-remaining counter exists in the answer engine today. Honestly empty, not a fabricated number. Flagged to Bishop as a data-model gap (BP140-K5 MOVE 3 report)." })) })] })] }));
}
/** One percent-fill gauge row -- deliberately NOT the vertical-liquid-fill metaphor
 *  TokensRemainingBarrel uses above, because this data is fundamentally different: a BOUNDED
 *  0-100 percent-of-an-unpublished-allocation with its own reset clock, not an unbounded amount
 *  stacked from multiple layers. A horizontal percent bar is the honest fit for "percent
 *  consumed of something you cannot see the total of." */
function UsageGaugeRow({ reading, color, }) {
    const pct = Math.max(0, Math.min(100, reading.percentConsumed));
    return (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 2 }, children: [_jsx("span", { children: reading.label }), _jsxs("span", { style: { color: '#cbd5e1' }, children: [pct, "% consumed"] })] }), _jsx("div", { style: { height: 8, background: 'rgba(148,163,184,0.12)', borderRadius: 4, overflow: 'hidden' }, children: _jsx("div", { style: { width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s ease' } }) }), _jsx("div", { style: { fontSize: 9, color: '#64748b', marginTop: 2 }, children: reading.resetText || 'reset time unknown' })] }));
}
/** Barrel 1 (top), KN-BP145-M1 realization -- vendor usage ceiling (Anthropic claude.ai plan
 *  limits: rolling 5-hour window + weekly window, each percent-consumed + reset countdown). No
 *  denominator/token count is ever rendered because the vendor never publishes one -- see
 *  usage_barrel_scraper.ts's header. Renders an explicit "not yet checked" or "check failed"
 *  state rather than a fabricated 0%. */
export function VendorUsageBarrel({ data }) {
    const hasData = !!data && data.status === 'ok' && (data.fiveHour !== null || data.weeklyAllModels !== null);
    return (_jsxs("div", { style: {
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
            padding: '12px 14px', marginBottom: 8,
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0' }, children: "\uD83D\uDEA6 Vendor Usage Ceiling" }), _jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: data?.lastCheckedAt ? `checked ${new Date(data.lastCheckedAt).toLocaleTimeString()}` : 'never checked' })] }), hasData ? (_jsxs(_Fragment, { children: [data?.fiveHour && _jsx(UsageGaugeRow, { reading: data.fiveHour, color: "#38bdf8" }), data?.weeklyAllModels && _jsx(UsageGaugeRow, { reading: data.weeklyAllModels, color: "#facc15" }), data?.weeklyModelSpecific && _jsx(UsageGaugeRow, { reading: data.weeklyModelSpecific, color: "#f472b6" }), data?.usageCredits && (_jsxs("div", { style: { fontSize: 10, color: '#94a3b8', marginBottom: 6 }, children: ["Usage credits: $", data.usageCredits.usedUsd.toFixed(2), " of $", data.usageCredits.limitUsd.toFixed(2)] })), _jsx("div", { style: { fontSize: 10, color: '#cbd5e1', lineHeight: 1.5, borderTop: '1px solid #1e2d45', paddingTop: 6 }, children: data?.operationalAnswer || 'No operational answer computed.' })] })) : (_jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }, children: data?.status === 'error'
                    ? `Not yet tracked -- last check failed (${data.failureReason ?? 'unlabeled failure'}). Honestly reported, not a fabricated percent.`
                    : 'Not yet checked -- the vendor usage scrape has not run yet in this session.' }))] }));
}
/** Barrel 2 (below) -- tokens SAVED, color-LAYERED sand strata (never mixing colors), fed by
 *  getAnswerCacheMeterSummary() -> cloud_cost_avoided_usd. Per the boundary check, that field is
 *  aggregate-only, so this renders exactly ONE real stratum ("All authorities (aggregate)")
 *  rather than fabricating a per-AI split the engine cannot back up. */
export function TokensSavedBarrel({ meter, resolution, }) {
    const [hidden, setHidden] = useState(new Set());
    const aggregateValue = meter?.cloud_cost_avoided_usd ?? 0;
    const hasData = (meter?.total_queries ?? 0) > 0;
    const layers = hasData
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
    return (_jsxs("div", { style: {
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
            padding: '12px 14px', marginBottom: 8,
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0' }, children: "\uD83C\uDFDC\uFE0F Tokens Saved (cumulative)" }), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: ["Scale: ", _jsxs("b", { style: { color: '#94a3b8' }, children: ["out of ", denominator] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 14 }, children: [_jsxs("svg", { width: BARREL_W, height: BARREL_H, viewBox: `0 0 ${BARREL_W} ${BARREL_H}`, children: [_jsxs("defs", { children: [_jsxs("pattern", { id: "sand-hatch", width: 6, height: 6, patternTransform: "rotate(45)", patternUnits: "userSpaceOnUse", children: [_jsx("rect", { width: 6, height: 6, fill: "transparent" }), _jsx("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(0,0,0,0.15)", strokeWidth: 2 })] }), _jsx("clipPath", { id: "barrel2-clip", children: _jsx("path", { d: barrelShellPath(BARREL_W, BARREL_H) }) })] }), _jsx("path", { d: barrelShellPath(BARREL_W, BARREL_H), fill: "rgba(148,163,184,0.05)", stroke: "rgba(148,163,184,0.35)", strokeWidth: 2 }), hasData && (_jsx("g", { clipPath: "url(#barrel2-clip)", children: bands.map((b) => (_jsxs(React.Fragment, { children: [_jsx("rect", { x: 0, y: b.y, width: BARREL_W, height: Math.max(0, b.bandHeight), fill: b.color, opacity: 0.9 }), _jsx("rect", { x: 0, y: b.y, width: BARREL_W, height: Math.max(0, b.bandHeight), fill: "url(#sand-hatch)" })] }, b.key))) })), [0.33, 0.66].map((f) => (_jsx("line", { x1: 0, y1: BARREL_H * f, x2: BARREL_W, y2: BARREL_H * f, stroke: "rgba(148,163,184,0.15)", strokeWidth: 2 }, f))), !hasData && (_jsx("text", { x: BARREL_W / 2, y: BARREL_H / 2, textAnchor: "middle", fontSize: 10, fill: "#475569", fontFamily: "system-ui, sans-serif", children: "no queries yet" }))] }), _jsx("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }, children: hasData ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 6 }, children: ["$", formatAutoScale(aggregateValue, resolution), _jsx("span", { style: { color: '#475569', fontSize: 9 }, children: " (estimate -- not a guarantee)" })] }), layers.map((l) => (_jsx(LegendRow, { color: l.color, label: l.label, valueText: `$${l.value.toFixed(resolution)}`, dimmed: hidden.has(l.key), onToggle: () => setHidden((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(l.key))
                                            next.delete(l.key);
                                        else
                                            next.add(l.key);
                                        return next;
                                    }) }, l.key))), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 6, lineHeight: 1.5 }, children: "Single aggregate stratum -- the answer engine does not yet attribute avoided cost to a specific authority/AI. Per-AI strata activate automatically once getAnswerCacheMeterSummary() exposes that breakdown (data-model gap, flagged to Bishop)." })] })) : (_jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }, children: "No queries recorded yet. Ask a question, then come back and refresh." })) })] })] }));
}
/** KN-BP147-M4: the real call site. Calls the new
 *  `window.amplify.getVendorUsageBarrelSnapshot()` contextBridge export (preload.ts) on mount,
 *  which round-trips to index.ts's 'usage-barrel-get-vendor-usage' ipcMain handler and, through
 *  it, the real usage_barrel_scraper.ts. Returns the fetched data plus a manual `refresh()` and
 *  an honest `loading` flag. Every exit path -- bridge missing (e.g. a non-Electron test
 *  harness), the invoke rejecting, or a successful-but-failed scrape -- resolves to an explicit
 *  `status: 'error'` object with a labeled `failureReason`, never a fabricated percent standing
 *  in for "I don't actually know." */
function useVendorUsageBarrelData(enabled) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchOnce = useCallback(() => {
        const bridge = typeof window !== 'undefined' ? window.amplify : undefined;
        if (!bridge?.getVendorUsageBarrelSnapshot) {
            setData({
                status: 'error',
                fiveHour: null,
                weeklyAllModels: null,
                weeklyModelSpecific: null,
                usageCredits: null,
                operationalAnswer: null,
                lastCheckedAt: null,
                failureReason: 'ipc-bridge-unavailable',
            });
            return;
        }
        setLoading(true);
        bridge
            .getVendorUsageBarrelSnapshot()
            .then((result) => setData(result))
            .catch((err) => setData({
            status: 'error',
            fiveHour: null,
            weeklyAllModels: null,
            weeklyModelSpecific: null,
            usageCredits: null,
            operationalAnswer: null,
            lastCheckedAt: null,
            failureReason: `renderer-invoke-rejected:${err instanceof Error ? err.message : String(err)}`,
        }))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        if (enabled)
            fetchOnce();
        // Fetch once on mount (and whenever `enabled` flips on) -- no polling interval added here,
        // matching Barrel 2's own click-to-refresh convention rather than inventing a new one.
    }, [enabled, fetchOnce]);
    return { data, loading, refresh: fetchOnce };
}
// KN-BP143-3 D3 (Founder amendment): Barrel 1 has no data source anywhere in the engine, so its
// render is suppressed here -- but per the Founder's explicit instruction, TokensRemainingBarrel
// itself, its props, and this call site are NOT deleted, only gated off, so the Coupon Clipper's
// price-aware routing/savings work can flip this to `true` (with real `layers`, not `[]`) and get
// a working barrel with zero rebuild. See
// SPEC_THE_COUPON_CLIPPER_PRICE_AWARE_ROUTING_AND_SAVINGS_METER_BP143.md.
const SHOW_TOKENS_REMAINING_BARREL = false;
// KN-BP145-M1 built the design; KN-BP147-M4 wired it live (see the header note above) -- the IPC
// round trip is real now (preload.ts + index.ts's IPC-HANDLER append zone + this file's own
// useVendorUsageBarrelData() self-fetch), so this flips to `true`. The box the Founder sees now
// renders real vendor-account usage or an honest failure/unknown state, never a fabricated one.
const SHOW_VENDOR_USAGE_BARREL = true;
/** Composite "Two Barrels" panel -- replaces the old single "The Meter" block. Barrel 1 sits on
 *  top of Barrel 2 with a small funnel glyph between them illustrating the spec's flow metaphor
 *  (a query's pour from Barrel 1 is either SPENT, or caught by the Substrate funnel into Barrel
 *  2 as a SAVING). The funnel is static chrome today since Barrel 1 has no live flow to animate
 *  (see the per-file header) -- it will start reflecting a real flow the moment Barrel 1 gets a
 *  data source. Both Barrel 1 and the funnel are gated by SHOW_TOKENS_REMAINING_BARREL above:
 *  the funnel visually depends on a filled Barrel 1 pouring into it, so it is suppressed
 *  alongside it rather than left dangling above Barrel 2 with nothing to catch. */
export function TwoBarrelMeter({ meter, loading, onRefresh, vendorUsage }) {
    const [resolution, setResolution] = useState(3);
    // KN-BP147-M4: self-fetch is enabled exactly when the caller did not pass an explicit
    // `vendorUsage` override (see TwoBarrelMeterProps's doc comment) -- ProveItWorksTab.tsx today
    // passes none, so this is always the active path in the shipping app right now.
    const selfFetchEnabled = vendorUsage === undefined;
    const selfFetched = useVendorUsageBarrelData(selfFetchEnabled);
    const effectiveVendorUsage = selfFetchEnabled ? selfFetched.data : (vendorUsage ?? null);
    const vendorUsageLoading = selfFetchEnabled && selfFetched.loading;
    return (_jsxs("div", { style: {
            marginTop: 16, padding: 12, backgroundColor: 'rgba(148, 163, 184, 0.06)',
            border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 6,
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: "Two Barrels" }), _jsx("div", { style: { fontSize: 10, color: '#606060', marginTop: 2 }, children: "Replaces \"The Meter\" -- real counters only, per-AI attribution pending an engine data-model decision (see gap notes below each barrel)." })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsxs("label", { style: { fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }, children: ["Decimals:", _jsx("input", { type: "number", min: 0, max: 6, value: resolution, onChange: (e) => {
                                            const v = parseInt(e.target.value, 10);
                                            if (!Number.isNaN(v) && v >= 0 && v <= 6)
                                                setResolution(v);
                                        }, style: {
                                            width: 36, background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 4,
                                            color: '#e2e8f0', fontSize: 10, padding: '2px 4px',
                                        } })] }), _jsx("button", { type: "button", onClick: () => {
                                    onRefresh();
                                    // KN-BP147-M4: the same Refresh button also re-triggers the vendor-usage
                                    // self-fetch when this component owns that fetch (see selfFetchEnabled above) --
                                    // one button, both barrels, rather than a second refresh control.
                                    if (selfFetchEnabled)
                                        selfFetched.refresh();
                                }, disabled: loading || vendorUsageLoading, title: "Refresh", style: {
                                    background: 'none', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 4,
                                    color: '#94a3b8', fontSize: 11, padding: '2px 8px',
                                    cursor: (loading || vendorUsageLoading) ? 'wait' : 'pointer',
                                }, children: (loading || vendorUsageLoading) ? '…' : '↻ Refresh' })] })] }), SHOW_VENDOR_USAGE_BARREL && (_jsx(VendorUsageBarrel, { data: effectiveVendorUsage })), SHOW_TOKENS_REMAINING_BARREL && (_jsxs(_Fragment, { children: [_jsx(TokensRemainingBarrel, { layers: [], resolution: resolution }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', margin: '-2px 0 4px' }, children: _jsx("span", { style: { fontSize: 16, color: '#475569' }, title: "Substrate funnel -- catches a query that would have been SPENT and routes it into Barrel 2 as a SAVING instead", children: "\uD83D\uDD3B substrate funnel" }) })] })), _jsx(TokensSavedBarrel, { meter: meter, resolution: resolution })] }));
}
