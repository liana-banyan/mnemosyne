import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function statusToColor(status) {
    switch (status) {
        case 'green': return '#22c55e';
        case 'yellow': return '#f6ad55';
        case 'red': return '#ef4444';
        case 'gray': return '#4a5568';
        default: return '#4a5568';
    }
}
function statusToEmoji(status) {
    switch (status) {
        case 'green': return '●';
        case 'yellow': return '◐';
        case 'red': return '✕';
        case 'gray': return '○';
        default: return '○';
    }
}
function statusToLabel(status) {
    switch (status) {
        case 'green': return 'healthy';
        case 'yellow': return 'degraded';
        case 'red': return 'error';
        case 'gray': return 'not registered';
        default: return 'unknown';
    }
}
export function HealthGrid({ subjects, onSubjectClick, hoveredSubject, onHoverChange }) {
    return (_jsx("div", { style: styles.grid, children: subjects.map((s) => {
            const color = statusToColor(s.status);
            const isHovered = hoveredSubject === s.short_name;
            return (_jsxs("div", { style: {
                    ...styles.cell,
                    borderColor: isHovered ? color : '#2d3748',
                    background: isHovered ? `${color}18` : '#1a1a2e',
                    cursor: 'pointer',
                }, onClick: () => onSubjectClick(s), onMouseEnter: () => onHoverChange(s.short_name), onMouseLeave: () => onHoverChange(null), title: `${s.name} — ${statusToLabel(s.status)}\n${s.description}\n${s.stack_ref}`, children: [_jsx("div", { style: { ...styles.statusSymbol, color }, children: statusToEmoji(s.status) }), _jsx("div", { style: styles.subjectName, children: s.name }), _jsx("div", { style: styles.stackRef, children: s.stack_ref }), s.last_heartbeat && (_jsx("div", { style: styles.heartbeat, children: new Date(s.last_heartbeat).toLocaleTimeString() }))] }, s.short_name));
        }) }));
}
const styles = {
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.4rem',
        padding: '0.4rem',
    },
    cell: {
        borderRadius: '8px',
        border: '1px solid',
        padding: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.15rem',
        transition: 'border-color 0.15s, background 0.15s',
        minHeight: '70px',
    },
    statusSymbol: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1,
    },
    subjectName: {
        fontSize: '0.68rem',
        fontWeight: 600,
        color: '#e2e8f0',
        lineHeight: 1.2,
    },
    stackRef: {
        fontSize: '0.58rem',
        color: '#4a5568',
        fontFamily: 'monospace',
    },
    heartbeat: {
        fontSize: '0.58rem',
        color: '#718096',
        marginTop: 'auto',
    },
};
