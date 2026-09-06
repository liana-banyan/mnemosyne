import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC · KN-BP143-3 D5 (amended, scoped to real data) · 2026-08-03
// §2 Truth-Always · Founder-ratified
//
// AskEngineView — per-message "live engine view" for the Ask tab (LeanAskTab.tsx).
// Renders a color-coded terminal-style panel that mirrors the REAL token feed for one
// assistant message (cold-start heartbeat → streaming assembled text → final content),
// plus a strip of badges that pop in OUTSIDE the terminal as each real completion/nexus
// field actually arrives. Every terminal line and every badge carries a stable, unique,
// semantic `data-stage-id` (see STAGE IDS below) so each is individually addressable.
//
// HARD CONSTRAINT (Truth-Always, restated per this Yoke): no placeholder stages, no
// simulated progress, no spinner pretending to be work. Every field rendered here is read
// directly off real IPC payloads (onAskTokenProgress / onAskTokenComplete / nexusAskLookupFact)
// that LeanAskTab.tsx already receives — this component fabricates nothing and invents no
// additional stages beyond what those real events actually carry. If a field is absent,
// undefined, null, or false-in-a-non-meaningful-way, nothing renders for it.
//
// KN-BP144-8 Phase 1 (2026-08-04) AMENDMENT: the line above was true when D5 landed -- Ask
// did not go through canonical_pipeline.ts at all. It now does, via the NEW
// window.amplify.aiDispatch.queryEngine channel (ai-dispatch:query-engine, separate from the
// plain-chat `query` channel this file's badges above were originally built for). The new
// `stages`/`receipt` fields on AskEngineState below carry that path's real substrate-tier /
// concordance / specialist-outcome / abstain data -- additive, never touching a single
// existing field or stage id above, and absent entirely on a plain-chat turn.
//
// STAGE IDS (React keys + data-stage-id, per this Yoke's addressability requirement):
//   cold-start                         — badge, only when this turn's coldStart flag fired
//   token-stream                       — the terminal's live/frozen assembled-text line
//   completion:served-from-substrate   — badge, only when servedFromSubstrate === true
//   completion:provenance              — badge, only when provenance is a non-empty string
//   completion:verified                — badge, only when verified === true
//   completion:cost                    — badge, only when cost_usd is a real number
//   completion:latency                 — badge, only when latency_ms is a real number
//   completion:hot-hits                — badge, only when hotHits > 0
//   completion:self-context            — badge, only when selfContextLoaded === true
//   nexus:authority                    — badge, only when the Nexus browser-authority
//                                         short-circuit actually fired and resolved usable
//   engine-view:toggle / engine-view:collapsed — the expand/collapse control itself
//   engine:specialist:<name>           — KN-BP144-8 Phase 1: one live-status row per specialist
//                                         the free-text engine's roster includes for this turn
//   engine:substrate-tier               — badge, only when receipt.servedFromSubstrate === true
//   engine:concordance                  — badge, only when receipt.concordance is present
//   engine:bmv                          — badge, only when receipt.bmvScore is a real number
//   engine:andon                        — badge, only when receipt.andonTriggered === true
//   engine:abstained                    — the abstention banner, only when receipt.abstained
import { useState } from 'react';
// ─── Formatting helpers ───────────────────────────────────────────────────────────────────
function formatCost(v) {
    return `$${v.toFixed(4)}`;
}
function formatLatency(v) {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}
function formatConfidence(v) {
    return `${Math.round(v * 100)}%`;
}
// ─── Badge pill ───────────────────────────────────────────────────────────────────────────
function Pill({ stageId, color, children }) {
    return (_jsx("span", { "data-stage-id": stageId, style: {
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 4,
            background: `${color}22`,
            border: `1px solid ${color}`,
            color,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
        }, children: children }));
}
export function AskEngineView({ messageId, liveText, engine, onOpenExternal }) {
    const [expanded, setExpanded] = useState(true);
    const completion = engine?.completion;
    const nexus = engine?.nexus;
    const receipt = engine?.receipt;
    const stages = engine?.stages;
    const done = Boolean(completion) || Boolean(nexus) || Boolean(receipt);
    const coldStart = Boolean(engine?.coldStart);
    const substrateChecking = Boolean(engine?.substrateChecking) && !done;
    const streaming = (Boolean(engine?.streaming) || Boolean(stages && stages.length > 0)) && !done;
    let phaseLabel = 'waiting';
    let phaseColor = '#64748b';
    if (done) {
        phaseLabel = receipt?.abstained ? 'abstained' : 'complete';
        phaseColor = receipt?.abstained ? '#f87171' : '#38bdf8';
    }
    else if (substrateChecking) {
        phaseLabel = 'checking substrate';
        phaseColor = '#a78bfa';
    }
    else if (streaming) {
        phaseLabel = 'streaming';
        phaseColor = '#34d399';
    }
    else if (coldStart) {
        phaseLabel = 'cold-start';
        phaseColor = '#f59e0b';
    }
    const badges = [];
    if (coldStart) {
        badges.push({ stageId: 'cold-start', color: '#f59e0b', node: _jsx(_Fragment, { children: "\u2744 Cold start" }) });
    }
    if (completion) {
        if (completion.servedFromSubstrate === true) {
            badges.push({ stageId: 'completion:served-from-substrate', color: '#10b981', node: _jsx(_Fragment, { children: "\uD83C\uDFAF Served free (substrate)" }) });
        }
        if (completion.provenance) {
            badges.push({ stageId: 'completion:provenance', color: '#94a3b8', node: _jsxs(_Fragment, { children: ["Provenance: ", completion.provenance] }) });
        }
        if (completion.verified === true) {
            badges.push({ stageId: 'completion:verified', color: '#6ee7b7', node: _jsx(_Fragment, { children: "\u2713 Verified / corroborated" }) });
        }
        if (typeof completion.cost_usd === 'number' && !Number.isNaN(completion.cost_usd)) {
            badges.push({ stageId: 'completion:cost', color: '#a78bfa', node: _jsxs(_Fragment, { children: ["\uD83D\uDCB0 ", formatCost(completion.cost_usd)] }) });
        }
        if (typeof completion.latency_ms === 'number' && !Number.isNaN(completion.latency_ms)) {
            badges.push({ stageId: 'completion:latency', color: '#60a5fa', node: _jsxs(_Fragment, { children: ["\u23F1 ", formatLatency(completion.latency_ms)] }) });
        }
        if (typeof completion.hotHits === 'number' && completion.hotHits > 0) {
            badges.push({ stageId: 'completion:hot-hits', color: '#fbbf24', node: _jsxs(_Fragment, { children: ["\uD83D\uDD25 ", completion.hotHits, " hot hit", completion.hotHits === 1 ? '' : 's'] }) });
        }
        if (completion.selfContextLoaded === true) {
            badges.push({ stageId: 'completion:self-context', color: '#6ee7b7', node: _jsx(_Fragment, { children: "\uD83E\uDDE0 Self-Context loaded" }) });
        }
    }
    if (receipt) {
        if (receipt.servedFromSubstrate === true) {
            badges.push({
                stageId: 'engine:substrate-tier',
                color: '#10b981',
                node: _jsxs(_Fragment, { children: ["\uD83C\uDFAF Substrate hit \u2014 ROOTED (", receipt.substrateTier ?? 'unknown tier', ")"] }),
            });
        }
        if (receipt.concordance) {
            const concordanceColor = receipt.concordance === 'CONCORDANT' ? '#6ee7b7'
                : receipt.concordance === 'PARTIAL' ? '#fbbf24' : '#f87171';
            badges.push({ stageId: 'engine:concordance', color: concordanceColor, node: _jsxs(_Fragment, { children: ["\u2696 ", receipt.concordance] }) });
        }
        if (typeof receipt.bmvScore === 'number' && !Number.isNaN(receipt.bmvScore)) {
            badges.push({ stageId: 'engine:bmv', color: '#a78bfa', node: _jsxs(_Fragment, { children: ["BMV ", receipt.bmvScore] }) });
        }
        if (receipt.andonTriggered === true) {
            badges.push({
                stageId: 'engine:andon',
                color: '#fbbf24',
                node: _jsxs(_Fragment, { children: ["\uD83D\uDD01 Andon retried (", receipt.andonRetries ?? 0, "x)"] }),
            });
        }
        if (typeof receipt.ebletsWritten === 'number' && receipt.ebletsWritten > 0) {
            badges.push({ stageId: 'engine:eblets-written', color: '#6ee7b7', node: _jsxs(_Fragment, { children: ["+", receipt.ebletsWritten, " eblet", receipt.ebletsWritten === 1 ? '' : 's', " written"] }) });
        }
    }
    if (nexus) {
        badges.push({
            stageId: 'nexus:authority',
            color: '#c4b5fd',
            node: (_jsxs(_Fragment, { children: ["\uD83D\uDD17 ", nexus.authority === 'user_perplexity' ? 'Perplexity' : 'Google', " (your session)", typeof nexus.confidence === 'number' && _jsxs(_Fragment, { children: [" \u00B7 ", formatConfidence(nexus.confidence)] }), ' · ', _jsx("a", { href: nexus.sourceUrl, onClick: (e) => { e.preventDefault(); onOpenExternal?.(nexus.sourceUrl); }, style: { color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }, children: "source" })] })),
        });
    }
    if (!expanded) {
        return (_jsx("div", { style: { marginTop: 6 }, "data-message-id": messageId, children: _jsxs("button", { type: "button", "data-stage-id": "engine-view:collapsed", onClick: () => setExpanded(true), style: {
                    background: 'none',
                    border: '1px solid #1e2a38',
                    borderRadius: 5,
                    color: '#64748b',
                    fontSize: 10,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                    outline: 'none',
                }, children: ["\u25B6 Engine View", badges.length > 0 ? ` (${badges.length})` : ''] }) }));
    }
    return (_jsxs("div", { style: { marginTop: 6, maxWidth: '78%' }, "data-message-id": messageId, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: 0.4 }, children: "ENGINE VIEW" }), _jsx("button", { type: "button", "data-stage-id": "engine-view:toggle", onClick: () => setExpanded(false), style: {
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: 10,
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'system-ui, sans-serif',
                            outline: 'none',
                        }, children: "\u25B2 collapse" })] }), _jsxs("div", { "data-stage-id": "token-stream", style: {
                    background: '#05070a',
                    border: '1px solid #1e2a38',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontFamily: "'SF Mono', 'Cascadia Code', Consolas, monospace",
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 220,
                    overflowY: 'auto',
                }, children: [_jsxs("span", { style: { color: phaseColor, fontWeight: 700 }, children: ["[", phaseLabel, "]"] }), ' ', _jsx("span", { style: { color: done ? '#94a3b8' : phaseColor }, children: liveText }), !done && _jsx("span", { style: { opacity: 0.6, color: phaseColor }, children: "\u258B" })] }), receipt?.abstained === true && (_jsxs("div", { "data-stage-id": "engine:abstained", style: {
                    marginTop: 6,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.35)',
                    color: '#fca5a5',
                    fontSize: 11,
                }, children: ["\u26A0 The engine could not produce an honest answer to this question.", receipt.abstainReason ? _jsxs(_Fragment, { children: [" ", receipt.abstainReason] }) : null] })), stages && stages.length > 0 && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }, children: stages.map((s) => {
                    const dot = s.status === 'done' ? (s.candidateCount && s.candidateCount > 0 ? '🟢' : '⚪')
                        : s.status === 'firing' ? '◌' : '⚪';
                    const color = s.status === 'done'
                        ? (s.candidateCount && s.candidateCount > 0 ? '#6ee7b7' : '#64748b')
                        : s.status === 'firing' ? '#fbbf24' : '#334155';
                    return (_jsxs("div", { "data-stage-id": `engine:specialist:${s.name}`, style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 10.5,
                            color,
                            padding: '2px 4px',
                        }, children: [_jsxs("span", { children: [dot, " ", s.name] }), _jsxs("span", { children: [s.status === 'pending' && 'pending', s.status === 'firing' && 'firing…', s.status === 'done' && `${s.candidateCount ?? 0} candidate${s.candidateCount === 1 ? '' : 's'}`] })] }, s.name));
                }) })), badges.length > 0 && (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: badges.map((b) => (_jsx(Pill, { stageId: b.stageId, color: b.color, children: b.node }, b.stageId))) }))] }));
}
