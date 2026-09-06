import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// MnemosyneC — Federation Tab (MV-J Full Surface)
// SAGA 4 BP045 W1 — extends FederationPeerMeshPanel
//
// Surfaces:
//   1. SVG mesh visualizer — self at center, peers as orbiting nodes
//   2. Peer roster — name · pubkey-short · joined · last-sync · leave button
//   3. Invite flow — generate 24h signed token + copy-to-clipboard
//   4. Accept flow — paste-token + verify + join-mesh confirmation
//   5. Empty state — cooperative-class, no mock peers
//   6. Fleet Health — D7 per-peer health verdict panel (BP105)
import { useEffect, useState, useCallback, useRef } from 'react';
import { PeerCueCard } from './PeerCueCard';
import { FleetHealthPanel } from '../hearth/active_substrate/FleetHealthPanel';
// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    bg: '#0a0f1a',
    surface: '#111827',
    border: '#1e2d45',
    text: '#e2e8f0',
    muted: '#64748b',
    accent: '#3b82f6',
    green: '#22c55e',
    amber: '#f59e0b',
    red: '#ef4444',
    purple: '#a78bfa',
};
// ─── SVG Mesh Visualizer ──────────────────────────────────────────────────────
function MeshVisualizer({ peers, ownId }) {
    const W = 340;
    const H = 240;
    const cx = W / 2;
    const cy = H / 2;
    const R = 80;
    const nodes = peers.map((p, i) => {
        const angle = (2 * Math.PI * i) / Math.max(peers.length, 1) - Math.PI / 2;
        return {
            ...p,
            x: cx + R * Math.cos(angle),
            y: cy + R * Math.sin(angle),
        };
    });
    const phaseColor = (phase) => {
        if (phase === 'synced')
            return C.green;
        if (phase === 'ratified')
            return C.purple;
        if (phase === 'identified')
            return C.accent;
        if (phase === 'discovered')
            return C.amber;
        return C.red;
    };
    return (_jsxs("svg", { width: W, height: H, style: { display: 'block', margin: '0 auto' }, "aria-label": "Federation peer mesh visualizer", children: [nodes.map((n) => (_jsx("line", { x1: cx, y1: cy, x2: n.x, y2: n.y, stroke: phaseColor(n.phase), strokeWidth: 1, strokeOpacity: 0.35, strokeDasharray: n.phase === 'synced' ? undefined : '4 3' }, `line-${n.peerId}`))), _jsx("circle", { cx: cx, cy: cy, r: 18, fill: "#1e3a5f", stroke: C.accent, strokeWidth: 2 }), _jsx("text", { x: cx, y: cy - 24, textAnchor: "middle", fontSize: 9, fill: C.muted, children: ownId ? ownId.slice(0, 6) + '…' : 'You' }), _jsx("text", { x: cx, y: cy + 4, textAnchor: "middle", fontSize: 9, fill: C.accent, fontWeight: "700", children: "ME" }), nodes.map((n) => (_jsxs("g", { children: [_jsx("circle", { cx: n.x, cy: n.y, r: 12, fill: "#1a2235", stroke: phaseColor(n.phase), strokeWidth: 1.5 }), _jsx("text", { x: n.x, y: n.y + 4, textAnchor: "middle", fontSize: 7, fill: C.text, children: (n.displayName ?? n.peerId).slice(0, 6) })] }, `node-${n.peerId}`))), peers.length === 0 && (_jsxs(_Fragment, { children: [_jsx("circle", { cx: cx, cy: cy, r: 60, fill: "none", stroke: C.border, strokeWidth: 1, strokeDasharray: "4 4" }), _jsx("text", { x: cx, y: cy + 80, textAnchor: "middle", fontSize: 10, fill: C.muted, children: "No peers in mesh" })] }))] }));
}
// ─── Peer Roster ──────────────────────────────────────────────────────────────
// Renders peers as a flex-wrap card grid using PeerCueCard.
// BP132 Yoke #22 Addendum A: `federation:connect-peer` IPC handler + preload
// exposure already exist (confirmed by source read) — see handleConnectPeer below.
function PeerRoster({ peers, onLeave, onConnect }) {
    if (peers.length === 0) {
        return (_jsxs("div", { style: s.emptyBox, children: [_jsx("div", { style: { fontSize: 28, marginBottom: 8 }, children: "\uD83D\uDD78\uFE0F" }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }, children: "You are not yet federated." }), _jsxs("div", { style: { fontSize: 11, color: C.muted, lineHeight: 1.6 }, children: ["Invite a peer or accept an invitation to join a mesh.", _jsx("br", {}), "Federation is cooperative-class: opt-in, sovereign, per-folder."] })] }));
    }
    return (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 12, padding: 8 }, children: peers.map((peer) => (_jsx(PeerCueCard, { peer: peer, onConnect: onConnect }, peer.peerId))) }));
}
// ─── Invite Cue Card Preview ──────────────────────────────────────────────────
// SEG-V0153A-P0-INVITE-FORM: stacked pair (FRONT=brand/identity, BACK=action).
// NOT a CSS 3D flip — vertically stacked display in-app alongside the form.
function InviteCueCardPreview({ displayName, recipientName, }) {
    const CARD_W = 280;
    const CARD_H = 160;
    const recipientLabel = recipientName.trim()
        ? `${recipientName.trim()}'s MnemosyneC network`
        : 'Your MnemosyneC network';
    const isHandleStyle = displayName.startsWith('@') || displayName.includes('#');
    return (_jsxs("div", { style: { marginTop: 8 }, children: [_jsx("div", { style: {
                    fontSize: 9, color: '#475569', marginBottom: 6,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                }, children: "Your Invite Card Preview" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsxs("div", { style: {
                            width: CARD_W, height: CARD_H,
                            background: '#0a0f1a',
                            border: '1px solid #6ee7b7',
                            borderRadius: 10,
                            padding: '12px 14px',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                        }, children: [_jsx("div", { style: { fontSize: 18, lineHeight: 1 }, children: "\uD83E\uDDE0" }), _jsx("div", { style: {
                                    textAlign: 'center',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: isHandleStyle ? '#6ee7b7' : '#e2e8f0',
                                }, children: displayName }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }, children: [_jsx("div", { style: {
                                            fontSize: 9, color: '#475569',
                                            letterSpacing: '0.06em', textTransform: 'uppercase',
                                        }, children: "FounderDenken" }), _jsx("div", { style: {
                                            width: 16, height: 16, background: '#1a2235',
                                            borderRadius: 3, border: '1px solid #1e2d45',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 7, color: '#475569',
                                        }, children: "QR" })] })] }), _jsxs("div", { style: {
                            width: CARD_W, height: CARD_H,
                            background: '#0a0f1a',
                            border: '1px solid #22c55e',
                            borderRadius: 10,
                            padding: '12px 14px',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                        }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.08em' }, children: "MnemosyneC" }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 12, color: '#e2e8f0', marginBottom: 8 }, children: recipientLabel }), _jsx("div", { style: {
                                            width: 16, height: 16, background: '#1a2235',
                                            borderRadius: 3, border: '1px solid #1e2d45',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 7, color: '#475569',
                                        }, children: "QR" })] }), _jsx("div", { style: { fontSize: 11, color: '#94a3b8', textAlign: 'center' }, children: "Scan to accept \u2191" })] })] })] }));
}
// ─── Invite Flow ──────────────────────────────────────────────────────────────
// SEG-V0153A-P0-INVITE-FORM + SEG-V0153A-INVITE-FORM-ENHANCE
//
// Truth-Always flags:
//   [T1] window.amplify.getProfile does NOT exist in preload.ts.
//        displayName is sourced from getAuthState().member?.display_name (FederationTab state),
//        passed as prop to InviteFlow. Falls back to "Your Name" for resolvedDisplayName,
//        and to "you" for the Sign-this-card checkbox label.
//   [T2] window.amplify.openExternal IS confirmed in preload.ts (ipcRenderer.send — fire-and-forget,
//        no Promise return). 3s timeout used to transition to success state.
//   [T3] Sent invites history (Part C): P1-DEFERRED — not implemented in this version.
//        Shape: localStorage key 'mnemosynec.sent_invites', capped 20 entries.
//   [T4] Cooldown IPC shape: SEG-P1-REJECTION-COOLDOWN may not have landed yet.
//        Both old shape { token, expiresAt } and new shape { ok, ... } are handled gracefully.
export function InviteFlow({ displayName }) {
    const resolvedDisplayName = displayName?.trim() || 'Your Name';
    // — Primary form state —
    const [recipientName, setRecipientName] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [personalNote, setPersonalNote] = useState('');
    const [sendStatus, setSendStatus] = useState('idle');
    const [emailError, setEmailError] = useState(null);
    const [sentToken, setSentToken] = useState(null);
    const [sendError, setSendError] = useState(null);
    const [tokenCopied, setTokenCopied] = useState(false);
    const openTimeoutRef = useRef(null);
    // — Cooldown state —
    const [cooldownActive, setCooldownActive] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    // — Sign card state —
    const [signCard, setSignCard] = useState(true);
    // — Legacy manual token state (collapsible fallback) —
    const [legacyToken, setLegacyToken] = useState(null);
    const [legacyLoading, setLegacyLoading] = useState(false);
    const [legacyCopied, setLegacyCopied] = useState(false);
    const [legacyError, setLegacyError] = useState(null);
    const isBusy = sendStatus === 'validating' ||
        sendStatus === 'generating' ||
        sendStatus === 'opening';
    // Live countdown — ticks every 60 s; clears cooldown when ≤ 60 s remain
    useEffect(() => {
        if (!cooldownActive || cooldownSeconds <= 0)
            return;
        const interval = setInterval(() => {
            setCooldownSeconds(s => {
                if (s <= 60) {
                    setCooldownActive(false);
                    clearInterval(interval);
                    return 0;
                }
                return s - 60;
            });
        }, 60000);
        return () => clearInterval(interval);
    }, [cooldownActive, cooldownSeconds]);
    const handleSend = async () => {
        if (isBusy)
            return;
        // Step 1 — immediate feedback on every click
        setSendStatus('validating');
        setEmailError(null);
        setSendError(null);
        // Step 2 — validate email
        if (!/.+@.+\..+/.test(recipientEmail.trim())) {
            setEmailError('Please enter a valid email address.');
            setSendStatus('idle');
            return;
        }
        // Step 3 — generate token
        setSendStatus('generating');
        let inviteToken;
        let expiresAt;
        try {
            const rawResult = await window.amplify?.federationGenerateInvite?.();
            // Support both old shape { token, expiresAt } and new shape { ok, token, expiresAt } | { ok: false, error, wait_seconds }
            const result = rawResult && 'ok' in rawResult ? rawResult : { ok: true, ...rawResult };
            if (!result.ok && result.error === 'cooldown') {
                setCooldownSeconds(result.wait_seconds ?? 3600);
                setCooldownActive(true);
                setSendStatus('idle');
                return;
            }
            if (result?.token) {
                inviteToken = result.token;
                expiresAt = result.expiresAt;
            }
            else {
                inviteToken = `mnemo-invite-${crypto.randomUUID?.() ?? Date.now()}`;
                expiresAt = new Date(Date.now() + 86400000).toISOString();
            }
        }
        catch (e) {
            setSendStatus('error');
            setSendError('Failed to generate invite token: ' + String(e));
            return;
        }
        // Steps 4–5 — compose accept link + mailto body
        const acceptLink = `mnemo://accept?token=${inviteToken}`;
        const note = personalNote.trim();
        const fromLine = signCard ? `From: ${resolvedDisplayName}\n` : '';
        const noteBlock = signCard && note ? `\n${note}\n` : '';
        const body = fromLine +
            noteBlock +
            (fromLine || noteBlock ? '\n' : '') +
            "I'd like to share context with you via MnemosyneC.\n\n" +
            `Click to accept:\n${acceptLink}\n\n` +
            `Or paste this token in MnemosyneC → Federation → Accept tab:\n${inviteToken}\n\n` +
            `This invite expires: ${new Date(expiresAt).toLocaleString()}\n\n` +
            'Get MnemosyneC: https://mnemosynec.ai';
        const subjectRecipient = recipientName.trim();
        const mailtoUrl = 'mailto:' + encodeURIComponent(recipientEmail.trim()) +
            '?subject=' + encodeURIComponent(subjectRecipient
            ? `${subjectRecipient}, you're invited to join MnemosyneC`
            : "You're invited to join MnemosyneC") +
            '&body=' + encodeURIComponent(body);
        // Step 6 — fire openExternal ([T2] fire-and-forget, no await)
        setSendStatus('opening');
        setSentToken(inviteToken);
        window.amplify?.openExternal?.(mailtoUrl);
        // Step 7 — 3s timeout then show success (openExternal has no return value)
        if (openTimeoutRef.current)
            clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = setTimeout(() => {
            setSendStatus('success');
        }, 3000);
    };
    const copyFallbackToken = async () => {
        if (!sentToken)
            return;
        try {
            await navigator.clipboard.writeText(sentToken);
            setTokenCopied(true);
            setTimeout(() => setTokenCopied(false), 2000);
        }
        catch { /* ignore */ }
    };
    const resetForm = () => {
        if (openTimeoutRef.current)
            clearTimeout(openTimeoutRef.current);
        setSendStatus('idle');
        setEmailError(null);
        setSendError(null);
        setSentToken(null);
        setTokenCopied(false);
        setRecipientName('');
        setRecipientEmail('');
        setPersonalNote('');
    };
    const sendButtonLabel = () => {
        switch (sendStatus) {
            case 'validating': return '⏳ Validating…';
            case 'generating': return '🔑 Generating…';
            case 'opening': return '📧 Opening email client…';
            default: return '✉️ Send Invite Card';
        }
    };
    // — Legacy handlers —
    const legacyGenerate = async () => {
        setLegacyLoading(true);
        setLegacyError(null);
        try {
            const result = await window.amplify?.federationGenerateInvite?.();
            if (result?.token) {
                setLegacyToken({ token: result.token, expiresAt: result.expiresAt });
            }
            else {
                setLegacyToken({
                    token: `mnemo-invite-${crypto.randomUUID?.() ?? Date.now()}`,
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                });
            }
        }
        catch (e) {
            setLegacyError(String(e));
        }
        finally {
            setLegacyLoading(false);
        }
    };
    const legacyCopy = async () => {
        if (!legacyToken)
            return;
        try {
            await navigator.clipboard.writeText(legacyToken.token);
            setLegacyCopied(true);
            setTimeout(() => setLegacyCopied(false), 2000);
        }
        catch {
            setLegacyError('Could not copy to clipboard.');
        }
    };
    const legacyExpiresLabel = legacyToken
        ? new Date(legacyToken.expiresAt).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        : '';
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [sendStatus === 'success' ? (
            /* ── Success state ── */
            _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("div", { style: {
                            fontSize: 12, color: C.green, padding: '10px 14px',
                            background: '#0a1f0e', borderRadius: 8,
                            border: `1px solid ${C.green}44`, lineHeight: 1.6,
                        }, children: "\u2713 Invite opened in your email client. Check your drafts." }), sentToken && (_jsxs("div", { style: s.tokenBox, children: [_jsx("div", { style: { fontSize: 10, color: C.muted, marginBottom: 6 }, children: "Fallback token \u2014 paste in Accept tab if email client didn't open" }), _jsx("div", { style: {
                                    fontFamily: 'monospace', fontSize: 10, color: C.accent,
                                    wordBreak: 'break-all', lineHeight: 1.5,
                                    background: '#070d1a', padding: '6px 10px', borderRadius: 6,
                                    border: `1px solid ${C.border}`,
                                }, children: sentToken }), _jsx("button", { onClick: () => void copyFallbackToken(), style: { ...s.ghostBtn, marginTop: 6, fontSize: 10 }, children: tokenCopied ? '✓ Copied!' : '📋 Copy token' })] })), _jsx("button", { onClick: resetForm, style: s.ghostBtn, children: "Send another invite" })] })) : (
            /* ── Form state ── */
            _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: cooldownActive ? (
                /* ── Cooldown banner — replaces form fields ── */
                _jsxs("div", { style: {
                        background: '#1a1200',
                        border: '1px solid #d97706',
                        borderRadius: 8,
                        padding: '12px 16px',
                        color: '#d97706',
                        fontSize: 13,
                    }, children: ["\u23F3 You can send your next invite in ", Math.ceil(cooldownSeconds / 60), " minute", Math.ceil(cooldownSeconds / 60) !== 1 ? 's' : '', ".", _jsx("div", { style: { fontSize: 11, color: '#92400e', marginTop: 4 }, children: "Invite responsibly \u2014 senders who get rejected too often enter a cooldown period." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 11, color: C.muted, lineHeight: 1.6 }, children: "Send a signed invite \u2014 valid 24 hours, single-use. Opens your mail client." }), _jsxs("div", { children: [_jsx("input", { type: "text", value: recipientName, onChange: (e) => setRecipientName(e.target.value), placeholder: "Their name", disabled: isBusy, maxLength: 60, style: s.input }), recipientName.length > 40 && (_jsxs("div", { style: { fontSize: 9, textAlign: 'right', marginTop: 2, color: C.muted }, children: [recipientName.length, "/60"] }))] }), _jsxs("div", { children: [_jsx("input", { type: "email", value: recipientEmail, onChange: (e) => { setRecipientEmail(e.target.value); setEmailError(null); }, placeholder: "their@email.com", disabled: isBusy, style: {
                                        ...s.input,
                                        borderColor: emailError ? C.red : undefined,
                                    } }), emailError && (_jsx("div", { style: { fontSize: 10, color: C.red, marginTop: 4 }, children: emailError }))] }), _jsxs("div", { children: [_jsx("textarea", { value: personalNote, onChange: (e) => setPersonalNote(e.target.value.slice(0, 280)), placeholder: "Why you're inviting them\u2026 (optional)", rows: 3, disabled: isBusy, style: { ...s.input, resize: 'vertical', fontFamily: 'inherit', fontSize: 11 } }), personalNote.length > 220 && (_jsxs("div", { style: {
                                        fontSize: 9, textAlign: 'right', marginTop: 2,
                                        color: personalNote.length >= 280 ? C.red : C.muted,
                                    }, children: [personalNote.length, "/280"] }))] }), sendError && (_jsx("div", { style: { fontSize: 10, color: C.red, padding: '6px 10px', background: '#1c0808', borderRadius: 6 }, children: sendError })), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: signCard, onChange: (e) => setSignCard(e.target.checked), style: { cursor: 'pointer' } }), "Sign this card as ", _jsx("span", { style: { color: '#6ee7b7', marginLeft: 4 }, children: displayName?.trim() || 'you' })] }), _jsx("button", { onClick: () => void handleSend(), disabled: isBusy, style: {
                                ...s.primaryBtn,
                                background: '#0e2a1a',
                                border: `1px solid ${C.green}`,
                                color: C.green,
                                opacity: isBusy ? 0.7 : 1,
                            }, children: sendButtonLabel() }), _jsx(InviteCueCardPreview, { displayName: resolvedDisplayName, recipientName: recipientName })] })) })), _jsxs("details", { style: { marginTop: 4 }, children: [_jsx("summary", { style: {
                            fontSize: 10, color: C.muted, cursor: 'pointer',
                            userSelect: 'none', padding: '4px 0', listStyle: 'none',
                        }, children: "\u25B8 Generate token manually (copy-paste fallback)" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }, children: [legacyError && (_jsx("div", { style: { fontSize: 10, color: C.red, padding: '6px 10px', background: '#1c0808', borderRadius: 6 }, children: legacyError })), !legacyToken ? (_jsx("button", { onClick: () => void legacyGenerate(), disabled: legacyLoading, style: s.primaryBtn, children: legacyLoading ? '⏳ Generating…' : '🔑 Generate Invite Token' })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: s.tokenBox, children: [_jsxs("div", { style: { fontSize: 10, color: C.muted, marginBottom: 6 }, children: ["Invite token \u00B7 expires ", legacyExpiresLabel] }), _jsx("div", { style: {
                                                    fontFamily: 'monospace', fontSize: 11, color: C.accent,
                                                    wordBreak: 'break-all', lineHeight: 1.5,
                                                    background: '#070d1a', padding: '8px 10px', borderRadius: 6,
                                                    border: `1px solid ${C.border}`,
                                                }, children: legacyToken.token })] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: () => void legacyCopy(), style: s.primaryBtn, children: legacyCopied ? '✓ Copied!' : '📋 Copy Token' }), _jsx("button", { onClick: () => { setLegacyToken(null); setLegacyCopied(false); }, style: s.ghostBtn, children: "Regenerate" })] }), _jsx("div", { style: { fontSize: 10, color: C.muted }, children: "\u26A0\uFE0F Single-use. Do not share publicly. Expires in 24 hours." })] }))] })] })] }));
}
// ─── Accept Flow ──────────────────────────────────────────────────────────────
function AcceptFlow({ initialToken }) {
    const [tokenInput, setTokenInput] = useState(initialToken ?? '');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [deepLinkBanner, setDeepLinkBanner] = useState(!!initialToken);
    const [rejecting, setRejecting] = useState(false);
    // SEG-V0153A: when a new initialToken arrives (deep-link), pre-populate input + show banner
    useEffect(() => {
        if (initialToken) {
            setTokenInput(initialToken);
            setStatus('idle');
            setMessage('');
            setDeepLinkBanner(true);
        }
    }, [initialToken]);
    const verify = async () => {
        const t = tokenInput.trim();
        if (!t)
            return;
        setStatus('verifying');
        setMessage('');
        try {
            const result = await window.amplify?.federationAcceptInvite?.(t);
            if (result?.success) {
                setStatus('success');
                setMessage(result.peerName
                    ? `Joined mesh with ${result.peerName}. Handshake initiated.`
                    : 'Token accepted. Handshake initiated.');
            }
            else {
                setStatus('error');
                setMessage(result?.error ?? 'Token could not be verified. It may be expired or already used.');
            }
        }
        catch (e) {
            setStatus('error');
            setMessage('Verification failed: ' + String(e));
        }
    };
    const reset = () => {
        setTokenInput('');
        setStatus('idle');
        setMessage('');
        setDeepLinkBanner(false);
    };
    const handleRejectInvite = async () => {
        if (rejecting || !tokenInput.trim())
            return;
        setRejecting(true);
        void window.amplify?.federationRejectInvite?.({
            invite_token: tokenInput.trim(),
            source: 'in_app',
        });
        setTimeout(() => {
            setTokenInput('');
            setStatus('idle');
            setMessage('');
            setDeepLinkBanner(false);
            setRejecting(false);
        }, 1500);
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [deepLinkBanner && status !== 'success' && (_jsxs("div", { style: { fontSize: 11, color: C.accent, padding: '8px 12px', background: '#0d1f38', borderRadius: 8, border: `1px solid ${C.accent}55` }, children: ["\uD83D\uDD17 Token received! Click ", _jsx("strong", { children: "Verify & Join Mesh" }), " to connect."] })), _jsx("div", { style: { fontSize: 11, color: C.muted, lineHeight: 1.6 }, children: "Paste an invite token from a peer. MnemosyneC will verify the signature and initiate the mesh handshake." }), status === 'success' && (_jsxs("div", { style: { fontSize: 11, color: C.green, padding: '8px 12px', background: '#0a1f0e', borderRadius: 8, border: `1px solid ${C.green}44` }, children: ["\u2713 ", message, _jsx("div", { style: { marginTop: 8 }, children: _jsx("button", { onClick: reset, style: s.ghostBtn, children: "Accept another token" }) })] })), status !== 'success' && (_jsxs(_Fragment, { children: [_jsx("textarea", { value: tokenInput, onChange: (e) => setTokenInput(e.target.value), placeholder: "Paste invite token here\u2026", rows: 3, style: {
                            ...s.input,
                            resize: 'vertical',
                            fontFamily: 'monospace',
                            fontSize: 11,
                        }, disabled: status === 'verifying' }), status === 'error' && (_jsxs("div", { style: { fontSize: 10, color: C.red, padding: '6px 10px', background: '#1c0808', borderRadius: 6 }, children: ["\u2717 ", message] })), _jsx("button", { onClick: () => void verify(), disabled: !tokenInput.trim() || status === 'verifying', style: s.primaryBtn, children: status === 'verifying' ? '⏳ Verifying…' : '🤝 Verify & Join Mesh' }), tokenInput.trim() && (_jsx("button", { style: {
                            marginTop: 8,
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid #475569',
                            color: '#64748b',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                        }, onClick: () => void handleRejectInvite(), disabled: rejecting, children: rejecting ? 'Dismissed' : 'Not interested' }))] }))] }));
}
// ─── Main FederationTab ───────────────────────────────────────────────────────
export function FederationTab() {
    const [meshState, setMeshState] = useState({
        peers: [],
        relayConnected: false,
        ownPeerId: '',
    });
    const [activeTab, setActiveTab] = useState('mesh');
    const [loading, setLoading] = useState(true);
    const [displayName, setDisplayName] = useState(undefined);
    // SEG-V0153A: deep-link token from mnemo://accept?token=<token>
    const [deepLinkToken, setDeepLinkToken] = useState(undefined);
    useEffect(() => {
        void (async () => {
            try {
                const authState = await window.amplify?.getAuthState?.();
                const name = authState?.member?.display_name;
                if (name)
                    setDisplayName(name);
            }
            catch { /* non-fatal */ }
        })();
    }, []);
    const loadMesh = useCallback(async () => {
        try {
            const state = await window.amplify?.getMeshState?.();
            if (state)
                setMeshState(state);
        }
        catch { /* ignore */ }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadMesh();
        const iv = setInterval(() => void loadMesh(), 5000);
        const c1 = window.amplify?.onMeshStateChanged?.((s) => setMeshState(s));
        const c2 = window.amplify?.onRelayStateChanged?.((s) => setMeshState((prev) => ({ ...prev, ...s })));
        return () => {
            clearInterval(iv);
            c1?.();
            c2?.();
        };
    }, [loadMesh]);
    // SEG-V0153A: listen for mnemo://accept?token=<token> deep-link from main process
    useEffect(() => {
        const cleanup = window.amplify?.onFederationDeepLinkAccept?.((data) => {
            setDeepLinkToken(data.token);
            setActiveTab('accept');
        });
        return () => cleanup?.();
    }, []);
    const handleLeave = async (peerId) => {
        if (!confirm('Leave mesh with this peer? They will still exist in their own mesh.'))
            return;
        try {
            await window.amplify?.federationLeavePeer?.(peerId);
            await loadMesh();
        }
        catch { /* ignore */ }
    };
    // BP132 Yoke #22 Addendum A: the `federation:connect-peer` IPC handler + preload
    // exposure (`federationConnectPeer`) were confirmed to ALREADY EXIST (src/main/index.ts
    // ~3473, preload.ts ~457) — this comment previously claimed otherwise (SEG-V0153A/BP079
    // era, now stale). The real gap was that this component never called it. Fixed.
    const handleConnectPeer = async (peerId) => {
        try {
            await window.amplify?.federationConnectPeer?.(peerId);
            await loadMesh();
        }
        catch { /* ignore — visual feedback is handled by PeerCueCard's local state */ }
    };
    const TABS = [
        { id: 'mesh', label: '🕸️ Mesh' },
        { id: 'fleet', label: '🩺 Fleet' },
        { id: 'roster', label: '📋 Roster' },
        { id: 'invite', label: '🔑 Invite' },
        { id: 'accept', label: '🤝 Accept' },
    ];
    return (_jsxs("div", { style: s.root, children: [_jsxs("div", { style: s.header, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 15, fontWeight: 700, color: C.text }, children: "Federation" }), _jsx("div", { style: { fontSize: 10, color: C.muted, marginTop: 2 }, children: "Cooperative peer-to-peer mesh \u00B7 sovereign \u00B7 opt-in" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("div", { style: {
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: meshState.relayConnected ? C.green : C.muted,
                                } }), _jsx("span", { style: { fontSize: 10, color: meshState.relayConnected ? C.green : C.muted }, children: meshState.relayConnected ? 'Relay' : 'No relay' }), _jsxs("span", { style: { fontSize: 10, color: C.muted, marginLeft: 8 }, children: [meshState.peers.length, " peer", meshState.peers.length !== 1 ? 's' : ''] })] })] }), _jsx("div", { style: s.tabBar, children: TABS.map(({ id, label }) => (_jsx("button", { onClick: () => setActiveTab(id), style: {
                        ...s.tabBtn,
                        background: activeTab === id ? '#1e3a5f' : 'transparent',
                        color: activeTab === id ? C.accent : C.muted,
                        borderBottom: activeTab === id ? `2px solid ${C.accent}` : '2px solid transparent',
                    }, children: label }, id))) }), _jsx("div", { style: s.body, children: loading && activeTab === 'mesh' ? (_jsx("div", { style: { textAlign: 'center', color: C.muted, padding: 24, fontSize: 11 }, children: "Scanning\u2026" })) : activeTab === 'fleet' ? (_jsx(FleetHealthPanel, {})) : activeTab === 'mesh' ? (_jsx(MeshVisualizer, { peers: meshState.peers, ownId: meshState.ownPeerId })) : activeTab === 'roster' ? (_jsx(PeerRoster, { peers: meshState.peers, onLeave: (id) => void handleLeave(id), onConnect: (id) => void handleConnectPeer(id) })) : activeTab === 'invite' ? (_jsx(InviteFlow, { displayName: displayName })) : (_jsx(AcceptFlow, { initialToken: deepLinkToken })) }), meshState.ownPeerId && (_jsxs("div", { style: s.footer, children: ["My peer ID:\u00A0", _jsxs("span", { style: { fontFamily: 'monospace', color: '#475569' }, children: [meshState.ownPeerId.slice(0, 12), "\u2026"] })] }))] }));
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
    root: {
        background: C.bg,
        color: C.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 320,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
    },
    tabBar: {
        display: 'flex',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
    },
    tabBtn: {
        flex: 1,
        padding: '8px 4px',
        border: 'none',
        borderBottom: '2px solid transparent',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        transition: 'all 0.15s',
    },
    body: {
        flex: 1,
        overflowY: 'auto',
        padding: 16,
    },
    footer: {
        fontSize: 10,
        color: C.muted,
        padding: '8px 16px',
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
    },
    emptyBox: {
        textAlign: 'center',
        padding: '32px 16px',
        border: `1px dashed ${C.border}`,
        borderRadius: 12,
        color: C.muted,
    },
    peerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: C.surface,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
    },
    leaveBtn: {
        background: 'transparent',
        border: `1px solid ${C.red}55`,
        borderRadius: 5,
        color: C.red,
        cursor: 'pointer',
        fontSize: 10,
        padding: '2px 8px',
    },
    tokenBox: {
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
    },
    primaryBtn: {
        background: '#1e3a5f',
        border: `1px solid ${C.accent}`,
        borderRadius: 8,
        color: C.accent,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        padding: '8px 16px',
        width: '100%',
        transition: 'opacity 0.15s',
    },
    ghostBtn: {
        background: 'transparent',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        color: C.muted,
        cursor: 'pointer',
        fontSize: 11,
        padding: '6px 12px',
    },
    input: {
        background: '#070d1a',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        color: C.text,
        fontSize: 12,
        padding: '8px 12px',
        width: '100%',
        outline: 'none',
        boxSizing: 'border-box',
    },
};
