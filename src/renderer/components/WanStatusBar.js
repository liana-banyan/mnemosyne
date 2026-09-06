import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// WAN Status Bar — SEG-WAN-2 · relay escalation heartbeat
// Listens on wan-status-update IPC; fades after 30s idle.
import { useState, useEffect } from 'react';
const FADE_MS = 300;
const STALE_MS = 30000;
export function WanStatusBar() {
    const [wanStatus, setWanStatus] = useState('');
    const [visible, setVisible] = useState(false);
    const [lastTs, setLastTs] = useState(0);
    useEffect(() => {
        const onUpdate = (payload) => {
            if (!payload?.status)
                return;
            setWanStatus(payload.status);
            setLastTs(Date.now());
            setVisible(true);
        };
        const unsub = window.amplify
            ?.onWanStatusUpdate?.(onUpdate);
        const staleCheck = setInterval(() => {
            if (lastTs > 0 && Date.now() - lastTs > STALE_MS) {
                setVisible(false);
                setTimeout(() => setWanStatus(''), FADE_MS);
            }
        }, 1000);
        return () => {
            unsub?.();
            clearInterval(staleCheck);
        };
    }, [lastTs]);
    if (!wanStatus)
        return null;
    return (_jsxs("div", { style: {
            fontSize: 10,
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease`,
        }, children: [_jsx("span", { style: {
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#38bdf8',
                    display: 'inline-block',
                    boxShadow: visible ? '0 0 4px #38bdf8' : 'none',
                } }), wanStatus] }));
}
