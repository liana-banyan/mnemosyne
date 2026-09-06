import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// P2P Discovery Panel — MnemosyneC™ v0.1.8 · SEG-FT-3 · BP052 NOVACULA
// LAN peer discovery status panel — no cloud relay.
import { useState, useEffect, useCallback } from 'react';
function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000)
        return 'just now';
    if (diff < 3600000)
        return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
}
export function P2PDiscoveryPanel() {
    const [peers, setPeers] = useState([]);
    const [active, setActive] = useState(false);
    const [toggling, setToggling] = useState(false);
    const refresh = useCallback(async () => {
        try {
            const result = await window.amplify?.kitchenTable?.p2pPeers?.();
            if (result) {
                setPeers(result.peers ?? []);
                setActive(result.active ?? false);
            }
        }
        catch {
            // IPC unavailable
        }
    }, []);
    useEffect(() => {
        void refresh();
        const id = setInterval(() => { void refresh(); }, 10000);
        return () => clearInterval(id);
    }, [refresh]);
    async function handleToggle() {
        setToggling(true);
        try {
            if (active) {
                await window.amplify?.kitchenTable?.p2pStop?.();
                setActive(false);
                setPeers([]);
            }
            else {
                const peerId = localStorage.getItem('mnemo_peer_id') ?? Math.random().toString(36).slice(2);
                localStorage.setItem('mnemo_peer_id', peerId);
                const displayName = localStorage.getItem('mnemo_display_name') ?? 'MnemosyneC™';
                await window.amplify?.kitchenTable?.p2pStart?.(peerId, displayName);
                setActive(true);
                setTimeout(() => { void refresh(); }, 2000);
            }
        }
        catch {
            // IPC unavailable
        }
        finally {
            setToggling(false);
        }
    }
    const capColor = {
        kitchen_table: '#6ee7b7',
        atlas: '#38bdf8',
    };
    return (_jsxs("div", { style: {
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(100,116,139,0.15)',
            borderRadius: 8,
            padding: '10px 12px',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [active && (_jsx("span", { style: {
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: '#22c55e',
                                    boxShadow: '0 0 6px #22c55e',
                                    display: 'inline-block',
                                    animation: 'pulse 2s infinite',
                                }, title: "Discovery active" })), _jsx("span", { style: { fontSize: 11, fontWeight: 600, color: active ? '#e2e8f0' : '#64748b' }, children: active ? 'Discovery Active' : 'Discovery Off' }), _jsxs("span", { style: { fontSize: 10, color: '#475569' }, children: ["\u00B7 ", peers.length, " peer", peers.length !== 1 ? 's' : '', " found"] })] }), _jsx("button", { onClick: handleToggle, disabled: toggling, style: {
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: toggling ? 'wait' : 'pointer',
                            border: active ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(110,231,183,0.3)',
                            background: active ? 'rgba(248,113,113,0.06)' : 'rgba(110,231,183,0.06)',
                            color: active ? '#f87171' : '#6ee7b7',
                            opacity: toggling ? 0.6 : 1,
                        }, children: toggling ? '…' : active ? 'Stop' : 'Start' })] }), peers.length === 0 && active && (_jsx("div", { style: { fontSize: 10, color: '#475569', textAlign: 'center', padding: '8px 0' }, children: "Listening for peers on LAN \u2014 no peers found yet" })), peers.length === 0 && !active && (_jsx("div", { style: { fontSize: 10, color: '#334155', textAlign: 'center', padding: '8px 0' }, children: "Start discovery to find other MnemosyneC\u2122 instances on your network" })), peers.map((peer) => (_jsxs("div", { style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid rgba(100,116,139,0.08)',
                    gap: 8,
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0' }, children: peer.displayName }), _jsxs("div", { style: { fontSize: 9, color: '#475569', marginTop: 1 }, children: [relativeTime(peer.lastSeen), " \u00B7 ", peer.trustLevel] })] }), _jsx("div", { style: { display: 'flex', gap: 3, flexWrap: 'wrap' }, children: peer.capabilities.map((cap) => (_jsx("span", { style: {
                                fontSize: 8, borderRadius: 8, padding: '1px 5px',
                                border: `1px solid ${capColor[cap] ?? '#64748b'}20`,
                                color: capColor[cap] ?? '#64748b',
                                background: `${capColor[cap] ?? '#64748b'}0d`,
                            }, children: cap }, cap))) })] }, peer.peerId)))] }));
}
