import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMeshStatus } from './useMeshStatus';
const STRIP_STYLE = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '4px 12px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    fontSize: 12,
    color: '#a0a0a0',
    minHeight: 32,
};
const SHIMMER_STYLE = {
    ...STRIP_STYLE,
    justifyContent: 'center',
    color: '#707070',
    fontStyle: 'italic',
};
export function MeshStatusStrip() {
    const { connected, peerCount, pollAdvancing, frozenPeers, loading } = useMeshStatus();
    if (loading) {
        return _jsx("div", { style: SHIMMER_STYLE, children: "Connecting..." });
    }
    const peerLabel = `${peerCount} peer${peerCount !== 1 ? 's' : ''}`;
    const peerColor = peerCount > 0 ? '#a0a0a0' : connected ? '#f59e0b' : '#a0a0a0';
    return (_jsxs("div", { style: STRIP_STYLE, children: [_jsxs("span", { children: [connected ? '🟢' : '🔴', " Mesh: ", connected ? 'Online' : 'Offline'] }), _jsx("span", { style: { color: peerColor }, children: peerLabel }), _jsxs("span", { style: { color: pollAdvancing ? '#22c55e' : '#ef4444' }, children: ["Poll: ", pollAdvancing ? '▶ Active' : '✖ Stalled'] }), frozenPeers.length > 0 && (_jsxs("span", { style: {
                    color: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    padding: '2px 8px',
                    borderRadius: 4,
                }, children: ["\u26A0 ", frozenPeers.length, " peer", frozenPeers.length !== 1 ? 's' : '', " may be poll-frozen (", frozenPeers.join(', '), ")"] }))] }));
}
