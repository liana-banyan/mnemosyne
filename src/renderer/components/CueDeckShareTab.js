import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// MnemosyneC · v0.1.56 · BP081 · 2026-06-12
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// CueDeckShareTab — "Connect Via Invite Token Availability" tab contents.
// §3.1 MY CUE DECK CARD: always-visible own invite card + share controls.
// §3.2 RECEIVED CARDS: cards shared to this user; empty state when none.
import { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
// ── Local persistence ──────────────────────────────────────────────────────────
const LS_RECEIVED_CARDS = 'mnemo_received_cue_deck_cards';
function loadReceivedCards() {
    try {
        const raw = localStorage.getItem(LS_RECEIVED_CARDS);
        if (!raw)
            return [];
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
function saveReceivedCards(cards) {
    try {
        localStorage.setItem(LS_RECEIVED_CARDS, JSON.stringify(cards));
    }
    catch { /* non-fatal */ }
}
// ── Shared button base style ───────────────────────────────────────────────────
const BTN = {
    border: 'none',
    borderRadius: 5,
    padding: '5px 11px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
    transition: 'opacity 0.1s',
};
// ── CueDeckShareTab ────────────────────────────────────────────────────────────
export function CueDeckShareTab() {
    // §3.1 — Own card state
    const [myToken, setMyToken] = useState(null);
    const [myExpiresAt, setMyExpiresAt] = useState(null);
    const [myDisplayName, setMyDisplayName] = useState('Me');
    const [tokenLoading, setTokenLoading] = useState(false);
    const [tokenError, setTokenError] = useState(null);
    const [showQR, setShowQR] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [urlCopied, setUrlCopied] = useState(false);
    const [meshSent, setMeshSent] = useState(false);
    // §3.2 — Received cards state
    const [receivedCards, setReceivedCards] = useState(loadReceivedCards);
    const [pasteMode, setPasteMode] = useState(false);
    const [pasteToken, setPasteToken] = useState('');
    const [pasteStatus, setPasteStatus] = useState(null);
    const [connectingId, setConnectingId] = useState(null);
    const [connectedIds, setConnectedIds] = useState(new Set());
    const [dismissedIds, setDismissedIds] = useState(new Set());
    // Fetch own display name from mesh
    useEffect(() => {
        (async () => {
            try {
                const state = await window.amplify?.getMeshState?.();
                if (state?.ownDisplayName)
                    setMyDisplayName(state.ownDisplayName);
            }
            catch { /* non-fatal */ }
        })();
    }, []);
    // Generate own invite token
    const generateToken = useCallback(async () => {
        setTokenLoading(true);
        setTokenError(null);
        try {
            const rawResult = await window.amplify?.federationGenerateInvite?.();
            const result = rawResult && 'ok' in rawResult
                ? rawResult
                : { ok: true, ...rawResult };
            if (result?.token) {
                setMyToken(result.token);
                setMyExpiresAt(result.expiresAt ?? null);
            }
            else {
                setTokenError('Could not generate invite token.');
            }
        }
        catch (e) {
            setTokenError('Error: ' + String(e));
        }
        setTokenLoading(false);
    }, []);
    useEffect(() => { generateToken(); }, [generateToken]);
    const acceptUrl = myToken ? `mnemo://accept?token=${myToken}` : '';
    // Clipboard copy with every-click visible feedback (BP078)
    const copyToken = useCallback(async () => {
        if (!myToken)
            return;
        await navigator.clipboard.writeText(myToken);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
    }, [myToken]);
    const copyUrl = useCallback(async () => {
        if (!acceptUrl)
            return;
        await navigator.clipboard.writeText(acceptUrl);
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
    }, [acceptUrl]);
    const sendViaMesh = useCallback(async () => {
        if (!myToken)
            return;
        setMeshSent(false);
        try {
            await window.amplify?.meshBroadcastCard?.({ token: myToken });
        }
        catch { /* non-fatal — mesh send is best-effort */ }
        setMeshSent(true);
        setTimeout(() => setMeshSent(false), 2500);
    }, [myToken]);
    // §3.2 — Accept a manually pasted token
    const handlePasteConnect = useCallback(async () => {
        if (!pasteToken.trim())
            return;
        setPasteStatus('Connecting…');
        try {
            const result = await window.amplify?.federationAcceptInvite?.(pasteToken.trim());
            if (result?.success) {
                const newCard = {
                    id: crypto.randomUUID?.() ?? String(Date.now()),
                    senderName: result.peerName ?? 'Unknown peer',
                    token: pasteToken.trim(),
                    receivedAt: new Date().toISOString(),
                };
                const updated = [...receivedCards, newCard];
                setReceivedCards(updated);
                saveReceivedCards(updated);
                setPasteStatus(`Connected to ${result.peerName ?? 'peer'} ✓`);
                setPasteToken('');
                setPasteMode(false);
                setTimeout(() => setPasteStatus(null), 3000);
            }
            else {
                setPasteStatus(result?.error ?? 'Connection failed — check the token and try again.');
            }
        }
        catch {
            setPasteStatus('Connection error. Please try again.');
        }
    }, [pasteToken, receivedCards]);
    // Re-connect to a received card
    const handleConnect = useCallback(async (card) => {
        setConnectingId(card.id);
        try {
            const result = await window.amplify?.federationAcceptInvite?.(card.token);
            if (result?.success) {
                setConnectedIds(prev => new Set([...prev, card.id]));
            }
        }
        catch { /* non-fatal */ }
        setConnectingId(null);
    }, []);
    const handleDismiss = (id) => {
        setDismissedIds(prev => new Set([...prev, id]));
    };
    const visibleCards = receivedCards.filter(c => !dismissedIds.has(c.id));
    return (_jsxs("div", { style: { marginTop: 12 }, children: [_jsxs("div", { style: {
                    background: '#0d1b2a',
                    border: '1px solid rgba(110, 231, 183, 0.25)',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: 8 }, children: [_jsx("span", { style: {
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#6ee7b7',
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                }, children: "\u2B21 My Cue Deck Card" }), _jsx("span", { style: { fontSize: 10, color: '#334155', marginLeft: 'auto' }, children: "always available" })] }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }, children: myDisplayName }), tokenLoading && (_jsx("div", { style: { fontSize: 11, color: '#f59e0b', marginBottom: 8 }, children: "Generating token\u2026" })), tokenError && !tokenLoading && (_jsxs("div", { style: { fontSize: 11, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }, children: [tokenError, _jsx("button", { onClick: generateToken, style: { ...BTN, background: 'none', color: '#6ee7b7', border: '1px solid #1e4038' }, children: "Retry" })] })), myToken && !tokenLoading && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                    background: '#111827',
                                    border: '1px solid #1e2d45',
                                    borderRadius: 4,
                                    padding: '5px 8px',
                                    fontFamily: 'monospace',
                                    fontSize: 10,
                                    color: '#94a3b8',
                                    wordBreak: 'break-all',
                                    marginBottom: 6,
                                    lineHeight: 1.5,
                                }, children: myToken }), myExpiresAt && (_jsxs("div", { style: { fontSize: 10, color: '#475569', marginBottom: 8 }, children: ["Expires: ", new Date(myExpiresAt).toLocaleString()] })), _jsxs("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: showQR ? 10 : 0 }, children: [_jsx("button", { onClick: copyToken, style: {
                                            ...BTN,
                                            background: tokenCopied ? '#14532d' : '#1e3a5c',
                                            color: tokenCopied ? '#22c55e' : '#6ee7b7',
                                            border: `1px solid ${tokenCopied ? '#22c55e55' : '#1e4038'}`,
                                        }, children: tokenCopied ? '✓ Copied!' : '📋 Copy Token' }), _jsx("button", { onClick: copyUrl, style: {
                                            ...BTN,
                                            background: urlCopied ? '#14532d' : '#1e3a5c',
                                            color: urlCopied ? '#22c55e' : '#6ee7b7',
                                            border: `1px solid ${urlCopied ? '#22c55e55' : '#1e4038'}`,
                                        }, children: urlCopied ? '✓ Copied!' : '🔗 Copy Link' }), _jsx("button", { onClick: () => setShowQR(v => !v), style: {
                                            ...BTN,
                                            background: showQR ? '#2d1b69' : '#1e1a38',
                                            color: '#a78bfa',
                                            border: '1px solid #2d1b4e',
                                        }, children: showQR ? '▲ Hide QR' : '▦ QR Code' }), _jsx("button", { onClick: sendViaMesh, style: {
                                            ...BTN,
                                            background: meshSent ? '#14532d' : '#1e2a38',
                                            color: meshSent ? '#22c55e' : '#94a3b8',
                                            border: `1px solid ${meshSent ? '#22c55e55' : '#1e2a38'}`,
                                        }, children: meshSent ? '✓ Sent!' : '⬡ Send via Mesh' }), _jsx("button", { onClick: generateToken, disabled: tokenLoading, title: "Generate a fresh token", style: { ...BTN, background: 'none', color: '#475569', border: '1px solid #1e2a38' }, children: "\u21BB Refresh" })] }), showQR && acceptUrl && (_jsxs("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: 12,
                                    background: '#111827',
                                    border: '1px solid #1e2d45',
                                    borderRadius: 6,
                                    marginTop: 8,
                                }, children: [_jsx(QRCodeCanvas, { value: acceptUrl, size: 160, bgColor: "#111827", fgColor: "#e2e8f0" }), _jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: "Scan to accept on another device" })] }))] }))] }), _jsxs("div", { style: {
                    background: '#0d1117',
                    border: '1px solid #1e2a38',
                    borderRadius: 8,
                    padding: 12,
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: 8 }, children: [_jsx("span", { style: {
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#94a3b8',
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                }, children: "\u2193 Received Cards" }), _jsx("button", { onClick: () => { setPasteMode(v => !v); setPasteStatus(null); }, style: {
                                    ...BTN,
                                    marginLeft: 'auto',
                                    background: 'none',
                                    color: '#6ee7b7',
                                    border: '1px solid #1e4038',
                                    padding: '3px 8px',
                                    fontSize: 10,
                                }, children: pasteMode ? '✕ Cancel' : '+ Paste Token' })] }), pasteMode && (_jsxs("div", { style: { marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx("input", { value: pasteToken, onChange: (e) => setPasteToken(e.target.value), placeholder: "mnemo-invite-\u2026", onKeyDown: (e) => { if (e.key === 'Enter')
                                    handlePasteConnect(); }, style: {
                                    background: '#111827',
                                    border: '1px solid #1e2a38',
                                    borderRadius: 4,
                                    color: '#f0fdf4',
                                    fontSize: 11,
                                    padding: '4px 8px',
                                    outline: 'none',
                                    flex: 1,
                                    minWidth: 140,
                                    fontFamily: 'system-ui, sans-serif',
                                } }), _jsx("button", { onClick: handlePasteConnect, style: { ...BTN, background: '#10b981', color: '#fff' }, children: "Connect" }), pasteStatus && (_jsx("span", { style: { fontSize: 11, color: pasteStatus.includes('✓') ? '#22c55e' : '#94a3b8' }, children: pasteStatus }))] })), visibleCards.length === 0 && !pasteMode && (_jsx("div", { style: { fontSize: 11, color: '#475569', fontStyle: 'italic', padding: '4px 0 2px' }, children: "No cards received yet \u2014 share yours to invite others" })), visibleCards.length > 0 && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: visibleCards.map((card) => {
                            const isConnecting = connectingId === card.id;
                            const isConnected = connectedIds.has(card.id);
                            return (_jsxs("div", { style: {
                                    background: '#111827',
                                    border: `1px solid ${isConnected ? 'rgba(34,197,94,0.25)' : '#1e2d45'}`,
                                    borderRadius: 6,
                                    padding: '8px 10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0' }, children: card.senderName }), _jsxs("div", { style: { fontSize: 10, color: '#475569' }, children: ["Received ", new Date(card.receivedAt).toLocaleString()] })] }), _jsx("button", { onClick: () => handleConnect(card), disabled: isConnecting || isConnected, style: {
                                            ...BTN,
                                            background: isConnected ? '#14532d' : '#10b981',
                                            color: '#fff',
                                            padding: '3px 8px',
                                            fontSize: 10,
                                            opacity: isConnecting ? 0.6 : 1,
                                        }, children: isConnected ? 'Connected ✓' : isConnecting ? 'Connecting…' : 'Connect' }), _jsx("button", { onClick: () => handleDismiss(card.id), title: "Dismiss", style: { ...BTN, background: 'none', color: '#475569', border: 'none', padding: '3px 5px', fontSize: 13 }, children: "\u2715" })] }, card.id));
                        }) }))] })] }));
}
export default CueDeckShareTab;
