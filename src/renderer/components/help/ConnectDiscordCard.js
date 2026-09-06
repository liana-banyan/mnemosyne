import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — Connect Discord Card
// Sonnet 4.6 · Founder-ratified
//
// OAuth path: renderer calls window.amplify.oauth.startFlow('discord')
// Main process opens browser, catches mnemo://oauth/discord/callback,
// exchanges code for token, stores via safeStorage, returns to renderer.
// Client ID sourced from window.amplify.oauth.getClientId('discord') — set by main
// process from env (DISCORD_OAUTH_CLIENT_ID). If missing, shows registration CTA.
import { useState, useCallback } from 'react';
const LS_DISCORD_STATE = 'mnemo_discord_connection';
function loadDiscordState() {
    try {
        const raw = localStorage.getItem(LS_DISCORD_STATE);
        if (!raw)
            return { connected: false };
        return JSON.parse(raw);
    }
    catch {
        return { connected: false };
    }
}
function saveDiscordState(state) {
    localStorage.setItem(LS_DISCORD_STATE, JSON.stringify(state));
}
export function ConnectDiscordCard({ onMarksAccrued }) {
    const [state, setState] = useState(loadDiscordState);
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
            const result = await window.amplify?.oauth?.startFlow?.('discord');
            if (!result) {
                setError('OAuth not available — app registration required. See yoke-return for setup steps.');
                return;
            }
            if (result.needsRegistration) {
                setError('Discord OAuth app not yet registered. Founder: visit discord.com/developers/applications to register "MnemosyneC Substrate Filter" and add DISCORD_OAUTH_CLIENT_ID to your env.');
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
            saveDiscordState(newState);
            // Accrue 5 Marks for first Discord connect
            void window.amplify?.oauth?.accrueConnectMarks?.('discord', 5);
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
        const ok = window.confirm('Disconnect your Discord account from MnemosyneC?');
        if (!ok)
            return;
        const cleared = { connected: false };
        setState(cleared);
        saveDiscordState(cleared);
        void window.amplify?.oauth?.revokeToken?.('discord');
        showToast('Discord disconnected.');
    }, [showToast]);
    return (_jsxs("div", { style: s.card, children: [_jsxs("div", { style: s.header, children: [_jsx("span", { style: s.platformIcon, children: "\uD83D\uDFE3" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: s.platformName, children: "Discord" }), _jsx("div", { style: s.platformSub, children: state.connected
                                    ? `Connected as @${state.username}`
                                    : 'Full read-write · private + guild channels' })] }), state.connected && (_jsx("span", { style: s.connectedBadge, children: "\u25CF Connected" }))] }), !state.connected && (_jsxs("p", { style: s.description, children: ["Join the Liana Banyan Plumbing & Mechanics Guild Discord. Use Discord through MnemosyneC \u2014 every response can be saved to your Substrate with one click. Earn ", _jsx("strong", { style: { color: '#6ee7b7' }, children: "\u2726 5 Marks" }), " for connecting."] })), error && (_jsx("div", { style: s.errorBox, role: "alert", children: error })), toast && (_jsx("div", { style: s.toastBox, role: "status", "aria-live": "polite", children: toast })), !state.connected ? (_jsx("button", { type: "button", onClick: handleConnect, disabled: connecting, style: { ...s.connectBtn, opacity: connecting ? 0.6 : 1 }, children: connecting ? 'Connecting…' : '🟣 Connect Discord' })) : (_jsxs("div", { style: s.connectedControls, children: [_jsxs("p", { style: s.connectedHelp, children: ["\uD83D\uDCDA Save any message from Discord channels to your Substrate \u2014 each capture earns", ' ', _jsx("strong", { style: { color: '#6ee7b7' }, children: "\u2726 1 Mark" }), ". Full webview with eblet overlay coming in the Discord window below when you open it."] }), _jsx("button", { type: "button", onClick: () => window.amplify?.openExternal?.('https://discord.com/channels/@me'), style: s.openBtn, children: "Open Discord \u2192" }), _jsx("button", { type: "button", onClick: handleDisconnect, style: s.disconnectBtn, children: "Disconnect" })] }))] }));
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
        background: '#5865f2',
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
        background: '#5865f2',
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
