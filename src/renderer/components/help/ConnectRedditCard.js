import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — Connect Reddit Card
// Sonnet 4.6 · Founder-ratified
//
// Mirror of ConnectDiscordCard for Reddit OAuth.
// Scopes: identity, read, submit, vote, subscribe, mysubreddits
// Client ID from REDDIT_OAUTH_CLIENT_ID env var (main process).
// Redirect: mnemo://oauth/reddit/callback
import { useState, useCallback } from 'react';
const LS_REDDIT_STATE = 'mnemo_reddit_connection';
function loadRedditState() {
    try {
        const raw = localStorage.getItem(LS_REDDIT_STATE);
        if (!raw)
            return { connected: false };
        return JSON.parse(raw);
    }
    catch {
        return { connected: false };
    }
}
function saveRedditState(state) {
    localStorage.setItem(LS_REDDIT_STATE, JSON.stringify(state));
}
export function ConnectRedditCard({ onMarksAccrued }) {
    const [state, setState] = useState(loadRedditState);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }, []);
    const handleConnect = useCallback(async () => {
        setConnecting(true);
        setError(null);
        try {
            const result = await window.amplify?.oauth?.startFlow?.('reddit');
            if (!result) {
                setError('OAuth not available — app registration required. See yoke-return for setup steps.');
                return;
            }
            if (result.needsRegistration) {
                setError('Reddit OAuth app not yet registered. Founder: visit reddit.com/prefs/apps to register "MnemosyneC Substrate Filter" and add REDDIT_OAUTH_CLIENT_ID to your env.');
                return;
            }
            if (!result.success) {
                setError(result.error ?? 'Connection failed. Please try again.');
                return;
            }
            const newState = {
                connected: true,
                username: result.username,
                scopes: result.scopes,
            };
            setState(newState);
            saveRedditState(newState);
            void window.amplify?.oauth?.accrueConnectMarks?.('reddit', 5);
            onMarksAccrued?.(5);
            showToast('✦ Connected! +5 Marks earned.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Unexpected error. Please try again.');
        }
        finally {
            setConnecting(false);
        }
    }, [onMarksAccrued, showToast]);
    const handleDisconnect = useCallback(() => {
        const ok = window.confirm('Disconnect your Reddit account from MnemosyneC?');
        if (!ok)
            return;
        const cleared = { connected: false };
        setState(cleared);
        saveRedditState(cleared);
        void window.amplify?.oauth?.revokeToken?.('reddit');
        showToast('Reddit disconnected.');
    }, [showToast]);
    return (_jsxs("div", { style: s.card, children: [_jsxs("div", { style: s.header, children: [_jsx("span", { style: s.platformIcon, children: "\uD83D\uDFE0" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: s.platformName, children: "Reddit" }), _jsx("div", { style: s.platformSub, children: state.connected
                                    ? `Connected as u/${state.username}`
                                    : 'Full read-write · posts, comments, votes' })] }), state.connected && (_jsx("span", { style: s.connectedBadge, children: "\u25CF Connected" }))] }), !state.connected && (_jsxs("p", { style: s.description, children: ["Join r/LianaBanyanGuild. Use Reddit through MnemosyneC \u2014 save any answer to your Substrate with one click. Earn ", _jsx("strong", { style: { color: '#6ee7b7' }, children: "\u2726 5 Marks" }), " for connecting."] })), error && (_jsx("div", { style: s.errorBox, role: "alert", children: error })), toast && (_jsx("div", { style: s.toastBox, role: "status", "aria-live": "polite", children: toast })), !state.connected ? (_jsx("button", { type: "button", onClick: handleConnect, disabled: connecting, style: { ...s.connectBtn, opacity: connecting ? 0.6 : 1 }, children: connecting ? 'Connecting…' : '🟠 Connect Reddit' })) : (_jsxs("div", { style: s.connectedControls, children: [_jsxs("p", { style: s.connectedHelp, children: ["\uD83D\uDCDA Save any Reddit post or comment to your Substrate \u2014 each capture earns", ' ', _jsx("strong", { style: { color: '#6ee7b7' }, children: "\u2726 1 Mark" }), "."] }), _jsx("button", { type: "button", onClick: () => window.amplify?.openExternal?.('https://www.reddit.com/r/LianaBanyanGuild/'), style: s.openBtn, children: "Open Reddit \u2192" }), _jsx("button", { type: "button", onClick: handleDisconnect, style: s.disconnectBtn, children: "Disconnect" })] }))] }));
}
const s = {
    card: {
        background: '#0d1117',
        border: '1px solid #1e2a38',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 10,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    platformIcon: {
        fontSize: 20,
        flexShrink: 0,
    },
    platformName: {
        fontSize: 14,
        fontWeight: 700,
        color: '#f0fdf4',
    },
    platformSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    connectedBadge: {
        fontSize: 11,
        color: '#4ade80',
        flexShrink: 0,
    },
    description: {
        margin: '0 0 10px',
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.6,
    },
    errorBox: {
        background: '#1a0a0a',
        border: '1px solid #4a1515',
        borderRadius: 5,
        padding: '7px 10px',
        fontSize: 11,
        color: '#f87171',
        marginBottom: 10,
        lineHeight: 1.55,
    },
    toastBox: {
        background: '#064e3b',
        border: '1px solid #059669',
        borderRadius: 5,
        padding: '5px 10px',
        fontSize: 11,
        color: '#6ee7b7',
        marginBottom: 10,
    },
    connectBtn: {
        background: '#ff4500',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '7px 16px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
        outline: 'none',
        transition: 'opacity 0.15s',
    },
    connectedControls: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'flex-start',
    },
    connectedHelp: {
        width: '100%',
        margin: '0 0 8px',
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.6,
    },
    openBtn: {
        background: '#ff4500',
        color: '#fff',
        border: 'none',
        borderRadius: 5,
        padding: '5px 12px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
        outline: 'none',
    },
    disconnectBtn: {
        background: 'none',
        border: '1px solid #334155',
        borderRadius: 5,
        color: '#64748b',
        fontSize: 11,
        padding: '5px 10px',
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
        outline: 'none',
    },
};
