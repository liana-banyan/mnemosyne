import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// CommunityConnectButton.tsx — SEG-3 v0.1.55 COMMUNITY-CONNECT
// Every-click-feedback canon: idle · connecting · success · fail (no silent states)
import { useState, useCallback, useEffect, useRef } from 'react';
export function CommunityConnectButton() {
    const [state, setState] = useState('idle');
    const [elapsedMs, setElapsedMs] = useState(0);
    const heartbeatRef = useRef(null);
    const connectStartRef = useRef(0);
    const clearHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    }, []);
    useEffect(() => () => clearHeartbeat(), [clearHeartbeat]);
    const handleConnect = useCallback(async () => {
        if (state === 'connecting')
            return;
        setState('connecting');
        setElapsedMs(0);
        connectStartRef.current = Date.now();
        clearHeartbeat();
        heartbeatRef.current = setInterval(() => {
            setElapsedMs(Date.now() - connectStartRef.current);
        }, 2000);
        try {
            const result = await window.amplify?.communityConnectHandshake?.();
            clearHeartbeat();
            if (result?.success) {
                setState('success');
            }
            else {
                setState('fail');
            }
        }
        catch {
            clearHeartbeat();
            setState('fail');
        }
    }, [state, clearHeartbeat]);
    const baseBtn = {
        width: '100%',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'background 150ms ease, border-color 150ms ease',
    };
    if (state === 'idle') {
        return (_jsx("button", { type: "button", onClick: () => { void handleConnect(); }, style: {
                ...baseBtn,
                background: 'rgba(110, 231, 183, 0.08)',
                border: '1px solid rgba(110, 231, 183, 0.35)',
                color: '#6ee7b7',
            }, onMouseEnter: (e) => {
                e.currentTarget.style.background = 'rgba(110, 231, 183, 0.14)';
            }, onMouseLeave: (e) => {
                e.currentTarget.style.background = 'rgba(110, 231, 183, 0.08)';
            }, children: "Connect to MnemosyneC community" }));
    }
    if (state === 'connecting') {
        return (_jsxs("div", { style: {
                ...baseBtn,
                background: 'rgba(96, 165, 250, 0.08)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                color: '#93c5fd',
                cursor: 'default',
            }, "aria-live": "polite", children: [_jsx("span", { style: {
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(147, 197, 253, 0.3)',
                        borderTopColor: '#93c5fd',
                        borderRadius: '50%',
                        animation: 'communityConnectSpin 0.8s linear infinite',
                        flexShrink: 0,
                    } }), "Connecting to MnemosyneC community\u2026", elapsedMs >= 2000 && (_jsxs("span", { style: { fontSize: 11, color: '#64748b', fontWeight: 400 }, children: ["(", Math.round(elapsedMs / 1000), "s)"] })), _jsx("style", { children: `@keyframes communityConnectSpin { to { transform: rotate(360deg); } }` })] }));
    }
    if (state === 'success') {
        return (_jsxs("div", { style: {
                ...baseBtn,
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#22c55e',
                cursor: 'default',
            }, "aria-live": "polite", children: [_jsx("span", { style: { fontSize: 15, lineHeight: 1 }, children: "\u2713" }), "Connected \u00B7 1 peer (FounderDenken)"] }));
    }
    // fail — retry button visible (every-click-feedback canon)
    return (_jsxs("button", { type: "button", onClick: () => { void handleConnect(); }, style: {
            ...baseBtn,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
        }, onMouseEnter: (e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)';
        }, onMouseLeave: (e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
        }, "aria-live": "polite", children: [_jsx("span", { style: { fontSize: 15, lineHeight: 1 }, children: "\u2715" }), "Relay unreachable \u2014 retry"] }));
}
export default CommunityConnectButton;
