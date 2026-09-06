import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function levelColor(level) {
    switch (level.toLowerCase()) {
        case 'error': return '#ef4444';
        case 'warn':
        case 'warning': return '#f6ad55';
        case 'info': return '#63b3ed';
        default: return '#718096';
    }
}
export function SubjectDrilldown({ subject, history, onClose }) {
    if (!subject)
        return null;
    return (_jsxs("div", { style: styles.drawer, children: [_jsxs("div", { style: styles.header, children: [_jsxs("div", { style: styles.title, children: [_jsx("span", { style: styles.name, children: subject.name }), _jsx("span", { style: styles.ref, children: subject.stack_ref })] }), _jsx("button", { style: styles.closeBtn, onClick: onClose, children: "\u2715" })] }), _jsx("div", { style: styles.description, children: subject.description }), _jsxs("div", { style: styles.statusRow, children: [_jsx("span", { style: styles.statusLabel, children: "Status:" }), _jsx("span", { style: {
                            color: subject.status === 'green' ? '#22c55e'
                                : subject.status === 'yellow' ? '#f6ad55'
                                    : subject.status === 'red' ? '#ef4444' : '#4a5568',
                            fontWeight: 700,
                        }, children: subject.status.toUpperCase() }), subject.last_heartbeat && (_jsxs("span", { style: styles.heartbeat, children: ["Last beat: ", new Date(subject.last_heartbeat).toLocaleString()] }))] }), subject.last_error && (_jsx("div", { style: styles.error, children: subject.last_error })), _jsxs("div", { style: styles.historyHeader, children: ["Event History (", history.length, ")"] }), _jsx("div", { style: styles.historyList, children: history.length === 0 ? (_jsx("div", { style: styles.noHistory, children: "No events in window (Watchdog server not yet wired \u2014 G11 pending)" })) : (history.slice(0, 50).map((ev, i) => (_jsxs("div", { style: styles.event, children: [_jsx("span", { style: { color: levelColor(ev.level), fontWeight: 600, minWidth: 40 }, children: ev.level.toUpperCase().slice(0, 4) }), _jsx("span", { style: styles.eventTs, children: new Date(ev.ts).toLocaleTimeString() }), _jsx("span", { style: styles.eventMsg, children: ev.message })] }, i)))) })] }));
}
const styles = {
    drawer: {
        background: '#1a1a2e',
        border: '1px solid #4a5568',
        borderRadius: '8px',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        overflow: 'hidden',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
    name: { fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0' },
    ref: { fontSize: '0.65rem', color: '#4a5568', fontFamily: 'monospace' },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#718096',
        cursor: 'pointer',
        fontSize: '0.9rem',
        padding: '0 0.25rem',
    },
    description: { fontSize: '0.72rem', color: '#a0aec0', lineHeight: 1.4 },
    statusRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' },
    statusLabel: { color: '#718096' },
    heartbeat: { marginLeft: 'auto', fontSize: '0.65rem', color: '#718096' },
    error: { background: '#2d0000', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.3rem 0.4rem', fontSize: '0.7rem', color: '#ef4444' },
    historyHeader: { fontWeight: 600, fontSize: '0.72rem', color: '#63b3ed', marginTop: '0.25rem' },
    historyList: { overflowY: 'auto', maxHeight: 200, display: 'flex', flexDirection: 'column', gap: '0.15rem' },
    noHistory: { fontSize: '0.7rem', color: '#4a5568', fontStyle: 'italic' },
    event: { display: 'flex', gap: '0.4rem', fontSize: '0.68rem', lineHeight: 1.3 },
    eventTs: { color: '#718096', flexShrink: 0, minWidth: 60 },
    eventMsg: { color: '#a0aec0', flex: 1, wordBreak: 'break-word' },
};
