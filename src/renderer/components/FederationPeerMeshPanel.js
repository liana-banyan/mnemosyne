import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// MnemosyneC — Federation Peer Mesh Panel
// MV-CN Cross-Network Mesh · SAGA 3 BP045 W1
//
// Surfaces discovered peers (LAN + WAN relay), their handshake phase,
// and the relay connection status. Mounts inside HearthConjunctionWindow
// or the AMPLIFY Dashboard (wired via IPC).
import { useEffect, useState, useCallback } from 'react';
const TIER_COLOR = {
    member: '#D4AF37',
    base: '#22c55e',
    unknown: '#475569',
};
// ─── Phase badge ──────────────────────────────────────────────────────────────
const PHASE_COLOR = {
    discovered: '#f59e0b',
    identified: '#60a5fa',
    ratified: '#a78bfa',
    synced: '#22c55e',
    error: '#ef4444',
};
const PHASE_LABEL = {
    discovered: 'Discovered',
    identified: 'Identified',
    ratified: 'Ratified',
    synced: 'Synced ✓',
    error: 'Error',
};
function PhaseBadge({ phase }) {
    return (_jsx("span", { style: {
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 10,
            background: PHASE_COLOR[phase] + '22',
            color: PHASE_COLOR[phase],
            border: `1px solid ${PHASE_COLOR[phase]}55`,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
        }, children: PHASE_LABEL[phase] }));
}
// ─── Peer row ─────────────────────────────────────────────────────────────────
function PeerRow({ peer }) {
    const transportLabel = peer.transport === 'lan' ? '🔵 LAN' : '🌐 WAN';
    const ago = Math.round((Date.now() - new Date(peer.lastSeen).getTime()) / 1000);
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 6,
            gap: 8,
        }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }, children: peer.displayName ?? peer.peerId.slice(0, 8) + '…' }), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: [transportLabel, " \u00B7 ", peer.address === 'relay' ? 'via relay' : peer.address, ' · ', "seen ", ago, "s ago"] })] }), _jsx(PhaseBadge, { phase: peer.phase })] }));
}
// ─── Main panel ───────────────────────────────────────────────────────────────
export function FederationPeerMeshPanel() {
    const [meshState, setMeshState] = useState({
        peers: [],
        relayConnected: false,
        ownPeerId: '',
    });
    const [loading, setLoading] = useState(true);
    const [relayTier, setRelayTier] = useState('unknown');
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
    const loadTier = useCallback(async () => {
        try {
            const result = await window.amplify?.getRelayTier?.();
            if (result?.tier)
                setRelayTier(result.tier);
        }
        catch { /* ignore */ }
    }, []);
    useEffect(() => {
        loadMesh();
        loadTier();
        const iv = setInterval(loadMesh, 5000);
        const tierIv = setInterval(loadTier, 30000);
        const cleanup1 = window.amplify?.onMeshStateChanged?.((state) => {
            setMeshState(state);
        });
        const cleanup2 = window.amplify?.onRelayStateChanged?.((s) => {
            setMeshState((prev) => ({ ...prev, ...s }));
            // Refresh tier on relay reconnect
            void loadTier();
        });
        return () => {
            clearInterval(iv);
            clearInterval(tierIv);
            cleanup1?.();
            cleanup2?.();
        };
    }, [loadMesh, loadTier]);
    const lanPeers = meshState.peers.filter((p) => p.transport === 'lan');
    const wanPeers = meshState.peers.filter((p) => p.transport === 'wan-relay');
    const syncedCount = meshState.peers.filter((p) => p.phase === 'synced').length;
    return (_jsxs("div", { style: {
            padding: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#e2e8f0',
            minWidth: 280,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#f8fafc' }, children: "Peer Mesh" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { style: {
                                    fontSize: 12,
                                    color: meshState.relayConnected
                                        ? (TIER_COLOR[relayTier] ?? TIER_COLOR.base)
                                        : '#475569',
                                }, children: "\u25CF" }), _jsx("span", { style: { fontSize: 10, color: meshState.relayConnected ? (TIER_COLOR[relayTier] ?? TIER_COLOR.base) : '#475569' }, children: meshState.relayConnected
                                    ? `Connected · ${relayTier === 'member' ? 'Member' : relayTier === 'base' ? 'Base' : 'Connecting...'}`
                                    : 'Relay offline' })] })] }), _jsx("div", { style: {
                    display: 'flex', gap: 8, marginBottom: 14,
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                }, children: [
                    { label: 'Total', value: meshState.peers.length },
                    { label: 'LAN', value: lanPeers.length },
                    { label: 'WAN', value: wanPeers.length },
                    { label: 'Synced', value: syncedCount, highlight: syncedCount > 0 },
                ].map(({ label, value, highlight }) => (_jsxs("div", { style: { flex: 1, textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, color: highlight ? '#22c55e' : '#94a3b8' }, children: value }), _jsx("div", { style: { fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }, children: label })] }, label))) }), meshState.ownPeerId && (_jsxs("div", { style: { fontSize: 10, color: '#334155', marginBottom: 12 }, children: ["My peer ID: ", _jsx("span", { style: { color: '#475569', fontFamily: 'monospace' }, children: meshState.ownPeerId })] })), loading ? (_jsx("div", { style: { fontSize: 11, color: '#475569', textAlign: 'center', padding: 12 }, children: "Scanning\u2026" })) : meshState.peers.length === 0 ? (_jsxs("div", { style: {
                    fontSize: 11, color: '#334155', textAlign: 'center', padding: 16,
                    border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 8,
                }, children: ["No peers discovered yet.", _jsx("br", {}), _jsxs("span", { style: { color: '#475569' }, children: ["Other MnemosyneC instances on your network", _jsx("br", {}), "will appear here automatically."] })] })) : (_jsxs(_Fragment, { children: [lanPeers.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "\uD83D\uDD35 Local Network" }), lanPeers.map((p) => _jsx(PeerRow, { peer: p }, p.peerId))] })), wanPeers.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "\uD83C\uDF10 Cross-Network (relay)" }), wanPeers.map((p) => _jsx(PeerRow, { peer: p }, p.peerId))] }))] }))] }));
}
