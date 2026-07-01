// SEG-K23-B — Mesh status hook for compact health strip
// Polls getMeshState + pollerHealthQuery; detects poll-frozen peers via lastSeen streak

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MnemosynePeer } from '../../../shared/federation-protocol';

export interface MeshStatus {
  connected: boolean;
  peerCount: number;
  pollAdvancing: boolean;
  frozenPeers: string[];
  loading: boolean;
}

interface MeshState {
  peers: MnemosynePeer[];
  relayConnected: boolean;
  ownPeerId: string;
}

interface PollerHealth {
  alive: boolean;
  uptime_seconds: number;
  last_route_processed_at: string | null;
  last_route_id: string | null;
  restart_count: number;
  ollama_status: 'up' | 'down';
  current_consecutive_crashes: number;
}

/** Bridge methods not yet declared on renderer amplify.d.ts */
interface AmplifyMeshBridge {
  getMeshState?: () => Promise<MeshState>;
  onMeshStateChanged?: (cb: (state: MeshState) => void) => () => void;
  onRelayStateChanged?: (cb: (state: { relayConnected: boolean }) => void) => () => void;
  pollerHealthQuery?: () => Promise<PollerHealth>;
}

function getAmplify(): AmplifyMeshBridge | undefined {
  return window.amplify as AmplifyMeshBridge | undefined;
}

const ACTIVE_PHASES = new Set<MnemosynePeer['phase']>(['synced', 'ratified']);

function detectFrozenPeers(
  peers: MnemosynePeer[],
  streakMap: Map<string, { lastSeen: string; streak: number }>,
): { frozen: string[]; nextMap: Map<string, { lastSeen: string; streak: number }> } {
  const frozen: string[] = [];
  const nextMap = new Map<string, { lastSeen: string; streak: number }>();

  for (const peer of peers) {
    if (!ACTIVE_PHASES.has(peer.phase)) continue;

    const prev = streakMap.get(peer.peerId);
    if (prev && prev.lastSeen === peer.lastSeen) {
      const streak = prev.streak + 1;
      nextMap.set(peer.peerId, { lastSeen: peer.lastSeen, streak });
      if (streak >= 2) frozen.push(peer.peerId);
    } else {
      nextMap.set(peer.peerId, { lastSeen: peer.lastSeen, streak: 0 });
    }
  }

  return { frozen, nextMap };
}

export function useMeshStatus(): MeshStatus {
  const [connected, setConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [pollAdvancing, setPollAdvancing] = useState(false);
  const [frozenPeers, setFrozenPeers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const lastSeenStreakRef = useRef<Map<string, { lastSeen: string; streak: number }>>(new Map());

  const applyMeshState = useCallback((state: MeshState) => {
    setConnected(state.relayConnected);
    setPeerCount(state.peers.length);

    const { frozen, nextMap } = detectFrozenPeers(state.peers, lastSeenStreakRef.current);
    lastSeenStreakRef.current = nextMap;
    setFrozenPeers(frozen);
  }, []);

  const loadMesh = useCallback(async () => {
    try {
      const state = await getAmplify()?.getMeshState?.();
      if (state) applyMeshState(state);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [applyMeshState]);

  useEffect(() => {
    void loadMesh();
    const iv = setInterval(() => void loadMesh(), 5000);

    const cleanupMesh = getAmplify()?.onMeshStateChanged?.((state: MeshState) => {
      applyMeshState(state);
      setLoading(false);
    });

    const cleanupRelay = getAmplify()?.onRelayStateChanged?.((s: { relayConnected: boolean }) => {
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
        if (h) setPollAdvancing(h.alive);
      } catch {
        /* non-fatal */
      }
    }

    void fetchPollerHealth();
    const interval = setInterval(() => void fetchPollerHealth(), 5000);
    return () => clearInterval(interval);
  }, []);

  return { connected, peerCount, pollAdvancing, frozenPeers, loading };
}
