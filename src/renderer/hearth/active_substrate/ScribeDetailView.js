import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BP041 SAGA 2 — Scribe Detail View (flip-card back face)
// Shown when member clicks any scribe card in ActiveSubstratePanel
// Back face: name · role · LB-STACK doctrine · activity timeline · output sample · MONITOR toggle
import { useState } from 'react';
function levelColor(level) {
    switch (level.toLowerCase()) {
        case 'error': return '#ef4444';
        case 'warn':
        case 'warning': return '#f6ad55';
        case 'info': return '#63b3ed';
        default: return '#718096';
    }
}
function fmtMs(ms) {
    if (Math.abs(ms) < 1000)
        return `${ms > 0 ? '+' : ''}${Math.round(ms)}ms`;
    return `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(1)}s`;
}
function fmtAccuracy(v) {
    return `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}
function fmtTokens(t) {
    if (Math.abs(t) < 1000)
        return `${t > 0 ? '+' : ''}${Math.round(t)} tok`;
    return `${t > 0 ? '+' : ''}${(t / 1000).toFixed(1)}K tok`;
}
function MetricBar({ label, value, format }) {
    const isPositive = value >= 0;
    return (_jsxs("div", { style: styles.metricRow, children: [_jsx("span", { style: styles.metricLabel, children: label }), _jsx("span", { style: { ...styles.metricValue, color: isPositive ? '#68d391' : '#f6ad55' }, children: format(value) })] }));
}
function MetricsCard({ metrics, title }) {
    const combined = metrics.reduce((acc, m) => ({
        speed: acc.speed + m.total_speed_delta_ms,
        accuracy: acc.accuracy + m.total_accuracy_delta,
        cost: acc.cost + m.total_cost_delta_tokens,
        events: acc.events + m.event_count,
    }), { speed: 0, accuracy: 0, cost: 0, events: 0 });
    return (_jsxs("div", { style: styles.metricsCard, children: [_jsx("div", { style: styles.metricsTitle, children: title }), _jsxs("div", { style: styles.metricsSubtitle, children: [combined.events, " events recorded"] }), _jsx(MetricBar, { label: "Speed", value: combined.speed, format: fmtMs }), _jsx(MetricBar, { label: "Accuracy", value: combined.accuracy, format: fmtAccuracy }), _jsx(MetricBar, { label: "Cost", value: combined.cost, format: fmtTokens }), _jsx("div", { style: styles.baselineNote, children: "vs substrate-only baseline \u00B7 member-replicable \u00B7 K533" })] }));
}
function CombinedDashboard({ allMonitoredMetrics, onBack, }) {
    return (_jsxs("div", { style: styles.combinedPanel, children: [_jsxs("div", { style: styles.combinedHeader, children: [_jsx("button", { style: styles.backBtn, onClick: onBack, children: "\u2190 Back" }), _jsxs("span", { style: styles.combinedTitle, children: ["Combined Dashboard (", allMonitoredMetrics.length, " scribes)"] })] }), _jsx(MetricsCard, { metrics: allMonitoredMetrics, title: "Aggregate F/C/A \u2014 All Monitored Scribes" }), _jsx("div", { style: styles.combinedScribesLabel, children: "Individual breakdown:" }), allMonitoredMetrics.map((m) => (_jsxs("div", { style: styles.combinedScribeRow, children: [_jsx("span", { style: styles.combinedScribeId, children: m.scribe_id }), _jsx("span", { style: { color: m.total_speed_delta_ms >= 0 ? '#68d391' : '#f6ad55', fontSize: '0.65rem' }, children: fmtMs(m.total_speed_delta_ms) }), _jsx("span", { style: { color: m.total_accuracy_delta >= 0 ? '#68d391' : '#f6ad55', fontSize: '0.65rem' }, children: fmtAccuracy(m.total_accuracy_delta) }), _jsx("span", { style: { color: m.total_cost_delta_tokens >= 0 ? '#68d391' : '#f6ad55', fontSize: '0.65rem' }, children: fmtTokens(m.total_cost_delta_tokens) }), _jsxs("span", { style: styles.combinedEventCount, children: [m.event_count, " ev"] })] }, m.scribe_id)))] }));
}
export function ScribeDetailView({ subject, history, monitorEnabled, metrics, allMonitoredMetrics, onToggleMonitor, onBack, }) {
    const [showCombined, setShowCombined] = useState(false);
    const hasMultipleMonitored = allMonitoredMetrics.length >= 2;
    if (showCombined) {
        return (_jsx(CombinedDashboard, { allMonitoredMetrics: allMonitoredMetrics, onBack: () => setShowCombined(false) }));
    }
    const recentOutput = history.find((ev) => ev.message && ev.message.length > 10);
    const activitySlice = history.slice(0, 10);
    return (_jsxs("div", { style: styles.panel, children: [_jsxs("div", { style: styles.header, children: [_jsx("button", { style: styles.backBtn, onClick: onBack, children: "\u2190 Back" }), hasMultipleMonitored && (_jsxs("button", { style: styles.combinedBtn, onClick: () => setShowCombined(true), children: ["Combined (", allMonitoredMetrics.length, " monitored)"] }))] }), _jsxs("div", { style: styles.identity, children: [_jsx("div", { style: styles.scribeName, children: subject.name }), _jsx("div", { style: styles.stackRef, children: subject.stack_ref }), _jsx("div", { style: styles.description, children: subject.description })] }), _jsxs("div", { style: styles.monitorRow, children: [_jsx("span", { style: styles.monitorLabel, children: "Monitor contribution" }), _jsx("button", { style: {
                            ...styles.toggleBtn,
                            background: monitorEnabled ? '#276749' : '#2d3748',
                            border: `1px solid ${monitorEnabled ? '#68d391' : '#4a5568'}`,
                            color: monitorEnabled ? '#68d391' : '#718096',
                        }, onClick: () => onToggleMonitor(!monitorEnabled), title: monitorEnabled ? 'Stop monitoring this scribe' : 'Start monitoring Speed/Accuracy/Cost contribution', children: monitorEnabled ? '● ON' : '○ OFF' }), metrics?.monitored_since && (_jsxs("span", { style: styles.monitorSince, children: ["since ", new Date(metrics.monitored_since).toLocaleDateString()] }))] }), monitorEnabled && metrics && metrics.event_count > 0 && (_jsx(MetricsCard, { metrics: [metrics], title: "This Scribe's Contribution" })), monitorEnabled && metrics && metrics.event_count === 0 && (_jsx("div", { style: styles.monitorPending, children: "Monitoring active \u2014 deltas will accumulate as waves fire" })), recentOutput && (_jsxs("div", { style: styles.outputSampleBlock, children: [_jsx("div", { style: styles.sectionLabel, children: "Recent output sample" }), _jsxs("div", { style: styles.outputSampleText, children: [recentOutput.message.slice(0, 240), recentOutput.message.length > 240 ? '…' : ''] }), _jsx("div", { style: styles.outputTs, children: new Date(recentOutput.ts).toLocaleTimeString() })] })), _jsxs("div", { style: styles.sectionLabel, children: ["Activity timeline (", activitySlice.length, "/", history.length, ")"] }), _jsx("div", { style: styles.timeline, children: activitySlice.length === 0 ? (_jsx("div", { style: styles.noActivity, children: "No events \u2014 Watchdog server not yet wired (G11 pending)" })) : (activitySlice.map((ev, i) => (_jsxs("div", { style: styles.timelineEvent, children: [_jsx("span", { style: { color: levelColor(ev.level), minWidth: 32, fontSize: '0.62rem', fontWeight: 700 }, children: ev.level.slice(0, 4).toUpperCase() }), _jsx("span", { style: styles.timelineTs, children: new Date(ev.ts).toLocaleTimeString() }), _jsx("span", { style: styles.timelineMsg, children: ev.message })] }, i)))) })] }));
}
const styles = {
    panel: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        height: '100%',
        overflowY: 'auto',
        padding: '0.25rem 0',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.15rem',
    },
    backBtn: {
        background: 'none',
        border: '1px solid #4a5568',
        color: '#a0aec0',
        borderRadius: '4px',
        padding: '0.2rem 0.5rem',
        fontSize: '0.7rem',
        cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
    },
    combinedBtn: {
        marginLeft: 'auto',
        background: 'none',
        border: '1px solid #4a5568',
        color: '#63b3ed',
        borderRadius: '4px',
        padding: '0.2rem 0.5rem',
        fontSize: '0.65rem',
        cursor: 'pointer',
    },
    identity: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        paddingBottom: '0.4rem',
        borderBottom: '1px solid #2d3748',
    },
    scribeName: {
        fontWeight: 700,
        fontSize: '0.95rem',
        color: '#68d391',
    },
    stackRef: {
        fontSize: '0.62rem',
        color: '#4a5568',
        fontFamily: 'monospace',
    },
    description: {
        fontSize: '0.72rem',
        color: '#a0aec0',
        lineHeight: 1.4,
    },
    monitorRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    monitorLabel: {
        fontSize: '0.72rem',
        color: '#a0aec0',
        flex: 1,
    },
    toggleBtn: {
        borderRadius: '4px',
        padding: '0.2rem 0.6rem',
        fontSize: '0.7rem',
        cursor: 'pointer',
        fontWeight: 600,
        transition: 'background 0.2s, border-color 0.2s, color 0.2s',
    },
    monitorSince: {
        fontSize: '0.6rem',
        color: '#4a5568',
    },
    monitorPending: {
        fontSize: '0.68rem',
        color: '#68d391',
        background: '#0d2018',
        border: '1px solid #276749',
        borderRadius: '4px',
        padding: '0.3rem 0.5rem',
        fontStyle: 'italic',
    },
    metricsCard: {
        background: '#0d1117',
        border: '1px solid #2d3748',
        borderRadius: '6px',
        padding: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    metricsTitle: {
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#63b3ed',
    },
    metricsSubtitle: {
        fontSize: '0.6rem',
        color: '#4a5568',
        marginBottom: '0.15rem',
    },
    metricRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: '0.68rem',
        color: '#718096',
    },
    metricValue: {
        fontSize: '0.7rem',
        fontWeight: 600,
        fontFamily: 'monospace',
    },
    baselineNote: {
        fontSize: '0.58rem',
        color: '#4a5568',
        marginTop: '0.1rem',
        fontStyle: 'italic',
    },
    outputSampleBlock: {
        background: '#1a1a2e',
        border: '1px solid #2d3748',
        borderRadius: '6px',
        padding: '0.4rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.15rem',
    },
    sectionLabel: {
        fontSize: '0.65rem',
        color: '#4a5568',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    outputSampleText: {
        fontSize: '0.68rem',
        color: '#a0aec0',
        lineHeight: 1.4,
        wordBreak: 'break-word',
    },
    outputTs: {
        fontSize: '0.58rem',
        color: '#4a5568',
        textAlign: 'right',
    },
    timeline: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.15rem',
        maxHeight: 140,
        overflowY: 'auto',
    },
    timelineEvent: {
        display: 'flex',
        gap: '0.35rem',
        fontSize: '0.65rem',
        lineHeight: 1.3,
    },
    timelineTs: {
        color: '#718096',
        flexShrink: 0,
        minWidth: 56,
    },
    timelineMsg: {
        color: '#a0aec0',
        flex: 1,
        wordBreak: 'break-word',
    },
    noActivity: {
        fontSize: '0.65rem',
        color: '#4a5568',
        fontStyle: 'italic',
    },
    // Combined dashboard
    combinedPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        height: '100%',
        overflowY: 'auto',
        padding: '0.25rem 0',
    },
    combinedHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    combinedTitle: {
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#63b3ed',
    },
    combinedScribesLabel: {
        fontSize: '0.62rem',
        color: '#4a5568',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    combinedScribeRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.2rem 0',
        borderBottom: '1px solid #1a1a2e',
    },
    combinedScribeId: {
        fontSize: '0.65rem',
        color: '#a0aec0',
        flex: 1,
        fontFamily: 'monospace',
    },
    combinedEventCount: {
        fontSize: '0.6rem',
        color: '#4a5568',
        minWidth: 30,
        textAlign: 'right',
    },
};
