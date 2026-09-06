import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — Coming Soon Card
// Sonnet 4.6 · Founder-ratified
import { useState } from 'react';
const LS_NOTIFY_PREFIX = 'mnemo_notify_me_';
export function ComingSoonCard({ name, why, eta, icon = '🚀' }) {
    const key = LS_NOTIFY_PREFIX + name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const [notified, setNotified] = useState(() => localStorage.getItem(key) === '1');
    const [justSet, setJustSet] = useState(false);
    const handleNotify = () => {
        localStorage.setItem(key, '1');
        setNotified(true);
        setJustSet(true);
        setTimeout(() => setJustSet(false), 2000);
    };
    return (_jsxs("div", { style: s.card, children: [_jsxs("div", { style: s.header, children: [_jsx("span", { style: s.icon, children: icon }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: s.name, children: name }), _jsxs("div", { style: s.eta, children: ["Coming ", eta] })] }), notified ? (_jsx("span", { style: s.notifiedBadge, children: justSet ? '✓ You\'re on the list!' : '📬 Notified' })) : (_jsx("button", { type: "button", onClick: handleNotify, style: s.notifyBtn, title: "Get notified when this launches", children: "\uD83D\uDCEC Notify me" }))] }), _jsx("p", { style: s.why, children: why })] }));
}
const s = {
    card: {
        background: '#0a0f1a',
        border: '1px solid #1e2a38',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 10,
        opacity: 0.85,
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 6,
    },
    icon: {
        fontSize: 18,
        flexShrink: 0,
        marginTop: 2,
    },
    name: {
        fontSize: 13,
        fontWeight: 600,
        color: '#e2e8f0',
    },
    eta: {
        fontSize: 11,
        color: '#475569',
        marginTop: 2,
    },
    why: {
        margin: 0,
        fontSize: 12,
        color: '#64748b',
        lineHeight: 1.6,
    },
    notifyBtn: {
        background: 'none',
        border: '1px solid #334155',
        borderRadius: 5,
        color: '#94a3b8',
        fontSize: 11,
        padding: '3px 9px',
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
        outline: 'none',
        flexShrink: 0,
        whiteSpace: 'nowrap',
    },
    notifiedBadge: {
        fontSize: 11,
        color: '#6ee7b7',
        flexShrink: 0,
        whiteSpace: 'nowrap',
    },
};
