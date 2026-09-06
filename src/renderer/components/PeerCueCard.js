import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// PeerCueCard.tsx — SEG-V0153A-P0-PEER-CUE-CARDS BP079
// Peer card for FederationTab Roster/Mesh view + Social tab (BP132 Yoke #22).
// Inline styles only — no Tailwind, no CSS files. Matches WelcomeCueCard.tsx pattern.
//
// BP132 Yoke #22 Addendum A: the stale note this comment used to carry (claiming
// `federation:connect-peer` did not exist) was checked against current source and
// found to be OUT OF DATE — the handler + preload exposure (`federationConnectPeer`)
// already exist (src/main/index.ts ~3473, preload.ts ~457). Callers (FederationTab.tsx)
// have been fixed to use it instead of the federationAcceptInvite stopgap.
import { useState } from 'react';
// ─── Phase color map (replicated from FederationPeerMeshPanel.tsx) ────────────
const PHASE_COLOR = {
    discovered: '#f59e0b',
    identified: '#60a5fa',
    ratified: '#a78bfa',
    synced: '#22c55e',
    error: '#ef4444',
};
// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatLastSeen(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)
        return 'just now';
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)
        return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
}
// ─── Component ────────────────────────────────────────────────────────────────
export function PeerCueCard({ peer, onConnect }) {
    const [connecting, setConnecting] = useState(false);
    const isSynced = peer.phase === 'synced';
    const phaseColor = PHASE_COLOR[peer.phase];
    const displayName = peer.displayName ?? peer.peerId.slice(0, 8);
    const handleClick = () => {
        if (isSynced || connecting)
            return;
        setConnecting(true);
        onConnect(peer.peerId);
        setTimeout(() => setConnecting(false), 1500);
    };
    const cardStyle = {
        width: 240,
        minHeight: 160,
        background: '#111827',
        border: isSynced ? '1px solid rgba(34, 197, 94, 0.27)' : '1px solid #1e2d45',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
    };
    const isLan = peer.transport === 'lan';
    const transportBadgeStyle = isLan
        ? { background: '#0c1a2e', color: '#60a5fa', fontSize: 11, padding: '2px 6px', borderRadius: 4 }
        : { background: '#1a0c2e', color: '#a78bfa', fontSize: 11, padding: '2px 6px', borderRadius: 4 };
    const phaseBadgeStyle = {
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: 10,
        background: phaseColor + '22',
        color: phaseColor,
        border: `1px solid ${phaseColor}55`,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        alignSelf: 'flex-start',
    };
    const btnDisabled = isSynced || connecting;
    const btnStyle = {
        width: '100%',
        padding: '8px 0',
        background: '#14532d',
        border: '1px solid #22c55e',
        color: '#22c55e',
        borderRadius: 8,
        cursor: btnDisabled ? 'default' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        opacity: btnDisabled ? 0.5 : 1,
        marginTop: 'auto',
        transition: 'opacity 0.1s',
    };
    let btnText = 'Connect';
    if (isSynced)
        btnText = 'Synced ✓';
    else if (connecting)
        btnText = 'Connecting…';
    return (_jsxs("div", { style: cardStyle, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsx("div", { style: {
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#e2e8f0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0,
                        }, children: displayName }), _jsx("span", { style: transportBadgeStyle, children: isLan ? '🔵 LAN' : '🌐 WAN' })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx("span", { style: phaseBadgeStyle, children: peer.phase }), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: ["Last seen: ", formatLastSeen(peer.lastSeen)] })] }), _jsx("button", { type: "button", onClick: handleClick, disabled: btnDisabled, style: btnStyle, children: btnText })] }));
}
export default PeerCueCard;
