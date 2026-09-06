import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// ConstellationSwitchboard.tsx — v0.4.1 BP083
// MIC crown badge + per-peer live progress display
//
// NotCents shape mapping (BP083 Founder ratified):
//   ▢ Square   = connected, idle
//   △ Triangle = connected, active interaction
//   ◯ Circle   = not connected
//   ★ Star     = current MIC role (NEW v0.4.0)
//
// Placement: Plow the Field tab (when constellation mode active) + future Package Store tab.
import { useState, useEffect, useRef, useCallback } from 'react';
import { getGlowTier } from '../utils/glow_tier';
const S = {
    container: {
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    heading: { fontSize: 12, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 },
    peerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        borderBottom: '1px solid rgba(99,102,241,0.1)',
    },
    peerShape: { fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 },
    peerName: { fontSize: 12, color: '#e2e8f0', flex: 1 },
    peerBadge: {
        fontSize: 10,
        background: 'rgba(110,231,183,0.1)',
        border: '1px solid rgba(110,231,183,0.3)',
        borderRadius: 4,
        padding: '1px 6px',
        color: '#6ee7b7',
    },
    peerCounter: { fontSize: 11, color: '#64748b' },
};
function getPeerShape(peer, micId) {
    if (micId && peer.id === micId)
        return '★'; // MIC crown
    if (!peer.online)
        return '◯'; // Not connected
    if (peer.active)
        return '△'; // Active interaction
    return '▢'; // Connected, idle
}
function getSelfShape(selfId, micId, active) {
    if (micId && selfId === micId)
        return '★';
    if (active)
        return '△';
    return '▢';
}
export function ConstellationSwitchboard({ peers, selfId, micId, selfEbletCount = 0, selfActive = false, selfDomain, pulsingPeerIds, }) {
    const [expanded, setExpanded] = useState(false);
    const isMic = micId === selfId;
    const onlineCount = peers.filter((p) => p.online).length;
    return (_jsxs("div", { style: S.container, children: [_jsxs("div", { style: { ...S.heading, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, onClick: () => setExpanded((e) => !e), children: [_jsxs("span", { children: ["\uD83C\uDF0C Constellation \u00B7 ", peers.length, " peer", peers.length !== 1 ? 's' : '', " (", onlineCount, " online)"] }), _jsx("span", { style: { fontSize: 10, color: '#6366f1' }, children: expanded ? '▲' : '▼' })] }), _jsxs("div", { style: S.peerRow, children: [_jsx("span", { style: { ...S.peerShape, color: isMic ? '#fbbf24' : selfActive ? '#6ee7b7' : '#475569' }, children: getSelfShape(selfId, micId, selfActive) }), _jsxs("span", { style: { ...S.peerName, fontWeight: isMic ? 700 : 400 }, children: ["This Machine (M0)", isMic ? ' · MIC' : ''] }), selfDomain && _jsx("span", { style: S.peerBadge, children: selfDomain }), selfEbletCount > 0 && _jsxs("span", { style: S.peerCounter, children: [selfEbletCount, " eblets"] })] }), expanded && peers.map((peer) => {
                const isMicPeer = micId === peer.id;
                const shape = getPeerShape(peer, micId);
                const isPulsing = pulsingPeerIds?.has(peer.id) ?? false;
                return (_jsxs("div", { className: isPulsing ? 'peer-row-pulse' : undefined, style: S.peerRow, title: `${peer.name} · ${peer.address ?? 'unknown'} · ${peer.installedDomains?.join(', ') ?? 'no domains'}`, children: [_jsx("span", { style: { ...S.peerShape, color: isMicPeer ? '#fbbf24' : peer.active ? '#6ee7b7' : peer.online ? '#64748b' : '#334155' }, children: shape }), _jsxs("span", { style: { ...S.peerName, color: peer.online ? '#e2e8f0' : '#475569', fontWeight: isMicPeer ? 700 : 400 }, children: [peer.name, isMicPeer ? ' · MIC' : ''] }), peer.currentDomain && _jsx("span", { style: S.peerBadge, children: peer.currentDomain }), peer.ebletCount > 0 && _jsxs("span", { style: S.peerCounter, children: [peer.ebletCount, " eblets"] }), !peer.online && _jsx("span", { style: { fontSize: 10, color: '#475569' }, children: "offline" })] }, peer.id));
            }), peers.length === 0 && expanded && (_jsx("p", { style: { fontSize: 11, color: '#475569', margin: '4px 0' }, children: "No peers configured. Add peers in Settings \u2192 Constellation." }))] }));
}
// ─── Live MIC Switchboard (hooks into mic:status-event) ──────────────────────
export function LiveMicSwitchboard() {
    const [peers, setPeers] = useState([]);
    const [micId, setMicId] = useState(null);
    const [selfEblets, setSelfEblets] = useState(0);
    const [selfActive, setSelfActive] = useState(false);
    const [selfDomain, setSelfDomain] = useState(undefined);
    // v0.4.1: per-peer pulse set for high-glow Diagnosis arrivals
    const [pulsingPeerIds, setPulsingPeerIds] = useState(new Set());
    const pulseTimerRefs = useRef(new Map());
    const pulsePeer = useCallback((peerId) => {
        setPulsingPeerIds((prev) => new Set([...prev, peerId]));
        const existing = pulseTimerRefs.current.get(peerId);
        if (existing)
            clearTimeout(existing);
        const t = setTimeout(() => {
            setPulsingPeerIds((prev) => {
                const next = new Set(prev);
                next.delete(peerId);
                return next;
            });
            pulseTimerRefs.current.delete(peerId);
        }, 1800);
        pulseTimerRefs.current.set(peerId, t);
    }, []);
    useEffect(() => {
        // Load initial peer list
        window.amplify?.micGetPeers?.().then((saved) => {
            if (Array.isArray(saved)) {
                setPeers(saved.map((p) => ({
                    id: p.id,
                    name: p.name,
                    online: p.online,
                    active: false,
                    ebletCount: 0,
                    pendingWorkload: p.pendingWorkload ?? 0,
                    address: p.address,
                    installedDomains: p.installedDomains ?? [],
                })));
            }
        }).catch(() => { });
        // v0.4.1: listen for incoming high-glow Diagnoses → pulse originating peer node
        const unsubDiagnosis = window.amplify?.onDiagnosisIncoming?.((data) => {
            const post = data;
            const marks = post?.bounty?.amount ?? 0;
            const tier = getGlowTier(marks);
            if ((tier === 'bright' || tier === 'golden') && post.posterId) {
                pulsePeer(post.posterId);
            }
        });
        // Listen for MIC status events
        const unsub = window.amplify?.onMicStatusEvent?.((event) => {
            const type = event.type;
            if (type === 'mic-start') {
                setMicId('self-m0');
                setSelfActive(true);
            }
            else if (type === 'workload-partitioned' && event.workload) {
                const wl = event.workload;
                if (wl.peers) {
                    setPeers(wl.peers.map((p) => ({ ...p, active: false, ebletCount: 0 })));
                }
            }
            else if (type === 'dispatch-sent' && event.peerId) {
                setPeers((prev) => prev.map((p) => p.id === event.peerId ? { ...p, active: true, currentDomain: event.domain } : p));
            }
            else if (type === 'peer-complete' && event.peerId) {
                setPeers((prev) => prev.map((p) => p.id === event.peerId ? { ...p, active: false, currentDomain: undefined } : p));
            }
            else if (type === 'self-progress') {
                setSelfActive(true);
                setSelfDomain(event.domain);
            }
            else if (type === 'complete') {
                setSelfActive(false);
                setSelfDomain(undefined);
                setPeers((prev) => prev.map((p) => ({ ...p, active: false, currentDomain: undefined })));
                setMicId(null);
            }
        });
        return () => {
            unsub?.();
            unsubDiagnosis?.();
        };
    }, [pulsePeer]);
    return (_jsx(ConstellationSwitchboard, { peers: peers, selfId: "self-m0", micId: micId, selfEbletCount: selfEblets, selfActive: selfActive, selfDomain: selfDomain, pulsingPeerIds: pulsingPeerIds }));
}
