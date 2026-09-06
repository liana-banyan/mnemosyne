import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// AMPLIFY Dashboard — B37 Phase 4 + Phase 7
// Full telemetry: real-time session + historical (today/week/month) + daily bar chart + share card
// Phase 3 retained: mode switcher, force-mode settings, federation panel
// Phase 7: Auth state, member badge, trial info, sign-out
import { useEffect, useState, useCallback } from 'react';
import { ShareCard } from './ShareCard';
import { NotCentsGlyph } from './NotCentsGlyph';
// ─── Helpers ──────────────────────────────────────────────────────────────────
const MODES = [
    { id: 'ai_burst', icon: '🔥', label: 'AI Burst', desc: 'Substrate + Ollama + cloud' },
    { id: 'normal', icon: '🌿', label: 'Normal', desc: 'Substrate-only, no AI cost' },
    { id: 'fallback', icon: '🌑', label: 'Fallback', desc: 'Peer-to-peer, zero cloud' },
];
const FORCE_OPTIONS = [
    { id: 'auto', label: 'Auto-Detect' },
    { id: 'ai_burst', label: '🔥 AI Burst' },
    { id: 'normal', label: '🌿 Normal' },
    { id: 'fallback', label: '🌑 Fallback' },
];
const emptyPeriod = (label = '') => ({
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
const emptySummary = {
    session: emptyPeriod('This Session'),
    today: emptyPeriod('Today'),
    week: emptyPeriod('This Week'),
    month: emptyPeriod('This Month'),
    daily_breakdown: [],
    all_time_cost_avoided_usd: 0,
    all_time_tokens_saved: 0,
    all_time_queries: 0,
};
function fmt$(n) {
    if (n >= 1)
        return `$${n.toFixed(2)}`;
    if (n >= 0.01)
        return `$${n.toFixed(3)}`;
    return `$${n.toFixed(4)}`;
}
function fmtTokens(n) {
    if (n >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
}
function pct(n) {
    return `${(n * 100).toFixed(0)}%`;
}
function syncLabel(ts) {
    if (!ts)
        return 'Never';
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000)
        return 'Just now';
    if (diff < 3600000)
        return `${Math.round(diff / 60000)}m ago`;
    return new Date(ts).toLocaleTimeString();
}
// ─── Daily Bar Chart ──────────────────────────────────────────────────────────
const DailyChart = ({ data }) => {
    if (data.length === 0) {
        return (_jsx("div", { style: { textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11, padding: '20px 0' }, children: "No historical data yet \u2014 start routing queries to see daily trends" }));
    }
    const maxCost = Math.max(...data.map((d) => d.cloud_cost_avoided_usd), 0.0001);
    const shown = data.slice(0, 14).reverse();
    return (_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }, children: ["DAILY CLOUD COST AVOIDED (last ", shown.length, " days)"] }), _jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 3,
                    height: 60,
                    padding: '0 0 4px',
                }, children: shown.map((d) => {
                    const heightPct = d.cloud_cost_avoided_usd / maxCost;
                    const isToday = d.date === new Date().toISOString().slice(0, 10);
                    return (_jsx("div", { title: `${d.date}: ${fmt$(d.cloud_cost_avoided_usd)} saved (${d.total_queries} queries)`, style: {
                            flex: 1,
                            height: `${Math.max(heightPct * 100, 4)}%`,
                            background: isToday
                                ? 'linear-gradient(to top, #16a34a, #22c55e)'
                                : 'linear-gradient(to top, #1d4ed8, #3b82f6)',
                            borderRadius: '2px 2px 0 0',
                            opacity: d.total_queries === 0 ? 0.15 : 0.85,
                            cursor: 'default',
                            transition: 'opacity 0.2s',
                        } }, d.date));
                }) }), _jsx("div", { style: {
                    display: 'flex',
                    gap: 3,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: 3,
                }, children: shown.map((d) => {
                    const day = new Date(d.date + 'T12:00:00').getDate();
                    const isToday = d.date === new Date().toISOString().slice(0, 10);
                    return (_jsx("div", { style: {
                            flex: 1,
                            textAlign: 'center',
                            fontSize: 8,
                            color: isToday ? '#22c55e' : 'rgba(255,255,255,0.2)',
                            fontWeight: isToday ? 700 : 400,
                        }, children: day }, d.date));
                }) })] }));
};
// ─── Stat row ─────────────────────────────────────────────────────────────────
const StatRow = ({ label, value, sub, color, }) => (_jsxs("div", { style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '5px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    }, children: [_jsx("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.5)' }, children: label }), _jsxs("span", { style: { fontSize: 13, fontWeight: 700, color: color ?? 'rgba(255,255,255,0.85)' }, children: [value, sub && (_jsx("span", { style: { fontSize: 10, fontWeight: 400, opacity: 0.55, marginLeft: 4 }, children: sub }))] })] }));
const PERIOD_TABS = [
    { id: 'session', label: 'Session' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
];
// ─── Main Component ───────────────────────────────────────────────────────────
export const AMPLIFYDashboard = ({ currentMode, onModeChange, onClose, authState, }) => {
    const [summary, setSummary] = useState(emptySummary);
    const [federation, setFederation] = useState({
        online: false, peerCount: 0, lastSyncTs: null, lastSyncRecordsExchanged: 0, pendingWriteCount: 0,
    });
    const [forcedMode, setForcedMode] = useState(null);
    const [tab, setTab] = useState('stats');
    const [historyPeriod, setHistoryPeriod] = useState('session');
    const [showShareCard, setShowShareCard] = useState(false);
    const [forceApplied, setForceApplied] = useState(false);
    const [moneyPennyUrl, setMoneyPennyUrl] = useState(null);
    const [updateState, setUpdateState] = useState({ status: 'idle' });
    const [appVersion, setAppVersion] = useState(null);
    // ── Data loading ──────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        const [sum, fed, modeInfo, mpUrl] = await Promise.all([
            window.amplify.getAMPLIFYSummary(),
            window.amplify.getFederationStatus(),
            window.amplify.getFrameMode(),
            window.amplify.getMoneyPennyUrl(),
        ]);
        setSummary(sum ?? emptySummary);
        setFederation(fed);
        setForcedMode(modeInfo.forced_mode);
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
            if (v)
                setAppVersion(v);
        });
    }, []);
    // ── Period to stats ───────────────────────────────────────────────────────
    const periodStats = summary[historyPeriod];
    // ── Force mode ────────────────────────────────────────────────────────────
    const handleForceMode = async (value) => {
        const mode = value === 'auto' ? null : value;
        const result = await window.amplify.forceFrameMode(mode);
        setForcedMode(result.forced_mode);
        if (mode !== null)
            onModeChange(mode);
        setForceApplied(true);
        setTimeout(() => setForceApplied(false), 1500);
    };
    // ── Share card data ───────────────────────────────────────────────────────
    const shareStats = summary.month;
    const localServedPct = (shareStats.substrate_hit_ratio + shareStats.local_ratio) * 100;
    // ─── Render ───────────────────────────────────────────────────────────────
    return (_jsxs(_Fragment, { children: [showShareCard && (_jsx(ShareCard, { costAvoided: shareStats.cloud_cost_avoided_usd, totalQueries: shareStats.total_queries, substratePct: localServedPct, tokensSaved: shareStats.tokens_saved_est, latencyImprovementPct: shareStats.latency_improvement_pct, period: shareStats.label, onClose: () => setShowShareCard(false) })), _jsx("div", { className: "dashboard", onClick: (e) => e.target === e.currentTarget && onClose(), children: _jsxs("div", { className: "dashboard__panel", children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                            }, children: [_jsxs("div", { children: [_jsx("div", { className: "dashboard__title", children: "MnemosyneC\u2122" }), _jsxs("div", { className: "dashboard__subtitle", children: ["MnemosyneC CAI Amplifier \u2014 ", MODES.find((m) => m.id === currentMode)?.label ?? 'Normal', " Mode", forcedMode && (_jsx("span", { style: { color: '#f59e0b', marginLeft: 6, fontSize: 10 }, children: "(forced)" }))] })] }), authState && (_jsxs("div", { style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        gap: 4,
                                        marginTop: 2,
                                    }, children: [_jsxs("div", { title: "Your NotCents balance (cooperative substitution-only)", style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                background: 'rgba(110,231,183,0.08)',
                                                border: '1px solid rgba(110,231,183,0.22)',
                                                borderRadius: 20,
                                                padding: '2px 9px',
                                                fontSize: 11,
                                                color: '#6ee7b7',
                                            }, children: [_jsx(NotCentsGlyph, { size: "0.95em", alt: "NotCents balance" }), _jsx("span", { style: { fontVariantNumeric: 'tabular-nums' }, children: (() => {
                                                        const bal = authState?.member?.notcents_balance;
                                                        return typeof bal === 'number' ? bal.toLocaleString() : '—';
                                                    })() })] }), authState.status === 'member' && authState.member ? (_jsxs("div", { title: `Signed in as ${authState.member.email}`, style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 5,
                                                background: 'rgba(245,158,11,0.1)',
                                                border: '1px solid rgba(245,158,11,0.25)',
                                                borderRadius: 20,
                                                padding: '3px 10px',
                                                fontSize: 11,
                                                color: '#f59e0b',
                                            }, children: [authState.member.badge_tier === 'stamped' && (_jsx("span", { style: { fontSize: 8 }, children: "\u2726" })), authState.member.display_name] })) : authState.status === 'trial_active' ? (_jsxs("div", { style: {
                                                fontSize: 10,
                                                color: 'rgba(255,255,255,0.35)',
                                                borderRadius: 20,
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                padding: '2px 8px',
                                            }, children: ["Trial \u00B7 ", authState.trial_days_remaining ?? 0, "d left"] })) : authState.status === 'trial_expired' ? (_jsx("div", { style: {
                                                fontSize: 10,
                                                color: '#fca5a5',
                                                borderRadius: 20,
                                                border: '1px solid rgba(239,68,68,0.25)',
                                                padding: '2px 8px',
                                            }, children: "\u26A0 Trial expired" })) : null, authState.status === 'member' && (_jsx("button", { onClick: () => window.amplify.authSignOut(), style: {
                                                background: 'none',
                                                border: 'none',
                                                color: 'rgba(255,255,255,0.2)',
                                                fontSize: 10,
                                                cursor: 'pointer',
                                                padding: 0,
                                            }, children: "Sign out" })), (authState.status === 'trial_active' || authState.status === 'trial_expired') && (_jsx("button", { onClick: () => window.amplify.authSignIn(), style: {
                                                background: 'none',
                                                border: 'none',
                                                color: '#f59e0b',
                                                fontSize: 10,
                                                cursor: 'pointer',
                                                padding: 0,
                                            }, children: "Sign in \u2192" }))] }))] }), (updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'downloaded') && (_jsxs("div", { style: {
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
                            }, children: [_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 12, fontWeight: 600, color: updateState.status === 'downloaded' ? '#22c55e' : '#60a5fa' }, children: [updateState.status === 'downloaded'
                                                    ? `✓ v${updateState.version} ready to install`
                                                    : updateState.status === 'downloading'
                                                        ? `⬇ Downloading v${updateState.version}… ${updateState.downloadProgress ?? 0}%`
                                                        : appVersion
                                                            ? `↑ v${appVersion.version} → v${updateState.version} available · `
                                                            : `↑ v${updateState.version} available`, updateState.status === 'available' && (_jsx("a", { href: "https://cephas.lianabanyan.com/changelog/", onClick: (e) => {
                                                        e.preventDefault();
                                                        const ext = window.amplify?.openExternal;
                                                        if (typeof ext === 'function')
                                                            ext('https://cephas.lianabanyan.com/changelog/');
                                                    }, style: { color: '#93c5fd', fontSize: 11, cursor: 'pointer' }, children: "changelog" }))] }), updateState.status === 'downloading' && (_jsx("div", { style: { marginTop: 4, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }, children: _jsx("div", { style: {
                                                    height: '100%',
                                                    width: `${updateState.downloadProgress ?? 0}%`,
                                                    background: '#3b82f6',
                                                    borderRadius: 2,
                                                    transition: 'width 0.3s',
                                                } }) }))] }), updateState.status === 'downloaded' && (_jsx("button", { onClick: () => window.amplify.installUpdate(), style: {
                                        padding: '5px 12px',
                                        background: '#22c55e',
                                        border: 'none',
                                        borderRadius: 6,
                                        color: '#000',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                    }, children: "Restart" }))] })), _jsx("div", { className: "mode-switcher", children: MODES.map((m) => (_jsxs("button", { className: `mode-btn ${currentMode === m.id ? `mode-btn--active-${m.id}` : ''}`, onClick: () => onModeChange(m.id), title: m.desc, children: [m.icon, " ", m.label] }, m.id))) }), _jsx("div", { style: { display: 'flex', gap: 4, marginBottom: 12 }, children: ['stats', 'history', 'settings', 'federation'].map((t) => (_jsxs("button", { onClick: () => setTab(t), style: {
                                    flex: 1,
                                    padding: '5px 0',
                                    background: tab === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    border: tab === t ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                                    borderRadius: 6,
                                    color: 'rgba(255,255,255,0.8)',
                                    fontSize: 10,
                                    cursor: 'pointer',
                                }, children: [t === 'stats' ? '📊' : t === 'history' ? '📅' : t === 'settings' ? '⚙️' : '🌐', ' ', t.charAt(0).toUpperCase() + t.slice(1)] }, t))) }), tab === 'stats' && (_jsxs(_Fragment, { children: [_jsx(StatRow, { label: "Cloud cost avoided", value: fmt$(summary.session.cloud_cost_avoided_usd), color: "#22c55e" }), _jsx(StatRow, { label: "Total queries", value: summary.session.total_queries.toLocaleString() }), _jsx(StatRow, { label: "Substrate hits", value: summary.session.substrate_hits.toLocaleString(), sub: pct(summary.session.substrate_hit_ratio), color: "#22c55e" }), _jsx(StatRow, { label: "Local Ollama", value: summary.session.local_ollama_served.toLocaleString(), sub: pct(summary.session.local_ratio), color: "#f59e0b" }), _jsx(StatRow, { label: "Cloud escalations", value: summary.session.cloud_escalations.toLocaleString(), sub: pct(summary.session.cloud_ratio) }), _jsx(StatRow, { label: "Tokens saved", value: fmtTokens(summary.session.tokens_saved_est) }), summary.session.avg_local_latency_ms > 0 && (_jsx(StatRow, { label: "Latency improvement", value: summary.session.latency_improvement_pct > 0
                                        ? `${summary.session.latency_improvement_pct}% faster`
                                        : '—', sub: summary.session.avg_local_latency_ms > 0
                                        ? `${summary.session.avg_local_latency_ms}ms vs ${summary.session.cloud_baseline_latency_ms}ms cloud`
                                        : undefined, color: "#38bdf8" })), _jsxs("div", { style: {
                                        marginTop: 10,
                                        padding: '8px 10px',
                                        background: 'rgba(255,255,255,0.04)',
                                        borderRadius: 6,
                                        border: '1px solid rgba(255,255,255,0.07)',
                                    }, children: [_jsx("div", { style: { fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }, children: "ALL TIME" }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsxs("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.5)' }, children: [summary.all_time_queries.toLocaleString(), " queries"] }), _jsxs("span", { style: { fontSize: 11, fontWeight: 700, color: '#22c55e' }, children: [fmt$(summary.all_time_cost_avoided_usd), " saved"] }), _jsxs("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.5)' }, children: [fmtTokens(summary.all_time_tokens_saved), " tokens"] })] })] })] })), tab === 'history' && (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: 'flex', gap: 4, marginBottom: 12 }, children: PERIOD_TABS.map((p) => (_jsx("button", { onClick: () => setHistoryPeriod(p.id), style: {
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
                                        }, children: p.label }, p.id))) }), _jsx(StatRow, { label: "Cloud cost avoided", value: fmt$(periodStats.cloud_cost_avoided_usd), color: "#22c55e" }), _jsx(StatRow, { label: "Queries", value: periodStats.total_queries.toLocaleString() }), _jsx(StatRow, { label: "Locally served", value: pct(periodStats.substrate_hit_ratio + periodStats.local_ratio), sub: `${periodStats.substrate_hits} substrate · ${periodStats.local_ollama_served} Ollama`, color: "#22c55e" }), _jsx(StatRow, { label: "Cloud escalations", value: periodStats.cloud_escalations.toLocaleString(), sub: pct(periodStats.cloud_ratio) }), _jsx(StatRow, { label: "Tokens saved", value: fmtTokens(periodStats.tokens_saved_est) }), periodStats.latency_improvement_pct > 0 && (_jsx(StatRow, { label: "Latency improvement", value: `${periodStats.latency_improvement_pct}% faster`, sub: `${periodStats.avg_local_latency_ms}ms local vs ${periodStats.cloud_baseline_latency_ms}ms cloud`, color: "#38bdf8" })), periodStats.days_active > 1 && (_jsx(StatRow, { label: "Days active", value: `${periodStats.days_active}` })), _jsx("div", { style: { marginTop: 14 }, children: _jsx(DailyChart, { data: summary.daily_breakdown }) }), (historyPeriod === 'month' || historyPeriod === 'week') && (_jsx("button", { onClick: () => setShowShareCard(true), style: {
                                        width: '100%',
                                        marginTop: 12,
                                        padding: '8px 0',
                                        background: 'rgba(245,158,11,0.1)',
                                        border: '1px solid rgba(245,158,11,0.3)',
                                        borderRadius: 8,
                                        color: 'rgba(245,158,11,0.9)',
                                        fontSize: 12,
                                        cursor: 'pointer',
                                    }, children: "\u2728 Share savings summary (opt-in)" }))] })), tab === 'settings' && (_jsxs("div", { style: { padding: '4px 0' }, children: [_jsx("div", { style: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }, children: "MODE OVERRIDE" }), _jsx("div", { style: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }, children: "Lock AMPLIFY into a specific mode, bypassing auto-detection." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: FORCE_OPTIONS.map((opt) => {
                                        const isActive = opt.id === 'auto' ? forcedMode === null : forcedMode === opt.id;
                                        return (_jsxs("button", { onClick: () => handleForceMode(opt.id), style: {
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
                                            }, children: [_jsx("span", { children: opt.label }), isActive && (_jsx("span", { style: { fontSize: 10, color: '#16a34a' }, children: forceApplied ? '✓ Applied' : '● Active' }))] }, opt.id));
                                    }) }), _jsx("div", { style: { marginTop: 16, fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }, children: "Auto-Detect switches mode based on Ollama availability, network connectivity, and peer count. Privacy-conscious users should lock to Fallback." }), _jsxs("div", { style: { marginTop: 16 }, children: [_jsx("div", { style: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }, children: "SOFTWARE UPDATE" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, children: [_jsx("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.45)' }, children: updateState.status === 'idle'
                                                        ? `MnemosyneC ${appVersion ? `v${appVersion.version}` : ''}`
                                                        : updateState.status === 'checking' ? 'Checking…'
                                                            : updateState.status === 'not-available'
                                                                ? `✓ v${appVersion?.version ?? '?'} — up to date`
                                                                : updateState.status === 'available' ? `v${updateState.version} available`
                                                                    : updateState.status === 'downloading' ? `Downloading ${updateState.downloadProgress ?? 0}%`
                                                                        : updateState.status === 'downloaded' ? `v${updateState.version} ready`
                                                                            : updateState.status === 'error' ? `Error: ${updateState.errorMessage?.slice(0, 40)}`
                                                                                : '—' }), _jsx("button", { onClick: () => updateState.status === 'downloaded'
                                                        ? window.amplify.installUpdate()
                                                        : window.amplify.checkForUpdates(), style: {
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
                                                    }, children: updateState.status === 'downloaded' ? 'Restart & Install'
                                                        : updateState.status === 'checking' ? 'Checking…'
                                                            : 'Check Now' })] })] }), moneyPennyUrl && (_jsxs("div", { style: {
                                        marginTop: 16,
                                        padding: '10px 12px',
                                        background: 'rgba(245,158,11,0.06)',
                                        border: '1px solid rgba(245,158,11,0.2)',
                                        borderRadius: 8,
                                    }, children: [_jsx("div", { style: { fontSize: 10, color: 'rgba(245,158,11,0.6)', marginBottom: 5 }, children: "\uD83D\uDCF1 MONEYPENNY MOBILE" }), _jsx("div", { style: {
                                                fontSize: 12,
                                                fontFamily: 'monospace',
                                                color: 'rgba(245,158,11,0.85)',
                                                wordBreak: 'break-all',
                                            }, children: moneyPennyUrl }), _jsx("div", { style: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }, children: "Open on your phone while on the same WiFi network" })] }))] })), tab === 'federation' && (_jsxs("div", { style: { padding: '4px 0' }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginBottom: 12,
                                        padding: '8px 12px',
                                        background: 'rgba(255,255,255,0.06)',
                                        borderRadius: 8,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }, children: [_jsx("span", { style: {
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: federation.online ? '#16a34a' : '#6b7280',
                                                flexShrink: 0,
                                                display: 'inline-block',
                                            } }), _jsxs("span", { style: { fontSize: 12, color: 'rgba(255,255,255,0.75)' }, children: ["Cooperative Substrate:", ' ', _jsx("strong", { children: federation.online ? 'Online' : 'Offline' })] })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }, children: [
                                        { label: 'Local Peers', value: federation.peerCount },
                                        { label: 'Last Sync', value: syncLabel(federation.lastSyncTs) },
                                        { label: 'Records Synced', value: federation.lastSyncRecordsExchanged },
                                        { label: 'Pending Writes', value: federation.pendingWriteCount },
                                    ].map((item) => (_jsxs("div", { style: {
                                            padding: '8px 10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 6,
                                            border: '1px solid rgba(255,255,255,0.08)',
                                        }, children: [_jsx("div", { style: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }, children: item.label.toUpperCase() }), _jsx("div", { style: { fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }, children: item.value })] }, item.label))) }), currentMode === 'fallback' && (_jsxs("div", { style: {
                                        padding: '8px 12px',
                                        background: 'rgba(107,114,128,0.15)',
                                        borderRadius: 8,
                                        border: '1px solid rgba(107,114,128,0.3)',
                                        fontSize: 11,
                                        color: 'rgba(255,255,255,0.6)',
                                        lineHeight: 1.5,
                                    }, children: ["\uD83C\uDF11 Fallback active \u2014 peer-to-peer substrate exchange only.", federation.peerCount === 0
                                            ? ' Scanning local network for peers...'
                                            : ` Syncing with ${federation.peerCount} local peer${federation.peerCount !== 1 ? 's' : ''}.`] })), _jsxs("div", { style: { marginTop: 12, fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }, children: ["The cooperative substrate syncs high-signal records with", ' ', _jsx("strong", { style: { color: 'rgba(255,255,255,0.5)' }, children: "lianabanyan.com" }), ". Join the cooperative for $5/year to contribute and benefit from the full network."] })] })), _jsx("div", { style: {
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.2)',
                                textAlign: 'center',
                                marginTop: 12,
                                marginBottom: 4,
                                letterSpacing: 0.5,
                            }, children: "MnemosyneC \u00B7 powered by CAI \u00B7 SSPL \u00B7 Pledge #2260 \u00B7 No Ads \u00B7 No Strings" }), appVersion && (_jsxs("div", { style: {
                                fontSize: 9,
                                color: 'rgba(255,255,255,0.18)',
                                textAlign: 'center',
                                marginBottom: 4,
                                letterSpacing: 0.4,
                                fontFamily: 'monospace',
                            }, children: ["v", appVersion.version, "+", appVersion.buildHash, " \u00B7 LB Alpha-phase \u00B7", ' ', _jsx("a", { href: "https://cephas.lianabanyan.com/changelog/", onClick: (e) => {
                                        e.preventDefault();
                                        const ext = window.amplify?.openExternal;
                                        if (typeof ext === 'function')
                                            ext('https://cephas.lianabanyan.com/changelog/');
                                    }, style: { color: 'rgba(246,173,85,0.45)', textDecoration: 'none', cursor: 'pointer' }, children: "changelog" })] })), _jsx("div", { style: {
                                textAlign: 'center',
                                marginBottom: 14,
                            }, children: _jsx("a", { href: "https://lianabanyan.com/bonfire", onClick: (e) => {
                                    e.preventDefault();
                                    const ext = window.amplify?.openExternal;
                                    if (typeof ext === 'function') {
                                        ext('https://lianabanyan.com/bonfire');
                                    }
                                }, style: {
                                    display: 'inline-block',
                                    fontSize: 10,
                                    color: 'rgba(245,158,11,0.55)',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                    borderRadius: 20,
                                    padding: '2px 10px',
                                    letterSpacing: 0.4,
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                }, title: "Initiative #17 \u2014 The Bonfire \u00B7 cooperative open-source AI research", children: "\uD83D\uDD25 Bonfire \u00B7 Initiative #17 \u00B7 cooperative open-source AI" }) }), _jsx("button", { className: "close-btn", onClick: onClose, children: "Close Dashboard" })] }) })] }));
};
export default AMPLIFYDashboard;
