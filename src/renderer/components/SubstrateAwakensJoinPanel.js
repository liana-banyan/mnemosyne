import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SubstrateAwakensJoinPanel.tsx — BP084 SEG-3
// Settings panel: "Substrate Awakens — Join Live Event"
// Guides a fresh installer through the email-token → mesh-handshake join flow.
import { useState, useEffect } from 'react';
const s = {
    section: {
        marginBottom: 16,
    },
    header: {
        fontSize: 11,
        fontWeight: 600,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    card: {
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: 8,
        padding: '14px 16px',
    },
    label: {
        fontSize: 10,
        color: '#94a3b8',
        marginBottom: 4,
        fontWeight: 500,
    },
    input: {
        width: '100%',
        background: 'rgba(30,41,59,0.8)',
        border: '1px solid rgba(71,85,105,0.6)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 12,
        padding: '7px 10px',
        outline: 'none',
        boxSizing: 'border-box',
        marginBottom: 10,
    },
    btn: {
        background: 'rgba(99,102,241,0.15)',
        border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: 6,
        color: '#818cf8',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '7px 14px',
    },
    btnGreen: {
        background: 'rgba(52,211,153,0.15)',
        border: '1px solid rgba(52,211,153,0.4)',
        borderRadius: 6,
        color: '#34d399',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '7px 14px',
    },
    btnLink: {
        background: 'none',
        border: 'none',
        color: '#64748b',
        fontSize: 10,
        cursor: 'pointer',
        padding: 0,
        textDecoration: 'underline',
    },
    hint: {
        fontSize: 9,
        color: '#475569',
        lineHeight: 1.6,
        marginTop: 4,
    },
    errorBox: {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 6,
        color: '#f87171',
        fontSize: 10,
        padding: '8px 10px',
        marginTop: 8,
    },
    successBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(52,211,153,0.1)',
        border: '1px solid rgba(52,211,153,0.35)',
        borderRadius: 6,
        color: '#34d399',
        fontSize: 11,
        fontWeight: 600,
        padding: '6px 10px',
    },
    tierBadge: {
        display: 'inline-block',
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 5,
        color: '#a5b4fc',
        fontSize: 9,
        padding: '3px 8px',
        marginTop: 6,
    },
    numList: {
        paddingLeft: 18,
        margin: '0 0 12px 0',
        fontSize: 10,
        color: '#64748b',
        lineHeight: 1.7,
    },
    spinner: {
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid rgba(99,102,241,0.3)',
        borderTopColor: '#818cf8',
        borderRadius: '50%',
        animation: 'sa-spin 0.8s linear infinite',
        marginRight: 8,
        verticalAlign: 'middle',
    },
};
export function SubstrateAwakensJoinPanel() {
    const [flow, setFlow] = useState('loading');
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [token, setToken] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [joinedInfo, setJoinedInfo] = useState(null);
    const [tierLabel, setTierLabel] = useState('Detecting...');
    const [tierModel, setTierModel] = useState('');
    // Detect hardware tier via register call (just to display info; no side effects)
    // We use a lightweight approach: call getState on mount and show tier from that context.
    // Tier detection happens in the handshake call on the main side.
    useEffect(() => {
        // Restore joined state from previous session
        (async () => {
            try {
                const state = await window.amplify?.substrateAwakensGetState?.();
                if (state?.joined && state.peerId && state.displayName) {
                    setJoinedInfo({ peerId: state.peerId, displayName: state.displayName, joinedAt: state.joinedAt });
                    setFlow('joined');
                }
                else {
                    setFlow('not-joined');
                }
            }
            catch {
                setFlow('not-joined');
            }
        })();
        // Detect tier label client-side from navigator.deviceMemory if available, else show generic
        const mem = navigator.deviceMemory;
        if (mem) {
            if (mem < 12) {
                setTierLabel('Lightweight');
                setTierModel('gemma2:2b');
            }
            else if (mem < 16) {
                setTierLabel('Standard');
                setTierModel('qwen2.5:7b');
            }
            else {
                setTierLabel('Premium');
                setTierModel('gemma4:12b');
            }
        }
        else {
            setTierLabel('Premium');
            setTierModel('gemma4:12b');
        }
    }, []);
    async function handleRegister() {
        if (!email.trim() || !displayName.trim()) {
            setErrorMsg('Please enter your email and a display name.');
            return;
        }
        setErrorMsg('');
        setFlow('joining');
        try {
            const result = await window.amplify?.substrateAwakensRegister?.(email.trim(), displayName.trim(), tierLabel.toLowerCase());
            if (result?.success) {
                setFlow('token-sent');
            }
            else {
                setErrorMsg(result?.error ?? 'Registration failed. Please try again.');
                setFlow('not-joined');
            }
        }
        catch (err) {
            setErrorMsg(`Unexpected error: ${String(err)}`);
            setFlow('not-joined');
        }
    }
    async function handleHandshake() {
        if (!token.trim()) {
            setErrorMsg('Please paste your token from the email.');
            return;
        }
        setErrorMsg('');
        setFlow('joining');
        try {
            const result = await window.amplify?.substrateAwakensHandshake?.(token.trim(), email.trim(), displayName.trim());
            if (result?.success && result.peerId) {
                setJoinedInfo({ peerId: result.peerId, displayName: result.displayName ?? displayName });
                setFlow('joined');
            }
            else {
                setErrorMsg(result?.error ?? 'Handshake failed. Check your token and try again.');
                setFlow('token-sent');
            }
        }
        catch (err) {
            setErrorMsg(`Unexpected error: ${String(err)}`);
            setFlow('token-sent');
        }
    }
    function handleBack() {
        setErrorMsg('');
        setToken('');
        setFlow('not-joined');
    }
    if (flow === 'loading') {
        return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.header, children: "Substrate Awakens: Join Live Event" }), _jsx("div", { style: s.card, children: _jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic' }, children: "Loading\u2026" }) })] }));
    }
    if (flow === 'joined' && joinedInfo) {
        return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.header, children: "Substrate Awakens: Join Live Event" }), _jsxs("div", { style: s.card, children: [_jsxs("div", { style: s.successBadge, children: [_jsx("span", { children: "\u2713" }), _jsxs("span", { children: ["Connected to live mesh as ", joinedInfo.displayName] })] }), _jsxs("div", { style: { fontSize: 10, color: '#64748b', marginTop: 8 }, children: ["Peer ID: ", _jsx("span", { style: { color: '#94a3b8', fontFamily: 'monospace' }, children: joinedInfo.peerId })] }), joinedInfo.joinedAt && (_jsxs("div", { style: s.hint, children: ["Joined: ", new Date(joinedInfo.joinedAt).toLocaleString()] })), _jsx("div", { style: { marginTop: 10 }, children: _jsx("button", { style: s.btnGreen, onClick: () => window.amplify?.openExternal?.('https://mnemosynec.ai/live/SubstrateAwakens/'), children: "View dashboard \u2192" }) })] })] }));
    }
    if (flow === 'token-sent' || flow === 'joining') {
        const isBusy = flow === 'joining';
        return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.header, children: "Substrate Awakens: Join Live Event" }), _jsxs("div", { style: s.card, children: [_jsx("div", { style: { fontSize: 11, color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }, children: isBusy ? (_jsxs(_Fragment, { children: [_jsx("span", { style: s.spinner }), "Connecting to live mesh\u2026"] })) : ('Check your email for your heartbeat token') }), !isBusy && (_jsxs("div", { style: s.hint, children: ["An email was sent to ", _jsx("strong", { style: { color: '#94a3b8' }, children: email }), ". Paste your token below."] })), !isBusy && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginTop: 10 }, children: [_jsx("div", { style: s.label, children: "Token from email" }), _jsx("input", { style: s.input, type: "text", placeholder: "Paste your token here\u2026", value: token, onChange: (e) => setToken(e.target.value), disabled: isBusy })] }), errorMsg && _jsx("div", { style: s.errorBox, children: errorMsg }), _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }, children: [_jsx("button", { style: s.btnGreen, onClick: handleHandshake, disabled: isBusy, children: "Join Live Mesh" }), _jsx("button", { style: s.btnLink, onClick: handleBack, children: "\u2190 Back" })] })] }))] })] }));
    }
    // not-joined (default) + error state
    return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.header, children: "Substrate Awakens: Join Live Event" }), _jsxs("div", { style: s.card, children: [_jsxs("ol", { style: s.numList, children: [_jsx("li", { children: "Enter your email + display name below" }), _jsx("li", { children: "Click \"Send me my token\" \u00B7 we'll email you an HMAC token" }), _jsx("li", { children: "Paste the token back here" }), _jsx("li", { children: "Click \"Join Live Mesh\" \u00B7 your node handshakes with the relay" }), _jsx("li", { children: "See your presence confirmed and visit the live dashboard" })] }), _jsxs("div", { style: s.tierBadge, children: ["Your machine: ", tierLabel, " \u00B7 you'll run ", tierModel] }), _jsxs("div", { style: { marginTop: 12 }, children: [_jsx("div", { style: s.label, children: "Email" }), _jsx("input", { style: s.input, type: "email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value) }), _jsx("div", { style: s.label, children: "Display name" }), _jsx("input", { style: s.input, type: "text", placeholder: "e.g. Alice M0", value: displayName, onChange: (e) => setDisplayName(e.target.value) })] }), errorMsg && _jsx("div", { style: s.errorBox, children: errorMsg }), _jsx("button", { style: s.btn, onClick: handleRegister, children: "Send me my token \u2192" })] }), _jsx("style", { children: `@keyframes sa-spin { to { transform: rotate(360deg); } }` })] }));
}
