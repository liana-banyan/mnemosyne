// SEG-K23-B — Mesh status hook for compact health strip
// Polls getMeshState + pollerHealthQuery; detects poll-frozen peers via lastSeen streak
import { useCallback, useEffect, useRef, useState } from 'react';
function getAmplify() {
    return window.amplify;
}
const ACTIVE_PHASES = new Set(['synced', 'ratified']);
function detectFrozenPeers(peers, streakMap) {
    const frozen = [];
    const nextMap = new Map();
    for (const peer of peers) {
        if (!ACTIVE_PHASES.has(peer.phase))
            continue;
        const prev = streakMap.get(peer.peerId);
        if (prev && prev.lastSeen === peer.lastSeen) {
            const streak = prev.streak + 1;
            nextMap.set(peer.peerId, { lastSeen: peer.lastSeen, streak });
            if (streak >= 2)
                frozen.push(peer.peerId);
        }
        else {
            nextMap.set(peer.peerId, { lastSeen: peer.lastSeen, streak: 0 });
        }
    }
    return { frozen, nextMap };
}
export function useMeshStatus() {
    const [connected, setConnected] = useState(false);
    const [peerCount, setPeerCount] = useState(0);
    const [pollAdvancing, setPollAdvancing] = useState(false);
    const [frozenPeers, setFrozenPeers] = useState([]);
    const [loading, setLoading] = useState(true);
    const lastSeenStreakRef = useRef(new Map());
    const applyMeshState = useCallback((state) => {
        setConnected(state.relayConnected);
        setPeerCount(state.peers.length);
        const { frozen, nextMap } = detectFrozenPeers(state.peers, lastSeenStreakRef.current);
        lastSeenStreakRef.current = nextMap;
        setFrozenPeers(frozen);
    }, []);
    const loadMesh = useCallback(async () => {
        try {
            const state = await getAmplify()?.getMeshState?.();
            if (state)
                applyMeshState(state);
        }
        catch {
            /* non-fatal */
        }
        finally {
            setLoading(false);
        }
    }, [applyMeshState]);
    useEffect(() => {
        void loadMesh();
        const iv = setInterval(() => void loadMesh(), 5000);
        const cleanupMesh = getAmplify()?.onMeshStateChanged?.((state) => {
            applyMeshState(state);
            setLoading(false);
        });
        const cleanupRelay = getAmplify()?.onRelayStateChanged?.((s) => {
            setConnected(s.relayConnected);
        });
        return () => {
            clearInterval(iv);
            cleanupMesh?.();
            cleanupRelay?.();
        };
    }, [loadMesh, applyMeshState]);
    useEffect(() => {
        async function fetchPollerHealth() {
            try {
                const h = await getAmplify()?.pollerHealthQuery?.();
                if (h)
                    setPollAdvancing(h.alive);
            }
            catch {
                /* non-fatal */
            }
        }
        void fetchPollerHealth();
        const interval = setInterval(() => void fetchPollerHealth(), 5000);
        return () => clearInterval(interval);
    }, []);
    return { connected, peerCount, pollAdvancing, frozenPeers, loading };
}
