import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// LBAccountTab.tsx — Tab 14 "LB Account"
// BP065 Part A (SEG-D2a) + Part B (SEG-C2b) · MnemosyneC v0.1.22
//
// States:
//   Unlinked  — email input + "Link My LB Account" CTA
//   Linking   — spinner + "Check your email…" message
//   Linked    — account info + Frontier registration section + Unlink button
//
// Frontier section (gated on LB Account being linked):
//   Unregistered — "Join the Frontier" button (explicit opt-in with disclosure)
//   Registered   — node info + last heartbeat + "Leave the Frontier" button
import React, { useState, useEffect, useCallback } from 'react';
import { NotCentsGlyph } from './NotCentsGlyph';
// BP087 Wave 3 SEG-G2 -- Preference Inference
import { PreferenceInferencePanel } from './PreferenceInferencePanel';
// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
    root: {
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 560,
    },
    heading: {
        fontSize: 15,
        fontWeight: 700,
        color: '#e2e8f0',
        margin: 0,
    },
    sub: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 1.6,
        margin: 0,
    },
    card: {
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    cardGreen: {
        background: 'rgba(6,78,59,0.2)',
        border: '1px solid rgba(110,231,183,0.3)',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    label: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    },
    value: {
        fontSize: 12,
        color: '#e2e8f0',
        fontFamily: 'monospace',
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(100,116,139,0.35)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 13,
        outline: 'none',
        boxSizing: 'border-box',
    },
    btnPrimary: {
        padding: '8px 18px',
        background: 'rgba(110,231,183,0.12)',
        border: '1px solid rgba(110,231,183,0.35)',
        borderRadius: 6,
        color: '#6ee7b7',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    btnDanger: {
        padding: '6px 14px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 6,
        color: '#f87171',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
    },
    btnFrontier: {
        padding: '8px 18px',
        background: 'rgba(250,204,21,0.08)',
        border: '1px solid rgba(250,204,21,0.3)',
        borderRadius: 6,
        color: '#facc15',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
    },
    error: {
        fontSize: 11,
        color: '#f87171',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 6,
        padding: '6px 10px',
    },
    success: {
        fontSize: 11,
        color: '#6ee7b7',
        background: 'rgba(110,231,183,0.08)',
        border: '1px solid rgba(110,231,183,0.2)',
        borderRadius: 6,
        padding: '6px 10px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    tag: (color) => ({
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 10,
        background: `rgba(${color},0.12)`,
        border: `1px solid rgba(${color},0.3)`,
        color: `rgb(${color})`,
        whiteSpace: 'nowrap',
    }),
};
// ─── Component ────────────────────────────────────────────────────────────────
export function LBAccountTab() {
    const [accountState, setAccountState] = useState({ linked: false });
    const [frontierState, setFrontierState] = useState({ registered: false });
    const [email, setEmail] = useState('');
    const [linkPhase, setLinkPhase] = useState('idle');
    const [linkError, setLinkError] = useState('');
    const [frontierBusy, setFrontierBusy] = useState(false);
    const [frontierError, setFrontierError] = useState('');
    const [revokeBusy, setRevokeBusy] = useState(false);
    const loadState = useCallback(async () => {
        if (!window.amplify?.lbGetSession)
            return;
        try {
            const session = await window.amplify.lbGetSession();
            setAccountState(session);
            // SEG-V0146-CRIT-2: persist user_id for ShareMnemosyneC ref= URLs (survives app restarts)
            if (session.linked && session.user_id) {
                try {
                    localStorage.setItem('mnemo_lb_user_id', session.user_id);
                }
                catch { }
            }
            if (session.linked) {
                const frontier = await window.amplify.lbGetFrontierStatus?.();
                if (frontier)
                    setFrontierState(frontier);
            }
        }
        catch {
            // Ignore load errors
        }
    }, []);
    useEffect(() => {
        void loadState();
        // Listen for auth-complete broadcasts (from deep-link or link-device IPC)
        const cleanup = window.amplify?.onLbAuthComplete?.((session) => {
            setAccountState({ linked: true, ...session });
            setLinkPhase('idle');
            // SEG-V0146-CRIT-2: persist user_id so ShareMnemosyneC.tsx can build ref= URLs
            if (session.user_id) {
                try {
                    localStorage.setItem('mnemo_lb_user_id', session.user_id);
                }
                catch { }
            }
        });
        return cleanup ?? undefined;
    }, [loadState]);
    async function handleStartAuth() {
        if (!email.trim() || !window.amplify?.lbStartAuth)
            return;
        setLinkPhase('sending');
        setLinkError('');
        try {
            const result = await window.amplify.lbStartAuth(email.trim());
            if (result.ok) {
                setLinkPhase('sent');
            }
            else {
                setLinkError(result.error ?? 'Failed to send magic link. Check your email and try again.');
                setLinkPhase('error');
            }
        }
        catch (err) {
            setLinkError(err.message);
            setLinkPhase('error');
        }
    }
    async function handleRevoke() {
        if (!window.amplify?.lbRevokeDevice)
            return;
        setRevokeBusy(true);
        try {
            await window.amplify.lbWithdrawFrontierNode?.();
            await window.amplify.lbRevokeDevice();
            setAccountState({ linked: false });
            setFrontierState({ registered: false });
            setLinkPhase('idle');
            setEmail('');
        }
        catch {
            // Ignore
        }
        finally {
            setRevokeBusy(false);
        }
    }
    async function handleJoinFrontier() {
        if (!window.amplify?.lbRegisterFrontierNode)
            return;
        setFrontierBusy(true);
        setFrontierError('');
        try {
            const result = await window.amplify.lbRegisterFrontierNode();
            if (result.ok) {
                setFrontierState({ registered: true, frontier_node_id: result.frontier_node_id });
            }
            else {
                setFrontierError(result.error ?? 'Registration failed.');
            }
        }
        catch (err) {
            setFrontierError(err.message);
        }
        finally {
            setFrontierBusy(false);
        }
    }
    async function handleLeaveFrontier() {
        if (!window.amplify?.lbWithdrawFrontierNode)
            return;
        setFrontierBusy(true);
        try {
            await window.amplify.lbWithdrawFrontierNode();
            setFrontierState({ registered: false });
        }
        catch {
            // Ignore
        }
        finally {
            setFrontierBusy(false);
        }
    }
    return (_jsxs("div", { style: s.root, children: [_jsxs("div", { children: [_jsxs("h2", { style: s.heading, children: [_jsx(NotCentsGlyph, {}), " LB Account"] }), _jsx("p", { style: { ...s.sub, marginTop: 6 }, children: "Link your Liana Banyan cooperative account to this device. Enables Frontier node registration, shared-substrate credits, and Crewman attribution." })] }), !accountState.linked && (_jsxs("div", { style: {
                    background: 'rgba(110,231,183,0.06)',
                    border: '1px solid rgba(110,231,183,0.25)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginBottom: 4 }, children: "Join the cooperative -- $5/year" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', lineHeight: 1.6 }, children: "Unlock Helm, Federation Stage 6, Banyan Metric sharing, and Crewman attribution. Free to use MnemosyneC. Better to join." })] }), _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { style: s.btnPrimary, onClick: () => {
                                    void (async () => {
                                        try {
                                            const result = await window.amplify?.membership?.createCheckout?.(false);
                                            const url = result?.url;
                                            window.amplify?.openExternal?.(url ?? 'https://lianabanyan.com/join');
                                        }
                                        catch {
                                            window.amplify?.openExternal?.('https://lianabanyan.com/join');
                                        }
                                    })();
                                }, children: "Join -- $5/year" }), _jsx("span", { style: { fontSize: 10, color: '#334155' }, children: "Using free? No account required." })] })] })), accountState.linked ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: s.cardGreen, children: [_jsxs("div", { style: s.row, children: [_jsx("span", { style: { fontSize: 18 }, children: "\u2705" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#6ee7b7' }, children: "LB Account Linked" }), accountState.crewman_number && (_jsxs("div", { style: { fontSize: 11, color: '#94a3b8' }, children: ["Crewman #", accountState.crewman_number, " on this device"] }))] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [accountState.email && (_jsxs("div", { children: [_jsx("div", { style: s.label, children: "Email" }), _jsx("div", { style: s.value, children: accountState.email })] })), accountState.linked_at && (_jsxs("div", { children: [_jsx("div", { style: s.label, children: "Linked" }), _jsx("div", { style: { ...s.value, fontSize: 11 }, children: new Date(accountState.linked_at).toLocaleDateString() })] })), accountState.peer_id && (_jsxs("div", { style: { gridColumn: '1 / -1' }, children: [_jsx("div", { style: s.label, children: "Peer ID" }), _jsxs("div", { style: { ...s.value, fontSize: 10, opacity: 0.7 }, children: [accountState.peer_id.slice(0, 20), "\u2026"] })] }))] }), _jsx("div", { children: _jsx("button", { style: s.btnDanger, onClick: handleRevoke, disabled: revokeBusy, children: revokeBusy ? 'Unlinking…' : 'Unlink This Device' }) })] }), _jsx(FrontierSection, { frontierState: frontierState, busy: frontierBusy, error: frontierError, onJoin: handleJoinFrontier, onLeave: handleLeaveFrontier }), _jsx(FrontierBorrowSection, { linked: true })] })) : (
            /* ── Unlinked State ── */
            _jsxs("div", { style: s.card, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: "Connect your Liana Banyan account" }), _jsx("p", { style: s.sub, children: "Enter your LB account email. We'll send a one-click magic link \u2014 no password needed. Click the link in your email and this device links automatically." }), linkPhase === 'sent' ? (_jsxs("div", { style: s.success, children: ["\u2709\uFE0F Magic link sent to ", _jsx("strong", { children: email }), ". Check your email and click the link to complete linking. The tab will update automatically when your device is linked."] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: s.row, children: [_jsx("input", { type: "email", placeholder: "your@email.com", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleStartAuth(), style: s.input, disabled: linkPhase === 'sending', autoComplete: "email" }), _jsx("button", { style: s.btnPrimary, onClick: handleStartAuth, disabled: linkPhase === 'sending' || !email.trim(), children: linkPhase === 'sending' ? '⟳ Sending…' : 'Link →' })] }), linkError && _jsxs("div", { style: s.error, children: ["\u26A0 ", linkError] }), linkPhase !== 'sending' && (_jsxs("p", { style: { ...s.sub, fontSize: 10 }, children: ["Don't have an LB account?", ' ', _jsx("button", { style: { background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }, onClick: () => window.amplify?.openExternal?.('https://lianabanyan.com/join'), children: "Join \u2014 $5/year \u2192" })] }))] }))] })), _jsx(PreferenceInferencePanel, {})] }));
}
// ─── Frontier Borrow Section (WAVE-24) ────────────────────────────────────────
function FrontierBorrowSection({ linked }) {
    const [borrowOptIn, setBorrowOptIn] = React.useState(false);
    const [borrowLoading, setBorrowLoading] = React.useState(false);
    const [borrowResult, setBorrowResult] = React.useState(null);
    React.useEffect(() => {
        void window.amplify?.lbGetBorrowStatus?.()
            .then((res) => { if (res)
            setBorrowOptIn(res.borrow_opt_in); })
            .catch(() => { });
    }, []);
    const handleToggleBorrow = async () => {
        const next = !borrowOptIn;
        setBorrowOptIn(next);
        await window.amplify?.lbSetBorrowOptIn?.(next).catch(() => { });
    };
    const handleRequestBorrow = async () => {
        setBorrowLoading(true);
        setBorrowResult(null);
        try {
            const res = await window.amplify?.lbRequestFrontierBorrow?.();
            setBorrowResult(res ?? { ok: false, error: 'No response from main process.' });
        }
        catch {
            setBorrowResult({ ok: false, error: 'Request failed.' });
        }
        finally {
            setBorrowLoading(false);
        }
    };
    return (_jsxs("div", { style: s.card, children: [_jsxs("div", { style: s.row, children: [_jsx("span", { style: { fontSize: 16 }, children: "+" }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: "Borrow a Frontier Node" }), _jsx("span", { style: {
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 10,
                            background: 'rgba(59,130,246,0.12)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            color: 'rgb(96,165,250)',
                            whiteSpace: 'nowrap',
                        }, children: "OPT-IN" })] }), _jsx("p", { style: s.sub, children: "Your computer is busy -- borrow a trusted Frontier node for this inference. Opt-in only. You choose which nodes to trust." }), _jsxs("div", { style: { display: 'flex', gap: 14, marginBottom: 4 }, children: [_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: '#4ade80' }, children: "$0" }), _jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: "transport" })] }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: '#94a3b8' }, children: "~$0.01" }), _jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: "compute / inference" })] })] }), !linked && (_jsx("div", { style: s.error, children: "Link your LB account above to access Frontier nodes." })), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: linked ? 'pointer' : 'not-allowed' }, children: [_jsx("input", { type: "checkbox", checked: borrowOptIn, onChange: () => void handleToggleBorrow(), disabled: !linked, style: { accentColor: '#6ee7b7', width: 14, height: 14 } }), _jsx("span", { style: { fontSize: 12, color: linked ? '#94a3b8' : '#475569' }, children: "Enable borrowing from trusted Frontier nodes" })] }), borrowOptIn && linked && (_jsxs(_Fragment, { children: [_jsx("div", { style: { ...s.sub, fontSize: 10, color: '#475569' }, children: "Trust list is shared from your LB cooperative membership. Nodes are verified cooperative members only." }), _jsx("button", { style: s.btnFrontier, onClick: () => void handleRequestBorrow(), disabled: borrowLoading, children: borrowLoading ? 'Requesting...' : 'Borrow a node for this session' }), borrowResult?.ok && (_jsxs("div", { style: s.success, children: ["Ready. ", borrowResult.disclosure ?? ''] })), borrowResult && !borrowResult.ok && (_jsx("div", { style: s.error, children: borrowResult.error }))] }))] }));
}
// ─── Frontier Section ─────────────────────────────────────────────────────────
function FrontierSection({ frontierState, busy, error, onJoin, onLeave, }) {
    return (_jsxs("div", { style: s.card, children: [_jsxs("div", { style: s.row, children: [_jsx("span", { style: { fontSize: 16 }, children: "\uD83C\uDF10" }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: "The Frontier" }), frontierState.registered && (_jsx("span", { style: s.tag('110,231,183'), children: "REGISTERED" }))] }), frontierState.registered ? (_jsxs(_Fragment, { children: [_jsx("p", { style: s.sub, children: "Your device is visible in the cooperative Frontier mesh. Withdraw anytime \u2014 this only removes your node from the public registry, not from the cooperative." }), frontierState.frontier_node_id && (_jsxs("div", { children: [_jsx("div", { style: s.label, children: "Node ID" }), _jsxs("div", { style: { ...s.value, fontSize: 10 }, children: [frontierState.frontier_node_id.slice(0, 28), "\u2026"] })] })), _jsx("div", { style: s.row, children: _jsx("span", { style: { fontSize: 10, color: '#475569' }, children: "Heartbeat: every 5 minutes" }) }), _jsx("button", { style: s.btnDanger, onClick: onLeave, disabled: busy, children: busy ? 'Withdrawing…' : 'Leave the Frontier' })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { style: s.sub, children: "Making your device visible in the Frontier cooperative mesh enables substrate peer-sync and shared memory across nodes. You can withdraw at any time." }), _jsx("p", { style: { ...s.sub, fontSize: 10, color: '#475569' }, children: "\u26A0 This makes your device visible in the cooperative mesh. Withdraw anytime. Reinstalling MnemosyneC creates a new peer ID \u2014 the old node will be orphaned until you withdraw it." }), error && _jsxs("div", { style: s.error, children: ["\u26A0 ", error] }), _jsx("button", { style: s.btnFrontier, onClick: onJoin, disabled: busy, children: busy ? 'Registering…' : 'Join the Frontier →' })] }))] }));
}
